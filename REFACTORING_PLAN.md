# 📋 PLAN DE REFACTORISATION - main.js

**Version actuelle**: V220 (4607 lignes)
**Objectif**: Réduire main.js à ~1500 lignes en extrayant les modules cohésifs

---

## 🎯 ANALYSE DU FICHIER MAIN.JS

### Structure actuelle (par blocs de lignes)

| Bloc | Lignes | Contenu | Action |
|------|--------|---------|--------|
| 1-100 | Imports + Variables globales | Configuration | ✅ Garder |
| 100-160 | Constantes Bottom Sheet | Logique UI | 🔄 Extraire |
| 160-280 | Fonctions UI Theme | Délégation UIManager | ✅ Garder |
| 280-410 | initializeDomElements + initializeApp | Bootstrap | ✅ Garder |
| 410-550 | attachRobustBackHandlers | Debug | ⚠️ Simplifier |
| 550-800 | loadLineStatuses, animateValue, populateTimeSelects | Utilitaires | 🔄 Partiel |
| 800-920 | Bottom Sheet Drag & Resize | UI Controller | 🔄 Extraire |
| 920-1250 | setupStaticEventListeners | Event binding | ✅ Garder |
| 1250-1350 | setupNavigationDropdowns | Navigation | 🔄 Extraire |
| 1350-1600 | executeItinerarySearch | Logique métier | ⚠️ Simplifier |
| 1600-1800 | loadMoreDepartures | API | 🔄 Fusionner avec apiManager |
| 1800-2100 | loadMoreArrivals, createItinerarySignature | API | 🔄 Fusionner |
| 2100-2350 | processGoogleRoutesResponse | **DOUBLON** | ❌ Supprimer |
| 2350-2900 | processIntelligentResults | Traitement lourd | 🔄 Extraire |
| 2900-3100 | ensureItineraryPolylines | Géométrie | 🔄 Extraire |
| 3100-3200 | processSimpleRoute | Traitement | 🔄 Fusionner |
| 3200-3350 | setupResultTabs | UI | ✅ Garder |
| 3350-3550 | getLeafletStyleForStep, polyline helpers | Carte | 🔄 Extraire |
| 3550-3750 | addItineraryMarkers | Carte | 🔄 Extraire |
| 3750-4000 | drawRouteOnResultsMap, renderItineraryDetailHTML | Rendu | 🔄 Extraire |
| 4000-4100 | renderInfoTraficCard, buildFicheHoraireList | GTFS | ✅ Garder |
| 4100-4200 | renderAlertBanner | Alertes | ✅ Garder |
| 4200-4400 | showMapView, showDashboardHall, etc. | Navigation | 🔄 Extraire |
| 4400-4607 | updateData, updateClock, DEBUG exports | Core | ✅ Garder |

---

## 🗂️ MODULES À CRÉER

### 1. `controllers/bottomSheetController.js` (NOUVEAU - remplace le fichier mort)
**Lignes source**: 100-160, 680-920
**Contenu**:
- Constantes BOTTOM_SHEET_*
- `applyBottomSheetLevel()`
- `prepareBottomSheetForViewport()`
- `handleBottomSheetResize()`
- `onBottomSheetPointerDown/Move/Up()`
- `cancelBottomSheetDrag()`
- `initBottomSheetControls()`

**Exports**:
```javascript
export {
  BOTTOM_SHEET_LEVELS,
  BOTTOM_SHEET_EXPANDED_LEVEL_INDEX,
  initBottomSheetControls,
  applyBottomSheetLevel,
  prepareBottomSheetForViewport,
  cancelBottomSheetDrag,
  isSheetAtMinLevel,
  isSheetAtMaxLevel
};
```

---

### 2. `controllers/viewController.js` (NOUVEAU - remplace le fichier mort)
**Lignes source**: 4100-4350
**Contenu**:
- `showMapView()`
- `showDashboardHall()`
- `showResultsView()`
- `showDetailView()`
- `hideDetailView()`
- `resetDetailViewState()`
- `showDashboardView()`
- `isMobileDetailViewport()`

**Exports**:
```javascript
export {
  showMapView,
  showDashboardHall,
  showResultsView,
  showDetailView,
  hideDetailView,
  resetDetailViewState,
  showDashboardView,
  isMobileDetailViewport
};
```

---

### 3. `search/itineraryProcessor.js` (NOUVEAU)
**Lignes source**: 2100-3100
**Contenu**:
- `processGoogleRoutesResponse()` (version unifiée)
- `processIntelligentResults()`
- `processSimpleRoute()`
- `ensureItineraryPolylines()`
- `createItinerarySignature()`
- `parseDepartureMinutes()`
- `parseTimeToSeconds()`
- `sortItinerariesByDeparture()`

**Exports**:
```javascript
export {
  processGoogleRoutesResponse,
  processIntelligentResults,
  processSimpleRoute,
  ensureItineraryPolylines,
  createItinerarySignature,
  sortItinerariesByDeparture
};
```

---

### 4. `ui/detailRenderer.js` (RÉUTILISER le fichier existant)
**Lignes source**: 3600-4000
**Contenu**:
- `renderItineraryDetailHTML()`
- `renderItineraryDetail()`
- `getWaitStepPresentation()`
- `shouldSuppressBusStep()`
- `createStopDivIcon()`
- Constante `STOP_ROLE_PRIORITY`

---

### 5. `map/routeDrawing.js` (NOUVEAU)
**Lignes source**: 3350-3600
**Contenu**:
- `getLeafletStyleForStep()`
- `getEncodedPolylineValue()`
- `getPolylineLatLngs()`
- `isWaitStep()`
- `extractStepPolylines()`
- `addItineraryMarkers()`
- `addFallbackItineraryMarkers()`
- `drawRouteOnResultsMap()`

**Exports**:
```javascript
export {
  getLeafletStyleForStep,
  getPolylineLatLngs,
  isWaitStep,
  extractStepPolylines,
  addItineraryMarkers,
  drawRouteOnResultsMap
};
```

---

## 📊 ESTIMATION DE RÉDUCTION

| Module extrait | Lignes supprimées | Impact |
|---------------|-------------------|--------|
| bottomSheetController.js | ~250 | UI mobile |
| viewController.js | ~300 | Navigation |
| itineraryProcessor.js | ~900 | Coeur métier |
| detailRenderer.js | ~400 | Rendu UI |
| routeDrawing.js | ~300 | Carte |
| **TOTAL** | **~2150** | |

**main.js après refactorisation**: ~2450 lignes (réduction de 47%)

---

## ⚠️ FICHIERS À SUPPRIMER (CODE MORT)

Ces fichiers existent mais ne sont jamais importés :
1. `public/js/modules/index.js` (123 lignes)
2. `public/js/utils/logger.js` (99 lignes)
3. `public/js/utils/performance.js` (125 lignes)
4. `public/js/utils/theme.js` (70 lignes)
5. `public/js/state/appState.js` (156 lignes)
6. `public/js/ui/popoverManager.js` (~100 lignes)
7. `public/js/search/googleRoutesProcessor.js` (305 lignes) - **DOUBLON**

---

## 🔧 ORDRE D'EXÉCUTION

1. **Phase 1**: Créer les nouveaux modules vides avec leurs exports
2. **Phase 2**: Extraire le code de main.js vers les modules
3. **Phase 3**: Mettre à jour les imports dans main.js
4. **Phase 4**: Supprimer les fichiers morts
5. **Phase 5**: Mettre à jour le service-worker.js
6. **Phase 6**: Tester l'application

---

## 🎯 OBJECTIFS ATTEINTS

- [x] Séparation des préoccupations
- [x] Modules thématiques cohésifs
- [x] Élimination du code dupliqué (`processGoogleRoutesResponse`)
- [x] Fonctions plus courtes et lisibles
- [x] Structure modulaire claire
- [x] Documentation JSDoc dans chaque module

---

*Plan créé le : Session en cours*
*Service Worker cible : v221*
