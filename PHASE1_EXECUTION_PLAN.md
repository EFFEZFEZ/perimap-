# 🚀 PHASE 1: INTÉGRATION EVENTBUS - PLAN D'EXÉCUTION

## État Actuel
- ✅ EventBus.js créé (pub/sub pattern)
- ✅ StateManager.js créé (gestion d'état immutable)
- ✅ Logger.js créé (logging centralisé)
- ✅ main.js importé les 3 fichiers core
- ✅ AUDIT_FEATURES.md complété

## Prochaines Étapes (Semaine 1)

### 1. Remapper les écouteurs de navigation (2 heures)
**Fichier:** main.js (lignes ~3000+)
**Cible:** Les boutons data-action="..."

```javascript
// AVANT (listeners éparpillés):
document.getElementById('bottom-nav').addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  if (action === 'horaires') { /* code */ }
  if (action === 'carte') { /* code */ }
  // ... 50 lignes de conditionnels
});

// APRÈS (avec EventBus):
eventBus.on('nav:select', ({ view }) => {
  stateManager.setState({ currentView: view });
  loadViewContent(view);
});

document.getElementById('bottom-nav').addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  eventBus.emit('nav:select', { view: action });
});
```

### 2. Remapper recherche d'itinéraire (3 heures)
**Fichier:** main.js (lignes ~1000-2000)
**Cible:** Function recherche itinéraire

```javascript
// AVANT:
async function handleSearch(departure, arrival, time) {
  // 100 lignes de logique mélangée
  try {
    const results = await apiManager.search(...);
    renderResults(results); // Couplage étroit
    updateUI(); // Couplage étroit
  }
}

// APRÈS:
async function handleSearch(departure, arrival, time) {
  eventBus.emit('search:start', { departure, arrival, time });
  stateManager.setState({ 
    search: { loading: true, departure, arrival }
  }, 'search:start');
  
  try {
    const results = await apiManager.search(...);
    eventBus.emit('search:complete', { itineraries: results });
    stateManager.setState({ 
      search: { results, loading: false }
    }, 'search:complete');
  } catch (error) {
    eventBus.emit('search:error', { error });
    stateManager.setState({ 
      search: { error: error.message, loading: false }
    }, 'search:error');
  }
}

// Les listeners sont découplés:
eventBus.on('search:complete', ({ itineraries }) => {
  renderResults(itineraries); // renderResults n'a pas besoin de connaître le contexte
});

eventBus.on('search:start', () => {
  eventBus.emit('ui:loading', true);
});
```

### 3. Remapper carte interactive (2 heures)
**Fichier:** main.js + mapRenderer.js
**Cible:** Events carte (zoom, pan, clic arrêt/marqueur)

```javascript
// MapRenderer émet les événements:
eventBus.emit('map:route-selected', { itinerary });
eventBus.emit('map:stop-selected', { stop });
eventBus.emit('map:viewport-changed', { bounds });

// main.js les écoute:
eventBus.on('map:route-selected', ({ itinerary }) => {
  // Mettre à jour state
  stateManager.setState({ 
    map: { selectedRoute: itinerary }
  });
  // Afficher détails
  showItineraryDetails(itinerary);
});
```

### 4. Centraliser state management (2 heures)
**Fichier:** main.js
**Cible:** Variables globales → StateManager

```javascript
// AVANT:
let allFetchedItineraries = [];
let lastSearchMode = 'partir';
let currentDetailRouteLayer = null;
let lineStatuses = {};

// APRÈS:
// Tout dans StateManager.getState()
stateManager.getState().search.results
stateManager.getState().search.mode
stateManager.getState().map.selectedRoute
stateManager.getState().data.lineStatuses
```

### 5. Intégrer Logger (1 heure)
**Fichier:** main.js (tous les console.log/error)
**Cible:** Remplacer par logger.*

```javascript
// AVANT:
console.log('Itinéraires trouvés:', results);
console.error('Erreur API:', error);

// APRÈS:
logger.info('Itinéraires trouvés', results);
logger.error('Erreur API', error);
```

---

## Fichiers à Modifier en Phase 1

1. **main.js** (5561 lignes)
   - Ajouter EventBus imports ✅
   - Remapper tous les addEventListener → eventBus
   - Migrer état global → stateManager
   - Remplacer console.* → logger.*

2. **app.js** (Point d'entrée, ligne 268)
   - Initialiser EventBus
   - Initialiser StateManager
   - Initialiser Logger
   - Configurer écouteurs de base

3. **Service Worker** (v444 → v445)
   - Version bump
   - Commit: "feat: Phase 1 - EventBus integration start"

---

## Tests de Validation Phase 1

Après migration, vérifier dans Console:
```javascript
// Test 1: EventBus fonctionne
eventBus.emit('test:event', { data: 'test' });
eventBus.on('test:event', (data) => console.log('✅ EventBus OK:', data));

// Test 2: StateManager fonctionne
stateManager.setState({ test: true });
console.log('✅ StateManager:', stateManager.getState().test);

// Test 3: Logger fonctionne
logger.info('Test message');
console.log('✅ Logger:', logger.getLogs().length);

// Test 4: Navigation fonctionne
document.querySelector('[data-action="horaires"]').click();
console.log('✅ Navigation:', stateManager.getState().currentView);
```

---

## Risques Identifiés

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Listeners non remappés correctement | Moyenne | Haut | Tests unitaires + tests manuels |
| State pas synchronisé | Haut | Haut | Subscribe aux state changes |
| Performance degradée | Basse | Moyen | Profiling + optimiser EventBus |
| Bugs en production | Moyenne | Haut | Feature flag pour EventBus |

---

## Timeline Proposée

- **Jour 1** (2 heures): Remapper navigation + recherche
- **Jour 2** (2 heures): Remapper carte + state
- **Jour 3** (1 heure): Logger + tests
- **Jour 4** (2 heures): Tests complets + bugfix
- **Jour 5** (1 heure): Déploiement production

**Total Phase 1:** ~8 heures de dev + testing

---

## Succès = 

✅ Tous les boutons de navigation fonctionnent → Changement de vue
✅ Recherche itinéraire retourne les mêmes résultats
✅ Carte affiche correctement arrêts + itinéraires
✅ Aucun console error ou warning
✅ Performance ≥ version précédente
✅ EventBus capture tous les événements système
✅ StateManager synchronisé avec UI en tout temps
✅ Logger enregistre toutes actions
✅ Code Plus lisible et maintenable

---

**État:** Plan Phase 1 prêt pour exécution ✅
