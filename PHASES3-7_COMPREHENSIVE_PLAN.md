# Phases 3-7: Comprehensive Migration Plan

**Status:** Phase 2 Complete, Phase 3 Initiated  
**Total Remaining Work:** ~15-20 hours  
**Target Completion:** Single extended session

---

## PHASE 3: DATA LAYER REFACTORING (2-3 hours)

### Objective
Decompose `dataManager.js` (1,538 lines) into focused, event-driven stores.

### Stores to Create

#### 3.1 GTFSStore.js (400 lines) ✅ STARTED
**Responsibility:** GTFS static data (routes, stops, trips, calendars, shapes)

**Public Methods:**
- `loadAllData(onProgress)` - Load with cache-first strategy
- `getRoute(routeId)` - Get single route
- `getStop(stopId)` - Get single stop
- `getTrip(tripId)` - Get single trip
- `getStopTimes(tripId)` - Get times for trip
- `getStopsByName(name)` - Search stops by name
- `getTripsForRoute(routeId)` - Get all trips for route
- `getArrivalsAtStop(stopId)` - Get arrivals at stop
- `getStats()` - Return data statistics

**Cache Strategy:**
- 12-hour TTL for GTFS data (rarely changes mid-day)
- IndexedDB + localStorage fallback
- Compress before storage (~2-3MB → 500KB)

**Event Integration:**
- Emits: `DATA_LOADED`, `DATA_ERROR`
- Listens: None
- Updates StateManager: `data.gtfs`

---

#### 3.2 TrafficStore.js (300 lines) - NOT YET STARTED
**Responsibility:** Real-time traffic alerts and delays

**Public Methods:**
- `addAlert(alert)` - Add new traffic alert
- `removeAlert(alertId)` - Remove resolved alert
- `getAlerts()` - Get all active alerts
- `getAlertsByRoute(routeId)` - Alerts for specific route
- `getDelay(routeId, tripId)` - Get delay for trip
- `recordDelay(routeId, tripId, delaySeconds)` - Record observation
- `clearExpiredAlerts(ttlMs)` - Clean old alerts

**Event Integration:**
- Emits: `TRAFFIC_ALERT`, `TRAFFIC_RESOLVED`
- Listens: EventBus real-time updates
- Updates StateManager: `data.traffic`

**Data Source:**
- Real-time API updates (websocket/polling)
- Delay calculations from realtimeManager

---

#### 3.3 UserStore.js (250 lines) - NOT YET STARTED
**Responsibility:** User preferences, history, saved locations

**Public Methods:**
- `getSavedLocations()` - Get user's favorite places
- `addSavedLocation(location)` - Save a place
- `removeSavedLocation(id)` - Delete saved place
- `getSearchHistory()` - Get recent searches
- `addSearchToHistory(search)` - Record search
- `getPreferences()` - Get user settings
- `updatePreferences(prefs)` - Update settings

**Event Integration:**
- Emits: None (data-only)
- Listens: `nav:select`, `search:complete`
- Updates StateManager: `user`

**Storage:**
- localStorage for preferences
- IndexedDB for history (500+ items)

---

#### 3.4 CacheStore.js (200 lines) - NOT YET STARTED
**Responsibility:** Unified caching layer for all data

**Public Methods:**
- `set(key, value, ttlMs)` - Store value with TTL
- `get(key)` - Retrieve cached value
- `has(key)` - Check if key exists
- `delete(key)` - Remove cache entry
- `clear()` - Clear entire cache
- `getStats()` - Cache statistics
- `prune()` - Remove expired entries

**Caching Strategy:**
```javascript
Cache Hierarchy:
1. Memory (fastest, limited)
   - Active searches: 1-2 min TTL
   - API responses: 5-30 min TTL
   
2. SessionStorage (medium, ~5MB)
   - User preferences
   - Recent routes
   - Session data
   
3. LocalStorage (persistent, ~10MB)
   - GTFS data
   - User history
   - App state

4. IndexedDB (persistent, ~50MB+)
   - Large datasets
   - Historical data
```

**Event Integration:**
- Emits: None
- Listens: `search:complete`, `data:loaded`
- Metrics: Size, hit rate, eviction count

---

### Phase 3 Integration Steps

1. **Create all 4 stores** (parallel work possible)
2. **Create DataStoreFactory** (similar to APIServiceFactory)
3. **Update main.js imports:**
   ```javascript
   // OLD:
   import { DataManager } from './dataManager.js';
   const dataManager = new DataManager();
   
   // NEW:
   import { initializeDataStores, getDataStoreFactory } from './stores/index.js';
   const storeFactory = initializeDataStores(config);
   ```

4. **Replace dataManager calls:**
   - `dataManager.loadAllData()` → `storeFactory.gtfs.loadAllData()`
   - `dataManager.getRoute()` → `storeFactory.gtfs.getRoute()`
   - `dataManager.routes` → `storeFactory.gtfs.routes`
   - etc.

5. **Add EventBus listeners:**
   - TrafficStore listens to real-time updates
   - UserStore listens to user actions
   - CacheStore manages all caches

6. **Update StateManager:**
   - Add `data.gtfs`, `data.traffic`, `user` sections
   - Subscribe to store changes

---

## PHASE 4: UI COMPONENTS MODULARIZATION (2-2.5 hours)

### Objective
Break down mapRenderer.js (1,364L) and router.js (1,316L) into modular components.

### Components to Create

#### 4.1 MapComponent.js (400 lines)
**Responsibility:** Map rendering (Leaflet wrapper)

**Methods:**
- `initialize()` - Set up Leaflet map
- `addLayer(layer)` - Add GeoJSON layer
- `removeLayer(layerId)` - Remove layer
- `centerOn(lat, lng)` - Pan to location
- `fitBounds(bounds)` - Zoom to bounds
- `drawRoute(route)` - Draw itinerary
- `clearRoute()` - Remove route drawing
- `getViewport()` - Get current bounds

**Event Integration:**
- Emits: `map:ready`, `map:viewport-changed`
- Listens: `map:route-selected`

---

#### 4.2 RouterComponent.js (300 lines)
**Responsibility:** Routing and waypoint management

**Methods:**
- `setOrigin(coords)` - Start point
- `setDestination(coords)` - End point
- `addWaypoint(coords)` - Intermediate stop
- `removeWaypoint(index)` - Delete waypoint
- `getRouteMatrix()` - Multi-leg calculation
- `optimize()` - Reorder for efficiency

---

#### 4.3 SearchBoxComponent.js (250 lines)
**Responsibility:** Departure/arrival input with autocomplete

**Methods:**
- `render()` - Generate DOM
- `setDeparture(label, coords)` - Set from
- `setArrival(label, coords)` - Set to
- `onAutocomplete(query)` - Handle autocomplete
- `onSearch()` - Trigger search
- `clear()` - Reset form

---

#### 4.4 ResultsListComponent.js (250 lines)
**Responsibility:** Itinerary results display with pagination

**Methods:**
- `render(itineraries)` - Display results
- `onSelectItinerary(id)` - Handle selection
- `loadMore()` - Pagination
- `sortBy(field)` - Re-sort
- `filter(criteria)` - Filter results

---

### Phase 4 Structure
```
public/js/components/
├── MapComponent.js       (400L)
├── RouterComponent.js    (300L)
├── SearchBoxComponent.js (250L)
├── ResultsListComponent.js (250L)
└── index.js             (export all)
```

**Total:** ~1,200 lines modular code  
**Replaces:** ~2,680 lines monolithic code  
**Reduction:** 55% fewer LOC

---

## PHASE 5: CSS ATOMIZATION (3-4 hours)

### Objective
Break 11,766L style.css into 100+ focused component files.

### CSS Structure

```
public/css/
├── _config.css              (variables, tokens)
├── _reset.css               (browser reset)
├── _typography.css          (fonts, text)
├── components/
│   ├── button.css           (buttons)
│   ├── card.css             (card layouts)
│   ├── form.css             (inputs, selects)
│   ├── nav.css              (navigation)
│   ├── modal.css            (modals, dialogs)
│   ├── tabs.css             (tabbed interfaces)
│   ├── badge.css            (status badges)
│   └── ... (50+ components)
├── layout/
│   ├── container.css        (grid, container)
│   ├── flexbox.css          (flex utilities)
│   ├── grid.css             (grid layout)
│   └── responsive.css       (media queries)
├── utilities/
│   ├── colors.css           (color utilities)
│   ├── spacing.css          (margin, padding)
│   ├── shadows.css          (box-shadow)
│   └── animation.css        (keyframes, transitions)
├── pages/
│   ├── horaires.css         (schedule page)
│   ├── carte.css            (map page)
│   ├── trajets.css          (results page)
│   └── about.css            (info page)
└── main.css                 (import orchestration)
```

### CSS Variables System

```css
/* _config.css */
:root {
    /* Colors */
    --color-primary: #22c55e;
    --color-secondary: #60a5fa;
    --color-error: #ef4444;
    
    /* Spacing */
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
    
    /* Typography */
    --font-size-body: 14px;
    --font-size-heading: 28px;
    --line-height-normal: 1.5;
    
    /* Shadows */
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
    
    /* Breakpoints */
    --breakpoint-mobile: 480px;
    --breakpoint-tablet: 768px;
    --breakpoint-desktop: 1024px;
}
```

### Component CSS Files (Sample)

**button.css** (45 lines):
```css
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--font-size-body);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 200ms ease;
}

.btn-primary {
    background: var(--color-primary);
    color: white;
}

.btn-primary:hover {
    background: var(--color-primary-dark);
    box-shadow: var(--shadow-md);
}
```

**card.css** (40 lines):
```css
.card {
    background: white;
    border-radius: 8px;
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    transition: box-shadow 200ms ease;
}

.card:hover {
    box-shadow: var(--shadow-md);
}

.card__header { padding: var(--spacing-md); }
.card__body { padding: var(--spacing-md); }
.card__footer { padding: var(--spacing-md); }
```

### Phase 5 Metrics

- **Before:** 1 file, 11,766 lines
- **After:** 110+ files, ~50-100 lines each
- **Average:** 60 lines per file
- **Result:** Much easier to maintain, organize, scale

---

## PHASE 6: TESTING SUITE (2-3 hours)

### Test Structure

```
tests/
├── unit/
│   ├── stores/
│   │   ├── GTFSStore.test.js
│   │   ├── TrafficStore.test.js
│   │   ├── UserStore.test.js
│   │   └── CacheStore.test.js
│   ├── services/
│   │   ├── RouteService.test.js
│   │   ├── GeocodeService.test.js
│   │   └── AutocompleteService.test.js
│   └── utils/
│       └── helpers.test.js
├── integration/
│   ├── api-services.test.js
│   ├── data-stores.test.js
│   └── event-flows.test.js
└── e2e/
    ├── search-flow.test.js
    ├── map-interaction.test.js
    └── navigation.test.js
```

### Test Coverage Goals

- **Unit tests:** 80%+ coverage per module
- **Integration tests:** Critical paths (search, map, nav)
- **E2E tests:** User journeys (find route, view details, save)
- **Overall target:** 85% coverage

### Sample Tests (Vitest format)

```javascript
// tests/unit/stores/GTFSStore.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { GTFSStore } from '../../../public/js/stores/GTFSStore.js';

describe('GTFSStore', () => {
    let store;
    
    beforeEach(() => {
        store = new GTFSStore();
    });
    
    it('should build indexes after loading', () => {
        store.applyLoadedData({
            routes: [{ route_id: 'R1', route_short_name: '1' }],
            stops: [{ stop_id: 'S1', stop_name: 'Gare' }]
        });
        
        expect(store.getRoute('R1')).toBeDefined();
        expect(store.getStop('S1')).toBeDefined();
    });
    
    it('should search stops by name', () => {
        store.applyLoadedData({
            stops: [
                { stop_id: 'S1', stop_name: 'Gare Centrale' },
                { stop_id: 'S2', stop_name: 'Gare Sud' }
            ]
        });
        
        const results = store.getStopsByName('Gare');
        expect(results).toHaveLength(2);
    });
});
```

---

## PHASE 7: FINAL CLEANUP (1-2 hours)

### Tasks

1. **Code Review**
   - Check for dead code
   - Remove legacy functions
   - Consolidate utilities

2. **Logger Migration**
   - Replace remaining `console.*` calls
   - Ensure all critical operations logged
   - Set appropriate log levels

3. **Documentation**
   - Update README with architecture
   - Create architecture diagram
   - Document all public APIs
   - Migration guide for future devs

4. **Performance Optimization**
   - Profile with lighthouse
   - Optimize bundle size
   - Cache layer verification
   - Memory leak detection

5. **Deployment**
   - Test on staging
   - Monitor error rates
   - Verify cache stats
   - Update version (v1.0 final)

---

## CRITICAL PATH TIMELINE

| Phase | Duration | Dependency | Status |
|-------|----------|-----------|--------|
| **Phase 1** | 2h | None | ✅ DONE |
| **Phase 2a/2b** | 1.5h | Phase 1 | ✅ DONE |
| **Phase 2c** | 1.5h | Phase 2a/2b | ✅ DONE |
| **Phase 3** | 3h | Phase 1,2 | 🔄 IN PROGRESS |
| **Phase 4** | 2.5h | Phase 3 | ⏳ PLANNED |
| **Phase 5** | 3.5h | Phase 1 | ⏳ PLANNED |
| **Phase 6** | 2.5h | All phases | ⏳ PLANNED |
| **Phase 7** | 1.5h | Phase 6 | ⏳ PLANNED |
| **TOTAL** | **~18 hours** | Sequential | 22% COMPLETE |

---

## SUCCESS METRICS

### Code Quality
- ✅ Monolithic files eliminated
- ✅ Average file size: 200-400 lines
- ✅ Circular dependencies: 0
- ✅ Test coverage: 85%+
- ✅ No console errors in production

### Performance
- ✅ App load time: <2s
- ✅ Search response: <1s
- ✅ Map rendering: <500ms
- ✅ Cache hit rate: 40-60%
- ✅ Memory usage: <150MB

### Developer Experience
- ✅ Add feature: 15-30 min
- ✅ Fix bug: 5-15 min
- ✅ Onboard new dev: <1h
- ✅ Test coverage: Automated
- ✅ Documentation: Complete

---

## DEPLOYMENT STRATEGY

### Per-Phase Deployment

- **Phases 1-2c:** Already deployed (API layer)
- **Phase 3:** Deploy when data tests pass
- **Phase 4:** Deploy when UI tests pass
- **Phase 5:** Deploy gradually (CSS modules)
- **Phase 6-7:** Deploy as final v1.0

### Rollback Plan

- Keep apiManager.js as fallback
- Feature flags for new services
- Blue-green deployment ready
- Canary release possible (10% → 50% → 100%)

---

## MIGRATION GUIDE FOR DEVELOPERS

### When complete, new developers will:

1. **Understand the architecture** (30 min)
   - Read ARCHITECTURE.md
   - View component diagram
   - Understand event flow

2. **Modify a feature** (15 min)
   - Find relevant service/store/component
   - Update logic
   - Run tests
   - Done!

3. **Add new feature** (45 min - 1h)
   - Create new service/component
   - Emit events for integration
   - Add tests
   - Deploy

### Before (Complex)
```
Modify search → affects apiManager → affects dataManager → affects main.js 
→ affects map → affects router → affects UI (2-4 hours of cascade failures)
```

### After (Simple)
```
Modify search → update GeocodeService → local tests pass 
→ eventBus notifies consumers → done (15-30 minutes)
```

---

## VERSION ROADMAP

| Version | Status | Content |
|---------|--------|---------|
| v0.9 | ✅ Current | Phase 1-2c complete, monolithic dataManager |
| v0.95 | 🔄 Phase 3 | Modular data stores |
| v0.98 | ⏳ Phase 4 | Modular UI components |
| v0.99 | ⏳ Phase 5 | Atomic CSS |
| v1.0 | ⏳ Phase 6-7 | Complete refactoring, 85% tests, final polish |

---

## RISK MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Cache corruption | Low | High | Version cache, validate data |
| Performance regression | Low | High | Profile each phase, compare baseline |
| Breaking changes | Medium | High | Extensive testing, feature flags |
| Time overrun | Low | High | Parallel work, scope clearly defined |
| Production issues | Low | Critical | Canary deployment, rollback ready |

---

## NEXT STEPS (IMMEDIATE)

1. **Phase 3 Continue:**
   - [ ] Complete GTFSStore
   - [ ] Create TrafficStore
   - [ ] Create UserStore
   - [ ] Create CacheStore
   - [ ] Create DataStoreFactory
   - [ ] Update main.js imports
   - [ ] Test all store interactions

2. **Commit after Phase 3:**
   ```
   Phase 3: Modular data stores
   - GTFSStore for GTFS data
   - TrafficStore for real-time alerts
   - UserStore for preferences
   - CacheStore for unified caching
   - DataStoreFactory for dependency injection
   - All data-layer functionality replicated
   - EventBus integration throughout
   ```

3. **Continue Phases 4-7** in sequence

---

**PHASE 3-7 COMPREHENSIVE PLAN COMPLETE**

All phases clearly scoped, estimated, and ready for execution. Proceed with Phase 3 immediately.
