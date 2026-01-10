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
        console.log('[routes edge V314] Body keys:', Object.keys(body).join(', '));

        // Support both fromPlace/toPlace and origin/destination formats
        if (!body || (!body.fromPlace && !body.origin) || (!body.toPlace && !body.destination)) {
            return new Response(
                JSON.stringify({ error: 'Corps de requête invalide: fromPlace/toPlace ou origin/destination requis.' }),
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
            
            // Validate and format parameters
            if (!date || !time) {
                console.error('[routes edge V314] Missing date or time:', { date, time });
                return new Response(
                    JSON.stringify({ error: 'Date et heure requis' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            
            // Extract just HH:MM if time includes seconds or is ISO format
            let timeFormatted = time;
            if (time.includes('T')) {
                // ISO format like "2026-01-10T11:50:00+01:00" - extract time part
                const timeMatch = time.match(/T(\d{2}):(\d{2})/);
                if (timeMatch) {
                    timeFormatted = `${timeMatch[1]}:${timeMatch[2]}`;
                }
            } else if (time.includes(' ')) {
                // Format like "2026-01-10 11:50" - extract time part
                const parts = time.split(' ');
                if (parts.length === 2) {
                    date = parts[0];  // Update date from combined string
                    timeFormatted = parts[1];
                }
            }
            
            // Ensure date is YYYY-MM-DD
            if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                console.error('[routes edge V314] Invalid date format:', date);
                return new Response(
                    JSON.stringify({ error: 'Format de date invalide (attendu YYYY-MM-DD)' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            
            console.log('[routes edge V314] Calling OTP with:', { fromPlace, toPlace, date, time: timeFormatted, mode: 'TRANSIT,WALK' });
            
            const otpUrl = new URL('http://79.72.24.141:8080/otp/routers/default/plan');
            otpUrl.searchParams.append('fromPlace', fromPlace);
            otpUrl.searchParams.append('toPlace', toPlace);
            otpUrl.searchParams.append('date', date);
            otpUrl.searchParams.append('time', timeFormatted);
            otpUrl.searchParams.append('mode', 'TRANSIT,WALK');
            otpUrl.searchParams.append('maxWalkDistance', maxWalkDistance || 1000);
            otpUrl.searchParams.append('numItineraries', numItineraries || 3);
            otpUrl.searchParams.append('arriveBy', arriveBy ? 'true' : 'false');
            
            console.log('[routes edge V314] Full OTP URL:', otpUrl.toString());
            
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


