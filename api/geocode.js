/*
 * Copyright (c) 2025 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */
export default async function handler(req, res) {
    // CORS headers (optionnellement restreints via ALLOWED_ORIGINS)
    const origin = req.headers?.origin;
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    const originAllowed = !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin);

    res.setHeader('Vary', 'Origin');
    if (origin && originAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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

    const apiKey = process.env.GMAPS_SERVER_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'GMAPS_SERVER_KEY manquant sur le serveur.' });
        return;
    }

    const { lat, lon, lng } = req.query || {};
    const latitude = lat ?? req.query?.latitude;
    const longitude = lon ?? lng ?? req.query?.longitude;

    if (!latitude || !longitude) {
        res.status(400).json({ error: 'Paramètres lat et lng obligatoires.' });
        return;
    }

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${latitude},${longitude}`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('language', req.query?.language || 'fr');

    try {
        const upstream = await fetch(url.toString());
        const payload = await upstream.json();
        if (!upstream.ok) {
            res.status(upstream.status).json(payload);
            return;
        }
        res.status(200).json(payload);
    } catch (error) {
        res.status(502).json({ error: 'Geocode proxy error', details: error.message });
    }
}

