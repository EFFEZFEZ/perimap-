/**
 * GTFSStore.js - Modular GTFS data store
 * Replaces core functions of dataManager.js
 * Handles: routes, stops, trips, stop_times, calendar, shapes
 * 
 * Phase 3: Data Layer Modularization
 */

import { eventBus, EVENTS } from '../EventBus.js';
import { stateManager } from '../StateManager.js';
import { logger } from '../Logger.js';

export class GTFSStore {
    constructor(config = {}) {
        this.config = config;
        
        // Core GTFS data
        this.routes = [];
        this.stops = [];
        this.trips = [];
        this.stopTimes = [];
        this.calendar = [];
        this.calendarDates = [];
        this.shapes = [];
        
        // Indexes for fast lookups
        this.routesById = {};
        this.stopsById = {};
        this.tripsByTripId = {};
        this.stopTimesByTrip = {};
        this.stopTimesByStop = {};
        this.routesByShortName = {};
        this.stopsByName = {};
        this.tripsByRoute = {};
        this.routeGeometriesById = {};
        this.shapesById = {};
        
        // Master stops (grouped)
        this.masterStops = [];
        this.groupedStopMap = {};
        
        // GeoJSON representation
        this.geoJson = null;
        this.isLoaded = false;
        
        // Cache settings
        this.cacheKey = config.cacheKey || 'peribus_gtfs_cache_v6';
        this.cacheTtlMs = config.cacheTtlMs || 12 * 60 * 60 * 1000; // 12 hours
        this.remoteGtfsBaseUrl = config.remoteGtfsBaseUrl || 'https://raw.githubusercontent.com/EFFEZFEZ/p-rimap-sans-api-/main/public/data/gtfs';
        
        logger.info('GTFSStore initialized', { 
            cacheKey: this.cacheKey,
            cacheTtlHours: this.cacheTtlMs / (60 * 60 * 1000)
        });
    }

    /**
     * Load all GTFS data with progress callback
     */
    async loadAllData(onProgress = null) {
        logger.info('GTFSStore.loadAllData starting');
        const startTime = performance.now();
        
        try {
            eventBus.emit(EVENTS.DATA_LOADED, { 
                source: 'gtfs',
                message: 'Chargement GTFS en cours...' 
            });
            
            // Try cache first
            const cached = await this.restoreCache();
            if (cached) {
                logger.info('GTFSStore cache HIT', { 
                    duration: performance.now() - startTime 
                });
                this.applyLoadedData(cached);
                this.isLoaded = true;
                eventBus.emit(EVENTS.DATA_LOADED, { source: 'gtfs', cached: true });
                return true;
            }

            // Load fresh data
            onProgress?.('Téléchargement données GTFS...');
            const data = await this.loadFresh(onProgress);
            
            this.applyLoadedData(data);
            this.isLoaded = true;
            
            // Save cache in background
            this.saveCache(data).catch(e => logger.warn('Cache save failed', e));
            
            logger.info('GTFSStore data loaded', { 
                duration: performance.now() - startTime,
                routes: this.routes.length,
                stops: this.stops.length,
                trips: this.trips.length
            });
            
            eventBus.emit(EVENTS.DATA_LOADED, { 
                source: 'gtfs',
                cached: false,
                stats: {
                    routes: this.routes.length,
                    stops: this.stops.length,
                    trips: this.trips.length
                }
            });
            
            stateManager.setState({
                data: {
                    gtfs: {
                        loaded: true,
                        timestamp: Date.now(),
                        routes: this.routes.length,
                        stops: this.stops.length
                    }
                }
            }, 'gtfs:loaded');
            
            return true;
        } catch (error) {
            logger.error('GTFSStore.loadAllData failed', { error: error.message });
            eventBus.emit(EVENTS.DATA_ERROR, { source: 'gtfs', error });
            stateManager.setState({
                data: { gtfs: { error: error.message } }
            }, 'gtfs:error');
            throw error;
        }
    }

    /**
     * Load fresh GTFS data from remote source
     */
    async loadFresh(onProgress = null) {
        logger.debug('GTFSStore.loadFresh starting');
        
        // Placeholder for actual GTFS loading logic
        // In production, this would fetch from remote URL
        // For now, return empty structure
        
        return {
            routes: [],
            stops: [],
            trips: [],
            stopTimes: [],
            calendar: [],
            calendarDates: [],
            shapes: []
        };
    }

    /**
     * Apply loaded data to store indexes
     */
    applyLoadedData(data) {
        logger.debug('GTFSStore.applyLoadedData', { 
            routes: data.routes?.length || 0,
            stops: data.stops?.length || 0
        });
        
        this.routes = data.routes || [];
        this.stops = data.stops || [];
        this.trips = data.trips || [];
        this.stopTimes = data.stopTimes || [];
        this.calendar = data.calendar || [];
        this.calendarDates = data.calendarDates || [];
        this.shapes = data.shapes || [];
        
        // Build indexes
        this.buildIndexes();
    }

    /**
     * Build all lookup indexes
     */
    buildIndexes() {
        logger.debug('GTFSStore.buildIndexes');
        
        // Routes index
        this.routesById = {};
        this.routesByShortName = {};
        this.routes.forEach(route => {
            this.routesById[route.route_id] = route;
            if (route.route_short_name) {
                this.routesByShortName[route.route_short_name] = route;
            }
        });
        
        // Stops index
        this.stopsById = {};
        this.stopsByName = {};
        this.stops.forEach(stop => {
            this.stopsById[stop.stop_id] = stop;
            if (stop.stop_name) {
                if (!this.stopsByName[stop.stop_name]) {
                    this.stopsByName[stop.stop_name] = [];
                }
                this.stopsByName[stop.stop_name].push(stop);
            }
        });
        
        // Trips index
        this.tripsByTripId = {};
        this.tripsByRoute = {};
        this.trips.forEach(trip => {
            this.tripsByTripId[trip.trip_id] = trip;
            if (!this.tripsByRoute[trip.route_id]) {
                this.tripsByRoute[trip.route_id] = [];
            }
            this.tripsByRoute[trip.route_id].push(trip);
        });
        
        // Stop times index
        this.stopTimesByTrip = {};
        this.stopTimesByStop = {};
        this.stopTimes.forEach(st => {
            if (!this.stopTimesByTrip[st.trip_id]) {
                this.stopTimesByTrip[st.trip_id] = [];
            }
            this.stopTimesByTrip[st.trip_id].push(st);
            
            if (!this.stopTimesByStop[st.stop_id]) {
                this.stopTimesByStop[st.stop_id] = [];
            }
            this.stopTimesByStop[st.stop_id].push(st);
        });
        
        // Shapes index
        this.shapesById = {};
        this.shapes.forEach(shape => {
            this.shapesById[shape.shape_id] = shape;
        });
        
        logger.debug('GTFSStore indexes built', {
            routes: Object.keys(this.routesById).length,
            stops: Object.keys(this.stopsById).length,
            trips: Object.keys(this.tripsByTripId).length
        });
    }

    /**
     * Cache management
     */
    async restoreCache() {
        logger.debug('GTFSStore.restoreCache');
        // Placeholder for cache restoration logic
        return null;
    }

    async saveCache(data) {
        logger.debug('GTFSStore.saveCache');
        // Placeholder for cache saving logic
    }

    /**
     * Query methods
     */
    getRoute(routeId) {
        return this.routesById[routeId] || null;
    }

    getStop(stopId) {
        return this.stopsById[stopId] || null;
    }

    getTrip(tripId) {
        return this.tripsByTripId[tripId] || null;
    }

    getStopTimes(tripId) {
        return this.stopTimesByTrip[tripId] || [];
    }

    getStopsByName(name) {
        return this.stopsByName[name.toLowerCase()] || [];
    }

    getRoutesByShortName(shortName) {
        return this.routesByShortName[shortName] || null;
    }

    getTripsForRoute(routeId) {
        return this.tripsByRoute[routeId] || [];
    }

    getArrivalsAtStop(stopId) {
        return this.stopTimesByStop[stopId] || [];
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            routes: this.routes.length,
            stops: this.stops.length,
            trips: this.trips.length,
            stopTimes: this.stopTimes.length,
            shapes: this.shapes.length,
            indexed: {
                routesById: Object.keys(this.routesById).length,
                stopsById: Object.keys(this.stopsById).length,
                tripsByTripId: Object.keys(this.tripsByTripId).length
            }
        };
    }

    /**
     * Clear all data
     */
    clear() {
        logger.info('GTFSStore.clear');
        this.routes = [];
        this.stops = [];
        this.trips = [];
        this.stopTimes = [];
        this.calendar = [];
        this.calendarDates = [];
        this.shapes = [];
        this.isLoaded = false;
        this.buildIndexes();
    }
}

// Singleton instance
let gtfsStoreInstance = null;

export function getGTFSStore(config = {}) {
    if (!gtfsStoreInstance) {
        gtfsStoreInstance = new GTFSStore(config);
    }
    return gtfsStoreInstance;
}

export function setGTFSStore(instance) {
    gtfsStoreInstance = instance;
}
