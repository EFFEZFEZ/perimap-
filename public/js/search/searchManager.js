/*
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */

/**
 * searchManager.js - Gestionnaire de recherche d'itinéraires
 * 
 * Gère la logique de recherche, pagination et tri des résultats
 */

import { deduplicateItineraries, rankArrivalItineraries, rankDepartureItineraries, filterExpiredDepartures, filterLateArrivals, limitBikeWalkItineraries, countBusItineraries, getMinBusItineraries } from '../itinerary/ranking.js';

const DEFAULT_ARRIVAL_PAGE_SIZE = 6;

class SearchManager {
    constructor() {
        this.lastSearchMode = null; // 'partir' | 'arriver'
        this.lastSearchTime = null;
        this.loadMoreOffset = 0;
        
        // Pagination mode "arriver"
        this.arrivalRankedAll = [];
        this.arrivalRenderedCount = 0;
        this.arrivalPageSize = DEFAULT_ARRIVAL_PAGE_SIZE;
        
        // Tous les itinéraires fetchés
        this.allFetchedItineraries = [];
        
        // Place IDs pour le formulaire
        this.hallFromPlaceId = null;
        this.hallToPlaceId = null;
        this.resultsFromPlaceId = null;
        this.resultsToPlaceId = null;
    }

    /**
     * Configure la taille de page pour le mode arriver
     */
    setArrivalPageSize(size) {
        this.arrivalPageSize = size || DEFAULT_ARRIVAL_PAGE_SIZE;
    }

    /**
     * Réinitialise l'état de recherche
     */
    reset() {
        this.lastSearchMode = null;
        this.lastSearchTime = null;
        this.loadMoreOffset = 0;
        this.arrivalRankedAll = [];
        this.arrivalRenderedCount = 0;
        this.allFetchedItineraries = [];
    }

    /**
     * Enregistre une nouvelle recherche
     */
    recordSearch(mode, searchTime) {
        this.lastSearchMode = mode;
        this.lastSearchTime = searchTime;
        this.loadMoreOffset = 0;
        this.arrivalRankedAll = [];
        this.arrivalRenderedCount = 0;
    }

    /**
     * Stocke les itinéraires fetchés
     */
    setFetchedItineraries(itineraries) {
        this.allFetchedItineraries = itineraries || [];
    }

    /**
     * Ajoute des itinéraires aux existants (pour "charger plus")
     */
    addFetchedItineraries(itineraries) {
        this.allFetchedItineraries = [
            ...this.allFetchedItineraries,
            ...(itineraries || [])
        ];
    }

    /**
     * Récupère tous les itinéraires fetchés
     */
    getFetchedItineraries() {
        return this.allFetchedItineraries;
    }

    /**
     * Crée une signature unique pour un itinéraire (déduplication)
     */
    createItinerarySignature(itinerary) {
        if (!itinerary || !Array.isArray(itinerary.steps)) {
            return JSON.stringify(itinerary);
        }

        const parts = [];
        
        // Heures de départ et arrivée
        parts.push(itinerary.departureTime || '');
        parts.push(itinerary.arrivalTime || '');
        
        // Étapes
        for (const step of itinerary.steps) {
            if (!step) continue;
            
            parts.push(step.type || '');
            
            if (step.type === 'BUS') {
                parts.push(step.routeShortName || '');
                parts.push(step.departureStop || '');
                parts.push(step.arrivalStop || '');
            } else if (step.type === 'WALK') {
                parts.push(Math.round((step.durationMinutes || 0) / 5) * 5); // Arrondi à 5 min
            }
        }

        return parts.join('|');
    }

    /**
     * Déduplique les itinéraires
     */
    deduplicate(itineraries) {
        if (!Array.isArray(itineraries)) return [];
        
        const seen = new Set();
        return itineraries.filter(it => {
            const sig = this.createItinerarySignature(it);
            if (seen.has(sig)) return false;
            seen.add(sig);
            return true;
        });
    }

    /**
     * Trie et filtre les itinéraires selon le mode
     */
    processResults(itineraries, mode, searchTime) {
        let processed = this.deduplicate(itineraries);

        if (mode === 'partir') {
            // Filtre les départs expirés et trie par heure de départ
            processed = filterExpiredDepartures(processed, searchTime);
            processed = rankDepartureItineraries(processed);
        } else if (mode === 'arriver') {
            // Filtre les arrivées tardives et trie par heure d'arrivée (plus proche en premier)
            processed = filterLateArrivals(processed, searchTime);
            processed = rankArrivalItineraries(processed);
        }

        // Limite vélo/marche si assez de bus
        const busCount = countBusItineraries(processed);
        if (busCount >= getMinBusItineraries()) {
            processed = limitBikeWalkItineraries(processed);
        }

        return processed;
    }

    /**
     * Prépare la pagination pour le mode arriver
     */
    prepareArrivalPagination(itineraries) {
        this.arrivalRankedAll = itineraries;
        this.arrivalRenderedCount = 0;
    }

    /**
     * Retourne le prochain lot d'itinéraires pour le mode arriver
     */
    getNextArrivalPage() {
        const start = this.arrivalRenderedCount;
        const end = start + this.arrivalPageSize;
        const page = this.arrivalRankedAll.slice(start, end);
        this.arrivalRenderedCount = end;
        return page;
    }

    /**
     * Vérifie s'il reste des itinéraires à charger
     */
    hasMoreArrivals() {
        return this.arrivalRenderedCount < this.arrivalRankedAll.length;
    }

    /**
     * Incrémente l'offset pour charger plus de départs
     */
    incrementLoadMoreOffset(minutes = 60) {
        this.loadMoreOffset += minutes;
    }

    /**
     * Récupère l'offset actuel
     */
    getLoadMoreOffset() {
        return this.loadMoreOffset;
    }

    // === Gestion des Place IDs ===

    setHallFromPlaceId(id) {
        this.hallFromPlaceId = id;
    }

    setHallToPlaceId(id) {
        this.hallToPlaceId = id;
    }

    setResultsFromPlaceId(id) {
        this.resultsFromPlaceId = id;
    }

    setResultsToPlaceId(id) {
        this.resultsToPlaceId = id;
    }

    getHallFromPlaceId() {
        return this.hallFromPlaceId;
    }

    getHallToPlaceId() {
        return this.hallToPlaceId;
    }

    getResultsFromPlaceId() {
        return this.resultsFromPlaceId;
    }

    getResultsToPlaceId() {
        return this.resultsToPlaceId;
    }

    /**
     * Synchronise les Place IDs entre hall et results
     */
    syncPlaceIds(fromHall = true) {
        if (fromHall) {
            this.resultsFromPlaceId = this.hallFromPlaceId;
            this.resultsToPlaceId = this.hallToPlaceId;
        } else {
            this.hallFromPlaceId = this.resultsFromPlaceId;
            this.hallToPlaceId = this.resultsToPlaceId;
        }
    }
}

// Export singleton
export const searchManager = new SearchManager();

// Export classe pour tests
export { SearchManager };
