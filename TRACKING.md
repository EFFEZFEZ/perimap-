# 📈 TRACKING - Progression Refactorisation

## 📅 Timeline

### Phase 1: Foundation (Semaine 1-2)
**Objectif:** Créer l'infrastructure sans casser la prod

- [ ] Jour 1: EventBus, StateManager, Logger
- [ ] Jour 2: CSS structure modulaire
- [ ] Jour 3: Variables CSS extraites
- [ ] Jour 4-5: Intégration dans main.js
- [ ] Jour 6-7: Tests et validation
- [ ] Semaine 2: Cleanup et documentation

**Status:** ⏳ Not Started
**ETA:** ...

---

### Phase 2: API Layer (Semaine 3)
**Objectif:** Isoler TOUT ce qui touche le réseau

- [ ] APIClient.js (wrapper fetch)
- [ ] gtfsAPI.js (Routes, Stops, Trips)
- [ ] realtimeAPI.js (Bus temps réel)
- [ ] geocodingAPI.js (Geocoding)
- [ ] Tests unitaires

**Status:** ⏳ Not Started
**ETA:** ...

---

### Phase 3: Models & Services (Semaine 4)
**Objectif:** Créer la logique métier testable

- [ ] Domain Models (Route, Stop, Trip, Schedule)
- [ ] ScheduleService (logique horaires)
- [ ] ItineraryService (logique itinéraires)
- [ ] BusPositionService (calcul positions)
- [ ] Tests (80%+ coverage)

**Status:** ⏳ Not Started
**ETA:** ...

---

### Phase 4: UI Refactoring (Semaine 5-6)
**Objectif:** Découpler présentation de la logique

- [ ] UIController (orchestration vues)
- [ ] BottomNav component
- [ ] PlannerBlock component
- [ ] Modal, Toast components
- [ ] Views (Dashboard, Schedule, Itinerary, Map)

**Status:** ⏳ Not Started
**ETA:** ...

---

### Phase 5: CSS Refactoring (Semaine 7)
**Objectif:** Atomiser les 11,766 lignes

- [ ] _bottom-nav.css
- [ ] _planner.css
- [ ] _horaires.css
- [ ] _map.css
- [ ] _responsive.css
- [ ] Tests visuels

**Status:** ⏳ Not Started
**ETA:** ...

---

### Phase 6: Migration Progressive (Semaine 8-10)
**Objectif:** Basculer progressivement

- [ ] Feature flags (USE_NEW_*)
- [ ] Week 8: API Layer actif
- [ ] Week 9: Services actif
- [ ] Week 10: UI Layer actif
- [ ] Tests A/B
- [ ] Performance benchmarking

**Status:** ⏳ Not Started
**ETA:** ...

---

### Phase 7: Cleanup (Semaine 11)
**Objectif:** Nettoyer et documenter

- [ ] Supprimer ancien code
- [ ] Documentation complète
- [ ] Guide contribution
- [ ] Examples d'ajout de feature

**Status:** ⏳ Not Started
**ETA:** ...

---

## 📊 Métriques

### Qualité du Code

| Métrique | Avant | Cible | Actuel |
|----------|-------|-------|--------|
| Test Coverage | 10% | 85% | - |
| Max File Size (JS) | 5,124 | 500 | - |
| Max File Size (CSS) | 11,766 | 200 | - |
| Circular Dependencies | 15+ | 0 | - |
| Bundle Size | 350KB | 280KB | - |

### Performance

| Métrique | Avant | Cible | Actuel |
|----------|-------|-------|--------|
| Load Time | 2.5s | 1.8s | - |
| First Contentful Paint | - | <1s | - |
| Time to Interactive | - | <2s | - |

### Productivité

| Métrique | Avant | Cible | Actuel |
|----------|-------|-------|--------|
| Temps moyen modification | 2-4h | 15-30min | - |
| Risque régression | 70% | 5% | - |
| Temps déploiement | 1-2h | 15-30min | - |

---

## 🔄 Dépendances Entre Phases

```
Phase 1 (Foundation)
    ↓
Phase 2 (API Layer)  ← Utilise EventBus de Phase 1
    ↓
Phase 3 (Services)   ← Utilise API de Phase 2
    ↓
Phase 4 (UI)         ← Utilise Services de Phase 3
    ↓
Phase 5 (CSS)        ← Peut être parallèle aux autres
    ↓
Phase 6 (Migration)  ← Bascule progressif
    ↓
Phase 7 (Cleanup)    ← Nettoyage final
```

---

## 🎯 Done Criteria par Phase

### Phase 1
- [ ] EventBus testé et fonctionnel
- [ ] StateManager testé et fonctionnel
- [ ] Logger testé et fonctionnel
- [ ] Ancien code continue de fonctionner
- [ ] 0 erreurs de console en prod

### Phase 2
- [ ] APIClient centalisé
- [ ] 100% des appels API passent par les adapters
- [ ] Tests unitaires pour chaque adapter
- [ ] Cache strategy implémentée
- [ ] Pas d'appels API directs dans les views

### Phase 3
- [ ] 80%+ coverage sur services
- [ ] Services testables SANS UI ni API
- [ ] Mock data pour tests
- [ ] Pas de side effects dans services

### Phase 4
- [ ] UIController gère tout
- [ ] Components autonomes
- [ ] Pas de logique métier dans UI
- [ ] UI tests 100% passant

### Phase 5
- [ ] 0 fichier CSS > 200 lignes
- [ ] BEM naming convention
- [ ] Tests visuels cross-browser
- [ ] Pas de régressions visuelles

### Phase 6
- [ ] Feature flags tout fonctionnel
- [ ] A/B tests validés
- [ ] Performance stable ou ↑
- [ ] 0 bug en production

### Phase 7
- [ ] Ancien code supprimé
- [ ] Documentation à jour
- [ ] Contribution guide écrit
- [ ] Onboarding nouveau dev testé

---

## 📝 Notes et Blockers

### Bloqueurs Actuels
- [ ] (aucun - on peut commencer!)

### Notes
- DevDependencies: Vite, Vitest, ESLint, Prettier

### Pour Après
- Ajouter Storybook pour composants UI
- Ajouter SonarQube pour qualité
- Ajouter Lighthouse CI

---

## 🔗 Ressources

- [REFACTORING_PLAN.md](REFACTORING_PLAN.md) - Plan détaillé
- [PROBLEMS_ANALYSIS.md](PROBLEMS_ANALYSIS.md) - Diagnostic
- [PHASE1_FOUNDATION.md](PHASE1_FOUNDATION.md) - Phase 1 détails
- [QUICKSTART_PHASE1.md](QUICKSTART_PHASE1.md) - Commencer maintenant
- [README_REFACTORING.md](README_REFACTORING.md) - Résumé

---

**Mis à jour:** 21 Jan 2026
**Status:** 🟡 Planning Phase
**Next:** Commencer Phase 1 dès que possible
