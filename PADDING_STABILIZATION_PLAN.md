# 📐 PADDING STABILIZATION PLAN — PériMap
## Multi-Phase Strategy for Predictable Spacing Architecture

**Version:** 1.0.0  
**Date:** 28 janvier 2026  
**Status:** Planning Document (No Code Changes Yet)  
**Related Docs:** CSS_ADVANCED_AUDIT_REPORT.md, CSS_PADDING_ARCHITECTURE.md, SCROLL_STABILIZATION_PLAN.md

---

## 📋 EXECUTIVE SUMMARY

This document defines a **multi-phase stabilization strategy** for padding, margin, and spacing behavior in PériMap, addressing the core issue: **"Why do my padding changes do nothing?"**

### Problem Statement

Developers experience **unpredictable padding behavior** due to:
- **!important warfare** (50+ instances across codebase)
- **Cascade order instability** (mobile.css vs components/itinerary.css)
- **Specificity conflicts** (3-4 layers of overrides per element)
- **Hard-coded values** (400+ instances) instead of spacing tokens
- **Late-loaded file wins** (components/itinerary.css loaded last via HTML)

### Goal

Transform padding/spacing from **"trial-and-error nightmare"** to **"predictable, documented, maintainable system"**.

### Approach

**3-phase strategy** similar to scroll stabilization:
1. **Phase 1:** Documentation & classification (safe)
2. **Phase 2:** Normalization & conflict resolution (low risk)
3. **Phase 3:** Token system adoption (optional, progressive)

---

## 🏗️ PART 1: CURRENT PADDING ARCHITECTURE

### 1.1 Spacing Token System (Defined But Not Enforced)

**File:** `modules/base/variables.css` (lines 94-112)

```css
:root {
    --spacing-0: 0;
    --spacing-1: 0.25rem;  /* 4px */
    --spacing-2: 0.5rem;   /* 8px */
    --spacing-3: 0.75rem;  /* 12px */
    --spacing-4: 1rem;     /* 16px */
    --spacing-5: 1.25rem;  /* 20px */
    --spacing-6: 1.5rem;   /* 24px */
    --spacing-8: 2rem;     /* 32px */
    --spacing-10: 2.5rem;  /* 40px */
    --spacing-12: 3rem;    /* 48px */
}
```

**Status:** ✅ Well-designed 4px/8px grid  
**Problem:** ❌ Rarely used — 400+ hard-coded padding values exist

**Adoption Rate (estimated):**
- Token usage: ~15% of spacing rules
- Hard-coded values: ~85% of spacing rules

---

### 1.2 Major Sources of Padding Rules

#### A. Global Reset / Base

**File:** `modules/base/reset.css` (759 lines)

```css
html, body {
    margin: 0;
    padding: 0;
}

* {
    box-sizing: border-box; /* Prevents padding expanding width */
}
```

**Impact:** Foundation layer — rarely causes conflicts.

---

#### B. Layout Containers

**Files:**
- `modules/layout/header.css` (fixed positioning)
- `modules/layout/grid.css` (252 lines)
- `modules/layout/navigation.css` (bottom nav spacing)

**Example — Bottom Navigation:**
```css
/* navigation.css L29 */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
    .nav-bottom {
        padding-bottom: 0 !important; /* ⚠️ !important */
    }
}
```

**Issue:** !important used for safe-area support, blocks all overrides.

---

#### C. Utilities (Mobile.css — The Cascade Crusher)

**File:** `modules/utilities/mobile.css` (1,294 lines)

**Characteristics:**
- 50+ `!important` declarations on padding/margin
- Loaded TWICE in style.modules.css (duplicate imports bug)
- View-specific overrides for every major view
- Highest specificity: `body.{view}-view-active .{element}`

**Power Level:** 🔥🔥🔥 **MAXIMUM CASCADE PRIORITY**

**Example — Itinerary Padding:**
```css
/* mobile.css L1070 */
body.itinerary-view-active .results-list-wrapper {
    padding: 1.5rem 1.25rem 5rem 1.25rem !important;
}

/* mobile.css L1088 */
body.itinerary-view-active .recent-journeys-section {
    margin-top: 2rem !important;
    margin-bottom: 0 !important;
}

/* mobile.css L1106 */
body.itinerary-view-active .itinerary-top-bar {
    padding: 1rem 0.75rem 0 0.75rem !important;
}
```

**Result:** Any padding change in other files is **silently ignored**.

---

#### D. Page-Specific CSS

**Files:**
- `modules/pages/itinerary.css` (4,930 lines — largest file)
- `modules/pages/map.css` (1,547 lines)
- `modules/pages/schedules.css` (474 lines)
- `modules/pages/home.css`
- `modules/pages/traffic.css`

**Characteristics:**
- Base padding rules (no !important)
- Media query overrides (responsive)
- Mostly **overridden by mobile.css** on mobile devices

**Example — Schedules Base Padding:**
```css
/* schedules.css L17 */
#fiche-horaire-container {
    margin-bottom: 3rem; /* Desktop */
}

/* Later overridden by mobile.css */
@media (max-width: 768px) {
    body.horaires-view-active #fiche-horaire-container {
        margin-bottom: 1rem; /* Mobile wins */
    }
}
```

---

#### E. Components (Last-Loaded Wildcard)

**File:** `css/components/itinerary.css` (loaded via HTML `<link>` tag)

**Characteristics:**
- Loaded **AFTER** style.modules.css
- **Wins ALL cascade conflicts** (last loaded = highest priority)
- No !important needed — cascade position gives natural priority

**Example — Side Panel Padding:**
```css
/* components/itinerary.css L128 */
@media (max-width: 768px) {
    #results-side-panel {
        padding-bottom: 200px; /* Space for popover */
    }
}

/* This overrides mobile.css EVEN THOUGH mobile.css has !important */
/* Because components/itinerary.css loads AFTER style.modules.css */
```

**Result:** Hidden coupling — hard to predict which rule wins.

---

### 1.3 Padding Ownership by View (Current State)

| View | Primary Container | Padding Owner | Complexity | Issues |
|------|------------------|---------------|------------|--------|
| **Home** | `#dashboard-hall` | mobile.css + home.css | Medium | 3-layer overrides |
| **Schedules** | `#horaires.view-active` | schedules.css + mobile.css | Low | 2-layer, predictable |
| **Traffic** | `#info-trafic.view-active` | traffic.css + mobile.css | Low | 2-layer, stable |
| **Map** | `#map-side-panel` | map.css + mobile.css | Medium | Fixed positioning |
| **Itinerary** | `.results-list-wrapper` | mobile.css + components/itinerary.css | **High** | 4-layer, unpredictable |

**Itinerary View Cascade (Mobile):**

```
Layer 1: pages/itinerary.css (base rules)
  ↓ overridden by
Layer 2: pages/itinerary.css @media (responsive)
  ↓ overridden by
Layer 3: utilities/mobile.css (view-specific + !important)
  ↓ SOMETIMES overridden by
Layer 4: components/itinerary.css (last-loaded, no !important needed)
```

**Winner Determination Logic:**
```
IF components/itinerary.css has rule for element:
    → components/itinerary.css WINS (last loaded)
ELSE IF mobile.css has rule with !important:
    → mobile.css WINS (!important)
ELSE IF media query matches:
    → Last matching media query WINS
ELSE:
    → Base rule from pages/*.css
```

---

## 🔍 PART 2: ROOT CAUSES OF "PADDING DOES NOTHING"

### Cause 1: !important Warfare

**Description:** Multiple files use `!important` to force overrides, creating an arms race where only the most forceful rule wins.

**Mechanism:**
```css
/* File A */
.element { padding: 1rem; }

/* File B (loaded later) */
.element { padding: 2rem !important; } /* ⬅️ Wins */

/* File C (loaded even later) */
.element { padding: 3rem; } /* ⬅️ LOSES to File B's !important */
```

**Real Example:**

**File:** `pages/itinerary.css` (line 2049)
```css
@media (max-width: 600px) {
    .results-list-wrapper {
        padding: 0.75rem 1rem 1.25rem 1rem !important;
    }
}
```

**File:** `utilities/mobile.css` (line 1070)
```css
body.itinerary-view-active .results-list-wrapper {
    padding: 1.5rem 1.25rem 5rem 1.25rem !important;
}
```

**Result:** Both have `!important`, but `mobile.css` has **higher specificity** (`body.class .element` > `.element`) → mobile.css wins.

**Developer Experience:**
```
Developer: "I'll add 2rem padding to .results-list-wrapper"
→ Adds padding: 2rem in itinerary.css
→ Refreshes browser
→ Nothing changes (mobile.css overrides with !important)
→ Adds !important
→ Still nothing (mobile.css has higher specificity)
→ Gives up or adds inline style
```

**Impact:** 🔴 **High** — Most common source of frustration.

---

### Cause 2: Late-Loaded File Dominance

**Description:** `components/itinerary.css` loads via HTML `<link>` tag AFTER `style.modules.css`, giving it cascade priority without needing `!important`.

**Mechanism:**
```html
<!-- In HTML <head> -->
<link rel="stylesheet" href="/style.modules.css">       <!-- Loads first -->
<link rel="stylesheet" href="/css/components/itinerary.css"> <!-- Loads last -->
```

**Real Example:**

**File:** `utilities/mobile.css` (line 1056, inside style.modules.css)
```css
body.itinerary-view-active #results-side-panel {
    padding-bottom: 0 !important;
}
```

**File:** `components/itinerary.css` (line 128, loaded after)
```css
@media (max-width: 768px) {
    #results-side-panel {
        padding-bottom: 200px; /* No !important needed */
    }
}
```

**Result:** `components/itinerary.css` **WINS** because it loads last, even though mobile.css has `!important`.

**Why:** CSS cascade rule: **!important in earlier stylesheet < normal rule in later stylesheet** (when specificity equal).

**Developer Experience:**
```
Developer: "I'll fix padding-bottom in mobile.css with !important"
→ Adds padding-bottom: 0 !important
→ Refreshes browser
→ Nothing changes (components/itinerary.css loads later)
→ Adds more specific selector
→ Still loses (load order trumps specificity)
→ Must edit components/itinerary.css instead
```

**Impact:** 🔴 **High** — Hidden coupling, hard to debug.

---

### Cause 3: Specificity Layering

**Description:** Multiple files target the same element with increasing specificity, creating a hierarchy that's hard to trace.

**Specificity Hierarchy:**
```
Specificity Level 1: .element                     (0,0,1,0)
Specificity Level 2: .parent .element             (0,0,2,0)
Specificity Level 3: .class1.class2 .element      (0,0,3,0)
Specificity Level 4: body.view-active .element    (0,0,3,0) [same as L3]
Specificity Level 5: #id .element                 (0,1,1,0) [ID = highest]
```

**Real Example — Itinerary Top Bar:**

**File:** `pages/itinerary.css` (line 93)
```css
.itinerary-top-bar {
    padding: 0.75rem 1rem;
}
/* Specificity: (0,0,1,0) */
```

**File:** `pages/itinerary.css` (line 2077, media query)
```css
@media (max-width: 600px) {
    .itinerary-top-bar {
        padding: 0.5rem 0.75rem;
    }
}
/* Specificity: (0,0,1,0) + media query match */
```

**File:** `utilities/mobile.css` (line 1110)
```css
body.itinerary-view-active .itinerary-top-bar {
    padding: 1rem 0.75rem 0 0.75rem !important;
}
/* Specificity: (0,0,2,0) + !important */
```

**File:** `components/itinerary.css` (line 139)
```css
@media (max-width: 768px) {
    .itinerary-top-bar {
        padding: 1.1rem 1.25rem 0.75rem;
    }
}
/* Specificity: (0,0,1,0) BUT loaded last */
```

**Winner:** `components/itinerary.css` (1.1rem 1.25rem 0.75rem)

**Why:** Even though mobile.css has `!important` AND higher specificity, components/itinerary.css loads AFTER style.modules.css, and **no !important in later stylesheet > !important in earlier stylesheet** when targeting same element.

**Developer Experience:**
```
Developer: "Why is padding 1.1rem when I set it to 1rem with !important?"
→ Checks mobile.css: "It says 1rem !important"
→ Inspects DevTools: "Browser shows 1.1rem"
→ Searches codebase: "Where is 1.1rem coming from?"
→ Finds components/itinerary.css (loaded via HTML)
→ Realizes load order issue
→ 30 minutes wasted debugging
```

**Impact:** 🟠 **Medium** — Requires DevTools + load order knowledge.

---

### Cause 4: Duplicate CSS Loading

**Description:** `style.modules.css` imports 29 CSS files TWICE — once in main section, once in "mobile overrides" section.

**Mechanism:**
```css
/* style.modules.css Lines 50-80 (Section 1) */
@import "css/modules/pages/home.css";
@import "css/modules/pages/itinerary.css";
/* ... 27 more ... */

/* style.modules.css Lines 88-115 (Section 7 - Mobile) */
@import "css/modules/utilities/mobile.css";
@import "css/modules/pages/home.css";        /* ⬅️ DUPLICATE */
@import "css/modules/pages/itinerary.css";   /* ⬅️ DUPLICATE */
/* ... 27 more duplicates ... */
```

**Result:**
- Same CSS rules parsed twice
- Browser resolves conflicts using "last occurrence wins"
- Developer confusion: "Which version is active?"
- Performance overhead

**Real Example:**

**First Load:** `home.css` line 304
```css
.search-field {
    padding: 0.875rem 2rem !important;
}
```

**Second Load (duplicate):** Same rule, same file
```css
.search-field {
    padding: 0.875rem 2rem !important; /* Loaded again */
}
```

**Browser Behavior:** Applies rule twice → no visual difference, but **cascade position changes**.

**Developer Experience:**
```
Developer: "I changed padding in home.css, why doesn't it work?"
→ Checks file: "It says 2rem"
→ Refreshes: "Still wrong"
→ Realizes: "Oh, it's loaded twice, which one applies?"
→ Confusion about cascade position
```

**Impact:** 🟡 **Low-Medium** — Mostly causes confusion, rarely breaks layout.

---

### Cause 5: Mobile-First vs Desktop-First Conflicts

**Description:** Some files use mobile-first approach (base = mobile, media query = desktop), others use desktop-first (base = desktop, media query = mobile).

**Mechanism:**

**Mobile-First Approach:**
```css
.element { padding: 1rem; } /* Mobile base */

@media (min-width: 768px) {
    .element { padding: 2rem; } /* Desktop override */
}
```

**Desktop-First Approach:**
```css
.element { padding: 2rem; } /* Desktop base */

@media (max-width: 768px) {
    .element { padding: 1rem; } /* Mobile override */
}
```

**Conflict:** When files mix approaches, media queries overlap and fight.

**Real Example:**

**File:** `pages/itinerary.css` (desktop-first)
```css
/* L160 - Base (desktop) */
.results-list-wrapper {
    padding: 0;
}

/* L2018 - Mobile override */
@media (max-width: 600px) {
    .results-list-wrapper {
        padding: 0.75rem 1rem 1.25rem 1rem !important;
    }
}
```

**File:** `utilities/mobile.css` (mobile-specific)
```css
/* L1070 - Only applies on mobile */
body.itinerary-view-active .results-list-wrapper {
    padding: 1.5rem 1.25rem 5rem 1.25rem !important;
}
```

**Conflict:** Both target mobile, both use `!important`, higher specificity wins (mobile.css).

**Developer Experience:**
```
Developer: "I want desktop padding 2rem, mobile padding 1rem"
→ Sets base: padding: 2rem
→ Sets mobile: @media (max-width: 768px) { padding: 1rem; }
→ Mobile.css overrides: padding: 1.5rem !important
→ Developer's mobile rule is ignored
→ Must edit mobile.css instead
```

**Impact:** 🟠 **Medium** — Requires understanding of file strategies.

---

### Cause 6: Parent Container Overflow

**Description:** Padding on a child element is **visually hidden** when parent has `overflow: hidden` or `overflow: auto` with constrained height.

**Mechanism:**
```html
<div class="parent" style="overflow: hidden; height: 200px;">
    <div class="child" style="padding: 50px;">
        Content <!-- Padding exists but clipped by parent -->
    </div>
</div>
```

**Real Example — Accordion:**

**File:** `modules/pages/schedules.css` (line 88)
```css
.accordion-content {
    overflow: hidden; /* For animation */
    max-height: 0;
    padding: 0 var(--spacing-5);
}

details[open] .accordion-content {
    max-height: 1000px; /* ⚠️ May clip content if > 1000px */
}
```

**Issue:** If content + padding > 1000px, bottom padding is clipped.

**Developer Experience:**
```
Developer: "I added padding-bottom: 2rem to accordion content"
→ Checks DevTools: "Padding exists in computed styles"
→ Visual inspection: "But I can't see it?"
→ Realizes: "Parent max-height clips it"
→ Must increase parent max-height instead
```

**Impact:** 🟡 **Low-Medium** — Rare, but confusing when encountered.

**Note:** ✅ **FIXED in Phase 2 of Scroll Stabilization** (max-height: 2500px + overflow-y: auto).

---

## 🎯 PART 3: SOURCES OF TRUTH FOR PADDING

### 3.1 Proposed Canonical Ownership Model

#### Global Spacing Rules

**Owner:** `modules/base/reset.css` + `modules/base/variables.css`

**Responsibility:**
- Define spacing tokens (`--spacing-*`)
- Set `box-sizing: border-box` (foundation)
- Zero out default browser padding/margins (html, body, headings, lists)

**Rule:**
- ✅ **DO:** Define global resets and tokens here
- ❌ **DON'T:** Add view-specific padding
- ❌ **DON'T:** Use `!important` (foundation should be override-able)

---

#### Layout Containers (Page-Wide)

**Owner:** `modules/layout/*.css` (header, grid, navigation)

**Responsibility:**
- Header spacing (fixed positioning)
- Bottom navigation safe-area padding
- Grid system gaps (not content padding)

**Rule:**
- ✅ **DO:** Use `!important` for safe-area spacing (necessary for iOS)
- ✅ **DO:** Set structural padding (e.g., header height compensation)
- ❌ **DON'T:** Add content-specific padding
- ❌ **DON'T:** Override view-specific spacing

**Example (Good):**
```css
/* navigation.css — Safe-area padding */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
    .nav-bottom {
        padding-bottom: env(safe-area-inset-bottom) !important;
    }
}
```

---

#### View Containers (Per-View Spacing)

**Owner:** `modules/pages/{view}.css` (home, map, itinerary, schedules, traffic)

**Responsibility:**
- **Base desktop padding** for each view's main container
- **Responsive overrides** for tablet/mobile via media queries
- Content area spacing (list wrappers, card containers)

**Rule:**
- ✅ **DO:** Define base padding without `!important`
- ✅ **DO:** Use spacing tokens (`var(--spacing-*)`)
- ✅ **DO:** Group responsive rules in same file (co-locate)
- ❌ **DON'T:** Use `!important` (allow mobile.css to override)
- ❌ **DON'T:** Duplicate rules in multiple files

**Example (Good):**
```css
/* schedules.css — Base + Responsive */
#fiche-horaire-container {
    margin-bottom: var(--spacing-12); /* Desktop: 48px */
}

@media (max-width: 768px) {
    #fiche-horaire-container {
        margin-bottom: var(--spacing-4); /* Mobile: 16px */
    }
}
```

**Example (Bad):**
```css
/* schedules.css */
#fiche-horaire-container {
    margin-bottom: 3rem !important; /* ❌ !important blocks overrides */
}
```

---

#### Mobile Overrides (Cross-View)

**Owner:** `modules/utilities/mobile.css`

**Responsibility:**
- **Mobile-specific spacing** that differs from desktop
- **View state-specific** padding (`body.{view}-view-active .element`)
- Safe-area compensation for mobile views

**Rule:**
- ✅ **DO:** Use `!important` ONLY when necessary (rare)
- ✅ **DO:** Use view state classes for targeting (`body.itinerary-view-active`)
- ✅ **DO:** Document WHY `!important` is used (add comment)
- ⚠️ **CONSIDER:** Moving rules to respective view files instead
- ❌ **DON'T:** Duplicate desktop rules here
- ❌ **DON'T:** Use `!important` by default (reserve for conflicts only)

**Example (Good):**
```css
/* mobile.css — Necessary override */
body.itinerary-view-active .results-list-wrapper {
    /* Bottom padding for navigation clearance */
    padding-bottom: 5rem !important; /* Override needed for fixed nav */
}
```

**Example (Bad):**
```css
/* mobile.css — Unnecessary !important */
body.horaires-view-active #horaires {
    padding: 1rem !important; /* ❌ Could be normal rule in schedules.css */
}
```

---

#### Component-Specific Padding

**Owner:** `modules/components/*.css` (buttons, cards, forms, modals, etc.)

**Responsibility:**
- **Internal padding** of reusable components
- Consistent spacing within component boundaries

**Rule:**
- ✅ **DO:** Use spacing tokens for consistency
- ✅ **DO:** Keep component padding self-contained
- ❌ **DON'T:** Override page-level padding from here
- ❌ **DON'T:** Use view state classes (components should be view-agnostic)

**Example (Good):**
```css
/* buttons.css */
.btn {
    padding: var(--spacing-3) var(--spacing-5); /* 12px 20px */
}

.btn-lg {
    padding: var(--spacing-4) var(--spacing-8); /* 16px 32px */
}
```

**Example (Bad):**
```css
/* buttons.css */
body.itinerary-view-active .btn {
    padding: 1rem; /* ❌ View-specific logic doesn't belong in component */
}
```

---

#### Last-Loaded Overrides (Special Case)

**Owner:** `css/components/itinerary.css` (loaded via HTML)

**Status:** ⚠️ **PROBLEMATIC ARCHITECTURE**

**Current Reality:**
- Loads AFTER style.modules.css (via HTML `<link>` tag)
- Wins cascade conflicts without `!important`
- Creates hidden coupling

**Proposed Future:**
- **Option A:** Move into style.modules.css as `pages/itinerary-overrides.css`
- **Option B:** Keep separate but document load order clearly
- **Option C:** Merge into `pages/itinerary.css` (consolidate)

**Rule (Current State):**
- ✅ **DO:** Document that this file has maximum cascade priority
- ✅ **DO:** Use sparingly (last resort for overrides)
- ❌ **DON'T:** Add new rules here (use mobile.css or pages/itinerary.css)
- ❌ **DON'T:** Rely on load order for normal styling

---

### 3.2 Decision Tree: Where Should Padding Be Defined?

```
START: Need to add/change padding on element
  │
  ├─ Is it a GLOBAL reset? (html, body, *, headings)
  │  └─ YES → modules/base/reset.css
  │
  ├─ Is it a LAYOUT structure? (header, navigation, grid gaps)
  │  └─ YES → modules/layout/*.css
  │
  ├─ Is it a REUSABLE COMPONENT? (button, card, form input)
  │  └─ YES → modules/components/*.css
  │
  ├─ Is it VIEW-SPECIFIC content spacing?
  │  ├─ Desktop padding?
  │  │  └─ YES → modules/pages/{view}.css (base rule)
  │  │
  │  ├─ Mobile different from desktop?
  │  │  └─ YES → modules/pages/{view}.css (@media query)
  │  │
  │  └─ Mobile requires FORCING override (rare)?
  │     └─ YES → modules/utilities/mobile.css (with !important + comment)
  │
  └─ Is it a UTILITY class? (spacing helpers)
     └─ YES → modules/utilities/spacing.css
```

---

### 3.3 Anti-Patterns to Avoid

#### ❌ Anti-Pattern 1: Inline Styles

```html
<!-- BAD -->
<div style="padding: 20px;">Content</div>
```

**Why Bad:** Unmaintainable, highest specificity, can't be overridden by CSS.

**Fix:** Use class + CSS file.

---

#### ❌ Anti-Pattern 2: Random !important

```css
/* BAD */
.element {
    padding: 1rem !important; /* No comment explaining why */
}
```

**Why Bad:** Blocks future overrides, creates !important arms race.

**Fix:** Remove !important OR add comment explaining necessity.

---

#### ❌ Anti-Pattern 3: Duplicate Rules in Multiple Files

```css
/* File A: pages/itinerary.css */
.results-list-wrapper { padding: 1rem; }

/* File B: utilities/mobile.css */
body.itinerary-view-active .results-list-wrapper { padding: 1rem; }

/* File C: components/itinerary.css */
.results-list-wrapper { padding: 1rem; }
```

**Why Bad:** Maintenance nightmare, unclear which file controls padding.

**Fix:** Choose ONE canonical location per element.

---

#### ❌ Anti-Pattern 4: Hard-Coded Magic Numbers

```css
/* BAD */
.element {
    padding: 17px; /* Why 17? */
    margin-bottom: 23px; /* Random value */
}
```

**Why Bad:** Inconsistent spacing, doesn't follow design system.

**Fix:** Use spacing tokens.

```css
/* GOOD */
.element {
    padding: var(--spacing-4); /* 16px */
    margin-bottom: var(--spacing-6); /* 24px */
}
```

---

## ⚠️ PART 4: DANGER ZONE RULES

### 4.1 Critical Warning: These Rules Make Padding Dangerous

#### 🔴 Danger Zone 1: Mobile.css !important Overrides

**File:** `modules/utilities/mobile.css`  
**Lines:** 1022, 1047, 1056, 1076, 1083, 1094, 1106, 1113, 1114, 1185, 1189, 1195, 1206, 1207, 1214, 1215, 1220, 1221, 1232

**Total Count:** 50+ `!important` declarations on padding/margin

**Example:**
```css
/* L1070 */
body.itinerary-view-active .results-list-wrapper {
    padding: 1.5rem 1.25rem 5rem 1.25rem !important;
}

/* L1088 */
body.itinerary-view-active .recent-journeys-section {
    margin-top: 2rem !important;
    margin-bottom: 0 !important;
}

/* L1106 */
body.itinerary-view-active .itinerary-top-bar {
    padding: 1rem 0.75rem 0 0.75rem !important;
}
```

**Why Dangerous:**
- Blocks ALL overrides in other files
- High specificity (`body.class .element`) + `!important` = nuclear option
- Changes require editing mobile.css OR using even higher specificity

**Affected Elements:**
- `.results-list-wrapper` (itinerary view)
- `.recent-journeys-section` (itinerary view)
- `.itinerary-top-bar` (itinerary view)
- `#itinerary-edit-panel` (search form)
- `#results-side-panel` (results panel)
- Multiple schedules/traffic view elements

**Suggested Mitigation (Phase 2):**
1. Audit EACH `!important` usage
2. For each one, ask: "Is !important truly necessary?"
3. If NO → Remove `!important`, move to pages/{view}.css
4. If YES → Add comment explaining why
5. Document in CSS_DOCUMENTATION.md

**Risk Level:** 🔴 **CRITICAL** — Most common source of "padding does nothing" issues.

---

#### 🔴 Danger Zone 2: Components/Itinerary.css Load Order

**File:** `css/components/itinerary.css` (loaded via HTML `<link>` after style.modules.css)  
**Lines:** 110, 128, 139, 142, 179, 183, 207, 212

**Why Dangerous:**
- Loads LAST → wins cascade conflicts automatically
- No `!important` needed (load order gives priority)
- Hidden coupling — developers don't expect external file to override

**Example:**
```css
/* components/itinerary.css L128 */
@media (max-width: 768px) {
    #results-side-panel {
        padding-bottom: 200px; /* Overrides mobile.css !important */
    }
}
```

**Mechanism:**
```
style.modules.css loads (includes mobile.css)
  ↓
mobile.css sets: padding-bottom: 0 !important
  ↓
components/itinerary.css loads (via HTML)
  ↓
components/itinerary.css sets: padding-bottom: 200px (no !important)
  ↓
Browser cascade: Later stylesheet wins → 200px applied
```

**Affected Elements:**
- `#itinerary-results-container`
- `#results-side-panel`
- `.itinerary-top-bar`
- `#itinerary-edit-panel`
- `.results-list-wrapper`

**Suggested Mitigation (Phase 3):**
1. **Option A (Recommended):** Move into style.modules.css as `pages/itinerary-overrides.css`
2. **Option B:** Keep separate but add LARGE comment in HTML explaining load order
3. **Option C:** Merge entirely into `pages/itinerary.css`

**Risk Level:** 🔴 **CRITICAL** — Hidden coupling, hard to debug.

---

#### 🟠 Danger Zone 3: Home.css Desktop-Mobile Conflicts

**File:** `modules/pages/home.css`  
**Lines:** 304, 933-936, 967, 979, 1057

**Why Dangerous:**
- Mix of `!important` and normal rules
- Unclear ownership (mobile.css also targets same elements)

**Example:**
```css
/* home.css L304 */
.search-field {
    padding: 0.875rem 2rem !important;
}

/* home.css L933-936 */
.service-card {
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
}

/* home.css L967 */
@media (max-width: 768px) {
    #dashboard-content-view {
        padding-top: calc(66px + env(safe-area-inset-top, 0px)) !important;
    }
}
```

**Issues:**
- `!important` used without clear reason (no comment)
- Service card spacing zeroed out aggressively
- Safe-area padding in media query (should be in mobile.css?)

**Suggested Mitigation (Phase 2):**
1. Audit each `!important` — determine if necessary
2. Move mobile-specific rules to mobile.css OR remove `!important`
3. Add comments explaining why spacing is zeroed

**Risk Level:** 🟠 **HIGH** — Medium complexity, multiple overrides.

---

#### 🟠 Danger Zone 4: Itinerary.css Media Query Explosions

**File:** `modules/pages/itinerary.css` (4,930 lines)  
**Lines:** 2049, 2066, 2082, 3632

**Why Dangerous:**
- LARGEST CSS file (4,930 lines)
- Multiple media queries with `!important`
- Hard to track which rule applies at which breakpoint

**Example:**
```css
/* itinerary.css L2049 */
@media (max-width: 600px) {
    .results-list-wrapper {
        padding: 0.75rem 1rem 1.25rem 1rem !important;
    }
}

/* itinerary.css L2066 */
@media (max-width: 600px) {
    .results-list {
        padding: 0 !important;
    }
}
```

**Issues:**
- `!important` in media queries (rare, should be avoided)
- Conflicts with mobile.css (both target same breakpoint)
- File size makes navigation difficult

**Suggested Mitigation (Phase 3):**
1. Extract mobile rules to mobile.css (consolidate)
2. Remove `!important` where possible
3. Consider splitting file (itinerary-base.css + itinerary-mobile.css)

**Risk Level:** 🟠 **HIGH** — Size + complexity + conflicts.

---

#### 🟡 Danger Zone 5: Duplicate CSS Loading (style.modules.css)

**File:** `public/style.modules.css`  
**Lines:** 88-115 (duplicate imports)

**Why Dangerous:**
- 29 CSS files imported TWICE
- Confusing cascade position
- Performance overhead

**Example:**
```css
/* Line 72 — First import */
@import "css/modules/pages/home.css";

/* Line 90 — Duplicate import */
@import "css/modules/pages/home.css"; /* ⬅️ Loaded again */
```

**Issues:**
- Intended to place mobile overrides at end
- Implementation duplicates entire files
- Creates confusion about which occurrence applies

**Suggested Mitigation (Phase 2):**
1. Remove duplicate imports (lines 88-115)
2. Keep ONLY unique imports (mobile.css, mobile-overlays.css)
3. Verify no visual regressions after removal

**Risk Level:** 🟡 **MEDIUM** — Mostly confusion, rarely breaks layout.

---

#### 🟡 Danger Zone 6: Navigation.css Safe-Area !important

**File:** `modules/layout/navigation.css`  
**Lines:** 29, 36, 43

**Why Dangerous:**
- Blocks all padding-bottom overrides on navigation
- Necessary for iOS safe-area, but aggressive

**Example:**
```css
/* navigation.css L36 */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
    .nav-bottom {
        padding-bottom: env(safe-area-inset-bottom, 0px) !important;
    }
}
```

**Why `!important` Used:**
- Must override all other rules to ensure safe-area compliance
- iOS devices require this for bottom navigation visibility

**Issues:**
- `!important` is JUSTIFIED here (safe-area critical)
- BUT prevents any padding-bottom adjustments

**Suggested Mitigation (None — Keep As-Is):**
- This `!important` is necessary and correct
- Document in CSS_DOCUMENTATION.md: "Safe-area padding requires !important"

**Risk Level:** 🟢 **LOW** — Justified usage, rare conflicts.

---

### 4.2 Danger Zone Summary Table

| File | Lines | Severity | Issue | Mitigation Phase |
|------|-------|----------|-------|------------------|
| `mobile.css` | 50+ locations | 🔴 CRITICAL | !important warfare | Phase 2 |
| `components/itinerary.css` | 8 locations | 🔴 CRITICAL | Load order dominance | Phase 3 |
| `home.css` | 7 locations | 🟠 HIGH | Unclear !important usage | Phase 2 |
| `itinerary.css` | 4,930 lines | 🟠 HIGH | File size + complexity | Phase 3 |
| `style.modules.css` | 29 duplicates | 🟡 MEDIUM | Duplicate imports | Phase 2 |
| `navigation.css` | 3 locations | 🟢 LOW | Justified !important | Document only |

---

## 📋 PART 5: MULTI-PHASE STABILIZATION STRATEGY

### Overview

**Philosophy:** Same as scroll stabilization — **documentation first, safe changes second, optional refactor third**.

**Constraints:**
- No visual regressions
- No breaking changes
- Progressive improvement
- Each phase independently valuable

---

### 🔵 PHASE 1: Documentation & Classification

**Goal:** Make padding architecture **understandable and traceable** without changing any code.

**Duration:** 1-2 hours  
**Risk Level:** 🟢 **ZERO** (no code changes)  
**Impact:** High (enables informed decisions)

#### Tasks

**Task 1.1: Audit All !important Usages**

```bash
# Find all padding/margin !important
grep -rn "padding.*!important\|margin.*!important" public/css/ > padding_important_audit.txt
```

**For each usage:**
1. Document file + line
2. Document selector
3. Explain WHY `!important` is used (add inline comment if missing)
4. Classify as:
   - ✅ **Justified** (e.g., safe-area spacing)
   - ⚠️ **Questionable** (could be removed)
   - ❌ **Unnecessary** (defensive programming)

**Deliverable:** Updated CSS files with comments explaining `!important` usage.

---

**Task 1.2: Document Canonical Padding Owners**

Create a table in this document or CSS_DOCUMENTATION.md:

| Element | Desktop Padding Owner | Mobile Padding Owner | Justification |
|---------|----------------------|---------------------|---------------|
| `.results-list-wrapper` | `pages/itinerary.css` (base) | `mobile.css` (override) | Mobile needs extra bottom padding for nav |
| `#fiche-horaire-container` | `pages/schedules.css` (base) | `pages/schedules.css` (@media) | Same file, responsive |
| `.recent-journeys-section` | `pages/itinerary.css` (base) | `mobile.css` (!important) | Mobile layout differs significantly |
| ... | ... | ... | ... |

**Deliverable:** Canonical ownership table in documentation.

---

**Task 1.3: Mark Danger Zone Rules**

Add comments above dangerous rules:

```css
/* ⚠️ DANGER ZONE — PADDING STABILIZATION PHASE 1
 * This rule uses !important and overrides all other padding rules.
 * File: mobile.css L1070
 * Reason: Necessary for mobile navigation clearance (5rem bottom padding)
 * Impact: Blocks padding changes in pages/itinerary.css
 * Mitigation: To change padding, edit THIS rule (not itinerary.css)
 */
body.itinerary-view-active .results-list-wrapper {
    padding: 1.5rem 1.25rem 5rem 1.25rem !important;
}
```

**Deliverable:** Annotated CSS files with danger zone comments.

---

**Task 1.4: Update CSS_DOCUMENTATION.md**

Add new section: **"Padding Architecture & Ownership"**

```markdown
## Padding Architecture & Ownership

### Decision Tree: Where to Change Padding

1. **Is it a global reset?** → `modules/base/reset.css`
2. **Is it layout structure?** → `modules/layout/*.css`
3. **Is it a component?** → `modules/components/*.css`
4. **Is it view-specific?**
   - Desktop: `modules/pages/{view}.css` (base rule)
   - Mobile: `modules/pages/{view}.css` (@media) OR `modules/utilities/mobile.css` (if !important needed)

### Danger Zones (Avoid Editing Without Caution)

- `mobile.css` — 50+ !important overrides
- `components/itinerary.css` — Loads last, wins cascade
- `home.css` — Multiple !important usages
- `itinerary.css` — 4,930 lines, complex media queries

### Common Issues

**Issue:** "I changed padding but nothing happened"

**Solution:**
1. Check if `mobile.css` has `!important` override (use DevTools)
2. Check if `components/itinerary.css` loads after your change
3. Check specificity (use DevTools → Styles panel)
4. Refer to canonical ownership table above
```

**Deliverable:** Updated CSS_DOCUMENTATION.md with padding guidance.

---

**Task 1.5: Create PADDING_DANGER_ZONES.md (Optional)**

Separate document listing all danger zone rules with:
- File + line
- Selector
- Current padding values
- Why it's dangerous
- How to safely override

**Deliverable:** (Optional) PADDING_DANGER_ZONES.md

---

#### Phase 1 Deliverables Checklist

- [ ] All `!important` usages documented with inline comments
- [ ] Canonical ownership table created
- [ ] Danger zone rules marked in CSS files
- [ ] CSS_DOCUMENTATION.md updated with padding guidance
- [ ] (Optional) PADDING_DANGER_ZONES.md created
- [ ] No code behavior changes (only comments added)

---

### 🟢 PHASE 2: Safe Normalization & Conflict Resolution

**Goal:** Resolve **low-risk conflicts** and remove **unnecessary !important** declarations without changing visual layout.

**Duration:** 2-4 hours  
**Risk Level:** 🟡 **LOW-MEDIUM** (carefully tested changes)  
**Impact:** Medium (reduces complexity)

#### Tasks

**Task 2.1: Remove Duplicate CSS Imports**

**File:** `public/style.modules.css` (lines 88-115)

**Action:** Delete duplicate imports, keep ONLY unique mobile files.

**Before:**
```css
/* Section 7 - Mobile overrides */
@import "css/modules/utilities/mobile.css";
@import "css/modules/pages/home.css";          /* ⬅️ DUPLICATE */
@import "css/modules/pages/itinerary.css";     /* ⬅️ DUPLICATE */
/* ... 27 more duplicates ... */
```

**After:**
```css
/* Section 7 - Mobile overrides */
@import "css/modules/utilities/mobile.css";
/* Removed 29 duplicate imports — files already loaded in sections 1-6 */
```

**Testing:**
1. Load each view (home, map, itinerary, schedules, traffic)
2. Verify spacing looks identical before/after
3. Check DevTools → Network tab: CSS file size should decrease

**Risk:** 🟢 **LOW** — Should be no visual changes.

**Deliverable:** Updated style.modules.css with duplicates removed.

---

**Task 2.2: Consolidate Home.css !important Rules**

**File:** `modules/pages/home.css` (lines 304, 933-936, 967, 979, 1057)

**Action:** Audit each `!important` usage:

**Example 1:** Service Card Spacing (L933-936)
```css
/* BEFORE */
.service-card {
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
}
```

**Question:** Is `!important` necessary?  
**Check:** Search for `.service-card` in mobile.css → If no conflicts, remove `!important`.

**AFTER (if no conflicts):**
```css
.service-card {
    padding-top: 0;
    padding-bottom: 0;
    margin-top: 0;
    margin-bottom: 0;
}
```

**Testing:**
1. Load home view on desktop + mobile
2. Verify service cards look identical
3. Check DevTools → Computed styles for `.service-card`

**Repeat for each `!important` in home.css.**

**Risk:** 🟡 **MEDIUM** — Requires visual verification.

**Deliverable:** Updated home.css with justified `!important` only.

---

**Task 2.3: Consolidate Itinerary.css Media Query !important**

**File:** `modules/pages/itinerary.css` (lines 2049, 2066, 2082)

**Action:** Determine if `!important` can be removed or moved to mobile.css.

**Example:** `.results-list-wrapper` padding (L2049)
```css
/* BEFORE */
@media (max-width: 600px) {
    .results-list-wrapper {
        padding: 0.75rem 1rem 1.25rem 1rem !important;
    }
}
```

**Check:** mobile.css L1070 already overrides this with:
```css
body.itinerary-view-active .results-list-wrapper {
    padding: 1.5rem 1.25rem 5rem 1.25rem !important;
}
```

**Result:** itinerary.css rule is **DEAD CODE** (never applies).

**AFTER:**
```css
/* REMOVED — Dead code (mobile.css overrides with higher specificity) */
```

**Testing:**
1. Load itinerary view on mobile
2. Verify `.results-list-wrapper` padding unchanged
3. Check DevTools → Computed styles

**Risk:** 🟢 **LOW** — Removing dead code.

**Deliverable:** Updated itinerary.css with dead code removed.

---

**Task 2.4: Document Remaining !important Usages**

**For all `!important` that remain after Tasks 2.2-2.3:**

Add inline comment explaining WHY:

```css
/* ✅ !important JUSTIFIED
 * Reason: Must override components/itinerary.css (loads last)
 * Without !important, this rule is ignored on mobile.
 */
body.itinerary-view-active .results-list-wrapper {
    padding: 1.5rem 1.25rem 5rem 1.25rem !important;
}
```

**Deliverable:** All remaining `!important` documented.

---

**Task 2.5: Consolidate View-Specific Padding**

**Goal:** Move scattered mobile padding rules into canonical locations.

**Example:** Schedules view padding

**Current State:**
- Base rules in `pages/schedules.css`
- Mobile overrides in `mobile.css`
- Some media queries in `schedules.css`

**Proposed State:**
- All schedules padding in `pages/schedules.css` (base + @media)
- ONLY exceptional cases in `mobile.css` (with comment)

**Action:**
1. Identify rules in mobile.css for schedules view
2. Check if they can be moved to schedules.css @media query
3. If YES: Move rule, remove from mobile.css
4. If NO: Add comment explaining why mobile.css is needed

**Risk:** 🟡 **MEDIUM** — Requires cascade understanding.

**Deliverable:** Consolidated padding rules per view.

---

#### Phase 2 Deliverables Checklist

- [ ] Duplicate CSS imports removed from style.modules.css
- [ ] Home.css !important usages audited & reduced
- [ ] Itinerary.css dead code removed
- [ ] All remaining !important documented with comments
- [ ] View-specific padding consolidated
- [ ] Visual regression testing complete (all views, desktop + mobile)
- [ ] CSS_DOCUMENTATION.md updated with Phase 2 changes

---

### 🔵 PHASE 3: Token System Adoption (Optional)

**Goal:** Progressive migration to spacing tokens for **long-term consistency**.

**Duration:** 4-8 hours (spread over multiple PRs)  
**Risk Level:** 🟡 **MEDIUM** (many small changes)  
**Impact:** High (future-proof)

**Note:** This phase is OPTIONAL and can be done incrementally (file by file, view by view).

#### Tasks

**Task 3.1: Audit Hard-Coded Padding Values**

```bash
# Find all hard-coded padding/margin
grep -rn "padding: [0-9]\|margin: [0-9]" public/css/modules/pages/ > hardcoded_padding.txt
```

**Deliverable:** List of hard-coded values to migrate.

---

**Task 3.2: Migrate One File at a Time**

**Strategy:** Start with smallest/simplest files.

**Example:** `modules/pages/schedules.css`

**BEFORE:**
```css
#fiche-horaire-container {
    margin-bottom: 3rem;
}

.accordion-group summary {
    padding: 1rem 1.25rem;
}
```

**AFTER:**
```css
#fiche-horaire-container {
    margin-bottom: var(--spacing-12); /* 3rem = 48px */
}

.accordion-group summary {
    padding: var(--spacing-4) var(--spacing-5); /* 1rem 1.25rem = 16px 20px */
}
```

**Testing:**
1. Visual comparison before/after (screenshots)
2. Computed styles verification (DevTools)
3. Mobile + desktop testing

**Order of Migration:**
1. ✅ schedules.css (smallest, simplest)
2. ✅ traffic.css (small, stable)
3. ✅ home.css (medium, moderate complexity)
4. ✅ map.css (large, complex)
5. ✅ itinerary.css (largest, most complex — LAST)

**Deliverable:** Progressively migrated files using tokens.

---

**Task 3.3: Extend Token System (If Needed)**

**Current tokens:**
```css
--spacing-0, 1, 2, 3, 4, 5, 6, 8, 10, 12
```

**Gaps:**
- No `--spacing-7` (1.75rem = 28px)
- No `--spacing-9` (2.25rem = 36px)
- No `--spacing-16` (4rem = 64px)

**Action:** If commonly used values are missing, add them.

**Example:**
```css
:root {
    /* Existing tokens */
    --spacing-0: 0;
    --spacing-1: 0.25rem;
    --spacing-2: 0.5rem;
    --spacing-3: 0.75rem;
    --spacing-4: 1rem;
    --spacing-5: 1.25rem;
    --spacing-6: 1.5rem;
    
    /* New tokens (if needed) */
    --spacing-7: 1.75rem;  /* 28px */
    --spacing-8: 2rem;     /* 32px */
    --spacing-9: 2.25rem;  /* 36px */
    --spacing-10: 2.5rem;  /* 40px */
    --spacing-12: 3rem;    /* 48px */
    --spacing-16: 4rem;    /* 64px */
    --spacing-20: 5rem;    /* 80px */
}
```

**Deliverable:** Extended token system (if needed).

---

**Task 3.4: Update Utility Classes**

**File:** `modules/utilities/spacing.css`

**Goal:** Provide utility classes for common spacing needs.

**Example:**
```css
/* Margin utilities */
.m-0 { margin: 0; }
.m-1 { margin: var(--spacing-1); }
.m-2 { margin: var(--spacing-2); }
/* ... */
.mb-4 { margin-bottom: var(--spacing-4); }
.mt-6 { margin-top: var(--spacing-6); }

/* Padding utilities */
.p-0 { padding: 0; }
.p-1 { padding: var(--spacing-1); }
.p-2 { padding: var(--spacing-2); }
/* ... */
.px-4 { padding-left: var(--spacing-4); padding-right: var(--spacing-4); }
.py-6 { padding-top: var(--spacing-6); padding-bottom: var(--spacing-6); }
```

**Benefit:** Quick spacing adjustments without custom CSS.

**Deliverable:** (Optional) Utility class system.

---

**Task 3.5: Consolidate components/itinerary.css**

**Goal:** Resolve load order issue.

**Option A (Recommended):** Move into style.modules.css

**Action:**
1. Rename `css/components/itinerary.css` → `css/modules/pages/itinerary-overrides.css`
2. Import in style.modules.css AFTER pages/itinerary.css:
```css
@import "css/modules/pages/itinerary.css";
@import "css/modules/pages/itinerary-overrides.css"; /* Explicit overrides */
```
3. Remove HTML `<link>` tag

**Option B:** Keep separate but document clearly

**Action:**
1. Add LARGE comment in HTML:
```html
<!-- ⚠️ CRITICAL: This file loads AFTER style.modules.css
     It has maximum cascade priority and overrides mobile.css rules.
     See: PADDING_STABILIZATION_PLAN.md for details. -->
<link rel="stylesheet" href="/css/components/itinerary.css">
```
2. Add comment at top of components/itinerary.css:
```css
/* ⚠️ LOAD ORDER WARNING
 * This file is loaded via HTML <link> tag AFTER style.modules.css.
 * Rules here override ALL other CSS files (including mobile.css).
 * Use sparingly — prefer adding rules to pages/itinerary.css instead.
 */
```

**Option C:** Merge into pages/itinerary.css

**Action:**
1. Copy all rules from components/itinerary.css
2. Paste into pages/itinerary.css (at end)
3. Delete components/itinerary.css
4. Remove HTML `<link>` tag

**Recommended:** Option A (explicit overrides file).

**Deliverable:** Consolidated itinerary CSS with clear load order.

---

#### Phase 3 Deliverables Checklist

- [ ] Hard-coded padding values audited
- [ ] Files migrated to tokens (progressive, file-by-file)
- [ ] Token system extended (if needed)
- [ ] (Optional) Utility classes created
- [ ] components/itinerary.css consolidated (Option A, B, or C)
- [ ] Visual regression testing (all views, all breakpoints)
- [ ] CSS_DOCUMENTATION.md updated with token usage guide

---

## 📊 PART 6: RISK ASSESSMENT & SUCCESS METRICS

### Risk Matrix

| Phase | Tasks | Risk Level | Reversibility | Testing Effort |
|-------|-------|------------|---------------|----------------|
| **Phase 1** | Documentation only | 🟢 ZERO | N/A | None |
| **Phase 2** | Remove duplicates, reduce !important | 🟡 LOW-MEDIUM | High | Medium |
| **Phase 3** | Token migration, consolidation | 🟡 MEDIUM | Medium | High |

### Success Metrics

**Phase 1 Success:**
- [ ] All `!important` usages have inline comments
- [ ] Canonical ownership table exists
- [ ] Developer guide updated (CSS_DOCUMENTATION.md)
- [ ] Danger zones clearly marked

**Phase 2 Success:**
- [ ] Duplicate CSS imports removed (29 files)
- [ ] ≥20% reduction in `!important` declarations
- [ ] Zero visual regressions (verified)
- [ ] Padding changes become easier (subjective improvement)

**Phase 3 Success:**
- [ ] ≥50% of padding rules use spacing tokens
- [ ] components/itinerary.css load order resolved
- [ ] Developer onboarding time reduced (easier to understand)
- [ ] Consistency across views improved (measured by token adoption)

---

## 🚀 PART 7: NEXT STEPS & RECOMMENDATIONS

### Immediate Actions (Before Any Phase)

1. **Commit Current State**
   - Create git branch: `padding-stabilization-baseline`
   - Tag current version: `v1.0.0-pre-padding-stabilization`
   - Ensures rollback path if needed

2. **Screenshot All Views**
   - Desktop: 1920x1080
   - Tablet: 768x1024
   - Mobile: 375x667
   - Store in `/docs/screenshots/baseline/`

3. **Document Current Behavior**
   - List known padding issues (GitHub issues or doc)
   - Establish baseline metrics (how many `!important` exist)

---

### Phase Execution Order

**Recommended Sequence:**

```
Phase 1 (Documentation)
  ↓
Wait 1 week (let team review documentation)
  ↓
Phase 2 (Safe Normalization)
  ↓
Deploy to staging → monitor 2-3 days
  ↓
Deploy to production → monitor 1 week
  ↓
Phase 3 (Token Migration) — OPTIONAL
  ↓ (Progressive, file-by-file over multiple releases)
Deploy incrementally
```

**Why Wait Between Phases?**
- Allows team review and feedback
- Reduces risk of compounding issues
- Validates documentation accuracy

---

### Communication Plan

**Before Phase 1:**
- Announce to team: "Padding stabilization documentation phase starting"
- Share this document for review
- Collect feedback on proposed canonical ownership

**After Phase 1:**
- Team review meeting (30 minutes)
- Decide: Proceed to Phase 2 or revise documentation?

**Before Phase 2:**
- Code review: All changes reviewed by 2+ people
- Staging deployment: Test thoroughly before production

**After Phase 2:**
- Production monitoring: Watch for bug reports
- Retrospective: What worked? What didn't?

**Phase 3 (Optional):**
- Team decision: Is token migration worth effort?
- If YES: Plan incremental rollout (1-2 files per release)

---

### Maintenance Strategy (Post-Stabilization)

**New Rule Enforcement:**

```markdown
## CSS Padding Rules (Team Agreement)

1. **Never use !important without a comment**
   - Every !important must have inline comment explaining WHY
   - Comment format: `/* !important: Reason... */`

2. **Prefer spacing tokens over hard-coded values**
   - Use `var(--spacing-*)` when possible
   - Only use hard-coded values for non-standard spacing

3. **Respect canonical ownership**
   - Check ownership table before adding padding rules
   - If unclear, ask team before adding

4. **Mobile-first or desktop-first?**
   - Desktop-first: Base rule = desktop, @media = mobile
   - Consistency within each file (don't mix approaches)

5. **Code review checklist**
   - [ ] Padding change doesn't conflict with mobile.css
   - [ ] No unnecessary !important added
   - [ ] Spacing token used (if available)
   - [ ] Visual regression tested
```

**Deliverable:** Team agreement documented in CONTRIBUTING.md or similar.

---

### Tools & Automation (Future)

**Linting Rules (PostCSS / Stylelint):**

```javascript
// .stylelintrc.json
{
  "rules": {
    "declaration-no-important": [true, {
      "severity": "warning",
      "message": "Avoid !important — add comment if necessary"
    }],
    "function-disallowed-list": ["calc"],
    "unit-allowed-list": ["rem", "px", "vh", "vw", "%"],
    "scale-unlimited/declaration-strict-value": [
      ["/padding/", "/margin/"],
      {
        "ignoreVariables": true,
        "message": "Use spacing tokens (var(--spacing-*)) instead of hard-coded values"
      }
    ]
  }
}
```

**Benefits:**
- Catches `!important` during development
- Encourages spacing token usage
- Automated enforcement (CI/CD pipeline)

**Deliverable:** (Future) Stylelint config for padding rules.

---

## 📝 APPENDIX: GLOSSARY

**Cascade:** CSS rule resolution order (specificity → source order → importance).

**Specificity:** Weight of a CSS selector (ID > class > element).

**!important:** CSS flag that overrides normal cascade rules.

**Load Order:** Sequence in which CSS files are parsed by browser.

**Spacing Token:** CSS variable for consistent spacing (e.g., `--spacing-4`).

**Safe-Area:** iOS notch/bottom bar padding (`env(safe-area-inset-*)`).

**Canonical Owner:** File responsible for defining padding for an element.

**Danger Zone:** CSS rule that is risky to modify (high impact, complex overrides).

**Dead Code:** CSS rule that never applies (overridden by all other rules).

**Hard-Coded Value:** Direct pixel/rem value (e.g., `padding: 20px`) instead of token.

---

## ✅ CONCLUSION

**Summary:**

Padding in PériMap is currently **unpredictable and fragile** due to:
- !important warfare (50+ instances)
- Load order complexity (components/itinerary.css loads last)
- Specificity layering (3-4 override levels per element)
- Hard-coded values (400+ instances)

**This plan provides:**
- 3-phase strategy (documentation → normalization → tokens)
- Clear canonical ownership model
- Danger zone identification
- Safe migration path
- Team enforcement guidelines

**Outcome:**

After completion, developers will experience:
- ✅ Predictable padding behavior
- ✅ Clear ownership model (know which file to edit)
- ✅ Reduced !important usage (only justified cases)
- ✅ Consistent spacing (tokens enforced)
- ✅ Faster development (less trial-and-error)

**Next Step:** Execute Phase 1 (documentation only, zero risk).

---

**Document Version:** 1.0.0  
**Last Updated:** 28 janvier 2026  
**Status:** Planning Document (No Code Changes Yet)  
**Approved By:** [Pending team review]  
**Next Review:** After Phase 1 completion

