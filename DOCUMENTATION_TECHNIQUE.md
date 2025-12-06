# 📚 DOCUMENTATION TECHNIQUE - PÉRIMAP

**Version**: V221 | **Dernière mise à jour**: 6 décembre 2025

---

# 🔍 ANALYSE COMPLÈTE DU PROJET

## 1. DESCRIPTION DU PROJET

### Ce que c'est RÉELLEMENT

**Périmap** est un **wrapper/surcouche** aux données publiques GTFS de Péribus (Grand Périgueux), enrichi par l'API Google Routes pour le calcul d'itinéraires.

**Ce n'est PAS** :
- Une application officielle de Péribus/Transdev
- Un système avec accès aux données GPS temps réel des bus
- Une startup avec un modèle économique validé

**Ce que ça fait concrètement aujourd'hui** :
- Affiche les horaires théoriques des bus (données GTFS statiques)
- Calcule des itinéraires bus/marche/vélo via Google Routes API
- Estime les positions des bus (calcul mathématique, PAS de GPS réel)
- Fonctionne hors-ligne (PWA avec Service Worker)
- Propose une carte interactive (Leaflet)

**Problème résolu** : Offre une alternative plus moderne/rapide à Google Maps pour les transports locaux de Périgueux. Mais Google Maps fait déjà le job gratuitement.

---

## 2. ÉTAT ACTUEL & MATURITÉ

| Critère | Évaluation | Justification |
|---------|------------|---------------|
| **Niveau de développement** | MVP avancé | Fonctionnel mais pas production-ready |
| **Statut** | Side-project semi-pro | Qualité technique au-dessus de l'amateur, mais pas viable commercialement |
| **Qualité technique** | Propre | Architecture modulaire, ES modules, code commenté, versionné (V221) |
| **Qualité design/UX** | Pro | Interface moderne, dark mode, bottom sheet mobile, cohérent |
| **Utilisable par d'autres ?** | Oui | PWA installable, intuitive, mais valeur ajoutée faible vs Google Maps |

---

## 3. FORCES RÉELLES (sans bullshit)

### ✅ Ce qui est vraiment bon

1. **Qualité technique impressionnante pour un projet perso**
   - Architecture JavaScript moderne (ES modules, Workers, IndexedDB)
   - Gestion intelligente du cache (Service Worker v221)
   - Code bien structuré et commenté
   - Refactorisation propre (V221 : -1800 lignes de code mort supprimées)

2. **PWA exemplaire**
   - Installable sur mobile/desktop
   - Fonctionne hors-ligne
   - Shortcuts, share target, manifest complet

3. **SEO très poussé**
   - Schema.org, Open Graph, géolocalisation
   - Meta tags optimisés, canonical URLs

4. **UX mobile soignée**
   - Bottom sheet natif iOS-like
   - Dark/light mode
   - Interface épurée

5. **Indépendance serveur pour les horaires**
   - Données GTFS stockées localement
   - Pas de backend requis pour la consultation basique

### ⚠️ Avantages concurrentiels objectifs

**Honnêtement : quasi aucun.**

- Google Maps fait la même chose gratuitement
- L'app officielle Péribus (si elle existe/est bonne) a la légitimité
- Le seul avantage : interface plus jolie/rapide que Google Maps pour CE réseau spécifique

---

## 4. FAIBLESSES MAJEURES (impitoyable)

### 🔴 Technique

| Problème | Gravité | Détail |
|----------|---------|--------|
| Pas de temps réel GPS | CRITIQUE | Les positions des bus sont CALCULÉES, pas réelles. C'est le différenciateur principal qu'il manque. |
| main.js = 4500 lignes | Majeur | Monolithe difficile à maintenir, malgré la refactorisation V221 |
| Pas de tests | Majeur | Aucun test unitaire/intégration = dette technique |
| Dépendance Google Routes API | Majeur | Coûts potentiels si trafic, et dépendance externe |

### 🔴 Juridique

| Problème | Gravité | Détail |
|----------|---------|--------|
| Utilisation du nom "Péribus" | RISQUE | Utilisé dans le SEO/title sans autorisation officielle |
| Pas de structure juridique | Majeur | Pas de SIRET, éditeur = personne physique |
| RGPD | OK | Aucune donnée collectée, conforme |
| Données GTFS | Faible | Données publiques, mais redistribution sans mention peut poser problème |

### 🔴 Business

| Problème | Gravité | Détail |
|----------|---------|--------|
| Pas de modèle économique | CRITIQUE | Aucune source de revenus, aucune stratégie |
| Marché minuscule | CRITIQUE | ~110 000 habitants dans le Grand Périgueux |
| Concurrence écrasante | CRITIQUE | Google Maps est gratuit et meilleur |
| Valeur ajoutée floue | Majeur | Pourquoi quelqu'un choisirait ça plutôt que Google Maps ? |

### 🔴 Crédibilité

| Aspect | Verdict |
|--------|---------|
| Fait amateur ? | Non, le design est pro |
| Fait bricolé ? | Non, le code est propre |
| Crédible ? | Oui visuellement, mais la mention "non-officiel" tue la confiance |

---

## 5. POTENTIEL RÉEL

### Note : ⭐⭐☆☆☆ FAIBLE à MOYEN

**Justification factuelle :**

1. **Marché trop petit** : 110 000 habitants, peut-être 5-10% utilisent le bus régulièrement = 5 000-11 000 personnes max
2. **Concurrence imbattable** : Google Maps est gratuit, universel, et a le temps réel
3. **Pas de différenciateur** : Sans GPS temps réel, c'est juste "Google Maps avec une jolie UI"
4. **Pas de barrière à l'entrée** : N'importe qui peut faire pareil avec les mêmes données GTFS

**Y a-t-il un vrai besoin ?** Non. C'est un projet "cool à faire" techniquement, pas une solution à un problème criant.

---

## 6. MARCHÉ & CONCURRENCE

### Qui fait déjà la même chose ?

| Concurrent | Forces | Part de marché estimée |
|------------|--------|----------------------|
| **Google Maps** | Temps réel, mondial, gratuit | 80%+ |
| **Citymapper** | UX premium, alertes, multi-villes | 5-10% |
| **Moovit** | Communauté, gamification | 5% |
| **App officielle Péribus** (si existe) | Légitimité, temps réel potentiel | 5-10% |
| **Périmap** | Interface locale jolie | <1% |

### En quoi Périmap est différent ?

**Honnêtement : pas grand-chose.**
- Interface plus épurée que Google Maps (subjectif)
- Spécialisé Périgueux uniquement (avantage ET inconvénient)
- Hors-ligne (Google Maps le fait aussi)

### État du marché

- **Saturé** au niveau mondial (Google Maps domine)
- **Niche locale** potentiellement ouverte si partenariat officiel
- **Barrière à l'entrée** : Quasi nulle. Les données GTFS sont publiques.

---

## 7. PUBLIC CIBLE RÉEL

### Qui utiliserait vraiment ça ?

| Segment | Taille | Réalisme |
|---------|--------|----------|
| Usagers réguliers Péribus cherchant une alternative | ~2 000-5 000 | Faible motivation à changer |
| Étudiants Périgueux | ~500-1 000 | Possible |
| Touristes | ~100/mois | Anecdotique |
| Personnes sans smartphone récent (PWA légère) | ~200 | Très niche |

**Total réaliste : 500-2 000 utilisateurs actifs mensuels maximum.**

### Profil du public

- **Pouvoir d'achat** : Faible (transports en commun = souvent budget serré)
- **Facile à atteindre ?** : Difficile. Pas de budget marketing, pas de viralité naturelle.

---

## 8. MONÉTISATION

### Est-ce monétisable ?

**❌ NON / Très difficilement**

### Analyse par modèle

| Modèle | Viabilité | Raison |
|--------|-----------|--------|
| Publicité | ❌ | Trop peu d'utilisateurs, CPM ridicule |
| Abonnement premium | ❌ | Aucune feature premium évidente, Google Maps est gratuit |
| Affiliation | ❌ | Pas de produit/service à affilier |
| B2B / Partenariat collectivité | ✅ Seule option | Vendre en marque blanche ou comme prestataire |
| White-label multi-villes | ⚠️ Possible | Réutiliser le code pour d'autres réseaux GTFS |

### Difficulté pour générer du revenu

**🔴 TRÈS DIFFICILE**

### Estimation réaliste des revenus

| Horizon | Scénario | Revenus estimés |
|---------|----------|-----------------|
| Court terme (6-12 mois) | En l'état, publicité/dons | 0 - 200€/an |
| Moyen terme (1-3 ans) | Avec partenariat local | 2 000 - 10 000€/an |
| Moyen terme (1-3 ans) | White-label multi-villes | 10 000 - 30 000€/an |

**Type de projet : Side-project sans revenu, ou petit complément si partenariat.**

### Obstacles à la monétisation

1. **Marché trop petit** pour la pub/freemium
2. **Pas de légitimité** pour facturer sans partenariat officiel
3. **Concurrence gratuite** (Google Maps)
4. **Coûts API Google** potentiellement supérieurs aux revenus

---

## 9. RISQUES

### Juridiques

| Risque | Probabilité | Impact |
|--------|-------------|--------|
| Demande de retrait par Péribus/Transdev | Moyenne | Fatal - Obligation de rebranding total |
| Utilisation non autorisée du nom "Péribus" dans le SEO | Moyenne | Potentiel litige |
| Responsabilité si un usager rate un bus à cause d'infos erronées | Faible | Problématique mais mentions légales protègent |

### Techniques

| Risque | Probabilité | Impact |
|--------|-------------|--------|
| Facture Google API si trafic élevé | Moyenne | Coûts imprévus (1000 requêtes = ~$5, mais peut grimper) |
| Changement format GTFS Péribus | Faible | Maintenance requise |
| Obsolescence navigateurs (PWA) | Très faible | Faible impact |

### Business

| Risque | Probabilité | Impact |
|--------|-------------|--------|
| Péribus lance sa propre app moderne | Haute | Projet devient obsolète |
| Google Maps améliore son UX locale | Certaine | Différenciateur réduit |
| Désintérêt personnel (burnout side-project) | Haute | Abandon |

---

## 10. CE QUI MANQUE AUJOURD'HUI

### Gaps critiques

| Domaine | Manque | Impact |
|---------|--------|--------|
| **Technique** | Temps réel GPS | Pas de différenciateur vs Google Maps |
| **Technique** | Tests automatisés | Dette technique, risque de régression |
| **Business** | Modèle économique | Pas de viabilité |
| **Légal** | Structure juridique | Impossible de facturer/contracter |
| **Marketing** | Stratégie d'acquisition | Pas de croissance possible |

### Ce qui bloque le projet

1. **Pas d'accès aux données temps réel** (nécessite partenariat Transdev/collectivité)
2. **Pas de différenciateur clair** face à Google Maps
3. **Pas de ressources** pour le marketing

---

## 11. AMÉLIORATIONS PRIORITAIRES

### Par ordre d'importance RÉELLE

1. **🔴 DÉCIDER : continuer ou pivoter ?** - Sans partenariat officiel, le projet n'a pas d'avenir commercial

2. **Si continue :**
   - Contacter le service mobilité du Grand Périgueux pour partenariat
   - Pitch : "J'ai développé cette app gratuitement, voulez-vous collaborer ?"

3. **Sécurisation juridique**
   - Créer structure juridique (auto-entrepreneur minimum)
   - Renommer si risque avec "Péribus" dans le SEO

4. **Technique (si partenariat)**
   - Intégrer temps réel GPS (données Transdev)
   - Ajouter tests unitaires (ranking.js, apiManager.js)

5. **Marketing (si partenariat)**
   - Landing page différenciante
   - Présence locale (flyers arrêts de bus ?)

---

## 12. FONCTIONNALITÉS À CRÉER

### Essentielles (si le projet continue sérieusement)

| Fonctionnalité | Priorité | Difficulté | Impact |
|----------------|----------|------------|--------|
| Temps réel GPS | CRITIQUE | Haute (besoin partenariat) | Différenciateur majeur |
| Favoris (arrêts/trajets) | Haute | Facile | Fidélisation |
| Alertes perturbations push | Haute | Moyenne | Valeur ajoutée |
| Tests automatisés | Haute | Moyenne | Stabilité |

### Nice to have

| Fonctionnalité | Priorité | Difficulté |
|----------------|----------|------------|
| Widget "prochain bus" | Moyenne | Haute |
| Mode crowdsourcing (positions signalées) | Moyenne | Moyenne |
| Multilingue | Basse | Facile |

---

## 13. PERSPECTIVES D'ÉVOLUTION

### Court terme (3-6 mois)

**Sans partenariat :** Stagnation. Quelques dizaines/centaines d'utilisateurs locaux fidèles. Pas de revenus.

**Avec démarche partenariat :** Potentielle discussion avec la collectivité. Résultat incertain.

### Moyen terme (6-18 mois)

**Scénario optimiste :** Partenariat officiel → Accès temps réel → App de référence locale → 2 000-10 000€/an

**Scénario réaliste :** Pas de partenariat → Projet portfolio → Utilité pour décrocher un job de dev

**Scénario pessimiste :** Demande de retrait → Rebranding obligatoire ou abandon

### Long terme (2-5 ans)

**Meilleur cas :** White-label répliqué sur d'autres villes moyennes françaises → Side-business viable (20-50k€/an)

**Cas probable :** Projet abandonné ou en maintenance minimale

---

## 14. CONSEILS STRATÉGIQUES CONCRETS

### ✅ À faire en priorité

1. **Décider maintenant** : soit tu contactes la collectivité pour un partenariat, soit tu assumes que c'est un projet portfolio
2. **Si partenariat** : préparer un pitch professionnel (démo, métriques, proposition de valeur)
3. **Utiliser comme portfolio** : le projet est techniquement impressionnant pour un CV

### ❌ À arrêter/éviter

1. **Arrêter d'optimiser sans objectif** : Le code est déjà propre, pas besoin de refactorisation infinie
2. **Ne pas investir d'argent** : Pas de pub payante, pas de domaine premium, pas de serveur dédié
3. **Ne pas surestimer le potentiel** : Ce n'est pas une startup, c'est un side-project local

### 🎯 Prochain move stratégique

**Email au service mobilité du Grand Périgueux** avec :
- Démo de l'app
- Proposition de collaboration (gratuite ou rémunérée)
- Mise en avant de la valeur (app moderne, hors-ligne, PWA)

Si réponse négative ou silence → Accepter que c'est un projet portfolio et passer à autre chose.

---

## 15. VERDICT FINAL

### Statut actuel du projet

## ⚠️ PROJET FRAGILE / INCERTAIN

### Ce que ça peut devenir (scénario réaliste sur 1 an)

| Scénario | Probabilité | Description |
|----------|-------------|-------------|
| **Meilleur réaliste** | 15% | Partenariat officiel → App de référence locale → 5-10k€/an |
| **Probable** | 60% | Projet portfolio → Aide à décrocher un job de dev front-end/PWA |
| **Pire** | 25% | Demande de retrait ou désintérêt → Abandon |

### Recommandation finale

## 🤔 Y ALLER PRUDEMMENT (side-project)

**Justification :**

Le projet est **techniquement excellent** mais **commercialement non viable** en l'état. Sans accès au temps réel GPS et sans partenariat officiel, il restera un "Google Maps local plus joli" sans valeur ajoutée suffisante.

**Action recommandée :** Tenter UN contact sérieux avec la collectivité. Si ça ne donne rien en 2-3 mois, considérer ce projet comme un excellent portfolio technique et passer à un projet avec plus de potentiel.

---

---

# 📖 DOCUMENTATION TECHNIQUE

## Architecture technique

### Structure des fichiers JS

```
public/js/
├── main.js              # Orchestration principale (~4500 lignes)
├── app.js               # Point d'entrée HTML
├── config.js            # Configuration (API keys via env)
│
├── config/
│   ├── icons.js         # SVG icons centralisés
│   └── routes.js        # Mapping lignes/couleurs
│
├── map/
│   └── routeDrawing.js  # ✨ V221: Dessin routes Leaflet
│
├── search/
│   └── itineraryProcessor.js  # ✨ V221: Traitement itinéraires
│
├── itinerary/
│   └── ranking.js       # Tri/filtrage résultats
│
├── ui/
│   ├── resultsRenderer.js  # Affichage résultats
│   └── trafficInfo.js      # Alertes trafic
│
├── utils/
│   ├── formatters.js    # Formatage dates/heures
│   ├── geo.js           # Utilitaires géographiques
│   ├── polyline.js      # Encodage/décodage polylines
│   └── gtfsProcessor.js # Traitement GTFS
│
├── workers/
│   ├── gtfsWorker.js    # Worker GTFS (IndexedDB)
│   └── routerWorker.js  # Worker calcul routes
│
└── [autres managers]    # apiManager, dataManager, uiManager, etc.
```

### API Proxies (Vercel Functions)

| Route | Fichier | Rôle |
|-------|---------|------|
| `/api/routes` | `api/routes.js` | Proxy Google Routes API |
| `/api/places` | `api/places.js` | Proxy Google Places API |
| `/api/geocode` | `api/geocode.js` | Proxy Google Geocoding API |

---

## Flux de données critiques

### Recherche d'itinéraire

```
[1] UTILISATEUR
     │
     ▼
[2] uiManager.js → Collecte from/to/searchTime
     │
     ▼
[3] main.js::executeItinerarySearch()
     │
     ├──► [4a] router.js (GTFS local) → 0 résultats (souvent)
     │
     └──► [4b] apiManager.js::fetchItinerary()
              │
              ├── Mode "partir" : 8 appels API décalés (T+0 à T+180min)
              └── Mode "arriver" : 1 seul appel API
                    │
                    ▼
          [5] extractDepartureTime()
              │
              ▼
          [6] Déduplication par uniqueKey
              │
              ▼
          [7] Tri par heure de départ
              │
              ▼
[9] main.js::processIntelligentResults()
     │
     ▼
[10] ranking.js::filterExpiredDepartures()
     │
     ▼
[11] resultsRenderer.js → Affichage
```

### Mode "Partir" vs "Arriver"

| Aspect | Mode "Partir à" | Mode "Arriver à" |
|--------|-----------------|------------------|
| Objectif | Partir à une heure précise | Arriver avant une heure |
| Appels API | 8 décalés (T+0 à T+180min) | 1 seul appel |
| Paramètre API | `departureTime` | `arrivalTime` |
| Filtrage départs | >= heure demandée | >= heure ACTUELLE |
| Filtrage arrivées | - | <= heure demandée |
| Tri | Départ croissant | Arrivée décroissante |

---

## Fichiers critiques

| Fichier | Lignes | Zones sensibles |
|---------|--------|-----------------|
| `apiManager.js` | ~1117 | `extractDepartureTime()`, `uniqueKey`, `_offsetSearchTime()` |
| `ranking.js` | ~374 | `filterExpiredDepartures()`, `filterLateArrivals()` |
| `main.js` | ~4531 | `executeItinerarySearch()`, `processIntelligentResults()` |
| `dataManager.js` | ~1570 | `getTripsBetweenStops()`, `getServiceIds()` |
| `service-worker.js` | ~193 | `CACHE_VERSION` (incrémenter à chaque déploiement) |

---

## Bugs majeurs corrigés

| Version | Bug | Cause | Fix |
|---------|-----|-------|-----|
| V217 | Saut d'horaires (14:04 → 15:53) | Mauvais chemin extraction `depTime` | Helper `extractDepartureTime()` |
| V217 | Déduplication trop agressive | `uniqueKey = ""-lineName` (vide) | Clé = `depTime-line-stop` |
| V219 | Mode arriver = 0 bus | 8 appels avec `arrivalTime` décalés dans le passé | 1 seul appel en mode arriver |
| V220 | Mode arriver filtre tous les bus | Comparaison départ vs heure demandée | Comparer à heure ACTUELLE |

---

## API Google Routes - Structure réponse

```
route
├── duration: "3660s"
├── polyline: { encodedPolyline: "..." }
└── legs[]
    └── [0]
        ├── localizedValues
        │   └── departureTime  ◄── VIDE pour TRANSIT !
        └── steps[]
            ├── [0] travelMode: "WALK"
            ├── [1] travelMode: "TRANSIT" ◄── C'EST LÀ
            │   └── transitDetails
            │       └── localizedValues
            │           ├── departureTime.time.text: "14:04" ◄── BONNE VALEUR
            │           └── arrivalTime.time.text: "14:52"
            └── [2] travelMode: "WALK"
```

**Règle d'or** : Pour TRANSIT, parcourir `steps[]` et extraire de `transitDetails`.

---

## Refactorisation V221

| Métrique | Avant | Après | Delta |
|----------|-------|-------|-------|
| Fichiers JS | 32 | 24 | **-8** |
| Lignes code mort | ~1,828 | 0 | **-1,828** |
| Modules extraits | 0 | 2 | **+2** |

### Nouveaux modules

- `map/routeDrawing.js` (503 lignes) - Dessin routes Leaflet
- `search/itineraryProcessor.js` (511 lignes) - Traitement itinéraires

---

## Guide de debug

### Constantes importantes

```javascript
// apiManager.js
MAX_BUS_RESULTS = 8
Offsets mode partir : [0, 20, 40, 60, 90, 120, 150, 180] minutes

// ranking.js
MIN_BUS_ITINERARIES = 5

// main.js
ARRIVAL_PAGE_SIZE = 6

// service-worker.js
CACHE_VERSION = 'v221'
```

### Commandes Git utiles

```bash
git log --oneline -20 -- public/js/apiManager.js
git diff v217..v221 -- public/js/apiManager.js
git checkout v217 -- public/js/apiManager.js
```

---

## Contact & Maintenance

- **Repository** : https://github.com/EFFEZFEZ/p-rimap-sans-api-
- **Production** : https://périmap.fr (Vercel)

---

*Documentation générée le 6 décembre 2025 - Version V221*
