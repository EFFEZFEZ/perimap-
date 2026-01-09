/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * API Places - Version Edge Function (proxy vers Oracle Cloud)
 * V311 - Proxy vers backend Oracle au lieu de Google
 * 
 * Redirige les requêtes vers notre serveur Oracle Cloud
 * qui utilise Photon (OSM) + arrêts GTFS locaux
 */

export const config = {
    runtime: 'edge',
};

// URL du backend Oracle Cloud
// Note: Vercel Edge ne permet pas les IP directes, on utilise nip.io
const ORACLE_BACKEND = 'http://79.72.24.141.nip.io';

export default async function handler(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
    };

    console.log('[places edge V311] Requête reçue:', request.url);

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (request.method !== 'GET') {
        return new Response(
            JSON.stringify({ error: 'Méthode non autorisée. Utilisez GET.' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const input = url.searchParams.get('input') || url.searchParams.get('q');
    const placeId = url.searchParams.get('placeId');

    console.log('[places edge V311] Params - input:', input, 'placeId:', placeId);

    try {
        // Mode 1: Autocomplétion - proxy vers Oracle Cloud
        if (input) {
            const oracleUrl = `${ORACLE_BACKEND}/api/places/autocomplete?q=${encodeURIComponent(input)}`;
            console.log('[places edge V311] Proxy autocomplete vers:', oracleUrl);
            
            const startTime = Date.now();
            const response = await fetch(oracleUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Perimap-Vercel-Edge/1.0'
                }
            });
            const elapsed = Date.now() - startTime;

            console.log('[places edge V311] Oracle réponse en', elapsed, 'ms, status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[places edge V311] Erreur Oracle:', errorText);
                return new Response(
                    JSON.stringify({ error: 'Erreur backend Oracle', details: errorText }),
                    { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const data = await response.json();
            console.log('[places edge V313] Suggestions reçues:', data.suggestions?.length || 0);
            console.log('[places edge V313] Première suggestion:', JSON.stringify(data.suggestions?.[0]));

            // Passe les données Oracle directement - elles sont déjà au bon format
            // Oracle retourne: { suggestions: [{description, lat, lon, city, type, source}] }
            // C'est exactement ce que l'ApiManager attend en mode OTP

            console.log('[places edge V313] Retourne', data.suggestions?.length || 0, 'suggestions');

            return new Response(
                JSON.stringify({ suggestions: data.suggestions || [], source: 'oracle-cloud' }),
                { 
                    status: 200, 
                    headers: { 
                        ...corsHeaders, 
                        'Content-Type': 'application/json',
                        'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
                        'X-Backend': 'oracle-cloud'
                    } 
                }
            );
        }

        // Mode 2: Récupérer les coordonnées GPS d'un lieu (par placeId)
        if (placeId) {
            // Si le placeId contient des coordonnées (format photon_lat_lon)
            if (placeId.startsWith('photon_')) {
                const parts = placeId.split('_');
                if (parts.length >= 3) {
                    const lat = parseFloat(parts[1]);
                    const lon = parseFloat(parts[2]);
                    console.log('[places edge V311] Coordonnées extraites du placeId:', lat, lon);
                    return new Response(
                        JSON.stringify({ lat, lng: lon, source: 'photon-id' }),
                        { 
                            status: 200, 
                            headers: { 
                                ...corsHeaders, 
                                'Content-Type': 'application/json',
                                'Cache-Control': 's-maxage=86400',
                                'X-Backend': 'oracle-cloud'
                            } 
                        }
                    );
                }
            }

            // Sinon, on cherche le lieu par son ID sur Oracle
            const oracleUrl = `${ORACLE_BACKEND}/api/places/details?placeId=${encodeURIComponent(placeId)}`;
            console.log('[places edge V311] Proxy details vers:', oracleUrl);

            const response = await fetch(oracleUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Perimap-Vercel-Edge/1.0'
                }
            });

            if (!response.ok) {
                console.error('[places edge V311] Lieu non trouvé:', placeId);
                return new Response(
                    JSON.stringify({ error: 'Lieu non trouvé' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const data = await response.json();
            console.log('[places edge V311] Détails reçus:', data);

            return new Response(
                JSON.stringify({ 
                    lat: data.lat || data.location?.lat, 
                    lng: data.lng || data.lon || data.location?.lng,
                    source: 'oracle-cloud'
                }),
                { 
                    status: 200, 
                    headers: { 
                        ...corsHeaders, 
                        'Content-Type': 'application/json',
                        'Cache-Control': 's-maxage=86400',
                        'X-Backend': 'oracle-cloud'
                    } 
                }
            );
        }

        console.log('[places edge V311] Aucun paramètre valide');
        return new Response(
            JSON.stringify({ error: 'Paramètre input, q ou placeId requis' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('[places edge V311] Error:', error);
        return new Response(
            JSON.stringify({ error: 'Oracle proxy error', details: error.message }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}


