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
            
            // OTP v2 expects YYYY-MM-DD format (keep as is)
            console.log('[routes edge V314] Calling OTP with date:', date, 'time:', time, 'fromPlace:', fromPlace, 'toPlace:', toPlace);
            
            const otpUrl = new URL('http://79.72.24.141:8080/otp/routers/default/plan');
            otpUrl.searchParams.append('fromPlace', fromPlace);
            otpUrl.searchParams.append('toPlace', toPlace);
            otpUrl.searchParams.append('date', date);  // Keep YYYY-MM-DD format
            otpUrl.searchParams.append('time', time);
            otpUrl.searchParams.append('mode', 'TRANSIT,WALK');
            otpUrl.searchParams.append('maxWalkDistance', maxWalkDistance || 1000);
            otpUrl.searchParams.append('numItineraries', numItineraries || 3);
            otpUrl.searchParams.append('arriveBy', arriveBy ? 'true' : 'false');
            
            console.log('[routes edge V314] OTP URL:', otpUrl.toString().substring(0, 180));
            
            try {
                const response = await fetch(otpUrl.toString(), {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Perimap-Vercel-Edge/1.0'
                    }
                });

                let data;
                try {
                    data = await response.json();
                } catch (e) {
                    console.error('[routes edge V314] Failed to parse JSON:', e.message);
                    data = { error: 'Invalid JSON response from OTP' };
                }
                
                console.log('[routes edge V314] OTP réponse:', response.status, '- error:', data.error || 'none', '- itineraires:', data.plan?.itineraries?.length || 0);

                // If OTP returns an error, log the full response and error message
                if (!response.ok) {
                    console.error('[routes edge V314] OTP error response:', JSON.stringify(data));
                    return new Response(
                        JSON.stringify({ 
                            success: false, 
                            error: 'OTP ne peut pas traiter cette requête',
                            code: 'OTP_REQUEST_ERROR',
                            details: data.error?.message || data.error || JSON.stringify(data)
                        }),
                        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Backend': 'oracle-otp' } }
                    );
                }

                // If OTP returns 200 but no itineraries
                if (!data.plan || !data.plan.itineraries || data.plan.itineraries.length === 0) {
                    console.warn('[routes edge V314] OTP returned no itineraries');
                    return new Response(
                        JSON.stringify({ 
                            success: false, 
                            error: 'Pas d\'itinéraire disponible',
                            code: 'NO_ITINERARIES',
                            details: 'OTP ne trouve aucun itinéraire pour cette recherche'
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


