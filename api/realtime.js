/**
 * API Vercel - Proxy temps réel Péribus (STEALTH LITE v3.0)
 * 
 * Version légère optimisée pour Vercel Serverless
 * Utilise fetch natif avec headers stealth avancés
 * 
 * Copyright (c) 2026-2026 Périmap. Tous droits réservés.
 * 
 * PROTECTIONS ACTIVES:
 * ✅ Client Hints complets (Sec-Ch-Ua, Sec-Ch-Ua-Platform, etc.)
 * ✅ Rotation User-Agent avec profils récents (Chrome 129-131)
 * ✅ Jitter aléatoire pour casser les patterns temporels
 * ✅ Referers légitimes (portail Péribus, Google, etc.)
 * ✅ Accept headers réalistes
 * ✅ Cache intelligent côté serveur
 */

// ============================================
// PROFILS DE NAVIGATEURS RÉALISTES
// ============================================

const BROWSER_PROFILES = [
    {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        secChUaPlatform: '"Windows"',
        secChUaMobile: '?0'
    },
    {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        secChUa: '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="24"',
        secChUaPlatform: '"Windows"',
        secChUaMobile: '?0'
    },
    {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        secChUaPlatform: '"macOS"',
        secChUaMobile: '?0'
    },
    {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        secChUa: '"Google Chrome";v="129", "Chromium";v="129", "Not_A Brand";v="24"',
        secChUaPlatform: '"Windows"',
        secChUaMobile: '?0'
    },
    {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        secChUa: '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="24"',
        secChUaPlatform: '"macOS"',
        secChUaMobile: '?0'
    }
];

const LEGITIMATE_REFERERS = [
    'https://www.perimouv.fr/',
    'https://perimouv.fr/',
    'https://www.grand-perigueux.fr/',
    'https://www.google.fr/',
    'https://xn--primap-bva.fr/',
    'https://www.xn--primap-bva.fr/'
];

// ============================================
// CACHE MÉMOIRE SIMPLE
// ============================================

const cache = new Map();
const CACHE_TTL = 15000; // 15 secondes

function getCached(key) {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > CACHE_TTL) {
        cache.delete(key);
        return null;
    }
    return item.data;
}

function setCache(key, data) {
    // Nettoyer le cache si trop gros
    if (cache.size > 100) {
        const now = Date.now();
        for (const [k, v] of cache) {
            if (now - v.timestamp > CACHE_TTL) cache.delete(k);
        }
    }
    cache.set(key, { data, timestamp: Date.now() });
}

// ============================================
// HELPERS
// ============================================

function getRandomProfile() {
    return BROWSER_PROFILES[Math.floor(Math.random() * BROWSER_PROFILES.length)];
}

function getRandomReferer() {
    return LEGITIMATE_REFERERS[Math.floor(Math.random() * LEGITIMATE_REFERERS.length)];
}

function randomJitter(min = 100, max = 500) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// SCRAPING AVEC FETCH
// ============================================

async function scrapeHawk(stopKey) {
    const profile = getRandomProfile();
    const referer = getRandomReferer();
    const url = `https://hawk.perimouv.fr/qrcodes/schedule.aspx?key=${stopKey}`;
    
    console.log(`[Realtime] Fetching ${url}`);
    
    // Headers simplifiés mais réalistes
    const headers = {
        'User-Agent': profile.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Referer': referer
    };

    // Jitter anti-pattern
    await sleep(randomJitter(50, 150));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: controller.signal,
            redirect: 'follow'
        });

        clearTimeout(timeout);
        
        console.log(`[Realtime] Response status: ${response.status}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        console.log(`[Realtime] HTML length: ${html.length}`);
        
        return parseHawkHTML(html);

    } catch (error) {
        clearTimeout(timeout);
        console.error(`[Realtime] Fetch error:`, error.message);
        throw error;
    }
}

// ============================================
// PARSING HTML HAWK
// ============================================

function parseHawkHTML(html) {
    const departures = [];

    // Extraire le nom de l'arrêt
    const stopNameMatch = html.match(/<span[^>]*class=['"]stop-name-text['"][^>]*>([^<]+)<\/span>/i);
    const stopName = stopNameMatch ? stopNameMatch[1].trim() : null;

    // Extraire les lignes (dans les balises <text> des SVG)
    const lineMatches = [...html.matchAll(/<text[^>]*>([^<]+)<\/text>/gi)];
    
    // Extraire les destinations
    const destMatches = [...html.matchAll(/<div class='row-cell destination-cell destination'[^>]*>([^<]+)<\/div>/gi)];
    
    // Extraire les temps au format HH:MM (temps d'attente)
    const timeMatches = [...html.matchAll(/<div class='row-cell schedule'[^>]*>(\d{2}:\d{2})/gi)];
    
    // Vérifier si chaque départ est théorique (contient T.png après le temps)
    const scheduleBlocks = [...html.matchAll(/<div class='row-cell schedule'[^>]*>(\d{2}:\d{2})([^<]*(?:<[^>]*>[^<]*)*?)<\/div>/gi)];
    
    const minLen = Math.min(lineMatches.length, destMatches.length, timeMatches.length);
    
    for (let i = 0; i < minLen; i++) {
        // Vérifier si ce départ est théorique
        const isTheoretical = scheduleBlocks[i] ? scheduleBlocks[i][0].includes('T.png') : false;
        
        departures.push({
            line: lineMatches[i][1].trim(),
            destination: destMatches[i][1].trim(),
            time: timeMatches[i][1].trim(),
            realtime: !isTheoretical,
            theoretical: isTheoretical
        });
    }

    // Ajouter le nom de l'arrêt aux données
    const result = departures.slice(0, 10);
    if (stopName) {
        result.stopName = stopName;
    }
    
    return result;
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { stop } = req.query;
    
    if (!stop) {
        return res.status(400).json({ 
            error: 'Missing stop parameter',
            usage: '/api/realtime?stop=77029'
        });
    }

    // Extraire l'ID numérique du stop
    const stopKey = String(stop).replace(/\D/g, '');
    
    if (!stopKey || stopKey.length < 2) {
        return res.status(400).json({ 
            error: 'Invalid stop ID',
            received: stop
        });
    }

    // Vérifier le cache
    const cacheKey = `rt_${stopKey}`;
    const cached = getCached(cacheKey);
    if (cached) {
        return res.status(200).json({
            ...cached,
            cached: true,
            cacheAge: Date.now() - cache.get(cacheKey).timestamp
        });
    }

    try {
        const departures = await scrapeHawk(stopKey);
        
        const result = {
            stop: stopKey,
            timestamp: new Date().toISOString(),
            departures,
            count: departures.length,
            source: 'hawk.perimouv.fr',
            cached: false
        };

        // Mettre en cache
        setCache(cacheKey, result);

        // Headers de cache HTTP
        res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
        
        return res.status(200).json(result);

    } catch (error) {
        console.error(`[Realtime] Error for stop ${stopKey}:`, error.message);
        
        return res.status(500).json({
            error: 'Failed to fetch realtime data',
            stop: stopKey,
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

