# BVO Change Log Brief
*Last updated: 2026-07-21*

---

## Scope — Universal Swatch & Chip Layout (Rule 13)
**Date:** 2026-07-21

### Summary
Established a universal, locked-in layout standard for size chips and color swatches across ALL card types on the site. This resolved a series of card-by-card discrepancies that accumulated across sessions.

### Changes Made

**`public/css/site2.css`** (at v13 after all changes):
- Labels: `.model-card-swatches-label` / `.model-card-sizes-label` — `font-size: .68rem`, `font-weight: 600`, `min-width: 5rem`, `color: #9CA3AF`, `text-transform: uppercase`
- Swatches row: `.model-card-swatches` — `gap: .35rem`, `margin-bottom: .5rem`
- Swatch shift: `.model-card-swatches .model-card-swatch:first-of-type` — `margin-left: -.5rem`
- Sizes row: `.model-card-sizes-row` — `gap: .35rem`, `margin-bottom: .5rem`
- Chip container shift: `.model-card-size-chips` — `margin-left: -.55rem`
- Chip button: `.model-card-size-btn` — `padding: .13rem`, `font-size: .68rem`, `font-weight: 600`, `border-radius: 3px`

**`views/pages/collection.ejs`:**
- Removed `"` from all size chip button visible text (model-group cards + product cards)
- Restored `FINISHES:` / `SIZES:` labels on all card types
- Removed 5-chip cap (+N overflow) — all sizes now shown
- Model-group chip template updated to use `sz.key` / `sz.label` (bucketed objects from SIZE_BUCKETS)

**`views/pages/index.ejs`:**
- Removed `"` from all size chip button visible text (carousel + featured product cards)
- Restored `FINISHES:` / `SIZES:` labels
- Removed 5-chip cap (+N overflow)

**`src/controllers/collectionsController.js`:**
- Applied SIZE_BUCKETS bucketing to model-group `m.sizes` (was raw numbers; now `{label, key}` objects)
- Fixed model-group filter options query: added `AND p.category_id = ?` scope
- Fixed model-group main WHERE: added `AND p.category_id = ?` scope

### Permanent Rule
See **Rule 13** in `BVO_AUDIT_BRIEF.md` for the canonical values and violation checklist.

---

## Scope 1 — Bug 3: Listing Grid Mobile Breakpoint + Pagination Fix
**Commit:** `7f292fb` — *"Bug 3: fix listing-grid mobile breakpoint + increase PER_PAGE to 24"*

### Problem
- On phones (≤480px), product cards in collection pages (e.g. `/collections/bathroom-vanities`) were showing 1 per row at full width, stretching the card layout.
- Pagination was 354 pages for 4,237 JM products — far too many.

### Changes
**`public/css/site.css`** — Added `listing-grid` to the existing `@media (max-width: 480px)` block:
```css
@media (max-width: 480px) {
  .category-grid { grid-template-columns: 1fr; }
  .product-grid  { grid-template-columns: 1fr; }
  .listing-grid  { grid-template-columns: 1fr; }   ← ADDED
  .value-bar     { grid-template-columns: 1fr; }
  .trust-band    { grid-template-columns: 1fr; }
  .footer-grid   { grid-template-columns: 1fr; }
  .parallax-title { font-size: 2rem; }
}
```

**`src/models/Product.js` line 5:**
```js
// BEFORE:
const PER_PAGE = 12;
// AFTER:
const PER_PAGE = 24;
```
→ Reduces pagination from 354 pages to ~177 pages for 4,237 JM products.

### To Reverse
- Revert `PER_PAGE` back to `12` in `src/models/Product.js`
- Remove the `.listing-grid { grid-template-columns: 1fr; }` line from the `@media (max-width: 480px)` block in `site.css`

---

## Scope 2 — Mobile Layout: Carousel, Filter Drawer, Related Products Grid
**Commit:** `fb1159b` — *"Mobile layout: responsive carousel, filter drawer, fix related products grid"*

### Problem
Three separate mobile layout issues observed in phone screenshots:
1. Related products section on product detail page always showed 4 columns on mobile (hardcoded inline style overriding all CSS media queries)
2. Homepage featured-models carousel showed 4 tiny cards on phone (~57px each), text completely clipped
3. Filter sidebar stacked above products on mobile, pushing all products far down the page

### Changes

**`views/pages/product.ejs` line 324** — Removed hardcoded inline style:
```html
<!-- BEFORE -->
<div class="product-grid" style="grid-template-columns:repeat(4,1fr)">
<!-- AFTER -->
<div class="product-grid">
```
→ Allows existing CSS breakpoints to work: 4 cols desktop, 3 at ≤1100px, 2 at ≤860px, 1 at ≤480px.

**`public/js/site.js`** — Made carousel `VISIBLE` responsive (was hardcoded `var VISIBLE = 4`):
```js
// BEFORE:
var VISIBLE = 4;
var GAP = 20;
function sizeCards() {
  var trackW = track.offsetWidth;
  if (!trackW) return;
  var cardW = Math.floor((trackW - (VISIBLE - 1) * GAP) / VISIBLE);

// AFTER:
var GAP = 20;
function sizeCards() {
  var trackW = track.offsetWidth;
  if (!trackW) return;
  var vw = window.innerWidth;
  var VISIBLE = vw < 520 ? 1.2 : vw < 768 ? 2 : 4;
  var cardW = Math.floor((trackW - (VISIBLE - 1) * GAP) / VISIBLE);
```
→ 4 cards on desktop, 2 on tablet, 1.2 on phone (full card + peek of next).

**`views/pages/collection.ejs`** — Added filter overlay div, close button, and mobile "Filters" toggle button:
```html
<!-- overlay (before .listing-layout) -->
<div class="filter-overlay" id="filterOverlay" aria-hidden="true"></div>

<!-- close button (inside .filter-header) -->
<button type="button" class="filter-close-btn" id="filterCloseBtn" aria-label="Close filters">
  <svg viewBox="0 0 24 24" width="18" height="18" ...><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
</button>

<!-- mobile toggle button (first element in .listing-toolbar) -->
<button type="button" class="mobile-filter-btn" id="mobileFilterBtn" aria-label="Open filters">
  <svg ...>...</svg>
  Filters<% if (hasActiveFilters) { %> <span class="mobile-filter-dot">●</span><% } %>
</button>
```

**`public/css/site.css`** — Appended mobile filter drawer CSS (now in site2.css after Scope 3 split):
```css
.mobile-filter-btn, .filter-close-btn, .filter-overlay { display: none; }

@media (max-width: 720px) {
  .filter-panel {
    position: fixed !important;
    top: 0; left: 0;
    width: 82%; max-width: 300px; height: 100%;
    transform: translateX(-110%);
    transition: transform .28s ease;
    z-index: 600;
    overflow-y: auto;
    border-radius: 0;
    box-shadow: 4px 0 24px rgba(24,40,64,.18);
    padding: 20px;
  }
  .filter-panel.is-open { transform: translateX(0); }
  .filter-overlay { display: block; position: fixed; inset: 0; background: rgba(24,40,64,.45); z-index: 599; opacity: 0; pointer-events: none; transition: opacity .28s ease; }
  .filter-overlay.is-open { opacity: 1; pointer-events: auto; }
  .mobile-filter-btn { display: inline-flex; ... }
  .filter-close-btn { display: inline-flex; ... }
}
```

**`public/js/site.js`** — Appended mobile filter drawer IIFE at end of file:
```js
(function () {
  var panel   = document.querySelector('.filter-panel');
  var openBtn = document.getElementById('mobileFilterBtn');
  var closeBtn = document.getElementById('filterCloseBtn');
  var overlay  = document.getElementById('filterOverlay');
  if (!panel || !openBtn) return;
  function openDrawer()  { panel.classList.add('is-open'); if (overlay) overlay.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
  function closeDrawer() { panel.classList.remove('is-open'); if (overlay) overlay.classList.remove('is-open'); document.body.style.overflow = ''; }
  openBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay)  overlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
})();
```

### To Reverse
- `product.ejs` line 324: restore `style="grid-template-columns:repeat(4,1fr)"` on the `.product-grid` div
- `site.js`: restore `var VISIBLE = 4;` as outer constant; remove `var vw = ...` and `var VISIBLE = ...` inside `sizeCards()`
- `collection.ejs`: remove the `filter-overlay` div, `filter-close-btn` button, and `mobile-filter-btn` button
- `site.css` / `site2.css`: remove the mobile filter drawer CSS block
- `site.js`: remove the mobile filter drawer IIFE at the end of the file

---

## Scope 3 — CSS Split: Bypass Hostinger 80KB CDN File Size Limit
**Commit:** *(pending push)* — *"fix: split site.css → site.css + site2.css to bypass Hostinger 80KB CDN limit"*

### Problem Discovered
The Hostinger CDN was silently truncating `public/css/site.css` at approximately **79,600 bytes**. The local file grew to **105,333 bytes** (2,706 lines) over the course of development. Everything past byte 79,600 — approximately line 1,689 onwards — was never served to browsers. This meant the following CSS sections were **completely invisible to the live site**:
- Newsletter section
- Testimonials section  
- Cart drawer
- Cart count badge
- Related products
- Trust band
- Model card swatches (`.model-card-swatches`, `.model-card-swatch`, `.model-card-sizes-row`)
- Favorites / heart button
- **Mobile filter drawer** (added in Scope 2)
- Various responsive breakpoints

This was the root cause of Scope 1 and Scope 2 fixes "not working" after deployment — the CSS was never reaching the browser.

### Changes

**`public/css/site.css`** — Trimmed to lines 1–1688 (77,540 bytes). Ends just before the NEWSLETTER section.

**`public/css/site2.css`** *(new file)* — Lines 1689–2706 of the original site.css (27,793 bytes). Contains:
- NEWSLETTER section
- TESTIMONIALS section
- CART DRAWER
- Cart count badge
- Related products
- Trust band
- Model card swatches + sizes
- Favorites / heart button styles
- Mobile filter drawer CSS (from Scope 2)

**`views/layouts/main.ejs`** — Added second stylesheet link:
```html
<!-- BEFORE -->
<!-- Site CSS -->
<link rel="stylesheet" href="/css/site.css">

<!-- AFTER -->
<!-- Site CSS (split to stay under CDN 80KB file-size limit) -->
<link rel="stylesheet" href="/css/site.css">
<link rel="stylesheet" href="/css/site2.css">
```

### To Reverse
- Concatenate `site.css` + `site2.css` back into a single `site.css`: `cat site.css site2.css > site_full.css && mv site_full.css site.css`
- Delete `site2.css`
- Remove the `site2.css` link from `main.ejs`
- Note: the combined file will exceed the ~79KB CDN limit and the problem will return unless the Hostinger CDN limit is raised or the CSS is minified

### Long-term Recommendation
If the CSS continues to grow, consider one of:
1. **Minify CSS** at deploy time (e.g. `cssnano` or `cleancss`) — a minified version of this file would be ~45–55KB, well under any limit
2. **Raise Hostinger's limit** — check nginx config or CDN settings for `client_max_body_size` / file-size caps
3. **Create a `site3.css`** if/when `site2.css` approaches 79KB

---

## Feature: James Martin Bundle Builder — `/bundle-builder`
**Commits:** `(bundleController)` → `a3ed0a9` (model-viewer redesign)
**Last updated:** 2026-07-30
**Rollback:** `git reset --hard 9d30d47` removes the entire feature (all 4 files)

---

### 1. Purpose

A dedicated page at `/bundle-builder` that lets shoppers assemble a James Martin bathroom set (cabinet + top + optional mirror + optional faucet) and earn a tiered discount — 5% for cabinet+top, 10% if they add a mirror, 15% when faucet is available. Each item is added to the cart individually at the discounted price so standard cart/checkout logic is unchanged.

---

### 2. Files Involved

| File | Role |
|---|---|
| `src/controllers/bundleController.js` | Fetches all JM SKUs for each step, groups by model, passes to view |
| `src/routes/bundle.js` | Registers `GET /bundle-builder` → bundleController.getBundleBuilder |
| `src/server.js` | Mounts bundle router: `app.use('/', bundleRouter)` |
| `views/pages/bundle-builder.ejs` | Full page template + inline client-side JS state machine |
| `public/css/site2.css` | All `.bb-*` styles (lines after the BUNDLE BUILDER comment header) |
| `views/layouts/main.ejs` | CSS version bump (currently `?v=31`) |

---

### 3. Database Layer — bundleController.js

#### Brand constant
```js
const JM_BRAND = 'James Martin Vanities';
// NOTE: never abbreviate to 'James Martin' — that matches zero rows
```

#### CHIP_SQL — color chip photo subquery
Each SKU row includes a `chip_image` column, fetched from the Sample products JM provides:

```sql
(SELECT pi2.url FROM product_images pi2
 INNER JOIN products s ON s.id = pi2.product_id
 WHERE s.brand       = ?          -- param 1: JM_BRAND
   AND s.model       = p.model    -- same collection name
   AND s.color       = p.color    -- same finish/color
   AND s.category_id = 10         -- category_id=10 = Sample products
 ORDER BY pi2.sort_order ASC, pi2.id ASC LIMIT 1) AS chip_image
```

**Key assumption:** JM Sample products (category_id=10, product_type='Sample') are the swatch/chip images JM bundles with every collection. They are matched by exact `brand + model + color` string. If color naming drifts between the regular product catalog and Sample products (e.g. "White" vs "White Glossy"), `chip_image` will return NULL and the swatch falls back to `FAMILY_HEX[color_family]` hex color.

#### IMG_SQL — primary product image
```sql
COALESCE(
  (SELECT pi.url FROM product_images pi
   WHERE pi.product_id = p.id
   ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1),
  p.primary_image_url
) AS primary_image
```
No bind params — scoped to the product itself via `p.id`.

#### Parameter count per query
Each query has exactly **2 bind params**: `[JM_BRAND, JM_BRAND]`.
- CHIP_SQL: 1 `?` (s.brand = ?)
- Main WHERE: 1 `?` (p.brand = ?)
- IMG_SQL: 0 `?` (no outer bind)

**Bug fixed in commit a3ed0a9:** original code passed `[JM_BRAND, JM_BRAND, JM_BRAND]` (3 params) — MySQL would throw "Parameter count mismatch". Now correctly `[JM_BRAND, JM_BRAND]`.

#### Three queries

**Step 1 — Cabinets:**
```sql
WHERE p.brand        = ?
  AND c.slug         = 'vanities'
  AND p.product_type = 'Cabinet Only'
  AND p.is_active    = 1
ORDER BY p.model ASC, p.width_in ASC, p.price ASC
```
`product_type = 'Cabinet Only'` mirrors exactly what the megamenu "Cabinet Only" link sends (`?type=Cabinet+Only`). The collectionsController maps `req.query.type` → `p.product_type` in a WHERE clause.

**Step 2 — Tops:**
```sql
WHERE p.brand      = ?
  AND c.slug       = 'vanity-tops'
  AND p.is_active  = 1
  AND (
    p.name         LIKE '%Quartz%'
    OR p.name      LIKE '%Marble%'
    OR p.product_type LIKE '%Quartz%'
    OR p.product_type LIKE '%Marble%'
  )
ORDER BY p.model ASC, p.width_in ASC, p.price ASC
```
**Assumption:** We only offer quartz/marble tops in the bundle. The LIKE filter is intentionally broad — it catches both product name and product_type. If JM introduces tops with different material names (e.g. "Granite"), this query will silently exclude them. **TODO: revisit once we verify all JM top product_type values in the DB.**

Width filtering for tops happens **client-side**, not in SQL — all tops are fetched up front, then the JS `activeTops()` function filters `TOP_MODELS` to only include models that have a SKU matching the selected cabinet's `width_in`. This avoids an extra round-trip when the cabinet selection changes.

**Step 3 — Mirrors:**
```sql
WHERE p.brand         = ?
  AND (c.slug = 'accessories' OR c.slug = 'mirrors')
  AND p.product_type  LIKE '%Mirror%'
  AND p.is_active     = 1
ORDER BY p.model ASC, p.width_in ASC, p.price ASC
```
**Assumption:** Mirrors live in either `accessories` or `mirrors` category slugs. If the import puts them elsewhere, this returns zero results. Verify with `SELECT DISTINCT c.slug FROM products p JOIN categories c ON c.id=p.category_id WHERE p.brand='James Martin Vanities' AND p.product_type LIKE '%Mirror%'`.

#### groupByModel(rows)
Converts a flat array of SKU rows into an array of `{ model, skus[] }` objects, sorted alphabetically by model name:
```js
[
  { model: 'Brookfield', skus: [{ id, slug, name, model, price, width_in, color, color_family, primary_image, chip_image }, ...] },
  { model: 'Hudson',     skus: [...] },
  ...
]
```
The `model` column in the DB = JM's "Collection Name" (e.g. "Hudson", "Brookfield", "De Soto"). Models with NULL model are grouped under key `'Other'`.

#### View render call
```js
res.render('pages/bundle-builder', {
  cabinetModels: groupByModel(cabinets),   // array of { model, skus[] }
  topModels:     groupByModel(tops),       // same shape
  mirrorModels:  groupByModel(mirrors),    // same shape
  familyHex:     FAMILY_HEX,              // { white: '#f5f5f3', cream: '#e8d9b8', ... }
});
```

`FAMILY_HEX` is built from `src/config/colorFamilies.js` FAMILIES array. Each key maps to a hex color used as swatch background fallback when `chip_image` is NULL. Also adds `key + '_border'` entry for border color (currently same as fill for most families).

---

### 4. EJS Template — bundle-builder.ejs

The template does **no server-side rendering of product state** beyond injecting the three `*Models` arrays and `familyHex` as JSON into JS constants. All display logic is client-side.

```html
<script>
var CABINET_MODELS = <%- JSON.stringify(cabinetModels) %>;
var TOP_MODELS     = <%- JSON.stringify(topModels) %>;
var MIRROR_MODELS  = <%- JSON.stringify(mirrorModels) %>;
var FAMILY_HEX     = <%- JSON.stringify(familyHex) %>;
</script>
```

**Breadcrumb:** Uses `<div class="breadcrumb">` (not `<nav>`), matching the pattern in `collection.ejs`. Site.css already styles `.breadcrumb` at `.78rem` / `var(--muted)` color.

**Tier bar:** 3 entries only — "Vanity + Top = 5%", "+ Mirror = 10%", "+ Faucet = 15%". No "0% Vanity only" entry. Active tier highlighted by JS `updateSummary()` toggling `.is-active`.

**Step sections:** Each step has an identical HTML skeleton:
- `.bb-step-hd` — number circle, title/meta text, `‹ N/M ›` navigator (`#bb-vnav-*`), selected badge (`#bb-badge-*`)
- `.bb-mcard` — 2-column grid (`.bb-mcard-img-col` + `.bb-mcard-info`)

Step 2 (Top) starts with `.bb-step--locked` class and a lock message inside `.bb-mcard` instead of the card columns. The card columns are injected by JS `unlockTopStep()` when a cabinet is selected.

**Heart button:** Uses `.heart-btn` class with `data-product-id` and `data-product-slug` attributes. Site.js handles this globally via event delegation at `POST /account/favorites/toggle`. The bundle builder does not need any special heart logic — it just keeps the attributes updated as the displayed SKU changes.

**Size chips:** Use `.model-card-size-btn` class (same as `collection.ejs`) with `data-step` and `data-size` (float) attributes. The `is-active` class is toggled by `pickSize()`.

**Finish swatches:** `.bb-swatch` buttons with `data-step` and `data-color` attributes. Background is either `background-image: url(chip_image)` (JM sample photo) or `background-color: hex` fallback. `title` attribute = color name (shown on browser hover). `is-active` class toggled by `pickColor()`.

---

### 5. Client-Side State Machine

#### Global variables
```js
// Which model index is visible per step (0-based)
var gIdx   = { cabinet: 0, top: 0, mirror: 0 };

// Currently selected size filter per step (null = show all)
// Size persists when navigating between models
var gSize  = { cabinet: null, mirror: null };
// NOTE: top step has no size picker — width is locked to cabinet

// Currently selected color per step (null = show cheapest/first available)
// Color resets when navigating to a different model
var gColor = { cabinet: null, top: null, mirror: null };

// Confirmed selections (the SKU objects the shopper has clicked "Select" on)
var state  = { cabinet: null, top: null, mirror: null };
```

#### Key functions and their responsibilities

**`getModels(step)`** — Returns the right models array for a step. For 'top', returns `activeTops()` (width-filtered) instead of raw `TOP_MODELS`.

**`activeTops()`** — Filters `TOP_MODELS` to only include models that have at least one SKU matching `state.cabinet.width_in`. If no cabinet is selected yet, returns all `TOP_MODELS`. This is the mechanism that makes the top step only show compatible tops.

**`getSizeFilteredSkus(step, model)`** — Returns the SKUs for a model filtered by `gSize[step]`. For 'top', always returns all model.skus (no size filter). If the size filter would result in 0 SKUs (e.g. the user picked 36" but this model only comes in 30" and 48"), falls back to all SKUs — this prevents blank cards when navigating to a model that doesn't carry the selected size.

**`getDisplaySku(step, model)`** — The single SKU whose image/name/price is displayed. Tries to match `gColor[step]` within the size-filtered SKUs. If no color match, returns the first SKU. This is the "currently displayed product" — not necessarily the selected one.

**`renderViewer(step)`** — Full re-render of a step's card. Called after model navigation, size chip picks, and step init. Rebuilds image, name, price, size chips, swatches, select button state, nav counter.

**`updateCard(step, displaySku)`** — Lightweight update (image/name/price/finish label/view link/heart) after a swatch pick, without rebuilding the chip/swatch HTML. Avoids flicker.

**`navModel(step, dir)`** — Advances `gIdx[step]` by +1 or -1, resets `gColor[step]` to null (new model = new color context), calls `renderViewer()`.

**`pickSize(step, size)`** — Toggles `gSize[step]` (clicking active chip de-selects it). Resets `gColor[step]`. Calls `renderViewer()`.

**`pickColor(step, color)`** — Toggles `gColor[step]`. Updates swatch `.is-active` classes in-place. Calls `updateCard()` for a lightweight image/price swap.

**`selectProduct(step)`** — If the displayed SKU is already `state[step]`, clears it (deselect). Otherwise sets `state[step]` to the displayed SKU. If step is 'cabinet' and we're clearing, also calls `lockTopStep()`. If step is 'cabinet' and we're selecting, calls `unlockTopStep()`. Always calls `updateBadge()`, `renderViewer()`, `updateSummary()`.

**`lockTopStep()`** — Clears `state.top`, resets top viewer indices, replaces `.bb-mcard-top` innerHTML with lock message, disables nav buttons, re-adds `.bb-step--locked` to step section.

**`unlockTopStep()`** — Removes `.bb-step--locked`, rebuilds `.bb-mcard-top` innerHTML with full card columns (including all the element IDs the rest of the JS expects), then calls `renderViewer('top')`. Because the top step starts locked, these elements don't exist in the initial HTML — they are injected here.

**`updateBadge(step)`** — Shows/hides the green "Selected ✓ [name]" badge in the step header based on `state[step]`.

**`updateSummary()`** — Rebuilds the sticky summary bar:
  1. Determines `itemCount()` (0–3, faucet always 0 for now)
  2. Looks up `discount()` from `TIERS` array
  3. Highlights the active `.bb-tier`
  4. Updates the badge text and `.has-discount` class
  5. Calculates `orig` total and `final` total with discount applied
  6. Rebuilds each summary row with per-item discounted price + strikethrough original
  7. Enables/disables the "Add Bundle to Cart" button (enabled once cabinet is selected)

**`addToCart()`** — Posts each selected item to `POST /cart/add` in parallel using `Promise.all`. Each POST includes:
  - `product_id`, `slug`, `name`, `image` — standard cart fields
  - `price` — the **discounted** unit price (original × (1 - disc/100)), 2 decimal places
  - `original_price` — unmodified price (for strikethrough in cart)
  - `bundle_discount_pct` — the percentage (5, 10, or 15)
  - `qty: 1`

On success, redirects to `/cart`. On failure, re-enables the button and alerts.

**`onPageClick(e)` (event delegation)** — Single global click handler for all interactive elements. Uses `closest()` to identify:
  - `[id^="bb-prev-"]` / `[id^="bb-next-"]` → `navModel()`
  - `.model-card-size-btn[data-step]` → `pickSize()`
  - `.bb-swatch[data-step]` → `pickColor()`
  - `[id^="bb-select-"]` → `selectProduct()`
  - `#bb-add-cart` → `addToCart()`

Heart buttons (`.heart-btn`) are handled by site.js globally — no special handler needed.

---

### 6. Discount Tiers

```js
var TIERS = [0, 0, 5, 10, 15];
//            ^  ^  ^   ^   ^
//            |  |  |   |   └── 4 items (cab+top+mirror+faucet) = 15%
//            |  |  |   └────── 3 items (cab+top+mirror) = 10%
//            |  |  └────────── 2 items (cab+top) = 5%
//            |  └───────────── 1 item (cabinet only) = 0%
//            └──────────────── 0 items = 0%
```

`discount()` = `TIERS[Math.min(itemCount(), 4)]`. Faucet is "coming soon" so `itemCount()` maxes at 3 for now → max live discount is 10%. When faucet is added, simply increment the counter logic; the TIERS array already has 15% at index 4.

---

### 7. CSS — site2.css `.bb-*` Block

The entire bundle builder CSS lives in one contiguous block in `site2.css`, starting at the `BUNDLE BUILDER` comment. The `.bt-*` bundle teaser section (homepage cards) immediately follows and must **not** be touched when editing bundle builder CSS.

**Key classes:**
- `.bb-wrap` — max-width 1280px page wrapper
- `.bb-hero` — centered hero with eyebrow/title/subtitle/tier bar
- `.bb-tiers` / `.bb-tier` / `.bb-tier-label` / `.bb-tier-pct` / `.bb-tier-arrow` — discount bar
- `.bb-steps` / `.bb-step` / `.bb-step--locked` / `.bb-step--coming-soon` — step containers
- `.bb-step-hd` / `.bb-step-num` / `.bb-step-title` / `.bb-step-meta` — step header
- `.bb-vnav` / `.bb-vnav-btn` / `.bb-vnav-count` — ‹ N/M › navigator
- `.bb-sel-badge` — green "Selected ✓" chip in step header
- `.bb-mcard` — 2-column grid (image | controls), collapses to 1-col at ≤820px
- `.bb-mcard-img-col` — image box with `aspect-ratio: 4/3`, `object-fit: contain`
- `.bb-mcard-img-col .heart-btn` — overlaid absolute heart button (top-right of image)
- `.bb-mcard-info` — flex column of controls
- `.bb-mcard-collection` / `.bb-mcard-name` / `.bb-mcard-price` — product identity
- `.bb-picker-row` / `.bb-picker-lbl` — label + control row layout
- `.bb-size-chips` — wrapping flex for `.model-card-size-btn` chips (reuses collection page class)
- `.bb-swatches-wrap` / `.bb-swatches` / `.bb-swatch` — swatch circles (26px, chip photo or hex)
- `.bb-finish-name` — italic color name that updates next to swatches
- `.bb-view-link` — subtle "View product page ›" text link
- `.bb-select-btn` — full-width Select button; `.is-selected` = green "Selected ✓"
- `.bb-locked-msg` — centered lock icon + text when step is disabled
- `.bb-coming-soon-card` — dashed border card for Step 4 (Faucet)
- `.bb-summary` — sticky bottom bar
- `.bb-sum-*` — summary row/cell classes
- `.bb-cart-btn` / `.bb-cart-note` — Add to Cart button + disclaimer

---

### 8. Key Assumptions & Potential Failure Points

| Assumption | Risk | How to detect |
|---|---|---|
| `product_type = 'Cabinet Only'` matches all JM vanity cabinet SKUs | If importer uses a different value, Step 1 returns zero products | `SELECT DISTINCT product_type FROM products WHERE brand='James Martin Vanities' AND category_id IN (SELECT id FROM categories WHERE slug='vanities')` |
| Tops live in `c.slug = 'vanity-tops'` | If importeer maps to different slug, Step 2 empty | `SELECT DISTINCT c.slug FROM products p JOIN categories c ON c.id=p.category_id WHERE p.brand='James Martin Vanities' AND p.product_type LIKE '%Quartz%'` |
| Mirrors in `c.slug = 'accessories'` OR `'mirrors'` | Wrong slug → Step 3 empty | `SELECT DISTINCT c.slug, p.product_type FROM products p JOIN categories c ON c.id=p.category_id WHERE p.brand='James Martin Vanities' AND p.product_type LIKE '%Mirror%'` |
| JM Sample products at `category_id = 10` | category_id might differ; chip_image NULLs everywhere | `SELECT id, name FROM categories WHERE id=10` |
| Sample products matched by exact `color` string | Minor naming inconsistency → NULL chip_image (falls back to hex, still works) | `SELECT DISTINCT s.color FROM products s WHERE s.category_id=10 AND s.brand='James Martin Vanities' LIMIT 20` — compare to regular product color values |
| Top width matching uses exact `width_in` float equality | Floating-point drift (e.g. 36.0 vs 36) could cause tops to not match cabinet | Fixed with `parseFloat()` on both sides in `activeTops()` |
| `POST /cart/add` accepts `original_price` and `bundle_discount_pct` fields | Cart controller may not store these — bundle context lost in cart | Verify `src/controllers/cartController.js` reads and stores these fields |
| Cabinet must be selected before Top step unlocks | This is intentional UX — no bypass needed | N/A |

---

### 9. What Is NOT Yet Done

- **Faucet step** is a "Coming Soon" placeholder. When JM faucets are imported, Step 4 needs a real query added to bundleController, mirror/cabinet viewer logic wired up, and `itemCount()` updated to include `state.faucet`.
- **Homepage bundle teaser section** (`#42` in task list) — the `.bt-*` CSS exists but the homepage section (index.ejs) has not been added yet.
- **No server-side validation** on the cart add payload. A malicious user could POST arbitrary prices. The cart endpoint should re-verify discount eligibility server-side (check that the combination of product IDs legitimately earns the stated bundle_discount_pct).
- **No persistence of bundle state** across page reloads. If the user leaves and returns, their selections are lost. Future: save to `localStorage` or a session key.
- **No analytics events** on step completion or cart add. Consider adding `gtag('event', 'bundle_step_complete', ...)` calls.

---
*End of brief*
