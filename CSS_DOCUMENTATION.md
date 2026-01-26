# Perimap CSS Documentation

## [2026-01-26] Marge inférieure mobile pour la section "Vos trajets"

**Fichier :** public/css/modules/pages/itinerary.css

**Sélecteur concerné :**
- .recent-journeys-section (section Vos trajets)

**Règle ajoutée :**
```css
@media (max-width: 600px) {
  .recent-journeys-section {
    margin-bottom: var(--spacing-6);
    padding-bottom: 72px; /* Espace pour la bottom nav, ajustable selon la hauteur réelle */
  }
}
```

**Pages concernées :**
- Page itinéraire (itineraire.html)

**Pourquoi ?**
- Garantit une aération visuelle entre le bloc "Vos trajets" et le bas de l’écran, même sur petit écran ou lors du scroll, pour éviter que le bloc ne soit collé au bord.
- Cohérence avec les autres vues de l’application.

- Le padding-bottom assure que le contenu ne soit jamais masqué ou collé à la barre de navigation fixe en bas de l’écran sur mobile.

**Statut :** Nouvelle règle (v2026-01-26)

**Effet visuel :**
- Sur mobile, la section "Vos trajets" garde toujours une marge avec le bas du viewport.

**Risques :**
- Aucun risque identifié, la règle ne s’applique que sur petit écran.

## [2026-01-26] Correction padding "Vos trajets" (Mobile Override)

**Fichier :** public/css/modules/utilities/mobile.css

**Sélecteur concerné :**
- body.itinerary-view-active .recent-journeys-section

**Règle modifiée :**
```css
padding: 0 0 80px 0 !important; /* V601: Espace pour le scroll mobile */
```

**Pourquoi ?**
- Le fichier `mobile.css` forçait `padding: 0 !important`, annulant la marge définie dans `itinerary.css`.
- Ajout d'un padding-bottom de 80px pour garantir que le contenu n'est pas masqué par la barre de navigation fixe.

**Statut :** Correction (v2026-01-26)

**Effet visuel :**
- La liste des trajets récents a maintenant un espace de respiration en bas de page sur mobile.

## [2026-01-26] Surcharge top: 10px pour éléments fixes carte

**Fichier :** public/css/modules/pages/map.css

**Sélecteurs concernés :**
- #btn-back-to-dashboard-from-map
- #clock
- #top-right-controls

**Règle ajoutée :**
```css
#btn-back-to-dashboard-from-map,
#clock,
#top-right-controls {
  top: 10px !important;
}
```

**Pages concernées :**
- Page carte (carte.html, views/carte.html)

**Pourquoi ?**
- Permet de rapprocher les éléments fixes du haut de la fenêtre, sur demande utilisateur, pour une meilleure visibilité et un gain d’espace vertical.
- La règle !important garantit la priorité sur les valeurs calculées précédentes (ex : calc(64px + 12px + env(safe-area-inset-top))).

**Statut :** Nouvelle règle (v2026-01-26)

**Effet visuel :**
- Les trois éléments sont désormais positionnés à 10px du haut du viewport, quel que soit le contexte précédent.

**Risques :**
- Si d’autres règles très spécifiques existent, il peut rester des conflits. Surveiller le rendu sur mobile et desktop.

## [2026-01-26] Itinerary Top Bar Static Positioning

**Fichier :** public/css/modules/pages/itinerary.css

**Sélecteur concerné :**
- .itinerary-top-bar

**Règle modifiée :**
```css
position: static;
top: auto;
z-index: auto;
```

**Pourquoi ?**
- Pour permettre à la barre supérieure de l'itinéraire de défiler avec le contenu et de passer sous les éléments fixes (comme le header principal) lors du défilement.
- Supprime le comportement `sticky` précédent.

**Statut :** Modification (v2026-01-26)

## [2026-01-26] Global Overscroll Fix (Anti-Gray Zones)

**Fichiers :**
- public/css/modules/base/reset.css
- public/css/modules/utilities/mobile.css

**Sélecteurs concernés :**
- body
- body.horaires-view-active
- body.trafic-view-active
- #itinerary-results-container

**Règle modifiée :**
```css
overscroll-behavior: none;
```

**Pourquoi ?**
- Empêche l'effet de rebond (rubber-banding) sur Chrome/Safari mobile qui révèle le fond gris/blanc du navigateur.
- Garantit une expérience "app-like" immersive, surtout sur les vues à fond sombre (Navy).

**Statut :** Modification globale (v2026-01-26)

This document is the single source of truth for the CSS split. It tracks the
current monolithic file, the planned module layout, and the validation status
for each block. It will be updated after each block extraction.

## Update 2026-01-25 — Monolithic `style.css` is now obsolete
- **Action**: The monolithic file `public/style.css` has been emptied and replaced with a deprecation notice.
- **Reason**: The CSS refactoring to a modular architecture is complete. All styles are now loaded via `public/style.modules.css`, which imports individual modules from `public/css/modules/`.
- **Status**: The old `style.css` file is **not used** by any part of the application. It is kept as an empty file solely to prevent any legacy build process or cached link from accidentally loading it and causing style conflicts. It can be safely ignored.

## Update 2026-01-24 — Active module index & SW v510
- Active stylesheet: `public/style.modules.css` is loaded on all public pages and replaces the monolithic `public/style.css` in production usage. The monolithic file remains archived and is not referenced by HTML.
- Import order in `style.modules.css` mirrors the original cascade to preserve visuals. Modules include base (variables, reset, animations), utilities (performance, accessibility, mobile, stacking), layout (header, navigation, header.dropdown), pages (map, home, itinerary, schedules, traffic), and components (hero, offline, banners, banners.alert, cards, common, leaflet, popups, forms, modals).
- Service Worker v510: precaches `style.modules.css` and all key module files, including `css/modules/components/banners.alert.css`. Strategy is cache-first for `.css`, ensuring offline availability and fast repeat loads; old caches are purged on activation.
- Build: Vite (v5) applies cache busting (hashed filenames) for CSS/JS. Even when hashed, cache-first captures the first request and stores it; no visual regressions expected.
- Next optional step: evaluate migration of non-module CSS still referenced (e.g., `public/css/_config.css`, `public/css/components/itinerary.css`, `public/css/components/timepicker.css`) into `public/css/modules/` to fully homogenize, preserving import order.

## File: public/style.css (v504) - DEPRECATED

### Resume global
- Lines: 12448 (measured)
- Major sections: 24 (based on the table of contents in the file header)
- Primary pages: `index.html`, `carte.html`, `horaires.html`, `itineraire.html`,
  `trafic.html`, `about.html`, `mentions-legales.html`
- Key dependencies: Leaflet map UI, planner form, bottom navigation, offline UI,
  dark theme

### Tableau fonctionnel
Planned target modules are placeholders and will be confirmed per block during
extraction.

| Section | Role | Planned target module |
| --- | --- | --- |
| 1. Map controls | Leaflet controls, locate button, map control UI | public/css/modules/pages/map.css |
| 2. Brand system | CSS variables, typography, spacing, base colors | public/css/modules/base/variables.css |
| 3. Unified hero | Shared hero layout for pages | public/css/modules/components/hero.css |
| 4. Performance | `will-change`, `content-visibility`, `contain` | public/css/modules/utilities/performance.css |
| 5. Accessibility | focus styles, touch targets, reduced motion | public/css/modules/utilities/accessibility.css |
| 6. Offline mode | offline banner, reconnect toast | public/css/modules/components/offline.css |
| 7. Animations | keyframes, transitions | public/css/modules/base/animations.css |
| 8. Bottom navigation | mobile bottom nav bar | public/css/modules/layout/navigation.css |
| 9. Dark theme top bar | top bar theme rules | public/css/modules/themes/dark.css |
| 10. Planner form | origin/destination inputs, swap/clear | public/css/modules/components/forms.css |
| 11. Itinerary results | route cards, badges, durations | public/css/modules/pages/itinerary.css |
| 12. Header mobile fixe | header principal toujours visible sur mobile, compensation zones grises Chrome | public/css/modules/layout/header.css |

### Section : Header mobile fixe (ajout 2026-01-25)

**Rôle** :
- Rend le header principal (#main-header) toujours visible en haut de l’écran sur mobile (≤900px).
- Empêche le header de sortir de l’écran pendant le scroll.
- Compense les zones grises Chrome (barres système) avec `env(safe-area-inset-top)`.
- Applique un z-index élevé et une largeur 100vw pour garantir la visibilité.
- Améliore l’expérience utilisateur sur la vue itinéraires et toutes les pages mobiles.

**Pages concernées** :
- Principalement `itineraire.html`, mais impacte toutes les vues utilisant #main-header sur mobile.

**Pourquoi ?**
- Sur mobile, le header disparaissait au scroll, rendant la navigation désagréable.
- Les zones grises Chrome n’étaient pas compensées, gênant le scroll.

**Statut** : Nouvelle règle (v506, 2026-01-25, module layout/header.css)
| 12. Header & nav | site header, hamburger, dropdown | public/css/modules/layout/header.css |
| 13. Home hero | home page hero | public/css/modules/pages/home.css |
| 14. Quick actions | home shortcuts cards | public/css/modules/components/cards.css |
| 15. Map view | map container, filters, popups | public/css/modules/pages/map.css |
| 16. Bus/stop popups | Leaflet popups | public/css/modules/components/popups.css |
| 17. News banner | traffic banner marquee | public/css/modules/components/banners.css |
| 18. Realtime badge | line status indicators | public/css/modules/components/badges.css |
| 19. Itinerary details | step-by-step panel | public/css/modules/pages/itinerary.css |
| 20. Schedules | timetable grids | public/css/modules/pages/schedules.css |
| 21. UI components | modals, toasts, dropdowns, cards | public/css/modules/components/ |
| 22. Specific pages | about, legal, fares | public/css/modules/pages/ |
| 23. Mobile responsive | responsive overrides, safe areas | public/css/modules/utilities/mobile.css |
| 24. Itinerary V93 | premium redesign | public/css/modules/pages/itinerary.css |

### Problemes detectes
- Monolithic file makes cascade order fragile and hard to maintain.
- Multiple versioned hotfixes are interleaved across sections, increasing risk.
- Existing module files in `public/css/modules/` appear to be out of sync with
  `public/style.css` and should be treated as references only until validated.

### Recommandations de nettoyage
- Extract blocks in the existing order and preserve every rule as-is.
- Keep `public/style.css` as an ordered index with `@import` once modules exist.
- Document selectors and dependencies per block before any cleanup.
- Any cleanup (duplicates, unused rules) must be proposed and validated first.

### Code refactore (optionnel)
- None yet. No CSS rules have been modified or moved in this step.

### Impact visuel estime
- None. This is documentation only.

## Section inventory and status
Status will be updated after each validated extraction.

| Section | Status | Target file |
| --- | --- | --- |
| 1. Map controls | synced (module only) | public/css/modules/pages/map.css |
| 2. Brand system | synced (module only) | public/css/modules/base/variables.css |
| 3. Unified hero | synced (module only) | public/css/modules/components/hero.css |
| 4. Performance | synced (module only) | public/css/modules/utilities/performance.css |
| 5. Accessibility | synced (module only) | public/css/modules/utilities/accessibility.css |
| 6. Offline mode | synced (module only) | public/css/modules/components/offline.css |
| 7. Animations | synced (module only) | public/css/modules/base/animations.css |
| 8. Bottom navigation | synced (module only) | public/css/modules/layout/navigation.css |
| 9. Dark theme top bar | synced (module only) | public/css/modules/themes/dark.css |
| 10. Planner form | synced (module only) | public/css/modules/components/forms.css |
| 11. Itinerary results | synced (module only) | public/css/modules/pages/itinerary.css |
| 12. Header & nav | synced (module only) | public/css/modules/layout/header.css |
| 13. Home hero | synced (module only) | public/css/modules/pages/home.css |
| 14. Quick actions | synced (module only) | public/css/modules/components/cards.css |
| 15. Map view | synced (module only) | public/css/modules/pages/map.css |
| 16. Bus/stop popups | synced (module only) | public/css/modules/components/popups.css |
| 17. News banner | synced (module only) | public/css/modules/components/banners.css |
| 18. Realtime badge | synced (module only) | public/css/modules/pages/traffic.css |
| 19. Itinerary details | synced (module only) | public/css/modules/pages/itinerary.css |
| 20. Schedules | synced (module only) | public/css/modules/pages/schedules.css |
| 21. UI components | synced (module only) | public/css/modules/components/ |
| 22. Specific pages | synced (module only) | public/css/modules/pages/ |
| 23. Mobile responsive | synced (module only) | public/css/modules/utilities/mobile.css |
| 24. Itinerary V93 | synced (module only) | public/css/modules/pages/itinerary.css |

## Class and ID registry (per block)
This registry is updated per block after extraction to list all classes and ids
used in the UI.

## Section 1 - Map controls (Leaflet UI)

### Resume global
- Source: `public/style.css` lines 88-280
- Target module: `public/css/modules/pages/map.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Hides native Leaflet controls and styles the floating map control cluster
- Locate button states (loading, error) and responsive adjustments
- Dark theme visuals for map controls

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/pages/map.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: dark-theme, has-error, is-loading, leaflet-bottom,
  leaflet-control-attribution, leaflet-control-layers, leaflet-control-scale,
  leaflet-control-zoom, leaflet-right, map-btn-locate, map-btn-zoom-in,
  map-btn-zoom-out, map-control-btn, map-floating-controls
- IDs: none

## Section 3 - Unified hero system

### Resume global
- Source: `public/style.css` lines 429-536
- Target module: `public/css/modules/components/hero.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Unified hero container and typography across pages
- Shared page container and card grid patterns
- Mobile hero adjustments for itinerary view and hero sizing

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/components/hero.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: horaires-actions, horaires-grid, horaires-hero, horaires-page,
  itinerary-view-active, ligne-grid, ligne-hero, ligne-page, pm-grid, pm-hero,
  pm-hero-actions, pm-hero-subtitle, pm-hero-title, pm-page, trafic-grid,
  trafic-hero, trafic-page
- IDs: none

## Section 2 - Brand system (CSS variables)

### Resume global
- Source: `public/style.css` lines 294-423
- Target module: `public/css/modules/base/variables.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Design system variables (colors, spacing, typography, z-index)
- Unified container widths and hero sizing variables
- Legacy variable mappings for backward compatibility

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/base/variables.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: none
- IDs: none

## Section 7 - Animations and keyframes

### Resume global
- Source: `public/style.css` lines 767-1030
- Target module: `public/css/modules/base/animations.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Keyframes: fadeIn, fadeInUp, fadeInDown, slideInLeft, slideInRight, scaleIn,
  pulse, shake, ripple, slideUp, bounceIn, notificationPop, pm-ripple, shimmer
- Utility classes: animate-*, stagger-*, page-transition-*, skeleton, pm-ripple-*

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/base/animations.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: animate-bounce-in, animate-fade-in, animate-fade-in-down,
  animate-fade-in-up, animate-scale-in, animate-slide-in-left,
  animate-slide-in-right, bottom-nav-item, btn, btn-icon-round, dark-theme,
  mobile-menu-item, nav-dropdown-item, notification-badge, page-transition-enter,
  page-transition-enter-active, page-transition-exit, page-transition-exit-active,
  pm-is-pressed, pm-ripple, pm-ripple-host, pm-skeleton-card, pm-skeleton-stack,
  quick-action-card, realtime-badge--loading, route-option, skeleton, stagger-1,
  stagger-2, stagger-3, stagger-4, stagger-5, stagger-6
- IDs: none

## Section 5 - Accessibility (WCAG)

### Resume global
- Source: `public/style.css` lines 562-673
- Target module: `public/css/modules/utilities/accessibility.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Focus visible rules for buttons/links/inputs
- Touch target minimum sizes (WCAG 2.5.5)
- Reduced motion preference handling
- Dark theme variable overrides and dark mode visual tweaks

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/utilities/accessibility.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: btn, btn-close, btn-geolocate, btn-icon-round, btn-swap-direction,
  card, dark-theme, instruction-content, leaflet-popup-content-wrapper,
  leaflet-popup-tip, nav-button-condensed, stop-schedule-popup, tab
- IDs: main-header, map

## Section 4 - Performance optimizations

### Resume global
- Source: `public/style.css` lines 536-561
- Target module: `public/css/modules/utilities/performance.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- GPU hinting for animated UI elements
- `content-visibility` for heavy sections
- Containment for fixed header and scroll areas

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/utilities/performance.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: bottom-sheet, bottom-sheet-content, btn, card, modal,
  nav-dropdown-menu, results-list, tarifs-card-body, tarifs-container
- IDs: detail-panel, itinerary-view, main-header, map-view

## Section 6 - Offline mode

### Resume global
- Source: `public/style.css` lines 674-766
- Target module: `public/css/modules/components/offline.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Offline banner (visual warning)
- Reconnect toast (success feedback)

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/components/offline.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: dark-theme, hiding, offline-banner, offline-toast, offline-toast-success
- IDs: none

## Section 8 - Bottom navigation (mobile)

### Resume global
- Source: `public/style.css` lines 1031-1146
- Target module: `public/css/modules/layout/navigation.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Bottom navigation layout and spacing for mobile
- Safe-area handling and dark theme variants
- Map background tweaks for dark theme

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/layout/navigation.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: bottom-nav, bottom-nav-icon, bottom-nav-item, bottom-nav-item--primary,
  bottom-nav-label, dark-theme, detail-view-open, is-active, itinerary-view-active
- IDs: app-view-root, detail-map, results-map

## Section 9 - Dark theme top bar

### Resume global
- Source: `public/style.css` lines 1147-1325
- Target module: `public/css/modules/themes/dark.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Dark theme top bar + clock/status pills
- Dark theme overrides for map controls and inputs
- Leaflet attribution styling and map control positioning

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/themes/dark.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: btn, btn-icon-round, card, dark-theme, leaflet-bar,
  leaflet-control-attribution, leaflet-control-locate, leaflet-right, leaflet-top,
  loaded, planner-block, real-select
- IDs: btn-back-to-dashboard-from-map, btn-back-to-results, btn-toggle-filter,
  bus-count, clock, current-time, data-status, date-indicator, detail-map,
  detail-map-header, detail-map-summary, main-header, map, map-container, map-view,
  results-map, route-filter-panel, status-info, top-bar

## Section - Base structure and scroll fixes

### Resume global
- Source: `public/style.css` lines 1326-2003
- Target module: `public/css/modules/base/reset.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Base element resets and layout defaults
- Mobile scroll fixes (overscroll, bounce, viewport height)
- Legal strip layout and legal footer styling

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/base/reset.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: about-back-btn, about-back-row, about-card, about-header,
  about-header-content, about-main, about-meta-grid, about-page, about-tile,
  btn-icon-round, dark-theme, detail-view-open, fade-in, header-nav, hero-badge,
  hero-card, hero-lede, hero-link, hidden, info-card, info-list, install-blurb,
  install-btn, install-helper, is-visible, itinerary-view-active, legal-about-btn,
  legal-pill, legal-strip-content, tile-layout, tile-points, tile-primary,
  tile-secondary, view-is-locked, view-map-locked
- IDs: app-view-root, dashboard-container, itinerary-results-container,
  legal-strip, main-header, map, map-container, map-view, site-footer

## Section 12 - Header and navigation

### Resume global
- Source: `public/style.css` lines 2004-2107
- Target module: `public/css/modules/layout/header.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Sticky header layout (logo, brand, nav)
- View lock visibility rules for header/footer strips
- Fallback background for browsers without `backdrop-filter`

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/layout/header.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: brand-name, brand-sub, dark-theme, header-content, header-logo-icon,
  header-logo-img, header-nav, header-title-group, hero-section,
  instruction-content, itinerary-view-active, logo, planner-block, view-is-locked,
  view-map-locked
- IDs: legal-strip, main-header, site-footer

## Section 17 - News banner (actualites / etat trafic)

### Resume global
- Source: `public/style.css` lines 2760-2844
- Target module: `public/css/modules/components/banners.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- News banner with label + marquee text for network updates

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/components/banners.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: dark-theme, has-perturbations, marquee-active, marquee-inner,
  marquee-text, news-banner, news-banner-content, news-banner-icon,
  news-banner-label, news-banner-link, news-banner-text, severity-annulation,
  severity-perturbation, severity-retard, stat-label, stat-number, stats-section
- IDs: none

## Component - Traffic alert banner (V84)

### Resume global
- Source: `public/style.css` lines 2108-2182
- Target module: `public/css/modules/components/banners.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Traffic alert banner with severity variants (perturbation, annulation, retard)

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/components/banners.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: type-annulation, type-perturbation, type-retard
- IDs: alert-banner, alert-banner-close, alert-banner-content

## Section 13 - Home hero and planner (dashboard hall)

### Resume global
- Source: `public/style.css` lines 2183-2669
- Target module: `public/css/modules/pages/home.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Dashboard hall layout and hero backdrop/overlay
- Planner block layout, swap button, search controls
- Network delays widget and planner options UI

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/pages/home.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: active, btn-geolocate, btn-swap-direction, btn-when, check-icon,
  chevron, dark-theme, empty-state, form-group, hero-backdrop, hero-overlay,
  input-icon, input-with-icon, network-delays-header, network-delays-widget,
  planner-block, planner-form, planner-inputs-vertical, planner-options,
  planner-search-btn, planner-section, planner-title, popover-active, popover-tab,
  popover-tabs, popover-time-inputs, search-priority-section, search-prominent,
  swap-button-row, swap-line, time-separator
- IDs: dashboard-hall, dashboard-main, planner-submit-btn

## Component - Hall line shortcuts (A/B/C/D)

### Resume global
- Source: `public/style.css` lines 2845-2901
- Target module: `public/css/modules/pages/home.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Direct line shortcuts displayed under the news banner
- Line color variants (A/B/C/D)

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/pages/home.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: dark-theme, hall-line-btn, hall-line-shortcuts, line-a, line-b,
  line-c, line-d
- IDs: none

## Component - Hall express (mobile-first)

### Resume global
- Source: `public/style.css` lines 2902-3040
- Target module: `public/css/modules/pages/home.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Express schedules chip list for the hall view
- Desktop spacing harmonization for hall blocks

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/pages/home.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: dark-theme, express-chip, hall-express, hall-express-all,
  hall-express-chips, hall-express-header, hall-express-title, hall-line-shortcuts,
  news-banner, personalized, planner-block, planner-section, quick-actions-section
- IDs: none

## Component - Legacy planner grid and condensed navigation

### Resume global
- Source: `public/style.css` lines 3135-3337
- Target module: `public/css/modules/pages/home.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Legacy planner grid layout for results (swap column + inputs)
- Condensed navigation buttons grid for hall shortcuts
- Bottom content grid and key figures card layout
- Block link button styling for CTA cards

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/pages/home.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: btn-block-link, btn-swap-direction, bottom-content-wrapper, bottom-grid,
  card, form-group, input-with-action, key-figure-item, key-figure-label,
  key-figure-number, key-figures-card, key-figures-grid,
  main-nav-buttons-condensed, nav-button-condensed, notification-badge,
  planner-inputs, swap-button-slot
- IDs: none

## Component - Internal views and transitions (dashboard hall)

### Resume global
- Source: `public/style.css` lines 3339-3411
- Target module: `public/css/modules/pages/home.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Dashboard hall and content view visibility toggles
- Transitions for view switching and scroll behavior
- 2026-01-25 (modified): entry animation for hall/content views via `pm-view-enter`;
  disabled when prefers-reduced-motion/data or update: slow is active.
- Back button spacing rules in content view
- Planner block enabled only in the hall view

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/pages/home.css`.

### Impact visuel estime
- Subtle view entry animation on hall/content; disabled on reduced-motion/data/slow-update.

### Classes and IDs
- Classes: app-back-btn, planner-section, view-is-active
- IDs: btn-back-to-hall, dashboard-content-view, dashboard-hall

## Component - Back buttons and internal cards (shared)

### Resume global
- Source: `public/style.css` lines 3412-3674
- Target module: `public/css/modules/pages/home.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Unified back button styling across views (light/dark)
- Internal content cards layout and transitions
- View-specific card sizing and anti-grey scroll safeguards
- Search and empty state shell (forms + headings)
- 2026-01-25 (modified): internal card entry animation via `pm-card-enter`;
  disabled when prefers-reduced-motion/data or update: slow is active.

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/pages/home.css`.

### Impact visuel estime
- Subtle card entry animation for internal cards; disabled on reduced-motion/data/slow-update.

### Classes and IDs
- Classes: app-back-btn, card, check-icon, content-cards, empty-state, form-group,
  has-geolocate, input-with-action, schedule-sheets-section, search-priority-section,
  search-prominent, view-active
- IDs: btn-back-to-dashboard-from-map, btn-back-to-dashboard-from-results,
  btn-back-to-hall, btn-back-to-hall-tarifs, btn-back-to-results,
  fiche-horaire-container, horaires, info-trafic

## Component - Schedule card (horaires)

### Resume global
- Source: `public/style.css` lines 3676-3835
- Target module: `public/css/modules/pages/schedules.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Search bar and results dropdown for schedules
- Accordion group layout for timetable listings
- Schedule container card and title styling
- Search shortcut CTA under the schedule card
- 2026-01-25 (modified): allow scroll chaining from accordion panels and search results
  by using `overscroll-behavior: auto` in `public/css/modules/pages/schedules.css`.
- 2026-01-25 (modified): accordion press feedback and content fade/slide
  transitions; reduced-motion/data/slow-update disables motion.

### Problemes detectes
- 2026-01-25: scroll could feel locked on horaires because overscroll containment
  blocked chaining when inner panels could not scroll. Set to `auto`.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/pages/schedules.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: accordion-content, accordion-content-inner, accordion-group,
  fiche-horaire-title, search-result-item
- IDs: btn-horaires-search-focus, fiche-horaire-container,
  horaires-search-bar, horaires-search-container, horaires-search-results,
  horaires-search-shortcut

## Component - Traffic card (info trafic)

### Resume global
- Source: `public/style.css` lines 3836-3996
- Target module: `public/css/modules/pages/traffic.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Tab switcher and scrollable tab panel
- Traffic line badge list with status indicators
- Status icon variants for delays, disruptions, cancellations, works
- 2026-01-25 (modified): allow scroll chaining from traffic tabs by using
  `overscroll-behavior: auto` in `public/css/modules/pages/traffic.css`.
- 2026-01-25 (modified): traffic badge press feedback and transition tuning;
  reduced-motion/data/slow-update disables motion.

### Problemes detectes
- 2026-01-25: scroll could feel locked on info trafic when tab content was not
  scrollable. Updated overscroll behavior to allow chaining.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/pages/traffic.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: active, line-badge, status-annulation, status-icon, status-normal,
  status-perturbation, status-retard, status-travaux, tab, tab-content, tabs,
  trafic-badge-item, trafic-badge-list, trafic-group
- IDs: none

## Component - Line and banner detail modals

### Resume global
- Source: `public/style.css` lines 3997-4426
- Target module: `public/css/modules/components/modals.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Line detail modal layout (header, status pills, body sections)
- Banner detail modal layout with line badges and status tags
- Backdrop, close button, and responsive adjustments

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/components/modals.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: active, banner-detail-backdrop, banner-detail-body, banner-detail-close,
  banner-detail-content, banner-detail-header, banner-detail-modal,
  banner-line-badge, banner-perturbation-header, banner-perturbation-item,
  banner-status-tag, line-detail-backdrop, line-detail-badge, line-detail-body,
  line-detail-close, line-detail-content, line-detail-header, line-detail-modal,
  line-detail-name, line-detail-section, line-detail-status, status-annulation,
  status-badge-icon, status-normal, status-perturbation, status-retard,
  status-travaux
- IDs: none

## Component - Map view (full screen)

### Resume global
- Source: `public/style.css` lines 4427-4464
- Target module: `public/css/modules/pages/map.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Full-screen map container layout
- Flex column layout for map view and map element

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/pages/map.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: view-map-locked
- IDs: map, map-container, map-view

## Component - Map top bar and mobile view rules

### Resume global
- Source: `public/style.css` lines 4465-5257
- Target module: `public/css/modules/pages/map.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Top bar pills, status info, and filter button behaviors
- Map theme toggle and right-side controls grouping
- Mobile view adjustments for hall content, traffic tabs, and alert banner
- Mobile layout tweaks for map container, footer, and filter panel

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/pages/map.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: bottom-grid, brand-name, brand-sub, btn, btn-load-more, collapsed,
  content-cards, dark-theme, error, header-content, header-logo-img, header-nav,
  header-title-group, hidden, load-more-departures, load-more-wrapper, loaded,
  logo, main-nav-buttons-condensed, map-fab-button, map-theme-toggle,
  panel-handle, results-list, results-list-wrapper, spinner-small, tab-content,
  theme-toggle-icon, theme-toggle-label, topbar-pill, view-is-active,
  view-map-locked
- IDs: alert-banner, alert-banner-close, alert-banner-content,
  btn-back-to-dashboard-from-map, btn-back-to-hall, btn-toggle-filter, bus-count,
  clock, current-time, dashboard-content-view, data-status, date-indicator,
  info-trafic, main-header, map-container, map-view, route-filter-panel,
  site-footer, status-info, top-bar, top-right-controls

## Component - Common UI styles

### Resume global
- Source: `public/style.css` lines 5258-5624
- Target module: `public/css/modules/components/common.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Shared button variants and icon buttons
- Filter panel controls and route list items
- Instruction modal content + install tip card

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/components/common.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: btn, btn-category-action, btn-close, btn-icon-round, btn-primary,
  btn-secondary, btn-small, category-actions, category-count, category-header,
  category-routes, category-title, dark-theme, filter-actions, filter-header,
  hidden, install-tip, install-tip-badge, install-tip-card, install-tip-header,
  install-tip-lede, install-tip-open, install-tip-steps, instruction-content,
  instruction-header, planner-block, planner-search-btn, route-badge,
  route-checkbox-item, route-list, route-name
- IDs: close-instructions, install-tip, install-tip-close, instructions,
  planner-submit-btn

## Component - Stacking corrections (global)

### Resume global
- Source: `public/style.css` lines 5625-5648
- Target module: `public/css/modules/utilities/stacking.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Global z-index stacking fixes for hero and bottom content
- Overflow visibility to avoid clipped planner content

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/utilities/stacking.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: bottom-content-wrapper, hero-section, planner-block,
  planner-block-wrapper, planner-form
- IDs: none

## Component - Leaflet styles (map + popups)

### Resume global
- Source: `public/style.css` lines 5649-6250
- Target module: `public/css/modules/components/leaflet.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Leaflet base popup sizing, marker layers, clusters, and controls
- Bus popup layout and stop markers
- Real-time badge states and wait time display

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/components/leaflet.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: alighting, badge-dot, boarding, bus-appear, bus-details,
  bus-icon-rect, bus-icon-waiting, bus-popup-body, bus-popup-footer,
  bus-popup-header, bus-popup-icon, bus-popup-info, bus-popup-info-row,
  bus-popup-line-badge, bus-popup-modern, bus-popup-title,
  bus-status-annulation, bus-status-perturbation, bus-status-retard, dark-theme,
  departure-badge, departure-dest, departure-info, departure-item,
  departure-time, destination, empty, eta-highlight, following, imminent,
  info-label, info-popup-body, info-popup-content, info-popup-header,
  info-value, intermediate, itinerary-stop-marker, leaflet-control-locate,
  leaflet-marker-pane, leaflet-popup, leaflet-popup-close-button,
  leaflet-popup-content, leaflet-popup-content-wrapper, leaflet-popup-pane,
  leaflet-popup-tip, leaflet-popup-tip-container, leaflet-zoom-animated,
  line-number, marker-cluster, marker-cluster-large, marker-cluster-medium,
  marker-cluster-small, realtime, realtime-badge, realtime-notice, route-destination,
  route-name, stop-marker-icon, stop-search-marker, theoretical, transfer,
  user-location-marker, wait-time, walk-icon
- IDs: none

## Component - Stop popup V105 (SNCF Connect style)

### Resume global
- Source: `public/style.css` lines 6251-6469
- Target module: `public/css/modules/components/popups.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Stop popup container, notice, and line blocks
- Destinations list with clickable rows
- Realtime indicator for departures

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/components/popups.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: dark-theme, dest-arrow, dest-label, leaflet-popup-close-button,
  leaflet-popup-content, leaflet-popup-content-wrapper, leaflet-popup-tip,
  popup-badge, popup-dest-clickable, popup-dest-name, popup-dest-row,
  popup-empty, popup-empty-icon, popup-line-block, popup-line-header,
  popup-notice, popup-stop-name, popup-time, popup-times, realtime,
  realtime-icon, stop-popup-v105, stop-schedule-popup
- IDs: none

## Component - Planner general styles

### Resume global
- Source: `public/style.css` lines 6470-6597
- Target module: `public/css/modules/components/forms.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Planner form labels and input helpers
- Geolocate button positioning
- Inline icon fields

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/components/forms.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: btn-geolocate, btn-swap-direction, form-group, has-geolocate,
  input-icon, input-with-icon, itinerary-edit-form, planner-block, spinner
- IDs: itinerary-results-container

## Component - Planner popovers and z-index fixes

### Resume global
- Source: `public/style.css` lines 6598-7094
- Target module: `public/css/modules/components/forms.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Planner popovers for home and results
- Time select dropdowns and suggestion list styles
- Z-index fixes for overlapping planner controls

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/components/forms.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: active, autocomplete-suggestions, btn-popover-submit,
  btn-swap-direction, btn-when, btn-when-inline, dark-theme, form-group,
  form-group-when, hidden, is-active, is-open, planner-form, planner-inputs,
  planner-search-btn, popover-active, popover-content, popover-tab,
  popover-tabs, popover-time-inputs, real-select, results-planner-inputs,
  suggestion-item, swap-button-slot, time-select-display, time-select-menu,
  time-select-native, time-select-option, time-select-wrapper,
  time-select-wrapper-hour, time-select-wrapper-minute
- IDs: planner-options-popover, results-planner-options-popover

## Component - Itinerary results view and form

### Resume global
- Source: `public/style.css` lines 7095-10430
- Target module: `public/css/modules/pages/itinerary.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Full-screen itinerary results layout with side panel + map
- Itinerary form redesign (top bar, inputs, visual indicators)
- Results list, route cards, step details, and detail panels
- Detail map header: back button and time summary aligned on the left (mobile)
- Update banner and recent journeys sections
- 2026-01-25 (modified): mobile results gutter aligned with the itinerary form,
  list container chrome removed via `public/css/components/itinerary.css`,
  load-more stays full-width on mobile and aligns on desktop.
- 2026-01-25 (modified): mobile detail header aligned to the safe-area with
  top spacing matching side padding; back button + time summary share styling.
- 2026-01-25 (modified): recent journeys wrapper now matches the schedule-sheets
  title placement; section background removed and the card chrome moved to
  `#recent-journeys-container` in `public/css/components/itinerary.css`.
- 2026-01-25 (modified): empty recent journeys state uses the same card chrome
  so the block stays visible until results are rendered.

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/pages/itinerary.css`.

### Impact visuel estime
- Cleaner mobile alignment between form, tabs, and route cards; recent journeys now
  matches the schedule-sheets title + card styling.

### Classes and IDs
- Classes: active, app-back-btn, bicycle, bottom-content-wrapper, btn-full-width,
  btn-geolocate-minimal, btn-search-route, btn-sm, btn-swap-minimal,
  btn-time-picker, chevron, dark-theme, departure-time, destination, empty,
  error, footer-bottom, footer-bottom-right, footer-brand, footer-brand-name,
  footer-brand-tagline, footer-brand-text, footer-content, footer-copyright,
  footer-data-info, footer-independent, footer-license, footer-links,
  footer-links-column, footer-logo, footer-main, footer-social-btn,
  footer-social-btn-sm, footer-social-column, footer-social-links,
  footer-social-mobile, form-group, header-nav-link, hero-headline, hero-section,
  hero-subtitle, hidden, highlight, indicator-dot, indicator-line,
  intermediate-stops, intermediate-stops-list, is-active, is-dragging,
  is-expanded, is-terminus, itinerary-edit-form, itinerary-edit-header,
  itinerary-top-bar, itinerary-view-active, key-figure-item, key-figure-label,
  key-figure-number, key-figures-grid, main-nav-buttons-condensed, mode-tab,
  mode-tab-duration, nav-button-condensed, network-delays-header,
  network-delays-list, network-delays-widget, next-departures-label,
  next-departures-more, notification-badge, origin, panel-handle,
  planner-block, planner-title-bar, popover-content, promo-banner,
  promo-banner-btn, promo-banner-content, promo-banner-icon, promo-banner-text,
  recent-journey-card, recent-journey-delete, recent-journey-duration,
  recent-journey-info, recent-journey-lines, recent-journey-meta,
  recent-journey-route, recent-journeys-empty, recent-journeys-section,
  results-list, results-list-wrapper, results-message, results-planner-inputs,
  route-actions, route-details, route-duration, route-duration-eco,
  route-footer, route-input, route-input-container, route-input-wrapper,
  route-inputs-stack, route-line-badge, route-next-departures, route-option,
  route-option-title, route-option-wrapper, route-summary-bike-icon,
  route-summary-bus-icon, route-summary-dot, route-summary-line,
  route-summary-walk-icon, route-summary-walk-only-icon, route-time,
  route-visual-indicators, section-title, service-card, service-card-arrow,
  service-card-content, service-card-icon, service-card-icon--blue,
  service-card-icon--green, service-card-icon--orange, services-grid,
  services-section, sheet-height-no-transition, sheet-level-0, sheet-level-1,
  sheet-level-2, stat-item, stat-label, stat-number, stats-card, stats-grid,
  stats-header, stats-section, step-detail, step-duration-inline, step-icon,
  step-info, step-instruction, step-stop-point, step-sub-instruction,
  step-time, step-time-detail, stop-context, stop-label, top-info-badge,
  top-info-content, top-info-left, top-info-link, update-banner-content,
  view-is-locked, view-map-locked, wait, wait-duration, wait-info, wait-time,
  walk, walk-step-info, walk-step-meta, walk-steps
- IDs: btn-back-to-results, detail-bottom-sheet, detail-map, detail-map-header,
  detail-map-summary, detail-panel-content, detail-panel-wrapper,
  itinerary-detail-backdrop, itinerary-detail-container, itinerary-edit-panel,
  itinerary-results-container, main-header, recent-journeys-container,
  recent-journeys-list, results-map, results-mode-tabs, results-planner-from,
  results-planner-options-popover, results-planner-to, results-side-panel,
  site-footer, top-info-bar, update-banner, update-dismiss

## Component - Navigation dropdown (IDFM-style)

### Resume global
- Source: `public/style.css` lines 10430-10935
- Target module: `public/css/modules/layout/header.dropdown.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Desktop navigation dropdown and trigger styling
- Mobile menu sections, items, and badges
- Header nav right actions and states

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/layout/header.dropdown.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: btn-icon-round, dark-theme, header-content, header-nav-main,
  header-nav-right, hidden, is-active, is-expanded, is-open, logo, mobile-menu,
  mobile-menu-category, mobile-menu-chevron, mobile-menu-item,
  mobile-menu-item--disabled, mobile-menu-items, mobile-menu-open,
  mobile-menu-section, mobile-menu-toggle, nav-badge, nav-dropdown,
  nav-dropdown-item, nav-dropdown-item--disabled, nav-dropdown-menu,
  nav-dropdown-trigger
- IDs: none

## Component - Tarifs page

### Resume global
- Source: `public/style.css` lines 10936-11677
- Target module: `public/css/modules/pages/traffic.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Tarifs page layout, cards, and navigation grid
- Payment options, app links, and mediation sections
- Alert banners and informational blocks

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- Move to a dedicated page module (e.g. `public/css/modules/pages/tarifs.css`) once extraction is complete.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/pages/traffic.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: dark-theme, tarifs-address, tarifs-alert, tarifs-alert--important,
  tarifs-alert--warning, tarifs-amende-options, tarifs-app-btn,
  tarifs-app-btn--android, tarifs-app-btn--ios, tarifs-app-links, tarifs-benefit,
  tarifs-bullet, tarifs-buy-icon, tarifs-buy-item, tarifs-buy-item--highlight,
  tarifs-buy-options, tarifs-buy-text, tarifs-card, tarifs-card--info,
  tarifs-card--success, tarifs-card--warning, tarifs-card-warning, tarifs-choice,
  tarifs-choice--pass, tarifs-choice-icon, tarifs-choice-separator,
  tarifs-content, tarifs-cta-section, tarifs-cta-text, tarifs-distributeur-features,
  tarifs-download-btn, tarifs-download-warning, tarifs-feature,
  tarifs-feature--primary, tarifs-feature-benefits, tarifs-feature-content,
  tarifs-feature-icon, tarifs-features, tarifs-header, tarifs-icon,
  tarifs-info-box, tarifs-info-item, tarifs-intro, tarifs-link, tarifs-link-btn,
  tarifs-list-compact, tarifs-list-locations, tarifs-location-city,
  tarifs-location-stops, tarifs-mediation, tarifs-mediation-box,
  tarifs-mediation-choices, tarifs-mediation-conditions, tarifs-mediation-docs,
  tarifs-mediation-question, tarifs-nav-arrow, tarifs-nav-card, tarifs-nav-grid,
  tarifs-nav-icon, tarifs-nav-title, tarifs-note, tarifs-pass-details,
  tarifs-payment-icon, tarifs-payment-option, tarifs-payment-options,
  tarifs-payment-text, tarifs-price, tarifs-price-highlight, tarifs-section-title,
  tarifs-small, tarifs-subtitle
- IDs: none

## Section 14 - Quick actions (home shortcuts)

### Resume global
- Source: `public/style.css` lines 2670-2759
- Target module: `public/css/modules/components/cards.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Quick action cards grid for home shortcuts (Carte, Horaires, Trafic)
- Mobile hide rules when bottom navigation is active

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/components/cards.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: dark-theme, desktop-only, quick-action-card, quick-action-icon,
  quick-actions-section
- IDs: none

## Section 23 - Mobile responsive utilities

### Resume global
- Source: `public/style.css` lines 11678-12596, 13686-13846
- Target module: `public/css/modules/utilities/mobile.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Mobile layout overrides for header, hero, planner, services, stats, promo, footer, tarifs
- Touch/size adjustments for popups, autocomplete, news banner, and bottom sheet
- Dark theme mobile fixes for missing components and planner elements
- Safe area padding and global scrollbar styling
- Itinerary mobile layout refonte and navy background unification for mobile views
- Itinerary mobile list wrapper gutter aligned to the itinerary form with safe-area bottom spacing

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/utilities/mobile.css`.

### Impact visuel estime
- None. `public/style.css` remains the active source.

### Classes and IDs
- Classes: accordion-content, accordion-group, active, alert-item, autocomplete-item,
  autocomplete-suggestions, bottom-sheet, btn, btn-geolocate, btn-swap-direction,
  btn-when, card, dark-theme, departure-badge, departure-dest, departure-item,
  departure-time-chip, departure-times-list, disruption-card, footer-bottom,
  footer-content, footer-copyright, footer-independent, footer-main, form-group,
  header-logo, header-logo-link, header-nav, hero-headline, hero-section,
  hero-subtext, hero-subtitle, horaire-card, horaire-item, horaires-hero,
  horaires-view-active, input-group, is-dragging, is-expanded, is-scrolled,
  is-selected, itinerary-edit-header, itinerary-inputs, itinerary-top-bar,
  itinerary-view-active, leaflet-container, leaflet-popup-content,
  line-departures-group, line-header, list-item, marquee-active, marquee-inner,
  mode-tab, nav-dropdown-menu, nav-dropdown-toggle, news-banner,
  news-banner-content, news-banner-icon, news-banner-label, news-banner-link,
  news-banner-text, panel-handle, planner-block, planner-block-wrapper,
  planner-title, popover-tab, popup-badge, popup-dest-name, popup-dest-row,
  popup-line-header, popup-stop-name, popup-time, promo-banner, promo-content,
  quick-action-card, real-select, recent-journeys-empty, recent-journeys-section,
  result-item, results-list, results-list-wrapper, route-card, route-input-wrapper,
  route-option, search-result-item, service-card, service-icon, service-title,
  services-grid, services-section, stat-item, stat-number, stats-container,
  stats-section, step-destination-icon, step-detail, step-icon, step-walk-icon,
  stop-popup-v105, stop-schedule-popup, swap-line, tab, tarifs-app-btn,
  tarifs-app-links, tarifs-buy-item, tarifs-card, tarifs-download-btn,
  tarifs-feature, tarifs-feature-benefits, tarifs-header, tarifs-info-item,
  tarifs-nav-grid, tarifs-page, tarifs-payment-option, tarifs-section-title,
  trafic-card, trafic-hero, trafic-view-active
- IDs: app-view-root, dashboard-container, detail-bottom-sheet, detail-panel-content,
  detail-panel-wrapper, from-suggestions, horaires-container,
  horaires-search-results, itinerary-detail-backdrop, itinerary-detail-container,
  itinerary-edit-panel, itinerary-results-container, main-header, map,
  map-container, planner-options-popover, planner-submit-btn,
  recent-journeys-container, results-from-suggestions, results-map,
  results-mode-tabs, results-planner-options-popover, results-planner-submit-btn,
  results-side-panel, results-to-suggestions, route-filter-panel, site-footer,
  to-suggestions, trafic-container

## Section 24 - Itinerary V91/V93 premium redesign

### Resume global
- Source: `public/style.css` lines 12597-13685
- Target module: `public/css/modules/pages/itinerary.css`
- Status: module synced; `public/style.css` unchanged

### Tableau fonctionnel
- Premium itinerary redesign for side panel, tabs, route cards, and actions
- Refined badges, icons, durations, and next departures layout
- Button styling for time picker and search actions
- Soft entrance animation and mobile-responsive adjustments
- 2026-01-25 (modified): load-more button styling aligned with route cards
  on desktop and full-width on mobile.

### Problemes detectes
- None. Rules copied as-is from the monolithic file.

### Recommandations de nettoyage
- None yet. Keep order intact until all blocks are extracted.

### Code refactore (optionnel)
- Extracted verbatim into `public/css/modules/pages/itinerary.css`.

### Impact visuel estime
- Itinerary list looks more consistent on mobile; load-more keeps a clean full-width layout.

### Classes and IDs
- Classes: active, btn, btn-full-width, btn-when, btn-when-inline, dark-theme,
  empty, form-group, is-active, itinerary-edit-form, itinerary-edit-header,
  load-more-departures, load-more-wrapper, mode-tab, mode-tab-duration,
  next-departures-label, next-departures-more, next-departures-time, results-list,
  route-duration, route-duration-eco, route-footer, route-line-badge,
  route-next-departures, route-option, route-option-title, route-option-wrapper,
  route-summary-bike-icon, route-summary-bus-icon, route-summary-dot,
  route-summary-line, route-summary-walk-icon, route-summary-walk-only-icon,
  route-time
- IDs: itinerary-edit-panel, planner-submit-btn, results-mode-tabs,
  results-planner-from, results-planner-submit-btn, results-planner-to,
  results-side-panel

## Change log
- 2026-01-24: Created documentation baseline for `public/style.css`.
- 2026-01-25: Adjusted overscroll behavior for schedules and traffic modules to
  restore scroll chaining on horaires/info trafic views.
- 2026-01-25: Added horaires/traffic click animations with reduced-motion/data
  fallbacks to limit GPU impact on weak devices.
- 2026-01-25: Added hall/content view and internal card entry animations with
  reduced-motion/data/slow-update fallbacks.
- 2026-01-25: Harmonized itinerary list widths on mobile and kept the load-more
  button full-width on mobile with desktop alignment.
- 2026-01-25: Aligned itinerary mobile list wrapper gutter with the form and
  documented the mobile list container reset in `public/css/components/itinerary.css`.
- 2026-01-25: Tuned the mobile itinerary detail header top spacing to match
  side padding and kept the back button + summary pill unified.
- 2026-01-24: Synced section 7 (animations) module and registry.
- 2026-01-24: Synced section 5 (accessibility) module and registry.
- 2026-01-24: Synced section 4 (performance) module and registry.
- 2026-01-24: Synced section 6 (offline mode) module and registry.
- 2026-01-24: Synced section 8 (bottom navigation) module and registry.
- 2026-01-24: Synced section 9 (dark theme top bar) module and registry.
- 2026-01-24: Synced base structure block (reset) module and registry.
- 2026-01-24: Synced section 12 (header) module and registry.
- 2026-01-24: Synced section 17 (news banner) module and registry.
- 2026-01-24: Synced traffic alert banner (V84) sub-block and registry.
- 2026-01-24: Synced section 13 (home hero + planner hall) module and registry.
- 2026-01-24: Synced section 14 (quick actions) module and registry.
- 2026-01-24: Synced hall line shortcuts (A/B/C/D) sub-block and registry.
- 2026-01-24: Synced hall express (mobile-first) sub-block and registry.
- 2026-01-24: Synced news banner severity variants sub-block and registry.
- 2026-01-24: Synced legacy planner grid + condensed navigation sub-block and registry.
- 2026-01-24: Synced internal views and transitions sub-block and registry.
- 2026-01-24: Synced back buttons and internal cards sub-block and registry.
- 2026-01-24: Synced schedule card (horaires) sub-block and registry.
- 2026-01-24: Synced traffic card (info trafic) sub-block and registry.
- 2026-01-24: Synced line and banner detail modals sub-block and registry.
- 2026-01-24: Synced map view (full screen) sub-block and registry.
- 2026-01-24: Synced map top bar + mobile view rules sub-block and registry.
- 2026-01-24: Synced common UI styles sub-block and registry.
- 2026-01-24: Synced stacking corrections sub-block and registry.
- 2026-01-24: Synced Leaflet styles sub-block and registry.
- 2026-01-24: Synced stop popup V105 (SNCF Connect style) sub-block and registry.
- 2026-01-24: Synced planner general styles sub-block and registry.
- 2026-01-24: Synced planner popovers and z-index fixes sub-block and registry.
- 2026-01-24: Synced itinerary results view and form sub-block and registry.
- 2026-01-24: Synced navigation dropdown (IDFM-style) sub-block and registry.
- 2026-01-24: Synced section 23 (mobile responsive utilities) module and registry.
- 2026-01-24: Synced section 24 (itinerary V91/V93 premium redesign) module and registry.
- 2026-01-24: Synced section 1 (map controls) module and registry.
- 2026-01-24: Synced section 3 (unified hero system) module and registry.
- 2026-01-24: Synced section 2 (brand system variables) module and registry.