/*
 * Copyright (c) 2025 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * ranking.js - VERSION V223
 * Logique de déduplication, tri et filtrage pour les itinéraires.
 * 
 * ✅ V223: Fix filtrage mode arriver - utilise arrivalTime au lieu de departureTime
 *    Un bus partant à 14h28 mais arrivant à 16h30 n'est plus incorrectement filtré
 */

import { parseTimeStringToMinutes } from '../utils/formatters.js';

// V120: Configuration minimum d'itinéraires bus
const MIN_BUS_ITINERARIES = 5;

/**
 * V327: Déduplication intelligente
 * - Garde plusieurs horaires de départ différents (17:44, 17:53, 18:05...)
 * - Pour un MÊME départ, garde la meilleure correspondance (arrivée la plus tôt)
 * - Signature = lignes utilisées + heure de départ arrondie à 2 min
 */
export function deduplicateItineraries(list, searchMode = 'partir') {
  if (!Array.isArray(list)) return [];
  
  const grouped = new Map();
  
  list.forEach(it => {
    const key = createRouteSignature(it);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(it);
  });
  
  const result = [];
  grouped.forEach((variants, key) => {
    if (variants.length === 1) {
      result.push(variants[0]);
      return;
    }
    
    // Trier les variantes par heure d'arrivée
    variants.sort((a, b) => {
      const arrA = parseTimeToMinutes(a.arrivalTime);
      const arrB = parseTimeToMinutes(b.arrivalTime);
      return arrA - arrB; // Plus tôt = meilleur
    });
    
    // Garder la meilleure (arrivée la plus tôt pour ce départ)
    result.push(variants[0]);
    
    if (variants.length > 1) {
      console.log(`🔄 Dédup: ${variants.length} variantes pour départ ${variants[0].departureTime}, gardé arrivée ${variants[0].arrivalTime}`);
    }
  });
  
  console.log(`🔄 Déduplication (${searchMode}): ${list.length} → ${result.length} itinéraires`);
  
  return result;
}

/**
 * V327: Signature basée sur les LIGNES + HEURE DE DÉPART
 * Deux trajets avec le même départ et mêmes lignes = même signature
 * → On garde celui avec la meilleure arrivée
 */
function createRouteSignature(it) {
  if (!it) return 'null';
  
  // Lignes utilisées dans l'ordre
  const lines = (it.summarySegments || [])
    .filter(s => s.type === 'BUS')
    .map(s => s.name || 'X')
    .join('>');
  
  // Heure de départ arrondie à 2 minutes (pour grouper les départs très proches)
  const depMinutes = parseTimeToMinutes(it.departureTime);
  const roundedDep = Math.floor(depMinutes / 2) * 2;
  
  return `${it.type}::${lines}::dep${roundedDep}`;
}

function normalizeStopName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
}

/**
 * Parse une chaîne de temps en minutes (wrapper pour compatibilité)
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return Infinity;
  const result = parseTimeStringToMinutes(timeStr);
  return result !== null ? result : Infinity;
}

/**
 * Filtre les itinéraires expirés (départ dans le passé).
 * Fonctionne pour les deux modes.
 * Si searchTime est fourni et la date est dans le futur, on ne filtre pas.
 * V70: Amélioration - ne filtre que si la recherche est pour aujourd'hui ET l'heure est passée
 */
export function filterExpiredDepartures(itineraries, searchTime = null) {
  if (!Array.isArray(itineraries)) return [];
  
  // Si pas de searchTime, pas de filtrage
  if (!searchTime) {
    return itineraries;
  }
  
  // V195: Normaliser la date de recherche
  let searchDate;
  const searchDateRaw = searchTime.date;
  
  if (!searchDateRaw || searchDateRaw === 'today' || searchDateRaw === "Aujourd'hui") {
    searchDate = new Date();
  } else if (searchDateRaw instanceof Date) {
    searchDate = searchDateRaw;
  } else {
    searchDate = new Date(searchDateRaw);
  }
  
  // Si date invalide, ne pas filtrer
  if (isNaN(searchDate.getTime())) {
    console.warn('⚠️ filterExpiredDepartures: date invalide, pas de filtrage');
    return itineraries;
  }
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const searchDateStr = `${searchDate.getFullYear()}-${String(searchDate.getMonth() + 1).padStart(2, '0')}-${String(searchDate.getDate()).padStart(2, '0')}`;
  
  // V205: Filtrer par rapport à l'heure demandée (pas l'heure courante)
  // Objectif: montrer une liste croissante à partir de l'heure choisie, même si la requête est faite après minuit
  
  // Si date FUTURE, on ne filtre rien (on suppose tous les horaires valides pour ce jour)
  if (searchDateStr !== todayStr) {
    console.log(`📅 V205: Recherche pour ${searchDateStr} (≠ aujourd'hui ${todayStr}) → pas de filtrage horaire`);
    return itineraries;
  }
  
  // V220: En mode ARRIVER, filtrer par rapport à l'heure ACTUELLE (pas l'heure demandée)
  // Car l'heure demandée est l'heure d'arrivée, pas de départ
  const isArriveMode = searchTime.type === 'arriver';
  
  let requestMinutes;
  if (isArriveMode) {
    // V223: Mode arriver - on filtre les bus qui ARRIVENT avant l'heure actuelle
    // (pas ceux qui PARTENT avant l'heure actuelle, car un bus parti à 14h peut arriver à 16h)
    const now = new Date();
    requestMinutes = now.getHours() * 60 + now.getMinutes();
    console.log(`🕐 V223: Mode ARRIVER - Filtrage des trajets qui arrivent avant ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')} (heure actuelle)`);
  } else {
    // Mode partir: filtrer les bus avant l'heure demandée
    const reqHour = parseInt(searchTime.hour) || 0;
    const reqMinute = parseInt(searchTime.minute) || 0;
    requestMinutes = reqHour * 60 + reqMinute;
    console.log(`🕐 V205: Filtrage des trajets avant ${reqHour}:${String(reqMinute).padStart(2,'0')} (heure demandée)`);
  }
  
  const filtered = itineraries.filter(it => {
    // V142: Ne jamais filtrer vélo/marche - ils n'ont pas d'horaire fixe
    const type = it?.type;
    if (type === 'BIKE' || type === 'WALK' || it?._isBike || it?._isWalk) {
      return true;
    }
    
    // V223: En mode arriver, utiliser l'heure d'ARRIVÉE pour le filtrage
    // Un bus qui part à 14h mais arrive à 16h30 est valide si on veut arriver avant 17h40
    const timeToCheck = isArriveMode ? it?.arrivalTime : it?.departureTime;
    if (!timeToCheck || timeToCheck === '~' || timeToCheck === '--:--') return true;
    
    const timeMinutes = parseTimeToMinutes(timeToCheck);
    if (timeMinutes === Infinity) return true;
    
    // Garder si l'heure >= heure actuelle/demandée (avec 2 min de marge négative)
    return timeMinutes >= (requestMinutes - 2);
  });
  
  const removed = itineraries.length - filtered.length;
  if (removed > 0) {
    console.log(`🚫 ${removed} trajet(s) passé(s) filtré(s)`);
  }
  
  return filtered;
}

/**
 * En mode "arriver", filtre les trajets qui arrivent APRÈS l'heure demandée.
 */
export function filterLateArrivals(itineraries, targetHour, targetMinute) {
  if (!Array.isArray(itineraries)) return [];
  
  const targetMinutes = targetHour * 60 + targetMinute;
  
  return itineraries.filter(it => {
    const arrTime = it?.arrivalTime;
    if (!arrTime || arrTime === '~' || arrTime === '--:--') return true;
    
    const arrMinutes = parseTimeToMinutes(arrTime);
    if (arrMinutes === Infinity) return true;
    
    // Garder si arrivée <= heure cible
    return arrMinutes <= targetMinutes;
  });
}

/**
 * Trie et classe les itinéraires pour le mode "arriver".
 * V142: Tri par type (BUS d'abord) puis par heure d'arrivée DÉCROISSANTE
 * L'utilisateur veut arriver à 16h -> les trajets BUS les plus proches de 16h en premier
 */
export function rankArrivalItineraries(itineraries, searchTime) {
  if (!searchTime || searchTime.type !== 'arriver') return itineraries;
  if (!Array.isArray(itineraries) || !itineraries.length) return itineraries;
  
  const targetHour = parseInt(searchTime.hour) || 0;
  const targetMinute = parseInt(searchTime.minute) || 0;
  const targetMinutes = targetHour * 60 + targetMinute;
  
  console.log(`🎯 rankArrivalItineraries: cible ${String(targetHour).padStart(2,'0')}:${String(targetMinute).padStart(2,'0')} (${targetMinutes}min), ${itineraries.length} itinéraires`);
  
  // V142: Séparer par type pour garder BUS en premier
  const busItins = itineraries.filter(it => it.type !== 'BIKE' && it.type !== 'WALK' && !it._isBike && !it._isWalk);
  const bikeItins = itineraries.filter(it => it.type === 'BIKE' || it._isBike);
  const walkItins = itineraries.filter(it => it.type === 'WALK' || it._isWalk);
  
  // V618: Dédupliquer les correspondances identiques avec heures différentes (garder le départ plus tard)
  const deduplicatedBus = deduplicateByTransferPattern(busItins);
  
  // Trier les bus par : 1) destination exacte, 2) arrivée DÉCROISSANTE (plus proche de l'heure cible en premier)
  deduplicatedBus.sort((a, b) => {
    // V617: PRIORITÉ 1: Destination correcte vs mismatch
    const aMismatch = a._destinationMismatch ? 1 : 0;
    const bMismatch = b._destinationMismatch ? 1 : 0;
    if (aMismatch !== bMismatch) {
      console.log(`📌 V618: Prioriser destination correcte: ${a._destinationMismatch ? 'A' : 'B'} au mauvais arrêt`);
      return aMismatch - bMismatch; // Bon arrêt d'abord (0 < 1)
    }
    
    const arrA = parseTimeToMinutes(a.arrivalTime);
    const arrB = parseTimeToMinutes(b.arrivalTime);
    
    // Filtrer les arrivées après l'heure demandée (trop tard)
    const aValid = arrA <= targetMinutes;
    const bValid = arrB <= targetMinutes;
    if (aValid !== bValid) return aValid ? -1 : 1;
    
    // Trier par arrivée DÉCROISSANTE (15h55 > 15h45 > 15h30)
    return arrB - arrA;
  });

  // Recomposer: BUS triés, puis BIKE, puis WALK
  const sorted = [...deduplicatedBus, ...bikeItins, ...walkItins];

  console.log('📋 Tri ARRIVER (BUS d\'abord, destination correcte, arrivée décroissante):', sorted.slice(0, 5).map(it => `${it.type}:${it.arrivalTime}${it._destinationMismatch ? '❌' : '✓'}`).join(', '));

  return sorted;
}

/**
 * V618: Dédupliquer les correspondances identiques avec heures différentes
 * Garde celle qui part LE PLUS TARD (moins d'attente à la correspondance)
 */
function deduplicateByTransferPattern(itineraries) {
  if (!itineraries.length) return itineraries;
  
  // Créer une clé basée sur le pattern de correspondances
  const getTransferKey = (it) => {
    if (!it.steps || it.steps.length === 0) return `${it.arrivalTime}`;
    
    // Clé = numéros de lignes + arrêts d'arrivée de chaque segment bus
    const busSteps = it.steps.filter(s => s.type === 'BUS');
    if (busSteps.length === 0) return `${it.arrivalTime}`;
    
    return busSteps.map(s => `${s.routeShortName}_${s.arrivalStop}`).join('|');
  };
  
  // Grouper par clé
  const groups = new Map();
  itineraries.forEach(it => {
    const key = getTransferKey(it);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  });
  
  // Pour chaque groupe, garder celui qui part LE PLUS TARD (moins d'attente)
  const deduplicated = [];
  groups.forEach(group => {
    if (group.length === 1) {
      deduplicated.push(group[0]);
    } else {
      // Trier par heure de départ DÉCROISSANTE, garder le premier
      group.sort((a, b) => parseTimeToMinutes(b.departureTime) - parseTimeToMinutes(a.departureTime));
      console.log(`📌 V618: Dédup - Correspondance ${group[0].steps?.map(s => s.routeShortName).join('-') || 'unknown'}: gardé ${group[0].departureTime}, rejeté ${group.slice(1).map(g => g.departureTime).join(', ')}`);
      deduplicated.push(group[0]);
    }
  });
  
  return deduplicated;
}

/**
 * Trie les itinéraires pour le mode "partir".
 * Priorité: premier départ (>= heure demandée), moins de correspondances, durée totale plus courte.
 */
/**
 * V64: Limite les trajets vélo et piéton à un seul de chaque.
 * Ces modes n'ont pas d'horaires (on peut partir quand on veut),
 * donc avoir plusieurs résultats est inutile.
 * V120: Garantit au minimum MIN_BUS_ITINERARIES trajets bus si disponibles
 */
export function limitBikeWalkItineraries(itineraries, minBusRequired = MIN_BUS_ITINERARIES) {
  if (!Array.isArray(itineraries)) return [];
  
  const busItineraries = [];
  let firstBike = null;
  let firstWalk = null;
  
  for (const it of itineraries) {
    const type = it?.type || 'BUS';
    
    if (type === 'BIKE' || it?._isBike) {
      if (!firstBike) {
        firstBike = it;
      }
      // Ignorer les doublons vélo
    } else if (type === 'WALK' || it?._isWalk) {
      if (!firstWalk) {
        firstWalk = it;
      }
      // Ignorer les doublons piéton
    } else {
      // Bus/Transit : garder tous
      busItineraries.push(it);
    }
  }
  
  // V120: Log si on a moins de bus que le minimum souhaité
  if (busItineraries.length < minBusRequired && busItineraries.length > 0) {
    console.log(`⚠️ V120: Seulement ${busItineraries.length} trajet(s) bus trouvé(s) (minimum souhaité: ${minBusRequired})`);
  }
  
  // Reconstruire la liste : BUS d'abord, puis vélo, puis piéton
  const result = [...busItineraries];
  if (firstBike) result.push(firstBike);
  if (firstWalk) result.push(firstWalk);
  
  const removed = itineraries.length - result.length;
  if (removed > 0) {
    console.log(`🚴 V64: ${removed} trajet(s) vélo/piéton en double supprimé(s)`);
  }
  
  console.log(`📊 V120: ${busItineraries.length} bus, ${firstBike ? 1 : 0} vélo, ${firstWalk ? 1 : 0} marche`);
  
  return result;
}

/**
 * V120: Compte le nombre d'itinéraires bus dans une liste
 */
export function countBusItineraries(itineraries) {
  if (!Array.isArray(itineraries)) return 0;
  return itineraries.filter(it => {
    const type = it?.type || 'BUS';
    return type !== 'BIKE' && type !== 'WALK' && !it?._isBike && !it?._isWalk;
  }).length;
}

/**
 * V120: Retourne le minimum d'itinéraires bus configuré
 */
export function getMinBusItineraries() {
  return MIN_BUS_ITINERARIES;
}

export function rankDepartureItineraries(itineraries) {
  if (!Array.isArray(itineraries) || !itineraries.length) return itineraries;
  
  console.log(`🎯 rankDepartureItineraries: ${itineraries.length} itinéraires à trier`);
  
  // Debug: afficher tous les itinéraires avant tri
  console.log('📋 Avant tri (heures de départ):', itineraries.map(it => it.departureTime).join(', '));
  
  const scored = itineraries.map(it => {
    const steps = Array.isArray(it.steps) ? it.steps : [];
    const busSteps = steps.filter(s => s.type === 'BUS');
    const transfers = Math.max(0, busSteps.length - 1);
    const depMinutes = parseTimeToMinutes(it.departureTime);
    
    // Durée totale en minutes
    let durationMin = 0;
    const durationMatch = (it.duration || '').match(/(\d+)/);
    if (durationMatch) durationMin = parseInt(durationMatch[1], 10);
    
    return {
      it,
      depMinutes,
      depTime: it.departureTime, // Pour debug
      transfers,
      durationMin
    };
  });

  // Trier: plus tôt d'abord
  scored.sort((a, b) => {
    // D'abord par heure de départ (plus tôt = meilleur)
    if (a.depMinutes !== b.depMinutes) return a.depMinutes - b.depMinutes;
    // Puis par nombre de correspondances
    if (a.transfers !== b.transfers) return a.transfers - b.transfers;
    // Enfin par durée totale
    return a.durationMin - b.durationMin;
  });

  console.log('📋 Après tri PARTIR (du plus tôt au plus tard):', scored.slice(0, 8).map(s => ({
    dep: s.depTime,
    depMin: s.depMinutes,
    arr: s.it.arrivalTime,
    transfers: s.transfers
  })));

  return scored.map(x => x.it);
}

