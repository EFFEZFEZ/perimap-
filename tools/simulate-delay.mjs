#!/usr/bin/env node
// Simulate sending a delay to /api/record-delay
// Usage:
//   node tools/simulate-delay.mjs --line A --stop "Gare" --scheduled "2026-01-13T12:00:00" --delay 3

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i+1] && !argv[i+1].startsWith('--') ? argv[++i] : 'true';
      args[key] = val;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const payload = {
    line: args.line || 'A',
    stop: args.stop || 'Gare',
    scheduled: args.scheduled || new Date().toISOString(),
    delay: Number(args.delay || 2)
  };

  // Try direct POST to local dev server first
  const ports = [5173, 3000, 8080];
  for (const port of ports) {
    const url = `http://localhost:${port}/api/record-delay`;
    try {
      console.log(`Attempting POST to ${url} with payload:`, payload);
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 5000
      });
      const text = await r.text();
      console.log(`Response ${r.status}:`, text);
      return;
    } catch (err) {
      // ignore and try next
    }
  }

  // If no local server responded, simulate the API handler without DB
  console.log('No local API reachable — simulating handler without DB.');
  console.log('Simulated SQL:');
  console.log('INSERT INTO delay_stats (line_name, stop_name, scheduled_time, delay_minutes)');
  console.log('VALUES', JSON.stringify([payload.line, payload.stop, payload.scheduled, payload.delay]));
  console.log('-- Simulation complete: would return HTTP 200 { saved: true }');
}

main().catch(err => {
  console.error('Error in simulation:', err);
  process.exit(1);
});
