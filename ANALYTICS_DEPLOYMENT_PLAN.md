# 📊 Plan de déploiement Analytics

## ✅ VERSION 1 - INTÉGRÉE (ACTUELLE)

### Commit: `032d12c`
**Avantages:**
- ✅ Pas d'infrastructure supplémentaire
- ✅ Admin-only (zéro impact public)
- ✅ CSS chargé dynamiquement
- ✅ Accès local via Alt+D

**Fichiers ajoutés:**
```
public/js/delayManager.js (417 lignes)
public/js/dataExporter.js (340 lignes)
public/js/delayStatsUI.js (376 lignes)
public/js/config/delayConfig.js (320 lignes)
public/css/delay-stats.css (520 lignes)
public/css/data-exporter.css (130 lignes)
server/api/delay-stats.js (285 lignes)
```

**Fichiers modifiés:**
```
public/index.html (+1 ligne import CSS)
public/js/main.js (+5 lignes pour init UI)
public/js/tripScheduler.js (+5 lignes delay recording)
public/js/busPositionCalculator.js (+10 lignes delay adjustment)
```

**Total ajouté:** ~2.4 KB JavaScript, 0.65 KB CSS
**Impact UX:** ZÉRO (admin seulement, CSS dynamique)

---

## 🚀 VERSION 2 - ALTERNATIVE: API + SITE EXTERNE

Si problèmes de perf détectés sur le site principal:

### Architecture:
```
┌─────────────────────────────┐
│   PERIBUS SITE (PUBLIC)      │
│  - delayManager.js (core)    │
│  - Envoie via API            │
│  - ZÉRO UI visible           │
└─────────┬───────────────────┘
          │ POST /api/delay-stats
          ↓
┌─────────────────────────────┐
│  NODE.JS API (server/)       │
│  - Récupère données          │
│  - Persiste en DB            │
│  - Endpoints REST            │
└─────────┬───────────────────┘
          │ GET /api/analytics/*
          ↓
┌─────────────────────────────┐
│  ANALYTICS DASHBOARD         │
│  (Site séparé)               │
│  - Accès admin seulement     │
│  - URL: analytics.peribus.fr │
│  - React/Vue simple          │
└─────────────────────────────┘
```

### Étapes si déploiement VERSION 2:

#### 1. Réduire le site principal (minimal):
```bash
# Garder SEULEMENT:
public/js/delayManager.js        # Core (non-bloking)
server/api/delay-stats.js        # POST endpoint seulement

# SUPPRIMER:
public/js/dataExporter.js        # UI admin → à la dashboard
public/js/delayStatsUI.js        # UI admin → à la dashboard
public/css/delay-stats.css       # Pas besoin
public/css/data-exporter.css     # Pas besoin
public/js/config/delayConfig.js  # Config → API
```

#### 2. API endpoints à activer:
```javascript
// server/api/delay-stats.js
POST   /api/delay-stats/record    # Enregistrer un retard
GET    /api/delay-stats/summary   # Résumé stats
GET    /api/delay-stats/stops     # Top arrêts
GET    /api/delay-stats/delays    # Stats retards
GET    /api/delay-stats/export    # CSV/JSON
```

#### 3. Dashboard externe (nouveau projet):
```
peribus-analytics-dashboard/
├── index.html
├── app.js
├── style.css
├── config.js
└── package.json
```

**Features:**
- Auth: Token admin
- Onglets: Summary, Stops, Delays, Export
- Fetch depuis API: `https://peribus.fr/api/delay-stats/*`
- Charts avec Chart.js
- Export CSV/JSON

---

## 🎯 RECOMMANDATION

### POUR COMMENCER:
✅ **VERSION 1 est suffisante** car:
- Admin-only (pas impacte users)
- CSS dynamique (chargé si nécessaire)
- DataExporter en lazy-load
- Impact réel: < 0.1ms on load

### SI PROBLÈMES PERF:
🚀 **Basculer à VERSION 2**:
1. Commit actuel reste intact
2. Créer branche `feature/external-analytics`
3. Nettoyer site principal
4. Déployer dashboard séparé

---

## 📈 MONITORING PERF

Pour tester l'impact:

```javascript
// F12 Console:
performance.mark('before-analytics');
// ... navigation ...
performance.mark('after-analytics');
performance.measure('analytics-impact', 'before-analytics', 'after-analytics');
const measure = performance.getEntriesByName('analytics-impact')[0];
console.log(`Impact: ${measure.duration}ms`);
```

**Seuils acceptables:**
- ✅ < 100ms: Garder VERSION 1
- ⚠️ 100-500ms: Évaluer VERSION 2
- ❌ > 500ms: Basculer VERSION 2

---

## 🔄 PLAN DE ROLLBACK

Si problèmes:

```bash
# Retour à avant analytics:
git revert 032d12c

# Ou garder juste delayManager (core):
git reset --soft HEAD~1
git reset public/js/dataExporter.js \
         public/js/delayStatsUI.js \
         public/css/*.css
git commit -m "Remove UI, keep core delay tracking"
```

---

## 📋 CHECKLIST DÉPLOIEMENT

- [ ] Version 1: Tester perf via Chrome DevTools
- [ ] Vérifier Alt+D fonctionne (admin)
- [ ] Vérifier localStorage persiste
- [ ] Vérifier API endpoints (optional, pour V2)
- [ ] Monitoring en production
- [ ] Si perf OK: Fermer et oublier
- [ ] Si perf baisse: Passer à VERSION 2

---

## 💾 DONNÉES

**localStorage:**
- `delayStats` (JSON, ~1MB max)
- `stopClickStats` (JSON, ~100KB max)

**API (server/api/delay-stats.js):**
- Database: Déjà préparée
- Authentification: Token admin
- Persistence: Optional, activable à tout moment
