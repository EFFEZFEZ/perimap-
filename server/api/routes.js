// Copyright © 2025 Périmap - Tous droits réservés
/**
 * api/routes.js
 * API d'itinéraires - Proxy vers OpenTripPlanner avec enrichissement GTFS
 * 
 * ARCHITECTURE SERVEUR-CENTRALISÉE:
 * - Le serveur interroge OTP et enrichit les réponses avec les couleurs GTFS
 * - Le client reçoit des données complètes prêtes à afficher
 * - AUCUN fallback côté client - erreurs explicites si OTP échoue
 */

import { Router } from 'express';
import { planItinerary, OtpError, OTP_ERROR_CODES } from '../services/otpService.js';

const router = Router();

// Modes supportés
const SUPPORTED_MODES = ['TRANSIT', 'WALK', 'BICYCLE'];

/**
 * POST /api/routes
 * Planifie un itinéraire via OTP avec enrichissement des couleurs GTFS
 */
router.post('/', async (req, res) => {
  try {
    // --- Compat frontend OTP (V230) ---
    // Payload attendu par public/js/apiManager.js::_fetchBusRouteOtp:
    // { fromPlace:"lat,lon", toPlace:"lat,lon", date:"YYYY-MM-DD", time:"HH:mm", mode?, maxWalkDistance?, numItineraries?, arriveBy? }
    if (req.body?.fromPlace && req.body?.toPlace && req.body?.date && req.body?.time) {
      const {
        fromPlace,
        toPlace,
        date,
        time,
        mode = 'TRANSIT,WALK',
        maxWalkDistance = 1000,
        numItineraries = 3,
        arriveBy: arriveByRaw = false,
      } = req.body;

      const arriveBy = parseBoolean(arriveByRaw, false);

      const routerId = process.env.OTP_ROUTER || 'default';
      const rawBase = (process.env.OTP_URL || process.env.OTP_BASE_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');

      const base = rawBase.includes('/otp/routers/')
        ? rawBase
        : `${rawBase}/otp/routers/${routerId}`;

      const url = new URL(`${base}/plan`);
      url.searchParams.set('fromPlace', String(fromPlace));
      url.searchParams.set('toPlace', String(toPlace));
      url.searchParams.set('date', String(date));
      url.searchParams.set('time', String(time));
      url.searchParams.set('mode', String(mode));
      url.searchParams.set('maxWalkDistance', String(maxWalkDistance));
      url.searchParams.set('numItineraries', String(numItineraries));
      url.searchParams.set('arriveBy', arriveBy ? 'true' : 'false');

      const otpResponse = await fetch(url.toString(), { method: 'GET' });
      if (!otpResponse.ok) {
        const text = await otpResponse.text().catch(() => '');
        return res.status(otpResponse.status).json({
          error: 'OTP non disponible',
          code: 'OTP_ERROR',
          details: text ? text.slice(0, 200) : undefined,
        });
      }

      const otpData = await otpResponse.json();
      res.setHeader('Cache-Control', 'no-store');
      return res.json(otpData);
    }

    const {
      origin,
      destination,
      time,
      timeType = 'departure',
      mode = 'TRANSIT',
      maxWalkDistance = 1000,
      maxTransfers = 3,
      options = {}
    } = req.body || {};

    // Validation basique
    if (!isValidCoord(origin) || !isValidCoord(destination)) {
      return res.status(400).json({ 
        error: 'Coordonnées invalides',
        code: 'INVALID_COORDINATES',
        details: 'origin et destination doivent contenir lat et lon valides'
      });
    }

    if (!SUPPORTED_MODES.includes(mode)) {
      return res.status(400).json({ 
        error: 'Mode de transport invalide',
        code: 'INVALID_MODE',
        details: `Modes supportés: ${SUPPORTED_MODES.join(', ')}`
      });
    }

    // Appel au service OTP enrichi
    const result = await planItinerary({
      origin,
      destination,
      time,
      timeType,
      mode,
      maxWalkDistance,
      maxTransfers,
      options
    });

    // Réponse succès avec métadonnées
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      routes: result.routes,
      metadata: result.metadata
    });

  } catch (error) {
    // Erreur OTP structurée
    if (error instanceof OtpError) {
      const statusCode = getHttpStatusForOtpError(error.code);
      return res.status(statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details
      });
    }

    // Erreur inattendue
    console.error('[routes] Erreur inattendue:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/routes/health
 * Vérifie l'état du service de routage
 */
router.get('/health', async (_req, res) => {
  const { checkOtpHealth } = await import('../services/otpService.js');
  const health = await checkOtpHealth();
  
  res.json({
    service: 'routes',
    otp: health.ok ? 'connected' : 'disconnected',
    otpVersion: health.version || null,
    otpError: health.error || null
  });
});

// === HELPERS ===

function isValidCoord(obj) {
  if (!obj || typeof obj.lat !== 'number' || typeof obj.lon !== 'number') return false;
  return obj.lat >= -90 && obj.lat <= 90 && obj.lon >= -180 && obj.lon <= 180;
}

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

function buildOtpMode(mode) {
  if (mode === 'WALK') return 'WALK';
  if (mode === 'BICYCLE') return 'BICYCLE';
  // Transit par défaut: ajouter WALK pour accès/egress
  return 'TRANSIT,WALK';
}

function parseBoolean(value, defaultValue = false) {
  if (value === true || value === false) return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off', ''].includes(normalized)) return false;
  }
  return defaultValue;
}

function mapItineraryToClient(itinerary) {
  const legs = Array.isArray(itinerary.legs) ? itinerary.legs : [];

  const mappedLegs = legs.map((leg) => {
    const isTransit = leg.mode === 'BUS' || leg.mode === 'TRAM' || leg.mode === 'SUBWAY' || leg.transitLeg;

    return {
      mode: leg.mode,
      duration: toSeconds(leg.duration),
      distanceMeters: Math.round(leg.distance || 0),
      polyline: leg.legGeometry?.points || null,
      // Horaires bruts OTP (en ms epoch) pour affichage HH:MM côté front
      startTime: leg.startTime || null,
      endTime: leg.endTime || null,
      from: {
        name: leg.from?.name,
        lat: leg.from?.lat,
        lon: leg.from?.lon,
        stopId: leg.from?.stopId, // ✅ AJOUT: stop ID pour reconstruction polyline GTFS
      },
      to: {
        name: leg.to?.name,
        lat: leg.to?.lat,
        lon: leg.to?.lon,
        stopId: leg.to?.stopId, // ✅ AJOUT: stop ID pour reconstruction polyline GTFS
      },
      transitDetails: isTransit
        ? {
            headsign: leg.headsign,
            routeShortName: leg.routeShortName,
            routeLongName: leg.routeLongName,
            agencyName: leg.agencyName,
            tripId: leg.tripId,
            routeId: leg.routeId, // ✅ AJOUT: route ID pour récupérer shape GTFS
            shapeId: leg.shapeId || leg.trip?.shapeId,
          }
        : undefined,
      steps: [], // Compat avec l'ancien frontend (liste attendue)
    };
  });

  const totalDistance = mappedLegs.reduce((acc, l) => acc + (l.distanceMeters || 0), 0);
  const totalDuration = toSeconds(itinerary.duration);

  return {
    duration: totalDuration,
    distanceMeters: Math.round(totalDistance),
    polyline: itinerary.legs?.[0]?.legGeometry?.points || null,
    startTime: itinerary.startTime || null,
    endTime: itinerary.endTime || null,
    legs: mappedLegs,
    fare: itinerary.fare?.fare?.regular?.cents
      ? { currency: itinerary.fare.fare.regular.currency, amountCents: itinerary.fare.fare.regular.cents }
      : undefined,
  };
}

function toSeconds(value) {
  if (typeof value === 'number') return Math.round(value);
  return 0;
}

export default router;
