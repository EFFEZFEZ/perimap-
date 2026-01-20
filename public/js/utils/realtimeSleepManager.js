/**
 * realtimeSleepManager.js - Gestion du mode économie d'énergie pour le temps réel
 * 
 * Quand aucun bus n'est en service, désactive temporairement les requêtes RT
 * pour économiser les appels API et la batterie.
 * 
 * Extrait de main.js pour améliorer la maintenabilité
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 */

// Configuration
const SLEEP_MIN_GAP_MS = 45 * 60 * 1000; // 45 min sans bus → sleep
const WAKE_WARMUP_MS = 2 * 60 * 1000;    // Réveil 2 min avant le premier départ

// État interne
let sleepUntilMs = 0;
let sleepTimerId = null;
let lastCheckMs = 0;
const nextDepartureCache = new Map();

/**
 * Convertit une date en chaîne ISO locale (YYYY-MM-DD)
 * @param {Date} date
 * @returns {string}
 */
function localIsoDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Retourne le début du jour local
 * @param {Date} date
 * @returns {Date}
 */
function startOfLocalDay(date) {
    const d = date instanceof Date ? date : new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Ajoute des jours à une date
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
function addDaysLocal(date, days) {
    const d = date instanceof Date ? date : new Date(date);
    const out = new Date(d);
    out.setDate(out.getDate() + (days || 0));
    return out;
}

/**
 * Trouve le prochain départ après une heure donnée pour une date
 * @param {Object} dataManager - Instance du DataManager
 * @param {Date} dateObj - Date à vérifier
 * @param {number} afterSeconds - Secondes depuis minuit
 * @returns {number|null} Secondes du prochain départ ou null
 */
function findNextDepartureSecondsForDate(dataManager, dateObj, afterSeconds) {
    if (!dataManager || !dataManager.isLoaded) return null;
    
    const iso = localIsoDate(dateObj);
    const bucket = Math.max(0, Math.floor((Number(afterSeconds) || 0) / 300)); // bucket 5 min
    const cacheKey = `${iso}|${bucket}`;
    
    if (nextDepartureCache.has(cacheKey)) {
        return nextDepartureCache.get(cacheKey);
    }

    const serviceIdSet = dataManager.getServiceIds(dateObj);
    if (!serviceIdSet || serviceIdSet.size === 0) {
        nextDepartureCache.set(cacheKey, null);
        return null;
    }

    let best = null;
    const after = Number(afterSeconds) || 0;
    
    for (const trip of (dataManager.trips || [])) {
        if (!trip) continue;

        // Service actif?
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
            // Early exit si c'est maintenant
            if (best <= after + 60) break;
        }
    }

    nextDepartureCache.set(cacheKey, best);
    return best;
}

/**
 * Calcule le timestamp du prochain départ
 * @param {Object} dataManager
 * @param {Date} currentDateObj
 * @param {number} currentSeconds
 * @returns {number|null}
 */
function computeNextDepartureTimestampMs(dataManager, currentDateObj, currentSeconds) {
    const todayNext = findNextDepartureSecondsForDate(
        dataManager, 
        currentDateObj, 
        (Number(currentSeconds) || 0) + 1
    );
    
    if (todayNext !== null) {
        return startOfLocalDay(currentDateObj).getTime() + (todayNext * 1000);
    }

    const tomorrow = addDaysLocal(currentDateObj, 1);
    const tomorrowFirst = findNextDepartureSecondsForDate(dataManager, tomorrow, 0);
    
    if (tomorrowFirst === null) return null;
    return startOfLocalDay(tomorrow).getTime() + (tomorrowFirst * 1000);
}

/**
 * Vérifie et gère le mode sleep du temps réel
 * @param {Object} dataManager - Instance du DataManager
 * @param {Object} realtimeManager - Instance du RealtimeManager
 * @param {number} visibleBusCount - Nombre de bus visibles
 * @param {number} currentSeconds - Secondes depuis minuit
 * @param {Date} currentDateObj - Date actuelle
 */
export function maybeSleepRealtimeAutoRefresh(
    dataManager, 
    realtimeManager, 
    visibleBusCount, 
    currentSeconds, 
    currentDateObj
) {
    if (!realtimeManager || !dataManager) return;

    // Réveil immédiat si des bus sont en service
    if ((visibleBusCount || 0) > 0) {
        if (sleepTimerId) {
            clearTimeout(sleepTimerId);
            sleepTimerId = null;
        }
        if (sleepUntilMs) {
            sleepUntilMs = 0;
            try { realtimeManager.setSleepUntil?.(0); } catch (_) {}
            try { realtimeManager.startAutoRefresh?.(); } catch (_) {}
        }
        return;
    }

    // Déjà en sleep?
    if (realtimeManager.isSleeping?.()) return;

    // Vérifier au maximum une fois par minute
    const nowMs = Date.now();
    if (nowMs - lastCheckMs < 60 * 1000) return;
    lastCheckMs = nowMs;

    const nextDepartureMs = computeNextDepartureTimestampMs(
        dataManager, 
        currentDateObj, 
        currentSeconds
    );
    
    if (!nextDepartureMs) return;

    const gapMs = nextDepartureMs - nowMs;
    if (gapMs < SLEEP_MIN_GAP_MS) return;

    const sleepUntil = Math.max(nowMs + 5000, nextDepartureMs - WAKE_WARMUP_MS);
    sleepUntilMs = sleepUntil;
    
    try { realtimeManager.setSleepUntil?.(sleepUntil); } catch (_) {}

    if (sleepTimerId) {
        clearTimeout(sleepTimerId);
        sleepTimerId = null;
    }

    const delayMs = sleepUntil - nowMs;
    const safeDelayMs = Math.min(delayMs, 2147483000); // setTimeout max (~24.8 jours)
    
    sleepTimerId = setTimeout(() => {
        sleepTimerId = null;
        sleepUntilMs = 0;
        try { realtimeManager.setSleepUntil?.(0); } catch (_) {}
        try { realtimeManager.preloadPriorityStops?.(); } catch (_) {}
    }, safeDelayMs);
}

/**
 * Vérifie si le manager est en mode sleep
 * @returns {boolean}
 */
export function isSleeping() {
    return sleepUntilMs > Date.now();
}

/**
 * Force le réveil du mode sleep
 * @param {Object} realtimeManager
 */
export function wakeUp(realtimeManager) {
    if (sleepTimerId) {
        clearTimeout(sleepTimerId);
        sleepTimerId = null;
    }
    sleepUntilMs = 0;
    
    try { realtimeManager?.setSleepUntil?.(0); } catch (_) {}
    try { realtimeManager?.preloadPriorityStops?.(); } catch (_) {}
}

/**
 * Nettoie le cache des prochains départs
 */
export function clearCache() {
    nextDepartureCache.clear();
}

export default {
    maybeSleepRealtimeAutoRefresh,
    isSleeping,
    wakeUp,
    clearCache,
    SLEEP_MIN_GAP_MS,
    WAKE_WARMUP_MS
};
