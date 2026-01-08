/**
 * API Vercel - Proxy temps réel Péribus (STEALTH LITE v3.0)
 * 
 * Version légère optimisée pour Vercel Serverless
 * Utilise fetch natif avec headers stealth avancés
 * 
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
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
    const url = `https://hawk.perimouv.fr/horaires/${stopKey}`;
    
    // Headers stealth complets
    const headers = {
        'User-Agent': profile.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': profile.secChUa,
        'Sec-Ch-Ua-Mobile': profile.secChUaMobile,
        'Sec-Ch-Ua-Platform': profile.secChUaPlatform,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Referer': referer,
        'DNT': '1'
    };

    // Jitter anti-pattern
    await sleep(randomJitter(50, 200));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: controller.signal,
            redirect: 'follow'
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        return parseHawkHTML(html);

    } catch (error) {
        clearTimeout(timeout);
        throw error;
    }
}

// ============================================
// PARSING HTML HAWK
// ============================================

function parseHawkHTML(html) {
    const departures = [];

    // Pattern pour les départs temps réel Hawk/Hanover
    // Format typique: <div class="departure">...</div>
    
    // Pattern 1: Format JSON embarqué (si présent)
    const jsonMatch = html.match(/var\s+departures\s*=\s*(\[[\s\S]*?\]);/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[1]);
            return parsed.map(d => ({
                line: d.line || d.routeShortName || '',
                destination: d.destination || d.headsign || '',
                time: d.time || d.departureTime || '',
                realtime: d.realtime !== false,
                delay: d.delay || 0
            }));
        } catch (e) {
            // Continue avec parsing HTML
        }
    }

    // Pattern 2: Tables de départs
    const tableRegex = /<tr[^>]*class="[^"]*departure[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    let tableMatch;
    while ((tableMatch = tableRegex.exec(html)) !== null) {
        const row = tableMatch[1];
        const lineMatch = row.match(/<td[^>]*class="[^"]*line[^"]*"[^>]*>([^<]+)</i);
        const destMatch = row.match(/<td[^>]*class="[^"]*destination[^"]*"[^>]*>([^<]+)</i);
        const timeMatch = row.match(/<td[^>]*class="[^"]*time[^"]*"[^>]*>([^<]+)</i);
        
        if (lineMatch || destMatch || timeMatch) {
            departures.push({
                line: lineMatch ? lineMatch[1].trim() : '',
                destination: destMatch ? destMatch[1].trim() : '',
                time: timeMatch ? timeMatch[1].trim() : '',
                realtime: true
            });
        }
    }

    // Pattern 3: Divs de départs (format Hanover classique)
    const divRegex = /<div[^>]*class="[^"]*(?:departure|horaire|passage)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let divMatch;
    while ((divMatch = divRegex.exec(html)) !== null) {
        const content = divMatch[1];
        
        // Extraire ligne
        const lineMatch = content.match(/(?:ligne|line)[:\s]*([A-D]|\d+)/i) ||
                         content.match(/<span[^>]*class="[^"]*line[^"]*"[^>]*>([^<]+)</i) ||
                         content.match(/<strong>([A-D])<\/strong>/i);
        
        // Extraire destination
        const destMatch = content.match(/(?:direction|vers|destination)[:\s]*([^<\n]+)/i) ||
                         content.match(/<span[^>]*class="[^"]*(?:destination|direction)[^"]*"[^>]*>([^<]+)</i);
        
        // Extraire temps
        const timeMatch = content.match(/(\d{1,2}:\d{2}|\d+\s*min|proche|imminent)/i) ||
                         content.match(/<span[^>]*class="[^"]*time[^"]*"[^>]*>([^<]+)</i);
        
        if (lineMatch && (destMatch || timeMatch)) {
            departures.push({
                line: lineMatch[1].trim(),
                destination: destMatch ? destMatch[1].trim() : '',
                time: timeMatch ? timeMatch[1].trim() : '',
                realtime: true
            });
        }
    }

    // Pattern 4: Format liste simple
    const listRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let listMatch;
    while ((listMatch = listRegex.exec(html)) !== null) {
        const item = listMatch[1];
        // Chercher pattern "Ligne X - Direction - HH:MM"
        const fullMatch = item.match(/(?:ligne\s*)?([A-D]|\d+)[^A-Za-z0-9]*(?:vers|direction|→)?\s*([^-\d]+?)\s*[-–]\s*(\d{1,2}:\d{2}|\d+\s*min)/i);
        if (fullMatch) {
            departures.push({
                line: fullMatch[1].trim(),
                destination: fullMatch[2].trim(),
                time: fullMatch[3].trim(),
                realtime: true
            });
        }
    }

    // Pattern 5: Texte brut structuré
    const textBlocks = html.match(/(?:Ligne\s*)?([A-D])\s*(?:vers|→|direction)?\s*([^\d\n<]+?)\s*[:–-]\s*(\d{1,2}h?\d{2}|\d+\s*min(?:utes?)?|Proche)/gi);
    if (textBlocks) {
        for (const block of textBlocks) {
            const parts = block.match(/([A-D])\s*(?:vers|→|direction)?\s*([^\d\n<]+?)\s*[:–-]\s*(\d{1,2}h?\d{2}|\d+\s*min(?:utes?)?|Proche)/i);
            if (parts && departures.length < 20) {
                departures.push({
                    line: parts[1].trim(),
                    destination: parts[2].trim(),
                    time: parts[3].trim().replace('h', ':'),
                    realtime: true
                });
            }
        }
    }

    // Dédupliquer
    const seen = new Set();
    return departures.filter(d => {
        const key = `${d.line}-${d.destination}-${d.time}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 10); // Max 10 départs
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
