// Copyright © 2025 Périmap - Tous droits réservés
/**
 * api/routes.js
 * API d'itinéraires - Proxy vers OpenTripPlanner avec enrichissement GTFS
 * 
 * ARCHITECTURE SERVEUR-CENTRALISÉE:
 * - Le serveur interroge OTP et enrichit les réponses avec les couleurs GTFS
 * - Le client reçoit des données complètes prêtes à afficher
 * - AUCUN fallback côté client - erreurs explicites si OTP échoue
 * 
 * FORMATS SUPPORTÉS:
 * - Format frontend: { fromPlace: "lat,lon", toPlace: "lat,lon", date, time, mode }
 * - Format API: { origin: {lat, lon}, destination: {lat, lon}, time, mode }
 */

import { Router } from 'express';
import { planItinerary, OtpError, OTP_ERROR_CODES, checkOtpHealth } from '../services/otpService.js';
import { createLogger } from '../utils/logger.js';

const router = Router();
const logger = createLogger('routes-api');

// Modes supportés
const SUPPORTED_MODES = ['TRANSIT', 'WALK', 'BICYCLE', 'TRANSIT,WALK'];

/**
 * POST /api/routes
 * Planifie un itinéraire via OTP avec enrichissement des couleurs GTFS
 * 
 * Supporte deux formats de requête:
 * 1. Format frontend OTP-like: { fromPlace: "lat,lon", toPlace: "lat,lon", date, time, mode, arriveBy }
 * 2. Format API: { origin: {lat, lon}, destination: {lat, lon}, time, timeType, mode }
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();
  logger.debug('POST /api/routes body:', req.body);

  try {
    let origin, destination, travelTime, timeType, mode, maxWalkDistance, maxTransfers, numItineraries;

    // --- Détection du format de requête ---
    
    // Format 1: Frontend OTP-like (fromPlace/toPlace strings)
    if (req.body?.fromPlace && req.body?.toPlace) {
      const {
        fromPlace,
        toPlace,
        date,
        time,
        mode: reqMode = 'TRANSIT,WALK',
        maxWalkDistance: reqMaxWalk = 1000,
        numItineraries: reqNumIt = 5,
        arriveBy = false,
        maxTransfers: reqMaxTransfers = 3,
      } = req.body;

      // Parser les coordonnées "lat,lon"
      origin = parsePlace(fromPlace);
      destination = parsePlace(toPlace);

      if (!origin || !destination) {
        return res.status(400).json({
          error: 'Coordonnées invalides',
          code: 'INVALID_COORDINATES',
          details: 'fromPlace et toPlace doivent être au format "lat,lon"'
        });
      }

      // Construire la date/heure
      travelTime = buildDateTime(date, time);
      timeType = arriveBy ? 'arrival' : 'departure';
      mode = normalizeMode(reqMode);
      maxWalkDistance = Number(reqMaxWalk) || 1000;
      maxTransfers = Number(reqMaxTransfers) || 3;
      numItineraries = Number(reqNumIt) || 5;
    }
    // Format 2: API (origin/destination objets)
    else if (req.body?.origin && req.body?.destination) {
      const {
        origin: reqOrigin,
        destination: reqDest,
        time: reqTime,
        timeType: reqTimeType = 'departure',
        mode: reqMode = 'TRANSIT',
        maxWalkDistance: reqMaxWalk = 1000,
        maxTransfers: reqMaxTransfers = 3,
        options = {}
      } = req.body;

      origin = normalizeCoord(reqOrigin);
      destination = normalizeCoord(reqDest);
      travelTime = reqTime ? new Date(reqTime) : new Date();
      timeType = reqTimeType;
      mode = normalizeMode(reqMode);
      maxWalkDistance = Number(reqMaxWalk) || 1000;
      maxTransfers = Number(reqMaxTransfers) || 3;
      numItineraries = options.numItineraries || 5;
    }
    // Format 3: from/to (alternative)
    else if (req.body?.from && req.body?.to) {
      const {
        from: fromRaw,
        to: toRaw,
        date,
        time,
        mode: reqMode = 'TRANSIT,WALK',
        arriveBy = false,
        maxWalkDistance: reqMaxWalk = 1000,
        maxTransfers: reqMaxTransfers = 3,
      } = req.body;

      origin = normalizeCoord(fromRaw);
      destination = normalizeCoord(toRaw);
      travelTime = buildDateTime(date, time);
      timeType = arriveBy ? 'arrival' : 'departure';
      mode = normalizeMode(reqMode);
      maxWalkDistance = Number(reqMaxWalk) || 1000;
      maxTransfers = Number(reqMaxTransfers) || 3;
      numItineraries = 5;
    }
    else {
      return res.status(400).json({
        error: 'Format de requête invalide',
        code: 'INVALID_REQUEST',
        details: 'Utilisez fromPlace/toPlace, origin/destination, ou from/to'
      });
    }

    // Validation des coordonnées
    if (!isValidCoord(origin) || !isValidCoord(destination)) {
      return res.status(400).json({
        error: 'Coordonnées invalides',
        code: 'INVALID_COORDINATES',
        details: 'Les coordonnées doivent contenir lat et lon valides'
      });
    }

    // Validation du mode
    if (!SUPPORTED_MODES.includes(mode)) {
      mode = 'TRANSIT,WALK'; // Fallback
    }

    logger.info(`🚍 OTP: ${origin.lat.toFixed(4)},${origin.lon.toFixed(4)} → ${destination.lat.toFixed(4)},${destination.lon.toFixed(4)} [${mode}]`);

    // Appel au service OTP
    const result = await planItinerary({
      origin,
      destination,
      time: travelTime,
      timeType,
      mode,
      maxWalkDistance,
      maxTransfers,
      options: { numItineraries }
    });

    const elapsed = Date.now() - startTime;
    logger.info(`✅ OTP: ${result.routes?.length || 0} itinéraire(s) en ${elapsed}ms`);

    // Convertir au format attendu par le frontend (plan.itineraries)
    const response = convertToFrontendFormat(result, origin, destination, travelTime);

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Compute-Time', `${elapsed}ms`);
    res.setHeader('X-Engine', 'otp');
    return res.json(response);

  } catch (error) {
    const elapsed = Date.now() - startTime;

    // Erreur OTP structurée
    if (error instanceof OtpError) {
      const statusCode = getHttpStatusForOtpError(error.code);
      logger.warn(`OTP Error [${error.code}]: ${error.message}`);
      return res.status(statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details
      });
    }

    // Erreur inattendue
    logger.error('[routes] Erreur inattendue:', error);
    return res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR',
      details: error.message
    });
  }
});

/**
 * GET /api/routes/health
 * Vérifie l'état du service de routage
 */
router.get('/health', async (_req, res) => {
  const health = await checkOtpHealth();

  res.json({
    service: 'routes',
    engine: 'otp',
    otp: health.ok ? 'connected' : 'disconnected',
    otpVersion: health.version || null,
    otpError: health.error || null
  });
});

// === HELPERS ===

/**
 * Parse une chaîne "lat,lon" en objet {lat, lon}
 */
function parsePlace(place) {
  if (!place || typeof place !== 'string') return null;
  const parts = place.split(',').map(s => parseFloat(s.trim()));
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { lat: parts[0], lon: parts[1] };
  }
  return null;
}

/**
 * Normalise un objet coordonnées (accepte lng ou lon)
 */
function normalizeCoord(obj) {
  if (!obj) return null;
  const lat = obj.lat || obj.latitude;
  const lon = obj.lon || obj.lng || obj.longitude;
  if (typeof lat === 'number' && typeof lon === 'number') {
    return { lat, lon };
  }
  return null;
}

/**
 * Valide des coordonnées
 */
function isValidCoord(obj) {
  if (!obj || typeof obj.lat !== 'number' || typeof obj.lon !== 'number') return false;
  return obj.lat >= -90 && obj.lat <= 90 && obj.lon >= -180 && obj.lon <= 180;
}

/**
 * Construit une Date à partir de date/time strings
 */
function buildDateTime(dateStr, timeStr) {
  const now = new Date();
  
  let year = now.getFullYear();
  let month = now.getMonth();
  let day = now.getDate();
  let hours = now.getHours();
  let minutes = now.getMinutes();

  if (dateStr) {
    const dateParts = dateStr.split('-').map(Number);
    if (dateParts.length === 3) {
      year = dateParts[0];
      month = dateParts[1] - 1;
      day = dateParts[2];
    }
  }

  if (timeStr) {
    const timeParts = timeStr.split(':').map(Number);
    if (timeParts.length >= 2) {
      hours = timeParts[0];
      minutes = timeParts[1];
    }
  }

  return new Date(year, month, day, hours, minutes);
}

/**
 * Normalise le mode de transport
 */
function normalizeMode(mode) {
  if (!mode) return 'TRANSIT,WALK';
  const upper = mode.toUpperCase().trim();
  if (upper === 'WALK') return 'WALK';
  if (upper === 'BICYCLE' || upper === 'BIKE') return 'BICYCLE';
  if (upper.includes('TRANSIT')) return 'TRANSIT,WALK';
  return 'TRANSIT,WALK';
}

/**
 * Convertit le code d'erreur OTP en code HTTP
 */
function getHttpStatusForOtpError(code) {
  switch (code) {
    case OTP_ERROR_CODES.NO_ROUTE:
      return 404;
    case OTP_ERROR_CODES.DATE_OUT_OF_RANGE:
      return 400;
    case OTP_ERROR_CODES.LOCATION_NOT_FOUND:
      return 404;
    case OTP_ERROR_CODES.INVALID_REQUEST:
      return 400;
    case OTP_ERROR_CODES.TIMEOUT:
      return 504;
    case OTP_ERROR_CODES.CONNECTION_ERROR:
      return 502;
    default:
      return 500;
  }
}

/**
 * Convertit la réponse OTP au format attendu par le frontend
 * Le frontend attend { plan: { itineraries: [...] } }
 */
function convertToFrontendFormat(result, origin, destination, travelTime) {
  // Mapper les routes au format itineraries OTP standard
  const itineraries = (result.routes || []).map(route => ({
    duration: route.duration,
    startTime: route.startTime,
    endTime: route.endTime,
    walkTime: route.walkTime || 0,
    transitTime: route.transitTime || 0,
    waitingTime: route.waitingTime || 0,
    transfers: route.transfers || 0,
    legs: (route.legs || []).map(leg => ({
      mode: leg.mode,
      duration: leg.duration,
      distance: leg.distanceMeters,
      startTime: leg.startTime,
      endTime: leg.endTime,
      from: leg.from,
      to: leg.to,
      legGeometry: leg.legGeometry || (leg.polyline ? { points: leg.polyline } : null),
      transitLeg: ['BUS', 'TRAM', 'SUBWAY', 'RAIL', 'FERRY'].includes(leg.mode),
      routeId: leg.routeId,
      routeShortName: leg.routeShortName,
      routeLongName: leg.routeLongName,
      routeColor: leg.routeColor,
      routeTextColor: leg.routeTextColor,
      tripId: leg.tripId,
      headsign: leg.headsign,
      agencyName: leg.agencyName,
      intermediateStops: leg.intermediateStops || []
    }))
  }));

  return {
    plan: {
      date: travelTime.getTime(),
      from: {
        lat: origin.lat,
        lon: origin.lon
      },
      to: {
        lat: destination.lat,
        lon: destination.lon
      },
      itineraries
    },
    metadata: result.metadata
  };
}

export default router;
