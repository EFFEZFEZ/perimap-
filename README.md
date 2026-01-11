<p align="center">
  <img src="https://i.ibb.co/99PZh9Zq/export6-removebg-preview.webp" alt="Périmap Logo" width="140" height="140">
</p>

<h1 align="center">🚍 Périmap</h1>

<p align="center">
  <strong>L'application moderne, gratuite et performante pour les transports en commun du Grand Périgueux</strong>
</p>

<p align="center">
  <a href="https://périmap.fr">🌐 périmap.fr</a> •
  <a href="https://instagram.com/perimap.fr">📸 Instagram</a> •
  <a href="https://facebook.com/perimap.fr">📘 Facebook</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.24.0-22c55e?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/PWA-Installable-00c8ff?style=flat-square" alt="PWA">
  <img src="https://img.shields.io/badge/GTFS-Péribus_2026-orange?style=flat-square" alt="GTFS">
  <img src="https://img.shields.io/badge/Edge_Functions-Vercel-black?style=flat-square" alt="Vercel">
  <img src="https://img.shields.io/badge/API-Google_Maps-4285F4?style=flat-square" alt="Google">
  <img src="https://img.shields.io/badge/license-Proprietary-red?style=flat-square" alt="License">
</p>

---

## 🎯 Pourquoi Périmap ?

Le réseau **Péribus** dessert le Grand Périgueux mais manquait d'une application moderne, rapide et gratuite pour planifier ses trajets. Les solutions existantes (Google Maps, applications officielles) ne répondent pas aux besoins spécifiques des usagers locaux :

| Problème | Solution Périmap |
|----------|------------------|
| ❌ Interfaces lentes et peu intuitives | ✅ PWA ultra-rapide (<500ms de réponse) |
| ❌ Données temps réel absentes ou imprécises | ✅ Horaires en temps réel via hawk.perimouv.fr |
| ❌ Pas d'itinéraire multimodal local | ✅ Routeur GTFS hybride + Google Routes API |
| ❌ Pas de fonctionnement hors-ligne | ✅ Service Worker avec cache stratégique |
| ❌ Autocomplétion générique | ✅ POI locaux prioritaires (lycées, commerces, hôpital) |
| ❌ Pas d'accessibilité PMR claire | ✅ Informations accessibilité par arrêt |

**Périmap est conçu par et pour les Périgourdins** — avec une connaissance fine du territoire et des usages locaux.

---

## ✨ Fonctionnalités

### 🗺️ Carte interactive
- Affichage de toutes les lignes Péribus avec tracés géométriques (shapes GTFS)
- Zoom sur les arrêts avec détails accessibilité
- Géolocalisation pour trouver les arrêts proches

### 🔍 Recherche d'itinéraire hybride
- **Routeur GTFS local** : calcul instantané basé sur les données officielles
- **Google Routes API** : alternatives bus, vélo et marche
- **Support des correspondances** : algorithme intelligent de hubs de transfert
- **Modes de recherche** : "Partir à" et "Arriver avant"

### ⏱️ Horaires en temps réel
- Prochains passages par arrêt via proxy vers hawk.perimouv.fr
- Préchargement intelligent des lignes principales
- Cache de 30 secondes pour éviter les requêtes répétées

### 🔎 Autocomplétion intelligente
Système hiérarchique avec priorité locale :
1. **POI locaux** : Auchan, Leclerc, lycées, hôpital, gare... (~100 lieux)
2. **Communes** : Périgueux, Trélissac, Boulazac, Coulounieix... (~30)
3. **Arrêts GTFS** : Tous les arrêts du réseau (~30 principaux)
4. **Adresses Google** : Fallback pour les adresses précises

### 📱 PWA & Mode hors-ligne
- Installable sur mobile (Add to Home Screen)
- Données GTFS cachées localement (IndexedDB)
- Fonctionnement dégradé sans connexion
- Synchronisation automatique au retour en ligne

### 🌙 Interface moderne
- Mode sombre natif
- Design responsive (mobile-first)
- Animations fluides
- Icônes SVG optimisées

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (PWA)                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  public/js/                                                      │   │
│  │  ├── main.js         → Point d'entrée, orchestration            │   │
│  │  ├── dataManager.js  → Chargement/indexation GTFS (1500+ lignes)│   │
│  │  ├── router.js       → Routeur hybride GTFS (1400 lignes)       │   │
│  │  ├── apiManager.js   → Abstraction API (1600 lignes)            │   │
│  │  ├── realtimeManager.js → Temps réel hawk.perimouv.fr          │   │
│  │  ├── mapRenderer.js  → Carte Leaflet + tuiles Carto             │   │
│  │  └── ...             → 20+ modules spécialisés                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Service Worker      → Cache stratégique, offline-first          │   │
│  │  IndexedDB           → Stockage GTFS + stop_times optimisé       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      EDGE FUNCTIONS (Vercel CDG1)                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │  api/routes.js   │  │  api/places.js   │  │  api/realtime.js │      │
│  │  Google Routes   │  │  Autocomplétion  │  │  Proxy temps réel│      │
│  │  + Cache 5min    │  │  hiérarchique    │  │  hawk.perimouv   │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
           ┌────────────┐  ┌────────────┐  ┌────────────────┐
           │ Google     │  │ Google     │  │ Hawk Perimouv  │
           │ Routes API │  │ Places API │  │ (temps réel)   │
           └────────────┘  └────────────┘  └────────────────┘
```

---

## ⚡ Performances

### Métriques actuelles (janvier 2026)

| Métrique | Valeur | Cible | Status |
|----------|--------|-------|--------|
| **Temps de réponse itinéraire** | ~450ms | <500ms | ✅ |
| **Autocomplétion (Places API)** | ~250ms | <300ms | ✅ |
| **First Contentful Paint** | ~1.2s | <1.5s | ✅ |
| **Time to Interactive** | ~2.5s | <3s | ✅ |
| **Bundle JS principal** | ~299KB | <350KB | ✅ |
| **Cache GTFS (IndexedDB)** | <1s | <2s | ✅ |

### Optimisations clés

#### 🔄 Cache intelligent multi-niveaux
```
Niveau 1: Cache CDN Vercel (s-maxage: 60s)
Niveau 2: Cache applicatif Edge (5 min, buckets temporels)
Niveau 3: Cache client (2 min, itinéraires identiques)
Niveau 4: IndexedDB (12h, données GTFS complètes)
```

#### 📊 Stratégie de cache Routes API
- **Normalisation temporelle** : requêtes arrondies à 5 minutes
- **Arrondi géographique** : coordonnées à 4 décimales (~11m de précision)
- **Partage de cache** : 10 utilisateurs cherchant le même trajet entre 14h00 et 14h05 → 1 seul appel API

#### 🚀 Optimisation des appels API
- **V222** : 3 appels au lieu de 10 par recherche (-70% de coût)
  - 1 appel bus avec `computeAlternativeRoutes: true` (retourne 5-6 alternatives)
  - 1 appel vélo
  - 1 appel marche

#### 💾 Chargement GTFS optimisé
- Web Worker pour parsing non-bloquant
- Bundle compressé Brotli (~200KB → ~50KB)
- Indexation incrémentale avec `requestIdleCallback`
- Stockage des stop_times dans IndexedDB (libère la RAM)

### Lighthouse Score

| Catégorie | Score |
|-----------|-------|
| Performance | 92 |
| Accessibilité | 95 |
| Best Practices | 100 |
| SEO | 100 |
| PWA | ✅ Installable |

---

## 🛠️ Stack technique

| Couche | Technologie |
|--------|-------------|
| **Frontend** | Vanilla JS ES2022+, Vite 5, Leaflet 1.9 |
| **Styling** | CSS3 modulaire, CSS Variables, Dark mode natif |
| **Edge Functions** | Vercel Edge Runtime (région cdg1 - Paris) |
| **APIs externes** | Google Routes API, Google Places API (New) |
| **Données transit** | GTFS Péribus (valide jusqu'au 28/02/2026) |
| **Temps réel** | Proxy vers hawk.perimouv.fr |
| **Cartographie** | Leaflet + Carto Voyager (dark/light) |
| **Hébergement** | Vercel (frontend + edge functions) |
| **Tests** | Vitest + Coverage V8 |
| **Bundler** | Vite + Terser (minification) |

---

## 📦 Installation

### Prérequis
- Node.js ≥ 18.0.0
- Compte Vercel (pour déploiement)
- Clé API Google Maps (Routes + Places)

### Développement local

```bash
# Cloner le repo
git clone https://github.com/EFFEZFEZ/perimap-.git
cd perimap-

# Installer les dépendances
npm install

# Lancer en développement
npm run dev
# → http://localhost:5173

# Build de production
npm run build

# Lancer les tests
npm test
```

### Variables d'environnement

Créer un fichier `.env.local` :

```env
GOOGLE_MAPS_API_KEY=votre_clé_google
```

Sur Vercel, configurer dans Settings → Environment Variables.

---

## 📁 Structure du projet

```
perimap/
├── api/                    # Edge Functions Vercel
│   ├── places.js           # Autocomplétion hiérarchique
│   ├── routes.js           # Itinéraires Google Routes + cache
│   ├── realtime.js         # Proxy temps réel
│   └── geocode.js          # Reverse geocoding
│
├── public/                 # Frontend statique
│   ├── css/                # Styles modulaires
│   │   ├── style.css       # Styles principaux
│   │   ├── brand.css       # Identité visuelle
│   │   └── modules/        # Composants CSS
│   │
│   ├── data/               # Données statiques
│   │   ├── gtfs/           # Fichiers GTFS Péribus
│   │   └── map.geojson     # Tracés des lignes
│   │
│   ├── js/                 # Modules JavaScript
│   │   ├── main.js         # Point d'entrée (~5000 lignes)
│   │   ├── router.js       # Routeur hybride GTFS
│   │   ├── dataManager.js  # Gestion données GTFS
│   │   ├── apiManager.js   # Abstraction APIs
│   │   ├── mapRenderer.js  # Carte Leaflet
│   │   ├── config/         # Configuration
│   │   ├── map/            # Modules cartographiques
│   │   ├── utils/          # Utilitaires
│   │   └── workers/        # Web Workers
│   │
│   ├── views/              # Templates HTML partiels
│   ├── icons/              # Assets graphiques
│   └── service-worker.js   # PWA offline support
│
├── scripts/                # Scripts de maintenance
│   ├── preprocess-gtfs.mjs # Prétraitement données
│   └── perfTest.js         # Tests de performance
│
├── tests/                  # Tests Vitest
│   ├── router/             # Tests du routeur
│   └── utils/              # Tests utilitaires
│
├── vercel.json             # Configuration Vercel
├── vite.config.js          # Configuration Vite
└── package.json            # Dépendances
```

---

## 🚀 Déploiement

### Vercel (Production)

Le déploiement est **automatique** à chaque push sur `main` :

```bash
git push origin main
# → Vercel détecte le push et déploie automatiquement
```

Configuration dans `vercel.json` :
- Edge Functions dans la région `cdg1` (Paris)
- Headers de cache optimisés par type de ressource
- Rewrites pour le routing SPA

### Mise à jour des données GTFS

1. Télécharger le nouveau GTFS depuis data.grandperigueux.fr
2. Placer les fichiers dans `public/data/gtfs/`
3. Exécuter le préprocessing :
```bash
node scripts/preprocess-gtfs.mjs
```
4. Mettre à jour `GTFS_CACHE_VERSION` dans `dataManager.js`
5. Commit et push

---

## 🧪 Tests

```bash
# Lancer tous les tests
npm test

# Tests avec interface graphique
npm run test:ui

# Couverture de code
npm run test:coverage

# Lint du code
npm run lint
npm run lint:fix
```

---

## 📊 Données GTFS

Le projet utilise les données GTFS officielles du réseau Péribus :

| Fichier | Description | Entrées |
|---------|-------------|---------|
| `routes.txt` | Lignes de bus | 80 |
| `trips.txt` | Trajets planifiés | 2,374 |
| `stops.txt` | Arrêts de bus | 1,329 |
| `stop_times.txt` | Horaires de passage | 33,408 |
| `shapes.txt` | Tracés géométriques | 62,754 points |
| `calendar.txt` | Jours de service | 17 |
| `calendar_dates.txt` | Exceptions | 133 |

**Validité** : jusqu'au 28 février 2026

---

## 🔒 Sécurité

- **CORS** : Origines autorisées configurées par endpoint
- **Rate Limiting** : Configurable par fonction Edge
- **Clés API** : Stockées en variables d'environnement Vercel
- **Headers sécurisés** : X-Content-Type-Options, X-Frame-Options
- **HTTPS** : Forcé par Vercel

---

## 📄 Licence

**© 2025-2026 Périmap. Tous droits réservés.**

Ce projet est **propriétaire**. Aucune copie, modification ou redistribution n'est autorisée sans accord écrit préalable.

Le code peut être consulté à titre informatif et éducatif uniquement.

Voir [LICENSE](LICENSE) et [COPYRIGHT](COPYRIGHT) pour plus de détails.

---

## 🤝 Contribution

Ce projet n'accepte pas de contributions externes pour le moment.

Pour signaler un bug ou suggérer une fonctionnalité, contactez-nous via les réseaux sociaux.

---

## 📞 Contact

- **Site web** : [périmap.fr](https://périmap.fr)
- **Instagram** : [@perimap.fr](https://instagram.com/perimap.fr)
- **Facebook** : [Périmap](https://facebook.com/perimap.fr)

---

<p align="center">
  <strong>Fait avec ❤️ à Périgueux, pour les Périgourdins</strong>
</p>

<p align="center">
  <img src="https://i.ibb.co/99PZh9Zq/export6-removebg-preview.webp" alt="Périmap" width="60">
</p>
