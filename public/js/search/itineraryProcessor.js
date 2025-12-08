/*
 * Copyright (c) 2025 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * itineraryProcessor.js - Traitement des réponses d'itinéraires
 * 
 * @module search/itineraryProcessor
 * @version V221
 * 
 * Ce module gère le traitement des réponses API Google Routes :
 * - Parsing des routes Google en objets itinéraires
 * - Enrichissement avec données GTFS locales
 * - Reconstruction des polylines manquantes
 * - Déduplication et signature d'itinéraires
 */

import { 
    isMeaningfulTime,
    formatGoogleTime, 
    formatGoogleDuration, 
    parseGoogleDuration,
    getSafeRouteBadgeLabel,
    addSecondsToTimeString,
    subtractSecondsFromTimeString
} from '../utils/formatters.js';

import { ICONS } from '../config/icons.js';
import { encodePolyline } from '../router.js';

// === CONSTANTES ===

/**
 * Lignes interdites (TER, régionales)
 * @type {Set<string>}
 */
const FORBIDDEN_LINES = new Set(['TER', '322']);

// === FONCTIONS DE PARSING ===

/**
 * Parse HH:MM en minutes depuis minuit
 * @param {string} timeStr - Format "HH:MM"
 * @returns {number} Minutes depuis minuit (Infinity si invalide)
 */
export function parseDepartureMinutes(timeStr) {
    const match = timeStr?.match?.(/(\d{1,2}):(\d{2})/);
    if (!match) return Infinity;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return Infinity;
    return h * 60 + m;
}

/**
 * Parse HH:MM en secondes depuis minuit
 * @param {string} timeStr - Format "HH:MM"
 * @returns {number} Secondes depuis minuit (Infinity si invalide)
 */
export function parseTimeToSeconds(timeStr) {
    const match = timeStr?.match?.(/(\d{1,2}):(\d{2})/);
    if (!match) return Infinity;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return Infinity;
    return h * 3600 + m * 60;
}

// === SIGNATURE ET DÉDUPLICATION ===

/**
 * Crée une signature unique pour un itinéraire
 * Permet de détecter les doublons même avec des horaires différents
 * 
 * @param {Object} it - L'itinéraire
 * @returns {string} Signature unique
 */
export function createItinerarySignature(it) {
    if (!it) return 'null';
    
    const type = it.type || 'BUS';
    
    // Pour vélo/piéton, signature simple par type
    if (type === 'BIKE' || type === 'WALK') {
        return `${type}_only`;
    }
    
    // Pour les bus, signature basée sur les lignes et arrêts
    const segments = (it.summarySegments || [])
        .map(s => s.name || s.routeShortName || 'X')
        .join('>');
    
    const steps = (it.steps || [])
        .filter(s => s.type === 'BUS')
        .map(s => {
            const route = s.routeShortName || s.route?.route_short_name || '';
            const from = (s.departureStop || '').toLowerCase().slice(0, 15);
            const to = (s.arrivalStop || '').toLowerCase().slice(0, 15);
            return `${route}:${from}-${to}`;
        })
        .join('|');
    
    // Inclure l'heure de départ pour distinguer les mêmes trajets à des heures différentes
    const depTime = it.departureTime || '';
    
    return `${type}::${segments}::${steps}::${depTime}`;
}

// === TRI DES ITINÉRAIRES ===

/**
 * Trie les itinéraires par heure de départ (croissant)
 * Conserve les groupes par type: BUS d'abord, puis BIKE, puis WALK
 * 
 * @param {Array} list - Liste d'itinéraires
 * @returns {Array} Liste triée
 */
export function sortItinerariesByDeparture(list) {
    // Séparer par type
    const busItins = list.filter(it => it.type !== 'BIKE' && it.type !== 'WALK' && !it._isBike && !it._isWalk);
    const bikeItins = list.filter(it => it.type === 'BIKE' || it._isBike);
    const walkItins = list.filter(it => it.type === 'WALK' || it._isWalk);
    
    // Trier seulement les bus par heure de départ
    busItins.sort((a, b) => parseDepartureMinutes(a?.departureTime) - parseDepartureMinutes(b?.departureTime));
    
    // Recomposer: BUS triés, puis BIKE, puis WALK
    return [...busItins, ...bikeItins, ...walkItins];
}

// === TRAITEMENT DES RÉPONSES GOOGLE ===

/**
 * Traite la réponse de l'API Google Routes pour les trajets en bus
 * 
 * @param {Object} data - Réponse de l'API Google Routes
 * @param {Object} [options] - Options
 * @param {Object} [options.dataManager] - Instance du DataManager pour enrichissement GTFS
 * @param {Object} [options.icons] - Icônes SVG
 * @returns {Array} Liste des itinéraires formatés
 */
export function processGoogleRoutesResponse(data, options = {}) {
    const { dataManager = null, icons = ICONS } = options;
    
    if (!data || !data.routes || data.routes.length === 0) {
        console.warn("Réponse de l'API Routes (BUS) vide ou invalide.");
        return [];
    }
    
    return data.routes.map(route => {
        const leg = route.legs[0];
        let isRegionalRoute = false;
        
        const itinerary = {
            type: 'BUS',
            priority: 1,
            departureTime: "--:--",
            arrivalTime: "--:--",
            duration: formatGoogleDuration(route.duration),
            durationRaw: parseGoogleDuration(route.duration),
            polyline: route.polyline,
            summarySegments: [],
            steps: []
        };
        
        let currentWalkStep = null;

        for (const step of leg.steps) {
            const duration = formatGoogleDuration(step.staticDuration);
            const rawDuration = parseGoogleDuration(step.staticDuration);
            const distanceMeters = step.distanceMeters || 0;
            const distanceText = step.localizedValues?.distance?.text || '';
            const instruction = step.navigationInstruction?.instructions || step.localizedValues?.instruction || "Marcher";
            const maneuver = step.navigationInstruction?.maneuver || 'DEFAULT';

            if (step.travelMode === 'WALK') {
                if (!currentWalkStep) {
                    currentWalkStep = {
                        type: 'WALK',
                        icon: icons.WALK,
                        instruction: "Marche",
                        subSteps: [],
                        polylines: [],
                        totalDuration: 0,
                        totalDistanceMeters: 0,
                        departureTime: "--:--",
                        arrivalTime: "--:--"
                    };
                }
                currentWalkStep.subSteps.push({ instruction, distance: distanceText, duration, maneuver });
                currentWalkStep.polylines.push(step.polyline);
                currentWalkStep.totalDuration += rawDuration;
                currentWalkStep.totalDistanceMeters += distanceMeters;

            } else if (step.travelMode === 'TRANSIT' && step.transitDetails) {
                const transit = step.transitDetails;
                const stopDetails = transit.stopDetails || {};

                if (currentWalkStep) {
                    currentWalkStep.duration = formatGoogleDuration(currentWalkStep.totalDuration + 's');
                    if (currentWalkStep.totalDistanceMeters > 1000) {
                        currentWalkStep.distance = `${(currentWalkStep.totalDistanceMeters / 1000).toFixed(1)} km`;
                    } else {
                        currentWalkStep.distance = `${currentWalkStep.totalDistanceMeters} m`;
                    }
                    const nextDepTime = transit.localizedValues?.departureTime?.time?.text || formatGoogleTime(stopDetails.departureTime);
                    currentWalkStep.arrivalTime = nextDepTime;
                    currentWalkStep.durationRaw = currentWalkStep.totalDuration;
                    itinerary.steps.push(currentWalkStep);
                    currentWalkStep = null;
                }
                
                const line = transit.transitLine;
                if (line) {
                    const shortName = line.nameShort || 'BUS';
                    
                    // Vérification des lignes interdites
                    if (FORBIDDEN_LINES.has(shortName)) {
                        console.warn(`[Filtre] Trajet rejeté: Ligne interdite ("${shortName}") détectée.`);
                        isRegionalRoute = true;
                    } else if (dataManager && dataManager.isLoaded && !dataManager.routesByShortName[shortName]) {
                        console.log(`⚠️ Ligne inconnue du GTFS ("${shortName}") mais conservée.`);
                    }
                    
                    const color = line.color || '#3388ff';
                    const textColor = line.textColor || '#ffffff';
                    const departureStop = stopDetails.departureStop || {};
                    const arrivalStop = stopDetails.arrivalStop || {};
                    let intermediateStops = (stopDetails.intermediateStops || []).map(stop => stop.name || 'Arrêt inconnu');
                    
                    // Enrichissement GTFS des arrêts intermédiaires
                    if (intermediateStops.length === 0 && dataManager && dataManager.isLoaded) {
                        const apiDepName = departureStop.name;
                        const apiArrName = arrivalStop.name;
                        const apiHeadsign = transit.headsign;
                        if (apiDepName && apiArrName && apiHeadsign) {
                            const gtfsStops = dataManager.getIntermediateStops(shortName, apiHeadsign, apiDepName, apiArrName);
                            if (gtfsStops && gtfsStops.length > 0) {
                                intermediateStops = gtfsStops;
                            }
                        }
                    }
                    
                    const depTime = transit.localizedValues?.departureTime?.time?.text || formatGoogleTime(stopDetails.departureTime);
                    const arrTime = transit.localizedValues?.arrivalTime?.time?.text || formatGoogleTime(stopDetails.arrivalTime);
                    
                    itinerary.steps.push({
                        type: 'BUS',
                        icon: icons.BUS,
                        routeShortName: shortName,
                        routeColor: color,
                        routeTextColor: textColor,
                        instruction: `Prendre le <b>${shortName}</b> direction <b>${transit.headsign || 'destination'}</b>`,
                        departureStop: departureStop.name || 'Arrêt de départ',
                        departureTime: depTime,
                        arrivalStop: arrivalStop.name || 'Arrêt d\'arrivée',
                        arrivalTime: arrTime,
                        numStops: transit.stopCount || 0,
                        intermediateStops: intermediateStops,
                        duration: formatGoogleDuration(step.staticDuration),
                        polyline: step.polyline,
                        durationRaw: rawDuration
                    });
                }
            }
        }
        
        if (isRegionalRoute) return null;

        // Finaliser le dernier step de marche
        if (currentWalkStep) {
            currentWalkStep.duration = formatGoogleDuration(currentWalkStep.totalDuration + 's');
            if (currentWalkStep.totalDistanceMeters > 1000) {
                currentWalkStep.distance = `${(currentWalkStep.totalDistanceMeters / 1000).toFixed(1)} km`;
            } else {
                currentWalkStep.distance = `${currentWalkStep.totalDistanceMeters} m`;
            }
            const legArrivalTime = leg.localizedValues?.arrivalTime?.time?.text || "--:--";
            currentWalkStep.arrivalTime = legArrivalTime;
            currentWalkStep.durationRaw = currentWalkStep.totalDuration;
            itinerary.steps.push(currentWalkStep);
        }
        
        // Calculer les heures de départ/arrivée de l'itinéraire
        if (itinerary.steps.length > 0) {
            const firstStepWithTime = itinerary.steps.find(s => s.departureTime && s.departureTime !== "--:--");
            itinerary.departureTime = firstStepWithTime ? firstStepWithTime.departureTime : (itinerary.steps[0].departureTime || "--:--");
            
            const lastStepWithTime = [...itinerary.steps].reverse().find(s => s.arrivalTime && s.arrivalTime !== "--:--");
            itinerary.arrivalTime = lastStepWithTime ? lastStepWithTime.arrivalTime : (itinerary.steps[itinerary.steps.length - 1].arrivalTime || "--:--");
        }
        
        // Construire les segments de résumé
        const allSummarySegments = itinerary.steps.map(step => {
            if (step.type === 'WALK') {
                return { type: 'WALK', duration: step.duration };
            } else {
                return {
                    type: 'BUS',
                    name: getSafeRouteBadgeLabel(step.routeShortName),
                    color: step.routeColor,
                    textColor: step.routeTextColor,
                    duration: step.duration
                };
            }
        });
        
        const hasBusSegment = itinerary.steps.some(step => step.type === 'BUS');
        
        // Recalculer la durée totale
        const computedDurationSeconds = itinerary.steps.reduce((total, step) => {
            const value = typeof step?.durationRaw === 'number' ? step.durationRaw : 0;
            return total + (Number.isFinite(value) ? value : 0);
        }, 0);
        
        if (computedDurationSeconds > 0) {
            itinerary.durationRaw = computedDurationSeconds;
            itinerary.duration = formatGoogleDuration(`${computedDurationSeconds}s`);
        }

        // Propager les temps de départ/arrivée aux steps adjacents
        _propagateTimesToSteps(itinerary, computedDurationSeconds);

        // Typer l'itinéraire
        if (!hasBusSegment) {
            const legDepartureTime = leg.localizedValues?.departureTime?.time?.text || leg.startTime?.text || "--:--";
            const legArrivalTime = leg.localizedValues?.arrivalTime?.time?.text || leg.endTime?.text || "--:--";
            itinerary.type = 'WALK';
            itinerary.summarySegments = [];
            itinerary._isWalk = true;
            
            if (legDepartureTime && legDepartureTime !== "--:--") {
                itinerary.departureTime = legDepartureTime;
                if (itinerary.steps.length && (!itinerary.steps[0].departureTime || itinerary.steps[0].departureTime === '--:--')) {
                    itinerary.steps[0].departureTime = legDepartureTime;
                }
            }
            if (legArrivalTime && legArrivalTime !== "--:--") {
                itinerary.arrivalTime = legArrivalTime;
                const lastStep = itinerary.steps[itinerary.steps.length - 1];
                if (lastStep && (!lastStep.arrivalTime || lastStep.arrivalTime === '--:--')) {
                    lastStep.arrivalTime = legArrivalTime;
                }
            }
        } else {
            itinerary.summarySegments = allSummarySegments.filter(segment => segment.type === 'BUS');
        }
        
        return itinerary;
    }).filter(itinerary => itinerary !== null);
}

/**
 * Propage les temps aux steps adjacents
 * @private
 */
function _propagateTimesToSteps(itinerary, computedDurationSeconds) {
    const firstTimedStepIndex = itinerary.steps.findIndex(step => isMeaningfulTime(step?.departureTime));
    
    if (firstTimedStepIndex !== -1) {
        let anchorTime = itinerary.steps[firstTimedStepIndex].departureTime;
        for (let i = firstTimedStepIndex - 1; i >= 0; i--) {
            const stepDuration = typeof itinerary.steps[i]?.durationRaw === 'number' ? itinerary.steps[i].durationRaw : 0;
            if (stepDuration > 0) {
                const recalculated = subtractSecondsFromTimeString(anchorTime, stepDuration);
                if (!recalculated) break;
                anchorTime = recalculated;
            }
        }
        itinerary.departureTime = anchorTime;
    } else if (isMeaningfulTime(itinerary.arrivalTime) && computedDurationSeconds > 0) {
        const derived = subtractSecondsFromTimeString(itinerary.arrivalTime, computedDurationSeconds);
        if (derived) itinerary.departureTime = derived;
    }

    const lastTimedArrivalIndex = (() => {
        for (let i = itinerary.steps.length - 1; i >= 0; i--) {
            if (isMeaningfulTime(itinerary.steps[i]?.arrivalTime)) return i;
        }
        return -1;
    })();

    if (lastTimedArrivalIndex !== -1) {
        let anchorTime = itinerary.steps[lastTimedArrivalIndex].arrivalTime;
        for (let i = lastTimedArrivalIndex + 1; i < itinerary.steps.length; i++) {
            const stepDuration = typeof itinerary.steps[i]?.durationRaw === 'number' ? itinerary.steps[i].durationRaw : 0;
            if (stepDuration > 0) {
                const recalculated = addSecondsToTimeString(anchorTime, stepDuration);
                if (!recalculated) break;
                anchorTime = recalculated;
            }
        }
        itinerary.arrivalTime = anchorTime;
    } else if (isMeaningfulTime(itinerary.departureTime) && computedDurationSeconds > 0) {
        const derivedArrival = addSecondsToTimeString(itinerary.departureTime, computedDurationSeconds);
        if (derivedArrival) itinerary.arrivalTime = derivedArrival;
    }
}

/**
 * Traite une route simple (vélo ou marche)
 * 
 * @param {Object} data - Données de la route
 * @param {string} mode - 'bike' ou 'walk'
 * @param {Object} modeInfo - Informations sur le mode (duration, distance)
 * @param {Object} searchTime - Paramètres de recherche temporelle
 * @param {Object} [options] - Options
 * @returns {Object|null} Itinéraire formaté
 */
export function processSimpleRoute(data, mode, modeInfo, searchTime, options = {}) {
    const { icons = ICONS } = options;
    
    if (!data || !data.routes || data.routes.length === 0 || !modeInfo) return null;
    
    const route = data.routes[0];
    const leg = route.legs?.[0];
    const durationMinutes = modeInfo.duration;
    const distanceKm = modeInfo.distance;
    const durationRawSeconds = durationMinutes * 60;
    const icon = mode === 'bike' ? icons.BICYCLE : icons.WALK;
    const modeLabel = mode === 'bike' ? 'Vélo' : 'Marche';
    const type = mode === 'bike' ? 'BIKE' : 'WALK';
    
    let departureTimeStr = "~";
    let arrivalTimeStr = "~";
    
    if (searchTime.type === 'partir') {
        try {
            let departureDate;
            if (searchTime.date === 'today' || searchTime.date === "Aujourd'hui" || !searchTime.date) {
                departureDate = new Date();
            } else {
                departureDate = new Date(searchTime.date);
            }
            departureDate.setHours(searchTime.hour, searchTime.minute, 0, 0);
            const arrivalDate = new Date(departureDate.getTime() + durationRawSeconds * 1000);
            departureTimeStr = `${String(departureDate.getHours()).padStart(2, '0')}:${String(departureDate.getMinutes()).padStart(2, '0')}`;
            arrivalTimeStr = `${String(arrivalDate.getHours()).padStart(2, '0')}:${String(arrivalDate.getMinutes()).padStart(2, '0')}`;
        } catch (e) {
            console.warn("Erreur calcul date pour vélo/marche", e);
        }
    } else if (searchTime.type === 'arriver') {
        try {
            let arrivalDate;
            if (searchTime.date === 'today' || searchTime.date === "Aujourd'hui" || !searchTime.date) {
                arrivalDate = new Date();
            } else {
                arrivalDate = new Date(searchTime.date);
            }
            arrivalDate.setHours(searchTime.hour, searchTime.minute, 0, 0);
            const departureDate = new Date(arrivalDate.getTime() - durationRawSeconds * 1000);
            arrivalTimeStr = `${String(arrivalDate.getHours()).padStart(2, '0')}:${String(arrivalDate.getMinutes()).padStart(2, '0')}`;
            departureTimeStr = `${String(departureDate.getHours()).padStart(2, '0')}:${String(departureDate.getMinutes()).padStart(2, '0')}`;
        } catch (e) {
            console.warn("Erreur calcul date (arriver) pour vélo/marche", e);
        }
    }

    const aggregatedStep = {
        type: type,
        icon: icon,
        instruction: modeLabel,
        distance: `${distanceKm} km`,
        duration: `${durationMinutes} min`,
        subSteps: [],
        polylines: [],
        departureTime: "~",
        arrivalTime: "~",
        durationRaw: durationRawSeconds
    };

    // Protection contre leg ou leg.steps undefined
    if (leg?.steps) {
        leg.steps.forEach(step => {
            const distanceText = step.localizedValues?.distance?.text || '';
            const instruction = step.navigationInstruction?.instructions || step.localizedValues?.instruction || (mode === 'bike' ? "Continuer à vélo" : "Marcher");
            const duration = formatGoogleDuration(step.staticDuration);
            const maneuver = step.navigationInstruction?.maneuver || 'DEFAULT';
            aggregatedStep.subSteps.push({ instruction, distance: distanceText, duration, maneuver });
            aggregatedStep.polylines.push(step.polyline);
        });
    }
    
    return {
        type: type,
        departureTime: departureTimeStr,
        arrivalTime: arrivalTimeStr,
        duration: `${durationMinutes} min`,
        durationRaw: durationRawSeconds,
        polyline: route.polyline,
        summarySegments: [],
        steps: [aggregatedStep],
        _isBike: mode === 'bike',
        _isWalk: mode === 'walk'
    };
}

// === EXPORTS PAR DÉFAUT ===

export default {
    // Parsing
    parseDepartureMinutes,
    parseTimeToSeconds,
    
    // Signature
    createItinerarySignature,
    
    // Tri
    sortItinerariesByDeparture,
    
    // Traitement
    processGoogleRoutesResponse,
    processSimpleRoute
};

