/*
 * Copyright (c) 2025 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * config.js
 * Configuration centralisée du serveur Peribus
 * 
 * 🔴 STATUT: DÉSACTIVÉ - Code préparé pour le futur
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configuration du serveur
 */
export const config = {
  // === SERVEUR ===
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,https://peribus.fr').split(','),
  },

  // === BASE DE DONNÉES ===
  database: {
    // SQLite par défaut, PostgreSQL en production
    url: process.env.DATABASE_URL || `sqlite:${join(__dirname, 'data', 'peribus.db')}`,
    // Pool de connexions (PostgreSQL uniquement)
    poolMin: 2,
    poolMax: 10,
  },

  // === CHEMINS DE FICHIERS ===
  paths: {
    root: __dirname,
    data: join(__dirname, 'data'),
    gtfs: join(__dirname, '..', 'public', 'data', 'gtfs'),
    cache: join(__dirname, 'data', 'cache'),
  },

  // === PATHFINDING ===
  pathfinding: {
    // Distance max de marche (mètres)
    maxWalkDistance: 1000,
    // Vitesse de marche (m/s) ~4.5 km/h
    walkSpeed: 1.25,
    // Nombre max de correspondances
    maxTransfers: 3,
    // Temps de correspondance minimum (secondes)
    minTransferTime: 120,
    // Nombre de résultats à retourner
    maxResults: 5,
    // Rayon de recherche pour les arrêts proches (mètres)
    nearbyStopRadius: 500,
    // Pénalité par correspondance (secondes) pour le tri
    transferPenalty: 300,
  },

  // === AUTOCOMPLÉTION ===
  places: {
    // Nombre max de suggestions
    maxSuggestions: 10,
    // Longueur min de la requête
    minQueryLength: 2,
    // Score min pour la recherche floue (0-1)
    fuzzyThreshold: 0.3,
    // Boost pour les lieux récents de l'utilisateur
    recentBoost: 1.5,
    // Boost pour les arrêts fréquentés
    frequencyBoost: 1.2,
  },

  // === MÉMOIRE UTILISATEUR ===
  userMemory: {
    // Nombre max de recherches récentes par utilisateur
    maxRecentSearches: 50,
    // Nombre max de favoris par utilisateur
    maxFavorites: 20,
    // Durée de rétention des données (jours)
    retentionDays: 365,
    // Anonymiser après X jours d'inactivité
    anonymizeAfterDays: 90,
  },

  // === RATE LIMITING ===
  rateLimit: {
    // Fenêtre de temps (ms)
    windowMs: 60 * 1000, // 1 minute
    // Requêtes max par fenêtre
    maxRequests: 100,
    // Requêtes max pour les recherches d'itinéraires
    maxRouteRequests: 20,
  },

  // === CACHE ===
  cache: {
    // TTL du cache des graphes (ms)
    graphTtl: 24 * 60 * 60 * 1000, // 24h
    // TTL du cache des places (ms)
    placesTtl: 60 * 60 * 1000, // 1h
    // TTL du cache des itinéraires (ms)
    routesTtl: 5 * 60 * 1000, // 5 min
    // Taille max du cache en mémoire (Mo)
    maxMemoryMb: 512,
  },

  // === APIs EXTERNES (backup) ===
  externalApis: {
    google: {
      apiKey: process.env.GOOGLE_API_KEY || '',
      enabled: false, // Désactivé - on utilise notre propre système
    },
  },

  // === LOGGING ===
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: join(__dirname, 'logs', 'server.log'),
    maxFiles: 5,
    maxSize: '10m',
  },
};

/**
 * Valide la configuration au démarrage
 */
export function validateConfig() {
  const errors = [];

  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('PORT invalide');
  }

  if (config.pathfinding.maxWalkDistance < 100) {
    errors.push('maxWalkDistance trop petit');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration invalide:\n${errors.join('\n')}`);
  }

  return true;
}

export default config;

