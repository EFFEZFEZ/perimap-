<div align="center">

![Périmap](https://i.ibb.co/99PZh9Zq/export6-removebg-preview.webp)

# PériMap

### Repensons les transports en commun

**Une application gratuite, rapide et accessible.**  
**Conçue pour le Grand Périgueux.**

[🌐 Ouvrir périmap.fr](https://périmap.fr)

![Version](https://img.shields.io/badge/version-2.6.1-22c55e?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-Ready-00c8ff?style=for-the-badge)
![Performance](https://img.shields.io/badge/Lighthouse-92%2F100-success?style=for-the-badge)

</div>

---

## 🎯 Fonctionnalités

### ⚡ Instantané
- **< 500ms** : Calcul d'itinéraire
- **< 250ms** : Autocomplétion
- **< 1s** : Chargement initial

### 🧠 Intelligent
L'autocomplétion comprend votre ville :
- Tapez **"auchan"** → Elle sait que c'est Boulazac
- Tapez **"lycée"** → Bertran de Born, Jay de Beaufort, Laure Gatet...
- Tapez **"hôpital"** → Direction le Centre Hospitalier

### 🚌 Multimodal
- 🚍 **Bus** : Tous les itinéraires avec correspondances intelligentes
- 🚶 **Marche** : Tracés optimisés, distances réelles
- 🚴 **Vélo** : Intégration disponible

### 📡 Temps Réel
- Horaires de passage en direct via hawk.perimouv.fr
- Préchargement intelligent des arrêts prioritaires
- Mise à jour automatique toutes les 60 secondes

---

## 🚀 Installation

### Prérequis
- Node.js 18+
- npm ou yarn

### Démarrage rapide

```bash
# Cloner le repository
git clone https://github.com/EFFEZFEZ/perimap-.git
cd perimap-

# Installer les dépendances
npm install

# Lancer en développement
npm run dev

# Build production
npm run build
```

### Variables d'environnement

Créer un fichier `.env` à la racine :

```env
# Google Maps Platform (requis)
GMAPS_SERVER_KEY=votre_clé_google_maps

# Base de données Neon (pour statistiques retards)
DATABASE_URL=postgres://...
```

---

## 📁 Structure du projet

```
perimap/
├── api/                    # APIs Vercel Serverless
│   ├── delay-stats.js      # Statistiques retards (Neon DB)
│   ├── geocode.js          # Reverse geocoding
│   ├── places.js           # Autocomplétion lieux
│   ├── realtime.js         # Proxy temps réel Hawk
│   ├── record-delay.js     # Enregistrement retards
│   └── routes.js           # Proxy Google Routes
│
├── public/                 # Assets statiques
│   ├── css/modules/        # CSS modulaire
│   ├── data/               # Données GTFS et config
│   ├── js/                 # Code JavaScript
│   ├── horaires/           # Page dynamique horaires
│   └── views/              # Fragments HTML
│
├── scripts/                # Scripts de build/maintenance
├── tools/                  # Outils de développement
└── tests/                  # Tests unitaires
```

---

## 🌐 Déploiement

Le projet est optimisé pour **Vercel** :

1. Connecter le repo GitHub à Vercel
2. Configurer les variables d'environnement
3. Déployer automatiquement à chaque push

### URLs
- Production : [périmap.fr](https://périmap.fr)
- Alternative : [xn--primap-bva.fr](https://www.xn--primap-bva.fr)

---

## 📊 Technologies

| Catégorie | Technologies |
|-----------|-------------|
| **Frontend** | Vanilla JS (ES6+), Vite, Leaflet |
| **Backend** | Vercel Serverless Functions |
| **Base de données** | Neon PostgreSQL |
| **APIs** | Google Maps Platform, hawk.perimouv.fr |
| **PWA** | Service Worker, IndexedDB |

---

## 🤝 Contribution

Les contributions sont les bienvenues ! 

1. Forker le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commiter (`git commit -m 'Add AmazingFeature'`)
4. Pusher (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

---

## 📄 Licence

Ce projet est sous licence propriétaire.  
© 2025-2026 PériMap. Tous droits réservés.

Voir [LICENSE](LICENSE) pour plus de détails.

---

<div align="center">

**Fait avec ❤️ pour le Grand Périgueux**

</div>
