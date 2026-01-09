/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * indexer.js
 * Indexation des lieux pour l'autocomplétion
 * 
 * ?? STATUT: DÉSACTIVÉ - Code préparé pour le futur
 * 
 * Ce module gère l'indexation de différentes sources de lieux:
 * - Arrêts de bus (GTFS)
 * - Points d'intérêt (POI) locaux
 * - Adresses (optionnel, avec Nominatim)
 */

import { Trie } from './trie.js';
import { FuzzySearcher, normalizeText } from './fuzzy.js';

/**
 * @typedef {Object} Place
 * @property {string} id - Identifiant unique
 * @property {string} type - Type de lieu (stop, poi, address)
 * @property {string} name - Nom du lieu
 * @property {number} lat - Latitude
 * @property {number} lon - Longitude
 * @property {Object} [metadata] - Données supplémentaires
 */

/**
 * Catégories de POI prédéfinies
 */
export const POI_CATEGORIES = {
  transport: ['gare', 'aéroport', 'parking', 'station'],
  education: ['école', 'collège', 'lycée', 'université', 'campus'],
  sante: ['hôpital', 'clinique', 'pharmacie', 'médecin'],
  commerce: ['supermarché', 'centre commercial', 'marché'],
  loisirs: ['cinéma', 'théâtre', 'musée', 'parc', 'piscine', 'stade'],
  administration: ['mairie', 'préfecture', 'poste', 'tribunal'],
  tourisme: ['cathédrale', 'château', 'monument', 'office de tourisme'],
};

/**
 * Indexeur de lieux
 */
export class PlacesIndexer {
  constructor() {
    // Index Trie pour la recherche par préfixe
    this.trie = new Trie();
    
    // Recherche floue pour les fautes de frappe
    this.fuzzySearcher = new FuzzySearcher([], {
      keys: ['name', 'metadata.alias'],
      threshold: 0.5,
      limit: 20,
    });

    // Tous les lieux indexés
    this.places = new Map(); // id -> Place

    // Index géographique simple (grille)
    this.geoIndex = new Map(); // "lat,lon" (arrondi) -> Place[]

    // Statistiques
    this.stats = {
      stops: 0,
      pois: 0,
      addresses: 0,
      total: 0,
    };
  }

  /**
   * Indexe les arrêts de bus depuis les données GTFS
   * 
   * @param {Array} stops - Tableau des arrêts GTFS
   */
  indexStops(stops) {
    console.log(`?? Indexation de ${stops.length} arrêts...`);

    for (const stop of stops) {
      // Ignorer les arrêts sans coordonnées
      if (!stop.stop_lat || !stop.stop_lon) continue;

      const place = {
        id: `stop_${stop.stop_id}`,
        type: 'stop',
        name: stop.stop_name || 'Arrêt sans nom',
        lat: parseFloat(stop.stop_lat),
        lon: parseFloat(stop.stop_lon),
        metadata: {
          stopId: stop.stop_id,
          stopCode: stop.stop_code,
          wheelchairBoarding: stop.wheelchair_boarding === '1',
          locationType: stop.location_type,
        },
      };

      this.addPlace(place);
      this.stats.stops++;
    }

    console.log(`? ${this.stats.stops} arrêts indexés`);
  }

  /**
   * Indexe des points d'intérêt personnalisés
   * 
   * @param {Array} pois - Tableau de POI
   */
  indexPOIs(pois) {
    console.log(`??? Indexation de ${pois.length} POI...`);

    for (const poi of pois) {
      const place = {
        id: `poi_${poi.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'poi',
        name: poi.name,
        lat: parseFloat(poi.lat),
        lon: parseFloat(poi.lon),
        metadata: {
          category: poi.category,
          alias: poi.alias || [],
          address: poi.address,
          phone: poi.phone,
          website: poi.website,
          openingHours: poi.openingHours,
        },
      };

      this.addPlace(place);
      this.stats.pois++;
    }

    console.log(`? ${this.stats.pois} POI indexés`);
  }

  /**
   * Ajoute les POI par défaut de Périgueux
   */
  addDefaultPOIs() {
    const defaultPOIs = [
      // Transport
      { name: 'Gare de Périgueux', lat: 45.1856, lon: 0.7208, category: 'transport', alias: ['gare sncf', 'train'] },
      
      // Administration
      { name: 'Mairie de Périgueux', lat: 45.1840, lon: 0.7218, category: 'administration', alias: ['hotel de ville'] },
      { name: 'Préfecture de la Dordogne', lat: 45.1830, lon: 0.7195, category: 'administration' },
      
      // Santé
      { name: 'Centre Hospitalier de Périgueux', lat: 45.1920, lon: 0.7380, category: 'sante', alias: ['hopital', 'chu'] },
      
      // Éducation
      { name: 'Université de Périgueux', lat: 45.1750, lon: 0.7300, category: 'education', alias: ['fac', 'campus'] },
      { name: 'Lycée Bertran de Born', lat: 45.1880, lon: 0.7160, category: 'education' },
      
      // Commerce
      { name: 'Centre Commercial Auchan Boulazac', lat: 45.1750, lon: 0.7520, category: 'commerce', alias: ['auchan'] },
      { name: 'Centre Commercial Marsac', lat: 45.2050, lon: 0.6800, category: 'commerce' },
      
      // Tourisme
      { name: 'Cathédrale Saint-Front', lat: 45.1843, lon: 0.7226, category: 'tourisme', alias: ['cathedrale'] },
      { name: 'Musée d\'Art et d\'Archéologie', lat: 45.1835, lon: 0.7215, category: 'tourisme', alias: ['musee vesunna'] },
      { name: 'Tour Mataguerre', lat: 45.1850, lon: 0.7180, category: 'tourisme' },
      
      // Loisirs
      { name: 'Stade Francis Rongiéras', lat: 45.1950, lon: 0.6950, category: 'loisirs', alias: ['stade csbj'] },
      { name: 'Piscine Municipale', lat: 45.1900, lon: 0.7100, category: 'loisirs' },
      { name: 'Parc Gamenson', lat: 45.1780, lon: 0.7250, category: 'loisirs' },
    ];

    this.indexPOIs(defaultPOIs);
  }

  /**
   * Ajoute un lieu à tous les index
   * 
   * @param {Place} place
   */
  addPlace(place) {
    // Stocker le lieu
    this.places.set(place.id, place);

    // Index Trie
    this.trie.insertWithVariants(place.name, place);
    
    // Aliases si présents
    if (place.metadata?.alias) {
      const aliases = Array.isArray(place.metadata.alias) 
        ? place.metadata.alias 
        : [place.metadata.alias];
      
      aliases.forEach(alias => {
        this.trie.insert(alias, place);
      });
    }

    // Index géographique
    const geoKey = this.getGeoKey(place.lat, place.lon);
    if (!this.geoIndex.has(geoKey)) {
      this.geoIndex.set(geoKey, []);
    }
    this.geoIndex.get(geoKey).push(place);

    this.stats.total++;
  }

  /**
   * Génère une clé géographique pour l'index spatial
   * (grille de ~100m de côté à cette latitude)
   */
  getGeoKey(lat, lon, precision = 3) {
    const roundedLat = lat.toFixed(precision);
    const roundedLon = lon.toFixed(precision);
    return `${roundedLat},${roundedLon}`;
  }

  /**
   * Recherche les lieux proches d'un point
   * 
   * @param {number} lat
   * @param {number} lon
   * @param {number} radiusMeters - Rayon de recherche
   * @returns {Array<{place: Place, distance: number}>}
   */
  findNearby(lat, lon, radiusMeters = 500) {
    const results = [];
    const radiusDegrees = radiusMeters / 111000; // Approximation

    // Chercher dans les cellules voisines
    for (let dLat = -radiusDegrees; dLat <= radiusDegrees; dLat += 0.001) {
      for (let dLon = -radiusDegrees; dLon <= radiusDegrees; dLon += 0.001) {
        const key = this.getGeoKey(lat + dLat, lon + dLon);
        const places = this.geoIndex.get(key) || [];
        
        for (const place of places) {
          const distance = this.haversineDistance(lat, lon, place.lat, place.lon);
          if (distance <= radiusMeters) {
            results.push({ place, distance: Math.round(distance) });
          }
        }
      }
    }

    // Trier par distance
    results.sort((a, b) => a.distance - b.distance);
    
    // Dédupliquer
    const seen = new Set();
    return results.filter(r => {
      if (seen.has(r.place.id)) return false;
      seen.add(r.place.id);
      return true;
    });
  }

  /**
   * Reconstruit l'index de recherche floue
   * (à appeler après avoir ajouté tous les lieux)
   */
  rebuildFuzzyIndex() {
    const allPlaces = Array.from(this.places.values());
    this.fuzzySearcher.setItems(allPlaces);
    console.log(`?? Index de recherche floue reconstruit (${allPlaces.length} lieux)`);
  }

  /**
   * Calcule la distance Haversine
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const f1 = (lat1 * Math.PI) / 180;
    const f2 = (lat2 * Math.PI) / 180;
    const ?f = ((lat2 - lat1) * Math.PI) / 180;
    const ?? = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(?f / 2) * Math.sin(?f / 2) +
      Math.cos(f1) * Math.cos(f2) * Math.sin(?? / 2) * Math.sin(?? / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Affiche les statistiques d'indexation
   */
  logStats() {
    console.log('?? Statistiques d\'indexation:');
    console.log(`   - Arrêts: ${this.stats.stops}`);
    console.log(`   - POI: ${this.stats.pois}`);
    console.log(`   - Adresses: ${this.stats.addresses}`);
    console.log(`   - Total: ${this.stats.total}`);
    console.log(`   - Trie: ${this.trie.size()} entrées`);
    console.log(`   - Cellules géo: ${this.geoIndex.size}`);
  }

  /**
   * Exporte les données pour le cache
   */
  export() {
    return {
      places: Array.from(this.places.values()),
      stats: this.stats,
      exportDate: new Date().toISOString(),
    };
  }

  /**
   * Importe les données depuis le cache
   */
  import(data) {
    this.places.clear();
    this.trie.clear();
    this.geoIndex.clear();
    this.stats = { stops: 0, pois: 0, addresses: 0, total: 0 };

    for (const place of data.places) {
      this.addPlace(place);
      
      // Mettre à jour les stats par type
      if (place.type === 'stop') this.stats.stops++;
      else if (place.type === 'poi') this.stats.pois++;
      else if (place.type === 'address') this.stats.addresses++;
    }

    this.rebuildFuzzyIndex();
  }
}

export default PlacesIndexer;


