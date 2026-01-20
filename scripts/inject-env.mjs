/**
 * inject-env.js - Script de post-build pour injecter les variables d'environnement
 * 
 * Remplace les placeholders __NEON_API_KEY__ dans les fichiers HTML du build
 * Exécuté automatiquement après le build Vite
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const DIST_DIR = resolve(process.cwd(), 'dist');

// Variables à remplacer
const ENV_REPLACEMENTS = {
  '__NEON_API_KEY__': process.env.NEON_API_KEY || '',
  '__VITE_ADMIN_TOKEN__': process.env.ADMIN_TOKEN || ''
};

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;
  
  for (const [placeholder, value] of Object.entries(ENV_REPLACEMENTS)) {
    if (content.includes(placeholder)) {
      content = content.replaceAll(placeholder, value);
      modified = true;
    }
  }
  
  if (modified) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ Injecté: ${filePath.replace(DIST_DIR, '')}`);
  }
}

function walkDir(dir) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.html') || file.endsWith('.js')) {
      processFile(filePath);
    }
  }
}

console.log('🔧 Injection des variables d\'environnement...');
console.log(`   NEON_API_KEY: ${process.env.NEON_API_KEY ? '✓ Définie' : '✗ Non définie'}`);
console.log(`   ADMIN_TOKEN: ${process.env.ADMIN_TOKEN ? '✓ Définie' : '✗ Non définie'}`);

try {
  walkDir(DIST_DIR);
  console.log('✅ Injection terminée');
} catch (error) {
  console.error('❌ Erreur lors de l\'injection:', error.message);
  process.exit(1);
}
