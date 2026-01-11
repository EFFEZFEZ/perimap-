// Copyright © 2025 Périmap - Tous droits réservés
/**
 * utils/gtfsLoader.js
 * Chargement intelligent des attributs GTFS (couleurs, noms)
 * 
 * ÉTAPE 1 : Gère les IDs préfixés d'OTP (ex: "GrandPerigueux:A" -> "A")
 * Algorithme de recherche "floue" en 3 étapes:
 * 1. Correspondance exacte
 * 2. Suppression du préfixe (après ":")
 * 3. Fallback gris si rien ne correspond
 */

import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { createLogger } from './logger.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger('gtfs-loader');

const routeAttributes = new Map();
let isLoaded = false;

// Distance Haversine en mètres entre deux coordonnées
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => deg * Math.PI / 180;
    const R = 6371000; // rayon terrestre en mètres
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function normalizeHexColor(input, fallback) {
    if (typeof input !== 'string') return fallback;
    let raw = input.trim();
    if (!raw) return fallback;

    // Supprime tous les # (on les rajoute à la fin)
    raw = raw.replace(/#/g, '').trim();
    if (!raw) return fallback;

    // Supporte RGB -> RRGGBB
    if (/^[0-9a-fA-F]{3}$/.test(raw)) {
        raw = raw.split('').map((c) => c + c).join('');
    }

    if (!/^[0-9a-fA-F]{6}$/.test(raw)) return fallback;
    return `#${raw.toUpperCase()}`;
}

/**
 * Charge les attributs (couleur, texte, nom court) depuis routes.txt au démarrage
 */
export async function loadRouteAttributes() {
    return new Promise((resolve, reject) => {
        // Chemin vers le fichier routes.txt
        // __dirname = server/utils/, donc on remonte de 2 niveaux pour atteindre public/
        // Chemin local: ../../public/data/gtfs/routes.txt
        // Chemin Docker: ../public/data/gtfs/routes.txt (si structure différente)
        const routesPath = path.join(__dirname, '../../public/data/gtfs/routes.txt');
        
        // Fallback Docker (si public est copié dans server/)
        const alternativePath = path.join(__dirname, '../public/data/gtfs/routes.txt');
        
        // Fallback supplémentaire
        const fallbackPath = path.join(__dirname, '../data/gtfs/routes.txt');
        
        let finalPath = routesPath;
        if (!fs.existsSync(routesPath)) {
            if (fs.existsSync(alternativePath)) {
                finalPath = alternativePath;
            } else if (fs.existsSync(fallbackPath)) {
                finalPath = fallbackPath;
            } else {
                logger.warn(`⚠️ Fichier routes.txt introuvable. Chemins testés: ${routesPath}, ${alternativePath}, ${fallbackPath}`);
                resolve(); // On résout quand même pour ne pas bloquer le serveur
                return;
            }
        }

        logger.info(`🎨 Chargement des couleurs depuis: ${finalPath}`);

        fs.createReadStream(finalPath)
            .pipe(csv())
            .on('data', (data) => {
                // Nettoyage et sécurisation des couleurs (évite '#', '##RRGGBB', valeurs non-hex)
                const color = normalizeHexColor(data.route_color, '#000000');
                const textColor = normalizeHexColor(data.route_text_color, '#FFFFFF');

                // On stocke l'ID exact
                routeAttributes.set(data.route_id, {
                    color: color,
                    textColor: textColor,
                    shortName: data.route_short_name || 'Bus',
                    longName: data.route_long_name || ''
                });
            })
            .on('end', () => {
                isLoaded = true;
                logger.info(`✅ ${routeAttributes.size} routes chargées en mémoire.`);
                resolve(routeAttributes);
            })
            .on('error', (err) => {
                logger.error('❌ Erreur lecture routes.txt:', err);
                reject(err);
            });
    });
}

/**
 * Trouve les infos d'une route avec une recherche "floue" (Fuzzy matching)
 * Gère les cas "GrandPerigueux:A" vs "A"
 * 
 * ÉTAPE 1 - Algorithme de matching:
 * 1. Essai Correspondance Exacte : "A" == "A"
 * 2. Essai Nettoyage de préfixe : "GrandPerigueux:A" -> "A"
 * 3. Essai Suffixe : "123_A" correspond à "A"
 * 4. Fallback : Gris #333333 + nom propre du routeId nettoyé
 */
export function getRouteAttributes(otpRouteId) {
    // Valeurs par défaut si le système n'est pas prêt ou ID vide
    const defaultAttrs = { 
        color: '#333333', 
        textColor: '#FFFFFF', 
        shortName: otpRouteId || 'Bus',
        longName: ''
    };
    
    if (!isLoaded || !otpRouteId) return defaultAttrs;

    // ÉTAPE 1: Essai Correspondance Exacte
    if (routeAttributes.has(otpRouteId)) {
        logger.debug(`[Route] Match exact: ${otpRouteId}`);
        return routeAttributes.get(otpRouteId);
    }

    // ÉTAPE 2: Essai Nettoyage de préfixe (ex: "GrandPerigueux:A" -> "A")
    // On prend tout ce qui est après le dernier ":"
    const parts = otpRouteId.split(':');
    const cleanId = parts[parts.length - 1]; // Prend le dernier élément

    if (routeAttributes.has(cleanId)) {
        logger.debug(`[Route] Match avec préfixe nettoyé: ${otpRouteId} -> ${cleanId}`);
        return routeAttributes.get(cleanId);
    }

    // ÉTAPE 3: Essai Suffixe (ex: ID "123_A" correspond à "A")
    for (const [storedId, attrs] of routeAttributes.entries()) {
        if (otpRouteId.endsWith(`:${storedId}`) || storedId === cleanId) {
            logger.debug(`[Route] Match suffixe: ${otpRouteId} -> ${storedId}`);
            return attrs;
        }
    }

    // Fallback : Si on a nettoyé l'ID, on renvoie au moins l'ID propre comme nom court
    logger.warn(`[Route] Pas de match pour ${otpRouteId}, utilisation du fallback gris`);
    return { 
        ...defaultAttrs, 
        shortName: cleanId 
    };
}

// Génère des transferts piétons bidirectionnels si absents (pour réparer un GTFS sans transfers.txt)
export function patchMissingTransfers(data, maxDistanceMeters = 200) {
    if (!data || !Array.isArray(data.stops)) {
        return data;
    }

    const hasTransfers = Array.isArray(data.transfers) && data.transfers.length > 0;
    if (hasTransfers) {
        return data;
    }

    const stops = data.stops;
    const transfers = [];

    for (let i = 0; i < stops.length; i++) {
        const from = stops[i];
        if (!from?.stop_id || typeof from.stop_lat !== 'number' || typeof from.stop_lon !== 'number') continue;

        for (let j = i + 1; j < stops.length; j++) {
            const to = stops[j];
            if (!to?.stop_id || typeof to.stop_lat !== 'number' || typeof to.stop_lon !== 'number') continue;

            const distance = haversineDistanceMeters(from.stop_lat, from.stop_lon, to.stop_lat, to.stop_lon);
            if (distance > maxDistanceMeters || distance === 0) continue;

            const minTransferTime = Math.round(distance / 1.1 + 60); // vitesse piéton ~1.1 m/s + 60s buffer

            transfers.push({
                from_stop_id: from.stop_id,
                to_stop_id: to.stop_id,
                transfer_type: 2,
                min_transfer_time: minTransferTime,
            });

            transfers.push({
                from_stop_id: to.stop_id,
                to_stop_id: from.stop_id,
                transfer_type: 2,
                min_transfer_time: minTransferTime,
            });
        }
    }

    data.transfers = transfers;
    console.log(`🧭 GTFS patch: ${transfers.length} transferts générés (rayon ${maxDistanceMeters}m)`);
    return data;
}

export default {
    loadRouteAttributes,
    getRouteAttributes,
    patchMissingTransfers,
    haversineDistanceMeters
};
