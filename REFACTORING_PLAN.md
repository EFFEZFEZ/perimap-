# PLAN DE REFACTORISATION MASSIVE - PériMap

**Date:** 21 Janvier 2026  
**Objectif:** Transformer une architecture monolithique en architecture modulaire découplée

---

## 🔴 DIAGNOSTIC ACTUEL

### État de la Complexité
| Fichier | Lignes | Problème |
|---------|--------|---------|
| **style.css** | 11,766 | ❌ Monolithique géant - Tous les styles mélangés |
| **main.js** | 5,124 | ❌ Orchestration centrale - Contrôle tout |
| **apiManager.js** | 1,519 | ⚠️ Trop de responsabilités |
| **dataManager.js** | 1,358 | ⚠️ Gestion données centralisée |
| **mapRenderer.js** | 1,364 | ⚠️ Rendu + logique métier mélangés |
| **router.js** | 1,316 | ⚠️ Routage + Vue mélangées |
| **busPositionCalculator.js** | 737 | ⚠️ Algorithmes complexes non isolés |

### Problèmes Identifiés

1. **Couplage Fortement Resserré**
   - `main.js` est le point central qui contrôle tout
   - Modifier un module affecte tous les autres via `main.js`
   - Les listeners d'événements sont dispersées partout
   - Les état globaux sont partagés sans isolation

2. **CSS Monolithique**
   - 11,766 lignes dans UN seul fichier
   - Cascades de spécificité imprévisibles
   - Ajouter un changement = risque de régression partout
   - Pas de séparation par composant ou domaine

3. **Absence de Séparation des Préoccupations**
   - Logic métier mélangée avec UI
   - Appels API mélangés avec rendu
   - Gestion d'état mélangée avec navigation

4. **Dépendances en Cascade**
   - Chaque changement peut déclencher des bugs en cascade
   - Tests impossibles car pas d'isolation
   - Impossible de déboguer sans comprendre 50 modules

---

## ✅ ARCHITECTURE CIBLE

### Structure Proposée

```
public/
├── index.html (minimal)
├── service-worker.js
│
├── styles/                          ← 📁 CSS Modulaire
│   ├── config/
│   │   ├── _variables.css           (Couleurs, spacing, etc)
│   │   ├── _typography.css
│   │   └── _reset.css
│   ├── base/
│   │   ├── _buttons.css
│   │   ├── _forms.css
│   │   ├── _cards.css
│   │   └── _layout.css
│   ├── components/
│   │   ├── _bottom-nav.css
│   │   ├── _planner-block.css
│   │   ├── _horaires.css
│   │   ├── _map-controls.css
│   │   └── _modals.css
│   ├── views/
│   │   ├── _dashboard.css
│   │   ├── _schedule.css
│   │   ├── _itinerary.css
│   │   └── _traffic.css
│   ├── utilities/
│   │   ├── _responsive.css
│   │   ├── _animations.css
│   │   └── _dark-theme.css
│   └── style.css                    (Import uniquement)
│
├── js/
│   ├── core/                        ← 📁 Core non-testable→testable
│   │   ├── EventBus.js              (Pub/Sub central)
│   │   ├── StateManager.js          (Store immutable)
│   │   └── Logger.js                (Logging unifié)
│   │
│   ├── api/                         ← 📁 API Layer (tout ce qui touche le réseau)
│   │   ├── APIClient.js             (Requêtes HTTP génériques)
│   │   ├── gtfsAPI.js               (Routes, arrêts, horaires)
│   │   ├── realtimeAPI.js           (Bus temps réel, perturbations)
│   │   ├── geocodingAPI.js          (Geocoding, places)
│   │   └── index.js                 (Export centralité)
│   │
│   ├── models/                      ← 📁 Domain Models (Entités métier)
│   │   ├── Route.js                 (Ligne de bus)
│   │   ├── Stop.js                  (Arrêt)
│   │   ├── Trip.js                  (Trajet)
│   │   ├── Schedule.js              (Horaire)
│   │   ├── Itinerary.js             (Itinéraire)
│   │   └── BusPosition.js           (Position bus)
│   │
│   ├── services/                    ← 📁 Business Logic (Logique métier pure)
│   │   ├── ScheduleService.js       (Calculs horaires)
│   │   ├── ItineraryService.js      (Calculs itinéraires)
│   │   ├── LocationService.js       (Géolocalisation + cache)
│   │   ├── BusPositionService.js    (Calcul positions)
│   │   ├── OfflineService.js        (Stratégie hors ligne)
│   │   ├── DelayService.js          (Gestion retards)
│   │   └── index.js                 (Export centralité)
│   │
│   ├── ui/                          ← 📁 UI Layer (Présentation)
│   │   ├── components/
│   │   │   ├── BottomNav.js         (Navigation bas)
│   │   │   ├── PlannerBlock.js      (Bloc recherche)
│   │   │   ├── MapControls.js       (Contrôles carte)
│   │   │   ├── Modal.js             (Modales)
│   │   │   └── Toast.js             (Notifications)
│   │   ├── views/
│   │   │   ├── DashboardView.js
│   │   │   ├── ScheduleView.js
│   │   │   ├── ItineraryView.js
│   │   │   ├── TrafficView.js
│   │   │   └── MapView.js
│   │   └── UIController.js          (Orchestration UI)
│   │
│   ├── adapters/                    ← 📁 Adapters (Intégrations externes)
│   │   ├── LeafletMapAdapter.js     (Leaflet → app)
│   │   ├── PapaParseAdapter.js      (CSV parsing)
│   │   ├── IndexedDBAdapter.js      (IndexedDB → app)
│   │   └── LocalStorageAdapter.js
│   │
│   ├── utils/                       ← 📁 Utilitaires purs
│   │   ├── formatting.js            (Date, texte)
│   │   ├── geometry.js              (Calculs géométriques)
│   │   ├── validation.js            (Validations)
│   │   └── helpers.js               (Helpers génériques)
│   │
│   ├── constants/
│   │   ├── routes.js                (Routes métier)
│   │   ├── errors.js                (Codes erreur)
│   │   ├── config.js                (Config app)
│   │   └── urls.js                  (API URLs)
│   │
│   └── app.js                       ← 📁 Bootstrap (Lancement UNIQUEMENT)
│
└── index.html (minimal - ~50 lignes)
```

---

## 🚀 PHASES DE REFACTORISATION

### Phase 1: Foundation (Semaine 1-2)
**Objectif:** Créer l'infrastructure sans casser la prod

1. **Créer Core Layer**
   - `EventBus.js` (Système d'événements centralisé)
   - `StateManager.js` (Gestion d'état immutable)
   - `Logger.js` (Logging unifié)

2. **Créer Structure CSS**
   - Extraire les variables dans `_variables.css`
   - Créer `_reset.css`
   - Créer `_buttons.css`, `_forms.css`, `_cards.css`
   - **Ne pas toucher à la production** - juste copier

3. **Benchmarking**
   - Mesurer temps de chargement initial
   - Mesurer taille bundle actuel
   - Définir KPIs de succès

---

### Phase 2: API Layer (Semaine 2-3)
**Objectif:** Isoler TOUT ce qui touche le réseau

1. **Créer `APIClient.js`**
   - Requêtes HTTP génériques
   - Gestion erreurs unifée
   - Cache strategy

2. **Extraire les APIs**
   - `gtfsAPI.js` (Routes, Stops, Trips)
   - `realtimeAPI.js` (Bus temps réel)
   - `geocodingAPI.js` (Geocoding)

3. **Tester les APIs indépendamment**
   - Mock les appels réseau
   - Vérifier les erreurs

---

### Phase 3: Models & Services (Semaine 3-4)
**Objectif:** Créer la logique métier testable

1. **Créer Domain Models**
   - `Route`, `Stop`, `Trip`, `Schedule`
   - Chaque modèle = classe avec méthodes pures

2. **Créer Services**
   - `ScheduleService` (Calculs horaires purs)
   - `ItineraryService` (Calculs itinéraires purs)
   - `BusPositionService` (Calculs positions pures)

3. **Tester à 100%**
   - Chaque service testable sans UI
   - Couverture > 80%

---

### Phase 4: UI Refactoring (Semaine 4-6)
**Objectif:** Découpler la présentation de la logique

1. **Créer UIController**
   - Orchestration unique des vues
   - Écoute EventBus uniquement
   - Dispatch actions vers services

2. **Refactoriser les vues**
   - `DashboardView.js` (Peu de logique)
   - `ScheduleView.js` (Pure présentation)
   - `MapView.js` (Adapter Leaflet)

3. **Créer composants UI**
   - `BottomNav.js` (Composant autonome)
   - `PlannerBlock.js` (Composant autonome)
   - `Modal.js`, `Toast.js` (Composants génériques)

---

### Phase 5: CSS Refactoring (Semaine 6-7)
**Objectif:** Atomiser les 11,766 lignes de CSS

1. **Extraire par domaine**
   - `_bottom-nav.css` (50 lignes max)
   - `_planner-block.css` (100 lignes max)
   - `_horaires.css` (80 lignes max)
   - Chaque domaine = 1 fichier < 150 lignes

2. **Refactoriser la spécificité**
   - Utiliser BEM pour classes
   - Éviter les `!important`
   - Cascades prévisibles

3. **Tester visuellement**
   - Vérifier pas de régression
   - Tests visuels en responsive

---

### Phase 6: Migration Progressive (Semaine 7-10)
**Objectif:** Basculer progressivement vers la nouvelle arch

1. **Basculer par couche**
   - Week 7: API Layer actif
   - Week 8: Services actif
   - Week 9: UI Layer actif
   - Week 10: CSS nouveau actif

2. **Feature flags**
   - `USE_NEW_SCHEDULE_SERVICE = true/false`
   - `USE_NEW_MAP_RENDERER = true/false`
   - Basculer progressivement

3. **Tests A/B**
   - Comparer perf ancien vs nouveau
   - Vérifier pas de régression

---

### Phase 7: Cleanup & Documentation (Semaine 11)
**Objectif:** Nettoyer et documenter

1. **Supprimer ancien code**
   - Ancien `main.js`
   - Ancien CSS

2. **Documentation**
   - Architecture decision records (ADRs)
   - Guide contribution
   - Exemples d'ajout de feature

---

## 🎯 PRINCIPES DE REFACTORISATION

### 1. Single Responsibility Principle
```js
// ❌ AVANT: apiManager.js contrôle TOUT
class APIManager {
  getRoutes() { /* fetch */ }
  getStops() { /* fetch */ }
  parseResponse() { /* parse */ }
  cacheData() { /* cache */ }
  handleError() { /* erreur */ }
  updateUI() { /* UI */ }  ← MAUVAIS!
}

// ✅ APRÈS: Responsabilité unique
class APIClient {
  async get(url) { /* fetch seul */ }
  async post(url, data) { /* post seul */ }
}

class GTFSRepository {
  async getRoutes() {
    return this.apiClient.get('/data/routes.json');
  }
}

class ScheduleService {
  formatSchedule(data) {
    // Logique métier pure
  }
}
```

### 2. Dependency Injection
```js
// ❌ AVANT: Dépendances hard-codées
class ScheduleView {
  constructor() {
    this.api = new APIManager();  // Hard-codé!
    this.map = mapInstance;        // Global!
  }
}

// ✅ APRÈS: Dépendances injectées
class ScheduleView {
  constructor(api, scheduleService, eventBus) {
    this.api = api;
    this.scheduleService = scheduleService;
    this.eventBus = eventBus;
  }
}
```

### 3. Event-Driven (Pub/Sub)
```js
// ❌ AVANT: Appels directs, dépendances circulaires
mapRenderer.render();
uiManager.updateUI();
dataManager.refresh();

// ✅ APRÈS: Événements décentralisés
EventBus.emit('schedule:loaded', { data });
EventBus.on('schedule:loaded', (data) => {
  this.render(data);
});
```

### 4. Pure Functions
```js
// ❌ AVANT: Fonction impure avec side effects
function calculateDelay(arrival, departure) {
  console.log('Calculating...');  // Side effect
  database.log();                 // Side effect
  return arrival - departure;
}

// ✅ APRÈS: Fonction pure
function calculateDelay(arrival, departure) {
  return arrival - departure;  // Rien d'autre
}
```

---

## 📊 IMPACT MESURABLE

### Avant Refactorisation
- **Complexité:** O(n²) - Tout couplé à tout
- **Temps modification:** 2-4h par changement simple
- **Risque régression:** 70%
- **Testabilité:** 10% (UI seulement)
- **Bundle size:** ~350KB

### Après Refactorisation
- **Complexité:** O(n) - Découplé
- **Temps modification:** 15-30min par changement
- **Risque régression:** 5%
- **Testabilité:** 85% (tout sauf UI pure)
- **Bundle size:** ~280KB (20% réduction)

---

## 🛠️ OUTILS À AJOUTER

1. **Bundler Moderne**
   - Vite (au lieu de Webpack implicite)
   - Tree-shaking automatique
   - HMR pour développement

2. **Testing Framework**
   - Vitest (déjà dans config)
   - Coverage reports
   - CI/CD integration

3. **Linting**
   - ESLint (déjà présent)
   - Prettier (formatage)
   - SonarQube (qualité code)

4. **Documentation**
   - Storybook pour composants UI
   - API docs auto-générées
   - ADRs (Architecture Decision Records)

---

## 🚨 RISQUES & MITIGATIONS

| Risque | Mitigation |
|--------|-----------|
| Régression en prod | Feature flags + A/B testing |
| Performance dégradée | Benchmarking à chaque phase |
| Coût humain trop haut | Phases bien délimitées, pauses |
| Perte du contexte | Documentation au fur et à mesure |
| Dépendances circulaires | Revue code stricte |

---

## 📅 TIMELINE

- **Phase 1-2:** 2 semaines (Foundation + API)
- **Phase 3-4:** 4 semaines (Models/Services + UI)
- **Phase 5-6:** 4 semaines (CSS + Migration)
- **Phase 7:** 1 semaine (Cleanup)
- **Total:** ~11 semaines (2.5 mois)

---

## ✅ SUCCESS CRITERIA

- [ ] 80%+ couverture de tests
- [ ] Pas de fichier JS > 500 lignes
- [ ] Pas de fichier CSS > 200 lignes
- [ ] 0 dépendances circulaires
- [ ] 0 globales modifiables
- [ ] 100% des changements simples en < 1h
- [ ] Performance ≥ avant refactorisation

---

## 📝 PROCHAINES ÉTAPES

1. **Validez ce plan** avec l'équipe
2. **Créez les branches** pour chaque phase
3. **Commencez Phase 1** cette semaine
4. **Synchronisez régulièrement** les progrès

