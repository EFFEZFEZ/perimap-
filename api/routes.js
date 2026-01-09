/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * API Routes - Version Edge Function (hybride)
 * V314 - Supporte OTP (Oracle) ET Google (vélo/marche)
 * 
 * - Mode TRANSIT: Proxy vers Oracle Cloud OTP
 * - Mode WALK/BICYCLE: Google Routes API
 */

export const config = {
    runtime: 'edge',
};

// URL du backend Oracle Cloud (via nip.io pour contourner restriction Vercel)
const ORACLE_BACKEND = 'http://79.72.24.141.nip.io';

export default async function handler(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
    };

    console.log('[routes edge V314] Requête reçue:', request.method);

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Méthode non autorisée. Utilisez POST.' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    try {
        const body = await request.json();
        console.log('[routes edge V314] Mode:', body.mode || 'non spécifié');

        if (!body || !body.origin || !body.destination) {
            return new Response(
                JSON.stringify({ error: 'Corps de requête invalide: origin et destination requis.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Déterminer si c'est une requête OTP (TRANSIT) ou Google (WALK/BICYCLE)
        const isGoogleFormat = body.travelMode || body.routingPreference;
        const mode = body.mode || body.travelMode || 'TRANSIT';
        
        // ========== MODE TRANSIT: Proxy vers Oracle Cloud OTP ==========
        if (mode === 'TRANSIT' && !isGoogleFormat) {
            console.log('[routes edge V314] Mode TRANSIT → Oracle OTP');
            
            const oracleUrl = `${ORACLE_BACKEND}/api/routes`;
            
            try {
                const response = await fetch(oracleUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Perimap-Vercel-Edge/1.0'
                    },
                    body: JSON.stringify(body)
                });

                const data = await response.json();
                console.log('[routes edge V314] Oracle réponse:', response.status);

                return new Response(
                    JSON.stringify(data),
                    { 
                        status: response.status, 
                        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Backend': 'oracle-otp' } 
                    }
                );
            } catch (otpError) {
                console.error('[routes edge V314] Oracle OTP indisponible:', otpError.message);
                // OTP non disponible - retourner erreur explicite
                return new Response(
                    JSON.stringify({ 
                        success: false, 
                        error: 'Service OTP non disponible',
                        code: 'OTP_UNAVAILABLE',
                        details: 'Le planificateur de transports est temporairement indisponible'
                    }),
                    { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
        }
        
        // ========== MODE WALK/BICYCLE: Google Routes API ==========
        console.log('[routes edge V314] Mode WALK/BICYCLE → Google');
        
        const apiKey = process.env.GMAPS_SERVER_KEY;
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: 'GMAPS_SERVER_KEY manquant.' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Utiliser le format Google Routes API
        const fieldMask = 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs.polyline';

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
            console.error('[routes edge V314] Google API error:', data);
            return new Response(
                JSON.stringify(data),
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
                    'Cache-Control': 's-maxage=60',
                    'X-Backend': 'google-routes'
                } 
            }
        );

    } catch (error) {
        console.error('[routes edge V314] Error:', error);
        return new Response(
            JSON.stringify({ error: 'Routes proxy error', details: error.message }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}


