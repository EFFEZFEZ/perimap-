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
     * Returns a position object { lat, lon, progress, bearing, rtInfo, confidence, hasRealtime, isEstimated }
     * or null when the pivot strategy is not applicable.
     */
    pivotBasedEstimate(segment, tripId, routeShortName, bus = null) {
        if (!routeShortName) return null;
        const short = String(routeShortName).toUpperCase();
        if (!this.LIGNES_RT.includes(short)) return null;
        const pivotNames = this.PIVOT_STOPS[short];
        if (!pivotNames || !pivotNames.length) return null;

        const stopTimes = this.dataManager.stopTimesByTrip?.[tripId];
        if (!Array.isArray(stopTimes) || stopTimes.length === 0) return null;

        // Build map stop_id -> scheduled seconds (use arrival_time or departure_time)
        const scheduleSecondsByStopId = {};
        stopTimes.forEach(st => {
            const t = st.arrival_time || st.departure_time;
            if (!t) return;
            try {
                scheduleSecondsByStopId[st.stop_id] = this.dataManager.timeToSeconds(t);
            } catch (e) {
                // ignore
            }
        });

        // Resolve pivot names to stop objects using cached index if available
        if (!this._pivotStopIndex) {
            this._pivotStopIndex = {};
            Object.keys(this.PIVOT_STOPS).forEach(routeKey => {
                const names = this.PIVOT_STOPS[routeKey] || [];
                const resolved = [];
                names.forEach(n => {
                    const matches = this.dataManager.findStopsByName ? this.dataManager.findStopsByName(n, 1) : [];
                    const stop = matches && matches.length ? matches[0] : null;
                    if (stop) resolved.push(stop);
                });
                this._pivotStopIndex[routeKey] = resolved;
            });
        }

        const resolvedStops = this._pivotStopIndex[short] || [];
        const pivots = resolvedStops.map(stop => {
            const scheduled = scheduleSecondsByStopId[stop.stop_id];
            if (scheduled === undefined) return null;
            return { stop, stop_id: stop.stop_id, scheduled };
        }).filter(Boolean);

        if (pivots.length < 2) return null; // need at least two pivots to interpolate

        // Find previous and next pivot surrounding current segment
        const segStart = segment.departureTime || 0;
        const segEnd = segment.arrivalTime || 0;

        let prev = null;
        let next = null;
        for (let i = 0; i < pivots.length; i++) {
            const p = pivots[i];
            if (p.scheduled <= segStart) prev = p;
            if (p.scheduled >= segEnd && !next) next = p;
        }

        // Fallback: if we didn't find bounding pivots, try nearest two by scheduled time
        if (!prev || !next) {
            const sorted = pivots.slice().sort((a, b) => a.scheduled - b.scheduled);
            if (!prev) prev = sorted[0];
            if (!next) next = sorted[sorted.length - 1];
        }

        if (!prev || !next || prev.stop_id === next.stop_id) return null;

        // Get RT info for both pivots (minutes until arrival), if available
        const nowSec = Math.floor(Date.now() / 1000);

        const prevStopTime = stopTimes.find(st => st.stop_id === prev.stop_id) || {};
        const nextStopTime = stopTimes.find(st => st.stop_id === next.stop_id) || {};

        const rtPrev = this.getRealtimeAdjustedProgress(tripId, short, prev.stop_id, prev.stop.stop_code, this.dataManager.timeToSeconds(prevStopTime.departure_time || prevStopTime.arrival_time || '00:00:00'), this.dataManager.timeToSeconds(prevStopTime.arrival_time || prevStopTime.departure_time || '00:00:00')) || null;
        const rtNext = this.getRealtimeAdjustedProgress(tripId, short, next.stop_id, next.stop.stop_code, this.dataManager.timeToSeconds(nextStopTime.departure_time || nextStopTime.arrival_time || '00:00:00'), this.dataManager.timeToSeconds(nextStopTime.arrival_time || nextStopTime.departure_time || '00:00:00')) || null;

        // Compute adjusted absolute times for pivots (scheduled seconds -> absolute epoch seconds on today)
        // We assume scheduleSeconds are seconds-of-day; convert to today's epoch seconds by aligning with now
        const todayBase = Math.floor(Date.now() / 1000 / 86400) * 86400; // midnight epoch today
        const prevScheduledAbs = todayBase + prev.scheduled;
        const nextScheduledAbs = todayBase + next.scheduled;

        const prevAdjustedAbs = rtPrev && typeof rtPrev.rtMinutes === 'number' ? (nowSec + Math.round(rtPrev.rtMinutes * 60)) : prevScheduledAbs;
        const nextAdjustedAbs = rtNext && typeof rtNext.rtMinutes === 'number' ? (nowSec + Math.round(rtNext.rtMinutes * 60)) : nextScheduledAbs;

        // If both pivots have huge delay (> DELAI_MAX_ESTIMATION) => mark estimation-only (no precise progression)
        const delayPrev = prevAdjustedAbs - prevScheduledAbs;
        const delayNext = nextAdjustedAbs - nextScheduledAbs;
        if (Math.abs(delayPrev) > this.DELAI_MAX_ESTIMATION || Math.abs(delayNext) > this.DELAI_MAX_ESTIMATION) {
            // Too much delay: return a coarse estimation (place at scheduled position without fine interpolation)
            const frac = segment.progress || 0;
            const lat = parseFloat(segment.fromStopInfo.stop_lat) + (parseFloat(segment.toStopInfo.stop_lat) - parseFloat(segment.fromStopInfo.stop_lat)) * frac;
            const lon = parseFloat(segment.fromStopInfo.stop_lon) + (parseFloat(segment.toStopInfo.stop_lon) - parseFloat(segment.fromStopInfo.stop_lon)) * frac;
            return { lat, lon, progress: frac, bearing: this.calculateLinearBearing(parseFloat(segment.fromStopInfo.stop_lat), parseFloat(segment.fromStopInfo.stop_lon), parseFloat(segment.toStopInfo.stop_lat), parseFloat(segment.toStopInfo.stop_lon)), rtInfo: { prev: rtPrev, next: rtNext }, confidence: 'estimated', hasRealtime: false, isEstimated: true };
        }

        // Interpolate current position fraction between prevAdjustedAbs and nextAdjustedAbs
        const denom = (nextAdjustedAbs - prevAdjustedAbs) || 1;
        const fracAbs = (nowSec - prevAdjustedAbs) / denom;
        const fracClamped = Math.max(0, Math.min(1, fracAbs));

        // Interpolate geographical coordinates between the two pivot stops
        const fromLat = parseFloat(prev.stop.stop_lat);
        const fromLon = parseFloat(prev.stop.stop_lon);
        const toLat = parseFloat(next.stop.stop_lat);
        const toLon = parseFloat(next.stop.stop_lon);

        if ([fromLat, fromLon, toLat, toLon].some(v => Number.isNaN(v))) return null;

        const lat = fromLat + (toLat - fromLat) * fracClamped;
        const lon = fromLon + (toLon - fromLon) * fracClamped;

        // If we have an existing RT-based position for this bus, compare distance.
        // Instead of teleporting on large discrepancies, blend the new RT position
        // with the last known position to preserve smooth motion.
        if (bus && bus.position && bus.position.lat && bus.position.lon) {
            try {
                const dist = this.dataManager.calculateDistance(bus.position.lat, bus.position.lon, lat, lon);
                if (dist > this.SEUIL_TELEPORT) {
                    // Large discrepancy: smooth the update to avoid teleportation.
                    const lastLat = parseFloat(bus.position.lat);
                    const lastLon = parseFloat(bus.position.lon);
                    // Blend factor decreases for larger distances; cap at 0.4 for stability
                    const blendFactor = Math.min(0.4, (this.SEUIL_TELEPORT / dist) * 0.4);
                    const smLat = lastLat * (1 - blendFactor) + lat * blendFactor;
                    const smLon = lastLon * (1 - blendFactor) + lon * blendFactor;
                    return { lat: smLat, lon: smLon, progress: fracClamped, bearing: this.calculateLinearBearing(fromLat, fromLon, toLat, toLon), rtInfo: { prev: rtPrev, next: rtNext }, confidence: 'realtime-pivot-smoothed', hasRealtime: true, isEstimated: false };
                }
            } catch (e) {
                // ignore distance failures
            }
        }

        return { lat, lon, progress: fracClamped, bearing: this.calculateLinearBearing(fromLat, fromLon, toLat, toLon), rtInfo: { prev: rtPrev, next: rtNext }, confidence: 'realtime-pivot', hasRealtime: Boolean(rtPrev || rtNext), isEstimated: false };
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

