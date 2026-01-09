/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * index.js
 * Point d'entrée du serveur Peribus
 * 
 * ?? STATUT: DÉSACTIVÉ - Code préparé pour le futur
 * 
 * Pour activer:
 * 1. Configurer les variables d'environnement (.env)
 * 2. Exécuter: npm install
 * 3. Exécuter: npm run build-graph
 * 4. Exécuter: npm start
 */

// ============================================================
// ?? DÉSACTIVÉ - Décommenter pour activer le serveur
// ============================================================

/*
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { config, validateConfig } from './config.js';
import { createLogger } from './utils/logger.js';
import { setupRateLimit } from './middleware/rateLimit.js';
import { setupCors } from './middleware/cors.js';
import apiRouter from './api/index.js';
import { PathfindingEngine } from './core/pathfinding/index.js';
import { PlacesEngine } from './core/places/index.js';
import { UserMemoryStore } from './core/memory/index.js';
import { loadGtfsData } from './utils/gtfsLoader.js';

const logger = createLogger('server');

async function startServer() {
  try {
    // Valider la configuration
    validateConfig();
    logger.info('? Configuration validée');

    // Créer l'application Express
    const app = express();

    // Middleware de sécurité
    app.use(helmet());
    app.use(compression());
    app.use(express.json({ limit: '1mb' }));
    
    // CORS
    setupCors(app);
    
    // Rate limiting
    setupRateLimit(app);

    // Charger les données GTFS
    logger.info('?? Chargement des données GTFS...');
    const gtfsData = await loadGtfsData(config.paths.gtfs);
    logger.info(`? ${gtfsData.stops.length} arrêts chargés`);

    // Initialiser les moteurs
    logger.info('?? Initialisation des moteurs...');
    
    const pathfindingEngine = new PathfindingEngine(gtfsData, config.pathfinding);
    await pathfindingEngine.buildGraph();
    logger.info('? Moteur de pathfinding prêt');

    const placesEngine = new PlacesEngine(gtfsData.stops, config.places);
    await placesEngine.buildIndex();
    logger.info('? Moteur de places prêt');

    const userMemory = new UserMemoryStore(config.database, config.userMemory);
    await userMemory.initialize();
    logger.info('? Mémoire utilisateur prête');

    // Injecter les moteurs dans l'app
    app.locals.pathfinding = pathfindingEngine;
    app.locals.places = placesEngine;
    app.locals.userMemory = userMemory;
    app.locals.gtfsData = gtfsData;

    // Routes API
    app.use('/api', apiRouter);

    // Health check
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    });

    // Gestion des erreurs
    app.use((err, req, res, next) => {
      logger.error('Erreur non gérée:', err);
      res.status(500).json({
        error: 'Erreur interne du serveur',
        message: config.server.env === 'development' ? err.message : undefined,
      });
    });

    // Démarrer le serveur
    const server = app.listen(config.server.port, config.server.host, () => {
      logger.info(`?? Serveur Peribus démarré sur http://${config.server.host}:${config.server.port}`);
      logger.info(`?? Environnement: ${config.server.env}`);
    });

    // Gestion de l'arrêt propre
    process.on('SIGTERM', () => {
      logger.info('SIGTERM reçu, arrêt du serveur...');
      server.close(() => {
        userMemory.close();
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('? Erreur au démarrage:', error);
    process.exit(1);
  }
}

startServer();
*/

// ============================================================
// Message d'information quand le fichier est exécuté
// ============================================================

console.log(`
+---------------------------------------------------------------+
¦                                                               ¦
¦   ?? PERIBUS SERVER - Module Backend                          ¦
¦                                                               ¦
¦   ?? STATUT: DÉSACTIVÉ                                        ¦
¦                                                               ¦
¦   Ce serveur est préparé pour une utilisation future.         ¦
¦   Il fournira:                                                ¦
¦   - ???  Pathfinding (calcul d'itinéraires)                    ¦
¦   - ?? Autocomplétion de lieux                                ¦
¦   - ?? Mémoire utilisateur (favoris, historique)              ¦
¦                                                               ¦
¦   Pour activer:                                               ¦
¦   1. Décommenter le code dans index.js                        ¦
¦   2. npm install                                              ¦
¦   3. npm run build-graph                                      ¦
¦   4. npm start                                                ¦
¦                                                               ¦
¦   Voir README.md pour plus d'informations.                    ¦
¦                                                               ¦
+---------------------------------------------------------------+
`);


