# BVO Change Log Brief
*Last updated: 2026-07-16*

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
*End of brief*
