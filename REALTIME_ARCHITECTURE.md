# Architecture Temps Réel Périmap

## Vue d'ensemble

Le système temps réel de Périmap utilise un scraping de hawk.perimouv.fr pour obtenir les horaires de passage en temps réel aux arrêts.

## Données disponibles

### Ce que le scraper hawk fournit :
- **Ligne** : A, B, C, D, etc.
- **Destination** : Nom du terminus
- **Heure de passage** : Au format HH:MM ou "X min"
- **Type** : Temps réel (`realtime: true`) ou théorique (`theoretical: true`)

### Ce que le scraper NE fournit PAS :
- ❌ Position GPS du véhicule
- ❌ Identifiant unique du véhicule/trip

## Ajustement de Position V305

Depuis la version V305, le système utilise les **temps d'attente RT** pour calculer une position ajustée des bus.

### Logique de calcul :

```
Position ajustée = 1 - (temps_RT_restant / durée_segment_statique)
```

**Exemple :**
- Durée du segment selon GTFS : 10 minutes
- Temps d'attente RT au prochain arrêt : 3 minutes
- Progress ajusté = 1 - (3/10) = 0.7 (70% du trajet effectué)

### Avantages :
- ✅ Position plus réaliste quand le bus a du retard ou de l'avance
- ✅ Temps d'arrivée affiché basé sur RT (en vert)
- ✅ Aucune modification de l'API hawk nécessaire

### Limitations :
- La précision dépend de la fraîcheur des données RT (cache 30s)
- Fonctionne uniquement si les données RT sont disponibles pour l'arrêt cible

## Flux de données

```
hawk.perimouv.fr
       ↓ (scraping)
  /api/realtime
       ↓ (cache 15s serveur)
  realtimeManager.js
       ↓ (cache 30s client)
  busPositionCalculator.getRealtimeAdjustedProgress()
       ↓ (calcul vitesse)
  Position interpolée ajustée
       ↓
  mapRenderer.updateBusMarkers()
```

## Fichiers concernés

- `public/js/realtimeManager.js` : Gestion du cache et des appels API temps réel
- `public/js/busPositionCalculator.js` : Interpolation de position avec ajustement RT (V305)
- `public/js/mapRenderer.js` : Affichage des popups avec temps RT
- `public/js/tripScheduler.js` : Calcul de l'état courant des trips (statique)
- `api/realtime.js` : Proxy Vercel pour le scraping hawk

## Versions

### V305 (Janvier 2026)
- Ajustement de position basé sur temps d'attente RT
- Affichage du temps d'arrivée RT dans les popups bus
- Cache dédié pour les ajustements RT par trip

### V304 (Janvier 2026)
- Amélioration de `mergeWithStatic()` pour meilleur matching RT/statique
- Timeout sur les appels RT pour éviter les blocages
- Fallback CSS pour les navigateurs sans support `dvh`
- Timing amélioré pour `invalidateSize()` de Leaflet
