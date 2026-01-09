# Architecture Temps Réel Périmap

## Vue d'ensemble

Le système temps réel de Périmap utilise un scraping de hawk.perimouv.fr pour obtenir les horaires de passage en temps réel aux arrêts.

## Données disponibles

### Ce que le scraper hawk fournit :
- **Ligne** : A, B, C, D, etc.
- **Destination** : Nom du terminus
- **Heure de passage** : Au format HH:MM
- **Type** : Temps réel (`realtime: true`) ou théorique (`theoretical: true`)

### Ce que le scraper NE fournit PAS :
- ❌ Position GPS du véhicule
- ❌ Identifiant unique du véhicule/trip
- ❌ Retard calculé (différence avec horaire prévu)
- ❌ Statut du véhicule (en service, à l'arrêt, etc.)

## Limitations actuelles

### Position des bus sur la carte
Les bus sont positionnés par **interpolation** entre deux arrêts basée sur les horaires GTFS **statiques**. Si un bus a du retard, sa position calculée sera incorrecte.

**Solution possible** : Intégrer un flux GTFS-RT de type `VehiclePositions` si disponible.

### Conflit statique/temps réel
Les horaires statiques peuvent montrer un bus comme "passé" alors que le temps réel indique qu'il est encore attendu (retard).

**Correction V304** : La fonction `mergeWithStatic()` a été améliorée pour :
1. Matcher par ligne ET destination (plus précis)
2. Ajouter les départs RT non matchés comme "bus supplémentaires"
3. Préserver les infos sur les horaires théoriques vs temps réel

### Cache des données RT
- Durée de vie : 30 secondes
- Préchargement : Activé au démarrage pour les arrêts populaires

## Flux de données

```
hawk.perimouv.fr
       ↓ (scraping)
  /api/realtime
       ↓ (cache 15s serveur)
  realtimeManager.js
       ↓ (cache 30s client)
  mapRenderer.createStopPopupContent()
       ↓
  Affichage dans popup
```

## Améliorations futures possibles

1. **GTFS-RT VehiclePositions** : Si Périmouv expose ce flux, l'intégrer pour avoir les vraies positions
2. **Calcul de retard** : Comparer l'heure RT avec l'horaire GTFS prévu pour calculer le retard
3. **Ajustement de position** : Utiliser le retard calculé pour ajuster la position interpolée du bus
4. **WebSocket** : Connexion persistante pour les mises à jour RT instantanées

## Fichiers concernés

- `public/js/realtimeManager.js` : Gestion du cache et des appels API temps réel
- `public/js/mapRenderer.js` : Affichage des popups avec données RT
- `public/js/tripScheduler.js` : Calcul de l'état courant des trips (statique seulement)
- `public/js/busPositionCalculator.js` : Interpolation de position (statique seulement)
- `api/realtime.js` : Proxy Vercel pour le scraping hawk

## Version

Corrections V304 appliquées le $(date) :
- Amélioration de `mergeWithStatic()` pour meilleur matching RT/statique
- Timeout sur les appels RT pour éviter les blocages
- Fallback CSS pour les navigateurs sans support `dvh`
- Timing amélioré pour `invalidateSize()` de Leaflet
