/**
 * core/pathfinding/index.js
 * Export principal du module de pathfinding
 * 
 * ✅ STATUT: ACTIF - Moteur RAPTOR natif pour le calcul d'itinéraires
 */

import { RaptorAlgorithm } from './raptor.js';
import { AStarAlgorithm } from './astar.js';
import { TransportGraph } from './graph.js';

/**
 * Moteur de calcul d'itinéraires complet
 * Combine RAPTOR (transport) et A* (marche)
 */
export class PathfindingEngine {
  /**
   * @param {Object} gtfsData - Données GTFS chargées
   * @param {Object} options - Options de configuration
   */
  constructor(gtfsData, options = {}) {
    this.options = {
      maxWalkDistance: options.maxWalkDistance || 1000,
      walkSpeed: options.walkSpeed || 1.25,
      maxTransfers: options.maxTransfers || 3,
      minTransferTime: options.minTransferTime || 120,
      transferPenalty: options.transferPenalty || 300,
      maxResults: options.maxResults || 5,
      nearbyStopRadius: options.nearbyStopRadius || 500,
      ...options,
    };

    this.gtfsData = gtfsData;
    this.graph = null;
    this.raptor = null;
    this.astar = null;
    this.isReady = false;
  }

  /**
   * Construit le graphe et initialise les algorithmes
   */
  async buildGraph() {
    console.log('🔧 Construction du moteur de pathfinding...');
    const startTime = Date.now();

    // Construire le graphe de transport
    this.graph = new TransportGraph();
    this.graph.loadFromGtfs(this.gtfsData);

    // Initialiser RAPTOR
    this.raptor = new RaptorAlgorithm(this.graph, this.options);
    this.raptor.buildIndexes();

    // Initialiser A* (pour les trajets à pied)
    this.astar = new AStarAlgorithm({
      walkSpeed: this.options.walkSpeed,
      maxDistance: this.options.maxWalkDistance,
    });

    // Construire le graphe piéton à partir des arrêts
    const walkNodes = this.gtfsData.stops.map(stop => ({
      id: stop.stop_id,
      lat: parseFloat(stop.stop_lat),
      lon: parseFloat(stop.stop_lon),
    }));
    this.astar.buildGraphFromPoints(walkNodes, 5, 500);

    this.isReady = true;
    const elapsed = Date.now() - startTime;
    console.log(`✅ Moteur de pathfinding prêt en ${elapsed}ms`);

    return this;
  }

  /**
   * Calcule les itinéraires entre deux points géographiques
   * 
   * @param {Object} origin - {lat, lon, name?}
   * @param {Object} destination - {lat, lon, name?}
   * @param {Date} departureTime - Heure de départ
   * @returns {Array} Liste des itinéraires
   */
  async computeItineraries(origin, destination, departureTime) {
    if (!this.isReady) {
      throw new Error('PathfindingEngine not ready. Call buildGraph() first.');
    }

    const results = [];
    const dateStr = this.formatGtfsDate(departureTime);
    const timeSeconds = this.timeToSeconds(departureTime);

    // 1. Trouver les arrêts proches de l'origine et de la destination
    const originStops = this.raptor.findNearbyStops(origin.lat, origin.lon);
    const destStops = this.raptor.findNearbyStops(destination.lat, destination.lon);

    // Filtrer: privilégier les quais (StopPlace/parent stations ne sont souvent pas dans stop_times)
    // et exclure les arrêts qui n'ont aucune route (impossible d'embarquer/débarquer en TC)
    const isQuayLike = stop => {
      const id = stop?.stop_id || '';
      if (id.includes(':StopPlace:')) return false;
      if (stop?.location_type !== undefined && String(stop.location_type) === '1') return false;
      return true;
    };
    const hasRoutes = stopId => {
      const routes = this.raptor.routesAtStop.get(stopId);
      return Array.isArray(routes) ? routes.length > 0 : false;
    };

    const originCandidates = originStops.filter(s => isQuayLike(s.stop) && hasRoutes(s.stop.stop_id));
    const destCandidates = destStops.filter(s => isQuayLike(s.stop) && hasRoutes(s.stop.stop_id));

    console.log(`🔍 Arrêts proches origine (${origin.lat.toFixed(4)}, ${origin.lon.toFixed(4)}): ${originStops.length} trouvés (${originCandidates.length} utilisables)`);
    if (originStops.length > 0) {
      console.log(`   → ${originStops.slice(0, 3).map(s => `${s.stop.stop_name} (${Math.round(s.distance)}m)`).join(', ')}`);
    }
    console.log(`🔍 Arrêts proches destination (${destination.lat.toFixed(4)}, ${destination.lon.toFixed(4)}): ${destStops.length} trouvés (${destCandidates.length} utilisables)`);
    if (destStops.length > 0) {
      console.log(`   → ${destStops.slice(0, 3).map(s => `${s.stop.stop_name} (${Math.round(s.distance)}m)`).join(', ')}`);
    }

    if (originCandidates.length === 0 || destCandidates.length === 0) {
      // Pas d'arrêts à proximité, retourner uniquement le trajet à pied
      const walkPath = this.astar.computeDirectPath(
        origin.lat, origin.lon,
        destination.lat, destination.lon
      );
      
      if (walkPath.distance <= this.options.maxWalkDistance * 2) {
        results.push({
          type: 'walk_only',
          legs: [{
            type: 'walk',
            from: origin,
            to: destination,
            distance: walkPath.distance,
            duration: walkPath.duration,
            polyline: walkPath.coordinates,
          }],
          totalDuration: walkPath.duration,
          totalDistance: walkPath.distance,
          transfers: 0,
          departureTime: departureTime.toISOString(),
          arrivalTime: new Date(departureTime.getTime() + walkPath.duration * 1000).toISOString(),
        });
      }
      return results;
    }

    // 2. Pour chaque combinaison origine/destination, calculer l'itinéraire RAPTOR
    // On essaie progressivement plus de combinaisons pour éviter de rater une paire viable
    // (les 3 plus proches peuvent être des StopPlace/non-desservis ou juste non connectés à l'heure demandée).
    const tryLimits = [3, 8, 15, 25];
    // IMPORTANT: ne pas s'arrêter dès qu'on trouve un trajet.
    // Un arrêt un peu plus loin (ex: Tourny) + marche finale peut produire
    // un itinéraire bien plus court que le meilleur parmi les 3 arrêts les plus proches.
    const maxToCollect = Math.max(this.options.maxResults, 20);

    for (const limit of tryLimits) {
      const oLimit = Math.min(limit, originCandidates.length);
      const dLimit = Math.min(limit, destCandidates.length);
      console.log(`🔍 Tentative RAPTOR: ${oLimit} x ${dLimit} combinaisons (top ${limit})`);

      for (const originStop of originCandidates.slice(0, oLimit)) {
        for (const destStop of destCandidates.slice(0, dLimit)) {
          const adjustedDepartureTime = timeSeconds + originStop.walkTime;

          console.log(
            `  → Essai: ${originStop.stop.stop_name} → ${destStop.stop.stop_name} à ${Math.floor(adjustedDepartureTime / 3600)}h${Math.floor((adjustedDepartureTime % 3600) / 60)}`
          );

          const journeys = this.raptor.computeJourneys(
            originStop.stop.stop_id,
            destStop.stop.stop_id,
            adjustedDepartureTime,
            dateStr
          );

          console.log(`  ← Résultat: ${journeys.length} itinéraires trouvés`);

          for (const journey of journeys) {
            const itinerary = this.buildItinerary(
              origin,
              destination,
              originStop,
              destStop,
              journey,
              departureTime
            );
            results.push(itinerary);
          }

          if (results.length >= maxToCollect) {
            break;
          }
        }
        if (results.length >= maxToCollect) {
          break;
        }
      }

      if (results.length >= maxToCollect) {
        break;
      }
    }

    // 3. Trier et filtrer les résultats
    const sorted = this.rankItineraries(results);
    return sorted.slice(0, this.options.maxResults);
  }

  /**
   * Construit un itinéraire complet avec les segments de marche
   */
  buildItinerary(origin, destination, originStop, destStop, journey, baseTime) {
    const legs = [];
    let currentTime = new Date(baseTime);

    // Segment de marche vers le premier arrêt
    if (originStop.walkTime > 0) {
      legs.push({
        type: 'walk',
        from: origin,
        to: {
          lat: originStop.stop.stop_lat,
          lon: originStop.stop.stop_lon,
          name: originStop.stop.stop_name,
          stopId: originStop.stop.stop_id,
        },
        distance: originStop.distance,
        duration: originStop.walkTime,
        departureTime: currentTime.toISOString(),
        arrivalTime: new Date(currentTime.getTime() + originStop.walkTime * 1000).toISOString(),
      });
      currentTime = new Date(currentTime.getTime() + originStop.walkTime * 1000);
    }

    // Segments de transport
    for (const leg of journey.legs) {
      const fromStop = this.graph.stopsById.get(leg.fromStop);
      const toStop = this.graph.stopsById.get(leg.toStop);
      const route = this.graph.routesById.get(leg.routeId);
      const trip = this.graph.tripsById.get(leg.tripId);

      // Attente éventuelle
      const legDepartureTime = this.secondsToDate(baseTime, leg.departureTime);
      if (legDepartureTime > currentTime) {
        // Il y a une attente (correspondance)
        const waitTime = (legDepartureTime - currentTime) / 1000;
        if (waitTime > 60) { // Plus d'une minute d'attente
          legs.push({
            type: 'wait',
            at: {
              lat: fromStop?.stop_lat,
              lon: fromStop?.stop_lon,
              name: fromStop?.stop_name,
              stopId: leg.fromStop,
            },
            duration: Math.round(waitTime),
            departureTime: currentTime.toISOString(),
            arrivalTime: legDepartureTime.toISOString(),
          });
        }
        currentTime = legDepartureTime;
      }

      legs.push({
        type: 'transit',
        mode: this.getRouteMode(route),
        routeId: leg.routeId,
        routeName: route?.route_short_name || route?.route_long_name,
        routeColor: route?.route_color ? `#${route.route_color}` : '#1976D2',
        tripId: leg.tripId,
        tripHeadsign: trip?.trip_headsign,
        from: {
          lat: fromStop?.stop_lat,
          lon: fromStop?.stop_lon,
          name: fromStop?.stop_name,
          stopId: leg.fromStop,
        },
        to: {
          lat: toStop?.stop_lat,
          lon: toStop?.stop_lon,
          name: toStop?.stop_name,
          stopId: leg.toStop,
        },
        departureTime: this.secondsToDate(baseTime, leg.departureTime).toISOString(),
        arrivalTime: this.secondsToDate(baseTime, (Number.isFinite(leg.arrivalTime) ? leg.arrivalTime : leg.alightTime)).toISOString(),
        duration: (Number.isFinite(leg.arrivalTime) ? leg.arrivalTime : leg.alightTime) - leg.departureTime,
      });

      currentTime = this.secondsToDate(baseTime, (Number.isFinite(leg.arrivalTime) ? leg.arrivalTime : leg.alightTime));
    }

    // Segment de marche vers la destination
    if (destStop.walkTime > 0) {
      legs.push({
        type: 'walk',
        from: {
          lat: destStop.stop.stop_lat,
          lon: destStop.stop.stop_lon,
          name: destStop.stop.stop_name,
          stopId: destStop.stop.stop_id,
        },
        to: destination,
        distance: destStop.distance,
        duration: destStop.walkTime,
        departureTime: currentTime.toISOString(),
        arrivalTime: new Date(currentTime.getTime() + destStop.walkTime * 1000).toISOString(),
      });
      currentTime = new Date(currentTime.getTime() + destStop.walkTime * 1000);
    }

    // Calculer les totaux
    const totalDuration = (currentTime - baseTime) / 1000;
    const totalWalkDistance = legs
      .filter(l => l.type === 'walk')
      .reduce((sum, l) => sum + (l.distance || 0), 0);
    const transfers = legs.filter(l => l.type === 'transit').length - 1;

    return {
      type: 'transit',
      legs,
      totalDuration: Math.round(totalDuration),
      totalWalkDistance: Math.round(totalWalkDistance),
      transfers: Math.max(0, transfers),
      departureTime: baseTime.toISOString(),
      arrivalTime: currentTime.toISOString(),
    };
  }

  /**
   * Classe les itinéraires par qualité
   */
  rankItineraries(itineraries) {
    return itineraries.sort((a, b) => {
      // Score = durée + pénalité par correspondance
      const scoreA = a.totalDuration + a.transfers * this.options.transferPenalty;
      const scoreB = b.totalDuration + b.transfers * this.options.transferPenalty;
      return scoreA - scoreB;
    });
  }

  /**
   * Détermine le mode de transport d'une route
   */
  getRouteMode(route) {
    if (!route) return 'bus';
    
    const type = parseInt(route.route_type, 10);
    switch (type) {
      case 0: return 'tram';
      case 1: return 'metro';
      case 2: return 'rail';
      case 3: return 'bus';
      case 4: return 'ferry';
      case 5: return 'cable_car';
      case 6: return 'gondola';
      case 7: return 'funicular';
      default: return 'bus';
    }
  }

  /**
   * Formate une date au format GTFS (YYYYMMDD)
   */
  formatGtfsDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * Convertit une heure en secondes depuis minuit
   */
  timeToSeconds(date) {
    return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  }

  /**
   * Convertit des secondes en Date
   */
  secondsToDate(baseDate, seconds) {
    const result = new Date(baseDate);
    result.setHours(0, 0, 0, 0);
    result.setSeconds(seconds);
    return result;
  }

  /**
   * Statistiques du moteur
   */
  getStats() {
    return {
      ready: this.isReady,
      graph: this.graph?.stats || {},
      memory: this.graph?.estimateMemory() || {},
    };
  }
}

// Exports
export { RaptorAlgorithm } from './raptor.js';
export { AStarAlgorithm } from './astar.js';
export { TransportGraph } from './graph.js';

export default PathfindingEngine;
