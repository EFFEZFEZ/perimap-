// Copyright © 2025 Périmap - Tous droits réservés
/**
 * api/fichehoraire-static.js
 * Endpoint pour servir les fiches horaires PDF
 */

import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();
const FICHE_DIR = join(__dirname, '..', '..', 'public', 'data', 'fichehoraire');

// Servir les fiches horaires PDF
router.get('/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    // Validater le nom du fichier (sécurité)
    if (!filename.match(/^[a-z0-9_-]+\.pdf$/i)) {
      return res.status(400).json({ error: 'Nom de fichier invalide' });
    }

    const filepath = join(FICHE_DIR, filename);

    // Vérifier que le fichier existe
    if (!existsSync(filepath)) {
      return res.status(404).json({ error: `Fichier ${filename} non trouvé` });
    }

    // Lire et envoyer le fichier PDF
    const pdf = readFileSync(filepath);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${filename}"`);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache 24h
    res.send(pdf);

  } catch (error) {
    console.error(`Erreur lecture fiche horaire: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
