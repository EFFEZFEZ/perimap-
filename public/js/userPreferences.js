/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * userPreferences.js - Gestion des préférences utilisateur et lignes favorites
 */

const STORAGE_KEY = 'perimap_user_prefs';
const MAX_RECENT_LINES = 10;
const MAX_CLICK_HISTORY = 50;

class UserPreferences {
    constructor() {
        this.data = this.load();
    }

    load() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Migration si ancienne version
                if (!parsed.version || parsed.version < 2) {
                    return this.getDefaultData();
                }
                return parsed;
            }
        } catch (e) {
            console.warn('[UserPrefs] Erreur chargement:', e);
        }
        return this.getDefaultData();
    }

    getDefaultData() {
        return {
            version: 2,
            lineClicks: {},        // { "A": 5, "B": 3, ... }
            recentLines: [],       // ["A", "B", "C"] - ordre chronologique
            lastVisit: Date.now(),
            sessionStart: Date.now(),
            totalSessions: 1,
            favoriteStops: [],     // Pour futur usage
            theme: 'auto'
        };
    }

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('[UserPrefs] Erreur sauvegarde:', e);
        }
    }

    /**
     * Enregistre un clic sur une ligne
     */
    trackLineClick(lineCode) {
        if (!lineCode) return;
        const normalized = String(lineCode).trim().toUpperCase();
        
        // Incrémenter le compteur de clics
        this.data.lineClicks[normalized] = (this.data.lineClicks[normalized] || 0) + 1;
        
        // Ajouter aux lignes récentes (en tête)
        this.data.recentLines = this.data.recentLines.filter(l => l !== normalized);
        this.data.recentLines.unshift(normalized);
        
        // Limiter la taille
        if (this.data.recentLines.length > MAX_RECENT_LINES) {
            this.data.recentLines = this.data.recentLines.slice(0, MAX_RECENT_LINES);
        }
        
        this.save();
    }

    /**
     * Retourne les lignes les plus populaires pour l'utilisateur
     * Combine: clics récents + fréquence globale
     */
    getPopularLines(limit = 8) {
        const scores = {};
        
        // Score basé sur les clics (poids: 2)
        Object.entries(this.data.lineClicks).forEach(([line, clicks]) => {
            scores[line] = (scores[line] || 0) + clicks * 2;
        });
        
        // Score basé sur récence (poids décroissant)
        this.data.recentLines.forEach((line, index) => {
            const recencyBonus = Math.max(0, (MAX_RECENT_LINES - index) * 3);
            scores[line] = (scores[line] || 0) + recencyBonus;
        });
        
        // Trier par score décroissant
        const sorted = Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .map(([line]) => line)
            .slice(0, limit);
        
        return sorted;
    }

    /**
     * Vérifie si l'utilisateur a des préférences personnalisées
     */
    hasPersonalizedData() {
        return Object.keys(this.data.lineClicks).length > 0 || this.data.recentLines.length > 0;
    }

    /**
     * Retourne les lignes récentes (les plus récemment cliquées)
     */
    getRecentLines(limit = 5) {
        return this.data.recentLines.slice(0, limit);
    }

    /**
     * Nouvelle session
     */
    startSession() {
        const now = Date.now();
        const lastVisit = this.data.lastVisit || now;
        const hoursSinceLastVisit = (now - lastVisit) / (1000 * 60 * 60);
        
        // Nouvelle session si plus de 30 minutes
        if (hoursSinceLastVisit > 0.5) {
            this.data.totalSessions = (this.data.totalSessions || 0) + 1;
            this.data.sessionStart = now;
        }
        
        this.data.lastVisit = now;
        this.save();
    }

    /**
     * Reset des données (pour debug)
     */
    reset() {
        this.data = this.getDefaultData();
        this.save();
    }

    /**
     * Export pour analytics
     */
    getStats() {
        return {
            totalClicks: Object.values(this.data.lineClicks).reduce((a, b) => a + b, 0),
            uniqueLines: Object.keys(this.data.lineClicks).length,
            sessions: this.data.totalSessions,
            topLines: this.getPopularLines(5)
        };
    }
}

// Instance singleton
export const userPreferences = new UserPreferences();

// Initialiser la session au chargement
if (typeof window !== 'undefined') {
    userPreferences.startSession();
}
