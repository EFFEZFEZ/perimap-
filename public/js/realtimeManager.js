/**
 * realtimeManager.js - Gestion des horaires temps réel Péribus
 * Scrape hawk.perimouv.fr pour obtenir les prochains passages en temps réel
 * 
 * V2 - OPTIMISÉ AVEC PRÉCHARGEMENT INTELLIGENT:
 * - Précharge les horaires des lignes principales au démarrage
 * - Utilise les données analytiques pour optimiser les chargements
 * - Cache agressif pour éviter les appels API répétés
 * 
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 */

import { getHawkKeyForStop, getHawkKeysForStopPlace, isRealtimeEnabled, loadStopIdMapping } from './config/stopKeyMapping.js';
import { analyticsManager } from './analyticsManager.js';
import { LINE_CATEGORIES } from './config/routes.js';

export class RealtimeManager {
    constructor() {
        // URL du proxy API (sur Vercel)
        this.proxyUrl = '/api/realtime';
        
        // Cache des données temps réel par arrêt
        this.cache = new Map();
        this.cacheMaxAge = 30 * 1000; // 30 secondes
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

        // Configuration du préchargement
        this.preloadConfig = {
            mainLinesOnly: true, // Précharger seulement lignes majeures au démarrage
            preloadTopStops: true, // Précharger les arrêts les plus consultés
            maxPreloadRequests: 50, // Limiter le nombre de préchargements parallèles
            delayBetweenRequests: 100 // 100ms entre les requêtes pour éviter surcharge
        };

        this.isPreloading = false;
    }

    /**
     * Initialise le manager avec les données GTFS
     * @param {Array} stops - Liste des arrêts GTFS
     * @param {boolean} [autoPreload=true] - Lancer le préchargement automatiquement
     */
    init(stops, autoPreload = true) {
        this.stops = stops;
        loadStopIdMapping(stops);

        // Lancer le préchargement intelligent en arrière-plan
        if (autoPreload) {
            // Attendre un peu pour ne pas bloquer le démarrage de l'app
            setTimeout(() => this.preloadMainLinesAndTopStops(), 500);
        }
    }

    /**
     * Précharge les horaires des lignes principales et arrêts fréquents
     * S'exécute en arrière-plan sans bloquer l'interface
     * NOTE: Le préchargement est actuellement désactivé car les données temps réel
     * sont chargées efficacement à la demande quand l'utilisateur clique sur un arrêt
     */
    async preloadMainLinesAndTopStops() {
        if (this.isPreloading) {
            console.warn('[Realtime] Préchargement déjà en cours');
            return;
        }

        this.isPreloading = true;
        console.log('[Realtime] 🚀 Démarrage du préchargement intelligent...');

        try {
            const stopsToPreload = new Set();

            // 1. Ajouter tous les arrêts des lignes majeures (A, B, C, D, express)
            // NOTE: Le préchargement est optimisé car les données temps réel
            // sont mieux chargées à la demande (réduction de la charge serveur)
            if (this.preloadConfig.mainLinesOnly && this.stops) {
                const mainLines = [
                    ...LINE_CATEGORIES.majeures.lines,
                    ...LINE_CATEGORIES.express.lines
                ];

                // Les stops GTFS ne contiennent pas les lignes qui les desservent
                // Cette info est implicite dans les stop_times. 
                // Le préchargement à la demande est plus efficace
                this.stops.forEach(stop => {
                    if (isRealtimeEnabled(stop.stop_id, stop.stop_code)) {
                        // Ajouter seulement les arrêts avec temps réel actif
                        // Le filtrage par ligne sera fait lors du chargement
                        stopsToPreload.add(stop);
                    }
                });

                console.log(`[Realtime] ${stopsToPreload.size} arrêts avec temps réel actif identifiés`);
            }

            // 2. Ajouter les arrêts les plus consultés (selon analytics) - PLUS PERTINENT
            if (this.preloadConfig.preloadTopStops && analyticsManager) {
                const topStops = analyticsManager.getTopStops(20);
                topStops.forEach(topStop => {
                    if (this.stops) {
                        const stop = this.stops.find(s => s.stop_id === topStop.stopId);
                        if (stop && isRealtimeEnabled(stop.stop_id, stop.stop_code)) {
                            stopsToPreload.add(stop);
                        }
                    }
                });

                console.log(`[Realtime] +${topStops.length} arrêts populaires identifiés`);
            }

            // 3. Lancer le préchargement par batch pour éviter surcharge
            const stopsArray = Array.from(stopsToPreload).slice(0, this.preloadConfig.maxPreloadRequests);
            const batchSize = 10;
            let successCount = 0;
            let failureCount = 0;

            for (let i = 0; i < stopsArray.length; i += batchSize) {
                const batch = stopsArray.slice(i, i + batchSize);
                const promises = batch.map((stop, index) => {
                    return new Promise(resolve => {
                        // Délai pour éviter surcharge serveur
                        setTimeout(async () => {
                            try {
                                await this.getRealtimeForStop(stop.stop_id, stop.stop_code);
                                this.preloadedStops.add(stop.stop_id);
                                successCount++;
                                resolve();
                            } catch (error) {
                                failureCount++;
                                resolve();
                            }
                        }, index * this.preloadConfig.delayBetweenRequests);
                    });
                });

                await Promise.all(promises);
                console.log(`[Realtime] Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stopsArray.length / batchSize)} complété`);
            }

            this.stats.preloadRequests = stopsArray.length;
            this.stats.preloadSuccesses = successCount;
            this.stats.preloadFailures = failureCount;

            console.log(`[Realtime] ✅ Préchargement terminé: ${successCount} succès, ${failureCount} erreurs`);
        } catch (error) {
            console.error('[Realtime] Erreur lors du préchargement:', error);
        } finally {
            this.isPreloading = false;
        }
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
     * @param {Array} staticDepartures - Départs GTFS statiques [{time, routeId, destination, ...}]
     * @param {Object} realtimeData - Données temps réel du scraper
     * @returns {Array} Départs enrichis avec isRealtime flag
     */
    mergeWithStatic(staticDepartures, realtimeData) {
        if (!realtimeData || !realtimeData.schedules || realtimeData.schedules.length === 0) {
            // Pas de données temps réel, retourner les statiques
            return staticDepartures.map(dep => ({ ...dep, isRealtime: false }));
        }

        const merged = [];
        const usedRealtime = new Set();

        // Pour chaque départ statique, chercher une correspondance temps réel
        for (const staticDep of staticDepartures) {
            let matchedRealtime = null;

            // Chercher un match par ligne et destination
            for (let i = 0; i < realtimeData.schedules.length; i++) {
                if (usedRealtime.has(i)) continue;

                const rt = realtimeData.schedules[i];
                
                // Matcher par ligne (A, B, C, D, etc.)
                const rtLigne = this.normalizeLigne(rt.ligne);
                const staticLigne = this.normalizeLigne(staticDep.routeShortName || staticDep.routeId);

                if (rtLigne === staticLigne) {
                    // Match trouvé !
                    matchedRealtime = rt;
                    usedRealtime.add(i);
                    break;
                }
            }

            if (matchedRealtime) {
                // Utiliser le temps réel
                const realtimeMinutes = this.parseTemps(matchedRealtime.temps);
                merged.push({
                    ...staticDep,
                    isRealtime: true,
                    realtimeMinutes: realtimeMinutes,
                    realtimeText: matchedRealtime.temps,
                    realtimeDestination: matchedRealtime.destination,
                    realtimeQuai: matchedRealtime.quai
                });
            } else {
                // Garder le statique
                merged.push({
                    ...staticDep,
                    isRealtime: false
                });
            }
        }

        // Ajouter les temps réel non matchés (bus supplémentaires)
        for (let i = 0; i < realtimeData.schedules.length; i++) {
            if (!usedRealtime.has(i)) {
                const rt = realtimeData.schedules[i];
                merged.push({
                    routeId: rt.ligne,
                    routeShortName: rt.ligne,
                    destination: rt.destination,
                    isRealtime: true,
                    realtimeMinutes: this.parseTemps(rt.temps),
                    realtimeText: rt.temps,
                    realtimeQuai: rt.quai,
                    isExtraRealtime: true // Bus non prévu dans le GTFS statique
                });
            }
        }

        // Trier par temps (temps réel d'abord si disponible)
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
