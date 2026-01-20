/**
 * screenManager.js - Gestion des transitions entre écrans
 * 
 * Extrait de main.js pour améliorer la maintenabilité
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 */

// Configuration
const SCREEN_TRANSITION_MS = 180;

// État interne
let screenSwapToken = 0;
let screenSwapTimeoutId = null;
let isScreenSwapping = false;
let pendingNavAction = null;

/**
 * Vérifie si l'utilisateur préfère les animations réduites
 * @returns {boolean}
 */
export function prefersReducedMotion() {
    try {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
        return false;
    }
}

/**
 * Retourne l'écran actuellement visible
 * @param {HTMLElement[]} screens - Liste des écrans candidats
 * @returns {HTMLElement|null}
 */
export function getVisibleScreen(screens) {
    return screens.find(el => el && !el.classList.contains('hidden')) || null;
}

/**
 * Anime la transition entre deux écrans
 * @param {HTMLElement} fromEl - Écran source
 * @param {HTMLElement} toEl - Écran destination
 * @param {Object} options - Options de transition
 * @param {number} options.duration - Durée de la transition en ms
 * @param {Function} options.onComplete - Callback appelé à la fin
 */
export function animateScreenSwap(fromEl, toEl, options = {}) {
    const { duration = SCREEN_TRANSITION_MS, onComplete } = options;
    
    screenSwapToken += 1;
    const swapToken = screenSwapToken;
    isScreenSwapping = true;

    if (screenSwapTimeoutId) {
        clearTimeout(screenSwapTimeoutId);
        screenSwapTimeoutId = null;
    }

    if (!toEl || fromEl === toEl) {
        if (toEl) toEl.classList.remove('hidden');
        isScreenSwapping = false;
        if (typeof onComplete === 'function') onComplete();
        return;
    }

    // Reset des classes de transition
    const transitionClasses = [
        'page-transition-enter',
        'page-transition-enter-active',
        'page-transition-exit',
        'page-transition-exit-active'
    ];
    
    if (fromEl) fromEl.classList.remove(...transitionClasses);
    toEl.classList.remove(...transitionClasses);

    // Mode réduit: transition instantanée
    if (prefersReducedMotion()) {
        if (fromEl) fromEl.classList.add('hidden');
        toEl.classList.remove('hidden');
        isScreenSwapping = false;
        if (typeof onComplete === 'function') onComplete();
        return;
    }

    // Animation standard
    toEl.classList.remove('hidden');
    toEl.classList.add('page-transition-enter');

    if (fromEl) {
        fromEl.classList.add('page-transition-exit');
    }

    // Forcer un reflow pour que les transitions CSS se déclenchent
    void toEl.offsetWidth;

    // Déclencher les classes "active"
    requestAnimationFrame(() => {
        if (swapToken !== screenSwapToken) return;
        
        toEl.classList.add('page-transition-enter-active');
        if (fromEl) {
            fromEl.classList.add('page-transition-exit-active');
        }
    });

    // Nettoyer après la transition
    screenSwapTimeoutId = setTimeout(() => {
        if (swapToken !== screenSwapToken) return;
        
        screenSwapTimeoutId = null;
        
        if (fromEl) {
            fromEl.classList.add('hidden');
            fromEl.classList.remove(...transitionClasses);
        }
        
        toEl.classList.remove(...transitionClasses);
        isScreenSwapping = false;
        
        if (typeof onComplete === 'function') onComplete();
    }, duration);
}

/**
 * Vérifie si une transition est en cours
 * @returns {boolean}
 */
export function isSwapping() {
    return isScreenSwapping;
}

/**
 * Définit une action de navigation en attente
 * @param {string|null} action
 */
export function setPendingNavAction(action) {
    pendingNavAction = action;
}

/**
 * Récupère et efface l'action de navigation en attente
 * @returns {string|null}
 */
export function consumePendingNavAction() {
    const action = pendingNavAction;
    pendingNavAction = null;
    return action;
}

/**
 * Annule toute transition en cours
 */
export function cancelScreenSwap() {
    if (screenSwapTimeoutId) {
        clearTimeout(screenSwapTimeoutId);
        screenSwapTimeoutId = null;
    }
    isScreenSwapping = false;
}

export default {
    prefersReducedMotion,
    getVisibleScreen,
    animateScreenSwap,
    isSwapping,
    setPendingNavAction,
    consumePendingNavAction,
    cancelScreenSwap,
    SCREEN_TRANSITION_MS
};
