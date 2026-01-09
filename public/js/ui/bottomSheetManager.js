/*
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */

/**
 * bottomSheetManager.js - Gestionnaire du Bottom Sheet mobile
 * 
 * Gère le panneau coulissant sur mobile pour les détails d'itinéraire
 */

const BOTTOM_SHEET_LEVELS = [0.2, 0.5, 0.8]; // peek (20%), mid (50%), expanded (80%)
const BOTTOM_SHEET_DEFAULT_INDEX = 0;
const BOTTOM_SHEET_DRAG_ZONE_PX = 110;
const BOTTOM_SHEET_SCROLL_UNLOCK_THRESHOLD = 4;
const BOTTOM_SHEET_EXPANDED_LEVEL_INDEX = 2;
const BOTTOM_SHEET_VELOCITY_THRESHOLD = 0.35;
const BOTTOM_SHEET_MIN_DRAG_DISTANCE_PX = 45;
const BOTTOM_SHEET_DRAG_BUFFER_PX = 20;

class BottomSheetManager {
    constructor() {
        this.currentLevelIndex = BOTTOM_SHEET_DEFAULT_INDEX;
        this.dragState = null;
        this.controlsInitialized = false;
        this._detailPanel = null;
        this._scrollContent = null;
    }

    /**
     * Initialise les contrôles du bottom sheet
     */
    init() {
        if (this.controlsInitialized) return;
        
        this._detailPanel = document.getElementById('detail-panel');
        this._scrollContent = this._detailPanel?.querySelector('.detail-scroll-content');
        
        if (!this._detailPanel) return;
        
        // Événements tactiles et souris
        this._detailPanel.addEventListener('pointerdown', (e) => this._onPointerDown(e), { passive: false });
        document.addEventListener('pointermove', (e) => this._onPointerMove(e), { passive: false });
        document.addEventListener('pointerup', () => this._onPointerUp(), { passive: true });
        document.addEventListener('pointercancel', () => this._cancelDrag(), { passive: true });
        
        // Gestion du scroll wheel
        this._detailPanel.addEventListener('wheel', (e) => this._handleWheel(e), { passive: false });
        
        // Resize
        window.addEventListener('resize', () => this._handleResize());
        
        this.controlsInitialized = true;
    }

    /**
     * Vérifie si on est en mode mobile
     */
    isMobileViewport() {
        return window.innerWidth <= 768;
    }

    /**
     * Hauteur du viewport
     */
    getViewportHeight() {
        return window.visualViewport?.height ?? window.innerHeight;
    }

    /**
     * Position Y actuelle du sheet
     */
    getCurrentTranslateY() {
        if (!this._detailPanel) return 0;
        const transform = getComputedStyle(this._detailPanel).transform;
        if (!transform || transform === 'none') return 0;
        const matrix = new DOMMatrix(transform);
        return matrix.m42;
    }

    /**
     * Applique un niveau de snap au sheet
     */
    applyLevel(index, { immediate = false } = {}) {
        if (!this._detailPanel || !this.isMobileViewport()) return;
        
        this.currentLevelIndex = Math.max(0, Math.min(index, BOTTOM_SHEET_LEVELS.length - 1));
        const fraction = BOTTOM_SHEET_LEVELS[this.currentLevelIndex];
        const viewportHeight = this.getViewportHeight();
        const sheetHeight = fraction * viewportHeight;
        const translateY = viewportHeight - sheetHeight;
        
        if (immediate) {
            this._detailPanel.style.transition = 'none';
        } else {
            this._detailPanel.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        }
        
        this._detailPanel.style.transform = `translateY(${translateY}px)`;
        
        // Gestion du scroll
        if (this._scrollContent) {
            const canScroll = this.currentLevelIndex === BOTTOM_SHEET_EXPANDED_LEVEL_INDEX;
            this._scrollContent.style.overflowY = canScroll ? 'auto' : 'hidden';
        }
        
        if (immediate) {
            this._detailPanel.offsetHeight; // Force reflow
            this._detailPanel.style.transition = '';
        }
    }

    /**
     * Prépare le sheet pour le viewport actuel
     */
    prepareForViewport(immediate = false) {
        if (!this._detailPanel) return;
        
        if (this.isMobileViewport()) {
            this._detailPanel.classList.add('bottom-sheet-mode');
            this.applyLevel(this.currentLevelIndex, { immediate });
        } else {
            this._detailPanel.classList.remove('bottom-sheet-mode');
            this._detailPanel.style.transform = '';
            if (this._scrollContent) {
                this._scrollContent.style.overflowY = 'auto';
            }
        }
    }

    /**
     * Reset à l'état initial
     */
    reset() {
        this.currentLevelIndex = BOTTOM_SHEET_DEFAULT_INDEX;
        this.prepareForViewport(true);
    }

    /**
     * Développe le sheet au maximum
     */
    expand() {
        this.applyLevel(BOTTOM_SHEET_LEVELS.length - 1);
    }

    /**
     * Réduit le sheet au minimum
     */
    collapse() {
        this.applyLevel(0);
    }

    // === Méthodes privées pour le drag ===

    _handleResize() {
        if (this.dragState) this._cancelDrag();
        this.prepareForViewport(true);
    }

    _getClosestLevelIndex(fraction) {
        let closest = 0;
        let minDiff = Math.abs(BOTTOM_SHEET_LEVELS[0] - fraction);
        
        for (let i = 1; i < BOTTOM_SHEET_LEVELS.length; i++) {
            const diff = Math.abs(BOTTOM_SHEET_LEVELS[i] - fraction);
            if (diff < minDiff) {
                minDiff = diff;
                closest = i;
            }
        }
        return closest;
    }

    _isPointerInDragRegion(event) {
        if (!this._detailPanel) return false;
        const rect = this._detailPanel.getBoundingClientRect();
        const y = event.clientY;
        return y >= (rect.top - BOTTOM_SHEET_DRAG_BUFFER_PX) && y <= (rect.top + BOTTOM_SHEET_DRAG_ZONE_PX);
    }

    _cancelDrag() {
        if (!this.dragState) return;
        this.dragState = null;
        if (this._detailPanel) {
            this._detailPanel.style.transition = '';
        }
    }

    _onPointerDown(event) {
        if (!this.isMobileViewport() || !this._isPointerInDragRegion(event)) return;
        
        // Empêche le scroll si on est dans la zone de drag
        const scrollEl = this._scrollContent;
        const isScrolledToTop = !scrollEl || scrollEl.scrollTop <= BOTTOM_SHEET_SCROLL_UNLOCK_THRESHOLD;
        
        if (!isScrolledToTop && this.currentLevelIndex === BOTTOM_SHEET_EXPANDED_LEVEL_INDEX) {
            return; // Laisse le scroll naturel
        }
        
        event.preventDefault();
        
        this.dragState = {
            startY: event.clientY,
            startTime: performance.now(),
            startTranslateY: this.getCurrentTranslateY(),
            lastY: event.clientY,
            lastTime: performance.now()
        };
        
        if (this._detailPanel) {
            this._detailPanel.style.transition = 'none';
            this._detailPanel.setPointerCapture(event.pointerId);
        }
    }

    _onPointerMove(event) {
        if (!this.dragState || !this._detailPanel) return;
        
        event.preventDefault();
        
        const deltaY = event.clientY - this.dragState.startY;
        const viewportHeight = this.getViewportHeight();
        const maxTranslateY = viewportHeight * (1 - BOTTOM_SHEET_LEVELS[0]);
        const minTranslateY = viewportHeight * (1 - BOTTOM_SHEET_LEVELS[BOTTOM_SHEET_LEVELS.length - 1]);
        
        let newTranslateY = this.dragState.startTranslateY + deltaY;
        newTranslateY = Math.max(minTranslateY, Math.min(maxTranslateY, newTranslateY));
        
        this._detailPanel.style.transform = `translateY(${newTranslateY}px)`;
        
        this.dragState.lastY = event.clientY;
        this.dragState.lastTime = performance.now();
    }

    _onPointerUp() {
        if (!this.dragState || !this._detailPanel) return;
        
        const viewportHeight = this.getViewportHeight();
        const currentTranslateY = this.getCurrentTranslateY();
        const currentFraction = 1 - (currentTranslateY / viewportHeight);
        
        // Calcul de la vélocité
        const deltaTime = performance.now() - this.dragState.lastTime;
        const deltaY = this.dragState.lastY - this.dragState.startY;
        const velocity = deltaTime > 0 ? deltaY / deltaTime : 0;
        
        let targetIndex = this._getClosestLevelIndex(currentFraction);
        
        // Ajustement basé sur la vélocité
        if (Math.abs(velocity) > BOTTOM_SHEET_VELOCITY_THRESHOLD) {
            if (velocity > 0) {
                // Swipe vers le bas → niveau inférieur
                targetIndex = Math.max(0, this.currentLevelIndex - 1);
            } else {
                // Swipe vers le haut → niveau supérieur
                targetIndex = Math.min(BOTTOM_SHEET_LEVELS.length - 1, this.currentLevelIndex + 1);
            }
        } else if (Math.abs(deltaY) > BOTTOM_SHEET_MIN_DRAG_DISTANCE_PX) {
            // Déplacement significatif → prochain niveau dans la direction
            if (deltaY > 0) {
                targetIndex = Math.max(0, this.currentLevelIndex - 1);
            } else {
                targetIndex = Math.min(BOTTOM_SHEET_LEVELS.length - 1, this.currentLevelIndex + 1);
            }
        }
        
        this.dragState = null;
        this._detailPanel.style.transition = '';
        this.applyLevel(targetIndex);
    }

    _handleWheel(event) {
        if (!this.isMobileViewport()) return;
        
        const scrollEl = this._scrollContent;
        const isExpanded = this.currentLevelIndex === BOTTOM_SHEET_EXPANDED_LEVEL_INDEX;
        
        if (!isExpanded) {
            event.preventDefault();
            if (event.deltaY < 0) {
                this.applyLevel(this.currentLevelIndex + 1);
            } else {
                this.applyLevel(this.currentLevelIndex - 1);
            }
            return;
        }
        
        // En mode expanded, permettre le scroll si pas au top
        if (scrollEl && scrollEl.scrollTop <= 0 && event.deltaY < 0) {
            // Au top et scroll vers le haut → ne rien faire
            event.preventDefault();
        }
    }

    // Getters pour la compatibilité
    get isAtMinLevel() {
        return this.currentLevelIndex === 0;
    }

    get isAtMaxLevel() {
        return this.currentLevelIndex === BOTTOM_SHEET_LEVELS.length - 1;
    }
}

// Export singleton
export const bottomSheetManager = new BottomSheetManager();

// Export classe pour tests
export { BottomSheetManager, BOTTOM_SHEET_LEVELS };
