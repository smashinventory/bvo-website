# BVO Node.js — Session Rules (Auto-loaded by Claude)

> **READ THIS FIRST every session.** Also read:
> - `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO_AUDIT_BRIEF.md` — full rules & architecture
> - `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js/CHANGE_LOG_BRIEF.md` — recent changes

---

## ⛔ NON-NEGOTIABLE PROCESS RULES

1. **Never make a code change before the user approves it.** Present what you plan to do and wait for explicit "go ahead / yes / proceed."
2. **Never assume what the user wants.** Ask. Do not infer intent from prior sessions or partial context.
3. **Always provide git push commands** in a copyable code block. Never push silently.
4. **Scope discipline** — only touch files required by the current task. Do not "improve" adjacent code while fixing something else.
5. **CSS bundle workflow** — CSS is now served as a single bundle. Rules:
   - Edit source files: `public/css/brand.css`, `site.css`, `site2.css`, `site4.css`
   - After any edit, rebuild the bundle: `cd "BVO Node.js/public/css" && cat brand.css site.css site2.css site4.css > site-bundle.css`
   - Bump `?v=N` on `site-bundle.css` in `views/layouts/main.ejs` to bust Hostinger CDN cache. Current version: `v1`.
   - `site3.css` is NOT in the bundle — it loads per-page via the `<%- style %>` slot. Current version: `v16`.

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
| Current CSS versions | site-bundle.css v4 (contains brand v3 + site v6 + site2 v50 + site4 v16), site3.css v16 |
| Current JS version | site.js v7 |
| rflposSync CAT_MAP | `src/services/rflposSync.js` lines 50-53 — maps to `bathroom-vanities` NOT `vanities` |

## Known Pending Issues (as of 2026-07-31)

- **rflposSync CAT_MAP** still maps vanity product types to slug `'vanities'` (retired). Must change to `'bathroom-vanities'`. See `src/services/rflposSync.js` lines 50–53.
- **header.ejs mega menu size chips** — still render `"` inch mark in visible text (line 64). Separate fix needed.
- **Task #12** — nested form bug on category-edit admin page. Committed as `e2840b6`, push verification pending.

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
