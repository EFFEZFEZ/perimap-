// Copyright © 2025 Périmap - Tous droits réservés
/**
 * nativeRouterService.js
 * Service de calcul d'itinéraires natif utilisant l'algorithme RAPTOR
 * 
 * Remplace OTP pour le routage transit en utilisant les données GTFS statiques.
 * Avantages:
 * - Fonctionne sur serveur avec 1 Go de RAM
 * - Pas de dépendance externe (Java/OTP)
 * - Temps de réponse < 100ms
 * - Cache LRU pour requêtes répétées
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createLogger } from '../utils/logger.js';
import { PathfindingEngine } from '../core/pathfinding/index.js';
import { patchMissingTransfers } from '../utils/gtfsLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger('native-router');

// Instance unique du moteur
let routerEngine = null;
let isInitializing = false;
let initPromise = null;

// ═══════════════════════════════════════════════════════════════════════
// CACHE LRU POUR OPTIMISER LES REQUÊTES RÉPÉTÉES
// ═══════════════════════════════════════════════════════════════════════
const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 120000; // 2 minutes
const routeCache = new Map();

function getCacheKey(origin, destination, time, mode, maxWalkDistance, maxTransfers) {
  // Arrondir les coordonnées à 4 décimales (~11m de précision)
  const oLat = origin.lat.toFixed(4);
  const oLon = origin.lon.toFixed(4);
  const dLat = destination.lat.toFixed(4);
  const dLon = destination.lon.toFixed(4);
  // Arrondir le temps à 5 minutes
  const timeSlot = Math.floor(new Date(time).getTime() / 300000);
  // Inclure les contraintes utilisateurs pour éviter la pollution du cache
  const walk = Math.max(0, Math.round(maxWalkDistance || 0));
  const transfers = Number.isFinite(maxTransfers) ? Math.max(0, Math.round(maxTransfers)) : 0;
  return `${oLat},${oLon}|${dLat},${dLon}|${timeSlot}|${mode}|walk:${walk}|xfer:${transfers}`;
}

function getCachedResult(key) {
  const entry = routeCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    routeCache.delete(key);
    return null;
  }
  // LRU: déplacer à la fin
  routeCache.delete(key);
  routeCache.set(key, entry);
  return entry.value;
}

function setCachedResult(key, value) {
  // Éviction si trop plein
  if (routeCache.size >= CACHE_MAX_SIZE) {
    const firstKey = routeCache.keys().next().value;
    routeCache.delete(firstKey);
  }
  routeCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

/**
 * Charge les données GTFS depuis les fichiers CSV
 */
async function loadGtfsData() {
  const gtfsDir = findGtfsDirectory();
  
  if (!gtfsDir) {
    throw new Error('Répertoire GTFS non trouvé');
  }

  logger.info(`📂 Chargement GTFS depuis: ${gtfsDir}`);

  const gtfsData = {
    stops: [],
    routes: [],
    trips: [],
    stopTimes: [],
    calendar: [],
    calendarDates: [],
    shapes: []
  };

  // Fichiers à charger
  const files = [
    { name: 'stops.txt', key: 'stops' },
    { name: 'routes.txt', key: 'routes' },
    { name: 'trips.txt', key: 'trips' },
    { name: 'stop_times.txt', key: 'stopTimes' },
    { name: 'calendar.txt', key: 'calendar' },
    { name: 'calendar_dates.txt', key: 'calendarDates' },
    { name: 'shapes.txt', key: 'shapes' }
  ];

  for (const { name, key } of files) {
    const filePath = path.join(gtfsDir, name);
    if (fs.existsSync(filePath)) {
      const data = await parseCsvFile(filePath);
      gtfsData[key] = data;
      logger.info(`   ✓ ${name}: ${data.length} enregistrements`);
    } else {
      logger.warn(`   ⚠ ${name} non trouvé`);
    }
  }

  // Convertir les types numériques
  gtfsData.stops = gtfsData.stops.map(stop => ({
    ...stop,
    stop_lat: parseFloat(stop.stop_lat),
    stop_lon: parseFloat(stop.stop_lon)
  }));

  gtfsData.stopTimes = gtfsData.stopTimes.map(st => ({
    ...st,
    stop_sequence: parseInt(st.stop_sequence, 10),
    arrival_time: parseGtfsTime(st.arrival_time),
    departure_time: parseGtfsTime(st.departure_time)
  }));

  // Générer transfers.txt à la volée si absent pour débloquer les correspondances piétonnes
  patchMissingTransfers(gtfsData, 200);

  return gtfsData;
}

/**
 * Trouve le répertoire GTFS
 */
function findGtfsDirectory() {
  const candidates = [
    path.join(__dirname, '../data/gtfs'),           // Docker: /app/data/gtfs
    path.join(__dirname, '../../public/data/gtfs'),  // Local: server/../public/data/gtfs
    path.join(__dirname, '../public/data/gtfs'),     // Docker alt
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'stops.txt'))) {
      return candidate;
    }
  }

  return null;
}

/**
 * Parse un fichier CSV GTFS
 */
async function parseCsvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) return [];

  // Parser l'en-tête
  const headers = parseCSVLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;

    const record = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx];
    });
    records.push(record);
  }

  return records;
}

/**
 * Parse une ligne CSV (gère les guillemets)
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values;
}

/**
 * Parse une heure GTFS (HH:MM:SS) en secondes depuis minuit
 */
function parseGtfsTime(timeStr) {
  if (!timeStr) return 0;
  const [h, m, s] = timeStr.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
}

/**
 * Formate des secondes en HH:MM:SS
 */
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Initialise le moteur de routage
 */
export async function initializeRouter() {
  if (routerEngine?.isReady) {
    return routerEngine;
  }

  if (isInitializing) {
    return initPromise;
  }

  isInitializing = true;
  
  initPromise = (async () => {
    try {
      logger.info('🚀 Initialisation du routeur natif RAPTOR...');
      const startTime = Date.now();

      // Charger les données GTFS
      const gtfsData = await loadGtfsData();

      // Créer et initialiser le moteur
      routerEngine = new PathfindingEngine(gtfsData, {
        maxWalkDistance: 2000,    // 2km max de marche
        walkSpeed: 1.25,          // ~4.5 km/h
        maxTransfers: 2,          // 2 correspondances max
        minTransferTime: 180,     // 3 min minimum
        transferPenalty: 1200,    // Pénalité de 20 min par correspondance (priorise trajets directs)
        maxResults: 5,            // 5 itinéraires max
        nearbyStopRadius: 800     // 800m pour trouver arrêts proches
      });

      await routerEngine.buildGraph();

      const elapsed = Date.now() - startTime;
      const stats = routerEngine.getStats();
      
      logger.info(`✅ Routeur natif prêt en ${elapsed}ms`);
      logger.info(`   📊 Statistiques: ${JSON.stringify(stats.graph)}`);

      return routerEngine;

    } catch (error) {
      logger.error('❌ Erreur initialisation routeur:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

/**
 * Calcule un itinéraire avec le routeur natif
 * 
 * @param {Object} params - Paramètres de la requête
 * @returns {Object} Résultat compatible avec le format OTP
 */
export async function planItineraryNative(params) {
  const { origin, destination, time, mode = 'TRANSIT', maxWalkDistance = 3000, maxTransfers = 3 } = params;

  // S'assurer que le routeur est initialisé
  const engine = await initializeRouter();

  // Pour WALK ou BICYCLE, retourner un itinéraire direct
  if (mode === 'WALK' || mode === 'BICYCLE') {
    return planDirectItinerary(origin, destination, mode, time);
  }

  // Parser le temps - s'assurer que c'est une Date valide
  let departureTime;
  try {
    departureTime = time ? new Date(time) : new Date();
    if (isNaN(departureTime.getTime())) {
      departureTime = new Date(); // Fallback à maintenant si invalide
    }
  } catch {
    departureTime = new Date();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VÉRIFIER LE CACHE D'ABORD (OPTIMISATION VITESSE)
  // ═══════════════════════════════════════════════════════════════════════
  const cacheKey = getCacheKey(origin, destination, departureTime, mode, maxWalkDistance, maxTransfers);
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) {
    logger.info(`⚡ Cache HIT: ${cacheKey.slice(0, 30)}...`);
    return cachedResult;
  }

  logger.info(`🔍 Recherche itinéraire: ${origin.lat.toFixed(4)},${origin.lon.toFixed(4)} -> ${destination.lat.toFixed(4)},${destination.lon.toFixed(4)}`);

  try {
    // Calculer les itinéraires
    const itineraries = await engine.computeItineraries(
      { lat: origin.lat, lon: origin.lon },
      { lat: destination.lat, lon: destination.lon },
      departureTime
    );

    if (!itineraries || itineraries.length === 0) {
      const emptyResult = {
        routes: [],
        metadata: {
          engine: 'raptor-native',
          noRouteFound: true,
          message: 'Aucun itinéraire trouvé'
        }
      };
      return emptyResult;
    }

    // Convertir au format attendu par le client
    const routes = itineraries.map((itin, index) => ({
      index,
      duration: itin.totalDuration,
      walkDistance: itin.totalWalkDistance,
      transfers: itin.transfers,
      departureTime: itin.departureTime,
      arrivalTime: itin.arrivalTime,
      legs: itin.legs.map(leg => formatLeg(leg))
    }));

    const result = {
      routes,
      metadata: {
        engine: 'raptor-native',
        computeTime: Date.now(),
        routesCount: routes.length
      }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // METTRE EN CACHE LE RÉSULTAT
    // ═══════════════════════════════════════════════════════════════════════
    setCachedResult(cacheKey, result);

    return result;

  } catch (error) {
    logger.error('Erreur calcul itinéraire:', error.message || error);
    logger.error('Stack:', error.stack);
    throw new NativeRouterError('COMPUTE_ERROR', error.message || 'Erreur de calcul');
  }
}

/**
 * Formate un segment pour le client
 */
function formatLeg(leg) {
  const base = {
    mode: leg.type.toUpperCase(),
    from: leg.from,
    to: leg.to,
    duration: leg.duration,
    departureTime: leg.departureTime,
    arrivalTime: leg.arrivalTime
  };

  if (leg.type === 'transit') {
    return {
      ...base,
      mode: leg.mode?.toUpperCase() || 'BUS',
      routeId: leg.routeId,
      routeShortName: leg.routeName,
      routeColor: leg.routeColor,
      tripId: leg.tripId,
      headsign: leg.tripHeadsign,
      transitLeg: true
    };
  }

  if (leg.type === 'walk') {
    return {
      ...base,
      mode: 'WALK',
      distance: leg.distance
    };
  }

  return base;
}

/**
 * Calcule un itinéraire direct (marche/vélo)
 */
function planDirectItinerary(origin, destination, mode, requestedTime) {
  const distance = haversineDistance(
    origin.lat, origin.lon,
    destination.lat, destination.lon
  );

  const speed = mode === 'BICYCLE' ? 4.17 : 1.25; // m/s (15 km/h ou 4.5 km/h)
  const duration = Math.round(distance / speed);

  const departure = requestedTime ? new Date(requestedTime) : new Date();
  const validDeparture = isNaN(departure.getTime()) ? new Date() : departure;
  const arrivalTime = new Date(validDeparture.getTime() + duration * 1000);

  return {
    routes: [{
      index: 0,
      duration,
      walkDistance: mode === 'WALK' ? Math.round(distance) : 0,
      transfers: 0,
      departureTime: validDeparture.toISOString(),
      arrivalTime: arrivalTime.toISOString(),
      legs: [{
        mode: mode.toUpperCase(),
        from: { lat: origin.lat, lon: origin.lon },
        to: { lat: destination.lat, lon: destination.lon },
        duration,
        distance: Math.round(distance),
        departureTime: validDeparture.toISOString(),
        arrivalTime: arrivalTime.toISOString()
      }]
    }],
    metadata: {
      engine: 'direct',
      mode
    }
  };
}

/**
 * Calcule la distance Haversine
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Vérifie l'état du routeur
 */
export async function checkNativeRouterHealth() {
  try {
    if (!routerEngine) {
      await initializeRouter();
    }

    if (routerEngine?.isReady) {
      const stats = routerEngine.getStats();
      return {
        ok: true,
        engine: 'raptor-native',
        stats: stats.graph,
        memory: stats.memory
      };
    }

    return {
      ok: false,
      engine: 'raptor-native',
      error: 'Router not ready'
    };

  } catch (error) {
    return {
      ok: false,
      engine: 'raptor-native',
      error: error.message
    };
  }
}

/**
 * Erreur du routeur natif
 */
export class NativeRouterError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'NativeRouterError';
  }
}

export const NATIVE_ROUTER_ERROR_CODES = {
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  NO_ROUTE: 'NO_ROUTE',
  COMPUTE_ERROR: 'COMPUTE_ERROR',
  INVALID_INPUT: 'INVALID_INPUT'
};

export default {
  initializeRouter,
  planItineraryNative,
  checkNativeRouterHealth,
  NativeRouterError,
  NATIVE_ROUTER_ERROR_CODES
};
