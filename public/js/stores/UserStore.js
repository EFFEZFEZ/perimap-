/**
 * UserStore.js - User preferences, history, saved locations
 * Phase 3: Data Layer Modularization
 */

import { logger } from '../Logger.js';

export class UserStore {
    constructor(config = {}) {
        this.config = config;
        
        // User data
        this.preferences = {};
        this.searchHistory = [];
        this.savedLocations = [];
        
        // Storage keys
        this.prefsKey = 'peribus_user_prefs';
        this.historyKey = 'peribus_search_history';
        this.locationsKey = 'peribus_saved_locations';
        
        // Load from storage
        this.loadFromStorage();
        
        logger.info('UserStore initialized', { 
            prefs: Object.keys(this.preferences).length,
            history: this.searchHistory.length,
            locations: this.savedLocations.length
        });
    }

    /**
     * Load from localStorage
     */
    loadFromStorage() {
        try {
            const prefs = localStorage.getItem(this.prefsKey);
            if (prefs) this.preferences = JSON.parse(prefs);
            
            const history = localStorage.getItem(this.historyKey);
            if (history) this.searchHistory = JSON.parse(history);
            
            const locations = localStorage.getItem(this.locationsKey);
            if (locations) this.savedLocations = JSON.parse(locations);
            
            logger.debug('UserStore loaded from storage');
        } catch (error) {
            logger.error('UserStore.loadFromStorage failed', { error: error.message });
        }
    }

    /**
     * Get user preferences
     */
    getPreferences() {
        return { ...this.preferences };
    }

    /**
     * Update preferences
     */
    updatePreferences(updates) {
        logger.info('UserStore.updatePreferences', updates);
        
        this.preferences = { ...this.preferences, ...updates };
        
        try {
            localStorage.setItem(this.prefsKey, JSON.stringify(this.preferences));
        } catch (error) {
            logger.error('Failed to save preferences', { error: error.message });
        }
    }

    /**
     * Get search history
     */
    getSearchHistory() {
        return [...this.searchHistory];
    }

    /**
     * Add search to history
     */
    addSearchToHistory(search) {
        logger.debug('UserStore.addSearchToHistory', { from: search.from, to: search.to });
        
        const entry = {
            ...search,
            timestamp: Date.now()
        };
        
        // Add to beginning, limit to 50 entries
        this.searchHistory.unshift(entry);
        this.searchHistory = this.searchHistory.slice(0, 50);
        
        try {
            localStorage.setItem(this.historyKey, JSON.stringify(this.searchHistory));
        } catch (error) {
            logger.error('Failed to save history', { error: error.message });
        }
    }

    /**
     * Clear search history
     */
    clearSearchHistory() {
        logger.info('UserStore.clearSearchHistory');
        this.searchHistory = [];
        localStorage.removeItem(this.historyKey);
    }

    /**
     * Get saved locations
     */
    getSavedLocations() {
        return [...this.savedLocations];
    }

    /**
     * Add saved location
     */
    addSavedLocation(location) {
        logger.info('UserStore.addSavedLocation', { name: location.name });
        
        const entry = {
            ...location,
            id: Date.now().toString(),
            timestamp: Date.now()
        };
        
        this.savedLocations.push(entry);
        
        try {
            localStorage.setItem(this.locationsKey, JSON.stringify(this.savedLocations));
        } catch (error) {
            logger.error('Failed to save location', { error: error.message });
        }
        
        return entry.id;
    }

    /**
     * Remove saved location
     */
    removeSavedLocation(id) {
        logger.info('UserStore.removeSavedLocation', { id });
        
        this.savedLocations = this.savedLocations.filter(loc => loc.id !== id);
        
        try {
            localStorage.setItem(this.locationsKey, JSON.stringify(this.savedLocations));
        } catch (error) {
            logger.error('Failed to remove location', { error: error.message });
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            preferences: Object.keys(this.preferences).length,
            searchHistory: this.searchHistory.length,
            savedLocations: this.savedLocations.length
        };
    }

    /**
     * Clear all user data
     */
    clear() {
        logger.info('UserStore.clear');
        this.preferences = {};
        this.searchHistory = [];
        this.savedLocations = [];
        
        localStorage.removeItem(this.prefsKey);
        localStorage.removeItem(this.historyKey);
        localStorage.removeItem(this.locationsKey);
    }
}

// Singleton
let userStoreInstance = null;

export function getUserStore(config = {}) {
    if (!userStoreInstance) {
        userStoreInstance = new UserStore(config);
    }
    return userStoreInstance;
}

export function setUserStore(instance) {
    userStoreInstance = instance;
}
