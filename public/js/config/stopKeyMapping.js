/**
 * stopKeyMapping.js - Mapping entre stop_id GTFS et clés hawk.perimouv.fr
 * 
 * Ce fichier fait le lien entre les identifiants GTFS (ex: MOBIITI:StopPlace:77324)
 * et les clés numériques utilisées par hawk.perimouv.fr pour les QR codes
 * 
 * Format: stop_id GTFS -> clé hawk (ou null si pas de correspondance connue)
 * 
 * NOTE: Ce mapping doit être enrichi manuellement ou via analyse des QR codes
 * des arrêts de bus physiques.
 */

// Mapping direct par clé numérique (pour tests)
// Les clés hawk sont généralement visibles sur les QR codes des arrêts
export const HAWK_KEY_BY_STOP_ID = {
    // À remplir avec les vraies correspondances
    // Exemple: 'MOBIITI:StopPlace:77328': '83',
};

// Mapping inverse (utile pour la recherche)
export const STOP_ID_BY_HAWK_KEY = {};

// Construire le mapping inverse
Object.entries(HAWK_KEY_BY_STOP_ID).forEach(([stopId, hawkKey]) => {
    if (hawkKey) {
        STOP_ID_BY_HAWK_KEY[hawkKey] = stopId;
    }
});

/**
 * Tente de trouver la clé hawk pour un stop_id GTFS
 * @param {string} stopId - L'identifiant GTFS de l'arrêt
 * @returns {string|null} La clé hawk ou null
 */
export function getHawkKeyForStop(stopId) {
    // 1. Vérifier le mapping direct
    if (HAWK_KEY_BY_STOP_ID[stopId]) {
        return HAWK_KEY_BY_STOP_ID[stopId];
    }
    
    // 2. Extraire le numéro du stop_id MOBIITI
    // Format: MOBIITI:StopPlace:77328 -> essayer 77328, ou partie
    const match = stopId.match(/(\d+)$/);
    if (match) {
        const numericPart = match[1];
        
        // Essayer le numéro complet d'abord
        // Certains arrêts peuvent avoir leur ID MOBIITI comme clé hawk
        return numericPart;
    }
    
    return null;
}

/**
 * Arrêts principaux connus avec temps réel disponible
 * (Ceux avec des panneaux d'affichage temps réel / QR codes)
 */
export const REALTIME_ENABLED_STOPS = [
    // Gares et pôles d'échange
    'MOBIITI:StopPlace:77328', // Trésorerie Municipale (centre Périgueux)
    'MOBIITI:StopPlace:2501',  // LR TRELISSAC - Les Garennes
    
    // À compléter avec les arrêts équipés QR code
];

/**
 * Vérifie si un arrêt a potentiellement le temps réel disponible
 * @param {string} stopId - L'identifiant GTFS de l'arrêt
 * @returns {boolean}
 */
export function isRealtimeEnabled(stopId) {
    // Pour l'instant, on tente pour tous les arrêts
    // Plus tard, on peut filtrer avec REALTIME_ENABLED_STOPS
    return true;
}

export default {
    HAWK_KEY_BY_STOP_ID,
    STOP_ID_BY_HAWK_KEY,
    getHawkKeyForStop,
    isRealtimeEnabled,
    REALTIME_ENABLED_STOPS
};
