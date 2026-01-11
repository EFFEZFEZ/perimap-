/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * API Routes - Optimisé pour < 500ms
 */

export const config = {
    runtime: 'edge',
    regions: ['cdg1'], // Paris - proche utilisateurs
};

export default async function handler(request) {
    const origin = request.headers.get('origin') || '';
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Méthode non autorisée. Utilisez POST.' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const apiKey = process.env.GMAPS_SERVER_KEY;
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: 'GMAPS_SERVER_KEY manquant.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        const body = await request.json();

        // Support des deux formats: fromPlace/toPlace (anciens clients) et origin/destination (Google)
        let googleBody = body;
        
        // Conversion format Périmap → Google si nécessaire
        if (body.fromPlace && body.toPlace) {
            const parseLatLon = (value) => {
                if (typeof value !== 'string') return null;
                const parts = value.split(',').map(s => s.trim());
                if (parts.length < 2) return null;
                const lat = Number(parts[0]);
                const lon = Number(parts[1]);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                return { lat, lon };
            };
            
            const originCoords = parseLatLon(body.fromPlace);
            const destCoords = parseLatLon(body.toPlace);
            
            if (!originCoords || !destCoords) {
                return new Response(
                    JSON.stringify({ error: 'Format coordonnées invalide (attendu: lat,lon)' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            
            // Mapper le mode vers Google
            const modeMap = {
                'TRANSIT': 'TRANSIT',
                'TRANSIT,WALK': 'TRANSIT',
                'WALK': 'WALK',
                'BICYCLE': 'BICYCLE',
                'DRIVE': 'DRIVE'
            };
            const travelMode = modeMap[body.mode] || 'TRANSIT';
            
            googleBody = {
                origin: { location: { latLng: { latitude: originCoords.lat, longitude: originCoords.lon } } },
                destination: { location: { latLng: { latitude: destCoords.lat, longitude: destCoords.lon } } },
                travelMode: travelMode,
                computeAlternativeRoutes: travelMode === 'TRANSIT',
                languageCode: 'fr',
                units: 'METRIC'
            };
            
            // Ajouter heure de départ/arrivée si spécifiée
            if (body.date && body.time) {
                let dateTime = body.time;
                if (!dateTime.includes('T')) {
                    dateTime = `${body.date}T${body.time}:00`;
                }
                const timestamp = new Date(dateTime).toISOString();
                
                if (body.arriveBy) {
                    googleBody.arrivalTime = timestamp;
                } else {
                    googleBody.departureTime = timestamp;
                }
            }
            
            // Transit routing preferences
            if (travelMode === 'TRANSIT') {
                googleBody.transitPreferences = {
                    routingPreference: 'FEWER_TRANSFERS'
                };
            }
        }

        // FieldMask optimisé - minimum requis pour l'affichage
        // Transit: polyline + steps avec transit details
        const travelMode = googleBody.travelMode || 'TRANSIT';
        const fieldMask = travelMode === 'TRANSIT'
            ? 'routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.transitDetails,routes.legs.steps.travelMode,routes.legs.steps.polyline.encodedPolyline'
            : 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline';

        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': fieldMask
            },
            body: JSON.stringify(googleBody)
        });

        const data = await response.json().catch(() => ({}));

        return new Response(
            JSON.stringify(data),
            { 
                status: response.status, 
                headers: { 
                    ...corsHeaders, 
                    'Content-Type': 'application/json',
                    'Cache-Control': 's-maxage=60',
                    'X-Backend': 'google-routes'
                } 
            }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Routes proxy error', details: error.message }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}


