// Copyright © 2025 Périmap - Tous droits réservés
/**
 * api/gtfs-static.js
 * Endpoint pour servir les fichiers GTFS statiques
 */

import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();
// Chemin absolu vers les fichiers GTFS
const GTFS_DIR = resolve(join(__dirname, '..', '..', 'public', 'data', 'gtfs'));
const fileCache = new Map();

console.log('[GTFS API] Chemin GTFS:', GTFS_DIR);

router.get('/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validater le nom du fichier (sécurité)
    if (!filename.match(/^[a-z0-9_-]+\.(txt|json|gz|br)$/i)) {
      return res.status(400).json({ error: 'Nom de fichier invalide' });
    }

    const filepath = join(GTFS_DIR, filename);
    
    // Log de debug
    console.log(`[GTFS API] Demande: ${filename} -> ${filepath}`);
    
    if (!existsSync(filepath)) {
      console.error(`[GTFS API] ❌ Fichier non trouvé: ${filepath}`);
      return res.status(404).json({ 
        error: `Fichier ${filename} non trouvé`,
        path: filepath 
      });
    }

    // Lire le fichier
    const data = readFileSync(filepath);
    
    // Servir avec le bon content-type
    const contentType = filename.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(data);
    
    console.log(`[GTFS API] ✅ ${filename} servi (${data.length} bytes)`);

  } catch (error) {
    console.error(`[GTFS API] Erreur:`, error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

    let data;
    if (fileCache.has(filename)) {
      data = fileCache.get(filename);
    } else {
      data = readFileSync(filepath);
      if (Buffer.byteLength(data) < 1024 * 1024) {
        fileCache.set(filename, data);
      }
    }

    res.set('Content-Type', filename.endsWith('.json') || filename.endsWith('.gz') ? 'application/octet-stream' : 'text/plain; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
