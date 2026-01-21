/**
 * SearchBoxComponent.js - Departure/arrival input with autocomplete
 * Phase 4: UI Components Modularization
 */

import { eventBus, EVENTS } from '../EventBus.js';
import { logger } from '../Logger.js';
import { getAPIServiceFactory } from '../services/index.js';

export class SearchBoxComponent {
    constructor(containerId, config = {}) {
        this.containerId = containerId;
        this.config = config;
        this.container = null;
        this.fromInput = null;
        this.toInput = null;
        this.searchButton = null;
        
        logger.info('SearchBoxComponent initialized', { containerId });
    }

    /**
     * Render search box
     */
    render() {
        logger.debug('SearchBoxComponent.render');
        
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            logger.error('Container not found', { id: this.containerId });
            return;
        }
        
        this.container.innerHTML = `
            <div class="search-box">
                <div class="search-input-group">
                    <label for="from-input">Départ</label>
                    <input 
                        type="text" 
                        id="from-input" 
                        placeholder="Entrez une adresse..."
                        autocomplete="off"
                    />
                    <div id="from-autocomplete" class="autocomplete-results"></div>
                </div>
                
                <div class="search-input-group">
                    <label for="to-input">Arrivée</label>
                    <input 
                        type="text" 
                        id="to-input" 
                        placeholder="Entrez une adresse..."
                        autocomplete="off"
                    />
                    <div id="to-autocomplete" class="autocomplete-results"></div>
                </div>
                
                <button id="search-btn" class="btn btn-primary">
                    Rechercher
                </button>
            </div>
        `;
        
        this.fromInput = document.getElementById('from-input');
        this.toInput = document.getElementById('to-input');
        this.searchButton = document.getElementById('search-btn');
        
        this.attachEventListeners();
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        logger.debug('SearchBoxComponent.attachEventListeners');
        
        // Autocomplete on input
        this.fromInput.addEventListener('input', (e) => {
            this.handleAutocomplete(e.target.value, 'from-autocomplete');
        });
        
        this.toInput.addEventListener('input', (e) => {
            this.handleAutocomplete(e.target.value, 'to-autocomplete');
        });
        
        // Search button
        this.searchButton.addEventListener('click', () => {
            this.handleSearch();
        });
        
        // Enter key
        [this.fromInput, this.toInput].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch();
                }
            });
        });
    }

    /**
     * Handle autocomplete
     */
    async handleAutocomplete(query, resultsId) {
        logger.debug('SearchBoxComponent.handleAutocomplete', { query });
        
        if (query.length < 2) {
            document.getElementById(resultsId).innerHTML = '';
            return;
        }
        
        try {
            const apiFactory = getAPIServiceFactory();
            const result = await apiFactory.getPlacePredictions(query);
            
            this.renderAutocompleteResults(result.predictions, resultsId);
        } catch (error) {
            logger.error('Autocomplete failed', { error: error.message });
        }
    }

    /**
     * Render autocomplete results
     */
    renderAutocompleteResults(predictions, resultsId) {
        const resultsContainer = document.getElementById(resultsId);
        
        if (!predictions || predictions.length === 0) {
            resultsContainer.innerHTML = '';
            return;
        }
        
        resultsContainer.innerHTML = predictions.map(pred => `
            <div class="autocomplete-item" data-place-id="${pred.placeId}">
                ${pred.description}
            </div>
        `).join('');
        
        // Click handlers
        resultsContainer.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                const placeId = item.dataset.placeId;
                const description = item.textContent.trim();
                
                if (resultsId === 'from-autocomplete') {
                    this.fromInput.value = description;
                } else {
                    this.toInput.value = description;
                }
                
                resultsContainer.innerHTML = '';
            });
        });
    }

    /**
     * Handle search
     */
    handleSearch() {
        const from = this.fromInput.value.trim();
        const to = this.toInput.value.trim();
        
        if (!from || !to) {
            logger.warn('SearchBoxComponent search incomplete', { from, to });
            return;
        }
        
        logger.info('SearchBoxComponent.handleSearch', { from, to });
        
        eventBus.emit(EVENTS.SEARCH_START, {
            from,
            to,
            timestamp: Date.now()
        });
    }

    /**
     * Set departure
     */
    setDeparture(label, coords = null) {
        logger.debug('SearchBoxComponent.setDeparture', { label });
        this.fromInput.value = label;
    }

    /**
     * Set arrival
     */
    setArrival(label, coords = null) {
        logger.debug('SearchBoxComponent.setArrival', { label });
        this.toInput.value = label;
    }

    /**
     * Clear form
     */
    clear() {
        logger.debug('SearchBoxComponent.clear');
        if (this.fromInput) this.fromInput.value = '';
        if (this.toInput) this.toInput.value = '';
    }
}
