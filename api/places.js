/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * API Places - Autocomplétion optimisée Grand Périgueux
 * 
 * Priorités:
 * 1. Arrêts de bus GTFS locaux (noms de communes = arrêt central)
 * 2. Lieux Google dans le Grand Périgueux uniquement
 */

export const config = {
    runtime: 'edge',
    regions: ['cdg1'],
};

// Arrêts GTFS importants du Grand Périgueux avec coordonnées précises
// Ces arrêts sont prioritaires et évitent les confusions de Google
const GTFS_STOPS = {
    // Communes - pointent vers l'arrêt central/gare routière
    'périgueux': { lat: 45.1847, lng: 0.7214, name: 'Périgueux - Gare SNCF', type: 'city' },
    'perigueux': { lat: 45.1847, lng: 0.7214, name: 'Périgueux - Gare SNCF', type: 'city' },
    'boulazac': { lat: 45.1780, lng: 0.7480, name: 'Boulazac - Centre', type: 'city' },
    'trélissac': { lat: 45.1920, lng: 0.7580, name: 'Trélissac - Mairie', type: 'city' },
    'trelissac': { lat: 45.1920, lng: 0.7580, name: 'Trélissac - Mairie', type: 'city' },
    'chancelade': { lat: 45.2050, lng: 0.6780, name: 'Chancelade - Mairie', type: 'city' },
    'coulounieix': { lat: 45.1780, lng: 0.6950, name: 'Coulounieix-Chamiers - Mairie', type: 'city' },
    'chamiers': { lat: 45.1650, lng: 0.6900, name: 'Coulounieix-Chamiers - Mairie', type: 'city' },
    'marsac': { lat: 45.1860, lng: 0.6620, name: 'Marsac-sur-l\'Isle - Centre', type: 'city' },
    'notre-dame-de-sanilhac': { lat: 45.1450, lng: 0.7100, name: 'Notre-Dame-de-Sanilhac', type: 'city' },
    'sanilhac': { lat: 45.1450, lng: 0.7100, name: 'Notre-Dame-de-Sanilhac', type: 'city' },
    'saint-astier': { lat: 45.1450, lng: 0.5270, name: 'Saint-Astier - Gare', type: 'city' },
    'bassillac': { lat: 45.1980, lng: 0.8150, name: 'Bassillac - Centre', type: 'city' },
    
    // Arrêts importants / Pôles d'échange
    'gare': { lat: 45.1871, lng: 0.7085, name: 'Périgueux - Gare SNCF', type: 'station' },
    'gare sncf': { lat: 45.1871, lng: 0.7085, name: 'Périgueux - Gare SNCF', type: 'station' },
    'campus': { lat: 45.1971, lng: 0.7181, name: 'Campus Universitaire', type: 'poi' },
    'université': { lat: 45.1971, lng: 0.7181, name: 'Campus Universitaire', type: 'poi' },
    'cité': { lat: 45.1890, lng: 0.7160, name: 'Cité - Périgueux', type: 'poi' },
    'cite': { lat: 45.1890, lng: 0.7160, name: 'Cité - Périgueux', type: 'poi' },
    'agora': { lat: 45.1795, lng: 0.7520, name: 'Agora - Boulazac', type: 'poi' },
    'auchan': { lat: 45.1820, lng: 0.7650, name: 'Auchan - Trélissac', type: 'poi' },
    'super u': { lat: 45.1730, lng: 0.7380, name: 'Super U - Boulazac', type: 'poi' },
    'médiathèque': { lat: 45.1847, lng: 0.7200, name: 'Médiathèque - Périgueux', type: 'poi' },
    'mediatheque': { lat: 45.1847, lng: 0.7200, name: 'Médiathèque - Périgueux', type: 'poi' },
    'hôpital': { lat: 45.1920, lng: 0.7050, name: 'Hôpital - Périgueux', type: 'poi' },
    'hopital': { lat: 45.1920, lng: 0.7050, name: 'Hôpital - Périgueux', type: 'poi' },
    'centre hospitalier': { lat: 45.1920, lng: 0.7050, name: 'Centre Hospitalier', type: 'poi' },
    'mairie périgueux': { lat: 45.1840, lng: 0.7210, name: 'Mairie de Périgueux', type: 'poi' },
    'pont des barris': { lat: 45.1845, lng: 0.7252, name: 'Pont des Barris', type: 'poi' },
    'barris': { lat: 45.1845, lng: 0.7252, name: 'Pont des Barris', type: 'poi' },
    
    // Quartiers de Trélissac (pour éviter la confusion)
    'garennes': { lat: 45.1850, lng: 0.7530, name: 'Trélissac - Les Garennes', type: 'neighborhood' },
    'les garennes': { lat: 45.1850, lng: 0.7530, name: 'Trélissac - Les Garennes', type: 'neighborhood' },
    'feuilleraie': { lat: 45.1880, lng: 0.7620, name: 'Trélissac - Feuilleraie', type: 'neighborhood' },
    'bauries': { lat: 45.1950, lng: 0.7700, name: 'Trélissac - Les Bauries', type: 'neighborhood' },
    'les bauries': { lat: 45.1950, lng: 0.7700, name: 'Trélissac - Les Bauries', type: 'neighborhood' },
};

// Zone stricte du Grand Périgueux (bounding box)
const GRAND_PERIGUEUX_BOUNDS = {
    north: 45.25,
    south: 45.10,
    east: 0.85,
    west: 0.50
};

// Vérifier si des coordonnées sont dans le Grand Périgueux
function isInGrandPerigueux(lat, lng) {
    return lat >= GRAND_PERIGUEUX_BOUNDS.south &&
           lat <= GRAND_PERIGUEUX_BOUNDS.north &&
           lng >= GRAND_PERIGUEUX_BOUNDS.west &&
           lng <= GRAND_PERIGUEUX_BOUNDS.east;
}

// Rechercher dans les arrêts GTFS locaux
function searchGtfsStops(input) {
    const query = input.toLowerCase().trim();
    const results = [];
    
    for (const [key, stop] of Object.entries(GTFS_STOPS)) {
        if (key.includes(query) || stop.name.toLowerCase().includes(query)) {
            results.push({
                description: stop.name,
                placeId: `GTFS_${key}`,
                mainText: stop.name,
                secondaryText: 'Grand Périgueux',
                location: { lat: stop.lat, lng: stop.lng },
                source: 'gtfs',
                priority: stop.type === 'city' ? 1 : (stop.type === 'station' ? 2 : 3)
            });
        }
    }
    
    // Trier par priorité
    return results.sort((a, b) => a.priority - b.priority);
}

// Cache en mémoire
const cache = new Map();
const CACHE_TTL = 120000; // 2 minutes

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

            // 1. D'abord chercher dans les arrêts GTFS locaux
            const gtfsResults = searchGtfsStops(input);
            
            // 2. Ensuite chercher via Google avec restriction géographique stricte
            let googleResults = [];
            
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
                    // Restriction stricte au Grand Périgueux
                    locationRestriction: {
                        rectangle: {
                            low: { latitude: GRAND_PERIGUEUX_BOUNDS.south, longitude: GRAND_PERIGUEUX_BOUNDS.west },
                            high: { latitude: GRAND_PERIGUEUX_BOUNDS.north, longitude: GRAND_PERIGUEUX_BOUNDS.east }
                        }
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                googleResults = (data.suggestions || [])
                    .map(s => {
                        const place = s.placePrediction;
                        return {
                            description: place?.text?.text,
                            placeId: place?.placeId,
                            mainText: place?.structuredFormat?.mainText?.text,
                            secondaryText: place?.structuredFormat?.secondaryText?.text,
                            source: 'google'
                        };
                    })
                    // Filtrer les résultats hors zone (double sécurité)
                    .filter(r => {
                        const text = (r.secondaryText || '').toLowerCase();
                        // Garder seulement Dordogne / Nouvelle-Aquitaine / France
                        return text.includes('périgueux') || 
                               text.includes('perigueux') ||
                               text.includes('dordogne') ||
                               text.includes('boulazac') ||
                               text.includes('trélissac') ||
                               text.includes('trelissac') ||
                               text.includes('chancelade') ||
                               text.includes('coulounieix') ||
                               text.includes('marsac') ||
                               text.includes('bassillac') ||
                               text.includes('24000') ||
                               text.includes('24750') ||
                               text.includes('24430') ||
                               text.includes('24660');
                    });
            }

            // 3. Fusionner: GTFS en premier, puis Google (sans doublons)
            const seenNames = new Set();
            const predictions = [];
            
            // Ajouter les résultats GTFS en priorité
            for (const r of gtfsResults.slice(0, 3)) {
                const key = r.mainText.toLowerCase();
                if (!seenNames.has(key)) {
                    seenNames.add(key);
                    predictions.push(r);
                }
            }
            
            // Ajouter les résultats Google
            for (const r of googleResults) {
                const key = (r.mainText || r.description || '').toLowerCase();
                // Éviter les doublons avec les arrêts GTFS
                if (!seenNames.has(key) && predictions.length < 8) {
                    seenNames.add(key);
                    predictions.push(r);
                }
            }

            const responseBody = JSON.stringify({ predictions });
            
            cache.set(cacheKey, { data: responseBody, time: Date.now() });
            if (cache.size > 100) {
                const oldest = [...cache.entries()].sort((a, b) => a[1].time - b[1].time)[0];
                if (oldest) cache.delete(oldest[0]);
            }

            return new Response(responseBody, { 
                status: 200, 
                headers: { 
                    ...corsHeaders, 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, s-maxage=120',
                    'X-Cache': 'MISS'
                } 
            });
        }

        // Mode 2: Détails d'un lieu (coordonnées)
        if (placeId) {
            // Si c'est un arrêt GTFS local
            if (placeId.startsWith('GTFS_')) {
                const key = placeId.replace('GTFS_', '');
                const stop = GTFS_STOPS[key];
                if (stop) {
                    return new Response(JSON.stringify({
                        placeId,
                        name: stop.name,
                        location: { lat: stop.lat, lng: stop.lng },
                        source: 'gtfs'
                    }), { 
                        status: 200, 
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                    });
                }
            }

            // Sinon, chercher via Google
            const cacheKey = `pd:${placeId}`;
            const cached = cache.get(cacheKey);
            if (cached && Date.now() - cached.time < 86400000) {
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
            
            // Vérifier que le lieu est dans le Grand Périgueux
            if (data.location && !isInGrandPerigueux(data.location.latitude, data.location.longitude)) {
                return new Response(
                    JSON.stringify({ error: 'Lieu hors zone Grand Périgueux' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

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


