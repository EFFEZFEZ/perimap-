/**
 * resultsRenderer.js
 * Rendu des itinéraires + pagination arrivée.
 * V65: Enrichissement GTFS - trouve les prochains départs réels depuis les données locales
 */
import { ICONS } from '../config/icons.js';

export function createResultsRenderer(deps) {
  const { resultsListContainer, resultsModeTabs, getAllItineraries, getArrivalState, setArrivalRenderedCount, onLoadMoreDepartures, onLoadMoreArrivals, getDataManager } = deps;

  function getItineraryType(itinerary) {
    if (!itinerary) return 'BUS';
    if (itinerary.type) return itinerary.type;
    if (itinerary.summarySegments && itinerary.summarySegments.length > 0) return 'BUS';
    if (itinerary._isBike) return 'BIKE';
    if (itinerary._isWalk) return 'WALK';
    return 'BUS';
  }

  /**
   * V63: Crée une signature de trajet pour regrouper les horaires
   * Deux trajets avec les mêmes bus/arrêts mais horaires différents ont la même signature
   */
  function createRouteSignature(itinerary) {
    if (!itinerary) return 'null';
    const type = getItineraryType(itinerary);
    
    if (type === 'BIKE' || type === 'WALK') {
      // Vélo et marche : pas de regroupement, toujours unique
      return `${type}_${itinerary.duration}_${Math.random()}`;
    }
    
    const segments = (itinerary.summarySegments || [])
      .map(s => s.name || s.routeShortName || 'X')
      .join('>');
    
    const steps = (itinerary.steps || [])
      .filter(s => s.type === 'BUS')
      .map(s => {
        const route = s.routeShortName || s.route?.route_short_name || '';
        const from = normalizeStopName(s.departureStop);
        const to = normalizeStopName(s.arrivalStop);
        return `${route}:${from}-${to}`;
      })
      .join('|');
    
    return `${type}::${segments}::${steps}`;
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
   * V63: Parse l'heure "HH:MM" en minutes depuis minuit
   */
  function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }

  /**
   * V63: Regroupe les itinéraires identiques et collecte leurs horaires
   */
  function groupItinerariesByRoute(list) {
    const groups = new Map();
    
    list.forEach(itinerary => {
      const signature = createRouteSignature(itinerary);
      
      if (!groups.has(signature)) {
        groups.set(signature, {
          mainItinerary: itinerary,
          allDepartures: []
        });
      }
      
      const group = groups.get(signature);
      const depMinutes = parseTimeToMinutes(itinerary.departureTime);
      
      if (depMinutes !== null) {
        group.allDepartures.push({
          departureTime: itinerary.departureTime,
          arrivalTime: itinerary.arrivalTime,
          depMinutes: depMinutes,
          itinerary: itinerary
        });
      }
    });
    
    // Trier les départs de chaque groupe et garder le premier comme principal
    groups.forEach((group) => {
      group.allDepartures.sort((a, b) => a.depMinutes - b.depMinutes);
      if (group.allDepartures.length > 0) {
        group.mainItinerary = group.allDepartures[0].itinerary;
      }
    });
    
    return Array.from(groups.values());
  }

  /**
   * V91: Formate les prochains départs en chips élégants style TBM
   * Utilise les données GTFS locales pour enrichir
   */
  function formatNextDepartures(allDepartures, maxShow = 4) {
    if (allDepartures.length <= 1) return '';
    
    const nextOnes = allDepartures.slice(1, maxShow + 1);
    if (nextOnes.length === 0) return '';
    
    const formatted = nextOnes.map(dep => {
      const diffFromFirst = dep.depMinutes - allDepartures[0].depMinutes;
      if (diffFromFirst <= 0) return null;
      return `<span class="next-departures-time">+${diffFromFirst}min</span>`;
    }).filter(Boolean);
    
    if (formatted.length === 0) return '';
    
    const moreCount = allDepartures.length - 1 - nextOnes.length;
    let html = formatted.join(' ');
    if (moreCount > 0) {
      html += ` <span class="next-departures-more">+${moreCount} autres</span>`;
    }
    
    return html;
  }

  /**
   * V64: Trouve les prochains départs GTFS pour un itinéraire bus
   * @param {Object} itinerary - L'itinéraire principal
   * @returns {Array} Liste des prochains départs avec {departureTime, depMinutes}
   */
  function findGtfsNextDepartures(itinerary) {
    const dataManager = getDataManager ? getDataManager() : null;
    if (!dataManager || !itinerary) return [];
    
    // Trouver le premier segment BUS
    const busStep = (itinerary.steps || []).find(s => s.type === 'BUS');
    if (!busStep) return [];
    
    const routeShortName = busStep.routeShortName || busStep.route?.route_short_name;
    const departureStopName = busStep.departureStop;
    const depTimeStr = itinerary.departureTime;
    
    if (!routeShortName || !departureStopName || !depTimeStr) return [];
    
    // Convertir l'heure de départ en minutes
    const depMinutes = parseTimeToMinutes(depTimeStr);
    if (depMinutes === null) return [];
    
    // Chercher l'arrêt de départ dans GTFS
    const matchingStops = dataManager.findStopsByName(departureStopName, 10);
    if (!matchingStops.length) return [];
    
    const stopIds = matchingStops.map(s => s.stop_id);
    
    // Trouver la route GTFS
    const route = dataManager.routesByShortName[routeShortName];
    if (!route) return [];
    
    // Calculer la fenêtre de temps (prochain 1h30 après le premier départ)
    const windowStart = depMinutes * 60;
    const windowEnd = (depMinutes + 90) * 60;
    
    // Récupérer les départs GTFS pour cet arrêt
    const now = new Date();
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60;
    const serviceIds = dataManager.getServiceIds(now);
    
    if (serviceIds.size === 0) return [];
    
    const departures = [];
    
    for (const stopId of stopIds) {
      const stopTimes = dataManager.stopTimesByStop[stopId] || [];
      
      for (const st of stopTimes) {
        const trip = dataManager.tripsByTripId[st.trip_id];
        if (!trip) continue;
        
        // Vérifier la même ligne
        if (trip.route_id !== route.route_id) continue;
        
        // Vérifier service actif
        const isActive = Array.from(serviceIds).some(sid => 
          dataManager.serviceIdsMatch(trip.service_id, sid)
        );
        if (!isActive) continue;
        
        const depSeconds = dataManager.timeToSeconds(st.departure_time);
        const depMins = Math.floor(depSeconds / 60);
        
        // Dans la fenêtre et après le premier départ affiché
        if (depSeconds >= windowStart && depSeconds <= windowEnd && depMins > depMinutes) {
          departures.push({
            departureTime: dataManager.formatTime(depSeconds),
            depMinutes: depMins,
            tripId: st.trip_id
          });
        }
      }
    }
    
    // Trier et dédupliquer
    departures.sort((a, b) => a.depMinutes - b.depMinutes);
    
    const uniqueDepartures = [];
    const seenMinutes = new Set();
    for (const dep of departures) {
      if (!seenMinutes.has(dep.depMinutes)) {
        seenMinutes.add(dep.depMinutes);
        uniqueDepartures.push(dep);
      }
    }
    
    return uniqueDepartures.slice(0, 5); // Max 5 prochains départs
  }

  /**
   * V60: Vérifie si l'itinéraire a de la marche significative
   */
  function hasSignificantWalk(itinerary) {
    if (!itinerary?.steps) return false;
    
    for (const step of itinerary.steps) {
      if (step.type === 'WALK' || step._isWalk) {
        const durationMatch = (step.duration || '').match(/(\d+)/);
        const durationMin = durationMatch ? parseInt(durationMatch[1], 10) : 0;
        if (durationMin > 2) return true;
        
        const distanceMatch = (step.distance || '').match(/(\d+)/);
        const distanceM = distanceMatch ? parseInt(distanceMatch[1], 10) : 0;
        if (distanceM > 100) return true;
      }
    }
    return false;
  }

  function render(mode) {
    if (!resultsListContainer) return;
    const allFetched = getAllItineraries();
    const { lastSearchMode, arrivalRankedAll, arrivalRenderedCount, pageSize } = getArrivalState();
    const isArrival = lastSearchMode === 'arriver';

    resultsListContainer.innerHTML = '';
    
    // V142: Utiliser TOUTE la liste, pas de pagination
    let list;
    if (isArrival) {
      // Mode ARRIVER: utiliser arrivalRankedAll complet (déjà trié par arrivée décroissante)
      list = (mode === 'ALL') ? [...arrivalRankedAll] : arrivalRankedAll.filter(i => i.type === mode);
    } else {
      // Mode PARTIR: allFetched est déjà trié par départ croissant
      list = (mode === 'ALL') ? [...allFetched] : allFetched.filter(i => i.type === mode);
    }

    if (!list.length) {
      resultsListContainer.innerHTML = `<p class="results-message">Aucun itinéraire n'a été trouvé.</p>`;
      return;
    }

    // V142: FORCER l'ordre BUS → BIKE → WALK toujours
    // Mais PRÉSERVER l'ordre de tri au sein de chaque catégorie
    const busItins = list.filter(i => getItineraryType(i) === 'BUS');
    const bikeItins = list.filter(i => getItineraryType(i) === 'BIKE');
    const walkItins = list.filter(i => getItineraryType(i) === 'WALK');
    
    // Recomposer la liste ordonnée: BUS en premier, puis les autres
    const orderedList = [...busItins, ...bikeItins, ...walkItins];
    
    // Grouper par structure de trajet (mêmes lignes/arrêts, horaires différents)
    const groupedList = groupItinerariesByRoute(orderedList);
    
    // V142: Re-séparer les groupes pour garder l'ordre BUS → BIKE → WALK
    const busGroups = [];
    const bikeGroups = [];
    const walkGroups = [];
    
    groupedList.forEach(group => {
      const type = getItineraryType(group.mainItinerary);
      if (type === 'BUS') busGroups.push(group);
      else if (type === 'BIKE') bikeGroups.push(group);
      else if (type === 'WALK') walkGroups.push(group);
    });
    
    // V142: Trier les groupes bus par heure de départ/arrivée du mainItinerary
    if (isArrival) {
      // Tri arrivée décroissante (plus tard → plus tôt)
      busGroups.sort((a, b) => {
        const arrA = parseTimeToMinutes(a.mainItinerary.arrivalTime);
        const arrB = parseTimeToMinutes(b.mainItinerary.arrivalTime);
        return arrB - arrA;
      });
    } else {
      // Tri départ croissant (plus tôt → plus tard)
      busGroups.sort((a, b) => {
        const depA = parseTimeToMinutes(a.mainItinerary.departureTime);
        const depB = parseTimeToMinutes(b.mainItinerary.departureTime);
        return depA - depB;
      });
    }

    let hasBusTitle = false, hasBikeTitle = false, hasWalkTitle = false;
    let globalIndex = 0;

    // Fonction pour rendre un groupe
    const renderGroup = (group, forceTitle = '') => {
      const itinerary = group.mainItinerary;
      const type = getItineraryType(itinerary);
      
      const wrapper = document.createElement('div');
      wrapper.className = 'route-option-wrapper';

      let title = forceTitle;
      if (mode === 'ALL' && !isArrival) {
        if (globalIndex === 0 && !forceTitle) {
          title = 'Suggéré';
          if (type === 'BUS') hasBusTitle = true;
          if (type === 'BIKE') hasBikeTitle = true;
          if (type === 'WALK') hasWalkTitle = true;
        }
        if (!forceTitle) {
          if (type === 'BUS' && !hasBusTitle) { title = 'Itinéraires Bus'; hasBusTitle = true; }
          else if (type === 'BIKE' && !hasBikeTitle) { title = 'Itinéraires Vélo'; hasBikeTitle = true; }
          else if (type === 'WALK' && !hasWalkTitle) { title = 'Itinéraires Piéton'; hasWalkTitle = true; }
        }
      }
      if (title) wrapper.innerHTML += `<p class='route-option-title'>${title}</p>`;

      const card = document.createElement('div');
      card.className = 'route-option';

      let summaryHtml = '';
      if (type === 'BIKE') {
        summaryHtml = `<div class='route-summary-bus-icon route-summary-bike-icon'>${ICONS.BICYCLE}</div><span class='route-type-label'>Trajet à vélo</span><span class='route-type-distance'>${itinerary.steps[0]?.distance || ''}</span>`;
      } else if (type === 'WALK') {
        summaryHtml = `<div class='route-summary-bus-icon route-summary-walk-only-icon'>${ICONS.WALK}</div><span class='route-type-label'>Trajet à pied</span><span class='route-type-distance'>${itinerary.steps[0]?.distance || ''}</span>`;
      } else {
        // V94: Style IDFM - Points entre les étapes, pas de marche au début dans l'aperçu
        const segments = itinerary.summarySegments || [];
        const hasWalkAtEnd = hasSignificantWalk(itinerary);
        
        // Construire le résumé style IDFM : Ligne • Ligne • (marche)
        segments.forEach((seg, i) => {
          const label = seg.name || 'Route';
          summaryHtml += `<div class='route-line-badge' style='background-color:${seg.color};color:${seg.textColor};'>${label}</div>`;
          
          // Ajouter un point séparateur entre les lignes (pas après la dernière)
          if (i < segments.length - 1) {
            summaryHtml += `<span class='route-summary-dot'>•</span>`;
          }
        });
        
        // Si marche significative à la fin, ajouter l'icône marche après les lignes
        if (hasWalkAtEnd) {
          summaryHtml += `<span class='route-summary-dot'>•</span>`;
          summaryHtml += `<div class='route-summary-walk-icon'>${ICONS.WALK}</div>`;
        }
      }

      const ecoHtml = (globalIndex === 0 && mode === 'ALL' && type === 'BUS')
        ? `<span class='route-duration-eco'>${ICONS.LEAF_ICON} ${itinerary.duration}</span>`
        : `<span>${itinerary.duration}</span>`;

      const timeHtml = (itinerary.departureTime === '~')
        ? `<span class='route-time' style='color:var(--text-secondary);font-weight:500;'>(Trajet)</span>`
        : `<span class='route-time'>${itinerary.departureTime} &gt; ${itinerary.arrivalTime}</span>`;

      // V64: Enrichir avec les prochains départs GTFS si c'est un bus
      let nextDeparturesLine = '';
      const dataManager = getDataManager ? getDataManager() : null;
      if (type === 'BUS' && dataManager) {
        // D'abord essayer les départs groupés depuis Google
        let allDepartures = group.allDepartures || [];
        
        // Si pas assez de départs depuis Google, enrichir avec GTFS
        if (allDepartures.length <= 1) {
          const gtfsDepartures = findGtfsNextDepartures(itinerary);
          if (gtfsDepartures.length > 0) {
            // Ajouter le premier départ (celui de l'itinéraire)
            const firstDepMinutes = parseTimeToMinutes(itinerary.departureTime);
            allDepartures = [
              { departureTime: itinerary.departureTime, depMinutes: firstDepMinutes },
              ...gtfsDepartures
            ];
          }
        }
        
        const nextDeparturesHtml = formatNextDepartures(allDepartures);
        if (nextDeparturesHtml) {
          nextDeparturesLine = `<div class='route-next-departures'><span class='next-departures-label'>Aussi à :</span> ${nextDeparturesHtml}</div>`;
        }
      }

      card.innerHTML = `
        <div class='route-summary-line'>${summaryHtml}</div>
        <div class='route-footer'>${timeHtml}<span class='route-duration'>${ecoHtml}</span></div>
        ${nextDeparturesLine}
      `;

      card.addEventListener('click', () => deps.onSelectItinerary(itinerary, card));

      wrapper.appendChild(card);
      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'route-details hidden';
      wrapper.appendChild(detailsDiv);
      resultsListContainer.appendChild(wrapper);
      
      globalIndex++;
    };

    // Bus en premier, puis vélo, puis marche (y compris en mode arrivée)
    const orderedGroups = [...busGroups, ...bikeGroups, ...walkGroups];

    // V143: Afficher les groupes dans l'ordre BUS → BIKE → WALK
    if (busGroups.length > 0) {
      busGroups.forEach(g => renderGroup(g));
    }
    bikeGroups.forEach(g => renderGroup(g));
    walkGroups.forEach(g => renderGroup(g));

    // V143: Message informatif si peu de bus affichés (mais pas alarmiste)
    // L'API Google ne renvoie que quelques alternatives proches de l'heure demandée
    if (busGroups.length > 0 && busGroups.length < 3) {
      const info = document.createElement('div');
      info.className = 'results-message notice';
      info.innerHTML = `<small>💡 Consultez les <a href="#" onclick="event.preventDefault(); document.querySelector('[data-view=\\'horaires\\']')?.click();">fiches horaires</a> pour voir tous les départs.</small>`;
      resultsListContainer.appendChild(info);
    }
  }

  return { render };
}
