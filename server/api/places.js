/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * api/places.js
 * API d'autocomplétion de lieux
 * 
 * ?? STATUT: DÉSACTIVÉ - Code préparé pour le futur
 */

/*
import { Router } from 'express';

const router = Router();

/**
 * GET /api/places/autocomplete
 * Recherche de lieux par texte (autocomplétion)
 * 
 * Query:
 * - q: string (requis) - Texte de recherche
 * - lat: number (optionnel) - Latitude pour boost proximité
 * - lon: number (optionnel) - Longitude pour boost proximité
 * - types: string (optionnel) - Types de lieux séparés par virgule (stop,poi,address)
 * - limit: number (optionnel, défaut 10)
 */
/*
router.get('/autocomplete', async (req, res, next) => {
  try {
    const { places, userMemory } = req.app.locals;
    const { q, lat, lon, types, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        error: 'Requête trop courte (min 2 caractères)',
      });
    }

    // Contexte utilisateur pour personnaliser les résultats
    let userContext = null;
    if (req.userId && userMemory) {
      userContext = await userMemory.getUserContext(req.userId);
    }

    // Options de recherche
    const searchOptions = {
      userContext,
    };

    // Position pour boost proximité
    if (lat && lon) {
      searchOptions.location = {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
      };
    }

    // Filtrer par types
    if (types) {
      searchOptions.types = types.split(',');
    }

    // Recherche
    const suggestions = places.search(q, searchOptions);

    res.json({
      suggestions: suggestions.slice(0, parseInt(limit)),
      query: q,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/places/nearby
 * Recherche de lieux à proximité d'une position
 * 
 * Query:
 * - lat: number (requis)
 * - lon: number (requis)
 * - radius: number (optionnel, défaut 500m)
 * - types: string (optionnel)
 * - limit: number (optionnel, défaut 10)
 */
/*
router.get('/nearby', async (req, res, next) => {
  try {
    const { places } = req.app.locals;
    const { lat, lon, radius = 500, types, limit = 10 } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'lat et lon requis',
      });
    }

    const options = {
      radius: parseInt(radius),
      limit: parseInt(limit),
    };

    if (types) {
      options.types = types.split(',');
    }

    const nearby = places.searchNearby(
      parseFloat(lat),
      parseFloat(lon),
      options
    );

    res.json({
      places: nearby,
      center: { lat: parseFloat(lat), lon: parseFloat(lon) },
      radius: parseInt(radius),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/places/:id
 * Détails d'un lieu spécifique
 */
/*
router.get('/:id', async (req, res, next) => {
  try {
    const { places } = req.app.locals;
    const { id } = req.params;

    const place = places.getPlace(id);

    if (!place) {
      return res.status(404).json({
        error: 'Lieu non trouvé',
      });
    }

    res.json({ place });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/places/reverse
 * Géocodage inverse (coordonnées -> adresse)
 */
/*
router.get('/reverse', async (req, res, next) => {
  try {
    const { places } = req.app.locals;
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'lat et lon requis',
      });
    }

    // Trouver le lieu le plus proche
    const nearby = places.searchNearby(
      parseFloat(lat),
      parseFloat(lon),
      { radius: 100, limit: 1 }
    );

    if (nearby.length === 0) {
      // Fallback: retourner les coordonnées
      return res.json({
        place: {
          id: `coords_${lat}_${lon}`,
          type: 'coordinates',
          name: `${parseFloat(lat).toFixed(5)}, ${parseFloat(lon).toFixed(5)}`,
          lat: parseFloat(lat),
          lon: parseFloat(lon),
        },
      });
    }

    res.json({
      place: nearby[0],
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


