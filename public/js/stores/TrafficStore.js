/**
 * TrafficStore.js - Real-time traffic alerts and delays
 * Phase 3: Data Layer Modularization
 */

import { eventBus, EVENTS } from '../EventBus.js';
import { stateManager } from '../StateManager.js';
import { logger } from '../Logger.js';

export class TrafficStore {
    constructor(config = {}) {
        this.config = config;
        
        // Active traffic alerts
        this.alerts = [];
        this.alertsById = {};
        
        // Delay tracking
        this.delays = {};
        this.delaysByRoute = {};
        
        // Alert TTL (time to live)
        this.alertTtlMs = config.alertTtlMs || 30 * 60 * 1000; // 30 minutes
        
        logger.info('TrafficStore initialized');
    }

    /**
     * Add new traffic alert
     */
    addAlert(alert) {
        logger.info('TrafficStore.addAlert', { id: alert.id, severity: alert.severity });
        
        const timestamp = Date.now();
        const enrichedAlert = {
            ...alert,
            timestamp,
            expiresAt: timestamp + this.alertTtlMs
        };
        
        this.alerts.push(enrichedAlert);
        this.alertsById[alert.id] = enrichedAlert;
        
        // Group by route
        if (alert.routeId) {
            if (!this.delaysByRoute[alert.routeId]) {
                this.delaysByRoute[alert.routeId] = [];
            }
            this.delaysByRoute[alert.routeId].push(enrichedAlert);
        }
        
        eventBus.emit(EVENTS.TRAFFIC_ALERT, { alert: enrichedAlert });
        stateManager.setState({
            data: { traffic: { alerts: this.alerts, count: this.alerts.length } }
        }, 'traffic:alert-added');
    }

    /**
     * Remove resolved alert
     */
    removeAlert(alertId) {
        logger.info('TrafficStore.removeAlert', { id: alertId });
        
        const alert = this.alertsById[alertId];
        if (!alert) return;
        
        this.alerts = this.alerts.filter(a => a.id !== alertId);
        delete this.alertsById[alertId];
        
        // Remove from route grouping
        if (alert.routeId && this.delaysByRoute[alert.routeId]) {
            this.delaysByRoute[alert.routeId] = this.delaysByRoute[alert.routeId]
                .filter(a => a.id !== alertId);
        }
        
        eventBus.emit(EVENTS.TRAFFIC_RESOLVED, { alertId });
        stateManager.setState({
            data: { traffic: { alerts: this.alerts, count: this.alerts.length } }
        }, 'traffic:alert-removed');
    }

    /**
     * Get all active alerts
     */
    getAlerts() {
        this.clearExpiredAlerts();
        return this.alerts;
    }

    /**
     * Get alerts for specific route
     */
    getAlertsByRoute(routeId) {
        this.clearExpiredAlerts();
        return this.delaysByRoute[routeId] || [];
    }

    /**
     * Record delay observation
     */
    recordDelay(routeId, tripId, delaySeconds) {
        logger.debug('TrafficStore.recordDelay', { routeId, tripId, delaySeconds });
        
        const key = `${routeId}:${tripId}`;
        this.delays[key] = {
            routeId,
            tripId,
            delaySeconds,
            timestamp: Date.now()
        };
    }

    /**
     * Get delay for specific trip
     */
    getDelay(routeId, tripId) {
        const key = `${routeId}:${tripId}`;
        return this.delays[key] || null;
    }

    /**
     * Clear expired alerts
     */
    clearExpiredAlerts() {
        const now = Date.now();
        const initialCount = this.alerts.length;
        
        this.alerts = this.alerts.filter(alert => alert.expiresAt > now);
        
        if (this.alerts.length < initialCount) {
            logger.debug('TrafficStore cleared expired alerts', { 
                removed: initialCount - this.alerts.length 
            });
            
            // Rebuild indexes
            this.alertsById = {};
            this.delaysByRoute = {};
            this.alerts.forEach(alert => {
                this.alertsById[alert.id] = alert;
                if (alert.routeId) {
                    if (!this.delaysByRoute[alert.routeId]) {
                        this.delaysByRoute[alert.routeId] = [];
                    }
                    this.delaysByRoute[alert.routeId].push(alert);
                }
            });
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            alerts: this.alerts.length,
            delays: Object.keys(this.delays).length,
            routesAffected: Object.keys(this.delaysByRoute).length
        };
    }

    /**
     * Clear all alerts and delays
     */
    clear() {
        logger.info('TrafficStore.clear');
        this.alerts = [];
        this.alertsById = {};
        this.delays = {};
        this.delaysByRoute = {};
    }
}

// Singleton
let trafficStoreInstance = null;

export function getTrafficStore(config = {}) {
    if (!trafficStoreInstance) {
        trafficStoreInstance = new TrafficStore(config);
    }
    return trafficStoreInstance;
}

export function setTrafficStore(instance) {
    trafficStoreInstance = instance;
}
