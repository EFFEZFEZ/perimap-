/*
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */

/**
 * installManager.js - Gestionnaire PWA d'installation
 * 
 * Gère l'affichage du bandeau d'installation PWA
 */

const INSTALL_TIP_ID = 'install-tip';
const INSTALL_DISMISSED_KEY = 'pwa-install-dismissed';

class InstallManager {
    constructor() {
        this.deferredPrompt = null;
        this._tipElement = null;
    }

    /**
     * Initialise le gestionnaire d'installation
     */
    init() {
        // Capture l'événement beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Affiche le tip si pas déjà dismissé
            if (!this._isDismissed()) {
                this.showTip();
            }
        });

        // Masque le tip si l'app est installée
        window.addEventListener('appinstalled', () => {
            this.hideTip();
            this.deferredPrompt = null;
        });

        // Vérifie si on est en mode standalone (déjà installé)
        if (window.matchMedia('(display-mode: standalone)').matches) {
            return; // Pas de tip nécessaire
        }

        // Affiche le tip au démarrage si prompt disponible et pas dismissé
        if (this.deferredPrompt && !this._isDismissed()) {
            setTimeout(() => this.showTip(), 3000);
        }
    }

    /**
     * Affiche le tip d'installation
     */
    showTip() {
        if (this._tipElement || this._isDismissed()) return;

        const tip = document.createElement('div');
        tip.id = INSTALL_TIP_ID;
        tip.className = 'install-tip';
        tip.setAttribute('role', 'dialog');
        tip.setAttribute('aria-label', 'Installer l\'application');
        
        tip.innerHTML = `
            <div class="install-tip-content">
                <div class="install-tip-icon">📲</div>
                <div class="install-tip-text">
                    <strong>Installer PériMap</strong>
                    <span>Accédez rapidement à vos horaires</span>
                </div>
                <div class="install-tip-actions">
                    <button id="install-btn" class="btn btn-primary btn-sm">Installer</button>
                    <button id="install-dismiss" class="btn-icon-round" aria-label="Fermer">×</button>
                </div>
            </div>
        `;

        document.body.appendChild(tip);
        this._tipElement = tip;

        // Bouton installer
        document.getElementById('install-btn')?.addEventListener('click', () => {
            this.promptInstall();
        });

        // Bouton fermer
        document.getElementById('install-dismiss')?.addEventListener('click', () => {
            this.dismissTip();
        });

        // Ferme avec Escape
        document.addEventListener('keydown', this._handleKeydown.bind(this));

        // Animation d'entrée
        requestAnimationFrame(() => {
            tip.classList.add('visible');
        });
    }

    /**
     * Masque le tip d'installation
     */
    hideTip() {
        if (!this._tipElement) return;

        this._tipElement.classList.remove('visible');
        this._tipElement.classList.add('hiding');

        setTimeout(() => {
            this._tipElement?.remove();
            this._tipElement = null;
        }, 300);

        document.removeEventListener('keydown', this._handleKeydown.bind(this));
    }

    /**
     * Masque et marque comme dismissé
     */
    dismissTip() {
        this.hideTip();
        this._setDismissed();
    }

    /**
     * Déclenche le prompt d'installation natif
     */
    async promptInstall() {
        if (!this.deferredPrompt) {
            console.warn('Prompt d\'installation non disponible');
            return;
        }

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        console.log(`Installation: ${outcome}`);
        
        if (outcome === 'accepted') {
            this.hideTip();
        }
        
        this.deferredPrompt = null;
    }

    /**
     * Vérifie si le tip a été dismissé
     */
    _isDismissed() {
        try {
            return localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true';
        } catch {
            return false;
        }
    }

    /**
     * Marque le tip comme dismissé
     */
    _setDismissed() {
        try {
            localStorage.setItem(INSTALL_DISMISSED_KEY, 'true');
        } catch {
            // Ignore
        }
    }

    /**
     * Gère les événements clavier
     */
    _handleKeydown(event) {
        if (event.key === 'Escape' && this._tipElement) {
            this.dismissTip();
        }
    }
}

// Export singleton
export const installManager = new InstallManager();

// Export classe pour tests
export { InstallManager };
