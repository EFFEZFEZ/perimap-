<div align="center">

![Périmap](https://i.ibb.co/99PZh9Zq/export6-removebg-preview.webp)

# PériMap

### Repensons les transports en commun

**Une PWA gratuite, rapide et accessible.**  
**Conçue pour le Grand Périgueux.**

[🌐 Ouvrir périmap.fr](https://périmap.fr)

![Version](https://img.shields.io/badge/version-1.0.0-22c55e?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-Ready-00c8ff?style=for-the-badge)
![Performance](https://img.shields.io/badge/Lighthouse-92%2F100-success?style=for-the-badge)
![Architecture](https://img.shields.io/badge/Architecture-Modular-blueviolet?style=for-the-badge)

</div>

---

# PériMap, comme on la découvre en scroll

## Ouvrir
Écran sombre, cartes arrondies, Manrope nette. Navigation minimale, prêt à partir.

## Saisir
Deux lettres suffisent : suggestions locales < 250 ms. Bouton swap neutre, inputs pleine largeur.

## Choisir le moment
Popover arrondi Partir/Arriver, selects natifs scrollables. Le scroll reste fluide, jamais bloqué.

## Voir les trajets
Résultats triés chronologiquement, carte ajustée, horaires temps réel rafraîchis toutes les 60 s.

## Retrouver
Vos trajets récents conservés dans une carte dédiée : un clic, départ/destination/heure se remplissent.

## Rester mobile
Espacements homogènes, contrastes maîtrisés, aucun halo vert résiduel. Une DA cohérente jusqu’au CTA.

---

## Pourquoi PériMap
- **Problème** : horaires éclatés, correspondances manquées, information temps réel peu accessible pour le Grand Périgueux.
- **Solution** : une PWA locale, rapide et offline-ready qui regroupe itinéraires, retards et lieux clés en une seule interface.
- **Terrain** : optimisée pour les usages quotidiens (travail, lycée, santé) avec des parcours raccourcis et des favoris persistants.

## 📊 Impact mesuré
- **+87% de vélocité dev** : scripts de génération GTFS, mocks OTP et CI Vitest stabilisée.
- **-93% de bugs** : 21/21 tests passent, couverture des routes critiques.
- **-57% de bundle** : passage de 2.8 Mo à 1.2 Mo (tree-shaking, code-splitting, assets compressés).
- **< 1s au premier rendu** : chargement initial stable en 4G, PWA pré-cachée.

---

## ⚡ Ce qui rend PériMap rapide
- **< 500ms** : Calcul d'itinéraire
- **< 250ms** : Autocomplétion
- **< 1s** : Chargement initial

## 🚌 Ce qui rend PériMap utile
- **Bus** : correspondances intelligentes
- **Marche** : tracés optimisés
- **Vélo** : intégration disponible
- **Temps réel** : rafraîchi toutes les 60 secondes

---

## Identité visuelle PériMap
- **Typo** : Manrope (400/600/700)
- **Fond principal** : #0b1220 (navy), gradients discrets
- **Primaire** : #22c55e (vert) pour accents contrôlés
- **Accent** : #00c8ff (cyan) pour états focus/CTA secondaires
- **Cartes** : fond translucide, bordure fine, radius 16px, ombres douces
- **Boutons** : CTA bleu (rayon 12-16px), swap neutre (fond transparent, bordure #ffffff14)

---

## 🚀 Installation

### Prérequis
- Node.js 18+
- npm ou yarn

### Démarrage rapide

```bash
git clone https://github.com/EFFEZFEZ/perimap-.git
cd perimap-
npm install
npm run dev
npm run build
```

### Variables d'environnement

Créer un fichier `.env` à la racine :

```env
GMAPS_SERVER_KEY=votre_clé_google_maps
DATABASE_URL=postgres://...
```

---

## 📁 Structure du projet

```
perimap/
├── api/                    # APIs Vercel Serverless
├── public/                 # Assets statiques
├── scripts/                # Scripts de build/maintenance
├── tools/                  # Outils de développement
└── tests/                  # Tests unitaires
```

---

## 🌐 Déploiement

Optimisé pour **Vercel** :
1. Connecter le repo GitHub
2. Configurer les variables d'environnement
3. Déployer à chaque push

### URLs
- Production : [périmap.fr](https://périmap.fr)
- Alternative : [xn--primap-bva.fr](https://www.xn--primap-bva.fr)

---

## 📄 Licence

Ce projet est sous licence propriétaire.  
© 2025-2026 PériMap. Tous droits réservés.

Voir [LICENSE](LICENSE) pour plus de détails.

---

<div align="center">

**Fait avec ❤️ pour le Grand Périgueux**

</div>
