#!/usr/bin/env node
import { planItineraryNative } from '../server/services/nativeRouterService.js';

async function main() {
  const args = process.argv.slice(2);
  const from = args[0] || '45.180252,0.711794';
  const to = args[1] || '45.194759,0.666050';
  const timeRaw = args[2] || '2026-01-10T19:00:00+01:00';

  const [olat, olon] = from.split(',').map(Number);
  const [dlat, dlon] = to.split(',').map(Number);

  const time = new Date(timeRaw);
  console.log('Calling planItineraryNative for', from, '->', to, 'at', time.toISOString());

  const res = await planItineraryNative({
    origin: { lat: olat, lon: olon },
    destination: { lat: dlat, lon: dlon },
    time,
    mode: 'TRANSIT,WALK',
    maxWalkDistance: 2000,
    maxTransfers: 2,
    maxResults: 10,
  });

  console.log(JSON.stringify(res, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
