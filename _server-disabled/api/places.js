// Copyright © 2025 Périmap - Tous droits réservés
/**
 * api/places.js
 * Recherche de lieux: Photon (si disponible) ou fallback GTFS local
 */

import { Router } from 'express';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createLogger } from '../utils/logger.js';
import { autocomplete as smartAutocomplete, loadAutocompleteCache } from '../utils/autocompleteProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();
const logger = createLogger('places-api');

// Utiliser Photon public par défaut (komoot.io) - fonctionne partout
const PHOTON_BASE_URL = process.env.PHOTON_BASE_URL || 'https://photon.komoot.io';

// Limites géographiques de la Dordogne (département 24)
const DORDOGNE_BOUNDS = {
  south: 44.69,   // Sud de la Dordogne
  north: 45.68,   // Nord de la Dordogne
  west: 0.01,     // Ouest de la Dordogne
  east: 1.54      // Est de la Dordogne
};

// Centre de Grand Périgueux (biais pour les recherches)
const GRAND_PERIGUEUX_CENTER = {
  lat: 45.1839,
  lon: 0.7212
};

// Initialiser le cache des suggestions au démarrage
await loadAutocompleteCache();

// Fonction partagée pour l'autocomplétion
async function handleAutocomplete(req, res) {
  // Support pour ?input= (frontend) et ?q= (standard)
  const q = req.query.q || req.query.input;
  const { lat, lon, limit = 10 } = req.query;

  if (!q || q.length < 1) {
    return res.status(400).json({ error: 'Requête trop courte (min 1 caractère)' });
  }

  try {
    const searchLat = lat ? Number(lat) : GRAND_PERIGUEUX_CENTER.lat;
    const searchLon = lon ? Number(lon) : GRAND_PERIGUEUX_CENTER.lon;
    const maxLimit = Number(limit);

    // === 1. Récupérer les résultats Photon (villes, rues, lieux) ===
    let photonResults = [];
    try {
      const params = new URLSearchParams({ 
        q, 
        limit: '15',  // On demande plus pour filtrer ensuite
        lat: String(searchLat),
        lon: String(searchLon)
      });

      const url = `${PHOTON_BASE_URL}/api?${params.toString()}`;
      const response = await Promise.race([
        fetch(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      
      if (response.ok) {
        const data = await response.json();
        photonResults = (data.features || [])
          .filter(f => {
            const lat = f.geometry.coordinates[1];
            const lon = f.geometry.coordinates[0];
            // Filtre géographique Dordogne
            return lat >= DORDOGNE_BOUNDS.south && lat <= DORDOGNE_BOUNDS.north &&
                   lon >= DORDOGNE_BOUNDS.west && lon <= DORDOGNE_BOUNDS.east;
          })
          .map(f => {
            const props = f.properties;
            const type = props.type || props.osm_value || 'place';
            
            // Construire une description lisible
            let description = props.name || '';
            if (props.street && !description.includes(props.street)) {
              description = description ? `${description}, ${props.street}` : props.street;
            }
            if (props.housenumber && props.street) {
              description = `${props.housenumber} ${props.street}`;
              if (props.name && props.name !== props.street) {
                description = `${props.name}, ${description}`;
              }
            }
            
            return {
              lat: f.geometry.coordinates[1],
              lon: f.geometry.coordinates[0],
              description: description || 'Lieu',
              city: props.city || props.locality || '',
              type: type,
              priority: getCategoryPriority(type),
              source: 'photon'
            };
          });
      }
    } catch (err) {
      logger.debug(`[places] Photon: ${err.message}`);
    }

    // === 2. Récupérer les arrêts de bus GTFS ===
    const gtfsResults = await smartAutocomplete(q, { 
      limit: 15,
      lat: searchLat,
      lon: searchLon
    });

    // === 3. Fusionner et trier intelligemment ===
    const allResults = [...photonResults, ...gtfsResults];
    
    // Dédupliquer par proximité géographique + nom similaire
    const deduplicated = deduplicateResults(allResults);
    
    // Trier par priorité (villes > POIs > adresses > arrêts) puis par pertinence
    deduplicated.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      // À priorité égale, préférer les correspondances exactes
      const aExact = a.description.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1;
      const bExact = b.description.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1;
      return aExact - bExact;
    });

    // Retourner les meilleurs résultats
    const finalResults = deduplicated.slice(0, maxLimit).map(r => ({
      lat: r.lat,
      lon: r.lon,
      description: r.description,
      city: r.city || '',
      type: r.type,
      source: r.source
    }));

    res.json({ suggestions: finalResults });
    
  } catch (error) {
    logger.error('[places] autocomplete error', error);
    res.json({ suggestions: [] });
  }
}

// Route principale: /api/places?input=... (compatibilité frontend)
router.get('/', handleAutocomplete);

// Route standard: /api/places/autocomplete?q=...
router.get('/autocomplete', handleAutocomplete);

/**
 * Détermine la priorité d'affichage selon le type
 * 1 = POIs / Lieux importants (Écoles, Admin...)
 * 2 = Arrêts de transport
 * 3 = Adresses / Rues
 * 4 = Villes (Moins précis)
 */
function getCategoryPriority(type) {
  const t = (type || '').toLowerCase();
  
  // 1. POIs et lieux importants (Écoles, Services publics, Commerces...)
  if (['amenity', 'shop', 'leisure', 'tourism', 'historic', 'building', 'school', 'college', 'university', 'hall', 'hospital', 'public', 'office', 'work'].includes(t)) {
    return 1;
  }

  // 2. Arrêts de transport (GTFS)
  if (['stop', 'transport', 'bus_stop', 'station'].includes(t)) {
    return 2;
  }
  
  // 3. Adresses et rues
  if (['street', 'road', 'way', 'house', 'residential', 'address', 'highway'].includes(t)) {
    return 3;
  }

  // 4. Villes et localités (En dernier car souvent trop vague)
  if (['city', 'town', 'village', 'hamlet', 'borough', 'suburb', 'municipality', 'administrative'].includes(t)) {
    return 4;
  }
  
  return 3; // Par défaut
}

/**
 * Déduplique les résultats par proximité géographique et similarité de nom
 */
function deduplicateResults(results) {
  const dominated = new Set();
  const deduplicated = [];
  
  for (let i = 0; i < results.length; i++) {
    if (dominated.has(i)) continue;
    
    const current = results[i];
    let dominated_by_current = false;
    
    for (let j = i + 1; j < results.length; j++) {
      if (dominated.has(j)) continue;
      
      const other = results[j];
      const distance = haversineDistanceMeters(current.lat, current.lon, other.lat, other.lon);
      const nameSimilarity = calculateNameSimilarity(current.description, other.description);
      
      // Si très proches géographiquement ET noms similaires → doublon
      if (distance < 100 && nameSimilarity > 0.7) {
        // Garder celui avec la meilleure priorité
        if (current.priority <= other.priority) {
          dominated.add(j);
        } else {
          dominated.add(i);
          dominated_by_current = true;
          break;
        }
      }
      // Si même nom exact mais positions différentes → garder les deux (arrêts différents)
    }
    
    if (!dominated_by_current) {
      deduplicated.push(current);
    }
  }
  
  return deduplicated;
}

/**
 * Calcule la similarité entre deux noms (0-1)
 */
function calculateNameSimilarity(name1, name2) {
  const n1 = (name1 || '').toLowerCase().trim();
  const n2 = (name2 || '').toLowerCase().trim();
  
  if (n1 === n2) return 1.0;
  if (n1.includes(n2) || n2.includes(n1)) return 0.9;
  
  // Jaccard sur les mots
  const words1 = new Set(n1.split(/[\s\-_,]+/).filter(w => w.length > 2));
  const words2 = new Set(n2.split(/[\s\-_,]+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  
  return intersection / union;
}

/**
 * Trie les suggestions par catégorie (hiérarchie logique)
 * 1. Villes
 * 2. Noms de lieux / enseignes (POIs)
 * 3. Adresses (rues, bâtiments)
 * 4. Autres
 */
function sortByCategory(suggestions) {
  const cities = [];
  const pois = [];
  const addresses = [];
  const other = [];

  suggestions.forEach(s => {
    const t = (s.type || '').toLowerCase();
    
    // Catégorie 1: Villes et localités
    if (['city', 'town', 'village', 'hamlet', 'borough', 'suburb'].includes(t)) {
      cities.push(s);
    }
    // Catégorie 2: POIs et enseignes
    else if (['amenity', 'shop', 'leisure', 'tourism', 'historic', 'building', 'public_transport'].includes(t)) {
      pois.push(s);
    }
    // Catégorie 3: Adresses et rues
    else if (['street', 'road', 'way', 'house', 'residential'].includes(t)) {
      addresses.push(s);
    }
    // Catégorie 4: Autres
    else {
      other.push(s);
    }
  });

  // Retourner dans l'ordre de priorité
  return [...cities, ...pois, ...addresses, ...other];
}

/**
 * Recherche floue simple dans les arrêts locaux
 */
function fuzzySearchStops(query, limit = 8) {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  
  const scored = stopsCache
    .map(stop => ({
      ...stop,
      score: fuzzyScore(q, stop.name.toLowerCase())
    }))
    .filter(s => s.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  return scored.map(s => ({
    lat: s.lat,
    lon: s.lon,
    description: s.name,
    city: 'Périgueux',
    type: 'stop'
  }));
}

router.get('/reverse', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat et lon requis' });
  }
  try {
    const params = new URLSearchParams({ lat, lon, limit: '1' });
    const url = `${PHOTON_BASE_URL}/reverse?${params.toString()}`;
    try {
      const response = await Promise.race([
        fetch(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      
      if (response.ok) {
        const data = await response.json();
        const feature = data.features?.[0];
        if (feature) {
          return res.json({ 
            place: {
              lat: feature.geometry.coordinates[1],
              lon: feature.geometry.coordinates[0],
              description: feature.properties.name || 'Localisation',
              city: feature.properties.city || ''
            }
          });
        }
      }
    } catch (err) {
      logger.debug(`[places] Photon reverse unavailable: ${err.message}`);
    }
    
    // Fallback: retourner le point de départ
    res.json({ 
      place: {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        description: 'Localisation',
        city: ''
      }
    });
  } catch (error) {
    logger.error('[places] reverse error', error);
    res.json({ place: { lat: parseFloat(lat), lon: parseFloat(lon), description: 'Localisation' } });
  }
});

function mapPhotonFeatureToSuggestion(feature) {
  return {
    lat: feature.geometry.coordinates[1],
    lon: feature.geometry.coordinates[0],
    description: feature.properties.name || '',
    city: feature.properties.city || ''
  };
}

// Haversine distance (meters)
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  function toRad(v) { return v * Math.PI / 180; }
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default router;
