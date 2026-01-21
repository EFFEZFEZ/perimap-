/**
 * ARCHITECTURE.md - System Architecture Documentation
 * Phase 7: Final Documentation
 */

# Architecture Documentation

## Overview

Périmap utilise une architecture modulaire event-driven avec séparation claire des responsabilités.

## Core Principles

### 1. Event-Driven Communication
Tous les modules communiquent via `EventBus` pour éliminer les dépendances circulaires.

```javascript
// Émission d'événement
eventBus.emit(EVENTS.ROUTE_SELECTED, { routeId: '123' });

// Écoute d'événement
eventBus.on(EVENTS.ROUTE_SELECTED, (data) => {
    console.log('Route sélectionnée:', data.routeId);
});
```

### 2. Centralized State Management
`StateManager` gère l'état global avec historique undo/redo.

```javascript
// Modification d'état
stateManager.set('ui.modal.isOpen', true);

// Lecture d'état
const isOpen = stateManager.get('ui.modal.isOpen');

// Undo/Redo
stateManager.undo();
stateManager.redo();
```

### 3. Service Layer
Services API indépendants avec cache optimisé.

```javascript
const apiFactory = getAPIServiceFactory();
const route = await apiFactory.calculateRoute(origin, destination);
```

## Architecture Layers

### Layer 1: Core (Foundation)
- **EventBus**: Système pub/sub pour communication inter-modules
- **StateManager**: Gestion d'état centralisée avec historique
- **Logger**: Logging unifié avec niveaux (info, debug, error)

### Layer 2: Services (API)
- **RouteService**: Calculs d'itinéraires (cache 2 min)
- **GeocodeService**: Résolution coordonnées (cache 24h)
- **AutocompleteService**: Recherche lieux (cache 5 min)
- **APIServiceFactory**: Orchestration et injection de dépendances

### Layer 3: Stores (Data)
- **GTFSStore**: Données statiques transport (routes, arrêts)
- **TrafficStore**: Alertes temps réel (TTL 30 min)
- **UserStore**: Préférences utilisateur (localStorage)
- **CacheStore**: Cache unifié (mémoire + localStorage)
- **DataStoreFactory**: Orchestration stores

### Layer 4: Components (UI)
- **MapComponent**: Wrapper Leaflet pour carte interactive
- **SearchBoxComponent**: Inputs avec autocomplete
- **Composants futurs**: RouterComponent, ResultsListComponent

### Layer 5: Views (Pages)
- main.js orchestrate tout
- Pages HTML utilisent composants

## Data Flow

```
User Action
    ↓
Component (SearchBoxComponent)
    ↓
EventBus.emit(SEARCH_START)
    ↓
APIServiceFactory.calculateRoute()
    ↓
StateManager.set('data.routes')
    ↓
EventBus.emit(STATE_CHANGE)
    ↓
Components Update UI
```

## Caching Strategy

### Memory Cache
- Capacity: 100 entries
- Eviction: LRU
- Speed: ~1ms

### localStorage Cache
- Capacity: 5 MB
- Persistence: Permanent
- Speed: ~5ms

### Service-Specific TTLs
- **Routes**: 2 minutes (dynamic data)
- **Geocoding**: 24 heures (static data)
- **Autocomplete**: 5 minutes (semi-dynamic)

## Error Handling

### 1. Service Level
```javascript
try {
    const result = await service.calculateRoute(a, b);
} catch (error) {
    logger.error('Route calculation failed', { error });
    eventBus.emit(EVENTS.API_ERROR, { error });
}
```

### 2. Global Level
```javascript
window.addEventListener('error', (event) => {
    logger.error('Global error', { error: event.error });
});
```

## Performance Optimizations

### 1. Lazy Loading
Modules chargés à la demande

### 2. Code Splitting
Séparation par route/page

### 3. Cache Strategy
Multi-layer caching (memory → localStorage → API)

### 4. Debouncing
Autocomplete avec 300ms debounce

## Testing Strategy

### Unit Tests
- Core modules (EventBus, StateManager)
- Services (API layer)
- Utilities

### Integration Tests
- Service + Store interactions
- Event flows

### E2E Tests
- User journeys complets
- Navigation flows

## Deployment

### Build Process
```bash
npm run build
```

### Environment Variables
```
VITE_API_URL=https://api.peribus.fr
VITE_GTFS_URL=https://data.peribus.fr/gtfs
```

### Service Worker
Version: v448
Cache strategy: Network-first for API, cache-first for assets

## Monitoring

### Metrics Tracked
- API response times
- Cache hit rates
- Error rates
- User interactions

### Logging Levels
- **info**: Important events
- **debug**: Detailed debugging
- **error**: Errors with stack traces

## Security

### CSP Headers
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
```

### API Keys
Stored in environment variables, never committed

## Maintenance

### Adding New Feature
1. Create module in appropriate layer
2. Integrate with EventBus
3. Update StateManager schema
4. Add tests (target 85% coverage)
5. Document in this file

### Debugging
1. Check Logger output (console)
2. Inspect StateManager state
3. Monitor EventBus events
4. Check cache stats

## Future Improvements

- [ ] GraphQL pour API
- [ ] WebSocket temps réel
- [ ] IndexedDB pour GTFS
- [ ] Service Worker sync background
- [ ] Progressive Web App features
