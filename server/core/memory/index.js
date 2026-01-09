/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * core/memory/index.js
 * Export principal du module de mémoire utilisateur
 * 
 * ?? STATUT: DÉSACTIVÉ - Code préparé pour le futur
 */

import { StorageInterface, InMemoryStore } from './store.js';
import { SQLiteStore } from './sqlite.js';
import { PostgresStore } from './postgres.js';

/**
 * Gestionnaire de mémoire utilisateur
 * Abstrait les opérations de stockage et ajoute la logique métier
 */
export class UserMemoryStore {
  /**
   * @param {Object} dbConfig - Configuration de la base de données
   * @param {Object} options - Options de configuration
   */
  constructor(dbConfig, options = {}) {
    this.options = {
      maxRecentSearches: options.maxRecentSearches || 50,
      maxFavorites: options.maxFavorites || 20,
      retentionDays: options.retentionDays || 365,
      anonymizeAfterDays: options.anonymizeAfterDays || 90,
      ...options,
    };

    // Sélectionner le backend de stockage
    this.store = this.createStore(dbConfig);
    this.isReady = false;
  }

  /**
   * Crée le store approprié selon la configuration
   */
  createStore(dbConfig) {
    const url = dbConfig.url || '';

    if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
      console.log('?? Backend: PostgreSQL');
      return new PostgresStore(url, this.options);
    }

    if (url.startsWith('sqlite:') || url.endsWith('.db')) {
      const path = url.replace('sqlite:', '');
      console.log('?? Backend: SQLite');
      return new SQLiteStore(path, this.options);
    }

    // Fallback: stockage en mémoire
    console.log('?? Backend: Mémoire (données non persistantes)');
    return new InMemoryStore(this.options);
  }

  /**
   * Initialise la connexion
   */
  async initialize() {
    console.log('?? Initialisation de la mémoire utilisateur...');
    await this.store.connect();
    this.isReady = true;
    console.log('? Mémoire utilisateur prête');
    return this;
  }

  /**
   * Ferme la connexion
   */
  async close() {
    await this.store.disconnect();
    this.isReady = false;
  }

  // === GESTION DES UTILISATEURS ===

  /**
   * Obtient ou crée un utilisateur par device ID
   * C'est la méthode principale pour identifier un utilisateur
   */
  async getOrCreateUser(deviceId) {
    if (!deviceId) {
      throw new Error('deviceId requis');
    }

    // Chercher l'utilisateur existant
    let user = await this.store.getUserByDevice(deviceId);
    
    if (user) {
      // Mettre à jour last_seen
      await this.store.updateUser(user.id, {});
      return user;
    }

    // Créer un nouvel utilisateur
    user = await this.store.createUser({ deviceId });
    console.log(`?? Nouvel utilisateur créé: ${user.id}`);
    return user;
  }

  /**
   * Obtient le contexte utilisateur pour l'autocomplétion
   */
  async getUserContext(userId) {
    const [favorites, history, frequentStops] = await Promise.all([
      this.store.getFavorites(userId),
      this.store.getSearchHistory(userId, { limit: 20 }),
      this.store.getFrequentStops(userId, 20),
    ]);

    return {
      favorites: favorites.map(f => f.placeId),
      recentSearches: history.map(h => ({
        placeId: h.destination?.id || h.origin?.id,
        timestamp: h.timestamp,
      })).filter(r => r.placeId),
      frequentStops: Object.fromEntries(
        frequentStops.map(s => [s.stopId, s.count])
      ),
    };
  }

  // === HISTORIQUE DE RECHERCHE ===

  /**
   * Enregistre une recherche d'itinéraire
   */
  async recordSearch(userId, searchData) {
    const entry = await this.store.addSearchHistory(userId, {
      query: searchData.query,
      origin: searchData.origin ? {
        id: searchData.origin.id,
        name: searchData.origin.name,
        lat: searchData.origin.lat,
        lon: searchData.origin.lon,
      } : null,
      destination: searchData.destination ? {
        id: searchData.destination.id,
        name: searchData.destination.name,
        lat: searchData.destination.lat,
        lon: searchData.destination.lon,
      } : null,
      selectedResult: searchData.selectedResult,
    });

    // Enregistrer l'utilisation des arrêts si ce sont des stops
    if (searchData.origin?.type === 'stop') {
      await this.store.recordStopUsage(userId, searchData.origin.id);
    }
    if (searchData.destination?.type === 'stop') {
      await this.store.recordStopUsage(userId, searchData.destination.id);
    }

    return entry;
  }

  /**
   * Obtient l'historique de recherche
   */
  async getRecentSearches(userId, limit = 10) {
    return this.store.getSearchHistory(userId, { limit });
  }

  /**
   * Efface l'historique
   */
  async clearHistory(userId) {
    return this.store.clearSearchHistory(userId);
  }

  // === FAVORIS ===

  /**
   * Ajoute un favori
   */
  async addFavorite(userId, place, options = {}) {
    const favorites = await this.store.getFavorites(userId);
    
    // Vérifier la limite
    if (favorites.length >= this.options.maxFavorites) {
      throw new Error(`Limite de ${this.options.maxFavorites} favoris atteinte`);
    }

    // Vérifier si déjà en favori
    const existing = favorites.find(f => f.placeId === place.id);
    if (existing) {
      // Mettre à jour le nom si différent
      if (options.name && options.name !== existing.name) {
        return this.store.updateFavorite(existing.id, { name: options.name });
      }
      return existing;
    }

    return this.store.addFavorite(userId, {
      placeId: place.id,
      name: options.name || place.name,
      type: options.type || 'other',
      place: {
        id: place.id,
        type: place.type,
        name: place.name,
        lat: place.lat,
        lon: place.lon,
      },
    });
  }

  /**
   * Obtient les favoris
   */
  async getFavorites(userId) {
    return this.store.getFavorites(userId);
  }

  /**
   * Définit un lieu comme domicile ou travail
   */
  async setHomeOrWork(userId, place, type) {
    if (!['home', 'work'].includes(type)) {
      throw new Error('Type doit être "home" ou "work"');
    }

    // Supprimer l'ancien si existant
    const favorites = await this.store.getFavorites(userId);
    const existing = favorites.find(f => f.type === type);
    if (existing) {
      await this.store.deleteFavorite(existing.id);
    }

    return this.addFavorite(userId, place, { 
      type, 
      name: type === 'home' ? 'Domicile' : 'Travail' 
    });
  }

  /**
   * Supprime un favori
   */
  async removeFavorite(userId, favoriteId) {
    const favorite = await this.store.getFavorites(userId)
      .then(favs => favs.find(f => f.id === favoriteId));
    
    if (!favorite) {
      throw new Error('Favori non trouvé');
    }

    return this.store.deleteFavorite(favoriteId);
  }

  // === PRÉFÉRENCES ===

  /**
   * Obtient les préférences utilisateur
   */
  async getPreferences(userId) {
    return this.store.getPreferences(userId);
  }

  /**
   * Met à jour les préférences
   */
  async updatePreferences(userId, preferences) {
    // Valider les préférences
    const validKeys = [
      'defaultMode',        // 'transit', 'walk', 'bike'
      'maxWalkDistance',    // en mètres
      'preferLessWalking',  // boolean
      'preferFewerTransfers', // boolean
      'wheelchairAccessible', // boolean
      'theme',              // 'light', 'dark', 'auto'
      'notifications',      // boolean
      'language',           // 'fr', 'en'
    ];

    const filtered = {};
    for (const [key, value] of Object.entries(preferences)) {
      if (validKeys.includes(key)) {
        filtered[key] = value;
      }
    }

    return this.store.updatePreferences(userId, filtered);
  }

  // === STATISTIQUES ===

  /**
   * Obtient les arrêts fréquemment utilisés
   */
  async getFrequentStops(userId, limit = 10) {
    return this.store.getFrequentStops(userId, limit);
  }

  // === MAINTENANCE ===

  /**
   * Exécute les tâches de maintenance
   */
  async runMaintenance() {
    console.log('?? Maintenance de la mémoire utilisateur...');

    // Nettoyer les données anciennes
    const cleanResult = await this.store.cleanup({
      daysOld: this.options.retentionDays,
    });
    console.log(`   - ${cleanResult.cleaned} entrées supprimées`);

    // Anonymiser les utilisateurs inactifs
    const anonResult = await this.store.anonymizeOldData(
      this.options.anonymizeAfterDays
    );
    console.log(`   - ${anonResult.anonymized} utilisateurs anonymisés`);

    return { ...cleanResult, ...anonResult };
  }

  /**
   * Vérification de santé
   */
  async healthCheck() {
    return this.store.healthCheck();
  }

  /**
   * Export des données utilisateur (RGPD)
   */
  async exportUserData(userId) {
    const [user, favorites, history, preferences, frequentStops] = await Promise.all([
      this.store.getUser(userId),
      this.store.getFavorites(userId),
      this.store.getSearchHistory(userId, { limit: 1000 }),
      this.store.getPreferences(userId),
      this.store.getFrequentStops(userId, 100),
    ]);

    return {
      user,
      favorites,
      searchHistory: history,
      preferences,
      frequentStops,
      exportDate: new Date().toISOString(),
    };
  }

  /**
   * Suppression complète d'un utilisateur (RGPD)
   */
  async deleteUserData(userId) {
    return this.store.deleteUser(userId);
  }
}

// Exports
export { StorageInterface, InMemoryStore } from './store.js';
export { SQLiteStore } from './sqlite.js';
export { PostgresStore } from './postgres.js';

export default UserMemoryStore;


