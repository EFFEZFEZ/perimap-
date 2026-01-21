# 🚀 QUICK START - Phase 1 (Jour 1 du Refactoring)

Vous allez créer **3 fichiers core** qui vont révolutionner votre architecture.

---

## Étape 1: Créer `public/js/core/EventBus.js`

Copez ce code exactement:

```javascript
/**
 * EventBus - Pub/Sub central (décentralise les dépendances)
 * 
 * Usage:
 * eventBus.on('schedule:loaded', (data) => console.log(data));
 * eventBus.emit('schedule:loaded', { routes: [...] });
 */

export class EventBus {
  constructor() {
    this.listeners = new Map();
    this.eventHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * S'abonner à un événement
   * Retourne une fonction pour se désabonner
   */
  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);

    // Retourner fonction de désabonnement
    return () => {
      const callbacks = this.listeners.get(eventName);
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    };
  }

  /**
   * S'abonner une fois, puis se désabonner auto
   */
  once(eventName, callback) {
    const unsubscribe = this.on(eventName, (data) => {
      callback(data);
      unsubscribe();
    });
    return unsubscribe;
  }

  /**
   * Émettre un événement à tous les listeners
   */
  emit(eventName, data = null) {
    // Log pour debug
    this.eventHistory.push({
      event: eventName,
      data,
      timestamp: Date.now(),
    });
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Appeler les callbacks
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[EventBus] Error in ${eventName}:`, err);
        }
      });
    }
  }

  /**
   * Obtenir l'historique des événements (debug)
   */
  getHistory() {
    return [...this.eventHistory];
  }

  /**
   * Nettoyer tous les listeners
   */
  clear() {
    this.listeners.clear();
    this.eventHistory = [];
  }

  /**
   * Nombre de listeners pour un événement
   */
  countListeners(eventName) {
    return this.listeners.has(eventName)
      ? this.listeners.get(eventName).length
      : 0;
  }
}

// Instance unique (singleton)
export const eventBus = new EventBus();
```

---

## Étape 2: Créer `public/js/core/StateManager.js`

```javascript
/**
 * StateManager - Source unique de vérité pour l'état
 * 
 * Remplace tous les état globaux dispersés
 * Usage:
 * stateManager.setState({ currentView: 'schedule' });
 * stateManager.subscribe((newState) => console.log(newState));
 */

export class StateManager {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.subscribers = [];
    this.history = [];
    this.maxHistorySize = 50;
  }

  /**
   * Obtenir l'état complet (copie immuable)
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Obtenir une valeur spécifique
   * Exemple: stateManager.get('currentView') → 'dashboard'
   * Exemple: stateManager.get('user.location.lat')
   */
  get(path) {
    if (!path) return this.state;

    const parts = path.split('.');
    let value = this.state;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    return value;
  }

  /**
   * Mettre à jour l'état (immutable merge)
   */
  setState(updates) {
    if (!updates || typeof updates !== 'object') {
      console.warn('[StateManager] setState called with invalid data');
      return;
    }

    const oldState = this.state;
    const newState = {
      ...this.state,
      ...updates,
    };

    // Log historique
    this.history.push({
      before: oldState,
      after: newState,
      timestamp: Date.now(),
      changes: Object.keys(updates),
    });
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    this.state = newState;
    this.notifySubscribers();
  }

  /**
   * S'abonner aux changements
   * Retourne fonction de désabonnement
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notifier les abonnés
   */
  notifySubscribers() {
    this.subscribers.forEach(callback => {
      try {
        callback(this.state);
      } catch (err) {
        console.error('[StateManager] Subscriber error:', err);
      }
    });
  }

  /**
   * Obtenir l'historique (debug/undo)
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Nettoyer
   */
  clear() {
    this.subscribers = [];
    this.history = [];
  }
}

// Instance unique (singleton)
export const stateManager = new StateManager({
  // État initial
  currentView: 'dashboard',           // Quelle vue active
  selectedRoute: null,                 // Route sélectionnée
  selectedStop: null,                  // Arrêt sélectionné
  userLocation: null,                  // Position GPS utilisateur
  schedules: {},                       // Cache horaires
  isOnline: true,                      // Statut connexion
  isDarkMode: false,                   // Thème dark
  plannerState: {                      // État du planner (recherche)
    departure: null,
    arrival: null,
    datetime: new Date(),
  },
});
```

---

## Étape 3: Créer `public/js/core/Logger.js`

```javascript
/**
 * Logger - Logging unifié
 * 
 * Usage:
 * const log = createLogger('MapRenderer');
 * log.info('Map initialized');
 * log.error('Failed to render', error);
 */

export class Logger {
  constructor(name) {
    this.name = name;
    this.logs = [];
    this.maxLogs = 500;
  }

  info(message, data = null) {
    this._log('INFO', message, data);
  }

  error(message, error = null) {
    this._log('ERROR', message, error);
    console.error(`[${this.name}]`, message, error);
  }

  warn(message, data = null) {
    this._log('WARN', message, data);
    console.warn(`[${this.name}]`, message, data);
  }

  debug(message, data = null) {
    if (process.env.DEBUG || window.DEBUG) {
      this._log('DEBUG', message, data);
      console.debug(`[${this.name}]`, message, data);
    }
  }

  _log(level, message, data) {
    const entry = {
      level,
      message,
      data,
      timestamp: Date.now(),
      name: this.name,
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  getLogs(filter = null) {
    if (!filter) return [...this.logs];
    return this.logs.filter(log => 
      !filter.level || log.level === filter.level
    );
  }

  clear() {
    this.logs = [];
  }
}

export const createLogger = (name) => new Logger(name);
```

---

## Étape 4: Créer `public/js/core/index.js` (Export central)

```javascript
/**
 * Core exports - Importer depuis là
 */

export { EventBus, eventBus } from './EventBus.js';
export { StateManager, stateManager } from './StateManager.js';
export { Logger, createLogger } from './Logger.js';
```

---

## Étape 5: Vérifier que tout fonctionne

Créez `public/js/core-test.js` pour valider:

```javascript
import { eventBus, stateManager, createLogger } from './core/index.js';

// Test 1: EventBus
console.log('=== Testing EventBus ===');
eventBus.on('test:event', (data) => {
  console.log('✅ EventBus works! Data:', data);
});
eventBus.emit('test:event', { msg: 'Hello EventBus' });

// Test 2: StateManager
console.log('\n=== Testing StateManager ===');
stateManager.subscribe((state) => {
  console.log('✅ StateManager updated:', state.currentView);
});
stateManager.setState({ currentView: 'schedule' });
console.log('Current view:', stateManager.get('currentView'));

// Test 3: Logger
console.log('\n=== Testing Logger ===');
const log = createLogger('TestModule');
log.info('Logger initialized');
log.warn('This is a warning');
log.getLogs().forEach(entry => {
  console.log(`  ${entry.level}: ${entry.message}`);
});

console.log('\n✅ All Core modules working!');
```

Ajoutez dans `index.html` pour tester:
```html
<!-- Juste avant </body> -->
<script type="module" src="js/core-test.js"></script>
```

Ouvrez la console (F12) et vérifiez les logs ✅

---

## Étape 6: Utiliser les Core dans `main.js`

Remplacez les imports en haut de `main.js`:

```javascript
// ✅ NOUVEAU
import { eventBus, stateManager, createLogger } from './core/index.js';

const log = createLogger('MainApp');

// Au lieu de vos variables globales dispersées:
// ❌ ANCIEN
// const STATE = {};
// const BUS = new EventEmitter();

// ✅ NOUVEAU
// Utiliser eventBus et stateManager pour TOUT

// Exemple 1: Navigation
stateManager.subscribe((state) => {
  if (state.currentView === 'schedule') {
    log.info('Switching to schedule view');
    // ...
  }
});

// Exemple 2: Communication entre modules
eventBus.on('location:changed', (location) => {
  stateManager.setState({ userLocation: location });
  log.info('Location updated', location);
});

// Exemple 3: Appels API
async function loadSchedules() {
  try {
    const data = await fetch('/api/schedules');
    eventBus.emit('schedules:loaded', data);
  } catch (error) {
    log.error('Failed to load schedules', error);
  }
}
```

---

## 📋 Checklist Phase 1 - Jour 1

- [ ] Créé `public/js/core/EventBus.js`
- [ ] Créé `public/js/core/StateManager.js`
- [ ] Créé `public/js/core/Logger.js`
- [ ] Créé `public/js/core/index.js`
- [ ] Testé avec `core-test.js`
- [ ] Tous les logs ✅ dans la console
- [ ] Commité sur GitHub:
  ```bash
  git add -A
  git commit -m "feat(core): Phase 1 - EventBus, StateManager, Logger"
  git push
  ```

---

## 🎯 Prochaines Étapes (Jour 2-3)

1. **Extraire CSS Variables** → `styles/config/_variables.css`
2. **Organiser structure CSS** → Modules au lieu de monolithe
3. **Ajouter tests** → Tests pour EventBus, StateManager

---

## 🆘 Si ça ne marche pas

### Erreur: "Cannot find module"
```bash
# Assurez-vous que l'import a le .js
❌ import { eventBus } from './core/index';
✅ import { eventBus } from './core/index.js';
```

### Erreur: "eventBus is not defined"
```bash
# Assurez-vous que vous importez depuis le bon endroit
# Dans main.js
import { eventBus } from './core/index.js'; // ✅
```

### Les tests ne s'affichent pas
- Ouvrez F12 → Console
- Cherchez les logs verts ✅
- Si rien: Rechargez la page (Ctrl+Shift+R)

---

## 📊 Impact Immédiat

Après cette Étape 1:
- ✅ Vous pouvez modifier `main.js` sans peur de cascades
- ✅ Vous pouvez tester les services indépendamment
- ✅ Les dépendances circulaires = Éliminées
- ✅ La communication = Centralisée via EventBus

**Prêt à commencer? Créez les 3 fichiers! ✅**
