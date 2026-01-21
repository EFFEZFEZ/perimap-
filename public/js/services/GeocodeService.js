/**
 * GeocodeService.js - Modular geocoding service
 * Handles coordinate resolution, place ID lookups, and reverse geocoding
 * Replaces: apiManager.getPlaceCoords, reverseGeocode
 */

import { eventBus, EVENTS } from '../EventBus.js';
import { logger } from '../Logger.js';

export class GeocodeService {
    constructor(config) {
        this.config = config;
        this.apiEndpoints = config.apiEndpoints || {};
        this.backendMode = config.backendMode || 'vercel';
        
        // Cache for coordinates
        this._coordsCache = new Map();
        this._coordsCacheTtlMs = 24 * 60 * 60 * 1000; // 24 hours
        
        // Cache for reverse geocoding
        this._reverseCache = new Map();
        this._reverseCacheTtlMs = 24 * 60 * 60 * 1000; // 24 hours
        
        // Place aliases for campus/university
        this.placeAliases = {
            'campus': {
                canonicalName: 'Campus Universitaire, Périgueux',
                aliases: ['campus', 'campus périgueux', 'fac', 'fac périgueux', 'université', 'iut', 'grenadière', 'pole universitaire', 'pôle universitaire'],
                coordinates: { lat: 45.1958, lng: 0.7192 },
                description: 'Campus universitaire (arrêts Campus + Pôle Grenadière)',
                searchRadius: 400
            }
        };
        
        logger.info('GeocodeService initialized', { backendMode: this.backendMode });
    }

    /**
     * Get coordinates from place ID or coordinates object
     */
    async getPlaceCoords(placeIdOrCoords) {
        logger.info('GeocodeService.getPlaceCoords', { input: typeof placeIdOrCoords });
        
        try {
            // If already coordinates, return them
            if (placeIdOrCoords && typeof placeIdOrCoords === 'object' && 'lat' in placeIdOrCoords && 'lng' in placeIdOrCoords) {
                logger.debug('GeocodeService input already coordinates');
                return placeIdOrCoords;
            }

            // If place ID, resolve it
            if (typeof placeIdOrCoords === 'string') {
                const cached = this._checkCoordCache(placeIdOrCoords);
                if (cached) {
                    logger.debug('GeocodeService coords cache HIT');
                    return cached;
                }

                const coords = await this._resolvePlaceId(placeIdOrCoords);
                this._setCoordCache(placeIdOrCoords, coords);
                eventBus.emit(EVENTS.GEOCODE_RESOLVED, { placeId: placeIdOrCoords, coords });
                return coords;
            }

            throw new Error('Invalid placeIdOrCoords format');
        } catch (error) {
            logger.error('GeocodeService.getPlaceCoords failed', { error: error.message });
            eventBus.emit(EVENTS.GEOCODE_ERROR, { error });
            throw error;
        }
    }

    /**
     * Resolve place ID to coordinates via Google Places API
     */
    async _resolvePlaceId(placeId) {
        logger.debug('GeocodeService._resolvePlaceId', { placeId });
        
        try {
            const response = await fetch(`${this.apiEndpoints.places}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ placeId })
            });

            if (!response.ok) {
                throw new Error(`Places API error: ${response.status}`);
            }

            const data = await response.json();
            const location = data.result?.geometry?.location;
            
            if (!location) {
                throw new Error('No location found for place ID');
            }

            return {
                lat: location.lat,
                lng: location.lng
            };
        } catch (error) {
            logger.error('GeocodeService._resolvePlaceId error', { error: error.message });
            throw error;
        }
    }

    /**
     * Reverse geocode coordinates to place ID or address
     */
    async reverseGeocode(lat, lng) {
        logger.info('GeocodeService.reverseGeocode', { lat, lng });
        
        try {
            const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
            const cached = this._checkReverseCache(cacheKey);
            if (cached) {
                logger.debug('GeocodeService reverse cache HIT');
                return cached;
            }

            const result = await this._reverseGeocodeGoogle(lat, lng);
            this._setReverseCache(cacheKey, result);
            eventBus.emit(EVENTS.GEOCODE_REVERSED, { lat, lng, result });
            return result;
        } catch (error) {
            logger.error('GeocodeService.reverseGeocode failed', { error: error.message });
            eventBus.emit(EVENTS.GEOCODE_ERROR, { error });
            throw error;
        }
    }

    /**
     * Perform reverse geocoding via Google API
     */
    async _reverseGeocodeGoogle(lat, lng) {
        logger.debug('GeocodeService._reverseGeocodeGoogle', { lat, lng });
        
        try {
            const response = await fetch(`${this.apiEndpoints.geocode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat, lng })
            });

            if (!response.ok) {
                throw new Error(`Geocode API error: ${response.status}`);
            }

            const data = await response.json();
            
            return {
                placeId: data.results?.[0]?.place_id,
                address: data.results?.[0]?.formatted_address,
                components: data.results?.[0]?.address_components,
                status: data.status
            };
        } catch (error) {
            logger.error('GeocodeService._reverseGeocodeGoogle error', { error: error.message });
            throw error;
        }
    }

    /**
     * Resolve alias or place ID
     */
    async resolveAliasOrPlaceId(input) {
        logger.debug('GeocodeService.resolveAliasOrPlaceId', { input });
        
        // Check if input matches an alias
        const alias = this._checkPlaceAlias(input);
        if (alias) {
            logger.debug('GeocodeService alias matched', { alias: alias.canonicalName });
            return alias.coordinates;
        }

        // Otherwise resolve as place ID
        return this.getPlaceCoords(input);
    }

    /**
     * Check if input matches a place alias
     */
    _checkPlaceAlias(inputString) {
        logger.debug('GeocodeService._checkPlaceAlias', { input: inputString });
        
        const normalized = (inputString || '').toLowerCase().trim();

        for (const [aliasKey, aliasData] of Object.entries(this.placeAliases)) {
            if (aliasData.aliases.some(alias => 
                normalized.includes(alias) || alias.includes(normalized)
            )) {
                logger.debug('GeocodeService alias found', { key: aliasKey });
                return aliasData;
            }
        }

        return null;
    }

    /**
     * Cache management for coordinates
     */
    _checkCoordCache(key) {
        const cached = this._coordsCache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this._coordsCacheTtlMs) {
            this._coordsCache.delete(key);
            return null;
        }
        
        return cached.value;
    }

    _setCoordCache(key, value) {
        this._coordsCache.set(key, { value, timestamp: Date.now() });
        logger.debug('GeocodeService coords cache SET', { key });
    }

    /**
     * Cache management for reverse geocoding
     */
    _checkReverseCache(key) {
        const cached = this._reverseCache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this._reverseCacheTtlMs) {
            this._reverseCache.delete(key);
            return null;
        }
        
        return cached.value;
    }

    _setReverseCache(key, value) {
        this._reverseCache.set(key, { value, timestamp: Date.now() });
        logger.debug('GeocodeService reverse cache SET', { key });
    }

    /**
     * Clear all caches
     */
    clearCaches() {
        logger.info('GeocodeService all caches cleared');
        this._coordsCache.clear();
        this._reverseCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            coordsCache: { size: this._coordsCache.size, ttlHours: this._coordsCacheTtlMs / (60 * 60 * 1000) },
            reverseCache: { size: this._reverseCache.size, ttlHours: this._reverseCacheTtlMs / (60 * 60 * 1000) }
        };
    }
}

// Export singleton instance
let geocodeServiceInstance = null;

export function getGeocodeService(config = {}) {
    if (!geocodeServiceInstance) {
        geocodeServiceInstance = new GeocodeService(config);
    }
    return geocodeServiceInstance;
}

export function setGeocodeService(instance) {
    geocodeServiceInstance = instance;
}
