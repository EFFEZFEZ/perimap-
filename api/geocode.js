/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * API Geocode - Version Edge Function (ultra-rapide)
 * 
 * Sert à convertir des coordonnées GPS en adresse
 * (quand l'utilisateur clique sur "Ma position")
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
            JSON.stringify({ error: 'GMAPS_SERVER_KEY manquant sur le serveur.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const lat = url.searchParams.get('lat');
    const lng = url.searchParams.get('lng');

    if (!lat || !lng) {
        return new Response(
            JSON.stringify({ error: 'Paramètres lat et lng requis' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        // Appelle l'API Google Geocoding
        const geocodeUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        geocodeUrl.searchParams.set('latlng', `${lat},${lng}`);
        geocodeUrl.searchParams.set('key', apiKey);
        geocodeUrl.searchParams.set('language', 'fr');
        geocodeUrl.searchParams.set('result_type', 'street_address|route|locality');

        const response = await fetch(geocodeUrl.toString());
        const data = await response.json();

        if (!response.ok) {
            return new Response(
                JSON.stringify({ error: 'Erreur Geocoding API', details: data }),
                { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify(data),
            { 
                status: 200, 
                headers: { 
                    ...corsHeaders, 
                    'Content-Type': 'application/json',
                    'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800'
                } 
            }
        );

    } catch (error) {
        console.error('[geocode edge] Error:', error);
        return new Response(
            JSON.stringify({ error: 'Geocode proxy error', details: error.message }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}


