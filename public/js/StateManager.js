/**
 * StateManager.js - Gestion d'état centralisée et immutable
 * Remplace la gestion d'état éparpillée dans main.js
 * 
 * Utilisation:
 * StateManager.setState({ key: value })
 * StateManager.getState()
 * StateManager.subscribe(handler)
 */

import { eventBus, EVENTS } from './EventBus.js';

export class StateManager {
  constructor(initialState = {}) {
    this.state = Object.freeze(this._deepClone(initialState));
    this.subscribers = [];
    this.history = [this._deepClone(initialState)];
    this.historyIndex = 0;
    this.maxHistory = 50;
    this.eventBus = eventBus;
  }

  /**
   * Compat: get() alias -> getStateValue / getState
   */
  get(path = null) {
    return path ? this.getStateValue(path) : this.getState();
  }

  /**
   * Récupérer l'état actuel
   * @returns {Object}
   */
  getState() {
    return this.state;
  }

  /**
   * Récupérer une partie de l'état
   * @param {string|string[]} path - Chemin dans l'état (ex: 'user.name' ou ['search', 'results'])
   * @returns {*}
   */
  getStateValue(path) {
    const keys = Array.isArray(path) ? path : path.split('.');
    let value = this.state;

    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) return undefined;
    }

    return value;
  }

  /**
   * Mettre à jour l'état (shallow merge)
   * @param {Object} updates - Objet avec les mises à jour
   * @param {string} description - Description du changement pour l'historique
   */
  setState(updates, description = 'State update') {
    if (!updates || typeof updates !== 'object') {
      console.warn('[StateManager] setState requires an object');
      return;
    }

    const prevState = this.state;
    const newState = Object.freeze({
      ...this.state,
      ...this._deepClone(updates)
    });

    // Vérifier si l'état a réellement changé
    if (JSON.stringify(newState) === JSON.stringify(this.state)) {
      return;
    }

    this.state = newState;

    // Gérer l'historique
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(this._deepClone(newState));

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    // Notifier les subscribers
    this._notifySubscribers({
      oldState: prevState,
      newState: this.state,
      updates,
      description,
      timestamp: new Date()
    });

    // Emit EventBus notification for compatibility
    this.eventBus?.emit(EVENTS.STATE_CHANGED, {
      path: null,
      value: updates,
      state: this.state,
      description
    });
  }

  /**
   * Remplacer l'état complètement
   * @param {Object} newState 
   */
  replaceState(newState) {
    this.state = Object.freeze(this._deepClone(newState));
    this.history = [this._deepClone(newState)];
    this.historyIndex = 0;

    this._notifySubscribers({
      oldState: {},
      newState: this.state,
      updates: newState,
      description: 'State replaced',
      timestamp: new Date()
    });
  }

  /**
   * S'abonner aux changements d'état
   * @param {Function} callback - Fonction appelée lors de changement
   * @returns {Function} Fonction de désabonnement
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => this._unsubscribe(callback);
  }

  /**
   * S'abonner aux changements d'une partie spécifique (surcharge)
   * @param {string|Function} path - Chemin ou callback direct
   * @param {Function} callback
   */
  subscribePath(path, callback) {
    if (typeof path === 'function') {
      return this.subscribe(path);
    }

    const wrappedCallback = (change) => {
      const oldValue = this._getValueAtPath(change.oldState || {}, path);
      const newValue = this._getValueAtPath(change.newState, path);

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        callback(newValue, oldValue, change);
      }
    };

    return this.subscribe(wrappedCallback);
  }

  /**
   * Annuler jusqu'à un point précédent de l'historique
   */
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.state = Object.freeze(this._deepClone(this.history[this.historyIndex]));
      this._notifySubscribers({
        description: 'Undo',
        timestamp: new Date()
      });
    }
  }

  /**
   * Refaire jusqu'à un point suivant
   */
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.state = Object.freeze(this._deepClone(this.history[this.historyIndex]));
      this._notifySubscribers({
        description: 'Redo',
        timestamp: new Date()
      });
    }
  }

  /**
   * Réinitialiser l'état
   * @param {Object} resetState 
   */
  reset(resetState = {}) {
    this.state = Object.freeze(this._deepClone(resetState));
    this.history = [this._deepClone(resetState)];
    this.historyIndex = 0;

    this._notifySubscribers({
      description: 'State reset',
      timestamp: new Date()
    });
  }

  /**
   * Exporter l'état pour persistence (localStorage, etc)
   */
  export() {
    return JSON.stringify(this.state);
  }

  /**
   * Importer l'état depuis une string
   */
  import(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.replaceState(imported);
    } catch (error) {
      console.error('[StateManager] Error importing state:', error);
    }
  }

  /**
   * Compat: set() alias -> setState with deep path support
   */
  set(path, value) {
    if (!path || typeof path !== 'string') return;
    const updates = this._buildNestedUpdate(path, value);
    this.setState(updates, `set:${path}`);
    this.eventBus?.emit(EVENTS.STATE_CHANGED, {
      path,
      value,
      state: this.state,
      description: `set:${path}`
    });
  }

  // === Helpers privés ===

  _notifySubscribers(change) {
    this.subscribers.forEach(callback => {
      try {
        // Compat: passer l'état complet au callback (un seul argument)
        callback(change.newState || this.state);
      } catch (error) {
        console.error('[StateManager] Error in subscriber:', error);
      }
    });
  }

  _unsubscribe(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index !== -1) {
      this.subscribers.splice(index, 1);
    }
  }

  _buildNestedUpdate(path, value) {
    const keys = path.split('.');
    const root = {};
    let current = root;

    keys.forEach((key, idx) => {
      if (idx === keys.length - 1) {
        current[key] = value;
      } else {
        current[key] = {};
        current = current[key];
      }
    });

    return root;
  }

  _deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => this._deepClone(item));
    if (obj instanceof Object) {
      const cloned = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this._deepClone(obj[key]);
        }
      }
      return cloned;
    }
    return obj;
  }

  _getValueAtPath(obj, path) {
    const keys = Array.isArray(path) ? path : path.split('.');
    let value = obj;

    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) return undefined;
    }

    return value;
  }
}

// État initial de l'application
const initialState = {
  // Navigation
  currentView: 'home', // 'home', 'search', 'horaires', 'trafic', 'carte'
  
  // Recherche
  search: {
    departure: null,
    arrival: null,
    departureTime: null,
    arrivalTime: null,
    mode: 'partir', // 'partir' ou 'arriver'
    results: [],
    loading: false,
    error: null
  },

  // Données
  data: {
    lines: [],
    stops: [],
    routes: [],
    loaded: false,
    lastUpdate: null
  },

  // Carte
  map: {
    center: [45.1846, 0.7214], // Périgueux
    zoom: 13,
    selectedRoute: null,
    selectedStop: null,
    viewport: null
  },

  // Utilisateur
  user: {
    location: null,
    preferences: {},
    savedPlaces: [],
    recentSearches: []
  },

  // Trafic
  traffic: {
    alerts: [],
    lastUpdate: null
  },

  // UI
  ui: {
    loading: false,
    error: null,
    message: null,
    modal: null
  }
};

// Instance globale du StateManager
export const stateManager = new StateManager(initialState);
