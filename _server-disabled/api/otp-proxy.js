// Copyright © 2025 Périmap - Tous droits réservés
/**
 * api/otp-proxy.js
 * Proxy pour relayer les requêtes vers OpenTripPlanner v2
 */

import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

// OTP can be accessed at localhost when running on the same host,
// but via public URL when accessed externally (e.g. Vercel).
//
// Supported env vars:
// - OTP_URL: preferred. Either "http://host:8080" OR "http://host:8080/otp/routers/default"
// - OTP_BASE_URL: legacy alias (same accepted formats)
// - OTP_ROUTER: router id (default: "default")
const OTP_ROUTER = process.env.OTP_ROUTER || 'default';
const RAW_OTP_BASE = (process.env.OTP_URL || process.env.OTP_BASE_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');

function buildOtpUrl(endpointPath) {
  const path = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  // If env already points to "/otp/routers/<router>", append endpoint directly.
  if (RAW_OTP_BASE.includes('/otp/routers/')) {
    return `${RAW_OTP_BASE}${path}`;
  }
  return `${RAW_OTP_BASE}/otp/routers/${OTP_ROUTER}${path}`;
}

router.post('/', async (req, res) => {
  try {
    const { fromPlace, toPlace, date, time, mode = 'TRANSIT,WALK', maxWalkDistance = 1000, numItineraries = 3, arriveBy = false } = req.body || {};

    if (!fromPlace || !toPlace || !date || !time) {
      return res.status(400).json({ error: 'Paramètres manquants: fromPlace, toPlace, date, time' });
    }

    const [fromLat, fromLon] = String(fromPlace).split(',').map(Number);
    const [toLat, toLon] = String(toPlace).split(',').map(Number);

    if (isNaN(fromLat) || isNaN(fromLon) || isNaN(toLat) || isNaN(toLon)) {
      return res.status(400).json({ error: 'Coordonnées invalides' });
    }

    const otpUrl = new URL(buildOtpUrl('/plan'));
    otpUrl.searchParams.append('fromPlace', `${fromLat},${fromLon}`);
    otpUrl.searchParams.append('toPlace', `${toLat},${toLon}`);
    otpUrl.searchParams.append('date', date);
    otpUrl.searchParams.append('time', time);
    otpUrl.searchParams.append('mode', mode);
    otpUrl.searchParams.append('maxWalkDistance', maxWalkDistance);
    otpUrl.searchParams.append('numItineraries', numItineraries);
    otpUrl.searchParams.append('arriveBy', arriveBy ? 'true' : 'false');

    console.log(`[OTP] Appel: ${otpUrl.toString().substring(0, 100)}...`);

    const otpResponse = await fetch(otpUrl.toString(), { method: 'GET', timeout: 30000 });

    if (!otpResponse.ok) {
      console.error(`[OTP] Erreur: ${otpResponse.status}`);
      return res.status(otpResponse.status).json({ error: 'OTP non disponible', code: 'OTP_ERROR' });
    }

    const otpData = await otpResponse.json();
    const count = otpData?.plan?.itineraries?.length || 0;
    console.log(`[OTP] ✅ ${count} itinéraire(s)`);
    // Return raw OTP payload (plan.itineraries) — expected by the frontend OTP adapter.
    res.json(otpData);
  } catch (error) {
    console.error(`[OTP] ❌ ${error.message}`);
    res.status(500).json({ error: 'Impossible de contacter le planificateur', code: 'PROXY_ERROR', message: error.message });
  }
});

router.get('/places', async (req, res) => {
  try {
    const { q, lat, lon, limit = 10 } = req.query;
    if (!q) return res.json({ suggestions: [] });

    const otpUrl = new URL(buildOtpUrl('/autocomplete'));
    otpUrl.searchParams.append('input', q);
    if (lat && lon) {
      otpUrl.searchParams.append('lat', lat);
      otpUrl.searchParams.append('lon', lon);
    }
    otpUrl.searchParams.append('limit', limit);

    const otpResponse = await fetch(otpUrl.toString(), { method: 'GET', timeout: 10000 });
    if (!otpResponse.ok) return res.status(otpResponse.status).json({ suggestions: [] });

    const otpData = await otpResponse.json();
    const suggestions = (otpData.results || []).map(r => ({
      lat: r.lat, lon: r.lon, description: r.name || r.label || '', city: r.suburb || r.region || '', type: 'address', source: 'otp'
    }));

    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ error: 'Erreur du geocodeur', suggestions: [] });
  }
});

export default router;
