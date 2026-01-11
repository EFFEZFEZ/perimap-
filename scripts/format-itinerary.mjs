#!/usr/bin/env node
import { planItineraryNative } from '../server/services/nativeRouterService.js';

function parseIso(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d;
}

function fmtShort(d) {
  if (!d) return '';
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function diffSec(a, b) {
  return Math.round((a - b) / 1000);
}

async function main() {
  const args = process.argv.slice(2);
  const from = args[0] || '45.180252,0.711794';
  const to = args[1] || '45.194759,0.666050';
  const timeRaw = args[2] || '2026-01-10T19:00:00+01:00';

  const [olat, olon] = from.split(',').map(Number);
  const [dlat, dlon] = to.split(',').map(Number);
  const time = new Date(timeRaw);

  const res = await planItineraryNative({
    origin: { lat: olat, lon: olon },
    destination: { lat: dlat, lon: dlon },
    time,
    mode: 'TRANSIT,WALK',
    maxWalkDistance: 2000,
    maxTransfers: 2,
    maxResults: 10,
  });

  const routes = Array.isArray(res?.routes) ? res.routes : [];

  routes.forEach((route, idx) => {
    console.log(`\nItinéraire ${idx} — durée totale ${Math.round((route.arrivalTime && route.departureTime) ? (new Date(route.arrivalTime)-new Date(route.departureTime))/60000 : (route.duration||0)/60)} min`);

    // Collecter la chaîne de lignes (si correspondances)
    const transitLegs = route.legs.filter(l => l.transitLeg || l.type === 'transit');
    if (transitLegs.length > 0) {
      const chain = transitLegs.map(l => l.routeShortName || l.routeName || l.routeId || '').join(' - ');
      if (transitLegs.length > 1) console.log(`  Correspondance(s): ${chain}`);
    }

    // Parcourir les legs et afficher selon le format demandé
    // On veut pour chaque transit segment: heure de départ (usager) : arrêt : temps d'attente : heure du bus : temps trajet : heure d'arrivée : arrêt

    // Maintenir le moment courant (temps d'arrivée du leg précédent)
    let currentArrival = parseIso(route.departureTime) || parseIso(route.legs[0]?.departureTime) || new Date(time);

    for (const leg of route.legs) {
      const mode = (leg.mode || leg.type || '').toUpperCase();

      if (mode === 'WALK' || leg.type === 'walk') {
        // marche vers un arrêt ou vers destination
        currentArrival = parseIso(leg.arrivalTime) || parseIso(leg.endTime) || new Date(currentArrival.getTime() + (leg.duration||0)*1000);
        continue; // marche ne s'affiche pas comme transit
      }

      if (mode === 'WAIT') {
        // attente déjà représentée; update currentArrival
        currentArrival = parseIso(leg.arrivalTime) || new Date(currentArrival.getTime() + (leg.duration||0)*1000);
        continue;
      }

      if (leg.transitLeg || mode === 'BUS' || mode === 'TRAM' || mode === 'RAIL') {
        const boardStop = leg.from?.name || leg.from?.stopId || 'unknown';
        const alightStop = leg.to?.name || leg.to?.stopId || 'unknown';
        const busDepart = parseIso(leg.departureTime) || parseIso(leg.startTime);
        const busArrive = parseIso(leg.arrivalTime) || parseIso(leg.endTime);

        const waitSec = busDepart && currentArrival ? diffSec(busDepart, currentArrival) : null;
        const transitSec = busArrive && busDepart ? diffSec(busArrive, busDepart) : (leg.duration || null);

        const userDepartShort = fmtShort(currentArrival);
        const busDepartShort = fmtShort(busDepart);
        const busArriveShort = fmtShort(busArrive);

        console.log(`  Départ: ${userDepartShort}  Arrêt: ${boardStop}  Attente: ${waitSec !== null ? waitSec + 's' : 'n/a'}  Bus départ: ${busDepartShort}  Temps bus: ${transitSec !== null ? transitSec + 's' : 'n/a'}  Arrivée: ${busArriveShort}  Arrêt: ${alightStop}`);

        // mettre à jour currentArrival au moment d'arrivée du bus
        currentArrival = busArrive || (new Date(currentArrival.getTime() + (transitSec||0)*1000));
      }
    }
  });
}

main().catch(err => { console.error(err); process.exit(1); });
