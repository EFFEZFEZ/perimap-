/*
 * Copyright (c) 2025 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * routeDrawing.js - Utilitaires de dessin de routes sur la carte
 * 
 * @module map/routeDrawing
 * @version V221
 * 
 * Ce module gère le dessin des itinéraires sur la carte Leaflet :
 * - Styles de polylines (couleur, épaisseur, hachures)
 * - Extraction et décodage des polylines
 * - Ajout des marqueurs d'arrêts
 */

import { decodePolyline } from '../router.js';
import { isMissingTextValue } from '../utils/formatters.js';
import { resolveStopCoordinates } from '../utils/geo.js';

// === CONSTANTES ===

/**
 * Priorité des rôles d'arrêts pour l'affichage des marqueurs
 * @type {Object<string, number>}
 */
export const STOP_ROLE_PRIORITY = {
    boarding: 4,
    alighting: 4,
    transfer: 3,
    intermediate: 1
};

// === DÉTECTION DE STEPS ===

/**
 * Vérifie si une étape est un step d'attente/correspondance
 * @param {Object} step - L'étape à vérifier
 * @returns {boolean}
 */
export function isWaitStep(step) {
    if (!step) return false;
    if (step.type === 'WAIT') return true;
    
    const instruction = (step.instruction || '').toLowerCase();
    const looksLikeWait = instruction.includes('correspondance') || 
                          instruction.includes('attente') || 
                          instruction.includes('transfert');
    const missingRoute = isMissingTextValue(step.routeShortName);
    const missingStops = isMissingTextValue(step.departureStop) && isMissingTextValue(step.arrivalStop);
    
    return looksLikeWait && (missingRoute || missingStops);
}

// === POLYLINES ===

/**
 * Extrait la valeur encodée d'une polyline
 * @param {Object|string} polyline - Polyline ou chaîne encodée
 * @returns {string|null}
 */
export function getEncodedPolylineValue(polyline) {
    if (!polyline) return null;
    if (typeof polyline === 'string') return polyline;
    return polyline.encodedPolyline || polyline.points || null;
}

/**
 * Extrait les coordonnées latLng d'une polyline
 * Supporte plusieurs formats (array, encodedPolyline, coordinates)
 * 
 * @param {Object|Array|string} polyline - La polyline
 * @returns {Array<Array<number>>|null} Array de [lat, lng]
 */
export function getPolylineLatLngs(polyline) {
    if (!polyline) return null;

    const normalizePairs = (pairs) => {
        if (!Array.isArray(pairs)) return null;
        const normalized = pairs
            .map((pair) => {
                if (!Array.isArray(pair) || pair.length < 2) return null;
                const lat = Number(pair[0]);
                const lon = Number(pair[1]);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                return [lat, lon];
            })
            .filter(Boolean);
        return normalized.length ? normalized : null;
    };

    // Cas 1: Array direct de paires
    if (Array.isArray(polyline)) {
        const direct = normalizePairs(polyline);
        if (direct) return direct;
    }

    // Cas 2: Objet avec latLngs
    if (Array.isArray(polyline.latLngs)) {
        const direct = normalizePairs(polyline.latLngs);
        if (direct) return direct;
    }

    // Cas 3: Objet avec points (peut être encodé ou array)
    if (Array.isArray(polyline.points)) {
        const maybeRaw = normalizePairs(polyline.points);
        if (maybeRaw) return maybeRaw;
    }

    // Cas 4: Objet avec coordinates (format GeoJSON)
    if (Array.isArray(polyline.coordinates)) {
        const converted = normalizePairs(polyline.coordinates.map(([lng, lat]) => [lat, lng]));
        if (converted) return converted;
    }

    // Cas 5: Chaîne encodée
    const encoded = getEncodedPolylineValue(polyline);
    if (encoded) {
        try {
            return decodePolyline(encoded);
        } catch (err) {
            console.warn('getPolylineLatLngs: decode failed', err);
        }
    }

    return null;
}

/**
 * Extrait toutes les polylines d'un step
 * V323: Version améliorée avec fallbacks multiples
 * @param {Object} step - L'étape
 * @returns {Array} Array de polylines
 */
export function extractStepPolylines(step) {
    if (!step || isWaitStep(step)) return [];

    const collected = [];
    const pushIfValid = (poly) => {
        if (poly) collected.push(poly);
    };

    // V323: Détecter mode transit (BUS ou TRANSIT)
    const isTransitStep = step.type === 'BUS' || step.travelMode === 'TRANSIT';

    // Priorité 1: BUS/TRANSIT avec polyline directe
    if (isTransitStep) {
        pushIfValid(step?.polyline);
        // V323: Fallback legGeometry pour legs OTP bruts
        if (collected.length === 0 && step?.legGeometry?.points) {
            pushIfValid({ encodedPolyline: step.legGeometry.points });
        }
    }
    // Priorité 2: Tableau polylines (WALK multi-segments)
    else if (Array.isArray(step.polylines) && step.polylines.length) {
        step.polylines.forEach(pushIfValid);
    }
    // Priorité 3: Polyline unique
    else {
        pushIfValid(step?.polyline);
    }

    // Fallback: chercher dans les substeps si aucune polyline trouvée
    if (collected.length === 0 && step.subSteps && step.subSteps.length > 0) {
        step.subSteps.forEach(subStep => {
            pushIfValid(subStep?.polyline);
            if (Array.isArray(subStep?.polylines)) {
                subStep.polylines.forEach(pushIfValid);
            }
        });
    }

    // V323: Fallback ultime - créer une polyline à partir des coordonnées de départ/arrivée
    if (collected.length === 0) {
        const startLoc = step.startLocation?.latLng || step.departureLocation;
        const endLoc = step.endLocation?.latLng || step.arrivalLocation;
        if (startLoc && endLoc) {
            const startLat = startLoc.latitude ?? startLoc.lat;
            const startLon = startLoc.longitude ?? startLoc.lon ?? startLoc.lng;
            const endLat = endLoc.latitude ?? endLoc.lat;
            const endLon = endLoc.longitude ?? endLoc.lon ?? endLoc.lng;
            if (Number.isFinite(startLat) && Number.isFinite(startLon) &&
                Number.isFinite(endLat) && Number.isFinite(endLon)) {
                pushIfValid({ latLngs: [[startLat, startLon], [endLat, endLon]] });
            }
        }
    }

    // Debug pour itinéraires multi-correspondances
    if (collected.length === 0 && step.type !== 'WAIT') {
        console.warn('[Polyline] Aucune polyline trouvée pour step:', step.type || step.travelMode, step.instruction);
    }

    return collected;
}

// === STYLES LEAFLET ===

/**
 * Détermine le style Leaflet pour une étape d'itinéraire
 * @param {Object} step - L'étape
 * @returns {Object} Style Leaflet (color, weight, opacity, dashArray)
 */
export function getLeafletStyleForStep(step) {
    // Vérifie le type simple (vélo/marche)
    if (step.type === 'BIKE') {
        return {
            color: 'var(--secondary)',
            weight: 5,
            opacity: 0.8
        };
    }
    if (step.type === 'WALK') {
        return {
            color: 'var(--primary)',
            weight: 5,
            opacity: 0.8,
            dashArray: '10, 10' // Hachuré
        };
    }
    // Vérifie le type Bus
    if (step.type === 'BUS') {
        const busColor = step.routeColor || 'var(--primary)';
        return {
            color: busColor,
            weight: 5,
            opacity: 0.8
        };
    }
    
    // Fallback pour les types Google (au cas où)
    if (step.travelMode === 'BICYCLE') return getLeafletStyleForStep({ type: 'BIKE' });
    if (step.travelMode === 'WALK') return getLeafletStyleForStep({ type: 'WALK' });
    if (step.travelMode === 'TRANSIT') return getLeafletStyleForStep({ type: 'BUS', routeColor: step.routeColor });

    // Style par défaut
    return {
        color: 'var(--primary)',
        weight: 5,
        opacity: 0.8
    };
}

// === MARQUEURS ===

/**
 * Crée un divIcon Leaflet pour un arrêt
 * @param {string} role - Rôle de l'arrêt (boarding, alighting, transfer, intermediate)
 * @returns {L.DivIcon|null}
 */
export function createStopDivIcon(role) {
    if (typeof L === 'undefined' || !L.divIcon) return null;
    
    const sizeMap = {
        boarding: 22,
        alighting: 22,
        transfer: 16,
        intermediate: 12
    };
    const size = sizeMap[role] || 12;
    
    return L.divIcon({
        className: `itinerary-stop-marker ${role}`,
        html: '<span></span>',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
}

/**
 * Ajoute les marqueurs d'arrêts pour un itinéraire
 * 
 * @param {Object} itinerary - L'itinéraire
 * @param {L.Map} map - La carte Leaflet
 * @param {L.LayerGroup} markerLayer - Le layer pour les marqueurs
 * @param {Object} [options] - Options
 * @param {Object} [options.dataManager] - Instance du DataManager
 */
export function addItineraryMarkers(itinerary, map, markerLayer, options = {}) {
    const { dataManager = null } = options;
    
    if (!itinerary || !Array.isArray(itinerary.steps) || !map || !markerLayer) return;

    markerLayer.clearLayers();

    const busSteps = itinerary.steps.filter(step => step.type === 'BUS' && !isWaitStep(step));
    if (!busSteps.length) {
        addFallbackItineraryMarkers(itinerary, markerLayer);
        return;
    }

    const stopPoints = [];

    busSteps.forEach((step, index) => {
        const isFirstBus = index === 0;
        const isLastBus = index === busSteps.length - 1;
        const stepStops = [];

        // Arrêt de départ
        if (step.departureStop) {
            stepStops.push({ name: step.departureStop, role: isFirstBus ? 'boarding' : 'transfer' });
        }

        // Arrêts intermédiaires
        let intermediateStopsData = [];
        
        if (Array.isArray(step.intermediateStops) && step.intermediateStops.length > 0) {
            intermediateStopsData = step.intermediateStops.map(stopName => ({
                name: typeof stopName === 'string' ? stopName : (stopName?.name || stopName?.stop_name || ''),
                lat: stopName?.lat || stopName?.stop_lat || null,
                lng: stopName?.lng || stopName?.stop_lon || null
            }));
        }
        
        if (intermediateStopsData.length === 0 && Array.isArray(step.stopTimes) && dataManager) {
            intermediateStopsData = step.stopTimes.slice(1, -1).map(st => {
                const stopObj = dataManager.getStop?.(st.stop_id);
                return {
                    name: stopObj?.stop_name || st.stop_id,
                    lat: parseFloat(stopObj?.stop_lat) || null,
                    lng: parseFloat(stopObj?.stop_lon) || null
                };
            });
        }
        
        intermediateStopsData.forEach(stop => {
            if (stop.name) {
                stepStops.push({ 
                    name: stop.name, 
                    role: 'intermediate',
                    directLat: stop.lat,
                    directLng: stop.lng
                });
            }
        });

        // Arrêt d'arrivée
        if (step.arrivalStop) {
            stepStops.push({ name: step.arrivalStop, role: isLastBus ? 'alighting' : 'transfer' });
        }

        // Résoudre les coordonnées
        stepStops.forEach(stop => {
            let coords = null;
            
            if (stop.directLat && stop.directLng) {
                coords = { lat: stop.directLat, lng: stop.directLng };
            } else if (dataManager) {
                coords = resolveStopCoordinates(stop.name, dataManager);
            }
            
            if (!coords) {
                console.log(`⚠️ Coordonnées non trouvées pour: ${stop.name}`);
                return;
            }

            const key = `${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}`;
            const existing = stopPoints.find(point => point.key === key);
            
            if (existing) {
                if (STOP_ROLE_PRIORITY[stop.role] > STOP_ROLE_PRIORITY[existing.role]) {
                    existing.role = stop.role;
                }
                if (!existing.names.includes(stop.name)) {
                    existing.names.push(stop.name);
                }
                return;
            }

            stopPoints.push({
                key,
                lat: coords.lat,
                lng: coords.lng,
                role: stop.role,
                names: [stop.name]
            });
        });
    });

    if (!stopPoints.length) {
        addFallbackItineraryMarkers(itinerary, markerLayer);
        return;
    }

    // Créer les marqueurs avec z-index approprié
    stopPoints.forEach(point => {
        const icon = createStopDivIcon(point.role);
        if (!icon) return;
        
        let zIndex = 800;
        if (point.role === 'boarding' || point.role === 'alighting') {
            zIndex = 1200;
        } else if (point.role === 'transfer') {
            zIndex = 1000;
        }
        
        const marker = L.marker([point.lat, point.lng], {
            icon,
            zIndexOffset: zIndex
        });
        markerLayer.addLayer(marker);
    });
    
    console.log(`📍 ${stopPoints.length} marqueurs ajoutés (${stopPoints.filter(p => p.role === 'intermediate').length} arrêts intermédiaires)`);
}

/**
 * Ajoute des marqueurs de fallback depuis les polylines
 * @param {Object} itinerary - L'itinéraire
 * @param {L.LayerGroup} markerLayer - Le layer pour les marqueurs
 */
export function addFallbackItineraryMarkers(itinerary, markerLayer) {
    if (!itinerary || !Array.isArray(itinerary.steps) || !itinerary.steps.length) return;

    const fallbackPoints = [];
    
    // Premier point
    const firstStep = itinerary.steps[0];
    const firstPolyline = (firstStep.type === 'BUS') ? firstStep.polyline : firstStep.polylines?.[0];
    const firstLatLngs = getPolylineLatLngs(firstPolyline);
    if (firstLatLngs && firstLatLngs.length) {
        const [lat, lng] = firstLatLngs[0];
        fallbackPoints.push({ lat, lng, role: 'boarding' });
    }

    // Points intermédiaires (correspondances)
    itinerary.steps.forEach((step, index) => {
        if (index === itinerary.steps.length - 1) return;
        const polyline = (step.type === 'BUS')
            ? step.polyline
            : (Array.isArray(step.polylines) ? step.polylines[step.polylines.length - 1] : null);
        const latLngs = getPolylineLatLngs(polyline);
        if (latLngs && latLngs.length) {
            const [lat, lng] = latLngs[latLngs.length - 1];
            fallbackPoints.push({ lat, lng, role: 'transfer' });
        }
    });

    // Dernier point
    const lastStep = itinerary.steps[itinerary.steps.length - 1];
    const lastPolyline = (lastStep.type === 'BUS')
        ? lastStep.polyline
        : (Array.isArray(lastStep.polylines) ? lastStep.polylines[lastStep.polylines.length - 1] : null);
    const lastLatLngs = getPolylineLatLngs(lastPolyline);
    if (lastLatLngs && lastLatLngs.length) {
        const [lat, lng] = lastLatLngs[lastLatLngs.length - 1];
        fallbackPoints.push({ lat, lng, role: 'alighting' });
    }

    // Créer les marqueurs
    fallbackPoints.forEach(point => {
        const icon = createStopDivIcon(point.role);
        if (!icon) return;
        markerLayer.addLayer(L.marker([point.lat, point.lng], {
            icon,
            zIndexOffset: (point.role === 'boarding' || point.role === 'alighting') ? 1200 : 900
        }));
    });
}

/**
 * Dessine un itinéraire sur une carte
 * 
 * @param {Object} itinerary - L'itinéraire à dessiner
 * @param {L.Map} map - La carte Leaflet
 * @param {L.Layer|null} existingRouteLayer - Layer existant à remplacer
 * @param {L.LayerGroup} markerLayer - Layer pour les marqueurs
 * @param {Object} [options] - Options
 * @param {Object} [options.dataManager] - Instance du DataManager
 * @returns {L.FeatureGroup|null} Le nouveau layer créé
 */
export function drawRouteOnMap(itinerary, map, existingRouteLayer, markerLayer, options = {}) {
    // Accepter un tableau ou un objet unique
    if (Array.isArray(itinerary)) {
        itinerary = itinerary[0];
    }
    
    if (!map || !itinerary || !itinerary.steps) return null;

    // Supprimer l'ancien layer
    if (existingRouteLayer) {
        map.removeLayer(existingRouteLayer);
    }
    
    // Vider les anciens marqueurs
    if (markerLayer) {
        markerLayer.clearLayers();
    }

    const stepLayers = [];
    
    itinerary.steps.forEach(step => {
        const style = getLeafletStyleForStep(step);
        const polylinesToDraw = extractStepPolylines(step);

        if (!polylinesToDraw.length) return;

        polylinesToDraw.forEach(polyline => {
            const latLngs = getPolylineLatLngs(polyline);
            if (!latLngs || !latLngs.length) return;

            const stepLayer = L.polyline(latLngs, style);
            stepLayers.push(stepLayer);
        });
    });

    if (stepLayers.length === 0) return null;

    // Créer un groupe avec toutes les couches
    const routeLayer = L.featureGroup(stepLayers).addTo(map);
    
    // Ajouter les marqueurs
    if (markerLayer) {
        addItineraryMarkers(itinerary, map, markerLayer, options);
    }

    // Ajuster la carte pour voir l'ensemble du trajet
    const bounds = routeLayer.getBounds();
    if (bounds && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
    }

    return routeLayer;
}

// === EXPORTS PAR DÉFAUT ===

export default {
    // Constantes
    STOP_ROLE_PRIORITY,
    
    // Détection
    isWaitStep,
    
    // Polylines
    getEncodedPolylineValue,
    getPolylineLatLngs,
    extractStepPolylines,
    
    // Styles
    getLeafletStyleForStep,
    
    // Marqueurs
    createStopDivIcon,
    addItineraryMarkers,
    addFallbackItineraryMarkers,
    
    // Dessin
    drawRouteOnMap
};

