/*
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */

/**
 * offlineManager.js - Gestionnaire du mode hors ligne
 * 
 * Fonctionnalités:
 * - Détection automatique de l'état de connexion
 * - Indicateur visuel discret du mode offline
 * - Notification lors du retour en ligne
 * - Gestion des requêtes en attente
 */

const OFFLINE_BANNER_ID = 'offline-banner';
const OFFLINE_TOAST_ID = 'offline-toast';

class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.listeners = new Set();
        this._banner = null;
        this._initialized = false;
    }

    /**
     * Initialise la détection offline/online
     */
    init() {
        if (this._initialized) return;
        this._initialized = true;

        // État initial
        this.isOnline = navigator.onLine;
        this._updateUI();

        // Écoute les changements de connexion
        window.addEventListener('online', () => this._handleOnline());
        window.addEventListener('offline', () => this._handleOffline());

        // Vérifie périodiquement la vraie connectivité (pas juste navigator.onLine)
        this._startConnectivityCheck();

        console.log(`📶 OfflineManager initialisé - ${this.isOnline ? 'En ligne' : 'Hors ligne'}`);
    }

    /**
     * Ajoute un listener pour les changements d'état
     */
    onStatusChange(callback) {
        if (typeof callback === 'function') {
            this.listeners.add(callback);
        }
        return () => this.listeners.delete(callback);
    }

    /**
     * Vérifie si l'app est en ligne
     */
    checkOnline() {
        return this.isOnline;
    }

    /**
     * Démarre une vérification périodique de la connectivité réelle
     */
    _startConnectivityCheck() {
        // Vérifie toutes les 30 secondes si on est vraiment connecté
        setInterval(async () => {
            if (navigator.onLine) {
                try {
                    // Teste avec une petite requête vers notre propre serveur
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    
                    const response = await fetch('/manifest.json', {
                        method: 'HEAD',
                        cache: 'no-store',
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    
                    if (!this.isOnline && response.ok) {
                        this._handleOnline();
                    }
                } catch (e) {
                    // Pas de connexion réelle même si navigator.onLine = true
                    if (this.isOnline) {
                        this._handleOffline();
                    }
                }
            }
        }, 30000);
    }

    _handleOnline() {
        if (this.isOnline) return;
        
        this.isOnline = true;
        console.log('🌐 Connexion rétablie');
        this._updateUI();
        this._showToast('Connexion rétablie', 'success');
        this._notifyListeners();
    }

    _handleOffline() {
        if (!this.isOnline) return;
        
        this.isOnline = false;
        console.log('📴 Mode hors ligne');
        this._updateUI();
        this._notifyListeners();
    }

    _notifyListeners() {
        this.listeners.forEach(cb => {
            try {
                cb(this.isOnline);
            } catch (e) {
                console.warn('OfflineManager listener error:', e);
            }
        });
    }

    _updateUI() {
        if (this.isOnline) {
            this._hideBanner();
        } else {
            this._showBanner();
        }
    }

    _showBanner() {
        if (document.getElementById(OFFLINE_BANNER_ID)) return;

        const banner = document.createElement('div');
        banner.id = OFFLINE_BANNER_ID;
        banner.className = 'offline-banner';
        banner.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                <line x1="12" y1="20" x2="12.01" y2="20"></line>
            </svg>
            <span>Mode hors ligne - Les données GTFS restent disponibles</span>
        `;
        
        // Insertion après le header si présent, sinon au début du body
        const header = document.getElementById('main-header');
        if (header && header.parentNode) {
            header.parentNode.insertBefore(banner, header.nextSibling);
        } else {
            document.body.insertBefore(banner, document.body.firstChild);
        }

        this._banner = banner;
    }

    _hideBanner() {
        const banner = document.getElementById(OFFLINE_BANNER_ID);
        if (banner) {
            banner.classList.add('hiding');
            setTimeout(() => banner.remove(), 300);
        }
        this._banner = null;
    }

    _showToast(message, type = 'info') {
        // Évite les doublons
        const existingToast = document.getElementById(OFFLINE_TOAST_ID);
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = OFFLINE_TOAST_ID;
        toast.className = `offline-toast offline-toast-${type}`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✅' : 'ℹ️'}</span>
            <span>${message}</span>
        `;

        document.body.appendChild(toast);

        // Auto-dismiss après 3 secondes
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Instance singleton
export const offlineManager = new OfflineManager();

// Export de la classe pour les tests
export { OfflineManager };
