/**
 * Configuration pour le système de gestion des retards
 * À placer dans: public/js/config/delayConfig.js
 * 
 * Customisez les paramètres selon vos besoins
 */

export const DELAY_CONFIG = {
    /**
     * Seuils de retard
     */
    thresholds: {
        minDelay: 120,              // Ignorer retards < 2 minutes
        majorDelay: 300,            // Retard "majeur" si > 5 minutes
        criticalDelay: 600          // Critique si > 10 minutes (optionnel)
    },

    /**
     * Stockage et persistence
     */
    storage: {
        localStorageKey: 'perimap_delay_stats',
        maxHistorySize: 5000,       // Garder dernier 5000 observations
        syncInterval: 5 * 60 * 1000 // Sync serveur toutes les 5 min
    },

    /**
     * Ajustement visuel des positions
     */
    positioning: {
        maxVisualAdjustment: 0.05,  // Max 5% d'ajustement de progression
        enableDelayAdjustment: true // Activer/désactiver l'ajustement
    },

    /**
     * UI et affichage
     */
    ui: {
        panelWidth: 400,            // Largeur du panneau (px)
        panelAnimationDuration: 300, // Durée animation (ms)
        updateInterval: 1000,       // Refresh stats (ms)
        maxVisibleStops: 10         // Top N arrêts à afficher
    },

    /**
     * API et serveur
     */
    api: {
        serverUrl: '/api/delay-stats',
        timeout: 10000,             // Timeout requêtes (ms)
        retryAttempts: 3,           // Tentatives en cas d'erreur
        retryDelay: 1000            // Délai entre tentatives (ms)
    },

    /**
     * Logging et debug
     */
    logging: {
        enabled: true,
        prefix: '[DelayManager]',
        verbose: false              // Logs détaillés?
    },

    /**
     * Exports et formats
     */
    export: {
        csvDelimiter: ',',
        csvEncoding: 'utf-8',
        jsonIndent: 2
    },

    /**
     * Noms des lignes (mapping)
     */
    lineNames: {
        'A': 'Ligne A',
        'B': 'Ligne B',
        'C': 'Ligne C',
        'D': 'Ligne D',
        'express': 'Express'
    },

    /**
     * Couleurs par ligne (optionnel)
     */
    lineColors: {
        'A': '#ff9800',     // Orange
        'B': '#2196f3',     // Bleu
        'C': '#f44336',     // Rouge
        'D': '#4caf50',     // Vert
        'express': '#9c27b0' // Violet
    },

    /**
     * Seuils visuels pour alertes
     */
    alerts: {
        warningThreshold: 300,      // > 5 min = alerte
        criticalThreshold: 600,     // > 10 min = critique
        showNotifications: false    // Afficher notifications?
    },

    /**
     * Raccourcis clavier (futur)
     */
    shortcuts: {
        togglePanel: 'Shift+R',     // Maj+R pour ouvrir/fermer
        exportStats: 'Ctrl+E',      // Ctrl+E pour exporter
        clearStats: 'Ctrl+Shift+D'  // Ctrl+Maj+D pour effacer
    }
};

/**
 * Sauvegarder la configuration en localStorage
 */
export function saveConfig() {
    try {
        localStorage.setItem('perimap_delay_config', JSON.stringify(DELAY_CONFIG));
        console.log('[Config] ✅ Configuration sauvegardée');
    } catch (error) {
        console.warn('[Config] Impossible de sauvegarder config:', error);
    }
}

/**
 * Charger la configuration depuis localStorage
 */
export function loadConfig() {
    try {
        const stored = localStorage.getItem('perimap_delay_config');
        if (stored) {
            const loaded = JSON.parse(stored);
            Object.assign(DELAY_CONFIG, loaded);
            console.log('[Config] ✅ Configuration chargée');
            return DELAY_CONFIG;
        }
    } catch (error) {
        console.warn('[Config] Impossible de charger config:', error);
    }
    return DELAY_CONFIG;
}

/**
 * Réinitialiser la configuration par défaut
 */
export function resetConfig() {
    try {
        localStorage.removeItem('perimap_delay_config');
        console.log('[Config] 🔄 Configuration réinitialisée');
        return DELAY_CONFIG;
    } catch (error) {
        console.warn('[Config] Erreur lors de reset:', error);
    }
}

/**
 * Obtenir une valeur de config avec fallback
 */
export function getConfig(path, fallback = null) {
    const keys = path.split('.');
    let value = DELAY_CONFIG;
    
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return fallback;
        }
    }
    
    return value;
}

/**
 * Définir une valeur de config
 */
export function setConfig(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    let obj = DELAY_CONFIG;
    for (const key of keys) {
        if (!(key in obj)) {
            obj[key] = {};
        }
        obj = obj[key];
    }
    
    obj[lastKey] = value;
    console.log(`[Config] ${path} = ${value}`);
    saveConfig();
}

/**
 * Utilitaires de configuration
 */
export const ConfigUtils = {
    /**
     * Obtenir le nom d'une ligne
     */
    getLineName(lineId) {
        return DELAY_CONFIG.lineNames[lineId] || lineId;
    },

    /**
     * Obtenir la couleur d'une ligne
     */
    getLineColor(lineId) {
        return DELAY_CONFIG.lineColors[lineId] || '#666';
    },

    /**
     * Vérifier si retard est majeur
     */
    isMajorDelay(seconds) {
        return Math.abs(seconds) >= DELAY_CONFIG.thresholds.majorDelay;
    },

    /**
     * Vérifier si retard est critique
     */
    isCriticalDelay(seconds) {
        return Math.abs(seconds) >= DELAY_CONFIG.thresholds.criticalThreshold;
    },

    /**
     * Format de retard
     */
    formatDelay(seconds) {
        const sign = seconds < 0 ? '-' : '';
        const minutes = Math.floor(Math.abs(seconds) / 60);
        const secs = Math.abs(seconds) % 60;
        
        if (minutes === 0) return `${sign}${secs}s`;
        return `${sign}${minutes}m ${secs}s`;
    }
};

/**
 * Export par défaut
 */
export default DELAY_CONFIG;

/**
 * Initialisation au chargement
 */
if (typeof window !== 'undefined') {
    // Charger config au démarrage
    loadConfig();
    
    // Exposer en global pour debug
    window.DELAY_CONFIG = DELAY_CONFIG;
    window.setDelayConfig = setConfig;
    window.getDelayConfig = getConfig;
}
