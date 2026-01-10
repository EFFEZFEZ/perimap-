#!/usr/bin/env node
/**
 * Simule un appel de routage via le moteur natif (RAPTOR) et affiche un résumé.
 *
 * Exemples:
 *   node scripts/simulate-itinerary.mjs --from 45.1958,0.7192 --to 45.184391,0.71862 --time 2026-01-10T11:30:00+01:00
 *   node scripts/simulate-itinerary.mjs --from 45.1958,0.7192 --to 45.184391,0.71862 --maxWalk 2000 --maxTransfers 2
 */

import { planItineraryNative } from '../server/services/nativeRouterService.js';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function getArgValue(args, key) {
  const idx = args.indexOf(key);
  if (idx < 0) return null;
  if (idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function hasFlag(args, key) {
  return args.includes(key);
}

function parseLatLon(value) {
  if (!value) return null;
  const parts = String(value).split(',').map(s => s.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function toInt(value, defaultValue) {
  if (value === null || value === undefined) return defaultValue;
  const n = Number(value);
  if (!Number.isFinite(n)) return defaultValue;
  return Math.trunc(n);
}

function upper(value) {
  return String(value || '').toUpperCase();
}

function pick(obj, path) {
  // path: ['a','b','c']
  let cur = obj;
  for (const key of path) {
    if (!cur) return undefined;
    cur = cur[key];
  }
  return cur;
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function summarizeRoute(route) {
  const legs = Array.isArray(route?.legs) ? route.legs : [];

  let busLegs = 0;
  let walkLegs = 0;
  let transfers = 0;
  const lineParts = [];

  for (const leg of legs) {
    const mode = upper(leg?.mode);
    const isTransit = Boolean(leg?.transitLeg) || leg?.type === 'transit';

    if (isTransit) {
      busLegs += 1;
      const shortName = leg?.routeShortName || leg?.routeId || leg?.routeName || 'BUS';
      const fromName = pick(leg, ['from', 'name']) || '';
      const toName = pick(leg, ['to', 'name']) || '';
      lineParts.push(`${shortName}(${String(fromName).slice(0, 12)}→${String(toName).slice(0, 12)})`);
    } else if (mode === 'WALK' || leg?.type === 'walk') {
      walkLegs += 1;
    }
  }

  if (busLegs > 0) transfers = Math.max(0, busLegs - 1);

  const durationSec = typeof route?.duration === 'number' ? route.duration : 0;
  const durationMin = Math.round(durationSec / 60);

  const startTime = fmtTime(route?.startTime);
  const endTime = fmtTime(route?.endTime);

  const lastLeg = legs.length > 0 ? legs[legs.length - 1] : null;
  const lastWalkMeters = (lastLeg && upper(lastLeg?.mode) === 'WALK' && typeof lastLeg.distance === 'number')
    ? Math.round(lastLeg.distance)
    : null;

  return {
    durationMin,
    busLegs,
    walkLegs,
    transfers,
    startTime,
    endTime,
    lineParts,
    lastWalkMeters,
  };
}

async function main() {
  const args = process.argv.slice(2);

  const from = parseLatLon(getArgValue(args, '--from'));
  const to = parseLatLon(getArgValue(args, '--to'));
  if (!from) fail('Missing/invalid --from. Expected "lat,lon"');
  if (!to) fail('Missing/invalid --to. Expected "lat,lon"');

  const timeRaw = getArgValue(args, '--time');
  const time = timeRaw ? new Date(timeRaw) : new Date();
  if (Number.isNaN(time.getTime())) fail('Invalid --time. Expected ISO date, e.g. 2026-01-10T11:30:00+01:00');

  const maxWalkDistance = toInt(getArgValue(args, '--maxWalk'), 2000);
  const maxTransfers = toInt(getArgValue(args, '--maxTransfers'), 2);
  const maxResults = toInt(getArgValue(args, '--maxResults'), 5);

  const quiet = hasFlag(args, '--quiet');

  if (!quiet) {
    console.log('from', from);
    console.log('to  ', to);
    console.log('time', time.toISOString());
    console.log('opts', { maxWalkDistance, maxTransfers, maxResults });
    console.log('---');
  }

  const res = await planItineraryNative({
    origin: from,
    destination: to,
    time,
    mode: 'TRANSIT,WALK',
    maxWalkDistance,
    maxTransfers,
    maxResults,
  });

  const engine = res?.metadata?.engine || 'n/a';
  const routes = Array.isArray(res?.routes) ? res.routes : [];

  console.log('engine', engine, 'routes', routes.length);

  for (let i = 0; i < Math.min(maxResults, routes.length); i += 1) {
    const r = routes[i];
    const s = summarizeRoute(r);
    const lines = s.lineParts.join(' + ');

    const timePart = s.startTime && s.endTime ? `${s.startTime}→${s.endTime}` : '';
    console.log(
      `${i}. ${s.durationMin}min ${timePart} bus=${s.busLegs} transfers=${s.transfers} walkLegs=${s.walkLegs} ${lines}`
    );

    if (s.lastWalkMeters !== null) {
      console.log(`   lastWalkMeters=${s.lastWalkMeters}`);
    }
  }

  if (hasFlag(args, '--legs')) {
    console.log('--- legs (route 0) ---');
    const r0 = routes[0];
    const legs = Array.isArray(r0?.legs) ? r0.legs : [];
    for (const leg of legs) {
      const mode = upper(leg?.mode) || leg?.type;
      const fromName = pick(leg, ['from', 'name']) || '';
      const toName = pick(leg, ['to', 'name']) || '';
      const dist = typeof leg?.distance === 'number' ? Math.round(leg.distance) : null;
      const t0 = fmtTime(leg?.startTime || leg?.departureTime);
      const t1 = fmtTime(leg?.endTime || leg?.arrivalTime);
      const detail = leg?.routeShortName || leg?.routeId || '';
      const distPart = dist !== null ? ` ${dist}m` : '';
      const timePart = t0 && t1 ? ` ${t0}→${t1}` : '';
      console.log(`${mode}${timePart}${distPart} ${detail} ${String(fromName).slice(0, 28)} → ${String(toName).slice(0, 28)}`.trim());
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
