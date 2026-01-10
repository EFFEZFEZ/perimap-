<p align="center">
  <img src="https://i.ibb.co/99PZh9Zq/export6-removebg-preview.webp" alt="Périmap Logo" width="120" height="120">
</p>

<h1 align="center">🚍 Périmap</h1>

<p align="center">
  <strong>L'application moderne et gratuite pour les transports en commun de Périgueux</strong>
</p>

<p align="center">
  <a href="https://périmap.fr">🌐 périmap.fr</a> •
  <a href="https://instagram.com/perimap.fr">📸 Instagram</a> •
  <a href="https://facebook.com/perimap.fr">📘 Facebook</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.30.0-22c55e?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/PWA-Ready-00c8ff?style=flat-square" alt="PWA">
  <img src="https://img.shields.io/badge/GTFS-Péribus-orange?style=flat-square" alt="GTFS">
  <img src="https://img.shields.io/badge/license-Proprietary-red?style=flat-square" alt="License">
</p>

---

## 📋 Table des matières

1. [Fonctionnalités](#-fonctionnalités)
2. [Architecture](#-architecture)
3. [Stack technique](#-stack-technique)
4. [Installation](#-installation)
5. [Développement](#-développement)
6. [Déploiement](#-déploiement)
7. [Performance](#-performance)
8. [Licence](#-licence)

---

## ✨ Fonctionnalités

| Fonctionnalité | Description |
|----------------|-------------|
| 🗺️ **Carte interactive** | Toutes les lignes Péribus avec tracés et arrêts |
| 🔍 **Recherche d'itinéraire** | Bus, vélo, marche via OTP + Photon |
| ⏱️ **Horaires en temps réel** | Prochains passages par arrêt |
| 📍 **Géolocalisation** | Position actuelle et arrêts à proximité |
| 🌙 **Mode sombre** | Interface adaptée jour/nuit |
| 📱 **PWA** | Installation sur mobile, fonctionne hors-ligne |
| ♿ **Accessibilité** | Informations PMR par arrêt |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vercel)                        │
│  public/  → HTML/CSS/JS statiques, données GTFS préprocessées   │
│  api/     → Serverless functions (proxy OTP, geocoding, etc.)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Oracle Cloud)                     │
│  server/  → Express.js API                                      │
│  - OTP 2.x (OpenTripPlanner) → calcul d'itinéraires             │
│  - Photon → geocoding / autocomplétion                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Vanilla JS, Leaflet, Vite |
| Backend | Node.js, Express |
| Routing | OpenTripPlanner 2.x |
| Geocoding | Photon (Komoot) |
| Données | GTFS Péribus |
| Hébergement | Vercel (frontend) + Oracle Cloud (backend) |
| Tests | Vitest |

---

## 📦 Installation

```bash
# Cloner le repo
git clone https://github.com/EFFEZFEZ/perimap-.git
cd perimap-

# Installer les dépendances
npm install

# Lancer en développement
npm run dev
```

---

## 🧪 Développement

```bash
# Serveur de développement (Vite)
npm run dev

# Lancer les tests
npm test

# Build de production
npm run build

# Préprocesser les données GTFS
npm run preprocess
```

### Structure du projet

```
├── api/              # Serverless functions Vercel
├── public/           # Frontend statique
│   ├── css/          # Styles modulaires
│   ├── data/         # GTFS préprocessées, GeoJSON
│   ├── js/           # Modules JavaScript
│   └── views/        # Templates HTML partiels
├── scripts/          # Scripts de build/préprocessing
├── server/           # Backend Express (Oracle)
└── tests/            # Tests Vitest
```

---

## 🚀 Déploiement

### Frontend (Vercel)

Push sur `main` → déploiement automatique via Vercel.

### Backend (Oracle Cloud)

```bash
cd server
docker build -t perimap-server .
docker run -d -p 3000:3000 perimap-server
```

OTP doit tourner sur le même serveur avec le graph GTFS Péribus.

---

## ⚡ Performance

### Objectifs d'optimisation

| Métrique | Actuel | Cible |
|----------|--------|-------|
| Temps de réponse itinéraire | ~3s | < 1s |
| First Contentful Paint | ~1.5s | < 1s |
| Bundle JS | ~150KB | < 100KB |

### Pistes d'amélioration

- [ ] Cache Redis côté backend
- [ ] Préchargement des itinéraires fréquents
- [ ] Compression Brotli des réponses API
- [ ] Service Worker avec cache stratégique
- [ ] Lazy loading des modules JS
- [ ] Réduction des appels API redondants

---

## 📄 Licence

**© 2025 Périmap. Tous droits réservés.**

Ce projet est propriétaire. Aucune copie, modification ou redistribution n'est autorisée sans accord écrit préalable.

Voir [LICENSE](LICENSE) et [COPYRIGHT](COPYRIGHT) pour plus de détails.

---

<p align="center">
  Fait avec ❤️ à Périgueux
</p>


