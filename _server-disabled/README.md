# 🚀 Peribus Backend Server

## État : 🟢 ACTIF (Intégré avec le client)

Ce dossier contient le serveur Express backend pour Peribus, intégré avec OpenTripPlanner et Photon pour le calcul d'itinéraires et la recherche de lieux.

## Fonctionnalités préparées

### 1. 🗺️ Pathfinding (Calcul d'itinéraires)
- Algorithme RAPTOR pour le transport en commun
- A* pour la marche à pied
- Graphe de transport pré-calculé
- Support multi-modal

### 2. 📍 Autocomplétion de lieux
- Index Trie pour recherche rapide
- Recherche floue (fuzzy search)
- Support des accents et caractères spéciaux
- Arrêts de bus + POI locaux

### 3. 💾 Mémoire utilisateur
- Historique des recherches
- Lieux favoris
- Préférences de trajet
- Stockage SQLite/PostgreSQL ready

### 4. 🌐 API REST
- Routes Express.js
- Middleware d'authentification
- Rate limiting
- CORS configuré

## Structure des fichiers

```
server/
├── README.md              # Ce fichier
├── package.json           # Dépendances Node.js
├── config.js              # Configuration centralisée
├── index.js               # Point d'entrée (désactivé)
│
├── core/                  # Modules principaux
│   ├── pathfinding/       # Calcul d'itinéraires
│   │   ├── raptor.js      # Algorithme RAPTOR
│   │   ├── astar.js       # Algorithme A*
│   │   ├── graph.js       # Graphe de transport
│   │   └── index.js       # Export principal
│   │
│   ├── places/            # Autocomplétion
│   │   ├── trie.js        # Structure Trie
│   │   ├── fuzzy.js       # Recherche floue
│   │   ├── indexer.js     # Indexation des lieux
│   │   └── index.js       # Export principal
│   │
│   └── memory/            # Mémoire utilisateur
│       ├── store.js       # Interface stockage
│       ├── sqlite.js      # Adaptateur SQLite
│       ├── postgres.js    # Adaptateur PostgreSQL
│       └── index.js       # Export principal
│
├── api/                   # Routes API REST
│   ├── routes.js          # /api/routes
│   ├── places.js          # /api/places
│   ├── user.js            # /api/user
│   └── index.js           # Router principal
│
├── middleware/            # Middleware Express
│   ├── auth.js            # Authentification
│   ├── rateLimit.js       # Rate limiting
│   └── cors.js            # CORS
│
├── utils/                 # Utilitaires
│   ├── gtfsLoader.js      # Chargement GTFS
│   ├── geo.js             # Calculs géographiques
│   └── cache.js           # Système de cache
│
└── data/                  # Données pré-calculées
    └── .gitkeep
```

## Prérequis serveur recommandés

| Ressource | Minimum | Recommandé |
|-----------|---------|------------|
| RAM       | 1 GB    | 2-4 GB     |
| CPU       | 2 cores | 4 cores    |
| Stockage  | 5 GB    | 20 GB      |
| Node.js   | 18.x    | 20.x LTS   |

## Installation future

```bash
cd server
npm install
npm run build-graph  # Pré-calcul du graphe
npm start            # Démarrage du serveur
```

## Variables d'environnement

```env
# server/.env (à créer - voir .env.example)
PORT=3000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# OpenTripPlanner
OTP_BASE_URL=http://localhost:8888/otp/routers/default
OTP_TIMEOUT_MS=15000

# Photon (géocodage)
PHOTON_BASE_URL=https://photon.komoot.io

# GTFS Realtime (optionnel)
GTFS_RT_URL=
```

## Activation

Le serveur est automatiquement détecté par le client quand il tourne sur `localhost:3000`.

### Démarrage rapide

```bash
cd server
npm install
npm run dev  # Démarre avec hot-reload
```

### Prérequis

- **Node.js >= 18.x**
- **OpenTripPlanner** tournant sur port 8888 (optionnel mais recommandé)
- Données GTFS dans `public/data/gtfs/`

### Architecture client-serveur

Le client (`public/js/apiManager.js`) détecte automatiquement le mode backend :

| Mode | Détection | Description |
|------|-----------|-------------|
| `otp` | Port 3000, localhost | Serveur Express avec OTP + Photon |
| `vercel` | Par défaut | Proxies Vercel → Google APIs |
| `google` | Clé API présente | SDK Google Maps direct (dev) |

---

**Dernière mise à jour**: Janvier 2026
