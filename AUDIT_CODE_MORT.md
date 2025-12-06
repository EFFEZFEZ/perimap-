# 🔍 AUDIT CODE MORT - PériMap

**Date**: Audit réalisé en session
**Version Service Worker**: v220

---

## 📊 RÉSUMÉ

| Catégorie | Fichiers identifiés | Action recommandée |
|-----------|---------------------|-------------------|
| 🔴 Code mort (jamais importé) | 10 fichiers | Suppression |
| 🟠 Doublons fonctionnels | 2 cas | Consolidation |
| 🟢 Fichiers utilisés | ~40 fichiers | Garder |

---

## 🔴 FICHIERS JAMAIS IMPORTÉS (CODE MORT)

Ces fichiers ne sont importés nulle part dans le code actif. Ils sont uniquement référencés dans le service-worker pour le cache, mais jamais utilisés.

### 1. `public/js/modules/index.js` (123 lignes)
- **Rôle prévu**: Fichier barrel pour ré-exporter tous les modules
- **Problème**: Jamais importé - `main.js` importe directement chaque module
- **Action**: ❌ **SUPPRIMER**

### 2. `public/js/utils/logger.js` (99 lignes)
- **Rôle prévu**: Système de logging centralisé avec niveaux DEBUG/INFO/WARN/ERROR
- **Problème**: Jamais importé - `console.log/warn/error` utilisés directement
- **Action**: ❌ **SUPPRIMER** ou intégrer progressivement

### 3. `public/js/utils/performance.js` (125 lignes)
- **Rôle prévu**: Throttle, debounce, requestIdleCallback polyfill
- **Problème**: Jamais importé - throttle/debounce codés en inline dans main.js
- **Action**: ❌ **SUPPRIMER** ou remplacer les implémentations inline

### 4. `public/js/utils/theme.js` (70 lignes)
- **Rôle prévu**: Gestion centralisée du thème clair/sombre
- **Problème**: Jamais importé - thème géré directement dans UIManager
- **Action**: ❌ **SUPPRIMER**

### 5. `public/js/state/appState.js` (156 lignes)
- **Rôle prévu**: État centralisé type Redux/MobX
- **Problème**: Jamais importé - état géré via variables globales dans main.js
- **Action**: ❌ **SUPPRIMER** (migration future possible)

### 6. `public/js/ui/popoverManager.js` (~100 lignes)
- **Rôle prévu**: Gestion des popovers (arrêts intermédiaires)
- **Problème**: Jamais importé depuis main.js - logique inline
- **Action**: ❌ **SUPPRIMER**

### 7. `public/js/ui/detailRenderer.js` (~300 lignes)
- **Rôle prévu**: Rendu HTML des détails d'itinéraire
- **Problème**: Seul import depuis modules/index.js (qui n'est pas utilisé)
- **Action**: ❌ **SUPPRIMER**

### 8. `public/js/controllers/bottomSheetController.js` (~200 lignes)
- **Rôle prévu**: Contrôle du bottom sheet mobile
- **Problème**: Seul import depuis modules/index.js (qui n'est pas utilisé)
- **Action**: ❌ **SUPPRIMER** - logique inline dans main.js

### 9. `public/js/controllers/viewController.js` (~350 lignes)
- **Rôle prévu**: Navigation entre vues (map, dashboard, detail)
- **Problème**: Seul import depuis modules/index.js - main.js a ses propres fonctions
- **Action**: ❌ **SUPPRIMER**

### 10. `public/js/search/googleRoutesProcessor.js` (305 lignes)
- **Rôle prévu**: Traitement des réponses Google Routes API
- **Problème**: Jamais importé - `main.js` ligne 2107 contient une COPIE EXACTE
- **Action**: ❌ **SUPPRIMER** (doublon)

---

## 🟠 DOUBLONS FONCTIONNELS

### Doublon 1: `processGoogleRoutesResponse()`
- **Fichier 1**: `public/js/search/googleRoutesProcessor.js` (ligne 22-301)
- **Fichier 2**: `public/js/main.js` (ligne 2107-2340)
- **État**: Copies quasi-identiques
- **Solution**: Supprimer googleRoutesProcessor.js, garder la version dans main.js

### Doublon 2: `showDetailView()` / Navigation vues
- **Fichier 1**: `public/js/controllers/viewController.js` (export showDetailView)
- **Fichier 2**: `public/js/main.js` (ligne 4189 - function showDetailView)
- **État**: Implémentations différentes
- **Solution**: Supprimer viewController.js, garder main.js

---

## 🟢 FICHIERS ACTIFS (NE PAS TOUCHER)

### Core Application
| Fichier | Imports | Rôle critique |
|---------|---------|---------------|
| `main.js` | Point d'entrée | Orchestration générale |
| `apiManager.js` | main.js | Appels API Google Routes |
| `dataManager.js` | main.js, routerWorker | Gestion GTFS + IndexedDB |
| `ranking.js` | main.js | Filtrage/tri itinéraires |
| `resultsRenderer.js` | main.js | Affichage résultats |

### Utilitaires actifs
| Fichier | Imports |
|---------|---------|
| `formatters.js` | ranking.js, polyline.js |
| `geo.js` | main.js |
| `gtfsProcessor.js` | dataManager.js, scripts/preprocess-gtfs.mjs |
| `polyline.js` | (indirect via formatters) |

### Configuration
| Fichier | Imports |
|---------|---------|
| `config.js` | apiManager.js, main.js |
| `config/icons.js` | resultsRenderer.js, main.js |
| `config/routes.js` | trafficInfo.js, main.js |

### UI/Managers
| Fichier | Imports |
|---------|---------|
| `uiManager.js` | main.js |
| `mapRenderer.js` | main.js |
| `timeManager.js` | main.js |
| `tripScheduler.js` | main.js |
| `busPositionCalculator.js` | main.js |
| `geolocationManager.js` | main.js |
| `viewLoader.js` | app.js, main.js |
| `trafficInfo.js` | main.js |
| `router.js` | main.js, routerWorker.js |
| `routerWorkerClient.js` | main.js |
| `stopTimesStore.js` | dataManager.js |
| `app.js` | index.html (script module) |

### Workers
| Fichier | Utilisation |
|---------|-------------|
| `gtfsWorker.js` | dataManager.js via new Worker() |
| `routerWorker.js` | routerWorkerClient.js via new Worker() |

### API Proxies (Vercel Functions)
| Fichier | Route |
|---------|-------|
| `api/routes.js` | /api/routes |
| `api/places.js` | /api/places |
| `api/geocode.js` | /api/geocode |
| `api/admin-token.js` | /api/admin-token (about.html) |

---

## 📋 ACTIONS RECOMMANDÉES

### Phase 1 : Nettoyage immédiat (0 risque)
```
Supprimer ces fichiers inutilisés :
- public/js/modules/index.js
- public/js/utils/logger.js  
- public/js/utils/performance.js
- public/js/utils/theme.js
- public/js/state/appState.js
- public/js/ui/popoverManager.js
- public/js/ui/detailRenderer.js
- public/js/controllers/bottomSheetController.js
- public/js/controllers/viewController.js
- public/js/search/googleRoutesProcessor.js
```

### Phase 2 : Mettre à jour service-worker.js
Retirer ces fichiers du cache ASSETS_TO_CACHE :
```javascript
// SUPPRIMER ces lignes :
'/js/modules/index.js',
'/js/ui/popoverManager.js', 
'/js/ui/detailRenderer.js',
'/js/controllers/bottomSheetController.js',
'/js/controllers/viewController.js',
'/js/search/googleRoutesProcessor.js',
// Note: logger.js, performance.js, theme.js, appState.js ne sont PAS dans le cache
```

### Phase 3 : Incrémenter version
```javascript
const CACHE_VERSION = 'v221'; // Après nettoyage
```

---

## ⚠️ AVERTISSEMENT

Ces fichiers ont été créés pour une refactorisation future qui n'a jamais été finalisée. 
Le code actif reste dans `main.js` (4607 lignes monolithiques).

Si vous souhaitez modulariser à l'avenir :
1. Gardez ces fichiers comme templates
2. Migrez progressivement depuis main.js
3. Testez chaque migration individuellement

---

## 📊 ÉCONOMIE ESTIMÉE

| Métrique | Avant | Après |
|----------|-------|-------|
| Fichiers JS | ~25 | ~15 |
| Lignes code mort | ~1500 | 0 |
| Taille cache SW | +50 KB | - |

---

*Audit généré automatiquement par Copilot*
