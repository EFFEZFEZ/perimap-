/**
 * Gestion des trajets récents en localStorage
 * V504: Cache persistant avec TTL de 1 semaine
 * Les trajets sont stockés après une recherche réussie avec visuels des lignes
 */

import { ICONS } from './config/icons.js';

const RECENT_JOURNEYS_STORAGE_KEY = 'perimap_journeys_v2';
const MAX_RECENT_JOURNEYS = 10;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

class RecentJourneysManager {
    constructor() {
        this.journeys = this.loadJourneys();
        this.init();
    }

    init() {
        this.renderRecentJourneys();
    }

    loadJourneys() {
        try {
            const stored = localStorage.getItem(RECENT_JOURNEYS_STORAGE_KEY);
            if (!stored) return [];
            
            const data = JSON.parse(stored);
            const now = Date.now();
            
            // Filtrer les trajets expirés
            const validJourneys = data.filter(j => (j.expiresAt || 0) > now);
            
            // Sauvegarder si on a nettoyé des trajets
            if (validJourneys.length !== data.length) {
                localStorage.setItem(RECENT_JOURNEYS_STORAGE_KEY, JSON.stringify(validJourneys));
            }
            
            return validJourneys;
        } catch (e) {
            console.error('[RecentJourneys] Erreur chargement:', e);
            return [];
        }
    }

    saveJourneys() {
        try {
            localStorage.setItem(RECENT_JOURNEYS_STORAGE_KEY, JSON.stringify(this.journeys));
        } catch (e) {
            console.error('[RecentJourneys] Erreur sauvegarde:', e);
        }
    }

    /**
     * V504: Créer un résumé visuel de l'itinéraire
     */
    createItinerarySummary(itinerary) {
        if (!itinerary) return null;
        
        return {
            type: itinerary.type || 'BUS',
            duration: itinerary.duration || '',
            segments: (itinerary.summarySegments || []).map(seg => ({
                name: seg.name || '',
                color: seg.color || '#0066CC',
                textColor: seg.textColor || '#FFFFFF'
            })),
            hasWalk: this.hasSignificantWalk(itinerary)
        };
    }
    
    hasSignificantWalk(itinerary) {
        if (!itinerary?.steps) return false;
        for (const step of itinerary.steps) {
            if (step.type === 'WALK' || step._isWalk) {
                const durationMatch = (step.duration || '').match(/(\d+)/);
                const durationMin = durationMatch ? parseInt(durationMatch[1], 10) : 0;
                if (durationMin > 2) return true;
            }
        }
        return false;
    }

    /**
     * V504: Ajouter un trajet avec cache TTL 1 semaine
     */
    addJourney(fromName, toName, departureTime = 'Maintenant', itinerary = null) {
        const now = Date.now();
        const key = `${fromName.trim().toLowerCase()}|${toName.trim().toLowerCase()}`;
        
        // Chercher si le trajet existe déjà
        const existingIndex = this.journeys.findIndex(j => j.key === key);

        const journeyData = {
            key,
            fromName: fromName.trim(),
            toName: toName.trim(),
            departureTime,
            summary: itinerary ? this.createItinerarySummary(itinerary) : null,
            savedAt: now,
            expiresAt: now + TTL_MS, // 1 semaine
            accessCount: 1
        };

        if (existingIndex >= 0) {
            // Mettre à jour avec nouveau TTL
            journeyData.accessCount = (this.journeys[existingIndex].accessCount || 0) + 1;
            this.journeys.splice(existingIndex, 1);
        }

        // Ajouter au début
        this.journeys.unshift(journeyData);
        this.journeys = this.journeys.slice(0, MAX_RECENT_JOURNEYS);

        this.saveJourneys();
        this.renderRecentJourneys();
        
        console.log('[RecentJourneys] Trajet sauvegardé (TTL 7j):', fromName, '->', toName);
    }

    /**
     * V504: Rafraîchir TTL quand l'utilisateur reclique
     */
    refreshTTL(fromName, toName) {
        const key = `${fromName.trim().toLowerCase()}|${toName.trim().toLowerCase()}`;
        const index = this.journeys.findIndex(j => j.key === key);
        
        if (index >= 0) {
            const now = Date.now();
            this.journeys[index].expiresAt = now + TTL_MS;
            this.journeys[index].accessCount = (this.journeys[index].accessCount || 0) + 1;
            this.journeys[index].lastAccessAt = now;
            
            // Déplacer en tête
            const [journey] = this.journeys.splice(index, 1);
            this.journeys.unshift(journey);
            
            this.saveJourneys();
            console.log('[RecentJourneys] TTL rafraîchi:', fromName, '->', toName);
            return journey;
        }
        return null;
    }

    renderRecentJourneys() {
        const section = document.getElementById('recent-journeys-section');
        const container = document.getElementById('recent-journeys-container');
        const emptyState = document.getElementById('recent-journeys-empty');
        const list = document.getElementById('recent-journeys-list');

        if (!section || !container || !list || !emptyState) return;

        if (this.journeys.length === 0) {
            section.classList.remove('hidden');
            container.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        section.classList.remove('hidden');
        container.classList.remove('hidden');
        emptyState.classList.add('hidden');
        list.innerHTML = '';

        this.journeys.forEach(journey => {
            const card = document.createElement('div');
            card.className = 'recent-journey-card';
            
            // Badges des lignes
            let linesHtml = '';
            if (journey.summary && journey.summary.segments && journey.summary.segments.length > 0) {
                linesHtml = '<div class="recent-journey-lines">';
                journey.summary.segments.forEach((seg, i) => {
                    linesHtml += `<div class='route-line-badge' style='background-color:${seg.color};color:${seg.textColor};'>${this.escapeHtml(seg.name)}</div>`;
                    if (i < journey.summary.segments.length - 1) {
                        linesHtml += `<span class='route-summary-dot'>•</span>`;
                    }
                });
                if (journey.summary.hasWalk) {
                    linesHtml += `<span class='route-summary-dot'>•</span>`;
                    linesHtml += `<div class='route-summary-walk-icon'>${ICONS.WALK}</div>`;
                }
                linesHtml += '</div>';
            } else {
                // Fallback: icône bus générique
                linesHtml = `<div class="recent-journey-lines"><div class='route-line-badge' style='background-color:#0066CC;color:#FFF;'>Bus</div></div>`;
            }
            
            // Durée
            const durationText = journey.summary?.duration || '';
            
            card.innerHTML = `
                ${linesHtml}
                <div class="recent-journey-info">
                    <div class="recent-journey-route">${this.escapeHtml(journey.fromName)} → ${this.escapeHtml(journey.toName)}</div>
                    <div class="recent-journey-meta">
                        ${durationText ? `<span class="recent-journey-duration">${durationText}</span>` : ''}
                    </div>
                </div>
                <button class="recent-journey-delete" aria-label="Supprimer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            `;
            
            // Click sur la carte = charger le trajet
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.recent-journey-delete')) {
                    this.loadJourney(journey);
                }
            });
            
            // Click sur supprimer
            const deleteBtn = card.querySelector('.recent-journey-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeJourney(journey.key);
                });
            }
            
            list.appendChild(card);
        });
    }

    loadJourney(journey) {
        // Rafraîchir le TTL
        this.refreshTTL(journey.fromName, journey.toName);
        
        const resultsFromInput = document.getElementById('results-planner-from');
        const resultsToInput = document.getElementById('results-planner-to');

        if (resultsFromInput && resultsToInput) {
            resultsFromInput.value = journey.fromName;
            resultsToInput.value = journey.toName;
            
            // Trigger search
            resultsFromInput.dispatchEvent(new Event('input', { bubbles: true }));
            resultsToInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Déclencher la recherche automatiquement
            setTimeout(() => {
                const searchBtn = document.getElementById('results-planner-submit-btn');
                if (searchBtn) searchBtn.click();
            }, 100);
        }
    }

    removeJourney(key) {
        this.journeys = this.journeys.filter(j => j.key !== key);
        this.saveJourneys();
        this.renderRecentJourneys();
    }

    clearAll() {
        this.journeys = [];
        this.saveJourneys();
        this.renderRecentJourneys();
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text || '').replace(/[&<>"']/g, m => map[m]);
    }
}

// Instance globale
let recentJourneysManager = null;

function initRecentJourneys() {
    if (!recentJourneysManager) {
        recentJourneysManager = new RecentJourneysManager();
    }
}

/**
 * V504: Ajouter un trajet avec l'itinéraire complet pour les visuels
 */
function addRecentJourney(fromName, toName, departureTime = 'Maintenant', itinerary = null) {
    if (!recentJourneysManager) {
        initRecentJourneys();
    }
    recentJourneysManager.addJourney(fromName, toName, departureTime, itinerary);
}

export { initRecentJourneys, addRecentJourney };
