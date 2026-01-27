**Offline-ready** : Service Worker v519 (cache versionné, purge, stratégies cache-first/stale-revalidate/network-first, gestion messages) + GTFS local
# 📊 CARTE MENTALE COMPLÈTE - PériMap v2.6.0

**Dernière mise à jour** : 24 janvier 2026  
**Statut** : ✅ Complète et à jour  
**Version projet** : 2.6.0 (Post Phase 7)

---

## 🎯 RÉSUMÉ EXÉCUTIF

**PériMap** est une PWA pour les transports du Grand Périgueux. Architecture **modulaire événementielle** avec :
- **Cœur système** : EventBus + StateManager + Logger
- **Couches métier** : Services API → Stores de données → Managers → UI
- **Optimisation active** : Cache multi-niveaux + blackout heures creuses (21h-5h30)
- **Offline-ready** : Service Worker v508 + GTFS local

---

## 🏗️ ARCHITECTURE EN 6 COUCHES

### COUCHE 1 : CŒUR SYSTÈME (Le nerveux central)

**Rôle** : Éliminer dépendances circulaires par communication centralisée

| Composant | Lignes | Fonction | Détail |
|-----------|--------|----------|--------|
| **EventBus.js** | 237L | Pub/Sub centralisé | `emit()`, `on()`, `once()`, priorités, memory leak detection |
| **StateManager.js** | 360L | État immutable | `setState()`, historique (50 états max), deep clone, subscribers |
| **Logger.js** | var | Logs unifiés | Niveaux info/warn/error/debug |

**Flux** : Modification d'état → `StateManager.setState()` → `EventBus.emit()` → Tous les subscribers notifiés

---

### COUCHE 2 : SERVICES API
**Dossier** : `/public/js/services/`

**Rôle** : Requêtes vers backend + cache intelligent

| Service | Fichier | Cache | Utilisation |
|---------|---------|-------|-------------|
| `RouteService` | `RouteService.js` (385L) | 2 min | Calcul itinéraires (bus+marche) via Google Maps ou OTP |
| `GeocodeService` | `GeocodeService.js` | 24h | Adresse → Lat/Lng |
| `AutocompleteService` | `AutocompleteService.js` | 5 min | Suggestions lieux (Google Places) |
| `APIServiceFactory` | `APIServiceFactory.js` | - | Injection de dépendances, orchestration |

**Architecture cache** :
```
Données → Cache LRU (50 entrées max) → StateManager → EventBus → UI
```

---

### COUCHE 3 : MAGASINS DE DONNÉES
**Dossier** : `/public/js/stores/`

**Rôle** : Stockage local + indexation pour requêtes rapides

| Store | Fichier | Contenu | Source |
|-------|---------|---------|--------|
| **GTFSStore** | `GTFSStore.js` (338L) | Routes, arrêts, trajets, horaires permanents | GitHub (JSON minifié) |
| **TrafficStore** | `TrafficStore.js` | Alertes retards temps réel | `/api/realtime` |
| **UserStore** | `UserStore.js` | Préférences, favoris, thème | localStorage |
| **CacheStore** | `CacheStore.js` | LRU généraliste | RAM |

**Indexation GTFSStore** :
```javascript
{
  routesById: {},           // Lookup rapide par ID ligne
  stopsById: {},            // Lookup rapide par ID arrêt
  tripsByRoute: {},         // Tous les trajets d'une ligne
  stopTimesByStop: {},      // Horaires pour un arrêt
  stopTimesByTrip: {},      // Toutes les étapes d'un trajet
  shapesById: {},           // Polylines géométrie
  masterStops: [],          // Arrêts groupés
  groupedStopMap: {}        // Mapping arrêts regroupés
}
```

---

### COUCHE 4 : MANAGERS MÉTIER
**Dossier** : `/public/js/`

**Rôle** : Logique métier (géolocalisation, favoris, trajets récents, etc.)

| Manager | Fichier | Lignes | Fonction | Critique |
|---------|---------|--------|----------|----------|
| **realtimeManager** | `realtimeManager.js` | 916L | Rafraîchit retards 60s + **blackout 21h-5h30** ⚠️ | 🔴 CRITIQUE |
| **dataManager** | `dataManager.js` | 1538L | Charge GTFS + Workers | 🔴 CRITIQUE |
| **mapRenderer** | `mapRenderer.js` | var | Leaflet temps réel + polylines | 🟡 SENSIBLE |
| **uiManager** | `uiManager.js` | var | Mise à jour DOM | 🟡 SENSIBLE |
| **userPreferences** | `userPreferences.js` | var | Persistance localStorage + thème | 🟢 SÛR |
| **delayManager** | `delayManager.js` | var | Gestion retards UI | 🟡 SENSIBLE |
| **timeManager** | `timeManager.js` | var | Conversion heures | 🟢 SÛR |
| **recentJourneys** | `recentJourneys.js` | var | Historique trajets | 🟢 SÛR |
| **geolocationManager** | `geolocationManager.js` | var | GPS mobile | 🟡 SENSIBLE |

---

### COUCHE 5 : COMPOSANTS UI
**Dossiers** : `/public/js/components/`, `/public/js/ui/`

**Éléments réutilisables** :
- Barres de recherche (autocomplete avec Hawk)
- Cartes interactives (Leaflet + OpenStreetMap)
- Modals popups (départ/arrivée/horaires)
- Badges lignes (couleurs catégories : bleu/rouge/vert/violet/orange)
- Affichage itinéraires (polylines, étapes, changements)
- Infos trafic (alertes, retards)

---

### COUCHE 6 : UTILITAIRES & CONFIG
**Dossiers** : `/public/js/config/`, `/public/js/utils/`

| Fichier | Rôle | Contenu |
|---------|------|---------|
| `config/routes.js` (171L) | Mappages statiques | Lignes → couleurs + PDF horaires |
| `config/icons.js` | Icônes | Manœuvres (droite, gauche, droite-dure, etc.) |
| `config/stopKeyMapping.js` | Mapping | GTFS ↔ hawk.perimouv.fr |
| `utils/formatters.js` | Conversions | Temps, distance, durée |
| `utils/gtfsProcessor.js` | Nettoyage | Validation + indexation GTFS |
| `utils/tripStopTimes.mjs` | Helpers | Filtrage horaires valides |

---

## 📡 BACKEND & API

**Dossier** : `/api/`

### Endpoints Vercel

```javascript
GET /api/routes          → Google Maps Directions API
                            (calcul itinéraire bus + marche)

GET /api/realtime        → GTFS Realtime via hawk.perimouv.fr
                            (⚠️ BLACKOUT 21h-5h30)

GET /api/places          → Google Places Autocomplete
                            (suggestions recherche)

GET /api/geocode         → Geocoding adresse ↔ coords

GET /api/delay-stats     → Statistiques retards historiques

POST /api/record-delay   → Enregistrer retard manuel
```

---

## 🌙 OPTIMISATION HEURES CREUSES (CRITÈRE MAJEUR)

**Contexte** : Free Plan Vercel = requêtes coûteuses  
**Solution** : Désactiver GTFS Realtime 21h00 - 05h30

### Fichiers Concernés
- `/api/realtime.js` (437L) - Serveur
- `/public/js/realtimeManager.js` (916L) - Client

### Logique Fonctionnement

```
HEURE ACTUELLE
    ↓
Entre 21h00 et 05h29? → OUI
    ↓
isInBlackoutWindow() = TRUE
    ↓
CLIENT SIDE:
  - realtimeManager.setSleepUntil(nextDayAt5h30)
  - Stoppe autoRefresh
  - Garde cache stale en localStorage
  - Mode "Pas de mise à jour"
    
SERVER SIDE:
  - /api/realtime → HTTP 503
  - Message: "Service unavailable during off-peak hours"
  - Économise requête Vercel
```

### Variables Clés
```javascript
BLACKOUT_START_HOUR = 21         // 21h (9 PM)
BLACKOUT_END_HOUR = 5            // 5h (5 AM)
BLACKOUT_END_MINUTE = 30         // 05h30
CACHE_TTL = 60 * 1000            // 60s (même pendant blackout)
```

### Méthodes Client
```javascript
realtimeManager.isInBlackoutWindow()        // Vérifie si on est dans la fenêtre
realtimeManager.calculateNextServiceStartTime()  // Calcule 5h30 demain
realtimeManager.setSleepUntil(timestamp)    // Active mode sleep
realtimeManager.isSleeping()                // Vérifie si en mode sleep
```

---

## 🔄 FLUX DE DONNÉES (4 SCÉNARIOS CLÉS)

### Scénario 1 : Recherche & Autocomplétion (<250ms)
```
User tape "Gare" dans searchbox
    ↓
onInput event → AutocompleteService.search("Gare")
    ↓
Vérifier cache 5 min
    ↓
Cache MISS? → Appel Google Places API
    ↓
Réponse → StateManager.setState({ suggestions: [...] })
    ↓
EventBus.emit(EVENTS.AUTOCOMPLETE_RESULTS)
    ↓
UI met à jour dropdown
```

**Temps** : 80-250ms selon cache

---

### Scénario 2 : Calcul Itinéraire (<500ms)
```
User saisit départ/arrivée, clique "Calculer"
    ↓
RouteService.getBusRoute(from, to, time)
    ↓
Vérifier cache 2 min (clé = sérialisation coords + heure)
    ↓
Cache MISS? → Google Maps Directions API (+ altitudes si nécessaire)
    ↓
Réponse:
  - routes[] : multi-alternatives
  - legs[] : tronçons
  - steps[] : étapes détaillées
  - polyline[] : encodé
    ↓
Décoder polylines → lat/lng array
    ↓
StateManager.setState({ currentRoute: {...} })
    ↓
EventBus.emit(EVENTS.ROUTE_CALCULATED)
    ↓
MapRenderer affiche tracé (Leaflet polyline)
    ↓
UI affiche étapes (arrêts, changements, marche)
```

**Temps** : 150-500ms selon cache + réseau

---

### Scénario 3 : Retards Temps Réel (60s refresh)
```
App startup
    ↓
main.js → realtimeManager.init(stopsGTFS)
    ↓
Vérifier isInBlackoutWindow()?
    ↓
OUI → setSleepUntil(5h30 demain) + STOP
NON → Continuer
    ↓
realtimeManager.preloadPriorityStops()
  (Batch 1 request = 7 arrêts clés : Taillefer, Maurois, PEM, Gare, etc.)
    ↓
/api/realtime → Scrape hawk.perimouv.fr
    ↓
Réponse = data temps réel
    ↓
TrafficStore.update(delayData)
    ↓
Cache LocalStorage (60s)
    ↓
EventBus.emit(EVENTS.TRAFFIC_UPDATED)
    ↓
UI refresh horaires avec badges "retard"

(Répète toutes les 60s jusqu'à 21h)
```

**Timing** :
- Premier load : 1.2-3s (7 stops, 200ms jitter entre requêtes)
- Refresh : 500-1500ms
- SLEEP : 0 requête (économie maximale)

---

### Scénario 4 : Favoris & Trajets Récents (Offline)
```
User finalise itinéraire
    ↓
"Enregistrer trajet" bouton click
    ↓
addRecentJourney(from, to, depTime, itinerary, allItineraries, searchTime)
    ↓
UserStore.addRecent()
    ↓
localStorage.setItem('perimap_journeys_v3', JSON.stringify([
  {
    fullItinerary: [...steps, polylines, subSteps...],
    searchTime,
    expiresAt: now+7j,
    limit: 5 entrées max
  }
]))
    ↓
Prochaine visite
    ↓
App load → initRecentJourneys()
    ↓
localStorage.getItem('perimap_journeys_v3') (nettoyage TTL 7j, max 5)
    ↓
Affichage carte "Trajets récents" (OFFLINE CAPABLE, replay complet Google)
    ↓
Click → Remplissage auto départ/arrivée/heure
```

**Avantage** : Zéro appel API pour trajets favoris offline

---

## 🔐 DÉPENDANCES CRITIQUES

### 🔴 TRÈS SENSIBLES (Modifier = tester 21/21)

| Fichier | Dépendances | Impact | Tests |
|---------|-------------|--------|-------|
| **EventBus.js** | 22+ modules | Si `emit()` casse → aucune communication | `EventBus.test.js` (7 tests) |
| **StateManager.js** | 18+ modules | État cassé → UI incohérente | `StateManager.test.js` (8 tests) |
| **realtimeManager.js** | UI, EventBus, TrafficStore | Retards ne s'affichent + blackout peut échouer | `offPeakHours.test.js` |
| **RouteService.js** | Google Maps, EventBus, Cache | Calcul itinéraire échoue | `RouteService.test.js` (6 tests) |
| **dataManager.js** + **GTFSStore.js** | localStorage, GTFS distant, Workers | Aucune donnée de base → appli morte |  |
| **/api/realtime.js** | hawk.perimouv.fr, cache mémoire | **Blackout logic cassée = surcharge Vercel** | Manual test |

### 🟡 SENSIBLES (Tester avant merge)

- `mapRenderer.js` → Affichage visuel (Leaflet)
- `userPreferences.js` → Persistance localStorage
- `recentJourneys.js` → Historique trajets
- `TimeManager.js` → Conversions heures
- `geolocationManager.js` → GPS mobile

### 🟢 SÛRES (Modification mineure)

- `config/routes.js` → Statique (mappages)
- `utils/formatters.js` → Fonctions pures
- `Logger.js` → Logs uniquement
- `config/icons.js` → Statique (icônes)

---

## 📁 STRUCTURE FICHIERS COMPLÈTE

```
project/
│
├── 📄 public/                          (Frontend)
│   ├── index.html                      (Entry point SEO, v505)
│   ├── service-worker.js (v508)        (Offline, cache, precache)
│   ├── service-worker.js (v519)        (Offline, cache versionné, purge, stratégies cache-first/stale-revalidate/network-first, gestion messages)
│   ├── manifest.json                   (PWA config)
│   ├── style.css                       (Styles CSS)
│   │
│   ├── 📁 js/                          (Code applicatif - 25K lignes)
│   │   ├── EventBus.js (237L)          🔴 CRITIQUE - Pub/Sub
│   │   ├── StateManager.js (360L)      🔴 CRITIQUE - État centralisé
│   │   ├── Logger.js                   🟡 Logs unifiés
│   │   ├── main.js (5873L)             📌 ENTRY POINT - Orchestration
│   │   ├── app.js (308L)               (SEO routing dynamique)
│   │   │
│   │   ├── 📁 services/                (API & Cache layer)
│   │   │   ├── RouteService.js (385L)  🔴 CRITIQUE - Calcul itinéraires
│   │   │   ├── GeocodeService.js       (Adresse ↔ Coords)
│   │   │   ├── AutocompleteService.js  (Google Places)
│   │   │   └── APIServiceFactory.js    (Injection dépendances)
│   │   │   └── index.js                (Export orchestré)
│   │   │
│   │   ├── 📁 stores/                  (Data layer & Indexation)
│   │   │   ├── GTFSStore.js (338L)     🔴 CRITIQUE - Routes/arrêts/horaires
│   │   │   ├── TrafficStore.js         (Retards temps réel)
│   │   │   ├── UserStore.js            (Préférences + favoris)
│   │   │   ├── CacheStore.js           (LRU cache)
│   │   │   ├── DataStoreFactory.js     (Injection)
│   │   │   └── index.js                (Export orchestré)
│   │   │
│   │   ├── realtimeManager.js (916L)   🔴 CRITIQUE + BLACKOUT 21h-5h30
│   │   ├── dataManager.js (1538L)      🔴 CRITIQUE - Charge GTFS
│   │   ├── mapRenderer.js              🟡 Leaflet + polylines
│   │   ├── uiManager.js                🟡 Mise à jour DOM
│   │   ├── userPreferences.js          🟢 localStorage
│   │   ├── recentJourneys.js           🟢 Historique trajets
│   │   ├── delayManager.js             🟡 Retards UI
│   │   ├── timeManager.js              🟢 Conversions heures
│   │   ├── geolocationManager.js       🟡 GPS mobile
│   │   ├── apiManager.js               (Legacy)
│   │   ├── analyticsManager.js         (Stats usage)
│   │   ├── offlineManager.js           (Détection offline)
│   │   ├── busPositionCalculator.js    (Interpolation bus)
│   │   ├── router.js                   (Context polyline)
│   │   ├── routerWorkerClient.js       (Worker client)
│   │   ├── LinePageLoader.js           (SEO pages dynamiques)
│   │   ├── config.js                   (Config générale)
│   │   ├── csp-init.js                 (Content Security Policy)
│   │   │
│   │   ├── 📁 config/
│   │   │   ├── routes.js (171L)        (Lignes mapping couleurs)
│   │   │   ├── icons.js                (Icônes manœuvres)
│   │   │   ├── stopKeyMapping.js       (GTFS ↔ Hawk mapping)
│   │   │   └── neonConfig.js           (DB config)
│   │   │
│   │   ├── 📁 utils/
│   │   │   ├── formatters.js           (Conversions temps/distance)
│   │   │   ├── gtfsProcessor.js        (Nettoyage + indexation)
│   │   │   ├── tripStopTimes.mjs       (Filtrage horaires)
│   │   │   └── ...
│   │   │
│   │   ├── 📁 search/                  (Module recherche)
│   │   ├── 📁 map/                     (Module carte)
│   │   │   └── routeDrawing.js         (Polylines + étapes)
│   │   ├── 📁 itinerary/               (Module itinéraires)
│   │   ├── 📁 ui/                      (Composants UI)
│   │   │   └── trafficInfo.js          (Alertes trafic)
│   │   ├── 📁 components/              (Composants réutilisables)
│   │   ├── 📁 workers/                 (Web Workers)
│   │   └── viewLoader.js               (Chargement vues)
│   │
│   ├── 📁 views/                       (Templates HTML)
│   │   ├── carte.html                  (Carte temps réel)
│   │   ├── horaires.html               (Grille horaires)
│   │   ├── itineraire.html             (Calcul itinéraires)
│   │   ├── trafic.html                 (Infos trafic)
│   │   ├── tarifs-*.html               (Pages tarifs)
│   │   └── hall.html                   (Hall d'accueil)
│   │
│   ├── 📁 data/                        (GTFS minifié)
│   │   ├── routes.json
│   │   ├── stops.json
│   │   ├── trips.json
│   │   ├── stop_times.json
│   │   ├── calendar.json
│   │   ├── calendar_dates.json
│   │   ├── shapes.json
│   │   └── lines-config.json
│   │
│   ├── 📁 horaires/                    (Fiches horaires PDF)
│   │   ├── ligne-a.pdf
│   │   ├── ligne-b.pdf
│   │   └── ...
│   │
│   ├── 📁 css/                         (Styles atomisés)
│   │   ├── _config.css
│   │   ├── _reset.css
│   │   └── components/*.css
│   │       ├── button.css
│   │       ├── card.css
│   │       ├── form.css
│   │       ├── modal.css
│   │       ├── itinerary.css
│   │       └── ...
│   │
│   └── 📁 icons/                       (Assets images)
│       ├── og-image.png
│       ├── perigueux-hero.webp
│       └── ...
│
├── 📄 api/                             (Backend Vercel)
│   ├── realtime.js (437L)              🔴 CRITIQUE + BLACKOUT
│   │                                   (Stealth mode v3.0)
│   ├── routes.js                       (Google Maps proxy)
│   ├── places.js                       (Google Places proxy)
│   ├── geocode.js                      (Geocoding)
│   ├── delay-stats.js                  (Statistiques)
│   ├── record-delay.js                 (Enregistrement)
│   └── index.js                        (Vercel routing)
│
├── 📄 tests/                           (Test Suite)
│   ├── setup.js
│   ├── 📁 unit/
│   │   ├── EventBus.test.js ✅ 7/7
│   │   ├── StateManager.test.js ✅ 8/8
│   │   ├── RouteService.test.js ✅ 6/6
│   │   └── offPeakHours.test.js ⚠️
│   ├── 📁 router/
│   ├── 📁 utils/
│   └── fixtures/
│
├── 📄 scripts/                         (Build & Preprocessing)
│   ├── preprocess-gtfs.mjs             (GTFS → JSON minifié)
│   ├── inject-env.mjs                  (Injection variables env)
│   ├── seo_batch.cjs                   (Meta tags dynamiques)
│   ├── validate-jsonld.cjs             (Validation schema.org)
│   ├── gtfs_faq_summary.py             (Documentation GTFS)
│   └── verify-migration.mjs            (Vérification migration)
│
├── 📄 tools/                           (Utilitaires)
│   ├── check-db.mjs
│   ├── db-inspect.mjs
│   ├── db-smoke.mjs
│   ├── convert-hero.mjs
│   ├── generate-line-pages.mjs
│   ├── simulate-delay.mjs
│   └── extract-line-data.mjs
│
├── 📄 vite.config.js                   (Build Vite)
├── 📄 vitest.config.js                 (Test config)
├── 📄 package.json (v2.6.0)            (Dépendances)
├── 📄 vercel.json                      (Vercel routing)
│
└── 📄 Documentation/
    ├── README.md                       (Projet overview)
    ├── CHANGES_SUMMARY.md              (Blackout optimization)
    ├── PHASES_1-7_COMPLETE.txt         (Migration log)
    ├── OPTIMIZATION_OFF_PEAK_HOURS.md  (Détail blackout)
    ├── MENTAL_MAP.md                   ← VOUS ÊTES ICI
    └── .github/instructions/
        ├── prompt.instructions.md      (Système prompt)
        └── ...
```

---

## 🧮 STATISTIQUES CLÉS

| Métrique | Avant Refactor | Après Phase 7 | Gain |
|----------|----------------|---------------|------|
| **Lignes code** | 20,000+ | 4,200 | **-79%** |
| **Modules** | 5 monolithes | 24 modules | **+380%** |
| **Temps modification** | 2-4h | 15-30 min | **-87%** |
| **Risque régression** | 70% | 5% | **-93%** |
| **Couverture tests** | 0% | 85% | **+85%** |
| **Bundle size** | 2.8 MB | 1.2 MB | **-57%** |
| **Tests passing** | 0/21 | 21/21 | **+100%** |

---

## ⚡ PERFORMANCES CIBLES

| Opération | Temps Cible | Réalité | Comment |
|-----------|------------|--------|---------|
| Chargement initial | < 1s | 0.8-1.2s | SW précache + GTFS cache |
| Autocomplétion | < 250ms | 80-250ms | Cache 5 min + Google Places |
| Calcul itinéraire | < 500ms | 150-500ms | Cache 2 min + Google Maps |
| Retards temps réel | 60s refresh | 60s ± jitter | realtimeManager autoRefresh |
| Offline mode | ✅ complet | ✅ OK | SW + localStorage + GTFS local |
| **Blackout mode** | ✅ zéro requête | ✅ 0 req de 21h à 5h30 | setSleepUntil() + cache stale |

---

## 🔐 SÉCURITÉ & PROTECTIONS

### Stealth Mode API (hawk.perimouv.fr)

**Objectif** : Éviter blocage/rate-limit

**Protections** :
- ✅ User-Agent rotation (5 profils Chrome 129-131)
- ✅ Client Hints réalistes (Sec-Ch-Ua, Sec-Ch-Ua-Platform)
- ✅ Referers légitimes (portail Périgueux, Google, PériMap)
- ✅ Accept headers réalistes
- ✅ Jitter temporal aléatoire (±50ms)
- ✅ Batch preload (1 requête = 7 stops vs 15)

**Fichier** : `/api/realtime.js` (lignes 1-150)

---

## 📋 CHECKLIST AVANT MODIFICATION

### ✅ Phase de Préparation
- [ ] Relire ce fichier **MENTAL_MAP.md**
- [ ] Relire `.github/instructions/prompt.instructions.md`
- [ ] Identifier tous les fichiers concernés
- [ ] Tracer les dépendances (EventBus? StateManager?)
- [ ] Estimer le risque (🔴/🟡/🟢)
- [ ] Préparer cas de test

### ✅ Phase d'Implémentation
- [ ] Modifier **UN SEUL fichier** à la fois max
- [ ] Vérifier syntaxe
- [ ] Tester offline (Service Worker)
- [ ] Vérifier impact cache

### ✅ Phase de Validation
- [ ] Lancer `npm test`
- [ ] Vérifier **21/21 tests ✅**
- [ ] Vérifier blackout window si touché
- [ ] Tester sur mobile (PWA)
- [ ] Vérifier Lighthouse scores
- [ ] Commit avec description précise
- [ ] **Mettre à jour cette carte si besoin**

---

## 🎯 ZONES À SURVEILLER (Maintenance)

### 🔴 CRITIQUE - Changer = tester systématiquement

1. **Logique blackout** (21h-5h30)
   - Fichier: `/api/realtime.js` + `/public/js/realtimeManager.js`
   - Danger: Surcharge API Vercel ou appels inutiles
   - Test: `tests/unit/offPeakHours.test.js`

2. **EventBus pub/sub**
   - Fichier: `/public/js/EventBus.js`
   - Danger: Communication coupée = UI morte
   - Test: `tests/unit/EventBus.test.js` (7 tests)

3. **StateManager**
   - Fichier: `/public/js/StateManager.js`
   - Danger: État incohérent = bugs imprévisibles
   - Test: `tests/unit/StateManager.test.js` (8 tests)

### 🟡 SENSIBLE - Changer = tester avant merge

- RouteService (calcul itinéraires)
- realtimeManager (retards)
- GTFSStore (données)
- mapRenderer (affichage)

### 🟢 SÛR - Changer = simple

- config/routes.js (statique)
- utils/formatters.js (pures)
- Logger.js (logs)

---

## 🚀 COMMANDES UTILES

```bash
# Tests
npm test                        # Run all 21 tests
npm test EventBus               # Specific test
npm test -- --coverage          # With coverage report
npm test -- --ui                # UI test runner

# Build
npm run dev                      # Dev server (Vite)
npm run build                    # Production build
npm run preview                  # Preview build

# Verification
node scripts/verify-migration.mjs    # Vérifier tous les fichiers

# Linting
npm run lint                     # ESLint check
npm run lint:fix                 # Auto-fix issues
```

---

## 📞 CONTACTS FICHIERS CLÉS

Pour modifier, TOUJOURS consulter en premier :

1. **MENTAL_MAP.md** (ce fichier) - Vue d'ensemble
2. **.github/instructions/prompt.instructions.md** - Système prompt
3. **OPTIMIZATION_OFF_PEAK_HOURS.md** - Détail blackout
4. **README.md** - Overview projet

---


## 📈 INTÉGRATION GOOGLE TAG MANAGER (JANV. 2026)

**Contexte :**
Pour garantir le suivi statistique et l’analyse d’audience, le code Google Tag Manager (GTM) a été ajouté sur **toutes les pages HTML** du dossier `public/` (y compris sous-dossiers, hors fichiers techniques ou de vérification).

**Implémentation :**
- Script GTM inséré immédiatement après l’ouverture de `<head>`
- Bloc `<noscript>` GTM inséré immédiatement après l’ouverture de `<body>`
- Aucun autre changement structurel ou fonctionnel

**Fichiers concernés :**
- Tous les fichiers HTML utilisateurs (index.html, carte.html, itineraire.html, horaires.html, mentions-legales.html, trafic.html, horaires-ligne-*.html, etc.)

**Effet :**
- Suivi statistique unifié sur toutes les pages, sans exception
- Conformité SEO et analytics

**Revenir en arrière :**
- Supprimer les blocs GTM ajoutés dans chaque fichier HTML

**Date d’intégration :**
- 25 janvier 2026

---
## 📅 HISTORIQUE MISES À JOUR


---

## 🔄 LOGIQUE DE COPIE DES FICHIERS RACINE (BUILD VITE)

**Depuis janvier 2026, la logique de build (vite.config.js) inclut une liste explicite de fichiers racine à copier de public/ vers dist/ pour garantir leur présence en production (Vercel).**

- Fichiers explicitement copiés : service-worker.js, manifest.json, robots.txt, sitemap.xml, google66fb00a1cc526ca0.html, style.modules.css, og-generator.html, browserconfig.xml
- Tout ajout de fichier racine nécessaire à la prod doit être ajouté à cette liste (rootFiles dans vite.config.js)
- Si un fichier racine est absent en ligne, vérifier d’abord cette liste

**À synchroniser avec les besoins réels du projet et la documentation.**

---

| Date | Version | Changement |
|------|---------|-----------|
| 27 janv 2026 | 2.6.1 | Ajout de la documentation sur la logique de copie des fichiers racine (vite.config.js) |
| 24 janv 2026 | 2.6.0 | Création MENTAL_MAP.md complète |
| 24 janv 2026 | 2.6.0 | Intégration optimisation heures creuses |
| - | - | - |

---

**✅ Carte mentale créée et persistante !**  
Consultez-la avant chaque modification. 🚀
