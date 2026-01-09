/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * graph.js
 * Gestion du graphe de transport pour le pathfinding
 * 
 * ?? STATUT: DÉSACTIVÉ - Code préparé pour le futur
 * 
 * Ce module gère:
 * - La construction du graphe à partir des données GTFS
 * - La sérialisation/désérialisation pour le cache
 * - Les optimisations pour réduire la mémoire
 */

import { createHash } from 'crypto';

/**
 * @typedef {Object} TransportGraph
 * @property {Array} stops - Arrêts
 * @property {Array} routes - Lignes
 * @property {Array} trips - Voyages
 * @property {Array} stopTimes - Horaires
 * @property {Array} calendar - Calendrier
 * @property {Array} calendarDates - Exceptions de calendrier
 * @property {Map} transfersIndex - Index des correspondances
 * @property {string} hash - Hash des données pour le cache
 */

export class TransportGraph {
  constructor() {
    // Données GTFS de base
    this.stops = [];
    this.routes = [];
    this.trips = [];
    this.stopTimes = [];
    this.calendar = [];
    this.calendarDates = [];
    this.shapes = [];

    // Index optimisés
    this.stopsById = new Map();
    this.routesById = new Map();
    this.tripsById = new Map();
    this.tripsByRoute = new Map();
    this.stopTimesByTrip = new Map();
    this.stopTimesByStop = new Map();
    this.routesByStop = new Map();
    this.transfersIndex = new Map();

    // Métadonnées
    this.buildDate = null;
    this.hash = null;
    this.stats = {};
  }

  /**
   * Charge les données GTFS dans le graphe
   * 
   * @param {Object} gtfsData - Données GTFS parsées
   */
  loadFromGtfs(gtfsData) {
    console.log('?? Chargement du graphe depuis GTFS...');
    const startTime = Date.now();

    // Copier les données
    this.stops = gtfsData.stops || [];
    this.routes = gtfsData.routes || [];
    this.trips = gtfsData.trips || [];
    this.stopTimes = gtfsData.stopTimes || [];
    this.calendar = gtfsData.calendar || [];
    this.calendarDates = gtfsData.calendarDates || [];
    this.shapes = gtfsData.shapes || [];

    // Construire les index
    this.buildIndexes();

    // Calculer le hash pour le cache
    this.hash = this.computeHash();
    this.buildDate = new Date().toISOString();

    const elapsed = Date.now() - startTime;
    console.log(`? Graphe chargé en ${elapsed}ms`);
    this.logStats();
  }

  /**
   * Construit tous les index pour des recherches rapides
   */
  buildIndexes() {
    console.log('?? Construction des index...');

    // Index par ID
    this.stops.forEach(stop => {
      this.stopsById.set(stop.stop_id, stop);
    });

    this.routes.forEach(route => {
      this.routesById.set(route.route_id, route);
    });

    this.trips.forEach(trip => {
      this.tripsById.set(trip.trip_id, trip);
      
      if (!this.tripsByRoute.has(trip.route_id)) {
        this.tripsByRoute.set(trip.route_id, []);
      }
      this.tripsByRoute.get(trip.route_id).push(trip);
    });

    // Index des stopTimes
    this.stopTimes.forEach(st => {
      // Par trip
      if (!this.stopTimesByTrip.has(st.trip_id)) {
        this.stopTimesByTrip.set(st.trip_id, []);
      }
      this.stopTimesByTrip.get(st.trip_id).push(st);

      // Par stop
      if (!this.stopTimesByStop.has(st.stop_id)) {
        this.stopTimesByStop.set(st.stop_id, []);
      }
      this.stopTimesByStop.get(st.stop_id).push(st);
    });

    // Trier les stopTimes par sequence
    this.stopTimesByTrip.forEach(stopTimes => {
      stopTimes.sort((a, b) => a.stop_sequence - b.stop_sequence);
    });

    // Routes par arrêt
    this.buildRoutesAtStopIndex();

    // Index des correspondances (transferts entre arrêts proches)
    this.buildTransfersIndex();

    // Statistiques
    this.stats = {
      stops: this.stops.length,
      routes: this.routes.length,
      trips: this.trips.length,
      stopTimes: this.stopTimes.length,
      transfers: this.transfersIndex.size,
    };
  }

  /**
   * Construit l'index des routes par arrêt
   */
  buildRoutesAtStopIndex() {
    this.routesByStop.clear();

    // Pour chaque trip, obtenir la route et les arrêts
    this.tripsByRoute.forEach((trips, routeId) => {
      const stopsSet = new Set();
      
      trips.forEach(trip => {
        const tripStopTimes = this.stopTimesByTrip.get(trip.trip_id) || [];
        tripStopTimes.forEach(st => stopsSet.add(st.stop_id));
      });

      stopsSet.forEach(stopId => {
        if (!this.routesByStop.has(stopId)) {
          this.routesByStop.set(stopId, new Set());
        }
        this.routesByStop.get(stopId).add(routeId);
      });
    });
  }

  /**
   * Construit l'index des correspondances (arrêts à distance de marche)
   * 
   * @param {number} maxDistance - Distance max en mètres (défaut: 300m)
   */
  buildTransfersIndex(maxDistance = 300) {
    console.log(`?? Construction des correspondances (max ${maxDistance}m)...`);
    this.transfersIndex.clear();

    const stopsArray = Array.from(this.stopsById.values());
    let transferCount = 0;

    for (let i = 0; i < stopsArray.length; i++) {
      const stopA = stopsArray[i];
      const transfers = [];

      for (let j = 0; j < stopsArray.length; j++) {
        if (i === j) continue;
        
        const stopB = stopsArray[j];
        const distance = this.haversineDistance(
          stopA.stop_lat, stopA.stop_lon,
          stopB.stop_lat, stopB.stop_lon
        );

        if (distance <= maxDistance) {
          transfers.push({
            toStopId: stopB.stop_id,
            distance: Math.round(distance),
            walkTime: Math.round(distance / 1.25), // ~4.5 km/h
          });
          transferCount++;
        }
      }

      if (transfers.length > 0) {
        // Trier par distance
        transfers.sort((a, b) => a.distance - b.distance);
        this.transfersIndex.set(stopA.stop_id, transfers);
      }
    }

    console.log(`? ${transferCount} correspondances trouvées`);
  }

  /**
   * Obtient les correspondances possibles depuis un arrêt
   * 
   * @param {string} stopId
   * @returns {Array<{toStopId: string, distance: number, walkTime: number}>}
   */
  getTransfers(stopId) {
    return this.transfersIndex.get(stopId) || [];
  }

  /**
   * Obtient les routes passant par un arrêt
   * 
   * @param {string} stopId
   * @returns {string[]} IDs des routes
   */
  getRoutesAtStop(stopId) {
    return Array.from(this.routesByStop.get(stopId) || []);
  }

  /**
   * Vérifie si un service est actif à une date donnée
   * 
   * @param {string} serviceId
   * @param {string} dateStr - Date au format YYYYMMDD
   * @returns {boolean}
   */
  isServiceActive(serviceId, dateStr) {
    // Vérifier les exceptions
    const exception = this.calendarDates.find(
      cd => cd.service_id === serviceId && cd.date === dateStr
    );
    
    if (exception) {
      return exception.exception_type === '1'; // 1 = ajouté, 2 = supprimé
    }

    // Vérifier le calendrier régulier
    const calendar = this.calendar.find(c => c.service_id === serviceId);
    if (!calendar) return false;

    // Vérifier la plage de dates
    if (dateStr < calendar.start_date || dateStr > calendar.end_date) {
      return false;
    }

    // Vérifier le jour de la semaine
    const date = this.parseGtfsDate(dateStr);
    const dayOfWeek = date.getDay();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    return calendar[days[dayOfWeek]] === '1';
  }

  /**
   * Obtient les trips actifs pour une route à une date donnée
   * 
   * @param {string} routeId
   * @param {string} dateStr
   * @returns {Array}
   */
  getActiveTrips(routeId, dateStr) {
    const trips = this.tripsByRoute.get(routeId) || [];
    return trips.filter(trip => this.isServiceActive(trip.service_id, dateStr));
  }

  /**
   * Parse une date GTFS (YYYYMMDD) en objet Date
   */
  parseGtfsDate(dateStr) {
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
    const day = parseInt(dateStr.substring(6, 8), 10);
    return new Date(year, month, day);
  }

  /**
   * Calcule la distance Haversine entre deux points
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const f1 = (lat1 * Math.PI) / 180;
    const f2 = (lat2 * Math.PI) / 180;
    const ?f = ((lat2 - lat1) * Math.PI) / 180;
    const ?? = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(?f / 2) * Math.sin(?f / 2) +
      Math.cos(f1) * Math.cos(f2) * Math.sin(?? / 2) * Math.sin(?? / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calcule un hash des données pour le cache
   */
  computeHash() {
    const dataString = JSON.stringify({
      stops: this.stops.length,
      routes: this.routes.length,
      trips: this.trips.length,
      stopTimes: this.stopTimes.length,
      firstStop: this.stops[0]?.stop_id,
      lastStop: this.stops[this.stops.length - 1]?.stop_id,
    });
    
    return createHash('md5').update(dataString).digest('hex').substring(0, 12);
  }

  /**
   * Sérialise le graphe pour le cache
   */
  serialize() {
    return {
      version: 1,
      hash: this.hash,
      buildDate: this.buildDate,
      data: {
        stops: this.stops,
        routes: this.routes,
        trips: this.trips,
        stopTimes: this.stopTimes,
        calendar: this.calendar,
        calendarDates: this.calendarDates,
      },
    };
  }

  /**
   * Désérialise le graphe depuis le cache
   */
  deserialize(cached) {
    if (cached.version !== 1) {
      throw new Error('Version de cache incompatible');
    }

    this.hash = cached.hash;
    this.buildDate = cached.buildDate;
    this.stops = cached.data.stops;
    this.routes = cached.data.routes;
    this.trips = cached.data.trips;
    this.stopTimes = cached.data.stopTimes;
    this.calendar = cached.data.calendar;
    this.calendarDates = cached.data.calendarDates;

    this.buildIndexes();
  }

  /**
   * Affiche les statistiques du graphe
   */
  logStats() {
    console.log('?? Statistiques du graphe:');
    console.log(`   - Arrêts: ${this.stats.stops}`);
    console.log(`   - Lignes: ${this.stats.routes}`);
    console.log(`   - Voyages: ${this.stats.trips}`);
    console.log(`   - Horaires: ${this.stats.stopTimes}`);
    console.log(`   - Correspondances: ${this.stats.transfers}`);
    console.log(`   - Hash: ${this.hash}`);
  }

  /**
   * Estime la mémoire utilisée par le graphe
   */
  estimateMemory() {
    const roughSize = JSON.stringify({
      stops: this.stops,
      routes: this.routes,
      trips: this.trips,
      stopTimes: this.stopTimes,
    }).length;

    return {
      bytes: roughSize,
      mb: (roughSize / 1024 / 1024).toFixed(2),
    };
  }
}

export default TransportGraph;


