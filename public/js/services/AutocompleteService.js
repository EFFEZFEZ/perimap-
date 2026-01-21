/**
 * AutocompleteService.js - Modular autocomplete service
 * Handles place search, suggestions, and predictions
 * Replaces: apiManager.getPlaceAutocomplete
 */

import { eventBus, EVENTS } from '../EventBus.js';
import { logger } from '../Logger.js';

export class AutocompleteService {
    constructor(config) {
        this.config = config;
        this.apiEndpoints = config.apiEndpoints || {};
        this.apiKey = config.apiKey || '';
        this.backendMode = config.backendMode || 'vercel';
        
        // Session token for autocomplete (reduce quota)
        this.sessionToken = null;
        
        // Cache for predictions
        this._predictionsCache = new Map();
        this._predictionsCacheTtlMs = 5 * 60 * 1000; // 5 minutes
        
        // Périgueux bounds
        this.perigueuxBounds = {
            south: 45.10, west: 0.60, north: 45.30, east: 0.85
        };
        
        // Place aliases
        this.placeAliases = {
            'campus': {
                canonicalName: 'Campus Universitaire, Périgueux',
                aliases: ['campus', 'campus périgueux', 'fac', 'fac périgueux', 'université', 'iut', 'grenadière', 'pole universitaire', 'pôle universitaire'],
                coordinates: { lat: 45.1958, lng: 0.7192 },
                description: 'Campus universitaire (arrêts Campus + Pôle Grenadière)',
                searchRadius: 400
            }
        };
        
        logger.info('AutocompleteService initialized', { backendMode: this.backendMode });
    }

    /**
     * Get place autocomplete suggestions
     */
    async getPlacePredictions(inputString, sessionToken = null) {
        logger.info('AutocompleteService.getPlacePredictions', { input: inputString, sessionToken: !!sessionToken });
        
        try {
            if (!inputString || inputString.length < 2) {
                logger.debug('AutocompleteService input too short');
                return { predictions: [], status: 'NO_INPUT' };
            }

            // Check cache
            const cacheKey = inputString.toLowerCase();
            const cached = this._checkCache(cacheKey);
            if (cached) {
                logger.debug('AutocompleteService predictions cache HIT');
                return cached;
            }

            // Check for alias first
            const aliasResult = this._checkPlaceAlias(inputString);
            if (aliasResult) {
                logger.debug('AutocompleteService alias matched');
                const result = { predictions: [aliasResult], status: 'OK' };
                this._setCache(cacheKey, result);
                return result;
            }

            // Fetch from Google Places API
            const result = await this._fetchPredictions(inputString, sessionToken);
            this._setCache(cacheKey, result);
            eventBus.emit(EVENTS.AUTOCOMPLETE_RESULTS, { input: inputString, count: result.predictions.length });
            return result;
        } catch (error) {
            logger.error('AutocompleteService.getPlacePredictions failed', { error: error.message });
            eventBus.emit(EVENTS.AUTOCOMPLETE_ERROR, { error });
            return { predictions: [], status: 'ERROR', error: error.message };
        }
    }

    /**
     * Fetch predictions from Google Places API
     */
    async _fetchPredictions(inputString, sessionToken) {
        logger.debug('AutocompleteService._fetchPredictions', { input: inputString });
        
        try {
            const response = await fetch(`${this.apiEndpoints.places}?autocomplete=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: inputString,
                    sessionToken,
                    locationBias: {
                        rectangle: {
                            low: { latitude: this.perigueuxBounds.south, longitude: this.perigueuxBounds.west },
                            high: { latitude: this.perigueuxBounds.north, longitude: this.perigueuxBounds.east }
                        }
                    },
                    languageCode: 'fr'
                })
            });

            if (!response.ok) {
                throw new Error(`Places API autocomplete error: ${response.status}`);
            }

            const data = await response.json();
            const predictions = (data.predictions || []).map(p => ({
                placeId: p.place_id || p.placeId,
                description: p.description,
                mainText: p.main_text || p.name,
                secondaryText: p.secondary_text || p.formattedAddress || '',
                types: p.types || [p.type],
                matchedSubstrings: p.matched_substrings,
                coordinates: p.coordinates
            }));

            logger.debug('AutocompleteService predictions fetched', { count: predictions.length });
            return { predictions, status: 'OK' };
        } catch (error) {
            logger.error('AutocompleteService._fetchPredictions error', { error: error.message });
            throw error;
        }
    }

    /**
     * Get details for a prediction
     */
    async getPredictionDetails(placeId) {
        logger.info('AutocompleteService.getPredictionDetails', { placeId });
        
        try {
            const response = await fetch(`${this.apiEndpoints.places}/${placeId}/details`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`Places details API error: ${response.status}`);
            }

            const data = await response.json();
            const result = {
                placeId,
                location: data.result?.geometry?.location,
                formattedAddress: data.result?.formatted_address,
                types: data.result?.types,
                components: data.result?.address_components,
                status: 'OK'
            };

            logger.debug('AutocompleteService prediction details fetched');
            eventBus.emit(EVENTS.PREDICTION_DETAILS_RESOLVED, { placeId, ...result });
            return result;
        } catch (error) {
            logger.error('AutocompleteService.getPredictionDetails failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Check if input matches a place alias
     */
    _checkPlaceAlias(inputString) {
        logger.debug('AutocompleteService._checkPlaceAlias', { input: inputString });
        
        const normalized = (inputString || '').toLowerCase().trim();

        for (const [aliasKey, aliasData] of Object.entries(this.placeAliases)) {
            if (aliasData.aliases.some(alias => 
                normalized.includes(alias) || alias.includes(normalized)
            )) {
                logger.debug('AutocompleteService alias found', { key: aliasKey });
                return {
                    placeId: 'ALIAS:' + aliasKey,
                    description: aliasData.canonicalName,
                    mainText: aliasData.canonicalName,
                    secondaryText: aliasData.description,
                    types: ['place_of_interest'],
                    isAlias: true
                };
            }
        }

        return null;
    }

    /**
     * Cache management
     */
    _checkCache(key) {
        const cached = this._predictionsCache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this._predictionsCacheTtlMs) {
            this._predictionsCache.delete(key);
            return null;
        }
        
        return cached.value;
    }

    _setCache(key, value) {
        this._predictionsCache.set(key, { value, timestamp: Date.now() });
        logger.debug('AutocompleteService cache SET', { key });
    }

    /**
     * Clear cache
     */
    clearCache() {
        logger.info('AutocompleteService cache cleared');
        this._predictionsCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this._predictionsCache.size,
            ttlMinutes: this._predictionsCacheTtlMs / (60 * 1000)
        };
    }

    /**
     * Set session token (for quota optimization)
     */
    setSessionToken(token) {
        logger.debug('AutocompleteService.setSessionToken');
        this.sessionToken = token;
    }

    /**
     * Generate new session token
     */
    generateSessionToken() {
        logger.debug('AutocompleteService.generateSessionToken');
        this.sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return this.sessionToken;
    }
}

// Export singleton instance
let autocompleteServiceInstance = null;

export function getAutocompleteService(config = {}) {
    if (!autocompleteServiceInstance) {
        autocompleteServiceInstance = new AutocompleteService(config);
    }
    return autocompleteServiceInstance;
}

export function setAutocompleteService(instance) {
    autocompleteServiceInstance = instance;
}
