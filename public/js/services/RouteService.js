/**
 * RouteService.js - Modular routing service
 * Handles bus, bicycle, and pedestrian route calculations
 * Replaces apiManager._fetchBusRoute, _fetchBusRouteOtp, fetchBicycleRoute
 * 
 * Features:
 * - Multi-mode routing (bus, bicycle, pedestrian)
 * - OTP and Google backends
 * - Route caching (2-minute TTL)
 * - Emergency fallback handling
 */

import { eventBus, EVENTS } from '../EventBus.js';
import { logger } from '../Logger.js';

export class RouteService {
    constructor(config) {
        const normalizedConfig = typeof config === 'string'
            ? { apiEndpoints: { routes: config, otp: config }, backendMode: 'vercel' }
            : (config || {});

        this.config = normalizedConfig;
        this.useOtp = normalizedConfig.useOtp || false;
        this.backendMode = normalizedConfig.backendMode || 'vercel';
        this.apiEndpoints = normalizedConfig.apiEndpoints || {};
        
        // Cache for itineraries
        this._itineraryCache = new Map();
        this._itineraryCacheTtlMs = 2 * 60 * 1000; // 2 minutes
        this._itineraryCacheMaxEntries = 50;

        // Bounds for Périgueux area
        this.perigueuxBounds = {
            south: 45.10, west: 0.60, north: 45.30, east: 0.85
        };
        
        logger.info('RouteService initialized', { backendMode: this.backendMode });
    }

    /**
     * Compat: calculateRoute alias
     */
    async calculateRoute(fromCoords, toCoords, searchTime = null) {
        const fromPlaceId = fromCoords?.placeId || `${fromCoords?.lat},${fromCoords?.lng}`;
        const toPlaceId = toCoords?.placeId || `${toCoords?.lat},${toCoords?.lng}`;
        return this.getBusRoute(fromPlaceId, toPlaceId, searchTime, fromCoords, toCoords);
    }

    set cacheTTL(value) {
        this._itineraryCacheTtlMs = value;
    }

    get cacheTTL() {
        return this._itineraryCacheTtlMs;
    }

    /**
     * Get bus route (primary method)
     * Handles both OTP and Google backends
     */
    async getBusRoute(fromPlaceId, toPlaceId, searchTime = null, fromCoords = null, toCoords = null) {
        logger.info('RouteService.getBusRoute', { fromPlaceId, toPlaceId, searchTime });
        
        try {
            // Check cache first - V501: serialize all values properly
            const serializeLocation = (loc) => {
                if (!loc) return 'null';
                if (typeof loc === 'string') return loc;
                if (loc.lat && loc.lng) return `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
                return JSON.stringify(loc);
            };
            const timeKey = searchTime ? `${searchTime.date || ''}_${searchTime.hour || ''}${searchTime.minute || ''}` : 'now';
            const cacheKey = `bus:${serializeLocation(fromPlaceId)}:${serializeLocation(toPlaceId)}:${timeKey}`;
            const cached = this._checkCache(cacheKey);
            if (cached) {
                logger.debug('RouteService cache HIT', { cacheKey });
                return cached;
            }

            let result;
            if (this.useOtp) {
                result = await this._fetchBusRouteOtp(fromPlaceId, toPlaceId, searchTime, fromCoords, toCoords);
            } else {
                result = await this._fetchBusRouteGoogle(fromPlaceId, toPlaceId, searchTime, fromCoords, toCoords);
            }

            const normalizedResult = result?.routes
                ? result
                : { ...result, routes: result?.itineraries || [] };

            this._setCache(cacheKey, normalizedResult);
            eventBus.emit(EVENTS.ROUTE_CALCULATED, { mode: 'bus', result: normalizedResult });
            return normalizedResult;
        } catch (error) {
            logger.error('RouteService.getBusRoute failed', { error: error.message });
            eventBus.emit(EVENTS.ROUTE_ERROR, { mode: 'bus', error });
            throw error;
        }
    }

    /**
     * Fetch bus route via OTP backend
     */
    async _fetchBusRouteOtp(fromPlaceId, toPlaceId, searchTime = null, fromCoords = null, toCoords = null) {
        logger.debug('RouteService._fetchBusRouteOtp', { fromPlaceId, toPlaceId });
        
        try {
            const payload = {
                fromPlaceId,
                toPlaceId,
                searchTime,
                ...(fromCoords && { fromCoords }),
                ...(toCoords && { toCoords })
            };

            const response = await fetch(`${this.apiEndpoints.otp}/plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`OTP backend error: ${response.status}`);
            }

            const data = await response.json();
            logger.debug('RouteService OTP response', { itineraryCount: data.itineraries?.length || 0 });
            
            return this._convertOtpItineraryToGoogleFormat(data);
        } catch (error) {
            logger.error('RouteService._fetchBusRouteOtp error', { error: error.message });
            throw error;
        }
    }

    /**
     * Fetch bus route via Google backend (Vercel proxy)
     */
    async _fetchBusRouteGoogle(fromPlaceId, toPlaceId, searchTime = null, fromCoords = null, toCoords = null) {
        logger.debug('RouteService._fetchBusRouteGoogle', { fromPlaceId, toPlaceId, fromCoords, toCoords });
        
        try {
            // Construire origin: gérer les 3 cas (placeId string, coords object, ou coords séparées)
            let origin;
            if (typeof fromPlaceId === 'string' && fromPlaceId.startsWith('ChIJ')) {
                // Cas 1: Google Place ID valide
                origin = { placeId: fromPlaceId };
            } else if (fromPlaceId && typeof fromPlaceId === 'object' && fromPlaceId.lat && fromPlaceId.lng) {
                // Cas 2: fromPlaceId est en fait un objet coords (commune locale)
                origin = { location: { latLng: { latitude: fromPlaceId.lat, longitude: fromPlaceId.lng } } };
            } else if (fromCoords?.lat && fromCoords?.lng) {
                // Cas 3: coords fournis séparément
                origin = { location: { latLng: { latitude: fromCoords.lat, longitude: fromCoords.lng } } };
            } else {
                throw new Error('Origine invalide: ni placeId ni coordonnées');
            }
            
            // Construire destination: gérer les 3 cas
            let destination;
            if (typeof toPlaceId === 'string' && toPlaceId.startsWith('ChIJ')) {
                destination = { placeId: toPlaceId };
            } else if (toPlaceId && typeof toPlaceId === 'object' && toPlaceId.lat && toPlaceId.lng) {
                destination = { location: { latLng: { latitude: toPlaceId.lat, longitude: toPlaceId.lng } } };
            } else if (toCoords?.lat && toCoords?.lng) {
                destination = { location: { latLng: { latitude: toCoords.lat, longitude: toCoords.lng } } };
            } else {
                throw new Error('Destination invalide: ni placeId ni coordonnées');
            }
            
            // Construire departureTime à partir de l'objet searchTime {type, date, hour, minute}
            let departureTime = null;
            if (searchTime) {
                if (typeof searchTime === 'string') {
                    departureTime = new Date(searchTime).toISOString();
                } else if (searchTime.date && searchTime.hour !== undefined) {
                    const dateStr = `${searchTime.date}T${String(searchTime.hour).padStart(2, '0')}:${String(searchTime.minute || 0).padStart(2, '0')}:00`;
                    departureTime = new Date(dateStr).toISOString();
                }
            }
            
            const payload = {
                origin,
                destination,
                travelMode: 'TRANSIT',
                transitPreferences: {
                    routingPreference: 'FEWER_TRANSFERS'
                },
                computeAlternativeRoutes: true,
                languageCode: 'fr',
                units: 'METRIC',
                ...(departureTime && { departureTime })
            };

            const response = await fetch(`${this.apiEndpoints.routes}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Google Routes API error: ${response.status}`);
            }

            const data = await response.json();
            logger.debug('RouteService Google response', { routeCount: data.routes?.length || 0 });
            
            return {
                itineraries: data.routes || [],
                status: 'OK'
            };
        } catch (error) {
            logger.error('RouteService._fetchBusRouteGoogle error', { error: error.message });
            throw error;
        }
    }

    /**
     * Get bicycle route
     */
    async getBicycleRoute(fromPlaceId, toPlaceId, fromCoords = null, toCoords = null) {
        logger.info('RouteService.getBicycleRoute', { fromPlaceId, toPlaceId });
        
        try {
            // V501: serialize locations properly
            const serializeLocation = (loc) => {
                if (!loc) return 'null';
                if (typeof loc === 'string') return loc;
                if (loc.lat && loc.lng) return `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
                return JSON.stringify(loc);
            };
            const cacheKey = `bicycle:${serializeLocation(fromCoords || fromPlaceId)}:${serializeLocation(toCoords || toPlaceId)}`;
            const cached = this._checkCache(cacheKey);
            if (cached) {
                logger.debug('RouteService bicycle cache HIT');
                return cached;
            }

            // Use fromCoords/toCoords if available, otherwise route is not available
            if (!fromCoords || !toCoords) {
                logger.warn('RouteService.getBicycleRoute missing coordinates');
                return { itineraries: [], status: 'NO_COORDINATES' };
            }

            const result = await this._fetchBicycleRouteGoogle(fromCoords, toCoords);
            this._setCache(cacheKey, result);
            eventBus.emit(EVENTS.ROUTE_CALCULATED, { mode: 'bicycle', result });
            return result;
        } catch (error) {
            logger.error('RouteService.getBicycleRoute failed', { error: error.message });
            eventBus.emit(EVENTS.ROUTE_ERROR, { mode: 'bicycle', error });
            throw error;
        }
    }

    /**
     * Fetch bicycle route via Google
     */
    async _fetchBicycleRouteGoogle(fromCoords, toCoords) {
        logger.debug('RouteService._fetchBicycleRouteGoogle', { from: fromCoords, to: toCoords });
        
        try {
            // V501: Fix payload format to match Google Routes API expected format
            const payload = {
                origin: { location: { latLng: { latitude: fromCoords.lat, longitude: fromCoords.lng } } },
                destination: { location: { latLng: { latitude: toCoords.lat, longitude: toCoords.lng } } },
                travelMode: 'BICYCLE',
                languageCode: 'fr',
                units: 'METRIC'
            };

            const response = await fetch(`${this.apiEndpoints.routes}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Google Routes API (bicycle) error: ${response.status}`);
            }

            const data = await response.json();
            return { itineraries: data.routes || [], status: 'OK' };
        } catch (error) {
            logger.error('RouteService._fetchBicycleRouteGoogle error', { error: error.message });
            throw error;
        }
    }

    /**
     * Convert OTP itinerary format to Google Routes format
     */
    _convertOtpItineraryToGoogleFormat(otpResponse) {
        logger.debug('RouteService._convertOtpItineraryToGoogleFormat');
        
        if (!otpResponse.plan || !otpResponse.plan.itineraries) {
            return { itineraries: [], status: 'NO_ROUTE' };
        }

        const converted = otpResponse.plan.itineraries.map(otp => ({
            legs: (otp.legs || []).map(leg => ({
                startTime: new Date(leg.startTime).toISOString(),
                endTime: new Date(leg.endTime).toISOString(),
                distance: { text: `${leg.distance}m`, value: leg.distance },
                duration: { text: `${Math.round(leg.duration / 60)}m`, value: leg.duration },
                steps: (leg.steps || []).map(step => ({
                    startLocation: { lat: step.lat, lng: step.lon },
                    endLocation: { lat: step.endLat, lng: step.endLon },
                    htmlInstructions: step.absoluteDirection || 'Continue',
                    distance: { value: step.distance },
                    duration: { value: step.duration }
                })),
                transitDetails: leg.transitLeg ? {
                    lineNumber: leg.routeShortName || leg.routeLongName,
                    departure: new Date(leg.startTime),
                    arrival: new Date(leg.endTime)
                } : null
            })),
            duration: { value: otp.duration, text: `${Math.round(otp.duration / 60)}m` },
            distance: { value: otp.distance || 0 }
        }));

        logger.debug('RouteService OTP conversion complete', { count: converted.length });
        return { itineraries: converted, status: 'OK' };
    }

    /**
     * Cache management
     */
    _checkCache(key) {
        const cached = this._itineraryCache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this._itineraryCacheTtlMs) {
            this._itineraryCache.delete(key);
            return null;
        }
        
        return cached.value;
    }

    _setCache(key, value) {
        // Implement LRU-like eviction
        if (this._itineraryCache.size >= this._itineraryCacheMaxEntries) {
            const firstKey = this._itineraryCache.keys().next().value;
            this._itineraryCache.delete(firstKey);
        }
        
        this._itineraryCache.set(key, { value, timestamp: Date.now() });
        logger.debug('RouteService cache SET', { key, size: this._itineraryCache.size });
    }

    /**
     * Clear entire cache
     */
    clearCache() {
        logger.info('RouteService cache cleared');
        this._itineraryCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this._itineraryCache.size,
            maxEntries: this._itineraryCacheMaxEntries,
            ttlMs: this._itineraryCacheTtlMs
        };
    }
}

// Export singleton instance
let routeServiceInstance = null;

export function getRouteService(config = {}) {
    if (!routeServiceInstance) {
        routeServiceInstance = new RouteService(config);
    }
    return routeServiceInstance;
}

export function setRouteService(instance) {
    routeServiceInstance = instance;
}
