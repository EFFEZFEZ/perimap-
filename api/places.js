/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * API Places - Proxy vers Google Places API
 */

export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (request.method !== 'GET') {
        return new Response(
            JSON.stringify({ error: 'Méthode non autorisée. Utilisez GET.' }),
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

    const input = url.searchParams.get('input') || url.searchParams.get('q');
    const placeId = url.searchParams.get('placeId');

    try {
        // Mode 1: Autocomplétion via New Places API (Text Search)
        if (input) {
            const googleUrl = 'https://places.googleapis.com/v1/places:searchText';
            
            const requestBody = {
                textQuery: input,
                languageCode: 'fr',
                regionCode: 'FR',
                locationBias: {
                    circle: {
                        center: { latitude: 45.184029, longitude: 0.7211149 },
                        radius: 30000.0
                    }
                },
                maxResultCount: 10
            };

            const response = await fetch(googleUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
                return new Response(
                    JSON.stringify({ error: `Google Places error`, details: data.error?.message }),
                    { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Formater la réponse
            const predictions = (data.places || []).map(p => ({
                description: p.formattedAddress || p.displayName?.text,
                placeId: p.id,
                name: p.displayName?.text,
                location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null
            }));

            return new Response(
                JSON.stringify({ predictions }),
                { 
                    status: 200, 
                    headers: { 
                        ...corsHeaders, 
                        'Content-Type': 'application/json',
                        'Cache-Control': 's-maxage=300'
                    } 
                }
            );
        }

        // Mode 2: Récupérer les coordonnées d'un placeId via Place Details (New API)
        if (placeId) {
            const googleUrl = `https://places.googleapis.com/v1/places/${placeId}`;

            const response = await fetch(googleUrl, {
                method: 'GET',
                headers: {
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'id,displayName,formattedAddress,location'
                }
            });

            const data = await response.json();

            if (!response.ok) {
                return new Response(
                    JSON.stringify({ error: `Google Places error`, details: data.error?.message }),
                    { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            return new Response(
                JSON.stringify({
                    placeId: data.id,
                    name: data.displayName?.text,
                    address: data.formattedAddress,
                    location: data.location ? {
                        lat: data.location.latitude,
                        lng: data.location.longitude
                    } : null
                }),
                { 
                    status: 200, 
                    headers: { 
                        ...corsHeaders, 
                        'Content-Type': 'application/json',
                        'Cache-Control': 's-maxage=86400'
                    } 
                }
            );
        }

        return new Response(
            JSON.stringify({ error: 'Paramètre input ou placeId requis.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Places proxy error', details: error.message }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}


