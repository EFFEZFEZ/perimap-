/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * api/routes.js
 * API de calcul d'itinéraires
 * 
 * ?? STATUT: DÉSACTIVÉ - Code préparé pour le futur
 */

/*
import { Router } from 'express';
import { validateCoordinates, parseTime } from '../utils/validation.js';

const router = Router();

/**
 * POST /api/routes/compute
 * Calcule un itinéraire entre deux points
 * 
 * Body:
 * {
 *   origin: { lat: number, lon: number, name?: string },
 *   destination: { lat: number, lon: number, name?: string },
 *   departureTime?: string (ISO 8601),
 *   arrivalTime?: string (ISO 8601),
 *   options?: {
 *     maxWalkDistance?: number,
 *     maxTransfers?: number,
 *     preferLessWalking?: boolean,
 *     wheelchairAccessible?: boolean,
 *   }
 * }
 */
/*
router.post('/compute', async (req, res, next) => {
  try {
    const { pathfinding, userMemory } = req.app.locals;
    const { origin, destination, departureTime, arrivalTime, options = {} } = req.body;

    // Validation
    if (!origin || !destination) {
      return res.status(400).json({
        error: 'origin et destination requis',
      });
    }

    if (!validateCoordinates(origin) || !validateCoordinates(destination)) {
      return res.status(400).json({
        error: 'Coordonnées invalides (lat, lon requis)',
      });
    }

    // Déterminer l'heure de départ
    let time;
    if (departureTime) {
      time = new Date(departureTime);
    } else if (arrivalTime) {
      // TODO: Implémenter la recherche par heure d'arrivée
      time = new Date(arrivalTime);
    } else {
      time = new Date();
    }

    // Calculer les itinéraires
    const itineraries = await pathfinding.computeItineraries(
      origin,
      destination,
      time,
      options
    );

    // Enregistrer la recherche si l'utilisateur est identifié
    const userId = req.userId;
    if (userId && userMemory) {
      await userMemory.recordSearch(userId, {
        origin,
        destination,
        selectedResult: itineraries[0],
      });
    }

    res.json({
      itineraries,
      searchTime: time.toISOString(),
      count: itineraries.length,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/routes/nearby-stops
 * Trouve les arrêts à proximité d'un point
 * 
 * Query:
 * - lat: number (requis)
 * - lon: number (requis)
 * - radius: number (optionnel, défaut 500m)
 * - limit: number (optionnel, défaut 10)
 */
/*
router.get('/nearby-stops', async (req, res, next) => {
  try {
    const { pathfinding } = req.app.locals;
    const { lat, lon, radius = 500, limit = 10 } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'lat et lon requis',
      });
    }

    const nearbyStops = pathfinding.raptor.findNearbyStops(
      parseFloat(lat),
      parseFloat(lon)
    );

    const filtered = nearbyStops
      .filter(s => s.distance <= parseInt(radius))
      .slice(0, parseInt(limit));

    res.json({
      stops: filtered.map(({ stop, distance, walkTime }) => ({
        id: stop.stop_id,
        name: stop.stop_name,
        lat: stop.stop_lat,
        lon: stop.stop_lon,
        distance,
        walkTime,
      })),
      count: filtered.length,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/routes/stop/:id/departures
 * Obtient les prochains départs d'un arrêt
 */
/*
router.get('/stop/:id/departures', async (req, res, next) => {
  try {
    const { gtfsData } = req.app.locals;
    const { id } = req.params;
    const { limit = 10, time } = req.query;

    const referenceTime = time ? new Date(time) : new Date();
    
    // TODO: Implémenter getNextDepartures
    const departures = [];

    res.json({
      stopId: id,
      departures,
      referenceTime: referenceTime.toISOString(),
    });

  } catch (error) {
    next(error);
  }
});

export default router;
*/

// Placeholder
const router = {};
export default router;


