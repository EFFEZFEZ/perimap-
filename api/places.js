/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * API Places - Version Edge Function (ultra-rapide)
 * 
 * Sert à l'autocomplétion quand tu tapes une adresse
 * et à trouver les coordonnées GPS d'un lieu
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

    const input = url.searchParams.get('input');
    const placeId = url.searchParams.get('placeId');

    try {
        // Mode 1: Autocomplétion (quand l'utilisateur tape une adresse)
        if (input) {
            const placesUrl = 'https://places.googleapis.com/v1/places:autocomplete';
            
            const requestBody = {
                input: input,
                languageCode: 'fr',
                // Zone du Grand Périgueux uniquement
                locationRestriction: {
                    rectangle: {
                        low: { latitude: 45.10, longitude: 0.55 },
                        high: { latitude: 45.30, longitude: 0.90 }
                    }
                }
            };

            const response = await fetch(placesUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
                return new Response(
                    JSON.stringify({ error: 'Erreur Places API', details: data }),
                    { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Transforme le format Google en format simple
            const predictions = (data.suggestions || []).map(s => ({
                description: s.placePrediction?.text?.text || '',
                placeId: s.placePrediction?.placeId || ''
            })).filter(p => p.placeId);

            return new Response(
                JSON.stringify({ predictions }),
                { 
                    status: 200, 
                    headers: { 
                        ...corsHeaders, 
                        'Content-Type': 'application/json',
                        'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
                    } 
                }
            );
        }

        // Mode 2: Récupérer les coordonnées GPS d'un lieu
        if (placeId) {
            const detailsUrl = `https://places.googleapis.com/v1/places/${placeId}`;

            const response = await fetch(detailsUrl, {
                method: 'GET',
                headers: {
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'location'
                }
            });

            const data = await response.json();

            if (!response.ok || !data.location) {
                return new Response(
                    JSON.stringify({ error: 'Lieu non trouvé' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            return new Response(
                JSON.stringify({ 
                    lat: data.location.latitude, 
                    lng: data.location.longitude 
                }),
                { 
                    status: 200, 
                    headers: { 
                        ...corsHeaders, 
                        'Content-Type': 'application/json',
                        'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800'
                    } 
                }
            );
        }

        return new Response(
            JSON.stringify({ error: 'Paramètre input ou placeId requis' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[places edge] Error:', error);
        return new Response(
            JSON.stringify({ error: 'Places proxy error', details: error.message }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}


