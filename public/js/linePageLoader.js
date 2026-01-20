/**
 * linePageLoader.js - Chargement dynamique des pages horaires
 * 
 * Remplace les 36 fichiers HTML statiques par un seul template
 * qui charge les données depuis lines-config.json
 * 
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 */

import { DataManager } from './dataManager.js';
import { RealtimeManager } from './realtimeManager.js';
import { getHawkKeyForStop } from './config/stopKeyMapping.js';
import { userPreferences } from './userPreferences.js';

export class LinePageLoader {
    constructor() {
        this.dataManager = new DataManager();
        this.realtimeManager = new RealtimeManager();
        this.lineConfig = null;
        this.map = null;
        this.stopMarkers = {};
        this.selectedMarker = null;
        this.dataReadyPromise = null;
    }

    /**
     * Initialise la page pour une ligne donnée
     * @param {string} lineId - ID de la ligne (a, b, c, etc.)
     */
    async init(lineId) {
        const normalizedId = lineId.toLowerCase();
        
        try {
            // Charger la configuration des lignes
            const response = await fetch('/data/lines-config.json');
            if (!response.ok) throw new Error('Impossible de charger lines-config.json');
            
            const data = await response.json();
            this.lineConfig = data.lines[normalizedId];
            
            if (!this.lineConfig) {
                this.showError(`Ligne ${lineId.toUpperCase()} non trouvée`);
                return;
            }

            // Tracker la visite
            userPreferences.trackLineClick(this.lineConfig.id);

            // Initialiser l'UI
            this.renderPageContent();
            this.initMap();
            this.setupEventListeners();
            
            // Charger les données GTFS en arrière-plan
            this.loadData().catch(console.error);
            
        } catch (error) {
            console.error('[LinePageLoader] Erreur:', error);
            this.showError('Erreur de chargement');
        }
    }

    normalize(value = '') {
        return value
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    }

    get TERMINUS_A() {
        return this.lineConfig?.stops[0]?.name || '';
    }

    get TERMINUS_B() {
        return this.lineConfig?.stops[this.lineConfig.stops.length - 1]?.name || '';
    }

    showError(message) {
        const content = document.getElementById('line-content');
        if (content) {
            content.innerHTML = `
                <div class="error-message">
                    <h2>⚠️ ${message}</h2>
                    <p>Retournez à <a href="/">l'accueil</a></p>
                </div>
            `;
        }
    }

    setDeparturesPlaceholder(text) {
        const content = document.getElementById('departures-content');
        if (content) {
            content.innerHTML = `<div class="departures-placeholder">${text}</div>`;
        }
    }

    renderPageContent() {
        const config = this.lineConfig;
        
        // Mettre à jour le titre
        document.title = `Horaires Ligne ${config.id} - Périmap`;
        
        // Mettre à jour les meta
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.content = `Horaires et temps réel de la ligne ${config.id} Péribus. ${this.TERMINUS_A} ↔ ${this.TERMINUS_B}`;
        }

        // Header de la ligne
        const header = document.getElementById('line-header');
        if (header) {
            header.innerHTML = `
                <div class="line-badge" style="background: ${config.color}">
                    ${config.id}
                </div>
                <div class="line-info">
                    <h1>Ligne ${config.id}</h1>
                    <p class="line-direction">${this.TERMINUS_A} ↔ ${this.TERMINUS_B}</p>
                </div>
            `;
        }

        // Sélecteur d'arrêts
        const stopSelect = document.getElementById('stop-select');
        if (stopSelect) {
            stopSelect.innerHTML = '<option value="">Sélectionner un arrêt</option>';
            config.stops.forEach(stop => {
                const option = document.createElement('option');
                option.value = stop.name;
                option.textContent = stop.name;
                stopSelect.appendChild(option);
            });
        }

        // FAQ dynamique
        const faqContainer = document.getElementById('faq-container');
        if (faqContainer && config.faq?.length) {
            faqContainer.innerHTML = config.faq.map(item => `
                <details class="faq-item">
                    <summary>${item.question}</summary>
                    <div class="faq-answer">${item.answer}</div>
                </details>
            `).join('');
        }

        // Lien PDF
        const pdfLink = document.getElementById('pdf-link');
        if (pdfLink && config.pdfUrl) {
            pdfLink.href = config.pdfUrl;
            pdfLink.style.display = 'flex';
        } else if (pdfLink) {
            pdfLink.style.display = 'none';
        }

        // Lien carte
        const mapLink = document.getElementById('map-link');
        if (mapLink) {
            mapLink.href = `/#carte?ligne=${config.id}`;
        }
    }

    initMap() {
        if (typeof L === 'undefined') {
            console.warn('[LinePageLoader] Leaflet non chargé');
            return;
        }

        const config = this.lineConfig;
        
        this.map = L.map('line-map', {
            center: [45.195, 0.695],
            zoom: 13,
            zoomControl: false,
            attributionControl: true,
            dragging: false,
            touchZoom: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
            maxZoom: 19
        }).addTo(this.map);

        // Tracé de la ligne
        if (config.routeShape?.length) {
            const routeLayer = L.polyline(config.routeShape, {
                color: config.color,
                weight: 4,
                opacity: 0.9
            }).addTo(this.map);
            this.map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
        }

        // Marqueurs des arrêts
        config.stops.forEach((stop, index) => {
            const isTerminus = index === 0 || index === config.stops.length - 1;
            const marker = L.circleMarker([stop.lat, stop.lon], {
                radius: isTerminus ? 8 : 5,
                fillColor: '#ffffff',
                color: config.color,
                weight: 2,
                fillOpacity: 1
            }).addTo(this.map);
            
            marker.bindTooltip(stop.name, { permanent: false });
            this.stopMarkers[stop.name] = marker;
        });

        setTimeout(() => this.map.invalidateSize(), 100);
    }

    setupEventListeners() {
        // Sélection d'arrêt
        const stopSelect = document.getElementById('stop-select');
        if (stopSelect) {
            stopSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.setDeparturesPlaceholder('Chargement des prochains passages...');
                    this.highlightStop(e.target.value);
                } else {
                    this.setDeparturesPlaceholder('Sélectionnez un arrêt pour afficher les prochains passages');
                }
            });
        }

        // Bouton localisation
        const locateBtn = document.getElementById('locate-btn');
        if (locateBtn) {
            locateBtn.addEventListener('click', () => this.handleLocate());
        }

        // Menu mobile
        const menuToggle = document.getElementById('mobile-menu-toggle');
        const mobileMenu = document.getElementById('mobile-menu');
        if (menuToggle && mobileMenu) {
            menuToggle.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }

        // Theme toggle
        const themeBtn = document.getElementById('theme-toggle-btn');
        const themeIcon = document.getElementById('theme-toggle-icon');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                document.body.classList.toggle('dark-theme');
                const isDark = document.body.classList.contains('dark-theme');
                if (themeIcon) themeIcon.textContent = isDark ? '☀️' : '🌙';
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
            });
            
            // Restaurer le thème
            if (localStorage.getItem('theme') === 'light') {
                document.body.classList.remove('dark-theme');
                if (themeIcon) themeIcon.textContent = '🌙';
            }
        }
    }

    handleLocate() {
        const btn = document.getElementById('locate-btn');
        if (btn) btn.classList.add('loading');

        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    if (btn) btn.classList.remove('loading');
                    const userLat = position.coords.latitude;
                    const userLon = position.coords.longitude;
                    
                    let closest = null;
                    let minDist = Infinity;
                    
                    this.lineConfig.stops.forEach(stop => {
                        const dist = Math.sqrt(
                            Math.pow(stop.lat - userLat, 2) + 
                            Math.pow(stop.lon - userLon, 2)
                        );
                        if (dist < minDist) {
                            minDist = dist;
                            closest = stop;
                        }
                    });

                    if (closest) {
                        const stopSelect = document.getElementById('stop-select');
                        if (stopSelect) stopSelect.value = closest.name;
                        this.setDeparturesPlaceholder('Chargement des prochains passages...');
                        this.highlightStop(closest.name);
                    }
                },
                () => {
                    if (btn) btn.classList.remove('loading');
                    alert('Impossible d\'obtenir votre position.');
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            if (btn) btn.classList.remove('loading');
            alert('Géolocalisation non disponible.');
        }
    }

    async loadData() {
        if (this.dataReadyPromise) return this.dataReadyPromise;
        
        this.dataReadyPromise = (async () => {
            this.setDeparturesPlaceholder('Chargement des horaires GTFS...');
            await this.dataManager.loadAllData();
            this.realtimeManager.init(this.dataManager.stops, false);
        })().catch((error) => {
            console.error('[LinePageLoader] Chargement GTFS impossible', error);
            this.setDeparturesPlaceholder('Horaires indisponibles pour le moment.');
            throw error;
        });
        
        return this.dataReadyPromise;
    }

    resolveStopIds(stopName) {
        const ids = [];
        const normalized = this.normalize(stopName);
        
        const direct = this.lineConfig.stops.find(s => this.normalize(s.name) === normalized);
        if (direct?.stop_id) ids.push(direct.stop_id);
        
        const byName = this.dataManager.stopsByName?.[normalized] || [];
        byName.forEach(stop => {
            if (stop.stop_id) ids.push(stop.stop_id);
        });
        
        return [...new Set(ids)];
    }

    resolveHawkKey(stopName, stopIds = []) {
        const normalized = this.normalize(stopName);
        const direct = this.lineConfig.stops.find(s => this.normalize(s.name) === normalized);
        
        if (direct) {
            const key = getHawkKeyForStop(direct.stop_id, direct.stop_code);
            if (key) return key;
        }
        
        for (const stopId of stopIds) {
            const stop = this.dataManager.stopsById?.[stopId];
            if (!stop) continue;
            const key = getHawkKeyForStop(stop.stop_id, stop.stop_code);
            if (key) return key;
        }
        
        return null;
    }

    getStaticDepartures(stopIds) {
        const now = new Date();
        const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const allDepartures = this.dataManager.getUpcomingDepartures(stopIds, seconds, now, 100);
        
        const lineRouteId = this.lineConfig.routeId;
        const filtered = allDepartures.filter(dep => {
            const trip = this.dataManager.tripsByTripId?.[dep.tripId];
            return trip && trip.route_id === lineRouteId;
        });
        
        return filtered.map(dep => ({ ...dep, isRealtime: false }));
    }

    timeToSeconds(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.split(':').map(Number);
        if (parts.length < 2) return 0;
        return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    }

    splitByDirection(departures) {
        const toB = [];
        const toA = [];
        const normA = this.normalize(this.TERMINUS_A);
        const normB = this.normalize(this.TERMINUS_B);

        departures.forEach(dep => {
            const dest = dep.realtimeDestination || dep.destination || '';
            const nDest = this.normalize(dest);
            
            if (normB && nDest.includes(normB)) {
                toB.push(dep);
                return;
            }
            if (normA && nDest.includes(normA)) {
                toA.push(dep);
                return;
            }
            (toB.length <= toA.length ? toB : toA).push(dep);
        });

        const sortByTime = (a, b) => 
            (a.departureSeconds || this.timeToSeconds(a.time)) - 
            (b.departureSeconds || this.timeToSeconds(b.time));
        
        toB.sort(sortByTime);
        toA.sort(sortByTime);

        return { toB: toB.slice(0, 10), toA: toA.slice(0, 10) };
    }

    formatDisplayTime(dep) {
        if (dep.isRealtime) {
            return dep.realtimeText || 
                (typeof dep.realtimeMinutes === 'number' ? `${dep.realtimeMinutes} min` : 'Temps réel');
        }
        if (!dep.time) return '—';
        const parts = dep.time.split(':');
        return parts.length >= 2 
            ? `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}` 
            : dep.time;
    }

    renderDepartures(dirToB, dirToA, usedRealtime) {
        const content = document.getElementById('departures-content');
        if (!content) return;

        const blockHtml = (label, departures) => {
            if (!departures?.length) {
                return `
                    <div class="direction-block">
                        <div class="direction-header"><span class="arrow">→</span>${label}</div>
                        <div class="direction-times">
                            <span class="no-departures">Aucun départ prévu</span>
                        </div>
                    </div>`;
            }
            const times = departures.map(d => 
                `<span class="time-badge ${d.isRealtime ? 'realtime' : ''}">${this.formatDisplayTime(d)}</span>`
            ).join('');
            return `
                <div class="direction-block">
                    <div class="direction-header"><span class="arrow">→</span>${label}</div>
                    <div class="direction-times">${times}</div>
                </div>`;
        };

        content.innerHTML = `
            ${blockHtml(`Direction ${this.TERMINUS_B || 'aller'}`, dirToB)}
            ${blockHtml(`Direction ${this.TERMINUS_A || 'retour'}`, dirToA)}
        `;

        const badge = document.getElementById('realtime-badge');
        if (badge) {
            badge.style.display = usedRealtime ? 'flex' : 'none';
        }
    }

    async showDepartures(stopName) {
        await this.loadData();
        
        const stopIds = this.resolveStopIds(stopName);
        if (!stopIds.length) {
            this.setDeparturesPlaceholder('Arrêt introuvable dans le GTFS.');
            return;
        }

        const staticDepartures = this.getStaticDepartures(stopIds);
        let merged = staticDepartures;
        let usedRealtime = false;

        const hawkKey = this.resolveHawkKey(stopName, stopIds);
        if (hawkKey) {
            try {
                const rt = await this.realtimeManager.fetchRealtimeByHawkKey(hawkKey);
                merged = this.realtimeManager.mergeWithStatic(staticDepartures, rt);
                usedRealtime = merged.some(dep => dep.isRealtime);
            } catch (error) {
                console.warn('[LinePageLoader] Temps réel indisponible', error?.message);
                merged = staticDepartures;
            }
        }

        const { toB, toA } = this.splitByDirection(merged);
        this.renderDepartures(toB, toA, usedRealtime);
    }

    highlightStop(stopName) {
        const config = this.lineConfig;
        
        // Reset tous les marqueurs
        config.stops.forEach((stop, index) => {
            const isTerminus = index === 0 || index === config.stops.length - 1;
            if (this.stopMarkers[stop.name]) {
                this.stopMarkers[stop.name].setStyle({
                    fillColor: '#ffffff',
                    color: config.color,
                    radius: isTerminus ? 8 : 5
                });
            }
        });

        // Highlight le marqueur sélectionné
        if (this.stopMarkers[stopName]) {
            this.selectedMarker = this.stopMarkers[stopName];
            this.selectedMarker.setStyle({
                fillColor: config.color,
                color: '#fdd003',
                radius: 10
            });
        }

        this.showDepartures(stopName);
    }
}

// Auto-initialisation si l'ID de ligne est dans l'URL
export function initLinePageFromUrl() {
    // Chercher l'ID de ligne dans l'URL: /horaires/a ou ?ligne=a
    const pathMatch = window.location.pathname.match(/\/horaires\/([a-z0-9]+)/i);
    const urlParams = new URLSearchParams(window.location.search);
    const lineId = pathMatch?.[1] || urlParams.get('ligne');
    
    if (lineId) {
        const loader = new LinePageLoader();
        loader.init(lineId);
        return loader;
    }
    
    return null;
}

// Export global pour usage simple
window.LinePageLoader = LinePageLoader;
window.initLinePageFromUrl = initLinePageFromUrl;
