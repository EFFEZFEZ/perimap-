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
      minTransferTime: options.minTransferTime || 180, // 3 minutes min de correspondance
      transferPenalty: options.transferPenalty || 600, // 10 minutes de pénalité pour limiter les correspondances inutiles
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
   * Effectue plusieurs recherches RAPTOR à des heures décalées pour obtenir
   * plusieurs départs successifs (comble les "trous" horaires)
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

    const allResults = [];
    const dateStr = this.formatGtfsDate(departureTime);
    const baseTimeSeconds = this.timeToSeconds(departureTime);

    // Calculer la distance directe entre origine et destination
    const directDistance = this.haversineDistance(origin.lat, origin.lon, destination.lat, destination.lon);
    const isShortDistance = directDistance < 500; // Moins de 500m
    const minBusResults = isShortDistance ? 1 : 5; // Minimum 5 bus pour distances normales

    // ════════════════════════════════════════════════════════════════════════
    // Clé unique pour le trip (combinaison des lignes utilisées et heures de départ)
    const SEARCH_OFFSETS = [0, 20, 40]; // Fenêtre encore réduite pour limiter le temps de calcul
    const seenTrips = new Map(); // Pour dédupliquer les mêmes trips (TripId -> {result, index})
    
    // ⚡ PARALLELISATION: Lancer toutes les recherches en même temps
    // Node.js est single-threaded, mais cela évite d'attendre séquentiellement les I/O si existants
    // et permet de grouper le processing.
    const promises = SEARCH_OFFSETS.map(offsetMinutes => {
      const searchTime = new Date(departureTime.getTime() + offsetMinutes * 60000);
      const timeSeconds = this.timeToSeconds(searchTime);
      return this._computeSingleSearch(origin, destination, searchTime, dateStr, timeSeconds);
    });

    const nestedResults = await Promise.all(promises);
    
    // Aplatir et dédupliquer
    for (const results of nestedResults) {
      for (const result of results) {
        // Clé unique pour le trip (combinaison des lignes utilisées et heures de départ)
        // On simplifie la clé pour grouper les variantes très proches (même premier bus)
        const transitLegs = result.legs.filter(l => l.type === 'transit');
        
        // Clé basée uniquement sur le PREMIER bus (TripId)
        // Si on a déjà un itinéraire qui part avec ce bus, on garde celui qui arrive le plus tôt
        const firstLeg = transitLegs[0];
        if (!firstLeg) continue; // Walk only traité à part

        const firstTripKey = `${firstLeg.routeId}_${firstLeg.tripId}`;
        const arrivalMs = new Date(result.arrivalTime).getTime();
        const existing = seenTrips.get(firstTripKey);

        if (existing) {
          const existingArrival = new Date(existing.result.arrivalTime).getTime();
          // Remplacer uniquement si nettement meilleur (>5 min) pour limiter les variantes
          if (Number.isFinite(arrivalMs) && Number.isFinite(existingArrival) && arrivalMs < existingArrival - 300000) {
            seenTrips.set(firstTripKey, { result, index: existing.index });
            allResults[existing.index] = result;
          }
          continue; // On ne duplique pas la même première montée
        }

        const stored = { result, index: allResults.length };
        seenTrips.set(firstTripKey, stored);
        allResults.push(result);
      }
    }

    // Ajouter l'option marche si pertinente et unique
    const walkResults = nestedResults.flat().filter(r => r.transfers === 0 && r.type === 'walk_only');
    if (walkResults.length > 0) {
       allResults.push(walkResults[0]);
    }

    // Trier par "Generalized Cost" (Logique OTP)
    const sorted = this.rankItinerariesSmart(allResults);
    return sorted.slice(0, this.options.maxResults);
  }

  /**
   * Trie les itinéraires selon le coût généralisé (Logique OTP)
   * On penalise la marche et les correspondances plus que le temps pur.
   */
  rankItinerariesSmart(itineraries) {
    // Poids (inspirés d'OpenTripPlanner)
    const WALK_RELUCTANCE = 2.0;       // 1 min de marche "coûte" 2 min de temps perçu
    const TRANSFER_PENALTY_COST = 600; // 1 transfert "coûte" 10 min (600s) de pénalité fixe
    const WAIT_RELUCTANCE = 1.0;       // L'attente est normale

    return itineraries.sort((a, b) => {
      // Calcul du coût pour A
      const walkCostA = (a.walkDistance / this.options.walkSpeed) * WALK_RELUCTANCE;
      const transferCostA = a.transfers * TRANSFER_PENALTY_COST;
      const durationA = a.totalDuration;
      const generalizedCostA = durationA + transferCostA + walkCostA;

      // Calcul du coût pour B
      const walkCostB = (b.walkDistance / this.options.walkSpeed) * WALK_RELUCTANCE;
      const transferCostB = b.transfers * TRANSFER_PENALTY_COST;
      const durationB = b.totalDuration;
      const generalizedCostB = durationB + transferCostB + walkCostB;

      return generalizedCostA - generalizedCostB;
    });
  }

  /**
   * Effectue une seule recherche RAPTOR pour une heure donnée
   */
  async _computeSingleSearch(origin, destination, departureTime, dateStr, timeSeconds) {
    const results = [];

    // Calculer la distance directe
    const directDistance = this.haversineDistance(origin.lat, origin.lon, destination.lat, destination.lon);
    
    // ⚡ OPTIMISATION: Limiter drastiquement les candidats (Max 5)
    // C'est ici qu'on gagne la vitesse. Inutile de tester 120 arrêts.
    const MAX_CANDIDATES = 3; 
    
    let originStops = this.raptor.findNearbyStops(origin.lat, origin.lon);
    let destStops = this.raptor.findNearbyStops(destination.lat, destination.lon);

    const isQuay = stop => !stop?.stop_id?.includes(':StopPlace:');
    
    // Garder seulement les X plus proches qui sont des quais
    const originCandidates = originStops.filter(s => isQuay(s.stop)).slice(0, MAX_CANDIDATES);
    const destCandidates = destStops.filter(s => isQuay(s.stop)).slice(0, MAX_CANDIDATES);

    if (originCandidates.length === 0 || destCandidates.length === 0) {
      // Fallback marche

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
            // Encode la polyline (liste lat/lon) pour affichage carte
            polyline: this.encodePolyline(walkPath.coordinates.map(c => [c.lat, c.lon])),
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
    const tryLimits = [3];
    const maxToCollect = Math.max(this.options.maxResults, 5);
    const startCompute = Date.now();
    const MAX_COMPUTE_TIME_MS = 1200; // Timeout global resserré pour viser <2s (cible ~1.5s)

    for (const limit of tryLimits) {
      // Vérifier le timeout global
      if (Date.now() - startCompute > MAX_COMPUTE_TIME_MS) {
        console.log(`⏱️ Timeout global atteint (${MAX_COMPUTE_TIME_MS}ms), arrêt de la recherche`);
        break;
      }

      const oLimit = Math.min(limit, originCandidates.length);
      const dLimit = Math.min(limit, destCandidates.length);
      for (const originStop of originCandidates.slice(0, oLimit)) {
        for (const destStop of destCandidates.slice(0, dLimit)) {
          // Timeout check
          if (Date.now() - startCompute > MAX_COMPUTE_TIME_MS) {
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
        polyline: this.encodePolyline([
          [origin.lat, origin.lon],
          [originStop.stop.stop_lat, originStop.stop.stop_lon]
        ]),
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
            polyline: this.encodePolyline([
              [fromStop.stop_lat, fromStop.stop_lon],
              [toStop.stop_lat, toStop.stop_lon]
            ]),
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
        polyline: this.encodePolyline([
          [destStop.stop.stop_lat, destStop.stop.stop_lon],
          [destination.lat, destination.lon]
        ]),
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
   * FILTRE les itinéraires absurdes (durée > 2x le meilleur)
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

    // 🛡️ FILTRE QUALITÉ : Rejeter les itinéraires absurdes
    // Un itinéraire avec durée > 2x le meilleur est clairement mauvais
    // Exception: si le meilleur est très court (<15min), on accepte jusqu'à +30min
    const bestDuration = sorted[0]?.totalDuration || Infinity;
    const maxAcceptableDuration = bestDuration < 900 
      ? bestDuration + 1800  // Pour trajets courts: +30min max
      : bestDuration * 2;     // Pour trajets longs: max 2x la durée
    
    const filtered = sorted.filter(it => {
      if (it.totalDuration > maxAcceptableDuration) {
        console.log(`🚫 Itinéraire rejeté: ${Math.round(it.totalDuration/60)}min > max ${Math.round(maxAcceptableDuration/60)}min`);
        return false;
      }
      return true;
    });

    // Assurer la diversité des lignes : garder au moins un trajet par première ligne utilisée
    // MAIS seulement si l'itinéraire est acceptable (pas 10h de marche!)
    const byFirstRoute = new Map(); // firstRouteName -> [itineraries]
    for (const it of filtered) {
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
    for (const it of filtered) {
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
