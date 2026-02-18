# Full UI/UX Audit Report — Dream Centre Proficiency Portal

**Audit Date:** 2026-02-18  
**Scope:** All public-facing HTML pages + `public/css/main.css`  
**Pages Audited:** login, signup, forgot-password, reset-password, dashboard, typing, letter, excel, excel-mcq, practice-typing, practice-mcq, practice-letter, practice-excel, results, results-new, leaderboards, feedback, admin, auth-success

---

## 1. CRITICAL ISSUES (Must Fix)

### 1.1 CSS Variable Undefined — Broken Visuals
**Severity: Critical**

`public/css/main.css` uses several CSS custom properties that are **never defined** in `:root` or `[data-theme="dark"]`:

| Undefined Variable | Used In |
|---|---|
| `--gradient-primary` | `.results-header h1`, `.score-circle`, `.submit-btn-main`, `.timer-progress`, `.instructions-card a` |
| `--gradient-secondary` | `.instructions-card a`, `.btn-analyze` |
| `--warning` | `.timer-progress.warning`, `.timer-display.warning`, `.map-circle.current`, `.unanswered-warn` |
| `--warning-light` | `.unanswered-warn` |
| `--success` | `.btn-confirm-submit` |
| `--shadow-primary` | `.submit-btn-main:hover`, `.instructions-card a:hover` |
| `--shadow-secondary` | `.instructions-card a:hover` |
| `--bg-card-hover` | `.q-item:hover` (admin panel) |

**Effect:** These elements render with no background, no color, or broken gradients. The results page title gradient, score circle, and submit buttons are visually broken.

**Fix:** Add to `:root` in `main.css`:
```css
--gradient-primary: linear-gradient(135deg, #58CC02 0%, #46A302 100%);
--gradient-secondary: linear-gradient(135deg, #1CB0F6 0%, #1899D6 100%);
--warning: #F59E0B;
--warning-light: #FEF3C7;
--success: #22C55E;
--shadow-primary: 0 8px 20px rgba(88, 204, 2, 0.35);
--shadow-secondary: 0 8px 20px rgba(28, 176, 246, 0.35);
--bg-card-hover: #F0F2F5;
```
And for `[data-theme="dark"]`:
```css
--warning: #FBBF24;
--warning-light: rgba(251, 191, 36, 0.15);
--success: #4ADE80;
--bg-card-hover: #3A3A3C;
```

---

### 1.2 `feedback.html` Uses Wrong CSS File
**Severity: Critical**

`public/feedback.html` links to `theme.css` (an old/legacy stylesheet) instead of `css/main.css`. This means the feedback page has a completely different visual language from every other page — different fonts, different button styles, different color tokens.

**Fix:** Change line 10 of `feedback.html`:
```html
<!-- FROM: -->
<link rel="stylesheet" href="theme.css">
<!-- TO: -->
<link rel="stylesheet" href="css/main.css">
```
Then remove the large `<style>` block (lines 12–152) and replace with proper CSS classes from `main.css`.

---

### 1.3 Admin Settings Panel Uses Hardcoded Inline Styles with `background: white`
**Severity: Critical (Dark Mode Broken)**

In `public/admin.html` (lines 642, 676, 710, 718), the settings cards use:
```html
style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);"
```
This hardcodes `white` background, making the settings section completely unreadable in dark mode (white cards on dark background).

**Fix:** Replace inline styles with a CSS class `.settings-card` that uses `var(--bg-card)`.

---

## 2. HIGH SEVERITY ISSUES

### 2.1 Duplicate CSS Class Definitions — Specificity Conflicts
**Severity: High**

`main.css` defines the same classes multiple times with conflicting values:

- **`.modal-overlay`** is defined at line 766 (with `display: flex; opacity: 0; visibility: hidden`) AND again at line 2503 (with `display: none`) AND again at line 3954 (with `display: none`). Three conflicting definitions cause unpredictable modal behavior.
- **`.modal-box`** is defined at line 2529 AND again at line 3973 with different padding values.
- **`.filter-bar`** is defined at line 1908 AND again at line 3790 with different gap/padding values.
- **`.q-item`** is defined at line 2168 AND again at line 3756.
- **`.counter-pill`** is defined at line 2288 AND again at line 3769.
- **`.badge-mcq`** is defined at line 2212 AND again at line 3778.
- **`.q-actions`** is defined at line 2229 AND again at line 3842.
- **`.category-counts`** is defined at line 2305 AND again at line 3820.
- **`.cat-count`** is defined at line 2312 AND again at line 3827.
- **`@keyframes spin`** is defined at line 3335 AND again at line 4417.
- **`@keyframes fadeInUp`** is defined at line 1326 AND again at line 3730.
- **`.spinner`** is defined at line 3325 AND again at line 4408 with different sizes (40px vs 60px).
- **`.loading-overlay`** is defined at line 3342 AND again at line 4393 with different z-index values.

**Fix:** Consolidate all duplicate definitions. The `main.css` file is 222KB — it needs a full deduplication pass.

---

### 2.2 Inconsistent Button System — Two Competing Paradigms
**Severity: High**

The project has two completely different button systems that coexist:

**System A** (Duolingo-style, defined ~line 468):
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`
- Uses `border-bottom: 4px solid` for 3D depth effect
- `text-transform: uppercase`

**System B** (Admin-style, defined ~line 1574):
- `.btn-primary`, `.btn-secondary` (redefined!)
- Flat design, no border-bottom depth
- No text-transform

**System C** (Legacy `.action-btn`, `.primary`, `.secondary` classes):
- Used in `results.html`, `results-new.html`
- Yet another visual style

This means the same class name (`.btn-primary`) renders differently depending on which CSS rule wins via cascade order. The results page footer buttons look different from the dashboard buttons.

**Fix:** Unify into a single button system. Remove the duplicate `.btn-primary`/`.btn-secondary` definitions in the admin section and use modifier classes (`.btn--flat`) instead.

---

### 2.3 `forgot-password.html` Missing Page Title/Heading
**Severity: High**

The forgot password page has `<p class="subtitle">Enter your credentials</p>` — this is the same generic subtitle as the login page. There is no `<h1>` or `<h2>` heading telling the user what page they are on. The `reset-password.html` correctly has `<h2>Reset Password</h2>` but `forgot-password.html` does not.

**Fix:** Add `<h2>Forgot Password</h2>` above the subtitle in `forgot-password.html`, and change the subtitle to something contextual like "We'll send a reset link to your email."

---

### 2.4 Login/Signup Pages Missing `<h1>` — Poor Accessibility & SEO
**Severity: High**

Both `login.html` and `signup.html` have no heading element (`<h1>`, `<h2>`) visible to the user. The logo image is present but there is no text heading. Screen readers and search engines have no page landmark.

**Fix:** Add `<h1 class="auth-title">Sign In</h1>` / `<h1 class="auth-title">Create Account</h1>` below the logo in each auth page.

---

### 2.5 Theme Toggle Button Missing from Dashboard Header
**Severity: High**

The `theme-toggle.js` script is loaded on every page, but the dashboard header nav (`dashboard.html`) has no theme toggle button in the HTML. The toggle button is rendered by `theme-toggle.js` as a floating button at `bottom: 1.5rem; left: 1.5rem` — but this overlaps with the toast notification container which is also at `bottom: 5.5rem; left: 1.5rem`. On mobile, both elements stack in the bottom-left corner.

**Fix:** Add the theme toggle button explicitly inside `.dashboard-nav` in `dashboard.html` (the CSS already has `.dashboard-nav .theme-toggle` styles for this). Move toast container to bottom-right to avoid overlap.

---

### 2.6 `practice-mcq.html` — `theme-toggle.js` Loaded After Body Content
**Severity: High**

In `practice-mcq.html`, `theme-toggle.js` is loaded at the bottom of `<body>` (line 184), but `auth.js` is loaded with `defer` in `<head>`. This means on slow connections, the page may flash unstyled (no theme applied) before the toggle script runs.

**Fix:** Move `<script src="theme-toggle.js"></script>` to `<head>` (without defer) on all pages, consistent with how it's done on other pages.

---

## 3. MEDIUM SEVERITY ISSUES

### 3.1 Inline Styles Scattered Throughout HTML
**Severity: Medium**

Multiple pages use inline `style=""` attributes for layout and visibility that should be CSS classes:

- `practice-mcq.html`: `style="display:flex; justify-content: space-between; margin-bottom: 1rem;"`, `style="display: grid; gap: 1rem; margin-top: 1.5rem;"`, `style="margin-top: 2rem; text-align: right;"`, `style="text-align: center;"`, `style="font-size: 1.5rem; margin: 1rem 0;"`
- `practice-excel.html`: `style="margin-bottom: 1.5rem;"`, `style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;"`, `style="flex: 1; min-width: 200px;"`, `style="display: none;"`, `style="margin-bottom: 2rem;"`, `style="white-space: pre-wrap; line-height: 1.8;"`, `style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;"`
- `leaderboards.html`: `style="font-size: 1rem; color: rgba(255,255,255,0.8);"`, `style="display: none;"` (multiple)
- `admin.html`: Extensive inline styles in settings section
- `dashboard.html`: `style="height: 300px; position: relative;"`, `style="margin:0; width: 100%; text-align: center;"`

**Fix:** Extract all inline styles to named CSS classes in `main.css`.

---

### 3.2 `results.html` — Score Circle Uses Undefined `--progress` Custom Property
**Severity: Medium**

The score circle uses `style="--progress: 0deg;"` as an inline CSS custom property, but the `.score-circle` CSS uses `var(--gradient-primary)` (undefined) as its background instead of a `conic-gradient` that would use `--progress`. The visual score animation is broken.

**Fix:** Define `.score-circle` to use `conic-gradient(var(--primary) var(--progress, 0deg), var(--border-color) var(--progress, 0deg))` and ensure `--gradient-primary` is defined.

---

### 3.3 `leaderboards.html` — Leaderboard Cards Section Has No Visible Table/List Structure
**Severity: Medium**

The `#leaderboard-body` div inside `.leaderboard-cards` is populated by JavaScript but has no loading skeleton or empty state defined in HTML. If JS fails or is slow, the user sees a completely blank section with no feedback.

**Fix:** Add a default skeleton loading state inside `#leaderboard-body` in the HTML (similar to how `dashboard.html` handles it).

---

### 3.4 `typing.html` — Admin Bypass Button Visible to All Users
**Severity: Medium**

The `#admin-bypass` div with "Admin: Quick Submit (Bypass Timer)" button is in the HTML with no CSS `display: none` by default. It relies entirely on JavaScript to hide it for non-admins. If JS is slow or fails, all users see this button.

**Fix:** Add `style="display:none"` to `#admin-bypass` in the HTML, and let JS show it only for admins.

---

### 3.5 `practice-letter.html` — Font Size Options Out of Order
**Severity: Medium**

The font size select in the letter editor toolbar has options in illogical order:
```html
<option value="3">11pt</option>
<option value="1">8pt</option>   <!-- smaller than 11pt but listed after -->
<option value="2">10pt</option>
<option value="4">12pt</option>
<option value="5">14pt</option>
```
The options should be in ascending order: 8pt, 10pt, 11pt, 12pt, 14pt.

**Fix:** Reorder the `<option>` elements in ascending font size order.

---

### 3.6 `excel.html` — Timer Positioned in `<footer>` Outside Main Content Flow
**Severity: Medium**

The timer in `excel.html` is inside a `<footer class="test-footer">` element, visually separated from the test content. On the letter test (`letter.html`), the timer is inside the header. This inconsistency confuses users switching between exam stages.

**Fix:** Move the timer to a consistent position — either always in the header (like `letter.html`) or always in a sticky bottom bar.

---

### 3.7 `results.html` — Footer Buttons Mix Classes Inconsistently
**Severity: Medium**

The results footer uses:
```html
<a href="/dashboard.html" class="btn-secondary">Back to Dashboard</a>
<button id="retry-exam-btn" class="btn-secondary">Retry Exam</button>
<button id="practice-zone-btn" class="btn-secondary">Practice Zone</button>
<a href="/feedback.html" class="btn-primary">Give Feedback</a>
```
These use `.btn-secondary` and `.btn-primary` WITHOUT the base `.btn` class, so they miss the base button styles (font-family, font-weight, border-radius, padding from the `.btn` rule). They render with browser-default button styles partially applied.

**Fix:** Add the `.btn` base class: `class="btn btn-secondary"` and `class="btn btn-primary"`.

---

### 3.8 `results-new.html` — Missing `auth.js` Script
**Severity: Medium**

`results-new.html` does not include `<script src="/auth.js" defer></script>`, while `results.html` does. If the new pattern results page requires authentication (which it should), unauthenticated users won't be redirected.

**Fix:** Add `<script src="/auth.js" defer></script>` to `results-new.html`.

---

### 3.9 Dashboard — Leaderboard Carousel Toggle Buttons Have No Accessible Labels
**Severity: Medium**

The carousel toggle buttons use single letters as labels:
```html
<button class="icon-btn" onclick="toggleLeaderboard('standard')" title="Standard Pattern">S</button>
<button class="icon-btn" onclick="toggleLeaderboard('new')" title="New Pattern">N</button>
```
The `title` attribute is not accessible to screen readers. There are no `aria-label` attributes.

**Fix:** Add `aria-label="Standard Pattern"` and `aria-label="New Pattern"` to these buttons.

---

### 3.10 No `aria-live` Region for Toast Notifications
**Severity: Medium**

The `#toast-container` has no `aria-live` attribute. Screen readers won't announce toast messages (success/error notifications) to users.

**Fix:** Add `aria-live="polite"` and `aria-atomic="true"` to `#toast-container` in `toast.js` or wherever it's created.

---

## 4. LOW SEVERITY / POLISH ISSUES

### 4.1 Inconsistent Page Titles
**Severity: Low**

- `login.html`: `<title>Log In - Proficiency Test</title>` — inconsistent format
- `signup.html`: `<title>Sign Up - Proficiency Test</title>` — inconsistent format
- `dashboard.html`: `<title>Dashboard | Dream Centre</title>` — uses `|` separator
- `forgot-password.html`: `<title>Forgot Password - Proficiency Test</title>` — uses `-` separator
- `reset-password.html`: `<title>Reset Password - Proficiency Test</title>` — uses `-` separator

**Fix:** Standardize all titles to `Page Name | Dream Centre` format.

---

### 4.2 `signup.html` — Subtitle Says "Enter your credentials" (Wrong Context)
**Severity: Low**

The signup page subtitle reads "Enter your credentials" — this is the login page's subtitle. For signup it should say something like "Create your free account" or "Join Dream Centre."

**Fix:** Change subtitle in `signup.html` to "Create your free account."

---

### 4.3 `forgot-password.html` — Subtitle Says "Enter your credentials" (Wrong Context)
**Severity: Low**

Same issue as above — the forgot password page subtitle reads "Enter your credentials" which is misleading.

**Fix:** Change subtitle to "Enter your email to receive a reset link."

---

### 4.4 Practice Zone Cards — No Visual Distinction Between Practice Types
**Severity: Low**

All four practice items on the dashboard use the same green left-border accent on hover. There's no color coding to distinguish Typing (blue?), MCQ (orange?), Letter (purple?), Excel (green?). The icons are emoji which may render differently across OS.

**Fix:** Assign distinct `--practice-color` per card type and use SVG icons instead of emoji for consistency.

---

### 4.5 `practice-mcq.html` — "Med" Abbreviation for Medium Difficulty
**Severity: Low**

The difficulty buttons use "Med" as an abbreviation for "Medium" which is non-standard. All other difficulty references in the codebase use "Medium."

**Fix:** Change button text from "Med" to "Medium" (or ensure consistent abbreviation across all pages).

---

### 4.6 `leaderboards.html` — Toggle Buttons Use Single Letters "N" and "S"
**Severity: Low**

The pattern toggle buttons on the leaderboard page use single letters "N" (New Pattern) and "S" (Standard). These are cryptic without context.

**Fix:** Use full words "New" and "Std" or add icon + text.

---

### 4.7 `excel.html` — File Input Has No Drag-and-Drop Zone
**Severity: Low**

The file upload in `excel.html` uses a plain `<input type="file">` with no visual drag-and-drop affordance. The `practice-excel.html` also lacks this. The CSS has `.upload-card input[type="file"]` with a dashed border, but there's no visual label or instruction text.

**Fix:** Add a styled drop zone with instruction text: "Drag & drop your .xlsx file here, or click to browse."

---

### 4.8 `auth-success.html` — No Error State
**Severity: Low**

The auth success page only shows a spinner. If the OAuth callback fails, the user sees a spinning loader forever with no error message.

**Fix:** Add a timeout (e.g., 10 seconds) after which an error message is shown with a link back to login.

---

### 4.9 Dashboard — "Complete Mock Examination" Card Has No Exam Duration Info
**Severity: Low**

The start test card says "Simulate the official NSSB CPT environment" but gives no indication of how long the exam takes. Users don't know if they're committing to 15 minutes or 45 minutes.

**Fix:** Add duration info: "~15 min (New Pattern) or ~25 min (Standard Pattern)."

---

### 4.10 `practice-typing.html` — Emoji Icons in Mode/Drill Buttons
**Severity: Low**

Mode buttons use emoji (👁️, 🎯) and drill buttons use emoji (🏠, ⬆️, ⬇️, 🔢, 📝, ✏️). These render inconsistently across platforms and OS versions.

**Fix:** Replace emoji with SVG icons for consistent cross-platform rendering.

---

### 4.11 No `<noscript>` Fallback on Any Page
**Severity: Low**

The entire application is JavaScript-dependent. If JS is disabled, users see blank pages with no explanation.

**Fix:** Add `<noscript>` tags on key pages with a message: "This application requires JavaScript to be enabled."

---

### 4.12 `main.css` File Size — 222KB Monolithic CSS
**Severity: Low (Performance)**

The single `main.css` file is 222KB (uncompressed). It contains:
- Duplicate class definitions (see issue 2.1)
- Legacy/unused CSS from old theme files (`gamified-theme.css`, `modern-theme.css`, `enhanced-pages.css`, `dark-mode.css`, `style.css`, `theme.css` — all still present in `/public` but not linked by most pages)
- Redundant `@keyframes` definitions

**Fix:** 
1. Remove unused CSS files from `/public` (or move to `/public/legacy/`)
2. Deduplicate class definitions
3. Split into page-specific CSS chunks or use CSS modules
4. Target: reduce to under 80KB

---

## 5. SUMMARY TABLE

| # | Issue | Page(s) | Severity | Category |
|---|-------|---------|----------|----------|
| 1.1 | Undefined CSS variables (`--gradient-primary`, `--warning`, etc.) | results, excel, excel-mcq, admin | **Critical** | CSS |
| 1.2 | `feedback.html` uses wrong CSS file (`theme.css`) | feedback | **Critical** | CSS |
| 1.3 | Admin settings uses `background: white` (dark mode broken) | admin | **Critical** | Dark Mode |
| 2.1 | Duplicate CSS class definitions (modal, spinner, filter-bar, etc.) | All | **High** | CSS |
| 2.2 | Two competing button systems (`.btn` vs admin `.btn-primary`) | All | **High** | Design System |
| 2.3 | `forgot-password.html` missing page heading | forgot-password | **High** | Accessibility |
| 2.4 | Login/Signup missing `<h1>` heading | login, signup | **High** | Accessibility/SEO |
| 2.5 | Theme toggle overlaps toast container (bottom-left) | All | **High** | Layout |
| 2.6 | `theme-toggle.js` loaded after body content in practice-mcq | practice-mcq | **High** | Performance |
| 3.1 | Inline styles scattered throughout HTML | Multiple | **Medium** | Maintainability |
| 3.2 | Score circle `--progress` custom property broken | results, results-new | **Medium** | CSS |
| 3.3 | Leaderboard list has no loading skeleton in HTML | leaderboards | **Medium** | UX |
| 3.4 | Admin bypass button visible without JS | typing | **Medium** | Security/UX |
| 3.5 | Font size options out of order in letter editor | practice-letter | **Medium** | UX |
| 3.6 | Timer position inconsistent between exam stages | excel, letter | **Medium** | UX |
| 3.7 | Results footer buttons missing base `.btn` class | results | **Medium** | CSS |
| 3.8 | `results-new.html` missing `auth.js` | results-new | **Medium** | Security |
| 3.9 | Carousel toggle buttons missing `aria-label` | dashboard | **Medium** | Accessibility |
| 3.10 | Toast container missing `aria-live` | All | **Medium** | Accessibility |
| 4.1 | Inconsistent page title format | All | Low | SEO |
| 4.2 | Signup subtitle says "Enter your credentials" | signup | Low | Copy |
| 4.3 | Forgot password subtitle says "Enter your credentials" | forgot-password | Low | Copy |
| 4.4 | Practice zone cards no color distinction | dashboard | Low | Visual Design |
| 4.5 | "Med" abbreviation for Medium difficulty | practice-mcq | Low | Copy |
| 4.6 | Leaderboard toggle uses cryptic "N"/"S" letters | leaderboards, dashboard | Low | UX |
| 4.7 | File upload has no drag-and-drop zone | excel, practice-excel | Low | UX |
| 4.8 | Auth success page has no error/timeout state | auth-success | Low | UX |
| 4.9 | Start exam card missing duration info | dashboard | Low | UX |
| 4.10 | Emoji icons in practice typing buttons | practice-typing | Low | Visual Design |
| 4.11 | No `<noscript>` fallback on any page | All | Low | Accessibility |
| 4.12 | `main.css` is 222KB monolithic file with duplicates | All | Low | Performance |

---

## 6. PRIORITIZED FIX LIST (Ordered for Implementation)

### Phase 1 — Critical Fixes (Do First)
1. **Add missing CSS variables** to `:root` in `main.css` (`--gradient-primary`, `--gradient-secondary`, `--warning`, `--warning-light`, `--success`, `--shadow-primary`, `--shadow-secondary`, `--bg-card-hover`)
2. **Fix `feedback.html`** — change CSS link from `theme.css` to `css/main.css`, remove inline `<style>` block, use proper classes
3. **Fix admin settings dark mode** — replace `background: white` inline styles with `.settings-card` CSS class using `var(--bg-card)`

### Phase 2 — High Priority Fixes
4. **Deduplicate CSS** — merge all duplicate class definitions in `main.css` (modal-overlay, modal-box, filter-bar, q-item, spinner, loading-overlay, keyframes)
5. **Unify button system** — remove duplicate `.btn-primary`/`.btn-secondary` definitions in admin section; use single system
6. **Add `<h1>` to login and signup pages**
7. **Add heading to `forgot-password.html`** and fix subtitle copy
8. **Fix theme toggle / toast overlap** — move toast container to bottom-right (`right: 1.5rem`)
9. **Move `theme-toggle.js` to `<head>`** on `practice-mcq.html`

### Phase 3 — Medium Priority Fixes
10. **Extract inline styles** to CSS classes across all pages
11. **Fix score circle** — use `conic-gradient` with `--progress` variable
12. **Add loading skeleton** to leaderboard list HTML
13. **Hide admin bypass button** by default in `typing.html`
14. **Fix font size option order** in `practice-letter.html`
15. **Standardize timer position** across exam pages
16. **Fix results footer buttons** — add base `.btn` class
17. **Add `auth.js`** to `results-new.html`
18. **Add `aria-label`** to carousel toggle buttons
19. **Add `aria-live`** to toast container

### Phase 4 — Polish & Performance
20. **Standardize page titles** to `Page Name | Dream Centre` format
21. **Fix subtitle copy** on signup and forgot-password pages
22. **Add color coding** to practice zone cards
23. **Fix "Med" → "Medium"** on difficulty buttons
24. **Expand leaderboard toggle labels** from "N"/"S" to full words
25. **Add drag-and-drop zone** to file upload inputs
26. **Add error/timeout state** to `auth-success.html`
27. **Add exam duration info** to start test card
28. **Replace emoji** with SVG icons in practice-typing
29. **Add `<noscript>` fallbacks** to all pages
30. **Reduce `main.css` size** — remove legacy CSS files, deduplicate, split by page

---

## 7. LEGACY CSS FILES TO CLEAN UP

The following CSS files exist in `/public` but are **not linked by any HTML page** (except `theme.css` which is only used by the broken `feedback.html`):

| File | Size | Status |
|------|------|--------|
| `public/dark-mode.css` | 44KB | Unused — superseded by `main.css` |
| `public/gamified-theme.css` | 70KB | Unused — content merged into `main.css` |
| `public/modern-theme.css` | 19KB | Unused |
| `public/enhanced-pages.css` | 15KB | Unused |
| `public/premium-headers.css` | 11KB | Unused |
| `public/style.css` | 45KB | Unused |
| `public/theme.css` | 25KB | Only used by broken `feedback.html` |
| `public/results.css` | 5KB | Unused |
| `public/results-new.css` | 2KB | Unused |

**Total dead CSS: ~236KB** — larger than the active `main.css` itself.

**Recommendation:** Move to `/public/legacy/` or delete after confirming no references remain.
