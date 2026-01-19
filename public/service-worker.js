/*
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 * Service Worker v409 - Version ultra-légère SANS blocage
 * 
 * AUCUNE restriction, AUCUN nettoyage agressif
 * Network-first pour tout, cache en fallback
 */

const CACHE_VERSION = 'v409';
const CACHE_NAME = `peribus-${CACHE_VERSION}`;

// Assets à pré-cacher (minimum vital)
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

/**
 * Installation: Simple, non-bloquante
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
 * Activation: Nettoie SEULEMENT les anciens caches SW
 * NE TOUCHE PAS à IndexedDB ni localStorage
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] 🚀 Activation', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => {
        console.log('[SW] Suppression cache:', k);
        return caches.delete(k);
      })))
      .then(() => self.clients.claim())
      .catch(() => self.clients.claim())
  );
});

/**
 * Fetch: Network-first SIMPLE
 * Ne bloque JAMAIS - laisse passer tout
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Laisser passer sans interception:
  // - Autres protocoles
  // - Non-GET
  // - Cross-origin
  // - APIs
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Network-first avec fallback cache
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, clone).catch(() => {});
          }).catch(() => {});
        }
        return response;
      })
      .catch(() => {
        return caches.match(request)
          .then(cached => cached || caches.match('/index.html'))
          .catch(() => new Response('Offline', { status: 503 }));
      })
  );
});

/**
 * Messages
 */
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data === 'getVersion' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

