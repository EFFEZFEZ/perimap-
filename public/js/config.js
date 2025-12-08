/*
 * Copyright (c) 2025 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * config.js
 * Centralise la récupération de configuration runtime.
 * 
 * ✅ V178: Sécurisation - La clé API Google n'est plus exposée côté client.
 * Tous les appels Google passent par les proxies Vercel:
 * - /api/routes : Google Routes API (itinéraires)
 * - /api/places : Google Places API (autocomplétion)
 * - /api/geocode : Google Geocoding API (reverse geocode)
 */

/**
 * Indique si le mode proxy est activé (clé API côté serveur)
 * @returns {boolean} true si on utilise les proxies Vercel
 */
export function useServerProxy() {
  // En production, on utilise toujours le proxy
  // En dev local, on peut avoir une clé dans window.__APP_CONFIG
  if (window.__APP_CONFIG && window.__APP_CONFIG.googleApiKey) {
    return false; // Mode dev avec clé locale
  }
  return true; // Mode production avec proxy
}

/**
 * Récupère la clé API Google (uniquement pour dev local)
 * En production, retourne une chaîne vide car on utilise le proxy
 * @returns {string} La clé API ou chaîne vide
 */
export function getGoogleApiKey() {
  // Mode dev uniquement
  if (window.__APP_CONFIG && window.__APP_CONFIG.googleApiKey) {
    return window.__APP_CONFIG.googleApiKey;
  }
  // En production, pas de clé côté client (proxy utilisé)
  return '';
}

/**
 * Récupère le token admin pour GitHub API
 * @returns {string} Le token ou chaîne vide
 */
export function getAdminToken() {
  // 1. Variable globale injectée (Vercel/index.html)
  if (window.__ADMIN_TOKEN && window.__ADMIN_TOKEN !== '__VITE_ADMIN_TOKEN__') {
    return window.__ADMIN_TOKEN;
  }
  // 2. Objet config global
  if (window.__APP_CONFIG && window.__APP_CONFIG.adminToken) {
    return window.__APP_CONFIG.adminToken;
  }
  // 3. Meta tag
  const meta = document.querySelector('meta[name="peribus-admin-token"]');
  if (meta && meta.content && meta.content.trim()) {
    return meta.content.trim();
  }
  return '';
}

/**
 * URLs des proxies API Vercel
 */
export const API_ENDPOINTS = {
  routes: '/api/routes',
  places: '/api/places',
  geocode: '/api/geocode'
};

/**
 * Retourne la configuration globale de l'application
 * @returns {Object} Configuration avec googleApiKey, adminToken, etc.
 */
export function getAppConfig() {
  return {
    googleApiKey: getGoogleApiKey(),
    adminToken: getAdminToken(),
    useProxy: useServerProxy(),
    apiEndpoints: API_ENDPOINTS,
    arrivalPageSize: 6,
    minBusItineraries: 3,
    maxBottomSheetLevels: 3
  };
}

