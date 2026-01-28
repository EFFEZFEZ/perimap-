/**
 * busPositionCalculator.js
 * * Calcule les positions géographiques interpolées des bus entre deux arrêts
 * * OPTIMISÉ V419 (Positionnement RT Amélioré):
 * * - V419: Recherche RT directe via realtimeManager.getDirectRtForStop()
 * *   → Requête synchrone dans le cache RT avec matching précis
 * *   → Support des formats "X min", "à l'approche", "HH:MM"
 * *   → Calcul du progress proportionnel au temps restant
 * * - V416: Contrainte par segment - bus ne dépasse jamais le prochain arrêt
 * * - Anti-téléportation avec lissage pour mouvements fluides
 * * - Indicateur de confiance (hasRealtime, isEstimated)
 */

export class BusPositionCalculator {
    constructor(dataManager, realtimeManager = null) {
        this.dataManager = dataManager;
        this.realtimeManager = realtimeManager;
        
        // Cache pour stocker les géométries pré-calculées entre deux arrêts
        this.segmentCache = new Map();
        
        // Cache des ajustements RT par trip
        this.rtAdjustmentCache = new Map();
        this.rtCacheMaxAge = 30000; // 30 secondes
        
        // V419: Cache des dernières positions connues pour lissage
        this.lastKnownPositions = new Map(); // tripId -> { lat, lon, timestamp, progress }
        
        // Seuils de validation
        this.validationThresholds = {
            maxProgressJump: 0.5,
            maxRtDeviation: 0.3,
            minSegmentDuration: 30,
            rtFreshnessLimit: 60000,
            // V419: Nouveaux seuils
            maxSpeedKmh: 60,           // Vitesse max réaliste pour un bus urbain
            smoothingFactor: 0.3,      // Facteur de lissage (0 = pas de lissage, 1 = tout lissé)
            maxSnapDistanceMeters: 350, // Distance max pour recaler sur la ligne
            minSnapDistanceMeters: 12   // Recalage seulement si l'écart est visible
        };

        // Lignes avec RT
        this.LIGNES_RT = ['A', 'B', 'C', 'D'];
        this.PIVOT_STOPS = {
            A: ['Centre Hospitalier', 'Médiathèque', 'Maurois', 'Gare SNCF', 'Salle Omnisports', 'Pont de la Beauronne', 'ZAE Marsac'],
            B: ['Gare SNCF', 'Taillefer', 'Centre de la Communication', 'Gabriel Laceuille', 'Maison Carrée', 'Agora', 'Centre Commercial Boulazac'],
            C: ['P+R Aquacap', 'Médiathèque', 'Maurois', 'Taillefer', 'Mounet Sully', 'PEM', 'Marival', 'ZAE Marsac'],
            D: ['Tourny', 'Taillefer', 'Sainte Cécile', 'Médiathèque', 'Feuilleraie', 'Charrieras']
        };
        this.DELAI_MAX_ESTIMATION = 7 * 60; // 7 minutes en secondes
        this.SEUIL_TELEPORT = 300; // mètres

        this.PIVOT_STOP_IDS = {};
        this._pivotStopIndex = null;
        
        try {
            this.buildPivotStopIdIndex();
        } catch (e) {
            // ignore if dataManager not ready
        }
    }

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
                } catch (e) {}
            });
            this.PIVOT_STOP_IDS[routeKey] = resolved;
        });
        this._pivotStopIndex = {};
        Object.keys(this.PIVOT_STOP_IDS).forEach(k => {
            this._pivotStopIndex[k] = this.PIVOT_STOP_IDS[k].map(e => e.stop);
        });
    }

    /**
     * V419: Recherche directe des données RT pour un arrêt spécifique et une ligne
     * Beaucoup plus fiable que la recherche par hawkKey
     * 
     * @param {Object} stopInfo - Info de l'arrêt (stop_id, stop_code, stop_name)
     * @param {string} lineCode - Code de la ligne (A, B, C, D)
     * @returns {Object|null} { rtMinutes, isRealtime, source }
     */
    getDirectRtForStop(stopInfo, lineCode) {
        if (!this.realtimeManager || !this.realtimeManager.cache) return null;
        if (!stopInfo) return null;
        
        const stopCode = stopInfo.stop_code || '';
        const stopName = (stopInfo.stop_name || '').toLowerCase().replace(/\s+/g, '');
        const normalizedLine = String(lineCode).toUpperCase();
        
        // Parcourir le cache RT pour trouver une correspondance
        for (const [cacheKey, cached] of this.realtimeManager.cache.entries()) {
            if (!cached || !cached.data) continue;
            
            // Vérifier si la clé correspond à cet arrêt
            const keyLower = cacheKey.toLowerCase();
            const matchesStop = (stopCode && keyLower.includes(stopCode.toLowerCase())) ||
                               (stopName && keyLower.includes(stopName));
            
            if (!matchesStop) continue;
            
            // Chercher un départ pour cette ligne
            const departures = cached.data.departures || cached.data.schedules || [];
            for (const dep of departures) {
                const depLine = (dep.line || dep.ligne || '').toUpperCase();
                if (depLine !== normalizedLine) continue;
                
                // Trouvé! Parser le temps
                const timeStr = dep.time || dep.temps || '';
                const rtMinutes = this.realtimeManager.parseTemps(timeStr);
                
                if (rtMinutes !== null && rtMinutes < 999) {
                    return {
                        rtMinutes,
                        isRealtime: dep.realtime !== false,
                        destination: dep.destination || dep.dest || '',
                        source: cacheKey,
                        rawTime: timeStr
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * V419: Position basée sur les données RT avec contraintes de segment
     * 
     * LOGIQUE AMÉLIORÉE:
     * 1. On utilise le segment GTFS (fromStop → toStop)
     * 2. On cherche les RT pour toStop ET fromStop
     * 3. On calcule le progress en fonction du temps RT restant
     * 4. On applique un lissage anti-téléportation
     * 5. Le bus ne peut JAMAIS dépasser un arrêt où le RT dit qu'il n'est pas arrivé
     */
    pivotBasedEstimate(segment, tripId, routeShortName, bus = null) {
        if (!routeShortName) return null;
        const lineCode = String(routeShortName).toUpperCase();
        if (!this.LIGNES_RT.includes(lineCode)) return null;
        
        if (!segment || !segment.fromStopInfo || !segment.toStopInfo) return null;
        
        const fromStop = segment.fromStopInfo;
        const toStop = segment.toStopInfo;
        
        // Coordonnées de base
        const fromLat = parseFloat(fromStop.stop_lat);
        const fromLon = parseFloat(fromStop.stop_lon);
        const toLat = parseFloat(toStop.stop_lat);
        const toLon = parseFloat(toStop.stop_lon);
        
        if ([fromLat, fromLon, toLat, toLon].some(v => isNaN(v))) return null;
        
        // V419: Chercher les données RT pour le prochain arrêt (toStop)
        const rtDataNext = this.getDirectRtForStop(toStop, lineCode);
        
        // V419: Chercher aussi les données RT pour l'arrêt de départ (fromStop)
        const rtDataFrom = this.getDirectRtForStop(fromStop, lineCode);
        
        // Calculer le progress
        let progress = segment.progress || 0.5;
        let confidence = 'theoretical';
        let rtMinutesToNext = null;
        let hasRealtimeData = false;
        
        // Durée estimée du segment
        const segmentDurationSec = (segment.arrivalTime || 0) - (segment.departureTime || 0);
        const segmentDurationMin = Math.max(1, segmentDurationSec / 60); // Min 1 minute
        
        if (rtDataNext && rtDataNext.rtMinutes !== null) {
            // On a des données RT pour le prochain arrêt
            rtMinutesToNext = rtDataNext.rtMinutes;
            hasRealtimeData = rtDataNext.isRealtime;
            
            if (rtMinutesToNext <= 0) {
                // "À l'approche" ou 0 min → le bus est presque arrivé
                progress = 0.92;
                confidence = 'realtime-arriving';
            } else if (rtMinutesToNext >= segmentDurationMin * 1.5) {
                // Le bus n'a probablement pas encore quitté fromStop
                progress = 0.08;
                confidence = 'realtime-waiting';
            } else {
                // En route: progress = temps écoulé / temps total
                // Si RT dit X min et segment fait Y min total → progress = 1 - (X/Y)
                const tempsEcouleMin = segmentDurationMin - rtMinutesToNext;
                progress = tempsEcouleMin / segmentDurationMin;
                progress = Math.max(0.05, Math.min(0.95, progress));
                confidence = 'realtime-moving';
            }
        } else if (rtDataFrom && rtDataFrom.rtMinutes !== null && rtDataFrom.rtMinutes <= 1) {
            // Le bus est encore au fromStop ou vient de partir
            progress = 0.1;
            confidence = 'realtime-departed';
            hasRealtimeData = rtDataFrom.isRealtime;
        }
        
        // CONTRAINTE: progress ne doit jamais dépasser 0.95 (le bus n'a pas encore atteint toStop)
        progress = Math.max(0, Math.min(0.95, progress));
        
        // Interpoler les coordonnées
        let lat = fromLat + (toLat - fromLat) * progress;
        let lon = fromLon + (toLon - fromLon) * progress;
        
        // Calculer le bearing
        const bearing = this.calculateLinearBearing(fromLat, fromLon, toLat, toLon);
        
        // V419: Anti-téléportation avec lissage intelligent
        const positionKey = tripId || `${lineCode}_${fromStop.stop_id}`;
        const lastPos = this.lastKnownPositions.get(positionKey);
        let smoothed = false;
        
        if (lastPos && Date.now() - lastPos.timestamp < 120000) { // Position valide depuis < 2 min
            const dist = this.dataManager.calculateDistance(lastPos.lat, lastPos.lon, lat, lon);
            const timeDeltaSec = (Date.now() - lastPos.timestamp) / 1000;
            const speedKmh = (dist / 1000) / (timeDeltaSec / 3600);
            
            // Si la "vitesse" est trop élevée, lisser la position
            if (speedKmh > this.validationThresholds.maxSpeedKmh || dist > this.SEUIL_TELEPORT) {
                const blend = this.validationThresholds.smoothingFactor;
                lat = lastPos.lat + (lat - lastPos.lat) * blend;
                lon = lastPos.lon + (lon - lastPos.lon) * blend;
                smoothed = true;
                confidence += '-smoothed';
            }
        }
        
        // Sauvegarder cette position pour le prochain cycle
        this.lastKnownPositions.set(positionKey, {
            lat, lon, progress, timestamp: Date.now()
        });
        
        // Nettoyer les anciennes positions (> 5 min)
        if (this.lastKnownPositions.size > 100) {
            const cutoff = Date.now() - 300000;
            for (const [key, val] of this.lastKnownPositions.entries()) {
                if (val.timestamp < cutoff) {
                    this.lastKnownPositions.delete(key);
                }
            }
        }
        
        return {
            lat,
            lon,
            progress,
            bearing,
            rtInfo: {
                fromStop: fromStop.stop_name,
                toStop: toStop.stop_name,
                rtMinutes: rtMinutesToNext,
                smoothed,
                segmentDuration: segmentDurationMin
            },
            confidence,
            hasRealtime: hasRealtimeData,
            isEstimated: !hasRealtimeData
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

        const routeGeometry = routeId ? this.dataManager.getRouteGeometry(routeId) : null;
        const routeCoordinates = this.extractRouteCoordinates(routeGeometry);
        const segmentData = (routeId && routeCoordinates && segment?.fromStopInfo?.stop_id && segment?.toStopInfo?.stop_id)
            ? this.getSegmentData(
                routeId,
                segment.fromStopInfo.stop_id,
                segment.toStopInfo.stop_id,
                routeCoordinates,
                fromLat,
                fromLon,
                toLat,
                toLon
            )
            : null;

        // Tentative: stratégie pivot (GTFS-RT partiel) — interpolation entre pivots
        try {
            const pivotPos = this.pivotBasedEstimate(segment, tripId, routeShortName, bus);
            if (pivotPos) {
                // Enrichir avec rtInfo si disponible et renvoyer
                pivotPos.rtInfo = pivotPos.rtInfo || null;
                pivotPos.confidence = pivotPos.confidence || 'realtime-pivot';
                pivotPos.hasRealtime = pivotPos.hasRealtime || false;
                pivotPos.isEstimated = pivotPos.isEstimated !== false;
                return this.snapPositionToRoute(
                    pivotPos,
                    segmentData?.path || routeCoordinates
                );
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

        // Fallback: Interpolation linéaire simple (ligne droite) si pas de GeoJSON
        // ou si le calcul géométrique a échoué
        const lat = fromLat + (toLat - fromLat) * finalProgress;
        const lon = fromLon + (toLon - fromLon) * finalProgress;

        const fallbackPosition = {
            lat,
            lon,
            progress: finalProgress,
            bearing: this.calculateLinearBearing(fromLat, fromLon, toLat, toLon),
            rtInfo,
            confidence: positionConfidence,
            hasRealtime: rtInfo?.isRealtime === true,
            isEstimated: positionConfidence !== 'realtime'
        };

        return this.snapPositionToRoute(
            fallbackPosition,
            segmentData?.path || routeCoordinates
        );
    }

    getSegmentData(routeId, fromStopId, toStopId, routeCoordinates, fromLat, fromLon, toLat, toLon) {
        if (!routeId || !fromStopId || !toStopId || !routeCoordinates) return null;
        const cacheKey = `${routeId}_${fromStopId}_${toStopId}`;

        let segmentData = this.segmentCache.get(cacheKey);
        if (segmentData && segmentData.invalid) return null;
        if (!segmentData) {
            segmentData = this.computeSegmentGeometry(routeCoordinates, fromLat, fromLon, toLat, toLon);
            if (segmentData) {
                this.segmentCache.set(cacheKey, segmentData);
            } else {
                this.segmentCache.set(cacheKey, { invalid: true });
                return null;
            }
        }
        return segmentData;
    }

    snapPositionToRoute(position, routeCoordinates) {
        if (!position || !routeCoordinates || routeCoordinates.length === 0) return position;

        const maxSnapDistance = this.validationThresholds.maxSnapDistanceMeters || 300;
        const minSnapDistance = this.validationThresholds.minSnapDistanceMeters || 0;

        let minDistance = Infinity;
        let nearestPoint = null;

        for (let i = 0; i < routeCoordinates.length; i++) {
            const [pointLon, pointLat] = routeCoordinates[i];
            const distance = this.dataManager.calculateDistance(position.lat, position.lon, pointLat, pointLon);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = { lat: pointLat, lon: pointLon };
            }
        }

        if (!nearestPoint || !isFinite(minDistance)) return position;

        const shouldSnap = minDistance >= minSnapDistance && minDistance <= maxSnapDistance;
        if (shouldSnap) {
            return {
                ...position,
                lat: nearestPoint.lat,
                lon: nearestPoint.lon,
                offRouteDistance: Math.round(minDistance),
                snappedToRoute: true
            };
        }

        return {
            ...position,
            offRouteDistance: Math.round(minDistance),
            snappedToRoute: false
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
        // 1. Récupérer les données de segment (cache + calcul si besoin)
        const segmentData = this.getSegmentData(routeId, fromStopId, toStopId, routeCoordinates, fromLat, fromLon, toLat, toLon);

        // 2. Si le segment est invalide, on abandonne
        if (!segmentData) return null;

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

