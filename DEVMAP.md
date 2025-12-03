# 🗺️ PÉRIMAP - DEVELOPMENT ROADMAP

> **Version actuelle** : v109 (3.6.0)  
> **Dernière mise à jour** : 3 décembre 2025

---

## 📊 ÉTAT DU PROJET

```
████████████████████░░░░ 80% Complete
```

### Légende des statuts
- ✅ **Terminé** - Fonctionnel en production
- 🔄 **En cours** - Développement actif
- 📋 **Planifié** - Dans la roadmap
- 💡 **Idée** - À évaluer
- ❌ **Abandonné** - Non retenu

---

## 🏗️ ARCHITECTURE ACTUELLE

```
public/
├── js/
│   ├── app.js              ✅ Point d'entrée
│   ├── main.js             ⚠️ 4300 lignes (à refactorer)
│   ├── dataManager.js      ✅ Gestion GTFS
│   ├── mapRenderer.js      ✅ Carte Leaflet
│   ├── timeManager.js      ✅ Temps réel/simulé
│   ├── tripScheduler.js    ✅ Calcul positions bus
│   ├── apiManager.js       ✅ Google APIs
│   ├── uiManager.js        ✅ Thème & UI
│   ├── geolocationManager.js ✅ Géoloc
│   ├── router.js           ⏸️ GTFS Router (désactivé)
│   ├── config/             ✅ Icons, routes
│   ├── utils/              ✅ Formatters, geo
│   ├── ui/                 ✅ Renderers
│   └── workers/            ✅ GTFS Worker
├── views/                  ✅ Templates HTML
├── data/
│   ├── gtfs/               ✅ Données transport
│   └── line-status.json    ✅ État des lignes
└── style.css               ✅ 9800+ lignes
```

---

## ✅ FONCTIONNALITÉS TERMINÉES

### v1.0 - v50 : Fondations
- [x] Carte Leaflet avec lignes multi-couleurs
- [x] Chargement GTFS (routes, trips, stops, stop_times)
- [x] Affichage des bus en temps simulé
- [x] Popup bus avec destination et ETA
- [x] Filtrage des lignes

### v51 - v70 : Planificateur
- [x] Intégration Google Places Autocomplete
- [x] Intégration Google Routes API
- [x] Calcul itinéraires bus/vélo/marche
- [x] Affichage des étapes détaillées
- [x] Mode "Partir à" / "Arriver avant"

### v71 - v90 : UX Avancée
- [x] Dark mode complet
- [x] PWA installable (manifest + SW)
- [x] Bottom sheet mobile avec drag
- [x] Navigation dropdown IDFM-style
- [x] Géolocalisation utilisateur

### v91 - v109 : Polish
- [x] Popup arrêts style SNCF Connect
- [x] Prochains départs GTFS enrichis
- [x] Clic destination → centrer sur arrêt
- [x] Cache IndexedDB optimisé
- [x] Bouton filtrer FAB mobile

---

## 🔄 EN COURS / PRIORITÉ HAUTE

### Sprint actuel (Décembre 2025)

| Tâche | Priorité | Effort | Status |
|-------|----------|--------|--------|
| Refactoring main.js | 🔴 Haute | 3-5h | 📋 |
| Skeleton loaders | 🟡 Moyenne | 2h | 📋 |
| Historique recherches | 🟡 Moyenne | 2h | 📋 |
| Fix bugs mineurs | 🔴 Haute | 1h | 🔄 |

---

## 📋 ROADMAP Q1 2026

### v110 - Refactoring & Performance
```
Objectif: Réduire la dette technique
```
- [ ] Diviser main.js en modules :
  - [ ] `itineraryController.js` (~800 lignes)
  - [ ] `mapController.js` (~500 lignes)
  - [ ] `dashboardController.js` (~400 lignes)
  - [ ] `plannerController.js` (~600 lignes)
- [ ] Lazy loading des vues HTML
- [ ] Tree-shaking des icônes

### v111 - UX Améliorations
```
Objectif: Expérience utilisateur fluide
```
- [ ] Skeleton loaders (horaires, itinéraires)
- [ ] Pull-to-refresh sur mobile
- [ ] Haptic feedback (vibrations)
- [ ] Animations page transitions

### v112 - Fonctionnalités Utilisateur
```
Objectif: Personnalisation
```
- [ ] Historique des recherches (localStorage)
- [ ] Arrêts favoris ⭐
- [ ] Trajets favoris 🚌
- [ ] Export itinéraire (partage)

### v113 - Données Temps Réel
```
Objectif: Fiabilité des informations
```
- [ ] Intégration GTFS-RT (si disponible)
- [ ] Alertes trafic dynamiques
- [ ] Retards en temps réel
- [ ] Notifications push

---

## 💡 BACKLOG (À ÉVALUER)

### Fonctionnalités potentielles

| Feature | Impact | Effort | Décision |
|---------|--------|--------|----------|
| Mode offline complet | ⭐⭐⭐⭐ | 🔴 Élevé | 💡 Évaluer |
| Widget iOS/Android | ⭐⭐⭐⭐⭐ | 🔴 Élevé | 💡 Évaluer |
| Accessibilité vocale | ⭐⭐⭐ | 🟡 Moyen | 💡 Évaluer |
| Multi-langue (EN) | ⭐⭐ | 🟢 Faible | 💡 Évaluer |
| Statistiques usage | ⭐⭐⭐ | 🟡 Moyen | 💡 Évaluer |
| Comparateur horaires | ⭐⭐⭐ | 🟡 Moyen | 💡 Évaluer |
| Intégration vélos libre-service | ⭐⭐⭐⭐ | 🟡 Moyen | 💡 Évaluer |
| Covoiturage | ⭐⭐ | 🔴 Élevé | ❌ Hors scope |

### Améliorations techniques

| Amélioration | Bénéfice | Effort |
|--------------|----------|--------|
| TypeScript migration | Maintenabilité | 🔴 Élevé |
| Tests unitaires (Jest) | Fiabilité | 🟡 Moyen |
| Tests E2E (Playwright) | Qualité | 🟡 Moyen |
| CI/CD GitHub Actions | Automatisation | 🟢 Faible |
| Documentation JSDoc | Onboarding | 🟢 Faible |
| Monitoring (Sentry) | Debugging | 🟢 Faible |

---

## 🐛 BUGS CONNUS

| Bug | Sévérité | Status |
|-----|----------|--------|
| Bouton filtrer parfois mal positionné | 🟡 Mineure | ✅ Fix v109 |
| Router GTFS local trop lent | 🟡 Mineure | ⏸️ Désactivé |
| Double scrollbar popup (ancien) | 🟢 Cosmétique | ✅ Fix v105 |

---

## 📈 MÉTRIQUES CIBLES

### Performance
| Métrique | Actuel | Cible |
|----------|--------|-------|
| First Contentful Paint | ~1.5s | <1s |
| Time to Interactive | ~3s | <2s |
| Lighthouse Performance | ~75 | >90 |
| Bundle size (main.js) | 180KB | <100KB |

### Qualité
| Métrique | Actuel | Cible |
|----------|--------|-------|
| Test coverage | 0% | >60% |
| Accessibility score | ~80 | >95 |
| Best practices | ~85 | >95 |

---

## 🔗 DÉPENDANCES EXTERNES

| Service | Usage | Criticité |
|---------|-------|-----------|
| Google Places API | Autocomplete | 🔴 Critique |
| Google Routes API | Itinéraires | 🔴 Critique |
| OpenStreetMap tiles | Carte light | 🟡 Moyenne |
| CARTO tiles | Carte dark | 🟡 Moyenne |
| GitHub Pages | Hébergement | 🔴 Critique |
| GTFS Péribus | Données transport | 🔴 Critique |

---

## 📝 NOTES DE VERSION

### v109 (3 déc 2025)
- Fix bouton Filtrer position/couleur

### v108 (3 déc 2025)
- Clic destination → centre sur arrêt

### v107 (3 déc 2025)
- Amélioration tracé ligne (revert)

### v106 (3 déc 2025)
- Destinations cliquables popup

### v105 (3 déc 2025)
- Popup SNCF Connect style

---

## 👥 CONTRIBUTION

Ce projet est open-source. Pour contribuer :

1. Fork le repo
2. Créer une branche (`git checkout -b feature/ma-feature`)
3. Commit (`git commit -m 'Add ma feature'`)
4. Push (`git push origin feature/ma-feature`)
5. Ouvrir une Pull Request

---

*Dernière mise à jour : 3 décembre 2025*
