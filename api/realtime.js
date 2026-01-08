/**
 * API Vercel - Proxy temps réel Péribus (GHOST MODE v2.0)
 * 
 * Scraping furtif et indétectable de hawk.perimouv.fr
 * Utilise Puppeteer Stealth avec toutes les protections anti-bot
 * 
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 * 
 * PROTECTIONS ACTIVES:
 * ✅ Puppeteer Extra Stealth Plugin (masque webdriver, chrome.runtime, etc.)
 * ✅ Client Hints complets (Sec-Ch-Ua, Sec-Ch-Ua-Platform, etc.)
 * ✅ Rotation User-Agent avec profils récents (Chrome 129-131/Windows/Mac)
 * ✅ Jitter aléatoire pour casser les patterns temporels
 * ✅ Simulation comportementale (mouvements souris, scrolls)
 * ✅ Blocage images/CSS/fonts/tracking pour mode ghost
 * ✅ Interception XHR prioritaire (évite parsing HTML = invisibilité maximale)
 * ✅ Referers légitimes (portail Péribus, Google, etc.)
 * ✅ WebGL fingerprint falsifié
 */

import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// ============================================
// CONFIGURATION PUPPETEER STEALTH
// ============================================

// Configurer puppeteer-extra avec le plugin stealth complet
const puppeteer = puppeteerExtra.default || puppeteerExtra;
const stealth = StealthPlugin.default || StealthPlugin;
puppeteer.use(stealth());

// ============================================
// PROFILS DE NAVIGATEURS RÉALISTES
// Chrome 129-131 uniquement (versions récentes 2024-2025)
// ============================================

const BROWSER_PROFILES = [
    {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        platform: 'Windows',
        platformVersion: '10.0.0',
        mobile: false,
        brands: [
            { brand: 'Google Chrome', version: '131' },
            { brand: 'Chromium', version: '131' },
            { brand: 'Not_A Brand', version: '24' }
        ],
        viewport: { width: 1920, height: 1080 },
        deviceMemory: 8,
        hardwareConcurrency: 8
    },
    {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        platform: 'Windows',
        platformVersion: '10.0.0',
        mobile: false,
        brands: [
            { brand: 'Google Chrome', version: '130' },
            { brand: 'Chromium', version: '130' },
            { brand: 'Not_A Brand', version: '24' }
        ],
        viewport: { width: 1366, height: 768 },
        deviceMemory: 4,
        hardwareConcurrency: 4
    },
    {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        platform: 'macOS',
        platformVersion: '10.15.7',
        mobile: false,
        brands: [
            { brand: 'Google Chrome', version: '131' },
            { brand: 'Chromium', version: '131' },
            { brand: 'Not_A Brand', version: '24' }
        ],
        viewport: { width: 1440, height: 900 },
        deviceMemory: 16,
        hardwareConcurrency: 10
    },
    {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        platform: 'Windows',
        platformVersion: '10.0.0',
        mobile: false,
        brands: [
            { brand: 'Google Chrome', version: '129' },
            { brand: 'Chromium', version: '129' },
            { brand: 'Not_A Brand', version: '24' }
        ],
        viewport: { width: 1536, height: 864 },
        deviceMemory: 8,
        hardwareConcurrency: 6
    },
    {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        platform: 'macOS',
        platformVersion: '10.15.7',
        mobile: false,
        brands: [
            { brand: 'Google Chrome', version: '130' },
            { brand: 'Chromium', version: '130' },
            { brand: 'Not_A Brand', version: '24' }
        ],
        viewport: { width: 1680, height: 1050 },
        deviceMemory: 8,
        hardwareConcurrency: 8
    }
];

// Referers légitimes (portail Péribus et sites liés)
const LEGITIMATE_REFERERS = [
    'https://www.perimouv.fr/',
    'https://www.perimouv.fr/horaires',
    'https://www.grand-perigueux.fr/se-deplacer/',
    'https://www.grand-perigueux.fr/se-deplacer/en-bus/',
    'https://www.google.fr/search?q=horaires+peribus+perigueux',
    'https://www.google.com/search?q=bus+perigueux+temps+reel',
    'https://perimap.fr/',
    'https://xn--primap-bva.fr/'
];

// ============================================
// FONCTIONS UTILITAIRES GHOST
// ============================================

/**
 * Génère un délai aléatoire (jitter) pour casser les patterns
 * @param {number} minMs - Minimum en ms
 * @param {number} maxMs - Maximum en ms
 */
function randomJitter(minMs = 500, maxMs = 2500) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Sélectionne un profil de navigateur aléatoire
 */
function getRandomProfile() {
    return BROWSER_PROFILES[Math.floor(Math.random() * BROWSER_PROFILES.length)];
}

/**
 * Sélectionne un referer aléatoire
 */
function getRandomReferer() {
    return LEGITIMATE_REFERERS[Math.floor(Math.random() * LEGITIMATE_REFERERS.length)];
}

/**
 * Génère un fingerprint WebGL aléatoire mais réaliste
 */
function getRandomWebGLFingerprint() {
    const vendors = ['Google Inc. (NVIDIA)', 'Google Inc. (Intel)', 'Google Inc. (AMD)'];
    const renderers = [
        'ANGLE (NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)'
    ];
    return {
        vendor: vendors[Math.floor(Math.random() * vendors.length)],
        renderer: renderers[Math.floor(Math.random() * renderers.length)]
    };
}

/**
 * Simule un mouvement de souris humain (courbe de Bézier)
 */
async function simulateHumanMouseMove(page) {
    try {
        const startX = Math.floor(Math.random() * 200) + 50;
        const startY = Math.floor(Math.random() * 200) + 50;
        const endX = Math.floor(Math.random() * 600) + 200;
        const endY = Math.floor(Math.random() * 300) + 100;
        
        // Mouvement en plusieurs étapes (courbe naturelle)
        const steps = Math.floor(Math.random() * 15) + 10;
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            // Courbe de Bézier quadratique
            const ctrlX = (startX + endX) / 2 + (Math.random() - 0.5) * 100;
            const ctrlY = (startY + endY) / 2 + (Math.random() - 0.5) * 100;
            
            const x = Math.pow(1-t, 2) * startX + 2 * (1-t) * t * ctrlX + Math.pow(t, 2) * endX;
            const y = Math.pow(1-t, 2) * startY + 2 * (1-t) * t * ctrlY + Math.pow(t, 2) * endY;
            
            await page.mouse.move(x, y);
            await new Promise(r => setTimeout(r, Math.random() * 20 + 5));
        }
    } catch (e) {
        // Ignorer silencieusement
    }
}

/**
 * Simule un scroll humain (pas parfaitement linéaire)
 */
async function simulateHumanScroll(page) {
    try {
        const scrollAmount = Math.floor(Math.random() * 150) + 30;
        const direction = Math.random() > 0.3 ? 1 : -1; // 70% vers le bas
        
        await page.evaluate((amount, dir) => {
            window.scrollBy({
                top: amount * dir,
                behavior: 'smooth'
            });
        }, scrollAmount, direction);
        
        await new Promise(r => setTimeout(r, randomJitter(100, 400)));
    } catch (e) {
        // Ignorer silencieusement
    }
}

/**
 * Comportement humain complet
 */
async function simulateHumanBehavior(page) {
    // Délai initial (comme si on regardait la page)
    await new Promise(r => setTimeout(r, randomJitter(300, 800)));
    
    // Mouvement de souris
    await simulateHumanMouseMove(page);
    
    // Petit délai
    await new Promise(r => setTimeout(r, randomJitter(150, 500)));
    
    // Scroll léger
    await simulateHumanScroll(page);
    
    // Délai final
    await new Promise(r => setTimeout(r, randomJitter(200, 600)));
}

// ============================================
// INTERCEPTION XHR (MODE INVISIBLE)
// ============================================

/**
 * Intercepte les appels XHR/JSON pour extraction directe
 * C'est le mode le plus furtif - on ne parse même pas le HTML
 */
async function interceptXHR(page, stopKey) {
    return new Promise((resolve) => {
        let resolved = false;
        
        page.on('response', async (response) => {
            if (resolved) return;
            
            const url = response.url();
            const contentType = response.headers()['content-type'] || '';
            
            // Chercher des appels JSON/XHR avec les données de schedule
            if ((contentType.includes('json') || 
                 url.includes('schedule') || 
                 url.includes('api') ||
                 url.includes('data') ||
                 url.includes('passage')) 
                && !url.includes('.js') 
                && !url.includes('.css')
                && !url.includes('analytics')) {
                try {
                    const text = await response.text();
                    // Vérifier si ça contient des données de bus
                    if (text.includes('ligne') || 
                        text.includes('destination') || 
                        text.includes('temps') ||
                        text.includes('arret') ||
                        text.includes('schedule')) {
                        resolved = true;
                        resolve({ type: 'xhr', data: text });
                    }
                } catch (e) {
                    // Ignorer silencieusement
                }
            }
        });
        
        // Timeout pour passer au parsing HTML si pas de XHR trouvé
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve({ type: 'html', data: null });
            }
        }, 6000);
    });
}

// ============================================
// PARSERS
// ============================================

/**
 * Parse le HTML de hawk.perimouv.fr pour extraire les horaires
 */
function parseScheduleHTML(html, stopKey) {
    const schedules = [];
    
    // Extraire le nom de l'arrêt
    let stopName = 'Inconnu';
    const stopNamePatterns = [
        /<span[^>]*id="[^"]*StopLabel[^"]*"[^>]*>([^<]+)</i,
        /<span[^>]*id="StopLabel"[^>]*>([^<]+)</i,
        /<h2[^>]*class="[^"]*stop-name[^"]*"[^>]*>([^<]+)</i,
        /<div[^>]*class="[^"]*stop-header[^"]*"[^>]*>([^<]+)</i,
        /class="stop-name"[^>]*>([^<]+)</i
    ];
    
    for (const pattern of stopNamePatterns) {
        const match = html.match(pattern);
        if (match) {
            stopName = match[1].trim();
            break;
        }
    }

    // Pattern pour le tableau des horaires (table-body)
    const tableBodyMatch = html.match(/<tbody[^>]*id="table-body"[^>]*>([\s\S]*?)<\/tbody>/i);
    if (tableBodyMatch) {
        const tableContent = tableBodyMatch[1];
        const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let rowMatch;
        
        while ((rowMatch = rowPattern.exec(tableContent)) !== null) {
            const row = rowMatch[1];
            const cells = [];
            const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            let cellMatch;
            
            while ((cellMatch = cellPattern.exec(row)) !== null) {
                let content = cellMatch[1].replace(/<[^>]+>/g, '').trim();
                cells.push(content);
            }
            
            if (cells.length >= 4) {
                const ligne = cells[0];
                const destination = cells[1];
                const quai = cells[2] || '';
                const temps = cells[3];
                
                if (ligne && /^[A-Da-d]$|^\d+$/.test(ligne.trim())) {
                    schedules.push({
                        ligne: ligne.toUpperCase().trim(),
                        destination: destination.trim(),
                        quai: quai.trim(),
                        temps: temps.trim(),
                        stop_id: String(stopKey),
                        stop_name: stopName
                    });
                }
            }
        }
    }

    // Fallback patterns
    if (schedules.length === 0) {
        // Pattern ASP.NET avec labels
        const aspPattern = /ligne[^>]*>([A-Da-d])<[\s\S]*?destination[^>]*>([^<]+)<[\s\S]*?temps[^>]*>([^<]+)</gi;
        let match;
        while ((match = aspPattern.exec(html)) !== null) {
            schedules.push({
                ligne: match[1].toUpperCase().trim(),
                destination: match[2].trim(),
                quai: '',
                temps: match[3].trim(),
                stop_id: String(stopKey),
                stop_name: stopName
            });
        }
        
        // Pattern générique
        if (schedules.length === 0) {
            const genericPattern = /([A-Da-d])\s*[-–|:]\s*([^<\n]{3,40}?)[\s:]+(\d+\s*min|\d{1,2}[h:]\d{2}|imminent|approche)/gi;
            while ((match = genericPattern.exec(html)) !== null) {
                schedules.push({
                    ligne: match[1].toUpperCase(),
                    destination: match[2].trim(),
                    quai: '',
                    temps: match[3].trim(),
                    stop_id: String(stopKey),
                    stop_name: stopName
                });
            }
        }
    }

    return {
        timestamp: new Date().toISOString(),
        stop_id: String(stopKey),
        stop_name: stopName,
        schedules: schedules,
        source: 'html_parse'
    };
}

/**
 * Parse les données XHR/JSON interceptées
 */
function parseXHRData(xhrText, stopKey) {
    try {
        const data = JSON.parse(xhrText);
        const schedules = [];
        
        if (Array.isArray(data)) {
            data.forEach(item => {
                if (item.ligne || item.line) {
                    schedules.push({
                        ligne: (item.ligne || item.line || '').toUpperCase(),
                        destination: item.destination || item.dest || '',
                        quai: item.quai || item.platform || '',
                        temps: item.temps || item.time || item.wait || '',
                        stop_id: String(stopKey),
                        stop_name: item.stop_name || item.arret || 'Inconnu'
                    });
                }
            });
        } else if (data.schedules || data.departures || data.passages) {
            const items = data.schedules || data.departures || data.passages;
            items.forEach(item => {
                schedules.push({
                    ligne: (item.ligne || item.line || '').toUpperCase(),
                    destination: item.destination || item.dest || '',
                    quai: item.quai || item.platform || '',
                    temps: item.temps || item.time || item.wait || '',
                    stop_id: String(stopKey),
                    stop_name: data.stop_name || data.arret || 'Inconnu'
                });
            });
        }
        
        return {
            timestamp: new Date().toISOString(),
            stop_id: String(stopKey),
            stop_name: schedules[0]?.stop_name || 'Inconnu',
            schedules: schedules,
            source: 'xhr_intercept'
        };
    } catch (e) {
        return null;
    }
}

// ============================================
// SCRAPER GHOST MODE (PUPPETEER STEALTH)
// ============================================

async function scrapeWithPuppeteer(stopKey) {
    const profile = getRandomProfile();
    const referer = getRandomReferer();
    const webgl = getRandomWebGLFingerprint();
    
    let browser = null;
    
    try {
        // Configuration Chromium pour Vercel serverless
        const executablePath = await chromium.executablePath();
        
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-web-security',
                '--no-first-run',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                `--window-size=${profile.viewport.width},${profile.viewport.height}`,
                '--hide-scrollbars',
                '--mute-audio',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-extensions',
                '--disable-sync',
                '--disable-translate',
                '--metrics-recording-only',
                '--no-default-browser-check',
                '--safebrowsing-disable-auto-update'
            ],
            defaultViewport: profile.viewport,
            executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        
        // ============================================
        // STEALTH: MASQUER TOUS LES MARQUEURS BOT
        // ============================================
        
        await page.evaluateOnNewDocument((profileData, webglData) => {
            // Masquer webdriver
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            delete navigator.__proto__.webdriver;
            
            // Falsifier plugins Chrome réalistes
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const plugins = [
                        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
                        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
                        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 }
                    ];
                    plugins.item = (i) => plugins[i];
                    plugins.namedItem = (name) => plugins.find(p => p.name === name);
                    plugins.refresh = () => {};
                    return plugins;
                }
            });
            
            // Falsifier mimeTypes
            Object.defineProperty(navigator, 'mimeTypes', {
                get: () => {
                    const mimes = [
                        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
                        { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' }
                    ];
                    mimes.item = (i) => mimes[i];
                    mimes.namedItem = (name) => mimes.find(m => m.type === name);
                    return mimes;
                }
            });
            
            // Falsifier languages
            Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
            Object.defineProperty(navigator, 'language', { get: () => 'fr-FR' });
            
            // Falsifier platform
            Object.defineProperty(navigator, 'platform', { get: () => profileData.platform === 'Windows' ? 'Win32' : 'MacIntel' });
            
            // Falsifier deviceMemory et hardwareConcurrency
            Object.defineProperty(navigator, 'deviceMemory', { get: () => profileData.deviceMemory });
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => profileData.hardwareConcurrency });
            
            // Masquer automation
            window.chrome = { 
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };
            
            // Falsifier permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            // Falsifier WebGL fingerprint
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) return webglData.vendor;
                if (parameter === 37446) return webglData.renderer;
                return getParameter.apply(this, arguments);
            };
            
            // Cacher les traces de headless
            Object.defineProperty(document, 'hidden', { get: () => false });
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
            
            // Falsifier les dimensions d'écran
            Object.defineProperty(screen, 'width', { get: () => profileData.viewport.width });
            Object.defineProperty(screen, 'height', { get: () => profileData.viewport.height });
            Object.defineProperty(screen, 'availWidth', { get: () => profileData.viewport.width });
            Object.defineProperty(screen, 'availHeight', { get: () => profileData.viewport.height - 40 });
            Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
            Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
            
        }, profile, webgl);

        // User-Agent
        await page.setUserAgent(profile.userAgent);
        
        // Headers avec Client Hints complets
        const secChUa = profile.brands.map(b => `"${b.brand}";v="${b.version}"`).join(', ');
        
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Sec-Ch-Ua': secChUa,
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': `"${profile.platform}"`,
            'Sec-Ch-Ua-Platform-Version': `"${profile.platformVersion}"`,
            'Sec-Ch-Ua-Full-Version-List': secChUa,
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Referer': referer,
            'DNT': '1'
        });

        // ============================================
        // GHOST MODE: BLOCAGE RESSOURCES INUTILES
        // ============================================
        await page.setRequestInterception(true);
        
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            const url = request.url().toLowerCase();
            
            // Types à bloquer
            const blockedTypes = ['image', 'stylesheet', 'font', 'media', 'texttrack', 'object', 'beacon', 'csp_report', 'imageset'];
            
            // URLs de tracking à bloquer
            const blockedUrls = [
                'google-analytics', 'googletagmanager', 'facebook', 'doubleclick', 
                'analytics', 'tracker', 'pixel', 'ads', 'adservice', 'advertising',
                'matomo', 'piwik', 'hotjar', 'fullstory', 'mixpanel', 'segment',
                'cloudflare-web-analytics', 'plausible.io', 'umami'
            ];
            
            if (blockedTypes.includes(resourceType)) {
                request.abort();
            } else if (blockedUrls.some(blocked => url.includes(blocked))) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // ============================================
        // NAVIGATION AVEC JITTER
        // ============================================
        
        // Jitter initial (800ms - 2.5s)
        await new Promise(r => setTimeout(r, randomJitter(800, 2500)));
        
        const url = `https://hawk.perimouv.fr/qrcodes/schedule.aspx?key=${stopKey}`;
        
        // Démarrer l'interception XHR en parallèle
        const xhrPromise = interceptXHR(page, stopKey);
        
        // Navigation
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 25000
        });

        // Simulation comportement humain
        await simulateHumanBehavior(page);

        // Attendre résultat XHR ou timeout
        const xhrResult = await xhrPromise;
        
        let result;
        
        if (xhrResult.type === 'xhr' && xhrResult.data) {
            // ✅ GHOST MODE OPTIMAL: Données interceptées directement via XHR
            result = parseXHRData(xhrResult.data, stopKey);
            if (result) {
                result.mode = 'ghost_xhr';
            }
        }
        
        if (!result || !result.schedules || result.schedules.length === 0) {
            // Fallback: parser le HTML
            await new Promise(r => setTimeout(r, randomJitter(300, 800)));
            const html = await page.content();
            result = parseScheduleHTML(html, stopKey);
            result.mode = 'ghost_html';
        }

        return result;

    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// ============================================
// FALLBACK: SCRAPING LÉGER (FETCH AVEC STEALTH)
// ============================================

async function scrapeLightweight(stopKey) {
    const profile = getRandomProfile();
    const referer = getRandomReferer();
    
    const url = `https://hawk.perimouv.fr/qrcodes/schedule.aspx?key=${stopKey}`;
    
    // Jitter
    await new Promise(r => setTimeout(r, randomJitter(500, 2000)));
    
    const secChUa = profile.brands.map(b => `"${b.brand}";v="${b.version}"`).join(', ');
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'User-Agent': profile.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Sec-Ch-Ua': secChUa,
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': `"${profile.platform}"`,
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Referer': referer,
            'DNT': '1'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const result = parseScheduleHTML(html, stopKey);
    result.mode = 'lightweight_stealth';
    return result;
}

// ============================================
// HANDLER PRINCIPAL VERCEL
// ============================================

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const stopKey = req.query.stop;
    
    if (!stopKey) {
        return res.status(400).json({ 
            error: 'Missing stop parameter',
            usage: '/api/realtime?stop=83'
        });
    }

    try {
        let result;
        
        // Essayer d'abord avec Puppeteer Stealth (mode Ghost)
        try {
            result = await scrapeWithPuppeteer(stopKey);
        } catch (puppeteerError) {
            console.warn('[Ghost] Puppeteer failed, using lightweight fallback:', puppeteerError.message);
            
            // Fallback: fetch avec tous les headers stealth
            result = await scrapeLightweight(stopKey);
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error('[Ghost] Critical error:', error.message);
        return res.status(500).json({
            error: 'Failed to fetch realtime data',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Configuration Vercel
export const config = {
    maxDuration: 30
};
