# 🔄 SCROLL STABILIZATION PLAN — PériMap
## Focused Strategy to Unify and Stabilize Scroll Behavior

**Version:** 1.0.0  
**Date:** 28 janvier 2026  
**Status:** Planning Phase — DO NOT IMPLEMENT YET  
**Priority:** Critical — Scroll issues block all other CSS work

---

## 🎯 OBJECTIVE

**Single Goal:** Make scroll behavior predictable and consistent across all views.

**Success Criteria:**
- ✅ One scroll container per view (no ambiguity)
- ✅ Mouse wheel works everywhere
- ✅ Touch scroll works everywhere
- ✅ Scroll lock uses single mechanism
- ✅ No cascade conflicts between scroll rules

**Out of Scope:**
- ❌ Padding/spacing changes
- ❌ Visual layout modifications
- ❌ Performance optimizations
- ❌ File structure refactoring

---

## 📊 CURRENT STATE ANALYSIS

### View-by-View Scroll Responsibility

| View | Desktop Scroll | Mobile Scroll | Issues |
|------|----------------|---------------|--------|
| **Home** | `html` ✅ | `html` ✅ | None — works correctly |
| **Map** | `html` (disabled) | `#map-side-panel` (internal) | Mouse wheel only works over panel |
| **Itinerary** | `html` ✅ | `#results-side-panel` (internal) | Conflicts with search/modal scroll locks |
| **Schedules** | `html` ✅ | `html` ✅ | Accordion `max-height` may clip content |
| **Traffic** | `html` ✅ | `html` ✅ | None — works correctly |

### Scroll Lock Classes (8 Total)

| Class | File | Used In | Mechanism | Status |
|-------|------|---------|-----------|--------|
| `.scroll-locked` | scroll-lock.css | Recommended | `overflow: hidden` + `position: fixed` | ✅ **KEEP — Primary** |
| `.scroll-locked-preserve` | scroll-lock.css | Modals | `position: fixed` + top offset | ✅ **KEEP — Special case** |
| `.view-is-locked` | reset.css | Legacy fullscreen | Hides header + `overflow: hidden` | ⚠️ **DEPRECATE** |
| `.view-map-locked` | reset.css | Map fullscreen | Hides footer only | ⚠️ **DEPRECATE** (merge into .scroll-locked) |
| `.itinerary-view-active` | mobile.css | Itinerary | `position: fixed` on container | ⚠️ **KEEP but simplify** |
| `.has-search` | itinerary.css | Itinerary search | `position: fixed` + `overflow: hidden` | ⚠️ **DEPRECATE** (use .scroll-locked) |
| `.horaires-view-active` | mobile.css | Schedules | Modifies overflow | ⚠️ **KEEP but simplify** |
| `.trafic-view-active` | mobile.css | Traffic | Modifies overflow | ⚠️ **KEEP but simplify** |

---

## 🏗️ TARGET ARCHITECTURE (SIMPLE & SAFE)

### Principle 1: One Scroll Container Per View

```
Desktop (all views):
  html → PRIMARY SCROLL
  body → overflow-y: visible (passes through)

Mobile:
  - Home/Schedules/Traffic → html (same as desktop) ✅
  - Map → html locked + #map-side-panel internal scroll ✅ (keep as-is)
  - Itinerary → html locked + #results-side-panel internal scroll ✅ (keep as-is)
```

**Decision:** Keep `position: fixed` containers for Map and Itinerary mobile — they work, don't break them.

### Principle 2: Single Scroll Lock Class

```
Scroll Lock Hierarchy:
1. .scroll-locked → DEFAULT (html/body locked)
2. .scroll-locked-preserve → MODALS ONLY (preserves scroll position)
3. View-specific classes → LAYOUT ONLY (not scroll control)
```

**Rule:** View classes (`.itinerary-view-active`, `.view-map-locked`) handle layout/positioning, NOT scroll locking.

### Principle 3: Clear Responsibility Separation

```css
/* scroll-lock.css — SCROLL CONTROL */
.scroll-locked { overflow: hidden; position: fixed; }

/* pages/map.css — LAYOUT (not scroll lock) */
body.view-map-locked #map-container { /* layout only */ }

/* pages/itinerary.css — LAYOUT (not scroll lock) */
body.itinerary-view-active #itinerary-results-container { /* layout only */ }
```

**JavaScript responsibility:**
- Opening modal → add `.scroll-locked` to `<html>`
- Closing modal → remove `.scroll-locked`
- View classes (`.itinerary-view-active`) → layout state only

---

## 🎯 STABILIZATION STRATEGY (MINIMAL CHANGES)

### Phase 1: Audit Scroll Lock Usage in JavaScript

**Goal:** Find all places where scroll is locked/unlocked.

**Action:**
```bash
# Find all scroll lock class manipulations
grep -rn "classList.add.*lock\|classList.remove.*lock" public/js/
grep -rn "style.overflow\|scrollY\|scroll-behavior" public/js/
```

**Expected Findings:**
- Modal open/close handlers
- Itinerary search toggle
- Map panel interactions
- View transition handlers

**Output:** Create `SCROLL_LOCK_AUDIT.txt` listing:
- File path
- Line number
- Current scroll lock mechanism
- Recommended replacement

**Example:**
```
public/js/modal.js:45
  Current: document.body.classList.add('view-is-locked')
  Replace: document.documentElement.classList.add('scroll-locked')

public/js/itinerary.js:230
  Current: document.body.style.overflow = 'hidden'
  Replace: document.documentElement.classList.add('scroll-locked')
```

### Phase 2: Deprecate Legacy Scroll Lock Classes

**Goal:** Mark old classes as deprecated, prevent new usage.

**Changes Required:**

#### File: `public/css/modules/base/reset.css`

**Add deprecation comments:**

```css
/* ============================================================================
   DEPRECATED SCROLL LOCK CLASSES (V627)
   
   DO NOT USE THESE CLASSES IN NEW CODE.
   Migrate to .scroll-locked (see css/modules/utilities/scroll-lock.css)
   
   Legacy classes maintained for backward compatibility only.
   Will be removed in future version.
   ============================================================================ */

/* DEPRECATED V627: Use .scroll-locked instead */
.view-is-locked {
    /* Legacy fullscreen lock */
    overflow: hidden;
}

body.view-is-locked #main-header {
    display: none;
}

body.view-is-locked #legal-strip {
    display: none;
}

/* DEPRECATED V627: Use layout classes + .scroll-locked instead */
.view-map-locked {
    /* Legacy map fullscreen */
}

body.view-map-locked #site-footer,
body.view-map-locked #legal-strip {
    display: none !important;
}
```

**No functionality changes yet** — just documentation.

#### File: `public/css/modules/pages/itinerary.css`

**Add deprecation comment:**

```css
/* Line ~2187 */

/* DEPRECATED V627: Scroll lock moved to .scroll-locked class
   This rule now only handles search panel positioning.
   Do not rely on overflow: hidden here for scroll control. */
body.itinerary-view-active.has-search {
    position: fixed;
    overflow: hidden; /* ⚠️ Will be removed - use .scroll-locked instead */
}
```

### Phase 3: Document Correct Scroll Lock Pattern

**Goal:** Establish single pattern for all future scroll locks.

**Create:** `SCROLL_LOCK_PATTERN.md` (reference doc)

```markdown
# Scroll Lock Pattern (Standard)

## When to Lock Scroll

- Opening a modal/overlay
- Opening full-screen search
- Opening mobile drawer/panel
- Preventing background scroll

## How to Lock Scroll

### Standard Pattern (90% of cases)

```javascript
// Lock scroll
document.documentElement.classList.add('scroll-locked');

// Unlock scroll
document.documentElement.classList.remove('scroll-locked');
```

### Modal Pattern (preserve scroll position)

```javascript
// Before opening modal
const scrollY = window.scrollY;
document.body.style.top = `-${scrollY}px`;
document.documentElement.classList.add('scroll-locked-preserve');

// After closing modal
document.documentElement.classList.remove('scroll-locked-preserve');
document.body.style.top = '';
window.scrollTo(0, scrollY);
```

### Internal Scroll Pattern (panel with position: fixed)

```html
<!-- Container locks page scroll -->
<div class="panel-overlay scroll-locked">
  <!-- Internal container scrolls -->
  <div class="panel-content scroll-enabled">
    <!-- Content here -->
  </div>
</div>
```

```css
.panel-overlay {
    position: fixed;
    top: 0; bottom: 0;
    overflow: hidden; /* No scroll on overlay */
}

.panel-content {
    overflow-y: auto; /* Internal scroll */
    -webkit-overflow-scrolling: touch;
}
```

## What NOT to Do

❌ **Don't use multiple scroll lock classes**
```javascript
// BAD
document.body.classList.add('view-is-locked');
document.getElementById('app').style.overflow = 'hidden';
```

❌ **Don't lock scroll with inline styles**
```javascript
// BAD
document.body.style.overflow = 'hidden';
```

❌ **Don't mix lock mechanisms**
```javascript
// BAD
document.documentElement.classList.add('scroll-locked');
document.body.classList.add('has-search'); // Also locks scroll
```

✅ **Do use single class**
```javascript
// GOOD
document.documentElement.classList.add('scroll-locked');
```
```

### Phase 4: Identify Conflict Points

**Goal:** Find where multiple scroll locks interfere.

**Known Conflicts:**

#### Conflict 1: Itinerary + Modal
```
User opens itinerary view (mobile)
  → body.itinerary-view-active applied
  → #itinerary-results-container { position: fixed; overflow-y: auto; }
  
User opens modal
  → html.scroll-locked applied
  → html { overflow: hidden; position: fixed; }
  
Result: DOUBLE LOCK
  - html is locked (no page scroll)
  - #itinerary-results-container still scrolls internally
  - Mouse wheel may not work
```

**Resolution Strategy:**
- Keep both mechanisms (they serve different purposes)
- Ensure `.scroll-locked` ONLY locks html/body
- Ensure `.itinerary-view-active` ONLY positions container
- Document that internal scroll continues when modal opens

#### Conflict 2: Map + Search Overlay
```
User opens map view
  → body.view-map-locked applied
  → #map-side-panel { position: fixed; overflow-y: auto; }
  
User opens search overlay
  → (Currently no scroll lock mechanism)
  
Result: Background map still scrollable
```

**Resolution Strategy:**
- Search overlay should add `.scroll-locked` to html
- Map panel internal scroll continues (desired behavior)

#### Conflict 3: Accordion Animation + Scroll
```
User opens accordion in Schedules view
  → .accordion-content { max-height: 1000px; overflow: hidden; }
  
If content > 1000px
  → Content is clipped
  → No scroll fallback
```

**Resolution Strategy:**
- Change `overflow: hidden` to `overflow: auto` after animation completes
- Or increase `max-height` to safe value (e.g., 2500px)
- Or use JavaScript to measure content height dynamically

---

## 📋 IMPLEMENTATION CHECKLIST (DO NOT EXECUTE YET)

### Step 1: JavaScript Audit
- [ ] Search all `.add('.*lock')` calls
- [ ] Search all `.remove('.*lock')` calls  
- [ ] Search all `style.overflow` manipulations
- [ ] Create `SCROLL_LOCK_AUDIT.txt` with findings
- [ ] Identify which files need changes

### Step 2: CSS Documentation
- [ ] Add deprecation comments to `.view-is-locked` (reset.css)
- [ ] Add deprecation comments to `.view-map-locked` (reset.css)
- [ ] Add deprecation comments to `.has-search` (itinerary.css)
- [ ] Create `SCROLL_LOCK_PATTERN.md` reference doc
- [ ] Update `CSS_SCROLL_ARCHITECTURE.md` with decisions

### Step 3: Test Current Behavior
- [ ] Test home view scroll (desktop + mobile)
- [ ] Test map view scroll (desktop + mobile)
- [ ] Test itinerary view scroll (desktop + mobile)
- [ ] Test schedules accordion scroll
- [ ] Test modal open/close in each view
- [ ] Document any broken behavior BEFORE changes

### Step 4: Conflict Resolution (CSS Only — No JS Yet)
- [ ] Accordion: Change `overflow: hidden` → `overflow: auto` after animation
- [ ] Accordion: Increase `max-height` from 1000px to 2500px (safe limit)
- [ ] Document expected behavior for each conflict

### Step 5: Validation
- [ ] Re-test all views after CSS changes
- [ ] Verify no visual regressions
- [ ] Verify scroll still works in all contexts
- [ ] Document any new issues

---

## 🎯 SUCCESS METRICS

### Before Stabilization
- 8 scroll lock classes with overlapping responsibilities
- Multiple JavaScript patterns for locking scroll
- Conflicts between view classes and scroll locks
- Unpredictable scroll behavior when multiple locks active

### After Stabilization (Phase 1 — Documentation Only)
- ✅ All scroll lock classes documented (keep vs deprecate)
- ✅ Single scroll lock pattern established
- ✅ JavaScript audit completed
- ✅ Conflict points identified and resolution planned
- ✅ No code changes yet (safe planning phase)

### After Stabilization (Phase 2 — CSS Fixes Only)
- ✅ Accordion scroll conflict resolved
- ✅ Deprecation warnings added to CSS
- ✅ Reference documentation created
- ✅ All existing scroll behavior preserved

### After Stabilization (Phase 3 — JavaScript Migration)
- ✅ All JavaScript migrated to `.scroll-locked` pattern
- ✅ Legacy classes removed (or kept as empty shells)
- ✅ Single source of truth for scroll locking
- ✅ Predictable scroll behavior everywhere

---

## 🚨 RISK ASSESSMENT

### Low Risk (Safe to Do Now)
- ✅ Add deprecation comments to CSS
- ✅ Create reference documentation
- ✅ Audit JavaScript scroll lock usage
- ✅ Test current behavior

### Medium Risk (Requires Testing)
- ⚠️ Change accordion `overflow: hidden` → `overflow: auto`
- ⚠️ Increase accordion `max-height` from 1000px to 2500px
- ⚠️ Document scroll lock pattern for team

### High Risk (Do NOT Do Yet)
- ❌ Remove deprecated scroll lock classes
- ❌ Migrate JavaScript to new pattern
- ❌ Change view class scroll behavior
- ❌ Modify `position: fixed` containers

---

## 📝 SPECIFIC CSS RULES TO PRESERVE

### DO NOT TOUCH (Working as Designed)

#### Primary Scroll Architecture
```css
/* File: modules/base/reset.css L48-72 */
html {
    overflow-y: scroll; /* PRIMARY SCROLL — DO NOT CHANGE */
    overscroll-behavior: none;
    background-attachment: fixed;
}

html::before {
    position: fixed; /* Background fix — DO NOT CHANGE */
    height: 100lvh;
}

body {
    overflow-y: visible; /* Pass scroll to html — DO NOT CHANGE */
    overflow-x: hidden;
}
```

#### Scroll Lock Mechanism
```css
/* File: modules/utilities/scroll-lock.css L28-44 */
html.scroll-locked {
    overflow: hidden !important; /* KEEP !important */
    position: fixed;
    width: 100%;
    height: 100%;
}

html.scroll-locked body {
    overflow: hidden !important; /* KEEP !important */
    position: fixed;
}
```

#### Map View Internal Scroll
```css
/* File: modules/pages/map.css L334 */
#map-side-panel {
    position: fixed; /* Required for layout — DO NOT CHANGE */
    overflow-y: auto; /* Internal scroll — DO NOT CHANGE */
    max-height: 100vh; /* May need viewport variable but don't change now */
}
```

#### Itinerary View Internal Scroll
```css
/* File: utilities/mobile.css L1026 */
body.itinerary-view-active #itinerary-results-container {
    position: fixed !important; /* Required for layout — DO NOT CHANGE */
    overflow-y: auto !important; /* Internal scroll — DO NOT CHANGE */
}
```

### SAFE TO MODIFY (Fixes Without Breaking)

#### Accordion Scroll Trap
```css
/* File: modules/pages/schedules.css L94-115 */

/* BEFORE (clips content) */
.accordion-content {
    overflow: hidden; /* Blocks scroll */
    max-height: 0;
}

details[open] .accordion-content {
    max-height: 1000px; /* Too small, clips tall content */
}

/* AFTER (allows scroll) */
.accordion-content {
    overflow: hidden; /* Keep during animation */
    max-height: 0;
}

details[open] .accordion-content {
    max-height: 2500px; /* Safer limit */
    overflow: auto; /* Allow scroll if > 2500px */
}
```

**Why Safe:**
- Only affects accordion behavior
- Preserves animation
- Adds scroll fallback for tall content

### MUST DOCUMENT (But Don't Change)

#### View Layout Classes
```css
/* These classes control layout, NOT scroll locking */

/* body.view-map-locked → hides footer */
/* body.itinerary-view-active → positions container */
/* body.horaires-view-active → view state */
/* body.trafic-view-active → view state */
```

**Documentation Required:**
- Add comments explaining purpose
- Note that scroll lock is separate concern
- Reference `.scroll-locked` for scroll control

---

## 🔄 MIGRATION PATH (3 Phases)

### Phase 1: Documentation & Planning (THIS DOCUMENT)
**Duration:** 1 day  
**Risk:** None (no code changes)

**Tasks:**
1. ✅ Create this stabilization plan
2. ⏳ Audit JavaScript scroll lock usage
3. ⏳ Create `SCROLL_LOCK_PATTERN.md`
4. ⏳ Add deprecation comments to CSS
5. ⏳ Test and document current behavior

**Deliverables:**
- `SCROLL_STABILIZATION_PLAN.md` (this doc)
- `SCROLL_LOCK_AUDIT.txt` (JavaScript findings)
- `SCROLL_LOCK_PATTERN.md` (reference)
- Updated CSS with deprecation comments

### Phase 2: Safe CSS Fixes (After Phase 1 Approved)
**Duration:** 1-2 days  
**Risk:** Low (localized changes)

**Tasks:**
1. Fix accordion scroll trap (increase max-height, add overflow: auto)
2. Test all views for scroll regressions
3. Update `CSS_SCROLL_ARCHITECTURE.md` with changes

**Deliverables:**
- Fixed accordion behavior
- Test results documented
- No breaking changes

### Phase 3: JavaScript Migration (After Phase 2 Validated)
**Duration:** 3-5 days  
**Risk:** Medium (touches multiple JS files)

**Tasks:**
1. Migrate all scroll locks to `.scroll-locked` pattern
2. Remove deprecated class usage in JavaScript
3. Test scroll behavior in all views + modals
4. Update team documentation

**Deliverables:**
- Unified scroll lock pattern across codebase
- All JavaScript using `.scroll-locked`
- Deprecated classes can be safely removed

---

## 📊 DECISION MATRIX

| Scroll Lock Class | Keep? | Why | Action |
|-------------------|-------|-----|--------|
| `.scroll-locked` | ✅ Yes | Primary mechanism, well-designed | **Promote as standard** |
| `.scroll-locked-preserve` | ✅ Yes | Needed for modals | **Keep as special case** |
| `.view-is-locked` | ⚠️ Maybe | Legacy but still used | **Deprecate, migrate slowly** |
| `.view-map-locked` | ⚠️ Maybe | Map layout state | **Keep for layout, not scroll** |
| `.itinerary-view-active` | ✅ Yes | Itinerary layout state | **Keep for layout, not scroll** |
| `.has-search` | ❌ No | Duplicates .scroll-locked | **Deprecate, migrate to .scroll-locked** |
| `.horaires-view-active` | ✅ Yes | Schedules view state | **Keep for layout, not scroll** |
| `.trafic-view-active` | ✅ Yes | Traffic view state | **Keep for layout, not scroll** |

### Legend
- ✅ **Keep** — Essential, well-designed, or needed for layout
- ⚠️ **Maybe** — Deprecate or repurpose (layout only, not scroll)
- ❌ **No** — Redundant, migrate away

---

## 🎓 KEY PRINCIPLES (TEAM ALIGNMENT)

### Principle 1: Separation of Concerns
```
Layout Classes  ≠  Scroll Lock Classes

body.itinerary-view-active → Layout/positioning (position: fixed, etc.)
html.scroll-locked → Scroll control (overflow: hidden)
```

### Principle 2: Single Responsibility
```
One class = One job

.scroll-locked → Locks scroll (nothing else)
.itinerary-view-active → Positions itinerary container (doesn't lock scroll)
```

### Principle 3: Predictable Cascade
```
html.scroll-locked → Always locks html/body scroll
  - No exceptions
  - No conflicts
  - Applies everywhere
```

### Principle 4: Internal Scroll Independence
```
html.scroll-locked (page locked)
  + position: fixed container with overflow-y: auto
  = Internal scroll works, page scroll locked ✅

This is NOT a conflict, this is by design.
```

---

## ✅ NEXT STEPS (IMMEDIATE)

### 1. Review & Approve This Plan
- [ ] Team reviews stabilization strategy
- [ ] Confirm approach is safe and minimal
- [ ] Approve Phase 1 (documentation only)

### 2. Execute Phase 1 (This Week)
- [ ] JavaScript audit (find all scroll lock usages)
- [ ] Add deprecation comments to CSS
- [ ] Create `SCROLL_LOCK_PATTERN.md`
- [ ] Test current scroll behavior

### 3. Validate Phase 1 Results
- [ ] Review `SCROLL_LOCK_AUDIT.txt` findings
- [ ] Confirm no code was changed
- [ ] Approve Phase 2 (safe CSS fixes)

### 4. Plan Phase 2 Execution (Next Week)
- [ ] Fix accordion scroll trap
- [ ] Test all views
- [ ] Document results

---

**Document Status:** Planning — Awaiting Approval  
**Next Review:** After Phase 1 completion  
**Owner:** Development Team  
**Contact:** Refer to CSS_ADVANCED_AUDIT_REPORT.md for technical details

