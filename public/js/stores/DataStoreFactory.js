/**
 * DataStoreFactory.js - Central factory for all data stores
 * Phase 3: Data Layer Modularization
 */

import { GTFSStore, getGTFSStore } from './GTFSStore.js';
import { TrafficStore, getTrafficStore } from './TrafficStore.js';
import { UserStore, getUserStore } from './UserStore.js';
import { CacheStore, getCacheStore } from './CacheStore.js';
import { logger } from '../Logger.js';
import { eventBus, EVENTS } from '../EventBus.js';

export class DataStoreFactory {
    constructor(config = {}) {
        this.config = config;
        
        // Initialize all stores
        this.gtfs = getGTFSStore(config.gtfs || {});
        this.traffic = getTrafficStore(config.traffic || {});
        this.user = getUserStore(config.user || {});
        this.cache = getCacheStore(config.cache || {});
        
        logger.info('DataStoreFactory initialized', { storesCount: 4 });
        eventBus.emit('data:stores-ready', { factory: this });
    }

    /**
     * Load all GTFS data
     */
    async loadGTFSData(onProgress = null) {
        logger.info('DataStoreFactory.loadGTFSData');
        return this.gtfs.loadAllData(onProgress);
    }

    /**
     * Get all active traffic alerts
     */
    getTrafficAlerts() {
        return this.traffic.getAlerts();
    }

    /**
     * Get user preferences
     */
    getUserPreferences() {
        return this.user.getPreferences();
    }

    /**
     * Get comprehensive statistics
     */
    getStats() {
        return {
            gtfs: this.gtfs.getStats(),
            traffic: this.traffic.getStats(),
            user: this.user.getStats(),
            cache: this.cache.getStats()
        };
    }

    /**
     * Clear all caches
     */
    clearAllCaches() {
        logger.info('DataStoreFactory.clearAllCaches');
        this.cache.clear();
        logger.info('All caches cleared');
    }

    /**
     * Get health status
     */
    getHealth() {
        return {
            gtfs: { loaded: this.gtfs.isLoaded },
            traffic: { alerts: this.traffic.alerts.length },
            user: { preferences: Object.keys(this.user.preferences).length },
            cache: { size: this.cache.memoryCache.size }
        };
    }
}

// Singleton factory instance
let factoryInstance = null;

export function initializeDataStores(config = {}) {
    logger.info('Initializing data stores factory', { config });
    
    if (!factoryInstance) {
        factoryInstance = new DataStoreFactory(config);
    }
    
    return factoryInstance;
}

export function getDataStoreFactory() {
    if (!factoryInstance) {
        logger.warn('DataStoreFactory not initialized, creating with defaults');
        factoryInstance = new DataStoreFactory({});
    }
    return factoryInstance;
}
