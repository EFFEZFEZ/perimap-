# 📈 PLAN B: Dashboard Analytics Externe

Si vous décidez de passer à la VERSION 2 (site séparé), voici la structure:

## 🎯 Objectif
- Site principal: `peribus.fr` (léger, zéro UI analytics)
- Dashboard: `analytics.peribus.fr` (ou `/admin/analytics`)
- Communication: API REST

## 📁 Structure du dashboard

```
peribus-analytics-dashboard/
├── index.html
├── css/
│   ├── style.css
│   └── dashboard.css
├── js/
│   ├── app.js          (Bootstrap + init)
│   ├── api.js          (Fetch wrapper)
│   ├── auth.js         (Token admin)
│   ├── ui/
│   │   ├── tabs.js
│   │   ├── charts.js
│   │   └── tables.js
│   └── utils/
│       ├── formatters.js
│       └── export.js
├── package.json
└── README.md
```

## 🔌 API à créer/activer

### 1. POST /api/delay-stats/record
**Depuis:** delayManager.js (site principal)
```javascript
POST /api/delay-stats/record
{
  "tripId": "A-001",
  "delaySeconds": 180,
  "stopId": "STOP-123",
  "isMajor": false,
  "timestamp": 1234567890
}
```

### 2. GET /api/delay-stats/summary
**Vers:** Dashboard (résumé)
```json
{
  "totalObservations": 1523,
  "averageDelay": 240,
  "majorDelayCount": 45,
  "mostAffectedLine": "A",
  "peakHour": 17,
  "lastUpdate": "2024-01-09T15:30:00Z"
}
```

### 3. GET /api/delay-stats/stops
**Vers:** Dashboard (top arrêts)
```json
[
  { "stopId": "STOP-123", "count": 156, "avgDelay": 240 },
  { "stopId": "STOP-456", "count": 142, "avgDelay": 210 }
]
```

### 4. GET /api/delay-stats/lines
**Vers:** Dashboard (par ligne)
```json
[
  { "lineId": "A", "avgDelay": 240, "observations": 400 },
  { "lineId": "B", "avgDelay": 180, "observations": 350 }
]
```

### 5. GET /api/delay-stats/hourly
**Vers:** Dashboard (par heure)
```json
[
  { "hour": 6, "avgDelay": 120, "count": 10 },
  { "hour": 7, "avgDelay": 180, "count": 45 }
]
```

### 6. GET /api/delay-stats/export?format=csv|json
**Vers:** Dashboard (téléchargement)

---

## 📊 HTML Dashboard minimal

```html
<!DOCTYPE html>
<html>
<head>
    <title>Péribus Analytics</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header class="header">
            <h1>📊 Péribus Analytics</h1>
            <button id="logout">Déconnexion</button>
        </header>

        <!-- Tabs -->
        <div class="tabs">
            <button class="tab-btn active" data-tab="summary">Résumé</button>
            <button class="tab-btn" data-tab="delays">Retards</button>
            <button class="tab-btn" data-tab="stops">Arrêts</button>
            <button class="tab-btn" data-tab="export">Export</button>
        </div>

        <!-- Contenu -->
        <div class="content">
            <!-- Summary -->
            <div id="summary" class="tab-content active">
                <div class="stat-cards">
                    <div class="stat-card">
                        <span class="label">Observations</span>
                        <span id="totalObs" class="value">-</span>
                    </div>
                    <div class="stat-card">
                        <span class="label">Retard moyen</span>
                        <span id="avgDelay" class="value">-</span>
                    </div>
                    <div class="stat-card">
                        <span class="label">Retards majeurs</span>
                        <span id="majorCount" class="value">-</span>
                    </div>
                </div>
            </div>

            <!-- Delays Chart -->
            <div id="delays" class="tab-content">
                <canvas id="delaysChart"></canvas>
            </div>

            <!-- Stops Table -->
            <div id="stops" class="tab-content">
                <table id="stopsTable" class="data-table">
                    <thead>
                        <tr>
                            <th>Stop ID</th>
                            <th>Clics</th>
                            <th>Retard moyen</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>

            <!-- Export -->
            <div id="export" class="tab-content">
                <button id="exportCsv" class="btn">📥 CSV</button>
                <button id="exportJson" class="btn">📥 JSON</button>
            </div>
        </div>
    </div>

    <script src="js/api.js"></script>
    <script src="js/auth.js"></script>
    <script src="js/ui/tabs.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
```

---

## 🔐 Authentification

```javascript
// js/auth.js
class AdminAuth {
    constructor() {
        this.token = localStorage.getItem('adminToken');
    }

    async login(email, password) {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const { token } = await res.json();
        this.token = token;
        localStorage.setItem('adminToken', token);
        return !!token;
    }

    isAuthenticated() {
        return !!this.token;
    }

    getAuthHeader() {
        return { 'Authorization': `Bearer ${this.token}` };
    }
}
```

---

## 🚀 Avantages VERSION 2

✅ **Site principal:** Ultra-léger (zéro UI analytics)
✅ **Dashboard:** Scalable indépendamment
✅ **API:** Réutilisable (mobile app, autre frontend, etc.)
✅ **Sécurité:** Admin-only, pas exposé sur site public
✅ **Perf:** Zéro impact sur la navigation des users
✅ **Flexible:** Peut être hébergé ailleurs, s'intégrer à un CMS

---

## 📦 Package.json minimal dashboard

```json
{
  "name": "peribus-analytics",
  "version": "1.0.0",
  "scripts": {
    "dev": "python -m http.server 3000",
    "build": "echo 'Static site, no build needed'"
  },
  "devDependencies": {},
  "dependencies": {
    "chart.js": "^3.9.1"
  }
}
```

---

## 🔄 Migration VERSION 1 → VERSION 2

### Jour 0: Décision
```bash
git checkout -b feature/external-analytics
```

### Jour 1: Réduire site principal
```bash
# Garder SEULEMENT delayManager (core)
rm public/js/dataExporter.js
rm public/js/delayStatsUI.js
rm public/css/delay-stats.css
rm public/css/data-exporter.css
git commit -m "Remove UI, keep delay tracking"
```

### Jour 2: Créer dashboard
```bash
# Nouveau dossier
mkdir peribus-analytics
cd peribus-analytics
# Créer structure avec HTML/JS/CSS
```

### Jour 3: Tester API
```bash
# Vérifier GET /api/delay-stats/summary
curl https://peribus.fr/api/delay-stats/summary \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Jour 4: Déployer
```bash
# Dashboard: https://analytics.peribus.fr
# Ou: https://peribus.fr/admin/analytics
```

---

## 💬 Questions avant migration?

Si vous validez VERSION 2, je peux créer:
1. Le dashboard complet (HTML/CSS/JS)
2. Les endpoints API manquants
3. Le système d'auth admin
4. Tests de charge

**Mais d'abord,** testez VERSION 1 avec `analyticsPerfTest()` en console.
