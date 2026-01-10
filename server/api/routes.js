// Copyright © 2025 Périmap - Tous droits réservés
/**
 * api/routes.js
 * API d'itinéraires - Moteur RAPTOR natif (remplace OTP)
 * 
 * ARCHITECTURE:
 * - Utilise l'algorithme RAPTOR natif pour le calcul d'itinéraires
 * - Ultra-rapide (<100ms vs ~3s avec OTP)
 * - Pas de dépendance externe (Java/OTP)
 * - Format de sortie compatible avec le frontend existant
 */

import { Router } from 'express';
import { 
  initializeRouter, 
  planItineraryNative, 
  checkNativeRouterHealth,
  NativeRouterError,
  NATIVE_ROUTER_ERROR_CODES 
} from '../services/nativeRouterService.js';
import { createLogger } from '../utils/logger.js';

const router = Router();
const logger = createLogger('routes-api');

// Modes supportés
const SUPPORTED_MODES = ['TRANSIT', 'WALK', 'BICYCLE', 'TRANSIT,WALK'];

/**
 * POST /api/routes
 * Planifie un itinéraire via RAPTOR natif
 * 
 * Payload frontend (OTP-compatible):
 * { fromPlace:"lat,lon", toPlace:"lat,lon", date:"YYYY-MM-DD", time:"HH:mm", mode?, numItineraries?, arriveBy? }
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // --- Format frontend OTP-like ---
    if (req.body?.fromPlace && req.body?.toPlace) {
      const {
        fromPlace,
        toPlace,
        date,
        time,
        mode = 'TRANSIT,WALK',
        maxWalkDistance = 1000,
        numItineraries = 3,
        arriveBy: arriveByRaw = false,
        maxTransfers: maxTransfersRaw = 2,
      } = req.body;

      // Parser les coordonnées
      const origin = parsePlace(fromPlace);
      const destination = parsePlace(toPlace);

      if (!origin || !destination) {
        return res.status(400).json({
          error: 'Coordonnées invalides',
          code: 'INVALID_COORDINATES',
          details: 'fromPlace et toPlace doivent être au format "lat,lon"'
        });
      }

      // Construire la date/heure de départ
      const departureTime = buildDateTime(date, time);
      const effectiveMode = normalizeMode(mode);

      logger.info(`🔍 RAPTOR: ${origin.lat.toFixed(4)},${origin.lon.toFixed(4)} → ${destination.lat.toFixed(4)},${destination.lon.toFixed(4)} [${effectiveMode}]`);

      // Appel au moteur RAPTOR
      const result = await planItineraryNative({
        origin,
        destination,
        time: departureTime,
        mode: effectiveMode,
        maxWalkDistance,
        maxTransfers: Number.isFinite(Number(maxTransfersRaw)) ? Math.max(0, Math.min(4, Number(maxTransfersRaw))) : 2
      });

      // Convertir au format OTP attendu par le frontend
      const otpResponse = convertToOtpFormat(result, origin, destination, departureTime);

      const elapsed = Date.now() - startTime;
      logger.info(`✅ RAPTOR: ${result.routes?.length || 0} itinéraire(s) en ${elapsed}ms`);

      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('X-Compute-Time', `${elapsed}ms`);
      res.setHeader('X-Engine', 'raptor-native');
      return res.json(otpResponse);
    }

    // --- Format alternatif (origin/destination objets) ---
    const {
      origin,
      destination,
      time,
      timeType = 'departure',
      mode = 'TRANSIT',
      maxWalkDistance = 1000,
      maxTransfers = 3,
    } = req.body || {};

    if (!isValidCoord(origin) || !isValidCoord(destination)) {
      return res.status(400).json({ 
        error: 'Coordonnées invalides',
        code: 'INVALID_COORDINATES',
        details: 'origin et destination doivent contenir lat et lon valides'
      });
    }

    const effectiveMode = normalizeMode(mode);
    if (!SUPPORTED_MODES.includes(effectiveMode) && !SUPPORTED_MODES.includes(mode)) {
      return res.status(400).json({ 
        error: 'Mode de transport invalide',
        code: 'INVALID_MODE',
        details: `Modes supportés: ${SUPPORTED_MODES.join(', ')}`
      });
    }

    const departureTime = time ? new Date(time) : new Date();

    const result = await planItineraryNative({
      origin,
      destination,
      time: departureTime,
      mode: effectiveMode,
      maxWalkDistance,
      maxTransfers
    });

    const otpResponse = convertToOtpFormat(result, origin, destination, departureTime);
    const elapsed = Date.now() - startTime;

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Compute-Time', `${elapsed}ms`);
    res.setHeader('X-Engine', 'raptor-native');
    return res.json(otpResponse);

  } catch (error) {
    const elapsed = Date.now() - startTime;
    
    if (error instanceof NativeRouterError) {
      const statusCode = getHttpStatusForError(error.code);
      logger.warn(`⚠️ RAPTOR error [${error.code}]: ${error.message} (${elapsed}ms)`);
      return res.status(statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details
      });
    }

    logger.error(`❌ Erreur inattendue (${elapsed}ms):`, error);
    return res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/routes/health
 * Vérifie l'état du moteur RAPTOR
 */
router.get('/health', async (_req, res) => {
  const health = await checkNativeRouterHealth();
  
  res.json({
    service: 'routes',
    engine: 'raptor-native',
    status: health.ok ? 'ready' : 'error',
    stats: health.stats || null,
    memory: health.memory || null,
    error: health.error || null
  });
});

// === HELPERS ===

/**
 * Parse "lat,lon" en objet {lat, lon}
 */
function parsePlace(place) {
  if (!place || typeof place !== 'string') return null;
  const parts = place.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return { lat: parts[0], lon: parts[1] };
}

/**
 * Construit un objet Date à partir de date et time
 */
function buildDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return new Date();
  
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    
    const date = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (isNaN(date.getTime())) return new Date();
    
    return date;
  } catch {
    return new Date();
  }
}

/**
 * Normalise le mode de transport
 */
function normalizeMode(mode) {
  if (!mode) return 'TRANSIT';
  const m = String(mode).toUpperCase();
  if (m.includes('TRANSIT')) return 'TRANSIT';
  if (m.includes('BICYCLE') || m.includes('BIKE')) return 'BICYCLE';
  if (m === 'WALK') return 'WALK';
  return 'TRANSIT';
}

function isValidCoord(obj) {
  if (!obj || typeof obj.lat !== 'number' || typeof obj.lon !== 'number') return false;
  return obj.lat >= -90 && obj.lat <= 90 && obj.lon >= -180 && obj.lon <= 180;
}

function getHttpStatusForError(code) {
  switch (code) {
    case NATIVE_ROUTER_ERROR_CODES.NO_ROUTE:
      return 404;
    case NATIVE_ROUTER_ERROR_CODES.INVALID_INPUT:
      return 400;
    case NATIVE_ROUTER_ERROR_CODES.NOT_INITIALIZED:
      return 503;
    default:
      return 500;
  }
}

/**
 * Convertit le résultat RAPTOR au format OTP attendu par le frontend
 */
function convertToOtpFormat(result, origin, destination, departureTime) {
  if (!result.routes || result.routes.length === 0) {
    return {
      plan: {
        date: departureTime.getTime(),
        from: { lat: origin.lat, lon: origin.lon },
        to: { lat: destination.lat, lon: destination.lon },
        itineraries: []
      }
    };
  }

  const itineraries = result.routes.map(route => {
    const legs = route.legs.map(leg => {
      const startTimeMs = leg.departureTime ? new Date(leg.departureTime).getTime() : Date.now();
      const endTimeMs = leg.arrivalTime ? new Date(leg.arrivalTime).getTime() : startTimeMs + (leg.duration || 0) * 1000;

      const baseLeg = {
        mode: leg.mode || 'WALK',
        startTime: startTimeMs,
        endTime: endTimeMs,
        duration: leg.duration || Math.round((endTimeMs - startTimeMs) / 1000),
        distance: leg.distance || 0,
        from: {
          name: leg.from?.name || '',
          lat: leg.from?.lat,
          lon: leg.from?.lon,
          stopId: leg.from?.stopId
        },
        to: {
          name: leg.to?.name || '',
          lat: leg.to?.lat,
          lon: leg.to?.lon,
          stopId: leg.to?.stopId
        },
        legGeometry: leg.polyline ? { points: leg.polyline } : null
      };

      // Ajouter les détails transit si c'est un leg bus
      if (leg.transitLeg || leg.mode === 'BUS' || leg.mode === 'TRANSIT') {
        baseLeg.transitLeg = true;
        baseLeg.routeId = leg.routeId;
        baseLeg.routeShortName = leg.routeShortName || leg.routeName;
        baseLeg.routeColor = leg.routeColor;
        baseLeg.routeTextColor = leg.routeTextColor || 'FFFFFF';
        baseLeg.tripId = leg.tripId;
        baseLeg.headsign = leg.headsign;
        baseLeg.agencyName = 'Péribus';
        
        // Arrêts intermédiaires si disponibles
        if (leg.intermediateStops) {
          baseLeg.intermediateStops = leg.intermediateStops;
        }
      }

      return baseLeg;
    });

    const startTimeMs = route.departureTime ? new Date(route.departureTime).getTime() : Date.now();
    const endTimeMs = route.arrivalTime ? new Date(route.arrivalTime).getTime() : startTimeMs + (route.duration || 0) * 1000;

    return {
      startTime: startTimeMs,
      endTime: endTimeMs,
      duration: route.duration || Math.round((endTimeMs - startTimeMs) / 1000),
      walkDistance: route.walkDistance || 0,
      transfers: route.transfers || 0,
      legs
    };
  });

  return {
    plan: {
      date: departureTime.getTime(),
      from: { 
        name: 'Origine',
        lat: origin.lat, 
        lon: origin.lon 
      },
      to: { 
        name: 'Destination',
        lat: destination.lat, 
        lon: destination.lon 
      },
      itineraries
    }
  };
}

export default router;
