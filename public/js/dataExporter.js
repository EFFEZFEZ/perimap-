/**
 * dataExporter.js - Console d'extraction de données analytiques
 * Interface visuelle simple comme Google Search Console
 */

export class DataExporterUI {
    constructor() {
        this.isOpen = false;
        this.currentTab = 'summary';
        this.panel = null;
        this.isAdminMode = this.checkAdminMode();
    }

    /**
     * Vérifier si on est en mode admin
     */
    checkAdminMode() {
        // Vérifier si admin token existe
        const adminToken = window.__ADMIN_TOKEN || window.__APP_CONFIG?.adminToken;
        const hasAdminMeta = document.querySelector('meta[name="peribus-admin-token"]');
        return !!(adminToken || hasAdminMeta);
    }

    /**
     * Initialiser (aucun bouton visible sauf en mode admin)
     */
    init() {
        // Créer le panneau (caché par défaut)
        this.panel = document.createElement('div');
        this.panel.id = 'data-exporter-panel';
        this.panel.className = 'data-exporter-panel';
        this.panel.innerHTML = this.createPanelHTML();
        document.body.appendChild(this.panel);

        this.attachEvents();

        // Charger CSS seulement si admin
        if (this.isAdminMode) {
            this.loadCSS();
        }

        // Ajouter un bouton au menu admin s'il existe
        this.addToAdminMenu();

        // Keyboard shortcut: Alt+D pour admin
        if (this.isAdminMode) {
            document.addEventListener('keydown', (e) => {
                if (e.altKey && e.key.toLowerCase() === 'd') {
                    this.toggle();
                }
            });
            console.log('[DataExporter] ✅ Console admin initialisée (Alt+D)');
        }
    }

    /**
     * Charger le CSS dynamiquement
     */
    loadCSS() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/data-exporter.css';
        document.head.appendChild(link);
    }

    /**
     * Ajouter un bouton au menu admin
     */
    addToAdminMenu() {
        // Chercher un menu admin ou un élément avec data-admin
        const adminMenu = document.querySelector('[data-admin-menu]') || 
                          document.querySelector('.admin-menu') ||
                          document.getElementById('admin-menu');
        
        if (adminMenu && this.isAdminMode) {
            const btn = document.createElement('button');
            btn.className = 'admin-menu-item admin-analytics-btn';
            btn.innerHTML = '📊 Analytics';
            btn.title = 'Ouvrir la console de données (Alt+D)';
            btn.addEventListener('click', () => this.toggle());
            adminMenu.appendChild(btn);
        }
    }

    /**
     * Créer le HTML du panneau
     */
    createPanelHTML() {
        return `
            <div class="exporter-header">
                <div class="exporter-title">📊 Données analytiques</div>
                <button class="exporter-close">&times;</button>
            </div>

            <div class="exporter-tabs">
                <button class="exporter-tab active" data-tab="summary">Résumé</button>
                <button class="exporter-tab" data-tab="stops">Arrêts</button>
                <button class="exporter-tab" data-tab="delays">Retards</button>
                <button class="exporter-tab" data-tab="export">Export</button>
            </div>

            <div class="exporter-content">
                <!-- Résumé -->
                <div class="exporter-tab-content active" id="tab-summary">
                    <div class="summary-stats"></div>
                </div>

                <!-- Arrêts -->
                <div class="exporter-tab-content" id="tab-stops">
                    <div class="stops-table"></div>
                </div>

                <!-- Retards -->
                <div class="exporter-tab-content" id="tab-delays">
                    <div class="delays-content"></div>
                </div>

                <!-- Export -->
                <div class="exporter-tab-content" id="tab-export">
                    <div class="export-buttons">
                        <button class="export-btn" data-format="stops-csv">📥 Arrêts (CSV)</button>
                        <button class="export-btn" data-format="delays-csv">📥 Retards (CSV)</button>
                        <button class="export-btn" data-format="all-json">📥 Tout (JSON)</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attacher les événements
     */
    attachEvents() {
        // Tabs
        this.panel.querySelectorAll('.exporter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Fermer
        this.panel.querySelector('.exporter-close').addEventListener('click', () => this.close());

        // Export
        this.panel.querySelectorAll('.export-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.export(e.target.dataset.format));
        });
    }

    /**
     * Basculer la vue
     */
    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    /**
     * Ouvrir
     */
    open() {
        this.panel.classList.add('open');
        this.isOpen = true;
        this.refreshData();
    }

    /**
     * Fermer
     */
    close() {
        this.panel.classList.remove('open');
        this.isOpen = false;
    }

    /**
     * Changer d'onglet
     */
    switchTab(tab) {
        this.currentTab = tab;

        // Tabs
        this.panel.querySelectorAll('.exporter-tab').forEach(t => {
            t.classList.remove('active');
        });
        this.panel.querySelector(`[data-tab="${tab}"]`).classList.add('active');

        // Contenu
        this.panel.querySelectorAll('.exporter-tab-content').forEach(c => {
            c.classList.remove('active');
        });
        this.panel.querySelector(`#tab-${tab}`).classList.add('active');

        this.refreshData();
    }

    /**
     * Rafraîchir les données affichées
     */
    refreshData() {
        switch(this.currentTab) {
            case 'summary':
                this.showSummary();
                break;
            case 'stops':
                this.showStops();
                break;
            case 'delays':
                this.showDelays();
                break;
        }
    }

    /**
     * Afficher le résumé
     */
    showSummary() {
        const summary = this.panel.querySelector('.summary-stats');
        const stops = DataExporter.getStopStats();
        const delays = DataExporter.getDelayStats();

        let html = '<div class="stat-cards">';

        if (stops && stops.length > 0) {
            html += `
                <div class="stat-card">
                    <div class="stat-label">Arrêt #1</div>
                    <div class="stat-value">Stop ${stops[0].stopId}</div>
                    <div class="stat-detail">${stops[0].clicks} clics</div>
                </div>
            `;
        }

        if (delays && delays.lineStats.length > 0) {
            const topDelay = delays.lineStats[0];
            html += `
                <div class="stat-card">
                    <div class="stat-label">Ligne retardée</div>
                    <div class="stat-value">${topDelay.lineId}</div>
                    <div class="stat-detail">${Math.floor(topDelay.averageDelay/60)}m moyen</div>
                </div>
            `;
        }

        html += `
            <div class="stat-card">
                <div class="stat-label">Total observations</div>
                <div class="stat-value">${delays ? delays.totalObservations : 0}</div>
            </div>
        </div>`;

        summary.innerHTML = html;
    }

    /**
     * Afficher les arrêts
     */
    showStops() {
        const table = this.panel.querySelector('.stops-table');
        const stops = DataExporter.getStopStats();

        if (!stops || stops.length === 0) {
            table.innerHTML = '<p class="no-data">Aucune donnée</p>';
            return;
        }

        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Rang</th>
                        <th>Stop ID</th>
                        <th>Clics</th>
                    </tr>
                </thead>
                <tbody>
        `;

        stops.slice(0, 20).forEach((s, i) => {
            html += `<tr><td>${i+1}</td><td>${s.stopId}</td><td>${s.clicks}</td></tr>`;
        });

        html += '</tbody></table>';
        table.innerHTML = html;
    }

    /**
     * Afficher les retards
     */
    showDelays() {
        const content = this.panel.querySelector('.delays-content');
        const delays = DataExporter.getDelayStats();

        if (!delays) {
            content.innerHTML = '<p class="no-data">Aucune donnée</p>';
            return;
        }

        let html = '<div class="delays-tabs">';

        // Tab Lignes
        html += '<div class="delays-section"><h3>Par ligne</h3>';
        html += '<table class="data-table"><thead><tr><th>Ligne</th><th>Moyen</th><th>Max</th><th>Majeurs</th></tr></thead><tbody>';
        delays.lineStats.forEach(line => {
            const avgMin = Math.floor(line.averageDelay / 60);
            const maxMin = Math.floor(line.maxDelay / 60);
            html += `<tr><td>${line.lineId}</td><td>${avgMin}m</td><td>${maxMin}m</td><td>${line.majorDelayCount}</td></tr>`;
        });
        html += '</tbody></table></div>';

        // Tab Heures
        html += '<div class="delays-section"><h3>Par heure (top 10)</h3>';
        html += '<table class="data-table"><thead><tr><th>Heure</th><th>Retard moyen</th><th>Obs</th></tr></thead><tbody>';
        delays.hourlyStats.slice(0, 10).forEach(hour => {
            const avgMin = Math.floor(hour.averageDelay / 60);
            html += `<tr><td>${hour.hour}</td><td>${avgMin}m</td><td>${hour.observations}</td></tr>`;
        });
        html += '</tbody></table></div>';

        html += '</div>';
        content.innerHTML = html;
    }

    /**
     * Exporter les données
     */
    export(format) {
        switch(format) {
            case 'stops-csv':
                DataExporter.exportStopsToCSV();
                break;
            case 'delays-csv':
                DataExporter.exportDelaysToCSV();
                break;
            case 'all-json':
                DataExporter.exportAllJSON();
                break;
        }
    }
}

export class DataExporter {
    /**
     * Arrêts les plus fréquentés (depuis analyticsManager)
     */
    static getStopStats() {
        if (typeof analyticsManager === 'undefined') {
            console.warn('analyticsManager non disponible');
            return null;
        }

        // Récupérer les clicks par arrêt
        const stops = analyticsManager.stopClickStats || new Map();
        
        const stats = Array.from(stops.entries())
            .map(([stopId, count]) => ({
                stopId,
                clicks: count,
                frequency: 'high'
            }))
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 50); // Top 50

        console.log(`📊 ${stats.length} arrêts les plus fréquentés:`);
        stats.forEach((s, i) => {
            console.log(`${i+1}. Stop ${s.stopId}: ${s.clicks} clics`);
        });

        return stats;
    }

    /**
     * Retards par ligne et heure
     */
    static getDelayStats() {
        if (typeof delayManager === 'undefined') {
            console.warn('delayManager non disponible');
            return null;
        }

        const stats = delayManager.getDelayStats();

        console.log('\n📈 RETARDS PAR LIGNE:');
        stats.lineStats.forEach(line => {
            console.log(`
Ligne ${line.lineId}:
  - Retard moyen: ${Math.floor(line.averageDelay/60)}m ${line.averageDelay%60}s
  - Retard max: ${Math.floor(line.maxDelay/60)}m
  - Retards majeurs (>5min): ${line.majorDelayCount}
  - Observations: ${line.observations}`);
        });

        console.log('\n⏰ RETARDS PAR HEURE:');
        stats.hourlyStats.forEach(hour => {
            console.log(`${hour.hour}: ${Math.floor(hour.averageDelay/60)}m avg (${hour.observations} obs)`);
        });

        console.log('\n🚏 ARRÊTS LES PLUS AFFECTÉS:');
        stats.worstStops.slice(0, 10).forEach((stop, i) => {
            console.log(`${i+1}. Stop ${stop.stopId}: ${Math.floor(stop.averageDelay/60)}m avg`);
        });

        return stats;
    }

    /**
     * Exporter arrêts en CSV
     */
    static exportStopsToCSV() {
        const stops = this.getStopStats();
        if (!stops) return;

        let csv = 'Rang,Stop ID,Clics\n';
        stops.forEach((s, i) => {
            csv += `${i+1},${s.stopId},${s.clicks}\n`;
        });

        this.downloadFile(csv, 'stops_frequents.csv');
    }

    /**
     * Exporter retards en CSV
     */
    static exportDelaysToCSV() {
        const stats = delayManager.getDelayStats();
        if (!stats) return;

        // CSV par ligne
        let csv = 'Ligne,Retard Moyen (sec),Retard Max (sec),Majeurs,Observations\n';
        stats.lineStats.forEach(line => {
            csv += `${line.lineId},${line.averageDelay},${line.maxDelay},${line.majorDelayCount},${line.observations}\n`;
        });

        this.downloadFile(csv, 'retards_par_ligne.csv');

        // CSV par heure
        csv = 'Heure,Retard Moyen (sec),Observations\n';
        stats.hourlyStats.forEach(hour => {
            csv += `${hour.hour},${hour.averageDelay},${hour.observations}\n`;
        });

        this.downloadFile(csv, 'retards_par_heure.csv');
    }

    /**
     * Exporter tout en JSON
     */
    static exportAllJSON() {
        const data = {
            timestamp: new Date().toISOString(),
            stops: this.getStopStats(),
            delays: delayManager.getDelayStats(),
            rawHistory: delayManager.delayHistory.slice(-1000) // Dernier 1000
        };

        const json = JSON.stringify(data, null, 2);
        this.downloadFile(json, 'perimap_data_export.json', 'application/json');
    }

    /**
     * Télécharger un fichier
     */
    static downloadFile(content, filename, type = 'text/csv') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log(`✅ Fichier téléchargé: ${filename}`);
    }

    /**
     * Résumé court
     */
    static summary() {
        console.clear();
        console.log('═══════════════════════════════════════════');
        console.log('📊 EXTRAIT DES DONNÉES ANALYTIQUES');
        console.log('═══════════════════════════════════════════');
        
        const stops = this.getStopStats();
        const delays = this.getDelayStats();

        if (stops && stops.length > 0) {
            console.log(`\n🏆 Arrêt #1: Stop ${stops[0].stopId} (${stops[0].clicks} clics)`);
        }

        if (delays) {
            const topDelay = delays.lineStats[0];
            if (topDelay) {
                console.log(`\n⚠️ Ligne la plus retardée: ${topDelay.lineId} (${Math.floor(topDelay.averageDelay/60)}m moyen)`);
            }
        }

        console.log('\n═══════════════════════════════════════════');
        console.log('Commandes disponibles:');
        console.log('  DataExporter.getStopStats()      → Arrêts');
        console.log('  DataExporter.getDelayStats()     → Retards');
        console.log('  DataExporter.exportStopsToCSV()  → Téléch. CSV');
        console.log('  DataExporter.exportDelaysToCSV() → Téléch. CSV');
        console.log('  DataExporter.exportAllJSON()     → Tout en JSON');
        console.log('═══════════════════════════════════════════\n');
    }
}

// Exposer globalement
if (typeof window !== 'undefined') {
    window.DataExporter = DataExporter;
    window.getStops = () => DataExporter.getStopStats();
    window.getDelays = () => DataExporter.getDelayStats();
    window.exportData = () => DataExporter.exportAllJSON();
}

export default DataExporter;
