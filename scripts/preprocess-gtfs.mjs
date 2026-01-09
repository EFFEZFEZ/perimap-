import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { cleanDataset } from '../public/js/utils/gtfsProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GTFS_DIR = path.resolve(__dirname, '../public/data/gtfs');
const OUTPUT_FILE = path.join(GTFS_DIR, 'gtfs.bundle.json');
const COMPRESSED_OUTPUT_FILE = `${OUTPUT_FILE}.gz`;
const BROTLI_OUTPUT_FILE = `${OUTPUT_FILE}.br`;  // Nouveau : Brotli (meilleure compression)
const GTFS_FILES = [
    { file: 'routes.txt', key: 'routes' },
    { file: 'trips.txt', key: 'trips' },
    { file: 'stop_times.txt', key: 'stopTimes' },
    { file: 'stops.txt', key: 'stops' },
    { file: 'calendar.txt', key: 'calendar' },
    { file: 'calendar_dates.txt', key: 'calendarDates' },
    { file: 'shapes.txt', key: 'shapes' }
];

async function main() {
    console.log('➡️  Prétraitement des fichiers GTFS...');
    const dataset = {};

    for (const { file, key } of GTFS_FILES) {
        const filePath = path.join(GTFS_DIR, file);
        console.log(`   • ${file}`);
        const contents = await fs.readFile(filePath, 'utf8');
        dataset[key] = parseCsv(contents);
    }

    dataset.geoJson = await readGeoJson();
    const cleaned = cleanDataset(dataset);

    const jsonBuffer = Buffer.from(JSON.stringify(cleaned));
    await fs.writeFile(OUTPUT_FILE, jsonBuffer);

    const gzipped = gzipSync(jsonBuffer, { level: 9 });
    await fs.writeFile(COMPRESSED_OUTPUT_FILE, gzipped);

    // Compression Brotli (encore meilleure, ~20% plus petit que gzip)
    const brotliOptions = {
        params: {
            [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
            [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT
        }
    };
    const brotlied = brotliCompressSync(jsonBuffer, brotliOptions);
    await fs.writeFile(BROTLI_OUTPUT_FILE, brotlied);

    console.log(`✅ Bundle GTFS généré: ${OUTPUT_FILE}`);
    console.log(`✅ Bundle gzip généré: ${COMPRESSED_OUTPUT_FILE} (${(gzipped.length / 1024).toFixed(1)} Ko)`);
    console.log(`✅ Bundle Brotli généré: ${BROTLI_OUTPUT_FILE} (${(brotlied.length / 1024).toFixed(1)} Ko)`);
}

function parseCsv(text) {
    const rows = [];
    let current = '';
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            row.push(current);
            current = '';
            continue;
        }

        if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            row.push(current);
            rows.push(row);
            row = [];
            current = '';
            continue;
        }

        current += char;
    }

    if (current !== '' || row.length) {
        row.push(current);
        rows.push(row);
    }

    if (!rows.length) {
        return [];
    }

    const headers = rows.shift().map((header) => header.trim());
    return rows
        .filter((cells) => cells.length && cells.some((value) => value && value.trim() !== ''))
        .map((cells) => {
            const record = {};
            headers.forEach((header, index) => {
                record[header] = cells[index] ?? '';
            });
            return record;
        });
}

async function readGeoJson() {
    const geoPath = path.resolve(__dirname, '../public/data/map.geojson');
    try {
        const text = await fs.readFile(geoPath, 'utf8');
        return JSON.parse(text);
    } catch (error) {
        console.warn('GeoJSON non trouvé, ignoré.');
        return null;
    }
}

main().catch((error) => {
    console.error('❌ Prétraitement GTFS échoué:', error);
    process.exit(1);
});
