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

  /**
   * S'abonner à un événement
   * @param {string} eventName - Nom de l'événement
   * @param {Function} handler - Fonction callback
   * @param {Object} options - {once: bool, priority: number}
   */
  on(eventName, handler, options = {}) {
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
    return this.on(eventName, handler, { once: true });
  }

  /**
   * Émettre un événement
   * @param {string} eventName 
   * @param {*} data - Données à passer aux handlers
   */
  emit(eventName, data) {
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
  'nav:select': 'Utilisateur clique sur une vue de navigation',
  'nav:update': 'La navigation doit être mise à jour',
  
  // Recherche
  'search:start': 'Début d\'une recherche d\'itinéraire',
  'search:complete': 'Résultats de recherche disponibles',
  'search:error': 'Erreur lors de la recherche',
  
  // Données
  'data:loaded': 'Données GTFS/horaires chargées',
  'data:updated': 'Mise à jour des données en temps réel',
  'data:error': 'Erreur de chargement de données',
  
  // Carte
  'map:ready': 'Carte initialisée',
  'map:route-selected': 'Un itinéraire a été sélectionné',
  'map:viewport-changed': 'La vue de la carte a changé',
  
  // État
  'state:changed': 'L\'état global a changé',
  'state:reset': 'L\'état a été réinitialisé',
  
  // UI
  'ui:loading': 'Afficher un indicateur de chargement',
  'ui:error': 'Afficher un message d\'erreur',
  'ui:success': 'Afficher un message de succès',
  
  // Trafic
  'traffic:alert': 'Nouvelle alerte trafic',
  'traffic:resolved': 'Une alerte trafic a été résolue',
  
  // Géolocalisation
  'location:found': 'Position utilisateur trouvée',
  'location:lost': 'Perte du signal de géolocalisation'
};
