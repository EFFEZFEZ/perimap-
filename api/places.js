/**
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * API Places - Autocomplétion avec hiérarchie intelligente
 * 
 * V328: Suppression des POI inventés - utilise uniquement:
 * - Communes (coordonnées mairies vérifiées)
 * - Google Places (pour les commerces et POI réels)
 * 
 * Priorité : Communes > Google Places
 * 
 * NOTE: Les arrêts GTFS sont gérés côté client via dataManager
 */

export const config = {
  runtime: 'edge',
  regions: ['cdg1'],
};

// ===========================================
// Cache pour les résultats Google Places
// ===========================================
const placesCache = new Map();
const PLACES_CACHE_MAX_SIZE = 200;
const PLACES_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanPlacesCache() {
  const now = Date.now();
  for (const [key, entry] of placesCache.entries()) {
    if (now - entry.timestamp > PLACES_CACHE_TTL_MS) {
      placesCache.delete(key);
    }
  }
  if (placesCache.size > PLACES_CACHE_MAX_SIZE) {
    const entries = [...placesCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, placesCache.size - PLACES_CACHE_MAX_SIZE);
    toDelete.forEach(([key]) => placesCache.delete(key));
  }
}

// ===========================================
// COMMUNES du Grand Périgueux
// Coordonnées = centre-ville/mairie (source: data.gouv.fr)
// ===========================================
const LOCAL_COMMUNES = {
  // Centre urbain
  'perigueux': { name: 'Périgueux', lat: 45.1846, lng: 0.7214 },
  'périgueux': { name: 'Périgueux', lat: 45.1846, lng: 0.7214 },
  
  // Communes limitrophes principales
  'boulazac': { name: 'Boulazac Isle Manoire', lat: 45.1789, lng: 0.7534 },
  'isle manoire': { name: 'Boulazac Isle Manoire', lat: 45.1789, lng: 0.7534 },
  'trelissac': { name: 'Trélissac', lat: 45.1912, lng: 0.7656 },
  'trélissac': { name: 'Trélissac', lat: 45.1912, lng: 0.7656 },
  'coulounieix': { name: 'Coulounieix-Chamiers', lat: 45.1756, lng: 0.6889 },
  'chamiers': { name: 'Coulounieix-Chamiers', lat: 45.1756, lng: 0.6889 },
  'coulounieix chamiers': { name: 'Coulounieix-Chamiers', lat: 45.1756, lng: 0.6889 },
  'coulounieix-chamiers': { name: 'Coulounieix-Chamiers', lat: 45.1756, lng: 0.6889 },
  'chancelade': { name: 'Chancelade', lat: 45.2056, lng: 0.6734 },
  'marsac': { name: 'Marsac-sur-l\'Isle', lat: 45.1923, lng: 0.6456 },
  'marsac sur l isle': { name: 'Marsac-sur-l\'Isle', lat: 45.1923, lng: 0.6456 },
  
  // Communes périphériques
  'notre dame de sanilhac': { name: 'Notre-Dame-de-Sanilhac', lat: 45.1423, lng: 0.7312 },
  'sanilhac': { name: 'Notre-Dame-de-Sanilhac', lat: 45.1423, lng: 0.7312 },
  'razac': { name: 'Razac-sur-l\'Isle', lat: 45.1734, lng: 0.6123 },
  'razac sur l isle': { name: 'Razac-sur-l\'Isle', lat: 45.1734, lng: 0.6123 },
  'bassillac': { name: 'Bassillac et Auberoche', lat: 45.1534, lng: 0.8012 },
  'auberoche': { name: 'Bassillac et Auberoche', lat: 45.1534, lng: 0.8012 },
  'antonne': { name: 'Antonne-et-Trigonant', lat: 45.2078, lng: 0.7789 },
  'trigonant': { name: 'Antonne-et-Trigonant', lat: 45.2078, lng: 0.7789 },
  'atur': { name: 'Atur', lat: 45.1456, lng: 0.7612 },
  'saint laurent sur manoire': { name: 'Saint-Laurent-sur-Manoire', lat: 45.1534, lng: 0.7923 },
  'escoire': { name: 'Escoire', lat: 45.2234, lng: 0.8012 },
  'la chapelle gonaguet': { name: 'La Chapelle-Gonaguet', lat: 45.2312, lng: 0.6523 },
  'chateau l eveque': { name: 'Château-l\'Évêque', lat: 45.2234, lng: 0.7112 },
  'château l évêque': { name: 'Château-l\'Évêque', lat: 45.2234, lng: 0.7112 },
  'cornille': { name: 'Cornille', lat: 45.2156, lng: 0.8123 },
  'eyliac': { name: 'Eyliac', lat: 45.1312, lng: 0.7723 },
  'saint astier': { name: 'Saint-Astier', lat: 45.1456, lng: 0.5312 },
};

// ===========================================
// Zones géographiques (Grand Périgueux + Dordogne)
// ===========================================
const GRAND_PERIGUEUX_BOUNDS = {
  south: 45.10,
  west: 0.50,
  north: 45.28,
  east: 0.90
};

const DORDOGNE_BOUNDS = {
  south: 44.69,
  west: 0.01,
  north: 45.68,
  east: 1.54
};

const CENTER = { lat: 45.1846, lng: 0.7214 };

// ===========================================
// Fonctions utilitaires
// ===========================================

function normalize(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchLocal(query, dictionary, maxResults = 5) {
  const normalizedQuery = normalize(query);
  const results = [];
  const seenNames = new Set();
  
  // Recherche exacte
  for (const [key, data] of Object.entries(dictionary)) {
    const normalizedKey = normalize(key);
    if (normalizedKey === normalizedQuery) {
      const uniqueName = normalize(data.name);
      if (!seenNames.has(uniqueName)) {
        seenNames.add(uniqueName);
        results.push({ ...data, score: 100 });
      }
    }
  }
  
  // Recherche partielle (commence par)
  for (const [key, data] of Object.entries(dictionary)) {
    const normalizedKey = normalize(key);
    const uniqueName = normalize(data.name);
    
    if (!seenNames.has(uniqueName)) {
      if (normalizedKey.startsWith(normalizedQuery)) {
        seenNames.add(uniqueName);
        results.push({ ...data, score: 90 });
      } else if (normalizedQuery.startsWith(normalizedKey) && normalizedKey.length >= 3) {
        seenNames.add(uniqueName);
        results.push({ ...data, score: 85 });
      }
    }
  }
  
  // Recherche contient
  for (const [key, data] of Object.entries(dictionary)) {
    const normalizedKey = normalize(key);
    const normalizedName = normalize(data.name);
    const uniqueName = normalize(data.name);
    
    if (!seenNames.has(uniqueName)) {
      if (normalizedKey.includes(normalizedQuery) || normalizedName.includes(normalizedQuery)) {
        seenNames.add(uniqueName);
        results.push({ ...data, score: 70 });
      }
    }
  }
  
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

function formatResult(item, type, index) {
  let icon, subtitle;
  
  switch (type) {
    case 'commune':
      icon = '🏘️';
      subtitle = 'Commune du Grand Périgueux';
      break;
    case 'google':
      icon = '📍';
      subtitle = item.formattedAddress || '';
      break;
    default:
      icon = '📍';
      subtitle = '';
  }
  
  const displayName = `${icon} ${item.name}`;
  const description = subtitle ? `${displayName}, ${subtitle}` : displayName;
  
  return {
    description: description,
    place_id: type === 'google' ? item.placeId : `local_${type}_${index}`,
    placeId: type === 'google' ? item.placeId : `local_${type}_${index}`,
    main_text: item.name,
    secondary_text: subtitle,
    coordinates: { lat: item.lat, lng: item.lng },
    source: type === 'google' ? 'google' : 'local',
    type: type
  };
}

// ===========================================
// Handler principal
// ===========================================

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const url = new URL(req.url);
  let input = url.searchParams.get('input')?.trim();

  // V490: Support POST requests with JSON body (AutocompleteService sends POST)
  if (!input && req.method === 'POST') {
    try {
      const body = await req.json();
      input = body.input?.trim();
    } catch (e) {
      console.error('[Places] Error parsing POST body:', e.message);
    }
  }

  if (!input || input.length < 2) {
    return new Response(JSON.stringify({ predictions: [] }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  }

  const results = [];
  const seenNames = new Set();

  // ========================================
  // 1. PRIORITÉ 1 : Communes (données fiables)
  // ========================================
  const communes = searchLocal(input, LOCAL_COMMUNES, 3);
  for (let i = 0; i < communes.length; i++) {
    const item = communes[i];
    const normalizedName = normalize(item.name);
    if (!seenNames.has(normalizedName)) {
      seenNames.add(normalizedName);
      results.push(formatResult(item, 'commune', i));
    }
  }

  // ========================================
  // 2. PRIORITÉ 2 : Google Places (données réelles)
  // Cherche toujours pour avoir des POI fiables
  // ========================================
  const googleNeeded = Math.max(2, 5 - results.length);
  
  cleanPlacesCache();
  
  const cacheKey = normalize(input);
  const cachedGoogle = placesCache.get(cacheKey);
  
  if (cachedGoogle && (Date.now() - cachedGoogle.timestamp < PLACES_CACHE_TTL_MS)) {
    console.log(`[Places] ✅ Cache HIT: "${input}"`);
    for (const item of cachedGoogle.data.slice(0, googleNeeded)) {
      if (!seenNames.has(normalize(item.name))) {
        seenNames.add(normalize(item.name));
        results.push(item);
      }
    }
  } else {
    try {
      const apiKey = process.env.GMAPS_SERVER_KEY;
      if (!apiKey) throw new Error('API key missing');

      const requestBody = {
        input: input,
        languageCode: 'fr',
        regionCode: 'FR',
        includeQueryPredictions: true,
        locationRestriction: {
          rectangle: {
            low: { latitude: DORDOGNE_BOUNDS.south, longitude: DORDOGNE_BOUNDS.west },
            high: { latitude: DORDOGNE_BOUNDS.north, longitude: DORDOGNE_BOUNDS.east }
          }
        }
      };

      const response = await fetch(
        'https://places.googleapis.com/v1/places:autocomplete',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const suggestions = data.suggestions || [];
        const queryPredictionTexts = [];
        
        let googleCount = 0;
        const googleResults = [];
        
        for (const suggestion of suggestions) {
          if (googleCount >= googleNeeded) break;
          
          const queryPrediction = suggestion.queryPrediction;
          if (queryPrediction?.text?.text) {
            queryPredictionTexts.push(queryPrediction.text.text);
          }

          const place = suggestion.placePrediction;
          if (!place) continue;
          
          const placeId = place.placeId;
          
          // Récupérer les détails
          const detailsResponse = await fetch(
            `https://places.googleapis.com/v1/places/${placeId}?languageCode=fr`,
            {
              headers: {
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'id,displayName,formattedAddress,location'
              }
            }
          );
          
          if (detailsResponse.ok) {
            const details = await detailsResponse.json();
            const name = details.displayName?.text || '';
            const normalizedName = normalize(name);
            
            if (!seenNames.has(normalizedName) && name) {
              seenNames.add(normalizedName);
              const location = details.location || { latitude: CENTER.lat, longitude: CENTER.lng };
              const item = {
                description: `📍 ${name}, ${details.formattedAddress || ''}`,
                place_id: placeId,
                placeId: placeId,
                main_text: name,
                secondary_text: details.formattedAddress || '',
                coordinates: { lat: location.latitude, lng: location.longitude },
                source: 'google',
                type: 'google',
                name: name,
                formattedAddress: details.formattedAddress
              };
              results.push(item);
              googleResults.push(item);
              googleCount++;
            }
          }
        }
        
        if (googleResults.length === 0) {
          try {
            const searchCandidates = queryPredictionTexts.length
              ? [...new Set(queryPredictionTexts)]
              : [input];

            let textSearchFilled = false;
            for (const candidate of searchCandidates) {
              if (textSearchFilled || googleCount >= googleNeeded) break;
            const textSearchResponse = await fetch(
              'https://places.googleapis.com/v1/places:searchText',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': apiKey,
                  'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
                },
                body: JSON.stringify({
                  textQuery: candidate,
                  languageCode: 'fr',
                  regionCode: 'FR',
                  locationRestriction: {
                    rectangle: {
                      low: { latitude: DORDOGNE_BOUNDS.south, longitude: DORDOGNE_BOUNDS.west },
                      high: { latitude: DORDOGNE_BOUNDS.north, longitude: DORDOGNE_BOUNDS.east }
                    }
                  },
                  pageSize: googleNeeded
                })
              }
            );

            if (textSearchResponse.ok) {
              const textData = await textSearchResponse.json();
              const places = textData.places || [];

              for (const place of places) {
                if (googleCount >= googleNeeded) break;
                const name = place.displayName?.text || '';
                const normalizedName = normalize(name);
                if (!name || seenNames.has(normalizedName)) continue;
                const location = place.location || { latitude: CENTER.lat, longitude: CENTER.lng };
                const item = {
                  description: `📍 ${name}, ${place.formattedAddress || ''}`,
                  place_id: place.id,
                  placeId: place.id,
                  main_text: name,
                  secondary_text: place.formattedAddress || '',
                  coordinates: { lat: location.latitude, lng: location.longitude },
                  source: 'google-text',
                  type: 'google',
                  name: name,
                  formattedAddress: place.formattedAddress
                };
                results.push(item);
                googleResults.push(item);
                googleCount++;
                seenNames.add(normalizedName);
              }
              if (googleCount > 0) {
                textSearchFilled = true;
              }
            }
          } catch (textError) {
            console.error('Google Text Search error:', textError.message);
          }
        }

        if (googleResults.length > 0) {
          placesCache.set(cacheKey, {
            data: googleResults,
            timestamp: Date.now()
          });
          console.log(`[Places] 📦 Cache STORE: "${input}" (${googleResults.length} results)`);
        }
      }
    } catch (error) {
      console.error('Google Places error:', error.message);
    }
  }

  return new Response(JSON.stringify({ 
    predictions: results.slice(0, 5)
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
