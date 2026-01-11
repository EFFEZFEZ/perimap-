/**
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * API Routes - Optimisé avec cache intelligent
 * 
 * Stratégie de cache:
 * - Cache CDN Vercel: 60s (s-maxage)
 * - Cache applicatif: normalisation temporelle par buckets de 5 minutes
 * - Si départ à 14h03, on arrondit à 14h05 → même cache pour 14h00-14h05
 */

export const config = {
    runtime: 'edge',
    regions: ['cdg1'], // Paris - proche utilisateurs
};

// Cache en mémoire pour les requêtes récentes (limité à 100 entrées)
const routeCache = new Map();
const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Arrondit une date au prochain bucket de 5 minutes
 * Ex: 14h03 → 14h05, 14h07 → 14h10
 */
function roundToNext5Minutes(date) {
    const ms = 5 * 60 * 1000;
    return new Date(Math.ceil(date.getTime() / ms) * ms);
}

/**
 * Génère une clé de cache unique pour un trajet
 */
function generateCacheKey(origin, destination, departureTime, travelMode) {
    const roundedTime = departureTime ? roundToNext5Minutes(new Date(departureTime)) : null;
    const timeKey = roundedTime ? roundedTime.toISOString().slice(0, 16) : 'now';
    
    // Arrondir les coordonnées à 4 décimales (précision ~11m)
    const roundCoord = (c) => Math.round(c * 10000) / 10000;
    
    const originKey = origin.location?.latLng 
        ? `${roundCoord(origin.location.latLng.latitude)},${roundCoord(origin.location.latLng.longitude)}`
        : JSON.stringify(origin);
    
    const destKey = destination.location?.latLng
        ? `${roundCoord(destination.location.latLng.latitude)},${roundCoord(destination.location.latLng.longitude)}`
        : JSON.stringify(destination);
    
    return `${originKey}|${destKey}|${timeKey}|${travelMode}`;
}

/**
 * Nettoie les entrées expirées du cache
 */
function cleanExpiredCache() {
    const now = Date.now();
    for (const [key, entry] of routeCache.entries()) {
        if (now - entry.timestamp > CACHE_TTL_MS) {
            routeCache.delete(key);
        }
    }
    
    // Si toujours trop grand, supprimer les plus anciennes
    if (routeCache.size > CACHE_MAX_SIZE) {
        const entries = [...routeCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toDelete = entries.slice(0, routeCache.size - CACHE_MAX_SIZE);
        toDelete.forEach(([key]) => routeCache.delete(key));
    }
}

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

        // Support des deux formats: fromPlace/toPlace (anciens clients) et origin/destination (Google)
        let googleBody = body;
        
        // Conversion format Périmap → Google si nécessaire
        if (body.fromPlace && body.toPlace) {
            const parseLatLon = (value) => {
                if (typeof value !== 'string') return null;
                const parts = value.split(',').map(s => s.trim());
                if (parts.length < 2) return null;
                const lat = Number(parts[0]);
                const lon = Number(parts[1]);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                return { lat, lon };
            };
            
            const originCoords = parseLatLon(body.fromPlace);
            const destCoords = parseLatLon(body.toPlace);
            
            if (!originCoords || !destCoords) {
                return new Response(
                    JSON.stringify({ error: 'Format coordonnées invalide (attendu: lat,lon)' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            
            // Mapper le mode vers Google
            const modeMap = {
                'TRANSIT': 'TRANSIT',
                'TRANSIT,WALK': 'TRANSIT',
                'WALK': 'WALK',
                'BICYCLE': 'BICYCLE',
                'DRIVE': 'DRIVE'
            };
            const travelMode = modeMap[body.mode] || 'TRANSIT';
            
            googleBody = {
                origin: { location: { latLng: { latitude: originCoords.lat, longitude: originCoords.lon } } },
                destination: { location: { latLng: { latitude: destCoords.lat, longitude: destCoords.lon } } },
                travelMode: travelMode,
                computeAlternativeRoutes: travelMode === 'TRANSIT',
                languageCode: 'fr',
                units: 'METRIC'
            };
            
            // Ajouter heure de départ/arrivée si spécifiée
            if (body.date && body.time) {
                let dateTime = body.time;
                if (!dateTime.includes('T')) {
                    dateTime = `${body.date}T${body.time}:00`;
                }
                const timestamp = new Date(dateTime).toISOString();
                
                if (body.arriveBy) {
                    googleBody.arrivalTime = timestamp;
                } else {
                    googleBody.departureTime = timestamp;
                }
            }
            
            // Transit routing preferences
            if (travelMode === 'TRANSIT') {
                googleBody.transitPreferences = {
                    routingPreference: 'FEWER_TRANSFERS'
                };
            }
        }

        // ============================================
        // CACHE INTELLIGENT - Vérifier le cache
        // ============================================
        const travelMode = googleBody.travelMode || 'TRANSIT';
        const departureTime = googleBody.departureTime || googleBody.arrivalTime || null;
        const cacheKey = generateCacheKey(
            googleBody.origin, 
            googleBody.destination, 
            departureTime, 
            travelMode
        );
        
        // Nettoyer les entrées expirées
        cleanExpiredCache();
        
        // Vérifier si on a un cache valide
        const cachedEntry = routeCache.get(cacheKey);
        if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS)) {
            console.log(`[Routes] ✅ Cache HIT: ${cacheKey.slice(0, 50)}...`);
            return new Response(
                JSON.stringify(cachedEntry.data),
                { 
                    status: 200, 
                    headers: { 
                        ...corsHeaders, 
                        'Content-Type': 'application/json',
                        'Cache-Control': 'public, s-maxage=60, max-age=30',
                        'X-Backend': 'google-routes',
                        'X-Cache': 'HIT'
                    } 
                }
            );
        }

        // ============================================
        // Appel à Google Routes API
        // ============================================
        
        // FieldMask optimisé - minimum requis pour l'affichage
        const fieldMask = travelMode === 'TRANSIT'
            ? 'routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.transitDetails,routes.legs.steps.travelMode,routes.legs.steps.polyline.encodedPolyline'
            : 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline';

        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': fieldMask
            },
            body: JSON.stringify(googleBody)
        });

        const data = await response.json().catch(() => ({}));

        // ============================================
        // Stocker dans le cache si succès
        // ============================================
        if (response.ok && data.routes && data.routes.length > 0) {
            routeCache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
            console.log(`[Routes] 📦 Cache STORE: ${cacheKey.slice(0, 50)}... (${routeCache.size} entries)`);
        }

        return new Response(
            JSON.stringify(data),
            { 
                status: response.status, 
                headers: { 
                    ...corsHeaders, 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, s-maxage=60, max-age=30',
                    'X-Backend': 'google-routes',
                    'X-Cache': 'MISS'
                } 
            }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Routes proxy error', details: error.message }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
}


