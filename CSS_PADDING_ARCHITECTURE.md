# 🏗️ ARCHITECTURE CSS - PADDING & ESPACEMENT
## Vue Itinéraire Mobile - Analyse Complète

**Date:** 2026-01-28  
**Objectif:** Comprendre et documenter TOUTES les règles de padding qui affectent la vue itinéraire sur mobile

---

## 📱 ORDRE DE CHARGEMENT DES CSS (CRITIQUE)

```
1. /css/_config.css
2. /style.modules.css
   ├── Base (reset, variables, etc.)
   ├── Utilities (scroll-lock, mobile-overlays, etc.)
   ├── Layout (grid, header, navigation)
   ├── Components (buttons, forms, cards, etc.)
   ├── Pages
   │   └── css/modules/pages/itinerary.css   ⬅️ Chargé ICI
   ├── Themes (dark.css)
   └── Mobile (EN DERNIER - SURCHARGE TOUT)
       └── css/modules/utilities/mobile.css   ⬅️ Très prioritaire
3. /css/components/itinerary.css              ⬅️ PRIORITÉ MAXIMALE (dernier dans HTML)
```

**RÈGLE CRITIQUE:** `components/itinerary.css` a la priorité la plus haute car chargé EN DERNIER dans le HTML !

---

## 🎯 HIÉRARCHIE DES CONTENEURS - VUE ITINÉRAIRE MOBILE

```html
<body class="itinerary-view-active">
  └── #itinerary-results-container
      └── #results-side-panel
          ├── .itinerary-top-bar (header "Itinéraires")
          ├── #itinerary-edit-panel (formulaire de recherche)
          └── .results-list-wrapper ⬅️ CONTENEUR CRITIQUE POUR PADDING
              ├── .results-list (résultats de recherche)
              └── .recent-journeys-section ⬅️ "VOS TRAJETS"
                  └── #recent-journeys-container
                      ├── <h3>Vos trajets :</h3>
                      └── #recent-journeys-list ⬅️ GAP ENTRE CARTES
                          ├── .recent-journey-card
                          ├── .recent-journey-card
                          └── .recent-journey-card
```

---

## 📐 RÈGLES DE PADDING PAR CONTENEUR

### 1️⃣ `#itinerary-results-container` (Container global)

| Fichier | Sélecteur | Propriétés | Appliqué quand |
|---------|-----------|------------|----------------|
| `pages/itinerary.css` L39 | `@media (max-width: 900px)` | `padding-top: calc(64px + env(safe-area-inset-top, 0px))` | < 900px |
| `utilities/mobile.css` L1026 | `body.itinerary-view-active` | `position: fixed; top: 56px; bottom: 66px; padding: 0` | Mobile + vue active |
| `components/itinerary.css` L110 | `@media (max-width: 768px)` | `padding: 0; min-height: 100vh` | < 768px |

**SYNTHÈSE:** Sur mobile, ce conteneur est en `position: fixed` SANS padding interne.

---

### 2️⃣ `#results-side-panel` (Panneau latéral)

| Fichier | Sélecteur | Propriétés | Appliqué quand |
|---------|-----------|------------|----------------|
| `pages/itinerary.css` L63 | Base | `width: 400px; padding: 0; overflow-y: auto` | Desktop |
| `pages/itinerary.css` L2004 | `@media (max-width: 600px)` | `width: 100%; padding: 0; overflow-y: visible` | < 600px |
| `utilities/mobile.css` L1044 | `body.itinerary-view-active` | `width: 100%; max-width: 520px; padding-bottom: 0 !important` | Mobile + vue active |
| `components/itinerary.css` L128 | `@media (max-width: 768px)` | `padding-bottom: 200px` | < 768px |

**CONFLIT DÉTECTÉ:**
- `components/itinerary.css` impose `padding-bottom: 200px`
- `utilities/mobile.css` force `padding-bottom: 0 !important`
- ⚠️ Le `!important` dans `mobile.css` gagne mais `mobile.css` est chargé AVANT `components/itinerary.css` dans `style.modules.css`
- ✅ MAIS `components/itinerary.css` est chargé EN DERNIER via le HTML → **`padding-bottom: 200px` GAGNE**

---

### 3️⃣ `.itinerary-top-bar` (Header "Itinéraires")

| Fichier | Sélecteur | Propriétés | Appliqué quand |
|---------|-----------|------------|----------------|
| `pages/itinerary.css` L93 | Base | `padding: 0.75rem 1rem` | Toujours |
| `pages/itinerary.css` L2077 | `@media (max-width: 600px)` | `padding: 0.5rem 0.75rem` | < 600px |
| `utilities/mobile.css` L1110 | `body.itinerary-view-active` | `padding: 1rem 0.75rem 0 0.75rem !important` | Mobile + vue active |
| `components/itinerary.css` L139 | `@media (max-width: 768px)` | `padding: 1.1rem 1.25rem 0.75rem` | < 768px |

**GAGNANT:** `components/itinerary.css` → **`padding: 1.1rem 1.25rem 0.75rem`**

---

### 4️⃣ `#itinerary-edit-panel` (Formulaire de recherche)

| Fichier | Sélecteur | Propriétés | Appliqué quand |
|---------|-----------|------------|----------------|
| `pages/itinerary.css` L508 | Base | `padding: 1.25rem` | Toujours |
| `pages/itinerary.css` L1022 | Media query | `padding: 1rem` | Responsive |
| `pages/itinerary.css` L2085 | `@media (max-width: 600px)` | `padding: 0.75rem` | < 600px |
| `utilities/mobile.css` L1117 | `body.itinerary-view-active` | `padding: 0.9rem !important; margin: 1rem 0.75rem` | Mobile + vue active |
| `components/itinerary.css` L142 | `@media (max-width: 768px)` | `padding: 1.15rem; margin: 0 1rem 0.75rem` | < 768px |

**GAGNANT:** `components/itinerary.css` → **`padding: 1.15rem`**

---

### 5️⃣ `.results-list-wrapper` ⚠️ **CONTENEUR CRITIQUE**

| Fichier | Sélecteur | Propriétés | Appliqué quand |
|---------|-----------|------------|----------------|
| `pages/itinerary.css` L160 | Base | `flex: 1; overflow-y: auto; padding: 0` | Toujours |
| `pages/itinerary.css` L1192 | Règle principale | `padding: 0.75rem 0 0 0` | Toujours |
| `pages/itinerary.css` L2018 | `@media (max-width: 600px)` | `padding: 0.75rem 1rem 1.25rem 1rem !important` | < 600px |
| `utilities/mobile.css` L1070 | `body.itinerary-view-active` | `padding: 1.5rem 1.25rem 5rem 1.25rem !important` | Mobile + vue active ✅ |
| `components/itinerary.css` L179 | `@media (max-width: 768px)` | `padding: 1.5rem 1.25rem 1.25rem` | < 768px |

**ANALYSE:**
- `mobile.css` : `padding: 1.5rem 1.25rem 5rem 1.25rem !important` (avec `!important`)
- `components/itinerary.css` : `padding: 1.5rem 1.25rem 1.25rem` (sans `!important`)

**GAGNANT:** `utilities/mobile.css` avec **`!important`** → **`padding: 1.5rem 1.25rem 5rem 1.25rem`**

C'est CE padding qui crée l'espace global autour de la section "Vos trajets".

---

### 6️⃣ `.recent-journeys-section` ⚠️ **SECTION "VOS TRAJETS"**

| Fichier | Sélecteur | Propriétés | Appliqué quand |
|---------|-----------|------------|----------------|
| `pages/itinerary.css` L971 | Media query | `padding: 0; margin-top: var(--spacing-6)` | Responsive |
| `pages/itinerary.css` L1271 | Base | `padding: 0; margin-top: var(--spacing-8); gap: var(--spacing-4)` | Toujours |
| `pages/itinerary.css` L2035 | `@media (max-width: 600px)` | `padding: 0; margin-top: var(--spacing-6); gap: var(--spacing-4)` | < 600px |
| `utilities/mobile.css` L1088 | `body.itinerary-view-active` | `gap: 1rem; margin-top: 2rem !important; margin-bottom: 0 !important` | Mobile + vue active ✅ |
| `components/itinerary.css` L183 | `@media (max-width: 768px)` | `padding: 0; margin-top: 2rem; gap: 1rem` | < 768px |

**GAGNANT:** `utilities/mobile.css` avec **`!important`** → **`margin-top: 2rem; gap: 1rem`**

---

### 7️⃣ `#recent-journeys-list` (Liste des cartes)

| Fichier | Sélecteur | Propriétés | Appliqué quand |
|---------|-----------|------------|----------------|
| `pages/itinerary.css` L1305 | Base | `display: flex; flex-direction: column; gap: 1.25rem` | Toujours ✅ |
| `utilities/mobile.css` L1099 | `body.itinerary-view-active` | `gap: 1.25rem` | Mobile + vue active ✅ |
| `components/itinerary.css` L207 | `@media (max-width: 768px)` | `gap: 1.25rem` | < 768px |

**GAGNANT:** Tous concordent → **`gap: 1.25rem`** entre les cartes

---

### 8️⃣ `.recent-journey-card` (Carte individuelle)

| Fichier | Sélecteur | Propriétés | Appliqué quand |
|---------|-----------|------------|----------------|
| `pages/itinerary.css` L1312 | Base | `padding: 0.9rem 1rem` | Toujours |
| `pages/itinerary.css` L1005 | Media query | `padding: 0.9rem 1rem` | Responsive |
| `components/itinerary.css` L212 | `@media (max-width: 768px)` | `padding: 0.9rem 1rem` | < 768px |

**SYNTHÈSE:** Tous concordent → **`padding: 0.9rem 1rem`**

---

## 🎯 RÉSUMÉ FINAL - ESPACEMENT "VOS TRAJETS" SUR MOBILE

```
body.itinerary-view-active (mobile < 768px)
└── #itinerary-results-container [padding: 0]
    └── #results-side-panel [padding-bottom: 200px]  ⬅️ Espace pour popover
        ├── .itinerary-top-bar [padding: 1.1rem 1.25rem 0.75rem]
        ├── #itinerary-edit-panel [padding: 1.15rem; margin: 0 1rem 0.75rem]
        └── .results-list-wrapper [padding: 1.5rem 1.25rem 5rem 1.25rem] ⬅️ CRITIQUE
            └── .recent-journeys-section [margin-top: 2rem; gap: 1rem]
                └── #recent-journeys-list [gap: 1.25rem] ⬅️ Entre cartes
                    └── .recent-journey-card [padding: 0.9rem 1rem]
```

### 📊 Espacement total vertical

```
Formulaire → Section "Vos trajets":
  - margin-top de .recent-journeys-section: 2rem (32px)

Entre les cartes:
  - gap de #recent-journeys-list: 1.25rem (20px)

Padding interne de chaque carte:
  - padding vertical: 0.9rem (14.4px)

Padding global du wrapper:
  - top: 1.5rem (24px)
  - bottom: 5rem (80px) ← Pour la bottom nav
  - left/right: 1.25rem (20px)
```

---

## ⚠️ CONFLITS ET PRIORITÉS

### Conflit #1: `#results-side-panel` padding-bottom

- **`components/itinerary.css`**: `padding-bottom: 200px`
- **`utilities/mobile.css`**: `padding-bottom: 0 !important`

**Résolution:** `components/itinerary.css` chargé EN DERNIER dans HTML → **GAGNE** (`200px`)  
**Impact:** Crée un espace énorme en bas pour permettre le scroll du popover horaires

---

### Conflit #2: `.results-list-wrapper` padding

- **`pages/itinerary.css`**: `padding: 0.75rem 1rem 1.25rem`
- **`utilities/mobile.css`**: `padding: 1.5rem 1.25rem 5rem 1.25rem !important`
- **`components/itinerary.css`**: `padding: 1.5rem 1.25rem 1.25rem`

**Résolution:** `utilities/mobile.css` avec **`!important`** → **GAGNE**  
**Impact:** C'est CE padding qui crée l'air autour de la section

---

## 🔧 OÙ MODIFIER POUR AÉRER "VOS TRAJETS" ?

### Option 1: Modifier `.results-list-wrapper` (RECOMMANDÉ)
**Fichier:** `css/modules/utilities/mobile.css` ligne 1077  
**Sélecteur:** `body.itinerary-view-active .results-list-wrapper`  
**Propriété:** `padding: 1.5rem 1.25rem 5rem 1.25rem !important`

✅ **Avantage:** Spécificité maximale + `!important` → Aucun risque de conflit

---

### Option 2: Modifier `.recent-journeys-section` margin-top
**Fichier:** `css/modules/utilities/mobile.css` ligne 1088  
**Sélecteur:** `body.itinerary-view-active .recent-journeys-section`  
**Propriété:** `margin-top: 2rem !important`

✅ **Avantage:** Cible précisément l'espace au-dessus de "Vos trajets"

---

### Option 3: Modifier `#recent-journeys-list` gap
**Fichier:** `css/modules/utilities/mobile.css` ligne 1099  
**Sélecteur:** `body.itinerary-view-active #recent-journeys-list`  
**Propriété:** `gap: 1.25rem`

✅ **Avantage:** Change uniquement l'espace entre les cartes

---

## 📝 MODIFICATIONS DÉJÀ APPLIQUÉES (2026-01-28)

1. **`components/itinerary.css` L183:**
   - `.recent-journeys-section { margin-top: 2rem; gap: 1rem; }`

2. **`components/itinerary.css` L207:**
   - `#recent-journeys-list { gap: 1.25rem; }`

3. **`utilities/mobile.css` L1077:**
   - `body.itinerary-view-active .results-list-wrapper { padding: 1.5rem 1.25rem 5rem 1.25rem !important; }`

4. **`utilities/mobile.css` L1088:**
   - `body.itinerary-view-active .recent-journeys-section { margin-top: 2rem !important; gap: 1rem; }`

5. **`utilities/mobile.css` L1099:**
   - `body.itinerary-view-active #recent-journeys-list { gap: 1.25rem; }`

6. **`components/itinerary.css` L179:**
   - `.results-list-wrapper { padding: 1.5rem 1.25rem 1.25rem; }`

---

## 🚨 PROBLÈMES IDENTIFIÉS

### ⚠️ Problème 1: Duplication d'imports dans `style.modules.css`

**Fichier:** `public/style.modules.css`  
**Issue:** `css/modules/pages/itinerary.css` est chargé 2 fois:
- Ligne ~68 (section PAGES)
- Ligne ~91 (section MOBILE - fin du fichier)

**Impact:** Confusion sur l'ordre de priorité, règles potentiellement écrasées

**Solution recommandée:** Supprimer la duplication, ne garder qu'UN seul import

---

### ⚠️ Problème 2: Conflit de priorité `!important`

**Issue:** `utilities/mobile.css` utilise `!important` mais est chargé AVANT `components/itinerary.css`

**Cascade actuelle:**
1. `mobile.css` (avec `!important`)
2. Plein d'autres fichiers rechargés
3. `components/itinerary.css` (sans `!important` mais DERNIER)

**Résultat:** Comportement imprévisible selon la propriété

**Solution recommandée:** 
- Soit tout mettre dans `components/itinerary.css` (chargé en dernier)
- Soit renforcer `mobile.css` avec plus de spécificité

---

## 📌 RECOMMANDATIONS FINALES

### ✅ Pour aérer la section "Vos trajets" :

1. **Modifier `utilities/mobile.css` uniquement** car il a `!important` et cible spécifiquement `body.itinerary-view-active`

2. **NE PAS MODIFIER** `components/itinerary.css` car il peut être écrasé par d'autres règles avec `!important`

3. **Valeurs recommandées pour un espacement confortable:**
   ```css
   /* Wrapper global */
   padding: 2rem 1.5rem 5rem 1.5rem; /* Plus d'air sur les côtés */
   
   /* Section Vos trajets */
   margin-top: 2.5rem; /* Plus d'espace après le bouton Rechercher */
   
   /* Entre les cartes */
   gap: 1.5rem; /* Plus d'air entre chaque trajet */
   ```

---

**Document créé le:** 2026-01-28  
**Dernière modification:** 2026-01-28  
**Auteur:** Analyse CSS automatisée
