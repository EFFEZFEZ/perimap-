<div align="center">

![Périmap](https://i.ibb.co/99PZh9Zq/export6-removebg-preview.webp)

# Périmap

### Repensons les transports en commun

**Une application gratuite, rapide et accessible.**  
**Conçue pour le Grand Périgueux.**

[🌐 Ouvrir périmap.fr](https://périmap.fr)

![Version](https://img.shields.io/badge/version-3.24-22c55e?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-Ready-00c8ff?style=for-the-badge)
![Performance](https://img.shields.io/badge/Lighthouse-92%2F100-success?style=for-the-badge)

</div>

---

<br>
<br>

## Un constat simple

Les applications de transport existantes sont lentes.  
Les interfaces sont complexes.  
Les données ne sont pas toujours fiables.

**Et si on recommençait à zéro ?**

<br>
<br>

---

<br>
<br>

## Instantané

![](https://img.shields.io/badge/⚡-450ms-green?style=flat-square) **Calcul d'itinéraire**  
![](https://img.shields.io/badge/🔍-250ms-green?style=flat-square) **Autocomplétion**  
![](https://img.shields.io/badge/⏱️-<1s-green?style=flat-square) **Chargement initial**

Périmap répond en **moins d'une demi-seconde**.  
Même sur mobile. Même en 3G.

Grâce à un système de cache intelligent multi-niveaux :  
CDN mondial → Serveurs Edge → Stockage local → Mémoire vive

**Résultat :** Vous cherchez, vous trouvez. Instantanément.

<br>
<br>

---

<br>
<br>

## Intelligent

L'autocomplétion comprend votre ville.

Tapez **"auchan"** → Elle sait que c'est Boulazac.  
Tapez **"lycée"** → Bertran de Born, Jay de Beaufort, Laure Gatet...  
Tapez **"hôpital"** → Direction le Centre Hospitalier.

### Hiérarchie intelligente

```
1️⃣ Lieux populaires      → Commerces, écoles, services
2️⃣ Communes              → Périgueux, Trélissac, Boulazac...  
3️⃣ Arrêts de bus         → 1300+ arrêts du réseau
4️⃣ Adresses précises     → Toutes les rues, tous les numéros
```

**Plus de 100 lieux locaux** indexés pour une recherche pertinente.

<br>
<br>

---

<br>
<br>

## Multimodal

### Un seul outil. Tous vos trajets.

🚍 **Bus**  
Tous les itinéraires possibles, avec correspondances intelligentes.

🚶 **Marche**  
Tracés optimisés, distances réelles, temps précis.

🚴 **Vélo**  
Alternatives écologiques, toujours proposées.

### Modes de recherche flexibles

**Partir à 14h30** → Les prochains bus après cette heure  
**Arriver avant 16h** → Les derniers bus qui arrivent à temps

<br>
<br>

---

<br>
<br>

## Temps réel

Les horaires théoriques, c'est bien.  
**Les horaires réels, c'est mieux.**

Périmap affiche les prochains passages en temps réel.  
Retards, suppressions, modifications : vous êtes prévenus.

Sources de données temps réel certifiées.  
Mise à jour toutes les 30 secondes.

<br>
<br>

---

<br>
<br>

## Hors ligne

### Pas de réseau ? Pas de problème.

Périmap est une **Progressive Web App**.

Cela signifie :
- ✅ Installation sur votre écran d'accueil
- ✅ Fonctionne sans connexion internet
- ✅ Données GTFS stockées localement (33 000+ horaires)
- ✅ Synchronisation automatique au retour en ligne

**Vos trajets quotidiens restent accessibles, toujours.**

<br>
<br>

---

<br>
<br>

## Visuel

### Une carte qui respire

Interface claire. Tracés précis. Couleurs des lignes respectées.  
Zoom fluide. Navigation intuitive. Mode sombre natif.

**Leaflet + 62 000 points géométriques** pour un rendu parfait des lignes.

### Design mobile-first

Conçu d'abord pour mobile.  
Optimisé ensuite pour desktop.  
Magnifique partout.

<br>
<br>

---

<br>
<br>

## Performant

### L'obsession du détail

| Objectif | Résultat |
|----------|----------|
| Calcul d'itinéraire < 500ms | ✅ **450ms** |
| Autocomplétion < 300ms | ✅ **250ms** |
| First Contentful Paint < 1.5s | ✅ **1.2s** |
| Bundle JS < 350KB | ✅ **299KB** |

### Lighthouse Score

![Performance](https://img.shields.io/badge/Performance-92-success?style=flat)
![Accessibility](https://img.shields.io/badge/Accessibility-95-success?style=flat)
![Best Practices](https://img.shields.io/badge/Best_Practices-100-success?style=flat)
![SEO](https://img.shields.io/badge/SEO-100-success?style=flat)

<br>
<br>

---

<br>
<br>

## Optimisé pour l'usage réel

### Cache intelligent

Imaginez : 10 personnes cherchent le trajet Trélissac → Boulazac entre 14h00 et 14h05.

**Avec une API classique :** 10 appels serveur  
**Avec Périmap :** 1 seul appel partagé

**Comment ?**
- Normalisation temporelle (buckets de 5 minutes)
- Arrondi géographique (précision ~11 mètres)
- Cache distribué sur 4 niveaux

**Résultat :** -70% de coût API, meilleure réactivité

<br>
<br>

---

<br>
<br>

## Construit avec soin

### Stack moderne

```
Frontend      → Vanilla JS, Vite, Leaflet
Edge          → Vercel Edge Functions (Paris CDG1)
APIs          → Google Routes, Google Places
Data          → GTFS officiel Péribus 2026
Hosting       → Vercel (déploiement continu)
```

### Architecture edge-first

Les calculs se font au plus près de vous.  
Serveurs à Paris. Latence minimale. Réponse instantanée.

<br>
<br>

---

<br>
<br>

## Données officielles

### GTFS Péribus 2026

| Fichier | Entrées |
|---------|---------|
| Lignes de bus | 80 |
| Trajets planifiés | 2 374 |
| Arrêts | 1 329 |
| Horaires de passage | 33 408 |
| Points de tracé | 62 754 |

**Validité :** jusqu'au 28 février 2026  
**Mise à jour :** Synchronisée avec le réseau officiel

<br>
<br>

---

<br>
<br>

## Open pour les développeurs

### Démarrage rapide

```bash
# Clone
git clone https://github.com/EFFEZFEZ/perimap-.git
cd perimap-

# Install
npm install

# Dev
npm run dev
```

### Structure claire

```
api/          → Edge Functions (routes, places, realtime)
public/       → Frontend PWA
  ├── js/     → Modules (main, router, dataManager...)
  ├── css/    → Styles modulaires
  └── data/   → GTFS + GeoJSON
tests/        → Vitest + Coverage
```

### Tests inclus

```bash
npm test              # Lancer les tests
npm run test:ui       # Interface graphique
npm run test:coverage # Couverture de code
```

<br>
<br>

---

<br>
<br>

## Accessible

### Conçu pour tous

- ♿ Informations accessibilité PMR par arrêt
- 🌙 Mode sombre automatique
- 📱 Interface tactile optimisée
- ⌨️ Navigation clavier complète
- 🔊 Compatible lecteurs d'écran

**Score Lighthouse Accessibilité : 95/100**

<br>
<br>

---

<br>
<br>

## Gratuit. Pour toujours.

Périmap est **100% gratuit** pour tous les usagers.

Pas de publicité.  
Pas d'abonnement.  
Pas de données vendues.

**Juste un service public moderne.**

<br>
<br>

---

<br>
<br>

## Fait à Périgueux

Par des Périgourdins, pour les Périgourdins.

Avec une connaissance fine du territoire :
- Les zones commerciales fréquentées
- Les établissements scolaires
- Les pôles de santé
- Les habitudes de déplacement

**Un outil local, vraiment.**

<br>
<br>

---

<br>
<br>

## Rejoignez-nous

<div align="center">

### [🌐 périmap.fr](https://périmap.fr)

[![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://instagram.com/perimap.fr)
[![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white)](https://facebook.com/perimap.fr)

</div>

<br>
<br>

---

<br>
<br>

<div align="center">

## Questions techniques ?

### Architecture

**Frontend** : Vanilla JavaScript ES2022+, Vite 5, Leaflet 1.9  
**Backend** : Vercel Edge Functions (région cdg1)  
**Cache** : Multi-niveaux (CDN + Edge + Client + IndexedDB)  
**APIs** : Google Routes API, Google Places API (New)  
**Data** : GTFS officiel + temps réel multi-sources

### Performance

**Bundle principal** : 299KB minifié + compressé  
**Chargement GTFS** : <1s via Web Worker  
**Itinéraires** : ~450ms (routeur hybride GTFS + Google)  
**Offline** : Fonctionnel via Service Worker v324

### Sécurité

**HTTPS** : Forcé partout  
**CORS** : Origines autorisées configurées  
**Clés API** : Variables d'environnement Vercel  
**Headers** : X-Content-Type-Options, X-Frame-Options

</div>

<br>
<br>

---

<br>
<br>

<div align="center">

## Licence

**© 2025-2026 Périmap. Tous droits réservés.**

Ce projet est propriétaire.  
Le code peut être consulté à titre éducatif uniquement.

Voir [LICENSE](LICENSE) pour plus de détails.

<br>

---

<br>

**Fait avec ❤️ à Périgueux**

![Périmap](https://i.ibb.co/99PZh9Zq/export6-removebg-preview.webp)

</div>
