/**
 * googleRoutesProcessor.js - Traitement des réponses Google Routes API
 * 
 * Ce module gère la transformation des réponses de l'API Google Routes
 * en objets itinéraires utilisables par l'application.
 */

import { ICONS } from '../config/icons.js';
import { 
    formatGoogleTime, 
    formatGoogleDuration, 
    parseGoogleDuration,
    getSafeRouteBadgeLabel 
} from '../utils/formatters.js';

/**
 * Traite la réponse de l'API Google Routes pour les trajets en bus
 * @param {Object} data - Réponse de l'API Google Routes
 * @param {Object} dataManager - Instance du DataManager pour enrichissement GTFS
 * @returns {Array} Liste des itinéraires formatés
 */
export function processGoogleRoutesResponse(data, dataManager = null) {
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
                        icon: ICONS.WALK,
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
                    currentWalkStep.distance = formatDistance(currentWalkStep.totalDistanceMeters);
                    const nextDepTime = transit.localizedValues?.departureTime?.time?.text || formatGoogleTime(stopDetails.departureTime);
                    currentWalkStep.arrivalTime = nextDepTime;
                    currentWalkStep.durationRaw = currentWalkStep.totalDuration;
                    itinerary.steps.push(currentWalkStep);
                    currentWalkStep = null;
                }
                
                const line = transit.transitLine;
                if (line) {
                    const shortName = line.nameShort || 'BUS';
                    
                    // Vérifier si la ligne est locale
                    if (dataManager && dataManager.isLoaded && !dataManager.routesByShortName[shortName]) {
                        console.warn(`[Filtre] Trajet rejeté: Ligne non-locale ("${shortName}") détectée.`);
                        isRegionalRoute = true;
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
                        icon: ICONS.BUS,
                        routeShortName: shortName,
                        routeColor: color,
                        routeTextColor: textColor,
                        instruction: `Prendre le <b>${shortName}</b> direction <b>${transit.headsign || 'destination'}</b>`,
                        departureStop: departureStop.name || 'Arrêt de départ',
                        departureTime: depTime,
                        arrivalStop: arrivalStop.name || "Arrêt d'arrivée",
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

        // Finaliser la dernière étape de marche
        if (currentWalkStep) {
            currentWalkStep.duration = formatGoogleDuration(currentWalkStep.totalDuration + 's');
            currentWalkStep.distance = formatDistance(currentWalkStep.totalDistanceMeters);
            const legArrivalTime = leg.localizedValues?.arrivalTime?.time?.text || "--:--";
            currentWalkStep.arrivalTime = legArrivalTime;
            currentWalkStep.durationRaw = currentWalkStep.totalDuration;
            itinerary.steps.push(currentWalkStep);
        }
        
        // Calculer les heures de départ/arrivée globales
        if (itinerary.steps.length > 0) {
            const firstStepWithTime = itinerary.steps.find(s => s.departureTime && s.departureTime !== "--:--");
            itinerary.departureTime = firstStepWithTime ? firstStepWithTime.departureTime : (itinerary.steps[0].departureTime || "--:--");
            const lastStepWithTime = [...itinerary.steps].reverse().find(s => s.arrivalTime && s.arrivalTime !== "--:--");
            itinerary.arrivalTime = lastStepWithTime ? lastStepWithTime.arrivalTime : (itinerary.steps[itinerary.steps.length - 1].arrivalTime || "--:--");
        }
                
        // Construire le résumé des segments
        itinerary.summarySegments = buildSummarySegments(itinerary.steps);
        
        return itinerary;
    }).filter(Boolean); // Retirer les null (routes régionales rejetées)
}

/**
 * Traite un itinéraire simple (vélo ou marche)
 * @param {Object} data - Réponse de l'API
 * @param {string} mode - 'bike' ou 'walk'
 * @param {Object} modeInfo - Infos de durée et distance
 * @param {Object} searchTime - Paramètres de recherche temporels
 * @returns {Object|null} Itinéraire formaté
 */
export function processSimpleRoute(data, mode, modeInfo, searchTime) {
    if (!data || !data.routes || data.routes.length === 0 || !modeInfo) return null;
    
    const route = data.routes[0];
    const leg = route.legs[0];
    const durationMinutes = modeInfo.duration;
    const distanceKm = modeInfo.distance;
    const durationRawSeconds = durationMinutes * 60;
    const icon = mode === 'bike' ? ICONS.BICYCLE : ICONS.WALK;
    const modeLabel = mode === 'bike' ? 'Vélo' : 'Marche';
    const type = mode === 'bike' ? 'BIKE' : 'WALK';
    
    const { departureTimeStr, arrivalTimeStr } = calculateTimes(searchTime, durationRawSeconds);

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

    leg.steps.forEach(step => {
        const distanceText = step.localizedValues?.distance?.text || '';
        const instruction = step.navigationInstruction?.instructions || step.localizedValues?.instruction || (mode === 'bike' ? "Continuer à vélo" : "Marcher");
        const duration = formatGoogleDuration(step.staticDuration);
        const maneuver = step.navigationInstruction?.maneuver || 'DEFAULT';
        aggregatedStep.subSteps.push({ instruction, distance: distanceText, duration, maneuver });
        aggregatedStep.polylines.push(step.polyline);
    });
    
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

// === Fonctions utilitaires ===

/**
 * Formate une distance en mètres
 */
function formatDistance(meters) {
    if (meters > 1000) {
        return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters} m`;
}

/**
 * Construit les segments de résumé
 */
function buildSummarySegments(steps) {
    return steps.map(step => {
        if (step.type === 'WALK') {
            return { type: 'WALK', duration: step.duration };
        }
        return {
            type: 'BUS',
            name: getSafeRouteBadgeLabel(step.routeShortName),
            color: step.routeColor,
            textColor: step.routeTextColor,
            duration: step.duration
        };
    });
}

/**
 * Calcule les heures de départ et d'arrivée
 */
function calculateTimes(searchTime, durationRawSeconds) {
    let departureTimeStr = "~";
    let arrivalTimeStr = "~";
    
    try {
        if (searchTime.type === 'partir') {
            let departureDate = getSearchDate(searchTime);
            departureDate.setHours(searchTime.hour, searchTime.minute, 0, 0);
            const arrivalDate = new Date(departureDate.getTime() + durationRawSeconds * 1000);
            departureTimeStr = formatTimeFromDate(departureDate);
            arrivalTimeStr = formatTimeFromDate(arrivalDate);
        } else if (searchTime.type === 'arriver') {
            let arrivalDate = getSearchDate(searchTime);
            arrivalDate.setHours(searchTime.hour, searchTime.minute, 0, 0);
            const departureDate = new Date(arrivalDate.getTime() - durationRawSeconds * 1000);
            arrivalTimeStr = formatTimeFromDate(arrivalDate);
            departureTimeStr = formatTimeFromDate(departureDate);
        }
    } catch (e) {
        console.warn("Erreur calcul date pour vélo/marche", e);
    }
    
    return { departureTimeStr, arrivalTimeStr };
}

/**
 * Obtient la date de recherche
 */
function getSearchDate(searchTime) {
    if (searchTime.date === 'today' || searchTime.date === "Aujourd'hui" || !searchTime.date) {
        return new Date();
    }
    return new Date(searchTime.date);
}

/**
 * Formate une date en HH:MM
 */
function formatTimeFromDate(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default {
    processGoogleRoutesResponse,
    processSimpleRoute
};
