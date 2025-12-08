/*
 * Copyright (c) 2025 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * api/index.js
 * Router principal de l'API
 * 
 * 🔴 STATUT: DÉSACTIVÉ - Code préparé pour le futur
 */

/*
import { Router } from 'express';
import routesApi from './routes.js';
import placesApi from './places.js';
import userApi from './user.js';

const router = Router();

// Routes de l'API
router.use('/routes', routesApi);
router.use('/places', placesApi);
router.use('/user', userApi);

// Documentation de l'API
router.get('/', (req, res) => {
  res.json({
    name: 'Peribus API',
    version: '1.0.0',
    endpoints: {
      routes: {
        'POST /api/routes/compute': 'Calcul d\'itinéraire',
        'GET /api/routes/nearby-stops': 'Arrêts à proximité',
      },
      places: {
        'GET /api/places/autocomplete': 'Autocomplétion de lieux',
        'GET /api/places/nearby': 'Lieux à proximité',
        'GET /api/places/:id': 'Détails d\'un lieu',
      },
      user: {
        'GET /api/user': 'Profil utilisateur',
        'GET /api/user/favorites': 'Liste des favoris',
        'POST /api/user/favorites': 'Ajouter un favori',
        'DELETE /api/user/favorites/:id': 'Supprimer un favori',
        'GET /api/user/history': 'Historique de recherche',
        'DELETE /api/user/history': 'Effacer l\'historique',
        'GET /api/user/preferences': 'Préférences',
        'PATCH /api/user/preferences': 'Modifier les préférences',
      },
    },
  });
});

export default router;
*/

// Placeholder pour l'export
const router = {
  use: () => {},
  get: () => {},
};

export default router;

