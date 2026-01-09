/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
import { DataManager } from '../dataManager.js';
import { createRouterContext } from '../router.js';

let routerContext = null;
let workerDataManager = null;
let isReady = false;
let googleApiKey = null;
let geocodeProxyUrl = '/api/geocode';

self.addEventListener('message', async (event) => {
    const { type, payload, requestId } = event.data || {};
    if (type === 'init') {
        try {
            await handleInit(payload);
            isReady = true;
            self.postMessage({ type: 'ready' });
        } catch (error) {
            console.error('routerWorker init failed', error);
            self.postMessage({ type: 'init-error', error: error?.message || 'init failed' });
        }
        return;
    }

    if (type === 'computeItinerary') {
        if (!isReady || !routerContext) {
            self.postMessage({ type: 'result', requestId, error: 'Router worker not ready' });
            return;
        }
        try {
            // V49: Accepter les arrêts forcés des pôles multimodaux
            const { fromCoords, toCoords, searchTime, labels, forcedStops } = payload || {};
            const itineraries = await routerContext.computeHybridItinerary(fromCoords, toCoords, searchTime, labels, forcedStops || {});
            self.postMessage({ type: 'result', requestId, payload: itineraries });
        } catch (error) {
            console.error('routerWorker compute error', error);
            self.postMessage({ type: 'result', requestId, error: error?.message || 'compute failed' });
        }
    }
});

async function handleInit(payload = {}) {
    const snapshot = payload.snapshot || {};
    googleApiKey = payload.googleApiKey || null;
    geocodeProxyUrl = payload.geocodeProxyUrl || geocodeProxyUrl;
    workerDataManager = new DataManager();
    workerDataManager.applyIndexes(snapshot.indexes || {});
    workerDataManager.routes = snapshot.dataset?.routes || [];
    workerDataManager.trips = snapshot.dataset?.trips || [];
    workerDataManager.stopTimes = snapshot.dataset?.stopTimes || [];
    workerDataManager.stops = snapshot.dataset?.stops || [];
    workerDataManager.calendar = snapshot.dataset?.calendar || [];
    workerDataManager.calendarDates = snapshot.dataset?.calendarDates || [];
    workerDataManager.geoJson = snapshot.dataset?.geoJson || null;
    workerDataManager.shapes = snapshot.dataset?.shapes || [];
    workerDataManager.buildRouteGeometryIndex();
    workerDataManager.isLoaded = true;
    
    // V192: Debug calendar pour vérifier les jours de service
    console.log('?? [Worker] Calendar chargé:', workerDataManager.calendar?.length || 0, 'entrées');
    if (workerDataManager.calendar?.length > 0) {
        const sample = workerDataManager.calendar[0];
        console.log('?? [Worker] Exemple calendar:', {
            service_id: sample.service_id,
            saturday: sample.saturday,
            sunday: sample.sunday,
            start_date: sample.start_date,
            end_date: sample.end_date
        });
    }
    
    // DEBUG: Vérifier stopTimesByStop
    const stopTimesByStopKeys = Object.keys(workerDataManager.stopTimesByStop || {});
    console.log('?? [Worker] stopTimesByStop reçu:', stopTimesByStopKeys.length, 'stops');
    if (stopTimesByStopKeys.length > 0) {
        console.log('?? [Worker] Sample stopTimesByStop IDs:', stopTimesByStopKeys.slice(0, 5));
    }

    const apiBridge = createWorkerApiBridge(googleApiKey, { geocodeProxyUrl });
    routerContext = createRouterContext({
        dataManager: workerDataManager,
        apiManager: apiBridge,
        icons: payload.icons || {}
    });
}

function createWorkerApiBridge(apiKey, options = {}) {
    if (!apiKey) {
        return null;
    }
    const ROUTES_API = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    const geocodeEndpoint = options.geocodeProxyUrl || '/api/geocode';

    const headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline'
    };

    return {
        async fetchWalkingRoute(fromPlaceId, toPlaceId) {
            const body = {
                origin: { placeId: fromPlaceId },
                destination: { placeId: toPlaceId },
                travelMode: 'WALK',
                languageCode: 'fr',
                units: 'METRIC'
            };
            const response = await fetch(ROUTES_API, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                throw new Error(`Routes API error: ${response.status}`);
            }
            return response.json();
        },
        async reverseGeocode(lat, lon) {
            const url = `${geocodeEndpoint}?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lon)}`;
            const response = await fetch(url, { method: 'GET' });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Geocode proxy error: ${response.status} ${text}`);
            }
            const data = await response.json();
            const firstResult = data.results?.[0];
            return firstResult?.place_id || null;
        }
    };
}


