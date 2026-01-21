# 📋 AUDIT COMPLET - Toutes les Fonctionnalités à Préserver

## NAVIGATION (Bottom-nav)

### Boutons de navigation
- `data-action="hall"` → Accueil / Page d'accueil
- `data-action="horaires"` → Afficher page horaires (toutes les lignes)
- `data-action="carte"` → Afficher carte interactive
- `data-action="itineraire"` → Calculer itinéraire (recherche multimodal)
- `data-action="info-trafic"` → Afficher alertes et infos trafic

**Événements attendus:**
- Changement de vue (navigation)
- Mise à jour des contenus
- Changement de la section active de bottom-nav

---

## HORAIRES (Page horaires)

### Fonctionnalités:
1. **Liste de toutes les lignes** (A, B, C, D, E1-E7, K1a, K1b, K2-K6, N, N1, R1-R15)
2. **Clic sur une ligne** → Ouvre page horaires détaillée
3. **Affichage des:
   - Direction/Terminus (ex: "Centre ville ↔ Gare")
   - Toutes les heures de départ
   - Badge "En temps réel" si données temps réel disponibles

### Pages de ligne détaillées (/horaires-ligne-X.html)
- **Sélecteur d'arrêt** → Change les horaires affichés
- **Bouton "Localiser moi"** → Géolocalise → Trouve arrêt proche
- **Menu latéral** (collapsible)
  - **Thème sombre/clair** (toggle)
  - **À propos de cette ligne**
  - **FAQ de la ligne**
- **Affichage des temps** (HH:MM format)
- **Distinction** horaires planifiés vs temps réel

---

## CALCUL D'ITINÉRAIRE (page itineraire)

### Formulaire de recherche:
- **Champ départ** (avec autocomplete adresses/arrêts/points d'intérêt)
- **Champ arrivée** (avec autocomplete)
- **Inverseur départ/arrivée** (bouton swap)
- **Heure de départ/arrivée** (input time)
- **Mode départ/arrivée** (radio: "Partir à" ou "Arriver à")
- **Bouton "Localiser moi"** → Remplit champ départ

### Résultats d'itinéraire:
- **Liste d'itinéraires** (bus + marche + vélo + combinaisons)
- **Pour chaque itinéraire:**
  - Durée totale
  - Heure départ / Arrivée
  - Nombre de correspondances
  - Détails étapes (bus, marche, etc)
  - Badge "Temps réel" si applicable

### Détails itinéraire (au clic):
- **Traçage sur carte** (Leaflet)
- **Étapes détaillées** (chaque segment)
- **Infos arrêts** (nom, localisation)
- **Temps d'attente** entre correspondances
- **Calcul de marche** (distance + durée)

---

## CARTE INTERACTIVE

### Fonctionnalités:
1. **Affichage carte Leaflet**
2. **Zoom/pan** (interaction utilisateur)
3. **Position initiale** → Périgueux center (45.1846, 0.7214)
4. **Affichage arrêts** (markers)
   - Clustérisation (+ 20 arrêts)
   - Au clic → Popup avec:
     - Nom arrêt
     - Lignes desservies
     - Prochain passage
     - Badge temps réel si actif
5. **Affichage bus temps réel** (si données GTFS-RT)
   - Marqueurs bus avec icônes
   - Popup avec:
     - Numéro ligne
     - Direction
     - Délai actuel (si retard)
     - Heure estimée

### Traçage d'itinéraire:
- Polylines pour chaque segment (couleur ligne)
- Markers début/fin
- Mode walk/bike (style différent)

---

## INFOS TRAFIC & ALERTES

### Affichage:
1. **Bannière alertes** (en haut si existe)
   - Type alerte (retard, déviations, arrêt fermeture)
   - Ligne affectée
   - Message détail
   - Durée alerte

2. **Page info trafic**
   - Tableau des alertes par ligne
   - Sévérité (couleurs)
   - Détails complets
   - Horaires de rétablissement si connus

---

## DONNÉES TEMPS RÉEL (Realtime)

### Sources:
1. **Données GTFS-RT** (Hawk API si disponible)
   - Position buses
   - Délais actualisés
   - Destinations en temps réel

2. **Délais enregistrés** (Neon DB)
   - Historique des retards
   - Par arrêt, par ligne
   - Stats (moyenne, max, heures pic)

### Affichage/Usage:
- Badge "🔴 Live" sur horaires temps réel
- Couleur différente pour délais importants
- Marqueurs bus décalés sur carte

---

## GÉOLOCALISATION

### Fonctionnalités:
- **Bouton "Localiser moi"** (GPS)
  - Demande permission
  - Reverse geocode → Adresse
  - Inverse geocode si pas d'adresse
  - Place dans input départ/arrivée
  - Ou zoom/pan carte vers position

- **Tracking continu** (mode carte)
  - Met à jour position utilisateur
  - Fait apparaitre marker
  - Recalcule itinéraire si nécessaire

---

## PARAMÈTRES & PRÉFÉRENCES

### Sauvegardé (localStorage):
1. **Thème** (clair/sombre)
2. **Dernières recherches** (historique)
3. **Favoris/Points sauvegardés** (adresses récentes)
4. **Préférences utilisateur** (modes préférés: bus/marche/vélo)

---

## API & DONNÉES CHARGÉES

### Au démarrage:
1. **GTFS static**
   - Routes (A, B, C, D, etc)
   - Stops (tous les arrêts)
   - Stop_times (horaires)
   - Shapes (polylines routes)

2. **Geocoding API** (Google Places)
   - Autocomplete adresses
   - Reverse geocoding

3. **Routing API** (Google Routes)
   - Calcul marche
   - Calcul vélo

4. **Données temps réel** (Hawk API + Neon)
   - Bus positions
   - Retards/alertes

---

## FORMATAGE & AFFICHAGE

### Temps:
- HH:MM (24h) en France
- Durées en "2h 15min" ou "15min"
- Indication "Temps réel" vs planifié

### Noms:
- Arrêts: Nom complet (ex: "Gare Centrale")
- Lignes: Code (ex: "A", "K2")
- Terminus: "Terminus A" / "Terminus B"

### Couleurs:
- Par ligne (codes couleur Péribus existants)
- Statut bus: normal vs retard
- Mode transport: bus (vert), marche (gris), vélo (bleu)

---

## EXPORTS & ANALYTICS

### DataExporter UI:
- **Export CSV/JSON** des:
  - Itinéraires récents
  - Horaires visualisés
  - Stops favoris
  - Données trafic

### Analytics:
- Chargement pages
- Actions utilisateur (clics, recherches)
- Erreurs rencontrées
- Performance (temps réponse API)

---

## CONFIGURATION SYSTÈME

### Détection:
- Mode offline (service worker)
- Disponibilité GTFS (fallback API si nécessaire)
- Capacités géolocalisation
- Support localStorage/IndexedDB

### Backend:
- **Mode GTFS** (données complètes)
- **Mode API** (fallback Google Routes)
- **Mode Offline** (cache service worker)

---

## TOUS LES LISTENERS D'ÉVÉNEMENTS À REMAPPER

Ces écouteurs doivent être convertis en **EventBus.emit()**:

### Navigation:
- `data-action="hall"` → eventBus.emit('nav:select', { view: 'hall' })
- `data-action="horaires"` → eventBus.emit('nav:select', { view: 'horaires' })
- Etc.

### Recherche:
- Recherche lancée → eventBus.emit('search:start', { departure, arrival, time })
- Résultats reçus → eventBus.emit('search:complete', { itineraries })
- Erreur recherche → eventBus.emit('search:error', { error })

### Carte:
- Itinéraire cliqué → eventBus.emit('map:route-selected', { itinerary })
- Arrêt cliqué → eventBus.emit('map:stop-selected', { stop })
- Vue changée → eventBus.emit('map:viewport-changed', { bounds })

### État:
- Changement état important → eventBus.emit('state:changed', { key, newValue })

### UI:
- Affichage loading → eventBus.emit('ui:loading', true)
- Affichage erreur → eventBus.emit('ui:error', { message, error })
- Affichage succès → eventBus.emit('ui:success', { message })

---

## TESTS À EFFECTUER (Production Parity)

✅ = À vérifier après migration

- [ ] Navigation entre toutes les vues fonctionne
- [ ] Recherche itinéraire retourne résultats identiques
- [ ] Horaires affichent les bons départs
- [ ] Carte affiche tous les marqueurs
- [ ] Temps réel fonctionne et s'affiche correctement
- [ ] Géolocalisation fonctionne
- [ ] Offline mode fonctionne
- [ ] Exports CSV/JSON fonctionnent
- [ ] Thème sombre/clair fonctionne
- [ ] Tous les boutons d'interface réactifs
- [ ] Performance identique ou meilleure
- [ ] Pas de console errors/warnings

---

## FICHIERS CLÉS À REFACTORISER

Priority order:

1. **main.js** (5124 lignes) → Intégrer EventBus
2. **apiManager.js** (1519 lignes) → Services APIs modulaires
3. **dataManager.js** (1358 lignes) → Service données
4. **mapRenderer.js** (1364 lignes) → Composant carte
5. **router.js** (1316 lignes) → Service routing
6. **uiManager.js** → UI components
7. **style.css** (11766 lignes) → CSS modules
8. **viewLoader.js** → Lazy loading views

---

## MÉTRIQUES DE SUCCÈS

**Avant migration:**
- main.js: 5124 lignes
- Modification temps: 2-4 heures
- Regression risk: 70%
- Test coverage: ~10%

**Après Phase 7:**
- Modules: 50-500 lignes chacun
- Modification temps: 15-30 minutes
- Regression risk: 5%
- Test coverage: 85%

---

**État:** Audit complet ✅ Prêt pour Phase 1 intégration
