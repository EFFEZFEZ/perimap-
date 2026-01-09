/*
 * Copyright (c) 2025-2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */

/**
 * api/delay-stats.js - API pour la collecte et analyse des statistiques de retard
 * 
 * Endpoints:
 * - POST /api/delay-stats : Recevoir et stocker les données de retard
 * - GET /api/delay-stats : Récupérer les statistiques compilées
 * - GET /api/delay-stats/export : Exporter les données (CSV)
 * 
 * 🔴 STATUT: PRÉPARÉ POUR LE FUTUR (Serveur actuellement désactivé)
 */

/*
import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../utils/logger.js';

const router = Router();
const logger = createLogger('delay-stats');

// Base de données en fichier JSON (pour démarrage simple)
const STATS_DIR = path.join(process.cwd(), 'data', 'delay-stats');
const STATS_FILE = path.join(STATS_DIR, 'stats.json');

// Initialiser le répertoire
async function ensureStatsDir() {
    try {
        await fs.mkdir(STATS_DIR, { recursive: true });
    } catch (error) {
        logger.error('Impossible de créer le répertoire de stats:', error);
    }
}

// Charger les stats existantes
async function loadStats() {
    try {
        const data = await fs.readFile(STATS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // Fichier n'existe pas encore
        return {
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            observations: []
        };
    }
}

// Sauvegarder les stats
async function saveStats(stats) {
    try {
        await ensureStatsDir();
        await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
        return true;
    } catch (error) {
        logger.error('Erreur lors de la sauvegarde des stats:', error);
        return false;
    }
}

/**
 * POST /api/delay-stats
 * Recevoir et stocker les données de retard depuis le client
 */
router.post('/', async (req, res) => {
    try {
        const { timestamp, stats, history } = req.body;

        if (!stats || !history) {
            return res.status(400).json({ error: 'Données invalides' });
        }

        // Charger les stats existantes
        const currentStats = await loadStats();

        // Ajouter les nouvelles observations
        if (history && Array.isArray(history)) {
            currentStats.observations.push(...history.map(obs => ({
                ...obs,
                receivedAt: new Date().toISOString()
            })));
        }

        // Garder seulement les 100 000 dernières observations
        if (currentStats.observations.length > 100000) {
            currentStats.observations = currentStats.observations.slice(-100000);
        }

        // Mettre à jour les metadata
        currentStats.updated = new Date().toISOString();
        currentStats.lastBatch = timestamp;
        currentStats.totalObservations = currentStats.observations.length;

        // Sauvegarder
        const saved = await saveStats(currentStats);

        if (saved) {
            logger.info(`✅ ${history.length} observations reçues et sauvegardées`);
            res.json({ 
                success: true, 
                message: 'Données reçues et sauvegardées',
                totalObservations: currentStats.observations.length
            });
        } else {
            res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
        }
    } catch (error) {
        logger.error('Erreur lors de la réception des stats:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/delay-stats
 * Récupérer les statistiques compilées
 */
router.get('/', async (req, res) => {
    try {
        const stats = await loadStats();

        // Compiler les statistiques
        const compiled = {
            totalObservations: stats.observations.length,
            dateRange: {
                earliest: stats.observations[0]?.timestamp,
                latest: stats.observations[stats.observations.length - 1]?.timestamp
            },
            
            // Statistiques par ligne
            byLine: compileByLine(stats.observations),
            
            // Statistiques par heure
            byHour: compileByHour(stats.observations),
            
            // Arrêts les plus affectés
            worstStops: compileWorstStops(stats.observations),

            lastUpdate: stats.updated
        };

        res.json(compiled);
    } catch (error) {
        logger.error('Erreur lors de la lecture des stats:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/delay-stats/export
 * Exporter les données au format CSV
 */
router.get('/export', async (req, res) => {
    try {
        const stats = await loadStats();
        const format = req.query.format || 'csv';

        if (format === 'csv') {
            const csv = generateCSV(stats.observations);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="delay-stats.csv"');
            res.send(csv);
        } else if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename="delay-stats.json"');
            res.json(stats.observations);
        } else {
            res.status(400).json({ error: 'Format non supporté' });
        }
    } catch (error) {
        logger.error('Erreur lors de l\'export:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ============ HELPERS COMPILATION STATS ============

function compileByLine(observations) {
    const byLine = {};

    observations.forEach(obs => {
        if (!byLine[obs.lineId]) {
            byLine[obs.lineId] = {
                totalDelay: 0,
                count: 0,
                maxDelay: 0,
                minDelay: 0,
                majorDelayCount: 0
            };
        }

        const line = byLine[obs.lineId];
        line.totalDelay += obs.delaySeconds;
        line.count++;
        line.maxDelay = Math.max(line.maxDelay, obs.delaySeconds);
        line.minDelay = Math.min(line.minDelay, obs.delaySeconds);
        if (obs.isMajor) line.majorDelayCount++;
    });

    // Formater en array trié
    return Object.entries(byLine)
        .map(([lineId, data]) => ({
            lineId,
            averageDelay: Math.round(data.totalDelay / data.count),
            maxDelay: data.maxDelay,
            minDelay: data.minDelay,
            majorDelayCount: data.majorDelayCount,
            observations: data.count
        }))
        .sort((a, b) => b.observations - a.observations);
}

function compileByHour(observations) {
    const byHour = {};

    observations.forEach(obs => {
        const hour = obs.hour || 0;
        const hourKey = `${String(hour).padStart(2, '0')}:00`;

        if (!byHour[hourKey]) {
            byHour[hourKey] = { totalDelay: 0, count: 0 };
        }

        byHour[hourKey].totalDelay += obs.delaySeconds;
        byHour[hourKey].count++;
    });

    return Object.entries(byHour)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([hour, data]) => ({
            hour,
            averageDelay: Math.round(data.totalDelay / data.count),
            observations: data.count
        }));
}

function compileWorstStops(observations) {
    const byStop = {};

    observations.forEach(obs => {
        if (!byStop[obs.stopId]) {
            byStop[obs.stopId] = { totalDelay: 0, count: 0 };
        }

        byStop[obs.stopId].totalDelay += obs.delaySeconds;
        byStop[obs.stopId].count++;
    });

    return Object.entries(byStop)
        .map(([stopId, data]) => ({
            stopId,
            averageDelay: Math.round(data.totalDelay / data.count),
            observations: data.count
        }))
        .sort((a, b) => b.averageDelay - a.averageDelay)
        .slice(0, 10);
}

function generateCSV(observations) {
    const headers = ['timestamp', 'tripId', 'lineId', 'delaySeconds', 'isMajor', 'stopId', 'hour'];
    
    let csv = headers.join(',') + '\n';
    
    observations.forEach(obs => {
        const row = [
            obs.timestamp || '',
            obs.tripId || '',
            obs.lineId || '',
            obs.delaySeconds || 0,
            obs.isMajor ? 'true' : 'false',
            obs.stopId || '',
            obs.hour || 0
        ];
        csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    return csv;
}

export default router;
*/

// Version non-commentée avec export vide pour l'instant
export default {};
