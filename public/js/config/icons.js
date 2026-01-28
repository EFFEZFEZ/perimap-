/*
 * Copyright (c) 2025 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * icons.js - Définition centralisée de toutes les icônes SVG
 * 
 * Ce module exporte l'objet ICONS contenant toutes les icônes SVG
 * utilisées dans l'application.
 */

export const ICONS = {
    // V93: Icônes modernisées style SF Symbols / Material Design 3
    BUS: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>`,
    busSmall: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>`,
    statusTriangle: `<svg width="16" height="8" viewBox="0 0 16 8" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8 0L16 8H0L8 0Z" /></svg>`,
    statusWarning: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    statusError: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    // Vélo moderne rempli
    BICYCLE: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/></svg>`,
    // Piéton moderne rempli
    WALK: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/></svg>`,
    // Étoile favori moderne
    ALL: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z"/></svg>`,
    // Feuille éco moderne
    LEAF_ICON: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"/></svg>`,
    GEOLOCATE: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.5a6.5 6.5 0 0 0-6.5 6.5c0 4.9 6.5 12.5 6.5 12.5s6.5-7.6 6.5-12.5A6.5 6.5 0 0 0 12 2.5Zm0 9.3a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6Z"/></svg>`,
    GEOLOCATE_SPINNER: `<div class="spinner"></div>`,
    MAP_LOCATE: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L7 12l10 0L12 2z"/><circle cx="12" cy="12" r="10"/></svg>`,
    // Icônes de manœuvre pour les étapes de marche
    MANEUVER: {
        STRAIGHT: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`,
        TURN_LEFT: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>`,
        TURN_RIGHT: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"></polyline><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg>`,
        TURN_SLIGHT_LEFT: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M17 5 9 13v7"></path><path d="m8 18 4-4"></path></svg>`,
        TURN_SLIGHT_RIGHT: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21 3-5 5"/><path d="M21 3v8h-8"/><path d="m3 21 5.5-5.5"/></svg>`,
        ROUNDABOUT_LEFT: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 9.5c.1-.4.5-.8.9-1s1-.3 1.5-.3c.7 0 1.3.1 1.9.4c.6.3 1.1.7 1.5 1.1c.4.5.7 1 .8 1.7c.1.6.1 1.3 0 1.9c-.2.7-.4 1.3-.8 1.8c-.4.5-1 1-1.6 1.3c-.6.3-1.3.5-2.1.5c-.6 0-1.1-.1-1.6-.2c-.5-.1-1-.4-1.4-.7c-.4-.3-.7-.7-.9-1.1"></path><path d="m7 9 3-3 3 3"></path><circle cx="12" cy="12" r="10"></circle></svg>`,
        ROUNDABOUT_RIGHT: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9.5c-.1-.4-.5-.8-.9-1s-1-.3-1.5-.3c-.7 0-1.3.1-1.9.4c-.6.3-1.1.7-1.5 1.1c-.4.5-.7 1-.8 1.7c-.1.6-.1 1.3 0 1.9c.2.7.4 1.3.8 1.8c.4.5 1 1 1.6 1.3c.6.3 1.3.5 2.1.5c.6 0 1.1-.1 1.6-.2c.5-.1 1-.4 1.4-.7c.4-.3.7-.7-.9-1.1"></path><path d="m17 9-3-3-3 3"></path><circle cx="12" cy="12" r="10"></circle></svg>`,
        DEFAULT: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m12 16 4-4-4-4"></path><path d="M8 12h8"></path></svg>`
    }
};

// Icônes pour le bandeau d'alerte
export const ALERT_BANNER_ICONS = {
    annulation: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    retard: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
};

/**
 * Récupère l'icône de manœuvre appropriée
 * @param {string} maneuver - Type de manœuvre
 * @returns {string} - HTML de l'icône SVG
 */
export function getManeuverIcon(maneuver) {
    switch(maneuver) {
        case 'TURN_LEFT': return ICONS.MANEUVER.TURN_LEFT;
        case 'TURN_RIGHT': return ICONS.MANEUVER.TURN_RIGHT;
        case 'TURN_SLIGHT_LEFT': return ICONS.MANEUVER.TURN_SLIGHT_LEFT;
        case 'TURN_SLIGHT_RIGHT': return ICONS.MANEUVER.TURN_SLIGHT_RIGHT;
        case 'ROUNDABOUT_LEFT': return ICONS.MANEUVER.ROUNDABOUT_LEFT;
        case 'ROUNDABOUT_RIGHT': return ICONS.MANEUVER.ROUNDABOUT_RIGHT;
        case 'STRAIGHT': return ICONS.MANEUVER.STRAIGHT;
        default: return ICONS.MANEUVER.DEFAULT;
    }
}

/**
 * Récupère l'icône d'alerte appropriée pour le bandeau
 * @param {string} type - Type d'alerte (annulation, retard, etc.)
 * @returns {string} - HTML de l'icône SVG
 */
export function getAlertBannerIcon(type) {
    if (!type) {
        return ALERT_BANNER_ICONS.default;
    }
    return ALERT_BANNER_ICONS[type] || ALERT_BANNER_ICONS.default;
}

export default ICONS;

