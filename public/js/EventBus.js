/**
 * EventBus.js - Système de communication pub/sub
 * Élimine les dépendances circulaires en centralisant la communication
 * 
 * Utilisation:
 * EventBus.on('event-name', handler)
 * EventBus.emit('event-name', data)
 * EventBus.off('event-name', handler)
 */

export class EventBus {
  constructor() {
    this.events = new Map();
    this.maxListeners = 10;
    this.wildcardListeners = [];
  }

  _normalizeEventName(eventName) {
    if (!eventName) return eventName;
    return EVENTS?.[eventName] || eventName;
  }

  /**
   * S'abonner à un événement
   * @param {string} eventName - Nom de l'événement
   * @param {Function} handler - Fonction callback
   * @param {Object} options - {once: bool, priority: number}
   */
  on(eventName, handler, options = {}) {
    eventName = this._normalizeEventName(eventName);
    if (typeof handler !== 'function') {
      console.warn(`[EventBus] Handler must be a function for "${eventName}"`);
      return;
    }

    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }

    const wrappedHandler = {
      fn: handler,
      once: options.once || false,
      priority: options.priority || 0,
      id: Math.random().toString(36).substr(2, 9)
    };

    const handlers = this.events.get(eventName);
    handlers.push(wrappedHandler);
    handlers.sort((a, b) => b.priority - a.priority);

    // Avertissement si trop d'écouteurs
    if (handlers.length > this.maxListeners) {
      console.warn(`[EventBus] Possible memory leak: ${handlers.length} listeners for "${eventName}"`);
    }

    // Retourner une fonction de désabonnement
    return () => this.off(eventName, handler);
  }

  /**
   * S'abonner une seule fois
   * @param {string} eventName 
   * @param {Function} handler 
   */
  once(eventName, handler) {
    eventName = this._normalizeEventName(eventName);
    return this.on(eventName, handler, { once: true });
  }

  /**
   * Émettre un événement
   * @param {string} eventName 
   * @param {*} data - Données à passer aux handlers
   */
  emit(eventName, data) {
    eventName = this._normalizeEventName(eventName);
    if (!this.events.has(eventName)) {
      return false;
    }

    const handlers = [...this.events.get(eventName)];
    
    handlers.forEach(wrappedHandler => {
      try {
        wrappedHandler.fn(data);
      } catch (error) {
        console.error(`[EventBus] Error in handler for "${eventName}":`, error);
      }
      
      if (wrappedHandler.once) {
        this.off(eventName, wrappedHandler.fn);
      }
    });

    return true;
  }

  /**
   * Émettre un événement et attendre une réponse promise
   * @param {string} eventName 
   * @param {*} data 
   * @returns {Promise}
   */
  async emitAsync(eventName, data) {
    if (!this.events.has(eventName)) {
      return undefined;
    }

    const handlers = [...this.events.get(eventName)];
    let result;

    for (const wrappedHandler of handlers) {
      try {
        result = await Promise.resolve(wrappedHandler.fn(data));
      } catch (error) {
        console.error(`[EventBus] Error in async handler for "${eventName}":`, error);
      }

      if (wrappedHandler.once) {
        this.off(eventName, wrappedHandler.fn);
      }
    }

    return result;
  }

  /**
   * Se désabonner d'un événement
   * @param {string} eventName 
   * @param {Function} handler 
   */
  off(eventName, handler) {
    eventName = this._normalizeEventName(eventName);
    if (!this.events.has(eventName)) {
      return;
    }

    const handlers = this.events.get(eventName);
    const index = handlers.findIndex(h => h.fn === handler);

    if (index !== -1) {
      handlers.splice(index, 1);
    }

    if (handlers.length === 0) {
      this.events.delete(eventName);
    }
  }

  /**
   * Supprimer tous les écouteurs d'un événement
   * @param {string} eventName 
   */
  removeAllListeners(eventName) {
    eventName = this._normalizeEventName(eventName);
    if (eventName) {
      this.events.delete(eventName);
    } else {
      this.events.clear();
    }
  }

  /**
   * Obtenir le nombre d'écouteurs pour un événement
   * @param {string} eventName 
   */
  listenerCount(eventName) {
    return this.events.has(eventName) ? this.events.get(eventName).length : 0;
  }

  /**
   * Obtenir tous les événements enregistrés
   */
  getEventNames() {
    return Array.from(this.events.keys());
  }
}

// Instance globale unique
export const eventBus = new EventBus();

// Événements disponibles (documentation)
export const EVENTS = {
  // Navigation
  NAV_SELECT: 'nav:select',
  NAV_UPDATE: 'nav:update',
  ROUTE_SELECTED: 'map:route-selected',
  
  // Recherche
  SEARCH_START: 'search:start',
  SEARCH_COMPLETE: 'search:complete',
  SEARCH_ERROR: 'search:error',
  
  // Données
  DATA_LOADED: 'data:loaded',
  DATA_UPDATED: 'data:updated',
  DATA_ERROR: 'data:error',
  
  // Carte
  MAP_READY: 'map:ready',
  MAP_ROUTE_SELECTED: 'map:route-selected',
  MAP_VIEWPORT_CHANGED: 'map:viewport-changed',
  
  // État
  STATE_CHANGED: 'state:changed',
  STATE_CHANGE: 'state:changed',
  STATE_RESET: 'state:reset',
  
  // API
  API_REQUEST: 'api:request',
  API_SUCCESS: 'api:success',
  API_ERROR: 'api:error',
  
  // UI
  UI_LOADING: 'ui:loading',
  UI_ERROR: 'ui:error',
  UI_SUCCESS: 'ui:success',
  
  // Trafic
  TRAFFIC_ALERT: 'traffic:alert',
  TRAFFIC_RESOLVED: 'traffic:resolved',
  
  // Géolocalisation
  LOCATION_FOUND: 'location:found',
  LOCATION_LOST: 'location:lost',
  
  // API Services (Phase 2)
  ROUTE_CALCULATED: 'route:calculated',
  ROUTE_ERROR: 'route:error',
  GEOCODE_RESOLVED: 'geocode:resolved',
  GEOCODE_REVERSED: 'geocode:reversed',
  GEOCODE_ERROR: 'geocode:error',
  AUTOCOMPLETE_RESULTS: 'autocomplete:results',
  AUTOCOMPLETE_ERROR: 'autocomplete:error',
  PREDICTION_DETAILS_RESOLVED: 'prediction:details-resolved'
};
