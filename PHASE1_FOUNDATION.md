# PHASE 1: FOUNDATION - Starting Now

## Semaine 1-2: Construire les Fondations

### Milestone 1: EventBus & StateManager (Jour 1-2)

#### 1. Créer `core/EventBus.js`

```javascript
/**
 * EventBus - Pub/Sub décentralisé
 * Tous les composants communiquent par événements
 * Élimine les dépendances circulaires
 */
class EventBus {
  constructor() {
    this.listeners = new Map();
    this.history = [];
  }

  /**
   * S'abonner à un événement
   * @param {string} eventName - Nom de l'événement
   * @param {Function} callback - Fonction à appeler
   * @returns {Function} Fonction pour se désabonner
   */
  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
    
    // Retourner fonction unsubscribe
    return () => {
      const callbacks = this.listeners.get(eventName);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Émettre un événement (une fois)
   */
  once(eventName, callback) {
    const unsubscribe = this.on(eventName, (...args) => {
      callback(...args);
      unsubscribe();
    });
    return unsubscribe;
  }

  /**
   * Émettre un événement à tous les listeners
   * @param {string} eventName - Nom de l'événement
   * @param {any} data - Données associées
   */
  emit(eventName, data) {
    // Log pour debug
    this.history.push({
      event: eventName,
      data,
      timestamp: Date.now(),
    });
    
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventName} listener:`, error);
        }
      });
    }
  }

  /**
   * Obtenir l'historique des événements (debug)
   */
  getHistory(limit = 50) {
    return this.history.slice(-limit);
  }

  /**
   * Nettoyer
   */
  clear() {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
```

#### 2. Créer `core/StateManager.js`

```javascript
/**
 * StateManager - Gestion d'état immutable
 * Source de vérité unique pour l'état app
 * Élimine les état globaux dispersés
 */
class StateManager {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.observers = [];
    this.history = [];
  }

  /**
   * Obtenir l'état actuel
   */
  getState() {
    return { ...this.state }; // Copie immuable
  }

  /**
   * Obtenir une partie de l'état
   */
  get(path) {
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
   * Mettre à jour l'état (immutable)
   */
  setState(updates) {
    const newState = {
      ...this.state,
      ...updates,
    };
    
    // Historique pour debug/undo
    this.history.push({
      before: this.state,
      after: newState,
      timestamp: Date.now(),
    });
    
    this.state = newState;
    this.notifyObservers();
  }

  /**
   * S'abonner aux changements d'état
   */
  subscribe(callback) {
    this.observers.push(callback);
    return () => {
      const index = this.observers.indexOf(callback);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  /**
   * Notifier tous les observateurs
   */
  notifyObservers() {
    this.observers.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in state observer:', error);
      }
    });
  }

  /**
   * Obtenir l'historique (debug/undo)
   */
  getHistory() {
    return this.history;
  }
}

export const stateManager = new StateManager({
  currentView: 'dashboard',
  selectedRoute: null,
  selectedStop: null,
  userLocation: null,
  schedules: {},
  isOffline: false,
  darkMode: false,
});
```

#### 3. Créer `core/Logger.js`

```javascript
/**
 * Logger - Logging unifié
 * Tous les logs passent par un endroit centralisé
 */
class Logger {
  constructor(name) {
    this.name = name;
    this.logs = [];
  }

  log(message, data = null) {
    const entry = { level: 'LOG', message, data, timestamp: Date.now() };
    this.logs.push(entry);
    console.log(`[${this.name}]`, message, data || '');
  }

  error(message, error = null) {
    const entry = { level: 'ERROR', message, error, timestamp: Date.now() };
    this.logs.push(entry);
    console.error(`[${this.name}]`, message, error || '');
  }

  warn(message, data = null) {
    const entry = { level: 'WARN', message, data, timestamp: Date.now() };
    this.logs.push(entry);
    console.warn(`[${this.name}]`, message, data || '');
  }

  debug(message, data = null) {
    if (process.env.DEBUG) {
      const entry = { level: 'DEBUG', message, data, timestamp: Date.now() };
      this.logs.push(entry);
      console.debug(`[${this.name}]`, message, data || '');
    }
  }

  getLogs(limit = 100) {
    return this.logs.slice(-limit);
  }
}

export const createLogger = (name) => new Logger(name);
```

---

### Milestone 2: Extraire CSS Variables (Jour 3)

#### Créer `styles/config/_variables.css`

```css
/* ═══════════════════════════════════════════════════════
 * VARIABLES GLOBALES - Source unique pour design system
 * ══════════════════════════════════════════════════════= */

:root {
  /* COULEURS */
  --color-primary: #22c55e;      /* Vert Péribus */
  --color-secondary: #00c8ff;    /* Cyan */
  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-info: #3b82f6;
  
  --bg-page: #0b1220;
  --bg-main: #0b1220;
  --bg-card: #0f1724;
  --bg-hover: #1a2332;
  
  --text-primary: #e6eef8;
  --text-secondary: #9fb3c9;
  --text-muted: #6b7280;
  
  --border: rgba(255, 255, 255, 0.08);
  --border-light: rgba(255, 255, 255, 0.04);
  
  /* SPACING */
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
  --spacing-10: 2.5rem;
  --spacing-12: 3rem;
  
  /* BORDER RADIUS */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;
  
  /* SHADOWS */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.15);
  
  /* TYPOGRAPHY */
  --font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  
  /* TRANSITIONS */
  --transition-fast: 150ms ease-out;
  --transition-normal: 250ms ease-out;
  --transition-slow: 350ms ease-out;
  
  /* Z-INDEX */
  --z-dropdown: 1000;
  --z-sticky: 2000;
  --z-fixed: 3000;
  --z-modal: 5000;
  --z-tooltip: 6000;
}

/* DARK THEME */
body.dark-theme {
  color-scheme: dark;
  /* Les variables au-dessus suffisent */
}
```

#### Créer `styles/config/_typography.css`

```css
/* ═══════════════════════════════════════════════════════
 * TYPOGRAPHIE - Consistent sizing & weights
 * ══════════════════════════════════════════════════════= */

html {
  font-size: 16px;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: 1.5;
  color: var(--text-primary);
}

h1 {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  line-height: 1.2;
}

h2 {
  font-size: var(--font-size-xl);
  font-weight: 700;
  line-height: 1.3;
}

h3 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: 1.4;
}

p {
  font-size: var(--font-size-base);
  line-height: 1.6;
}

.text-secondary {
  color: var(--text-secondary);
}

.text-muted {
  color: var(--text-muted);
}
```

---

### Milestone 3: Créer Structure CSS Modulaire (Jour 4)

```bash
# Créer la structure
mkdir -p public/styles/config
mkdir -p public/styles/base
mkdir -p public/styles/components
mkdir -p public/styles/views
mkdir -p public/styles/utilities

# Créer les fichiers
touch public/styles/config/{_variables.css,_typography.css,_reset.css}
touch public/styles/base/{_buttons.css,_forms.css,_cards.css,_layout.css}
touch public/styles/components/{_bottom-nav.css,_planner.css,_modals.css}
touch public/styles/views/{_dashboard.css,_schedule.css,_map.css}
touch public/styles/utilities/{_responsive.css,_animations.css}
```

#### Créer `styles/style.css` (nouveau - import uniquement)

```css
/* ═══════════════════════════════════════════════════════
 * MAIN CSS - Import modules (JAMAIS ajouter du CSS ici!)
 * ══════════════════════════════════════════════════════= */

/* 1. CONFIG & RESET */
@import url('config/_variables.css');
@import url('config/_typography.css');
@import url('config/_reset.css');

/* 2. BASE COMPONENTS */
@import url('base/_layout.css');
@import url('base/_buttons.css');
@import url('base/_forms.css');
@import url('base/_cards.css');

/* 3. UI COMPONENTS */
@import url('components/_bottom-nav.css');
@import url('components/_planner.css');
@import url('components/_modals.css');

/* 4. VIEWS */
@import url('views/_dashboard.css');
@import url('views/_schedule.css');
@import url('views/_map.css');

/* 5. UTILITIES */
@import url('utilities/_responsive.css');
@import url('utilities/_animations.css');
```

---

### ✅ Fin Phase 1 - Checklist

- [ ] `EventBus.js` créé et testé
- [ ] `StateManager.js` créé et testé
- [ ] `Logger.js` créé et testé
- [ ] Structure CSS modulaire créée
- [ ] Variables CSS extraites
- [ ] Ancien `style.css` inchangé (backup)
- [ ] Documentation mise à jour
- [ ] Service worker v445 créé
- [ ] Tous les changements pushés sur GitHub

---

## 🚀 Exécution

Pour démarrer Phase 1:

```bash
cd "c:\Users\chadi\Documents\Peribus Test design"
git checkout -b refactor/phase1-foundation
mkdir -p public/js/core
mkdir -p public/styles/{config,base,components,views,utilities}

# Créer les fichiers
# (Voir contenu ci-dessus)

git add -A
git commit -m "feat: Phase 1 - Foundation (EventBus, StateManager, Logger, CSS structure)"
git push origin refactor/phase1-foundation
```

Êtes-vous prêt à commencer la Phase 1?
