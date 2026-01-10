/*
 * Copyright (c) 2025 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * config.js
 * Centralise la récupération de configuration runtime.
 * 
 * ✅ V178: Sécurisation - La clé API Google n'est plus exposée côté client.
 * ✅ V230: Support du serveur Express local (OTP/Photon) en plus de Vercel
 * 
 * Modes disponibles:
 * - 'vercel': Proxies Vercel Edge → Google APIs (production Vercel)
 * - 'otp': Serveur Express local → OTP + Photon (serveur dédié)
 * - 'google': SDK Google Maps direct (dev local avec clé API)
 */

/**
 * Détermine le mode backend à utiliser
 * ✅ V310: FORCÉ SUR ORACLE (RAPTOR) - Google désactivé
 * @returns {'vercel' | 'otp' | 'oracle' | 'google'} Le mode backend
 */
export function getBackendMode() {
  // ✅ V310: FORCER LE MODE ORACLE (Oracle Cloud backend)
  console.log('[Config] 🔧 getBackendMode() appelé');
  console.log('[Config] 📍 URL actuelle:', window.location.href);
  console.log('[Config] 📍 Origin:', window.location.origin);
  console.log('[Config] 📍 Hostname:', window.location.hostname);
  console.log('[Config] 📍 Port:', window.location.port);
  
  // Forcer Oracle (backend Oracle Cloud). Le moteur côté serveur est RAPTOR natif.
  console.log('[Config] ✅ MODE FORCÉ: oracle (Oracle Cloud / RAPTOR)');
  return 'oracle';
  
  /* DÉSACTIVÉ - Code original commenté
  // 1. Configuration explicite via window.__APP_CONFIG
  if (window.__APP_CONFIG?.backendMode) {
    return window.__APP_CONFIG.backendMode;
  }
  
  // 2. Détection automatique basée sur l'URL du serveur
  // Si on est sur localhost:3000 (serveur Express), utiliser OTP
  if (window.location.port === '3000' && window.location.hostname === 'localhost') {
    return 'otp';
  }
  
  // 3. Si clé Google présente, mode dev direct
  if (window.__APP_CONFIG?.googleApiKey) {
    return 'google';
  }
  
  // 4. Par défaut: proxy Vercel (production)
  return 'vercel';
  */
}

/**
 * Indique si le mode proxy est activé (clé API côté serveur)
 * @returns {boolean} true si on utilise les proxies Vercel ou OTP
 */
export function useServerProxy() {
  const mode = getBackendMode();
  return mode === 'vercel' || mode === 'otp' || mode === 'oracle';
}

/**
 * Indique si on utilise le backend OTP/Photon
 * @returns {boolean} true si on utilise le serveur Express avec OTP
 */
export function useOtpBackend() {
  const mode = getBackendMode();
  return mode === 'otp' || mode === 'oracle';
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
 * URLs des proxies API Vercel (Google)
 */
export const API_ENDPOINTS = {
  routes: '/api/routes',
  googleRoutes: '/api/google-routes',
  places: '/api/places',
  geocode: '/api/geocode'
};

/**
 * URLs des APIs du serveur Express (OTP/Photon)
 * ✅ V310: /api/places supporte ?q= et ?input=
 */
export const OTP_API_ENDPOINTS = {
  routes: '/api/routes',
  googleRoutes: '/api/google-routes',
  places: '/api/places',
  reverse: '/api/places/reverse',
  realtime: '/api/realtime'
};

/**
 * Retourne les endpoints appropriés selon le mode backend
 * ✅ V310: LOGS DÉTAILLÉS
 * @returns {Object} Endpoints API
 */
export function getApiEndpoints() {
  const useOtp = useOtpBackend();
  console.log('[Config] 🔧 getApiEndpoints() - useOtpBackend():', useOtp);
  if (useOtp) {
    console.log('[Config] ✅ Utilisation OTP_API_ENDPOINTS:', JSON.stringify(OTP_API_ENDPOINTS));
    return OTP_API_ENDPOINTS;
  }
  console.log('[Config] ⚠️ Utilisation API_ENDPOINTS (Google):', JSON.stringify(API_ENDPOINTS));
  return API_ENDPOINTS;
}

/**
 * Retourne la configuration globale de l'application
 * ✅ V310: LOGS DÉTAILLÉS
 * @returns {Object} Configuration avec googleApiKey, adminToken, etc.
 */
export function getAppConfig() {
  console.log('[Config] ═══════════════════════════════════════');
  console.log('[Config] 🔧 getAppConfig() appelé');
  
  const mode = getBackendMode();
  const useProxy = useServerProxy();
  const useOtp = useOtpBackend();
  const endpoints = getApiEndpoints();
  
  console.log('[Config] 📦 Résultats:');
  console.log('[Config]   - backendMode:', mode);
  console.log('[Config]   - useProxy:', useProxy);
  console.log('[Config]   - useOtp:', useOtp);
  console.log('[Config]   - apiEndpoints:', JSON.stringify(endpoints));
  console.log('[Config] ═══════════════════════════════════════');
  
  return {
    googleApiKey: getGoogleApiKey(),
    adminToken: getAdminToken(),
    useProxy: useProxy,
    useOtp: useOtp,
    backendMode: mode,
    apiEndpoints: endpoints,
    arrivalPageSize: 6,
    minBusItineraries: 3,
    maxBottomSheetLevels: 3
  };
}

