/*
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * Service Worker - Stratégie optimisée pour performance
 * 
 * STRATÉGIES:
 * - Cache-First pour assets statiques (CSS, JS, images)
 * - Stale-While-Revalidate pour données GTFS
 * - Network-First pour APIs externes
 * 
 * IMPORTANT: Incrémentez CACHE_VERSION à chaque déploiement !
 */

const CACHE_VERSION = 'v312'; // ✅ v312: Polylines OTP + blocage Google sans clé
const CACHE_NAME = `peribus-cache-${CACHE_VERSION}`;
const STATIC_CACHE = `peribus-static-${CACHE_VERSION}`;
const DATA_CACHE = `peribus-data-${CACHE_VERSION}`;

// Assets critiques à pré-cacher (chargés immédiatement)
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/horaires.html',
  '/horaires-ligne-a.html',
  '/horaires-ligne-b.html',
  '/horaires-ligne-c.html',
  '/horaires-ligne-d.html',
  '/itineraire.html',
  '/trafic.html',
  '/carte.html',
  '/about.html',
  '/mentions-legales.html',
  '/style.css',
  '/css/brand.css',
  '/css/line-pages.css',
  '/js/app.js',
  '/manifest.json'
];

// Assets secondaires (chargés en arrière-plan)
const SECONDARY_ASSETS = [
  '/js/main.js',
  '/js/dataManager.js',
  '/js/mapRenderer.js',
  '/js/router.js',
  '/js/routerWorkerClient.js',
  '/js/geolocationManager.js',
  '/js/busPositionCalculator.js',
  '/js/tripScheduler.js',
  '/js/timeManager.js',
  '/js/apiManager.js',
  '/js/stopTimesStore.js',
  '/js/uiManager.js',
  '/js/viewLoader.js',
  '/js/config.js',
  '/js/realtimeManager.js',
  '/js/analyticsManager.js',
  '/js/delayManager.js',
  '/js/dataExporter.js',
  '/js/delayStatsUI.js',
  '/js/offlineManager.js',
  '/js/config/icons.js',
  '/js/config/routes.js',
  '/js/config/stopKeyMapping.js',
  '/js/config/delayConfig.js',
  '/js/utils/formatters.js',
  '/js/utils/geo.js',
  '/js/utils/stopName.mjs',
  '/js/utils/tripStopTimes.mjs',
  '/js/utils/polyline.js',
  '/js/utils/gtfsProcessor.js',
  '/js/itinerary/ranking.js',
  '/js/ui/resultsRenderer.js',
  '/js/ui/trafficInfo.js',
  '/js/ui/bottomSheetManager.js',
  '/js/ui/navigationManager.js',
  '/js/ui/installManager.js',
  '/js/map/routeDrawing.js',
  '/js/search/itineraryProcessor.js',
  '/js/search/searchManager.js',
  '/js/workers/gtfsWorker.js',
  '/js/workers/routerWorker.js',
  '/views/hall.html',
  '/views/horaires.html',
  '/views/carte.html',
  '/views/itineraire.html',
  '/views/trafic.html',
  '/views/tarifs-achat.html',
  '/views/tarifs-amendes.html',
  '/views/tarifs-billettique.html',
  '/views/tarifs-grille.html',
  '/css/brand.css',
  '/css/line-pages.css',
  '/css/delay-stats.css',
  '/css/data-exporter.css'
];

// Patterns pour Network-Only
const NETWORK_ONLY = ['/api/', 'google', 'googleapis', 'ibb.co', 'line-status.json'];

// Patterns pour données GTFS (cache long terme)
const GTFS_PATTERNS = ['/data/gtfs/', '.json', '.txt'];

// Ajout robuste en cache: ignore les ressources manquantes pour ne pas casser l'installation
async function cacheUrlsSafely(cacheName, urls, label) {
  const cache = await caches.open(cacheName);
  for (const url of urls) {
    try {
      await cache.add(url);
    } catch (err) {
      console.warn(`[SW] ⚠️ ${label} non mis en cache (ignoré):`, url, err?.message || err);
    }
  }
}

/**
 * Installation: Pré-cache les assets critiques, puis secondaires
 */
self.addEventListener('install', (event) => {
  console.log('[SW] 📦 Installation version', CACHE_VERSION);
  event.waitUntil(
    (async () => {
      try {
        // Cache critique en priorité (tolérant aux 404)
        await cacheUrlsSafely(STATIC_CACHE, CRITICAL_ASSETS, 'Asset critique');
        console.log('[SW] ✅ Assets critiques cachés (best effort)');
        
        // Cache secondaire en arrière-plan (non-bloquant, tolérant aux 404)
        cacheUrlsSafely(STATIC_CACHE, SECONDARY_ASSETS, 'Asset secondaire').catch(err => {
          console.warn('[SW] ⚠️ Cache secondaire partiel:', err);
        });
        
        // Force la nouvelle version
        await self.skipWaiting();
        console.log('[SW] ✅ Service Worker activé immédiatement');
      } catch (err) {
        console.error('[SW] Erreur installation:', err);
      }
    })()
  );
});

/**
 * Activation: Nettoie TOUS les anciens caches + anciens stores
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] 🚀 Activation version', CACHE_VERSION, '- Nettoyage agressif');
  event.waitUntil(
    (async () => {
      try {
        // 1. Supprimer TOUS les anciens caches
        const keys = await caches.keys();
        const deletePromises = keys.map(key => {
          if (!key.includes(CACHE_VERSION)) {
            console.log('[SW] ❌ Suppression cache obsolète:', key);
            return caches.delete(key);
          }
        });
        await Promise.all(deletePromises);
        console.log('[SW] ✅ Caches nettoyés');

        // 2. Nettoyer les IndexedDB et LocalStorage obsolètes
        try {
          const dbs = await indexedDB.databases();
          dbs.forEach(db => {
            console.log('[SW] 🗑️ Vidage IndexedDB:', db.name);
            indexedDB.deleteDatabase(db.name);
          });
        } catch (err) {
          console.warn('[SW] Erreur nettoyage IndexedDB:', err);
        }

        // 3. Réclamer tous les clients
        await self.clients.claim();
        console.log('[SW] ✅ Tous les clients réclamés');
        
        // 4. Notifier tous les clients
        const allClients = await self.clients.matchAll();
        allClients.forEach(client => {
          client.postMessage({
            type: 'CACHE_UPDATED',
            version: CACHE_VERSION,
            message: 'Nouvelle version Périmap disponible - Page rechargée'
          });
        });

      } catch (err) {
        console.error('[SW] Erreur activation:', err);
      }
    })()
  );
});

/**
 * Fetch: Stratégies différenciées selon le type de ressource
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorer non-GET
  if (request.method !== 'GET') return;
  
  // Network-only pour APIs externes
  if (NETWORK_ONLY.some(p => request.url.includes(p))) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }
  
  // Stale-While-Revalidate pour assets statiques (JS, CSS, HTML)
  // Objectif: éviter un site "figé" entre deux versions.
  if (url.origin === self.location.origin &&
      (request.url.endsWith('.js') || request.url.endsWith('.css') || request.url.endsWith('.html'))) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }
  
  // Stale-While-Revalidate pour données GTFS
  if (GTFS_PATTERNS.some(p => request.url.includes(p))) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }
  
  // Par défaut: Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
});

/**
 * Cache-First: Retourne le cache, sinon réseau
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match('/index.html');
  }
}

/**
 * Stale-While-Revalidate: Retourne le cache, met à jour en arrière-plan
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  // Revalidation en arrière-plan
  const networkPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  
  return cached || networkPromise || caches.match('/index.html');
}

/**
 * Message: Permet de forcer une mise à jour depuis l'app
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message reçu:', event.data);
  
  if (event.data === 'skipWaiting') {
    console.log('[SW] 🔄 Activation immédiate demandée');
    self.skipWaiting();
  }
  
  if (event.data === 'clearCache') {
    console.log('[SW] 🗑️ Suppression de tous les caches');
    caches.keys().then(keys => {
      keys.forEach(k => {
        console.log('[SW] Suppression:', k);
        caches.delete(k);
      });
    });
  }

  if (event.data === 'getVersion') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

