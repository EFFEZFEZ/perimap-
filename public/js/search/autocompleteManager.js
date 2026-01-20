/**
 * autocompleteManager.js - Gestion de l'autocomplétion des recherches
 * 
 * Extrait de main.js pour améliorer la maintenabilité
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 */

/**
 * Configuration de l'autocomplétion
 */
const CONFIG = {
    minQueryLength: 2,
    debounceMs: 150,
    maxResults: 10,
    apiEndpoint: '/api/places'
};

// État interne
let debounceTimer = null;
let lastQuery = '';
let activeContainer = null;

/**
 * Normalise une chaîne pour la comparaison
 * @param {string} str
 * @returns {string}
 */
function normalize(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

/**
 * Met en surbrillance les termes de recherche dans un texte
 * @param {string} text
 * @param {string} query
 * @returns {string}
 */
function highlightMatch(text, query) {
    if (!text || !query) return text || '';
    
    const normalizedQuery = normalize(query);
    const normalizedText = normalize(text);
    const index = normalizedText.indexOf(normalizedQuery);
    
    if (index === -1) return text;
    
    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);
    
    return `${before}<strong>${match}</strong>${after}`;
}

/**
 * Génère le HTML pour un item de suggestion
 * @param {Object} suggestion
 * @param {string} query
 * @returns {string}
 */
function renderSuggestionItem(suggestion, query) {
    const icon = getSuggestionIcon(suggestion.type);
    const name = highlightMatch(suggestion.name || suggestion.label, query);
    const subtitle = suggestion.subtitle || suggestion.locality || '';
    
    return `
        <div class="suggestion-item" data-place-id="${suggestion.placeId || ''}" data-type="${suggestion.type || 'address'}">
            <div class="suggestion-icon">${icon}</div>
            <div class="suggestion-content">
                <div class="suggestion-name">${name}</div>
                ${subtitle ? `<div class="suggestion-subtitle">${subtitle}</div>` : ''}
            </div>
        </div>
    `;
}

/**
 * Retourne l'icône appropriée pour un type de suggestion
 * @param {string} type
 * @returns {string}
 */
function getSuggestionIcon(type) {
    const icons = {
        stop: '🚏',
        station: '🚉',
        city: '🏙️',
        poi: '📍',
        address: '🏠',
        street: '🛣️',
        default: '📍'
    };
    return icons[type] || icons.default;
}

/**
 * Gère l'autocomplétion pour un champ de saisie
 * @param {string} query - Texte de recherche
 * @param {HTMLElement} container - Conteneur pour les suggestions
 * @param {Function} onSelect - Callback lors de la sélection
 * @param {Object} options - Options supplémentaires
 */
export async function handleAutocomplete(query, container, onSelect, options = {}) {
    const { 
        apiManager = null,
        minLength = CONFIG.minQueryLength,
        maxResults = CONFIG.maxResults
    } = options;
    
    // Nettoyer le timer précédent
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    
    // Validation de la query
    const trimmedQuery = (query || '').trim();
    
    if (trimmedQuery.length < minLength) {
        hideContainer(container);
        return;
    }
    
    // Éviter les requêtes dupliquées
    if (trimmedQuery === lastQuery && activeContainer === container) {
        return;
    }
    
    lastQuery = trimmedQuery;
    activeContainer = container;
    
    // Debounce
    debounceTimer = setTimeout(async () => {
        try {
            let suggestions = [];
            
            if (apiManager && typeof apiManager.fetchPlaces === 'function') {
                suggestions = await apiManager.fetchPlaces(trimmedQuery, maxResults);
            } else {
                // Fallback: appel API direct
                const response = await fetch(`${CONFIG.apiEndpoint}?q=${encodeURIComponent(trimmedQuery)}&limit=${maxResults}`);
                if (response.ok) {
                    const data = await response.json();
                    suggestions = data.suggestions || data.results || [];
                }
            }
            
            renderSuggestions(suggestions, container, onSelect, trimmedQuery);
            
        } catch (error) {
            console.warn('[Autocomplete] Erreur:', error);
            hideContainer(container);
        }
    }, CONFIG.debounceMs);
}

/**
 * Affiche les suggestions dans le conteneur
 * @param {Array} suggestions
 * @param {HTMLElement} container
 * @param {Function} onSelect
 * @param {string} query
 */
export function renderSuggestions(suggestions, container, onSelect, query = '') {
    if (!container) return;
    
    if (!suggestions || suggestions.length === 0) {
        hideContainer(container);
        return;
    }
    
    const html = suggestions.map(s => renderSuggestionItem(s, query)).join('');
    container.innerHTML = html;
    container.classList.remove('hidden');
    container.setAttribute('aria-expanded', 'true');
    
    // Ajouter les event listeners
    container.querySelectorAll('.suggestion-item').forEach((item, index) => {
        item.addEventListener('click', () => {
            const suggestion = suggestions[index];
            if (typeof onSelect === 'function') {
                onSelect(suggestion);
            }
            hideContainer(container);
        });
        
        // Support clavier
        item.setAttribute('tabindex', '0');
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const suggestion = suggestions[index];
                if (typeof onSelect === 'function') {
                    onSelect(suggestion);
                }
                hideContainer(container);
            }
        });
    });
}

/**
 * Cache le conteneur de suggestions
 * @param {HTMLElement} container
 */
export function hideContainer(container) {
    if (!container) return;
    container.innerHTML = '';
    container.classList.add('hidden');
    container.setAttribute('aria-expanded', 'false');
}

/**
 * Configure l'autocomplétion pour un champ input
 * @param {HTMLInputElement} input
 * @param {HTMLElement} suggestionsContainer
 * @param {Function} onSelect
 * @param {Object} options
 */
export function setupAutocomplete(input, suggestionsContainer, onSelect, options = {}) {
    if (!input || !suggestionsContainer) return;
    
    // Input handler
    input.addEventListener('input', (e) => {
        handleAutocomplete(e.target.value, suggestionsContainer, onSelect, options);
    });
    
    // Focus handler
    input.addEventListener('focus', () => {
        if (input.value.trim().length >= CONFIG.minQueryLength) {
            handleAutocomplete(input.value, suggestionsContainer, onSelect, options);
        }
    });
    
    // Blur handler (avec délai pour permettre le clic)
    input.addEventListener('blur', () => {
        setTimeout(() => {
            hideContainer(suggestionsContainer);
        }, 200);
    });
    
    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideContainer(suggestionsContainer);
            return;
        }
        
        const items = suggestionsContainer.querySelectorAll('.suggestion-item');
        if (!items.length) return;
        
        const focused = suggestionsContainer.querySelector('.suggestion-item:focus');
        let currentIndex = focused ? Array.from(items).indexOf(focused) : -1;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = Math.min(currentIndex + 1, items.length - 1);
            items[nextIndex]?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentIndex > 0) {
                items[currentIndex - 1]?.focus();
            } else {
                input.focus();
            }
        }
    });
}

/**
 * Efface l'état de l'autocomplétion
 */
export function clearAutocompleteState() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    lastQuery = '';
    activeContainer = null;
}

export default {
    handleAutocomplete,
    renderSuggestions,
    hideContainer,
    setupAutocomplete,
    clearAutocompleteState,
    CONFIG
};
