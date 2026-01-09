/*
 * Copyright (c) 2026-2026 Périmap. Tous droits réservés.
 * Ce code ne peut être ni copié, ni distribué, ni modifié sans l'autorisation écrite de l'auteur.
 */

/**
 * delayStatsUI.js - Interface utilisateur pour les statistiques de retard
 * 
 * Fonctionnalités:
 * - Affichage des statistiques compilées
 * - Graphiques par ligne, par heure
 * - Export des données (CSV/JSON)
 * - Vue détaillée des retards
 */

export class DelayStatsUI {
    constructor(delayManager) {
        this.delayManager = delayManager;
        this.container = null;
        this.isOpen = false;
    }

    /**
     * Initialise l'interface et ajoute le bouton d'accès
     */
    init() {
        // Créer le bouton de statistiques
        const statsButton = document.createElement('button');
        statsButton.id = 'delay-stats-btn';
        statsButton.className = 'delay-stats-toggle';
        statsButton.innerHTML = '📊 Retards';
        statsButton.title = 'Voir les statistiques de retard';
        statsButton.addEventListener('click', () => this.toggle());

        // Chercher un container pour le bouton (par exemple près des contrôles de carte)
        const controlArea = document.querySelector('[data-role="map-controls"]') || 
                          document.querySelector('.leaflet-control-container') ||
                          document.body;
        
        if (controlArea) {
            const wrapper = document.createElement('div');
            wrapper.className = 'delay-stats-button-wrapper';
            wrapper.appendChild(statsButton);
            controlArea.insertBefore(wrapper, controlArea.firstChild);
        }

        // Créer le container principal
        this.container = document.createElement('div');
        this.container.id = 'delay-stats-panel';
        this.container.className = 'delay-stats-panel';
        this.container.innerHTML = this.createPanelHTML();
        document.body.appendChild(this.container);

        // Attacher les événements
        this.attachEventListeners();

        console.log('[DelayStatsUI] ✅ Interface initialisée');
    }

    /**
     * Bascule l'affichage du panneau
     */
    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    /**
     * Ouvre le panneau
     */
    open() {
        if (!this.container) return;
        
        // Mettre à jour les stats
        this.updateStats();
        
        this.container.classList.add('open');
        this.isOpen = true;
        document.body.style.overflow = 'hidden';
    }

    /**
     * Ferme le panneau
     */
    close() {
        if (!this.container) return;
        
        this.container.classList.remove('open');
        this.isOpen = false;
        document.body.style.overflow = '';
    }

    /**
     * Met à jour l'affichage des statistiques
     */
    updateStats() {
        const stats = this.delayManager.getDelayStats();
        const statsContent = this.container?.querySelector('.stats-content');
        
        if (!statsContent) return;

        // Remplir les chiffres principaux
        this.container.querySelector('.total-observations').textContent = stats.totalObservations.toLocaleString();

        // Générer les tableaux
        const lineStatsHtml = this.generateLineStatsTable(stats.lineStats);
        const hourlyStatsHtml = this.generateHourlyStatsTable(stats.hourlyStats);
        const worstStopsHtml = this.generateWorstStopsTable(stats.worstStops);

        statsContent.innerHTML = `
            <div class="stats-section">
                <h3>📍 Statistiques par ligne</h3>
                <div class="stats-table-container">
                    ${lineStatsHtml}
                </div>
            </div>

            <div class="stats-section">
                <h3>⏰ Statistiques par heure</h3>
                <div class="stats-chart-container">
                    ${hourlyStatsHtml}
                </div>
            </div>

            <div class="stats-section">
                <h3>🚏 Arrêts les plus affectés</h3>
                <div class="stats-table-container">
                    ${worstStopsHtml}
                </div>
            </div>
        `;
    }

    /**
     * Génère le tableau des stats par ligne
     */
    generateLineStatsTable(lineStats) {
        if (!lineStats || lineStats.length === 0) {
            return '<p class="no-data">Aucune donnée de retard collectée</p>';
        }

        const rows = lineStats.map(line => `
            <tr>
                <td class="line-cell"><strong>Ligne ${line.lineId}</strong></td>
                <td class="number">${this.formatDelay(line.averageDelay)}</td>
                <td class="number">${this.formatDelay(line.maxDelay)}</td>
                <td class="number-minor">${line.majorDelayCount}</td>
                <td class="number-minor">${line.observations}</td>
            </tr>
        `).join('');

        return `
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>Ligne</th>
                        <th title="Retard moyen">Moy.</th>
                        <th title="Retard maximal">Max</th>
                        <th title="Retards > 5 min">Majeurs</th>
                        <th title="Nombre d'observations">Obs.</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    /**
     * Génère le graphique par heure
     */
    generateHourlyStatsTable(hourlyStats) {
        if (!hourlyStats || hourlyStats.length === 0) {
            return '<p class="no-data">Aucune donnée horaire</p>';
        }

        // Trouver le retard max pour la mise à l'échelle
        const maxDelay = Math.max(...hourlyStats.map(h => h.averageDelay));

        const rows = hourlyStats.map(hour => {
            const barWidth = (hour.averageDelay / maxDelay) * 100;
            return `
                <div class="hour-row">
                    <span class="hour-label">${hour.hour}</span>
                    <div class="hour-bar-container">
                        <div class="hour-bar" style="width: ${barWidth}%"></div>
                    </div>
                    <span class="hour-value">${this.formatDelay(hour.averageDelay)}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="hourly-chart">
                ${rows}
            </div>
        `;
    }

    /**
     * Génère le tableau des arrêts affectés
     */
    generateWorstStopsTable(worstStops) {
        if (!worstStops || worstStops.length === 0) {
            return '<p class="no-data">Aucun arrêt affecté</p>';
        }

        const rows = worstStops.map((stop, idx) => `
            <tr>
                <td class="rank">#${idx + 1}</td>
                <td class="stop-id">${stop.stopId}</td>
                <td class="number">${this.formatDelay(stop.averageDelay)}</td>
                <td class="number-minor">${stop.observations}</td>
            </tr>
        `).join('');

        return `
            <table class="stats-table stats-table-compact">
                <thead>
                    <tr>
                        <th>Rang</th>
                        <th>Arrêt</th>
                        <th>Retard moyen</th>
                        <th>Obs.</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }

    /**
     * Crée le HTML du panneau principal
     */
    createPanelHTML() {
        return `
            <div class="stats-panel-header">
                <h2>📊 Statistiques de retard</h2>
                <button class="close-btn" aria-label="Fermer">&times;</button>
            </div>

            <div class="stats-panel-body">
                <div class="stats-header-info">
                    <div class="stat-card">
                        <span class="stat-label">Observations collectées</span>
                        <span class="stat-value total-observations">0</span>
                    </div>
                </div>

                <div class="stats-actions">
                    <button class="action-btn" id="stats-export-csv">
                        📥 Exporter CSV
                    </button>
                    <button class="action-btn" id="stats-export-json">
                        📥 Exporter JSON
                    </button>
                    <button class="action-btn action-danger" id="stats-clear">
                        🗑️ Effacer
                    </button>
                </div>

                <div class="stats-content">
                    <p class="loading">Chargement des statistiques...</p>
                </div>
            </div>
        `;
    }

    /**
     * Attache les événements du panneau
     */
    attachEventListeners() {
        // Bouton fermer
        this.container?.querySelector('.close-btn')?.addEventListener('click', () => this.close());

        // Boutons d'export
        this.container?.querySelector('#stats-export-csv')?.addEventListener('click', () => this.exportCSV());
        this.container?.querySelector('#stats-export-json')?.addEventListener('click', () => this.exportJSON());
        this.container?.querySelector('#stats-clear')?.addEventListener('click', () => this.clearData());

        // Fermer au clic en dehors
        this.container?.addEventListener('click', (e) => {
            if (e.target === this.container) {
                this.close();
            }
        });
    }

    /**
     * Exporte les stats en CSV
     */
    exportCSV() {
        const csv = this.delayManager.exportStats('csv');
        const blob = new Blob([csv], { type: 'text/csv' });
        this.downloadFile(blob, 'perimap-delay-stats.csv');
    }

    /**
     * Exporte les stats en JSON
     */
    exportJSON() {
        const stats = this.delayManager.exportStats('json');
        const json = JSON.stringify(stats, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        this.downloadFile(blob, 'perimap-delay-stats.json');
    }

    /**
     * Efface les statistiques
     */
    clearData() {
        if (!confirm('Êtes-vous sûr ? Cette action ne peut pas être annulée.')) {
            return;
        }

        this.delayManager.clearStorage();
        this.updateStats();
        alert('✅ Toutes les statistiques ont été effacées');
    }

    /**
     * Télécharge un fichier
     */
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Formate un retard en minutes:secondes
     */
    formatDelay(seconds) {
        if (!seconds) return '0 sec';
        const minutes = Math.floor(Math.abs(seconds) / 60);
        const secs = Math.abs(seconds) % 60;
        const sign = seconds < 0 ? '-' : '';
        
        if (minutes === 0) {
            return `${sign}${secs}s`;
        }
        return `${sign}${minutes}m ${secs}s`;
    }
}

