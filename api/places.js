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
        // Mode 1: Autocomplétion
        if (input) {
            const googleUrl = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
            googleUrl.searchParams.set('input', input);
            googleUrl.searchParams.set('key', apiKey);
            googleUrl.searchParams.set('language', 'fr');
            googleUrl.searchParams.set('components', 'country:fr');
            // Zone Grand Périgueux
            googleUrl.searchParams.set('location', '45.184029,0.7211149');
            googleUrl.searchParams.set('radius', '30000');
            googleUrl.searchParams.set('strictbounds', 'false');

            const response = await fetch(googleUrl.toString());
            const data = await response.json();

            if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                return new Response(
                    JSON.stringify({ error: `Google Places error: ${data.status}`, details: data.error_message }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Formater la réponse
            const predictions = (data.predictions || []).map(p => ({
                description: p.description,
                placeId: p.place_id,
                types: p.types
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

        // Mode 2: Récupérer les coordonnées d'un placeId
        if (placeId) {
            const googleUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
            googleUrl.searchParams.set('place_id', placeId);
            googleUrl.searchParams.set('key', apiKey);
            googleUrl.searchParams.set('fields', 'geometry,formatted_address,name');
            googleUrl.searchParams.set('language', 'fr');

            const response = await fetch(googleUrl.toString());
            const data = await response.json();

            if (data.status !== 'OK') {
                return new Response(
                    JSON.stringify({ error: `Google Places error: ${data.status}`, details: data.error_message }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const result = data.result;
            return new Response(
                JSON.stringify({
                    placeId: placeId,
                    name: result.name,
                    address: result.formatted_address,
                    location: {
                        lat: result.geometry?.location?.lat,
                        lng: result.geometry?.location?.lng
                    }
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


