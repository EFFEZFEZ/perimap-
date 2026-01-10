/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * API Routes - Version Edge Function (hybride)
 * V315 - Supporte OTP (Oracle) + fallback Google (secours)
 * 
 * - Mode OTP (TRANSIT/WALK/BICYCLE): Proxy vers Oracle Cloud
 * - Fallback: Google Routes API si Oracle/OTP échoue
 */

export const config = {
    runtime: 'edge',
};

function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n', 'off', ''].includes(normalized)) return false;
    }
    return false;
}

// URL du backend Oracle Cloud (via nip.io pour contourner restriction Vercel)
const ORACLE_BACKEND = 'http://79.72.24.141.nip.io';

function parseLatLonString(value) {
    if (typeof value !== 'string') return null;
    const parts = value.split(',').map(s => s.trim());
    if (parts.length < 2) return null;
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
}

async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const resp = await fetch(url, { ...options, signal: controller.signal });
        return resp;
    } finally {
        clearTimeout(timeoutId);
    }
}

export default async function handler(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
    };

    console.log('[routes edge V315] Requête reçue:', request.method);

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
        console.log('[routes edge V315] Mode:', body.mode || body.travelMode || 'non spécifié');
        console.log('[routes edge V315] Body keys:', Object.keys(body).join(', '));

        // Support both fromPlace/toPlace and origin/destination formats
        if (!body || (!body.fromPlace && !body.origin) || (!body.toPlace && !body.destination)) {
            return new Response(
                JSON.stringify({ error: 'Corps de requête invalide: fromPlace/toPlace ou origin/destination requis.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Déterminer si c'est une requête OTP-compat (fromPlace/toPlace/date/time)
        // ou une requête Google Routes (origin/destination/travelMode)
        const isGoogleFormat = !!(body.travelMode || body.origin || body.destination);
        const requestedMode = body.mode || body.travelMode || 'TRANSIT';
        const isOtpPayload = !!(body.fromPlace && body.toPlace && !isGoogleFormat);

        // ========== MODE OTP: Proxy vers Oracle Cloud ==========
        if (isOtpPayload) {
            console.log('[routes edge V315] Mode OTP → Oracle');
            
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
                // ISO format like "2026-01-10T11:50:00+01:00" - extract both date and time
                const dateMatchISO = time.match(/^(\d{4})-(\d{2})-(\d{2})/);
                const timeMatch = time.match(/T(\d{2}):(\d{2})/);
                if (dateMatchISO) {
                    date = `${dateMatchISO[1]}-${dateMatchISO[2]}-${dateMatchISO[3]}`;
                }
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
            
            // Also extract date from date field if it's in ISO format
            if (date && date.includes('T')) {
                const dateMatchISO = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (dateMatchISO) {
                    date = `${dateMatchISO[1]}-${dateMatchISO[2]}-${dateMatchISO[3]}`;
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
            
            const oracleRoutesUrl = `${ORACLE_BACKEND}/api/routes`;
            const oracleMode = body.mode || 'TRANSIT,WALK';
            const defaultItineraries = String(oracleMode).toUpperCase().includes('WALK') && !String(oracleMode).toUpperCase().includes('TRANSIT')
                ? 1
                : (String(oracleMode).toUpperCase().includes('BICYCLE') ? 1 : 3);

            const oraclePayload = {
                fromPlace,
                toPlace,
                date,
                time: timeFormatted,
                mode: oracleMode,
                maxWalkDistance: maxWalkDistance || 1000,
                numItineraries: numItineraries || defaultItineraries,
                arriveBy: parseBoolean(arriveBy),
            };

            console.log('[routes edge V315] Proxy vers Oracle:', oracleRoutesUrl);
            console.log('[routes edge V315] Payload OTP-compat:', oraclePayload);

            try {
                const response = await fetchWithTimeout(oracleRoutesUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'User-Agent': 'Perimap-Vercel-Edge/1.0'
                    },
                    body: JSON.stringify(oraclePayload),
                }, 20000);

                let data;
                try {
                    data = await response.json();
                } catch (e) {
                    console.error('[routes edge V315] Failed to parse JSON:', e.message);
                    data = { error: 'Invalid JSON response from OTP' };
                }

                console.log('[routes edge V315] Oracle réponse:', response.status, '- error:', data.error || 'none', '- itineraires:', data.plan?.itineraries?.length || 0);

                // If OTP returns an error, log the full response and error message
                if (!response.ok) {
                    console.error('[routes edge V315] Oracle error response:', JSON.stringify(data));
                    throw new Error(data.error?.message || data.error || 'oracle-error');
                }

                // If OTP returns 200 but no itineraries
                if (!data.plan || !data.plan.itineraries || data.plan.itineraries.length === 0) {
                    console.warn('[routes edge V315] Oracle returned no itineraries');
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
                console.error('[routes edge V315] Backend Oracle indisponible:', otpError?.message || otpError);

                // Fallback Google (secours) si une clé serveur existe.
                const apiKey = process.env.GMAPS_SERVER_KEY;
                if (!apiKey) {
                    return new Response(
                        JSON.stringify({ 
                            success: false, 
                            error: 'Backend Oracle non disponible',
                            code: 'ORACLE_UNAVAILABLE',
                            details: 'OTP/Oracle indisponible et GMAPS_SERVER_KEY absent'
                        }),
                        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                const from = parseLatLonString(fromPlace);
                const to = parseLatLonString(toPlace);
                if (!from || !to) {
                    return new Response(
                        JSON.stringify({ 
                            success: false, 
                            error: 'Backend Oracle non disponible',
                            code: 'ORACLE_UNAVAILABLE',
                            details: 'Fallback Google impossible: fromPlace/toPlace invalides'
                        }),
                        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                const upperMode = String(oracleMode || requestedMode || '').toUpperCase();
                const travelMode = upperMode.includes('BICYCLE') ? 'BICYCLE' : (upperMode === 'WALK' ? 'WALK' : 'TRANSIT');

                const googleBody = {
                    origin: { location: { latLng: { latitude: from.lat, longitude: from.lon } } },
                    destination: { location: { latLng: { latitude: to.lat, longitude: to.lon } } },
                    travelMode,
                    computeAlternativeRoutes: travelMode === 'TRANSIT',
                    ...(travelMode === 'TRANSIT'
                        ? {
                            transitPreferences: {
                                allowedTravelModes: ['BUS'],
                                routingPreference: 'FEWER_TRANSFERS'
                            }
                          }
                        : {}),
                    languageCode: 'fr',
                    units: 'METRIC'
                };

                const fieldMask = 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs.steps';
                const googleResp = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Goog-Api-Key': apiKey,
                        'X-Goog-FieldMask': fieldMask
                    },
                    body: JSON.stringify(googleBody)
                });

                const googleData = await googleResp.json().catch(() => ({}));
                if (!googleResp.ok) {
                    return new Response(
                        JSON.stringify({ success: false, error: 'Fallback Google a échoué', details: googleData }),
                        { status: googleResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }

                return new Response(
                    JSON.stringify(googleData),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Backend': 'google-fallback' } }
                );
            }
        }
        
        // ========== Payload Google: proxy computeRoutes (utilisé uniquement si le client l'envoie) ==========
        console.log('[routes edge V315] Payload Google → Google');
        
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


