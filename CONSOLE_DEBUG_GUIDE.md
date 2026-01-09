# 🛠️ Guide d'Utilisation Console - Analytique et Préchargement

## 📊 Voir les Statistiques Analytiques

### Vue complète des analytics

```javascript
console.table(analyticsManager.getStatistics())
```

**Résultat attendu:**
```
{
  sessionData: {
    startTime: 1678345600000,
    totalClicks: 42,
    totalStopsViewed: 8
  },
  uniqueStops: 8,
  uniqueStopPlaces: 3,
  uniqueRoutes: 4,
  topStops: [
    { stopId: 'MOBIITI:StopPoint:1234', stopName: 'Tourny', count: 5, ... },
    { stopId: 'MOBIITI:StopPoint:5678', stopName: 'Gare SNCF', count: 3, ... },
    ...
  ],
  topRoutes: [
    { routeId: 'MOBIITI:Route:A', routeShortName: 'A', count: 3, ... },
    ...
  ],
  preloadPriority: { stops: [...], stopPlaces: [...], routes: [...] }
}
```

### Voir les arrêts les plus cliqués

```javascript
console.table(analyticsManager.getTopStops(10))
```

### Voir les lignes les plus consultées

```javascript
console.table(analyticsManager.getTopRoutes(10))
```

### Voir les StopPlaces les plus cliqués

```javascript
console.table(analyticsManager.getTopStopPlaces(10))
```

---

## 🚀 Voir l'État du Préchargement

### État complet du préchargement

```javascript
console.table(realtimeManager.getPreloadStatus())
```

**Résultat attendu:**
```
{
  isPreloading: false,           // Est-ce que le préchargement est en cours?
  preloadedStopsCount: 47,       // Nombre d'arrêts préchargés
  stats: {
    preloadRequests: 50,         // Total requêtes de préchargement
    preloadSuccesses: 48,        // Succès
    preloadFailures: 2,          // Erreurs
    totalRequests: 58,           // Total toutes les requêtes
    totalSuccesses: 56,
    totalFailures: 2
  },
  cacheSize: 47                  // Éléments en cache
}
```

### Vérifier si préchargement est en cours

```javascript
if (realtimeManager.isPreloading) {
  console.log('⏳ Préchargement en cours...')
} else {
  console.log('✅ Préchargement terminé!')
}
```

### Taille du cache

```javascript
console.log(`Cache: ${realtimeManager.cache.size} éléments`)
```

### Vérifier arrêts préchargés

```javascript
console.log(`${realtimeManager.preloadedStops.size} arrêts préchargés`)
console.log(Array.from(realtimeManager.preloadedStops))
```

---

## 🧪 Tests et Monitoring

### Tester un clic arrêt

```javascript
analyticsManager.trackStopClick('MOBIITI:StopPoint:1234', 'Test Arrêt')
console.log(analyticsManager.stopClicks)
```

### Tester un clic ligne

```javascript
analyticsManager.trackRouteClick('MOBIITI:Route:A', 'A')
console.log(analyticsManager.routeClicks)
```

### Voir le cache d'une arrêt spécifique

```javascript
const stopId = 'MOBIITI:StopPoint:1234'
const cacheKey = `hawk_${stopId}`  // Simplifié (clé réelle peut être différente)
console.log(realtimeManager.cache.get(cacheKey))
```

### Vérifier les paramètres de préchargement

```javascript
console.table(realtimeManager.preloadConfig)
```

**Résultat:**
```
{
  mainLinesOnly: true,           // Précharge lignes majeures uniquement
  preloadTopStops: true,         // Ajoute arrêts populaires
  maxPreloadRequests: 50,        // Max requêtes parallèles
  delayBetweenRequests: 100      // 100ms entre requêtes (throttle)
}
```

---

## 🔄 Gestion des Données

### Sauvegarder manuellement les analytics

```javascript
analyticsManager.saveToStorage()
console.log('✅ Données sauvegardées dans localStorage')
```

### Charger les analytics du localStorage

```javascript
analyticsManager.loadFromStorage()
console.log('✅ Données chargées depuis localStorage')
```

### Voir les données brutes du localStorage

```javascript
// Arrêts cliqués
console.table(JSON.parse(localStorage.getItem('perimap_analytics_stop_clicks')))

// Lignes consultées
console.table(JSON.parse(localStorage.getItem('perimap_analytics_route_clicks')))

// StopPlaces cliqués
console.table(JSON.parse(localStorage.getItem('perimap_analytics_stopplace_clicks')))

// Données de session
console.log(JSON.parse(localStorage.getItem('perimap_analytics_session')))
```

### Effacer toutes les données analytiques

```javascript
analyticsManager.reset()
console.log('⚠️ Toutes les données analytiques ont été effacées!')
```

### Effacer seulement le localStorage

```javascript
localStorage.removeItem('perimap_analytics_stop_clicks')
localStorage.removeItem('perimap_analytics_route_clicks')
localStorage.removeItem('perimap_analytics_stopplace_clicks')
localStorage.removeItem('perimap_analytics_session')
console.log('⚠️ localStorage effacé!')
```

---

## 📈 Cas de Test

### Test 1: Vérifier le préchargement au démarrage

```javascript
// À faire dans la console au démarrage de l'app (dans les 5 premières secondes)
setInterval(() => {
  const status = realtimeManager.getPreloadStatus()
  console.log(`[${new Date().toLocaleTimeString()}] Préchargement: ${status.isPreloading ? '⏳ EN COURS' : '✅ FINI'} (${status.preloadedStopsCount} arrêts)`)
}, 500)

// Arrêter après ~10 secondes
```

### Test 2: Vérifier la rapidité du cache

```javascript
// Mesurer temps de réponse pour un arrêt préchargé
const stopId = 'MOBIITI:StopPoint:1234'
const stopCode = 'XX'  // À adapter

console.time('Chargement horaires')
await realtimeManager.getRealtimeForStop(stopId, stopCode)
console.timeEnd('Chargement horaires')

// Si arrêt est en cache: ~1-5ms
// Si arrêt non préchargé: ~200-500ms
```

### Test 3: Voir l'évolution des analytics

```javascript
// Afficher stats chaque 5 secondes
setInterval(() => {
  const stats = analyticsManager.getStatistics()
  console.clear()
  console.log(`📊 ANALYTICS LIVE [${new Date().toLocaleTimeString()}]`)
  console.log(`Total clics: ${stats.sessionData.totalClicks}`)
  console.log(`Arrêts uniques: ${stats.uniqueStops}`)
  console.log(`Top arrêt: ${stats.topStops[0]?.stopName || 'N/A'} (${stats.topStops[0]?.count || 0} clics)`)
  console.log(`Top ligne: ${stats.topRoutes[0]?.routeShortName || 'N/A'} (${stats.topRoutes[0]?.count || 0} clics)`)
}, 5000)

// Arrêter: Ctrl+C
```

### Test 4: Simuler beaucoup de clics

```javascript
// Simuler 50 clics aléatoires sur arrêts
for (let i = 0; i < 50; i++) {
  const stopId = `test_stop_${Math.floor(Math.random() * 10)}`
  analyticsManager.trackStopClick(stopId, `Test Arrêt ${stopId}`)
}

console.log(analyticsManager.getStatistics())
```

---

## 🎯 Bonnes Pratiques

### ✅ À FAIRE

```javascript
// Voir régulièrement les stats
analyticsManager.getStatistics()

// Monitorer la santé du préchargement
realtimeManager.getPreloadStatus()

// Tester manuellement avant de déployer
console.table(realtimeManager.cache)
```

### ❌ À ÉVITER

```javascript
// ❌ Ne pas appeler getRealtimeForStop en boucle rapide
for (let i = 0; i < 100; i++) {
  await realtimeManager.getRealtimeForStop(stopId)
}

// ❌ Ne pas modifier directement realtimeManager.cache
realtimeManager.cache.clear()  // Utiliser clearCache()

// ❌ Ne pas effacer localStorage sans sauvegarder d'abord
analyticsManager.reset()  // OK, c'est la bonne façon
```

---

## 🐛 Debugging

### Voir tous les logs du système

```javascript
// Activer tous les logs (déjà activés par défaut)
console.log(
  '%c[Analytics] Logs activés',
  'background: #2ecc71; color: white; padding: 5px; border-radius: 3px;'
)

// Filtrer les logs dans la console:
// - Taper: localStorage
// - Voir onglet "Application" > "Local Storage"
```

### Voir le réseau (Network tab)

1. Ouvrir DevTools (F12)
2. Aller dans l'onglet **Network**
3. Filtrer par `realtime` ou `/api/realtime`
4. Voir:
   - Requêtes parallèles pendant le préchargement
   - Temps de réponse
   - Taille des réponses

### Voir le stockage local

1. DevTools > **Application**
2. **Local Storage** > sélectionner le domain
3. Voir les clés:
   - `perimap_analytics_stop_clicks`
   - `perimap_analytics_route_clicks`
   - `perimap_analytics_stopplace_clicks`

### Performance

```javascript
// Mesurer temps session
performance.mark('analytics-check')
const stats = analyticsManager.getStatistics()
performance.measure('analytics-check')
console.log(performance.getEntriesByName('analytics-check'))
```

---

## 📱 Sur Mobile

### Limitations

- localStorage limité à ~5MB (généralement OK pour analytics)
- Préchargement peut être plus lent sur 4G
- CPU/batterie: impact minimal (~2-3%)

### Tester sur Mobile

```javascript
// Voir taille des données stockées
function getStorageSize() {
  let size = 0
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      size += localStorage[key].length
    }
  }
  return (size / 1024).toFixed(2) + ' KB'
}

console.log(`Taille localStorage: ${getStorageSize()}`)
```

---

## 🎓 Résumé Commandes Utiles

| Commande | Utilité |
|----------|---------|
| `analyticsManager.getStatistics()` | Voir toutes les stats |
| `realtimeManager.getPreloadStatus()` | Voir état préchargement |
| `analyticsManager.getTopStops(10)` | Top 10 arrêts cliqués |
| `analyticsManager.getTopRoutes(10)` | Top 10 lignes consultées |
| `analyticsManager.reset()` | Effacer données |
| `analyticsManager.saveToStorage()` | Sauvegarder manuellement |
| `analyticsManager.loadFromStorage()` | Charger depuis localStorage |
| `realtimeManager.getPreloadStatus()` | Vérifier cache |
| `console.table(realtimeManager.cache)` | Voir le cache |

---

## 💡 Tips & Tricks

### Exporter les données en CSV

```javascript
// Convertir top stops en CSV
const topStops = analyticsManager.getTopStops(100)
const csv = 'stopId,stopName,count\n' + 
  topStops.map(s => `${s.stopId},"${s.stopName}",${s.count}`).join('\n')
console.log(csv)
```

### Comparer avec session précédente

```javascript
const sessionData = JSON.parse(localStorage.getItem('perimap_analytics_session'))
console.log(`Dernière session: ${new Date(sessionData.lastUpdate).toLocaleString()}`)
console.log(`Clics: ${sessionData.totalClicks}`)
```

### Monitorer en temps réel

```javascript
// Afficher mise à jour chaque clic
const originalTrack = analyticsManager.trackStopClick
analyticsManager.trackStopClick = function(stopId, stopName) {
  console.log(`✅ ${stopName} cliqué!`)
  return originalTrack.call(this, stopId, stopName)
}
```

---

**Dernière mise à jour:** Janvier 2026
**Version:** 2.0 (Avec Analytique + Préchargement)
