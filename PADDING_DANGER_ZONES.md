# Padding Danger Zones — PériMap
## High-Risk CSS Rules That Make Padding Unpredictable

**Version:** 1.0.0  
**Date:** 28 janvier 2026  
**Phase:** Padding Stabilization Phase 1 (Documentation)  
**Related:** PADDING_STABILIZATION_PLAN.md, PADDING_OWNERSHIP_MAP.md

---

## ⚠️ WARNING

**DO NOT MODIFY THESE RULES IN PHASE 1.**

This document lists CSS rules that are **dangerous to modify** because they:
- Use `!important` to override many other rules
- Affect multiple views simultaneously
- Create hidden coupling through cascade order
- Are loaded late (high cascade priority)

**Phase 1 Goal:** Document only. Phase 2 will safely resolve conflicts.

---

## 🔴 DANGER ZONE 1: Mobile.css !important Warfare

### File
`public/css/modules/utilities/mobile.css`

### Severity
🔴 **CRITICAL** — Highest impact across entire codebase

### Description
Mobile.css contains **50+ `!important` declarations** on padding/margin that override ALL other CSS files. Any padding change in view-specific files (home.css, itinerary.css, etc.) will be silently ignored if mobile.css has a conflicting rule.

### Affected Lines
1022, 1047, 1056, 1076, 1083, 1094, 1106, 1113, 1114, 1185, 1189, 1195, 1206, 1207, 1214, 1215, 1220, 1221, 1232

### Danger Level
- **Specificity:** High (`body.{view}-view-active .element`)
- **!important Count:** 20+ spacing-related
- **Views Affected:** All (home, map, itinerary, schedules, traffic)
- **Cascade Position:** Middle (inside style.modules.css)
- **Override Difficulty:** 🔴 Extremely difficult (requires !important + higher specificity)

### Examples

#### Example 1: Itinerary Results Wrapper
```css
/* Line 1076 */
body.itinerary-view-active .results-list-wrapper {
    padding: 0.75rem 0.75rem 0 0.75rem !important;
}
```

**Impact:** ANY padding change to `.results-list-wrapper` in `pages/itinerary.css` will be **completely ignored** on mobile.

**Why Dangerous:** Developer changes padding in itinerary.css, refreshes browser, sees no change, wastes 15+ minutes debugging.

#### Example 2: Recent Journeys Section
```css
/* Line 1094 */
body.itinerary-view-active .recent-journeys-section {
    padding: 0 0 80px 0 !important;
}
```

**Impact:** Bottom padding is FORCED to 80px. Cannot be changed from any other file.

**Why Dangerous:** Heavy-handed override with no flexibility.

#### Example 3: Itinerary Top Bar
```css
/* Line 1106 */
body.itinerary-view-active .itinerary-top-bar {
    padding: 1rem 0.75rem 0 0.75rem !important;
}
```

**Impact:** Padding is locked. Even `components/itinerary.css` (which loads LAST) cannot override this without even higher specificity.

**Why Dangerous:** Creates false assumption that "last-loaded file wins" — not true when !important is involved.

### Developer Experience

```
Developer Task: "Increase left padding on .results-list-wrapper to 2rem"

Attempt 1: Edit pages/itinerary.css
  .results-list-wrapper { padding-left: 2rem; }
  → Result: Nothing changes (mobile.css overrides with !important)

Attempt 2: Add !important
  .results-list-wrapper { padding-left: 2rem !important; }
  → Result: Still nothing (mobile.css has higher specificity)

Attempt 3: Use higher specificity
  body.itinerary-view-active .results-list-wrapper { padding-left: 2rem !important; }
  → Result: CONFLICT with mobile.css (both have same specificity + !important)
  → Browser uses last-defined rule → still loses

Solution: Must edit mobile.css line 1076 directly
  → 30 minutes wasted debugging
```

### Mitigation Strategy (Phase 2)
1. Audit EACH !important usage in mobile.css
2. Ask: "Is !important truly necessary?"
3. If NO: Remove !important, move rule to view-specific file
4. If YES: Add inline comment explaining why
5. Document in CSS_DOCUMENTATION.md

### Current Status
**DO NOT MODIFY** — Wait for Phase 2 systematic audit.

---

## 🔴 DANGER ZONE 2: Components/Itinerary.css Load Order Dominance

### File
`public/css/components/itinerary.css`

### Severity
🔴 **CRITICAL** — Hidden coupling, hard to debug

### Description
This file is loaded via HTML `<link>` tag **AFTER** `style.modules.css`, giving it **maximum cascade priority**. Rules here win ALL conflicts, even against mobile.css `!important`, because **later stylesheet > earlier stylesheet** when specificity is equal.

### Affected Lines
110, 128, 139, 142, 179, 183, 207, 212

### Danger Level
- **Load Order:** LAST (highest cascade priority)
- **!important Needed:** NO (cascade position gives natural priority)
- **Views Affected:** Itinerary only
- **Cascade Position:** MAXIMUM (loaded after style.modules.css)
- **Override Difficulty:** 🔴 Impossible from earlier files

### Examples

#### Example 1: Results Side Panel Bottom Padding
```css
/* Line 128 */
@media (max-width: 768px) {
    #results-side-panel {
        padding-bottom: 200px;
    }
}
```

**Conflict:**
```css
/* mobile.css (inside style.modules.css) L1056 */
body.itinerary-view-active #results-side-panel {
    padding-bottom: 0 !important;
}

/* components/itinerary.css (loaded AFTER) */
#results-side-panel {
    padding-bottom: 200px; /* ⬅️ WINS despite mobile.css !important */
}
```

**Why WINS:** CSS cascade rule: **Normal rule in later stylesheet > !important rule in earlier stylesheet** (when targeting same element with equal specificity).

**Developer Experience:**
```
Developer: "I set padding-bottom: 0 !important in mobile.css"
Browser: "Displays padding-bottom: 200px"
Developer: "But I used !important! Why doesn't it work?"
Answer: "components/itinerary.css loads AFTER style.modules.css"
```

#### Example 2: Itinerary Top Bar
```css
/* Line 139 */
@media (max-width: 768px) {
    .itinerary-top-bar {
        padding: 1.1rem 1.25rem 0.75rem;
    }
}
```

**Conflict:**
```css
/* mobile.css L1106 */
body.itinerary-view-active .itinerary-top-bar {
    padding: 1rem 0.75rem 0 0.75rem !important;
}

/* components/itinerary.css L139 (loaded AFTER) */
.itinerary-top-bar {
    padding: 1.1rem 1.25rem 0.75rem; /* WINS */
}
```

**Result:** components/itinerary.css (1.1rem 1.25rem 0.75rem) overrides mobile.css (!important).

**Why Dangerous:** Invisible coupling — developers don't expect external HTML-loaded file to override !important rules.

### Mitigation Strategy (Phase 3)
**Option A (Recommended):** Move into style.modules.css
1. Rename: `components/itinerary.css` → `pages/itinerary-overrides.css`
2. Import in style.modules.css after pages/itinerary.css
3. Remove HTML `<link>` tag

**Option B:** Document clearly
1. Add large comment in HTML explaining load order
2. Add comment at top of components/itinerary.css warning about priority

**Option C:** Merge into pages/itinerary.css
1. Copy all rules into pages/itinerary.css
2. Delete components/itinerary.css
3. Remove HTML `<link>` tag

### Current Status
**DO NOT MODIFY** — Wait for Phase 3 consolidation.

---

## 🟠 DANGER ZONE 3: Home.css Aggressive !important Usage

### File
`public/css/modules/pages/home.css`

### Severity
🟠 **HIGH** — Multiple !important without clear justification

### Description
Home.css uses !important in 7 locations (lines 304, 933, 934, 935, 936, 967, 979, 1057) without inline comments explaining WHY. Some appear defensive (preventing overrides) rather than necessary.

### Affected Lines
304, 933, 934, 935, 936, 967, 979, 1057

### Danger Level
- **!important Count:** 7 spacing-related
- **Views Affected:** Home view only
- **Cascade Position:** Middle (inside style.modules.css)
- **Override Difficulty:** 🟠 Medium-High (requires !important + equal specificity)

### Examples

#### Example 1: Search Button Padding
```css
/* Line 304 */
.planner-search-btn,
#planner-submit-btn {
    padding: 0.875rem 2rem !important;
}
```

**Question:** Why !important?  
**Check:** Are there conflicting rules in buttons.css or mobile.css?  
**Status:** Unclear — needs audit.

#### Example 2: Service Card Spacing Zeroed
```css
/* Lines 933-936 */
.service-card {
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    margin-top: 0 !important;
    margin-bottom: 0 !important;
}
```

**Question:** Why zero out all spacing with !important?  
**Hypothesis:** Preventing default card.css spacing?  
**Issue:** Aggressive override — may be unnecessary.

#### Example 3: Dashboard Content View Padding
```css
/* Line 967 */
@media (max-width: 900px) {
    #dashboard-content-view.view-is-active {
        padding-top: calc(66px + env(safe-area-inset-top, 0px)) !important;
    }
}
```

**Question:** Why !important for safe-area padding?  
**Hypothesis:** Ensuring header compensation works?  
**Status:** May be justified (safe-area critical), but needs confirmation.

### Mitigation Strategy (Phase 2)
1. Audit each !important in home.css
2. Search for conflicting rules in other files
3. If no conflicts → Remove !important
4. If conflicts exist → Add comment explaining necessity
5. Consider moving mobile-specific rules to mobile.css

### Current Status
**DO NOT MODIFY** — Wait for Phase 2 audit.

---

## 🟠 DANGER ZONE 4: Itinerary.css Size & Complexity

### File
`public/css/modules/pages/itinerary.css`

### Severity
🟠 **HIGH** — Sheer size makes changes risky

### Description
Itinerary.css is the **LARGEST CSS file** (4,930 lines). It contains 4 media queries with !important declarations (lines 2049, 2066, 2082, 3632), making it difficult to track which rule applies at which breakpoint.

### Affected Lines
2049, 2066, 2082, 3632

### Danger Level
- **File Size:** 4,930 lines (largest in project)
- **!important Count:** 4 in media queries
- **Cascade Position:** Middle (inside style.modules.css)
- **Complexity:** 🔴 Very High (multiple breakpoints, nested rules)

### Examples

#### Example 1: Results List Wrapper (Line 2049)
```css
/* Line 2049 */
@media (max-width: 600px) {
    .results-list-wrapper {
        padding: 0.75rem 1rem 1.25rem 1rem !important;
    }
}
```

**Issue:** This rule is **DEAD CODE** because mobile.css L1076 overrides it with higher specificity:
```css
/* mobile.css L1076 — HIGHER SPECIFICITY */
body.itinerary-view-active .results-list-wrapper {
    padding: 0.75rem 0.75rem 0 0.75rem !important;
}
```

**Result:** itinerary.css rule NEVER applies.

#### Example 2: Results List Padding (Line 2066)
```css
/* Line 2066 */
@media (max-width: 600px) {
    .results-list {
        padding: 0 !important;
    }
}
```

**Issue:** Also overridden by mobile.css L1083.

### Mitigation Strategy (Phase 2-3)
1. Identify dead code (rules that never apply)
2. Remove dead code (reduces file size)
3. Consider splitting file:
   - `itinerary-base.css` (desktop rules)
   - `itinerary-mobile.css` (mobile overrides)
4. Move mobile rules to mobile.css (consolidate)

### Current Status
**DO NOT MODIFY** — Wait for Phase 2 dead code analysis.

---

## 🟡 DANGER ZONE 5: Duplicate CSS Loading (style.modules.css)

### File
`public/style.modules.css`

### Severity
🟡 **MEDIUM** — Confusion more than breakage

### Description
style.modules.css imports **29 CSS files TWICE** (lines 88-115 duplicate earlier imports). This was intended to place mobile overrides at the end, but implementation duplicates entire files instead.

### Affected Lines
88-115 (duplicate import block)

### Danger Level
- **Duplicate Count:** 29 files imported twice
- **Performance:** Moderate overhead (browser parses same CSS twice)
- **Cascade:** Confusing (which occurrence applies?)
- **Breakage Risk:** 🟡 Low (mostly causes confusion)

### Example

```css
/* Line 72 — First import */
@import "css/modules/pages/home.css";

/* Line 90 — DUPLICATE import */
@import "css/modules/pages/home.css"; /* ⬅️ Same file again */
```

**Browser Behavior:** Parses home.css twice, applies rules twice (no visual difference, but cascade position changes).

### Mitigation Strategy (Phase 2)
1. Remove duplicate imports (lines 88-115)
2. Keep ONLY unique mobile files:
   - `css/modules/utilities/mobile.css`
   - `css/modules/utilities/mobile-overlays.css`
3. Test all views for visual regressions

### Current Status
**DO NOT MODIFY** — Wait for Phase 2 removal.

---

## 🟢 DANGER ZONE 6: Navigation.css Safe-Area !important (JUSTIFIED)

### File
`public/css/modules/layout/navigation.css`

### Severity
🟢 **LOW** — Justified usage, minimal risk

### Description
Navigation.css uses !important for safe-area padding (lines 29, 36, 43). This is **JUSTIFIED** because iOS devices REQUIRE `padding-bottom: env(safe-area-inset-bottom)` to ensure bottom navigation is visible on devices with notch/bottom bar.

### Affected Lines
29, 36, 43

### Danger Level
- **!important Count:** 3
- **Justification:** ✅ Necessary for iOS safe-area
- **Risk:** 🟢 Low (correct usage)

### Example

```css
/* Line 36 */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
    .nav-bottom {
        padding-bottom: env(safe-area-inset-bottom, 0px) !important;
    }
}
```

**Why !important:** Must override ALL other rules to ensure safe-area compliance on iOS.

**Result:** Bottom navigation always has correct padding on iPhone X and newer.

### Mitigation Strategy
**NONE** — This is correct usage. Document in CSS_DOCUMENTATION.md as justified example.

### Current Status
**NO CHANGES NEEDED** — Keep as-is, document only.

---

## 📊 DANGER ZONES SUMMARY TABLE

| Zone | File | Severity | !important Count | Phase 2 Action | Phase 3 Action |
|------|------|----------|------------------|----------------|----------------|
| **1** | `mobile.css` | 🔴 CRITICAL | 20+ | Audit each usage | Reduce by 50% |
| **2** | `components/itinerary.css` | 🔴 CRITICAL | 0 (cascade wins) | Document | Consolidate into style.modules.css |
| **3** | `home.css` | 🟠 HIGH | 7 | Audit each usage | Remove unnecessary |
| **4** | `itinerary.css` | 🟠 HIGH | 4 | Remove dead code | Split file or consolidate |
| **5** | `style.modules.css` | 🟡 MEDIUM | N/A | Remove duplicates | N/A |
| **6** | `navigation.css` | 🟢 LOW | 3 | Document only | Keep as-is |

---

## 🎯 DEVELOPER CHECKLIST: Before Modifying Padding

Before changing ANY padding/margin in PériMap:

1. **Check PADDING_OWNERSHIP_MAP.md**
   - Who is the canonical owner for this element?

2. **Check this document (PADDING_DANGER_ZONES.md)**
   - Is this element in a danger zone?

3. **Check mobile.css**
   - Does it have `!important` override?
   - If YES: Edit mobile.css, not view-specific file

4. **For Itinerary view: Check components/itinerary.css**
   - Does it define padding for this element?
   - If YES: Edit components/itinerary.css (loads last)

5. **Use DevTools**
   - Inspect element → Styles panel
   - Find which rule is actually applying
   - Note file name + line number

6. **Test on mobile AND desktop**
   - Padding may differ between breakpoints
   - mobile.css overrides only apply < 768px

7. **Add comment if using !important**
   - Explain WHY !important is necessary
   - Reference conflicting rule if known

---

## ✅ PHASE 1 STATUS

**Phase 1 Goal:** Documentation only  
**Status:** ✅ Complete

**Phase 1 Actions Taken:**
- [x] Identified 6 danger zones
- [x] Documented severity and affected lines
- [x] Explained why each zone is dangerous
- [x] Provided mitigation strategies for Phase 2/3
- [x] Created developer checklist

**Phase 1 Actions NOT Taken:**
- [ ] No CSS rules modified
- [ ] No !important declarations removed
- [ ] No padding values changed
- [ ] No files consolidated

**Next Step:** Wait for Phase 2 approval → Begin safe normalization.

---

**Document Version:** 1.0.0  
**Last Updated:** 28 janvier 2026  
**Phase:** Padding Stabilization Phase 1  
**Next Review:** Before Phase 2 execution
