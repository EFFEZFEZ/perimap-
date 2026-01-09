/*
 * Copyright (c) 2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
/**
 * Proxy API pour Google Routes
 * Masque la clé API côté serveur (Vercel Edge Function)
 * 
 * Endpoints supportés:
 * - POST /api/routes?action=directions : Calcul d'itinéraire
 * - POST /api/routes?action=walking : Itinéraire piéton
 * - POST /api/routes?action=bicycle : Itinéraire vélo
 */

export default async function handler(req, res) {
    // CORS headers (optionnellement restreints via ALLOWED_ORIGINS)
    const normalizeOrigin = (value) => (typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '');
    const origin = normalizeOrigin(req.headers?.origin);
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(normalizeOrigin)
        .filter(Boolean);
    const originAllowed = !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin);

    res.setHeader('Vary', 'Origin');
    if (origin && originAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
        // Requête serveur-à-serveur (pas d'Origin)
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        if (origin && !originAllowed) {
            res.status(403).json({ error: 'Origin not allowed' });
            return;
        }
        res.status(200).end();
        return;
    }

    if (origin && !originAllowed) {
        res.status(403).json({ error: 'Origin not allowed' });
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
        return;
    }

    const apiKey = process.env.GMAPS_SERVER_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'GMAPS_SERVER_KEY manquant sur le serveur.' });
        return;
    }

    const { action } = req.query;
    
    if (!action || !['directions', 'walking', 'bicycle'].includes(action)) {
        res.status(400).json({ error: 'Paramètre action invalide. Valeurs: directions, walking, bicycle' });
        return;
    }

    const API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

    try {
        const body = req.body;

        if (!body || !body.origin || !body.destination) {
            res.status(400).json({ error: 'Corps de requête invalide: origin et destination requis.' });
            return;
        }

        // Définir le FieldMask selon le type de route
        let fieldMask = 'routes.duration,routes.distanceMeters,routes.polyline';
        
        if (action === 'directions') {
            // Pour le transit, on veut les étapes détaillées
            fieldMask = 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs.steps';
        } else {
            // Pour marche/vélo, on veut aussi la polyline des legs
            fieldMask = 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs.polyline';
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': fieldMask
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[routes proxy] Google API error:', data);
            res.status(response.status).json(data);
            return;
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('[routes proxy] Error:', error);
        res.status(502).json({ error: 'Routes proxy error', details: error.message });
    }
}


