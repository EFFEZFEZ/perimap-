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

    // Calculer la distance directe entre origine et destination
    const directDistance = this.haversineDistance(origin.lat, origin.lon, destination.lat, destination.lon);
    const isShortDistance = directDistance < 500; // Moins de 500m
    const minBusResults = isShortDistance ? 1 : 3; // Minimum 3 bus pour distances normales, 1 pour courtes
    console.log(`📏 Distance directe: ${Math.round(directDistance)}m (${isShortDistance ? 'courte' : 'normale'}, min ${minBusResults} bus)`);

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
    // OPTIMISATION V2: réduire drastiquement les combinaisons pour la performance
    // On limite à 5 arrêts max de chaque côté (25 combinaisons max au lieu de 625)
    const tryLimits = [3, 5];
    const maxToCollect = Math.max(this.options.maxResults, 8);
    const startCompute = Date.now();
    const MAX_COMPUTE_TIME_MS = 8000; // Timeout global de 8 secondes

    for (const limit of tryLimits) {
      // Vérifier le timeout global
      if (Date.now() - startCompute > MAX_COMPUTE_TIME_MS) {
        console.log(`⏱️ Timeout global atteint (${MAX_COMPUTE_TIME_MS}ms), arrêt de la recherche`);
        break;
      }

      const oLimit = Math.min(limit, originCandidates.length);
      const dLimit = Math.min(limit, destCandidates.length);
      console.log(`🔍 Tentative RAPTOR: ${oLimit} x ${dLimit} combinaisons (top ${limit})`);

      for (const originStop of originCandidates.slice(0, oLimit)) {
        for (const destStop of destCandidates.slice(0, dLimit)) {
          // Timeout check
          if (Date.now() - startCompute > MAX_COMPUTE_TIME_MS) {
            console.log(`⏱️ Timeout atteint, arrêt`);
            break;
          }

          const adjustedDepartureTime = timeSeconds + originStop.walkTime;

          // Log condensé (une seule ligne par essai)
          const journeys = this.raptor.computeJourneys(
            originStop.stop.stop_id,
            destStop.stop.stop_id,
            adjustedDepartureTime,
            dateStr
          );

          if (journeys.length > 0) {
            console.log(`  ✅ ${originStop.stop.stop_name} → ${destStop.stop.stop_name}: ${journeys.length} itinéraire(s)`);
            // Debug: afficher les legs du premier journey
            const firstJ = journeys[0];
            console.log(`    📋 Journey legs: ${firstJ.legs?.length || 0}, transfers: ${firstJ.transfers}`);
            if (firstJ.legs?.length > 0) {
              console.log(`    📍 Legs: ${firstJ.legs.map(l => `${l.fromStop}->${l.toStop}`).join(', ')}`);
            }
          }

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
        if (results.length >= maxToCollect || Date.now() - startCompute > MAX_COMPUTE_TIME_MS) {
          break;
        }
      }

      // Early exit si on a assez de résultats (minimum requis de bus)
      const busResults = results.filter(r => r.type === 'transit').length;
      if (busResults >= minBusResults) {
        console.log(`✅ ${busResults} itinéraires bus trouvés (min: ${minBusResults}), arrêt anticipé`);
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
      // Gérer les legs de marche (footpaths entre arrêts)
      if (leg.type === 'walk') {
        const fromStop = this.graph.stopsById.get(leg.fromStop);
        const toStop = this.graph.stopsById.get(leg.toStop);
        const walkDuration = leg.walkTime || 120; // Durée de marche en secondes
        
        console.log(`    📍 Walk: ${fromStop?.stop_name || leg.fromStop} → ${toStop?.stop_name || leg.toStop}, dur=${walkDuration}s`);
        
        // Ajouter le leg de marche entre arrêts
        if (fromStop && toStop) {
          legs.push({
            type: 'walk',
            from: {
              lat: fromStop.stop_lat,
              lon: fromStop.stop_lon,
              name: fromStop.stop_name,
              stopId: leg.fromStop,
            },
            to: {
              lat: toStop.stop_lat,
              lon: toStop.stop_lon,
              name: toStop.stop_name,
              stopId: leg.toStop,
            },
            distance: this.haversineDistance(fromStop.stop_lat, fromStop.stop_lon, toStop.stop_lat, toStop.stop_lon),
            duration: walkDuration,
            departureTime: currentTime.toISOString(),
            arrivalTime: new Date(currentTime.getTime() + walkDuration * 1000).toISOString(),
          });
          currentTime = new Date(currentTime.getTime() + walkDuration * 1000);
        }
        continue;
      }

      const fromStop = this.graph.stopsById.get(leg.fromStop);
      const toStop = this.graph.stopsById.get(leg.toStop);
      const route = this.graph.routesById.get(leg.routeId);
      const trip = this.graph.tripsById.get(leg.tripId);

      const alightTimeSec = (Number.isFinite(leg.arrivalTime) ? leg.arrivalTime : leg.alightTime);
      const transitDurationSec = Math.max(0, alightTimeSec - leg.departureTime);

      // Debug: log leg info
      console.log(`    📍 Leg: ${fromStop?.stop_name || leg.fromStop} → ${toStop?.stop_name || leg.toStop}, route=${route?.route_short_name}, dur=${transitDurationSec}s`);

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

      // Filtrer les legs transit "vides" (ex: Tourny → Tourny) qui gonflent artificiellement les correspondances
      // Garder les legs même avec durée 0 si les arrêts sont différents (trajet express)
      if (leg.fromStop !== leg.toStop) {
        // Récupérer la polyline du shape GTFS si disponible
        const shapeId = trip?.shape_id;
        let polyline = null;
        if (shapeId && this.gtfsData.shapes) {
          polyline = this.extractShapePolyline(shapeId, fromStop, toStop);
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
          arrivalTime: this.secondsToDate(baseTime, alightTimeSec).toISOString(),
          duration: transitDurationSec,
          polyline,
        });
      }

      currentTime = this.secondsToDate(baseTime, alightTimeSec);
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
   * Priorise fortement les trajets avec moins de correspondances
   * ET assure une diversité des lignes utilisées
   */
  rankItineraries(itineraries) {
    // D'abord dédupliquer les itinéraires similaires
    const seen = new Set();
    const unique = itineraries.filter(it => {
      // Clé unique basée sur les arrêts de transit (pas les détails horaires)
      const transitLegs = it.legs.filter(l => l.type === 'transit');
      const key = transitLegs.map(l => `${l.routeName}:${l.from?.stopId}->${l.to?.stopId}`).join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Trier par score (durée + pénalité correspondances)
    const sorted = unique.sort((a, b) => {
      // 1. Prioriser FORTEMENT moins de correspondances (pénalité de 20 min par correspondance)
      const transferPenalty = 1200; // 20 minutes
      const scoreA = a.totalDuration + a.transfers * transferPenalty;
      const scoreB = b.totalDuration + b.transfers * transferPenalty;

      // 2. À score égal, prioriser moins de correspondances
      if (Math.abs(scoreA - scoreB) < 300) { // ~5 min de différence acceptable
        if (a.transfers !== b.transfers) {
          return a.transfers - b.transfers;
        }
      }

      return scoreA - scoreB;
    });

    // Assurer la diversité des lignes : garder au moins un trajet par première ligne utilisée
    // Cela permet de proposer des alternatives même si elles sont plus lentes
    const byFirstRoute = new Map(); // firstRouteName -> [itineraries]
    for (const it of sorted) {
      const transitLegs = it.legs.filter(l => l.type === 'transit');
      const firstRoute = transitLegs[0]?.routeName || 'unknown';
      if (!byFirstRoute.has(firstRoute)) {
        byFirstRoute.set(firstRoute, []);
      }
      byFirstRoute.get(firstRoute).push(it);
    }

    // Prendre le meilleur de chaque première ligne + les meilleurs globaux
    const diversified = [];
    const includedKeys = new Set();

    // D'abord ajouter le meilleur de chaque première ligne
    for (const [route, routeItineraries] of byFirstRoute) {
      if (routeItineraries.length > 0) {
        const best = routeItineraries[0];
        const key = best.legs.filter(l => l.type === 'transit')
          .map(l => `${l.routeName}:${l.from?.stopId}`).join('|');
        if (!includedKeys.has(key)) {
          diversified.push(best);
          includedKeys.add(key);
        }
      }
    }

    // Ensuite ajouter les autres triés par score (sans doublons)
    for (const it of sorted) {
      const key = it.legs.filter(l => l.type === 'transit')
        .map(l => `${l.routeName}:${l.from?.stopId}`).join('|');
      if (!includedKeys.has(key)) {
        diversified.push(it);
        includedKeys.add(key);
      }
    }

    return diversified;
  }

  /**
   * Extrait la polyline GTFS encodée pour un segment entre deux arrêts
   */
  extractShapePolyline(shapeId, fromStop, toStop) {
    if (!shapeId || !this.gtfsData.shapes) return null;

    // Récupérer tous les points du shape
    const shapePoints = this.gtfsData.shapes
      .filter(s => s.shape_id === shapeId)
      .sort((a, b) => parseInt(a.shape_pt_sequence) - parseInt(b.shape_pt_sequence));

    if (shapePoints.length < 2) return null;

    const fromLat = parseFloat(fromStop?.stop_lat);
    const fromLon = parseFloat(fromStop?.stop_lon);
    const toLat = parseFloat(toStop?.stop_lat);
    const toLon = parseFloat(toStop?.stop_lon);

    if (isNaN(fromLat) || isNaN(toLat)) return null;

    // Trouver les indices les plus proches des arrêts de départ et d'arrivée
    let startIdx = 0, endIdx = shapePoints.length - 1;
    let minStartDist = Infinity, minEndDist = Infinity;

    for (let i = 0; i < shapePoints.length; i++) {
      const lat = parseFloat(shapePoints[i].shape_pt_lat);
      const lon = parseFloat(shapePoints[i].shape_pt_lon);
      const distFrom = this.quickDistance(fromLat, fromLon, lat, lon);
      const distTo = this.quickDistance(toLat, toLon, lat, lon);

      if (distFrom < minStartDist) {
        minStartDist = distFrom;
        startIdx = i;
      }
      if (distTo < minEndDist) {
        minEndDist = distTo;
        endIdx = i;
      }
    }

    // Extraire le segment (dans le bon ordre)
    let segment;
    if (startIdx <= endIdx) {
      segment = shapePoints.slice(startIdx, endIdx + 1);
    } else {
      segment = shapePoints.slice(endIdx, startIdx + 1).reverse();
    }

    if (segment.length < 2) {
      // Fallback: ligne directe
      segment = [
        { shape_pt_lat: fromLat, shape_pt_lon: fromLon },
        { shape_pt_lat: toLat, shape_pt_lon: toLon }
      ];
    }

    // Encoder en polyline Google
    return this.encodePolyline(segment.map(p => [parseFloat(p.shape_pt_lat), parseFloat(p.shape_pt_lon)]));
  }

  /**
   * Distance rapide (approximation)
   */
  quickDistance(lat1, lon1, lat2, lon2) {
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    return dLat * dLat + dLon * dLon * 0.7; // Approximation
  }

  /**
   * Encode une liste de [lat, lon] en polyline Google
   */
  encodePolyline(coords) {
    if (!coords || coords.length === 0) return null;

    let encoded = '';
    let prevLat = 0, prevLon = 0;

    for (const [lat, lon] of coords) {
      const latE5 = Math.round(lat * 1e5);
      const lonE5 = Math.round(lon * 1e5);

      encoded += this.encodeSignedNumber(latE5 - prevLat);
      encoded += this.encodeSignedNumber(lonE5 - prevLon);

      prevLat = latE5;
      prevLon = lonE5;
    }

    return encoded;
  }

  encodeSignedNumber(num) {
    let sgn = num < 0 ? ~(num << 1) : (num << 1);
    let encoded = '';
    while (sgn >= 0x20) {
      encoded += String.fromCharCode((0x20 | (sgn & 0x1f)) + 63);
      sgn >>= 5;
    }
    encoded += String.fromCharCode(sgn + 63);
    return encoded;
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
   * Calcule la distance Haversine entre deux points (en mètres)
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Rayon de la Terre en mètres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
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
