// Copyright © 2025 Périmap - Tous droits réservés
/**
 * api/otp-proxy.js
 * Proxy pour relayer les requêtes vers OpenTripPlanner v2
 */

import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();
const OTP_BASE_URL = 'http://localhost:8080';
const OTP_ROUTER = 'default';

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

    const otpUrl = new URL(`${OTP_BASE_URL}/otp/routers/${OTP_ROUTER}/plan`);
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
    const transformed = transformOtpResponse(otpData);

    console.log(`[OTP] ✅ ${transformed.itineraries?.length || 0} itinéraires`);
    res.json(transformed);
  } catch (error) {
    console.error(`[OTP] ❌ ${error.message}`);
    res.status(500).json({ error: 'Impossible de contacter le planificateur', code: 'PROXY_ERROR', message: error.message });
  }
});

router.get('/places', async (req, res) => {
  try {
    const { q, lat, lon, limit = 10 } = req.query;
    if (!q) return res.json({ suggestions: [] });

    const otpUrl = new URL(`${OTP_BASE_URL}/otp/routers/${OTP_ROUTER}/autocomplete`);
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

function transformOtpResponse(otpData) {
  if (!otpData || !otpData.plan || !otpData.plan.itineraries) {
    return { success: false, itineraries: [], error: 'Aucun itinéraire trouvé' };
  }

  const itineraries = otpData.plan.itineraries.map(itin => ({
    duration: itin.duration, startTime: itin.startTime, endTime: itin.endTime,
    legs: (itin.legs || []).map(leg => ({ startTime: leg.startTime, endTime: leg.endTime, distance: leg.distance, mode: leg.mode, from: leg.from, to: leg.to })),
    transferCount: (itin.legs || []).filter(l => l.transitLeg).length - 1
  }));

  return { success: true, itineraries, plan: { date: otpData.plan.date, from: otpData.plan.from, to: otpData.plan.to } };
}

export default router;
