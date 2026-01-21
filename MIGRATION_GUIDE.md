/**
 * MIGRATION_GUIDE.md - Guide d'utilisation de la nouvelle architecture
 * Phase 7: Documentation finale
 */

# Guide de Migration - Nouvelle Architecture

## 🎯 Quick Start

### Utiliser EventBus

**Avant (mauvais - couplage fort):**
```javascript
// Appel direct entre modules
mapRenderer.displayRoute(route);
searchComponent.updateResults(results);
```

**Après (bon - découplé):**
```javascript
// Communication via événements
import { eventBus, EVENTS } from './EventBus.js';

eventBus.emit(EVENTS.ROUTE_SELECTED, { route });
eventBus.on(EVENTS.ROUTE_SELECTED, (data) => {
    // React to route selection
});
```

### Utiliser StateManager

**Avant (mauvais - état dispersé):**
```javascript
// Variables globales partout
let selectedRoute = null;
let isModalOpen = false;
```

**Après (bon - état centralisé):**
```javascript
import { stateManager } from './StateManager.js';

// Set state
stateManager.set('ui.modal.isOpen', true);

// Get state
const isOpen = stateManager.get('ui.modal.isOpen');

// Subscribe to changes
stateManager.subscribe((state) => {
    console.log('State changed:', state);
});
```

### Utiliser Services API

**Avant (mauvais - fetch dispersés):**
```javascript
// Appels fetch directs
const response = await fetch('/api/route');
const data = await response.json();
```

**Après (bon - services avec cache):**
```javascript
import { getAPIServiceFactory } from './services/index.js';

const apiFactory = getAPIServiceFactory();

// Calculate route (cached 2 min)
const route = await apiFactory.calculateRoute(origin, destination);

// Geocode address (cached 24h)
const coords = await apiFactory.geocodeAddress('Périgueux');

// Autocomplete (cached 5 min)
const predictions = await apiFactory.getPlacePredictions('périg');
```

### Utiliser Data Stores

**Avant (mauvais - données mélangées):**
```javascript
// Tout dans dataManager
const routes = dataManager.getRoutes();
const alerts = dataManager.getAlerts();
```

**Après (bon - stores spécialisés):**
```javascript
import { getDataStoreFactory } from './stores/index.js';

const dataFactory = getDataStoreFactory();

// GTFS data
const routes = dataFactory.gtfs.getRoutes();

// Traffic alerts
const alerts = dataFactory.traffic.getAlerts();

// User preferences
const prefs = dataFactory.user.getPreferences();

// Cache management
const stats = dataFactory.cache.getStats();
```

### Utiliser UI Components

**Avant (mauvais - manipulation DOM directe):**
```javascript
document.getElementById('map').innerHTML = '<div>...</div>';
```

**Après (bon - composants réutilisables):**
```javascript
import { MapComponent, SearchBoxComponent } from './components/index.js';

// Initialize map
const map = new MapComponent('map-container');
map.initialize();
map.centerOn(45.184029, 0.7211149);

// Initialize search
const search = new SearchBoxComponent('search-container');
search.render();
search.setDeparture('Périgueux');
```

## 📦 Structure des Fichiers

### Avant
```
js/
├── main.js (5,683 lignes) ❌
├── apiManager.js (1,615 lignes) ❌
├── dataManager.js (1,538 lignes) ❌
└── mapRenderer.js (1,364 lignes) ❌
```

### Après
```
js/
├── core/
│   ├── EventBus.js ✅
│   ├── StateManager.js ✅
│   └── Logger.js ✅
├── services/
│   ├── RouteService.js ✅
│   ├── GeocodeService.js ✅
│   ├── AutocompleteService.js ✅
│   ├── APIServiceFactory.js ✅
│   └── index.js ✅
├── stores/
│   ├── GTFSStore.js ✅
│   ├── TrafficStore.js ✅
│   ├── UserStore.js ✅
│   ├── CacheStore.js ✅
│   ├── DataStoreFactory.js ✅
│   └── index.js ✅
├── components/
│   ├── MapComponent.js ✅
│   ├── SearchBoxComponent.js ✅
│   └── index.js ✅
└── main.js (orchestration) ✅
```

## 🔧 Patterns Communs

### Pattern 1: Événement → Action

```javascript
// Component émet événement
eventBus.emit(EVENTS.SEARCH_START, { 
    from: 'Périgueux',
    to: 'Bordeaux' 
});

// Service écoute et réagit
eventBus.on(EVENTS.SEARCH_START, async (data) => {
    const route = await apiFactory.calculateRoute(data.from, data.to);
    eventBus.emit(EVENTS.ROUTE_CALCULATED, { route });
});
```

### Pattern 2: State → UI Update

```javascript
// Update state
stateManager.set('data.routes', routes);

// UI reacts automatically
stateManager.subscribe((state) => {
    if (state.data.routes) {
        renderRoutes(state.data.routes);
    }
});
```

### Pattern 3: Service avec Cache

```javascript
class MyService {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 2 * 60 * 1000; // 2 minutes
    }
    
    async getData(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        
        const data = await fetch('/api/data');
        this.cache.set(key, { data, timestamp: Date.now() });
        return data;
    }
}
```

### Pattern 4: Component Lifecycle

```javascript
class MyComponent {
    constructor(containerId) {
        this.containerId = containerId;
        this.listeners = [];
    }
    
    initialize() {
        this.render();
        this.attachEvents();
    }
    
    render() {
        const container = document.getElementById(this.containerId);
        container.innerHTML = `<div>...</div>`;
    }
    
    attachEvents() {
        const handler = eventBus.on(EVENTS.SOMETHING, this.handleEvent);
        this.listeners.push(handler);
    }
    
    destroy() {
        // Cleanup
        this.listeners.forEach(unsub => unsub());
    }
}
```

## 🚀 Examples Pratiques

### Exemple 1: Recherche d'itinéraire

```javascript
// 1. User clicks search button
searchButton.addEventListener('click', () => {
    const from = fromInput.value;
    const to = toInput.value;
    
    eventBus.emit(EVENTS.SEARCH_START, { from, to });
});

// 2. API service calculates route
eventBus.on(EVENTS.SEARCH_START, async (data) => {
    try {
        const route = await apiFactory.calculateRoute(
            data.from,
            data.to
        );
        
        stateManager.set('data.currentRoute', route);
        eventBus.emit(EVENTS.ROUTE_CALCULATED, { route });
    } catch (error) {
        eventBus.emit(EVENTS.API_ERROR, { error });
    }
});

// 3. Map component displays route
eventBus.on(EVENTS.ROUTE_CALCULATED, (data) => {
    mapComponent.drawRoute(data.route);
});
```

### Exemple 2: Affichage alertes trafic

```javascript
// 1. Load traffic alerts
const dataFactory = getDataStoreFactory();
const alerts = dataFactory.traffic.getAlerts();

// 2. Filter by route
const routeAlerts = alerts.filter(a => a.routeId === 'A');

// 3. Display in UI
routeAlerts.forEach(alert => {
    const alertElement = createAlertElement(alert);
    alertsContainer.appendChild(alertElement);
});

// 4. Listen for new alerts
eventBus.on(EVENTS.TRAFFIC_ALERT, (data) => {
    showNotification(`Alerte: ${data.alert.message}`);
});
```

### Exemple 3: Gestion préférences utilisateur

```javascript
const userStore = dataFactory.user;

// Get preferences
const prefs = userStore.getPreferences();
console.log('Theme:', prefs.theme); // 'light' or 'dark'

// Update preferences
userStore.updatePreferences({
    theme: 'dark',
    notifications: true
});

// Listen for preference changes
eventBus.on(EVENTS.USER_PREFERENCES_CHANGED, (data) => {
    applyTheme(data.preferences.theme);
});
```

## 🧪 Testing

### Unit Test Example

```javascript
import { describe, it, expect } from 'vitest';
import { eventBus } from './EventBus.js';

describe('EventBus', () => {
    it('should emit and receive events', () => {
        let received = null;
        
        eventBus.on('test-event', (data) => {
            received = data;
        });
        
        eventBus.emit('test-event', { foo: 'bar' });
        
        expect(received).toEqual({ foo: 'bar' });
    });
});
```

### Run Tests

```bash
npm test                 # Run all tests
npm test EventBus        # Run specific test
npm test -- --coverage   # With coverage
```

## 📝 Checklist Migration

Pour migrer une feature existante:

- [ ] Identifier le code monolithique à migrer
- [ ] Créer module dans layer approprié (core/services/stores/components)
- [ ] Remplacer appels directs par EventBus
- [ ] Centraliser état dans StateManager
- [ ] Ajouter cache si nécessaire
- [ ] Écrire tests unitaires (target 85%)
- [ ] Documenter dans ARCHITECTURE.md
- [ ] Tester parité production

## ❓ FAQ

### Q: Comment débugger un événement ?

**R:** Utilisez le Logger avec niveau debug:
```javascript
logger.debug('Event emitted', { event: 'ROUTE_SELECTED', data });
```

### Q: Comment voir l'état actuel ?

**R:** Inspectez le StateManager:
```javascript
console.log(stateManager.get()); // Tout l'état
console.log(stateManager.get('ui.modal')); // Sous-état
```

### Q: Comment clear le cache ?

**R:** Utilisez CacheStore:
```javascript
const cache = dataFactory.cache;
cache.clear(); // Clear tout
cache.delete('specific-key'); // Clear une clé
```

### Q: Comment ajouter un nouvel événement ?

**R:** Ajoutez dans EventBus.EVENTS:
```javascript
export const EVENTS = {
    // ... existing events
    MY_NEW_EVENT: 'my-new-event'
};
```

## 🎓 Ressources

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture détaillée
- [PHASE7_MIGRATION_COMPLETION.md](./PHASE7_MIGRATION_COMPLETION.md) - Rapport final
- [tests/](./tests/) - Exemples de tests
- [TECHNICAL_DOC.md](./TECHNICAL_DOC.md) - Documentation technique

---

**Questions?** Consultez la documentation ou inspectez le code - tout est commenté! 🚀
