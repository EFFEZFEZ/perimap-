/**
 * realtimeManager.js - Gestion des horaires temps réel Péribus
 * Scrape hawk.perimouv.fr pour obtenir les prochains passages en temps réel
 * 
 * V3 - PRÉCHARGEMENT PRIORITAIRE + AUTO-REFRESH:
 * - Précharge les arrêts prioritaires (Taillefer, Gare, PEM, etc.) au démarrage
 * - Auto-refresh des arrêts prioritaires toutes les 60 secondes
 * - Cache agressif pour éviter les appels API répétés
 * - Chargement à la demande conservé pour les autres arrêts
 * 
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 */

import { getHawkKeyForStop, getHawkKeysForStopPlace, isRealtimeEnabled, loadStopIdMapping, PRIORITY_STOPS, getPriorityHawkKeys } from './config/stopKeyMapping.js';
import { analyticsManager } from './analyticsManager.js';
import { LINE_CATEGORIES } from './config/routes.js';

export class RealtimeManager {
    constructor() {
        // URL du proxy API (sur Vercel)
        this.proxyUrl = '/api/realtime';
        
        // Cache des données temps réel par arrêt
        this.cache = new Map();
        this.cacheMaxAge = 60 * 1000; // 60 secondes (éviter re-fetch trop fréquent)
        this.preloadedStops = new Set(); // Arrêts préchargés
        
        // État
        this.isAvailable = false;
        this.lastError = null;
        
        // Référence aux stops GTFS (pour le mapping)
        this.stops = null;
        
        // Statistiques
        this.stats = {
            requests: 0,
            successes: 0,
            failures: 0,
            preloadRequests: 0,
            preloadSuccesses: 0,
            preloadFailures: 0
        };

        // V421: Configuration optimisée pour discrétion maximale
        this.preloadConfig = {
            enabled: true,
            autoRefreshInterval: 60 * 1000,   // 60s - sync avec Hawk
            delayBetweenRequests: 200,        // V421: 200ms → plus naturel, moins de burst
            maxConcurrentRequests: 3,         // V421: 3 → spread plus long, moins détectable
            randomJitter: 50                  // V421: +/- 50ms aléatoire entre requêtes
        };

        this.isPreloading = false;
        this.autoRefreshTimer = null;

        // Sleep mode: permet de couper l'auto-refresh (économie API) jusqu'à une date donnée
        this.sleepUntilMs = 0;
    }

    isSleeping() {
        return !!(this.sleepUntilMs && Date.now() < this.sleepUntilMs);
    }

    setSleepUntil(timestampMs) {
        const ts = Number(timestampMs) || 0;
        this.sleepUntilMs = ts;
        if (this.isSleeping()) {
            this.stopAutoRefresh();
        }
    }

    /**
     * Initialise le manager avec les données GTFS
     * @param {Array} stops - Liste des arrêts GTFS
     * @param {boolean} [autoPreload=true] - Lancer le préchargement automatiquement
     */
    init(stops, autoPreload = true) {
        this.stops = stops;
        loadStopIdMapping(stops);

        // V3: Lancer le préchargement des arrêts PRIORITAIRES uniquement
        if (autoPreload && this.preloadConfig.enabled) {
            // Attendre un peu pour ne pas bloquer le démarrage de l'app
            setTimeout(() => this.preloadPriorityStops(), 800);
        }
    }

    /**
     * V421: Précharge UNIQUEMENT les arrêts prioritaires (les plus fréquentés) EN 1 SEUL APPEL BATCH
     * Liste définie dans PRIORITY_STOPS: Taillefer, Maurois, PEM, Gare SNCF, Tourny, Médiathèque, Boulazac CC
     * 
     * Avantages V421 BATCH:
     * - 1 seul appel API au lieu de 15 individuels
     * - Moins détectable (pattern unique vs multiples requêtes espacées)
     * - Plus économique (1 round-trip HTTP au lieu de 15)
     * - Jitter géré côté serveur pour stealth
    * - Auto-refresh toutes les 60s pour maintenir les données fraîches
     */
    async preloadPriorityStops() {
        if (this.isSleeping()) {
            return;
        }
        if (this.isPreloading) {
            console.warn('[Realtime] Préchargement déjà en cours');
            return;
        }

        this.isPreloading = true;
        const priorityHawkKeys = getPriorityHawkKeys();
        
        console.log(`[Realtime] 🚀 Préchargement BATCH des ${priorityHawkKeys.length} arrêts prioritaires...`);
        console.log('[Realtime] Arrêts prioritaires:', PRIORITY_STOPS.map(s => s.name).join(', '));

        let successCount = 0;
        let failureCount = 0;

        try {
            // V421: UN SEUL APPEL BATCH
            const stopsParam = priorityHawkKeys.join(',');
            const response = await fetch(`/api/realtime?stops=${encodeURIComponent(stopsParam)}`);
            
            if (!response.ok) {
                throw new Error(`Batch request failed: ${response.status}`);
            }

            const batchData = await response.json();
            
            if (batchData.batch && Array.isArray(batchData.results)) {
                // Traiter chaque arrêt du batch
                for (const result of batchData.results) {
                    const cacheKey = `hawk_${result.stop}`;
                    
                    this.cache.set(cacheKey, {
                        data: result,
                        fetchedAt: Date.now()
                    });
                    
                    successCount++;
                }
                
                failureCount = batchData.failed || 0;
                
                console.log(`[Realtime] ✅ Batch terminé: ${successCount}/${priorityHawkKeys.length} succès, ${batchData.cached} du cache`);
            } else {
                throw new Error('Invalid batch response format');
            }

            this.stats.preloadRequests += 1; // 1 seul appel batch
            this.stats.preloadSuccesses += successCount;
            this.stats.preloadFailures += failureCount;

            console.log(`[Realtime] ✅ Préchargement prioritaire BATCH terminé: ${successCount}/${priorityHawkKeys.length} succès`);
            
            // V3: Démarrer l'auto-refresh des arrêts prioritaires
            this.startAutoRefresh();

        } catch (error) {
            console.error('[Realtime] Erreur lors du préchargement prioritaire:', error);
        } finally {
            this.isPreloading = false;
        }
    }

    /**
     * Précharge une liste additionnelle de hawkKeys (sans interrompre le preload principal)
     * @param {string[]} extraHawkKeys
     */
    async preloadExtraStops(extraHawkKeys = []) {
        if (!Array.isArray(extraHawkKeys) || extraHawkKeys.length === 0) return;
        if (this.isSleeping()) return;

        // Dédupliquer et ignorer ceux déjà en cache
        const unique = Array.from(new Set(extraHawkKeys));
        const toFetch = unique.filter(k => {
            const cacheKey = `hawk_${k}`;
            const cached = this.cache.get(cacheKey);
            return !(cached && Date.now() - cached.fetchedAt < this.cacheMaxAge);
        });
        if (toFetch.length === 0) return;

        console.log(`[Realtime] Préchargement additionnel de ${toFetch.length} hawkKeys`);

        const batchSize = this.preloadConfig.maxConcurrentRequests;
        for (let i = 0; i < toFetch.length; i += batchSize) {
            const batch = toFetch.slice(i, i + batchSize);
            const promises = batch.map((hawkKey, index) => {
                return new Promise(resolve => {
                    setTimeout(async () => {
                        try {
                            await this.fetchRealtimeByHawkKey(hawkKey);
                            resolve({ success: true, hawkKey });
                        } catch (error) {
                            resolve({ success: false, hawkKey, error: error?.message || error });
                        }
                    }, index * this.preloadConfig.delayBetweenRequests);
                });
            });
            await Promise.all(promises);
        }
    }

    /**
     * Résout les pivots présents dans une instance de BusPositionCalculator
     * et lance leur préchargement via hawk keys.
     * @param {BusPositionCalculator} busPosCalc
     */
    async preloadPivotStopsFromCalculator(busPosCalc) {
        if (!busPosCalc || !busPosCalc.PIVOT_STOP_IDS) return;
        const hawkKeys = [];
        for (const routeKey of Object.keys(busPosCalc.PIVOT_STOP_IDS)) {
            const entries = busPosCalc.PIVOT_STOP_IDS[routeKey] || [];
            for (const e of entries) {
                try {
                    const hawk = getHawkKeyForStop(e.stop_id, e.stop_code);
                    if (hawk) hawkKeys.push(hawk);
                } catch (err) {
                    // ignore
                }
            }
        }
        await this.preloadExtraStops(hawkKeys);
    }

    /**
     * V3: Récupère les données temps réel directement par hawkKey (sans passer par stopId)
     * @param {string} hawkKey - La clé hawk de l'arrêt
     * @returns {Promise<Object|null>}
     */
    async fetchRealtimeByHawkKey(hawkKey) {
        const cacheKey = `hawk_${hawkKey}`;

        // Sleep mode: ne pas faire d'appels réseau, renvoyer le cache best-effort
        if (this.isSleeping()) {
            const cached = this.cache.get(cacheKey);
            return cached ? cached.data : null;
        }
        
        // Vérifier le cache (sauf si refresh forcé)
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.fetchedAt < this.cacheMaxAge) {
            return cached.data;
        }

        this.stats.requests++;

        try {
            const response = await fetch(`${this.proxyUrl}?stop=${hawkKey}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(8000)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Normalisation légère: s'assurer que le format contient à la fois
            // - `departures` (utilisé par BusPositionCalculator)
            // - `schedules` (utilisé par la popup et mergeWithStatic)
            try {
                const raw = data && (data.departures || data.schedules) ? (data.departures || data.schedules) : [];

                const schedules = Array.isArray(raw) ? raw.map((d, idx) => {
                    const ligne = d.ligne || d.line || d.routeShortName || '';
                    const destination = d.destination || d.dest || d.to || '';
                    const temps = d.temps || d.time || d.realtimeText || '';
                    const quai = d.quai || d.quay || d.platform || '';
                    const realtime = (d.realtime === undefined) ? true : (d.realtime !== false && String(d.realtime) !== 'false');
                    const theoretical = d.theoretical || false;
                    return {
                        // Champs utilisés par `mergeWithStatic` / popups
                        ligne: String(ligne).toUpperCase(),
                        destination: String(destination || '').trim(),
                        temps: String(temps || '').trim(),
                        quai: String(quai || '').trim(),
                        realtime,
                        theoretical,
                        _index: idx
                    };
                }) : [];

                const departures = schedules.map(s => ({
                    // Champs utilisés par `BusPositionCalculator` and other consumers
                    line: s.ligne,
                    destination: s.destination,
                    time: s.temps,
                    quay: s.quai,
                    realtime: s.realtime,
                    theoretical: s.theoretical
                }));

                // Recomposer l'objet retourné sans supprimer les métadonnées existantes
                data.schedules = schedules;
                data.departures = departures;
                data.count = departures.length;
            } catch (normErr) {
                console.warn('[Realtime] Normalisation RT échouée:', normErr?.message || normErr);
            }

            // Mettre en cache
            this.cache.set(cacheKey, {
                data,
                fetchedAt: Date.now()
            });

            // Marquer comme préchargé pour éviter double-calls
            try {
                this.preloadedStops.add(hawkKey);
            } catch (e) {
                // ignore
            }

            this.isAvailable = true;
            this.stats.successes++;
            
            return data;

        } catch (error) {
            this.stats.failures++;
            throw error;
        }
    }

    /**
     * V3: Démarre l'auto-refresh des arrêts prioritaires
    * Rafraîchit les données toutes les 60 secondes
     */
    /**
     * V421: Auto-refresh optimisé avec BATCH API
     */
    startAutoRefresh() {
        if (this.isSleeping()) {
            return;
        }
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
        }

        console.log(`[Realtime] ⏰ Auto-refresh BATCH activé (intervalle: ${this.preloadConfig.autoRefreshInterval / 1000}s)`);

        this.autoRefreshTimer = setInterval(async () => {
            if (this.isPreloading) return; // Ne pas interférer avec un préchargement en cours
            
            const priorityHawkKeys = getPriorityHawkKeys();
            console.log(`[Realtime] 🔄 Auto-refresh BATCH des ${priorityHawkKeys.length} arrêts prioritaires...`);
            
            try {
                // V421: Invalider le cache et faire 1 appel batch
                for (const hawkKey of priorityHawkKeys) {
                    const cacheKey = `hawk_${hawkKey}`;
                    this.cache.delete(cacheKey);
                }
                
                // 1 appel batch pour tous les arrêts
                const stopsParam = priorityHawkKeys.join(',');
                const response = await fetch(`/api/realtime?stops=${encodeURIComponent(stopsParam)}`);
                
                if (response.ok) {
                    const batchData = await response.json();
                    let refreshCount = 0;
                    
                    if (batchData.batch && Array.isArray(batchData.results)) {
                        for (const result of batchData.results) {
                            const cacheKey = `hawk_${result.stop}`;
                            this.cache.set(cacheKey, {
                                data: result,
                                fetchedAt: Date.now()
                            });
                            refreshCount++;
                        }
                    }
                    
                    console.log(`[Realtime] ✅ Auto-refresh BATCH: ${refreshCount}/${priorityHawkKeys.length} mis à jour`);
                }
            } catch (error) {
                console.warn('[Realtime] Erreur auto-refresh batch:', error.message);
            }
            
        }, this.preloadConfig.autoRefreshInterval);
    }

    /**
     * V3: Arrête l'auto-refresh (ex: quand l'utilisateur quitte la page)
     */
    stopAutoRefresh() {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = null;
            console.log('[Realtime] ⏹️ Auto-refresh désactivé');
        }
    }

    /**
     * V3: Vérifie si un arrêt fait partie des prioritaires
     * @param {string} hawkKey
     * @returns {boolean}
     */
    isPriorityStop(hawkKey) {
        return getPriorityHawkKeys().includes(hawkKey);
    }

    /**
     * Obtient l'état du préchargement
     */
    getPreloadStatus() {
        return {
            isPreloading: this.isPreloading,
            preloadedStopsCount: this.preloadedStops.size,
            stats: {
                preloadRequests: this.stats.preloadRequests,
                preloadSuccesses: this.stats.preloadSuccesses,
                preloadFailures: this.stats.preloadFailures,
                totalRequests: this.stats.requests,
                totalSuccesses: this.stats.successes,
                totalFailures: this.stats.failures
            },
            cacheSize: this.cache.size
        };
    }

    /**
     * Récupère les horaires temps réel pour un arrêt
     * @param {string|number} stopId - L'identifiant GTFS de l'arrêt
     * @param {string} [stopCode] - Optionnel: le stop_code si connu
     * @returns {Promise<RealtimeData|null>}
     */
    async getRealtimeForStop(stopId, stopCode = null) {
        // Vérifier si le temps réel est activé pour cet arrêt
        if (!isRealtimeEnabled(stopId, stopCode)) {
            console.debug(`[Realtime] Temps réel non disponible pour stop ${stopId}`);
            return null;
        }
        
        // Obtenir la clé hawk correspondante
        const hawkKey = getHawkKeyForStop(stopId, stopCode);
        if (!hawkKey) {
            console.debug(`[Realtime] Pas de clé hawk pour stop ${stopId} (code: ${stopCode})`);
            return null;
        }
        
        // Vérifier le cache
        const cacheKey = `hawk_${hawkKey}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.fetchedAt < this.cacheMaxAge) {
            return cached.data;
        }

        // Si l'arrêt est prioritaire et qu'on est en train de précharger, NE PAS
        // déclencher un nouvel appel: s'appuyer sur la première requête automatique.
        if (this.isPriorityStop(hawkKey) && this.isPreloading && !cached) {
            // Retourner null pour indiquer qu'aucune donnée fraîche n'est disponible
            // et éviter d'appeler hawk deux fois.
            return null;
        }

        this.stats.requests++;

        try {
            const response = await fetch(`${this.proxyUrl}?stop=${hawkKey}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(10000) // 10s timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            // Mettre en cache
            this.cache.set(cacheKey, {
                data,
                fetchedAt: Date.now()
            });

            this.isAvailable = true;
            this.lastError = null;
            this.stats.successes++;
            
            console.log(`[Realtime] ✅ Données reçues pour hawk:${hawkKey}:`, data.count, 'départs');
            
            return data;

        } catch (error) {
            console.warn(`[Realtime] Erreur pour arrêt ${stopId} (hawk:${hawkKey}):`, error.message);
            this.lastError = error.message;
            this.stats.failures++;
            return null;
        }
    }

    /**
     * Récupère les horaires temps réel pour un StopPlace (arrêt parent avec plusieurs quais)
     * @param {string} stopPlaceId - ID du StopPlace (ex: MOBIITI:StopPlace:77017)
     * @returns {Promise<RealtimeData|null>}
     */
    async getRealtimeForStopPlace(stopPlaceId) {
        if (!this.stops) {
            console.warn('[Realtime] Stops non initialisés, appeler init() d\'abord');
            return null;
        }
        
        // Obtenir toutes les clés hawk pour ce StopPlace
        const hawkKeys = getHawkKeysForStopPlace(stopPlaceId, this.stops);
        
        if (hawkKeys.length === 0) {
            console.debug(`[Realtime] Pas de clés hawk pour StopPlace ${stopPlaceId}`);
            return null;
        }
        
        console.log(`[Realtime] StopPlace ${stopPlaceId} -> ${hawkKeys.length} quais: ${hawkKeys.map(k => k.stopCode).join(', ')}`);
        
        // Récupérer les données pour chaque quai
        const allDepartures = [];
        
        for (const { stopId, stopCode, hawkKey } of hawkKeys) {
            const data = await this.getRealtimeForStop(stopId, stopCode);
            if (data && data.departures) {
                allDepartures.push(...data.departures.map(d => ({
                    ...d,
                    quay: stopCode,
                    hawkKey
                })));
            }
        }
        
        if (allDepartures.length === 0) {
            return null;
        }
        
        // Fusionner et trier par temps
        allDepartures.sort((a, b) => {
            const timeA = this.parseTime(a.time);
            const timeB = this.parseTime(b.time);
            return timeA - timeB;
        });
        
        return {
            stopPlaceId,
            timestamp: new Date().toISOString(),
            departures: allDepartures.slice(0, 10),
            count: allDepartures.length
        };
    }

    /**
     * Parse un temps au format HH:MM en minutes
     */
    parseTime(timeStr) {
        if (!timeStr) return Infinity;
        const match = timeStr.match(/(\d{2}):(\d{2})/);
        if (match) {
            return parseInt(match[1]) * 60 + parseInt(match[2]);
        }
        return Infinity;
    }

    /**
     * Fusionne les horaires GTFS statiques avec les données temps réel
     * V304: Amélioration de la logique de fusion pour éviter les conflits
     * 
     * @param {Array} staticDepartures - Départs GTFS statiques [{time, routeId, destination, ...}]
     * @param {Object} realtimeData - Données temps réel du scraper
     * @returns {Array} Départs enrichis avec isRealtime flag
     */
    mergeWithStatic(staticDepartures, realtimeData) {
        // V304: Si pas de données temps réel, retourner les statiques tels quels
        if (!realtimeData || !realtimeData.schedules || realtimeData.schedules.length === 0) {
            return staticDepartures.map(dep => ({ ...dep, isRealtime: false }));
        }

        // V304: Créer une copie des données RT indexées par ligne + destination
        const rtByLineAndDest = new Map();
        realtimeData.schedules.forEach((rt, index) => {
            const key = `${this.normalizeLigne(rt.ligne)}_${this.normalizeDestination(rt.destination)}`;
            if (!rtByLineAndDest.has(key)) {
                rtByLineAndDest.set(key, []);
            }
            rtByLineAndDest.get(key).push({ ...rt, _index: index });
        });

        const merged = [];
        const usedRealtimeIndices = new Set();

        // V304: Pour chaque départ statique, chercher une correspondance RT précise
        for (const staticDep of staticDepartures) {
            const staticLigne = this.normalizeLigne(staticDep.routeShortName || staticDep.routeId);
            const staticDest = this.normalizeDestination(staticDep.destination);
            const key = `${staticLigne}_${staticDest}`;
            
            let matchedRealtime = null;
            
            // Chercher d'abord un match par ligne + destination
            const candidates = rtByLineAndDest.get(key) || [];
            for (const rt of candidates) {
                if (!usedRealtimeIndices.has(rt._index)) {
                    matchedRealtime = rt;
                    usedRealtimeIndices.add(rt._index);
                    break;
                }
            }
            
            // V304: Si pas de match exact, chercher par ligne seule
            if (!matchedRealtime) {
                for (const rt of realtimeData.schedules) {
                    if (usedRealtimeIndices.has(rt._index)) continue;
                    const rtLigne = this.normalizeLigne(rt.ligne);
                    if (rtLigne === staticLigne) {
                        matchedRealtime = rt;
                        usedRealtimeIndices.add(realtimeData.schedules.indexOf(rt));
                        break;
                    }
                }
            }

            if (matchedRealtime) {
                // V304: Utiliser le temps réel, conserver les infos statiques
                const realtimeMinutes = this.parseTemps(matchedRealtime.temps);

                // --- DÉBUT AJOUT STATS ---
                try {
                    const staticMinutes = this.getMinutesFromTime(staticDep.time);
                    if (realtimeMinutes < 900 && staticMinutes < 900) {
                        const delay = realtimeMinutes - staticMinutes;
                        // Si le retard est cohérent (ex: pas dû à un bug d'horaire > 2h)
                        if (Math.abs(delay) < 120) {
                            this.sendDelayStat(
                                staticDep.routeShortName,
                                // On utilise le nom statique comme référence
                                staticDep.stop_name || 'Arrêt', 
                                staticDep.time,
                                delay
                            );
                        }
                    }
                } catch (e) { /* silent ignore */ }
                // --- FIN AJOUT STATS ---

                merged.push({
                    ...staticDep,
                    isRealtime: true,
                    realtimeMinutes: realtimeMinutes,
                    realtimeText: matchedRealtime.temps,
                    realtimeDestination: matchedRealtime.destination,
                    realtimeQuai: matchedRealtime.quai,
                    realtimeIsTheoretical: matchedRealtime.theoretical || false
                });
            } else {
                // Garder le statique
                merged.push({
                    ...staticDep,
                    isRealtime: false
                });
            }
        }

        // V304: Ajouter les temps réel non matchés (bus supplémentaires ou retardés)
        for (let i = 0; i < realtimeData.schedules.length; i++) {
            if (!usedRealtimeIndices.has(i)) {
                const rt = realtimeData.schedules[i];
                merged.push({
                    routeId: rt.ligne,
                    routeShortName: rt.ligne,
                    destination: rt.destination,
                    isRealtime: true,
                    realtimeMinutes: this.parseTemps(rt.temps),
                    realtimeText: rt.temps,
                    realtimeQuai: rt.quai,
                    realtimeIsTheoretical: rt.theoretical || false,
                    isExtraRealtime: true // Bus non prévu dans le GTFS statique
                });
            }
        }

        // V304: Trier par temps (temps réel en priorité pour le calcul)
        merged.sort((a, b) => {
            const timeA = a.isRealtime ? a.realtimeMinutes : this.getMinutesFromTime(a.time);
            const timeB = b.isRealtime ? b.realtimeMinutes : this.getMinutesFromTime(b.time);
            return timeA - timeB;
        });

        return merged;
    }

    /**
     * Normalise le nom d'une ligne pour comparaison
     */
    normalizeLigne(ligne) {
        if (!ligne) return '';
        return String(ligne).toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    /**
     * V304: Normalise le nom d'une destination pour comparaison
     * Extrait le premier mot significatif pour le matching
     */
    normalizeDestination(dest) {
        if (!dest) return '';
        // Supprimer les accents, mettre en majuscules, garder alphanumérique et espaces
        const normalized = String(dest)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9\s]/g, '')
            .trim();
        // Retourner le premier mot significatif (ignore les articles)
        const words = normalized.split(/\s+/).filter(w => w.length > 2);
        return words[0] || normalized;
    }

    /**
     * Parse le temps d'attente du format "X min" ou "XX:XX"
     * @returns {number} Minutes jusqu'au passage
     */
    parseTemps(temps) {
        if (!temps) return 999;
        
        const tempsLower = temps.toLowerCase().trim();
        
        // Format "X min" ou "Xmin"
        const minMatch = tempsLower.match(/(\d+)\s*min/);
        if (minMatch) {
            return parseInt(minMatch[1], 10);
        }
        
        // Format "à l'approche" ou "imminent"
        if (tempsLower.includes('approche') || tempsLower.includes('imminent') || tempsLower === '0') {
            return 0;
        }
        
        // Format "HH:MM"
        const timeMatch = temps.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
            const now = new Date();
            const targetHour = parseInt(timeMatch[1], 10);
            const targetMin = parseInt(timeMatch[2], 10);
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            const targetMinutes = targetHour * 60 + targetMin;
            let diff = targetMinutes - nowMinutes;
            if (diff < 0) diff += 24 * 60; // Le bus est demain
            return diff;
        }

        return 999; // Inconnu
    }

    /**
     * Envoie les statistiques de retard au serveur
     * (Uniquement si le retard est significatif : > 1 min ou < -1 min)
     */
    sendDelayStat(line, stop, scheduled, delay) {
        // Toujours envoyer l'observation — inclure aussi les bus à l'heure (delay === 0)
        // Pour éviter de surcharger le serveur, on ajoute un jitter et on envoie silencieusement.

        const payload = { line, stop, scheduled, delay };

        // Délai aléatoire (0.5-3s) pour lisser la charge serveur
        const jitter = 500 + Math.random() * 2500;
        setTimeout(() => {
            const apiBase = (window.PERIBUS_API_BASE_URL || '').replace(/\/+$/, '');
            fetch(`${apiBase}/api/record-delay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).then(resp => {
                if (!resp.ok) {
                    // silent fail
                    console.debug('[DelayStat] upload failed', resp.status);
                }
            }).catch(e => console.debug('[DelayStat] upload error', e));
        }, jitter);
    }

    /**
     * Convertit une heure HH:MM en minutes depuis minuit
     */
    getMinutesFromTime(timeStr) {
        if (!timeStr) return 999;
        const match = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (!match) return 999;
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const targetMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        let diff = targetMinutes - nowMinutes;
        if (diff < -60) diff += 24 * 60; // Passage demain
        return diff;
    }

    /**
     * Vide le cache
     */
    clearCache() {
        this.cache.clear();
    }
    
    /**
     * V303: Vérifie si on a des données temps réel récentes pour un arrêt
     * @param {string} stopId - ID de l'arrêt GTFS
     * @param {string} stopCode - Code de l'arrêt (optionnel)
     * @returns {boolean} true si données temps réel disponibles
     */
    hasRealtimeDataForStop(stopId, stopCode = null) {
        const hawkKey = getHawkKeyForStop(stopId, stopCode);
        if (!hawkKey) return false;
        
        const cacheKey = `hawk_${hawkKey}`;
        const cached = this.cache.get(cacheKey);
        
        // Vérifier si le cache existe et n'est pas expiré
        if (cached && Date.now() - cached.fetchedAt < this.cacheMaxAge) {
            // Vérifier qu'il y a bien des données
            return cached.data && cached.data.count > 0;
        }
        
        return false;
    }
}

// Singleton
export const realtimeManager = new RealtimeManager();
