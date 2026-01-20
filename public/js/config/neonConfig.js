/**
 * neonConfig.js - Configuration centralisée pour Neon Database
 * 
 * Ce fichier centralise la configuration Neon pour toutes les pages PériMap.
 * La clé API doit être définie dans les variables d'environnement Vercel.
 * 
 * Variables d'environnement requises côté Vercel:
 * - DATABASE_URL : URL de connexion PostgreSQL Neon (pour les API serverless)
 * - NEON_API_KEY : Clé API pour l'accès REST direct (optionnel, pour le frontend)
 */

// Configuration Neon REST API
export const NEON_CONFIG = {
    // URL de base de l'API REST Neon
    restBaseUrl: 'https://ep-fragrant-silence-abgl9bv2.apirest.eu-west-2.aws.neon.tech/neondb/rest/v1',
    
    // Nom de la table pour les retards
    delayTable: 'delay_reports',
    
    // Timeout des requêtes (ms)
    timeout: 10000,
    
    // Activer/désactiver l'envoi vers Neon
    enabled: true,
    
    // Mode debug
    debug: false
};

/**
 * Initialise la configuration Neon côté client
 * Doit être appelé au chargement de chaque page
 */
export function initNeonConfig() {
    // Définir les variables globales si pas déjà fait
    if (!window.PERIBUS_NEON_REST_URL) {
        window.PERIBUS_NEON_REST_URL = NEON_CONFIG.restBaseUrl;
    }
    
    // La clé API sera injectée par Vercel via la meta tag ou env
    // Si pas de clé, l'envoi REST sera désactivé (fallback sur API serverless)
    if (!window.PERIBUS_NEON_REST_KEY) {
        window.PERIBUS_NEON_REST_KEY = '';
    }
    
    // URL de base de l'API PériMap
    if (!window.PERIBUS_API_BASE_URL) {
        window.PERIBUS_API_BASE_URL = 'https://www.xn--primap-bva.fr';
    }
    
    if (NEON_CONFIG.debug) {
        console.log('[NeonConfig] Configuration initialisée:', {
            restUrl: window.PERIBUS_NEON_REST_URL,
            hasKey: !!window.PERIBUS_NEON_REST_KEY,
            apiBase: window.PERIBUS_API_BASE_URL
        });
    }
}

/**
 * Vérifie si l'envoi direct vers Neon REST est possible
 * @returns {boolean}
 */
export function canUseNeonRest() {
    return !!(
        NEON_CONFIG.enabled &&
        window.PERIBUS_NEON_REST_URL &&
        window.PERIBUS_NEON_REST_KEY
    );
}

/**
 * Construit les headers pour une requête Neon REST
 * @returns {Object}
 */
export function getNeonHeaders() {
    const headers = {
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    };
    
    const key = window.PERIBUS_NEON_REST_KEY;
    if (key) {
        headers['apikey'] = key;
        headers['Authorization'] = `Bearer ${key}`;
    }
    
    return headers;
}

/**
 * Envoie des données de retard vers Neon
 * @param {Object} delayData - Données de retard à enregistrer
 * @returns {Promise<boolean>} - true si succès
 */
export async function sendDelayToNeon(delayData) {
    if (!canUseNeonRest()) {
        if (NEON_CONFIG.debug) {
            console.log('[NeonConfig] REST désactivé, utilisation API serverless');
        }
        return false;
    }
    
    try {
        const now = new Date();
        const payload = {
            line_code: delayData.line || delayData.lineCode,
            stop_name: delayData.stop || delayData.stopName || null,
            stop_id: delayData.stopId || null,
            scheduled_time: delayData.scheduled || delayData.scheduledTime || null,
            actual_time: delayData.actual || delayData.actualTime || null,
            delay_minutes: Number(delayData.delay || delayData.delayMinutes || 0),
            direction: delayData.direction || null,
            is_realtime: delayData.isRealtime !== false,
            trip_id: delayData.tripId || null,
            source: delayData.source || 'hawk',
            day_of_week: now.getDay(),
            hour_of_day: now.getHours()
        };
        
        const response = await fetch(
            `${window.PERIBUS_NEON_REST_URL}/${NEON_CONFIG.delayTable}`,
            {
                method: 'POST',
                headers: getNeonHeaders(),
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(NEON_CONFIG.timeout)
            }
        );
        
        if (response.ok || response.status === 201) {
            if (NEON_CONFIG.debug) {
                console.log('[NeonConfig] ✅ Retard envoyé à Neon REST');
            }
            return true;
        } else {
            if (NEON_CONFIG.debug) {
                console.warn('[NeonConfig] ⚠️ Erreur Neon REST:', response.status);
            }
            return false;
        }
    } catch (error) {
        if (NEON_CONFIG.debug) {
            console.error('[NeonConfig] ❌ Erreur envoi Neon:', error.message);
        }
        return false;
    }
}

/**
 * Récupère les statistiques de retard depuis Neon
 * Via l'API serverless (plus fiable, pas besoin de clé côté client)
 * @param {Object} options - Options de filtrage
 * @returns {Promise<Object|null>}
 */
export async function fetchDelayStats(options = {}) {
    const { line, days = 30, detailed = false } = options;
    
    try {
        const params = new URLSearchParams();
        if (line) params.set('line', line);
        if (days) params.set('days', days);
        if (detailed) params.set('detailed', 'true');
        
        const apiBase = window.PERIBUS_API_BASE_URL || '';
        const url = `${apiBase}/api/delay-stats?${params.toString()}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(NEON_CONFIG.timeout)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('[NeonConfig] Erreur récupération stats:', error.message);
        return null;
    }
}

// Auto-init si le DOM est prêt
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNeonConfig);
    } else {
        initNeonConfig();
    }
}
