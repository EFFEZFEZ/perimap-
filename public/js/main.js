/*
 * Copyright (c) 2025 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * main.js - V222 (Intégration EventBus + StateManager + Logger)
 *
 * Refactorisation avec architecture event-driven pour éliminer dépendances circulaires
 * Nouvelle couche d'abstraction avec EventBus pub/sub
 * Gestion d'état centralisée avec StateManager
 * Logging unifié avec Logger
 */

// === PHASE 1: Système de communication central ===
import { EventBus, eventBus, EVENTS } from './EventBus.js';
import { StateManager, stateManager } from './StateManager.js';
import { Logger, logger } from './Logger.js';

// === Imports des managers ===
import { DataManager } from './dataManager.js';
import { TimeManager } from './timeManager.js';
import { TripScheduler } from './tripScheduler.js';
import { BusPositionCalculator } from './busPositionCalculator.js';
import { delayManager } from './delayManager.js';
import { DataExporter, DataExporterUI } from './dataExporter.js';
import { MapRenderer } from './mapRenderer.js';
import { ApiManager } from './apiManager.js';
import { createRouterContext, encodePolyline, decodePolyline } from './router.js';
import { RouterWorkerClient } from './routerWorkerClient.js';
import { UIManager } from './uiManager.js';
import { createGeolocationManager } from './geolocationManager.js';
import { loadBaseLayout } from './viewLoader.js';
import { realtimeManager } from './realtimeManager.js';
import { analyticsManager } from './analyticsManager.js';
import { userPreferences } from './userPreferences.js';
import { addRecentJourney, initRecentJourneys } from './recentJourneys.js';

// === PHASE 2: Modular API Services ===
import { initializeAPIServices, getAPIServiceFactory } from './services/index.js';

// === Imports des modules extraits (V221) ===
import { 
    isWaitStep,
    getEncodedPolylineValue,
    getPolylineLatLngs,
    extractStepPolylines,
    STOP_ROLE_PRIORITY as IMPORTED_STOP_ROLE_PRIORITY
} from './map/routeDrawing.js';

// === Imports des modules refactorisés ===
import { 
    isMeaningfulTime, 
    isMissingTextValue,
    getSafeStopLabel, 
    getSafeTimeLabel, 
    getSafeRouteBadgeLabel,
    hasStopMetadata,
    parseTimeStringToMinutes,
    formatMinutesToTimeString,
    addSecondsToTimeString,
    subtractSecondsFromTimeString,
    computeTimeDifferenceMinutes,
    formatGoogleTime,
    formatGoogleDuration,
    parseGoogleDuration
} from './utils/formatters.js';

// === Mock Routes pour testing ===
import { setupConsoleHelpers } from './mocks/mockRoutes.js';
import { setupSimpleConsoleHelpers } from './mocks/simpleMockRoutes.js';

import { getCategoryForRoute, LINE_CATEGORIES, PDF_FILENAME_MAP, ROUTE_LONG_NAME_MAP } from './config/routes.js';
import { ICONS, getManeuverIcon, getAlertBannerIcon } from './config/icons.js';
import { updateNewsBanner, renderInfoTraficCard as renderInfoTraficCardFromModule } from './ui/trafficInfo.js';

// Modules
let dataManager;
let timeManager;
let tripScheduler;
let busPositionCalculator;
let mapRenderer; // Carte temps réel
let detailMapRenderer; // Carte détail mobile
let resultsMapRenderer; // Carte résultats PC
let visibleRoutes = new Set();
let apiManager; 
let routerContext = null;
let routerWorkerClient = null;
let uiManager = null;
let resultsRenderer = null; // instance du renderer des résultats

// Feature flags
let gtfsAvailable = true; // set to false if GTFS loading fails -> degraded API-only mode

// ⚠️ V60: GTFS Router désactivé temporairement (performances insuffisantes)
// TODO: Améliorer l'algorithme de pathfinding avant de réactiver
const ENABLE_GTFS_ROUTER = true; // V189: ACTIVÉ pour avoir TOUS les horaires (comme SNCF Connect)

// État global
let lineStatuses = {}; 
let currentDetailRouteLayer = null; // Tracé sur la carte détail mobile
let currentResultsRouteLayer = null; // Tracé sur la carte PC
let currentDetailMarkerLayer = null; // ✅ NOUVEAU V46.1
let currentResultsMarkerLayer = null; // ✅ NOUVEAU V46.1
let allFetchedItineraries = []; // Stocke tous les itinéraires (bus/vélo/marche)
// Pagination / tri spécifique mode "arriver"
let lastSearchMode = null; // 'partir' | 'arriver'
let arrivalRankedAll = []; // Liste complète triée (arriver)
let arrivalRenderedCount = 0; // Combien affichés actuellement
let ARRIVAL_PAGE_SIZE = 6; // V120: Augmenté à 6 pour afficher plus d'options

// V60: État pour charger plus de départs
let lastSearchTime = null; // Dernier searchTime utilisé
let loadMoreOffset = 0; // Décalage en minutes pour charger plus

let geolocationManager = null;

const BOTTOM_SHEET_LEVELS = [0.2, 0.5, 0.8]; // V266: 3 niveaux: peek (20%), mid (50%), expanded (80%)
import { getAppConfig } from './config.js';
import { deduplicateItineraries, rankArrivalItineraries, rankDepartureItineraries, filterExpiredDepartures, filterLateArrivals, limitBikeWalkItineraries, countBusItineraries, getMinBusItineraries } from './itinerary/ranking.js';
import { normalizeStopNameForLookup, resolveStopCoordinates } from './utils/geo.js';
import { createResultsRenderer } from './ui/resultsRenderer.js';
const BOTTOM_SHEET_DEFAULT_INDEX = 0;
const BOTTOM_SHEET_DRAG_ZONE_PX = 300;
const APP_CONFIG = getAppConfig();
const GOOGLE_API_KEY = APP_CONFIG.googleApiKey; // dynamique (config.js), jamais hardcodé ici
ARRIVAL_PAGE_SIZE = APP_CONFIG.arrivalPageSize || ARRIVAL_PAGE_SIZE; // surcharge si fourni
const BOTTOM_SHEET_SCROLL_UNLOCK_THRESHOLD = 64; // px tolerance before locking drag
const BOTTOM_SHEET_EXPANDED_LEVEL_INDEX = 2; // V266: Index du niveau expanded (80%) = index 2
const BOTTOM_SHEET_VELOCITY_THRESHOLD = 0.35; // px per ms
const BOTTOM_SHEET_MIN_DRAG_DISTANCE_PX = 45; // px delta before forcing next snap
const BOTTOM_SHEET_DRAG_BUFFER_PX = 56; // Zone au-dessus du sheet où on peut commencer le drag
let currentBottomSheetLevelIndex = BOTTOM_SHEET_DEFAULT_INDEX;
let bottomSheetDragState = null;
let bottomSheetControlsInitialized = false;

const isSheetAtMinLevel = () => currentBottomSheetLevelIndex === 0;
const isSheetAtMaxLevel = () => currentBottomSheetLevelIndex === BOTTOM_SHEET_LEVELS.length - 1;

// ICONS, ALERT_BANNER_ICONS, getManeuverIcon et getAlertBannerIcon sont importés depuis config/icons.js

// normalizeStopNameForLookup & resolveStopCoordinates importés depuis utils/geo.js

// V221: STOP_ROLE_PRIORITY importé depuis map/routeDrawing.js
const STOP_ROLE_PRIORITY = IMPORTED_STOP_ROLE_PRIORITY;

function createStopDivIcon(role) {
    if (typeof L === 'undefined' || !L.divIcon) return null;
    const sizeMap = {
        boarding: 22,
        alighting: 22,
        transfer: 16,
        intermediate: 12
    };
    const size = sizeMap[role] || 12;
    return L.divIcon({
        className: `itinerary-stop-marker ${role}`,
        html: '<span></span>',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
}

// ALERT_BANNER_ICONS et getAlertBannerIcon sont importés depuis config/icons.js

// isMissingTextValue, getSafeStopLabel, getSafeTimeLabel, getSafeRouteBadgeLabel, hasStopMetadata sont importées depuis utils/formatters.js

const shouldSuppressBusStep = (step) => {
    if (!step || step.type !== 'BUS') return false;
    const hasRoute = !isMissingTextValue(step.routeShortName);
    const hasBoardingInfo = hasStopMetadata(step.departureStop, step.departureTime);
    const hasAlightingInfo = hasStopMetadata(step.arrivalStop, step.arrivalTime);
    if (hasBoardingInfo || hasAlightingInfo) {
        return false;
    }
    if (!hasRoute) return true;
    const lacksIntermediateStops = !Array.isArray(step.intermediateStops) || step.intermediateStops.length === 0;
    return lacksIntermediateStops;
};

// computeTimeDifferenceMinutes est maintenant importée depuis utils/formatters.js

function getWaitStepPresentation(steps, index) {
    const step = steps?.[index] || {};
    const previousStep = index > 0 ? steps[index - 1] : null;
    const nextStep = index < steps.length - 1 ? steps[index + 1] : null;

    const fallbackTime = previousStep?.arrivalTime || step.time || step.arrivalTime || step.departureTime || nextStep?.departureTime;
    const diffFromNeighbors = computeTimeDifferenceMinutes(previousStep?.arrivalTime, nextStep?.departureTime);

    let waitMinutes = diffFromNeighbors;
    if (waitMinutes === null && typeof step._durationSeconds === 'number') {
        waitMinutes = Math.max(0, Math.round(step._durationSeconds / 60));
    }
    if (waitMinutes === null && typeof step.duration === 'string') {
        const match = step.duration.match(/(\d+)/);
        if (match) waitMinutes = parseInt(match[1], 10);
    }
    if (waitMinutes !== null && waitMinutes <= 0 && typeof step._durationSeconds === 'number' && step._durationSeconds > 0) {
        waitMinutes = 1;
    }

    const durationLabel = (waitMinutes !== null)
        ? `${waitMinutes} min`
        : (step.duration || 'Attente en cours');

    return {
        timeLabel: getSafeTimeLabel(fallbackTime),
        durationLabel
    };
}

/**
 * Fonction appelée lors du clic sur une carte d'itinéraire.
 * Affiche/masque les détails de l'itinéraire et met à jour la carte.
 * V59: Gère le cas mobile (vue overlay) vs desktop (accordéon inline)
 */
function onSelectItinerary(itinerary, cardEl) {
    if (!itinerary || !cardEl) return;

    logger.debug('Itinerary selected', { 
        departure: itinerary.departureTime, 
        arrival: itinerary.arrivalTime 
    });
    
    // PHASE 1: Emit map:route-selected event
    eventBus.emit('map:route-selected', { itinerary, source: 'results' });
    
    stateManager.setState({
        map: { selectedRoute: itinerary }
    }, 'map:route-selected');

    // Rafraîchir le cache "Vos trajets" avec l'itinéraire réellement sélectionné
    try {
        const fromName = document.getElementById('results-planner-from')?.value || document.getElementById('hall-planner-from')?.value;
        const toName = document.getElementById('results-planner-to')?.value || document.getElementById('hall-planner-to')?.value;
        if (fromName && toName) {
            const depLabel = itinerary.departureTime || (lastSearchTime ? `${lastSearchTime.hour}:${String(lastSearchTime.minute).padStart(2, '0')}` : 'Maintenant');
            addRecentJourney(fromName, toName, depLabel, itinerary, allFetchedItineraries, lastSearchTime);
        }
    } catch (err) {
        logger.warn('Recent journey refresh failed after selection', err);
    }

    // V59: Sur mobile, on affiche la vue détail overlay
    if (isMobileDetailViewport()) {
        // Marquer cette carte comme active visuellement
        document.querySelectorAll('.route-option').forEach(c => c.classList.remove('is-active'));
        cardEl.classList.add('is-active');
        
        // Rendre le détail dans la vue mobile et afficher l'overlay
        const routeLayer = renderItineraryDetail(itinerary);
        showDetailView(routeLayer);
        
        logger.debug('Showing itinerary detail view (mobile)');
        return;
    }

    // Desktop: comportement accordéon existant
    const wrapper = cardEl.closest('.route-option-wrapper');
    if (!wrapper) return;

    const detailsDiv = wrapper.querySelector('.route-details');
    if (!detailsDiv) return;

    const wasExpanded = !detailsDiv.classList.contains('hidden');

    // Fermer tous les autres détails ouverts
    document.querySelectorAll('.route-option-wrapper .route-details').forEach(d => {
        if (d !== detailsDiv) d.classList.add('hidden');
    });
    document.querySelectorAll('.route-option-wrapper .route-option').forEach(c => {
        if (c !== cardEl) c.classList.remove('is-active');
    });

    // Toggle l'état de cette carte
    if (wasExpanded) {
        detailsDiv.classList.add('hidden');
        cardEl.classList.remove('is-active');
        logger.debug('Itinerary details collapsed');
    } else {
        // Générer le HTML des détails si pas encore fait
        if (!detailsDiv.innerHTML.trim()) {
            detailsDiv.innerHTML = renderItineraryDetailHTML(itinerary);
        }
        detailsDiv.classList.remove('hidden');
        cardEl.classList.add('is-active');
        
        logger.debug('Itinerary details expanded (desktop)');

        // V117: Mettre à jour la carte avec l'itinéraire sélectionné
        if (resultsMapRenderer && resultsMapRenderer.map) {
            resultsMapRenderer.map.invalidateSize();
            setTimeout(() => drawRouteOnResultsMap(itinerary), 50);
        }

        // Scroll vers la carte
        setTimeout(() => {
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
}

uiManager = new UIManager({ icons: ICONS, geolocationManager: null });

/* ======================
 * UI Theme (Dark Mode)
 * - Persists user choice in localStorage ('ui-theme')
 * - Respects prefers-color-scheme when no saved choice
 * - Toggle button in header with id `theme-toggle-btn`
 * ======================
 */
function applyThemeState(useDarkParam) {
    if (!uiManager) return;
    uiManager.applyThemeState(useDarkParam, [mapRenderer, detailMapRenderer, resultsMapRenderer]);
}

function initTheme() {
    if (!uiManager) return;
    uiManager.initTheme([mapRenderer, detailMapRenderer, resultsMapRenderer]);
}

function wireThemeToggles() {
    const themeToggles = Array.from(document.querySelectorAll('[data-theme-toggle]'));
    themeToggles.forEach(btn => {
        btn.addEventListener('click', () => {
            const currentSaved = localStorage.getItem('ui-theme');
            const currentIsDark = document.body.classList.contains('dark-theme');
            
            // Cycle: light → dark → auto → light
            let nextMode;
            if (currentSaved === 'light') {
                nextMode = 'dark';
            } else if (currentSaved === 'dark') {
                nextMode = 'auto';
            } else {
                // auto ou null → light
                nextMode = 'light';
            }
            
            let nextIsDark;
            if (nextMode === 'auto') {
                nextIsDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
            } else {
                nextIsDark = (nextMode === 'dark');
            }
            
            applyThemeState(nextIsDark);
            try { 
                localStorage.setItem('ui-theme', nextMode);
                // Afficher un toast pour indiquer le mode actuel
                const modeLabel = nextMode === 'auto' ? 'automatique 🌓' : (nextMode === 'dark' ? 'sombre 🌙' : 'clair ☀️');
                console.log(`🎨 Thème: ${modeLabel}`);
            } catch (e) { /* ignore */ }
        }, { passive: true });
    });
}

async function hydrateHallExpressChips() {
    const container = document.querySelector('.hall-express-chips');
    if (!container) return;

    const defaultLines = ['E1', 'E2', 'K5', 'K6', 'N', 'N1', 'R1', 'R12'];
    const normalizeLine = (value) => String(value || '').trim().toUpperCase();
    const lineToSlug = (line) => normalizeLine(line).toLowerCase();

    // Vérifier si l'utilisateur a des préférences personnalisées
    let lines = defaultLines;
    let isPersonalized = false;
    
    if (userPreferences.hasPersonalizedData()) {
        const popularLines = userPreferences.getPopularLines(8);
        if (popularLines.length >= 3) {
            lines = popularLines;
            isPersonalized = true;
        }
    }

    // Fallback: charger les lignes par défaut si pas de personnalisation
    if (!isPersonalized) {
        try {
            const res = await fetch('/data/express-lines.json', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    const parsed = data.map(normalizeLine).filter(Boolean);
                    if (parsed.length) lines = parsed;
                }
            }
        } catch (e) { /* ignore */ }
    }

    const frag = document.createDocumentFragment();
    lines.forEach((line) => {
        const a = document.createElement('a');
        a.className = 'express-chip';
        if (isPersonalized) a.classList.add('personalized');
        a.href = `/horaires-ligne-${lineToSlug(line)}.html`;
        a.textContent = line;
        a.setAttribute('aria-label', `Horaires ligne ${line}`);
        
        // Tracker le clic pour améliorer les recommandations
        a.addEventListener('click', () => {
            userPreferences.trackLineClick(line);
        }, { passive: true });
        
        frag.appendChild(a);
    });

    container.innerHTML = '';
    container.appendChild(frag);
    
    // Ajouter un indicateur si personnalisé
    if (isPersonalized) {
        container.setAttribute('data-personalized', 'true');
        container.setAttribute('title', 'Lignes basées sur votre historique');
    }
}

// Service Worker est enregistré dans app.js

// PDF_FILENAME_MAP et ROUTE_LONG_NAME_MAP sont maintenant importées depuis config/routes.js
// getManeuverIcon est maintenant importée depuis config/icons.js

// ÉLÉMENTS DOM
let dashboardContainer, dashboardHall, dashboardContentView, btnBackToHall;
let infoTraficList, infoTraficAvenir, infoTraficCount;
let alertBanner, alertBannerContent, alertBannerClose;
let ficheHoraireContainer;
let searchBar, searchResultsContainer;
let mapContainer, btnShowMap, btnBackToDashboardFromMap;
let itineraryResultsContainer, btnBackToDashboardFromResults, resultsListContainer;
let resultsMap, resultsModeTabs;
let resultsFromInput, resultsToInput, resultsFromSuggestions, resultsToSuggestions;
let resultsSwapBtn, resultsWhenBtn, resultsPopover, resultsDate, resultsHour, resultsMinute;
let resultsPopoverSubmitBtn, resultsPlannerSubmitBtn, resultsGeolocateBtn;
let itineraryDetailBackdrop, itineraryDetailContainer, btnBackToResults, detailMapHeader, detailMapSummary, detailBottomSheet;
let detailPanelWrapper, detailPanelContent;
let hallPlannerSubmitBtn, hallFromInput, hallToInput, hallFromSuggestions, hallToSuggestions;
let hallWhenBtn, hallPopover, hallDate, hallHour, hallMinute, hallPopoverSubmitBtn, hallSwapBtn, hallGeolocateBtn;
let installTipContainer, installTipCloseBtn;
let bottomNav;

let fromPlaceId = null;
let toPlaceId = null;

// LINE_CATEGORIES est maintenant importée depuis config/routes.js

const DETAIL_SHEET_TRANSITION_MS = 380; // Doit être >= à la transition CSS (350ms + marge)

// UI transitions (short & functional)
const SCREEN_TRANSITION_MS = 180;

let __pmScreenSwapToken = 0;
let __pmScreenSwapTimeoutId = null;
let __pmIsScreenSwapping = false;
let __pmPendingNavAction = null;

// Realtime auto-refresh sleep (économie API quand aucun bus)
let __pmRealtimeSleepUntilMs = 0;
let __pmRealtimeSleepTimerId = null;
let __pmRealtimeSleepLastCheckMs = 0;
const __PM_REALTIME_SLEEP_MIN_GAP_MS = 45 * 60 * 1000; // 45 min sans bus -> sleep
const __PM_REALTIME_SLEEP_WAKE_WARMUP_MS = 2 * 60 * 1000; // réveil 2 min avant le premier départ
const __pmNextDepartureCache = new Map();

function __pmLocalIsoDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function __pmStartOfLocalDay(date) {
    const d = date instanceof Date ? date : new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function __pmAddDaysLocal(date, days) {
    const d = date instanceof Date ? date : new Date(date);
    const out = new Date(d);
    out.setDate(out.getDate() + (days || 0));
    return out;
}

function __pmFindNextDepartureSecondsForDate(dateObj, afterSeconds) {
    if (!dataManager || !dataManager.isLoaded) return null;
    const iso = __pmLocalIsoDate(dateObj);
    const bucket = Math.max(0, Math.floor((Number(afterSeconds) || 0) / 300)); // bucket 5 min
    const cacheKey = `${iso}|${bucket}`;
    if (__pmNextDepartureCache.has(cacheKey)) {
        return __pmNextDepartureCache.get(cacheKey);
    }

    const serviceIdSet = dataManager.getServiceIds(dateObj);
    if (!serviceIdSet || serviceIdSet.size === 0) {
        __pmNextDepartureCache.set(cacheKey, null);
        return null;
    }

    let best = null;
    const after = Number(afterSeconds) || 0;
    for (const trip of (dataManager.trips || [])) {
        if (!trip) continue;

        // service active?
        let isServiceActive = false;
        for (const activeServiceId of serviceIdSet) {
            if (dataManager.serviceIdsMatch(trip.service_id, activeServiceId)) {
                isServiceActive = true;
                break;
            }
        }
        if (!isServiceActive) continue;

        const stopTimes = dataManager.stopTimesByTrip?.[trip.trip_id];
        if (!stopTimes || stopTimes.length === 0) continue;

        const first = dataManager.timeToSeconds(stopTimes[0].departure_time);
        if (!Number.isFinite(first)) continue;
        if (first < after) continue;
        if (best === null || first < best) {
            best = first;
            // Early exit if it's basically now
            if (best <= after + 60) break;
        }
    }

    __pmNextDepartureCache.set(cacheKey, best);
    return best;
}

function __pmComputeNextDepartureTimestampMs(currentDateObj, currentSeconds) {
    const todayNext = __pmFindNextDepartureSecondsForDate(currentDateObj, (Number(currentSeconds) || 0) + 1);
    if (todayNext !== null) {
        return __pmStartOfLocalDay(currentDateObj).getTime() + (todayNext * 1000);
    }

    const tomorrow = __pmAddDaysLocal(currentDateObj, 1);
    const tomorrowFirst = __pmFindNextDepartureSecondsForDate(tomorrow, 0);
    if (tomorrowFirst === null) return null;
    return __pmStartOfLocalDay(tomorrow).getTime() + (tomorrowFirst * 1000);
}

function __pmMaybeSleepRealtimeAutoRefresh(visibleBusCount, currentSeconds, currentDateObj) {
    if (!realtimeManager || !dataManager) return;

    // Wake immediately when service resumes
    if ((visibleBusCount || 0) > 0) {
        if (__pmRealtimeSleepTimerId) {
            clearTimeout(__pmRealtimeSleepTimerId);
            __pmRealtimeSleepTimerId = null;
        }
        if (__pmRealtimeSleepUntilMs) {
            __pmRealtimeSleepUntilMs = 0;
            try { realtimeManager.setSleepUntil?.(0); } catch (_) {}
            try { realtimeManager.startAutoRefresh?.(); } catch (_) {}
        }
        return;
    }

    // Already sleeping? nothing to do
    if (realtimeManager.isSleeping?.()) return;

    // Check at most once per minute to avoid scanning trips too often
    const nowMs = Date.now();
    if (nowMs - __pmRealtimeSleepLastCheckMs < 60 * 1000) return;
    __pmRealtimeSleepLastCheckMs = nowMs;

    const nextDepartureMs = __pmComputeNextDepartureTimestampMs(currentDateObj, currentSeconds);
    if (!nextDepartureMs) return;

    const gapMs = nextDepartureMs - nowMs;
    if (gapMs < __PM_REALTIME_SLEEP_MIN_GAP_MS) return;

    const sleepUntilMs = Math.max(nowMs + 5000, nextDepartureMs - __PM_REALTIME_SLEEP_WAKE_WARMUP_MS);
    __pmRealtimeSleepUntilMs = sleepUntilMs;
    try { realtimeManager.setSleepUntil?.(sleepUntilMs); } catch (_) {}

    if (__pmRealtimeSleepTimerId) {
        clearTimeout(__pmRealtimeSleepTimerId);
        __pmRealtimeSleepTimerId = null;
    }

    const delayMs = sleepUntilMs - nowMs;
    const safeDelayMs = Math.min(delayMs, 2147483000); // setTimeout max (~24.8 jours)
    __pmRealtimeSleepTimerId = setTimeout(() => {
        __pmRealtimeSleepTimerId = null;
        __pmRealtimeSleepUntilMs = 0;
        try { realtimeManager.setSleepUntil?.(0); } catch (_) {}
        try { realtimeManager.preloadPriorityStops?.(); } catch (_) {}
    }, safeDelayMs);
}

function prefersReducedMotion() {
    try {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
        return false;
    }
}

function getVisibleAppScreen() {
    // Only consider the top-level screens (not detail overlay)
    const candidates = [dashboardContainer, mapContainer, itineraryResultsContainer];
    return candidates.find(el => el && !el.classList.contains('hidden')) || null;
}

function animateScreenSwap(fromEl, toEl) {
    __pmScreenSwapToken += 1;
    const swapToken = __pmScreenSwapToken;
    __pmIsScreenSwapping = true;

    if (__pmScreenSwapTimeoutId) {
        clearTimeout(__pmScreenSwapTimeoutId);
        __pmScreenSwapTimeoutId = null;
    }

    if (!toEl || fromEl === toEl) {
        if (toEl) toEl.classList.remove('hidden');
        __pmIsScreenSwapping = false;
        return;
    }

    // Always reset transient transition classes (prevents "stuck" screens)
    const transitionClasses = [
        'page-transition-enter',
        'page-transition-enter-active',
        'page-transition-exit',
        'page-transition-exit-active'
    ];
    if (fromEl) fromEl.classList.remove(...transitionClasses);
    toEl.classList.remove(...transitionClasses);

    // Reduced motion: instant
    if (prefersReducedMotion()) {
        if (fromEl) fromEl.classList.add('hidden');
        toEl.classList.remove('hidden');
        __pmIsScreenSwapping = false;

        // Replay pending action if any
        if (__pmPendingNavAction) {
            const pending = __pmPendingNavAction;
            __pmPendingNavAction = null;
            setTimeout(() => {
                try { handleNavigationAction(pending); } catch (_) {}
            }, 0);
        }
        return;
    }

    // Ensure target is visible before animating
    toEl.classList.remove('hidden');

    // UX: reset scroll on every top-level screen swap
    try {
        window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (_) {
        window.scrollTo(0, 0);
    }

    // ENTER
    toEl.classList.add('page-transition-enter');
    requestAnimationFrame(() => {
        toEl.classList.add('page-transition-enter-active');
        toEl.classList.remove('page-transition-enter');
    });

    // EXIT
    if (fromEl) {
        fromEl.classList.add('page-transition-exit');
        requestAnimationFrame(() => {
            fromEl.classList.add('page-transition-exit-active');
        });
    }

    __pmScreenSwapTimeoutId = setTimeout(() => {
        if (swapToken !== __pmScreenSwapToken) return;
        toEl.classList.remove('page-transition-enter-active');
        if (fromEl) {
            fromEl.classList.remove('page-transition-exit', 'page-transition-exit-active');
            fromEl.classList.add('hidden');
        }
        __pmScreenSwapTimeoutId = null;
        __pmIsScreenSwapping = false;

        // If user tapped quickly, replay the last requested action after swap
        if (__pmPendingNavAction) {
            const pending = __pmPendingNavAction;
            __pmPendingNavAction = null;
            setTimeout(() => {
                try { handleNavigationAction(pending); } catch (_) {}
            }, 0);
        }
    }, SCREEN_TRANSITION_MS);
}

function setBottomNavActive(action) {
    if (!bottomNav) bottomNav = document.getElementById('bottom-nav');
    if (!bottomNav) return;
    const normalized = (action || '').toLowerCase();
    bottomNav.querySelectorAll('.bottom-nav-item').forEach(btn => {
        const isActive = (btn.dataset.action || '').toLowerCase() === normalized;
        btn.classList.toggle('is-active', isActive);
        if (isActive) {
            btn.setAttribute('aria-current', 'page');
        } else {
            btn.removeAttribute('aria-current');
        }
    });
}

function setupTapFeedback() {
    if (window.__pmTapFeedbackReady) return;
    window.__pmTapFeedbackReady = true;

    const selector = [
        '.btn',
        '.btn-icon-round',
        '.quick-action-card',
        '.nav-dropdown-item',
        '.mobile-menu-item',
        '.bottom-nav-item',
        '.route-option'
    ].join(',');

    document.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary) return;
        const target = event.target instanceof Element ? event.target.closest(selector) : null;
        if (!target) return;
        if (target.matches('input, textarea, select')) return;

        // Press feedback
        target.classList.add('pm-is-pressed');

        // Ripple (skip if explicitly disabled)
        if (target.getAttribute('data-ripple') === 'false') return;
        if (prefersReducedMotion()) return;

        target.classList.add('pm-ripple-host');
        const rect = target.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = (event.clientX - rect.left) - size / 2;
        const y = (event.clientY - rect.top) - size / 2;

        const ripple = document.createElement('span');
        ripple.className = 'pm-ripple';
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        target.appendChild(ripple);

        // Cleanup
        window.setTimeout(() => {
            try { ripple.remove(); } catch (_) {}
        }, 520);
    }, { passive: true, capture: true });

    const clearPressed = (event) => {
        const el = event.target instanceof Element ? event.target.closest(selector) : null;
        if (!el) return;
        el.classList.remove('pm-is-pressed');
    };

    document.addEventListener('pointerup', clearPressed, { passive: true, capture: true });
    document.addEventListener('pointercancel', clearPressed, { passive: true, capture: true });
    document.addEventListener('pointerleave', clearPressed, { passive: true, capture: true });
}

// getCategoryForRoute est maintenant importée depuis config/routes.js

// Initialise toutes les références DOM
function initializeDomElements() {
    dashboardContainer = document.getElementById('dashboard-container');
    dashboardHall = document.getElementById('dashboard-hall');
    dashboardContentView = document.getElementById('dashboard-content-view');
    btnBackToHall = document.getElementById('btn-back-to-hall');
    infoTraficList = document.getElementById('info-trafic-list');
    infoTraficAvenir = document.getElementById('info-trafic-avenir');
    infoTraficCount = document.getElementById('info-trafic-count');
    alertBanner = document.getElementById('alert-banner');
    alertBannerContent = document.getElementById('alert-banner-content');
    alertBannerClose = document.getElementById('alert-banner-close');
    ficheHoraireContainer = document.getElementById('fiche-horaire-container');
    searchBar = document.getElementById('horaires-search-bar');
    searchResultsContainer = document.getElementById('horaires-search-results');
    mapContainer = document.getElementById('map-container');
    btnShowMap = document.getElementById('btn-show-map');
    btnBackToDashboardFromMap = document.getElementById('btn-back-to-dashboard-from-map');
    itineraryResultsContainer = document.getElementById('itinerary-results-container');
    btnBackToDashboardFromResults = document.getElementById('btn-back-to-dashboard-from-results');
    resultsListContainer = document.querySelector('#itinerary-results-container .results-list');
    resultsMap = document.getElementById('results-map'); 
    resultsModeTabs = document.getElementById('results-mode-tabs');
    resultsFromInput = document.getElementById('results-planner-from');
    resultsToInput = document.getElementById('results-planner-to');
    resultsFromSuggestions = document.getElementById('results-from-suggestions');
    resultsToSuggestions = document.getElementById('results-to-suggestions');
    resultsSwapBtn = document.getElementById('results-btn-swap-direction');
    resultsWhenBtn = document.getElementById('results-planner-when-btn');
    resultsPopover = document.getElementById('results-planner-options-popover');
    resultsDate = document.getElementById('results-popover-date');
    resultsHour = document.getElementById('results-popover-hour');
    resultsMinute = document.getElementById('results-popover-minute');
    resultsPopoverSubmitBtn = document.getElementById('results-popover-submit-btn');
    resultsPlannerSubmitBtn = document.getElementById('results-planner-submit-btn');
    resultsGeolocateBtn = document.getElementById('results-geolocate-btn');
    itineraryDetailBackdrop = document.getElementById('itinerary-detail-backdrop');
    itineraryDetailContainer = document.getElementById('itinerary-detail-container');
    detailBottomSheet = document.getElementById('detail-bottom-sheet');
    btnBackToResults = document.getElementById('btn-back-to-results');
    detailMapHeader = document.getElementById('detail-map-header');
    detailMapSummary = document.getElementById('detail-map-summary');
    detailPanelWrapper = document.getElementById('detail-panel-wrapper');
    detailPanelContent = document.getElementById('detail-panel-content');
    hallPlannerSubmitBtn = document.getElementById('planner-submit-btn');
    hallFromInput = document.getElementById('hall-planner-from');
    hallToInput = document.getElementById('hall-planner-to');
    hallFromSuggestions = document.getElementById('from-suggestions');
    hallToSuggestions = document.getElementById('to-suggestions');
    hallSwapBtn = document.getElementById('hall-btn-swap-direction');
    hallWhenBtn = document.getElementById('planner-when-btn');
    hallPopover = document.getElementById('planner-options-popover');
    hallDate = document.getElementById('popover-date');
    hallHour = document.getElementById('popover-hour');
    hallMinute = document.getElementById('popover-minute');
    hallPopoverSubmitBtn = document.getElementById('popover-submit-btn');
    hallGeolocateBtn = document.getElementById('hall-geolocate-btn');
    installTipContainer = document.getElementById('install-tip');
    installTipCloseBtn = document.getElementById('install-tip-close');
    bottomNav = document.getElementById('bottom-nav');
}

// Sécurité: débloque le scroll si aucune vue ou modal ne doit le verrouiller
function unlockBodyScrollIfStuck() {
    try {
        const mobileMenu = document.getElementById('mobile-menu');
        const mobileMenuVisible = mobileMenu && !mobileMenu.classList.contains('hidden');
        const detailOpen = itineraryDetailContainer?.classList?.contains('is-active');
        const blockingModal = document.querySelector('#line-detail-modal.active, #banner-detail-modal.active, #delay-stats-panel.open');
        const activeScreen = typeof getVisibleAppScreen === 'function' ? getVisibleAppScreen() : null;
        const isDashboardVisible = !activeScreen || activeScreen === dashboardContainer;
        // Forcer la sortie des états de verrou si les écrans correspondants sont cachés
        if (mapContainer?.classList?.contains('hidden')) {
            document.body.classList.remove('view-map-locked', 'view-is-locked');
        }
        if (itineraryResultsContainer?.classList?.contains('hidden')) {
            document.body.classList.remove('itinerary-view-active');
        }
        if (itineraryDetailContainer?.classList?.contains('hidden')) {
            document.body.classList.remove('detail-view-open');
        }
        if (!mobileMenuVisible) {
            document.body.classList.remove('mobile-menu-open');
        }
        if (!mobileMenuVisible && !detailOpen && !blockingModal && isDashboardVisible) {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.height = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.width = '';
            document.body.classList.remove('mobile-menu-open', 'install-tip-open');
        }
    } catch (_) {
        // ignore best-effort unlock
    }
}

async function initializeApp() {
    // Initialise les références DOM
    initializeDomElements();
    unlockBodyScrollIfStuck();
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) unlockBodyScrollIfStuck();
    });
    window.addEventListener('wheel', unlockBodyScrollIfStuck, { passive: true });
    window.addEventListener('touchstart', unlockBodyScrollIfStuck, { passive: true });
    // Filets de sécurité périodiques pour corriger un overflow bloqué laissé par un modal
    setInterval(unlockBodyScrollIfStuck, 1200);

    // UX: skeleton sur les fiches horaires pendant le chargement GTFS
    if (ficheHoraireContainer && (!dataManager || !dataManager.isLoaded)) {
        ficheHoraireContainer.innerHTML = `
            <div class="pm-skeleton-stack" aria-hidden="true">
                <div class="pm-skeleton-card">
                    <div class="skeleton" style="height:14px;width:55%;margin-bottom:10px;"></div>
                    <div class="skeleton" style="height:10px;width:85%;margin-bottom:8px;"></div>
                    <div class="skeleton" style="height:10px;width:72%;"></div>
                </div>
                <div class="pm-skeleton-card">
                    <div class="skeleton" style="height:14px;width:48%;margin-bottom:10px;"></div>
                    <div class="skeleton" style="height:10px;width:88%;margin-bottom:8px;"></div>
                    <div class="skeleton" style="height:10px;width:66%;"></div>
                </div>
                <div class="pm-skeleton-card">
                    <div class="skeleton" style="height:14px;width:60%;margin-bottom:10px;"></div>
                    <div class="skeleton" style="height:10px;width:80%;margin-bottom:8px;"></div>
                    <div class="skeleton" style="height:10px;width:70%;"></div>
                </div>
            </div>
        `;
    }

    // Instanciation du renderer (après sélection des éléments DOM)
    resultsRenderer = createResultsRenderer({
        resultsListContainer,
        resultsModeTabs,
        getAllItineraries: () => allFetchedItineraries,
        getArrivalState: () => ({ lastSearchMode, arrivalRankedAll, arrivalRenderedCount, pageSize: ARRIVAL_PAGE_SIZE }),
        setArrivalRenderedCount: (val) => { arrivalRenderedCount = val; },
        onSelectItinerary: (itinerary, cardEl) => onSelectItinerary(itinerary, cardEl),
        onLoadMoreDepartures: () => loadMoreDepartures(), // V60: Charger plus de départs
        onLoadMoreArrivals: () => loadMoreArrivals(), // V132: Charger plus d'arrivées
        getDataManager: () => dataManager, // V64: Accès aux données GTFS pour prochains départs
        getSearchTime: () => lastSearchTime // V212: Expose la date/heure de recherche pour enrichissement GTFS
    });

    apiManager = new ApiManager(GOOGLE_API_KEY);
    
    // === PHASE 2c: Initialize modular API services ===
    logger.info('Initializing Phase 2 API services', { backendMode: APP_CONFIG.backendMode });
    const apiFactory = initializeAPIServices({
        backendMode: APP_CONFIG.backendMode || 'vercel',
        useOtp: APP_CONFIG.useOtp || false,
        apiKey: GOOGLE_API_KEY,
        apiEndpoints: APP_CONFIG.apiEndpoints || {}
    });
    logger.info('API services initialized', { health: apiFactory.getHealth() });
    
    // Setup API service event listeners
    eventBus.on(EVENTS.ROUTE_CALCULATED, ({ mode, result }) => {
        logger.debug('Route calculated via Phase 2 service', { mode, routes: result.itineraries?.length || 0 });
        stateManager.setState({ 
            api: { lastRouteMode: mode, lastRouteTimestamp: Date.now() }
        }, 'route:calculated');
    });
    
    eventBus.on(EVENTS.ROUTE_ERROR, ({ mode, error }) => {
        logger.error('Route service error', { mode, error: error.message });
        stateManager.setState({ 
            api: { routeError: error.message, lastErrorMode: mode }
        }, 'route:error');
    });
    
    dataManager = new DataManager();
    routerContext = createRouterContext({ dataManager, apiManager, icons: ICONS });

    geolocationManager = createGeolocationManager({
        apiManager,
        icons: ICONS,
        onUserLocationUpdate: (coords) => {
            if (mapRenderer) mapRenderer.updateUserLocation(coords);
            if (resultsMapRenderer) resultsMapRenderer.updateUserLocation(coords);
            if (detailMapRenderer) detailMapRenderer.updateUserLocation(coords);
        },
        onUserLocationError: () => {
            if (mapRenderer) mapRenderer.onLocateError();
            if (resultsMapRenderer) resultsMapRenderer.onLocateError();
            if (detailMapRenderer) detailMapRenderer.onLocateError();
        }
    });

    uiManager = new UIManager({ icons: ICONS, geolocationManager });

    setupStaticEventListeners();
    if (geolocationManager) {
        geolocationManager.startWatching({
            hallButton: hallGeolocateBtn,
            resultsButton: resultsGeolocateBtn
        });
    }
    updateDataStatus('Chargement des données...', 'loading');

    try {
        await dataManager.loadAllData((message) => updateDataStatus(message, 'loading'));
        timeManager = new TimeManager();
        
        // Initialiser le realtimeManager avec les stops GTFS pour le mapping hawk
        realtimeManager.init(dataManager.stops);
        
        mapRenderer = new MapRenderer('map', dataManager, timeManager);
        mapRenderer.initializeMap();
        const locateSuccess = geolocationManager?.handleGeolocationSuccess || (() => {});
        const locateError = geolocationManager?.handleGeolocationError || (() => {});
        mapRenderer.addLocateControl(locateSuccess, locateError);

        // Exposer mapRenderer et dataManager globalement pour le système de retards
        window.mapRenderer = mapRenderer;
        window.dataManager = dataManager;
        
        window.addDelayedBusMarker = (delayInfo) => {
            if (mapRenderer && typeof mapRenderer.addDelayedBusMarker === 'function') {
                mapRenderer.addDelayedBusMarker(delayInfo);
            }
        };

        detailMapRenderer = new MapRenderer('detail-map', dataManager, timeManager);
        detailMapRenderer.initializeMap(false);
        currentDetailMarkerLayer = L.layerGroup().addTo(detailMapRenderer.map);
        detailMapRenderer.addLocateControl(locateSuccess, locateError);
        
        resultsMapRenderer = new MapRenderer('results-map', dataManager, timeManager);
        resultsMapRenderer.initializeMap(false);
        currentResultsMarkerLayer = L.layerGroup().addTo(resultsMapRenderer.map);
        resultsMapRenderer.addLocateControl(locateSuccess, locateError);

        // Initialize mock console helpers for testing
        setupConsoleHelpers(eventBus);
        setupSimpleConsoleHelpers(eventBus);

        // Wire theme toggles now that fragments sont chargés, puis applique le thème initial
        wireThemeToggles();
        initTheme();
        
        // V607: Initialiser les trajets récents (afficher ceux sauvegardés)
        initRecentJourneys();

        // Hydrate the "Horaires express" list from config (popular lines)
        try { await hydrateHallExpressChips(); } catch (e) { /* ignore */ }
        
        // Initialiser le delayManager
        delayManager.init(dataManager, realtimeManager);
        
        tripScheduler = new TripScheduler(dataManager, delayManager);
        // V305: Passer realtimeManager pour l'ajustement de position basé sur RT
        busPositionCalculator = new BusPositionCalculator(dataManager, realtimeManager);
        // Précharger aussi les pivots résolus pour les lignes prioritaires (si présents)
        try {
            await realtimeManager.preloadPivotStopsFromCalculator(busPositionCalculator);
        } catch (e) {
            console.warn('[Main] preloadPivotStopsFromCalculator failed', e);
        }
        
        // Exposer les managers pour le data exporter
        window.delayManager = delayManager;
        window.analyticsManager = analyticsManager;
        
        // Initialiser la console d'analytics (Alt+D)
        const dataExporterUI = new DataExporterUI();
        dataExporterUI.init();
        window.dataExporterUI = dataExporterUI;
        window.DataExporter = DataExporter;
        
        // Exposer pour le mock système (testing)
        window.allFetchedItineraries = allFetchedItineraries;
        window.resultsRenderer = resultsRenderer;
        window.showResultsView = showResultsView;
        window.setupResultTabs = setupResultTabs;
        
        initializeRouteFilter();

        // ⚠️ V60: Router GTFS désactivé temporairement pour performances
        // TODO: Réactiver quand l'algorithme sera optimisé
        if (ENABLE_GTFS_ROUTER) {
            try {
                const geocodeProxyUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/geocode` : '/api/geocode';
                routerWorkerClient = new RouterWorkerClient({
                    dataManager,
                    icons: ICONS,
                    googleApiKey: GOOGLE_API_KEY,
                    geocodeProxyUrl
                });
                console.log('🔧 Router GTFS local activé');
            } catch (error) {
                console.warn('Router worker indisponible, fallback main thread.', error);
                routerWorkerClient = null;
            }
        } else {
            console.log('⏸️ Router GTFS local désactivé (ENABLE_GTFS_ROUTER=false)');
            routerWorkerClient = null;
            routerContext = null;
        }

        try {
            await dataManager.optimizeStopTimesStorage();
        } catch (error) {
            console.warn('Impossible d’optimiser le stockage des stop_times:', error);
        }
        
        // Afficher les tracés des lignes
        let geoJsonData = dataManager.geoJson;
        if (!geoJsonData && dataManager.hasShapeData()) {
            console.log('🔄 map.geojson absent, génération à partir des shapes GTFS...');
            geoJsonData = dataManager.generateGeoJsonFromShapes();
            dataManager.geoJson = geoJsonData; // Mémoriser pour utilisation ultérieure
        }
        if (geoJsonData) {
            mapRenderer.displayMultiColorRoutes(geoJsonData, dataManager, visibleRoutes);
        } else {
            console.warn('⚠️ Aucun tracé disponible (ni map.geojson ni shapes.txt)');
        }

        mapRenderer.displayStops();
        setupDashboardContent(); 
        setupDataDependentEventListeners();

        if (localStorage.getItem('gtfsInstructionsShown') !== 'true') {
            document.getElementById('instructions').classList.add('hidden');
        }
        
        updateDataStatus('Données chargées', 'loaded');
        checkAndSetupTimeMode();
        updateData(); 
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation GTFS:', error);
        gtfsAvailable = false;
        updateDataStatus('GTFS indisponible. Mode dégradé (API seule).', 'warning');
    }

    // Attach robust handlers for back buttons and condensed nav (extra safety)
    try {
        attachRobustBackHandlers();
    } catch (e) { console.debug('attachRobustBackHandlers failed', e); }
}

function attachRobustBackHandlers() {
    const backIds = ['btn-back-to-hall', 'btn-back-to-dashboard-from-map', 'btn-back-to-dashboard-from-results'];
    backIds.forEach(id => {
        // fix duplicate ids: if multiple elements share the same id, rename extras
        const duplicates = Array.from(document.querySelectorAll(`#${id}`));
        if (duplicates.length > 1) {
            console.warn('attachRobustBackHandlers: duplicate id detected', id, duplicates.length);
            duplicates.forEach((el, idx) => {
                if (idx === 0) return; // keep first
                const newId = `${id}-dup-${idx}`;
                el.id = newId;
                console.warn('attachRobustBackHandlers: renamed duplicate id', id, '->', newId, el);
            });
        }

        const el = document.getElementById(id);
        if (!el) {
            console.debug('attachRobustBackHandlers: missing element', id);
            return;
        }
        // remove duplicate handlers if any
        try { el.removeEventListener('click', showDashboardHall); } catch (e) {}
        el.disabled = false;
        el.style.pointerEvents = 'auto';
        el.style.zIndex = el.style.zIndex || 2000;
        el.addEventListener('click', (ev) => {
            ev.preventDefault();
            console.debug('robust-back-click:', id);
            showDashboardHall();
        });
    });

    // Ensure service cards are clickable (new IDFM-style design)
    document.querySelectorAll('.service-card[data-view]').forEach(btn => {
        btn.style.pointerEvents = 'auto';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const view = btn.dataset.view;
            console.debug('robust-nav-click', view);
            if (view) showDashboardView(view);
        });
    });

    // Temporary pointer diagnostics to help debug covered/blocked buttons.
    // Active for 25 seconds after initialization; logs element at pointer location.
    try {
        const DEBUG_DURATION_MS = 25000;
        const start = Date.now();
        const pd = (ev) => {
            try {
                if ((Date.now() - start) > DEBUG_DURATION_MS) {
                    document.removeEventListener('pointerdown', pd, true);
                    return;
                }
                const x = ev.clientX, y = ev.clientY;
                const elAt = document.elementFromPoint(x, y);
                console.debug('pointerdown-debug', { x, y, target: ev.target && ev.target.id, elementAtPoint: elAt && (elAt.id || elAt.className || elAt.tagName) });
            } catch (err) { /* ignore */ }
        };
        document.addEventListener('pointerdown', pd, true);
        console.info('Back-button pointer diagnostics active for 25s. Click the problematic area and check console for `pointerdown-debug`.');
    } catch (e) { /* ignore */ }
}

function setupDashboardContent() {
    // Initialiser tous les statuts à "normal" par défaut
    dataManager.routes.forEach(route => {
        lineStatuses[route.route_id] = { status: 'normal', message: '' };
    });
    
    // Charger les statuts depuis le fichier JSON de configuration
    loadLineStatuses().then(() => {
        renderInfoTraficCard();
        renderAlertBanner();
        updateNewsBanner(dataManager, lineStatuses); // V114: Mise à jour du bandeau défilant
    });
    
    buildFicheHoraireList();
}

/**
 * V82: Charge les statuts des lignes depuis /data/line-status.json
 * Ce fichier peut être modifié facilement pour mettre à jour l'état des lignes
 */
async function loadLineStatuses() {
    try {
        const response = await fetch('/data/line-status.json?t=' + Date.now()); // Cache-bust
        if (!response.ok) {
            console.warn('[LineStatus] Fichier line-status.json non trouvé, utilisation des statuts par défaut');
            return;
        }
        
        const data = await response.json();
        console.log('[LineStatus] Chargement des statuts:', data.lastUpdate);
        
        // Mapper les statuts du JSON vers lineStatuses
        if (data.lines) {
            for (const [shortName, statusInfo] of Object.entries(data.lines)) {
                // Trouver le route_id correspondant au short_name
                const route = dataManager.routes.find(r => r.route_short_name === shortName);
                if (route && statusInfo.status !== 'normal') {
                    lineStatuses[route.route_id] = {
                        status: statusInfo.status,
                        message: statusInfo.message || ''
                    };
                    console.log(`[LineStatus] Ligne ${shortName}: ${statusInfo.status} - ${statusInfo.message}`);
                }
            }
        }
        
        // Message global (pour les alertes générales)
        if (data.globalMessage) {
            console.log('[LineStatus] Message global:', data.globalMessage);
        }
        
    } catch (error) {
        console.warn('[LineStatus] Erreur chargement statuts:', error);
    }
}

// Fonction d'animation générique (DÉPLACÉE EN DEHORS)
function animateValue(obj, start, end, duration, suffix = "") {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Easing function (pour que ça ralentisse à la fin)
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        
        const value = Math.floor(easeOutQuart * (end - start) + start);
        
        // Gestion spéciale pour les nombres à virgule (comme 2.1M)
        if (suffix === "M" && end === 2.1) {
             obj.innerHTML = (easeOutQuart * 2.1).toFixed(1) + suffix;
        } else {
             obj.innerHTML = value + suffix;
        }

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
             // S'assurer que la valeur finale est exacte
             obj.innerHTML = end + suffix;
        }
    };
    window.requestAnimationFrame(step);
}

function populateTimeSelects() {
    if (!uiManager) return;
    uiManager.populateTimeSelects({
        hall: { dateEl: hallDate, hourEl: hallHour, minEl: hallMinute },
        results: { dateEl: resultsDate, hourEl: resultsHour, minEl: resultsMinute }
    });
}

const isInstallTipVisible = () => installTipContainer && !installTipContainer.classList.contains('hidden');

function hideInstallTip() {
    if (!installTipContainer) return;
    installTipContainer.classList.add('hidden');
    installTipContainer.setAttribute('aria-hidden', 'true');
    installTipContainer.removeAttribute('aria-modal');
}

function showInstallTip() {
    if (!installTipContainer) return;
    installTipContainer.classList.remove('hidden');
    installTipContainer.setAttribute('aria-hidden', 'false');
    installTipContainer.setAttribute('aria-modal', 'true');
    if (installTipCloseBtn) {
        installTipCloseBtn.focus();
    }
}

function handleInstallTipKeydown(event) {
    if (event.key === 'Escape' && isInstallTipVisible()) {
        hideInstallTip();
    }
}

function isMobileDetailViewport() {
    return window.innerWidth <= 768;
}

function getViewportHeight() {
    return Math.max(window.innerHeight, document.documentElement?.clientHeight || 0);
}

// V269: Niveaux en % de translateY (100% = caché, 0% = full visible)
// Correspondance CSS: sheet-level-0 = 80%, sheet-level-1 = 50%, sheet-level-2 = 10%
const SHEET_TRANSLATE_LEVELS = [80, 50, 10];

function getCurrentSheetTranslateY() {
    if (!detailBottomSheet) return 100;
    // Lire le transform actuel
    const style = window.getComputedStyle(detailBottomSheet);
    const matrix = new DOMMatrix(style.transform);
    const viewportHeight = getViewportHeight();
    if (!viewportHeight) return 100;
    // translateY en pixels -> en %
    return (matrix.m42 / viewportHeight) * 100;
}

function applyBottomSheetLevel(index, { immediate = false } = {}) {
    if (!detailBottomSheet || !isMobileDetailViewport()) return;
    const targetIndex = Math.max(0, Math.min(BOTTOM_SHEET_LEVELS.length - 1, index));
    currentBottomSheetLevelIndex = targetIndex;
    
    // V268: Retirer toutes les classes de niveau
    detailBottomSheet.classList.remove('sheet-level-0', 'sheet-level-1', 'sheet-level-2');
    
    if (immediate) {
        detailBottomSheet.classList.add('sheet-height-no-transition');
    }
    
    // V268: Ajouter la classe du niveau cible
    detailBottomSheet.classList.add(`sheet-level-${targetIndex}`);
    
    // V268: Retirer le transform inline (laisser CSS gérer)
    detailBottomSheet.style.removeProperty('transform');
    
    // V60: Ajouter/retirer la classe is-expanded selon le niveau
    if (targetIndex >= BOTTOM_SHEET_EXPANDED_LEVEL_INDEX) {
        detailBottomSheet.classList.add('is-expanded');
    } else {
        detailBottomSheet.classList.remove('is-expanded');
        // Reset le scroll quand on réduit le sheet
        if (detailPanelWrapper) {
            detailPanelWrapper.scrollTop = 0;
        }
    }
    
    if (immediate) {
        requestAnimationFrame(() => detailBottomSheet?.classList.remove('sheet-height-no-transition'));
    }
}

function prepareBottomSheetForViewport(immediate = false) {
    if (!detailBottomSheet) return;
    if (!isMobileDetailViewport()) {
        detailBottomSheet.style.removeProperty('transform');
        detailBottomSheet.classList.remove('sheet-level-0', 'sheet-level-1', 'sheet-level-2');
        return;
    }
    applyBottomSheetLevel(currentBottomSheetLevelIndex, { immediate });
}

function handleBottomSheetResize() {
    if (!detailBottomSheet) return;
    if (!isMobileDetailViewport()) {
        detailBottomSheet.style.removeProperty('transform');
        detailBottomSheet.classList.remove('sheet-level-0', 'sheet-level-1', 'sheet-level-2');
        cancelBottomSheetDrag();
        return;
    }
    applyBottomSheetLevel(currentBottomSheetLevelIndex, { immediate: true });
}

function getClosestSheetLevelIndex(fraction) {
    let bestIdx = 0;
    let bestDistance = Infinity;
    BOTTOM_SHEET_LEVELS.forEach((level, idx) => {
        const distance = Math.abs(level - fraction);
        if (distance < bestDistance) {
            bestIdx = idx;
            bestDistance = distance;
        }
    });
    return bestIdx;
}

function isPointerWithinBottomSheetDragRegion(event) {
    if (!detailBottomSheet) return false;
    const rect = detailBottomSheet.getBoundingClientRect();
    const topBoundary = rect.top - BOTTOM_SHEET_DRAG_BUFFER_PX;
    const bottomBoundary = rect.top + BOTTOM_SHEET_DRAG_ZONE_PX;
    return event.clientY >= topBoundary && event.clientY <= bottomBoundary;
}

function cancelBottomSheetDrag() {
    if (!bottomSheetDragState) return;
    window.removeEventListener('pointermove', onBottomSheetPointerMove);
    window.removeEventListener('pointerup', onBottomSheetPointerUp);
    window.removeEventListener('pointercancel', onBottomSheetPointerUp);
    if (detailBottomSheet && bottomSheetDragState.pointerId !== undefined) {
        try { detailBottomSheet.releasePointerCapture(bottomSheetDragState.pointerId); } catch (_) { /* ignore */ }
    }
    detailBottomSheet?.classList.remove('is-dragging');
    bottomSheetDragState = null;
}

function onBottomSheetPointerDown(event) {
    if (!isMobileDetailViewport() || !detailBottomSheet || !itineraryDetailContainer?.classList.contains('is-active')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    
    const isHandle = Boolean(event.target.closest('.panel-handle'));
    const inDragRegion = isPointerWithinBottomSheetDragRegion(event);
    const inSheet = Boolean(event.target.closest('#detail-bottom-sheet'));
    const isExpanded = currentBottomSheetLevelIndex >= BOTTOM_SHEET_EXPANDED_LEVEL_INDEX;
    const wrapperScroll = detailPanelWrapper ? detailPanelWrapper.scrollTop : 0;
    
    // V60: Si pas expanded, on peut drag depuis n'importe où sur le sheet
    if (!isExpanded) {
        // Permettre le drag depuis la handle, la zone de drag, ou le sheet lui-meme
        if (!isHandle && !inDragRegion && !inSheet) return;
    } else {
        // Si expanded, on ne peut drag que depuis la handle ou si on est au top du scroll
        const canDragFromSheet = inSheet && wrapperScroll <= BOTTOM_SHEET_SCROLL_UNLOCK_THRESHOLD;
        if (!isHandle && !inDragRegion && !canDragFromSheet) return;
    }
    
    event.preventDefault();
    
    // V268: Calculer le translateY actuel en %
    const viewportHeight = getViewportHeight();
    const startTranslateY = SHEET_TRANSLATE_LEVELS[currentBottomSheetLevelIndex];
    
    bottomSheetDragState = {
        pointerId: event.pointerId,
        startY: event.clientY,
        lastClientY: event.clientY,
        startTranslateY: startTranslateY, // V268: En % au lieu de px
        currentTranslateY: startTranslateY,
        lastEventTime: performance.now(),
        velocity: 0,
        startIndex: currentBottomSheetLevelIndex,
        hasMoved: false,
        isDragging: false,
        viewportHeight: viewportHeight
    };
    
    try { detailBottomSheet.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
    window.addEventListener('pointermove', onBottomSheetPointerMove, { passive: false });
    window.addEventListener('pointerup', onBottomSheetPointerUp);
    window.addEventListener('pointercancel', onBottomSheetPointerUp);
}

function onBottomSheetPointerMove(event) {
    if (!bottomSheetDragState || !detailBottomSheet) return;
    event.preventDefault();
    
    const viewportHeight = bottomSheetDragState.viewportHeight;
    if (!viewportHeight) return;
    
    // V268: Calcul direct du deltaY en pixels -> convertir en %
    const deltaYPx = bottomSheetDragState.startY - event.clientY;
    const deltaYPercent = (deltaYPx / viewportHeight) * 100;
    
    // Anti-sautillement - ignorer les micro-mouvements (< 5px)
    if (!bottomSheetDragState.hasMoved && Math.abs(deltaYPx) < 5) {
        return;
    }
    
    // Premier vrai mouvement détecté
    if (!bottomSheetDragState.hasMoved) {
        bottomSheetDragState.hasMoved = true;
        bottomSheetDragState.isDragging = true;
        detailBottomSheet.classList.add('is-dragging');
        // V268: Retirer les classes de niveau pendant le drag
        detailBottomSheet.classList.remove('sheet-level-0', 'sheet-level-1', 'sheet-level-2');
        itineraryDetailContainer?.classList.add('sheet-is-dragging');
    }
    
    // V268: Calculer le nouveau translateY en %
    // Plus on drag vers le haut (deltaY positif), plus le translateY diminue (plus visible)
    let newTranslateY = bottomSheetDragState.startTranslateY - deltaYPercent;
    
    // Limites: min 15% (85% visible), max 80% (20% visible)
    const minTranslate = SHEET_TRANSLATE_LEVELS[SHEET_TRANSLATE_LEVELS.length - 1]; // 15%
    const maxTranslate = SHEET_TRANSLATE_LEVELS[0]; // 80%
    newTranslateY = Math.max(minTranslate, Math.min(maxTranslate, newTranslateY));
    
    // Calculer la vélocité
    const now = performance.now();
    const elapsed = now - (bottomSheetDragState.lastEventTime || now);
    if (elapsed > 0) {
        const deltaTranslate = newTranslateY - bottomSheetDragState.currentTranslateY;
        bottomSheetDragState.velocity = deltaTranslate / elapsed; // % par ms
    }
    
    bottomSheetDragState.currentTranslateY = newTranslateY;
    bottomSheetDragState.lastClientY = event.clientY;
    bottomSheetDragState.lastEventTime = now;
    
    // V268: Appliquer le transform DIRECTEMENT (pas de CSS var, pas de height)
    detailBottomSheet.style.transform = `translate3d(0, ${newTranslateY}%, 0)`;
}

function onBottomSheetPointerUp() {
    if (!bottomSheetDragState) return;
    
    const wasDragging = bottomSheetDragState.isDragging;
    let targetIndex = currentBottomSheetLevelIndex;
    
    // V272: Calculer l'index cible - UN SEUL NIVEAU À LA FOIS
    if (wasDragging) {
        const currentTranslate = bottomSheetDragState.currentTranslateY;
        const startIndex = bottomSheetDragState.startIndex;
        const velocity = bottomSheetDragState.velocity || 0;
        const deltaFromStart = bottomSheetDragState.startTranslateY - currentTranslate;
        
        // V272: Par défaut, rester au niveau de départ
        targetIndex = startIndex;
        
        // V272: Logique SNCF Connect - un seul niveau à la fois
        // Seuil de distance : 12% du viewport pour changer de niveau
        const SNAP_THRESHOLD_PERCENT = 8;
        // Seuil de vélocité : 0.3% par ms
        const VELOCITY_THRESHOLD = 0.3;
        
        // Swipe vers le HAUT (deltaFromStart > 0 = translateY diminue = plus visible)
        if (deltaFromStart > SNAP_THRESHOLD_PERCENT || velocity < -VELOCITY_THRESHOLD) {
            // Monter d'UN SEUL niveau (si possible)
            if (startIndex < SHEET_TRANSLATE_LEVELS.length - 1) {
                targetIndex = startIndex + 1;
            }
        }
        // Swipe vers le BAS (deltaFromStart < 0 = translateY augmente = moins visible)
        else if (deltaFromStart < -SNAP_THRESHOLD_PERCENT || velocity > VELOCITY_THRESHOLD) {
            // Descendre d'UN SEUL niveau (si possible)
            if (startIndex > 0) {
                targetIndex = startIndex - 1;
            }
        }
        // Sinon : retour au niveau de départ (rubber band)
    }
    
    // 1. Nettoyer les listeners
    window.removeEventListener('pointermove', onBottomSheetPointerMove);
    window.removeEventListener('pointerup', onBottomSheetPointerUp);
    window.removeEventListener('pointercancel', onBottomSheetPointerUp);
    if (detailBottomSheet && bottomSheetDragState.pointerId !== undefined) {
        try { detailBottomSheet.releasePointerCapture(bottomSheetDragState.pointerId); } catch (_) { /* ignore */ }
    }
    
    // V272: Fix scintillement - appliquer la classe AVANT de retirer is-dragging
    if (wasDragging && detailBottomSheet) {
        // 1. D'abord appliquer la classe du niveau cible (pendant que is-dragging est encore là)
        detailBottomSheet.classList.remove('sheet-level-0', 'sheet-level-1', 'sheet-level-2');
        detailBottomSheet.classList.add(`sheet-level-${targetIndex}`);
        currentBottomSheetLevelIndex = targetIndex;
        
        // 2. Gérer is-expanded
        if (targetIndex >= BOTTOM_SHEET_EXPANDED_LEVEL_INDEX) {
            detailBottomSheet.classList.add('is-expanded');
        } else {
            detailBottomSheet.classList.remove('is-expanded');
            if (detailPanelWrapper) detailPanelWrapper.scrollTop = 0;
        }
        
        // 3. PUIS retirer is-dragging et le transform inline dans le même frame
        detailBottomSheet.classList.remove('is-dragging');
        detailBottomSheet.style.removeProperty('transform');
        itineraryDetailContainer?.classList.remove('sheet-is-dragging');
    }
    
    bottomSheetDragState = null;
}

function handleDetailPanelWheel(event) {
    if (!isMobileDetailViewport() || !detailPanelWrapper || !detailBottomSheet) return;
    const nearTop = detailPanelWrapper.scrollTop <= BOTTOM_SHEET_SCROLL_UNLOCK_THRESHOLD;
    if (!nearTop) return; // let content scroll when not at the top
    const direction = Math.sign(event.deltaY);
    if (direction < 0 && !isSheetAtMaxLevel()) {
        event.preventDefault();
        applyBottomSheetLevel(currentBottomSheetLevelIndex + 1);
    } else if (direction > 0 && !isSheetAtMinLevel()) {
        event.preventDefault();
        applyBottomSheetLevel(currentBottomSheetLevelIndex - 1);
    }
}

function initBottomSheetControls() {
    if (bottomSheetControlsInitialized || !detailBottomSheet || !itineraryDetailContainer) return;
    detailBottomSheet.addEventListener('pointerdown', onBottomSheetPointerDown, { passive: false });
    window.addEventListener('resize', handleBottomSheetResize);
    bottomSheetControlsInitialized = true;
    prepareBottomSheetForViewport(true);
}

function setupStaticEventListeners() {
    // Charger Google Maps si une clé est présente (mode dev)
    if (APP_CONFIG.googleApiKey) {
        try { apiManager.loadGoogleMapsAPI(); } catch (error) { console.error("Impossible de charger l'API Google:", error); }
    }
    populateTimeSelects();

    // Gérer les liens hash (#horaires, #trafic, etc.)
    function handleHashNavigation() {
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            switch(hash) {
                case 'itineraire':
                    // Ouvrir la vue itinéraire (sans recherche préalable)
                    showResultsView();
                    break;
                case 'horaires':
                    showDashboardView('horaires');
                    break;
                case 'trafic':
                case 'info-trafic':
                    showDashboardView('info-trafic');
                    break;
                case 'carte':
                    showMapView();
                    break;
                case 'tarifs':
                case 'tarifs-grille':
                    showTarifsView('tarifs-grille');
                    break;
                case 'tarifs-achat':
                    showTarifsView('tarifs-achat');
                    break;
                case 'tarifs-billettique':
                    showTarifsView('tarifs-billettique');
                    break;
                case 'tarifs-amendes':
                    showTarifsView('tarifs-amendes');
                    break;
            }
            // Nettoyer le hash après navigation
            history.replaceState(null, '', window.location.pathname);
        }
    }
    
    // Écouter les changements de hash
    window.addEventListener('hashchange', handleHashNavigation);
    
    // Gérer le hash initial au chargement
    if (window.location.hash) {
        setTimeout(handleHashNavigation, 100);
    }
    
    // V505: Écouter l'événement de chargement d'itinéraire en cache (trajets récents)
    window.addEventListener('perimap:loadCachedItinerary', (e) => {
        const { from, to, itinerary, searchTime } = e.detail || {};
        if (!itinerary || !itinerary.length) {
            console.warn('[V505] loadCachedItinerary: itinéraire vide, relance recherche');
            const searchBtn = document.getElementById('results-planner-submit-btn');
            if (searchBtn) searchBtn.click();
            return;
        }
        console.log(`[V505] Chargement ${itinerary.length} itinéraires depuis cache:`, from, '->', to);
        
        // Remplir allFetchedItineraries avec les données du cache
        allFetchedItineraries = itinerary;
        if (searchTime) {
            lastSearchTime = { ...searchTime };
        }
        
        // Afficher la vue résultats si pas déjà visible
        showResultsView();
        
        // Configurer et afficher les onglets et résultats
        setupResultTabs(allFetchedItineraries);
        if (resultsRenderer) resultsRenderer.render('ALL');
        
        // Afficher le premier itinéraire sur la carte
        if (allFetchedItineraries.length > 0 && resultsMapRenderer && resultsMapRenderer.map) {
            setTimeout(() => {
                resultsMapRenderer.map.invalidateSize();
                drawRouteOnResultsMap(allFetchedItineraries[0]);
            }, 100);
        }
        
        console.log('[V505] Itinéraires affichés depuis cache');
    });

    document.querySelectorAll('.service-card[data-view]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const view = button.dataset.view;
            showDashboardView(view);
        });
    });

    if (btnShowMap) btnShowMap.addEventListener('click', showMapView); 
    if (btnBackToDashboardFromMap) btnBackToDashboardFromMap.addEventListener('click', showDashboardHall);
    if (btnBackToDashboardFromResults) btnBackToDashboardFromResults.addEventListener('click', showDashboardHall); 
    if (btnBackToHall) btnBackToHall.addEventListener('click', showDashboardHall);
    if (btnBackToResults) btnBackToResults.addEventListener('click', hideDetailView);
    if (itineraryDetailBackdrop) {
        itineraryDetailBackdrop.addEventListener('click', hideDetailView);
    }

    if (detailPanelWrapper && itineraryDetailContainer) {
        // V60: Bloquer le scroll du contenu tant qu'on n'est pas au niveau expanded (80%)
        detailPanelWrapper.addEventListener('touchmove', (e) => {
            // V60: Si on n'est pas au niveau max, bloquer le scroll et permettre le drag
            if (currentBottomSheetLevelIndex < BOTTOM_SHEET_EXPANDED_LEVEL_INDEX) {
                // Vérifier si l'événement est cancelable avant d'appeler preventDefault
                if (e.cancelable) {
                    e.preventDefault();
                }
                return;
            }
        }, { passive: false }); 
        
        detailPanelWrapper.addEventListener('wheel', handleDetailPanelWheel, { passive: false });
        
        detailPanelWrapper.addEventListener('scroll', () => {
            // V60: Ne pas gérer le scroll si on n'est pas au niveau max
            if (currentBottomSheetLevelIndex < BOTTOM_SHEET_EXPANDED_LEVEL_INDEX) {
                detailPanelWrapper.scrollTop = 0;
            }
        });
    }

    if (alertBannerClose && alertBanner) {
        alertBannerClose.addEventListener('click', () => alertBanner.classList.add('hidden'));
    }
    
    document.querySelectorAll('.tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabContent = tab.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.toggle('hidden', content.dataset.content !== tabContent);
            });
        });
    });

    const closeInstructionsBtn = document.getElementById('close-instructions');
    if (closeInstructionsBtn) {
        closeInstructionsBtn.addEventListener('click', () => {
            const instructions = document.getElementById('instructions');
            if (instructions) instructions.classList.add('hidden');
            localStorage.setItem('gtfsInstructionsShown', 'true');
        });
    }
    
    const btnToggleFilter = document.getElementById('btn-toggle-filter');
    const routeFilterPanel = document.getElementById('route-filter-panel');
    if (btnToggleFilter && routeFilterPanel) {
        btnToggleFilter.addEventListener('click', () => {
            routeFilterPanel.classList.toggle('hidden');
        });
        
        // Auto-collapse FAB après 3 secondes (mobile uniquement)
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                btnToggleFilter.classList.add('collapsed');
            }, 3000);
            
            // Expand au survol/touch
            btnToggleFilter.addEventListener('mouseenter', () => {
                btnToggleFilter.classList.remove('collapsed');
            });
            btnToggleFilter.addEventListener('mouseleave', () => {
                btnToggleFilter.classList.add('collapsed');
            });
        }
    }
    
    const closeFilterBtn = document.getElementById('close-filter');
    if (closeFilterBtn && routeFilterPanel) {
        closeFilterBtn.addEventListener('click', () => {
            routeFilterPanel.classList.add('hidden');
        });
    }
    
    const panelHandle = document.querySelector('#route-filter-panel .panel-handle');
    if (panelHandle && routeFilterPanel) {
        panelHandle.addEventListener('click', () => {
            routeFilterPanel.classList.add('hidden');
        });
    }
    
    const selectAllRoutesBtn = document.getElementById('select-all-routes');
    if (selectAllRoutesBtn) {
        selectAllRoutesBtn.addEventListener('click', () => {
            if (dataManager) {
                dataManager.routes.forEach(route => {
                    const checkbox = document.getElementById(`route-${route.route_id}`);
                    if (checkbox) checkbox.checked = true;
                });
                handleRouteFilterChange();
            }
        });
    }
    
    const deselectAllRoutesBtn = document.getElementById('deselect-all-routes');
    if (deselectAllRoutesBtn) {
        deselectAllRoutesBtn.addEventListener('click', () => {
            if (dataManager) {
                dataManager.routes.forEach(route => {
                    const checkbox = document.getElementById(`route-${route.route_id}`);
                    if (checkbox) checkbox.checked = false;
                });
                handleRouteFilterChange();
            }
        });
    }

    if (installTipCloseBtn) {
        installTipCloseBtn.addEventListener('click', hideInstallTip);
    }
    if (installTipContainer) {
        installTipContainer.addEventListener('click', (event) => {
            if (event.target === installTipContainer) {
                hideInstallTip();
            }
        });
    }
    document.addEventListener('keydown', handleInstallTipKeydown);

    document.getElementById('btn-horaires-search-focus').addEventListener('click', () => {
        const horairesCard = document.getElementById('horaires');
        if (horairesCard) {
            window.scrollTo({ top: horairesCard.offsetTop - 80, behavior: 'smooth' });
        }
        searchBar.focus();
    });
    searchBar.addEventListener('input', handleSearchInput);
    searchBar.addEventListener('focus', handleSearchInput);

    setupPlannerListeners('hall', {
        submitBtn: hallPlannerSubmitBtn,
        fromInput: hallFromInput,
        toInput: hallToInput,
        fromSuggestions: hallFromSuggestions,
        toSuggestions: hallToSuggestions,
        swapBtn: hallSwapBtn,
        whenBtn: hallWhenBtn,
        popover: hallPopover,
        dateSelect: hallDate,
        hourSelect: hallHour,
        minuteSelect: hallMinute,
        popoverSubmitBtn: hallPopoverSubmitBtn,
        geolocateBtn: hallGeolocateBtn
    });

    setupPlannerListeners('results', {
        submitBtn: resultsPlannerSubmitBtn,
        fromInput: resultsFromInput,
        toInput: resultsToInput,
        fromSuggestions: resultsFromSuggestions,
        toSuggestions: resultsToSuggestions,
        swapBtn: resultsSwapBtn,
        whenBtn: resultsWhenBtn,
        popover: resultsPopover,
        dateSelect: resultsDate,
        hourSelect: resultsHour,
        minuteSelect: resultsMinute,
        popoverSubmitBtn: resultsPopoverSubmitBtn,
        geolocateBtn: resultsGeolocateBtn
    });

    document.addEventListener('click', (e) => {
        if (searchResultsContainer && !e.target.closest('#horaires-search-container')) {
            searchResultsContainer.classList.add('hidden');
        }
        if (hallPopover && !e.target.closest('#hall-planner-from') && !e.target.closest('#hall-planner-to') && !e.target.closest('.form-group-when')) {
            if (!hallPopover.classList.contains('hidden')) {
                hallPopover.classList.add('hidden');
                hallWhenBtn.classList.remove('popover-active');
            }
        }
        if (resultsPopover && !e.target.closest('#results-planner-from') && !e.target.closest('#results-planner-to') && !e.target.closest('.form-group-when')) {
            if (!resultsPopover.classList.contains('hidden')) {
                resultsPopover.classList.add('hidden');
                resultsWhenBtn.classList.remove('popover-active');
            }
        }
        if (!e.target.closest('.form-group')) {
            if (hallFromSuggestions) hallFromSuggestions.style.display = 'none';
            if (hallToSuggestions) hallToSuggestions.style.display = 'none';
            if (resultsFromSuggestions) resultsFromSuggestions.style.display = 'none';
            if (resultsToSuggestions) resultsToSuggestions.style.display = 'none';
        }
    });

    // === NAVIGATION DROPDOWN IDFM-STYLE ===
    setupNavigationDropdowns();

    // Touch feedback (ripple + subtle press)
    setupTapFeedback();

    // Default highlight (home) until navigation occurs
    setBottomNavActive('hall');
    
    initBottomSheetControls();
}

// Nouvelle fonction pour gérer les menus dropdown
function setupNavigationDropdowns() {
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuToggle && mobileMenu) {
        mobileMenuToggle.addEventListener('click', () => {
            const isOpening = mobileMenu.classList.contains('hidden');
            mobileMenuToggle.classList.toggle('is-active');
            mobileMenu.classList.toggle('hidden');
            
            // Bloquer/débloquer le scroll de la page
            if (isOpening) {
                document.body.classList.add('mobile-menu-open');
            } else {
                document.body.classList.remove('mobile-menu-open');
                unlockBodyScrollIfStuck();
            }
        });
        
        // Gestion des catégories dépliables (accordéon exclusif - un seul ouvert à la fois)
        mobileMenu.querySelectorAll('.mobile-menu-category').forEach(category => {
            category.addEventListener('click', () => {
                const isExpanded = category.getAttribute('aria-expanded') === 'true';
                const itemsContainer = category.nextElementSibling;
                
                // Fermer toutes les autres catégories d'abord
                mobileMenu.querySelectorAll('.mobile-menu-category').forEach(otherCategory => {
                    if (otherCategory !== category) {
                        otherCategory.setAttribute('aria-expanded', 'false');
                        const otherItems = otherCategory.nextElementSibling;
                        if (otherItems) otherItems.classList.remove('is-expanded');
                    }
                });
                
                // Toggle l'état de la catégorie cliquée
                category.setAttribute('aria-expanded', !isExpanded);
                itemsContainer.classList.toggle('is-expanded', !isExpanded);
            });
        });
    }
    
    // Gestion des actions de navigation (desktop dropdown items)
    document.querySelectorAll('.nav-dropdown-item[data-action]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const action = item.dataset.action;
            handleNavigationAction(action);
        });
    });
    
    // Gestion des actions de navigation (mobile menu items)
    document.querySelectorAll('.mobile-menu-item[data-action]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const action = item.dataset.action;
            // Fermer le menu mobile
            if (mobileMenuToggle) mobileMenuToggle.classList.remove('is-active');
            if (mobileMenu) mobileMenu.classList.add('hidden');
            document.body.classList.remove('mobile-menu-open');
            unlockBodyScrollIfStuck();
            handleNavigationAction(action);
        });
    });

    // Bottom navigation (mobile-first) - Intégration EventBus Phase 1
    document.querySelectorAll('.bottom-nav-item[data-action]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const action = item.dataset.action;
            // Close mobile menu if open
            if (mobileMenuToggle) mobileMenuToggle.classList.remove('is-active');
            if (mobileMenu) mobileMenu.classList.add('hidden');
            document.body.classList.remove('mobile-menu-open');
            
            // PHASE 1: Émettre via EventBus
            logger.debug('Navigation button clicked', { action });
            eventBus.emit('nav:select', { view: action });
            
            // Garder l'appel direct pour compatibilité transitoire
            handleNavigationAction(action);
        });
    });
    
    // PHASE 1: Setup EventBus listeners pour navigation
    eventBus.on('nav:select', ({ view }) => {
        logger.info('Navigation event received', { view });
        stateManager.setState({ currentView: view }, `nav:select:${view}`);
    });
    
    // Fermer les menus au clic ailleurs
    document.addEventListener('click', (e) => {
        // Fermer le menu mobile si on clique ailleurs
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            if (!e.target.closest('#mobile-menu') && !e.target.closest('#mobile-menu-toggle')) {
                mobileMenuToggle.classList.remove('is-active');
                mobileMenu.classList.add('hidden');
                document.body.classList.remove('mobile-menu-open');
                unlockBodyScrollIfStuck();
            }
        }
    });
}

// V75: Vérifie si le dashboard est chargé et le recharge si nécessaire
async function ensureDashboardLoaded() {
    // Vérifier si les éléments clés du dashboard existent
    const dashboardExists = document.getElementById('dashboard-container');
    if (!dashboardExists) {
        logger.info('[Navigation] Dashboard non chargé, rechargement...');
        await reloadDashboardFromTarifs();
        return true; // Indique qu'on a rechargé
    }
    return false;
}

// Gérer les actions de navigation - PHASE 1: Intégration Logger
async function handleNavigationAction(action) {
    logger.debug('handleNavigationAction', { action });
    
    // Empêcher les transitions concurrentes: on garde la dernière action demandée
    if (__pmIsScreenSwapping) {
        __pmPendingNavAction = action;
        logger.warn('Screen swap in progress, queuing action', { action });
        return;
    }

    // V75: Pour les actions qui nécessitent le dashboard, s'assurer qu'il est chargé
    // V452: La carte ne nécessite pas le dashboard - évite le clignotement via accueil
    const needsDashboard = ['itineraire', 'horaires', 'info-trafic'].includes(action);
    
    if (needsDashboard) {
        const wasReloaded = await ensureDashboardLoaded();
        // Réinitialiser les références DOM après rechargement potentiel
        initializeDomElements();
        
        // V91: Si on a rechargé, attendre un peu que le DOM se stabilise
        if (wasReloaded) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    
    try {
        switch(action) {
            case 'hall':
                logger.info('Navigating to hall');
                showDashboardHall();
                break;
            case 'itineraire':
                logger.info('Navigating to itinerary search');
                // Aller à la vue résultats d'itinéraire (sans recherche préalable)
                showResultsView();
                break;
            case 'horaires':
                logger.info('Navigating to schedule view');
                showDashboardView('horaires');
                break;
            case 'info-trafic':
                logger.info('Navigating to traffic info');
                showDashboardView('info-trafic');
                break;
            case 'carte':
                logger.info('Navigating to map view');
                showMapView();
                break;
            case 'tarifs':
            case 'tarifs-grille':
                logger.info('Navigating to tariffs view', { page: 'tarifs-grille' });
                showTarifsView('tarifs-grille');
                break;
            case 'tarifs-achat':
                logger.info('Navigating to tariffs view', { page: 'tarifs-achat' });
                showTarifsView('tarifs-achat');
                break;
            case 'tarifs-billettique':
                logger.info('Navigating to tariffs view', { page: 'tarifs-billettique' });
                showTarifsView('tarifs-billettique');
                break;
            case 'tarifs-amendes':
                logger.info('Navigating to tariffs view', { page: 'tarifs-amendes' });
                showTarifsView('tarifs-amendes');
                break;
            default:
                logger.warn('Action not recognized', { action });
        }
    } catch (error) {
        logger.error('Navigation error', error, { action });
        eventBus.emit('ui:error', { 
            message: `Erreur lors de la navigation vers ${action}`,
            error 
        });
    }
}

// Afficher la vue Tarifs
async function showTarifsView(page = 'tarifs-grille') {
    try {
        const response = await fetch(`/views/${page}.html`);
        const html = await response.text();
        
        const appViewRoot = document.getElementById('app-view-root');
        appViewRoot.innerHTML = html;
        
        // Bouton retour - recharge le dashboard complet
        const backBtn = document.getElementById('btn-back-to-hall-tarifs');
        if (backBtn) {
            backBtn.addEventListener('click', async () => {
                await reloadDashboardFromTarifs();
            });
        }
        
        // Liens de navigation entre pages tarifs
        document.querySelectorAll('.tarifs-nav-card[data-action]').forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                const action = card.dataset.action;
                handleNavigationAction(action);
            });
        });
        
        // Scroll en haut
        window.scrollTo(0, 0);
        
    } catch (error) {
        console.error('Erreur chargement vue Tarifs:', error);
    }
}

// Recharger le dashboard depuis les pages tarifs
async function reloadDashboardFromTarifs() {
    try {
        // Recharger le layout de base
        await loadBaseLayout();
        
        // Réinitialiser les références DOM
        initializeDomElements();
        
        // Réattacher les event listeners statiques
        setupStaticEventListeners();
        attachRobustBackHandlers();
        
        // Réafficher les fiches horaires
        if (dataManager && ficheHoraireContainer) {
            buildFicheHoraireList();
        }
        
        // Afficher le hall
        if (dashboardContainer) {
            dashboardContainer.classList.remove('hidden');
        }
        if (mapContainer) {
            mapContainer.classList.add('hidden');
        }
        if (itineraryResultsContainer) {
            itineraryResultsContainer.classList.add('hidden');
        }
        if (dashboardHall) {
            dashboardHall.classList.add('view-is-active');
        }
        if (dashboardContentView) {
            dashboardContentView.classList.remove('view-is-active');
        }
        
        document.body.classList.remove('view-map-locked');
        document.body.classList.remove('view-is-locked');
        
        // Réafficher les alertes et infos trafic
        if (dataManager) {
            renderAlertBanner();
            renderInfoTrafic();
        }
        
        window.scrollTo(0, 0);
        console.log('[main] Dashboard rechargé depuis tarifs');
        
    } catch (error) {
        console.error('Erreur rechargement dashboard:', error);
        // Fallback: recharger la page
        window.location.reload();
    }
}

function setupDataDependentEventListeners() {
    if (timeManager) {
        timeManager.addListener(updateData);
    }
    if (mapRenderer && mapRenderer.map) {
        mapRenderer.map.on('zoomend', () => {
            if (dataManager) {
                mapRenderer.displayStops();
            }
        });
    }
}

function setupPlannerListeners(source, elements) {
    if (!uiManager) return;
    uiManager.setupPlannerListeners(source, elements, {
        onExecuteSearch: (ctxSource, ctxElements) => executeItinerarySearch(ctxSource, ctxElements),
        handleAutocomplete,
        getFromPlaceId: () => fromPlaceId,
        setFromPlaceId: (value) => { fromPlaceId = value; },
        getToPlaceId: () => toPlaceId,
        setToPlaceId: (value) => { toPlaceId = value; }
    });
}

async function executeItinerarySearch(source, sourceElements) {
    const { fromInput, toInput, dateSelect, hourSelect, minuteSelect, popover } = sourceElements;
    
    logger.debug('Itinerary search start', { source, fromPlaceId, toPlaceId });
    
    // V59: Reset complet pour nouvelle recherche
    logger.info('🔄 === NOUVELLE RECHERCHE ===');
    
    if (!fromPlaceId || !toPlaceId) {
        const message = "Veuillez sélectionner un point de départ et d'arrivée depuis les suggestions.";
        alert(message);
        logger.warn('Search cancelled: incomplete locations', { from: !!fromPlaceId, to: !!toPlaceId });
        eventBus.emit('search:error', { 
            message,
            error: new Error('Missing departure or arrival') 
        });
        return;
    }
    
    // PHASE 1: Emit search:start event
    const searchTime = {
        type: popover.querySelector('.popover-tab.active').dataset.tab, 
        date: dateSelect.value,
        hour: hourSelect.value,
        minute: minuteSelect.value
    };
    
    eventBus.emit('search:start', {
        departure: { placeId: fromPlaceId, label: fromInput?.value },
        arrival: { placeId: toPlaceId, label: toInput?.value },
        time: searchTime,
        source
    });
    
    stateManager.setState({
        search: {
            departure: { placeId: fromPlaceId, label: fromInput?.value },
            arrival: { placeId: toPlaceId, label: toInput?.value },
            departureTime: `${searchTime.hour}:${searchTime.minute}`,
            arrivalTime: searchTime.type === 'arriver' ? `${searchTime.hour}:${searchTime.minute}` : null,
            mode: searchTime.type,
            results: [],
            loading: true,
            error: null
        }
    }, 'search:start');

    // V204 + correctif fuseau: calculer la date du jour en local (pas en UTC)
    const nowLocal = new Date();
    const todayIso = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
    if (!searchTime.date || searchTime.date < todayIso) {
        searchTime.date = todayIso;
        try { dateSelect.value = todayIso; } catch (e) {}
    }
    
    // Debug: vérifier l'heure réellement sélectionnée
    logger.debug('Search time details', {
        date: searchTime.date,
        heure: `${searchTime.hour}:${String(searchTime.minute).padStart(2,'0')}`,
        mode: searchTime.type,
        hourSelectValue: hourSelect.value,
        minuteSelectValue: minuteSelect.value
    });
    
    lastSearchMode = searchTime.type; // Mémoriser le mode pour le rendu/pagination
    lastSearchTime = { ...searchTime }; // V60: Mémoriser pour charger plus
    loadMoreOffset = 0; // V60: Reset l'offset
    // V59: Reset complet de l'état de recherche
    arrivalRankedAll = [];
    arrivalRenderedCount = 0;
    allFetchedItineraries = [];
    
    prefillOtherPlanner(source, sourceElements);
    logger.info(`Recherche itinéraire (backend ${apiManager.backendMode || 'unknown'})`, { from: fromPlaceId, to: toPlaceId, time: searchTime });
    
    if (source === 'hall') {
        showResultsView(); 
    }
    
    // V220: Afficher des skeleton loaders pendant le chargement (plus joli qu'un texte)
    if (resultsRenderer) resultsRenderer.showSkeleton(4);
    resultsModeTabs.classList.add('hidden');
    
    // PHASE 1: Emit UI loading event
    eventBus.emit('ui:loading', true);
    
    try {
        let fromCoords = null;
        let toCoords = null;
        let fromGtfsStops = null; // V49: Arrêts GTFS forcés pour les pôles multimodaux (tableau de stop_id)
        let toGtfsStops = null;
        
        // 🚀 V60: Résolution des coordonnées EN PARALLÈLE (PHASE 2c: Using new service)
        const coordsStart = performance.now();
        const apiFactory = getAPIServiceFactory();
        const [fromResult, toResult] = await Promise.all([
            apiFactory.getPlaceCoords(fromPlaceId).catch(e => { logger.warn('Coords départ error (Phase 2)', e); return null; }),
            apiFactory.getPlaceCoords(toPlaceId).catch(e => { logger.warn('Coords arrivée error (Phase 2)', e); return null; })
        ]);
        
        if (fromResult) {
            fromCoords = { lat: fromResult.lat, lng: fromResult.lng };
            if (fromResult.isMultiStop && fromResult.gtfsStops) {
                fromGtfsStops = fromResult.gtfsStops.map(s => s.stopId);
                logger.debug(`🎓 Pôle multimodal origine: ${fromGtfsStops.length} arrêts`);
            }
        }
        if (toResult) {
            toCoords = { lat: toResult.lat, lng: toResult.lng };
            if (toResult.isMultiStop && toResult.gtfsStops) {
                toGtfsStops = toResult.gtfsStops.map(s => s.stopId);
                logger.debug(`🎓 Pôle multimodal destination: ${toGtfsStops.length} arrêts`);
            }
        }
        logger.debug(`⚡ Coords résolues en ${Math.round(performance.now() - coordsStart)}ms`);

        const fromLabel = sourceElements.fromInput?.value || '';
        const toLabel = sourceElements.toInput?.value || '';

        // Routage via Google Routes API
        const routingStart = performance.now();
        
        let hybridItins = [];
        
        // GTFS Router (désactivé par défaut pour performances)
        if (ENABLE_GTFS_ROUTER && routerWorkerClient) {
            try {
                hybridItins = await routerWorkerClient.computeHybridItinerary({
                    fromCoords, toCoords, searchTime,
                    labels: { fromLabel, toLabel },
                    forcedStops: { from: fromGtfsStops, to: toGtfsStops }
                });
                logger.debug('🔍 GTFS local', { count: hybridItins?.length || 0 });
            } catch (e) {
                logger.warn('GTFS router error', e);
            }
        }

        // Backend principal (Google Routes via Vercel proxy - PHASE 2c: Using new service)
        // Note: apiFactory already declared above, reuse it
        const intelligentResults = await apiFactory.getBusRoute(fromPlaceId, toPlaceId, searchTime, fromCoords, toCoords)
            .catch(e => { logger.error('Erreur routage principal (Phase 2)', e); return null; });
        
        // V500: Récupérer aussi les trajets vélo en parallèle
        let bicycleItineraries = [];
        try {
            const bikeResult = await apiFactory.getBicycleRoute(fromPlaceId, toPlaceId, fromCoords, toCoords);
            if (bikeResult?.itineraries?.length) {
                bicycleItineraries = bikeResult.itineraries;
                logger.debug('🚴 Trajets vélo récupérés', { count: bicycleItineraries.length });
            }
        } catch (e) {
            logger.warn('Erreur récupération trajets vélo', e);
        }
        
        logger.debug(`⚡ Routage terminé en ${Math.round(performance.now() - routingStart)}ms`);

        // Traiter les résultats backend principal
        if (intelligentResults) {
            // V493: Détecter le format des résultats
            // Nouveau format RouteService: { routes: [...], itineraries: [...] }
            // Ancien format apiManager: { bus: { data: {...} }, recommendations: [...] }
            if (intelligentResults.routes || intelligentResults.itineraries) {
                // Nouveau format: traiter directement les routes Google
                const routes = intelligentResults.routes || intelligentResults.itineraries || [];
                logger.debug('📦 Format RouteService détecté', { routeCount: routes.length });
                allFetchedItineraries = processGoogleRoutesResponse({ routes });
            } else if (intelligentResults.recommendations) {
                // Ancien format: utiliser processIntelligentResults
                allFetchedItineraries = processIntelligentResults(intelligentResults, searchTime);
            } else {
                logger.warn('Format de résultat inconnu', intelligentResults);
                allFetchedItineraries = [];
            }
            logger.info('✅ Backend principal itineraries received', { count: allFetchedItineraries?.length || 0 });
            
            // Fusionner avec GTFS si disponible
            if (hybridItins?.length) {
                for (const gtfsIt of hybridItins) {
                    const isDuplicate = allFetchedItineraries.some(googleIt => 
                        googleIt.departureTime === gtfsIt.departureTime && 
                        googleIt.arrivalTime === gtfsIt.arrivalTime
                    );
                    if (!isDuplicate) allFetchedItineraries.push(gtfsIt);
                }
            }
            
            // V500: Fusionner les trajets vélo
            if (bicycleItineraries?.length) {
                for (const bikeRoute of bicycleItineraries) {
                    // Convertir le format Google Routes en format interne pour vélo
                    const bikeIt = {
                        type: 'BIKE',
                        _isBike: true,
                        departureTime: searchTime.hour + ':' + String(searchTime.minute).padStart(2, '0'),
                        arrivalTime: null,
                        duration: bikeRoute.duration ? parseInt(bikeRoute.duration.replace('s', '')) : null,
                        durationText: bikeRoute.duration ? Math.round(parseInt(bikeRoute.duration.replace('s', '')) / 60) + ' min' : null,
                        distance: bikeRoute.distanceMeters || null,
                        distanceText: bikeRoute.distanceMeters ? (bikeRoute.distanceMeters / 1000).toFixed(1) + ' km' : null,
                        polyline: bikeRoute.polyline?.encodedPolyline || null,
                        legs: [{
                            mode: 'BICYCLE',
                            duration: bikeRoute.duration ? parseInt(bikeRoute.duration.replace('s', '')) : 0,
                            distance: bikeRoute.distanceMeters || 0
                        }],
                        steps: []
                    };
                    // Calculer l'heure d'arrivée
                    if (bikeIt.duration) {
                        const depDate = new Date();
                        depDate.setHours(parseInt(searchTime.hour), parseInt(searchTime.minute), 0, 0);
                        depDate.setSeconds(depDate.getSeconds() + bikeIt.duration);
                        bikeIt.arrivalTime = String(depDate.getHours()).padStart(2, '0') + ':' + String(depDate.getMinutes()).padStart(2, '0');
                    }
                    allFetchedItineraries.push(bikeIt);
                }
                logger.debug('🚴 Trajets vélo ajoutés', { count: bicycleItineraries.length });
            }
        } else if (hybridItins?.length) {
            logger.info('🔄 Fallback GTFS itineraries', { count: hybridItins.length });
            allFetchedItineraries = hybridItins;
        } else {
            allFetchedItineraries = [];
            logger.warn('No itineraries found');
        }

        // Debug: vérifier si l'heure demandée correspond
        const heureDemandeMin = parseInt(searchTime.hour) * 60 + parseInt(searchTime.minute);
        logger.debug('Requested time', { 
            time: `${searchTime.hour}:${String(searchTime.minute).padStart(2,'0')}`
        });

        // Ensure every BUS step has a polyline (GTFS constructed or fallback)
        try {
            await ensureItineraryPolylines(allFetchedItineraries);
        } catch (e) {
            logger.warn('Erreur lors de l\'assurance des polylines', e);
        }

        // TOUJOURS filtrer les trajets dont le départ est passé (même en mode "arriver")
        // Mais seulement si la recherche est pour aujourd'hui
        allFetchedItineraries = filterExpiredDepartures(allFetchedItineraries, searchTime);
        
        // En mode "arriver", filtrer aussi les trajets qui arrivent APRÈS l'heure demandée
        if (searchTime.type === 'arriver') {
            const targetHour = parseInt(searchTime.hour) || 0;
            const targetMinute = parseInt(searchTime.minute) || 0;
            allFetchedItineraries = filterLateArrivals(allFetchedItineraries, targetHour, targetMinute);
        }
        
        // V64: Limiter vélo et piéton à un seul trajet de chaque
        // Ces modes n'ont pas d'horaires, un seul résultat suffit
        allFetchedItineraries = limitBikeWalkItineraries(allFetchedItineraries);

        // Debug: après filtrage
        logger.debug('After filtering', {
            mode: searchTime.type || 'partir',
            remaining: allFetchedItineraries?.length || 0
        });

        // V63: On ne déduplique PLUS - Google gère le ranking, on garde tous les horaires
        // const searchMode = searchTime.type || 'partir';
        // allFetchedItineraries = deduplicateItineraries(allFetchedItineraries, searchMode);
        
        logger.info('📊 Available itineraries', { count: allFetchedItineraries?.length || 0 });

        // V137b: Forcer un ordre croissant clair (départs les plus proches → plus éloignés)
        const heureDemandee = `${searchTime.hour}:${String(searchTime.minute).padStart(2,'0')}`;
        if (searchTime.type === 'arriver') {
            logger.info(`🎯 Mode ARRIVER: tri cible ${heureDemandee} (arrivée décroissante)`);
            const { rankArrivalItineraries } = await import('./itinerary/ranking.js');
            arrivalRankedAll = rankArrivalItineraries([...allFetchedItineraries], searchTime);
            arrivalRenderedCount = arrivalRankedAll.length; // Montrer tout, pas de pagination
        } else {
            logger.info(`🎯 Mode PARTIR: tri chrono croissant appliqué (base ${heureDemandee})`);
            allFetchedItineraries = sortItinerariesByDeparture(allFetchedItineraries);
            arrivalRankedAll = [];
            arrivalRenderedCount = 0;
        }
        
        logger.debug('Itineraries sorted', 
            allFetchedItineraries.slice(0, 5).map(it => ({
                dep: it.departureTime,
                arr: it.arrivalTime,
                dur: it.duration
            })));

        // Sauvegarder les trajets avec toutes les données enrichies (polylines, étapes, etc.)
        if (sourceElements?.fromInput && sourceElements?.toInput && allFetchedItineraries?.length) {
            const fromDisplayName = sourceElements.fromInput.value;
            const toDisplayName = sourceElements.toInput.value;
            if (fromDisplayName && toDisplayName) {
                const departureTimeLabel = allFetchedItineraries[0]?.departureTime || `${searchTime.hour}:${String(searchTime.minute).padStart(2, '0')}`;
                const cacheSearchTime = lastSearchTime || searchTime || null;
                addRecentJourney(fromDisplayName, toDisplayName, departureTimeLabel, allFetchedItineraries[0], allFetchedItineraries, cacheSearchTime);
            }
        }
        
        setupResultTabs(allFetchedItineraries);
        if (resultsRenderer) resultsRenderer.render('ALL');
        
        // PHASE 1: Emit search:complete event
        eventBus.emit('search:complete', { 
            itineraries: allFetchedItineraries,
            mode: searchTime.type,
            source 
        });
        
        stateManager.setState({
            search: {
                results: allFetchedItineraries,
                loading: false,
                error: null
            }
        }, 'search:complete');
        
        if (allFetchedItineraries.length > 0) {
            // V117: S'assurer que la carte est bien dimensionnée avant de dessiner
            if (resultsMapRenderer && resultsMapRenderer.map) {
                setTimeout(() => {
                    resultsMapRenderer.map.invalidateSize();
                    drawRouteOnResultsMap(allFetchedItineraries[0]);
                }, 100);
            } else {
                drawRouteOnResultsMap(allFetchedItineraries[0]);
            }
            // V60: Le bouton GO est maintenant intégré dans le bottom sheet de chaque itinéraire
        }
        
        // PHASE 1: Emit UI loading completion
        eventBus.emit('ui:loading', false);
        
    } catch (error) {
        logger.error("Échec de la recherche d'itinéraire", error);
        
        // PHASE 1: Emit search:error event
        eventBus.emit('search:error', { 
            message: `Impossible de calculer l'itinéraire. ${error.message}`,
            error 
        });
        
        stateManager.setState({
            search: {
                loading: false,
                error: error.message,
                results: []
            }
        }, 'search:error');
        
        if (resultsListContainer) {
            resultsListContainer.innerHTML = `<p class="results-message error">Impossible de calculer l'itinéraire. ${error.message}</p>`;
        }
        resultsModeTabs.classList.add('hidden');
        
        // PHASE 1: Emit UI loading completion
        eventBus.emit('ui:loading', false);
    }
}

/**
 * V60: Charge plus de départs en décalant l'heure de recherche
 * V95: Cache les itinéraires existants pour éviter les doublons + ne charge que des bus
 */
async function loadMoreDepartures() {
    if (!lastSearchTime || !fromPlaceId || !toPlaceId) {
        console.warn('loadMoreDepartures: pas de recherche précédente');
        return;
    }

    // V95: Créer un cache des signatures d'itinéraires existants pour éviter les doublons
    const existingSignatures = new Set();
    const existingDepartures = new Set();
    
    allFetchedItineraries.forEach(it => {
        // Signature basée sur la structure du trajet
        const sig = createItinerarySignature(it);
        existingSignatures.add(sig);
        // Aussi garder les heures de départ exactes
        if (it.departureTime && it.departureTime !== '~') {
            existingDepartures.add(it.departureTime);
        }
    });

    // Trouver le dernier départ bus pour commencer après
    const busItineraries = allFetchedItineraries.filter(it => it.type === 'BUS' || it.type === 'TRANSIT');
    let startHour, startMinute;
    
    // V203: Calcul robuste de la nouvelle heure avec gestion de la date
    let baseDateObj;
    if (!lastSearchTime.date || lastSearchTime.date === 'today' || lastSearchTime.date === "Aujourd'hui") {
        baseDateObj = new Date();
    } else {
        baseDateObj = new Date(lastSearchTime.date);
    }
    
    // Si on a trouvé un dernier départ, on l'utilise comme base
    // V209: On ajoute seulement +1 min car l'API Google ajoute déjà des décalages internes (+15/+30/+50)
    // Avant on ajoutait +5 min, ce qui créait des sauts d'horaire (7h26 → 9h22)
    if (busItineraries.length > 0) {
        const lastDep = busItineraries[busItineraries.length - 1].departureTime;
        const match = lastDep?.match(/(\d{1,2}):(\d{2})/);
        if (match) {
            const h = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            
            // Attention: si le dernier départ est le lendemain (ex: 00:15 alors qu'on cherchait 23:00)
            // Il faut ajuster la date. Simplification: on prend l'heure de lastSearchTime
            // Si lastDep < lastSearchTime, c'est probablement le lendemain
            
            baseDateObj.setHours(h, m + 1, 0, 0); // +1 min seulement (l'API ajoute déjà des décalages)
            
            // Si on passe de 23h à 00h, setHours gère le changement de jour automatiquement
            // MAIS il faut être sûr que baseDateObj était au bon jour avant
        } else {
             // Fallback
             baseDateObj.setHours(parseInt(lastSearchTime.hour), parseInt(lastSearchTime.minute) + 30, 0, 0);
        }
    } else {
        // Fallback: décaler de 30 minutes par rapport à la recherche initiale
        loadMoreOffset += 30;
        baseDateObj.setHours(parseInt(lastSearchTime.hour), parseInt(lastSearchTime.minute) + loadMoreOffset, 0, 0);
    }

    const year = baseDateObj.getFullYear();
    const month = String(baseDateObj.getMonth() + 1).padStart(2, '0');
    const day = String(baseDateObj.getDate()).padStart(2, '0');
    const newDateStr = `${year}-${month}-${day}`;

    const offsetSearchTime = {
        ...lastSearchTime,
        date: newDateStr, // Date mise à jour
        hour: String(baseDateObj.getHours()).padStart(2, '0'),
        minute: String(baseDateObj.getMinutes()).padStart(2, '0')
    };

    console.log(`🔄 Chargement + de départs à partir de ${offsetSearchTime.date} ${offsetSearchTime.hour}:${offsetSearchTime.minute}`);
    console.log(`📦 Cache: ${existingSignatures.size} signatures, ${existingDepartures.size} heures de départ`);

    try {
        // Appeler l'API avec le nouvel horaire (PHASE 2c: Using new service)
        const apiFactory = getAPIServiceFactory();
        const intelligentResults = await apiFactory.getBusRoute(fromPlaceId, toPlaceId, offsetSearchTime);
        
        // V499: Utiliser le même format que executeItinerarySearch
        let newItineraries = [];
        if (intelligentResults) {
            if (intelligentResults.routes || intelligentResults.itineraries) {
                const routes = intelligentResults.routes || intelligentResults.itineraries || [];
                newItineraries = processGoogleRoutesResponse({ routes });
            } else if (intelligentResults.recommendations) {
                newItineraries = processIntelligentResults(intelligentResults, offsetSearchTime);
            }
        }
        
        // V95: Filtrer strictement les nouveaux itinéraires
        const beforeFilter = newItineraries.length;
        newItineraries = newItineraries.filter(it => {
            // 1. Exclure TOUS les vélo et piéton (on les a déjà de la première recherche)
            if (it.type === 'BIKE' || it.type === 'WALK' || it._isBike || it._isWalk) {
                return false;
            }
            
            // V199: Suppression du filtrage par heure exacte (existingDepartures)
            // Cela bloquait les trajets différents partant à la même heure
            
            // 3. Exclure les trajets avec la même signature (même structure)
            const sig = createItinerarySignature(it);
            if (existingSignatures.has(sig)) {
                // Même structure mais peut-être horaire différent - vérifier l'heure
                // Si c'est vraiment le même trajet à la même heure, exclure
                return false;
            }
            
            return true;
        });
        
        console.log(`🔍 Filtrage: ${beforeFilter} → ${newItineraries.length} (${beforeFilter - newItineraries.length} doublons/vélo/piéton exclus)`);
        
        if (newItineraries.length === 0) {
            console.log('Aucun nouveau départ trouvé');
            // Afficher un message
            const btn = document.querySelector('.load-more-departures button');
            if (btn) {
                btn.innerHTML = 'Plus de départs disponibles';
                btn.disabled = true;
            }
            return;
        }

        console.log(`✅ ${newItineraries.length} nouveaux départs bus ajoutés`);
        
        // Ajouter les nouveaux itinéraires et mettre à jour le cache
        newItineraries.forEach(it => {
            const sig = createItinerarySignature(it);
            existingSignatures.add(sig);
            if (it.departureTime) existingDepartures.add(it.departureTime);
        });
        
        allFetchedItineraries = sortItinerariesByDeparture([...allFetchedItineraries, ...newItineraries]);
        
        // Re-rendre
        setupResultTabs(allFetchedItineraries);
        if (resultsRenderer) resultsRenderer.render('ALL');
        
        // Réactiver le bouton
        const btn = document.querySelector('.load-more-departures button');
        if (btn) {
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                Charger + de départs
            `;
            btn.disabled = false;
        }
        
    } catch (error) {
        console.error('Erreur chargement + de départs:', error);
        const btn = document.querySelector('.load-more-departures button');
        if (btn) {
            btn.innerHTML = 'Erreur - Réessayer';
            btn.disabled = false;
        }
    }
}

/**
 * V95: Crée une signature unique pour un itinéraire basée sur sa structure
 * Permet de détecter les doublons même avec des horaires différents
 */
function createItinerarySignature(it) {
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

    // V137b: Parse HH:MM safely and return minutes (Infinity if invalid)
    function parseDepartureMinutes(timeStr) {
        const match = timeStr?.match?.(/(\d{1,2}):(\d{2})/);
        if (!match) return Infinity;
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        if (Number.isNaN(h) || Number.isNaN(m)) return Infinity;
        return h * 60 + m;
    }

    // V139: Parse HH:MM to seconds (Infinity if invalid)
    function parseTimeToSeconds(timeStr) {
        const match = timeStr?.match?.(/(\d{1,2}):(\d{2})/);
        if (!match) return Infinity;
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        if (Number.isNaN(h) || Number.isNaN(m)) return Infinity;
        return h * 3600 + m * 60;
    }

    // V142: Garantit un ordre chronologique croissant (proche → lointain)
    // MAIS conserve les groupes par type: BUS d'abord, puis BIKE, puis WALK
    function sortItinerariesByDeparture(list) {
        // Séparer par type
        const busItins = list.filter(it => it.type !== 'BIKE' && it.type !== 'WALK' && !it._isBike && !it._isWalk);
        const bikeItins = list.filter(it => it.type === 'BIKE' || it._isBike);
        const walkItins = list.filter(it => it.type === 'WALK' || it._isWalk);
        
        // Trier seulement les bus par heure de départ
        busItins.sort((a, b) => parseDepartureMinutes(a?.departureTime) - parseDepartureMinutes(b?.departureTime));
        
        // Recomposer: BUS triés, puis BIKE, puis WALK
        return [...busItins, ...bikeItins, ...walkItins];
    }

/**
 * V132: Charge plus de trajets pour le mode "arriver"
 * Recherche des trajets arrivant plus tôt que ceux déjà affichés
 */
async function loadMoreArrivals() {
    if (!lastSearchTime || !fromPlaceId || !toPlaceId || lastSearchTime.type !== 'arriver') {
        console.warn('loadMoreArrivals: pas de recherche arriver précédente');
        return;
    }

    // Créer un cache des signatures d'itinéraires existants
    const existingSignatures = new Set();
    const existingArrivals = new Set();
    
    allFetchedItineraries.forEach(it => {
        const sig = createItinerarySignature(it);
        existingSignatures.add(sig);
        if (it.arrivalTime && it.arrivalTime !== '~') {
            existingArrivals.add(it.arrivalTime);
        }
    });

    // V203: Calcul robuste de la nouvelle heure avec gestion de la date (Arriver)
    let baseDateObj;
    if (!lastSearchTime.date || lastSearchTime.date === 'today' || lastSearchTime.date === "Aujourd'hui") {
        baseDateObj = new Date();
    } else {
        baseDateObj = new Date(lastSearchTime.date);
    }

    // Trouver l'arrivée la plus tôt parmi les bus pour chercher encore plus tôt
    const busItineraries = allFetchedItineraries.filter(it => it.type === 'BUS' || it.type === 'TRANSIT');
    
    if (busItineraries.length > 0) {
        let earliestArrival = Infinity;
        busItineraries.forEach(it => {
            const match = it.arrivalTime?.match(/(\d{1,2}):(\d{2})/);
            if (match) {
                const mins = parseInt(match[1]) * 60 + parseInt(match[2]);
                if (mins < earliestArrival) earliestArrival = mins;
            }
        });
        
        if (earliestArrival !== Infinity) {
            // On recule de 30 minutes
            // Attention: earliestArrival est en minutes depuis minuit.
            // Il faut gérer le passage au jour précédent si < 0
            // Simplification: on utilise setHours sur l'objet Date
            
            const h = Math.floor(earliestArrival / 60);
            const m = earliestArrival % 60;
            
            baseDateObj.setHours(h, m - 30, 0, 0);
        } else {
             baseDateObj.setHours(parseInt(lastSearchTime.hour) - 1, parseInt(lastSearchTime.minute), 0, 0);
        }
    } else {
        // Fallback: décaler de 1h en arrière
        baseDateObj.setHours(parseInt(lastSearchTime.hour) - 1, parseInt(lastSearchTime.minute), 0, 0);
    }

    const year = baseDateObj.getFullYear();
    const month = String(baseDateObj.getMonth() + 1).padStart(2, '0');
    const day = String(baseDateObj.getDate()).padStart(2, '0');
    const newDateStr = `${year}-${month}-${day}`;

    const offsetSearchTime = {
        ...lastSearchTime,
        date: newDateStr,
        hour: String(baseDateObj.getHours()).padStart(2, '0'),
        minute: String(baseDateObj.getMinutes()).padStart(2, '0')
    };

    console.log(`🔄 Chargement + d'arrivées (cible ${offsetSearchTime.date} ${offsetSearchTime.hour}:${offsetSearchTime.minute})`);
    console.log(`📦 Cache: ${existingSignatures.size} signatures, ${existingArrivals.size} heures d'arrivée`);

    try {
        const apiFactory = getAPIServiceFactory();
        const intelligentResults = await apiFactory.getBusRoute(fromPlaceId, toPlaceId, offsetSearchTime);
        
        // V499: Utiliser le même format que executeItinerarySearch
        let newItineraries = [];
        if (intelligentResults) {
            if (intelligentResults.routes || intelligentResults.itineraries) {
                const routes = intelligentResults.routes || intelligentResults.itineraries || [];
                newItineraries = processGoogleRoutesResponse({ routes });
            } else if (intelligentResults.recommendations) {
                newItineraries = processIntelligentResults(intelligentResults, offsetSearchTime);
            }
        }
        
        // Filtrer les nouveaux itinéraires
        const beforeFilter = newItineraries.length;
        newItineraries = newItineraries.filter(it => {
            // Exclure vélo et piéton
            if (it.type === 'BIKE' || it.type === 'WALK' || it._isBike || it._isWalk) {
                return false;
            }
            
            // V199: Suppression du filtrage par heure exacte (existingArrivals)
            
            // Exclure les trajets avec la même signature
            const sig = createItinerarySignature(it);
            if (existingSignatures.has(sig)) {
                return false;
            }
            
            return true;
        });
        
        console.log(`🔍 Filtrage: ${beforeFilter} → ${newItineraries.length} nouveaux trajets`);
        
        if (newItineraries.length === 0) {
            console.log('Aucun nouveau trajet arrivée trouvé');
            const btn = document.querySelector('.load-more-arrivals button');
            if (btn) {
                btn.innerHTML = 'Plus de trajets disponibles';
                btn.disabled = true;
            }
            return;
        }

        console.log(`✅ ${newItineraries.length} nouveaux trajets arrivée ajoutés`);
        
        // Ajouter les nouveaux itinéraires
        newItineraries.forEach(it => {
            const sig = createItinerarySignature(it);
            existingSignatures.add(sig);
            if (it.arrivalTime) existingArrivals.add(it.arrivalTime);
        });
        
        allFetchedItineraries = [...allFetchedItineraries, ...newItineraries];
        
        // Re-trier et mettre à jour arrivalRankedAll
        const { rankArrivalItineraries } = await import('./itinerary/ranking.js');
        arrivalRankedAll = rankArrivalItineraries([...allFetchedItineraries], lastSearchTime);
        arrivalRenderedCount = arrivalRankedAll.length; // Montrer tout, pas de pagination
        
        // Re-rendre
        setupResultTabs(allFetchedItineraries);
        if (resultsRenderer) resultsRenderer.render('ALL');
        
        // Réactiver le bouton
        const btn = document.querySelector('.load-more-arrivals button');
        if (btn) {
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                Générer + de trajets
            `;
            btn.disabled = false;
        }
        
    } catch (error) {
        console.error('Erreur chargement + d\'arrivées:', error);
        const btn = document.querySelector('.load-more-arrivals button');
        if (btn) {
            btn.innerHTML = 'Erreur - Réessayer';
            btn.disabled = false;
        }
    }
}

function prefillOtherPlanner(sourceFormName, sourceElements) {
    let targetElements;
    if (sourceFormName === 'hall') {
        targetElements = {
            fromInput: resultsFromInput, toInput: resultsToInput,
            dateSelect: resultsDate, hourSelect: resultsHour, minuteSelect: resultsMinute,
            whenBtn: resultsWhenBtn, popover: resultsPopover, popoverSubmitBtn: resultsPopoverSubmitBtn
        };
    } else {
        targetElements = {
            fromInput: hallFromInput, toInput: hallToInput,
            dateSelect: hallDate, hourSelect: hallHour, minuteSelect: hallMinute,
            whenBtn: hallWhenBtn, popover: hallPopover, popoverSubmitBtn: hallPopoverSubmitBtn
        };
    }
    targetElements.fromInput.value = sourceElements.fromInput.value;
    targetElements.toInput.value = sourceElements.toInput.value;
    targetElements.dateSelect.value = sourceElements.dateSelect.value;
    targetElements.hourSelect.value = sourceElements.hourSelect.value;
    targetElements.minuteSelect.value = sourceElements.minuteSelect.value;
    if (uiManager && typeof uiManager.syncEnhancedTimeSelect === 'function') {
        uiManager.syncEnhancedTimeSelect(targetElements.hourSelect);
        uiManager.syncEnhancedTimeSelect(targetElements.minuteSelect);
    }
    const sourceActiveTab = sourceElements.popover.querySelector('.popover-tab.active').dataset.tab;
    targetElements.popover.querySelectorAll('.popover-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === sourceActiveTab);
    });
    targetElements.whenBtn.querySelector('span').textContent = sourceElements.whenBtn.querySelector('span').textContent;
    targetElements.popoverSubmitBtn.textContent = (sourceActiveTab === 'arriver') ? "Valider l'arrivée" : 'Partir maintenant';
}

// Debounce pour l'autocomplétion
let autocompleteTimeout = null;
const AUTOCOMPLETE_DEBOUNCE_MS = 150;

async function handleAutocomplete(query, container, onSelect, inputElement = null) {
    // Annuler la requête précédente
    if (autocompleteTimeout) {
        clearTimeout(autocompleteTimeout);
    }
    
    // Stocker l'input associé au container (critique pour éviter le bug de remplacement)
    if (inputElement) {
        container._associatedInput = inputElement;
    }
    
    if (query.length < 2) {
        container.innerHTML = '';
        container.style.display = 'none';
        onSelect(null); 
        return;
    }
    
    // Debounce: attendre que l'utilisateur arrête de taper
    autocompleteTimeout = setTimeout(async () => {
        try {
            const apiFactory = getAPIServiceFactory();
            const result = await apiFactory.getPlacePredictions(query);
            // V491: getPlacePredictions renvoie { predictions: [...], status: '...' }
            const suggestions = result?.predictions || [];
            renderSuggestions(suggestions, container, onSelect);
        } catch (error) {
            console.warn("Erreur d'autocomplétion:", error);
            container.style.display = 'none';
        }
    }, AUTOCOMPLETE_DEBOUNCE_MS);
}

function renderSuggestions(suggestions, container, onSelect) {
    container.innerHTML = '';
    if (suggestions.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Utiliser l'input stocké (priorité) ou fallback sur la recherche DOM
    const resolveInputElement = () => {
        // Priorité: input explicitement associé (évite le bug de remplacement)
        if (container._associatedInput) {
            return container._associatedInput;
        }
        // Fallback: chercher dans le DOM (peut échouer si container déplacé)
        if (!container) return null;
        let sibling = container.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === 'INPUT') return sibling;
            if (typeof sibling.querySelector === 'function') {
                const nested = sibling.querySelector('input');
                if (nested) return nested;
            }
            sibling = sibling.previousElementSibling;
        }
        let parent = container.parentElement;
        while (parent) {
            const nested = parent.querySelector('input');
            if (nested) return nested;
            parent = parent.parentElement;
        }
        return null;
    };

    const inputElement = resolveInputElement();
    // Mobile-specific behavior: keep suggestions under the input inside its wrapper
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const isResultsPlanner = container && (container.id === 'results-from-suggestions' || container.id === 'results-to-suggestions');

    let positionSuggestionsOverInput = () => {};

    if (isMobile && isResultsPlanner) {
        // Do NOT move to body; let CSS position them absolutely under the input
        try {
            if (container && container.parentElement !== null) {
                // Ensure local stacking and dimensions are controlled by CSS
                container.style.position = 'absolute';
                container.style.left = '';
                container.style.right = '';
                container.style.top = '';
                container.style.bottom = '';
                container.style.width = '';
                container.style.zIndex = '30000';
                container.style.pointerEvents = 'auto';
            }
        } catch (e) {
            // ignore
        }
        // No JS positioning; CSS handles placement below the input
        positionSuggestionsOverInput = () => {};
    } else {
        // Desktop or hall view: move to body to escape stacking contexts
        try {
            if (container && container.parentElement !== document.body) {
                document.body.appendChild(container);
                container.style.zIndex = '20000';
                container.style.pointerEvents = 'auto';
            }
        } catch (e) {
            // ignore failures to move
        }
        // Ensure container is positioned relative to the input (use fixed to escape stacking contexts)
        positionSuggestionsOverInput = () => {
            if (!inputElement || !container) return;
            try {
                const rect = inputElement.getBoundingClientRect();
                container.style.position = 'fixed';
                container.style.left = `${rect.left}px`;
                container.style.top = `${rect.bottom}px`;
                container.style.width = `${rect.width}px`;
                container.style.right = 'auto';
            } catch (e) {
                // ignore positioning errors
            }
        };
    }

    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        const mainText = suggestion.description.split(',')[0];
        const secondaryText = suggestion.description.substring(mainText.length);
        item.innerHTML = `<strong>${mainText}</strong>${secondaryText}`;
        item.addEventListener('click', (ev) => {
            // Prevent clicks from bubbling to underlying elements (no click-through)
            ev.stopPropagation();
            ev.preventDefault();
            if (inputElement) {
                inputElement.value = suggestion.description;
                // Move focus back to input for accessibility
                try { inputElement.focus(); } catch (e) {}
            }
            // V313: En mode OTP/Photon, les coordonnées sont directement dans la suggestion
            // On passe l'objet coordinates si disponible, sinon le placeId Google
            const selectionValue = suggestion.coordinates || suggestion.placeId;
            console.log('[renderSuggestions] Sélection:', suggestion.description, '→', selectionValue);
            onSelect(selectionValue); 
            container.innerHTML = '';
            container.style.display = 'none';
            // run cleanup if any
            try { if (container._suggestionsCleanup) container._suggestionsCleanup(); } catch (e) {}
        });
        container.appendChild(item);
    });
    // Position and show
    positionSuggestionsOverInput();
    // Reposition on viewport resize/scroll while visible
    const onWindowChange = () => positionSuggestionsOverInput();
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    container.style.display = 'block';

    // Cleanup listeners when suggestions are hidden by other logic
    const cleanup = () => {
        window.removeEventListener('resize', onWindowChange);
        window.removeEventListener('scroll', onWindowChange, true);
    };
    // attach cleanup to container dataset so other code can call it if needed
    container._suggestionsCleanup = cleanup;
}

function processGoogleRoutesResponse(data) {
    if (!data || !data.routes || data.routes.length === 0) {
        console.warn("Réponse de l'API Routes (BUS) vide ou invalide.");
        return [];
    }

    const normalizeHexColor = (value, fallback) => {
        if (!value) return fallback;
        const raw = String(value).trim();
        if (!raw) return fallback;
        const hex = raw.startsWith('#') ? raw.slice(1) : raw;
        if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toUpperCase()}`;
        return fallback;
    };

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
                        type: 'WALK', icon: ICONS.WALK, instruction: "Marche",
                        subSteps: [], polylines: [], totalDuration: 0, totalDistanceMeters: 0,
                        departureTime: "--:--", arrivalTime: "--:--"
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
                    // V199: Désactivation du filtrage strict "Ligne non-locale"
                    // On accepte tout ce que Google renvoie, sauf si c'est explicitement TER ou 322
                    if (shortName === 'TER' || shortName === '322') {
                         console.warn(`[Filtre] Trajet rejeté: Ligne interdite ("${shortName}") détectée.`);
                         isRegionalRoute = true;
                    } else if (dataManager && dataManager.isLoaded && !dataManager.routesByShortName[shortName]) {
                        console.log(`⚠️ V199: Ligne inconnue du GTFS ("${shortName}") mais conservée.`);
                    }
                    
                    const color = normalizeHexColor(line.color, '#3388FF');
                    const textColor = normalizeHexColor(line.textColor, '#FFFFFF');
                    const departureStop = stopDetails.departureStop || {};
                    const arrivalStop = stopDetails.arrivalStop || {};
                    let intermediateStops = (stopDetails.intermediateStops || []).map(stop => stop.name || 'Arrêt inconnu');
                    
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
                        type: 'BUS', icon: ICONS.BUS, routeShortName: shortName, routeColor: color, routeTextColor: textColor,
                        instruction: `Prendre le <b>${shortName}</b> direction <b>${transit.headsign || 'destination'}</b>`,
                        departureStop: departureStop.name || 'Arrêt de départ', departureTime: depTime,
                        arrivalStop: arrivalStop.name || 'Arrêt d\'arrivée', arrivalTime: arrTime,
                        numStops: transit.stopCount || 0, intermediateStops: intermediateStops,
                        duration: formatGoogleDuration(step.staticDuration), polyline: step.polyline
                        , durationRaw: rawDuration
                    });
                }
            }
        }
        
        if (isRegionalRoute) return null;

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
        
        if (itinerary.steps.length > 0) {
            const firstStepWithTime = itinerary.steps.find(s => s.departureTime && s.departureTime !== "--:--");
            itinerary.departureTime = firstStepWithTime ? firstStepWithTime.departureTime : (itinerary.steps[0].departureTime || "--:--");
            const lastStepWithTime = [...itinerary.steps].reverse().find(s => s.arrivalTime && s.arrivalTime !== "--:--");
            itinerary.arrivalTime = lastStepWithTime ? lastStepWithTime.arrivalTime : (itinerary.steps[itinerary.steps.length - 1].arrivalTime || "--:--");
        }
                
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
        const computedDurationSeconds = itinerary.steps.reduce((total, step) => {
            const value = typeof step?.durationRaw === 'number' ? step.durationRaw : 0;
            return total + (Number.isFinite(value) ? value : 0);
        }, 0);
        if (computedDurationSeconds > 0) {
            itinerary.durationRaw = computedDurationSeconds;
            itinerary.duration = formatGoogleDuration(`${computedDurationSeconds}s`);
        }

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

        if (!hasBusSegment) {
            const legDepartureTime = leg.localizedValues?.departureTime?.time?.text || leg.startTime?.text || "--:--";
            const legArrivalTime = leg.localizedValues?.arrivalTime?.time?.text || leg.endTime?.text || "--:--";
            itinerary.type = 'WALK';
            itinerary.summarySegments = [];
            itinerary._isWalk = true;
            if (legDepartureTime && legDepartureTime !== "--:--") {
                itinerary.departureTime = legDepartureTime;
                if (itinerary.steps.length) {
                    const firstStep = itinerary.steps[0];
                    if (!firstStep.departureTime || firstStep.departureTime === '--:--') {
                        firstStep.departureTime = legDepartureTime;
                    }
                }
            }
            if (legArrivalTime && legArrivalTime !== "--:--") {
                itinerary.arrivalTime = legArrivalTime;
                if (itinerary.steps.length) {
                    const lastStep = itinerary.steps[itinerary.steps.length - 1];
                    if (!lastStep.arrivalTime || lastStep.arrivalTime === '--:--') {
                        lastStep.arrivalTime = legArrivalTime;
                    }
                }
            }
        } else {
            itinerary.summarySegments = allSummarySegments.filter(segment => segment.type === 'BUS');
        }
        return itinerary;
    }).filter(itinerary => itinerary !== null);
}

// (Déduplication déplacée vers itinerary/ranking.js)

function processIntelligentResults(intelligentResults, searchTime) {
    console.log("=== DÉBUT PROCESS INTELLIGENT RESULTS ===");
    console.log("📥 Mode de recherche:", searchTime?.type || 'partir');
    console.log("📥 Heure demandée:", `${searchTime?.hour}:${String(searchTime?.minute || 0).padStart(2,'0')}`);
    
    const itineraries = [];
    const sortedRecommendations = [...intelligentResults.recommendations].sort((a, b) => b.score - a.score);

    // 1. Extraction des résultats Google
    sortedRecommendations.forEach(rec => {
        let modeData = null;
        let modeInfo = null;
        if (rec.mode === 'bus' && intelligentResults.bus) {
            modeData = intelligentResults.bus.data;
            modeInfo = intelligentResults.bus;
        } else if (rec.mode === 'bike' && intelligentResults.bike) {
            modeData = intelligentResults.bike.data;
            modeInfo = intelligentResults.bike;
        } else if (rec.mode === 'walk' && intelligentResults.walk) {
            modeData = intelligentResults.walk.data;
            modeInfo = intelligentResults.walk;
        }

        if (modeData && modeInfo) {
            if (rec.mode === 'bus') {
                const busItineraries = processGoogleRoutesResponse(modeData);
                if (busItineraries.length > 0) {
                    busItineraries.forEach((itin, index) => {
                        itin.score = rec.score - index;
                        if (!itin.type) itin.type = 'BUS';
                    });
                }
                itineraries.push(...busItineraries);
            } else {
                const simpleItinerary = processSimpleRoute(modeData, rec.mode, modeInfo, searchTime);
                if (simpleItinerary) {
                    simpleItinerary.score = rec.score;
                    if (rec.mode === 'bike' && simpleItinerary.type !== 'BIKE') simpleItinerary.type = 'BIKE';
                    if (rec.mode === 'walk' && simpleItinerary.type !== 'WALK') simpleItinerary.type = 'WALK';
                    itineraries.push(simpleItinerary);
                }
            }
        }
    });
    
    // Debug: afficher tous les itinéraires bruts AVANT filtrage (OTP/Oracle format Google-like)
    console.log("📋 Itinéraires bruts (avant filtrage):", itineraries.map(it => ({
        type: it.type,
        dep: it.departureTime,
        arr: it.arrivalTime,
        dur: it.duration
    })));

    // V193: FILTRAGE DES BUS GOOGLE PAR JOUR DE SERVICE GTFS
    // Vérifie que les lignes retournées par Google circulent bien ce jour-là
    if (dataManager && dataManager.isLoaded) {
        let searchDate;
        if (!searchTime?.date || searchTime.date === 'today' || searchTime.date === "Aujourd'hui") {
            searchDate = new Date();
        } else {
            searchDate = new Date(searchTime.date);
        }
        
        // V194: Ajouter l'heure pour que la date soit complète
        if (searchTime?.hour !== undefined) {
            searchDate.setHours(parseInt(searchTime.hour) || 0, parseInt(searchTime.minute) || 0, 0, 0);
        }
        
        const activeServiceIds = dataManager.getServiceIds(searchDate);
        const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const dayName = dayNames[searchDate.getDay()];
        console.log(`📅 V194: Vérification pour ${dayName} ${searchDate.toLocaleDateString()} - ${activeServiceIds.size} services actifs`);
        console.log(`📅 V194: Services actifs:`, Array.from(activeServiceIds));
        
        if (activeServiceIds.size === 0) {
            console.warn(`⚠️ V194: AUCUN SERVICE ACTIF pour ${dayName} - Les bus ne circulent peut-être pas (GTFS local)`);
            // V199: On ne supprime plus les bus, on fait confiance à Google
            console.log(`⚠️ V199: Conservation des itinéraires Google malgré l'absence de services locaux`);
        } else {
            // Construire un Set des lignes actives ce jour-là
            const activeLinesThisDay = new Set();
            for (const trip of dataManager.trips) {
                const isActive = Array.from(activeServiceIds).some(sid => 
                    dataManager.serviceIdsMatch(trip.service_id, sid)
                );
                if (isActive) {
                    const route = dataManager.getRoute(trip.route_id);
                    if (route?.route_short_name) {
                        activeLinesThisDay.add(route.route_short_name.toUpperCase());
                        // V194: Ajouter aussi sans espaces et avec variations
                        activeLinesThisDay.add(route.route_short_name.toUpperCase().replace(/\s+/g, ''));
                    }
                }
            }
            console.log(`🚍 V194: Lignes actives ${dayName}:`, Array.from(activeLinesThisDay).sort().join(', '));
            
            // Filtrer les itinéraires bus Google
            const beforeCount = itineraries.filter(it => it.type === 'BUS').length;
            const filteredItineraries = itineraries.filter(itin => {
                if (itin.type !== 'BUS') return true; // Garder vélo et marche
                
                // Extraire les noms de lignes depuis l'itinéraire
                const lineNames = new Set();
                if (itin.summarySegments) {
                    itin.summarySegments.forEach(seg => {
                        if (seg.name) {
                            lineNames.add(seg.name.toUpperCase());
                            lineNames.add(seg.name.toUpperCase().replace(/\s+/g, ''));
                        }
                    });
                }
                if (itin.steps) {
                    itin.steps.forEach(step => {
                        if (step.type === 'BUS' && step.lineName) {
                            lineNames.add(step.lineName.toUpperCase());
                            lineNames.add(step.lineName.toUpperCase().replace(/\s+/g, ''));
                        }
                        // V194: Aussi vérifier routeShortName
                        if (step.type === 'BUS' && step.routeShortName) {
                            lineNames.add(step.routeShortName.toUpperCase());
                        }
                    });
                }
                
                // Vérifier si au moins une ligne est active
                const hasActiveLine = Array.from(lineNames).some(name => activeLinesThisDay.has(name));
                
                if (!hasActiveLine && lineNames.size > 0) {
                    console.log(`⚠️ V199: Lignes [${Array.from(lineNames).join(', ')}] non trouvées dans GTFS local pour ${dayName}, mais conservées (Google First)`);
                    // return false; // V199: On ne filtre plus
                }
                
                // Si pas de nom de ligne trouvé, on garde par prudence
                if (lineNames.size === 0) {
                    console.warn(`⚠️ V194: Itinéraire sans nom de ligne, conservé par défaut`);
                }
                return true;
            });
            
            const afterCount = filteredItineraries.filter(it => it.type === 'BUS').length;
            if (beforeCount !== afterCount) {
                console.log(`📊 V194: ${beforeCount - afterCount} itinéraire(s) bus rejeté(s) (hors service ${dayName})`);
            }
            
            // Remplacer itineraries par la version filtrée
            itineraries.length = 0;
            itineraries.push(...filteredItineraries);
        }
    }

    // 2. LOGIQUE DE FENÊTRE TEMPORELLE (Horaire Arrivée)
    try {
        if (searchTime && searchTime.type === 'arriver') {
            // A. Définir la cible
            let reqDate = null;
            if (!searchTime.date || searchTime.date === 'today' || searchTime.date === "Aujourd'hui") {
                reqDate = new Date();
            } else {
                reqDate = new Date(searchTime.date);
            }
            const reqHour = parseInt(searchTime.hour) || 0;
            const reqMinute = parseInt(searchTime.minute) || 0;
            reqDate.setHours(reqHour, reqMinute, 0, 0);
            const reqMs = reqDate.getTime();

            // B. Fenêtre élargie : on accepte les arrivées jusqu'à 4h AVANT l'heure demandée
            // Le tri ensuite classera par proximité à l'heure cible
            const BEFORE_MINUTES = 240; // 4h de fenêtre en amont pour avoir plus de choix
            const windowStart = reqMs - BEFORE_MINUTES * 60 * 1000;
            const windowEnd = reqMs; // pas de trajets après l'heure demandée

            console.log(`🕒 Cible: ${reqDate.toLocaleTimeString()} | Fenêtre: ${new Date(windowStart).toLocaleTimeString()} → ${new Date(windowEnd).toLocaleTimeString()} ( -${BEFORE_MINUTES}min / +0min )`);

            const busItins = itineraries.filter(i => i.type === 'BUS' && i.arrivalTime && i.arrivalTime !== '~' && i.arrivalTime !== '--:--');
            const otherItins = itineraries.filter(i => i.type !== 'BUS');

            // Parser l'heure d'arrivée (HH:MM) en Timestamp
            const parseArrivalMs = (arrivalStr) => {
                if (!arrivalStr || typeof arrivalStr !== 'string') return NaN;
                const m = arrivalStr.match(/(\d{1,2}):(\d{2})/);
                if (!m) return NaN;
                const hh = parseInt(m[1], 10);
                const mm = parseInt(m[2], 10);
                const d = new Date(reqDate);
                d.setHours(hh, mm, 0, 0);
                return d.getTime();
            };

            const busWithMs = busItins.map(i => ({ itin: i, arrivalMs: parseArrivalMs(i.arrivalTime) })).filter(x => !isNaN(x.arrivalMs));

            // C. Filtrer les bus Google qui sont DANS la fenêtre
            let filteredBus = busWithMs
                .filter(x => x.arrivalMs >= windowStart && x.arrivalMs <= windowEnd)
                .map(x => x.itin);

            console.log(`🚌 Bus Google trouvés dans la fenêtre : ${filteredBus.length} sur ${busItins.length} total`);
            if (busWithMs.length > filteredBus.length) {
                const exclus = busWithMs.filter(x => x.arrivalMs < windowStart || x.arrivalMs > windowEnd);
                console.log(`📅 Bus exclus (hors fenêtre):`, exclus.map(x => ({ arr: x.itin.arrivalTime, ms: x.arrivalMs })));
            }

            // D. INJECTION GTFS (Data locale) pour compléter
            // ON SUPPRIME LA LIMITE "TARGET_BUS_COUNT" pour prendre TOUT ce qui existe.
            
            let gtfsAdded = [];
            let candidateStopIds = new Set();
            if (dataManager && dataManager.isLoaded) {
                console.log("📂 Recherche dans les données GTFS locales...");
                
                const normalize = (name) => {
                    if (!name) return "";
                    return name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/g, '').trim();
                };

                // Récupérer les noms d'arrêts d'arrivée depuis Google pour savoir où chercher
                const candidateNames = new Set();
                busItins.forEach(it => {
                    if (!it.steps) return;
                    const lastBusStep = [...it.steps].reverse().find(s => s.type === 'BUS');
                    if (lastBusStep && lastBusStep.arrivalStop) candidateNames.add(lastBusStep.arrivalStop);
                });

                candidateStopIds = new Set();
                candidateNames.forEach(n => {
                    const key = normalize(n);
                    if (dataManager.stopsByName && dataManager.stopsByName[key]) {
                        dataManager.stopsByName[key].forEach(s => candidateStopIds.add(s.stop_id));
                    } else {
                        // Fallback recherche large
                        dataManager.stops.forEach(s => {
                            if (normalize(s.stop_name || '').includes(key)) candidateStopIds.add(s.stop_id);
                        });
                    }
                });
                
                // Si Google n'a rien donné, on cherche "Tourny" ou "Gare" par défaut (optionnel)
                if (candidateStopIds.size === 0) {
                     console.warn("⚠️ Aucun arrêt candidat trouvé via Google, recherche GTFS impossible.");
                } else {
                    console.log(`📍 Arrêts candidats GTFS (IDs):`, Array.from(candidateStopIds));
                }

                const serviceIdSet = dataManager.getServiceIds(new Date(reqDate));
                const seenKeys = new Set(); // Pour éviter les doublons exacts

                // Ajouter les clés des bus Google déjà trouvés pour ne pas les dupliquer
                filteredBus.forEach(b => {
                    seenKeys.add(`${b.summarySegments[0]?.name}_${b.arrivalTime}`);
                });

                // PARCOURS GTFS
                for (const stopId of candidateStopIds) {
                    const stopTimes = dataManager.stopTimesByStop[stopId] || [];
                    
                    for (const st of stopTimes) {
                        const trip = dataManager.tripsByTripId[st.trip_id];
                        if (!trip) continue;

                        // Vérif Service (Jour de la semaine)
                        const isServiceActive = Array.from(serviceIdSet).some(sid => dataManager.serviceIdsMatch(trip.service_id, sid));
                        if (!isServiceActive) continue;

                        const arrTimeStr = st.arrival_time || st.departure_time;
                        const seconds = dataManager.timeToSeconds(arrTimeStr);
                        
                        // Calcul du Timestamp Arrivée GTFS
                        const d = new Date(reqDate);
                        const hours = Math.floor(seconds / 3600);
                        const mins = Math.floor((seconds % 3600) / 60);
                        d.setHours(hours, mins, 0, 0);
                        const arrMs = d.getTime();

                        // === TEST CRITIQUE DE LA FENÊTRE ===
                        if (arrMs >= windowStart && arrMs <= windowEnd) {
                            
                            const route = dataManager.getRoute(trip.route_id) || {};
                            const routeName = route.route_short_name || trip.route_id;
                            const key = `${routeName}_${dataManager.formatTime(seconds)}`;

                            if (!seenKeys.has(key)) {
                                seenKeys.add(key); // Marquer comme vu

                                // Création de l'itinéraire GTFS enrichi (noms lisibles, horaires, polylines via shapes)
                                                const stopTimesList = dataManager.getStopTimes(st.trip_id) || [];
                                                const alightIndex = stopTimesList.findIndex(s => s.stop_id === st.stop_id);

                                                // Determine boardingIndex robustly:
                                                // 1) Prefer a stop that matches any origin candidate stop IDs (if available)
                                                // 2) Otherwise, pick the nearest predecessor before alightIndex (within a small window)
                                                let boardingIndex = null;
                                                // Déclarer originCandidateIds en dehors du try pour qu'il soit accessible plus bas
                                                let originCandidateIds = new Set();
                                                try {
                                                    // Build origin candidate IDs from the current Google results (departure stops)
                                                    const originCandidateNames = new Set();
                                                    busItins.forEach(bi => {
                                                        if (!bi.steps) return;
                                                        const firstBusStep = [...bi.steps].find(s => s.type === 'BUS');
                                                        if (firstBusStep && firstBusStep.departureStop) originCandidateNames.add(firstBusStep.departureStop);
                                                    });
                                                    originCandidateNames.forEach(n => {
                                                        const key = (n || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/g, '').trim();
                                                        if (dataManager.stopsByName && dataManager.stopsByName[key]) {
                                                            dataManager.stopsByName[key].forEach(s => originCandidateIds.add(s.stop_id));
                                                        } else {
                                                            dataManager.stops.forEach(s => { if ((s.stop_name||'').toLowerCase().includes((n||'').toLowerCase())) originCandidateIds.add(s.stop_id); });
                                                        }
                                                    });
                                                        // Expand candidates via groupedStopMap (include station complexes)
                                                        if (dataManager.groupedStopMap) {
                                                            const toAdd = new Set();
                                                            originCandidateIds.forEach(id => {
                                                                if (dataManager.groupedStopMap[id]) dataManager.groupedStopMap[id].forEach(x => toAdd.add(x));
                                                                // also check parent station mapping
                                                                const stObj = dataManager.getStop(id);
                                                                if (stObj && stObj.parent_station && dataManager.groupedStopMap[stObj.parent_station]) {
                                                                    dataManager.groupedStopMap[stObj.parent_station].forEach(x => toAdd.add(x));
                                                                }
                                                            });
                                                            toAdd.forEach(x => originCandidateIds.add(x));
                                                        }

                                                    if (alightIndex > -1) {
                                                        // search backwards for any origin candidate stop id
                                                        for (let i = Math.min(alightIndex - 1, stopTimesList.length - 1); i >= 0; i--) {
                                                            if (originCandidateIds.size > 0 && originCandidateIds.has(stopTimesList[i].stop_id)) { boardingIndex = i; break; }
                                                        }

                                                        // if none found, pick a reasonable predecessor (up to 3 stops before the alight)
                                                        if (boardingIndex === null) {
                                                            boardingIndex = Math.max(0, alightIndex - 2);
                                                        }
                                                    } else {
                                                        // alightIndex not found: default to first stop or 0
                                                        boardingIndex = 0;
                                                    }
                                                } catch (err) {
                                                    console.warn('Erreur détermination boardingIndex GTFS, fallback utilisé', err);
                                                    boardingIndex = 0;
                                                }

                                                const boardingST = stopTimesList[boardingIndex] || stopTimesList[0] || st;
                                                const alightingST = stopTimesList[alightIndex] || st;

                                const boardingStopObj = dataManager.getStop(boardingST.stop_id) || { stop_name: boardingST.stop_id, stop_lat: 0, stop_lon: 0 };
                                const alightingStopObj = dataManager.getStop(alightingST.stop_id) || { stop_name: alightingST.stop_id, stop_lat: 0, stop_lon: 0 };

                                // If we have origin candidate IDs from Google, ensure the chosen boarding stop
                                // actually matches one of them or is geographically close enough.
                                // This avoids proposing trips that merely pass the destination stop
                                // but do not start near the requested origin.
                                const DIST_THRESHOLD_METERS = 500; // max acceptable walking distance to boarding
                                if (originCandidateIds && originCandidateIds.size > 0) {
                                    if (!originCandidateIds.has(boardingST.stop_id)) {
                                        // Not exact match by ID — compute nearest origin candidate distance
                                        let minDist = Infinity;
                                        originCandidateIds.forEach(cid => {
                                            const cand = dataManager.getStop(cid);
                                            if (cand && cand.stop_lat && cand.stop_lon && boardingStopObj && boardingStopObj.stop_lat) {
                                                const d = dataManager.calculateDistance(parseFloat(cand.stop_lat), parseFloat(cand.stop_lon), parseFloat(boardingStopObj.stop_lat), parseFloat(boardingStopObj.stop_lon));
                                                if (!Number.isNaN(d) && d < minDist) minDist = d;
                                            }
                                        });
                                        if (minDist === Infinity) {
                                            console.debug('GTFS injection: no origin candidate coordinates to compare, rejecting trip', { tripId: st.trip_id, boarding: boardingST.stop_id });
                                            continue;
                                        }
                                        if (minDist > DIST_THRESHOLD_METERS) {
                                            console.debug('GTFS injection: boarding stop too far from origin candidates, skip', { tripId: st.trip_id, boarding: boardingST.stop_id, minDist });
                                            continue;
                                        }
                                        // Otherwise accept (within distance threshold)
                                        console.debug('GTFS injection: boarding stop accepted by proximity', { tripId: st.trip_id, boarding: boardingST.stop_id, minDist });
                                    } else {
                                        // Exact match by ID
                                        console.debug('GTFS injection: boarding stop accepted by exact match', { tripId: st.trip_id, boarding: boardingST.stop_id });
                                    }
                                }

                                const depSeconds = dataManager.timeToSeconds(boardingST.departure_time || boardingST.arrival_time || '00:00:00');
                                const arrSeconds = dataManager.timeToSeconds(alightingST.arrival_time || alightingST.departure_time || '00:00:00');

                                // Diagnostic: report when readable names are missing or when boarding is far from alight
                                if (!boardingStopObj || !boardingStopObj.stop_name || boardingStopObj.stop_name === boardingST.stop_id) {
                                    console.debug('GTFS injection: boarding stop has no readable name', { tripId: st.trip_id, boardingST });
                                }
                                if (!alightingStopObj || !alightingStopObj.stop_name || alightingStopObj.stop_name === alightingST.stop_id) {
                                    console.debug('GTFS injection: alighting stop has no readable name', { tripId: st.trip_id, alightingST });
                                }

                                // Récupérer géométrie shape/route
                                let geometry = dataManager.getRouteGeometry(trip.route_id);
                                if (!geometry && trip.shape_id) {
                                    geometry = dataManager.getShapeGeoJSON(trip.shape_id, trip.route_id);
                                }

                                // Convertir geometry en tableau de [lon, lat] points (comme dans geojson)
                                const extractRouteCoords = (geom) => {
                                    if (!geom) return null;
                                    if (Array.isArray(geom)) return geom; // assume already coords
                                    if (geom.type === 'LineString') return geom.coordinates;
                                    if (geom.type === 'MultiLineString') return geom.coordinates.flat();
                                    return null;
                                };

                                const routeCoords = extractRouteCoords(geometry);
                                let busPolylineEncoded = null;
                                let busPolylineLatLngs = null;
                                if (routeCoords && routeCoords.length > 0) {
                                    // dataManager.findNearestPointOnRoute expects [lon, lat] pairs
                                    const startIdx = dataManager.findNearestPointOnRoute(routeCoords, parseFloat(boardingStopObj.stop_lat), parseFloat(boardingStopObj.stop_lon));
                                    const endIdx = dataManager.findNearestPointOnRoute(routeCoords, parseFloat(alightingStopObj.stop_lat), parseFloat(alightingStopObj.stop_lon));
                                    let slice = null;
                                    if (startIdx != null && endIdx != null) {
                                        if (startIdx <= endIdx) slice = routeCoords.slice(startIdx, endIdx + 1);
                                        else slice = [...routeCoords].slice(endIdx, startIdx + 1).reverse();
                                    }
                                    if (!slice || slice.length < 2) {
                                        slice = [[parseFloat(boardingStopObj.stop_lon), parseFloat(boardingStopObj.stop_lat)], [parseFloat(alightingStopObj.stop_lon), parseFloat(alightingStopObj.stop_lat)]];
                                    }
                                    // convert [lon,lat] to [lat,lon]
                                    const latlngs = slice
                                        .map(p => [Number(p[1]), Number(p[0])])
                                        .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
                                    if (latlngs.length >= 2) {
                                        busPolylineLatLngs = latlngs;
                                        busPolylineEncoded = encodePolyline(latlngs);
                                    }
                                }

                                const intermediateStops = [];
                                if (stopTimesList && stopTimesList.length > 0 && alightIndex > boardingIndex) {
                                    const mids = stopTimesList.slice(boardingIndex + 1, alightIndex).map(s => dataManager.getStop(s.stop_id)?.stop_name || s.stop_id);
                                    intermediateStops.push(...mids);
                                }

                                const busStep = {
                                    type: 'BUS',
                                    icon: ICONS.BUS,
                                    instruction: `Prendre ${routeName} vers ${trip.trip_headsign}`,
                                    polyline: busPolylineEncoded ? { encodedPolyline: busPolylineEncoded, latLngs: busPolylineLatLngs } : null,
                                    routeColor: route.route_color ? `#${route.route_color}` : '#3388ff',
                                    routeTextColor: route.route_text_color ? `#${route.route_text_color}` : '#ffffff',
                                    routeShortName: routeName,
                                    departureStop: boardingStopObj.stop_name || boardingST.stop_id,
                                    arrivalStop: alightingStopObj.stop_name || alightingST.stop_id,
                                    departureTime: dataManager.formatTime(depSeconds),
                                    arrivalTime: dataManager.formatTime(arrSeconds),
                                    duration: dataManager.formatDuration(Math.max(0, arrSeconds - depSeconds)) || 'Horaires théoriques',
                                    intermediateStops,
                                    numStops: Math.max(0, (alightIndex - boardingIndex)),
                                    _durationSeconds: Math.max(0, arrSeconds - depSeconds)
                                };

                                const itin = {
                                    type: 'BUS',
                                    tripId: st.trip_id,
                                    trip: trip,
                                    route: route,
                                    departureTime: busStep.departureTime || '~',
                                    arrivalTime: busStep.arrivalTime || dataManager.formatTime(seconds),
                                    summarySegments: [{ type: 'BUS', name: routeName, color: route.route_color ? `#${route.route_color}` : '#3388ff', textColor: route.route_text_color ? `#${route.route_text_color}` : '#ffffff' }],
                                    durationRaw: busStep._durationSeconds || 0,
                                    duration: busStep.duration || 'Horaires théoriques',
                                    steps: [busStep]
                                };
                                    // Verify trip headsign/direction loosely matches candidate arrival names to avoid cloning reverse trips
                                    if (trip.trip_headsign) {
                                        const th = (trip.trip_headsign || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
                                        const matchesHeadsign = Array.from(candidateNames).some(n => {
                                            if (!n) return false;
                                            const normalizedN = n.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
                                            // Match si headsign contient le nom OU si le nom contient le headsign
                                            return th.includes(normalizedN) || normalizedN.includes(th);
                                        });
                                        if (!matchesHeadsign) {
                                            console.debug('GTFS injection: trip headsign does not match candidate arrival names, skipping', { 
                                                tripId: st.trip_id, 
                                                trip_headsign: trip.trip_headsign,
                                                candidateNames: Array.from(candidateNames)
                                            });
                                            continue;
                                        }
                                    }
                                    gtfsAdded.push(itin);
                            }
                        }
                    }
                }
                console.log(`✅ Bus GTFS ajoutés : ${gtfsAdded.length}`);
            }

            // E. INCLURE LES RÉSULTATS GTFS DANS L'AFFICHAGE (fenêtre stricte: jusqu'à l'heure demandée)
            // On annote d'abord les bus Google confirmés par GTFS
            let matchedCount = 0;
            filteredBus.forEach(it => {
                const key = `${it.summarySegments[0]?.name}_${it.arrivalTime}`;
                const match = gtfsAdded.find(g => `${g.summarySegments[0]?.name}_${g.arrivalTime}` === key);
                // Do not annotate Google itineraries with provenance flags — treat all sources uniformly in UI.
            });

            // Préparer la liste combinée (Google + GTFS) — sans limitation du nombre
            const allBuses = [];
            // Ajouter les bus Google filtrés (déjà dans la fenêtre [req-30min, req])
            filteredBus.forEach(it => {
                allBuses.push({ itin: it, arrivalMs: parseArrivalMs(it.arrivalTime), source: 'google' });
            });
            // Ajouter les bus GTFS trouvés dans la même fenêtre
            gtfsAdded.forEach(g => {
                const arrivalMs = parseArrivalMs(g.arrivalTime);
                // uniquement si dans la fenêtre (sécurité)
                if (!isNaN(arrivalMs) && arrivalMs >= windowStart && arrivalMs <= windowEnd) {
                    allBuses.push({ itin: g, arrivalMs: arrivalMs, source: 'gtfs' });
                }
            });

            // Trier chronologiquement par heure d'arrivée
            allBuses.sort((a, b) => a.arrivalMs - b.arrivalMs);

            // Diagnostics GTFS
            const missingGtfs = gtfsAdded.filter(g => !filteredBus.some(f => `${f.summarySegments[0]?.name}_${f.arrivalTime}` === `${g.summarySegments[0]?.name}_${g.arrivalTime}`));
            itineraries._gtfsDiagnostics = {
                candidateStopIds: Array.from(candidateStopIds || []),
                gtfsFound: gtfsAdded.length,
                googleFound: filteredBus.length,
                matched: matchedCount,
                missing: missingGtfs.map(g => ({ route: g.summarySegments[0]?.name, arrival: g.arrivalTime, tripId: g.tripId }))
            };

            if (missingGtfs.length > 0) {
                console.warn(`⚠️ GTFS: ${missingGtfs.length} départ(s) trouvés dans GTFS mais non proposés par l'API Google.`);
                console.table(itineraries._gtfsDiagnostics.missing);
            } else {
                console.log('✅ GTFS et Google cohérents pour cette fenêtre.');
            }

            // F. RECONSTRUIRE LA LISTE FINALE: inclure TOUS les bus (Google + GTFS) sans limite
            itineraries.length = 0;
            allBuses.forEach(b => itineraries.push(b.itin));
            // Rajouter piéton/vélo filtrés dans la fenêtre demandée
            const filteredOther = otherItins.filter(o => {
                if (!o.arrivalTime || o.arrivalTime === '~' || o.arrivalTime === '--:--') return false;
                const ms = parseArrivalMs(o.arrivalTime);
                return !isNaN(ms) && ms >= windowStart && ms <= windowEnd;
            });
            itineraries.push(...filteredOther);
        }
    } catch (e) {
        console.warn('Erreur lors du filtrage par heure d\'arrivée:', e);
    }

    // V115: Passer le searchMode à deduplicateItineraries pour garder les bons horaires
    const searchMode = searchTime?.type || 'partir';
    // V325: Réactivation de la déduplication avec meilleure logique
    let finalList = deduplicateItineraries(itineraries, searchMode);

    // Tri + pagination spécifique au mode "arriver"
    if (searchTime && searchTime.type === 'arriver') {
        const parseArrivalMsGeneric = (arrivalStr, baseDate) => {
            if (!arrivalStr || typeof arrivalStr !== 'string') return 0;
            const m = arrivalStr.match(/(\d{1,2}):(\d{2})/);
            if (!m) return 0;
            const hh = parseInt(m[1], 10);
            const mm = parseInt(m[2], 10);
            return hh * 60 + mm; // Minutes depuis minuit
        };

        const targetMinutes = (parseInt(searchTime.hour) || 0) * 60 + (parseInt(searchTime.minute) || 0);

        // V134: Tri SIMPLE - par heure d'arrivée DÉCROISSANTE
        // L'utilisateur veut arriver à 16h -> on affiche d'abord 15h55, puis 15h45, puis 15h30...
        // C'est l'ordre logique : le meilleur (plus proche de 16h) en premier
        finalList.sort((a, b) => {
            const arrA = parseArrivalMsGeneric(a.arrivalTime);
            const arrB = parseArrivalMsGeneric(b.arrivalTime);
            
            // Filtrer les arrivées après l'heure demandée (trop tard)
            const aValid = arrA <= targetMinutes;
            const bValid = arrB <= targetMinutes;
            if (aValid !== bValid) return aValid ? -1 : 1;
            
            // Trier par arrivée DÉCROISSANTE (15h55 avant 15h45 avant 15h30...)
            return arrB - arrA;
        });
        
        console.log('🎯 V134: Tri ARRIVER (arrivée décroissante):', finalList.slice(0, 5).map(it => ({
            arr: it.arrivalTime,
            dep: it.departureTime
        })));

        arrivalRankedAll = [...finalList];
        arrivalRenderedCount = ARRIVAL_PAGE_SIZE;
        finalList = arrivalRankedAll.slice(0, ARRIVAL_PAGE_SIZE);
    }

    return finalList;
}

/**
 * Ensure every BUS step has a polyline. Attempts to reconstruct from GTFS data (shape or route geometry)
 * and falls back to a straight encoded line between boarding and alighting stops when necessary.
 * This is defensive: some GTFS-inserted itineraries may miss polylines and the renderer expects them.
 */
async function ensureItineraryPolylines(itineraries) {
    if (!Array.isArray(itineraries) || !dataManager) return;

    const shapesReady = await dataManager.ensureShapesIndexLoaded();
    if (shapesReady === false) {
        console.warn('ensureItineraryPolylines: les shapes GTFS n\'ont pas pu être chargées.');
    }

    const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/g, '').trim();

    for (const itin of itineraries) {
        if (!itin || !Array.isArray(itin.steps)) continue;
        for (const step of itin.steps) {
            try {
            if (!step || step.type !== 'BUS' || isWaitStep(step)) continue;

                const hasLatLngs = Array.isArray(step?.polyline?.latLngs) && step.polyline.latLngs.length >= 2;
                // V270: accepter davantage de formats d'encodage déjà présents sur le leg
                const encodedCandidate = step?.polyline?.encodedPolyline
                    || step?.polyline?.points
                    || step?.legGeometry?.points
                    || (typeof step?.polyline === 'string' ? step.polyline : null);

                // Si on a déjà une polyline encodée, la décoder et sortir pour éviter les lignes droites
                if (!hasLatLngs && encodedCandidate) {
                    const decoded = decodePolyline(encodedCandidate) || [];
                    if (decoded.length >= 2) {
                        step.polyline = step.polyline || {};
                        step.polyline.latLngs = decoded
                            .map(([lat, lon]) => [Number(lat), Number(lon)])
                            .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
                        step.polyline.encodedPolyline = step.polyline.encodedPolyline || encodedCandidate;
                        if (step.polyline.latLngs.length >= 2) {
                            continue;
                        }
                    }
                }
                if (hasLatLngs) continue;

                const stepTripId = step.tripId || itin.tripId || (itin.trip && itin.trip.trip_id) || null;
                const stepRouteId = step.routeId || (itin.route && (itin.route.route_id || itin.routeId)) || null;

                let tripObj = null;
                try {
                    if (stepTripId && dataManager?.tripsByTripId) {
                        tripObj = dataManager.tripsByTripId[stepTripId] || null;
                    }
                } catch {
                    tripObj = null;
                }

                const routeId = (tripObj && tripObj.route_id) || stepRouteId || null;
                const shapeId = (tripObj && tripObj.shape_id) || (itin.trip && itin.trip.shape_id) || (itin.shapeId) || null;
                const hasLocalGeometryHints = Boolean(routeId || shapeId || stepTripId || itin.tripId || itin.trip);

                const hasExistingEncoded = step.polyline && (step.polyline.encodedPolyline || step.polyline.points);
                if (!hasLocalGeometryHints && hasExistingEncoded) {
                    // Probable itinéraire Google déjà complet -> garder la polyline fournie
                    continue;
                }

                // Try to find departure/arrival stops via ids or names (fast path)
                let depStopObj = null, arrStopObj = null;
                let resolvedDepCoords = null, resolvedArrCoords = null;
                try {
                    const depStopId = step.departureStopId || step?.transitDetails?.stopDetails?.departureStop?.id || step?.transitDetails?.stopDetails?.departureStop?.stopId || null;
                    const arrStopId = step.arrivalStopId || step?.transitDetails?.stopDetails?.arrivalStop?.id || step?.transitDetails?.stopDetails?.arrivalStop?.stopId || null;

                    if (depStopId && dataManager.getStop) depStopObj = dataManager.getStop(depStopId) || depStopObj;
                    if (arrStopId && dataManager.getStop) arrStopObj = dataManager.getStop(arrStopId) || arrStopObj;

                    if (step.departureStop && !depStopObj) {
                        const candidates = (dataManager.findStopsByName && dataManager.findStopsByName(step.departureStop, 3)) || [];
                        if (candidates.length) depStopObj = candidates[0];
                    }
                    if (step.arrivalStop && !arrStopObj) {
                        const candidates = (dataManager.findStopsByName && dataManager.findStopsByName(step.arrivalStop, 3)) || [];
                        if (candidates.length) arrStopObj = candidates[0];
                    }

                    // If still missing, try to use itinerary-level info (trip/route) and match by times or stop_id
                    if ((!depStopObj || !arrStopObj) && stepTripId) {
                        const stopTimes = dataManager.getStopTimes(stepTripId) || [];
                        if (stopTimes.length >= 1) {
                            // Attempt to match by departureTime/arrivalTime strings if available
                            if (!depStopObj && step.departureTime && step.departureTime !== '~') {
                                const match = stopTimes.find(st => (st.departure_time || st.arrival_time) && ((st.departure_time && st.departure_time.startsWith(step.departureTime)) || (st.arrival_time && st.arrival_time.startsWith(step.departureTime))));
                                if (match) depStopObj = dataManager.getStop(match.stop_id);
                            }
                            if (!arrStopObj && step.arrivalTime && step.arrivalTime !== '~') {
                                const match = stopTimes.find(st => (st.arrival_time || st.departure_time) && ((st.arrival_time && st.arrival_time.startsWith(step.arrivalTime)) || (st.departure_time && st.departure_time.startsWith(step.arrivalTime))));
                                if (match) arrStopObj = dataManager.getStop(match.stop_id);
                            }

                            // If still not found, try matching by raw stop_id if the UI shows one (some raw IDs include ':')
                            if (!depStopObj && step.departureStop && step.departureStop.indexOf(':') !== -1) {
                                depStopObj = dataManager.getStop(step.departureStop) || depStopObj;
                            }
                            if (!arrStopObj && step.arrivalStop && step.arrivalStop.indexOf(':') !== -1) {
                                arrStopObj = dataManager.getStop(step.arrivalStop) || arrStopObj;
                            }

                            // Final fallback from stopTimes: choose first/last stops if one side still missing
                            if (!depStopObj && stopTimes.length) depStopObj = dataManager.getStop(stopTimes[0].stop_id);
                            if (!arrStopObj && stopTimes.length) arrStopObj = dataManager.getStop(stopTimes[stopTimes.length - 1].stop_id);
                        }
                    }
                } catch (err) {
                    console.warn('ensureItineraryPolylines: erreur résolution arrêts', err);
                }

                if (!depStopObj && step.departureStop) {
                    resolvedDepCoords = resolveStopCoordinates(step.departureStop, dataManager);
                }
                if (!arrStopObj && step.arrivalStop) {
                    resolvedArrCoords = resolveStopCoordinates(step.arrivalStop, dataManager);
                }

                // Build encoded polyline from route geometry when possible
                let encoded = null;
                let latLngPoints = null;
                let geometry = routeId ? dataManager.getRouteGeometry(routeId) : null;
                if (!geometry && shapeId) geometry = dataManager.getShapeGeoJSON(shapeId, routeId);

                const geometryToLatLngs = (geom) => {
                    if (!geom) return null;

                    const toLatLng = (pair) => {
                        if (!Array.isArray(pair) || pair.length < 2) return null;
                        const lon = parseFloat(pair[0]);
                        const lat = parseFloat(pair[1]);
                        if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
                        return [lat, lon];
                    };

                    let rawPoints = null;
                    if (Array.isArray(geom)) {
                        rawPoints = geom;
                    } else if (geom.type === 'LineString') {
                        rawPoints = geom.coordinates;
                    } else if (geom.type === 'MultiLineString') {
                        rawPoints = geom.coordinates.flat();
                    }

                    if (!rawPoints) return null;
                    const converted = rawPoints.map(toLatLng).filter(Boolean);
                    return converted.length >= 2 ? converted : null;
                };

                const latlngs = geometryToLatLngs(geometry);

                const stopToCoord = (stopObj) => {
                    if (!stopObj) return null;
                    const lat = parseFloat(stopObj.stop_lat);
                    const lon = parseFloat(stopObj.stop_lon);
                    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
                    return { lat, lon };
                };
                const depCoordCandidate = stopToCoord(depStopObj)
                    || (resolvedDepCoords ? { lat: resolvedDepCoords.lat, lon: resolvedDepCoords.lng ?? resolvedDepCoords.lon } : null)
                    || (step.departureLocation ? { lat: step.departureLocation.lat, lon: step.departureLocation.lng ?? step.departureLocation.lon } : null);
                const arrCoordCandidate = stopToCoord(arrStopObj)
                    || (resolvedArrCoords ? { lat: resolvedArrCoords.lat, lon: resolvedArrCoords.lng ?? resolvedArrCoords.lon } : null)
                    || (step.arrivalLocation ? { lat: step.arrivalLocation.lat, lon: step.arrivalLocation.lng ?? step.arrivalLocation.lon } : null);

                if (latlngs && latlngs.length >= 2) {
                    if (depCoordCandidate && arrCoordCandidate) {
                        // find nearest indices
                        const findNearestIdx = (points, targetLat, targetLon) => {
                            let best = 0; let bestD = Infinity;
                            for (let i = 0; i < points.length; i++) {
                                const d = dataManager.calculateDistance(targetLat, targetLon, points[i][0], points[i][1]);
                                if (d < bestD) { bestD = d; best = i; }
                            }
                            return best;
                        };
                        const startIdx = findNearestIdx(latlngs, depCoordCandidate.lat, depCoordCandidate.lon);
                        const endIdx = findNearestIdx(latlngs, arrCoordCandidate.lat, arrCoordCandidate.lon);
                        let slice = null;
                        if (startIdx != null && endIdx != null && startIdx !== endIdx) {
                            if (startIdx < endIdx) slice = latlngs.slice(startIdx, endIdx + 1);
                            else slice = [...latlngs].slice(endIdx, startIdx + 1).reverse();
                        }
                        if (!slice || slice.length < 2) {
                            slice = [
                                [depCoordCandidate.lat, depCoordCandidate.lon],
                                [arrCoordCandidate.lat, arrCoordCandidate.lon]
                            ];
                        }
                        latLngPoints = slice
                            .map(pair => [Number(pair[0]), Number(pair[1])])
                            .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
                        encoded = latLngPoints.length >= 2 ? encodePolyline(latLngPoints) : null;
                        console.log('ensureItineraryPolylines: polyline reconstruite depuis la géométrie', {
                            itinId: itin.tripId || itin.trip?.trip_id || null,
                            stepRoute: routeId,
                            pointCount: latLngPoints?.length || 0
                        });
                    } else {
                        // Pas de coordonnées précises, on utilise la géométrie complète du tracé
                        latLngPoints = latlngs.map(pair => [Number(pair[0]), Number(pair[1])]).filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
                        encoded = latLngPoints.length >= 2 ? encodePolyline(latLngPoints) : null;
                    }
                }

                // Final fallback: direct straight line using available coordinates
                if (!encoded) {
                    const dep = depCoordCandidate
                        ? depCoordCandidate
                        : null;
                    const arr = arrCoordCandidate
                        ? arrCoordCandidate
                        : null;
                    
                    // V267: Fallback ultime - utiliser les coords de l'itinéraire global si dispo
                    let finalDep = dep;
                    let finalArr = arr;
                    
                    if (!finalDep && itin.origin) {
                        const o = itin.origin;
                        if (o.lat && o.lng) finalDep = { lat: o.lat, lon: o.lng };
                        else if (o.latitude && o.longitude) finalDep = { lat: o.latitude, lon: o.longitude };
                    }
                    if (!finalArr && itin.destination) {
                        const d = itin.destination;
                        if (d.lat && d.lng) finalArr = { lat: d.lat, lon: d.lng };
                        else if (d.latitude && d.longitude) finalArr = { lat: d.latitude, lon: d.longitude };
                    }
                    
                    // V267: Essayer aussi les coordonnées de step directement
                    if (!finalDep && step.departureLocation) {
                        const loc = step.departureLocation;
                        if (loc.lat !== undefined) finalDep = { lat: loc.lat, lon: loc.lng || loc.lon };
                        else if (loc.latLng) finalDep = { lat: loc.latLng.latitude, lon: loc.latLng.longitude };
                    }
                    if (!finalArr && step.arrivalLocation) {
                        const loc = step.arrivalLocation;
                        if (loc.lat !== undefined) finalArr = { lat: loc.lat, lon: loc.lng || loc.lon };
                        else if (loc.latLng) finalArr = { lat: loc.latLng.latitude, lon: loc.latLng.longitude };
                    }
                    
                    if (finalDep && finalArr && !Number.isNaN(finalDep.lat) && !Number.isNaN(finalArr.lat)) {
                        latLngPoints = [[finalDep.lat, finalDep.lon], [finalArr.lat, finalArr.lon]];
                        encoded = encodePolyline(latLngPoints);
                        console.log('ensureItineraryPolylines: fallback polyline directe utilisée', {
                            itinId: itin.tripId || itin.trip?.trip_id || null,
                            stepRoute: routeId,
                            source: 'coords-fallback'
                        });
                    }
                }

                if (encoded && latLngPoints && latLngPoints.length >= 2) {
                    step.polyline = { encodedPolyline: encoded, latLngs: latLngPoints };
                    console.debug('ensureItineraryPolylines: reconstructed polyline', { itinId: itin.tripId || itin.trip?.trip_id || null });
                } else {
                    console.warn('ensureItineraryPolylines: impossible de reconstruire la polyline pour une étape BUS (aucune coordonnée fiable)', {
                        itinId: itin.tripId || itin.trip?.trip_id || null,
                        stepRoute: routeId,
                        departureStop: step.departureStop,
                        arrivalStop: step.arrivalStop
                    });
                }
            } catch (err) {
                console.warn('ensureItineraryPolylines error for step', err);
            }
        }
    }
}

function processSimpleRoute(data, mode, modeInfo, searchTime) { 
    if (!data || !data.routes || data.routes.length === 0 || !modeInfo) return null;
    const route = data.routes[0];
    const leg = route.legs?.[0];
    const durationMinutes = modeInfo.duration;
    const distanceKm = modeInfo.distance;
    const durationRawSeconds = durationMinutes * 60;
    const icon = mode === 'bike' ? ICONS.BICYCLE : ICONS.WALK;
    const modeLabel = mode === 'bike' ? 'Vélo' : 'Marche';
    const type = mode === 'bike' ? 'BIKE' : 'WALK';
    
    let departureTimeStr = "~";
    let arrivalTimeStr = "~";
    if (searchTime.type === 'partir') {
        try {
            let departureDate;
            if(searchTime.date === 'today' || searchTime.date === "Aujourd'hui" || !searchTime.date) {
                departureDate = new Date();
            } else {
                departureDate = new Date(searchTime.date);
            }
            departureDate.setHours(searchTime.hour, searchTime.minute, 0, 0);
            const arrivalDate = new Date(departureDate.getTime() + durationRawSeconds * 1000);
            departureTimeStr = `${String(departureDate.getHours()).padStart(2, '0')}:${String(departureDate.getMinutes()).padStart(2, '0')}`;
            arrivalTimeStr = `${String(arrivalDate.getHours()).padStart(2, '0')}:${String(arrivalDate.getMinutes()).padStart(2, '0')}`;
        } catch(e) {
            console.warn("Erreur calcul date pour vélo/marche", e);
        }
    } else if (searchTime.type === 'arriver') {
        // Recherche "Arriver" : on fixe l'heure d'arrivée et on déduit l'heure de départ.
        try {
            let arrivalDate;
            if(searchTime.date === 'today' || searchTime.date === "Aujourd'hui" || !searchTime.date) {
                arrivalDate = new Date();
            } else {
                arrivalDate = new Date(searchTime.date);
            }
            arrivalDate.setHours(searchTime.hour, searchTime.minute, 0, 0);
            const departureDate = new Date(arrivalDate.getTime() - durationRawSeconds * 1000);
            arrivalTimeStr = `${String(arrivalDate.getHours()).padStart(2, '0')}:${String(arrivalDate.getMinutes()).padStart(2, '0')}`;
            departureTimeStr = `${String(departureDate.getHours()).padStart(2, '0')}:${String(departureDate.getMinutes()).padStart(2, '0')}`;
        } catch(e) {
            console.warn("Erreur calcul date (arriver) pour vélo/marche", e);
        }
    }

    const aggregatedStep = {
        type: type, icon: icon, instruction: modeLabel,
        distance: `${distanceKm} km`, duration: `${durationMinutes} min`,
        subSteps: [], polylines: [], departureTime: "~", arrivalTime: "~",
        durationRaw: durationRawSeconds
    };

    // V184: Protection contre leg ou leg.steps undefined
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
        type: type, departureTime: departureTimeStr, arrivalTime: arrivalTimeStr,
        duration: `${durationMinutes} min`, durationRaw: durationRawSeconds,
        polyline: route.polyline, summarySegments: [], steps: [aggregatedStep],
        _isBike: mode === 'bike', _isWalk: mode ==='walk'
    };
}

function setupResultTabs(itineraries) {
    if (!resultsModeTabs) return;
    if (!itineraries || !itineraries.length) {
        resultsModeTabs.classList.add('hidden');
        return;
    }
    const tabs = {
        ALL: resultsModeTabs.querySelector('[data-mode="ALL"]'),
        BUS: resultsModeTabs.querySelector('[data-mode="BUS"]'),
        BIKE: resultsModeTabs.querySelector('[data-mode="BIKE"]'),
        WALK: resultsModeTabs.querySelector('[data-mode="WALK"]')
    };
    const bestAll = itineraries[0];
    const bestBus = itineraries.find(i => i.type === 'BUS');
    const bestBike = itineraries.find(i => i.type === 'BIKE');
    const bestWalk = itineraries.find(i => i.type === 'WALK');

    const fillTab = (tab, itinerary, icon) => {
        if (!tab) return;
        let durationHtml = `<span class="mode-tab-duration empty">--</span>`;
        let iconHtml = icon;
        if (itinerary) {
            durationHtml = `<span class="mode-tab-duration">${itinerary.duration}</span>`;
            if (tab === tabs.ALL) iconHtml = ICONS.ALL;
            tab.classList.remove('hidden');
        } else {
            tab.classList.add('hidden'); 
        }
        tab.innerHTML = `${iconHtml}${durationHtml}`;
    };

    fillTab(tabs.ALL, bestAll, ICONS.ALL);
    fillTab(tabs.BUS, bestBus, ICONS.BUS);
    fillTab(tabs.BIKE, bestBike, ICONS.BICYCLE);
    fillTab(tabs.WALK, bestWalk, ICONS.WALK);

    resultsModeTabs.querySelectorAll('.mode-tab').forEach(tab => {
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        newTab.addEventListener('click', () => {
            resultsModeTabs.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            newTab.classList.add('active');
            const mode = newTab.dataset.mode;
            if (resultsRenderer) resultsRenderer.render(mode);
        });
    });
    const defaultActiveTab = resultsModeTabs.querySelector('[data-mode="ALL"]');
    if (defaultActiveTab) {
        defaultActiveTab.classList.add('active');
    }
    resultsModeTabs.classList.remove('hidden');
}

// ===================================================================
// main.js - V47 (Partie 2/2 : Rendu visuel et Marqueurs)
// ... (suite de la Partie 1)
//
// *** MODIFICATION V52 (Partie 2) ***
// 1. (Logique de titrage V52 - sera remplacée par V56)
//
// *** MODIFICATION V53 (Partie 2) ***
// 1. (Corrections de filtrage V53 - sera remplacée par V56)
//
// *** MODIFICATION V56 (Partie 2) ***
// 1. Logique de titrage dans `renderItineraryResults` entièrement révisée
//    pour lireSigma
//
// *** MODIFICATION V57.1 (Partie 2) ***
// 1. Correction du SyntaxError: "Illegal continue statement" (remplacé par "return")
//    dans la fonction `initializeRouteFilter`.
// ===================================================================

// Anciennes fonctions de rendu (getItineraryType, renderItineraryResults) supprimées.

/**
 * *** MODIFIÉ V325 ***
 * Helper pour déterminer le style Leaflet (couleur, hachures)
 * en fonction d'une ÉTAPE d'itinéraire.
 * Note: Leaflet ne supporte pas les variables CSS, on utilise des couleurs hex
 */
function getLeafletStyleForStep(step) {
    // Couleurs Périmap (remplace var(--primary) et var(--secondary))
    const PRIMARY_COLOR = '#0066CC';    // Bleu Périmap
    const SECONDARY_COLOR = '#6B7280';  // Gris
    
    // Vérifie le type simple (vélo/marche)
    if (step.type === 'BIKE') {
        return {
            color: SECONDARY_COLOR,
            weight: 5,
            opacity: 0.8
        };
    }
    if (step.type === 'WALK') {
        return {
            color: PRIMARY_COLOR,
            weight: 5,
            opacity: 0.8,
            dashArray: '10, 10' // Hachuré
        };
    }
    // Vérifie le type Bus
    if (step.type === 'BUS') {
        const busColor = step.routeColor || PRIMARY_COLOR;
        return {
            color: busColor,
            weight: 5,
            opacity: 0.8
        };
    }
    
    // Fallback pour les types Google (au cas où)
    if (step.travelMode === 'BICYCLE') return getLeafletStyleForStep({type: 'BIKE'});
    if (step.travelMode === 'WALK') return getLeafletStyleForStep({type: 'WALK'});
    if (step.travelMode === 'TRANSIT') return getLeafletStyleForStep({type: 'BUS', routeColor: step.routeColor});

    // Style par défaut
    return {
        color: PRIMARY_COLOR,
        weight: 5,
        opacity: 0.8
    };
}

// V221: getEncodedPolylineValue, getPolylineLatLngs, isWaitStep, extractStepPolylines
// sont maintenant importés depuis map/routeDrawing.js

/**
 * ✅ V62: AMÉLIORATION - Ajoute les marqueurs de Début, Fin, Correspondance et Arrêts intermédiaires
 * - Ronds verts pour le début
 * - Ronds rouges pour la fin
 * - Ronds jaunes pour les correspondances
 * - Petits ronds blancs pour les arrêts intermédiaires
 */
function addItineraryMarkers(itinerary, map, markerLayer) {
    if (!itinerary || !Array.isArray(itinerary.steps) || !map || !markerLayer) return;

    markerLayer.clearLayers();

    const busSteps = itinerary.steps.filter(step => step.type === 'BUS' && !isWaitStep(step));
    if (!busSteps.length) {
        addFallbackItineraryMarkers(itinerary, markerLayer);
        return;
    }

    const stopPoints = [];

    busSteps.forEach((step, index) => {
        const isFirstBus = index === 0;
        const isLastBus = index === busSteps.length - 1;
        const stepStops = [];

        // Arrêt de départ
        if (step.departureStop) {
            stepStops.push({ name: step.departureStop, role: isFirstBus ? 'boarding' : 'transfer' });
        }

        // Arrêts intermédiaires - Essayer plusieurs sources
        let intermediateStopsData = [];
        
        // Source 1: intermediateStops du step (noms)
        if (Array.isArray(step.intermediateStops) && step.intermediateStops.length > 0) {
            intermediateStopsData = step.intermediateStops.map(stopName => ({
                name: typeof stopName === 'string' ? stopName : (stopName?.name || stopName?.stop_name || ''),
                lat: stopName?.lat || stopName?.stop_lat || null,
                lng: stopName?.lng || stopName?.stop_lon || null
            }));
        }
        
        // Source 2: Si le step contient les stopTimes avec coordonnées (du router local)
        if (intermediateStopsData.length === 0 && Array.isArray(step.stopTimes)) {
            intermediateStopsData = step.stopTimes.slice(1, -1).map(st => {
                const stopObj = dataManager?.getStop?.(st.stop_id);
                return {
                    name: stopObj?.stop_name || st.stop_id,
                    lat: parseFloat(stopObj?.stop_lat) || null,
                    lng: parseFloat(stopObj?.stop_lon) || null
                };
            });
        }
        
        // Ajouter les arrêts intermédiaires
        intermediateStopsData.forEach(stop => {
            if (stop.name) {
                stepStops.push({ 
                    name: stop.name, 
                    role: 'intermediate',
                    directLat: stop.lat,
                    directLng: stop.lng
                });
            }
        });

        // Arrêt d'arrivée
        if (step.arrivalStop) {
            stepStops.push({ name: step.arrivalStop, role: isLastBus ? 'alighting' : 'transfer' });
        }

        // Résoudre les coordonnées pour chaque arrêt
        stepStops.forEach(stop => {
            let coords = null;
            
            // Utiliser les coordonnées directes si disponibles
            if (stop.directLat && stop.directLng) {
                coords = { lat: stop.directLat, lng: stop.directLng };
            } else {
                // Sinon, résoudre via le dataManager
                coords = resolveStopCoordinates(stop.name, dataManager);
            }
            
            if (!coords) {
                console.log(`⚠️ Coordonnées non trouvées pour: ${stop.name}`);
                return;
            }

            const key = `${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}`;
            const existing = stopPoints.find(point => point.key === key);
            if (existing) {
                if (STOP_ROLE_PRIORITY[stop.role] > STOP_ROLE_PRIORITY[existing.role]) {
                    existing.role = stop.role;
                }
                if (!existing.names.includes(stop.name)) {
                    existing.names.push(stop.name);
                }
                return;
            }

            stopPoints.push({
                key,
                lat: coords.lat,
                lng: coords.lng,
                role: stop.role,
                names: [stop.name]
            });
        });
    });

    if (!stopPoints.length) {
        addFallbackItineraryMarkers(itinerary, markerLayer);
        return;
    }

    // Créer les marqueurs avec z-index approprié
    stopPoints.forEach(point => {
        const icon = createStopDivIcon(point.role);
        if (!icon) return;
        
        // Z-index: boarding/alighting > transfer > intermediate
        let zIndex = 800;
        if (point.role === 'boarding' || point.role === 'alighting') {
            zIndex = 1200;
        } else if (point.role === 'transfer') {
            zIndex = 1000;
        }
        
        const marker = L.marker([point.lat, point.lng], {
            icon,
            zIndexOffset: zIndex
        });
        markerLayer.addLayer(marker);
    });
    
    // V334: Ajouter marqueur de destination finale si dernière étape est WALK
    const lastStep = itinerary.steps[itinerary.steps.length - 1];
    if (lastStep && lastStep.type === 'WALK' && lastStep.polyline) {
        const walkLatLngs = getPolylineLatLngs(lastStep.polyline) || getPolylineLatLngs(lastStep.polylines?.[lastStep.polylines.length - 1]);
        if (walkLatLngs && walkLatLngs.length > 0) {
            const [destLat, destLng] = walkLatLngs[walkLatLngs.length - 1];
            if (Number.isFinite(destLat) && Number.isFinite(destLng)) {
                const destIcon = L.divIcon({
                    className: 'itinerary-stop-marker destination',
                    html: '<span class="walk-icon">🚶</span>',
                    iconSize: [26, 26],
                    iconAnchor: [13, 13]
                });
                const destMarker = L.marker([destLat, destLng], {
                    icon: destIcon,
                    zIndexOffset: 1300
                });
                markerLayer.addLayer(destMarker);
                console.log('📍 Marqueur destination finale ajouté (marche)');
            }
        }
    }
    
    console.log(`📍 ${stopPoints.length} marqueurs ajoutés (${stopPoints.filter(p => p.role === 'intermediate').length} arrêts intermédiaires)`);
}

function addFallbackItineraryMarkers(itinerary, markerLayer) {
    if (!itinerary || !Array.isArray(itinerary.steps) || !itinerary.steps.length) return;

    const fallbackPoints = [];
    const firstStep = itinerary.steps[0];
    const firstPolyline = (firstStep.type === 'BUS') ? firstStep.polyline : firstStep.polylines?.[0];
    const firstLatLngs = getPolylineLatLngs(firstPolyline);
    if (firstLatLngs && firstLatLngs.length) {
        const [lat, lng] = firstLatLngs[0];
        fallbackPoints.push({ lat, lng, role: 'boarding' });
    }

    itinerary.steps.forEach((step, index) => {
        if (index === itinerary.steps.length - 1) return;
        const polyline = (step.type === 'BUS')
            ? step.polyline
            : (Array.isArray(step.polylines) ? step.polylines[step.polylines.length - 1] : null);
        const latLngs = getPolylineLatLngs(polyline);
        if (latLngs && latLngs.length) {
            const [lat, lng] = latLngs[latLngs.length - 1];
            fallbackPoints.push({ lat, lng, role: 'transfer' });
        }
    });

    const lastStep = itinerary.steps[itinerary.steps.length - 1];
    const lastPolyline = (lastStep.type === 'BUS')
        ? lastStep.polyline
        : (Array.isArray(lastStep.polylines) ? lastStep.polylines[lastStep.polylines.length - 1] : null);
    const lastLatLngs = getPolylineLatLngs(lastPolyline);
    if (lastLatLngs && lastLatLngs.length) {
        const [lat, lng] = lastLatLngs[lastLatLngs.length - 1];
        fallbackPoints.push({ lat, lng, role: 'alighting' });
    }

    fallbackPoints.forEach(point => {
        const icon = createStopDivIcon(point.role);
        if (!icon) return;
        markerLayer.addLayer(L.marker([point.lat, point.lng], {
            icon,
            zIndexOffset: (point.role === 'boarding' || point.role === 'alighting') ? 1200 : 900
        }));
    });
}


/**
 * *** MODIFIÉ V46 (Marqueurs) ***
 * Dessine un tracé sur la carte des résultats PC
 */
function drawRouteOnResultsMap(itinerary) {
    // Accepter un tableau ou un objet unique
    if (Array.isArray(itinerary)) {
        itinerary = itinerary[0];
    }
    if (!resultsMapRenderer || !resultsMapRenderer.map || !itinerary || !itinerary.steps) return;

    if (currentResultsRouteLayer) {
        resultsMapRenderer.map.removeLayer(currentResultsRouteLayer);
        currentResultsRouteLayer = null;
    }
    // Vider les anciens marqueurs
    if (currentResultsMarkerLayer) {
        currentResultsMarkerLayer.clearLayers();
    }

    const stepLayers = [];
    let polylineStats = { total: 0, withCoords: 0, empty: 0 };
    
    itinerary.steps.forEach((step, idx) => {
        const style = getLeafletStyleForStep(step);
        
        const polylinesToDraw = extractStepPolylines(step);
        polylineStats.total += polylinesToDraw.length;

        if (!polylinesToDraw.length) {
            console.warn(`[DrawRoute] Step ${idx} (${step.type}): Aucune polyline extraite`, { 
                hasPolyline: !!step.polyline, 
                hasPolylines: Array.isArray(step.polylines) && step.polylines.length > 0,
                instruction: step.instruction?.substring(0, 50)
            });
            return;
        }

        polylinesToDraw.forEach((polyline, pIdx) => {
            const latLngs = getPolylineLatLngs(polyline);
            if (!latLngs || !latLngs.length) {
                polylineStats.empty++;
                console.warn(`[DrawRoute] Step ${idx}, polyline ${pIdx}: latLngs vide`, {
                    polylineType: typeof polyline,
                    hasEncodedPolyline: !!polyline?.encodedPolyline,
                    hasLatLngs: !!polyline?.latLngs,
                    hasPoints: !!polyline?.points,
                    polylineKeys: polyline ? Object.keys(polyline) : []
                });
                return;
            }
            // V325: Valider que les coordonnées sont dans des plages valides
            const validLatLngs = latLngs.filter(([lat, lng]) => 
                lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
            );
            if (validLatLngs.length !== latLngs.length) {
                console.warn(`[DrawRoute] Step ${idx}: ${latLngs.length - validLatLngs.length} coords invalides filtrées`, latLngs.slice(0, 3));
            }
            if (validLatLngs.length === 0) {
                polylineStats.empty++;
                return;
            }
            polylineStats.withCoords++;

            const stepLayer = L.polyline(validLatLngs, style);
            stepLayers.push(stepLayer);
        });
    });

    console.log(`[DrawRoute] Stats polylines:`, polylineStats, `stepLayers: ${stepLayers.length}`);

    if (stepLayers.length > 0) {
        // Créer un groupe avec toutes les couches d'étapes
        currentResultsRouteLayer = L.featureGroup(stepLayers).addTo(resultsMapRenderer.map);
        
        // Ajouter les marqueurs
        addItineraryMarkers(itinerary, resultsMapRenderer.map, currentResultsMarkerLayer);

        // Ajuster la carte pour voir l'ensemble du trajet
        const bounds = currentResultsRouteLayer.getBounds();
        if (bounds && bounds.isValid()) {
            console.log(`[DrawRoute] Bounds valides, fitBounds:`, bounds.toBBoxString());
            resultsMapRenderer.map.fitBounds(bounds, { padding: [20, 20] });
        } else {
            console.warn(`[DrawRoute] Bounds invalides, pas de fitBounds`);
        }
    } else {
        console.warn(`[DrawRoute] Aucun stepLayer créé, carte non mise à jour`);
    }
}


/**
 * *** MODIFIÉ V46 (Icônes Manœuvre + Filtre Bruit) ***
 * Génère le HTML des détails pour l'accordéon PC (Bus)
 */
function renderItineraryDetailHTML(itinerary) {
    
    const stepsHtml = itinerary.steps.map((step, index) => {
        // ✅ V45: Logique de marche (et vélo) restaurée avec <details>
        if (step.type === 'WALK' || step.type === 'BIKE') {
            const hasSubSteps = step.subSteps && step.subSteps.length > 0;
            const icon = (step.type === 'BIKE') ? ICONS.BICYCLE : ICONS.WALK;
            const stepClass = (step.type === 'BIKE') ? 'bicycle' : 'walk';

            // ✅ V46: Filtrer les étapes "STRAIGHT" trop courtes
            const filteredSubSteps = (step.subSteps || []).filter(subStep => {
                const distanceMatch = subStep.distance.match(/(\d+)\s*m/);
                if (subStep.maneuver === 'STRAIGHT' && distanceMatch && parseInt(distanceMatch[1]) < 100) {
                    return false; // Ne pas afficher "Continuer tout droit (80m)"
                }
                return true;
            });

            const effectiveSubSteps = filteredSubSteps
                .map(s => ({
                    instruction: (s?.instruction || '').trim() || 'Marcher',
                    distance: (s?.distance || '').trim(),
                    duration: (s?.duration || '').trim(),
                    maneuver: s?.maneuver || 'DEFAULT'
                }))
                .filter(s => s.instruction || s.distance || s.duration);
            const showDetails = hasSubSteps && effectiveSubSteps.length > 0;
            const inlineDurationHtml = step.duration ? `<span class="step-duration-inline">${step.duration}</span>` : '';
            const fallbackMeta = [step.distance, step.duration].filter(Boolean).join(' • ');

            return `
                <div class="step-detail ${stepClass}" style="--line-color: var(--text-secondary);">
                    <div class="step-icon">
                        ${icon}
                    </div>
                    <div class="step-info">
                        <span class="step-instruction">${step.instruction} ${inlineDurationHtml}</span>
                        
                        ${showDetails ? `
                        <details class="intermediate-stops">
                            <summary>
                                <span>Voir les étapes</span>
                                <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                            </summary>
                            <ul class="intermediate-stops-list walk-steps">
                                ${effectiveSubSteps.map(subStep => `
                                    <li>
                                        ${getManeuverIcon(subStep.maneuver)}
                                        <div class="walk-step-info">
                                            <span>${subStep.instruction}</span>
                                            <span class="walk-step-meta">${[subStep.distance, subStep.duration].filter(Boolean).join(' • ')}</span>
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        </details>
                        ` : `<span class="step-sub-instruction">${fallbackMeta || step.instruction}</span>`}
                    </div>
                </div>
            `;
        } else if (isWaitStep(step)) {
            return '';
        } else if (shouldSuppressBusStep(step)) {
            return '';
        } else { // BUS
            const hasIntermediateStops = step.intermediateStops && step.intermediateStops.length > 0;
            const intermediateStopCount = hasIntermediateStops ? step.intermediateStops.length : (step.numStops > 1 ? step.numStops - 1 : 0);
            
            let stopCountLabel = 'Direct';
            if (intermediateStopCount > 1) {
                stopCountLabel = `${intermediateStopCount} arrêts`;
            } else if (intermediateStopCount === 1) {
                stopCountLabel = `1 arrêt`;
            }

            const lineColor = step.routeColor || 'var(--border)';
            const badgeLabel = getSafeRouteBadgeLabel(step.routeShortName);
            const badgeBg = step.routeColor || 'var(--primary)';
            const badgeText = step.routeTextColor || '#ffffff';
            const departureStopLabel = getSafeStopLabel(step.departureStop);
            const arrivalStopLabel = getSafeStopLabel(step.arrivalStop);
            const departureTimeLabel = getSafeTimeLabel(step.departureTime);
            const arrivalTimeLabel = getSafeTimeLabel(step.arrivalTime);
            
            // ✅ V227: Déterminer si c'est un terminus - basé sur le nom de l'arrêt
            const isTerminusArrival = arrivalStopLabel?.toLowerCase().includes('terminus') || arrivalStopLabel?.toLowerCase().includes('gare');
            const arrivalLabel = isTerminusArrival ? 'Arrivée au terminus' : 'Descente à';
            
            return `
                <div class="step-detail bus" style="--line-color: ${lineColor};">
                    <div class="step-icon">
                        <div class="route-line-badge" style="background-color: ${badgeBg}; color: ${badgeText};">${badgeLabel}</div>
                    </div>
                    <div class="step-info">
                        <span class="step-instruction">${step.instruction} ${step.duration ? `<span class="step-duration-inline">${step.duration}</span>` : ''}</span>
                        
                        <div class="step-stop-point stop-context">
                            <span class="stop-label">Montée</span>
                            <span class="step-time"><strong>${departureStopLabel}</strong></span>
                            <span class="step-time-detail">(${departureTimeLabel})</span>
                        </div>
                        
                        ${(intermediateStopCount > 0) ? `
                        <details class="intermediate-stops">
                            <summary>
                                <span>${stopCountLabel}</span>
                                <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                            </summary>
                            ${hasIntermediateStops ? `
                            <ul class="intermediate-stops-list" style="--line-color: ${lineColor};">
                                ${step.intermediateStops.map(stop => {
                                    const name = typeof stop === 'string' ? stop : (stop?.name || stop?.stop_name || 'Arrêt');
                                    return `<li>${name}</li>`;
                                }).join('')}
                            </ul>
                            ` : `<ul class="intermediate-stops-list" style="--line-color: ${lineColor};"><li>(La liste détaillée des arrêts n'est pas disponible)</li></ul>`}
                        </details>
                        ` : ''}
                        
                        <div class="step-stop-point stop-context ${isTerminusArrival ? 'is-terminus' : ''}">
                            <span class="stop-label">${arrivalLabel}</span>
                            <span class="step-time"><strong>${arrivalStopLabel}</strong></span>
                            ${!isTerminusArrival ? `<span class="step-time-detail">(${arrivalTimeLabel})</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('');
    
    return stepsHtml;
}


/**
 * *** MODIFIÉ V48 (Zoom Mobile) ***
 * Remplit l'écran 2 (Détail Mobile)
 * NE FAIT PLUS le fitBounds, mais RETOURNE la couche
 */
function renderItineraryDetail(itinerary) {
    if (!detailPanelContent || !detailMapRenderer) return;

    console.log('renderItineraryDetail: start', {
        itineraryId: itinerary.tripId || itinerary.trip?.trip_id || itinerary.id || null,
        stepCount: itinerary.steps?.length || 0
    });

    let stepsHtml = '';

    // ✅ V45: Logique de marche (et vélo) restaurée avec <details>
    stepsHtml = itinerary.steps.map((step, index) => {
        const lineColor = (step.type === 'BUS') ? (step.routeColor || 'var(--border)') : 'var(--text-secondary)';
        
        if (step.type === 'WALK' || step.type === 'BIKE') {
            const hasSubSteps = step.subSteps && step.subSteps.length > 0;
            const icon = (step.type === 'BIKE') ? ICONS.BICYCLE : ICONS.WALK;
            const stepClass = (step.type === 'BIKE') ? 'bicycle' : 'walk';

            // ✅ V46: Filtrer les étapes "STRAIGHT" trop courtes
            const filteredSubSteps = (step.subSteps || []).filter(subStep => {
                // Tente d'extraire les mètres
                const distanceMatch = subStep.distance.match(/(\d+)\s*m/);
                // Si c'est "STRAIGHT" ET que la distance est < 100m, on cache
                if (subStep.maneuver === 'STRAIGHT' && distanceMatch && parseInt(distanceMatch[1]) < 100) {
                    return false; 
                }
                return true;
            });

            const effectiveSubSteps = filteredSubSteps
                .map(s => ({
                    instruction: (s?.instruction || '').trim() || 'Marcher',
                    distance: (s?.distance || '').trim(),
                    duration: (s?.duration || '').trim(),
                    maneuver: s?.maneuver || 'DEFAULT'
                }))
                .filter(s => s.instruction || s.distance || s.duration);
            const showDetails = hasSubSteps && effectiveSubSteps.length > 0;
            const inlineDurationHtml = step.duration ? `<span class="step-duration-inline">${step.duration}</span>` : '';
            const fallbackMeta = [step.distance, step.duration].filter(Boolean).join(' • ');

            return `
                <div class="step-detail ${stepClass}" style="--line-color: ${lineColor};">
                    <div class="step-icon">
                        ${icon}
                    </div>
                    <div class="step-info">
                        <span class="step-instruction">${step.instruction} ${inlineDurationHtml}</span>
                        
                        ${showDetails ? `
                        <details class="intermediate-stops">
                            <summary>
                                <span>Voir les étapes</span>
                                <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                            </summary>
                            <ul class="intermediate-stops-list walk-steps">
                                ${effectiveSubSteps.map(subStep => `
                                    <li>
                                        ${getManeuverIcon(subStep.maneuver)}
                                        <div class="walk-step-info">
                                            <span>${subStep.instruction}</span>
                                            <span class="walk-step-meta">${[subStep.distance, subStep.duration].filter(Boolean).join(' • ')}</span>
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        </details>
                        ` : `<span class="step-sub-instruction">${fallbackMeta || step.instruction}</span>`}
                    </div>
                </div>
            `;
        } else if (isWaitStep(step)) {
            return '';
        } else if (shouldSuppressBusStep(step)) {
            return '';
        } else { // BUS
            const hasIntermediateStops = step.intermediateStops && step.intermediateStops.length > 0;
            const intermediateStopCount = hasIntermediateStops ? step.intermediateStops.length : (step.numStops > 1 ? step.numStops - 1 : 0);
            
            let stopCountLabel = 'Direct';
            if (intermediateStopCount > 1) {
                stopCountLabel = `${intermediateStopCount} arrêts`;
            } else if (intermediateStopCount === 1) {
                stopCountLabel = `1 arrêt`;
            }

            const badgeLabel = getSafeRouteBadgeLabel(step.routeShortName);
            const badgeBg = step.routeColor || 'var(--primary)';
            const badgeText = step.routeTextColor || '#ffffff';
            const departureStopLabel = getSafeStopLabel(step.departureStop);
            const arrivalStopLabel = getSafeStopLabel(step.arrivalStop);
            const departureTimeLabel = getSafeTimeLabel(step.departureTime);
            const arrivalTimeLabel = getSafeTimeLabel(step.arrivalTime);

            // ✅ V227: Déterminer si c'est un terminus - basé sur le nom de l'arrêt
            const isTerminusArrival = arrivalStopLabel?.toLowerCase().includes('terminus') || arrivalStopLabel?.toLowerCase().includes('gare');
            const arrivalLabel = isTerminusArrival ? 'Arrivée au terminus' : 'Descente à';

            return `
                <div class="step-detail bus" style="--line-color: ${lineColor};">
                    <div class="step-icon">
                        <div class="route-line-badge" style="background-color: ${badgeBg}; color: ${badgeText};">${badgeLabel}</div>
                    </div>
                    <div class="step-info">
                        <span class="step-instruction">${step.instruction} ${step.duration ? `<span class="step-duration-inline">${step.duration}</span>` : ''}</span>
                        
                        <div class="step-stop-point stop-context">
                            <span class="stop-label">Montée</span>
                            <span class="step-time"><strong>${departureStopLabel}</strong></span>
                            <span class="step-time-detail">(${departureTimeLabel})</span>
                        </div>
                        
                        ${(intermediateStopCount > 0) ? `
                        <details class="intermediate-stops">
                            <summary>
                                <span>${stopCountLabel}</span>
                                <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                            </summary>
                            ${hasIntermediateStops ? `
                            <ul class="intermediate-stops-list" style="--line-color: ${lineColor};">
                                ${step.intermediateStops.map(stop => {
                                    const name = typeof stop === 'string' ? stop : (stop?.name || stop?.stop_name || 'Arrêt');
                                    return `<li>${name}</li>`;
                                }).join('')}
                            </ul>
                            ` : `<ul class="intermediate-stops-list" style="--line-color: ${lineColor};"><li>(La liste détaillée des arrêts n'est pas disponible)</li></ul>`}
                        </details>
                        ` : ''}
                        
                        <div class="step-stop-point stop-context ${isTerminusArrival ? 'is-terminus' : ''}">
                            <span class="stop-label">${arrivalLabel}</span>
                            <span class="step-time"><strong>${arrivalStopLabel}</strong></span>
                            ${!isTerminusArrival ? `<span class="step-time-detail">(${arrivalTimeLabel})</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('');

    detailPanelContent.innerHTML = stepsHtml;
    resetDetailPanelScroll();

    // 2. Mettre à jour le résumé
    if(detailMapSummary) {
        // ✅ CORRECTION: Affiche les temps calculés pour Vélo/Marche
        const timeHtml = (itinerary.departureTime === '~')
            ? `<span class="route-time" style="color: var(--text-secondary); font-weight: 500;">(Trajet)</span>`
            : `<span class="route-time">${itinerary.departureTime} &gt; ${itinerary.arrivalTime}</span>`;

        detailMapSummary.innerHTML = `
            ${timeHtml}
            <span class="route-duration">${itinerary.duration}</span>
        `;
    }

    // 3. Dessiner le tracé sur la carte
    if (detailMapRenderer.map && itinerary.steps) { // V44: Basé sur les étapes
        if (currentDetailRouteLayer) {
            detailMapRenderer.map.removeLayer(currentDetailRouteLayer);
            currentDetailRouteLayer = null;
        }
        // ✅ V46: Vider les anciens marqueurs
        if (currentDetailMarkerLayer) {
            currentDetailMarkerLayer.clearLayers();
        }
        
        const stepLayers = [];

        itinerary.steps.forEach(step => {
            const style = getLeafletStyleForStep(step);

            const polylinesToDraw = extractStepPolylines(step);

            if (!polylinesToDraw.length) {
                if (!isWaitStep(step)) {
                    console.warn('renderItineraryDetail: étape sans polylines', { stepType: step.type, step });
                }
                return;
            }
            
            polylinesToDraw.forEach(polyline => {
                const latLngs = getPolylineLatLngs(polyline);
                if (!latLngs || !latLngs.length) {
                    console.warn('renderItineraryDetail: étape sans coordonnées', { stepType: step.type, step });
                    return;
                }

                const geoJson = {
                    type: 'LineString',
                    coordinates: latLngs.map(([lat, lng]) => [lng, lat])
                };

                console.log('renderItineraryDetail: couche ajoutée', {
                    stepType: step.type,
                    pointCount: latLngs.length
                });
                const stepLayer = L.geoJSON(geoJson, {
                    style: style // Utiliser le style dynamique de l'étape
                });
                stepLayers.push(stepLayer);
            });
        });

        if (stepLayers.length > 0) {
            // Créer un groupe avec toutes les couches d'étapes
            currentDetailRouteLayer = L.featureGroup(stepLayers).addTo(detailMapRenderer.map);
            
            // ✅ V46: Ajouter les marqueurs
            addItineraryMarkers(itinerary, detailMapRenderer.map, currentDetailMarkerLayer);

            // ✅ V48 (MODIFICATION IMPLÉMENTÉE): La ligne fitBounds est SUPPRIMÉE d'ici
        } else {
            console.warn('renderItineraryDetail: aucune couche tracée (liste vide)', {
                itineraryId: itinerary.tripId || itinerary.trip?.trip_id || itinerary.id || null
            });
        }
    }
    
    // ✅ V48 (MODIFICATION IMPLÉMENTÉE): 
    // On retourne la couche qui vient d'être créée
    return currentDetailRouteLayer;
}

// === Fonctions de formatage maintenant importées depuis utils/formatters.js ===
// formatGoogleTime, formatGoogleDuration, parseGoogleDuration
// isMeaningfulTime, parseTimeStringToMinutes, formatMinutesToTimeString
// addSecondsToTimeString, subtractSecondsFromTimeString


// --- Fonctions de l'application (logique métier GTFS) ---

function renderInfoTraficCard() {
    if (!dataManager || !infoTraficList) return;
    // V131: Utiliser la fonction du module trafficInfo.js pour avoir les clics
    renderInfoTraficCardFromModule(dataManager, lineStatuses, infoTraficList, infoTraficCount);
}

function buildFicheHoraireList() {
    if (!dataManager || !ficheHoraireContainer) return;
    ficheHoraireContainer.innerHTML = '';

    const groupedRoutes = {
        'Lignes A, B, C et D': [],
        'Lignes e': [],
        'Lignes K': [],
        'Lignes N': [],
        'Lignes R': [],
    };

    dataManager.routes.forEach(route => {
        const name = route.route_short_name;
        if (['A', 'B', 'C', 'D'].includes(name)) groupedRoutes['Lignes A, B, C et D'].push(route);
        else if (name.startsWith('e')) groupedRoutes['Lignes e'].push(route);
        else if (name.startsWith('K')) groupedRoutes['Lignes K'].push(route);
        else if (name.startsWith('N')) groupedRoutes['Lignes N'].push(route);
        else if (name.startsWith('R')) groupedRoutes['Lignes R'].push(route);
    });

    for (const [groupName, routes] of Object.entries(groupedRoutes)) {
        if (routes.length === 0) continue;
        const accordionGroup = document.createElement('div');
        accordionGroup.className = 'accordion-group';
        let linksHtml = '';
        
        if (groupName === 'Lignes R') {
            linksHtml = `
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R1_R2_R3_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Lignes R1, R2, R3 La Feuilleraie <> ESAT / Les Gourdoux <> Trélissac Les Garennes / Les Pinots <> P+R Aquacap</a>
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R4_R5_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Lignes R4, R5 Route de Payenché <> Collège Jean Moulin / Les Mondines / Clément Laval <> Collège Jean Moulin</a>
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R6_R7_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Lignes R6, R7 Maison des Compagnons <> Gour de l’Arche poste / Le Charpe <> Gour de l’Arche poste</a>
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R8_R9_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Lignes R8, R9 Jaunour <> Boulazac centre commercial / Stèle de Lesparat <> Place du 8 mai</a>
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R10_R11_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Lignes R10, R11 Notre Dame de Sanilhac poste <> Centre de la communication / Héliodore <> Place du 8 mai</a>
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R12_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Ligne R12 Le Change <> Boulazac centre commercial</a>
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R13_R14_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Lignes R13, R14 Coursac <> Razac sur l’Isle / La Chapelle Gonaguet <>Razac sur l’Isle</a>
                <a href="/data/fichehoraire/grandperigueux_fiche_horaires_ligne_R15_sept_2025.pdf" target="_blank" rel="noopener noreferrer">Ligne R15 Boulazac Isle Manoire <> Halte ferroviaire Niversac</a>
            `;
        } else {
            routes.sort((a, b) => a.route_short_name.localeCompare(b.route_short_name, undefined, {numeric: true}));
            routes.forEach(route => {
                let pdfName = PDF_FILENAME_MAP[route.route_short_name];
                let pdfPath = pdfName ? `/data/fichehoraire/${pdfName}` : '#';
                if (!pdfName) console.warn(`PDF non mappé pour ${route.route_short_name}.`);
                const longName = ROUTE_LONG_NAME_MAP[route.route_short_name] || (route.route_long_name ? route.route_long_name.replace(/<->/g, '<=>') : '');
                const displayName = `Ligne ${route.route_short_name} ${longName}`.trim();
                linksHtml += `<a href="${pdfPath}" target="_blank" rel="noopener noreferrer">${displayName}</a>`;
            });
        }

        if (linksHtml) {
            accordionGroup.innerHTML = `
                <details>
                    <summary>${groupName}</summary>
                    <div class="accordion-content">
                        <div class="accordion-content-inner">
                            ${linksHtml}
                        </div>
                    </div>
                </details>
            `;
            ficheHoraireContainer.appendChild(accordionGroup);
        }
    }
    
    // V355: Event delegation au lieu d'attacher des listeners individuels
    ficheHoraireContainer.addEventListener('toggle', (event) => {
        if (event.target.tagName === 'DETAILS' && event.target.open) {
            const allDetails = ficheHoraireContainer.querySelectorAll('details');
            allDetails.forEach(d => {
                if (d !== event.target && d.open) {
                    d.open = false;
                }
            });
        }
    }, true);
}

function renderAlertBanner() {
    let alerts = [];
    let firstAlertStatus = 'normal';
    
    if (Object.keys(lineStatuses).length === 0) {
        alertBanner.classList.add('hidden');
        return;
    }
    
    for (const route_id in lineStatuses) {
        const state = lineStatuses[route_id];
        if (state.status !== 'normal') {
            const route = dataManager.getRoute(route_id);
            if (route) { 
                alerts.push({
                    name: route.route_short_name,
                    status: state.status,
                    message: state.message
                });
            }
        }
    }

    if (alerts.length === 0) {
        alertBanner.classList.add('hidden');
        return;
    }

    if (alerts.some(a => a.status === 'annulation')) firstAlertStatus = 'annulation';
    else if (alerts.some(a => a.status === 'perturbation')) firstAlertStatus = 'perturbation';
    else firstAlertStatus = 'retard';
    
    alertBanner.className = `type-${firstAlertStatus}`;
    const alertIcon = getAlertBannerIcon(firstAlertStatus);
    const alertText = alerts.map(a => `<strong>Ligne ${a.name}</strong>`).join(', ');
    alertBannerContent.innerHTML = `${alertIcon} <strong>Infos Trafic:</strong> ${alertText}`;
    alertBanner.classList.remove('hidden');
}


/**
 * V355: Optimisation showMapView avec RAF et lazy invalidateSize
 */
function showMapView() {
    const fromScreen = getVisibleAppScreen();
    
    requestAnimationFrame(() => {
        resetDetailViewState();
        
        // Nettoyer les états dashboard
        document.querySelectorAll('#dashboard-content-view .card').forEach(c => c.classList.remove('view-active'));
        if (dashboardContentView) dashboardContentView.classList.remove('view-is-active');
        if (dashboardHall) dashboardHall.classList.add('view-is-active');
        
        animateScreenSwap(fromScreen, mapContainer);
        document.body.classList.remove('itinerary-view-active', 'content-view-active');
        document.body.classList.add('view-map-locked'); 
        setBottomNavActive('carte');

        // Fermer le panneau filtre
        const routeFilterPanel = document.getElementById('route-filter-panel');
        if (routeFilterPanel) routeFilterPanel.classList.add('hidden');
        
        // V355: InvalidateSize après transition complète pour éviter le lag
        if (mapRenderer && mapRenderer.map) {
            // Première invalidation rapide
            requestAnimationFrame(() => {
                mapRenderer.map.invalidateSize({ animate: false, pan: false });
            });
            // Deuxième invalidation après transition
            setTimeout(() => {
                mapRenderer.map.invalidateSize({ animate: false, pan: false });
            }, SCREEN_TRANSITION_MS + 50);
        }
    });
}

/**
 * V356: Optimisation showDashboardHall avec RAF + bottom nav immédiat
 */
function showDashboardHall() {
    const fromScreen = getVisibleAppScreen();
    
    // V356: Mettre à jour la bottom nav IMMÉDIATEMENT (avant RAF)
    setBottomNavActive('hall');
    
    requestAnimationFrame(() => {
        if (fromScreen !== dashboardContainer) {
            animateScreenSwap(fromScreen, dashboardContainer);
        }

        // Scroll instantané
        window.scrollTo({ top: 0, behavior: 'instant' });

        if (dashboardContainer) dashboardContainer.classList.remove('hidden');
        document.body.classList.remove('view-map-locked', 'view-is-locked', 'itinerary-view-active', 'content-view-active');
        
        // Reset cartes en batch
        document.querySelectorAll('#dashboard-content-view .card').forEach(c => c.classList.remove('view-active'));
        
        if (dashboardContentView) dashboardContentView.classList.remove('view-is-active');
        if (dashboardHall) dashboardHall.classList.add('view-is-active');
        
        if (dashboardHall) dashboardHall.scrollTop = 0;

        // Différer le nettoyage lourd
        requestIdleCallback ? requestIdleCallback(() => {
            resetDetailViewState();
            if (dataManager) renderAlertBanner();
        }, { timeout: 150 }) : setTimeout(() => {
            resetDetailViewState();
            if (dataManager) renderAlertBanner();
        }, 50);
    });
}

function showResultsView() {
    const fromScreen = getVisibleAppScreen();
    
    // V355: Optimisation avec RAF pour fluidité
    requestAnimationFrame(() => {
        resetDetailViewState();
        
        // V350: Nettoyer les états de vues internes du dashboard avant de partir
        document.querySelectorAll('#dashboard-content-view .card').forEach(c => c.classList.remove('view-active'));
        if (dashboardContentView) dashboardContentView.classList.remove('view-is-active');
        if (dashboardHall) dashboardHall.classList.add('view-is-active');
        
        animateScreenSwap(fromScreen, itineraryResultsContainer);
        // V67: Cacher header/footer Perimap sur la vue itinéraire
        // IMPORTANT: sortir du mode carte (body fixed/overflow hidden)
        document.body.classList.remove('view-map-locked', 'view-is-locked');
        document.body.classList.add('itinerary-view-active');
        // Ne pas verrouiller le scroll pour permettre de voir tous les itinéraires

        setBottomNavActive('itineraire');

        // Reset scroll internes (side panel + list) pour éviter un état persistant
        try {
            const sidePanel = document.getElementById('results-side-panel');
            if (sidePanel) sidePanel.scrollTop = 0;
            const listWrapper = itineraryResultsContainer ? itineraryResultsContainer.querySelector('.results-list-wrapper') : null;
            if (listWrapper) listWrapper.scrollTop = 0;
        } catch (_) {}

        if (resultsListContainer) {
            resultsListContainer.innerHTML = '';
        }
        
        // V496: Réafficher "Vos trajets" quand on entre dans la vue (pas de résultats encore)
        const recentJourneysSection = document.getElementById('recent-journeys-section');
        if (recentJourneysSection) {
            recentJourneysSection.style.display = '';
        }
        
        // V355: Invalider la carte avec RAF pour synchronisation optimale
        if (resultsMapRenderer && resultsMapRenderer.map) {
            requestAnimationFrame(() => {
                resultsMapRenderer.map.invalidateSize({ animate: false, pan: false });
            });
            // Après la transition
            setTimeout(() => {
                resultsMapRenderer.map.invalidateSize({ animate: false, pan: false });
            }, SCREEN_TRANSITION_MS + 50);
        }
    });
}

/**
 * *** MODIFIÉ V48 (Zoom Mobile) ***
 * Accepte la couche du trajet et gère le zoom au bon moment.
 */
function showDetailView(routeLayer) {
    if (!itineraryDetailContainer) return;
    
    // Bloquer le scroll du body
    document.body.classList.add('detail-view-open');
    
    initBottomSheetControls();
    cancelBottomSheetDrag();
    
    // V270: Reset au niveau 0 et appliquer IMMÉDIATEMENT la classe
    currentBottomSheetLevelIndex = BOTTOM_SHEET_DEFAULT_INDEX;
    if (detailBottomSheet) {
        detailBottomSheet.classList.remove('sheet-level-0', 'sheet-level-1', 'sheet-level-2');
        detailBottomSheet.classList.add('sheet-level-0'); // Niveau 0 = 20% visible
        detailBottomSheet.classList.remove('is-expanded');
        detailBottomSheet.style.removeProperty('transform');
    }
    
    itineraryDetailContainer.classList.remove('hidden');
    itineraryDetailContainer.classList.remove('is-scrolled');
    resetDetailPanelScroll();
    
    if (itineraryDetailBackdrop) {
        itineraryDetailBackdrop.classList.remove('hidden');
        requestAnimationFrame(() => itineraryDetailBackdrop.classList.add('is-active'));
    }

    // Invalide la carte des détails
    if (detailMapRenderer && detailMapRenderer.map) {
        detailMapRenderer.map.invalidateSize();
    }

    // V270: Ajouter is-active - le CSS appliquera sheet-level-0 automatiquement
    itineraryDetailContainer.classList.add('is-active');
    
    // Zoomer sur le trajet après un frame
    requestAnimationFrame(() => {
        if (routeLayer && detailMapRenderer.map) {
            try {
                const bounds = routeLayer.getBounds();
                if (bounds.isValid()) {
                    detailMapRenderer.map.fitBounds(bounds, { padding: [20, 20] });
                }
            } catch (e) {
                console.error("Erreur lors du fitBounds sur la carte détail:", e);
            }
        } else if (detailMapRenderer.map) {
            console.warn('showItineraryDetailView: pas de routeLayer, centrage sur Périgueux');
            detailMapRenderer.map.setView([45.1845, 0.7211], 13);
        }
    });
}


// *** NOUVELLE FONCTION V33 + V264 (Optimisée) ***
function hideDetailView() {
    if (!itineraryDetailContainer) return;
    
    // 1. Lancer l'animation de fermeture immédiatement (GPU-optimisée)
    if (itineraryDetailBackdrop) {
        itineraryDetailBackdrop.classList.remove('is-active');
    }
    itineraryDetailContainer.classList.remove('is-active');
    itineraryDetailContainer.classList.remove('is-scrolled');
    
    // 2. Annuler tout drag en cours
    cancelBottomSheetDrag();
    
    // 3. Débloquer le scroll IMMÉDIATEMENT (pas d'attente)
    document.body.classList.remove('detail-view-open');
    unlockBodyScrollIfStuck();
    
    // 4. Attendre la transition CSS AVANT de nettoyer le contenu
    setTimeout(() => {
        resetDetailViewState();
    }, DETAIL_SHEET_TRANSITION_MS);
}

function resetDetailViewState() {
    if (!itineraryDetailContainer) return;
    
    // Masquage CSS pur
    itineraryDetailContainer.classList.add('hidden');
    itineraryDetailContainer.classList.remove('is-active', 'is-scrolled');
    
    // Nettoyage visuel du sheet
    if (detailBottomSheet) {
        detailBottomSheet.classList.remove('is-dragging', 'sheet-height-no-transition');
        itineraryDetailContainer?.classList.remove('sheet-is-dragging');
        detailBottomSheet.style.removeProperty('--sheet-height');
    }
    resetDetailPanelScroll();
    
    // V265: replaceChildren est plus rapide que innerHTML = ''
    if (detailPanelContent && detailPanelContent.hasChildNodes()) {
        detailPanelContent.replaceChildren();
    }
    
    // Nettoyage des layers Leaflet (rapide)
    if (currentDetailRouteLayer && detailMapRenderer?.map) {
        detailMapRenderer.map.removeLayer(currentDetailRouteLayer);
        currentDetailRouteLayer = null;
    }
    if (currentDetailMarkerLayer) {
        currentDetailMarkerLayer.clearLayers();
    }
    if (itineraryDetailBackdrop) {
        itineraryDetailBackdrop.classList.remove('is-active');
        itineraryDetailBackdrop.classList.add('hidden');
    }
}

function resetDetailPanelScroll() {
    if (!detailPanelWrapper) return;
    detailPanelWrapper.scrollTop = 0;
    detailPanelWrapper.scrollLeft = 0;
    requestAnimationFrame(() => {
        if (!detailPanelWrapper) return;
        if (detailPanelWrapper.scrollTop !== 0) {
            detailPanelWrapper.scrollTop = 0;
        }
        if (detailPanelWrapper.scrollLeft !== 0) {
            detailPanelWrapper.scrollLeft = 0;
        }
    });
}


function showDashboardView(viewName) {
    // V355: Optimisation - utiliser requestAnimationFrame pour la fluidité
    const fromScreen = getVisibleAppScreen();
    
    // V355: Transition optimisée avec RAF
    requestAnimationFrame(() => {
        if (fromScreen !== dashboardContainer) {
            animateScreenSwap(fromScreen, dashboardContainer);
        }
        
        if (dashboardContainer) dashboardContainer.classList.remove('hidden');
        
        // V355: Scroll instantané pour éviter le lag
        window.scrollTo({ top: 0, behavior: 'instant' });
        
        // Reset des vues en batch
        const cards = document.querySelectorAll('#dashboard-content-view .card');
        cards.forEach(card => card.classList.remove('view-active'));

        dashboardHall.classList.remove('view-is-active');
        dashboardContentView.classList.add('view-is-active');
        
        if (dashboardContentView) dashboardContentView.scrollTop = 0;
        
        document.body.classList.remove('view-map-locked', 'view-is-locked', 'itinerary-view-active');
        
        if (alertBanner) alertBanner.classList.add('hidden');

        // Update bottom nav
        if (viewName === 'horaires') setBottomNavActive('horaires');
        else if (viewName === 'info-trafic') setBottomNavActive('info-trafic');
        else setBottomNavActive('hall');

        const activeCard = document.getElementById(viewName);
        if (activeCard) {
            // Affichage après transition
            const delay = fromScreen !== dashboardContainer ? SCREEN_TRANSITION_MS : 0;
            setTimeout(() => {
                activeCard.classList.add('view-active');
                activeCard.scrollTop = 0;
                
                // V356: Rendre les infos trafic APRÈS que la carte soit visible
                if (viewName === 'info-trafic') {
                    renderInfoTraficCard();
                }
            }, delay);
        }
    });
}


// --- Fonctions de l'application (logique métier GTFS) ---

function checkAndSetupTimeMode() {
    timeManager.setMode('real');
    timeManager.play();
    console.log('⏰ Mode TEMPS RÉEL activé.');
}

function initializeRouteFilter() {
    const routeCheckboxesContainer = document.getElementById('route-checkboxes');
    if (!routeCheckboxesContainer || !dataManager) return;

    routeCheckboxesContainer.innerHTML = '';
    visibleRoutes.clear();
    const routesByCategory = {};
    Object.keys(LINE_CATEGORIES).forEach(cat => { routesByCategory[cat] = []; });
    routesByCategory['autres'] = [];
    
    dataManager.routes.forEach(route => {
        visibleRoutes.add(route.route_id);
        const category = getCategoryForRoute(route.route_short_name);
        routesByCategory[category].push(route);
    });
    Object.values(routesByCategory).forEach(routes => {
        routes.sort((a, b) => a.route_short_name.localeCompare(b.route_short_name, undefined, {numeric: true}));
    });

    Object.entries(LINE_CATEGORIES).forEach(([categoryId, categoryInfo]) => {
        const routes = routesByCategory[categoryId];
        
        // ✅ V57.1 (CORRECTION BUG) : 'continue' remplacé par 'return'
        if (routes.length === 0) return; 

        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'category-header';
        categoryHeader.innerHTML = `
            <div class="category-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="${categoryInfo.color}"><circle cx="12" cy="12" r="10"/></svg>
                <strong>${categoryInfo.name}</strong>
                <span class="category-count">(${routes.length})</span>
            </div>
            <div class="category-actions">
                <button class="btn-category-action" data-category="${categoryId}" data-action="select">Tous</button>
                <button class="btn-category-action" data-category="${categoryId}" data-action="deselect">Aucun</button>
            </div>`;
        routeCheckboxesContainer.appendChild(categoryHeader);
        
        const categoryContainer = document.createElement('div');
        categoryContainer.className = 'category-routes';
        categoryContainer.id = `category-${categoryId}`;
        routes.forEach(route => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'route-checkbox-item';
            
            // *** CORRECTION V30 (BUG ##) ***
            // Le '#' est retiré des variables. Il est appliqué
            // directement et uniquement dans la chaîne innerHTML.
            const routeColor = route.route_color ? route.route_color : '3388ff';
            const textColor = route.route_text_color ? route.route_text_color : 'ffffff';
            
            itemDiv.innerHTML = `
                <input type="checkbox" id="route-${route.route_id}" data-category="${categoryId}" checked>
                <div class="route-badge" style="background-color: #${routeColor}; color: #${textColor};">
                    ${route.route_short_name || route.route_id}
                </div>
                <span class="route-name">${route.route_long_name || route.route_short_name || route.route_id}</span>
            `;
            
            itemDiv.querySelector('input[type="checkbox"]').addEventListener('change', handleRouteFilterChange);
            itemDiv.addEventListener('mouseenter', () => mapRenderer.highlightRoute(route.route_id, true));
            itemDiv.addEventListener('mouseleave', () => mapRenderer.highlightRoute(route.route_id, false));
            itemDiv.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return;
                mapRenderer.zoomToRoute(route.route_id);
            });
            categoryContainer.appendChild(itemDiv);
        });
        routeCheckboxesContainer.appendChild(categoryContainer);
    });

    document.querySelectorAll('.btn-category-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            const action = e.target.dataset.action;
            handleCategoryAction(category, action);
        });
    });
}

function handleCategoryAction(category, action) {
    const checkboxes = document.querySelectorAll(`input[data-category="${category}"]`);
    checkboxes.forEach(checkbox => { checkbox.checked = (action === 'select'); });
    handleRouteFilterChange();
}

function handleRouteFilterChange() {
    if (!dataManager) return;
    visibleRoutes.clear();
    dataManager.routes.forEach(route => {
        const checkbox = document.getElementById(`route-${route.route_id}`);
        if (checkbox && checkbox.checked) { 
            visibleRoutes.add(route.route_id);
            // 📊 ANALYTICS: Tracker les lignes consultées/activées
            analyticsManager.trackRouteClick(route.route_id, route.route_short_name);
        }
    });
    // Afficher les tracés avec geoJson existant ou généré à partir des shapes
    const geoJsonData = dataManager.geoJson;
    if (geoJsonData) {
        mapRenderer.displayMultiColorRoutes(geoJsonData, dataManager, visibleRoutes);
    }
    updateData();
}

function handleSearchInput(e) {
    const query = e.target.value.toLowerCase();
    if (query.length < 2) {
        searchResultsContainer.classList.add('hidden');
        searchResultsContainer.innerHTML = '';
        return;
    }
    if (!dataManager) return;
    const matches = dataManager.masterStops
        .filter(stop => stop.stop_name.toLowerCase().includes(query))
        .slice(0, 10); 
    displaySearchResults(matches, query);
}

function displaySearchResults(stops, query) {
    searchResultsContainer.innerHTML = '';
    if (stops.length === 0) {
        searchResultsContainer.innerHTML = `<div class="search-result-item">Aucun arrêt trouvé.</div>`;
        searchResultsContainer.classList.remove('hidden');
        return;
    }
    stops.forEach(stop => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        const regex = new RegExp(`(${query})`, 'gi');
        item.innerHTML = stop.stop_name.replace(regex, '<strong>$1</strong>');
        item.addEventListener('click', () => onSearchResultClick(stop));
        searchResultsContainer.appendChild(item);
    });
    searchResultsContainer.classList.remove('hidden');
}

function onSearchResultClick(stop) {
    showMapView(); 
    if (mapRenderer) {
        mapRenderer.zoomToStop(stop);
        mapRenderer.onStopClick(stop);
    }
    searchBar.value = stop.stop_name;
    searchResultsContainer.classList.add('hidden');
}

/**
 * Fonction de mise à jour principale (pour la carte temps réel)
 */
function updateData() {
    if (!timeManager || !tripScheduler || !busPositionCalculator || !mapRenderer) {
        return;
    }

    const currentSeconds = timeManager.getCurrentSeconds();
    const currentDate = timeManager.getCurrentDate(); 
    
    updateClock(currentSeconds);
    
    const activeBuses = tripScheduler.getActiveTrips(currentSeconds, currentDate);
    let allBusesWithPositions = busPositionCalculator.calculateAllPositions(activeBuses);

    // V306: Corriger la position visuelle des bus retardés en "rembobinant" le temps
    // Si le RT indique un temps restant plus élevé que le théorique, on calcule une
    // position alternative en utilisant currentSeconds - delaySeconds.
    allBusesWithPositions = allBusesWithPositions.map(bus => {
        try {
            if (!bus || !bus.segment) return bus;

            // rtInfo peut provenir du calcul initial; si absent, on skip
            const rtMinutes = bus.rtInfo?.rtMinutes ?? null;
            if (rtMinutes === null) return bus;

            const rtRemainingSeconds = Number(rtMinutes) * 60;
            const remainingSecondsTheoretical = (bus.segment.arrivalTime - currentSeconds);
            const delaySeconds = Math.max(0, rtRemainingSeconds - remainingSecondsTheoretical);

            // V416: Enregistrer le retard dans la base Neon pour analyse
            if (delaySeconds > 60 && bus.route) { // Seuil: > 1 minute
                const delayData = {
                    tripId: bus.tripId,
                    delaySeconds: delaySeconds,
                    isMajor: delaySeconds >= 300, // > 5 min = majeur
                    stopId: bus.segment.toStopInfo?.stop_id,
                    relevantStop: bus.segment.toStopInfo
                };
                delayManager.recordDelay(delayData, bus.route, currentSeconds);
            }

            const MIN_DELAY_FOR_REWIND = 30; // seulement si retard > 30s
            if (delaySeconds > MIN_DELAY_FOR_REWIND) {
                const effectiveTime = currentSeconds - delaySeconds;
                const seg = bus.segment;
                const adjustedProgress = tripScheduler.calculateProgress(seg.departureTime, seg.arrivalTime, effectiveTime);
                const adjustedSegment = Object.assign({}, seg, { progress: adjustedProgress });
                const adjustedPosition = busPositionCalculator.calculatePosition(adjustedSegment, bus.route?.route_id, bus.tripId, bus.route?.route_short_name);
                if (adjustedPosition) {
                    return Object.assign({}, bus, {
                        position: adjustedPosition,
                        bearing: adjustedPosition.bearing || bus.bearing,
                        delay: delaySeconds // V416: Ajouter le retard au bus pour référence
                    });
                }
            }
        } catch (e) {
            // Fail silently and return original
            console.warn('[updateData] position rewind failed for', bus?.tripId, e);
        }
        return bus;
    });

    allBusesWithPositions.forEach(bus => {
        if (bus && bus.route) {
            const routeId = bus.route.route_id;
            bus.currentStatus = (lineStatuses[routeId] && lineStatuses[routeId].status) 
                                ? lineStatuses[routeId].status 
                                : 'normal';
            
            // V303: Définir isRealtime basé sur les données temps réel disponibles
            // Un bus est "temps réel" si on a des données récentes dans le cache
            if (bus.segment?.toStopInfo?.stop_id && realtimeManager) {
                const stopId = bus.segment.toStopInfo.stop_id;
                const stopCode = bus.segment.toStopInfo.stop_code;
                // Vérifier si le realtimeManager a préchargé des données pour cet arrêt
                bus.isRealtime = realtimeManager.hasRealtimeDataForStop?.(stopId, stopCode) ?? false;
            } else {
                bus.isRealtime = false;
            }
        }
    });
    
    const visibleBuses = allBusesWithPositions
        .filter(bus => bus !== null)
        .filter(bus => bus.route && visibleRoutes.has(bus.route.route_id)); 

    // Économie API GTFS-RT: si aucun bus et prochain départ lointain, couper l'auto-refresh jusqu'au matin
    __pmMaybeSleepRealtimeAutoRefresh(visibleBuses.length, currentSeconds, currentDate);
    
    mapRenderer.updateBusMarkers(visibleBuses, tripScheduler, currentSeconds);
    updateBusCount(visibleBuses.length, visibleBuses.length);
}

function updateClock(seconds) {
    const hours = Math.floor(seconds / 3600) % 24;
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    const currentTimeEl = document.getElementById('current-time');
    if (currentTimeEl) currentTimeEl.textContent = timeString;
    
    const now = new Date();
    const dateString = now.toLocaleDateString('fr-FR', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
    });
    const dateIndicatorEl = document.getElementById('date-indicator');
    if (dateIndicatorEl) dateIndicatorEl.textContent = dateString;
}

function updateBusCount(visible, total) {
    const busCountElement = document.getElementById('bus-count');
    if (busCountElement) {
        busCountElement.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10"/>
            </svg>
            ${visible} bus
        `;
    }
}

function updateDataStatus(message, status = '') {
    const statusElement = document.getElementById('data-status');
    if (statusElement) {
        statusElement.className = status;
        statusElement.textContent = message;
    }
}

export async function bootstrapApp() {
    await initializeApp();
}

// =====================
// DEBUG EXPORTS (harness)
// =====================
// Expose pure / side-effect-light helpers for local testing in debug.html
if (typeof window !== 'undefined') {
    window.__DEBUG = Object.assign({}, window.__DEBUG || {}, {
        // Imported pure functions from ranking.js
        rankArrivalItineraries,
        rankDepartureItineraries,
        deduplicateItineraries,
        filterExpiredDepartures,
        filterLateArrivals,
        // Local helpers (remain internal but exposed for inspection)
        processIntelligentResults,
        ensureItineraryPolylines,
        computeTimeDifferenceMinutes,
        getWaitStepPresentation,
        // State inspectors
        getAllFetched: () => allFetchedItineraries,
        getArrivalState: () => ({ lastSearchMode, arrivalRankedAll, arrivalRenderedCount, ARRIVAL_PAGE_SIZE }),
        // Manual trigger (simulate minimal search rendering without network)
        _debugRender: (mode='ALL') => resultsRenderer && resultsRenderer.render(mode),
        // V140: offline sorting check without external API
        simulateItinerarySorting: async function simulateItinerarySorting() {
            const sampleDepart = [
                { departureTime: '13:22', arrivalTime: '14:43', type: 'BUS' },
                { departureTime: '13:25', arrivalTime: '14:49', type: 'BUS' },
                { departureTime: '13:50', arrivalTime: '15:13', type: 'BUS' },
                { departureTime: '14:14', arrivalTime: '15:21', type: 'BUS' }
            ];

            const sampleArrive = [
                { departureTime: '12:39', arrivalTime: '13:51', type: 'BUS' },
                { departureTime: '13:25', arrivalTime: '14:49', type: 'BUS' },
                { departureTime: '14:06', arrivalTime: '15:00', type: 'BUS' },
                { departureTime: '13:50', arrivalTime: '15:13', type: 'BUS' },
                { departureTime: '13:22', arrivalTime: '14:43', type: 'BUS' }
            ];

            console.log('--- DEBUG PARTIR (tri croissant départ) ---');
            console.table(sortItinerariesByDeparture(sampleDepart).map(it => ({ dep: it.departureTime, arr: it.arrivalTime })));

            console.log('--- DEBUG ARRIVER (cible 15:00, tri arrivée décroissante) ---');
            const rankedArrive = rankArrivalItineraries(sampleArrive, { type: 'arriver', hour: '15', minute: '00' });
            console.table(rankedArrive.map(it => ({ dep: it.departureTime, arr: it.arrivalTime })));
        }
    });
}
