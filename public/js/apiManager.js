/*
 * Copyright (c) 2025 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * apiManager.js - VERSION V230 (Support OTP/Photon + Google)
 * Gère tous les appels aux API externes.
 *
 * ✅ V230: SUPPORT MULTI-BACKEND
 * - Mode 'vercel': Proxies Vercel → Google APIs
 * - Mode 'otp': Serveur Express → OTP + Photon (itinéraires + lieux)
 * - Mode 'google': SDK Google Maps direct (dev)
 *
 * ✅ V222: 1 SEUL APPEL BUS (comme mode arrivée)
 * - Google retourne 5-6 alternatives avec computeAlternativeRoutes: true
 * - Mode partir ET arriver : 1 appel bus + 1 vélo + 1 marche = 3 appels
 * - ÉCONOMIE : -70% de coût API (3 appels au lieu de 10)
 * 
 * ✅ V181: PROXY COMPLET - Tout passe par les proxies Vercel en production
 * - /api/routes : Google Routes API (itinéraires bus/vélo/marche)
 * - /api/places : Google Places API (autocomplétion + geocoding placeId→coords)
 * - /api/geocode : Google Geocoding API (reverse geocode lat/lng→placeId)
 * 
 * Le SDK Google Maps JavaScript n'est PAS chargé en mode proxy.
 *
 * *** MODIFICATION V48 (Alias Campus/Grenadière) ***
 * 1. Ajout d'un système d'alias pour fusionner des lieux équivalents.
 * 2. "Campus" et "Pôle Universitaire Grenadière" pointent vers le même lieu.
 *
 * *** MODIFICATION V57 (Géolocalisation) ***
 * 1. Ajout de la fonction `reverseGeocode` pour convertir lat/lng en place_id.
 */

import { getAppConfig, API_ENDPOINTS, getApiEndpoints } from './config.js';

export class ApiManager {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.sessionToken = null;
        
        // ✅ V310: LOGS DÉTAILLÉS POUR DEBUG
        console.log('[ApiManager] ═══════════════════════════════════════');
        console.log('[ApiManager] 🚀 Initialisation ApiManager');
        console.log('[ApiManager] 📍 apiKey fournie:', apiKey ? '***' + apiKey.slice(-4) : 'AUCUNE');
        
        // ✅ V230: Configuration multi-backend
        const config = getAppConfig();
        
        console.log('[ApiManager] 📦 Configuration reçue de getAppConfig():');
        console.log('[ApiManager]   - useProxy:', config.useProxy);
        console.log('[ApiManager]   - useOtp:', config.useOtp);
        console.log('[ApiManager]   - backendMode:', config.backendMode);
        console.log('[ApiManager]   - apiEndpoints:', JSON.stringify(config.apiEndpoints));
        
        this.useProxy = config.useProxy;
        this.useOtp = config.useOtp || false;
        this.backendMode = config.backendMode || 'vercel';
        this.apiEndpoints = config.apiEndpoints || getApiEndpoints();
        
        console.log('[ApiManager] ✅ Valeurs finales:');
        console.log('[ApiManager]   - this.useProxy:', this.useProxy);
        console.log('[ApiManager]   - this.useOtp:', this.useOtp);
        console.log('[ApiManager]   - this.backendMode:', this.backendMode);
        console.log('[ApiManager]   - this.apiEndpoints:', JSON.stringify(this.apiEndpoints));
        console.log('[ApiManager] ═══════════════════════════════════════');

        // Zone du Grand Périgueux / Dordogne
        this.perigueuxBounds = {
            south: 45.10,  // Sud du Grand Périgueux
            west: 0.60,    // Ouest
            north: 45.30,  // Nord
            east: 0.85     // Est
        };
        
        this.perigueuxCenter = { lat: 45.184029, lng: 0.7211149 };

        // ✅ V57: Services Google Maps
        this.geocoder = null;
        this.autocompleteService = null;
        this.apiLoadPromise = null; // <-- CORRECTION: Ajout du verrou
        this.proxyReady = false; // ✅ V181: Flag pour mode proxy
        this.googleAuthFailed = false;
        this.googleAuthFailureMessage = '';
        this.clientOrigin = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';

        // ✅ Itinerary cache (in-memory)
        // Avoids repeated recalculation for identical queries (useful during peak hours).
        // Note: this caches only SAME query (same from/to + date/time + mode). It does NOT reuse across different times.
        this._itineraryCache = new Map();
        this._itineraryCacheTtlMs = 2 * 60 * 1000; // 2 minutes
        this._itineraryCacheMaxEntries = 50;
        
        // ✅ V49: Alias de lieux - Fusion d'arrêts équivalents (pôles multimodaux)
        // Quand l'utilisateur cherche un de ces termes, on lui propose le lieu canonique
        // ET le routeur considère TOUS les arrêts du pôle comme équivalents
        this.placeAliases = {
            // Campus universitaire de Périgueux - PÔLE MULTIMODAL
            // Regroupe l'arrêt "Campus" (K1A) et "Pôle Universitaire Grenadière" (K1B)
            'campus': {
                canonicalName: 'Campus Universitaire, Périgueux',
                aliases: ['campus', 'campus périgueux', 'fac', 'fac périgueux', 'université', 'université périgueux', 'iut', 'iut périgueux', 'grenadière', 'pole universitaire', 'pôle universitaire', 'la grenadière'],
                // Coordonnées centrales (entre les deux arrêts)
                coordinates: { lat: 45.1958, lng: 0.7192 },
                description: 'Campus universitaire (arrêts Campus + Pôle Grenadière)',
                // ✅ V49: Liste des arrêts GTFS qui desservent ce pôle
                gtfsStops: [
                    { stopId: 'MOBIITI:StopPlace:77309', name: 'Campus', lat: 45.197113, lng: 0.718130 },
                    { stopId: 'MOBIITI:StopPlace:77314', name: 'Pôle Universitaire Grenadière', lat: 45.194477, lng: 0.720215 }
                ],
                // Rayon de recherche autour du centre (en mètres)
                searchRadius: 400
            }
        };
    }

    /**
     * Initialise le chargeur de l'API Google Maps.
     * ✅ V181: En mode proxy, on n'a PAS besoin du SDK Google Maps côté client
     * L'autocomplétion et le géocodage passent par les proxies Vercel
     */
    async loadGoogleMapsAPI() {
        // ✅ V181: En mode proxy, ne pas charger le SDK Google Maps
        // On utilise les endpoints /api/places et /api/geocode
        if (this.useProxy) {
            console.log("✅ Mode proxy activé - SDK Google Maps non requis");
            this.proxyReady = true;
            return Promise.resolve();
        }

        if (this.googleAuthFailed) {
            return Promise.reject(new Error(this.buildAuthFailureMessage()));
        }

        // <-- CORRECTION: Vérifie si un chargement est déjà en cours
        if (this.apiLoadPromise) {
            return this.apiLoadPromise;
        }

        if (window.google?.maps) {
            await this.ensureGoogleLibraries();
            if (window.google.maps.places && window.google.maps.Geocoder) {
                console.log("✅ API Google Maps déjà chargée.");
                this.initServices();
                return Promise.resolve();
            }
        }

        this.installGoogleAuthHook();

        // <-- CORRECTION: Stocke la promesse pour la réutiliser
        this.apiLoadPromise = new Promise((resolve, reject) => {
            const authEventName = 'peribus-google-auth-failure';
            const handleAuthFailure = (event) => {
                window.removeEventListener(authEventName, handleAuthFailure);
                this.googleAuthFailed = true;
                this.googleAuthFailureMessage = this.buildAuthFailureMessage(event?.detail?.origin);
                console.error(this.googleAuthFailureMessage);
                this.apiLoadPromise = null;
                reject(new Error(this.googleAuthFailureMessage));
            };
            window.addEventListener(authEventName, handleAuthFailure, { once: true });

            const cleanupAuthHandler = () => window.removeEventListener(authEventName, handleAuthFailure);
            const script = document.createElement('script');
            
            // ✅ V57: Charge 'places' (pour Autocomplete) et 'geocoding' (pour Reverse Geocode)
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places,geocoding&v=weekly&loading=async`;
            
            script.async = true;
            script.defer = true;
            script.setAttribute('data-google-maps', 'true');
            
            script.onload = () => {
                cleanupAuthHandler();
                console.log("✅ API Google Maps chargée avec succès.");
                setTimeout(async () => {
                    try {
                        await this.ensureGoogleLibraries();
                        // ✅ V57: Vérifie les deux bibliothèques
                        if (window.google?.maps?.places && window.google?.maps?.Geocoder) {
                            this.initServices();
                            resolve();
                        } else {
                            throw new Error("Bibliothèques places/geocoding non disponibles");
                        }
                    } catch (err) {
                        console.error("❌ google.maps.places ou google.maps.Geocoder n'est pas disponible");
                        this.apiLoadPromise = null;
                        reject(err);
                    }
                }, 100);
            };
            
            script.onerror = () => {
                cleanupAuthHandler();
                console.error("❌ Erreur lors du chargement du script Google Maps.");
                this.apiLoadPromise = null;
                reject(new Error("Impossible de charger Google Maps API."));
            };
            
            document.head.appendChild(script);
        });

        return this.apiLoadPromise;
    }

    /**
     * Initialise les services une fois l'API chargée.
     */
    initServices() {
        if (!window.google?.maps?.places || !window.google?.maps?.Geocoder) { // ✅ V57: Vérifie les deux
            console.error("❌ Les bibliothèques Google Maps 'places' ou 'geocoding' ne sont pas disponibles.");
            return;
        }
        
        try {
            // ✅ V57: Service de Geocoding
            this.geocoder = new google.maps.Geocoder();
            
            // Service d'Autocomplete
            if (google.maps.places.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
                console.log("✅ Nouvelle API AutocompleteSuggestion disponible.");
                // Pas besoin d'instancier, on utilise la méthode statique
            } else {
                console.warn("⚠️ AutocompleteSuggestion non disponible, fallback vers ancienne API");
                this.autocompleteService = new google.maps.places.AutocompleteService();
            }
            
            this.sessionToken = new google.maps.places.AutocompleteSessionToken();
            
        } catch (error) {
            console.error("❌ Erreur lors de l'initialisation des services:", error);
        }
    }

    /**
     * S'assure que les bibliothèques Google nécessaires sont prêtes
     */
    async ensureGoogleLibraries() {
        if (!window.google?.maps) {
            return;
        }

        const importLib = window.google.maps.importLibrary;
        if (typeof importLib !== 'function') {
            return;
        }

        // Charger la bibliothèque Places si nécessaire
        if (!window.google.maps.places) {
            try {
                const placesLib = await importLib('places');
                if (placesLib) {
                    window.google.maps.places = window.google.maps.places || {};
                    Object.assign(window.google.maps.places, placesLib);
                }
            } catch (error) {
                console.warn('⚠️ Impossible de charger la bibliothèque Places via importLibrary:', error);
            }
        }

        // Charger la bibliothèque Geocoding si nécessaire
        if (!window.google.maps.Geocoder) {
            try {
                const geocodingLib = await importLib('geocoding');
                if (geocodingLib?.Geocoder && !window.google.maps.Geocoder) {
                    window.google.maps.Geocoder = geocodingLib.Geocoder;
                }
            } catch (error) {
                console.warn('⚠️ Impossible de charger la bibliothèque Geocoding via importLibrary:', error);
            }
        }
    }

    /**
     * Récupère les suggestions d'autocomplétion
     * ✅ V310: LOGS DÉTAILLÉS POUR DEBUG ORACLE CLOUD
     * ✅ V230: Support OTP/Photon backend
     * ✅ V181: Utilise le proxy Vercel /api/places en production
     * ✅ V48: Intègre les alias de lieux (Campus = Pôle Universitaire Grenadière)
     */
    async getPlaceAutocomplete(inputString) {
        console.log('[ApiManager] ═══════════════════════════════════════');
        console.log('[ApiManager] 🔍 getPlaceAutocomplete() appelé');
        console.log('[ApiManager]   - inputString:', inputString);
        console.log('[ApiManager]   - this.useOtp:', this.useOtp);
        console.log('[ApiManager]   - this.useProxy:', this.useProxy);
        console.log('[ApiManager]   - this.backendMode:', this.backendMode);
        console.log('[ApiManager]   - this.apiEndpoints.places:', this.apiEndpoints.places);
        
        // ✅ V48: Vérifier si l'entrée correspond à un alias
        const aliasMatch = this._checkPlaceAlias(inputString);
        
        try {
            let results = [];
            
            // ✅ V230: Mode OTP - utiliser l'endpoint Photon du serveur Express
            if (this.useOtp) {
                console.log("[ApiManager] 🌐 Mode Oracle activé - Appel backend Oracle Cloud (RAPTOR)");
                
                const url = new URL(this.apiEndpoints.places, window.location.origin);
                url.searchParams.set('q', inputString);
                url.searchParams.set('lat', this.perigueuxCenter.lat);
                url.searchParams.set('lon', this.perigueuxCenter.lng);
                url.searchParams.set('limit', '10');
                
                console.log('[ApiManager] 📡 URL construite:', url.toString());
                console.log('[ApiManager] ⏳ Envoi de la requête fetch...');
                
                const startTime = Date.now();
                const response = await fetch(url.toString());
                const elapsed = Date.now() - startTime;
                
                console.log('[ApiManager] 📥 Réponse reçue en', elapsed, 'ms');
                console.log('[ApiManager]   - response.ok:', response.ok);
                console.log('[ApiManager]   - response.status:', response.status);
                console.log('[ApiManager]   - response.statusText:', response.statusText);
                console.log('[ApiManager]   - Content-Type:', response.headers.get('content-type'));
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('[ApiManager] ❌ Erreur HTTP:', response.status);
                    console.error('[ApiManager] ❌ Corps de l\'erreur:', errorText);
                    throw new Error(`Erreur OTP: ${response.status} - ${errorText}`);
                }
                
                const data = await response.json();
                console.log('[ApiManager] 📦 Données JSON reçues:', JSON.stringify(data).substring(0, 500));
                console.log('[ApiManager]   - Nombre de suggestions:', data.suggestions?.length || 0);
                
                // ✅ V230: Format OTP: { suggestions: [{lat, lon, description, city, type}] }
                results = (data.suggestions || []).map(s => ({
                    description: s.description + (s.city ? `, ${s.city}` : ''),
                    // Pour OTP, on utilise les coordonnées directement (pas de placeId Google)
                    placeId: null,
                    coordinates: { lat: s.lat, lng: s.lon },
                    type: s.type || 'place',
                    source: s.source || 'photon'
                }));
                
                console.log(`[ApiManager] ✅ ${results.length} suggestions mappées (OTP/Photon)`);
                console.log('[ApiManager] ═══════════════════════════════════════');
            }
            // ✅ V181: Mode proxy Vercel - utiliser Google Places
            else if (this.useProxy) {
                console.log("🔍 Recherche autocomplétion (proxy):", inputString);
                
                const url = new URL(this.apiEndpoints.places, window.location.origin);
                url.searchParams.set('input', inputString);
                
                const response = await fetch(url.toString());
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Erreur proxy: ${response.status}`);
                }
                
                const data = await response.json();
                results = (data.predictions || []).map(p => ({
                    description: p.description,
                    placeId: p.placeId
                }));
                
                console.log(`✅ ${results.length} suggestions trouvées (proxy)`);
            } 
            // Mode SDK Google Maps (dev local avec clé API)
            else {
                if (!this.sessionToken) {
                    console.warn("⚠️ Service d'autocomplétion non initialisé. Tentative de chargement...");
                    try {
                        await this.loadGoogleMapsAPI();
                    } catch (error) {
                        console.error("❌ Impossible d'initialiser le service d'autocomplétion:", error.message);
                        return aliasMatch ? [this._createAliasResult(aliasMatch)] : [];
                    }
                    if (!this.sessionToken) {
                        console.error("❌ Impossible d'initialiser le service d'autocomplétion");
                        return aliasMatch ? [this._createAliasResult(aliasMatch)] : [];
                    }
                }
                
                // Vérifier si la nouvelle API est disponible
                if (google.maps.places.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
                    // ✅ NOUVELLE API (recommandée depuis mars 2025)
                    const request = {
                        input: inputString,
                        locationRestriction: {
                            west: this.perigueuxBounds.west,
                            north: this.perigueuxBounds.north,
                            east: this.perigueuxBounds.east,
                            south: this.perigueuxBounds.south
                        },
                        region: "fr",
                        sessionToken: this.sessionToken,
                    };

                    console.log("🔍 Recherche autocomplétion (SDK):", inputString);
                    const { suggestions } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
                    console.log(`✅ ${suggestions.length} suggestions trouvées`);
                    
                    results = suggestions.map(s => ({
                        description: s.placePrediction.text.text,
                        placeId: s.placePrediction.placeId,
                    }));
                } else {
                    // ❌ FALLBACK : Ancienne API (dépréciée mais fonctionnelle)
                    console.warn("⚠️ Utilisation de l'ancienne API AutocompleteService (dépréciée)");
                    
                    results = await new Promise((resolve, reject) => {
                        const request = {
                            input: inputString,
                            sessionToken: this.sessionToken,
                            componentRestrictions: { country: 'fr' },
                            bounds: new google.maps.LatLngBounds(
                                new google.maps.LatLng(this.perigueuxBounds.south, this.perigueuxBounds.west),
                                new google.maps.LatLng(this.perigueuxBounds.north, this.perigueuxBounds.east)
                            ),
                            strictBounds: true,
                        };

                        this.autocompleteService.getPlacePredictions(request, (predictions, status) => {
                            if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
                                console.warn("⚠️ Échec de l'autocomplétion Places:", status);
                                resolve([]);
                            } else {
                                console.log(`✅ ${predictions.length} suggestions trouvées (ancienne API)`);
                                resolve(predictions.map(p => ({
                                    description: p.description,
                                    placeId: p.place_id,
                                })));
                            }
                        });
                    });
                }
            }
            
            // ✅ V48: Injecter l'alias en première position si trouvé
            if (aliasMatch) {
                // Vérifier si le résultat n'est pas déjà dans la liste
                const alreadyInList = results.some(r => 
                    r.description.toLowerCase().includes('grenadière') || 
                    r.description.toLowerCase().includes('universitaire')
                );
                
                if (!alreadyInList) {
                    results.unshift(this._createAliasResult(aliasMatch));
                    console.log(`🎓 Alias injecté: ${aliasMatch.canonicalName}`);
                }
            }
            
            return results;
        } catch (error) {
            console.error("❌ Erreur lors de l'autocomplétion:", error);
            
            // ✅ V48: Même en cas d'erreur, proposer l'alias si trouvé
            if (aliasMatch) {
                return [this._createAliasResult(aliasMatch)];
            }
            
            return [];
        }
    }
    
    /**
     * ✅ V181: Helper pour créer un résultat d'alias
     * @private
     */
    _createAliasResult(aliasMatch) {
        return {
            description: `🎓 ${aliasMatch.canonicalName}`,
            placeId: `ALIAS_CAMPUS`,
            isAlias: true,
            coordinates: aliasMatch.coordinates,
            aliasDescription: aliasMatch.description
        };
    }
    
    /**
     * ✅ V48: Vérifie si l'entrée correspond à un alias de lieu
     * @private
     */
    _checkPlaceAlias(inputString) {
        if (!inputString || inputString.length < 3) return null;
        
        const normalizedInput = inputString.toLowerCase().trim();
        
        for (const [key, aliasData] of Object.entries(this.placeAliases)) {
            // Vérifier si l'entrée correspond à un des alias
            const matchesAlias = aliasData.aliases.some(alias => {
                // Match exact ou partiel (l'alias commence par l'entrée)
                return alias.startsWith(normalizedInput) || normalizedInput.startsWith(alias);
            });
            
            if (matchesAlias) {
                console.log(`🎓 Alias trouvé: "${inputString}" → "${aliasData.canonicalName}"`);
                return aliasData;
            }
        }
        
        return null;
    }
    
    /**
     * ✅ V48: Résout un placeId d'alias en coordonnées
     * @param {string} placeId - Le placeId (peut être un alias comme ALIAS_CAMPUS)
     * @returns {Promise<{lat:number, lng:number}|null>}
     */
    async resolveAliasOrPlaceId(placeId) {
        // Vérifier si c'est un alias
        if (placeId && placeId.startsWith('ALIAS_')) {
            const aliasKey = placeId.replace('ALIAS_', '').toLowerCase();
            const aliasData = this.placeAliases[aliasKey];
            if (aliasData && aliasData.coordinates) {
                console.log(`🎓 Résolution alias: ${placeId} → ${JSON.stringify(aliasData.coordinates)}`);
                return aliasData.coordinates;
            }
        }
        
        // Sinon, utiliser le geocoder normal
        return this.getPlaceCoords(placeId);
    }

    /**
     * ✅ V57: Convertit les coordonnées (lat, lng) en le place_id le plus proche.
     * ✅ V181: Utilise le proxy Vercel /api/geocode en production
     * @param {number} lat
     * @param {number} lng
     * @returns {Promise<string|null>} Le place_id ou null
     */
    async reverseGeocode(lat, lng) {
        // ✅ V181: Mode proxy - utiliser l'endpoint Vercel
        if (this.useProxy) {
            try {
                const url = new URL(this.apiEndpoints.geocode, window.location.origin);
                url.searchParams.set('lat', lat);
                url.searchParams.set('lng', lng);
                
                const response = await fetch(url.toString());
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Erreur geocode proxy: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    const placeId = data.results[0].place_id;
                    console.log(`✅ Géocodage inversé réussi (proxy): ${placeId}`);
                    return placeId;
                }
                
                console.warn("Géocodage inversé: Aucun résultat trouvé.");
                return null;
            } catch (error) {
                console.error("❌ Erreur géocodage inversé (proxy):", error);
                return null;
            }
        }
        
        // Mode SDK Google Maps (dev local)
        if (!this.geocoder) {
            console.warn("⚠️ Service Geocoder non initialisé. Tentative de chargement...");
            try {
                await this.loadGoogleMapsAPI();
            } catch (error) {
                console.error("❌ Impossible d'initialiser le service Geocoder:", error.message);
                return null;
            }
            if (!this.geocoder) {
                console.error("❌ Impossible d'initialiser le service Geocoder");
                return null;
            }
        }

        return new Promise((resolve, reject) => {
            const latlng = { lat: lat, lng: lng };
            this.geocoder.geocode({ location: latlng }, (results, status) => {
                if (status === 'OK') {
                    if (results && results.length > 0) {
                        // On prend le premier résultat (le plus précis)
                        console.log(`✅ Géocodage inversé réussi: ${results[0].place_id}`);
                        resolve(results[0].place_id);
                    } else {
                        console.warn("Géocodage inversé: Aucun résultat trouvé.");
                        resolve(null);
                    }
                } else {
                    console.warn("Échec du géocodage inversé:", status);
                    reject(new Error(`Geocode failed with status: ${status}`));
                }
            });
        });
    }

    /**
     * Récupère les coordonnées {lat,lng} pour un place_id en utilisant le Geocoder
     * ✅ V230: Support OTP - coordonnées directes sans placeId
     * ✅ V49: Gère les alias avec pôles multimodaux (retourne aussi les arrêts GTFS)
     * ✅ V181: Utilise le proxy Vercel /api/places?placeId=... en production
     * @param {string|object} placeIdOrCoords - placeId Google OU objet {lat, lng/lon}
     * @returns {Promise<{lat:number, lng:number, gtfsStops?:Array, searchRadius?:number}|null>}
     */
    async getPlaceCoords(placeIdOrCoords) {
        // ✅ V230: Si c'est déjà un objet avec coordonnées (mode OTP), le retourner directement
        if (placeIdOrCoords && typeof placeIdOrCoords === 'object' && (placeIdOrCoords.lat || placeIdOrCoords.latitude)) {
            const lat = placeIdOrCoords.lat || placeIdOrCoords.latitude;
            const lng = placeIdOrCoords.lng || placeIdOrCoords.lon || placeIdOrCoords.longitude;
            console.log(`✅ Coordonnées directes: ${lat}, ${lng}`);
            return { lat, lng };
        }
        
        const placeId = placeIdOrCoords;
        
        // ✅ V49: Vérifier si c'est un alias avec pôle multimodal
        if (placeId && typeof placeId === 'string' && placeId.startsWith('ALIAS_')) {
            const aliasKey = placeId.replace('ALIAS_', '').toLowerCase();
            const aliasData = this.placeAliases[aliasKey];
            if (aliasData && aliasData.coordinates) {
                console.log(`🎓 Résolution alias coords: ${placeId} → ${JSON.stringify(aliasData.coordinates)}`);
                // Retourner les coordonnées ET les infos du pôle multimodal
                return {
                    lat: aliasData.coordinates.lat,
                    lng: aliasData.coordinates.lng,
                    gtfsStops: aliasData.gtfsStops || null,
                    searchRadius: aliasData.searchRadius || 300,
                    isMultiStop: Array.isArray(aliasData.gtfsStops) && aliasData.gtfsStops.length > 1
                };
            }
        }
        
        // ✅ V230: Mode OTP - pas de placeId Google, utiliser reverse geocode si nécessaire
        if (this.useOtp) {
            console.warn('getPlaceCoords (OTP): placeId non supporté, utilisez les coordonnées directes');
            return null;
        }
        
        // ✅ V181: Mode proxy Vercel - utiliser l'endpoint Google Places
        if (this.useProxy) {
            try {
                const url = new URL(this.apiEndpoints.places, window.location.origin);
                url.searchParams.set('placeId', placeId);
                
                const response = await fetch(url.toString());
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.warn('getPlaceCoords (proxy): erreur', errorData.error || response.status);
                    return null;
                }
                
                const data = await response.json();
                
                if (data.lat && data.lng) {
                    console.log(`✅ Coordonnées obtenues (proxy): ${placeId} → ${data.lat}, ${data.lng}`);
                    return { lat: data.lat, lng: data.lng };
                }
                
                console.warn('getPlaceCoords (proxy): pas de coordonnées pour', placeId);
                return null;
            } catch (error) {
                console.error('getPlaceCoords (proxy): erreur', error);
                return null;
            }
        }
        
        // Mode SDK Google Maps (dev local)
        if (!this.geocoder) {
            console.warn("⚠️ Service Geocoder non initialisé. Tentative de chargement...");
            try {
                await this.loadGoogleMapsAPI();
            } catch (error) {
                console.error("❌ Impossible d'initialiser le service Geocoder:", error.message);
                return null;
            }
            if (!this.geocoder) {
                console.error("❌ Impossible d'initialiser le service Geocoder");
                return null;
            }
        }

        return new Promise((resolve, reject) => {
            this.geocoder.geocode({ placeId: placeId }, (results, status) => {
                if (status === 'OK' && results && results.length > 0) {
                    const loc = results[0].geometry && results[0].geometry.location;
                    if (loc && typeof loc.lat === 'function' && typeof loc.lng === 'function') {
                        resolve({ lat: loc.lat(), lng: loc.lng() });
                        return;
                    }
                    if (loc && loc.lat && loc.lng) {
                        resolve({ lat: loc.lat, lng: loc.lng });
                        return;
                    }
                }
                console.warn('getPlaceCoords: pas de résultat pour', placeId, status);
                resolve(null);
            });
        });
    }


    /**
     * V188: MÉTHODE SNCF CONNECT
     * ✅ V230: Support mode OTP (coordonnées directes)
     * - 2 appels API (maintenant + 20min) pour avoir ~5 horaires consécutifs
     * - Cache les résultats pour "Voir plus"
     * - Dédoublonne et trie par heure de départ
     */
    async fetchItinerary(fromPlaceId, toPlaceId, searchTime = null) {
        const startTime = performance.now();
        console.log(`🧠 V230 RECHERCHE ITINÉRAIRE (${this.backendMode}): ${typeof fromPlaceId === 'object' ? 'coords' : fromPlaceId} → ${typeof toPlaceId === 'object' ? 'coords' : toPlaceId}`);
        if (searchTime) {
            console.log(`⏰ Mode: ${searchTime.type || 'partir'}, Heure: ${searchTime.hour}:${searchTime.minute}`);
        }
        
        // ✅ V230: Gestion unifiée des coordonnées (OTP ou alias)
        let fromCoords = null;
        let toCoords = null;
        
        // Si les entrées sont déjà des objets avec coordonnées (mode OTP)
        if (typeof fromPlaceId === 'object' && fromPlaceId?.coordinates) {
            fromCoords = fromPlaceId.coordinates;
        } else if (typeof fromPlaceId === 'object' && fromPlaceId?.lat) {
            fromCoords = fromPlaceId;
        }
        
        if (typeof toPlaceId === 'object' && toPlaceId?.coordinates) {
            toCoords = toPlaceId.coordinates;
        } else if (typeof toPlaceId === 'object' && toPlaceId?.lat) {
            toCoords = toPlaceId;
        }
        
        // Convertir les alias en coordonnées
        const fromIsAlias = typeof fromPlaceId === 'string' && fromPlaceId.startsWith('ALIAS_');
        const toIsAlias = typeof toPlaceId === 'string' && toPlaceId.startsWith('ALIAS_');
        
        const aliasPromises = [];
        if (fromIsAlias) aliasPromises.push(this.getPlaceCoords(fromPlaceId).then(c => { fromCoords = c; }));
        if (toIsAlias) aliasPromises.push(this.getPlaceCoords(toPlaceId).then(c => { toCoords = c; }));
        if (aliasPromises.length) await Promise.all(aliasPromises);

        const results = {
            bus: null,
            bike: null,
            walk: null,
            recommendations: []
        };

        // ----------------------------------------
        // In-memory cache lookup (only for SAME query)
        // ----------------------------------------
        try {
            const norm = (v) => {
                const n = Number(v);
                return Number.isFinite(n) ? n.toFixed(5) : '';
            };
            const fromKey = fromCoords ? `${norm(fromCoords.lat)},${norm(fromCoords.lng ?? fromCoords.lon)}` : String(fromPlaceId || '');
            const toKey = toCoords ? `${norm(toCoords.lat)},${norm(toCoords.lng ?? toCoords.lon)}` : String(toPlaceId || '');
            const dateKey = searchTime?.date || 'today';
            const timeKey = (searchTime && searchTime.hour !== undefined)
                ? `${String(searchTime.hour).padStart(2, '0')}:${String(searchTime.minute || 0).padStart(2, '0')}`
                : 'now';
            const typeKey = searchTime?.type || 'partir';
            const backendKey = this.backendMode || 'unknown';
            const cacheKey = `${backendKey}|${typeKey}|${dateKey}|${timeKey}|${fromKey}|${toKey}`;

            const cached = this._itineraryCache.get(cacheKey);
            if (cached && (Date.now() - cached.fetchedAt) < this._itineraryCacheTtlMs) {
                console.log('⚡ Itinerary cache HIT:', { cacheKey });
                const cloned = (typeof structuredClone === 'function')
                    ? structuredClone(cached.data)
                    : JSON.parse(JSON.stringify(cached.data));
                return cloned;
            }

            // Store cacheKey for writeback later
            results._cacheKey = cacheKey;
        } catch (e) {
            // Cache is best-effort; never break routing
            console.debug('Itinerary cache: skipped (key build failed)', e);
        }

        // ========================================
        // V222: STRATÉGIE MINIMALE - 1 SEUL APPEL BUS
        // Google Routes avec computeAlternativeRoutes retourne 5-6 alternatives
        // 
        // - Mode "partir" : 1 appel = 5-6 trajets
        // - Mode "arriver" : 1 appel = 5-6 trajets
        // 
        // ÉCONOMIE : 10 appels → 3 appels = -70% de coût API
        // ========================================
        
        // V222: UN SEUL appel bus, que ce soit mode "partir" ou "arriver"
        // Google renvoie déjà 5-6 alternatives avec computeAlternativeRoutes: true
        const searchTimes = [searchTime];
        
        if (searchTime && searchTime.type === 'arriver') {
            console.log(`⏰ V222 Mode ARRIVER: 1 appel avec arrivalTime=${searchTime.hour}:${searchTime.minute}`);
        } else {
            console.log(`⏰ V222 Mode PARTIR: 1 appel avec departureTime=${searchTime?.hour || 'now'}:${searchTime?.minute || ''}`);
        }
        
        const [busResults, bikeResult, walkResult] = await Promise.allSettled([
            // V220: 3 appels bus en parallèle (au lieu de 8)
            Promise.allSettled(searchTimes.map(st => this._fetchBusRoute(fromPlaceId, toPlaceId, st, fromCoords, toCoords))),
            this.fetchBicycleRoute(fromPlaceId, toPlaceId, fromCoords, toCoords),
            this.fetchWalkingRoute(fromPlaceId, toPlaceId, fromCoords, toCoords)
        ]);

        // V217: Helper pour extraire l'heure de départ d'une route Google
        const extractDepartureTime = (route) => {
            // Essayer d'abord le chemin direct
            let depTime = route.legs?.[0]?.localizedValues?.departureTime?.time?.text;
            if (depTime) return depTime;
            
            // Sinon chercher dans les steps TRANSIT
            const transitStep = route.legs?.[0]?.steps?.find(s => s.travelMode === 'TRANSIT');
            if (transitStep?.transitDetails) {
                const transit = transitStep.transitDetails;
                depTime = transit.localizedValues?.departureTime?.time?.text;
                if (depTime) return depTime;
                
                // Fallback: stopDetails.departureTime
                const stopDep = transit.stopDetails?.departureTime;
                if (stopDep) {
                    // Format ISO -> HH:MM
                    const d = new Date(stopDep);
                    if (!isNaN(d.getTime())) {
                        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                    }
                }
            }
            return '';
        };

        // 1️⃣ Traitement BUS - Fusionner et dédupliquer
        if (busResults.status === 'fulfilled') {
            const allBusRoutes = [];
            const seenDepartures = new Set();
            
            for (const result of busResults.value) {
                if (result.status === 'fulfilled' && result.value?.routes?.length > 0) {
                    for (const route of result.value.routes) {
                        // V217: Utiliser le helper pour extraire l'heure
                        const depTime = extractDepartureTime(route);
                        const transitStep = route.legs?.[0]?.steps?.find(s => s.travelMode === 'TRANSIT');
                        const lineName = transitStep?.transitDetails?.transitLine?.nameShort || 
                                        transitStep?.transitDetails?.transitLine?.name || '';
                        
                        // V217: Clé unique = heure départ + ligne + arrêt départ (pour plus de précision)
                        const depStopName = transitStep?.transitDetails?.stopDetails?.departureStop?.name || '';
                        const uniqueKey = `${depTime}-${lineName}-${depStopName}`;
                        
                        if (!seenDepartures.has(uniqueKey)) {
                            seenDepartures.add(uniqueKey);
                            allBusRoutes.push(route);
                        }
                    }
                }
            }
            
            if (allBusRoutes.length > 0) {
                // V217: Trier par heure de départ en utilisant le helper
                allBusRoutes.sort((a, b) => {
                    const depA = extractDepartureTime(a) || '99:99';
                    const depB = extractDepartureTime(b) || '99:99';
                    return depA.localeCompare(depB);
                });
                
                // V218: Limiter à 8 trajets bus maximum
                const limitedBusRoutes = allBusRoutes.slice(0, 8);
                const busData = { routes: limitedBusRoutes, hasMore: allBusRoutes.length > 8 };
                
                // Calculs pour le "meilleur" trajet (pour le score)
                const bestRoute = allBusRoutes[0];
                const durationSeconds = parseInt(bestRoute.duration?.replace('s', '')) || 0;
                const durationMinutes = Math.round(durationSeconds / 60);
                const transitSteps = bestRoute.legs?.[0]?.steps?.filter(s => s.travelMode === 'TRANSIT') || [];
                const transferCount = Math.max(0, transitSteps.length - 1);
                
                results.bus = { data: busData, duration: durationMinutes, transfers: transferCount };
                console.log(`🚍 V218: ${limitedBusRoutes.length}/${allBusRoutes.length} trajets affichés (max 8)`);
                
                // V217: Log des heures pour vérification (avec le helper)
                const heures = limitedBusRoutes.map(r => extractDepartureTime(r)).filter(Boolean).join(', ');
                console.log(`📋 Horaires: ${heures}`);
                
                // Score simplifié
                results.recommendations.push({
                    mode: 'bus', score: 100, // Bus toujours prioritaire
                    reason: `${durationMinutes}min${transferCount ? ` (${transferCount} corresp.)` : ''}`
                });
            } else {
                console.warn("⚠️ Pas de bus disponible");
                results.recommendations.push({ mode: 'bus', score: 0, reason: 'Aucun bus disponible' });
            }
        } else {
            console.warn("⚠️ Erreur appels bus");
            results.recommendations.push({ mode: 'bus', score: 0, reason: 'Erreur recherche bus' });
        }

        // 2️⃣ Traitement VÉLO
        if (bikeResult.status === 'fulfilled' && bikeResult.value?.routes?.length > 0) {
            const route = bikeResult.value.routes[0];
            const durationMinutes = Math.round((parseInt(route.duration?.replace('s', '')) || 0) / 60);
            const distanceKm = (route.distanceMeters / 1000).toFixed(1);
            
            results.bike = { data: bikeResult.value, duration: durationMinutes, distance: distanceKm };
            console.log(`🚴 Vélo: ${durationMinutes}min, ${distanceKm}km`);
            
            let score = durationMinutes < 15 ? 100 : durationMinutes < 30 ? 90 : durationMinutes < 45 ? 70 : 40;
            results.recommendations.push({
                mode: 'bike', score,
                reason: `${durationMinutes}min (${distanceKm}km)`
            });
        }

        // 3️⃣ Traitement MARCHE
        if (walkResult.status === 'fulfilled' && walkResult.value?.routes?.length > 0) {
            const route = walkResult.value.routes[0];
            const durationMinutes = Math.round((parseInt(route.duration?.replace('s', '')) || 0) / 60);
            const distanceKm = (route.distanceMeters / 1000).toFixed(1);
            
            results.walk = { data: walkResult.value, duration: durationMinutes, distance: distanceKm };
            console.log(`🚶 Marche: ${durationMinutes}min, ${distanceKm}km`);
            
            let score = durationMinutes < 10 ? 95 : durationMinutes < 20 ? 85 : durationMinutes < 30 ? 65 : durationMinutes < 45 ? 40 : 20;
            results.recommendations.push({
                mode: 'walk', score,
                reason: `${durationMinutes}min (${distanceKm}km)`
            });
        }

        // 4️⃣ TRIER PAR SCORE ET RETOURNER
        results.recommendations.sort((a, b) => b.score - a.score);
        
        const elapsed = Math.round(performance.now() - startTime);
        const apiCallCount = searchTimes.length + 2; // 1 bus + 1 bike + 1 walk = 3
        console.log(`⚡ V222 Calcul terminé en ${elapsed}ms (${apiCallCount} appels API au lieu de 10)`);
        console.log(`💰 Économie API: ${Math.round((1 - apiCallCount/10) * 100)}%`);

        // Régénérer le token de session
        if (window.google?.maps?.places) {
            this.sessionToken = new google.maps.places.AutocompleteSessionToken();
        }

        // Writeback cache (best-effort)
        try {
            const cacheKey = results._cacheKey;
            if (cacheKey) {
                // Prevent unbounded growth
                if (this._itineraryCache.size >= this._itineraryCacheMaxEntries) {
                    const oldestKey = this._itineraryCache.keys().next().value;
                    if (oldestKey) this._itineraryCache.delete(oldestKey);
                }
                const stored = { ...results };
                delete stored._cacheKey;
                this._itineraryCache.set(cacheKey, { fetchedAt: Date.now(), data: stored });
                console.log('💾 Itinerary cache SET');
            }
        } catch (e) {
            console.debug('Itinerary cache: writeback failed', e);
        }

        delete results._cacheKey;
        return results;
    }

    /**
     * V187: Décale un searchTime de X minutes
     * @private
     */
    _offsetSearchTime(baseSearchTime, offsetMinutes) {
        if (!baseSearchTime) {
            const now = new Date();
            now.setMinutes(now.getMinutes() + offsetMinutes);
            return {
                type: 'partir',
                hour: now.getHours().toString().padStart(2, '0'),
                minute: now.getMinutes().toString().padStart(2, '0')
            };
        }
        
        // V203: Gestion complète de la date et du passage de minuit
        // On convertit tout en objet Date pour gérer correctement les changements de jour
        let dateObj;
        if (!baseSearchTime.date || baseSearchTime.date === 'today' || baseSearchTime.date === "Aujourd'hui") {
            dateObj = new Date();
        } else {
            dateObj = new Date(baseSearchTime.date);
        }
        
        // Définir l'heure de base
        dateObj.setHours(parseInt(baseSearchTime.hour) || 0);
        dateObj.setMinutes(parseInt(baseSearchTime.minute) || 0);
        dateObj.setSeconds(0);
        
        // Ajouter le décalage
        dateObj.setMinutes(dateObj.getMinutes() + offsetMinutes);
        
        // Reconstruire le searchTime avec la NOUVELLE date et heure
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const newDateStr = `${year}-${month}-${day}`;
        
        return {
            ...baseSearchTime,
            date: newDateStr, // Date mise à jour (peut avoir changé de jour)
            hour: dateObj.getHours().toString().padStart(2, '0'),
            minute: dateObj.getMinutes().toString().padStart(2, '0')
        };
    }

    /**
     * Méthode privée pour calculer uniquement le bus
     * ✅ V230: Support OTP backend
     * ✅ V178: Utilise le proxy Vercel pour masquer la clé API
     * ✅ V48: Gère les alias via coordonnées
     * @private
     */
    async _fetchBusRoute(fromPlaceId, toPlaceId, searchTime = null, fromCoords = null, toCoords = null) {
        // ✅ V230: Mode OTP - utiliser le serveur Express avec OTP
        if (this.useOtp) {
            return this._fetchBusRouteOtp(fromPlaceId, toPlaceId, searchTime, fromCoords, toCoords);
        }
        
        // ✅ V178: Utiliser le proxy Vercel
        const API_URL = this.useProxy 
            ? `${this.apiEndpoints.routes}?action=directions`
            : 'https://routes.googleapis.com/directions/v2:computeRoutes';

        // ✅ V48: Utiliser les coordonnées pour les alias, sinon placeId
        const origin = fromCoords 
            ? { location: { latLng: { latitude: fromCoords.lat, longitude: fromCoords.lng } } }
            : { placeId: fromPlaceId };
        const destination = toCoords
            ? { location: { latLng: { latitude: toCoords.lat, longitude: toCoords.lng } } }
            : { placeId: toPlaceId };

        const body = {
            origin,
            destination,
            travelMode: "TRANSIT",
            computeAlternativeRoutes: true,  // Demander plusieurs alternatives
            transitPreferences: {
                allowedTravelModes: ["BUS"],  // Uniquement bus (pas train, métro, tram)
                routingPreference: "FEWER_TRANSFERS"  // V63: Prioriser moins de correspondances
            },
            languageCode: "fr",
            units: "METRIC"
            // Note: requestedReferenceRoutes n'est PAS supporté pour TRANSIT
        };

        // Ajout du temps de départ/arrivée
        if (searchTime) {
            const dateTime = this._buildDateTime(searchTime);
            if (searchTime.type === 'arriver') {
                body.arrivalTime = dateTime;
                console.log(`🎯 V222 API arrivalTime: ${dateTime}`);
            } else {
                body.departureTime = dateTime;
            }
        }

        // ✅ V178: Headers différents selon mode proxy ou direct
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (!this.useProxy) {
            headers['X-Goog-Api-Key'] = this.apiKey;
            headers['X-Goog-FieldMask'] = 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs.steps';
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Erreur API Routes (bus):", errorText);
            
            if (response.status === 404 || errorText.includes("NOT_FOUND")) {
                throw new Error("Aucun bus disponible");
            }
            throw new Error(`Erreur API Routes: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.routes || data.routes.length === 0) {
            throw new Error("Aucun itinéraire en bus trouvé");
        }

        console.log(`✅ ${data.routes.length} itinéraire(s) bus trouvé(s)`);
        return data;
    }

    /**
     * ✅ V230: Méthode privée pour calculer les itinéraires bus via OTP
     * Appelle le serveur Express → OTP et convertit la réponse au format attendu
     * @private
     */
    async _fetchBusRouteOtp(fromPlaceId, toPlaceId, searchTime = null, fromCoords = null, toCoords = null) {
        console.log("🚍 Recherche itinéraire Oracle (RAPTOR)...");
        
        // Résoudre les coordonnées si nécessaire
        let originCoords = fromCoords;
        let destCoords = toCoords;
        
        if (!originCoords && fromPlaceId?.coordinates) {
            originCoords = fromPlaceId.coordinates;
        }
        if (!destCoords && toPlaceId?.coordinates) {
            destCoords = toPlaceId.coordinates;
        }
        
        if (!originCoords || !destCoords) {
            throw new Error("Coordonnées requises pour le mode OTP");
        }
        
        return this._fetchOtpRouteAsGoogleFormat({
            originCoords,
            destCoords,
            searchTime,
            otpMode: 'TRANSIT,WALK',
            maxWalkDistance: 1000,
            numItineraries: 3,
            errorLabel: 'bus',
        });
    }
    
    /**
     * ✅ V230: Convertit un itinéraire OTP (JSON direct) au format Google Routes
     * @private
     */
    _convertOtpItineraryToGoogleFormat(itinerary) {
        const legs = itinerary.legs || [];

        const totalDistanceMeters = legs.reduce((sum, leg) => sum + (leg.distance || 0), 0);
        const startTimeMs = itinerary.startTime || legs[0]?.startTime;
        const endTimeMs = itinerary.endTime || legs[legs.length - 1]?.endTime;
        const totalDurationSeconds = (startTimeMs && endTimeMs)
            ? Math.max(0, Math.round((endTimeMs - startTimeMs) / 1000))
            : Math.round((legs.reduce((sum, leg) => sum + (leg.duration || 0), 0)) || 0);
        
        const formatDistanceText = (meters) => {
            const m = Number(meters) || 0;
            if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
            if (m > 0) return `${Math.round(m)} m`;
            return '';
        };

        // Construire les steps à partir des legs OTP
        const steps = legs.map(leg => {
            const otpMode = (leg.mode || '').toUpperCase();
            const isTransitLeg = leg.transitLeg === true;
            const isTransit = isTransitLeg || ['BUS', 'TRAM', 'SUBWAY', 'RAIL', 'FERRY'].includes(otpMode);
            const isBicycle = otpMode === 'BICYCLE' || otpMode === 'BIKE';

            const legDurationSeconds = (() => {
                if (leg?.startTime && leg?.endTime) {
                    return Math.max(0, Math.round((leg.endTime - leg.startTime) / 1000));
                }
                // OTP renvoie souvent leg.duration en secondes
                const v = Number(leg?.duration);
                return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
            })();

            const routeShortName = leg.routeShortName || '';
            const routeLongName = leg.routeLongName || leg.route || '';
            const routeColor = '#' + (leg.routeColor || '3388ff');
            const routeTextColor = '#' + (leg.routeTextColor || 'FFFFFF');

            const distanceMeters = Number(leg?.distance) || 0;
            const distanceText = formatDistanceText(distanceMeters);
            const instructionText = isTransit
                ? ''
                : (isBicycle ? 'Vélo' : 'Marcher');
            
            return {
                travelMode: isTransit ? 'TRANSIT' : (isBicycle ? 'BICYCLE' : 'WALK'),
                distance: { meters: leg.distance || 0 },
                duration: { seconds: legDurationSeconds },
                // Champs attendus par nos parsers "Google-like"
                staticDuration: `${legDurationSeconds}s`,
                distanceMeters,
                localizedValues: {
                    distance: { text: distanceText },
                    instruction: instructionText,
                },
                navigationInstruction: isTransit ? undefined : {
                    instructions: instructionText,
                    maneuver: 'DEFAULT',
                },
                polyline: leg.legGeometry?.points ? { encodedPolyline: leg.legGeometry.points } : null,
                startLocation: { latLng: { latitude: leg.from.lat, longitude: leg.from.lon } },
                endLocation: { latLng: { latitude: leg.to.lat, longitude: leg.to.lon } },
                ...(isTransit && {
                    // Used by the UI to render the line badge/logo
                    routeShortName,
                    routeLongName,
                    routeColor,
                    routeTextColor,
                    headsign: leg.headsign || '',
                    routeId: leg.routeId || '',
                    tripId: leg.tripId || '',
                }),
                ...(isTransit && isTransitLeg && {
                    transitDetails: {
                        stopDetails: {
                            departureStop: { name: leg.from.name },
                            arrivalStop: { name: leg.to.name },
                            departureTime: new Date(leg.startTime).toISOString(),
                            arrivalTime: new Date(leg.endTime).toISOString(),
                            intermediateStops: Array.isArray(leg?.intermediateStops)
                                ? leg.intermediateStops.map(s => ({ name: s?.name || 'Arrêt' }))
                                : [],
                        },
                        localizedValues: {
                            departureTime: { time: { text: this._formatTimeFromMs(leg.startTime) } },
                            arrivalTime: { time: { text: this._formatTimeFromMs(leg.endTime) } }
                        },
                        transitLine: {
                            nameShort: routeShortName || 'BUS',
                            name: routeLongName || 'BUS',
                            color: routeColor,
                            textColor: routeTextColor,
                            vehicle: { type: 'BUS' }
                        },
                        headsign: leg.headsign || '',
                        stopCount: Array.isArray(leg?.intermediateStops)
                            ? Math.max(0, leg.intermediateStops.length)
                            : (Number.isFinite(leg?.stopCount) ? leg.stopCount : 0),
                    }
                })
            };
        });

        return {
            // Align with Google Routes API shapes used elsewhere in the app
            duration: `${totalDurationSeconds}s`,
            distanceMeters: totalDistanceMeters,
            legs: [{
                steps,
                startLocation: { latLng: { latitude: legs[0]?.from.lat, longitude: legs[0]?.from.lon } },
                endLocation: { latLng: { latitude: legs[legs.length - 1]?.to.lat, longitude: legs[legs.length - 1]?.to.lon } },
                distance: { meters: totalDistanceMeters },
                duration: { seconds: totalDurationSeconds }
            }],
            startAddress: legs[0]?.from.name || '',
            endAddress: legs[legs.length - 1]?.to.name || ''
        };
    }

    /**
     * ✅ V320: Itinéraire OTP générique (TRANSIT/WALK/BICYCLE) renvoyé au format Google Routes
     * - Utilise le backend Oracle (/api/routes) en mode OTP
     * - Permet de faire marche + vélo via OTP (min=1 / max=1)
     * - Fallback Google possible (endpoint /api/google-routes) si OTP échoue
     */
    async _fetchOtpRouteAsGoogleFormat({
        originCoords,
        destCoords,
        searchTime,
        otpMode,
        maxWalkDistance = 1000,
        numItineraries = 1,
        errorLabel = 'route',
    }) {
        if (!originCoords || !destCoords) {
            throw new Error('Coordonnées requises pour le mode OTP');
        }

        const body = {
            fromPlace: `${originCoords.lat},${originCoords.lng || originCoords.lon}`,
            toPlace: `${destCoords.lat},${destCoords.lng || destCoords.lon}`,
            mode: otpMode,
            maxWalkDistance,
            numItineraries,
        };

        if (searchTime) {
            const isoStr = this._buildDateTime(searchTime);
            const dateMatch = isoStr.match(/(\d{4})-(\d{2})-(\d{2})/);
            const timeMatch = isoStr.match(/T(\d{2}):(\d{2})/);
            if (dateMatch) body.date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
            if (timeMatch) body.time = `${timeMatch[1]}:${timeMatch[2]}`;
            body.arriveBy = searchTime.type === 'arriver';
        } else {
            // OTP legacy /plan nécessite toujours date + time.
            // Par défaut, on utilise l'heure locale courante (arriveBy=false).
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            body.date = `${yyyy}-${mm}-${dd}`;
            body.time = `${hh}:${min}`;
            body.arriveBy = false;
        }

        console.log('🕒 Oracle payload:', { mode: body.mode, date: body.date, time: body.time, arriveBy: body.arriveBy });

        let response;
        let data;
        try {
            response = await fetch(this.apiEndpoints.routes, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`❌ Erreur API OTP (${errorLabel}):`, errorData);
                throw new Error(errorData.error || errorData.details || `Erreur OTP: ${response.status}`);
            }

            data = await response.json();
        } catch (otpErr) {
            // ✅ Fallback: si OTP/Oracle est KO, tenter Google (proxy serveur) en dernier recours
            console.warn(`⚠️ OTP indisponible (${errorLabel}), tentative fallback Google...`, otpErr?.message || otpErr);
            const fallback = await this._tryEmergencyGoogleFallback({
                originCoords,
                destCoords,
                otpMode,
            });
            if (fallback) return fallback;
            throw otpErr;
        }

        if (data?.plan?.itineraries?.length > 0) {
            const itineraries = data.plan.itineraries.slice(0, Math.max(1, numItineraries));
            const routes = itineraries.map((itin) => this._convertOtpItineraryToGoogleFormat(itin));
            console.log(`✅ ${routes.length} itinéraire(s) OTP trouvé(s) (${errorLabel})`);
            return { routes };
        }

        throw new Error(`Aucun itinéraire trouvé (${errorLabel})`);
    }

    async _tryEmergencyGoogleFallback({ originCoords, destCoords, otpMode }) {
        // On ne fallback que si on a un proxy serveur disponible.
        const googleEndpoint = this.apiEndpoints?.googleRoutes || '/api/google-routes';
        if (!this.useProxy) return null;

        const travelMode = String(otpMode || '').toUpperCase().includes('BICYCLE')
            ? 'BICYCLE'
            : (String(otpMode || '').toUpperCase().includes('WALK') && !String(otpMode || '').toUpperCase().includes('TRANSIT'))
                ? 'WALK'
                : 'TRANSIT';

        const body = {
            origin: { location: { latLng: { latitude: originCoords.lat, longitude: originCoords.lng || originCoords.lon } } },
            destination: { location: { latLng: { latitude: destCoords.lat, longitude: destCoords.lng || destCoords.lon } } },
            travelMode,
            computeAlternativeRoutes: travelMode === 'TRANSIT',
            ...(travelMode === 'TRANSIT'
                ? {
                    transitPreferences: {
                        allowedTravelModes: ['BUS'],
                        routingPreference: 'FEWER_TRANSFERS',
                    },
                  }
                : {}),
            languageCode: 'fr',
            units: 'METRIC',
        };

        try {
            const resp = await fetch(googleEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!resp.ok) {
                const err = await resp.text().catch(() => '');
                console.warn('Fallback Google échoué:', resp.status, err);
                return null;
            }
            const data = await resp.json();
            if (!data?.routes?.length) return null;
            console.log('✅ Fallback Google OK:', travelMode, '- routes:', data.routes.length);
            return data;
        } catch (e) {
            console.warn('Fallback Google exception:', e?.message || e);
            return null;
        }
    }
    
    /**
     * ✅ V230: Formate un timestamp ms en HH:MM
     * @private
     */
    _formatTimeFromMs(timestampMs) {
        if (!timestampMs) return '';
        const d = new Date(timestampMs);
        if (isNaN(d.getTime())) return '';
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    /**
     * Construit un objet DateTime ISO 8601 pour l'API Google Routes
     * V142: Correction fuseau horaire - on envoie l'heure LOCALE avec offset timezone
     * @private
     */
    _buildDateTime(searchTime) {
        const { date, hour, minute } = searchTime;
        
        const toLocalDate = (value) => {
            if (!value || value === 'today' || value === "Aujourd'hui") {
                return new Date();
            }
            // Parse en local pour éviter le décalage d'un jour lié au fuseau
            const parts = String(value).split(/[-/]/).map(Number);
            if (parts.length >= 3 && parts.every(n => Number.isFinite(n))) {
                const [y, m, d] = parts;
                return new Date(y, m - 1, d);
            }
            return new Date(value);
        };

        let dateObj = toLocalDate(date);
        if (isNaN(dateObj.getTime())) {
            console.warn("⚠️ Date invalide, utilisation de la date actuelle");
            dateObj = new Date();
        }
        
        const hourInt = parseInt(hour) || 0;
        const minuteInt = parseInt(minute) || 0;
        dateObj.setHours(hourInt, minuteInt, 0, 0);
        
        // V142: Construire ISO string avec offset timezone local au lieu de UTC
        // Cela évite que 13:20 local devienne 12:20 UTC
        const tzOffset = -dateObj.getTimezoneOffset();
        const sign = tzOffset >= 0 ? '+' : '-';
        const offsetHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
        const offsetMinutes = String(Math.abs(tzOffset) % 60).padStart(2, '0');
        
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const seconds = String(dateObj.getSeconds()).padStart(2, '0');
        
        const isoWithTz = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMinutes}`;
        
        console.log("🕒 DateTime construit (local):", isoWithTz);
        return isoWithTz;
    }

    /**
     * Calcule un itinéraire à vélo
     * ✅ V178: Utilise le proxy Vercel pour masquer la clé API
     * ✅ V48: Gère les alias via coordonnées
     */
    async fetchBicycleRoute(fromPlaceId, toPlaceId, fromCoords = null, toCoords = null) {
        // ✅ V320: en mode OTP, vélo = OTP (min=1/max=1)
        if (this.useOtp) {
            console.log(`🚴 OTP (VÉLO): ${fromPlaceId} → ${toPlaceId}`);
            const originCoords = fromCoords || fromPlaceId?.coordinates || fromPlaceId;
            const destCoords = toCoords || toPlaceId?.coordinates || toPlaceId;
            return this._fetchOtpRouteAsGoogleFormat({
                originCoords,
                destCoords,
                searchTime: null,
                otpMode: 'BICYCLE',
                maxWalkDistance: 1000,
                numItineraries: 1,
                errorLabel: 'vélo',
            });
        }

        console.log(`🚴 API Google Routes (VÉLO): ${fromPlaceId} → ${toPlaceId}`);

        // ✅ V178: Utiliser le proxy Vercel
        const API_URL = this.useProxy 
            ? `${this.apiEndpoints.routes}?action=bicycle`
            : 'https://routes.googleapis.com/directions/v2:computeRoutes';

        // ✅ V48: Utiliser les coordonnées pour les alias, sinon placeId
        const origin = fromCoords 
            ? { location: { latLng: { latitude: fromCoords.lat, longitude: fromCoords.lng } } }
            : { placeId: fromPlaceId };
        const destination = toCoords
            ? { location: { latLng: { latitude: toCoords.lat, longitude: toCoords.lng } } }
            : { placeId: toPlaceId };

        const body = {
            origin,
            destination,
            travelMode: "BICYCLE",
            languageCode: "fr",
            units: "METRIC"
        };

        // ✅ V178: Headers différents selon mode proxy ou direct
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (!this.useProxy) {
            headers['X-Goog-Api-Key'] = this.apiKey;
            headers['X-Goog-FieldMask'] = 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs.steps';
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Erreur API Routes (vélo):", errorText);
            throw new Error(`Erreur vélo: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Itinéraire vélo calculé");
        return data;
    }
    
    /**
     * Calcule un itinéraire à pied
     * ✅ V178: Utilise le proxy Vercel pour masquer la clé API
     * ✅ V48: Gère les alias via coordonnées
     */
    async fetchWalkingRoute(fromPlaceId, toPlaceId, fromCoords = null, toCoords = null) {
        // ✅ V320: en mode OTP, marche = OTP (min=1/max=1)
        if (this.useOtp) {
            console.log(`🚶 OTP (MARCHE): ${fromPlaceId} → ${toPlaceId}`);
            const originCoords = fromCoords || fromPlaceId?.coordinates || fromPlaceId;
            const destCoords = toCoords || toPlaceId?.coordinates || toPlaceId;
            return this._fetchOtpRouteAsGoogleFormat({
                originCoords,
                destCoords,
                searchTime: null,
                otpMode: 'WALK',
                maxWalkDistance: 1000,
                numItineraries: 1,
                errorLabel: 'marche',
            });
        }

        console.log(`🚶 API Google Routes (MARCHE): ${fromPlaceId} → ${toPlaceId}`);

        // ✅ V178: Utiliser le proxy Vercel
        const API_URL = this.useProxy 
            ? `${this.apiEndpoints.routes}?action=walking`
            : 'https://routes.googleapis.com/directions/v2:computeRoutes';

        // ✅ V48: Utiliser les coordonnées pour les alias, sinon placeId
        const origin = fromCoords 
            ? { location: { latLng: { latitude: fromCoords.lat, longitude: fromCoords.lng } } }
            : { placeId: fromPlaceId };
        const destination = toCoords
            ? { location: { latLng: { latitude: toCoords.lat, longitude: toCoords.lng } } }
            : { placeId: toPlaceId };

        const body = {
            origin,
            destination,
            travelMode: "WALK",
            languageCode: "fr",
            units: "METRIC"
        };

        // ✅ V178: Headers différents selon mode proxy ou direct
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (!this.useProxy) {
            headers['X-Goog-Api-Key'] = this.apiKey;
            headers['X-Goog-FieldMask'] = 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs.steps';
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Erreur API Routes (marche):", errorText);
            throw new Error(`Erreur marche: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Itinéraire marche calculé");
        return data;
    }

    // Compatibilité ascendante (ancienne signature)
    async fetchWalkRoute(fromPlaceId, toPlaceId) {
        return this.fetchWalkingRoute(fromPlaceId, toPlaceId);
    }

    installGoogleAuthHook() {
        if (typeof window === 'undefined') {
            return;
        }
        if (window.__peribusGoogleAuthHookInstalled) {
            return;
        }
        window.__peribusGoogleAuthHookInstalled = true;
        const previousHandler = window.gm_authFailure;
        window.gm_authFailure = () => {
            try {
                window.dispatchEvent(new CustomEvent('peribus-google-auth-failure', {
                    detail: { origin: window.location?.origin }
                }));
            } catch (error) {
                console.warn('gm_authFailure dispatch error', error);
            }
            if (typeof previousHandler === 'function') {
                try {
                    previousHandler();
                } catch (error) {
                    console.warn('gm_authFailure previous handler failed', error);
                }
            }
        };
    }

    buildAuthFailureMessage(origin = this.clientOrigin) {
        const target = origin || this.clientOrigin || 'ce domaine';
        return `Google Maps API a refusé le referer ${target}. Ajoutez cette URL dans les restrictions HTTP de votre clé Google Cloud.`;
    }
}

