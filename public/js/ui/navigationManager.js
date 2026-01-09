/*
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */

/**
 * navigationManager.js - Gestionnaire de navigation entre vues
 * 
 * Gère les transitions entre les différentes vues de l'application
 */

class NavigationManager {
    constructor() {
        this.currentView = 'hall';
        this.previousView = null;
        this._listeners = new Set();
    }

    /**
     * Ajoute un listener de changement de vue
     */
    onViewChange(callback) {
        if (typeof callback === 'function') {
            this._listeners.add(callback);
        }
        return () => this._listeners.delete(callback);
    }

    /**
     * Notifie les listeners du changement de vue
     */
    _notifyViewChange(view, previousView) {
        this._listeners.forEach(cb => {
            try {
                cb(view, previousView);
            } catch (e) {
                console.warn('NavigationManager listener error:', e);
            }
        });
    }

    /**
     * Affiche la vue hall (accueil)
     */
    showHall(elements) {
        const { 
            dashboardContainer, 
            dashboardHall, 
            dashboardContentView,
            infoTraficList,
            alertBanner
        } = elements;

        this.previousView = this.currentView;
        this.currentView = 'hall';

        if (dashboardContainer) dashboardContainer.style.display = 'flex';
        if (dashboardHall) {
            dashboardHall.style.display = 'flex';
            dashboardHall.classList.remove('hidden');
        }
        if (dashboardContentView) {
            dashboardContentView.style.display = 'none';
            dashboardContentView.innerHTML = '';
        }
        if (infoTraficList) infoTraficList.style.display = '';
        if (alertBanner) alertBanner.classList.remove('hidden');

        // Nettoie le hash
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }

        this._notifyViewChange('hall', this.previousView);
    }

    /**
     * Affiche une vue de contenu (horaires, itinéraire, etc.)
     */
    showContentView(viewName, elements) {
        const { 
            dashboardContainer, 
            dashboardHall, 
            dashboardContentView,
            infoTraficList,
            alertBanner
        } = elements;

        this.previousView = this.currentView;
        this.currentView = viewName;

        if (dashboardContainer) dashboardContainer.style.display = 'flex';
        if (dashboardHall) {
            dashboardHall.style.display = 'none';
            dashboardHall.classList.add('hidden');
        }
        if (dashboardContentView) {
            dashboardContentView.style.display = 'block';
        }
        if (infoTraficList) infoTraficList.style.display = 'none';
        if (alertBanner) alertBanner.classList.add('hidden');

        this._notifyViewChange(viewName, this.previousView);
    }

    /**
     * Affiche la vue carte
     */
    showMap(elements) {
        const { dashboardContainer, mapSection } = elements;

        this.previousView = this.currentView;
        this.currentView = 'carte';

        if (dashboardContainer) dashboardContainer.style.display = 'none';
        if (mapSection) {
            mapSection.style.display = 'block';
            mapSection.classList.remove('hidden');
        }

        this._notifyViewChange('carte', this.previousView);
    }

    /**
     * Affiche la vue résultats (itinéraires)
     */
    showResults(elements) {
        const { 
            dashboardContainer, 
            dashboardHall, 
            dashboardContentView,
            resultsPanel 
        } = elements;

        this.previousView = this.currentView;
        this.currentView = 'results';

        if (dashboardContainer) dashboardContainer.style.display = 'none';
        if (dashboardHall) dashboardHall.style.display = 'none';
        if (dashboardContentView) dashboardContentView.style.display = 'none';
        if (resultsPanel) {
            resultsPanel.style.display = 'block';
            resultsPanel.classList.remove('hidden');
        }

        this._notifyViewChange('results', this.previousView);
    }

    /**
     * Affiche la vue détail (itinéraire sélectionné)
     */
    showDetail(elements) {
        const { 
            dashboardContainer, 
            detailPanel, 
            detailMapEl,
            resultsPanel 
        } = elements;

        this.previousView = this.currentView;
        this.currentView = 'detail';

        if (dashboardContainer) dashboardContainer.style.display = 'none';
        if (resultsPanel) resultsPanel.classList.add('hidden');
        if (detailPanel) {
            detailPanel.classList.remove('hidden');
            detailPanel.style.display = 'flex';
        }
        if (detailMapEl) {
            detailMapEl.classList.remove('hidden');
        }

        this._notifyViewChange('detail', this.previousView);
    }

    /**
     * Masque la vue détail
     */
    hideDetail(elements) {
        const { detailPanel, detailMapEl, resultsPanel } = elements;

        this.previousView = this.currentView;
        this.currentView = this.previousView === 'detail' ? 'results' : this.previousView;

        if (detailPanel) {
            detailPanel.classList.add('hidden');
            detailPanel.style.display = 'none';
        }
        if (detailMapEl) {
            detailMapEl.classList.add('hidden');
        }
        if (resultsPanel) {
            resultsPanel.classList.remove('hidden');
        }

        this._notifyViewChange(this.currentView, 'detail');
    }

    /**
     * Retourne à la vue précédente
     */
    goBack(elements) {
        switch (this.currentView) {
            case 'detail':
                this.hideDetail(elements);
                break;
            case 'results':
                this.showHall(elements);
                break;
            case 'carte':
            case 'horaires':
            case 'itineraire':
            case 'trafic':
            case 'tarifs':
                this.showHall(elements);
                break;
            default:
                this.showHall(elements);
        }
    }

    /**
     * Vérifie si on peut revenir en arrière
     */
    canGoBack() {
        return this.currentView !== 'hall';
    }

    /**
     * Retourne la vue courante
     */
    getCurrentView() {
        return this.currentView;
    }
}

// Export singleton
export const navigationManager = new NavigationManager();

// Export classe pour tests
export { NavigationManager };
