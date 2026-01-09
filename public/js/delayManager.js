/*
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */

/**
 * delayManager.js - Gestion des retards temps réel et collecte de statistiques
 * 
 * Responsabilités:
 * 1. Extraire les retards depuis les données temps réel (Hawk)
 * 2. Appliquer les retards au calcul de position des bus
 * 3. Collecter les données de retard pour les statistiques
 * 4. Calculer les ajustements de progression pour un bus en retard
 * 
 * V1 - INITIAL:
 * - Extraction des retards temps réel
 * - Application au calcul de progression
 * - Collecte de statistiques par ligne
 */

export class DelayManager {
    constructor() {
        // Données de retard en cache: clé = tripId, valeur = {delaySeconds, timestamp, ...}
        this.delayCache = new Map();
        
        // Statistiques collectées
        this.stats = {
            totalObservations: 0,
            delaysByLine: {}, // {lineId: {totalDelay, count, maxDelay, minDelay}}
            delaysByHour: {}, // {hour: {totalDelay, count}}
            delaysByStop: {}, // {stopId: {totalDelay, count}}
            peakDelayHours: [], // Heures avec le plus de retards
        };
        
        // Stockage des retards historiques (pour analyse)
        this.delayHistory = []; // [{tripId, lineId, delaySeconds, timestamp, stopId, ...}]
        this.maxHistorySize = 5000; // Garder les 5000 derniers retards
        
        // Cache des correspondances trip->line
        this.tripLineCache = new Map();
        
        // Configuration
        this.minDelayThreshold = 120; // 2 minutes minimum pour considérer comme "en retard"
        this.majorDelayThreshold = 300; // 5 minutes = "retard majeur"
    }

    /**
     * Initialise le manager avec les références nécessaires
     * @param {DataManager} dataManager - Pour accéder aux données GTFS
     * @param {RealtimeManager} realtimeManager - Pour les données temps réel
     */
    init(dataManager, realtimeManager) {
        this.dataManager = dataManager;
        this.realtimeManager = realtimeManager;
    }

    /**
     * Calcule le retard d'un bus donné
     * Combine les données temps réel avec les horaires statiques
     * 
     * @param {Object} trip - Données du trip GTFS
     * @param {Array} stopTimes - Horaires statiques de ce trip
     * @param {number} currentSeconds - Heure actuelle en secondes
     * @returns {Object|null} {delaySeconds, isMajor, relevantStop, scheduledTime, estimatedTime}
     */
    calculateTripDelay(trip, stopTimes, currentSeconds) {
        if (!trip || !stopTimes || stopTimes.length === 0) {
            return null;
        }

        const tripId = trip.trip_id;
        
        // Chercher le retard dans le cache
        const cached = this.delayCache.get(tripId);
        if (cached && Date.now() - cached.timestamp < 60000) { // Cache 1 minute
            return cached.data;
        }

        // Trouver l'arrêt actuel du bus
        const relevantStop = this.findCurrentStopForTrip(stopTimes, currentSeconds);
        if (!relevantStop) {
            return null;
        }

        // Essayer d'obtenir les données temps réel pour cet arrêt
        const realtimeData = this.getRealTimeDataForStop(relevantStop.stop_id, trip.route_id);
        
        if (!realtimeData) {
            // Pas de données temps réel disponible
            return null;
        }

        // Calculer le retard en comparant l'horaire statique vs temps réel
        const delaySeconds = this.computeDelaySeconds(relevantStop, realtimeData);
        
        if (Math.abs(delaySeconds) < this.minDelayThreshold) {
            // Retard trop faible, ignorer
            return null;
        }

        const isMajor = Math.abs(delaySeconds) >= this.majorDelayThreshold;
        
        const delayData = {
            tripId,
            delaySeconds,
            isMajor,
            relevantStop,
            scheduledTime: this.formatTime(relevantStop.departure_time),
            estimatedTime: this.addSecondsToTime(relevantStop.departure_time, delaySeconds),
            stopId: relevantStop.stop_id
        };

        // Mettre en cache
        this.delayCache.set(tripId, {
            data: delayData,
            timestamp: Date.now()
        });

        return delayData;
    }

    /**
     * Ajuste la progression d'un bus en fonction de son retard
     * Si un bus a du retard, on recalcule sa position en fonction de l'heure estimée
     * 
     * @param {Object} segment - Segment de route actuel
     * @param {Object} delayData - Données de retard
     * @param {number} currentSeconds - Heure actuelle
     * @returns {number} Progress ajusté (0-1)
     */
    adjustProgressForDelay(segment, delayData, currentSeconds) {
        if (!segment || !delayData) {
            return segment?.progress || 0;
        }

        const originalProgress = segment.progress;
        
        // Si le bus a du retard positif, on avance sa position fictive
        // en simulant qu'il aurait dû être à cette position à cette heure
        if (delayData.delaySeconds > 0) {
            // Le bus est en retard: on avance sa position pour qu'il paraisse "plus avancé"
            // pour que visuellement on voit qu'il rattrape du temps
            const adjustmentFactor = Math.min(0.05, delayData.delaySeconds / 3600); // Max 5% d'avance visuelle
            return Math.min(1, originalProgress + adjustmentFactor);
        }
        
        // Si le bus est en avance (retard négatif), on recule légèrement sa position
        if (delayData.delaySeconds < 0) {
            const adjustmentFactor = Math.min(0.05, Math.abs(delayData.delaySeconds) / 3600);
            return Math.max(0, originalProgress - adjustmentFactor);
        }

        return originalProgress;
    }

    /**
     * Collecte les données de retard pour les statistiques
     * @param {Object} delayData - Données de retard
     * @param {Object} route - Route du bus
     * @param {number} currentSeconds - Heure actuelle
     */
    recordDelay(delayData, route, currentSeconds) {
        if (!delayData || !route) return;

        const { tripId, delaySeconds, isMajor, stopId } = delayData;
        const lineId = route.route_id;
        const currentHour = Math.floor(currentSeconds / 3600);

        // Ajouter à l'historique
        this.delayHistory.push({
            tripId,
            lineId,
            delaySeconds,
            isMajor,
            stopId,
            timestamp: Date.now(),
            hour: currentHour
        });

        // Limiter la taille de l'historique
        if (this.delayHistory.length > this.maxHistorySize) {
            this.delayHistory.shift();
        }

        // Mettre à jour les statistiques par ligne
        if (!this.stats.delaysByLine[lineId]) {
            this.stats.delaysByLine[lineId] = {
                totalDelay: 0,
                count: 0,
                maxDelay: 0,
                minDelay: 0,
                majorDelayCount: 0
            };
        }
        const lineStat = this.stats.delaysByLine[lineId];
        lineStat.totalDelay += delaySeconds;
        lineStat.count++;
        lineStat.maxDelay = Math.max(lineStat.maxDelay, delaySeconds);
        lineStat.minDelay = Math.min(lineStat.minDelay, delaySeconds);
        if (isMajor) lineStat.majorDelayCount++;

        // Mettre à jour les statistiques par heure
        const hourKey = `${currentHour}:00`;
        if (!this.stats.delaysByHour[hourKey]) {
            this.stats.delaysByHour[hourKey] = { totalDelay: 0, count: 0 };
        }
        this.stats.delaysByHour[hourKey].totalDelay += delaySeconds;
        this.stats.delaysByHour[hourKey].count++;

        // Mettre à jour les statistiques par arrêt
        if (!this.stats.delaysByStop[stopId]) {
            this.stats.delaysByStop[stopId] = { totalDelay: 0, count: 0 };
        }
        this.stats.delaysByStop[stopId].totalDelay += delaySeconds;
        this.stats.delaysByStop[stopId].count++;

        this.stats.totalObservations++;
    }

    /**
     * Obtient les statistiques de retard compilées
     * @returns {Object} Statistiques formatées
     */
    getDelayStats() {
        const stats = {
            totalObservations: this.stats.totalObservations,
            
            // Retard moyen par ligne
            lineStats: Object.entries(this.stats.delaysByLine).map(([lineId, data]) => ({
                lineId,
                averageDelay: Math.round(data.totalDelay / (data.count || 1)),
                maxDelay: data.maxDelay,
                minDelay: data.minDelay,
                majorDelayCount: data.majorDelayCount,
                observations: data.count
            })),

            // Retard moyen par heure
            hourlyStats: Object.entries(this.stats.delaysByHour)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([hour, data]) => ({
                    hour,
                    averageDelay: Math.round(data.totalDelay / (data.count || 1)),
                    observations: data.count
                })),

            // Arrêts les plus affectés
            worstStops: Object.entries(this.stats.delaysByStop)
                .sort((a, b) => (b[1].totalDelay / (b[1].count || 1)) - (a[1].totalDelay / (a[1].count || 1)))
                .slice(0, 10)
                .map(([stopId, data]) => ({
                    stopId,
                    averageDelay: Math.round(data.totalDelay / (data.count || 1)),
                    observations: data.count
                }))
        };

        return stats;
    }

    /**
     * Envoie les statistiques au serveur pour stockage persistant
     */
    async syncStatsToServer() {
        try {
            const stats = this.getDelayStats();
            
            // Tenter d'envoyer au serveur
            const response = await fetch('/api/delay-stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    stats,
                    history: this.delayHistory.slice(-100) // Envoyer les 100 derniers
                })
            }).catch(() => null);

            if (response && response.ok) {
                console.log('[DelayManager] ✅ Statistiques synchronisées au serveur');
                return true;
            }
        } catch (error) {
            console.debug('[DelayManager] Serveur indisponible, utilisation localStorage');
        }

        // Fallback: Sauvegarder localement avec localStorage
        try {
            const stats = this.getDelayStats();
            const localStorageData = {
                timestamp: new Date().toISOString(),
                stats,
                history: this.delayHistory.slice(-100)
            };
            
            localStorage.setItem('perimap_delay_stats', JSON.stringify(localStorageData));
            console.log('[DelayManager] 💾 Statistiques sauvegardées en localStorage');
            return true;
        } catch (error) {
            console.warn('[DelayManager] Erreur lors de la sauvegarde locale:', error);
            return false;
        }
    }

    /**
     * Charge les statistiques depuis localStorage
     */
    loadStatsFromStorage() {
        try {
            const stored = localStorage.getItem('perimap_delay_stats');
            if (!stored) return null;
            
            const data = JSON.parse(stored);
            console.log('[DelayManager] 📂 Statistiques chargées depuis localStorage');
            return data;
        } catch (error) {
            console.warn('[DelayManager] Erreur lors du chargement des stats:', error);
            return null;
        }
    }

    /**
     * Efface toutes les statistiques stockées
     */
    clearStorage() {
        try {
            localStorage.removeItem('perimap_delay_stats');
            this.delayHistory = [];
            this.stats = {
                totalObservations: 0,
                delaysByLine: {},
                delaysByHour: {},
                delaysByStop: {},
                peakDelayHours: []
            };
            console.log('[DelayManager] 🗑️ Toutes les statistiques ont été effacées');
            return true;
        } catch (error) {
            console.warn('[DelayManager] Erreur lors du nettoyage:', error);
            return false;
        }
    }

    /**
     * Exporte les statistiques pour affichage/téléchargement
     */
    exportStats(format = 'json') {
        const stats = this.getDelayStats();
        
        if (format === 'csv') {
            return this.statsToCSV(stats);
        }
        
        return stats;
    }

    // ============ HELPERS PRIVÉS ============

    /**
     * Trouve l'arrêt actuel du bus dans son trip
     */
    findCurrentStopForTrip(stopTimes, currentSeconds) {
        if (!stopTimes || stopTimes.length === 0) return null;

        for (let i = 1; i < stopTimes.length; i++) {
            const prevStop = stopTimes[i - 1];
            const currentStop = stopTimes[i];
            
            const prevDeparture = this.dataManager.timeToSeconds(prevStop.departure_time);
            const currentDeparture = this.dataManager.timeToSeconds(currentStop.departure_time);

            if (currentSeconds >= prevDeparture && currentSeconds < currentDeparture) {
                return currentStop; // Retourner l'arrêt vers lequel on se dirige
            }
        }

        // Dernier segment
        const lastStop = stopTimes[stopTimes.length - 1];
        const prevStop = stopTimes[stopTimes.length - 2];
        const prevDeparture = this.dataManager.timeToSeconds(prevStop.departure_time);
        const lastArrival = this.dataManager.timeToSeconds(lastStop.arrival_time);

        if (currentSeconds >= prevDeparture && currentSeconds <= lastArrival) {
            return lastStop;
        }

        return null;
    }

    /**
     * Récupère les données temps réel pour un arrêt spécifique
     * (Serait appelé avec les vraies données du scraper)
     */
    getRealTimeDataForStop(stopId, routeId) {
        // Placeholder - À intégrer avec realtimeManager
        // Pour l'instant, retourne null
        return null;
    }

    /**
     * Calcule le retard en secondes en comparant horaire statique vs temps réel
     */
    computeDelaySeconds(stop, realtimeData) {
        // Placeholder - À intégrer avec les vraies données
        return 0;
    }

    /**
     * Formate une heure HH:MM:SS
     */
    formatTime(timeStr) {
        return timeStr || '--:--';
    }

    /**
     * Ajoute des secondes à un heure format HH:MM:SS
     */
    addSecondsToTime(timeStr, seconds) {
        if (!timeStr) return '--:--';
        
        const parts = timeStr.split(':');
        let hours = parseInt(parts[0]) || 0;
        let minutes = parseInt(parts[1]) || 0;
        let secs = parseInt(parts[2]) || 0;

        secs += seconds;
        while (secs >= 60) {
            minutes++;
            secs -= 60;
        }
        while (minutes >= 60) {
            hours++;
            minutes -= 60;
        }

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    /**
     * Convertit les stats en CSV
     */
    statsToCSV(stats) {
        let csv = 'Hour,Line,AverageDelay(seconds),MaxDelay,Observations\n';
        
        stats.hourlyStats.forEach(hourStat => {
            csv += `${hourStat.hour},,${hourStat.averageDelay},${hourStat.observations}\n`;
        });

        stats.lineStats.forEach(lineStat => {
            csv += `,${lineStat.lineId},${lineStat.averageDelay},${lineStat.maxDelay},${lineStat.observations}\n`;
        });

        return csv;
    }
}

// Instance globale
export const delayManager = new DelayManager();
