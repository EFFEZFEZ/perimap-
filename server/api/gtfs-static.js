// Copyright © 2025 Périmap - Tous droits réservés
/**
 * api/gtfs-static.js
 * Endpoint pour servir les fichiers GTFS statiques
 */

import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();
const GTFS_DIR = join(__dirname, '..', '..', 'public', 'data', 'gtfs');
const fileCache = new Map();

router.get('/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename.match(/^[a-z_]+\.(txt|json|gz|br)$/)) {
      return res.status(400).json({ error: 'Nom de fichier invalide' });
    }

    const filepath = join(GTFS_DIR, filename);
    if (!existsSync(filepath)) {
      return res.status(404).json({ error: `Fichier ${filename} non trouvé` });
    }

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
