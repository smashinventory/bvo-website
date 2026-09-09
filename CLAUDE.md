# BVO Node.js — Session Rules (Auto-loaded by Claude)

> **READ THIS FIRST every session.** Also read:
> - `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO_AUDIT_BRIEF.md` — full rules & architecture. **Includes the LIVE DATABASE INVENTORY — all 41 tables, and the 16 that have NO migration file. `database/migrations/` is a partial record of the schema. Never conclude a table does not exist because there is no CREATE for it.**
> - `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO_BRAND_ONBOARDING_PLAYBOOK.md` — **MANDATORY before loading any brand into BVO** (Atlanta Vanity, Nearmé, or any future supplier). 9 phases, 16 numbered traps, and the Cloudinary image and manual import run procedures. Written after the ER Vanities load; every trap in it cost real time once already.
> - `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js/CHANGE_LOG_BRIEF.md` — recent changes
> - `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js/SHIPPING_WWEX_BRIEF.md` — **MANDATORY if touching shipping** (wwexService, shippingController, admin/shipping/)

---

## ⛔ BRAND CANON — ER VANITIES (rebrand of Ethan Roth)

**Decided 2026-09-05 by Sam. `Ethan Roth` is RETIRED as a BVO brand value.**

The canonical BVO `brand` string is **`ER Vanities`**. Any code, query, migration
or document still comparing against `'Ethan Roth'` is stale.

| System | Brand value | Why |
|---|---|---|
| BVO `products.brand` | `ER Vanities` | Canonical |
| BVO `collections.brand` | `ER Vanities` | Canonical |
| RFLPos brand table | `Ethan Roth` (id 26), `Ethan Roth Old SKUs` (id 630) | **Read-only — never write to RFLPos.** The sync MAPS this to `ER Vanities` on the way in, per Rule 8: importers absorb vendor variation, downstream code sees one taxonomy. |

**Two traps:**

1. **Silent breakage.** `enrich_bvo_v7.py` branches on `brand_val == 'Ethan Roth'`
   (lines 486, 495) to set RFL cabinet material and attributes. When the DB value
   changes, that comparison simply stops matching — no error, no warning, the
   attributes just quietly stop being written. Change the script in the same pass
   as the data, never after.
2. **`brand` is not the product name.** The `brand` column is what filters and
   feeds read. Product names and long_desc text containing the literal words
   "Ethan Roth" are customer-facing copy and a separate decision — do not
   find-and-replace them into the brand migration.

---

## ⛔ ER VANITIES — SETTLED FACTS (do not re-flag)

Confirmed 2026-09-05 with Sam. Each of these looks like a data error on first
inspection and is not. Re-investigating them wastes a session.

### 1. London has no Left-drawer model

`London-35.5R-DOAK-MB` and `London-35.5R-WH-BN` have no `-35.5L-` sibling.
**This is by design.** Kensington and Windsor offer both hands; London does not.
An L/R pairing audit will report these as incomplete pairs — that report is
wrong, not the data.

### 2. Size codes: all ER sizes carry a decimal

The canonical set is **23.5, 29.5, 35.5, 41.5, 47.5, 59.5, 71.5** — no
exceptions. Four SKUs were missing the decimal and were corrected on
2026-09-05:

| Was | Now |
|---|---|
| `Kensington-59S-WH-BN` | `Kensington-59.5S-WH-BN` |
| `Windsor-59D-NVBLU-BG` | `Windsor-59.5D-NVBLU-BG` |
| `London-29-WH-BN` | `London-29.5-WH-BN` |
| `Oxford-47-CAMGRN-BG` | `Oxford-47.5-CAMGRN-BG` |

RFLPos still stores the old strings in its own product NAMES. That is correct
and read-only. The sync key is `rflpos_item_id` (PR0989, PR1016, PR0995,
PR1029), which never contained a size and is unaffected.

### 3. Seven Cloudinary public_ids read 59s/59d, not 60s/60d

```
bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-59s-bright-white-pr0989-{1,2,3}
bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-59d-navy-blue-pr1016-{1,2,3,4}
```

Cause: the nominal size ladder maps 29.5→30, 47.5→48, 59.5→60, but the four
SKUs above were missing their decimal at the time the map was built, and `59`
had no ladder entry so it passed through raw. London and Oxford laddered
correctly; these two did not.

**Deliberately NOT fixed** (Sam, 2026-09-05). public_ids are frozen by
`overwrite=false`, so correcting them means delete-then-reupload, and the SEO
gain across seven images does not justify the cycle. Every other public_id in
the library uses the nominal ladder correctly — do not "fix" these to match and
do not treat them as evidence the ladder is broken.

### 4. L/R photography — resolved 2026-09-05

Three of eleven L/R pairs were found sharing identical photos. Resolved as follows.

**Windsor 35.5 Navy Blue — RESOLVED.** The `Atlanta_Solo_Closed.png` /
`Atlanta_Solo_Open.png` files (2560x1800) show **RIGHT** drawers, confirmed by
Sam. They now belong to `PR1010` (Windsor-35.5R-NVBLU-BG) alone.
`PR1012` (Windsor-35.5L-NVBLU-BG) was only ever borrowing its sibling's photo
and now has **no imagery** — the only SKU in the catalogue with none.
The Cloudinary public_ids are side-neutral (`shared-windsor-navy-blue-6/7`), so
nothing frozen had to be re-uploaded; only the map assignment changed.

**Windsor 35.5 Bright White — no action.** Confirmed correct by Sam. The two
SKUs legitimately share the four files (`1_..jpg` through `4_..jpg`).

**Kensington 29.5 Bright White — open.** `PR0972` (Left) and `PR0969` (Right)
share files named `Kensington-30R-WH*`, i.e. the RIGHT cabinet. Shopify lists
only the Right version, so there is no correct Left image to swap in. Still on
the reshoot list.

### 5. GVS listing state for Windsor Navy (as of 2026-09-05)

The GVS Shopify listing
`windsor-35-5-left-drawers-in-all-wood-vanity-in-navy-blue-cabinet-only`
was titled **Left** while showing **Right** drawers. Sam duplicated it to create
a correct Right listing with that image. The original Left listing still carries
the wrong image and will be corrected later.

**A Windsor 35.5 Left in Navy Blue listing will be needed at a later date** —
the product exists (`PR1012` / `Windsor-35.5L-NVBLU-BG`), it simply has no
photography and no correct GVS listing yet. Do not treat it as a phantom SKU or
propose deleting it.

### 6. Kensington bridge drawers are card-only, deliberately

`Kensington-BridgeCabinet-WH-BN` and `-MG-BN` have four Shopify images between
them at 523-538 px square. That is the native size — Shopify's `?width=` caps
but never upscales, and the store holds no larger master (verified against the
product JSON). They are uploaded anyway and flagged `CARD-ONLY-<w>x<h>` in
`ERV_cloudinary_map.csv`: a soft card beats an empty one. **Serve them at card
size with zoom disabled.** Do not run them through an AI upscaler — that invents
detail that was never in the product photo. On the reshoot list.

---

## ⛔ ER VANITIES — COMPONENT DIMENSIONS (bridges & linen tower)

Supplied directly by Sam 2026-09-05. **Do not infer these from the vanities they
sit beside** — that inference was made once and was wrong on every value.

| SKU | W | D | H |
|---|---|---|---|
| `Bristol-Bridge3DE-NWA-BG` | 24 | 18 | 20 |
| `Bristol-BridgeMUCounter-NWA-BG` | 24 | 18 | 8 |
| `Kensington-BridgeCabinet-MG-BN` | 23 | 18 | 8 |
| `Kensington-BridgeCabinet-WH-BN` | 23 | 18 | 8 |
| `Windsor-LC-WH-BN` (linen tower) | 24 | 18 | 72 |

Vanities are 33.75 H x 21.625 D. **Components share neither number.** They are
18" deep, and the bridges are 8-20" tall because they span the gap between two
vanities rather than standing at counter height. A make-up bridge is 8" tall —
it is a low counter section, not a cabinet.

**The "84 in." trap.** The two Bristol bridge listings on GVS are titled
"Bristol 84 in. (3 Drawer Bridge)…". **84 is the assembled RUN width** — two
30" vanities plus the 24" bridge — not the unit being sold. BVO stores the unit
at 24". If a future import reads the width out of that Shopify title it will be
wrong by 60 inches. The GVS titles are the ones that need fixing, not BVO.

Related copy bug, fixed 2026-09-05: the nominal size ladder had no entry for
`Bridge3DE`, `BridgeMUCounter`, `BridgeCabinet` or `LC`, so short_desc and
meta_title printed the raw code with an inch mark — "Bristol Bridge3DE″ bathroom
vanity" — and called every component a bathroom vanity. Any new component code
must be added to the ladder or it will reproduce this.

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

## ER Vanities — MERCHANDISING FOLLOW-UPS (logged 2026-09-05 by Sam)

Queued while the ER Vanities catalogue load was being finalised. None of these
block the load; all of them are needed before ER is properly discoverable.

### 1. Homepage — ER Vanities section
No ER presence on the homepage. Needs its own section, in the pattern of the
existing collection/model card rows. Rule 13 (universal size chips and colour
swatches) applies to any new card type — see the design rules above.

### 2. Vanities mega menu — "Shop by Brand"
The mega menu has no brand axis. Add **Shop by Brand** listing **ER Vanities**
and **James Martin**. Menu links live in the DB (Theme Editor → Navigation),
which OVERRIDES the `themeSettings.js` defaults — so changing the defaults alone
does nothing to the live site. Edit both.

### 3 & 4. Bundle builder — label it, do not re-engineer it

Sam's concern: a customer building an ER base + James Martin top. **JM tops are
not compatible with ER bases.**

**Already prevented, structurally.** `src/controllers/bundleController.js` line 7
sets `JM_BRAND = 'James Martin Vanities'`, and every step query filters
`p.brand = ?` with it — cabinets (line 82), tops (111), mirrors (131), chips (36).
ER products load as `brand = 'ER Vanities'`, so they cannot appear in any step.

Second, independent barrier: the stone-top rule at line 65 admits only cabinets
with `depth_in >= 22.5`. **Every ER cabinet is 21.625" deep**, so they fail that
too.

Faucets are the deliberate exception — no brand filter (line 144), because JM
vanities use standard 8" widespread holes and any brand fits.

**So the work is a LABEL, not a guard.** The builder is silently JM-only; say so
in the UI. If ER ever gets its own bundle builder, note that the 22.5" depth
threshold is JM-SPECIFIC (line 65 says so) and must not be reused for ER.

⚠️ **The trap to avoid:** "make the bundle builder multi-brand" would remove the
brand filter and create exactly the incompatible pairing Sam is trying to
prevent. Any change here must keep cabinet, top and mirror brand-locked.

---

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
