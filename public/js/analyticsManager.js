/**
 * analyticsManager.js - Gestion des données analytiques utilisateur
 * 
 * Collecte des données sur :
 * - Les arrêts les plus cliqués
 * - Les lignes les plus consultées
 * - Les patterns de consultation pour optimisation
 * 
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 */

export class AnalyticsManager {
    constructor() {
        // Clés de stockage localStorage
        this.STORAGE_KEYS = {
            STOP_CLICKS: 'perimap_analytics_stop_clicks',
            ROUTE_CLICKS: 'perimap_analytics_route_clicks',
            STOP_PLACE_CLICKS: 'perimap_analytics_stopplace_clicks',
            SESSION_DATA: 'perimap_analytics_session',
            PRELOAD_PRIORITY: 'perimap_analytics_preload_priority',
        };

        // Données en mémoire (session courante)
        this.stopClicks = new Map();
        this.routeClicks = new Map();
        this.stopPlaceClicks = new Map();
        
        // Statistiques de session
        this.sessionData = {
            startTime: Date.now(),
            totalClicks: 0,
            totalStopsViewed: 0,
        };

        // Configuration
        this.MAX_HISTORY_ENTRIES = 1000; // Limiter la taille des données stockées
        this.PERSISTENCE_INTERVAL = 30000; // Sauvegarder chaque 30s

        this.init();
    }

    /**
     * Initialise le gestionnaire analytique
     */
    init() {
        // Charger les données historiques du localStorage
        this.loadFromStorage();
        
        // Sauvegarder périodiquement
        setInterval(() => this.saveToStorage(), this.PERSISTENCE_INTERVAL);
        
        console.log('[Analytics] Gestionnaire analytique initialisé');
    }

    /**
     * Enregistre un clic sur un arrêt
     * @param {string} stopId - ID GTFS de l'arrêt
     * @param {string} stopName - Nom de l'arrêt
     */
    trackStopClick(stopId, stopName) {
        if (!stopId) return;

        const key = `${stopId}_${stopName}`;
        const current = this.stopClicks.get(key) || {
            stopId,
            stopName,
            count: 0,
            lastClick: null,
            firstClick: Date.now()
        };

        current.count++;
        current.lastClick = Date.now();
        this.stopClicks.set(key, current);

        this.sessionData.totalClicks++;
        this.sessionData.totalStopsViewed++;

        console.debug(`[Analytics] Arrêt cliqué: ${stopName} (${stopId}) - Total: ${current.count}`);
    }

    /**
     * Enregistre un clic sur un StopPlace (arrêt parent)
     * @param {string} stopPlaceId - ID du StopPlace
     * @param {string} stopPlaceName - Nom du StopPlace
     */
    trackStopPlaceClick(stopPlaceId, stopPlaceName) {
        if (!stopPlaceId) return;

        const key = `${stopPlaceId}_${stopPlaceName}`;
        const current = this.stopPlaceClicks.get(key) || {
            stopPlaceId,
            stopPlaceName,
            count: 0,
            lastClick: null,
            firstClick: Date.now()
        };

        current.count++;
        current.lastClick = Date.now();
        this.stopPlaceClicks.set(key, current);

        this.sessionData.totalClicks++;

        console.debug(`[Analytics] StopPlace cliqué: ${stopPlaceName} (${stopPlaceId}) - Total: ${current.count}`);
    }

    /**
     * Enregistre une consultation de ligne
     * @param {string} routeId - ID GTFS de la ligne
     * @param {string} routeShortName - Nom court (ex: 'A', 'e1')
     */
    trackRouteClick(routeId, routeShortName) {
        if (!routeId) return;

        const key = routeShortName || routeId;
        const current = this.routeClicks.get(key) || {
            routeId,
            routeShortName: routeShortName || routeId,
            count: 0,
            lastClick: null,
            firstClick: Date.now()
        };

        current.count++;
        current.lastClick = Date.now();
        this.routeClicks.set(key, current);

        this.sessionData.totalClicks++;

        console.debug(`[Analytics] Ligne consultée: ${key} - Total: ${current.count}`);
    }

    /**
     * Récupère les arrêts les plus cliqués
     * @param {number} limit - Nombre d'arrêts à retourner
     * @returns {Array} - Arrêts triés par nombre de clics décroissant
     */
    getTopStops(limit = 10) {
        return Array.from(this.stopClicks.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    /**
     * Récupère les StopPlaces les plus cliqués
     * @param {number} limit - Nombre de StopPlaces à retourner
     * @returns {Array} - StopPlaces triés par nombre de clics décroissant
     */
    getTopStopPlaces(limit = 10) {
        return Array.from(this.stopPlaceClicks.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    /**
     * Récupère les lignes les plus consultées
     * @param {number} limit - Nombre de lignes à retourner
     * @returns {Array} - Lignes triées par nombre de consultations décroissant
     */
    getTopRoutes(limit = 10) {
        return Array.from(this.routeClicks.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    /**
     * Calcule la priorité de préchargement
     * Retourne les arrêts/lignes à précharger en priorité
     * @returns {Object} - { stops: [], routes: [], stopPlaces: [] }
     */
    computePreloadPriority() {
        const priority = {
            stops: this.getTopStops(20),
            stopPlaces: this.getTopStopPlaces(10),
            routes: this.getTopRoutes(10)
        };

        console.log('[Analytics] Priorités de préchargement calculées:', priority);
        return priority;
    }

    /**
     * Sauvegarde les données dans localStorage
     */
    saveToStorage() {
        try {
            const stopClicksData = Array.from(this.stopClicks.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, this.MAX_HISTORY_ENTRIES);

            const stopPlaceClicksData = Array.from(this.stopPlaceClicks.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, this.MAX_HISTORY_ENTRIES);

            const routeClicksData = Array.from(this.routeClicks.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, this.MAX_HISTORY_ENTRIES);

            localStorage.setItem(this.STORAGE_KEYS.STOP_CLICKS, JSON.stringify(stopClicksData));
            localStorage.setItem(this.STORAGE_KEYS.STOP_PLACE_CLICKS, JSON.stringify(stopPlaceClicksData));
            localStorage.setItem(this.STORAGE_KEYS.ROUTE_CLICKS, JSON.stringify(routeClicksData));

            // Sauvegarder les données de session (utiles pour la prochaine session)
            const sessionInfo = {
                lastUpdate: Date.now(),
                sessionStartTime: this.sessionData.startTime,
                totalClicks: this.sessionData.totalClicks,
                totalStopsViewed: this.sessionData.totalStopsViewed
            };
            localStorage.setItem(this.STORAGE_KEYS.SESSION_DATA, JSON.stringify(sessionInfo));

            console.debug('[Analytics] Données sauvegardées dans localStorage');
        } catch (error) {
            console.warn('[Analytics] Erreur lors de la sauvegarde:', error.message);
        }
    }

    /**
     * Charge les données depuis localStorage
     */
    loadFromStorage() {
        try {
            const stopClicksData = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.STOP_CLICKS)) || [];
            const stopPlaceClicksData = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.STOP_PLACE_CLICKS)) || [];
            const routeClicksData = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.ROUTE_CLICKS)) || [];

            // Reconstruire les Maps
            stopClicksData.forEach(item => {
                const key = `${item.stopId}_${item.stopName}`;
                this.stopClicks.set(key, item);
            });

            stopPlaceClicksData.forEach(item => {
                const key = `${item.stopPlaceId}_${item.stopPlaceName}`;
                this.stopPlaceClicks.set(key, item);
            });

            routeClicksData.forEach(item => {
                const key = item.routeShortName || item.routeId;
                this.routeClicks.set(key, item);
            });

            console.log('[Analytics] Données chargées depuis localStorage');
            console.log(`  - ${this.stopClicks.size} arrêts`);
            console.log(`  - ${this.stopPlaceClicks.size} stop places`);
            console.log(`  - ${this.routeClicks.size} lignes`);
        } catch (error) {
            console.warn('[Analytics] Erreur lors du chargement:', error.message);
        }
    }

    /**
     * Exporte les statistiques pour debug/monitoring
     */
    getStatistics() {
        return {
            sessionData: this.sessionData,
            uniqueStops: this.stopClicks.size,
            uniqueStopPlaces: this.stopPlaceClicks.size,
            uniqueRoutes: this.routeClicks.size,
            topStops: this.getTopStops(5),
            topStopPlaces: this.getTopStopPlaces(5),
            topRoutes: this.getTopRoutes(5),
            preloadPriority: this.computePreloadPriority()
        };
    }

    /**
     * Réinitialise les données (pour debug)
     */
    reset() {
        this.stopClicks.clear();
        this.routeClicks.clear();
        this.stopPlaceClicks.clear();
        this.sessionData = {
            startTime: Date.now(),
            totalClicks: 0,
            totalStopsViewed: 0
        };
        localStorage.removeItem(this.STORAGE_KEYS.STOP_CLICKS);
        localStorage.removeItem(this.STORAGE_KEYS.ROUTE_CLICKS);
        localStorage.removeItem(this.STORAGE_KEYS.STOP_PLACE_CLICKS);
        console.log('[Analytics] Données réinitialisées');
    }
}

// Export d'une instance singleton
export const analyticsManager = new AnalyticsManager();
