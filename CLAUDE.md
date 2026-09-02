# BVO Node.js — Session Rules (Auto-loaded by Claude)

> **READ THIS FIRST every session.** Also read:
> - `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO_AUDIT_BRIEF.md` — full rules & architecture
> - `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js/CHANGE_LOG_BRIEF.md` — recent changes
> - `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js/SHIPPING_WWEX_BRIEF.md` — **MANDATORY if touching shipping** (wwexService, shippingController, admin/shipping/)

---

## ⛔ NON-NEGOTIABLE PROCESS RULES

1. **Never make a code change before the user approves it.** Present what you plan to do and wait for explicit "go ahead / yes / proceed."
2. **Never assume what the user wants.** Ask. Do not infer intent from prior sessions or partial context.
3. **Always provide git push commands** in a copyable code block. Never push silently.
4. **Scope discipline** — only touch files required by the current task. Do not "improve" adjacent code while fixing something else.
5. **CSS bundle workflow** — two separate pipelines. Do not mix them.

   **PUBLIC pages** — `site-bundle.css`, linked in `views/layouts/main.ejs`:
   - Source files: `public/css/brand.css`, `site.css`, `site2.css` — **site4.css is NOT one of them**
   - After any edit, rebuild: `cd "BVO Node.js/public/css" && cat brand.css site.css site2.css > site-bundle.css`
   - Bump `?v=N` on `site-bundle.css` in `main.ejs`. Current version: `v5` (verified against `main.ejs` line 86 on 2026-08-31 — that line is the single source of truth; if it and the Architecture table disagree, `main.ejs` wins).

   **ADMIN pages** — `site4.css`, linked directly in `views/layouts/admin.ejs`:
   - Edit `public/css/site4.css` and bump its own `?v=N` in `admin.ejs`. Current: `v2`.
   - **No rebuild needed.** It is not concatenated into anything.

   ⚠️ **CORRECTED 2026-08-31.** This rule previously said to `cat` site4.css into
   the bundle, and the comment in `main.ejs` said the same. Both were wrong and
   contradicted the Admin UI Component Standard section further down this file,
   which correctly states site4.css is loaded separately. Following the old
   instruction shipped ~23KB of admin-only CSS to every public visitor and grew
   the bundle from 121KB to 137KB. site4.css content was never in the committed
   bundle — admin styling has always come from the `admin.ejs` link.

   `site3.css` is in neither bundle — it loads per-page via the `<%- style %>` slot. Current version: `v16`.
   - `site3.css` is NOT in the bundle — it loads per-page via the `<%- style %>` slot. Current version: `v16`.

---

## ⛔ EJS LAYOUT RULE — NEVER VIOLATE

**Admin templates must NOT call `<%- layout('layouts/admin') %>`.** The layout is set by the controller via `...LAYOUT` spread into `res.render()`. Calling `layout()` inside the template overwrites the express-ejs-layouts injected function with the string `'layouts/admin'`, causing `TypeError: layout is not a function` at runtime.

**Correct pattern — controller:**
```js
const LAYOUT = { layout: 'layouts/admin' };
res.render('pages/admin/some/view', { ...LAYOUT, activePage: 'x', pageTitle: 'X', flash: null, ...data });
```

**Correct pattern — template:**
```ejs
<%# NO layout() call here — layout is set by the controller %>
<div class="admin-page-header">
  ...
</div>
```

**Wrong (breaks everything):**
```ejs
<%- layout('layouts/admin') %>   ← DELETE THIS LINE
```

This applies to ALL admin templates. Public templates use the default `layouts/main` set in `server.js` — also no `layout()` call needed.

---

## ⛔ PERMANENT DESIGN RULES

### Rule 13 — Size Chips & Color Swatches (Universal)

Size chips and color swatches are **identical on ALL card types**:
- Collection product cards
- Model-group / vanity-model cards
- Homepage featured product cards
- Homepage carousel cards

**Layout (required everywhere):**
```
[FINISHES: label]  [● swatch] [● swatch] …
[SIZES: label]     [30] [36] [42] …
                   [ CTA button ]
```

**Locked CSS values (site2.css):**

| Rule | Value |
|---|---|
| Both labels font-size | `.68rem` |
| Both labels font-weight | `600` |
| Both labels min-width | `5rem` |
| Both labels color | `#9CA3AF` |
| Both labels text-transform | `uppercase` |
| Swatches row gap | `.35rem` |
| Swatches row margin-bottom | `.5rem` |
| First swatch margin-left | `-.5rem` (shifts swatches toward label) |
| Sizes row gap | `.35rem` |
| Sizes row margin-bottom | `.5rem` (space before CTA) |
| Size chip container margin-left | `-.55rem` (shifts chips toward label) |
| Size chip padding | `.13rem` (all sides) |
| Size chip font-size | `.68rem` |
| Size chip border-radius | `3px` |

**EJS rules:**
- `FINISHES:` and `SIZES:` labels are **always present** — never remove them
- Size chip button visible text: **no `"` inch mark**. Inch mark goes in `aria-label`/`title` only. **Exception: mega-menu nav size chips (`header.ejs` line 64) intentionally keep the `"` in visible text.**
- **No chip cap** — show all sizes, no `+N more` overflow
- Size values must be `{label, key}` objects from `SIZE_BUCKETS` — never render raw `width_in`

---

## Architecture Quick Reference

| Concern | Location |
|---|---|
| Category slug canon | `BVO_AUDIT_BRIEF.md` Rule 12 |
| SIZE_BUCKETS | `src/config/sizeBuckets.js` |
| Color families + normalize() | `src/config/colorFamilies.js` |
| Collections controller | `src/controllers/collectionsController.js` |
| Home controller | `src/controllers/homeController.js` |
| Category model (findBySlug) | `src/models/Category.js` |
| CSS (all new rules go here) | `public/css/site2.css` (then rebuild bundle — see Rule 5) |
| CSS bundle | `public/css/site-bundle.css` (generated — do not edit directly) |
| CSS cache bust link | `views/layouts/main.ejs` (bump `site-bundle.css?v=N`) |
| Current CSS versions | site-bundle.css v5 (contains brand v3 + site v6 + site2 v51 + site4 v16), site3.css v16 |
| Current JS version | site.js v9 |
| rflposSync CAT_MAP | `src/services/rflposSync.js` lines 50-53 — maps to `bathroom-vanities` NOT `vanities` |

## Known Pending Issues (as of 2026-08-31)

- **rflposSync CAT_MAP** still maps vanity product types to slug `'vanities'` (retired). Must change to `'bathroom-vanities'`. See `src/services/rflposSync.js` lines 50–53.
- **header.ejs mega menu size chips** — still render `"` inch mark in visible text (line 64). Separate fix needed.
- **Task #12** — nested form bug on category-edit admin page. Committed as `e2840b6`, push verification pending.
- **WWEX — Carrier-specific confirm rules (RL Carriers)** — SpeedShip shows a carrier-specific popup/acknowledgment when RL Carriers is selected. Our Step 3 confirm page is generic and does not implement these per-carrier requirements. User shared a screenshot in a prior session that was lost to session compaction. Must re-share screenshot before this can be implemented. See `SHIPPING_WWEX_BRIEF.md` → "Known Pending Issues" for full details. Do NOT guess at RL's requirements.
- **WWEX — BOL number not yet tested live** — booking fixes were committed 2026-08-31 (commit `8010806`) but not yet tested against live WWEX API. After deploy + pm2 restart, rate-shop a real LTL shipment and check server logs per test steps in `SHIPPING_WWEX_BRIEF.md`.

### ✅ Resolved (no longer pending)
- **vanity-models collection shows 0 results** — FIXED. `mgProductCatId` now resolved via `Category.findBySlug('bathroom-vanities')` in `collectionsController.js` lines 113–115. Not a pending issue.

---

## ⚠️ Taxonomy Overhaul — Approved, Implementation Pending

**Decision locked July 2026.** All implementation steps need approval before each code change.

### New Canonical `product_type` Values (bathroom-vanities products only)

| Old value | New value | Trigger |
|---|---|---|
| `'Single Sink'` | `'Single Sink Vanity With Top'` | JM: Vanities/Vanity + sink_count=1 |
| `'Double Sink'` | `'Double Sink Vanity With Top'` | JM: Vanities/Vanity + sink_count=2 |
| `'Cabinet Only'` (single) | `'Single Sink Cabinet Only'` | JM: Vanities/Cabinet or Cabinet/Cabinet + "Single" in name |
| `'Cabinet Only'` (double) | `'Double Sink Cabinet Only'` | JM: Vanities/Cabinet or Cabinet/Cabinet + "Double" in name |

### New Display Category Slugs

| Slug | Display Name | display_mode | Auto-filter applied |
|---|---|---|---|
| `bathroom-vanities-with-tops` | Bathroom Vanities With Tops | `model-group` | `product_type IN ('Single Sink Vanity With Top', 'Double Sink Vanity With Top')` |
| `bathroom-vanity-cabinets` | Bathroom Vanity Cabinets | `model-group` | `product_type IN ('Single Sink Cabinet Only', 'Double Sink Cabinet Only')` |

Products physically remain in `bathroom-vanities` (category_id=1). These are routing/display categories.

### JM Importer Root Bug

`PRODUCT_CATEGORY_MAP` has `'vanity'` (singular) but the JM feed says `'Vanities'` (plural — all 4,473 Vanities-category rows). Result: ALL Vanities products fall through to `PRODUCT_TYPE_MAP`, where `Product Type='Cabinet'` → Storage (category 6). Cabinet Only SKUs end up in wrong category with `product_type=NULL`.

### Implementation Checklist (get approval before each step)

1. [ ] **DB — Add new categories** (phpMyAdmin): `bathroom-vanities-with-tops` + `bathroom-vanity-cabinets`, `display_mode='model-group'`
2. [ ] **DB — UPDATE product_type values**: existing Single Sink → Single Sink Vanity With Top, Double Sink → Double Sink Vanity With Top
3. [ ] **DB — Fix Cabinet Only rows**: move from Storage → bathroom-vanities, set Single/Double Sink Cabinet Only
4. [ ] **Importer fix** (`importJamesMartinFeed.js`): correct PRODUCT_CATEGORY_MAP (`'vanities'` plural), new 4-value product_type assignment logic
5. [ ] **collectionsController.js**: (a) handle new slug → auto-inject mgActiveTypes; (b) fix `mgCsRows` to filter by `product_type` when `mgActiveTypes.length > 0`
6. [ ] **bundleController.js**: update `getCabinets()` query to `product_type IN ('Single Sink Cabinet Only', 'Double Sink Cabinet Only')`
7. [ ] **themeSettings.js defaults**: update megamenu links to new slugs/params
8. [ ] **collection.ejs**: update sidebar labels + `_mgTypeLabel` map
9. [ ] **Admin → Theme Editor → Navigation**: user must update live megamenu URLs manually (DB overrides defaults)
10. [ ] **Re-import JM feed** OR run targeted SQL to fix remaining NULL product_type rows
11. [ ] **Tops slug rename** — `vanity-tops` → `bathroom-vanity-tops`, Display Name → "Bathroom Vanity Tops". Code updated July 2026. DB UPDATE + DB name change required (see slug rename scripts).


---

## Admin UI Component Standard

**Rule: every admin view must use the unified component system below. Never use `admin-btn`, `admin-table`, `admin-input`, `admin-select`, `admin-filter-bar`, `admin-page-header`, `admin-link`, `admin-textarea`, or `admin-label` — these are undefined/deprecated. Any new admin page that introduces one of these classes will break the visual consistency.**

### Page structure

```ejs
<!-- Toolbar (always first, always adm-toolbar) -->
<div class="adm-toolbar">
  <!-- Option A: simple title -->
  <span class="adm-toolbar-title">Page Title</span>

  <!-- Option B: back link + title (detail/edit pages) -->
  <div class="adm-back-wrap">
    <a href="/admin/..." class="adm-back-link">← Section</a>
    <span class="adm-toolbar-title">Page or Record Title</span>
  </div>

  <!-- Centre: search/filter form -->
  <form class="adm-search-form" method="GET" action="...">
    <input type="text" class="adm-search-input" name="q" placeholder="Search…">
    <select class="adm-search-select" name="status">...</select>
    <button class="btn btn-primary" type="submit">Search</button>
    <a href="..." class="btn btn-outline">Clear</a>
  </form>

  <!-- Right: action buttons -->
  <div style="display:flex;gap:8px;flex-shrink:0">
    <a href="..." class="btn btn-outline">Secondary</a>
    <a href="..." class="btn btn-primary">+ Add New</a>
  </div>
</div>
```

### Buttons

| Use | Class |
|-----|-------|
| Primary CTA (save, filter, confirm) | `btn btn-primary` |
| Secondary / ghost | `btn btn-outline` |
| Success / approve (green) | `btn btn-sage` |
| Danger / deny (red) | `btn btn-outline` + `style="color:#c53030;border-color:#c53030"` |
| Small inline (table rows) | add `btn-sm` modifier: `btn btn-primary btn-sm` |

### Tables

```ejs
<div class="adm-table-wrap">
  <table class="adm-table">
    <thead><tr><th>Col</th>…</tr></thead>
    <tbody>
      <% if (rows.length === 0) { %>
        <tr><td colspan="N" class="adm-empty" style="border-radius:0">No records found.</td></tr>
      <% } %>
      <% rows.forEach(r => { %>
        <tr>
          <td class="adm-meta">muted text</td>
          <td>normal cell</td>
        </tr>
      <% }) %>
    </tbody>
  </table>
</div>
<p class="adm-count">N records total</p>
```

### Pagination

```ejs
<div style="display:flex;gap:6px;margin-top:16px;flex-wrap:wrap">
  <% for (let i = 1; i <= pages; i++) { %>
    <a href="?page=<%= i %>" class="adm-page-btn <%= i === page ? 'active' : '' %>"><%= i %></a>
  <% } %>
</div>
```

### Form fields

```ejs
<label class="adm-label">Field Name</label>
<input  type="text"  class="adm-input"    placeholder="…">
<select              class="adm-search-select">…</select>
<textarea            class="adm-textarea" rows="5"></textarea>
```

### Cards (side panels, detail sections)

```ejs
<!-- admin-card and admin-card-title are defined and correct — keep using them -->
<div class="admin-card">
  <h3 class="admin-card-title">Section Title</h3>
  …content…
</div>
```

### Links inside tables / cards

Do not use `admin-link`. Use inline style:
- Table row primary link: `style="font-weight:700;color:var(--color-navy)"`
- External/tracking link: `style="color:var(--color-amber)"`
- Email link: `style="color:var(--color-amber)"`

### CSS location

All admin component CSS lives in **`public/css/site4.css`** (not the minified bundle). Add new admin component classes there only. site4.css is loaded via a separate `<link>` in `layouts/main.ejs` and is **not** minified — edit the source directly.

### KPI / reports pages

`kpi-grid`, `kpi-card`, `kpi-card--warn`, `kpi-card--ok`, `kpi-label`, `kpi-value`, `kpi-sub`, `report-section-title`, `reason-bar`, `reason-fill`, `reason-label`, `reason-track`, `reason-count` are all defined in site4.css. Use them as-is.

### RAG status system

`rag-summary`, `rag-badge`, `rag-dot`, `rag-pill`, `order-row`, `order-status`, and their `--red/--yellow/--green/--grey` variants are defined in site4.css. Use them as-is.
