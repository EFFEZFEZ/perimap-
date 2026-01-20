# 📋 DOCUMENTATION TECHNIQUE INTERNE - PériMap

> **Version** : 2.6.2 (v430)  
> **Dernière mise à jour** : 20 janvier 2026  
> **Statut** : Production stable

---

## 🎯 RÉSUMÉ EXÉCUTIF

PériMap est une Progressive Web App (PWA) de transport en commun pour le réseau Péribus du Grand Périgueux. L'application offre :

- **Calcul d'itinéraires** hybride (GTFS local + Google Routes API)
- **Temps réel** via proxy vers hawk.perimouv.fr
- **Carte interactive** avec position des bus en temps réel
- **Mode hors ligne** grâce au Service Worker
- **Statistiques de retards** stockées dans Neon PostgreSQL

---

## 🎨 ARCHITECTURE CSS MODULAIRE (V430)

```
public/
├── style.css              ← Point d'entrée (importe css/main.css)
└── css/
    ├── main.css           ← Index des imports
    ├── legacy.css         ← Ancien code (migration progressive)
    ├── brand.css          ← Identité visuelle
    ├── line-pages.css     ← Pages horaires
    ├── delay-stats.css    ← UI statistiques
    ├── data-exporter.css  ← Console admin
    └── modules/
        ├── base/
        │   ├── variables.css   ← Design tokens (couleurs, spacing, etc.)
        │   ├── reset.css       ← Normalisation
        │   ├── typography.css  ← Polices, titres
        │   └── animations.css  ← Keyframes partagées
        ├── layout/
        │   ├── header.css      ← En-tête, logo
        │   ├── navigation.css  ← Bottom nav, menu mobile
        │   └── grid.css        ← Grilles, conteneurs
        ├── components/
        │   ├── buttons.css     ← Boutons (.btn, .btn-primary, etc.)
        │   ├── cards.css       ← Cartes génériques
        │   ├── forms.css       ← Inputs, selects
        │   ├── modals.css      ← Popups modales
        │   ├── popups.css      ← Popovers, tooltips
        │   ├── badges.css      ← Badges lignes
        │   └── loading.css     ← Skeleton, spinners
        ├── pages/
        │   ├── map.css         ← Vue carte
        │   ├── itinerary.css   ← Vue itinéraires (refonte V429)
        │   ├── schedules.css   ← Vue horaires
        │   └── traffic.css     ← Vue trafic
        ├── utilities/
        │   ├── spacing.css     ← Marges, paddings
        │   ├── display.css     ← Flex, hidden, etc.
        │   └── accessibility.css ← Focus, skip links
        └── themes/
            └── dark.css        ← Surcharges dark mode
```

### Comment modifier les styles

1. **Identifier le module** concerné (ex: itinerary.css pour les cartes d'itinéraires)
2. **Modifier dans css/modules/** - pas dans legacy.css
3. **Bump le service worker** dans service-worker.js (incrémenter CACHE_VERSION)
4. **Tester localement** avec `npm run build`

### Migration progressive

Le fichier `css/legacy.css` contient l'ancien code monolithique. Au fur et à mesure :
- Extraire les styles vers le bon module
- Supprimer du legacy.css
- Objectif : legacy.css = 0 lignes

---

## 🏗️ ARCHITECTURE GLOBALE

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   main.js   │  │  Modules    │  │     Web Workers         │  │
│  │  (5547 loc) │  │  config/    │  │  gtfsWorker.js          │  │
│  │             │  │  itinerary/ │  │  routerWorker.js        │  │
│  │  Orchestrat │  │  map/       │  └─────────────────────────┘  │
│  │  ion        │  │  search/    │                               │
│  │             │  │  ui/        │                               │
│  │             │  │  utils/     │                               │
│  └─────────────┘  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL SERVERLESS (api/)                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ realtime.js  │ │  routes.js   │ │  places.js   │            │
│  │ Proxy Hawk   │ │ Proxy Google │ │ Autocomplet. │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │delay-stats.js│ │record-delay  │ │  geocode.js  │            │
│  │ Stats Neon   │ │ Write Neon   │ │Rev. Geocode  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICES EXTERNES                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │hawk.perimouv │ │ Google Maps  │ │ Neon DB      │            │
│  │Temps réel    │ │ Routes API   │ │ PostgreSQL   │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 CARTOGRAPHIE DES FICHIERS

### `/public/js/` - Code Frontend Principal

#### Fichiers Racine (Managers)

| Fichier | Lignes | Rôle | Importe | Exporté par |
|---------|--------|------|---------|-------------|
| **main.js** | 5547 | Point d'entrée, orchestre tout | Tous les modules | - |
| **app.js** | 289 | Bootstrap, SEO, hash routing | viewLoader, main | - |
| **config.js** | 90 | Config runtime, API keys | - | Tous |
| **dataManager.js** | 1538 | Chargement/cache GTFS | gtfsProcessor, stopTimesStore | main, workers |
| **mapRenderer.js** | 1467 | Carte Leaflet, bus markers | realtimeManager | main |
| **router.js** | 1411 | Calcul itinéraires GTFS | formatters | main, worker |
| **apiManager.js** | 1615 | Appels API, caching | config | main |
| **realtimeManager.js** | 863 | Temps réel Hawk | stopKeyMapping | main, mapRenderer |
| **delayManager.js** | 590 | Tracking retards, Neon | delayConfig, neonConfig | main |
| **busPositionCalculator.js** | 793 | Calcul position GPS, snap-to-route | - | main |
| **tripScheduler.js** | 178 | Scheduler trips actifs | dataManager | main |
| **timeManager.js** | 228 | Gestion temps réel/simulé | - | main |
| **uiManager.js** | 454 | Thème, selects time | icons | main |
| **geolocationManager.js** | 218 | Géolocalisation user | - | main |
| **analyticsManager.js** | 290 | Analytics (clics, sessions) | - | main |
| **userPreferences.js** | 162 | Préférences localStorage | - | main |
| **offlineManager.js** | 201 | Mode offline PWA | - | main |
| **dataExporter.js** | 510 | Console admin (Alt+D) | - | main |
| **delayStatsUI.js** | 352 | UI stats retards | - | main |
| **routerWorkerClient.js** | 135 | Client Web Worker | - | main |
| **stopTimesStore.js** | 119 | Cache IndexedDB | - | dataManager |
| **viewLoader.js** | 45 | Chargement HTML fragments | - | app |
| **csp-init.js** | 75 | CSP, lazy loading CSS | - | index.html |
| **linePageLoader.js** | 537 | Pages horaires dynamiques | dataManager | horaires/ligne.html |

#### `/public/js/config/` - Configuration

| Fichier | Lignes | Rôle |
|---------|--------|------|
| **icons.js** | 82 | Icônes SVG centralisées (ICONS, getManeuverIcon) |
| **routes.js** | 171 | Config lignes (LINE_CATEGORIES, PDF_FILENAME_MAP) |
| **stopKeyMapping.js** | 281 | Mapping GTFS ↔ Hawk (HAWK_KEY_BY_STOP_CODE) |
| **delayConfig.js** | 257 | Config système retards (seuils, storage) |
| **neonConfig.js** | 193 | Config Neon DB (REST URL, helpers) |

#### `/public/js/itinerary/` - Logique Itinéraires

| Fichier | Lignes | Rôle |
|---------|--------|------|
| **ranking.js** | 378 | Tri, déduplication, filtrage itinéraires |

#### `/public/js/map/` - Rendu Carte

| Fichier | Lignes | Rôle |
|---------|--------|------|
| **routeDrawing.js** | 556 | Dessin polylines, styles, markers |

#### `/public/js/search/` - Recherche

| Fichier | Lignes | Rôle |
|---------|--------|------|
| **itineraryProcessor.js** | 530 | Parse réponses Google API |
| **searchManager.js** | 256 | État recherche, pagination |

#### `/public/js/ui/` - Interface Utilisateur

| Fichier | Lignes | Rôle |
|---------|--------|------|
| **bottomSheetManager.js** | 310 | Bottom sheet mobile (drag, snap) |
| **installManager.js** | 184 | PWA install prompt |
| **navigationManager.js** | 242 | Navigation entre vues |
| **resultsRenderer.js** | 233 | Rendu liste résultats |
| **trafficInfo.js** | 512 | Infos trafic, état lignes |

#### `/public/js/utils/` - Utilitaires

| Fichier | Lignes | Rôle |
|---------|--------|------|
| **formatters.js** | 278 | Formatage temps, durées, textes |
| **geo.js** | 44 | Normalisation, résolution arrêts |
| **gtfsProcessor.js** | 190 | Nettoyage, indexation GTFS |
| **polyline.js** | 323 | Encodage/décodage polylines |
| **stopName.mjs** | 38 | Normalisation noms arrêts |
| **tripStopTimes.mjs** | 23 | Helpers stop_times GTFS |

#### `/public/js/workers/` - Web Workers

| Fichier | Lignes | Rôle |
|---------|--------|------|
| **gtfsWorker.js** | 185 | Chargement GTFS en background |
| **routerWorker.js** | 136 | Calcul itinéraires hors main thread |

---

### `/api/` - Serverless Functions Vercel

| Fichier | Lignes | Méthode | Route | Rôle |
|---------|--------|---------|-------|------|
| **realtime.js** | 395 | GET | /api/realtime?keys=... | Proxy temps réel Hawk (stealth) |
| **routes.js** | 258 | POST | /api/routes | Proxy Google Routes API |
| **places.js** | 354 | GET | /api/places?q=... | Autocomplétion (communes + Google) |
| **geocode.js** | 93 | GET | /api/geocode?lat=&lng= | Reverse geocoding |
| **delay-stats.js** | 244 | GET | /api/delay-stats | Stats retards depuis Neon |
| **record-delay.js** | 161 | POST | /api/record-delay | Enregistre retard dans Neon |

---

## 🔄 FLUX DE DONNÉES

### Calcul d'itinéraire

```
1. User tape départ/arrivée
   └→ apiManager.geocode() → /api/places
   
2. User clique "Rechercher"
   └→ routerWorkerClient.computeHybridItinerary()
      ├→ router.js (GTFS local) → Itinéraires bus
      └→ /api/routes (Google) → Itinéraires vélo/marche
      
3. Résultats fusionnés
   └→ ranking.js → Déduplique, trie
   └→ resultsRenderer.js → Affiche
```

### Temps réel

```
1. App démarre
   └→ realtimeManager.init() 
      └→ preloadPriorityStops() → /api/realtime?keys=batch
      
2. User ouvre popup arrêt
   └→ realtimeManager.getNextDepartures(stopId)
      └→ /api/realtime?keys=xxx
      
3. Auto-refresh (60s)
   └→ realtimeManager.startAutoRefresh()
```

### Position bus sur carte

```
1. timeManager.tick() (chaque seconde)
   └→ tripScheduler.getActiveTrips()
   └→ busPositionCalculator.calculatePosition()
      └→ Snap-to-route (shapes GTFS)
      └→ Ajustement retard (realtimeManager)
   └→ mapRenderer.updateBusMarkers()
```

---

## 💾 STOCKAGE

### LocalStorage

| Clé | Contenu |
|-----|---------|
| `perimap_user_prefs` | Lignes favorites, thème, historique clics |
| `perimap_delay_stats` | Stats retards locales (avant sync Neon) |
| `ui-theme` | Thème actuel (dark/light/auto) |
| `pwa-install-dismissed` | Si le prompt PWA a été fermé |

### IndexedDB

| DB | Store | Contenu |
|----|-------|---------|
| `perimap-gtfs-cache` | `dataset` | Données GTFS complètes |
| `peribus_stop_times_store` | `stopTimesByTrip` | stop_times par trip_id |

### Service Worker Cache

| Cache | Stratégie | Contenu |
|-------|-----------|---------|
| `peribus-v428` | Cache-first | JS, CSS, fonts, images |
| | Stale-while-revalidate | Données GTFS |
| | Network-first | Pages HTML |

---

## 🛠️ CONFIGURATION ENVIRONNEMENT

### Variables Vercel

| Variable | Requis | Description |
|----------|--------|-------------|
| `GMAPS_SERVER_KEY` | ✅ | Clé API Google Maps (serveur) |
| `DATABASE_URL` | ⚠️ | URL Neon PostgreSQL |
| `KV_REST_API_URL` | ❌ | Vercel KV (non utilisé) |

### Base Neon

```sql
CREATE TABLE delay_reports (
  id SERIAL PRIMARY KEY,
  line_code VARCHAR(10),
  stop_name VARCHAR(100),
  stop_id VARCHAR(50),
  scheduled_time TIME,
  delay_minutes INT,
  direction VARCHAR(100),
  is_realtime BOOLEAN DEFAULT true,
  trip_id VARCHAR(100),
  source VARCHAR(20) DEFAULT 'hawk',
  reported_at TIMESTAMP DEFAULT NOW()
);
```

---

## ✅ CE QUI EST FAIT

### Fonctionnalités Core
- [x] Calcul itinéraires hybride GTFS + Google
- [x] Temps réel Hawk avec proxy stealth
- [x] Carte temps réel avec position bus
- [x] Mode hors ligne (Service Worker)
- [x] PWA installable
- [x] Thème clair/sombre automatique
- [x] Autocomplétion intelligente

### Optimisations
- [x] Web Workers pour GTFS et routing
- [x] IndexedDB pour cache GTFS
- [x] Snap-to-route pour position bus
- [x] Préchargement arrêts prioritaires
- [x] Cache CDN Vercel Edge

### Intégrations
- [x] Neon PostgreSQL pour stats retards
- [x] Google Maps Platform (Routes, Geocoding)
- [x] Hawk.perimouv.fr (temps réel)

---

## ⚠️ À NE PAS REFAIRE

### Erreurs Passées Corrigées

1. **Modules dupliqués (v427)**
   - ❌ Créé `ui/themeManager.js`, `ui/screenManager.js`, etc.
   - ❌ Ces modules n'étaient pas importés → code mort
   - ✅ Supprimés dans v428

2. **Interface admin inutilisée**
   - ❌ `api/admin-token.js` jamais utilisé en prod
   - ✅ Supprimé dans v428

3. **Reset-cache.js**
   - ❌ Script de debug laissé dans le build
   - ✅ Supprimé dans v428

### Règles à Suivre

- **Avant de factoriser** : Vérifier si le code existe déjà dans main.js
- **Avant de créer un module** : S'assurer qu'il sera importé quelque part
- **Garder main.js monolithique** : C'est le design actuel, pas un bug

---

## 🚧 TODO / AMÉLIORATIONS FUTURES

### Court terme
- [ ] Tests unitaires pour router.js
- [ ] Tests E2E avec Playwright
- [ ] Monitoring erreurs (Sentry)

### Moyen terme
- [ ] Notifications push (départs imminents)
- [ ] Mode "favoris" avec widget Android
- [ ] Intégration vélo (API stations)

### Long terme
- [ ] App native (React Native ou Capacitor)
- [ ] Support multi-réseaux (autres villes)

---

## 📊 MÉTRIQUES

### Taille du bundle
- **main.js** : ~180 KB (minifié)
- **Total JS** : ~250 KB
- **Total CSS** : ~45 KB

### Performance Lighthouse
- Performance : 92/100
- Accessibility : 95/100
- Best Practices : 100/100
- SEO : 100/100

### Données GTFS
- Routes : 36 lignes
- Stops : 1300+ arrêts
- Trips : ~2000 trips/jour
- Stop_times : ~50,000 entrées

---

## 📝 HISTORIQUE DES VERSIONS

| Version | Date | Changements majeurs |
|---------|------|---------------------|
| v428 | 20/01/2026 | Nettoyage code mort, suppression admin-token |
| v427 | 19/01/2026 | Pages horaires dynamiques |
| v426 | 18/01/2026 | Intégration Neon DB + GPS snap-to-route |
| v425 | 15/01/2026 | Préchargement batch temps réel |

---

> **Maintenu par** : Équipe PériMap  
> **Contact** : via GitHub Issues
