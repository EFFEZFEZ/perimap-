/**
 * config.js
 * Centralise la récupération de configuration runtime (clé API Google, flags, etc.).
 * Aucun hardcode sensible : la clé est lue soit via variable globale, soit via <meta>.
 * 
 * Priorité pour les clés:
 * 1. window.__APP_CONFIG.googleApiKey / window.__ADMIN_TOKEN
 * 2. <meta name="peribus-api-key" / "peribus-admin-token" content="...">
 */

/**
 * Récupère la clé API Google
 * @returns {string} La clé API ou chaîne vide
 */
export function getGoogleApiKey() {
  // 1. Objet global (défini avant chargement des modules)
  if (window.__APP_CONFIG && window.__APP_CONFIG.googleApiKey) {
    return window.__APP_CONFIG.googleApiKey;
  }
  // 2. Meta tag
  const meta = document.querySelector('meta[name="peribus-api-key"]');
  if (meta && meta.content && meta.content.trim()) {
    return meta.content.trim();
  }
  // 3. Aucune clé trouvée
  console.warn('[config] Aucune clé API Google trouvée.');
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
 * Retourne la configuration globale de l'application
 * @returns {Object} Configuration avec googleApiKey, adminToken, etc.
 */
export function getAppConfig() {
  return {
    googleApiKey: getGoogleApiKey(),
    adminToken: getAdminToken(),
    arrivalPageSize: 6,
    minBusItineraries: 3,
    maxBottomSheetLevels: 3
  };
}
