/**
 * realtimeManager.js - Gestion des horaires temps réel Péribus
 * Scrape hawk.perimouv.fr pour obtenir les prochains passages en temps réel
 * 
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 */

import { getHawkKeyForStop, isRealtimeEnabled } from './config/stopKeyMapping.js';

export class RealtimeManager {
    constructor() {
        // URL du proxy API (sur Vercel)
        this.proxyUrl = '/api/realtime';
        
        // Cache des données temps réel par arrêt
        this.cache = new Map();
        this.cacheMaxAge = 30 * 1000; // 30 secondes
        
        // État
        this.isAvailable = false;
        this.lastError = null;
        
        // Statistiques
        this.stats = {
            requests: 0,
            successes: 0,
            failures: 0
        };
    }

    /**
     * Récupère les horaires temps réel pour un arrêt
     * @param {string|number} stopId - L'identifiant GTFS de l'arrêt
     * @returns {Promise<RealtimeData|null>}
     */
    async getRealtimeForStop(stopId) {
        // Vérifier si le temps réel est activé pour cet arrêt
        if (!isRealtimeEnabled(stopId)) {
            return null;
        }
        
        // Obtenir la clé hawk correspondante
        const hawkKey = getHawkKeyForStop(stopId);
        if (!hawkKey) {
            console.debug(`[Realtime] Pas de clé hawk pour stop ${stopId}`);
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
            
            return data;

        } catch (error) {
            console.warn(`[Realtime] Erreur pour arrêt ${stopId} (hawk:${hawkKey}):`, error.message);
            this.lastError = error.message;
            this.stats.failures++;
            return null;
        }
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
}

// Singleton
export const realtimeManager = new RealtimeManager();
