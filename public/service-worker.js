/*
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 * Service Worker v414 - Performance optimisée + cache intelligent
 * 
 * Stratégies:
 * - Cache-first pour assets statiques (CSS, JS, fonts, images)
 * - Stale-while-revalidate pour données GTFS
 * - Network-first pour pages HTML
 */

const CACHE_VERSION = 'v416';
const CACHE_NAME = `peribus-${CACHE_VERSION}`;

// Assets à pré-cacher au premier chargement
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/style.css',
  '/js/main.js',
  '/js/dataManager.js',
  '/js/userPreferences.js'
];

// Patterns pour stratégies de cache
const CACHE_FIRST_PATTERNS = [
  /\.js$/,
  /\.css$/,
  /\.woff2?$/,
  /\.ttf$/,
  /\.png$/,
  /\.jpg$/,
  /\.svg$/,
  /\/icons\//
];

const STALE_REVALIDATE_PATTERNS = [
  /\/data\/gtfs\//,
  /\/data\/express-lines\.json$/
];

/**
 * Installation: Pré-cache les assets essentiels
 */
self.addEventListener('install', (event) => {
  console.log('[SW] 📦 Installation', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

/**
 * Activation: Nettoie les anciens caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] 🚀 Activation', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('peribus-') && k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Suppression ancien cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim())
      .catch(() => self.clients.claim())
  );
});

/**
 * Déterminer la stratégie de cache
 */
function getCacheStrategy(url) {
  const pathname = url.pathname;
  
  // Cache-first pour assets statiques
  if (CACHE_FIRST_PATTERNS.some(p => p.test(pathname))) {
    return 'cache-first';
  }
  
  // Stale-while-revalidate pour données GTFS
  if (STALE_REVALIDATE_PATTERNS.some(p => p.test(pathname))) {
    return 'stale-revalidate';
  }
  
  // Network-first pour le reste (HTML, API)
  return 'network-first';
}

/**
 * Cache-first: Utilise le cache d'abord, réseau si absent
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Stale-while-revalidate: Retourne le cache immédiatement, met à jour en arrière-plan
 */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  
  // Lancer la mise à jour en arrière-plan
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      caches.open(CACHE_NAME).then(cache => {
        cache.put(request, response.clone()).catch(() => {});
      }).catch(() => {});
    }
    return response;
  }).catch(() => cached);
  
  // Retourner le cache immédiatement ou attendre le réseau
  return cached || fetchPromise;
}

/**
 * Network-first: Réseau d'abord, cache en fallback
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('/index.html').then(r => r || new Response('Offline', { status: 503 }));
  }
}

/**
 * Fetch: Routage intelligent selon le type de ressource
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas intercepter:
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const strategy = getCacheStrategy(url);
  
  switch (strategy) {
    case 'cache-first':
      event.respondWith(cacheFirst(request));
      break;
    case 'stale-revalidate':
      event.respondWith(staleWhileRevalidate(request));
      break;
    default:
      event.respondWith(networkFirst(request));
  }
});

/**
 * Messages
 */
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data === 'getVersion' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
  // Permettre un rafraîchissement forcé du cache GTFS
  if (event.data === 'refreshGtfs') {
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all([
        cache.delete('/data/gtfs/routes.txt'),
        cache.delete('/data/gtfs/trips.txt'),
        cache.delete('/data/gtfs/stops.txt'),
        cache.delete('/data/gtfs/stop_times.txt')
      ]);
    }).catch(() => {});
  }
});