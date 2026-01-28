# Padding Ownership Map — PériMap
## Canonical Padding Owners Per View

**Version:** 1.0.0  
**Date:** 28 janvier 2026  
**Phase:** Padding Stabilization Phase 1 (Documentation)  
**Related:** PADDING_STABILIZATION_PLAN.md, CSS_PADDING_ARCHITECTURE.md

---

## 📋 PURPOSE

This document establishes the **canonical owner** for padding/margin in each view of PériMap. When you need to change padding, refer to this map to know **which file and which container** should be modified.

**Rule:** Padding should be defined in ONE canonical location per element. Avoid duplicating padding rules across multiple files.

---

## 🏠 HOME VIEW

### Canonical Padding Owners

**Main Containers:**
- `#dashboard-hall` → Owned by: `modules/pages/home.css`
- `#dashboard-content-view` → Owned by: `modules/pages/home.css`
- `.service-cards` wrapper → Owned by: `modules/pages/home.css`

**Mobile Overrides:**
- Owned by: `modules/utilities/mobile.css` (when view-specific behavior required)
- Use view state class: `body.home-view-active` (if needed)

**Layout Padding:**
- Header compensation: `modules/pages/home.css` (desktop + responsive)
- Bottom navigation clearance: `modules/utilities/mobile.css` (!important justified)

**Components:**
- `.service-card` internal padding → `modules/components/cards.css`
- Button padding → `modules/components/buttons.css`

### Padding Rules

1. ✅ **DO:** Define base padding in `home.css`
2. ✅ **DO:** Use responsive media queries in same file (`home.css`)
3. ⚠️ **CAUTION:** Mobile.css may override with !important (check first)
4. ❌ **DON'T:** Add view-specific padding to components/*.css

---

## 🗺️ MAP VIEW

### Canonical Padding Owners

**Main Containers:**
- `#map-side-panel` → Owned by: `modules/pages/map.css`
- `.map-results-header` → Owned by: `modules/pages/map.css`
- `#map-container` → Owned by: `modules/pages/map.css`

**Mobile Overrides:**
- Owned by: `modules/utilities/mobile.css`
- Use view state class: `body.view-map-locked`

**Layout Padding:**
- Fixed positioning padding: `modules/pages/map.css`
- Safe-area compensation: `modules/layout/navigation.css` (for bottom nav)

**Components:**
- Map popups → `modules/components/popups.css` OR `modules/components/leaflet.css`
- Stop markers → `modules/components/leaflet.css`

### Padding Rules

1. ✅ **DO:** Define map view padding in `map.css`
2. ✅ **DO:** Use `position: fixed` with calculated padding for full-screen mode
3. ⚠️ **CAUTION:** Mobile.css controls `body.view-map-locked` layout
4. ❌ **DON'T:** Mix padding between map.css and mobile.css without documentation

---

## 🚌 ITINERARY VIEW

### Canonical Padding Owners

**Main Containers:**
- `#itinerary-results-container` → Owned by: `modules/utilities/mobile.css` (mobile) + `modules/pages/itinerary.css` (desktop)
- `#results-side-panel` → Owned by: **CONFLICT ZONE** (see below)
- `.results-list-wrapper` → Owned by: `modules/utilities/mobile.css` (!important)
- `.recent-journeys-section` → Owned by: `modules/utilities/mobile.css` (!important)

**⚠️ CRITICAL: Load Order Conflict**

`#results-side-panel` padding is affected by:
1. `modules/pages/itinerary.css` (base rules)
2. `modules/utilities/mobile.css` (mobile + !important)
3. `css/components/itinerary.css` (loaded last via HTML — WINS)

**Current Winner:** `css/components/itinerary.css` (line 128) sets `padding-bottom: 200px` and overrides mobile.css.

**Mobile Overrides:**
- Owned by: `modules/utilities/mobile.css` (most rules)
- Uses: `body.itinerary-view-active .element` (!important)

**Components:**
- `.recent-journey-card` → `modules/pages/itinerary.css` (internal padding)
- `.itinerary-top-bar` → **CONFLICT** between mobile.css and components/itinerary.css
- `#itinerary-edit-panel` → `modules/utilities/mobile.css` (!important)

### Padding Rules

1. ⚠️ **DANGER ZONE:** This view has the most complex padding cascade
2. ✅ **DO:** Check mobile.css FIRST before modifying padding
3. ✅ **DO:** Check components/itinerary.css SECOND (loads last)
4. ❌ **DON'T:** Assume padding changes in itinerary.css will work (likely overridden)
5. 📘 **REFERENCE:** See CSS_PADDING_ARCHITECTURE.md for complete cascade analysis

---

## 📅 SCHEDULES VIEW (Horaires)

### Canonical Padding Owners

**Main Containers:**
- `#horaires.view-active` → Owned by: `modules/utilities/mobile.css` (mobile) + `modules/pages/schedules.css` (desktop)
- `#fiche-horaire-container` → Owned by: `modules/pages/schedules.css`
- `.accordion-group` → Owned by: `modules/pages/schedules.css`

**Mobile Overrides:**
- Owned by: `modules/utilities/mobile.css`
- Use view state class: `body.horaires-view-active`

**Components:**
- `.accordion-group summary` → `modules/pages/schedules.css` (base + responsive)
- `.accordion-content` → `modules/pages/schedules.css`

### Padding Rules

1. ✅ **DO:** Define base padding in `schedules.css`
2. ✅ **DO:** Use media queries in `schedules.css` for responsive padding
3. ✅ **DO:** Mobile.css handles view state-specific overrides
4. ❌ **DON'T:** Add !important in schedules.css (mobile.css already uses it)

---

## 🚦 TRAFFIC VIEW (Trafic)

### Canonical Padding Owners

**Main Containers:**
- `#info-trafic.view-active` → Owned by: `modules/utilities/mobile.css` (mobile) + `modules/pages/traffic.css` (desktop)
- `.traffic-card` → Owned by: `modules/pages/traffic.css`
- `.disruption-item` → Owned by: `modules/pages/traffic.css`

**Mobile Overrides:**
- Owned by: `modules/utilities/mobile.css`
- Use view state class: `body.trafic-view-active`

**Components:**
- `.alert-banner` → `modules/components/banners.alert.css`
- Line badges → `modules/components/badges.css`

### Padding Rules

1. ✅ **DO:** Define traffic-specific padding in `traffic.css`
2. ✅ **DO:** Use media queries in same file
3. ⚠️ **CAUTION:** Some rules use !important (lines 752, 805-810, 909-916, 1036, 1051)
4. ❌ **DON'T:** Override mobile.css rules without high specificity

---

## 🧩 GLOBAL / LAYOUT CONTAINERS

### Canonical Padding Owners

**HTML/Body:**
- Reset padding → Owned by: `modules/base/reset.css`
- Safe-area padding → Owned by: `modules/layout/navigation.css` (bottom nav)

**Header:**
- `#app-header` → Owned by: `modules/layout/header.css`
- Fixed positioning compensation → Owned by: per-view CSS files (home.css, map.css, etc.)

**Bottom Navigation:**
- `.nav-bottom` → Owned by: `modules/layout/navigation.css`
- Safe-area padding → **USES !important** (justified for iOS)

**App Root:**
- `#app-view-root` → Owned by: per-view CSS via mobile.css

### Padding Rules

1. ✅ **DO:** Use `modules/base/reset.css` for global resets only
2. ✅ **DO:** Use `modules/layout/navigation.css` for safe-area padding (!important justified)
3. ❌ **DON'T:** Add view-specific padding to layout files
4. ❌ **DON'T:** Remove !important from safe-area rules (iOS requires it)

---

## 🔧 COMPONENTS (Reusable)

### Canonical Padding Owners

**Buttons:**
- `.btn`, `.app-back-btn`, etc. → Owned by: `modules/components/buttons.css`
- May use !important for consistency (lines 134, 179)

**Cards:**
- `.card`, `.service-card`, etc. → Owned by: `modules/components/cards.css`
- Exception: View-specific cards may be in pages/*.css

**Forms:**
- `.form-control`, `.route-input`, etc. → Owned by: `modules/components/forms.css`

**Modals:**
- `.modal`, `.modal-content` → Owned by: `modules/components/modals.css`

**Popups (Map):**
- `.leaflet-popup`, `.map-popup` → Owned by: `modules/components/popups.css` OR `modules/components/leaflet.css`
- Uses !important to override Leaflet defaults

### Padding Rules

1. ✅ **DO:** Keep component padding self-contained
2. ✅ **DO:** Use spacing tokens (`var(--spacing-*)`)
3. ⚠️ **CAUTION:** Some components use !important to override libraries (Leaflet)
4. ❌ **DON'T:** Add view-specific logic to component CSS

---

## 🚨 CONFLICT ZONES (High Risk)

### 1. Itinerary View — Results Panel

**Conflict:** `#results-side-panel` padding

**Files Involved:**
1. `modules/pages/itinerary.css` (base)
2. `modules/utilities/mobile.css` (!important)
3. `css/components/itinerary.css` (loads last — WINS)

**Current Winner:** `components/itinerary.css` → `padding-bottom: 200px`

**How to Change:**
- Desktop: Edit `pages/itinerary.css`
- Mobile: Edit `components/itinerary.css` (loads last) OR `mobile.css` with higher specificity

---

### 2. Home View — Service Cards

**Conflict:** `.service-card` spacing

**Files Involved:**
1. `modules/pages/home.css` (lines 933-936 — uses !important)
2. `modules/components/cards.css` (base)

**Current Winner:** `home.css` with !important → all spacing set to 0

**How to Change:**
- Edit `home.css` lines 933-936 (currently has !important)
- Or remove !important and use normal cascade

---

### 3. Mobile.css — Cross-View Overrides

**Conflict:** Multiple elements across all views

**Files Involved:**
1. `modules/utilities/mobile.css` (50+ !important declarations)
2. All view-specific CSS files (overridden)

**Current Winner:** `mobile.css` (highest specificity + !important)

**How to Change:**
- Check mobile.css FIRST before modifying any mobile padding
- If conflict, edit mobile.css OR remove !important and use view-specific file

---

## 📊 PADDING OWNERSHIP SUMMARY TABLE

| View | Primary Owner | Mobile Owner | Conflict Risk | Notes |
|------|---------------|--------------|---------------|-------|
| **Home** | `home.css` | `mobile.css` | 🟡 Medium | Some !important in home.css |
| **Map** | `map.css` | `mobile.css` | 🟢 Low | Clear separation |
| **Itinerary** | `itinerary.css` | `mobile.css` + `components/itinerary.css` | 🔴 HIGH | 3-layer cascade, load order issue |
| **Schedules** | `schedules.css` | `mobile.css` | 🟢 Low | Predictable |
| **Traffic** | `traffic.css` | `mobile.css` | 🟡 Medium | Some !important in traffic.css |
| **Layout** | `layout/*.css` | `mobile.css` | 🟢 Low | Safe-area requires !important |
| **Components** | `components/*.css` | N/A | 🟢 Low | Self-contained |

---

## 🎯 DECISION TREE: WHERE TO CHANGE PADDING

```
START: Need to change padding on element in view X
  │
  ├─ Is it mobile-specific (< 768px)?
  │  │
  │  ├─ YES → Check modules/utilities/mobile.css FIRST
  │  │        (It may have !important override)
  │  │        │
  │  │        ├─ Found rule with !important?
  │  │        │  └─ Edit mobile.css (that's the canonical owner)
  │  │        │
  │  │        └─ No rule in mobile.css?
  │  │           └─ Edit view-specific file (pages/{view}.css) with @media query
  │  │
  │  └─ NO (Desktop or global)
  │     └─ Edit view-specific file (pages/{view}.css)
  │
  ├─ Is it for Itinerary view?
  │  │
  │  └─ YES → ⚠️ EXTRA CHECK:
  │            1. Check modules/utilities/mobile.css
  │            2. Check css/components/itinerary.css (loads last)
  │            3. Edit the file that currently defines it
  │            4. Verify in DevTools which rule wins
  │
  ├─ Is it a reusable component? (button, card, modal)
  │  │
  │  └─ YES → Edit modules/components/{component}.css
  │
  └─ Is it global layout? (header, navigation, safe-area)
     │
     └─ YES → Edit modules/layout/*.css
```

---

## 🔄 MIGRATION NOTES (Phase 2+)

**Planned Changes (Future):**
- [ ] Consolidate components/itinerary.css into pages/itinerary.css (resolve load order)
- [ ] Reduce !important usage in mobile.css (audit each one)
- [ ] Remove !important from home.css where unnecessary (lines 933-936)
- [ ] Migrate hard-coded padding to spacing tokens (`var(--spacing-*)`)

**DO NOT MODIFY IN PHASE 1** — This is planning only.

---

## ✅ CONCLUSION

**When changing padding:**
1. Check this map for canonical owner
2. Use decision tree to determine which file
3. For mobile: Check mobile.css FIRST (it may override)
4. For itinerary: Check components/itinerary.css SECOND (loads last)
5. Verify in DevTools which rule actually applies

**Avoid:**
- Adding padding to multiple files for same element
- Using !important without checking if necessary
- Assuming view-specific file will work (mobile.css may override)

---

**Document Version:** 1.0.0  
**Last Updated:** 28 janvier 2026  
**Phase:** Padding Stabilization Phase 1  
**Next Review:** After Phase 2 execution
