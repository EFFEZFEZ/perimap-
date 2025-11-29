/**
 * theme.js - Gestion du thème clair/sombre
 * 
 * Ce module centralise la logique de thème de l'application.
 */

/**
 * Applique l'état du thème
 * @param {boolean} useDark - true pour le mode sombre
 * @param {UIManager} uiManager - Instance du UIManager
 * @param {Array} mapRenderers - Liste des renderers de carte à mettre à jour
 */
export function applyThemeState(useDark, uiManager, mapRenderers = []) {
    if (!uiManager) return;
    uiManager.applyThemeState(useDark, mapRenderers);
}

/**
 * Initialise le thème au démarrage
 * @param {UIManager} uiManager - Instance du UIManager
 * @param {Array} mapRenderers - Liste des renderers de carte
 */
export function initTheme(uiManager, mapRenderers = []) {
    if (!uiManager) return;
    uiManager.initTheme(mapRenderers);
}

/**
 * Configure le bouton toggle de thème
 * @param {UIManager} uiManager - Instance du UIManager  
 * @param {Array} mapRenderers - Liste des renderers de carte
 */
export function setupThemeToggle(uiManager, mapRenderers = []) {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    
    btn.addEventListener('click', () => {
        const nextIsDark = !document.body.classList.contains('dark-theme');
        applyThemeState(nextIsDark, uiManager, mapRenderers);
        try { 
            localStorage.setItem('ui-theme', nextIsDark ? 'dark' : 'light'); 
        } catch (e) { 
            // Ignore storage errors
        }
    }, { passive: true });
}

/**
 * Vérifie si le thème sombre est actif
 * @returns {boolean}
 */
export function isDarkTheme() {
    return document.body.classList.contains('dark-theme');
}

/**
 * Bascule le thème
 * @param {UIManager} uiManager
 * @param {Array} mapRenderers
 */
export function toggleTheme(uiManager, mapRenderers = []) {
    const nextIsDark = !isDarkTheme();
    applyThemeState(nextIsDark, uiManager, mapRenderers);
    try { 
        localStorage.setItem('ui-theme', nextIsDark ? 'dark' : 'light'); 
    } catch (e) {}
}

export default {
    applyThemeState,
    initTheme,
    setupThemeToggle,
    isDarkTheme,
    toggleTheme
};
