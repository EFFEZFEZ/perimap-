/**
 * busPositionCalculator.js
 * * Calcule les positions géographiques interpolées des bus entre deux arrêts
 * * OPTIMISÉ V306 (Correction Temps Réel):
 * * - V305: Intégration temps réel pour ajustement de vitesse
 * * - V306: Validation de cohérence RT pour éviter positions aberrantes
 * * - V306: Indicateur de confiance (hasRealtime, isEstimated)
 * * - V306: Correction du problème "bus face à soi mais absent de la carte"
 */

export class BusPositionCalculator {
    constructor(dataManager, realtimeManager = null) {
        this.dataManager = dataManager;
        this.realtimeManager = realtimeManager; // V305: Référence au manager RT
        
        // Cache pour stocker les géométries pré-calculées entre deux arrêts
        // Clé: "routeId_fromStopId_toStopId"
        // Valeur: { path: [[lon,lat]...], distances: [0, d1, d2...], totalDistance: 1500 }
        this.segmentCache = new Map();
        
        // V305: Cache des ajustements RT par trip
        // Clé: tripId, Valeur: { rtMinutes, fetchedAt, adjustedProgress }
        this.rtAdjustmentCache = new Map();
        this.rtCacheMaxAge = 30000; // 30 secondes
        
        // V306: Seuils de validation pour éviter positions aberrantes
        this.validationThresholds = {
            maxProgressJump: 0.5,        // Max 50% de saut de progress en une mise à jour
            maxRtDeviation: 0.3,         // Max 30% de déviation RT vs théorique avant alerte
            minSegmentDuration: 30,      // 30 secondes minimum entre 2 arrêts
            rtFreshnessLimit: 60000      // Données RT valables 60 secondes max
        };
    }
    
    /**
     * V305: Configure le realtimeManager (peut être défini après construction)
     */
    setRealtimeManager(rtManager) {
        this.realtimeManager = rtManager;
    }

    /**
     * Calcule la position interpolée d'un bus entre deux arrêts
     * V306: Amélioration avec validation de cohérence et indicateurs de confiance
     */
    calculatePosition(segment, routeId = null, tripId = null, routeShortName = null) {
        if (!segment || !segment.fromStopInfo || !segment.toStopInfo) {
            return null;
        }

        const fromLat = parseFloat(segment.fromStopInfo.stop_lat);
        const fromLon = parseFloat(segment.fromStopInfo.stop_lon);
        const toLat = parseFloat(segment.toStopInfo.stop_lat);
        const toLon = parseFloat(segment.toStopInfo.stop_lon);

        // Vérification de base des coordonnées
        if (isNaN(fromLat) || isNaN(fromLon) || isNaN(toLat) || isNaN(toLon)) {
            return null;
        }

        // V306: Récupérer le progress théorique (basé sur l'heure)
        let theoreticalProgress = segment.progress; // 0.0 à 1.0
        let finalProgress = theoreticalProgress;
        let rtInfo = null;
        let positionConfidence = 'theoretical'; // 'realtime', 'adjusted', 'theoretical'
        
        // V306: Tenter d'ajuster avec le temps réel
        if (tripId && routeShortName && this.realtimeManager) {
            rtInfo = this.getRealtimeAdjustedProgress(
                tripId, 
                routeShortName, 
                segment.toStopInfo.stop_id,
                segment.toStopInfo.stop_code,
                segment.departureTime,
                segment.arrivalTime
            );
            
            if (rtInfo && rtInfo.adjustedProgress !== null) {
                // V306: Valider la cohérence du progress RT
                const validatedProgress = this.validateRtProgress(
                    theoreticalProgress, 
                    rtInfo.adjustedProgress,
                    rtInfo.isRealtime
                );
                
                finalProgress = validatedProgress.progress;
                positionConfidence = validatedProgress.confidence;
                
                // V306: Enrichir rtInfo avec les infos de validation
                rtInfo.validated = validatedProgress.isValid;
                rtInfo.deviation = validatedProgress.deviation;
                rtInfo.confidence = positionConfidence;
            }
        }

        // Tenter d'utiliser le tracé GeoJSON précis si disponible
        if (routeId) {
            const routeGeometry = this.dataManager.getRouteGeometry(routeId);
            const routeCoordinates = this.extractRouteCoordinates(routeGeometry);
            if (routeCoordinates && routeCoordinates.length > 0) {
                const position = this.interpolateAlongRouteCached(
                    routeId,
                    segment.fromStopInfo.stop_id,
                    segment.toStopInfo.stop_id,
                    routeCoordinates, 
                    fromLat, fromLon, 
                    toLat, toLon, 
                    finalProgress
                );
                if (position) {
                    // V306: Ajouter les infos enrichies à la position
                    position.rtInfo = rtInfo;
                    position.confidence = positionConfidence;
                    position.hasRealtime = rtInfo?.isRealtime === true;
                    position.isEstimated = positionConfidence !== 'realtime';
                    return position;
                }
            }
        }

        // Fallback: Interpolation linéaire simple (ligne droite) si pas de GeoJSON
        // ou si le calcul géométrique a échoué
        const lat = fromLat + (toLat - fromLat) * finalProgress;
        const lon = fromLon + (toLon - fromLon) * finalProgress;

        return {
            lat,
            lon,
            progress: finalProgress,
            bearing: this.calculateLinearBearing(fromLat, fromLon, toLat, toLon),
            rtInfo,
            confidence: positionConfidence,
            hasRealtime: rtInfo?.isRealtime === true,
            isEstimated: positionConfidence !== 'realtime'
        };
    }
    
    /**
     * V306: Valide la cohérence du progress temps réel par rapport au théorique
     * Évite les sauts brusques de position qui peuvent perdre la confiance utilisateur
     * 
     * @param {number} theoreticalProgress - Progress calculé depuis l'horaire
     * @param {number} rtProgress - Progress calculé depuis le temps réel
     * @param {boolean} isRealtime - Si la donnée vient bien du temps réel (pas théorique)
     * @returns {Object} { progress, confidence, isValid, deviation }
     */
    validateRtProgress(theoreticalProgress, rtProgress, isRealtime) {
        const deviation = Math.abs(rtProgress - theoreticalProgress);
        
        // Si pas de données temps réel réelles, utiliser le théorique
        if (!isRealtime) {
            return {
                progress: theoreticalProgress,
                confidence: 'theoretical',
                isValid: true,
                deviation: 0
            };
        }
        
        // Cas 1: Déviation acceptable (< 30%) - Utiliser le temps réel
        if (deviation <= this.validationThresholds.maxRtDeviation) {
            return {
                progress: rtProgress,
                confidence: 'realtime',
                isValid: true,
                deviation
            };
        }
        
        // Cas 2: Déviation modérée (30-50%) - Moyenne pondérée RT/théorique
        if (deviation <= this.validationThresholds.maxProgressJump) {
            // Pondérer 70% RT, 30% théorique pour lisser les sauts
            const smoothedProgress = rtProgress * 0.7 + theoreticalProgress * 0.3;
            return {
                progress: smoothedProgress,
                confidence: 'adjusted',
                isValid: true,
                deviation
            };
        }
        
        // Cas 3: Déviation trop grande (> 50%) - Probablement erreur, utiliser théorique
        // Cela évite qu'un bus "saute" brutalement sur la carte
        console.warn(`[BusPosition] Déviation RT trop grande: ${(deviation * 100).toFixed(1)}% - utilisation théorique`);
        return {
            progress: theoreticalProgress,
            confidence: 'theoretical',
            isValid: false,
            deviation
        };
    }
    
    /**
     * V305: Calcule le progress ajusté basé sur les données temps réel
     * 
     * Logique:
     * - Le temps RT indique dans combien de minutes le bus arrive au prochain arrêt
     * - On recalcule le progress basé sur ce temps restant
     * 
     * @returns {Object|null} { rtMinutes, adjustedProgress, isRealtime }
     */
    getRealtimeAdjustedProgress(tripId, routeShortName, toStopId, toStopCode, departureTime, arrivalTime) {
        if (!this.realtimeManager) return null;
        
        // Vérifier le cache d'ajustement RT
        const cacheKey = `${tripId}_${toStopId}`;
        const cached = this.rtAdjustmentCache.get(cacheKey);
        if (cached && Date.now() - cached.fetchedAt < this.rtCacheMaxAge) {
            return cached;
        }
        
        // Chercher les données RT pour cet arrêt
        if (!this.realtimeManager.hasRealtimeDataForStop(toStopId, toStopCode)) {
            return null;
        }
        
        // Récupérer le cache RT directement (synchrone)
        const hawkKey = this.realtimeManager.cache ? 
            Array.from(this.realtimeManager.cache.keys()).find(k => k.includes(toStopCode || toStopId)) : null;
        
        if (!hawkKey) return null;
        
        const cachedRT = this.realtimeManager.cache.get(hawkKey);
        if (!cachedRT || !cachedRT.data || !cachedRT.data.departures) return null;
        
        // Chercher un départ correspondant à cette ligne
        const normalizedLine = routeShortName?.toUpperCase?.() || '';
        const matchingDeparture = cachedRT.data.departures.find(d => 
            d.line?.toUpperCase() === normalizedLine
        );
        
        if (!matchingDeparture) return null;
        
        // Parser le temps d'attente RT
        const rtMinutes = this.realtimeManager.parseTemps(matchingDeparture.time);
        if (rtMinutes === null || rtMinutes >= 999) return null;
        
        // Calculer le progress ajusté
        // Le temps statique total du segment
        const totalStaticSeconds = arrivalTime - departureTime;
        if (totalStaticSeconds <= 0) return null;
        
        // Temps restant selon RT (en secondes)
        const rtRemainingSeconds = rtMinutes * 60;
        
        // Progress = 1 - (temps_restant / temps_total)
        // Si RT dit "5 min" et le segment total est 10 min, progress = 0.5
        let adjustedProgress = 1 - (rtRemainingSeconds / totalStaticSeconds);
        
        // Clamper entre 0 et 1
        adjustedProgress = Math.max(0, Math.min(1, adjustedProgress));
        
        const result = {
            rtMinutes,
            adjustedProgress,
            isRealtime: matchingDeparture.realtime !== false,
            fetchedAt: Date.now()
        };
        
        // Mettre en cache
        this.rtAdjustmentCache.set(cacheKey, result);
        
        return result;
    }

    /**
     * Version optimisée avec Mémorisation (Caching)
     */
    interpolateAlongRouteCached(routeId, fromStopId, toStopId, routeCoordinates, fromLat, fromLon, toLat, toLon, progress) {
        // 1. Générer une clé unique pour ce segment spécifique
        const cacheKey = `${routeId}_${fromStopId}_${toStopId}`;

        let segmentData = this.segmentCache.get(cacheKey);

        // 2. Si pas en cache, on fait le calcul LOURD (une seule fois)
        if (!segmentData) {
            segmentData = this.computeSegmentGeometry(routeCoordinates, fromLat, fromLon, toLat, toLon);
            
            if (segmentData) {
                this.segmentCache.set(cacheKey, segmentData);
            } else {
                // Si échec du calcul (points non trouvés sur la ligne), on marque comme invalide pour ne pas réessayer
                this.segmentCache.set(cacheKey, { invalid: true });
                return null;
            }
        }

        // 3. Si le segment est marqué invalide, on abandonne
        if (segmentData.invalid) return null;

        // 4. INTERPOLATION RAPIDE (Zéro trigonométrie ici)
        const targetDistance = segmentData.totalDistance * progress;
        const distances = segmentData.distances;
        const path = segmentData.path;

        // Trouver le sous-segment correspondant à la distance cible
        // On cherche i tel que distances[i] <= targetDistance <= distances[i+1]
        for (let i = 0; i < distances.length - 1; i++) {
            if (targetDistance >= distances[i] && targetDistance <= distances[i + 1]) {
                
                const distStart = distances[i];
                const distEnd = distances[i + 1];
                const segmentLen = distEnd - distStart;

                // Progression locale dans ce petit sous-segment
                const localProgress = segmentLen > 0 ? (targetDistance - distStart) / segmentLen : 0;

                const [lon1, lat1] = path[i];
                const [lon2, lat2] = path[i + 1];

                // Interpolation linéaire simple sur les coordonnées
                const lat = lat1 + (lat2 - lat1) * localProgress;
                const lon = lon1 + (lon2 - lon1) * localProgress;

                return { lat, lon, progress };
            }
        }

        // Cas limite (fin du trajet)
        const lastPoint = path[path.length - 1];
        return { lat: lastPoint[1], lon: lastPoint[0], progress };
    }

    /**
     * Le calcul lourd : Trouve les points les plus proches, coupe la ligne et mesure les distances.
     * N'est exécuté qu'une fois par segment.
     */
    computeSegmentGeometry(routeCoordinates, fromLat, fromLon, toLat, toLon) {
        // Trouver les indices sur le tracé global
        const fromIndex = this.dataManager.findNearestPointOnRoute(routeCoordinates, fromLat, fromLon);
        const toIndex = this.dataManager.findNearestPointOnRoute(routeCoordinates, toLat, toLon);

        if (fromIndex === null || toIndex === null || fromIndex === toIndex) {
            return null; 
        }

        // Extraire le sous-tracé
        let pathSegment;
        if (fromIndex < toIndex) {
            pathSegment = routeCoordinates.slice(fromIndex, toIndex + 1);
        } else {
            // Cas aller-retour ou boucle mal gérée par l'indexation simple
            pathSegment = routeCoordinates.slice(toIndex, fromIndex + 1).reverse();
        }

        if (pathSegment.length < 2) return null;

        // Calculer les distances cumulées (La partie coûteuse en CPU)
        const distances = [0];
        let totalDistance = 0;

        for (let i = 1; i < pathSegment.length; i++) {
            const [lon1, lat1] = pathSegment[i - 1];
            const [lon2, lat2] = pathSegment[i];
            
            // Appel à DataManager pour Haversine
            const dist = this.dataManager.calculateDistance(lat1, lon1, lat2, lon2);
            
            totalDistance += dist;
            distances.push(totalDistance);
        }

        if (totalDistance === 0) return null;

        return {
            path: pathSegment,
            distances: distances,
            totalDistance: totalDistance
        };
    }

    /**
     * Calcule l'angle de déplacement (Bearing)
     */
    calculateBearing(segment) {
        // Nous utilisons ici une approximation simple basée sur le mouvement linéaire
        // pour éviter de recalculer l'angle complexe à chaque micro-mouvement.
        // Pour plus de précision, on pourrait stocker les bearings dans le cache,
        // mais cela suffit généralement pour l'orientation de l'icône.
        if (!segment || !segment.fromStopInfo || !segment.toStopInfo) return 0;
        
        const fromLat = parseFloat(segment.fromStopInfo.stop_lat);
        const fromLon = parseFloat(segment.fromStopInfo.stop_lon);
        const toLat = parseFloat(segment.toStopInfo.stop_lat);
        const toLon = parseFloat(segment.toStopInfo.stop_lon);

        return this.calculateLinearBearing(fromLat, fromLon, toLat, toLon);
    }

    extractRouteCoordinates(geometry) {
        if (!geometry) return null;
        if (Array.isArray(geometry)) return geometry;
        if (geometry.type === 'LineString') return geometry.coordinates;
        if (geometry.type === 'MultiLineString') return geometry.coordinates.flat();
        return null;
    }

    /**
     * Helper pour calculer l'angle entre deux points (utilisé en fallback et pour l'orientation globale)
     */
    calculateLinearBearing(lat1, lon1, lat2, lon2) {
        const toRad = (deg) => deg * Math.PI / 180;
        const toDeg = (rad) => rad * 180 / Math.PI;

        const phi1 = toRad(lat1);
        const phi2 = toRad(lat2);
        const deltaLambda = toRad(lon2 - lon1);

        const y = Math.sin(deltaLambda) * Math.cos(phi2);
        const x = Math.cos(phi1) * Math.sin(phi2) -
                  Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

        let bearing = Math.atan2(y, x);
        return (toDeg(bearing) + 360) % 360;
    }

    /**
     * Calcule toutes les positions pour les bus actifs
     * V305: Intègre les données RT pour ajuster les positions
     */
    calculateAllPositions(allBuses) {
        return allBuses.map(bus => {
            const routeId = bus.route?.route_id;
            const routeShortName = bus.route?.route_short_name;
            const tripId = bus.tripId;
            let position = null;
            let bearing = 0;

            if (bus.segment) {
                // Cas 1: Bus en mouvement
                // V305: Passer tripId et routeShortName pour l'ajustement RT
                position = this.calculatePosition(bus.segment, routeId, tripId, routeShortName);
                // Si le calcul de position a réussi, on calcule l'angle
                if (position) {
                    // Petite amélioration : si on a un GeoJSON, l'angle devrait être celui du segment courant
                    // Mais pour la fluidité visuelle, l'angle global ou l'angle lissé est souvent préférable.
                    bearing = position.bearing || this.calculateBearing(bus.segment);
                }
            } else if (bus.position) {
                // Cas 2: Bus en attente (statique)
                position = bus.position;
            }

            if (!position) {
                return null;
            }

            return {
                ...bus,
                position,
                bearing,
                // V306: Propager les infos RT et indicateurs de confiance
                rtInfo: position.rtInfo || null,
                hasRealtime: position.hasRealtime || false,
                isEstimated: position.isEstimated !== false, // true par défaut
                positionConfidence: position.confidence || 'unknown'
            };
        }).filter(bus => bus !== null);
    }
}

