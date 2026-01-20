import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();
const publicDir = path.join(workspaceRoot, 'public');
const pdfDir = path.join(publicDir, 'data', 'fichehoraire');
const templatePath = path.join(publicDir, 'horaires-ligne-a.html');
const gtfsDir = path.join(publicDir, 'data', 'gtfs');
const routesPath = path.join(gtfsDir, 'routes.txt');
const tripsPath = path.join(gtfsDir, 'trips.txt');
const stopsPath = path.join(gtfsDir, 'stops.txt');
const stopTimesPath = path.join(gtfsDir, 'stop_times.txt');
const shapesPath = path.join(gtfsDir, 'shapes.txt');
const horairesHubPath = path.join(publicDir, 'horaires.html');

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function normalizeLineCode(raw) {
  return String(raw).trim();
}

function slugFor(code) {
  return normalizeLineCode(code).toLowerCase();
}

function colorFor(code) {
  const c = normalizeLineCode(code).toUpperCase();
  const gtfsColor = routeMetaByLine.get(c)?.color;
  if (gtfsColor) return gtfsColor;
  if (c === 'A') return '#fdd003';
  if (c === 'B') return '#1e91ff';
  if (c === 'C') return '#dd1b75';
  if (c === 'D') return '#41ae18';
  if (/^E\d+/i.test(c)) return '#e67e22';
  if (/^K/i.test(c)) return '#9b59b6';
  if (/^N/i.test(c)) return '#2c3e50';
  if (/^R/i.test(c)) return '#e74c3c';
  return '#22c55e';
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function loadRouteMetaByLine() {
  if (!exists(routesPath)) return new Map();
  const lines = fs.readFileSync(routesPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idxRouteId = header.indexOf('route_id');
  const idxShort = header.indexOf('route_short_name');
  const idxColor = header.indexOf('route_color');
  const idxText = header.indexOf('route_text_color');
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const routeId = row[idxRouteId];
    const shortNameRaw = row[idxShort];
    if (!routeId || !shortNameRaw) continue;
    const shortName = normalizeLineCode(shortNameRaw).toUpperCase();
    const color = row[idxColor] ? `#${row[idxColor].trim()}` : '';
    const textColor = row[idxText] ? `#${row[idxText].trim()}` : '';
    map.set(shortName, { routeId, color, textColor });
  }
  return map;
}

function loadTripsByRoute() {
  if (!exists(tripsPath)) return new Map();
  const lines = fs.readFileSync(tripsPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idxRouteId = header.indexOf('route_id');
  const idxTripId = header.indexOf('trip_id');
  const idxHeadsign = header.indexOf('trip_headsign');
  const idxDirection = header.indexOf('direction_id');
  const idxShape = header.indexOf('shape_id');
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const routeId = row[idxRouteId];
    const tripId = row[idxTripId];
    if (!routeId || !tripId) continue;
    const trip = {
      tripId,
      headsign: normalizeHeadsign(row[idxHeadsign]),
      directionId: row[idxDirection] === '' ? null : Number(row[idxDirection]),
      shapeId: row[idxShape]
    };
    if (!map.has(routeId)) map.set(routeId, []);
    map.get(routeId).push(trip);
  }
  return map;
}

function loadStopsById() {
  if (!exists(stopsPath)) return new Map();
  const lines = fs.readFileSync(stopsPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idxId = header.indexOf('stop_id');
  const idxName = header.indexOf('stop_name');
  const idxCode = header.indexOf('stop_code');
  const idxLat = header.indexOf('stop_lat');
  const idxLon = header.indexOf('stop_lon');
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const stopId = row[idxId];
    if (!stopId) continue;
    const name = row[idxName];
    const stopCode = idxCode === -1 ? '' : row[idxCode];
    const lat = parseFloat(row[idxLat]);
    const lon = parseFloat(row[idxLon]);
    if (!name || Number.isNaN(lat) || Number.isNaN(lon)) continue;
    map.set(stopId, { name, lat, lon, stopId, stop_id: stopId, stopCode, stop_code: stopCode });
  }
  return map;
}

function loadStopTimesByTrip() {
  if (!exists(stopTimesPath)) return new Map();
  const lines = fs.readFileSync(stopTimesPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idxTrip = header.indexOf('trip_id');
  const idxStop = header.indexOf('stop_id');
  const idxSeq = header.indexOf('stop_sequence');
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const tripId = row[idxTrip];
    const stopId = row[idxStop];
    const seq = Number(row[idxSeq]);
    if (!tripId || !stopId || Number.isNaN(seq)) continue;
    if (!map.has(tripId)) map.set(tripId, []);
    map.get(tripId).push({ stopId, seq });
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.seq - b.seq);
  }
  return map;
}

function loadShapesById() {
  if (!exists(shapesPath)) return new Map();
  const lines = fs.readFileSync(shapesPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idxId = header.indexOf('shape_id');
  const idxLat = header.indexOf('shape_pt_lat');
  const idxLon = header.indexOf('shape_pt_lon');
  const idxSeq = header.indexOf('shape_pt_sequence');
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const shapeId = row[idxId];
    const lat = parseFloat(row[idxLat]);
    const lon = parseFloat(row[idxLon]);
    const seq = Number(row[idxSeq]);
    if (!shapeId || Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(seq)) continue;
    if (!map.has(shapeId)) map.set(shapeId, []);
    map.get(shapeId).push({ lat, lon, seq });
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.seq - b.seq);
  }
  return map;
}

const routeMetaByLine = loadRouteMetaByLine();
const tripsByRoute = loadTripsByRoute();
const stopsById = loadStopsById();
const stopTimesByTrip = loadStopTimesByTrip();
const shapesById = loadShapesById();

function loadRouteIdToShortName() {
  if (!exists(routesPath)) return new Map();
  const lines = fs.readFileSync(routesPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idxRouteId = header.indexOf('route_id');
  const idxShort = header.indexOf('route_short_name');
  if (idxRouteId === -1 || idxShort === -1) return new Map();
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const routeId = row[idxRouteId];
    const shortName = row[idxShort];
    if (!routeId || !shortName) continue;
    map.set(routeId, String(shortName).trim());
  }
  return map;
}

function normalizeHeadsign(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function loadHeadsignsByLine() {
  if (!exists(tripsPath)) return new Map();
  const routeIdToShort = loadRouteIdToShortName();
  if (routeIdToShort.size === 0) return new Map();

  const lines = fs.readFileSync(tripsPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idxRouteId = header.indexOf('route_id');
  const idxHeadsign = header.indexOf('trip_headsign');
  if (idxRouteId === -1 || idxHeadsign === -1) return new Map();

  const countsByLine = new Map();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const routeId = row[idxRouteId];
    const headsignRaw = row[idxHeadsign];
    if (!routeId) continue;
    const short = routeIdToShort.get(routeId);
    if (!short) continue;
    const lineCode = normalizeLineCode(short).toUpperCase();
    const headsign = normalizeHeadsign(headsignRaw);
    if (!headsign) continue;
    if (!countsByLine.has(lineCode)) countsByLine.set(lineCode, new Map());
    const lineMap = countsByLine.get(lineCode);
    lineMap.set(headsign, (lineMap.get(headsign) || 0) + 1);
  }
  return countsByLine;
}

const headsignsByLine = loadHeadsignsByLine();

function textColorFor(bgHex) {
  const hex = bgHex.replace('#', '');
  if (hex.length !== 6) return '#fff';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? '#000' : '#fff';
}

function extractLineCodesFromPdf(filename) {
  const codes = [];

  const isValidLineCode = (code) => {
    const c = String(code).trim();
    return /^(?:[ABCD]|e\d+|k\d+[A-Za-z]?|n\d*|r\d+)$/i.test(c);
  };

  // Primary rule: filenames containing "ligne_..."
  // Examples:
  // - grandperigueux_fiche_horaires_ligne_K5_sept_2025.pdf
  // - grandperigueux_fiche_horaires_ligne_R10_R11_sept_2025.pdf
  const match = filename.match(/ligne_([A-Za-z0-9_]+)(?:_|\.|$)/);
  if (match) {
    const raw = match[1];
    // If multiple codes are packed (R10_R11), split
    for (const part of raw.split('_')) {
      if (!part) continue;
      const code = normalizeLineCode(part);
      if (!isValidLineCode(code)) continue;
      codes.push(code);
    }
  }

  // Secondary rule: special PDFs that encode a line but not using "ligne_" (ex: grandperigueux_K1A_12_janv_26.pdf)
  // We only accept K* to avoid accidental captures.
  const kMatch = filename.match(/(?:^|_)K(\d+[A-Za-z]?)_/i);
  if (kMatch) {
    const code = `K${kMatch[1]}`;
    if (isValidLineCode(code)) codes.push(code);
  }

  // Deduplicate while preserving order
  return [...new Set(codes)];
}

function inferRouteText(_code, _pdfFilename) {
  const lineCode = normalizeLineCode(_code).toUpperCase();
  const headsigns = headsignsByLine.get(lineCode);
  if (headsigns && headsigns.size > 0) {
    const ordered = [...headsigns.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
    if (ordered.length >= 2) {
      return `${ordered[0]} ↔ ${ordered[1]}`;
    }
    return ordered[0];
  }
  return 'Consultez la fiche horaire PDF pour les terminus.';
}

function getLineData(lineCode) {
  const code = normalizeLineCode(lineCode).toUpperCase();
  const routeMeta = routeMetaByLine.get(code);
  const routeId = routeMeta?.routeId;
  if (!routeId) return null;

  const trips = tripsByRoute.get(routeId) || [];
  if (trips.length === 0) return null;

  const pickTrip = (directionId) => {
    const candidates = trips.filter(t => t.directionId === directionId);
    const list = candidates.length ? candidates : trips;
    let best = null;
    let bestCount = -1;
    for (const t of list) {
      const stops = stopTimesByTrip.get(t.tripId) || [];
      if (stops.length > bestCount) {
        bestCount = stops.length;
        best = t;
      }
    }
    return best;
  };

  const trip = pickTrip(0) || pickTrip(1) || trips[0];
  const stopTimes = stopTimesByTrip.get(trip.tripId) || [];
  const stops = stopTimes
    .map(entry => stopsById.get(entry.stopId))
    .filter(Boolean)
    .map(stop => ({
      name: stop.name,
      lat: stop.lat,
      lon: stop.lon,
      stop_id: stop.stop_id || stop.stopId,
      stop_code: stop.stop_code || stop.stopCode || ''
    }));

  const terminusA = stops[0]?.name || '';
  const terminusB = stops[stops.length - 1]?.name || '';

  let shape = [];
  if (trip.shapeId && shapesById.has(trip.shapeId)) {
    shape = shapesById.get(trip.shapeId).map(pt => [pt.lat, pt.lon]);
  }
  if (shape.length === 0 && stops.length > 1) {
    shape = stops.map(stop => [stop.lat, stop.lon]);
  }

  const mainStops = [];
  if (stops.length > 0) {
    mainStops.push(stops[0].name);
    if (stops.length > 2) mainStops.push(stops[Math.floor(stops.length / 2)].name);
    if (stops.length > 1) mainStops.push(stops[stops.length - 1].name);
  }

  return {
    routeId,
    color: routeMeta?.color,
    textColor: routeMeta?.textColor,
    stops,
    shape,
    terminusA,
    terminusB,
    mainStops: [...new Set(mainStops)].filter(Boolean)
  };
}

function replaceOnce(haystack, needle, replacement) {
  const idx = haystack.indexOf(needle);
  if (idx === -1) return haystack;
  return haystack.slice(0, idx) + replacement + haystack.slice(idx + needle.length);
}

function updateBetweenTags(html, tagOpenRegex, tagClose, newInner) {
  const openMatch = html.match(tagOpenRegex);
  if (!openMatch) return html;
  const start = openMatch.index + openMatch[0].length;
  const end = html.indexOf(tagClose, start);
  if (end === -1) return html;
  return html.slice(0, start) + newInner + html.slice(end);
}

function generatePage({ template, lineCode, pdfFilename }) {
  const slug = slugFor(lineCode);
  const display = normalizeLineCode(lineCode).toUpperCase();
  const lineData = getLineData(display);
  const color = colorFor(display);
  const textColor = lineData?.textColor || textColorFor(color);
  const title = `PériMap — Horaires ligne ${display} Péribus Grand Périgueux`;
  const description = `Consultez les horaires et l'itinéraire de la ligne ${display} du réseau Péribus. Accédez aux prochains passages en temps réel et téléchargez la fiche horaire PDF.`;
  const routeText = inferRouteText(display, pdfFilename);
  const keywords = `ligne ${display} péribus, horaires ligne ${display}, bus ligne ${display} périgueux, arrêts ligne ${display}, péribus ${display}, grand périgueux, horaires péribus`;
  const ogDescription = `Horaires ligne ${display} Péribus : prochains passages et fiche PDF. ${routeText} (itinéraire indicatif).`;
  const twitterDescription = `Prochains passages et fiche PDF — ligne ${display} Péribus (Grand Périgueux).`;
  const busTripDescription = `Horaires et itinéraire de la ligne ${display} Péribus (Grand Périgueux).`;
  const mapHref = `/#carte?ligne=${display}`;

  let html = template;

  // Cosmetic: avoid leaving "ligne A" in comments on generated pages
  html = html.replace(/SEO Principal - Ligne A/gi, `SEO Principal - Ligne ${display}`);
  html = html.replace(/Tracé GTFS réel de la ligne A\s*\([^)]*\)/gi, `Tracé GTFS (données ${display})`);
  html = html.replace(/Tous les arrêts GTFS de la ligne A/gi, `Tous les arrêts GTFS de la ligne ${display}`);

  // <title>
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);

  // meta description
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*>/i,
    `<meta name="description" content="${description}">`
  );

  // meta keywords
  html = html.replace(
    /<meta\s+name="keywords"\s+content="[^"]*"\s*>/i,
    `<meta name="keywords" content="${keywords}">`
  );

  // canonical + og:url
  const canonical = `https://www.xn--primap-bva.fr/horaires-ligne-${slug}.html`;
  html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*>/i, `<link rel="canonical" href="${canonical}">`);
  html = html.replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*>/i, `<meta property="og:url" content="${canonical}">`);

  // og:title / twitter:title
  html = html.replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*>/i, `<meta property="og:title" content="${title}">`);
  html = html.replace(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*>/i, `<meta name="twitter:title" content="${title}">`);

  // og:description / twitter:description
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*>/i,
    `<meta property="og:description" content="${ogDescription}">`
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*>/i,
    `<meta name="twitter:description" content="${twitterDescription}">`
  );

  // h1
  html = html.replace(/<h1>\s*Ligne\s+[A-Za-z0-9]+\s*<\/h1>/i, `<h1>Ligne ${display}</h1>`);

  // route/direction text (template uses .line-direction)
  html = html.replace(/<div class="line-direction">[^<]*<\/div>/i, `<div class="line-direction">${routeText}</div>`);

  // badge
  html = html.replace(
    /<div class="line-badge">\s*[^<]*\s*<\/div>/i,
    `<div class="line-badge">${display}</div>`
  );

  // Update CSS theme color variables
  html = html.replace(/--line-color:\s*#[0-9a-fA-F]{6};/i, `--line-color: ${color};`);
  html = html.replace(/--line-text:\s*#[0-9a-fA-F]{6};/i, `--line-text: ${textColor};`);

  // PDF link (download button)
  html = html.replace(
    /<a href="\/data\/fichehoraire\/[^"]+" class="action-btn" target="_blank">/i,
    `<a href="/data/fichehoraire/${pdfFilename}" class="action-btn" target="_blank">`
  );

  // Map action link
  html = html.replace(/href="\/#carte\?ligne=[A-Za-z0-9]+"/i, `href="${mapHref}"`);

  // Nav: remove active highlight (these pages are outside A-D)
  html = html.replace(/class="nav-line-btn line-a active"/g, 'class="nav-line-btn line-a"');
  html = html.replace(/class="nav-line-btn line-b active"/g, 'class="nav-line-btn line-b"');
  html = html.replace(/class="nav-line-btn line-c active"/g, 'class="nav-line-btn line-c"');
  html = html.replace(/class="nav-line-btn line-d active"/g, 'class="nav-line-btn line-d"');

  // JS: inject GTFS shape + stops for the line
  if (lineData) {
    const shapeJson = JSON.stringify(lineData.shape);
    const stopsJson = JSON.stringify(lineData.stops, null, 2);
    html = html.replace(/const ROUTE_SHAPE\s*=\s*\[[\s\S]*?\];/m, `const ROUTE_SHAPE = ${shapeJson};`);
    html = html.replace(/stops:\s*\[[\s\S]*?\]\s*\n\s*\}/m, `stops: ${stopsJson}\n        }`);
  }

  // LINE_CONFIG id
  html = html.replace(/id:\s*'A'/g, `id: '${display}'`);
  if (lineData?.routeId) {
    html = html.replace(/routeId:\s*'[^']*'/g, `routeId: '${lineData.routeId}'`);
  }
  // LINE_CONFIG color
  html = html.replace(/color:\s*'#[0-9a-fA-F]{6}'/g, `color: '${color}'`);
  // Ensure LINE_CONFIG closes correctly when stops injected above
  html = html.replace(/\}\s*;\s*\n\s*\n\s*let map;/m, `};\n\n        let map;`);

  // stop select options -> per-line stops
  if (lineData && lineData.stops.length) {
    const optionsHtml = lineData.stops
      .map(stop => `                <option value="${escapeHtml(stop.name)}">${escapeHtml(stop.name)}</option>`)
      .join('\n');
    html = html.replace(
      /<select class="stop-select" id="stop-select">[\s\S]*?<\/select>/i,
      `<select class="stop-select" id="stop-select">\n                <option value="">— Sélectionnez un arrêt —</option>\n${optionsHtml}\n            </select>`
    );
  }

  // Schema.org bits: keep structure, but ensure the page/name references current line
  html = html.replace(/"@id": "https:\/\/www\.xn--primap-bva\.fr\/horaires-ligne-a\.html"/g, `"@id": "${canonical}"`);
  html = html.replace(/"url": "https:\/\/www\.xn--primap-bva\.fr\/horaires-ligne-a\.html"/g, `"url": "${canonical}"`);
  html = html.replace(/"name": "Ligne A Péribus[^\"]*"/g, `"name": "Ligne ${display} Péribus — Horaires"`);
  html = html.replace(/"description": "Horaires ligne A Péribus[^\"]*"/g, `"description": "Horaires ligne ${display} Péribus (Grand Périgueux)."`);
  html = html.replace(/"name": "Péribus Ligne A"/g, `"name": "Péribus Ligne ${display}"`);
  html = html.replace(/"description": "Ligne A[^\"]*"/g, `"description": "${busTripDescription}"`);
  html = html.replace(/"busName": "Ligne A"/g, `"busName": "Ligne ${display}"`);

  // Avoid claiming endpoints we don't reliably know
  html = html.replace(
    /"departureStation":\s*\{[\s\S]*?\}\s*,\s*\n\s*"arrivalStation":\s*\{[\s\S]*?\}/m,
    `"departureStation": { "@type": "BusStation", "name": "Grand Périgueux" },\n                "arrivalStation": { "@type": "BusStation", "name": "Grand Périgueux" }`
  );

  // Breadcrumb last element
  html = html.replace(/\{ "@type": "ListItem", "position": 3, "name": "Ligne A" \}/g, `{ "@type": "ListItem", "position": 3, "name": "Ligne ${display}" }`);

    // FAQ: replace the A-specific copy with a generic, line-specific FAQ
    const stopCount = lineData?.stops?.length || 0;
    const mainStops = lineData?.mainStops?.length ? lineData.mainStops.join(', ') : 'Consultez la fiche PDF.';
    const faqHtml = `

      <div class="faq-card">
        <h2>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Questions fréquentes
        </h2>

        <details class="faq-item">
          <summary>Quels sont les terminus de la ligne ${display} ?</summary>
          <div class="faq-answer">
            ${lineData?.terminusA && lineData?.terminusB ? `Terminus : <strong>${lineData.terminusA}</strong> et <strong>${lineData.terminusB}</strong>.` : `Consultez la fiche horaire PDF pour les terminus.`}
          </div>
        </details>

        <details class="faq-item">
          <summary>Quels sont les principaux arrêts de la ligne ${display} ?</summary>
          <div class="faq-answer">
            ${mainStops}
          </div>
        </details>

        <details class="faq-item">
          <summary>Combien d'arrêts desservit la ligne ${display} ?</summary>
          <div class="faq-answer">
            ${stopCount ? `Environ <strong>${stopCount}</strong> arrêts sur le parcours (selon le sens).` : `Consultez la fiche PDF pour le nombre d'arrêts.`}
          </div>
        </details>

        <details class="faq-item">
          <summary>Où trouver les horaires de la ligne ${display} ?</summary>
          <div class="faq-answer">
            Consultez les <strong>prochains passages</strong> dans l'app PériMap et téléchargez la <strong>fiche horaire PDF</strong> (périodes, vacances, jours fériés) : <a href="/data/fichehoraire/${pdfFilename}" target="_blank" rel="noopener">ouvrir la fiche</a>.
          </div>
        </details>

        <details class="faq-item">
          <summary>Pourquoi certains horaires ne s'affichent pas ici ?</summary>
          <div class="faq-answer">
            Cette page est une <strong>fiche statique</strong>. Pour les horaires temps réel et la sélection d'arrêt, utilisez l'application PériMap.
          </div>
        </details>
      </div>
  `;

    html = html.replace(/\n\s*<div class="faq-card">[\s\S]*?<\/div>\s*\n\s*<div class="actions">/m, `${faqHtml}\n\n        <div class="actions">`);

  return html;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function updateHorairesHubDescriptions(lineCodes) {
  if (!exists(horairesHubPath)) return;
  let html = fs.readFileSync(horairesHubPath, 'utf8');
  let updated = false;

  for (const lineCode of lineCodes) {
    const routeText = inferRouteText(lineCode);
    const safeRouteText = escapeHtml(routeText);
    const meta = routeMetaByLine.get(lineCode.toUpperCase());
    const bg = meta?.color || colorFor(lineCode);
    const fg = meta?.textColor || textColorFor(bg);
    const escapedCode = lineCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(<h3>\\s*Horaires ligne ${escapedCode}\\s*<\\/h3>\\s*<p>)([\\s\\S]*?)(<\\/p>)`, 'i');
    if (regex.test(html)) {
      html = html.replace(regex, `$1${safeRouteText}$3`);
      updated = true;
    }

    const iconRegex = new RegExp(`(<div class="service-card-icon[^\"]*">)${escapedCode}(<\\/div>)`, 'i');
    if (iconRegex.test(html)) {
      html = html.replace(iconRegex, `<div class="service-card-icon" style="background:${bg};color:${fg};">${lineCode}</div>`);
      updated = true;
    }
  }

  if (updated) {
    fs.writeFileSync(horairesHubPath, html, 'utf8');
  }
}

function main() {
  if (!exists(templatePath)) {
    console.error(`Template not found: ${templatePath}`);
    process.exit(1);
  }
  if (!exists(pdfDir)) {
    console.error(`PDF folder not found: ${pdfDir}`);
    process.exit(1);
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  const pdfFiles = fs.readdirSync(pdfDir).filter((f) => f.toLowerCase().endsWith('.pdf'));

  const plannedByOutFile = new Map();
  const detectedCodes = new Set();

  for (const pdfFilename of pdfFiles) {
    const codes = extractLineCodesFromPdf(pdfFilename);
    for (const code of codes) {
      const normalized = normalizeLineCode(code);
      const display = normalized.toUpperCase();
      detectedCodes.add(display);
      const slug = slugFor(display);
      const outFile = path.join(publicDir, `horaires-ligne-${slug}.html`);

      if (!plannedByOutFile.has(outFile)) {
        plannedByOutFile.set(outFile, { lineCode: display, slug, outFile, pdfFilename });
      }
    }
  }

  const planned = [...plannedByOutFile.values()].sort((a, b) => a.slug.localeCompare(b.slug, 'fr'));

  console.log(`Generated/updated ${planned.length} line pages.`);
  for (const p of planned) {
    const html = generatePage({ template, lineCode: p.lineCode, pdfFilename: p.pdfFilename });
    fs.writeFileSync(p.outFile, html, 'utf8');
    console.log(`- ${path.relative(workspaceRoot, p.outFile)}  (PDF: ${p.pdfFilename})`);
  }

  updateHorairesHubDescriptions(detectedCodes);

  // Print a normalized list of all line codes detected for downstream sitemap/hub updates.
  const allCodes = [...detectedCodes].sort((a, b) => a.localeCompare(b, 'fr'));
  console.log(`\nDetected line codes (${allCodes.length}): ${allCodes.join(', ')}`);
}

main();
