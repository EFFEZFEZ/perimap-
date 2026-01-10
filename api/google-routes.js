/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * API Google Routes (secours) - Edge Function
 *
 * Ce endpoint n'est pas utilisé en fonctionnement normal.
 * Il sert uniquement de fallback d'urgence si OTP/Oracle échoue.
 */

export const config = {
    runtime: 'edge',
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
        const fieldMask = request.headers.get('x-goog-fieldmask')
            || 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs.steps';

        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': fieldMask,
            },
            body: JSON.stringify(body),
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
                    'X-Backend': 'google-routes',
                },
            }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Google routes proxy error', details: error.message }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}
