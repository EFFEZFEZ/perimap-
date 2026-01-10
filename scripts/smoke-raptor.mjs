import { planItineraryNative } from '../server/services/nativeRouterService.js';

function fmtSeconds(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}min`;
}

function fmtCoord(c) {
  return `${c.lat.toFixed(5)},${c.lon.toFixed(5)}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function summarizeRoute(route) {
  const legs = Array.isArray(route.legs) ? route.legs : [];
  const busLegs = legs.filter(l => l && (l.transitLeg === true || String(l.mode || '').toUpperCase() === 'BUS'));
  const walkLegs = legs.filter(l => l && String(l.mode || '').toUpperCase() === 'WALK');

  const lineSummary = busLegs
    .map(l => `${l.routeShortName || l.routeId || 'BUS'}(${(l.from?.name || '').slice(0, 16)}→${(l.to?.name || '').slice(0, 16)})`)
    .join(' + ');

  return {
    duration: fmtSeconds(route.duration),
    transfers: route.transfers ?? Math.max(0, busLegs.length - 1),
    busLegs: busLegs.length,
    walkLegs: walkLegs.length,
    lineSummary,
  };
}

async function runCase({ name, origin, destination, whenIso, mode = 'TRANSIT,WALK', maxWalkDistance = 3000 }) {
  const when = new Date(whenIso);
  assert(!Number.isNaN(when.getTime()), `Invalid whenIso: ${whenIso}`);

  console.log('\n===', name, '===');
  console.log('from:', fmtCoord(origin), 'to:', fmtCoord(destination), 'at:', when.toISOString(), 'mode:', mode, 'maxWalkDistance:', maxWalkDistance);

  const result = await planItineraryNative({ origin, destination, time: when, mode, maxWalkDistance, maxTransfers: 2 });
  const routes = Array.isArray(result?.routes) ? result.routes : [];

  console.log('routes:', routes.length, 'engine:', result?.metadata?.engine || 'n/a');
  if (!routes.length) {
    console.log('NO_ROUTE_FOUND:', result?.metadata?.message || '');
    return;
  }

  // Basic validity checks
  for (const [idx, r] of routes.entries()) {
    assert(Number.isFinite(Number(r.duration)), `route[${idx}] duration missing`);
    assert(Array.isArray(r.legs), `route[${idx}] legs missing`);
  }

  const top = routes.slice(0, 3).map((r, i) => ({ i, ...summarizeRoute(r) }));
  console.table(top);

  // Deep-check first route for colors/geometry presence on transit legs
  const first = routes[0];
  const transitLegs = (first.legs || []).filter(l => l && l.transitLeg);
  if (transitLegs.length) {
    const badColors = transitLegs.filter(l => {
      const c = String(l.routeColor || '');
      const tc = String(l.routeTextColor || '');
      return (c.includes('##') || tc.includes('##'));
    });
    assert(badColors.length === 0, 'Some transit legs have invalid ## colors');
  }
}

async function main() {
  const cases = [
    {
      name: 'Trelissac -> Marsac (TRANSIT,WALK)',
      origin: { lat: 45.195372, lon: 0.7808015 },
      destination: { lat: 45.1858333, lon: 0.6619444 },
      whenIso: '2026-01-10T17:50:00+01:00',
      mode: 'TRANSIT,WALK',
      maxWalkDistance: 3000,
    },
    {
      name: 'Perigueux centre -> Campus (TRANSIT,WALK)',
      origin: { lat: 45.184029, lon: 0.7211149 },
      destination: { lat: 45.1958, lon: 0.7192 },
      whenIso: '2026-01-10T11:00:00+01:00',
      mode: 'TRANSIT,WALK',
      maxWalkDistance: 2000,
    },
    {
      name: 'Campus -> Perigueux centre (TRANSIT,WALK)',
      origin: { lat: 45.1958, lon: 0.7192 },
      destination: { lat: 45.184029, lon: 0.7211149 },
      whenIso: '2026-01-10T11:30:00+01:00',
      mode: 'TRANSIT,WALK',
      maxWalkDistance: 2000,
    },
  ];

  for (const c of cases) {
    // eslint-disable-next-line no-await-in-loop
    await runCase(c);
  }
}

main().catch((err) => {
  console.error('\nSMOKE FAILED:', err?.stack || err);
  process.exitCode = 1;
});
