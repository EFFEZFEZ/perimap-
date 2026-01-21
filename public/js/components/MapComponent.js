/**
 * MapComponent.js - Modular map rendering component
 * Phase 4: UI Components Modularization
 */

import { eventBus, EVENTS } from '../EventBus.js';
import { logger } from '../Logger.js';

export class MapComponent {
    constructor(containerId, config = {}) {
        this.containerId = containerId;
        this.config = config;
        this.map = null;
        this.layers = {};
        this.markers = {};
        
        logger.info('MapComponent initialized', { containerId });
    }

    /**
     * Initialize Leaflet map
     */
    initialize() {
        logger.info('MapComponent.initialize');
        
        if (typeof L === 'undefined') {
            logger.error('Leaflet not loaded');
            return;
        }
        
        const container = document.getElementById(this.containerId);
        if (!container) {
            logger.error('Map container not found', { id: this.containerId });
            return;
        }
        
        this.map = L.map(this.containerId).setView(
            [45.184029, 0.7211149], // Périgueux center
            13
        );
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        eventBus.emit(EVENTS.MAP_READY, { map: this.map });
        logger.info('MapComponent map ready');
    }

    /**
     * Add GeoJSON layer
     */
    addLayer(layerId, geojson, style = {}) {
        logger.debug('MapComponent.addLayer', { layerId });
        
        if (!this.map) return;
        
        const layer = L.geoJSON(geojson, {
            style: style,
            onEachFeature: (feature, layer) => {
                if (feature.properties && feature.properties.name) {
                    layer.bindPopup(feature.properties.name);
                }
            }
        }).addTo(this.map);
        
        this.layers[layerId] = layer;
    }

    /**
     * Remove layer
     */
    removeLayer(layerId) {
        logger.debug('MapComponent.removeLayer', { layerId });
        
        const layer = this.layers[layerId];
        if (layer && this.map) {
            this.map.removeLayer(layer);
            delete this.layers[layerId];
        }
    }

    /**
     * Center map on coordinates
     */
    centerOn(lat, lng, zoom = 15) {
        logger.debug('MapComponent.centerOn', { lat, lng, zoom });
        
        if (this.map) {
            this.map.setView([lat, lng], zoom);
        }
    }

    /**
     * Fit map to bounds
     */
    fitBounds(bounds) {
        logger.debug('MapComponent.fitBounds');
        
        if (this.map && bounds) {
            this.map.fitBounds(bounds);
        }
    }

    /**
     * Draw route polyline
     */
    drawRoute(route, options = {}) {
        logger.debug('MapComponent.drawRoute');
        
        if (!this.map || !route.coordinates) return;
        
        const routeLayer = L.polyline(route.coordinates, {
            color: options.color || '#22c55e',
            weight: options.weight || 4,
            opacity: options.opacity || 0.8
        }).addTo(this.map);
        
        this.layers['current-route'] = routeLayer;
        this.map.fitBounds(routeLayer.getBounds());
        
        eventBus.emit(EVENTS.MAP_ROUTE_SELECTED, { route });
    }

    /**
     * Clear current route
     */
    clearRoute() {
        logger.debug('MapComponent.clearRoute');
        this.removeLayer('current-route');
    }

    /**
     * Get current viewport bounds
     */
    getViewport() {
        if (!this.map) return null;
        
        const bounds = this.map.getBounds();
        return {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
        };
    }

    /**
     * Add marker
     */
    addMarker(markerId, lat, lng, options = {}) {
        logger.debug('MapComponent.addMarker', { markerId, lat, lng });
        
        if (!this.map) return;
        
        const marker = L.marker([lat, lng], options).addTo(this.map);
        
        if (options.popup) {
            marker.bindPopup(options.popup);
        }
        
        this.markers[markerId] = marker;
    }

    /**
     * Remove marker
     */
    removeMarker(markerId) {
        logger.debug('MapComponent.removeMarker', { markerId });
        
        const marker = this.markers[markerId];
        if (marker && this.map) {
            this.map.removeLayer(marker);
            delete this.markers[markerId];
        }
    }

    /**
     * Destroy map instance
     */
    destroy() {
        logger.info('MapComponent.destroy');
        
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        
        this.layers = {};
        this.markers = {};
    }
}
