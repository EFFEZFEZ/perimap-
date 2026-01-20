/**
 * itineraryRenderer.js - Rendu des détails d'itinéraire
 * 
 * Extrait de main.js pour améliorer la maintenabilité
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 */

import { 
    getSafeStopLabel, 
    getSafeTimeLabel, 
    getSafeRouteBadgeLabel,
    formatGoogleDuration
} from '../utils/formatters.js';
import { ICONS, getManeuverIcon } from '../config/icons.js';
import { getCategoryForRoute } from '../config/routes.js';

/**
 * Vérifie si une étape est une étape d'attente
 * @param {Object} step
 * @returns {boolean}
 */
export function isWaitStep(step) {
    if (!step) return false;
    return step.type === 'WAIT' || step.travelMode === 'WAIT';
}

/**
 * Génère le HTML pour le badge d'une ligne de bus
 * @param {string} routeShortName
 * @param {Object} options
 * @returns {string}
 */
export function renderRouteBadge(routeShortName, options = {}) {
    const { size = 'normal' } = options;
    const label = getSafeRouteBadgeLabel(routeShortName);
    const category = getCategoryForRoute(routeShortName);
    const categoryClass = category ? `route-${category}` : '';
    const sizeClass = size === 'small' ? 'badge-sm' : '';
    
    return `<span class="route-badge ${categoryClass} ${sizeClass}">${label}</span>`;
}

/**
 * Génère le HTML pour une étape de marche
 * @param {Object} step
 * @returns {string}
 */
export function renderWalkStep(step) {
    const duration = step.duration || step._durationSeconds 
        ? formatGoogleDuration({ seconds: step._durationSeconds || 0 })
        : '';
    const distance = step.distance ? `${Math.round(step.distance)}m` : '';
    const instruction = step.instruction || step.text || 'Marcher';
    
    return `
        <div class="step step-walk">
            <div class="step-icon">
                ${ICONS.walk || '🚶'}
            </div>
            <div class="step-content">
                <div class="step-instruction">${instruction}</div>
                <div class="step-meta">
                    ${distance ? `<span>${distance}</span>` : ''}
                    ${duration ? `<span>${duration}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Génère le HTML pour une étape de bus
 * @param {Object} step
 * @param {Object} options
 * @returns {string}
 */
export function renderBusStep(step, options = {}) {
    const { showIntermediateStops = true } = options;
    
    const routeBadge = renderRouteBadge(step.routeShortName);
    const departureStop = getSafeStopLabel(step.departureStop);
    const arrivalStop = getSafeStopLabel(step.arrivalStop);
    const departureTime = getSafeTimeLabel(step.departureTime);
    const arrivalTime = getSafeTimeLabel(step.arrivalTime);
    
    const intermediateStopsHtml = showIntermediateStops && step.intermediateStops?.length
        ? `
            <div class="intermediate-stops">
                <details>
                    <summary>${step.intermediateStops.length} arrêt(s)</summary>
                    <ul>
                        ${step.intermediateStops.map(s => `<li>${getSafeStopLabel(s)}</li>`).join('')}
                    </ul>
                </details>
            </div>
        `
        : '';
    
    return `
        <div class="step step-bus">
            <div class="step-icon">
                ${routeBadge}
            </div>
            <div class="step-content">
                <div class="step-boarding">
                    <span class="stop-name">${departureStop}</span>
                    <span class="time">${departureTime}</span>
                </div>
                ${intermediateStopsHtml}
                <div class="step-alighting">
                    <span class="stop-name">${arrivalStop}</span>
                    <span class="time">${arrivalTime}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Génère le HTML pour une étape d'attente
 * @param {Object} step
 * @param {Object} presentation - Données de présentation calculées
 * @returns {string}
 */
export function renderWaitStep(step, presentation = {}) {
    const { timeLabel = '', durationLabel = '' } = presentation;
    
    return `
        <div class="step step-wait">
            <div class="step-icon">
                ${ICONS.clock || '⏱️'}
            </div>
            <div class="step-content">
                <div class="step-instruction">Attente</div>
                <div class="step-meta">
                    ${timeLabel ? `<span>à ${timeLabel}</span>` : ''}
                    ${durationLabel ? `<span>${durationLabel}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Génère le HTML pour une étape vélo
 * @param {Object} step
 * @returns {string}
 */
export function renderBikeStep(step) {
    const duration = step.duration || formatGoogleDuration({ seconds: step._durationSeconds || 0 });
    const distance = step.distance ? `${(step.distance / 1000).toFixed(1)} km` : '';
    
    return `
        <div class="step step-bike">
            <div class="step-icon">
                ${ICONS.bike || '🚴'}
            </div>
            <div class="step-content">
                <div class="step-instruction">Vélo</div>
                <div class="step-meta">
                    ${distance ? `<span>${distance}</span>` : ''}
                    ${duration ? `<span>${duration}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Génère le HTML complet pour un itinéraire
 * @param {Object} itinerary
 * @param {Object} options
 * @returns {string}
 */
export function renderItinerarySteps(itinerary, options = {}) {
    if (!itinerary?.steps?.length) {
        return '<div class="no-steps">Aucune étape disponible</div>';
    }
    
    const stepsHtml = itinerary.steps.map((step, index) => {
        if (isWaitStep(step)) {
            const presentation = getWaitStepPresentation(itinerary.steps, index);
            return renderWaitStep(step, presentation);
        }
        
        switch (step.type || step.travelMode) {
            case 'WALK':
            case 'WALKING':
                return renderWalkStep(step);
            case 'BUS':
            case 'TRANSIT':
                return renderBusStep(step, options);
            case 'BIKE':
            case 'BICYCLING':
                return renderBikeStep(step);
            default:
                return renderWalkStep(step); // Fallback
        }
    }).join('');
    
    return `<div class="itinerary-steps">${stepsHtml}</div>`;
}

/**
 * Calcule les données de présentation pour une étape d'attente
 * @param {Array} steps
 * @param {number} index
 * @returns {Object}
 */
export function getWaitStepPresentation(steps, index) {
    const step = steps?.[index] || {};
    const previousStep = index > 0 ? steps[index - 1] : null;
    const nextStep = index < steps.length - 1 ? steps[index + 1] : null;

    const fallbackTime = previousStep?.arrivalTime || step.time || step.arrivalTime || step.departureTime || nextStep?.departureTime;
    
    // Calculer la différence de temps
    let waitMinutes = null;
    
    if (previousStep?.arrivalTime && nextStep?.departureTime) {
        const prevTime = parseTimeToMinutes(previousStep.arrivalTime);
        const nextTime = parseTimeToMinutes(nextStep.departureTime);
        if (prevTime !== null && nextTime !== null) {
            waitMinutes = nextTime - prevTime;
        }
    }
    
    if (waitMinutes === null && typeof step._durationSeconds === 'number') {
        waitMinutes = Math.max(0, Math.round(step._durationSeconds / 60));
    }
    
    if (waitMinutes === null && typeof step.duration === 'string') {
        const match = step.duration.match(/(\d+)/);
        if (match) waitMinutes = parseInt(match[1], 10);
    }
    
    if (waitMinutes !== null && waitMinutes <= 0 && typeof step._durationSeconds === 'number' && step._durationSeconds > 0) {
        waitMinutes = 1;
    }

    const durationLabel = (waitMinutes !== null)
        ? `${waitMinutes} min`
        : (step.duration || 'Attente en cours');

    return {
        timeLabel: getSafeTimeLabel(fallbackTime),
        durationLabel
    };
}

/**
 * Parse une chaîne de temps en minutes depuis minuit
 * @param {string} timeStr - Format "HH:MM" ou "HH:MM:SS"
 * @returns {number|null}
 */
function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export default {
    isWaitStep,
    renderRouteBadge,
    renderWalkStep,
    renderBusStep,
    renderWaitStep,
    renderBikeStep,
    renderItinerarySteps,
    getWaitStepPresentation
};
