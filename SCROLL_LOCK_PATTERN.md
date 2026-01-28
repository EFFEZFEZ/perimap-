# Scroll Lock Pattern — PériMap Official Guide
## Standard Reference for Scroll Control

**Version:** 1.0.0  
**Date:** 28 janvier 2026  
**Status:** Official Team Documentation  
**Related Docs:** CSS_SCROLL_ARCHITECTURE.md, SCROLL_STABILIZATION_PLAN.md, CSS_ADVANCED_AUDIT_REPORT.md

---

## 🎯 PURPOSE

This document establishes the **single, official pattern** for scroll control in PériMap.

**Goal:** Predictable, maintainable scroll behavior across all views.

**Audience:** All developers working on PériMap (CSS, JavaScript, HTML).

---

## 📐 PRIMARY SCROLL CONTAINER (PER VIEW)

### Desktop (All Views)

```
html → PRIMARY SCROLL CONTAINER
  - overflow-y: scroll
  - Always scrolls (unless explicitly locked)
  
body → PASS-THROUGH
  - overflow-y: visible
  - Lets scroll propagate to html parent
```

**Rule:** On desktop, `html` always controls page scroll.

### Mobile (View-Specific)

| View | Scroll Container | Scroll Model | Notes |
|------|------------------|--------------|-------|
| **Home** | `html` | Primary scroll | Same as desktop ✅ |
| **Schedules** | `html` | Primary scroll | Same as desktop ✅ |
| **Traffic** | `html` | Primary scroll | Same as desktop ✅ |
| **Map** | `#map-side-panel` | Internal scroll | `html` locked, panel scrolls |
| **Itinerary** | `#results-side-panel` | Internal scroll | `html` locked, panel scrolls |

**Key Principle:** Home/Schedules/Traffic use simple html scroll. Map/Itinerary use `position: fixed` containers with internal scroll on mobile.

---

## ✅ OFFICIAL SCROLL-LOCK CLASSES

### 1. `.scroll-locked` (Primary)

**File:** `public/css/modules/utilities/scroll-lock.css` (line 27)

**Purpose:** Lock page scroll (disable html/body scrolling).

**Mechanism:**
```css
html.scroll-locked {
    overflow: hidden !important;
    overflow-x: hidden !important;
    overflow-y: hidden !important;
    position: fixed;
    width: 100%;
    height: 100%;
    -webkit-overflow-scrolling: auto;
    overscroll-behavior: none;
}

html.scroll-locked body {
    overflow: hidden !important;
    position: fixed;
    width: 100%;
    height: 100%;
}
```

**JavaScript Usage (Standard):**
```javascript
// Lock scroll (e.g., opening modal)
document.documentElement.classList.add('scroll-locked');

// Unlock scroll (e.g., closing modal)
document.documentElement.classList.remove('scroll-locked');
```

**When to Use:**
- ✅ Opening modals/overlays
- ✅ Opening full-screen search
- ✅ Opening mobile drawer/panel
- ✅ Preventing background scroll when UI element is active

**When NOT to Use:**
- ❌ View layout control (use view-specific classes like `body.itinerary-view-active`)
- ❌ Hiding/showing elements (use separate classes)
- ❌ Internal scroll within a fixed container (use `.scroll-enabled` on child)

### 2. `.scroll-locked-preserve` (Special Case)

**File:** `public/css/modules/utilities/scroll-lock.css` (line 65)

**Purpose:** Lock scroll while preserving scroll position (for modals).

**Mechanism:**
```css
html.scroll-locked-preserve {
    overflow: hidden !important;
}

html.scroll-locked-preserve body {
    overflow: hidden !important;
    position: fixed;
    width: 100%;
    /* top will be set dynamically by JavaScript */
}
```

**JavaScript Usage (Preserve Pattern):**
```javascript
// Before opening modal (preserve position)
const scrollY = window.scrollY;
document.body.style.top = `-${scrollY}px`;
document.documentElement.classList.add('scroll-locked-preserve');

// After closing modal (restore position)
document.documentElement.classList.remove('scroll-locked-preserve');
document.body.style.top = '';
window.scrollTo(0, scrollY);
```

**When to Use:**
- ✅ Opening modals where user expects to return to same scroll position
- ✅ Form overlays with validation errors (user wants to see where they were)
- ✅ Detail panels that open temporarily

**When NOT to Use:**
- ❌ Full-page transitions (user doesn't expect to return)
- ❌ Most simple overlays (`.scroll-locked` is sufficient)

### 3. `.scroll-enabled` (Internal Scroll Utility)

**File:** `public/css/modules/utilities/scroll-lock.css` (line 84)

**Purpose:** Enable scroll on a specific container when page scroll is locked.

**Mechanism:**
```css
.scroll-enabled {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain; /* Don't propagate to parent */
}
```

**HTML Usage:**
```html
<!-- Page scroll locked -->
<html class="scroll-locked">
  <body>
    <!-- Fixed container (no scroll) -->
    <div class="modal-overlay">
      <!-- Internal scroll enabled -->
      <div class="modal-content scroll-enabled">
        <!-- Long content scrolls here -->
      </div>
    </div>
  </body>
</html>
```

**When to Use:**
- ✅ Modal content that may overflow
- ✅ Sidebars with scrollable content
- ✅ Dropdown menus with many items

---

## ⚠️ DEPRECATED CLASSES (DO NOT USE)

### 1. `.view-is-locked` (DEPRECATED)

**File:** `public/css/modules/base/reset.css` (line ~553)

**Status:** ⛔ **DEPRECATED for scroll control (V627 - 2026-01-28)**

**Original Purpose:**
- Lock scroll on fullscreen views
- Hide header and legal strip

**Why Deprecated:**
- Mixed concerns (scroll + layout visibility)
- Conflicts with modern scroll-lock.css
- Hard to predict in complex views

**Current JavaScript Usage:**
- `public/js/main.js` line 846: `classList.remove('view-is-locked')`
- `public/js/main.js` line 2186: `classList.remove('view-is-locked')`
- `public/js/main.js` line 5345, 5381, 5585: Multiple removals

**Migration Path:**
- Replace with: `html.scroll-locked` (for scroll control)
- Keep separate classes for hiding header/footer (e.g., `.hide-header`)

**DO NOT USE IN NEW CODE.**

### 2. `.view-map-locked` (LAYOUT ONLY, NOT SCROLL)

**File:** `public/css/modules/base/reset.css` (line ~655)

**Status:** ⚠️ **Partially deprecated (V627 - 2026-01-28)**

**Current Purpose:**
- ✅ Layout control → Positions map container, hides footer/header
- ❌ Scroll control → DO NOT use for scroll locking

**Correct Usage:**
```javascript
// Layout control (positioning, visibility)
document.body.classList.add('view-map-locked');

// Scroll control (separate, if needed)
document.documentElement.classList.add('scroll-locked');
```

**Current CSS Behavior:**
```css
body.view-map-locked {
    overflow-y: visible !important; /* Allows scroll, not locks it */
    position: relative !important;
    /* ... other layout properties ... */
}
```

**DO NOT rely on this class for scroll control.**  
**DO use this class for map layout/positioning.**

### 3. `.has-search` (DEPRECATED for scroll)

**File:** `public/css/modules/pages/itinerary.css` (line ~1285)

**Status:** ⛔ **DEPRECATED for scroll control (V627 - 2026-01-28)**

**Original Purpose:**
- Hide "Vos trajets" section when search is active
- Lock scroll (now deprecated)

**Current Behavior:**
```css
body.has-search .recent-journeys-section {
    display: none !important; /* ✅ Keep this */
}
```

**Correct Usage:**
```javascript
// Hide recent journeys section (KEEP)
document.body.classList.add('has-search');

// Lock scroll separately (ADD)
document.documentElement.classList.add('scroll-locked');
```

**Current JavaScript Usage:**
- `public/js/main.js` line 2263: `classList.add('has-search')`
- `public/js/main.js` line 5384, 5386: `classList.add/remove('has-search')`
- `public/js/main.js` line 5500: `classList.remove('has-search')`

**Migration Path:**
- Keep `.has-search` for hiding the section (CSS stays)
- Add `html.scroll-locked` for scroll control (JavaScript change)

**DO NOT use `.has-search` for scroll control in new code.**

---

## 🧩 SEPARATION OF CONCERNS

### Principle: View State ≠ Scroll State

```
View Layout Classes (body.xxx-view-active)
  → Control positioning, visibility, layout
  → Examples: body.itinerary-view-active, body.horaires-view-active
  → DO NOT lock scroll

Scroll Lock Classes (html.scroll-locked)
  → Control scroll only
  → Applied to <html> element
  → DO NOT affect layout
```

**Example (Itinerary View on Mobile):**

```javascript
// ✅ CORRECT: Separate concerns
document.body.classList.add('itinerary-view-active'); // Layout
document.documentElement.classList.add('scroll-locked'); // Scroll (if needed)

// ❌ WRONG: Mixing concerns
document.body.classList.add('itinerary-view-active'); // This also locks scroll (old pattern)
```

**CSS Structure:**

```css
/* Layout control (body class) */
body.itinerary-view-active #itinerary-results-container {
    position: fixed;
    top: 56px;
    bottom: 66px;
    /* Layout properties only */
}

/* Scroll control (html class) */
html.scroll-locked {
    overflow: hidden !important;
    /* Scroll properties only */
}
```

---

## 📚 VIEW-SPECIFIC SCROLL PATTERNS

### Home / Schedules / Traffic Views

**Scroll Model:** Simple (html scrolls)

**Pattern:**
```javascript
// No special scroll control needed
// html scrolls naturally
```

**CSS:**
```css
html {
    overflow-y: scroll; /* Default */
}

body {
    overflow-y: visible; /* Pass-through */
}
```

**Lock Scroll (e.g., for modal):**
```javascript
document.documentElement.classList.add('scroll-locked');
```

### Map View

**Scroll Model:** Internal scroll on side panel

**Pattern (Desktop):**
```javascript
// No scroll lock needed (html scrolls normally)
```

**Pattern (Mobile Fullscreen):**
```javascript
// Layout control
document.body.classList.add('view-map-locked'); // Positions map, hides footer

// Note: Page scroll is NOT locked (map pans instead)
// Side panel scrolls internally (position: fixed, overflow-y: auto)
```

**CSS:**
```css
/* Side panel scrolls internally */
#map-side-panel {
    position: fixed;
    top: 64px;
    bottom: 0;
    overflow-y: auto; /* Internal scroll */
}
```

**Lock Scroll (e.g., for search overlay):**
```javascript
document.documentElement.classList.add('scroll-locked'); // Locks page
// Side panel internal scroll continues (by design)
```

### Itinerary View

**Scroll Model:** Internal scroll on results panel (mobile)

**Pattern (Desktop):**
```javascript
// html scrolls normally
// No special scroll control
```

**Pattern (Mobile):**
```javascript
// Layout control (position results container)
document.body.classList.add('itinerary-view-active');

// Results panel scrolls internally (position: fixed, overflow-y: auto)
// No page scroll lock needed (container is fixed)
```

**CSS:**
```css
/* Mobile: Fixed container with internal scroll */
body.itinerary-view-active #itinerary-results-container {
    position: fixed;
    top: 56px;
    bottom: 66px;
}

#results-side-panel {
    overflow-y: auto; /* Internal scroll */
}
```

**Lock Scroll (e.g., for modal or search):**
```javascript
// Lock page scroll (also locks results panel scroll)
document.documentElement.classList.add('scroll-locked');

// To allow results panel to scroll while page is locked:
// Add .scroll-enabled to #results-side-panel
```

---

## 🚨 COMMON MISTAKES (ANTI-PATTERNS)

### Mistake 1: Using Multiple Scroll Lock Classes

```javascript
// ❌ WRONG: Multiple scroll locks
document.body.classList.add('view-is-locked');
document.getElementById('app').style.overflow = 'hidden';
document.documentElement.classList.add('scroll-locked');
```

**Why Wrong:** Conflicting mechanisms, unpredictable behavior.

**Fix:**
```javascript
// ✅ CORRECT: Single scroll lock
document.documentElement.classList.add('scroll-locked');
```

### Mistake 2: Using Inline Styles for Scroll Lock

```javascript
// ❌ WRONG: Inline style
document.body.style.overflow = 'hidden';
```

**Why Wrong:** Bypasses cascade, hard to debug, conflicts with classes.

**Fix:**
```javascript
// ✅ CORRECT: Use class
document.documentElement.classList.add('scroll-locked');
```

### Mistake 3: Locking Scroll on Wrong Element

```javascript
// ❌ WRONG: Locking on body
document.body.classList.add('scroll-locked');
```

**Why Wrong:** `.scroll-locked` is designed for `<html>` element.

**Fix:**
```javascript
// ✅ CORRECT: Lock on html
document.documentElement.classList.add('scroll-locked');
```

### Mistake 4: Mixing Layout and Scroll Control

```javascript
// ❌ WRONG: View class also locks scroll
document.body.classList.add('itinerary-view-active'); // Assumes this locks scroll
```

**Why Wrong:** View classes control layout, not scroll.

**Fix:**
```javascript
// ✅ CORRECT: Separate concerns
document.body.classList.add('itinerary-view-active'); // Layout
if (needScrollLock) {
    document.documentElement.classList.add('scroll-locked'); // Scroll
}
```

### Mistake 5: Forgetting to Unlock Scroll

```javascript
// ❌ WRONG: Lock but never unlock
document.documentElement.classList.add('scroll-locked');
// ... modal closes, but scroll still locked
```

**Why Wrong:** Page becomes unusable (can't scroll).

**Fix:**
```javascript
// ✅ CORRECT: Always unlock
function openModal() {
    document.documentElement.classList.add('scroll-locked');
}

function closeModal() {
    document.documentElement.classList.remove('scroll-locked'); // Don't forget!
}
```

---

## 🧪 TESTING CHECKLIST

Before committing scroll-related changes:

- [ ] Desktop: Mouse wheel scrolls page
- [ ] Desktop: Scrollbar drags page
- [ ] Desktop: Keyboard (arrow keys, spacebar) scrolls page
- [ ] Mobile: Touch scroll works
- [ ] Mobile: Momentum scroll works (iOS)
- [ ] Modal open: Page scroll locked
- [ ] Modal open: Modal content scrolls (if applicable)
- [ ] Modal close: Page scroll unlocked
- [ ] View transition: Scroll state resets correctly
- [ ] No double-scroll (page + container both scrolling)
- [ ] No scroll conflicts (multiple locks interfering)

---

## 📖 REFERENCE: FILE LOCATIONS

### Official Scroll Lock CSS
- **Primary:** `public/css/modules/utilities/scroll-lock.css`
  - `.scroll-locked` (line 27)
  - `.scroll-locked-preserve` (line 65)
  - `.scroll-enabled` (line 84)

### Deprecated Scroll Lock CSS (Legacy)
- **Reset:** `public/css/modules/base/reset.css`
  - `.view-is-locked` (line ~553) ⛔ DEPRECATED
  - `.view-map-locked` (line ~655) ⚠️ Layout only
- **Itinerary:** `public/css/modules/pages/itinerary.css`
  - `.has-search` (line ~1285) ⛔ DEPRECATED for scroll

### JavaScript Usage
- **Main:** `public/js/main.js`
  - Multiple uses of deprecated classes (see audit)
  - Migration needed in Phase 3 (see SCROLL_STABILIZATION_PLAN.md)

---

## 🔄 MIGRATION STATUS (PHASE 1 - COMPLETE)

**Phase 1: Documentation & Planning** ✅ COMPLETE (2026-01-28)
- [x] Audit JavaScript scroll lock usage
- [x] Add deprecation comments to CSS
- [x] Create SCROLL_LOCK_PATTERN.md (this document)
- [x] Document current behavior

**Phase 2: Safe CSS Fixes** ⏳ PENDING
- [ ] Fix accordion scroll trap (increase max-height, add overflow: auto)
- [ ] Test all views for scroll regressions
- [ ] Update CSS_SCROLL_ARCHITECTURE.md

**Phase 3: JavaScript Migration** ⏳ PENDING
- [ ] Migrate all scroll locks to `.scroll-locked` pattern
- [ ] Remove deprecated class usage in JavaScript
- [ ] Comprehensive testing

See: `SCROLL_STABILIZATION_PLAN.md` for detailed migration roadmap.

---

## ✅ SUMMARY: WHAT TO USE

| Scenario | Class to Use | Applied To | Notes |
|----------|--------------|------------|-------|
| Lock page scroll | `.scroll-locked` | `<html>` | Standard pattern |
| Lock scroll (preserve position) | `.scroll-locked-preserve` | `<html>` | Modals only |
| Enable internal scroll | `.scroll-enabled` | Container element | When page is locked |
| Layout control (map) | `.view-map-locked` | `<body>` | NOT for scroll |
| Layout control (itinerary) | `.itinerary-view-active` | `<body>` | NOT for scroll |
| Hide elements | `.has-search` | `<body>` | NOT for scroll |

**Golden Rule:** Use `html.scroll-locked` for ALL scroll locking. Use view classes ONLY for layout.

---

**Document Version:** 1.0.0  
**Last Updated:** 28 janvier 2026  
**Next Review:** After Phase 2 completion  
**Maintained By:** Development Team + CSS Agent

