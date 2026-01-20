/**
 * Script pour extraire les données des pages horaires statiques
 * et générer un fichier JSON centralisé
 * 
 * Usage: node tools/extract-line-data.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const outputFile = join(publicDir, 'data', 'lines-config.json');

function extractLineData(htmlContent, filename) {
    const lineIdMatch = htmlContent.match(/LINE_CONFIG\s*=\s*\{[^}]*id:\s*['"]([^'"]+)['"]/s);
    const routeIdMatch = htmlContent.match(/routeId:\s*['"]([^'"]+)['"]/);
    const colorMatch = htmlContent.match(/color:\s*['"]([^'"]+)['"]/);
    const routeShapeMatch = htmlContent.match(/const\s+ROUTE_SHAPE\s*=\s*(\[\[[\d.,\s\[\]]+\]\]);?/);
    const stopsMatch = htmlContent.match(/stops:\s*(\[[^\]]*\{[^]*?\}\s*\])/s);

    if (!lineIdMatch) {
        console.warn(`⚠️ Pas de LINE_CONFIG trouvé dans ${filename}`);
        return null;
    }

    const lineId = lineIdMatch[1];
    const routeId = routeIdMatch ? routeIdMatch[1] : '';
    const color = colorMatch ? colorMatch[1] : '#107f73';
    
    let routeShape = [];
    if (routeShapeMatch) {
        try {
            routeShape = JSON.parse(routeShapeMatch[1]);
        } catch (e) {
            console.warn(`⚠️ Erreur parsing ROUTE_SHAPE pour ${lineId}:`, e.message);
        }
    }

    let stops = [];
    if (stopsMatch) {
        try {
            // Nettoyer le JSON (enlever les virgules trailing, etc.)
            let stopsJson = stopsMatch[1]
                .replace(/,\s*]/g, ']')
                .replace(/,\s*}/g, '}');
            stops = JSON.parse(stopsJson);
        } catch (e) {
            console.warn(`⚠️ Erreur parsing stops pour ${lineId}:`, e.message);
        }
    }

    // Extraire les FAQ
    const faqItems = [];
    const faqRegex = /<details class="faq-item">\s*<summary>([^<]+)<\/summary>\s*<div class="faq-answer">\s*([\s\S]*?)\s*<\/div>\s*<\/details>/g;
    let match;
    while ((match = faqRegex.exec(htmlContent)) !== null) {
        faqItems.push({
            question: match[1].trim(),
            answer: match[2].trim().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        });
    }

    // Extraire le lien PDF
    const pdfMatch = htmlContent.match(/href="([^"]*fiche_horaires[^"]*\.pdf)"/i);
    const pdfUrl = pdfMatch ? pdfMatch[1] : null;

    return {
        id: lineId,
        routeId,
        color,
        routeShape,
        stops,
        faq: faqItems,
        pdfUrl
    };
}

// Lister tous les fichiers horaires-ligne-*.html
const files = readdirSync(publicDir).filter(f => f.match(/^horaires-ligne-[a-z0-9]+\.html$/i));

console.log(`📂 Trouvé ${files.length} fichiers horaires\n`);

const linesData = {};

for (const file of files) {
    const filePath = join(publicDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const data = extractLineData(content, file);
    
    if (data) {
        linesData[data.id.toLowerCase()] = data;
        console.log(`✅ ${data.id}: ${data.stops.length} arrêts, ${data.routeShape.length} points`);
    }
}

// Écrire le fichier JSON
const output = {
    version: '1.0.0',
    generated: new Date().toISOString(),
    linesCount: Object.keys(linesData).length,
    lines: linesData
};

writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf-8');

console.log(`\n✅ Données exportées vers ${outputFile}`);
console.log(`📊 ${Object.keys(linesData).length} lignes traitées`);
