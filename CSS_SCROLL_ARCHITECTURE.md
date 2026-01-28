# 📜 Architecture du Scroll — PériMap CSS

**Version** : 1.0.0  
**Date** : 28 janvier 2026  
**Statut** : Document de référence

---

## 🎯 Objectif de ce document

Ce document centralise la **logique de gestion du scroll** dans le projet PériMap.
Il sert de référence pour éviter les conflits entre les multiples règles CSS qui contrôlent le défilement.

---

## 📐 Principes fondamentaux

### 1. Conteneur de scroll principal

```
┌─────────────────────────────────────┐
│  <html>  ← SCROLL PRINCIPAL         │
│  ├── overflow-y: scroll             │
│  ├── overscroll-behavior: none      │
│  └── background-attachment: fixed   │
│                                     │
│    ┌─────────────────────────────┐  │
│    │  <body>                     │  │
│    │  └── overflow-y: visible    │  │
│    │      (laisse passer au html)│  │
│    └─────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Règle d'or** : Le scroll par défaut est géré par `<html>`.
Le `<body>` a `overflow-y: visible` pour laisser passer le scroll au parent.

### 2. Pourquoi `overscroll-behavior: none` ?

- Empêche le "bounce" iOS (elastic scroll)
- Empêche le pull-to-refresh non désiré
- Évite les zones grises sur Chrome mobile lors de l'over-scroll
- Voir [MDN - overscroll-behavior](https://developer.mozilla.org/fr/docs/Web/CSS/overscroll-behavior)

### 3. Pourquoi `background-attachment: fixed` ?

- Garantit un fond solide même pendant l'over-scroll
- Élimine les flashs de fond blanc/gris sur mobile
- Le pseudo-élément `html::before` renforce cette protection

---

## 🔒 Classes de verrouillage du scroll

### Classe centralisée (RECOMMANDÉE)

```css
/* Fichier : utilities/scroll-lock.css */
.scroll-locked {
    overflow: hidden !important;
    position: fixed;
    width: 100%;
    height: 100%;
}
```

**Usage JavaScript** :
```javascript
// Verrouiller le scroll (ex: ouverture modale)
document.documentElement.classList.add('scroll-locked');

// Déverrouiller
document.documentElement.classList.remove('scroll-locked');
```

### Classes existantes (LEGACY)

Ces classes sont encore présentes pour compatibilité mais devraient migrer vers `.scroll-locked` :

| Classe | Fichier | Usage | Migration |
|--------|---------|-------|-----------|
| `.view-is-locked` | reset.css | Vue verrouillée générique | → `.scroll-locked` |
| `.view-map-locked` | reset.css | Vue carte plein écran | Conserver (spécifique carte) |
| `.itinerary-view-active` | mobile.css | Vue itinéraire mobile | Conserver (état UI) |
| `.has-search` | itinerary.css | Recherche active | Conserver (état UI) |

---

## 📱 Comportement mobile

### Hauteur viewport

```css
:root {
    --app-view-height: 100vh;
}

@supports (height: 100svh) {
    :root {
        --app-view-height: 100svh;  /* Small Viewport Height */
    }
}
```

- `100vh` : Inclut la barre d'adresse (peut causer des sauts)
- `100svh` : Exclut la barre d'adresse (stable mais plus petit)
- `100dvh` : Dynamique (change avec la barre d'adresse)
- `100lvh` : Large (toujours le max, avec barre masquée)

**Choix PériMap** : `100svh` avec fallback `100vh` pour stabilité.

### Safe areas (iPhone X+)

```css
body {
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

---

## ⚠️ Pièges courants

### 1. Cascade CSS et spécificité

**Problème** : Une règle dans `mobile.css` (chargé en dernier) écrase une règle de `itinerary.css`.

**Solution** : Utiliser des sélecteurs plus spécifiques :
```css
/* ❌ Écrasé par mobile.css */
body.has-search .recent-journeys-section { display: none; }

/* ✅ Plus spécifique, fonctionne */
body.itinerary-view-active.has-search .recent-journeys-section { display: none; }
```

### 2. `!important` en cascade

**Problème** : Deux règles avec `!important` → la dernière gagne (ordre de chargement).

**Solution** : Éviter `!important`, augmenter la spécificité :
```css
/* ❌ Guerre des !important */
.panel { overflow: hidden !important; }
.panel.open { overflow: auto !important; }

/* ✅ Spécificité sans !important */
html body .panel { overflow: hidden; }
html body .panel.open { overflow: auto; }
```

### 3. Scroll sur élément fixe

**Problème** : Un élément `position: fixed` avec son propre scroll peut bloquer le scroll parent.

**Solution** : Ajouter `overscroll-behavior: contain` sur l'élément fixe :
```css
.bottom-sheet {
    position: fixed;
    overflow-y: auto;
    overscroll-behavior: contain;  /* Contient le scroll */
}
```

---

## 🗂️ Fichiers concernés

| Fichier | Responsabilité scroll |
|---------|----------------------|
| `modules/base/reset.css` | Règles globales html/body |
| `modules/utilities/scroll-lock.css` | Classe `.scroll-locked` centralisée |
| `modules/utilities/mobile.css` | Overrides mobiles (fixed panels) |
| `modules/pages/itinerary.css` | Scroll panel latéral + bottom sheet |
| `modules/pages/map.css` | Verrouillage carte plein écran |

---

## 📝 Checklist avant modification

Avant de modifier une règle de scroll, vérifier :

- [ ] Quel élément a actuellement le scroll ? (`html`, `body`, ou conteneur)
- [ ] Y a-t-il des éléments `position: fixed` qui interceptent ?
- [ ] La règle a-t-elle des `!important` qui peuvent être évités ?
- [ ] Le comportement est-il testé sur mobile (iOS Safari, Chrome Android) ?
- [ ] La modification est-elle documentée dans `CSS_DOCUMENTATION.md` ?

---

## 🔗 Références

- [MDN - overflow](https://developer.mozilla.org/fr/docs/Web/CSS/overflow)
- [MDN - overscroll-behavior](https://developer.mozilla.org/fr/docs/Web/CSS/overscroll-behavior)
- [MDN - Viewport units](https://developer.mozilla.org/en-US/docs/Web/CSS/length#viewport-percentage_lengths)
- [CSS Tricks - Body scroll lock](https://css-tricks.com/prevent-page-scrolling-when-a-modal-is-open/)
