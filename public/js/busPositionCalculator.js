/**
 * busPositionCalculator.js
 * * Calcule les positions géographiques interpolées des bus entre deux arrêts
 * * OPTIMISÉ V415 (Refonte Positionnement RT):
 * * - V415: REFONTE COMPLÈTE de pivotBasedEstimate() 
 * *   → Utilise directement les données RT des pivots (pas les horaires statiques)
 * *   → Identifie le pivot PASSÉ (rt=0) et le pivot SUIVANT (rt>0)
 * *   → Interpole entre les deux en fonction du temps RT restant
 * * - V306: Validation de cohérence RT pour éviter positions aberrantes
 * * - V306: Indicateur de confiance (hasRealtime, isEstimated)
 * * - Anti-téléportation avec lissage pour mouvements fluides
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

        // -------------------------
        // Partial GTFS-RT (pivot stops) configuration
        // -------------------------
        this.LIGNES_RT = ['A', 'B', 'C', 'D'];
        this.PIVOT_STOPS = {
            A: [
                'Centre Hospitalier',
                'Médiathèque',
                'Maurois',
                'Gare SNCF',
                'Salle Omnisports',
                'Pont de la Beauronne',
                'ZAE Marsac'
            ],
            B: [
                'Gare SNCF',
                'Taillefer',
                'Centre de la Communication',
                'Gabriel Laceuille',
                'Maison Carrée',
                'Agora',
                'Centre Commercial Boulazac'
            ],
            C: [
                'P+R Aquacap',
                'Médiathèque',
                'Maurois',
                'Taillefer',
                'Mounet Sully',
                'PEM',
                'Marival',
                'ZAE Marsac'
            ],
            D: [
                'Tourny',
                'Taillefer',
                'Sainte Cécile',
                'Médiathèque',
                'Feuilleraie',
                'Charrieras'
            ]
        };
        this.DELAI_MAX_ESTIMATION = 7 * 60; // seconds (7 minutes)
        this.SEUIL_TELEPORT = 300; // meters
        // cache pour resolved pivot stops (route -> [{stop, stop_id}])
        this._pivotStopIndex = null;
        // build a pivot stop_id index for faster lookup
        try {
            this.buildPivotStopIdIndex();
        } catch (e) {
            // ignore if dataManager not ready
        }
    }

    /**
     * Resolve pivot stop names to GTFS stop objects and ids, store in `PIVOT_STOP_IDS`.
     * This improves lookup speed and makes matching robust.
     */
    buildPivotStopIdIndex() {
        this.PIVOT_STOP_IDS = {};
        Object.keys(this.PIVOT_STOPS).forEach(routeKey => {
            const names = this.PIVOT_STOPS[routeKey] || [];
            const resolved = [];
            names.forEach(n => {
                try {
                    const matches = this.dataManager.findStopsByName ? this.dataManager.findStopsByName(n, 1) : [];
                    const stop = matches && matches.length ? matches[0] : null;
                    if (stop) {
                        resolved.push({ stop_id: stop.stop_id, stop_code: stop.stop_code || null, stop });
                    }
                } catch (e) {
                    // ignore name resolution errors
                }
            });
            this.PIVOT_STOP_IDS[routeKey] = resolved;
        });
        // also populate _pivotStopIndex for backward-compat
        this._pivotStopIndex = {};
        Object.keys(this.PIVOT_STOP_IDS).forEach(k => {
            this._pivotStopIndex[k] = this.PIVOT_STOP_IDS[k].map(e => e.stop);
        });
    }

    /**
     * Pivot-based position estimation for partial GTFS-RT lines.
     * 
     * LOGIQUE V415 (REFONTE COMPLÈTE):
     * 1. On récupère les données RT pour CHAQUE pivot de la ligne
     * 2. On identifie le dernier pivot PASSÉ (temps RT = 0 ou non listé)
     * 3. On identifie le prochain pivot À VENIR (temps RT > 0)
     * 4. On interpole entre ces deux pivots en fonction du temps restant RT
     * 
     * Cela évite d'utiliser les horaires statiques GTFS qui peuvent être décalés.
     * 
     * Returns a position object { lat, lon, progress, bearing, rtInfo, confidence, hasRealtime, isEstimated }
     * or null when the pivot strategy is not applicable.
     */
    pivotBasedEstimate(segment, tripId, routeShortName, bus = null) {
        if (!routeShortName) return null;
        const short = String(routeShortName).toUpperCase();
        if (!this.LIGNES_RT.includes(short)) return null;
        
        // S'assurer que l'index pivot est construit
        if (!this.PIVOT_STOP_IDS || !this.PIVOT_STOP_IDS[short]) {
            try {
                this.buildPivotStopIdIndex();
            } catch (e) {
                return null;
            }
        }
        
        const pivotEntries = this.PIVOT_STOP_IDS[short];
        if (!pivotEntries || pivotEntries.length < 2) return null;
        
        // Récupérer les temps RT pour chaque pivot
        const pivotsWithRT = [];
        const nowMs = Date.now();
        
        for (const entry of pivotEntries) {
            if (!entry.stop) continue;
            
            const stop = entry.stop;
            const stopId = entry.stop_id;
            const stopCode = entry.stop_code || stop.stop_code;
            
            // Chercher les données RT dans le cache du realtimeManager
            let rtMinutes = null;
            let hasRealtimeData = false;
            
            if (this.realtimeManager) {
                // Chercher la clé hawk correspondante dans le cache
                const hawkKey = this.realtimeManager.cache ? 
                    Array.from(this.realtimeManager.cache.keys()).find(k => 
                        k.includes(stopCode || stopId) || k.includes(stop.stop_name?.replace(/\s+/g, ''))
                    ) : null;
                
                if (hawkKey) {
                    const cachedRT = this.realtimeManager.cache.get(hawkKey);
                    if (cachedRT && cachedRT.data && cachedRT.data.departures) {
                        // Chercher un départ pour cette ligne
                        const matchingDep = cachedRT.data.departures.find(d => 
                            d.line?.toUpperCase() === short
                        );
                        
                        if (matchingDep) {
                            rtMinutes = this.realtimeManager.parseTemps(matchingDep.time);
                            hasRealtimeData = matchingDep.realtime !== false && rtMinutes !== null && rtMinutes < 999;
                        }
                    }
                }
            }
            
            pivotsWithRT.push({
                stop,
                stopId,
                stopCode,
                lat: parseFloat(stop.stop_lat),
                lon: parseFloat(stop.stop_lon),
                rtMinutes,  // null = pas de données, nombre = minutes jusqu'au passage
                hasRealtimeData
            });
        }
        
        // Filtrer les pivots sans coordonnées valides
        const validPivots = pivotsWithRT.filter(p => !isNaN(p.lat) && !isNaN(p.lon));
        if (validPivots.length < 2) return null;
        
        // LOGIQUE CLEF: Identifier position entre pivots
        // - Pivot PASSÉ: le dernier où rtMinutes est 0 ou null (bus déjà passé)
        // - Pivot SUIVANT: le premier où rtMinutes > 0
        
        let lastPassedPivot = null;
        let nextPivot = null;
        
        for (let i = 0; i < validPivots.length; i++) {
            const p = validPivots[i];
            
            if (p.hasRealtimeData && p.rtMinutes !== null) {
                if (p.rtMinutes <= 0) {
                    // Le bus est à cet arrêt ou vient de le passer
                    lastPassedPivot = p;
                    nextPivot = validPivots[i + 1] || null;
                } else if (p.rtMinutes > 0) {
                    // Premier pivot où le bus n'est pas encore arrivé
                    if (!nextPivot) {
                        nextPivot = p;
                        // Le pivot passé est le précédent
                        lastPassedPivot = validPivots[i - 1] || null;
                    }
                    break;
                }
            }
        }
        
        // Si on n'a pas trouvé de configuration valide, essayer une approche basée sur le segment statique
        if (!lastPassedPivot && !nextPivot) {
            // Fallback: utiliser le segment statique pour deviner
            if (segment && segment.fromStopInfo && segment.toStopInfo) {
                const fromName = segment.fromStopInfo.stop_name?.toLowerCase() || '';
                const toName = segment.toStopInfo.stop_name?.toLowerCase() || '';
                
                // Chercher des pivots correspondants
                for (let i = 0; i < validPivots.length; i++) {
                    const pivotName = validPivots[i].stop.stop_name?.toLowerCase() || '';
                    if (pivotName.includes(fromName) || fromName.includes(pivotName)) {
                        lastPassedPivot = validPivots[i];
                    }
                    if (pivotName.includes(toName) || toName.includes(pivotName)) {
                        nextPivot = validPivots[i];
                        break;
                    }
                }
            }
        }
        
        // Si toujours pas de pivots, on ne peut pas estimer
        if (!lastPassedPivot || !nextPivot) {
            return null;
        }
        
        // Calculer la progression entre les deux pivots
        let progress = 0.5; // Par défaut au milieu
        
        if (nextPivot.hasRealtimeData && nextPivot.rtMinutes !== null && nextPivot.rtMinutes > 0) {
            // Estimer le temps total entre les deux pivots (approximation: 3 min par arrêt en moyenne)
            const pivotIndex1 = validPivots.indexOf(lastPassedPivot);
            const pivotIndex2 = validPivots.indexOf(nextPivot);
            const nbArretsBetween = Math.abs(pivotIndex2 - pivotIndex1);
            const estimatedTotalMinutes = nbArretsBetween * 2.5; // ~2.5 min par segment en ville
            
            if (estimatedTotalMinutes > 0) {
                // temps passé = temps total estimé - temps restant RT
                const tempsPasseMinutes = Math.max(0, estimatedTotalMinutes - nextPivot.rtMinutes);
                progress = Math.min(1, tempsPasseMinutes / estimatedTotalMinutes);
            }
        } else if (lastPassedPivot.hasRealtimeData && lastPassedPivot.rtMinutes === 0) {
            // Le bus vient juste de quitter le pivot passé
            progress = 0.1;
        }
        
        // Clamper le progress
        progress = Math.max(0, Math.min(1, progress));
        
        // Interpoler les coordonnées
        const lat = lastPassedPivot.lat + (nextPivot.lat - lastPassedPivot.lat) * progress;
        const lon = lastPassedPivot.lon + (nextPivot.lon - lastPassedPivot.lon) * progress;
        
        // Calculer le bearing
        const bearing = this.calculateLinearBearing(
            lastPassedPivot.lat, lastPassedPivot.lon,
            nextPivot.lat, nextPivot.lon
        );
        
        // Anti-téléportation: si on a une position précédente, lisser le mouvement
        if (bus && bus.position && bus.position.lat && bus.position.lon) {
            try {
                const dist = this.dataManager.calculateDistance(bus.position.lat, bus.position.lon, lat, lon);
                if (dist > this.SEUIL_TELEPORT) {
                    // Grande distance: lisser pour éviter les sauts
                    const lastLat = parseFloat(bus.position.lat);
                    const lastLon = parseFloat(bus.position.lon);
                    const blendFactor = Math.min(0.5, (this.SEUIL_TELEPORT / dist) * 0.5);
                    const smoothLat = lastLat + (lat - lastLat) * blendFactor;
                    const smoothLon = lastLon + (lon - lastLon) * blendFactor;
                    
                    return {
                        lat: smoothLat,
                        lon: smoothLon,
                        progress,
                        bearing,
                        rtInfo: {
                            fromPivot: lastPassedPivot.stop.stop_name,
                            toPivot: nextPivot.stop.stop_name,
                            rtMinutesToNext: nextPivot.rtMinutes,
                            smoothed: true
                        },
                        confidence: 'realtime-pivot-smoothed',
                        hasRealtime: true,
                        isEstimated: false
                    };
                }
            } catch (e) {
                // Ignorer les erreurs de calcul de distance
            }
        }
        
        return {
            lat,
            lon,
            progress,
            bearing,
            rtInfo: {
                fromPivot: lastPassedPivot.stop.stop_name,
                toPivot: nextPivot.stop.stop_name,
                rtMinutesToNext: nextPivot.rtMinutes
            },
            confidence: 'realtime-pivot',
            hasRealtime: nextPivot.hasRealtimeData || lastPassedPivot.hasRealtimeData,
            isEstimated: false
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
    calculatePosition(segment, routeId = null, tripId = null, routeShortName = null, bus = null) {
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

        // Tentative: stratégie pivot (GTFS-RT partiel) — interpolation entre pivots
        try {
            const pivotPos = this.pivotBasedEstimate(segment, tripId, routeShortName, bus);
            if (pivotPos) {
                // Enrichir avec rtInfo si disponible et renvoyer
                pivotPos.rtInfo = pivotPos.rtInfo || null;
                pivotPos.confidence = pivotPos.confidence || 'realtime-pivot';
                pivotPos.hasRealtime = pivotPos.hasRealtime || false;
                pivotPos.isEstimated = pivotPos.isEstimated !== false;
                return pivotPos;
            }
        } catch (e) {
            // Ne pas faire échouer la position en cas d'erreur pivot
            console.warn('[BusPositionCalculator] pivotBasedEstimate failed', e);
        }

        // V306: Récupérer le progress théorique (basé sur l'heure)
        let theoreticalProgress = segment.progress; // 0.0 à 1.0
        let finalProgress = theoreticalProgress;
        let rtInfo = null;
        let positionConfidence = 'theoretical'; // 'realtime', 'adjusted', 'theoretical'
        
        // V306: Tenter d'ajuster avec le temps réel
        // V310: Virtual Time - prefer position computed at (now - delay) when delay is known
        if (bus && bus.hasRealtime && typeof bus.delay === 'number' && segment.departureTime && segment.arrivalTime) {
            try {
                const nowSec = Math.floor(Date.now() / 1000);
                const virtualTime = nowSec - Math.floor(bus.delay);
                const totalStaticSeconds = segment.arrivalTime - segment.departureTime;
                if (totalStaticSeconds > 0) {
                    const virtualProgress = (virtualTime - segment.departureTime) / totalStaticSeconds;
                    const clamped = Math.max(0, Math.min(1, virtualProgress));
                    finalProgress = clamped;
                    positionConfidence = 'realtime-virtual';
                    rtInfo = rtInfo || {};
                    rtInfo.source = 'realtime-virtual';
                    rtInfo.delaySeconds = bus.delay;
                }
            } catch (e) {
                console.warn('[BusPositionCalculator] Virtual time computation failed', e);
            }
        } else if (tripId && routeShortName && this.realtimeManager) {
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
                position = this.calculatePosition(bus.segment, routeId, tripId, routeShortName, bus);
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

