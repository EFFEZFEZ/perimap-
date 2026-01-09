/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * API Routes - Version Edge Function (ultra-rapide)
 * 
 * Avantage : Répond en <50ms au lieu de 300-800ms
 * Les Edge Functions tournent au plus proche de l'utilisateur
 */

// Active le mode Edge (serveurs toujours prêts, partout dans le monde)
export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    // Récupère les infos de la requête
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    
    // Headers pour autoriser les requêtes depuis ton site
    const corsHeaders = {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
    };

    // Gère les requêtes de vérification (preflight)
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    // Vérifie que c'est bien une requête POST
    if (request.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Méthode non autorisée. Utilisez POST.' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Récupère la clé API Google (stockée dans Vercel)
    const apiKey = process.env.GMAPS_SERVER_KEY;
    if (!apiKey) {
        return new Response(
            JSON.stringify({ error: 'GMAPS_SERVER_KEY manquant sur le serveur.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Quel type de trajet ? (bus, marche, vélo)
    const action = url.searchParams.get('action');
    if (!action || !['directions', 'walking', 'bicycle'].includes(action)) {
        return new Response(
            JSON.stringify({ error: 'Paramètre action invalide. Valeurs: directions, walking, bicycle' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        const body = await request.json();

        if (!body || !body.origin || !body.destination) {
            return new Response(
                JSON.stringify({ error: 'Corps de requête invalide: origin et destination requis.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Quelles infos on veut de Google ?
        let fieldMask = 'routes.duration,routes.distanceMeters,routes.polyline';
        if (action === 'directions') {
            fieldMask = 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs.steps';
        } else {
            fieldMask = 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs.polyline';
        }

        // Appelle Google Routes API
        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': fieldMask
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[routes edge] Google API error:', data);
            return new Response(
                JSON.stringify(data),
                { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Succès ! On renvoie les itinéraires
        return new Response(
            JSON.stringify(data),
            { 
                status: 200, 
                headers: { 
                    ...corsHeaders, 
                    'Content-Type': 'application/json',
                    'Cache-Control': 's-maxage=20, stale-while-revalidate=40'
                } 
            }
        );

    } catch (error) {
        console.error('[routes edge] Error:', error);
        return new Response(
            JSON.stringify({ error: 'Routes proxy error', details: error.message }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}


