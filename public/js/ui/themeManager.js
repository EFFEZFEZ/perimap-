/**
 * themeManager.js - Gestion du thème clair/sombre
 * 
 * Extrait de main.js pour améliorer la maintenabilité
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 */

/**
 * Applique l'état du thème à l'application
 * @param {boolean} useDark - true pour le thème sombre
 * @param {Array} mapRenderers - Liste des renderers de carte à mettre à jour
 */
export function applyThemeState(useDark, mapRenderers = []) {
    const isDark = !!useDark;
    
    if (isDark) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    
    // Mettre à jour les icônes des toggles
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
        const icon = btn.querySelector('.theme-icon, svg');
        if (icon) {
            // Mettre à jour l'icône selon le thème
            if (btn.dataset.themeIcon === 'emoji') {
                icon.textContent = isDark ? '☀️' : '🌙';
            }
        }
    });
    
    // Notifier les renderers de carte du changement de thème
    mapRenderers.forEach(renderer => {
        if (renderer && typeof renderer.setTheme === 'function') {
            renderer.setTheme(isDark ? 'dark' : 'light');
        }
    });
}

/**
 * Initialise le thème au chargement de l'application
 * @param {Array} mapRenderers - Liste des renderers de carte
 */
export function initTheme(mapRenderers = []) {
    let shouldBeDark = false;
    
    try {
        const saved = localStorage.getItem('ui-theme');
        
        if (saved === 'dark') {
            shouldBeDark = true;
        } else if (saved === 'light') {
            shouldBeDark = false;
        } else {
            // Mode auto: respecter prefers-color-scheme
            shouldBeDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
        }
    } catch (e) {
        // localStorage indisponible, utiliser prefers-color-scheme
        shouldBeDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
    }
    
    applyThemeState(shouldBeDark, mapRenderers);
}

/**
 * Configure les écouteurs d'événements pour les boutons de toggle de thème
 * @param {Array} mapRenderers - Liste des renderers de carte
 * @param {Function} onThemeChange - Callback appelé lors du changement de thème
 */
export function wireThemeToggles(mapRenderers = [], onThemeChange = null) {
    const themeToggles = Array.from(document.querySelectorAll('[data-theme-toggle]'));
    
    themeToggles.forEach(btn => {
        btn.addEventListener('click', () => {
            let currentSaved;
            try {
                currentSaved = localStorage.getItem('ui-theme');
            } catch (e) {
                currentSaved = null;
            }
            
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
            
            applyThemeState(nextIsDark, mapRenderers);
            
            try {
                localStorage.setItem('ui-theme', nextMode);
            } catch (e) {
                // ignore
            }
            
            // Afficher un feedback
            const modeLabel = nextMode === 'auto' ? 'automatique 🌓' : (nextMode === 'dark' ? 'sombre 🌙' : 'clair ☀️');
            console.log(`🎨 Thème: ${modeLabel}`);
            
            if (typeof onThemeChange === 'function') {
                onThemeChange(nextMode, nextIsDark);
            }
        }, { passive: true });
    });
}

/**
 * Retourne le mode de thème actuel
 * @returns {'light' | 'dark' | 'auto'}
 */
export function getCurrentThemeMode() {
    try {
        return localStorage.getItem('ui-theme') || 'auto';
    } catch (e) {
        return 'auto';
    }
}

/**
 * Vérifie si le thème sombre est actuellement actif
 * @returns {boolean}
 */
export function isDarkTheme() {
    return document.body.classList.contains('dark-theme');
}

export default {
    applyThemeState,
    initTheme,
    wireThemeToggles,
    getCurrentThemeMode,
    isDarkTheme
};
