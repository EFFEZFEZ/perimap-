/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * API Places - Optimisé pour < 500ms
 */

export const config = {
    runtime: 'edge',
    regions: ['cdg1'], // Paris - proche de l'utilisateur
};

// Cache en mémoire pour les requêtes fréquentes (durée de vie de la fonction Edge)
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

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

    const apiKey = process.env.GMAPS_SERVER_KEY;
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: 'Config error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const input = url.searchParams.get('input') || url.searchParams.get('q');
    const placeId = url.searchParams.get('placeId');

    try {
        // Mode 1: Autocomplétion - Autocomplete (New) API
        if (input) {
            // Vérifier le cache
            const cacheKey = `ac:${input.toLowerCase()}`;
            const cached = cache.get(cacheKey);
            if (cached && Date.now() - cached.time < CACHE_TTL) {
                return new Response(cached.data, { 
                    status: 200, 
                    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' } 
                });
            }

            // Autocomplete (New) - Plus rapide que Text Search
            const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey
                },
                body: JSON.stringify({
                    input: input,
                    languageCode: 'fr',
                    regionCode: 'FR',
                    locationBias: {
                        circle: {
                            center: { latitude: 45.184, longitude: 0.721 },
                            radius: 25000
                        }
                    }
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                return new Response(
                    JSON.stringify({ error: 'API error', details: err.error?.message }),
                    { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const data = await response.json();
            
            // Formater pour le client
            const predictions = (data.suggestions || []).slice(0, 8).map(s => {
                const place = s.placePrediction;
                return {
                    description: place?.text?.text || place?.structuredFormat?.mainText?.text,
                    placeId: place?.placeId,
                    mainText: place?.structuredFormat?.mainText?.text,
                    secondaryText: place?.structuredFormat?.secondaryText?.text
                };
            });

            const responseBody = JSON.stringify({ predictions });
            
            // Mettre en cache
            cache.set(cacheKey, { data: responseBody, time: Date.now() });
            
            // Nettoyer le cache si trop gros
            if (cache.size > 100) {
                const oldest = [...cache.entries()].sort((a, b) => a[1].time - b[1].time)[0];
                if (oldest) cache.delete(oldest[0]);
            }

            return new Response(responseBody, { 
                status: 200, 
                headers: { 
                    ...corsHeaders, 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
                    'X-Cache': 'MISS'
                } 
            });
        }

        // Mode 2: Détails d'un lieu (coordonnées)
        if (placeId) {
            const cacheKey = `pd:${placeId}`;
            const cached = cache.get(cacheKey);
            if (cached && Date.now() - cached.time < 86400000) { // 24h pour les détails
                return new Response(cached.data, { 
                    status: 200, 
                    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' } 
                });
            }

            const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
                headers: {
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'location,displayName'
                }
            });

            if (!response.ok) {
                return new Response(
                    JSON.stringify({ error: 'Place not found' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const data = await response.json();
            const responseBody = JSON.stringify({
                placeId,
                name: data.displayName?.text,
                location: data.location ? {
                    lat: data.location.latitude,
                    lng: data.location.longitude
                } : null
            });

            cache.set(cacheKey, { data: responseBody, time: Date.now() });

            return new Response(responseBody, { 
                status: 200, 
                headers: { 
                    ...corsHeaders, 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, s-maxage=86400'
                } 
            });
        }

        return new Response(
            JSON.stringify({ error: 'input ou placeId requis' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}


