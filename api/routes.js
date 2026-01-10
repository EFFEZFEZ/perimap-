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
            
            // Transform Perimap format to OTP v2 format
            let { fromPlace, toPlace, date, time, arriveBy, maxWalkDistance, numItineraries } = body;
            
            // Convert date format from YYYY-MM-DD to MM-DD-YYYY (OTP expects this)
            if (date && typeof date === 'string') {
                const dateParts = date.split('-');
                if (dateParts.length === 3) {
                    date = `${dateParts[1]}-${dateParts[2]}-${dateParts[0]}`;
                }
            }
            
            console.log('[routes edge V314] Calling OTP with:', { fromPlace, toPlace, date, time });
            
            const otpUrl = new URL('http://79.72.24.141:8080/otp/routers/default/plan');
            otpUrl.searchParams.append('fromPlace', fromPlace);
            otpUrl.searchParams.append('toPlace', toPlace);
            otpUrl.searchParams.append('date', date);
            otpUrl.searchParams.append('time', time);
            otpUrl.searchParams.append('mode', 'TRANSIT,WALK');
            otpUrl.searchParams.append('maxWalkDistance', maxWalkDistance || 1000);
            otpUrl.searchParams.append('numItineraries', numItineraries || 3);
            otpUrl.searchParams.append('arriveBy', arriveBy ? 'true' : 'false');
            
            console.log('[routes edge V314] OTP URL:', otpUrl.toString().substring(0, 150));
            
            try {
                const response = await fetch(otpUrl.toString(), {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Perimap-Vercel-Edge/1.0'
                    }
                });

                const data = await response.json();
                console.log('[routes edge V314] OTP réponse:', response.status, '- itineraires:', data.plan?.itineraries?.length || 0);

                // If OTP returns an error or no itineraries, log it
                if (!response.ok || !data.plan || !data.plan.itineraries) {
                    console.warn('[routes edge V314] OTP response invalid or empty:', data.error);
                    return new Response(
                        JSON.stringify({ 
                            success: false, 
                            error: 'Pas d\'itinéraire disponible',
                            code: 'NO_ITINERARIES',
                            details: data.error?.message || 'OTP ne trouve aucun itinéraire'
                        }),
                        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Backend': 'oracle-otp' } }
                    );
                }

                return new Response(
                    JSON.stringify(data),
                    { 
                        status: 200, 
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
                        details: 'Le planificateur de transports est temporairement indisponible: ' + otpError.message
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


