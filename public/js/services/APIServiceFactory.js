/**
 * APIServiceFactory.js - Central factory for all API services
 * Provides singleton access to RouteService, GeocodeService, and AutocompleteService
 * Maintains backward compatibility with existing apiManager interface
 * 
 * Migration Path:
 * - Phase 2a: Services created (standalone)
 * - Phase 2b: APIServiceFactory created (integration layer)
 * - Phase 2c: main.js updated to use factory
 * - Phase 2d: apiManager gradually deprecated
 */

import { RouteService, getRouteService } from './RouteService.js';
import { GeocodeService, getGeocodeService } from './GeocodeService.js';
import { AutocompleteService, getAutocompleteService } from './AutocompleteService.js';
import { logger } from '../Logger.js';
import { eventBus } from '../EventBus.js';

export class APIServiceFactory {
    constructor(config = {}) {
        this.config = config;
        
        // Initialize all services
        this.routeService = getRouteService(config);
        this.geocodeService = getGeocodeService(config);
        this.autocompleteService = getAutocompleteService(config);
        
        logger.info('APIServiceFactory initialized', { 
            backendMode: config.backendMode,
            servicesCount: 3 
        });
        
        // Emit ready event
        eventBus.emit('api:ready', { factory: this });
    }

    /**
     * Get bus route (delegates to RouteService)
     */
    async getBusRoute(fromPlaceId, toPlaceId, searchTime = null, fromCoords = null, toCoords = null) {
        logger.info('APIServiceFactory.getBusRoute');
        return this.routeService.getBusRoute(fromPlaceId, toPlaceId, searchTime, fromCoords, toCoords);
    }

    /**
     * Get bicycle route (delegates to RouteService)
     */
    async getBicycleRoute(fromPlaceId, toPlaceId, fromCoords = null, toCoords = null) {
        logger.info('APIServiceFactory.getBicycleRoute');
        return this.routeService.getBicycleRoute(fromPlaceId, toPlaceId, fromCoords, toCoords);
    }

    /**
     * Get place coordinates (delegates to GeocodeService)
     */
    async getPlaceCoords(placeIdOrCoords) {
        logger.info('APIServiceFactory.getPlaceCoords');
        return this.geocodeService.getPlaceCoords(placeIdOrCoords);
    }

    /**
     * Reverse geocode (delegates to GeocodeService)
     */
    async reverseGeocode(lat, lng) {
        logger.info('APIServiceFactory.reverseGeocode');
        return this.geocodeService.reverseGeocode(lat, lng);
    }

    /**
     * Resolve alias or place ID (delegates to GeocodeService)
     */
    async resolveAliasOrPlaceId(input) {
        logger.info('APIServiceFactory.resolveAliasOrPlaceId');
        return this.geocodeService.resolveAliasOrPlaceId(input);
    }

    /**
     * Get place predictions (delegates to AutocompleteService)
     */
    async getPlacePredictions(inputString, sessionToken = null) {
        logger.info('APIServiceFactory.getPlacePredictions');
        return this.autocompleteService.getPlacePredictions(inputString, sessionToken);
    }

    /**
     * Get prediction details (delegates to AutocompleteService)
     */
    async getPredictionDetails(placeId) {
        logger.info('APIServiceFactory.getPredictionDetails');
        return this.autocompleteService.getPredictionDetails(placeId);
    }

    /**
     * Get all cache statistics
     */
    getCacheStats() {
        logger.debug('APIServiceFactory.getCacheStats');
        return {
            route: this.routeService.getCacheStats(),
            geocode: this.geocodeService.getCacheStats(),
            autocomplete: this.autocompleteService.getCacheStats()
        };
    }

    /**
     * Clear all caches
     */
    clearAllCaches() {
        logger.info('APIServiceFactory.clearAllCaches');
        this.routeService.clearCache();
        this.geocodeService.clearCaches();
        this.autocompleteService.clearCache();
        logger.info('All caches cleared');
    }

    /**
     * Get service health status
     */
    getHealth() {
        return {
            route: { initialized: !!this.routeService },
            geocode: { initialized: !!this.geocodeService },
            autocomplete: { initialized: !!this.autocompleteService },
            config: {
                backendMode: this.config.backendMode,
                useOtp: this.config.useOtp
            }
        };
    }
}

// Singleton factory instance
let factoryInstance = null;

/**
 * Initialize API service factory (called once during app startup)
 */
export function initializeAPIServices(config = {}) {
    logger.info('Initializing API services factory', { config });
    
    if (!factoryInstance) {
        factoryInstance = new APIServiceFactory(config);
    }
    
    return factoryInstance;
}

/**
 * Get API service factory instance
 */
export function getAPIServiceFactory() {
    if (!factoryInstance) {
        logger.warn('APIServiceFactory not initialized, creating with defaults');
        factoryInstance = new APIServiceFactory({});
    }
    return factoryInstance;
}

/**
 * Backward compatibility: expose services directly
 */
export function getRouteServiceFromFactory() {
    const factory = getAPIServiceFactory();
    return factory.routeService;
}

export function getGeocodeServiceFromFactory() {
    const factory = getAPIServiceFactory();
    return factory.geocodeService;
}

export function getAutocompleteServiceFromFactory() {
    const factory = getAPIServiceFactory();
    return factory.autocompleteService;
}
