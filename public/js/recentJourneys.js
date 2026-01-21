/**
 * Gestion des trajets récents en localStorage
 * Les trajets sont stockés après une recherche réussie
 */

const RECENT_JOURNEYS_STORAGE_KEY = 'perimap_recent_journeys';
const MAX_RECENT_JOURNEYS = 5;

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
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Erreur lors du chargement des trajets récents:', e);
            return [];
        }
    }

    saveJourneys() {
        try {
            localStorage.setItem(RECENT_JOURNEYS_STORAGE_KEY, JSON.stringify(this.journeys));
        } catch (e) {
            console.error('Erreur lors de la sauvegarde des trajets récents:', e);
        }
    }

    addJourney(fromName, toName, departureTime = 'Maintenant') {
        // Vérifier si le trajet existe déjà (éviter les doublons)
        const existing = this.journeys.find(j => 
            j.fromName === fromName && j.toName === toName && j.departureTime === departureTime
        );

        if (existing) {
            // Déplacer le trajet au début (le plus récent)
            this.journeys = this.journeys.filter(j => 
                !(j.fromName === fromName && j.toName === toName && j.departureTime === departureTime)
            );
            this.journeys.unshift(existing);
        } else {
            // Ajouter un nouveau trajet au début
            this.journeys.unshift({
                fromName,
                toName,
                departureTime,
                timestamp: Date.now()
            });

            // Limiter à MAX_RECENT_JOURNEYS
            this.journeys = this.journeys.slice(0, MAX_RECENT_JOURNEYS);
        }

        this.saveJourneys();
        this.renderRecentJourneys();
    }

    renderRecentJourneys() {
        const section = document.getElementById('recent-journeys-section');
        const heading = section ? section.querySelector('h3') : null;
        const container = document.getElementById('recent-journeys-container');
        const emptyState = document.getElementById('recent-journeys-empty');
        const list = document.getElementById('recent-journeys-list');

        if (!section || !container || !list || !emptyState) return;

        // Force correct labels even si cache HTML ancien
        if (heading) heading.textContent = 'Vos trajets :';
        emptyState.innerHTML = "<p>Aucun trajet répertorié pour l'instant.</p>";

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
            const item = document.createElement('div');
            item.className = 'recent-journey-item';
            item.innerHTML = `
                <div class="journey-route">${this.escapeHtml(journey.fromName)} → ${this.escapeHtml(journey.toName)}</div>
                <div class="journey-time">${journey.departureTime}</div>
            `;
            
            item.addEventListener('click', () => this.loadJourney(journey));
            list.appendChild(item);
        });
    }

    loadJourney(journey) {
        const resultsFromInput = document.getElementById('results-planner-from');
        const resultsToInput = document.getElementById('results-planner-to');

        if (resultsFromInput && resultsToInput) {
            resultsFromInput.value = journey.fromName;
            resultsToInput.value = journey.toName;
            
            // Trigger input events pour les autocomplete
            resultsFromInput.dispatchEvent(new Event('input', { bubbles: true }));
            resultsToInput.dispatchEvent(new Event('input', { bubbles: true }));

            // Si ce n'est pas "Maintenant", il faudrait aussi mettre à jour l'heure
            // Pour l'instant, on laisse "Maintenant" sélectionné
        }
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
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// Instance globale
let recentJourneysManager = null;

function initRecentJourneys() {
    if (!recentJourneysManager) {
        recentJourneysManager = new RecentJourneysManager();
    }
}

function addRecentJourney(fromName, toName, departureTime = 'Maintenant') {
    if (!recentJourneysManager) {
        initRecentJourneys();
    }
    recentJourneysManager.addJourney(fromName, toName, departureTime);
}
