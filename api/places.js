/**
 * Proxy API pour Google Places Autocomplete
 * Masque la clé API côté serveur (Vercel Edge Function)
 * 
 * Endpoints supportés:
 * - GET /api/places?input=... : Autocomplétion
 * - GET /api/places?placeId=... : Récupérer les coordonnées d'un lieu
 */

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Méthode non autorisée. Utilisez GET.' });
        return;
    }

    const apiKey = process.env.GMAPS_SERVER_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'GMAPS_SERVER_KEY manquant sur le serveur.' });
        return;
    }

    const { input, placeId, sessionToken } = req.query;

    try {
        // Mode 1: Autocomplétion
        if (input) {
            const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
            url.searchParams.set('input', input);
            url.searchParams.set('key', apiKey);
            url.searchParams.set('language', 'fr');
            url.searchParams.set('components', 'country:fr');
            // Zone Grand Périgueux
            url.searchParams.set('location', '45.184029,0.7211149');
            url.searchParams.set('radius', '15000');
            url.searchParams.set('strictbounds', 'true');
            
            if (sessionToken) {
                url.searchParams.set('sessiontoken', sessionToken);
            }

            const response = await fetch(url.toString());
            const data = await response.json();

            if (!response.ok) {
                res.status(response.status).json(data);
                return;
            }

            // Transformer la réponse pour le frontend
            const predictions = (data.predictions || []).map(p => ({
                description: p.description,
                placeId: p.place_id
            }));

            res.status(200).json({ predictions });
            return;
        }

        // Mode 2: Geocoding (placeId -> coords)
        if (placeId) {
            const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
            url.searchParams.set('place_id', placeId);
            url.searchParams.set('key', apiKey);
            url.searchParams.set('language', 'fr');

            const response = await fetch(url.toString());
            const data = await response.json();

            if (!response.ok) {
                res.status(response.status).json(data);
                return;
            }

            if (data.results && data.results.length > 0) {
                const location = data.results[0].geometry?.location;
                if (location) {
                    res.status(200).json({ 
                        lat: location.lat, 
                        lng: location.lng,
                        formattedAddress: data.results[0].formatted_address
                    });
                    return;
                }
            }

            res.status(404).json({ error: 'Lieu non trouvé' });
            return;
        }

        res.status(400).json({ error: 'Paramètre input ou placeId requis.' });

    } catch (error) {
        console.error('[places proxy] Error:', error);
        res.status(502).json({ error: 'Places proxy error', details: error.message });
    }
}
