# BVO — Codebase Audit Brief

> The numbered Rules (8, 9, 10, 11, 13, 14), architecture, the category table and the live DB inventory. Open this before any structural work.
## BathroomVanitiesOutlet.com — Node.js/Express/EJS storefront

> **Purpose:** Persistent audit log — never lose context again.
> Read this at the start of every session alongside `BVO_ISSUE1_BRIEF.md`.
> Path: `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO_AUDIT_BRIEF.md`

---

## ⚠️ RULES — NEVER OVERRIDE (same as PROJECT_BRIEF.md)

| Rule | Detail |
|---|---|
| RFLPOS DB | READ-ONLY for sync — NEVER write, modify, or delete |
| Credentials | Never re-display sensitive credentials in chat |
| Logos | NEVER regenerate. Primary = BVOLOGOSQ_512.png, Round = BVOLOGOCIRCLE_2000.png |
| Navy #182840 | INK/TEXT ONLY — never as background |
| Git prefix | Always: `cd "/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js" &&` |
| Rule 1 | Read entire brief before any action; ask if assumption needed — never guess |
| Rule 2 | No action without approval — present findings first, wait for "go ahead" |
| Rule 3 | Forbidden from making changes based on assumptions |
| Rule 4 | Always provide exact commands in copyable code blocks |
| Rule 5 | Three color fields must always stay in sync: products.color, products.color_family, cabinet_finish EAV |
| Rule 6 | Scope discipline — only do what current task requires |
| Rule 7 | Run post-import verification queries after every import |
| Rule 8 | ONE internal taxonomy — importers absorb all vendor variation; downstream code never handles vendor formats |
| Rule 9 | Every file, function, and non-obvious block must have a comment explaining its purpose and connections |
| Rule 10 | ONE canonical DB field per fact — `width_in` for size, `color`/`color_family` for cabinet color, EAV `hardware_finish` for hw. No code reads the same fact from two sources |
| Rule 11 | CSS goes in `site2.css` first — `site.css` is at the Hostinger CDN 80KB hard limit. Any new CSS blocks must be added to `site2.css`. If `site2.css` also approaches 80KB, create `site3.css` and link it in `main.ejs`. Non-ASCII characters in CSS `content:` properties must use Unicode escapes (e.g. `'\2713'` not `'✓'`) to avoid encoding failures. |
| Rule 12 | **Canonical category slugs — NEVER change without updating ALL references.** Vanities = `bathroom-vanities`, Mirrors = `bathroom-mirrors`, Faucets = `faucets`, Accessories = `accessories`, Lighting = `lighting`, Storage = `storage`, Vanity Tops = `bathroom-vanity-tops`, Samples = `samples`, Vanity Models = `vanity-models`, Vanities With Tops = `bathroom-vanities-with-tops`, Vanity Cabinets = `bathroom-vanity-cabinets`, Sale = `sale` (virtual). Retired slugs: `vanities` (caused flip-flop bugs), `mirrors` (→ `bathroom-mirrors`), `vanity-tops` (→ `bathroom-vanity-tops`). Any admin editing category slugs must be warned. |
| Rule 13 | **Size chips and color swatches are UNIVERSAL — identical layout on ALL card types** (collection product cards, model-group/vanity-model cards, homepage featured cards, homepage carousel cards). No card type gets special treatment. See "Rule 13 — Swatch & Chip Standards" section below for exact values. |
| Rule 14 | **No gate on this project can validate SQL.** Every gate is static — it parses JavaScript, matches strings, and runs pure functions. None connects to MySQL. A query that is valid JS, plausible SQL and *rejected by the server* passes every gate written here. Any query that compares or combines text columns from two different tables must be executed against the real database before it ships. See the section below. |

---

### Rule 11 — CSS File Size Limit (Hostinger CDN)

Hostinger's CDN has a hard limit of ~80KB per static file. `site.css` was split into `site.css` + `site2.css` when it first hit this limit (commit `8969a87`). Both files are linked in `views/layouts/main.ejs`.

**Current sizes (July 2026):**
- `site.css` — ~78KB after removing size-chip block. Effectively full — do not add new CSS here.
- `site2.css` — ~28KB. All new CSS goes here until it also approaches 80KB.

**What happens when the limit is hit:** The CDN silently truncates the file at the byte boundary. Styles that live near or past the limit simply don't load — no error, no warning. Symptoms look like "CSS not applying" even though the file on disk is correct and the deployment succeeded. This is easy to misdiagnose as a caching issue or code bug.

**Diagnosis checklist if CSS appears not to load after a push:**
1. Check `wc -c public/css/site.css` and `wc -c public/css/site2.css` — if either is ≥ 80,000 bytes, the CDN is truncating it.
2. Move any recently added CSS blocks to the other file (or create `site3.css`).
3. Use `'\2713'` (Unicode escape) not `'✓'` in CSS `content:` properties — non-ASCII in CSS can cause parse failures that silently drop all rules from that point onward.

**Future overflow plan:** If `site2.css` approaches 80KB, create `public/css/site3.css` and add `<link rel="stylesheet" href="/css/site3.css">` to `views/layouts/main.ejs` immediately after the `site2.css` link.

## Architecture Rules (approved July 2026)

### Rule 8 — One Internal Taxonomy

The import layer is the only place that knows about vendor formats. Its job is to absorb all vendor variation — different column names, different ways of expressing size (36", 36 in, 36 inches), different color naming conventions, different sheet structures — and translate everything into our internal schema before it touches the database.

Once data is written to our DB, there is exactly one canonical home for each piece of information:
- Vanity width → `products.width_in` (decimal, always)
- Cabinet color → `products.color` + `products.color_family` (always)
- Hardware finish → EAV `hardware_finish` value_text (always)

**No controller, model, view, or filter query ever deals with vendor format variation.** If downstream code needs to handle two formats for the same field, that is a signal the import mapping is incomplete — fix the importer, not the downstream code.

We do not add DB columns or EAV keys just because a vendor provides a field in a particular way. We map vendor fields into fields that already exist in our schema. Different importers (CSV admin import, JM feed import, future vendor feeds) may have different mapping conventions for their respective sheet formats — that is fine and expected. What is not acceptable is those importers writing to different DB fields for the same logical data.

**Violation example (now corrected):** JM feed wrote width to EAV `size_in`; CSV import wrote width to `products.width_in`. Two homes for the same fact. Fix: JM importer writes to `products.width_in`. EAV `size_in` removed as a size data path.

### Rule 10 — Canonical Data Sources (One True Source Per Fact)

Every piece of product data has exactly one authoritative DB field. No code — controller, model, view, importer, or filter query — may read the same fact from two different places.

| Data | Canonical source | Prohibited alternatives |
|---|---|---|
| Vanity width / size | `products.width_in` (decimal inches) | EAV `size_in`, SKU parsing, any text field |
| Cabinet color name | `products.color` (brand's exact name) | EAV `cabinet_finish`, SKU color code |
| Cabinet color family | `products.color_family` (normalized key) | Re-running `normalize()` at query time, EAV |
| Hardware finish | EAV `hardware_finish` value_text (raw) | `products` columns, SKU hardware code |
| Vanity type | `products.product_type` | EAV `vanity_type` (orphan — removed) |

**The filter sidebar size chips read `products.width_in` via `SIZE_BUCKETS` in `collectionsController.js`.** The bucket definitions and tolerance (±2") live in one place — `SIZE_BUCKETS` constant — and both the availability query (`Product.getAvailableWidths`) and the filter query (`Product.findByCategory`) derive from it. To change bucket ranges or tolerances, change `SIZE_BUCKETS` only.

**Violation signal:** If downstream code has to handle two formats for the same field, the importer is incomplete. Fix the importer, not the downstream code (Rule 8).

**Violation example (corrected July 2026):** JM feed wrote width to EAV `size_in`; the collection sidebar read from EAV; `homeController` read from `products.width_in`; `vanity-models` route read from EAV. Three paths for one fact. Fixed by: migrating all 4237 products to `products.width_in`, switching all reads to `width_in`, updating the JM importer to write `width_in`.

### Rule 9 — Code Must Be Self-Documenting

Every file must have a header comment explaining:
- What it is responsible for
- What it connects to (which routes, tables, or other files depend on it)

Every non-trivial function must have a comment explaining what it does and why key decisions were made.

Every non-obvious block of logic must have an inline comment. If a future developer would have to guess why something was written a certain way, it needs a comment.

**Why this matters:** `modelFamilies.js` had zero comments explaining its relationship to the rest of the system. It took significant investigation to confirm it was safe to delete. That cost should never be incurred again.

### Rule 13 — Swatch & Chip Standards (Universal — all card types)

Size chips and color swatches must look and behave identically on **every** card type in the codebase:
- Collection page — product cards
- Collection page — model-group (vanity-models) cards
- Homepage — featured product cards
- Homepage — carousel/model cards

**Layout structure (required on all cards):**
```
[FINISHES: label]  [● swatch] [● swatch] [● swatch] …
[SIZES: label]     [30] [36] [42] [48] …
                   [ Shop Now button ]
```
Both label + chip rows use a flex row with the label on the left (`min-width: 5rem`). The chips are shifted left toward the label by negative margin so visual alignment is tight.

**CSS values (canonical — site2.css):**

| Element | Property | Value |
|---|---|---|
| `.model-card-swatches-label`, `.model-card-sizes-label` | font-size | `.68rem` |
| both labels | font-weight | `600` |
| both labels | text-transform | `uppercase` |
| both labels | min-width | `5rem` |
| both labels | color | `#9CA3AF` |
| `.model-card-swatches` | gap | `.35rem` |
| `.model-card-swatches` | margin-bottom | `.5rem` |
| `.model-card-swatches .model-card-swatch:first-of-type` | margin-left | `-.5rem` (shifts swatches toward label) |
| `.model-card-sizes-row` | gap | `.35rem` |
| `.model-card-sizes-row` | margin-bottom | `.5rem` (space above CTA button) |
| `.model-card-size-chips` | margin-left | `-.55rem` (shifts chips toward label) |
| `.model-card-size-btn` | padding | `.13rem` (all sides) |
| `.model-card-size-btn` | font-size | `.68rem` |
| `.model-card-size-btn` | font-weight | `600` |
| `.model-card-size-btn` | border-radius | `3px` |

**EJS template rules (all card types):**
- Labels `FINISHES:` and `SIZES:` are **always present** — never remove them.
- Size chip button text: **no `"` inch mark** in visible text. The inch mark belongs only in `aria-label` and `title` attributes: `aria-label="<%= sz.label %>&quot; wide"`. **Exception: mega-menu nav size chips (`views/partials/header.ejs` line 64) intentionally keep the `"` in visible text — do not remove it.**
- All sizes shown — **no chip cap / +N overflow**. Show every size.
- Size values must be bucketed via `SIZE_BUCKETS` (from `src/config/sizeBuckets.js`) and stored as `{label, key}` objects. Never render raw `width_in` values on cards.

**Violation triggers:**
- Any card where "FINISHES:" or "SIZES:" label is missing
- Any card where chip text shows a `"` character
- Any card that caps chips at 5 and shows `+N more`
- Any card type where chip padding, label width, or gap differs from the table above
- Any new card type added to the site without matching this layout

---

### Rule 14 — Gates Cannot Validate SQL

Added 2026-09-16, after the colour-family work took the storefront down.

**What happened.** Commit `19161f0` shipped with nine executing gates, each one
negative-tested by deliberately breaking the thing it guarded. It added this to
`collectionsController.js`:

```sql
SELECT DISTINCT color_family FROM (
    SELECT p.color_family FROM products p WHERE ...
  UNION
    SELECT pav.value_text FROM product_attribute_values pav JOIN ...
) AS cf
```

`products.color_family` and `product_attribute_values.value_text` are declared
with different collations. MySQL refuses to combine them:

    Error: Illegal mix of collations for operation 'UNION'

`exports.show` threw for **every** `/collections/:slug`. Not the one page the
change was about — all of them.

**Why every gate passed.** The gates on this project do four things: run
`node --check`, match strings in source files, call pure functions and compare
the result, and render EJS templates. Not one of them opens a database
connection. The query was valid JavaScript inside a valid template literal and
read as correct SQL. There is no static check that could have known the two
columns disagree about collation, because that fact lives in the schema, not in
the code.

**This is a limit of the method, not a slip.** Gates verify that the code says
what it is supposed to say. They cannot verify that MySQL will accept it. Any
claim that a database change is "gated" should be read narrowly.

**The rule.** Before shipping a query that compares, joins or combines text
columns from two different tables — `UNION`, `IN (SELECT ...)`, `JOIN ... ON
a.text = b.text`, `GROUP BY` across a union — run it against the real database
first. phpMyAdmin is enough. If it cannot be run first, say so plainly rather
than describing the change as verified.

**Lower-risk shapes, when running it first is not possible:**

- Two separate queries merged in application code. No cross-column comparison
  happens, so collation is irrelevant. This is what the hotfix did.
- Comparing a column against a **literal or a placeholder** rather than another
  column. `WHERE value_text = ?` is fine; `WHERE value_text = color_family` is
  the risk.
- `COLLATE` works, but hard-codes into application code a collation the
  application has no way to know is correct, and breaks again when a column is
  redeclared. Prefer splitting the query.

**Related, same family of mistake:** the app DB user has **no grant on
`information_schema`** (`#1044`), and phpMyAdmin reports that denial against the
*next* statement — which makes an `ALTER` look refused when the verify `SELECT`
above it was the actual failure. Use `SHOW COLUMNS` / `SHOW INDEX`. Recorded in
`OPEN_ITEMS.md` after migration 023 and again after 026.

---

## BVO Category Registry (canonical — never change IDs or slugs)

| ID | Slug | Display Name | display_mode | Migration | Notes |
|---|---|---|---|---|---|
| 1 | `bathroom-vanities` | Bathroom Vanities | `list` | 001 | Physical home for ALL vanity products. product_type determines sub-type. |
| 2 | `bathroom-mirrors` | Bathroom Mirrors | `list` | 001 | Renamed from `mirrors` July 2026 — SEO overhaul |
| 3 | `faucets` | Faucets | `list` | 001 | |
| 4 | `accessories` | Accessories | `list` | 001 | Bench, Pull, Shelf, Knobs & Legs, Metal Base |
| 5 | `lighting` | Lighting | `list` | 001 | |
| 6 | `storage` | Storage | `list` | 001 | Hutch, Linen Cabinet, Side Cabinet, Storage Cabinet, Drawer Unit |
| 7 | `bathroom-vanity-tops` | Bathroom Vanity Tops | `list` | 010 | Renamed from `vanity-tops` July 2026 — SEO overhaul. Tops, Countertop Units, Backsplashes |
| 8 | `samples` | Samples | `list` | 014 | Metal Sample, Stone Sample, Wood Sample — finish/material swatches |
| — | `vanity-models` | All Vanity Models | `model-group` | existing | Browse all models regardless of type — sources from bathroom-vanities |
| — | `bathroom-vanities-with-tops` | Bathroom Vanities With Tops | `model-group` | **⏳ pending** | Auto-filters: `product_type IN ('Single Sink Vanity With Top', 'Double Sink Vanity With Top')` |
| — | `bathroom-vanity-cabinets` | Bathroom Vanity Cabinets | `model-group` | **⏳ pending** | Auto-filters: `product_type IN ('Single Sink Cabinet Only', 'Double Sink Cabinet Only')` |

**Note on display categories:** `vanity-models`, `bathroom-vanities-with-tops`, and `bathroom-vanity-cabinets` are routing/display categories — their `display_mode='model-group'` and their controller reads products from `bathroom-vanities` (category_id=1), filtered by `product_type`. Products are never moved out of `bathroom-vanities`.

**Complete schema file:** `bvo_schema_complete.sql` (outside git repo) — includes all 8 base categories.
**Migration 014 status:** SQL written (`data/migrations/014_samples_category.sql`) — must be run in phpMyAdmin on Hostinger.
**Taxonomy migration:** Two new display categories (`bathroom-vanities-with-tops`, `bathroom-vanity-cabinets`) to be added via phpMyAdmin as part of taxonomy overhaul. See Audit Fix #3.

---

## ⛔ LIVE DATABASE INVENTORY — 41 tables

**Source:** `u222311468_BVO_website.20260908172420.sql`, a full mysqldump taken
2026-09-08. Schema is authoritative. **Row counts and content are not** — this
dump predates migrations 014 and 015 (it still carries the migration-012
placeholder policy text and has no `footer-*` menus), so treat data as a
snapshot, not as current state.

### ⚠️ READ THIS BEFORE ASSUMING A TABLE DOES NOT EXIST

**16 of the 41 live tables have no `CREATE TABLE` anywhere in
`database/migrations/`.** They were created directly in phpMyAdmin, or by a
self-healing `CREATE TABLE IF NOT EXISTS` inside a controller, and were never
back-filled into a migration file.

```
app_settings            jmv_daily_movement      order_events
carrier_rules           jmv_dimensions          order_returns
color_mappings          jmv_snapshot_validity   product_videos
favorites               jmv_snapshots           sessions
model_groups            order_documents         shipments
vendor_purchase_orders
```

**`database/migrations/` is a partial record of the schema, not a complete
one. Absence of a migration proves nothing.** On 2026-09-08 this cost a
session: `email_templates` had no CREATE statement, was assumed not to exist,
and a migration was written to create and seed it. The table already held 9
live templates. `INSERT IGNORE` meant nothing was damaged, but the seeded
copy silently did nothing and the real templates stayed as they were.

If you cannot query the database, say so and ask. Do not infer the schema
from the migrations directory.

### The tables

Legend — **M** = has a CREATE in `database/migrations/`. Consumer column lists
the primary reader/writer.

| Table | M | Rows* | Purpose | Primary consumer |
|---|---|---|---|---|
| `products` | ✓ | 5,297 | Master catalogue, 95 columns | `Product.js` |
| `product_attribute_values` | ✓ | 176,257 | EAV — `attr_key`/`value_text`/`value_num` | `Product.js`, importers |
| `attribute_definitions` | ✓ | 50 | EAV key registry, drives filter sidebar | `collection.ejs` |
| `product_images` | ✓ | 57,152 | Gallery, `sort_order` = primary first | `Product.js` |
| `product_bullets` | ✓ | — | Feature bullets from JM feed | `importJamesMartinFeed.js` |
| `product_certifications` | ✓ | — | Cert claims from JM feed | `importJamesMartinFeed.js` |
| `product_components` | ✓ | — | Multi-box component rows | `importJamesMartinFeed.js` |
| `product_accessories` | ✓ | — | JM accessory cross-refs | `importJamesMartinFeed.js` |
| `product_documents` | ✓ | — | Spec sheets, use manuals | `productsController.js` |
| `product_shipping_boxes` | ✓ | — | Per-SKU carton dims — feeds LTL rating | `shippingController.js` |
| `product_videos` | ✗ | 2 | Product video embeds | `productsController.js` |
| `categories` | ✓ | 11 | Category registry (see table above) | `Category.js` |
| `collections` | ✓ | 64 | Collection records | *(name collides with `/collections/` URLs — verify before trusting a grep)* |
| `inventory` | ✓ | 5,210 | `qty_on_hand` per SKU | `Product.js` |
| `model_groups` | ✗ | 10 | Model-card overrides, keyed `(model, brand)` | `homeController.js`, `adminController.js` |
| `color_mappings` | ✗ | 10 | vendor colour → family key fallback | `colorFamilies.js` |
| **Orders / fulfilment** | | | | |
| `orders` | ✓ | 4 | 50 columns — payment, FraudLabs, UTM | `ordersController.js` |
| `order_items` | ✓ | 2 | Line items | `ordersController.js` |
| `order_events` | ✗ | 2 | Status-transition audit trail | `ordersController.js` |
| `order_returns` | ✗ | **0** | RMA workflow — never exercised | `returnsController.js` |
| `order_documents` | ✗ | **0** | BOL / packing list storage | `ordersController.js` |
| `shipments` | ✗ | 2 | 39 columns — WWEX booking + tracking | `shippingController.js` |
| `carrier_rules` | ✗ | 2 | Per-carrier confirm rules | `carrierRules.js` |
| `vendor_purchase_orders` | ✗ | **0** | PO to vendor — barely wired | `ordersController.js` |
| **Customers** | | | | |
| `customers` | ✓ | 2 | Accounts | `Customer.js` |
| `customer_addresses` | ✓ | **0** | **No code reads or writes it** | — |
| `favorites` | ✗ | 1 | Heart / wishlist | `accountController.js` |
| `sessions` | ✗ | — | express-mysql-session store | `server.js` |
| **CMS** | | | | |
| `pages` | ✓ | 16 | 6 CMS pages + 10 inspiration guides | `pagesController.js` |
| `blog_posts` | ✓ | **0** | Built, never used | `blogController.js` |
| `nav_menus` | ✓ | 2 | `main-menu`, `footer` *(pre-015 snapshot)* | `megaMenuData.js` |
| `nav_menu_items` | ✓ | 12 | Menu links | `megaMenuData.js` |
| `app_settings` | ✗ | 1 | Theme settings JSON blob | `themeSettings.js` |
| `email_templates` | ✗ | **9** | Transactional email copy — see warning above | `brevoService.js` |
| **JMV reporting** | | | | |
| `jmv_snapshots` | ✗ | 83,488 | Nightly SKU inventory snapshots | `jmvMovementRollup.js` |
| `jmv_daily_movement` | ✗ | 31,308 | Computed day-over-day deltas | `jmvReportsController.js` |
| `jmv_dimensions` | ✗ | 5,218 | SKU dimension cache for the reports | `jmvReportsController.js` |
| `jmv_snapshot_validity` | ✗ | 16 | Which snapshot dates are trustworthy | `jmvMovementRollup.js` |
| **Sync / import** | | | | |
| `rflpos_sync_log` | ✓ | 4 | RFLPos sync runs | `rflposSync.js` |
| `supplier_import_log` | ✓ | **0** | **No code reads or writes it** | — |
| `vendor_field_maps` | ✓ | **0** | **No code reads or writes it** | — |

\* Rows as of the 2026-09-08 dump.

### Dead or near-dead tables

`customer_addresses`, `supplier_import_log` and `vendor_field_maps` have **zero
references** anywhere in `src/` or `views/`. `vendor_purchase_orders` has one.
`blog_posts`, `order_returns` and `order_documents` are wired but have never
held a row. None of these are safe to drop without checking the shell scripts
at the domain root, which are outside this repo.

### Two migration files describe tables that do not exist live

`finish_colors` (dropped July 2026, Issue #4) and `product_attributes`
(superseded by `product_attribute_values` in migration 005). Both are expected.

---

## JM Feed → BVO Category Mapping

> **⚠️ Taxonomy overhaul in progress (July 2026).** The mapping below reflects the CORRECTED canonical values after the taxonomy fix. The current DB has old values (`'Single Sink'`, `'Double Sink'`, `'Cabinet Only'`). See Audit Fix #3 for the full migration plan.

**Feed structure:** JM Etail Products tab has TWO routing columns used in sequence:
1. `Product Category` column — broad JM grouping (`Vanities`, `Cabinet`, `General Products`, `Tops`)
2. `Product Type` column — JM sub-type (`Vanity`, `Cabinet`, `Mirror`, `Bench`, `Top`, etc.)

**File:** `src/jobs/importJamesMartinFeed.js`
**Primary routing:** `PRODUCT_CATEGORY_MAP` keyed on JM `Product Category` (lowercased)
**Fallback routing:** `PRODUCT_TYPE_MAP` keyed on JM `Product Type` (lowercased) — used when Product Category is `'general products'` or absent/unmapped

### JM Product Category × Product Type → BVO Mapping (canonical post-fix)

| JM `Product Category` | JM `Product Type` | Row count | BVO Category | BVO `product_type` stored |
|---|---|---|---|---|
| `Vanities` | `Vanity` | ~4,184 | 1 — bathroom-vanities | `'Single Sink Vanity With Top'` (sink_count=1) or `'Double Sink Vanity With Top'` (sink_count=2) |
| `Vanities` | `Cabinet` | ~289 | 1 — bathroom-vanities | `'Single Sink Cabinet Only'` or `'Double Sink Cabinet Only'` (from product name) |
| `Cabinet` | `Cabinet` | ~42 | 1 — bathroom-vanities | `'Single Sink Cabinet Only'` or `'Double Sink Cabinet Only'` (from product name) |
| `Vanities` | `Console` | — | 1 — bathroom-vanities | `null` (Boston, Addison, Athena components) |
| `Vanities` | `Console base` | — | 1 — bathroom-vanities | `null` |
| `Vanities` | `Floating console` | — | 1 — bathroom-vanities | `null` |
| `General Products` | `Mirror` | — | 2 — mirrors | `'Mirror'` |
| `General Products` | `Bench` | — | 4 — accessories | `'Bench'` |
| `General Products` | `Pull` | — | 4 — accessories | `'Pull'` |
| `General Products` | `Shelf` | — | 4 — accessories | `'Shelf'` |
| `General Products` | `Knobs & Legs` | — | 4 — accessories | `'Knobs & Legs'` |
| `General Products` | `Metal Base` | — | 4 — accessories | `'Metal Base'` |
| `General Products` | `Hutch` | — | 6 — storage | `'Hutch'` |
| `General Products` | `Linen Cabinet` | — | 6 — storage | `'Linen Cabinet'` |
| `General Products` | `Side Cabinet` | — | 6 — storage | `'Side Cabinet'` |
| `General Products` | `Storage Cabinet` | — | 6 — storage | `'Storage Cabinet'` |
| `General Products` | `Drawer Unit` | — | 6 — storage | `'Drawer Unit'` |
| `General Products` | `Backsplash` | — | 7 — vanity-tops | `'Backsplash'` |
| `General Products` | `Countertop Unit` | — | 7 — vanity-tops | `'Vanity Top'` |
| `Tops` | `Top` | — | 7 — vanity-tops | `'Vanity Top'` |
| `General Products` | `Metal Sample` | — | 8 — samples | `'Sample'` |
| `General Products` | `Stone Sample` | — | 8 — samples | `'Sample'` |
| `General Products` | `Wood Sample` | — | 8 — samples | `'Sample'` |

### Canonical `product_type` Values — Bathroom Vanities (category_id=1)

BVO canonical `products.product_type` values — derived in importer, NEVER copied from JM strings (Rule 8):

| BVO `product_type` | JM trigger | Display label (sidebar) | Megamenu URL |
|---|---|---|---|
| `'Single Sink Vanity With Top'` | Vanities/Vanity + sink_count=1 | "Single Sink Vanity With Top" | `/collections/bathroom-vanities-with-tops?type=Single+Sink+Vanity+With+Top` |
| `'Double Sink Vanity With Top'` | Vanities/Vanity + sink_count=2 | "Double Sink Vanity With Top" | `/collections/bathroom-vanities-with-tops?type=Double+Sink+Vanity+With+Top` |
| `'Single Sink Cabinet Only'` | Vanities/Cabinet or Cabinet/Cabinet + "Single" in name | "Single Sink Cabinet Only" | `/collections/bathroom-vanity-cabinets?type=Single+Sink+Cabinet+Only` |
| `'Double Sink Cabinet Only'` | Vanities/Cabinet or Cabinet/Cabinet + "Double" in name | "Double Sink Cabinet Only" | `/collections/bathroom-vanity-cabinets?type=Double+Sink+Cabinet+Only` |
| `null` | Console, Console base, Floating console | — | — |

**Non-vanity `product_type` values** (all other categories — universal English terms, not JM-specific):
`'Mirror'` | `'Pull'` | `'Bench'` | `'Hutch'` | `'Linen Cabinet'` | `'Side Cabinet'` | `'Storage Cabinet'` | `'Drawer Unit'` | `'Shelf'` | `'Knobs & Legs'` | `'Metal Base'` | `'Backsplash'` | `'Vanity Top'` | `'Sample'`

### Key Rules

- `Product Category = 'Vanities'` + `Product Type = 'Vanity'` ALWAYS means cabinet + top + sinks (1 or 2). No sink_count=0 occurs here.
- `Product Category = 'Vanities'` + `Product Type = 'Cabinet'` = cabinet only (no top, no integrated sink). Routes to bathroom-vanities — NOT Storage.
- `Product Category = 'Cabinet'` + `Product Type = 'Cabinet'` = parallel path for cabinet only. Same treatment as above.
- Single vs. Double for Cabinet Only: determined by parsing product name — "Single" → `'Single Sink Cabinet Only'`, "Double" → `'Double Sink Cabinet Only'`, neither → default `'Single Sink Cabinet Only'`.
- `Product Category = 'General Products'`: no entry in `PRODUCT_CATEGORY_MAP`. Falls through to `PRODUCT_TYPE_MAP` keyed on `Product Type` column. This is expected and correct.
- Backsplash routes to vanity-tops (7) — it is a stone sidesplash that pairs with a specific stone countertop, not an accessory.
- Samples are a standalone browse/discovery category (8) — customers order swatches before purchasing. Not accessories.
- Console variants are components of the Boston, Addison, and Athena pedestal vanity models. `product_type = null` until model card grouping is built.
- `products.product_type` is always a BVO canonical value derived in importer — JM vendor strings are NEVER written to the DB (Rule 8). `productTypRaw` is kept as a local variable for `mount_type` EAV derivation and `isSample` pricing logic only.

### ⚠️ Root Bug (pre-fix state — still in code as of 2026-07-31)

`PRODUCT_CATEGORY_MAP` has `'vanity'` (singular) but the JM feed sends `'Vanities'` (plural). ALL 4,473 Vanities-category products fall through to `PRODUCT_TYPE_MAP`, where `Product Type = 'Cabinet'` → Storage (category 6). This is why Cabinet Only SKUs land in Storage with `product_type=NULL`. Fix tracked in Audit Fix #3.

**⚠️ Future feature:** Backsplash SKUs to appear on their matching stone top's PDP as an optional upgrade (e.g., Charcoal Soapstone backsplash on Charcoal Soapstone Top card). Requires `product_upgrades` table — not yet built.

### Megamenu "Shop By Type" URLs (post-taxonomy-fix)

| Label | URL | Notes |
|---|---|---|
| Single Vanity With Top | `/collections/bathroom-vanities-with-tops?type=Single+Sink+Vanity+With+Top` | New slug |
| Double Vanity With Top | `/collections/bathroom-vanities-with-tops?type=Double+Sink+Vanity+With+Top` | New slug |
| Cabinet Only | `/collections/bathroom-vanity-cabinets` | New slug — no type param needed (category = all cabinet types) |

**SEO rationale for slugs:** "Bathroom Vanities With Tops" aligns with Home Depot's dominant category term (highest search authority). "Bathroom Vanity Cabinets" is understood consumer intent for cabinet-only bases. "Vanity Set" avoided — already claimed by major platforms to mean vanity + mirror bundle. Validated via web research July 2026.

---

## Audit #1 — Full Codebase Review
**Date:** July 2026
**Git range:** `b70bc67` → `a9da495` (all work from migration 010 onward)
**Scope:** All commits audited for conflicts, duplication, counteracting intentions, stale code, bugs

---

### ~~Audit Fix #1~~ — JM Importer: `Product Width` → `products.width_in` ✅ COMPLETE
**Priority:** CRITICAL
**File:** `src/jobs/importJamesMartinFeed.js`
**Status:** ✅ Committed + deployed. Takes full effect on next JM re-import.

**What changed:**
1. Removed `'Product Width': ['size_in', 'num']` from `ATTR_MAP` — no longer writes to EAV
2. Added `width_in: cleanNum(row['Product Width'])` to `productData` object
3. Added `width_in` to `upsertProduct()` INSERT column list and VALUES
4. Added `width_in = VALUES(width_in)` to ON DUPLICATE KEY UPDATE block

**Effect:** Every future JM feed import writes width directly to `products.width_in`. EAV `size_in` is never written by this importer again.

**⚠️ Rollback instructions (if needed):**
To reverse this change:
- Re-add `'Product Width': ['size_in', 'num'],` to `ATTR_MAP` (after `'Product Height'` line ~403)
- Remove `width_in: cleanNum(row['Product Width']),` from `productData`
- Remove `width_in,` from INSERT columns and `:width_in,` from VALUES
- Remove `width_in = VALUES(width_in),` from ON DUPLICATE KEY UPDATE block
- Note: the 4,237 existing `products.width_in` values remain valid — rollback only affects future imports

---

---

### Audit Fix #3 — Taxonomy Overhaul: 4-value product_type + new display categories ⏳ PENDING
**Priority:** CRITICAL
**Status:** ⏳ Implementation pending. Taxonomy locked. Requires approval before each code change.
**Files:** `importJamesMartinFeed.js`, `collectionsController.js`, `bundleController.js`, `themeSettings.js`, `collection.ejs`, DB categories table, DB products table

**Problem:**
1. JM importer `PRODUCT_CATEGORY_MAP` has `'vanity'` (singular); JM feed sends `'Vanities'` (plural). ALL 4,473 Vanities-category products fall through to `PRODUCT_TYPE_MAP`.
2. `PRODUCT_TYPE_MAP['cabinet'] = 6` (Storage). Cabinet Only SKUs land in Storage with `product_type=NULL`.
3. `product_type` values `'Single Sink'` and `'Double Sink'` are ambiguous — they don't express whether the product includes a top or is cabinet-only.
4. No consumer-facing URL makes "Cabinet Only" vs "Vanity With Top" distinction clear.

**Decision:**
Replace the 2-value system (`'Single Sink'`, `'Double Sink'`) with a 4-value system that encodes both product form and sink configuration:
- `'Single Sink Vanity With Top'`
- `'Double Sink Vanity With Top'`
- `'Single Sink Cabinet Only'`
- `'Double Sink Cabinet Only'`

Two new SEO-friendly display categories with model-group layout:
- `bathroom-vanities-with-tops` — SEO slug aligned with Home Depot dominant term
- `bathroom-vanity-cabinets` — clear consumer intent for base cabinets

**Importer fix — PRODUCT_CATEGORY_MAP (corrected):**
```js
const PRODUCT_CATEGORY_MAP = {
  'vanities':   1,   // ← WAS: 'vanity' (bug). 'General Products' intentionally absent — falls to PRODUCT_TYPE_MAP
  'cabinet':    1,   // Cabinet category = bathroom-vanities (Cabinet Only)
  'tops':       7,   // Tops category = vanity-tops
};
```

**Importer fix — product_type assignment (new logic for category_id=1):**
```js
if (categoryId === 1) {
  const productTypLower = clean(row['Product Type']);
  const sinkCount = cleanNum(row['Number of Sinks Included (0, 1, or 2)']);
  const nameLower = (row['Product Name'] || '').toLowerCase();

  if (catLower === 'vanities' && productTypLower === 'vanity') {
    // Complete set (cabinet + top + integrated sinks)
    if (sinkCount === 2)      productType = 'Double Sink Vanity With Top';
    else if (sinkCount === 1) productType = 'Single Sink Vanity With Top';
  } else if (
    (catLower === 'vanities' && productTypLower === 'cabinet') ||
    catLower === 'cabinet'
  ) {
    // Cabinet only (no top, no integrated sink)
    if (/double/i.test(nameLower))      productType = 'Double Sink Cabinet Only';
    else                                 productType = 'Single Sink Cabinet Only';
  }
  // console / console base / floating console → productType stays null
}
```

**DB migrations required:**
```sql
-- Step 1: Add two display categories
INSERT INTO categories (slug, name, display_mode, sort_order, is_active)
VALUES
  ('bathroom-vanities-with-tops', 'Bathroom Vanities With Tops', 'model-group', 15, 1),
  ('bathroom-vanity-cabinets',    'Bathroom Vanity Cabinets',    'model-group', 16, 1);

-- Step 2: Update existing product_type values (complete sets)
UPDATE products SET product_type = 'Single Sink Vanity With Top'
  WHERE product_type = 'Single Sink' AND brand = 'James Martin Vanities';
UPDATE products SET product_type = 'Double Sink Vanity With Top'
  WHERE product_type = 'Double Sink' AND brand = 'James Martin Vanities';

-- Step 3: Update existing Cabinet Only rows (currently in bathroom-vanities)
UPDATE products SET product_type = 'Single Sink Cabinet Only'
  WHERE product_type = 'Cabinet Only' AND name NOT LIKE '%Double%' AND brand = 'James Martin Vanities';
UPDATE products SET product_type = 'Double Sink Cabinet Only'
  WHERE product_type = 'Cabinet Only' AND name LIKE '%Double%' AND brand = 'James Martin Vanities';

-- Step 4: Fix Cabinet Only rows misrouted to Storage (category_id=6, product_type=NULL)
-- Run diagnostic first: SELECT id, sku, name, category_id, product_type FROM products
--   WHERE brand='James Martin Vanities' AND category_id=6 AND name LIKE '%Vanity Cabinet%';
UPDATE products
  SET category_id = 1,
      product_type = CASE
        WHEN name LIKE '%Double%' THEN 'Double Sink Cabinet Only'
        ELSE 'Single Sink Cabinet Only'
      END
  WHERE brand = 'James Martin Vanities'
    AND category_id = 6
    AND name LIKE '%Vanity Cabinet%';
```

**collectionsController.js fix — mgCsRows missing product_type filter:**
When `mgActiveTypes.length > 0` (i.e. page has `?type=...`), the model list query correctly filters by product_type but `mgCsRows` (the sub-query that fetches swatches/sizes for those model cards) does not. This means Cabinet Only cards on the vanity-models page show Single/Double Sink swatches mixed in. Fix: add `AND p.product_type IN (...)` to mgCsRows WHERE clause when `mgActiveTypes.length > 0`.

**collectionsController.js fix — new slug routing:**
When category slug = `bathroom-vanities-with-tops`, auto-inject `mgActiveTypes = ['Single Sink Vanity With Top', 'Double Sink Vanity With Top']`.
When category slug = `bathroom-vanity-cabinets`, auto-inject `mgActiveTypes = ['Single Sink Cabinet Only', 'Double Sink Cabinet Only']`.
Both slugs source products from `bathroom-vanities` (category_id=1), same as `vanity-models`.

**bundleController.js — getCabinets() query update:**
```js
// Change:
AND p.product_type = 'Cabinet Only'
// To:
AND p.product_type IN ('Single Sink Cabinet Only', 'Double Sink Cabinet Only')
```

**collection.ejs — sidebar label + _mgTypeLabel map update:**
```js
// _mgTypeLabel map (model-group page):
var _mgTypeLabel = {
  'Single Sink Vanity With Top':  'Single Sink Vanity With Top',
  'Double Sink Vanity With Top':  'Double Sink Vanity With Top',
  'Single Sink Cabinet Only':     'Single Sink Cabinet Only',
  'Double Sink Cabinet Only':     'Double Sink Cabinet Only',
};
// Configuration sidebar filter labels:
// Old: "Single Vanity" / "Double Vanity" / "Cabinet Only"
// New: "Single Sink Vanity With Top" / "Double Sink Vanity With Top" / "Single Sink Cabinet Only" / "Double Sink Cabinet Only"
```

**⚠️ Rollback (if taxonomy fix causes regressions):**
- Revert `PRODUCT_CATEGORY_MAP` `'vanities'` back to `'vanity'`
- Revert product_type assignment logic
- Run reverse SQL UPDATE statements (Single Sink Vanity With Top → Single Sink, etc.)
- Revert `mgCsRows` WHERE clause addition

**Pending next step (tabled — separate session):**
Tops category: similar slug/label treatment. Evaluate: `bathroom-vanity-tops` slug, "Top Only" vs. full-top labeling, SEO research for top-specific searches. Do NOT implement until taxonomy overhaul above is complete and verified.

---

### ~~Audit Fix #2~~ — JM Importer: category routing now uses `Product Category` column ✅ COMPLETE
**Priority:** CRITICAL
**File:** `src/jobs/importJamesMartinFeed.js`
**Status:** ✅ Committed + deployed (commits `c4a15e1`, `ca3692a`). Takes full effect on next JM re-import.

**Problem:** `resolveCategoryId()` only read `row['Product Type']`. `PRODUCT_TYPE_MAP` had `'cabinet': 6` (Storage), so every JM "Cabinet" product (vanity-cabinet-only, no top) imported into Storage instead of Bathroom Vanities.

**Fix:**
1. Added `PRODUCT_CATEGORY_MAP` keyed on JM `Product Category` column (Etail tab) — PRIMARY routing signal.
2. Added `const productCatRaw = clean(row['Product Category'])` at line ~502.
3. Updated `resolveCategoryId(productCategoryStr, productTypeStr)` — checks `PRODUCT_CATEGORY_MAP` first, falls back to `PRODUCT_TYPE_MAP` when Product Category is absent or unmapped.
4. Corrected `PRODUCT_TYPE_MAP` fallback: `backsplash` 4→7, `drawer unit` 4→6 (to match decisions below).

**JM Product Category → BVO Category mapping (canonical — do not change without updating the map):**

| JM Product Category | BVO Category | Notes |
|---|---|---|
| Vanity | 1 — bathroom-vanities | Cabinet + top combo (with sink) |
| Cabinet | **1 — bathroom-vanities** | Cabinet only, no top — was wrongly going to Storage |
| Console | 1 — bathroom-vanities | Pedestal vanity component |
| Console base | 1 — bathroom-vanities | Pedestal vanity component |
| Floating console | 1 — bathroom-vanities | Pedestal sink component |
| Mirror | 2 — mirrors | |
| Bench | 4 — accessories | Vanity seat |
| Knobs & legs | 4 — accessories | Hardware / leg kit |
| Metal base | 4 — accessories | Optional wall-hung component |
| Metal Sample | 8 — samples | Metallic finish swatch |
| Stone sample | 8 — samples | Stone/countertop material swatch |
| Wood sample | 8 — samples | Paint or stain finish swatch |
| Pull | 4 — accessories | Handle/pull |
| Shelf | 4 — accessories | Optional bottom shelf (e.g. Columbia wall-hung) |
| Drawer unit | 6 — storage | Modular bridge joining two vanity cabinets (model-specific) |
| Hutch | 6 — storage | Component of vanity-with-storage set |
| Linen cabinet | 6 — storage | Component of vanity-with-storage set |
| Side cabinet | 6 — storage | Component of vanity-with-storage set |
| Storage cabinet | 6 — storage | Optional pedestal sink component |
| Backsplash | **7 — vanity-tops** | Matching stone backsplash — optional upgrade for stone tops |
| Countertop unit | 7 — vanity-tops | Composite top for wall-hung vanities |
| Top | 7 — vanity-tops | Composite countertop (wall-hung) |

**Backsplash sub-category rule:**
Backsplashes are JM's optional matching stone sidesplash for their stone countertops (e.g., Charcoal Soapstone Silestone backsplash pairs with Charcoal Soapstone Silestone Top). They route to Vanity Tops (7), NOT Accessories.

**⚠️ Future feature (not yet built):** Backsplash SKUs should be surfaced on the matching stone top's product detail page as an optional upgrade — e.g., the Charcoal Soapstone Top PDP shows "Add Matching Backsplash" with the backsplash SKU inline. The association mechanism (likely `product_accessories` table or a new `product_upgrades` table) is a future task.

**Bathroom vanity sub-type taxonomy (for mega menu and filters):**
BVO canonical `products.product_type` values — derived in importer, never copied from JM strings (Rule 8).
⚠️ Values below reflect the POST-TAXONOMY-FIX state (see Audit Fix #3). Current DB still has old values.
- **Single Sink Vanity With Top** → `Vanities/Vanity` + sink_count=1 → `'Single Sink Vanity With Top'`
- **Double Sink Vanity With Top** → `Vanities/Vanity` + sink_count=2 → `'Double Sink Vanity With Top'`
- **Single Sink Cabinet Only** → `Vanities/Cabinet` or `Cabinet/Cabinet` + "Single" in name → `'Single Sink Cabinet Only'`
- **Double Sink Cabinet Only** → `Vanities/Cabinet` or `Cabinet/Cabinet` + "Double" in name → `'Double Sink Cabinet Only'`
- Console/console base/floating console → `product_type=null`; grouped by model card later (Boston, Addison, Athena)

**Rule:** `Vanities/Vanity` in JM ALWAYS means cabinet + top + sinks (1 or 2). `sink_count=0` belongs to storage components. There is no "Cabinet with Top, no sink" sub-type.

**Non-vanity `product_type` values (BVO canonical — universal English terms, not JM-specific):**
`'Mirror'` | `'Pull'` | `'Bench'` | `'Hutch'` | `'Linen Cabinet'` | `'Side Cabinet'` | `'Storage Cabinet'` | `'Drawer Unit'` | `'Shelf'` | `'Knobs & Legs'` | `'Metal Base'` | `'Backsplash'` | `'Vanity Top'` (Top/Countertop Unit) | `'Sample'` (all samples)

**⚠️ Rollback instructions:**
- Restore `resolveCategoryId(productTypeStr)` (single param) and revert `PRODUCT_CATEGORY_MAP` addition
- Remove `const productCatRaw = clean(row['Product Category'])` line
- Change call back to `resolveCategoryId(productTypRaw)`
- Revert `PRODUCT_TYPE_MAP`: `'backsplash': 7` → `4`, `'drawer unit': 6` → `4`
- Note: existing DB records retain their category_id until re-imported

---

---

### ~~Recent Change #1~~ — Product image management rewrite ✅ COMPLETE
**Commits:** `7141b4b`, `68cd48e`
**Files:** `views/pages/admin/product-edit.ejs`, `src/controllers/adminController.js`, `src/routes/admin.js`

**What changed:**
- All three image action forms (upload, set-primary, delete) were nested inside `productForm` — browsers ignore nested forms, making all buttons submit the product save form instead of the intended action.
- Removed nested forms. All image actions now use `fetch()` AJAX.
- Four new routes added to `src/routes/admin.js`:
  - `POST /admin/products/:id/images` — upload (multer)
  - `POST /admin/products/:id/images/reorder` — drag-to-reorder
  - `POST /admin/products/:id/images/:imgId/delete` — delete
  - `POST /admin/products/:id/images/:imgId/primary` — set primary
- Four controller handlers converted to return JSON (were redirect-after-POST).
- `productAddImageMiddleware` wrapped to return JSON on multer error (previously raw `_upload.single()` which sent HTML errors).
- All `catch` blocks return `res.json({ ok: false, error })` instead of `next(err)`.
- JS added to `product-edit.ejs`: `imgUpload()`, `imgSetPrimary()`, `imgDelete()`, `imgSaveOrder()`, drag-and-drop IIFE.
- Sort order fallback: if `sort_order` column missing from `product_images`, INSERT retries without it (`ER_BAD_FIELD_ERROR` catch).

**⚠️ Rollback instructions:**
- `git revert 68cd48e 7141b4b` — reverts both commits cleanly
- Or manually: restore nested `<form>` blocks in `product-edit.ejs`; revert the four route entries in `admin.js`; revert the four handler functions in `adminController.js` to their redirect-based versions.

---

### ~~Recent Change #2~~ — Vanity sidebar: Configuration + Vanity Style filters ✅ COMPLETE
**Commits:** `8c80f0b`, `79a2b42`
**File:** `views/pages/collection.ejs`

**What changed:**
- Replaced the auto-generated "Number of Drawers" / "Number of Sinks" EAV filters with two custom groups rendered only when `isVanityCategory` is true.
- "Configuration" group: Single Vanity (`sink_count=1`), Double Vanity (`sink_count=2`), Cabinet Only (`type=Cabinet+Only`).
- "Vanity Style" group: 9 canonical BVO style buckets (`Traditional`, `Transitional`, `Modern`, `Farmhouse`, `Mid-Century Modern`, `Industrial`, `Coastal`, `Scandinavian`, `European / Old World`). Shows all 9 always; once EAV style data is imported, list auto-narrows to only populated styles.
- Skip lines added to `attributeDefs.forEach()`: `sink_count`, `style`, `drawer_count` all `return` early to prevent duplicate rendering.

**⚠️ Rollback instructions:**
- `git revert 79a2b42 8c80f0b`
- Or manually: remove the 4 `return` skip lines from `attributeDefs.forEach()`; remove the Configuration and Vanity Style `<% if (isVanityCategory) { %>` blocks that follow `attributeDefs.forEach()`.

---

### ~~Recent Change #5~~ — Theme preview body parsing + admin auth 401 JSON ✅ COMPLETE
**Commit:** `58fae23`
**Files:** `src/middleware/adminAuth.js`, `views/pages/admin/theme.ejs`

**Problem A — "Invalid JSON" on upload after server restart:**
When Hostinger restarts Node.js (e.g., after `git pull`), all in-memory sessions are wiped (MemoryStore). The user's browser still holds the old session cookie, but the server no longer recognises it. When any AJAX request (image upload, preview) fires, `requireAdmin` redirected to `/admin/login` (HTML). The browser followed the redirect and returned HTML to the fetch call. `r.json()` then threw a JSON parse error, shown as alert: "Image upload failed: [JSON Parse error...]". User described this as "invalid json message."

**Fix A — `src/middleware/adminAuth.js`:**
`requireAdmin` now returns `{ ok: false, error: 'Session expired — please reload the page and log in again.' }` with HTTP 401 for any non-GET request (identified by `Content-Type: multipart/*` or `application/x-www-form-urlencoded`). Browser GET requests still redirect to the login page as before.

**Problem B — sendPreview() wipes all array fields on every preview (pre-existing silent bug):**
`sendPreview()` used `new FormData(form)` which sends as `multipart/form-data`. Express only has `express.urlencoded()` body parser — it cannot parse multipart. So `req.body = {}` on every preview call. `_buildSettingsFromBody({})` extracted empty arrays for nav links, footer links, brand logos, ticker items, and testimonials, then:
1. `themeSettings.save({})` — cloned and wrote current flat settings back (OK for flat fields)
2. `settings.nav.links = []` (and all other arrays = []) — mutated the returned object which IS `_cache`
3. `_persistSettings(settings)` — wrote the corrupted object to `theme_settings.json`
4. `themeSettings.reload()` — loaded corrupted settings from disk

Result: every preview silently deleted all nav links, footer links, logos, ticker items, and testimonials from `theme_settings.json`. These were ONLY restored if the user clicked Save (since the full form POST is URL-encoded and correctly parsed). But any navigate-away-and-back would show a site with no navigation.

**Fix B — `views/pages/admin/theme.ejs` `sendPreview()`:**
Changed from `new FormData(form)` to `new URLSearchParams(new FormData(form)).toString()` with `Content-Type: application/x-www-form-urlencoded`. Express now correctly parses `req.body` on the preview route. All form fields (including nav links, hero image URL, etc.) are correctly reflected in the preview and written to disk.

**Bug in fix A (commit `d7f312f`):** The original `requireAdmin` AJAX detection included `application/x-www-form-urlencoded` in the check. Regular form Save also uses `application/x-www-form-urlencoded`, so clicking Save produced `{"ok":false,"error":"Session expired..."}` in the browser instead of redirecting. Fix: removed URL-encoded from AJAX check; AJAX is now detected by `X-Requested-With: XMLHttpRequest` (image uploads use multipart as secondary check). Added `X-Requested-With: XMLHttpRequest` header to `sendPreview()` fetch so session expiry during a preview still returns JSON 401 rather than HTML.

**⚠️ Rollback instructions:**
- `git revert d7f312f 58fae23`
- Or manually: revert `adminAuth.js` to single `res.redirect('/admin/login')` line; revert `sendPreview()` to use `new FormData(form)` without URLSearchParams/X-Requested-With.

**Recovery if site is crashing after server restart:**
1. Check if `data/theme_settings.json` exists on Hostinger — if missing, the server uses DEFAULTS (fine)
2. If the JSON file exists but is corrupted (empty arrays from old broken previews): delete it → server uses DEFAULTS → log in → set settings via admin → Save
3. If the crash is something else: check Node.js logs (`pm2 logs` or `node src/server.js` output)

---

### ~~Recent Change #4~~ — Hero image reversion bug: theme_settings.json gitignored ✅ COMPLETE
**Commits:** `fd7faa2`, `e2994f0`
**Files:** `.gitignore`, `src/routes/admin.js`

**Problem (hero image bug):** Every `git pull` on Hostinger auto-deploy overwrote `data/theme_settings.json` with the committed version, which contained `hero.image_url: '/images/parallax-bg.jpg'` (the old hardcoded parallax image URL). Admin saves to the hero image were preserved until the next deploy, then silently lost.

**Root cause confirmed:** `git ls-files data/theme_settings.json` returned the file — it was tracked in git and not in `.gitignore`. The file had been committed at some point with the old hero URL baked in.

**Fix — commit `fd7faa2`:**
1. Added `data/theme_settings.json` to `.gitignore`
2. Ran `git rm --cached data/theme_settings.json` to untrack without deleting the server copy
3. Committed — future `git pull` operations leave the file untouched
4. `themeSettings.js` already handles missing file by falling back to DEFAULTS (hero default = `''`) — safe

**Fix — commit `e2994f0`:**
`POST /admin/products/:id/images/reorder` was implemented in `adminController.js` as `exports.productReorderImages` but never registered in `src/routes/admin.js`. Added the missing route line alongside the other image management routes.

**⚠️ Rollback instructions:**
- `fd7faa2`: Remove `data/theme_settings.json` from `.gitignore` → run `git add data/theme_settings.json` to re-track → commit. **Warning:** re-tracking will cause future deploys to reset admin-saved theme settings again.
- `e2994f0`: Remove `router.post('/products/:id/images/reorder', ctrl.productReorderImages);` from `src/routes/admin.js`

**First-time setup note:** After Hostinger pulls `fd7faa2`, visit Admin → Theme Editor → Hero Banner → upload or paste the desired hero image → Save. It will now persist across all future deploys.

---

### ~~Recent Change #3~~ — Size filter: chip UI → standard checkboxes ✅ COMPLETE
**Commit:** `f38dc43`
**File:** `views/pages/collection.ejs`

**What changed:**
- The `size_in` filter inside the `range` handler used a custom chip UI: styled `<label class="size-chip">` elements with visually hidden checkboxes. This was inconsistent with all other sidebar filters.
- Replaced with standard `<label class="filter-option"><input type="checkbox">` pattern — identical to Brand, Configuration, and Vanity Style.
- Labels updated: `20" & Under`, `25"`, `30"`, … `84" & Over` (previously `20 & under`, `84 & over`, `XX Inches`).
- Form submission and filter logic unchanged — same `name="size_in"` checkboxes, same URL param format.

**⚠️ Rollback instructions:**
- `git revert f38dc43`
- Or manually: replace the `_chips.forEach` block that renders `filter-option` labels with the original `<div class="size-chips">` block containing `size-chip` labels with `style="position:absolute;opacity:0..."` hidden inputs.

---

## 🔴 Open Issues — Bugs Found (Next Session)

### Issue #6 — `Product.js` `findByCategory()` missing `p.model`, `p.color`, `p.color_family` in SELECT
**Priority:** HIGH — causes two visible customer-facing bugs
**Status:** ⏳ PENDING — diagnosed, not yet fixed

**Root cause:** The SELECT in `findByCategory()` (`src/models/Product.js` ~line 216) does not include
`p.model`, `p.color`, or `p.color_family`. This breaks two things downstream:

**Bug A — Color swatches missing on collection page product cards:**
- `collectionsController.js` builds `pageModels` from `result.products.map(p => p.model)`
- Since `p.model` is not in SELECT, all values are `undefined` → `pageModels = []`
- `modelColorMap` query never runs → `modelColorMap = {}`
- In `collection.ejs`: `product.model` is `undefined` → `_mcSwatches = []`
- Fallback also fails: `product.color_family` is `undefined` (not in SELECT)
- Result: every product card shows "See details" instead of color swatches
- **Note:** Swatches DO work on vanity-models page and homepage because those routes
  use completely separate queries that explicitly SELECT color/color_family

**Bug B — Sizes missing on collection page product cards:**
- Same root cause: `pageModels = []` → `modelSizeMap` query never runs → `modelSizeMap = {}`
- `_pSizes` is always null → "See details" shown instead of size options

**Fix — add 3 columns to the SELECT in `findByCategory()`:**
```javascript
// In src/models/Product.js, findByCategory() SELECT (~line 218)
// Change:
SELECT p.id, p.slug, p.name, p.brand, p.price, p.compare_price,
       p.is_new, p.is_featured, p.short_desc, p.product_type,
       COALESCE(p.primary_image_url, pi.url) AS primary_image,
       i.qty_on_hand, ...

// To:
SELECT p.id, p.slug, p.name, p.brand, p.price, p.compare_price,
       p.is_new, p.is_featured, p.short_desc, p.product_type,
       p.model, p.color, p.color_family,
       COALESCE(p.primary_image_url, pi.url) AS primary_image,
       i.qty_on_hand, ...
```
**Risk:** Zero — purely additive. No existing logic affected.

---

### Issue #7 — `size_in` EAV data not imported — sizes missing everywhere
**Priority:** HIGH — affects size filter + size display on ALL pages
**Status:** ⏳ PENDING — data gap confirmed, solution identified

**Root cause:** The 280-product CSV import (`bvo-products-import.csv`, from Shopify/RFLPos enrichment)
did not include size data. The `product_attribute_values` table has no rows with `attr_key = 'size_in'`
for any product. User confirmed by inspecting individual product records.

**Why vanity-models also shows no sizes:**
The vanity-models route queries EAV directly:
```sql
GROUP_CONCAT(DISTINCT CAST(pav.value_num AS UNSIGNED) ORDER BY pav.value_num SEPARATOR ',') AS sizes_csv
```
No EAV rows → `sizes_csv = null` → no sizes anywhere.

**Fix:** JM feed re-import in progress (July 2026). The importer maps `'Product Width'` → `products.width_in` directly (Audit Fix #1). All JM products will have `width_in` populated after import completes. This also resolves category routing (Audit Fix #2) and canonical `product_type` values.

---

### ⚠️ CRITICAL — Lost Context: Color & Filter Customer Experience Objectives
**Status:** ❌ NOT CAPTURED — must be re-explained next session

During the prior session (compacted), approximately one hour was spent discussing the customer
experience objectives and strategic goals behind the color family and filtering system. This
discussion drove all the technical decisions in Issue #1. The substance of that discussion was
**never written to any brief** and was lost in the compaction.

**What is known** (from the technical decisions made):
- Two-layer color system for vanities: Primary (cabinet color) + Secondary (hardware finish)
- Single-layer for mirrors/faucets/accessories/lighting/storage
- Metallic-finish vanities (Radiant Gold, Matte Black, Brushed Nickel) appear in primary color filter
- Wood grain texture swatches distinguish stain finishes from painted finishes visually
- Cherry = wood stain (current products), Rose = paint color (future products)

**What is missing** (customer experience rationale):
- Why the two-layer approach was chosen from a customer shopping perspective
- What filtering journey the customer is expected to follow
- Any specific UX decisions or trade-offs discussed

**Action for next session:** Owner to re-explain CX objectives. Claude to write each point
into this brief IN REAL TIME as the explanation is given — not at the end of the session.

---

## 🔴 Open Issues (Original Audit)

### ~~Issue #3~~ — Dead file: `src/data/modelFamilies.js` ✅ RESOLVED
**Priority:** Medium (stale code cleanup)
**Status:** ✅ COMPLETE — commit `b821337`

**What:** `src/data/modelFamilies.js` — 106-line file that is fully superseded by DB migration 009.
Zero references anywhere in `src/` or `views/`. Dead weight.

**Evidence:**
```bash
grep -rn "modelFamilies" src/ views/   # returns nothing
wc -l src/data/modelFamilies.js        # 106
```

**Fix — ONE command:**
```bash
cd "/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js" && \
  git rm src/data/modelFamilies.js && \
  git commit -m "chore: remove dead modelFamilies.js — superseded by migration 009"
```

**Risk:** Zero — no references. Safe to delete.

---

### ~~Issue #4~~ — Stale DB table: `finish_colors` ✅ RESOLVED
**Priority:** Low (database housekeeping)
**Status:** ✅ COMPLETE — dropped on Hostinger July 2026

**What:** `finish_colors` (migration 002) — 15 hardcoded finish→hex rows, predecessor to `FINISH_HEX`.
Not JM color mappings — those live in `color_mappings` table (Task #34-D). Confirmed before drop.
`FINISH_HEX` JS constant removed in Task #33; table was the only remaining artifact.

---

### ~~Issue #5~~ — Mega menu missing `cherry` color family ✅ RESOLVED
**Priority:** Low (consistency / UX)
**Status:** ✅ COMPLETE — commit `0fb0274`

Cherry = wood stain finish with current products. Added to mega menu Shop By Finish column.
Rose = solid paint color (no current products) — added to colorFamilies.js in same commit.
Rose mega menu link deferred until rose-finish products are imported.

---

## ✅ Resolved Issues (confirmed clean — no action needed)

### ~~Issue #1~~ — colorFamilies.js rollout ✅ COMPLETE (commit `84f03a0`)
Full rollout documented in `BVO_ISSUE1_BRIEF.md`.
- `colorFamilies.js` — 10 cabinet + 7 metallic families, context-aware normalize
- `collectionsController.js` — category-aware color routing, primaryFamilyPool expanded for vanities
- `collection.ejs` — finishHex removed, hw color filter UI wired
- `Product.js` — FINISH_HEX removed, hwColorFilters EXISTS subquery via pav_hw alias
- `importJamesMartinFeed.js` — two-pass normalize + lookupColorMapping() DB fallback
- `color_mappings` DB table — vendor_color → family_key persistent fallback (created on Hostinger)
- Admin Color Report — GET/POST `/admin/products/color-report`
- `site.js` — hw color filter JS handlers (commit `a9da495`)

---

### ~~Issue #2~~ — `vanity_type` EAV orphan ✅ RESOLVED (in importer)
`vanity_type` EAV key had no `attribute_definition` entry, so it never appeared in any filter sidebar.
JM feed column "Vanity Type" (e.g. "Freestanding") is already stored in `products.product_type`.
The EAV write was removed from ATTR_MAP in `importJamesMartinFeed.js` with this comment:
> "The EAV key 'vanity_type' had no attribute_definition and was an orphan that never appeared in filters."
**No further action needed.**

---

### ~~contentFor('script') bug~~ ✅ FIXED (commits `c536856`, `317906a`, `cf08692`)
EJS `contentFor` helper killed all JS on 4 admin pages. Fixed by switching all views to
`<%- style %>` / `<%- script %>` placeholders in layout. All admin views confirmed clean.

---

### ~~FINISH_HEX / finishHex~~ ✅ FULLY REMOVED
- `FINISH_HEX` constant removed from `Product.js` (Task #33)
- `finishHex` branch removed from `collection.ejs` (Task #32)
- Only remaining reference: a comment in `collection.ejs` line 291:
  `/* Unrecognized color_swatch key — skip to avoid rendering stale finishHex logic */`
  This is a harmless historical comment (the skip logic itself is correct).
- `finish_colors` DB table — not yet dropped (see Issue #4 above)

---

### ~~Ghost cards / swatch overflow IIFEs~~ ✅ REMOVED (commit `4eddde9`)
- `site.js` — overflow badge IIFE and ghost cards IIFE both removed
- `site.css` — `.listing-ghost` rule removed
- `site2.css` — `max-height` clamp on `.model-card-swatches` removed
- `collection.ejs` — slice(0,4) restored via EJS template `+N` badge

---

### ~~Sale route missing locals~~ ✅ SAFE (template guards)
The `/collections/sale` route does not pass `savedProductIds`, `modelColorMap`, or `modelSizeMap`
to `collection.ejs`. This is safe because the template guards all three with
`typeof ... !== 'undefined'` checks before accessing them:
```javascript
var _mcSwatches = (product.model && typeof modelColorMap !== 'undefined' && modelColorMap[product.model]) ? ...
var _pSizes     = (product.model && typeof modelSizeMap  !== 'undefined' && modelSizeMap[product.model])  ? ...
// heart button:
<%= (typeof savedProductIds !== 'undefined' && savedProductIds.has(product.id)) ? ' is-saved' : '' %>
```
Sale page shows no swatches and no heart state — correct behaviour.

---

### ~~Wood grain swatches~~ ✅ IMPLEMENTED (commit `f64342b`)
- `colorFamilies.js` — `woodGrain: true` flag on `wood_l`, `wood_m`, `wood_d` families
- `collection.ejs` — `swatch--wood-grain` class applied to family dots + model card swatches
- `vanity-models.ejs` — same
- `site.css` — `.swatch--wood-grain::after` repeating-linear-gradient CSS texture
- On product cards: `_isWood = ['wood_l','wood_m','wood_d'].indexOf(f.color_family) !== -1`

---

### ~~Trust icons~~ ✅ IMPLEMENTED (`product.ejs` line 244)
Four trust badges below product gallery: Warranty, Satisfaction Guaranteed, Free Shipping, Easy Returns.

---

### ~~Favorites / heart icon~~ ✅ IMPLEMENTED (commit `7be0c51`)
- Routes: `GET /account/favorites`, `POST /account/favorites/toggle`
- Heart button on product cards in `collection.ejs` + `vanity-models.ejs`
- Nav heart icon in `header.ejs`
- Client auth state: `window.__bvoIsLoggedIn`

---

### ~~Two-track mega menu~~ ✅ IMPLEMENTED (commits `8de0bc8`, `dc96c60`)
- Shop By Type: Single Sink, Double Sink, With Storage, Base Cabinet
- Shop By Size: 30", 36", 42", 48", 60", 72"
- Shop By Finish: 9 color families (see Issue #5 re: cherry)
- Promo panel: "Every Model, Every Finish" → `/collections/vanity-models`

---

### ~~MAP back-calc~~ ✅ IMPLEMENTED (commit `c5ca3d1`)
When JM feed has no MAP price but has MSRP: `price = round(MSRP × 0.66, 2)`, `compare_price = MSRP`.
Documented in importer comments and PROJECT_BRIEF.md.

---

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| July 2026 | Taxonomy overhaul — 4 canonical product_type values replacing 2 | `'Single Sink'`/`'Double Sink'` were ambiguous (cabinet vs. complete set). New values encode both form and sink count. Enables clean Cabinet Only routing without ambiguity. |
| July 2026 | New slugs: `bathroom-vanities-with-tops` + `bathroom-vanity-cabinets` | SEO: "Bathroom Vanities With Tops" = Home Depot dominant category term (highest search authority). "Vanity Set" avoided — already claimed by major platforms for vanity + mirror bundles. Validated July 2026. |
| July 2026 | JM feed: Product Category = `'Vanities'` (plural) routes to bathroom-vanities; sub-type routing within uses `Product Type` column | Root bug fix: `PRODUCT_CATEGORY_MAP` had `'vanity'` (singular) causing all 4,473 Vanities rows to miss and Cabinet Only to end up in Storage. |
| July 2026 | Single/Double determination for Cabinet Only: parse product name, not sink_count | Cabinet Only products have sink_count=0 (no integrated sink). Name always contains "Single" or "Double" based on countertop configuration. |
| July 2026 | `vanity_type` EAV key — removed from importer | Already stored in `products.product_type`; orphan EAV key never filterable |
| July 2026 | Matte Black → both `black` (cabinet) and `matte_black` (metal) | Context-aware: cabinet filter returns paint finish, metal filter returns HW finish |
| July 2026 | Primary color pool for vanities = ALL FAMILIES (not cabinet-only) | Metallic-finish vanities (Radiant Gold, Matte Black, Brushed Nickel) need to appear in primary color filter |
| July 2026 | HW finish stored as raw text in EAV (no normalize at import time) | HW combos like "Brushed Nickel/Matte Black/Radiant Gold" — family matching done at query time |
| July 2026 | Sale route uses `collection.ejs` without model/color maps | Safe — template guards with `typeof` checks; no swatches on sale page is acceptable |
| July 2026 | James Martin brand = `'James Martin Vanities'` (NOT `'James Martin'`) | `'James Martin'` silently matches zero rows — use full brand name in ALL queries |
| July 2026 | Vanity product_type stored in `products.product_type`, not EAV | Filter queries use `WHERE p.product_type IN (...)` — no EAV JOIN needed |
| July 2026 | Category ID 1 = Vanities (hardcoded in `isVanityCategory` check) | Stable — Vanities was the first category created; ID never changes |
| July 2026 | JM importer: `'Product Width'` writes to `products.width_in`, not EAV `size_in` | Audit Fix #1 — Rule 10 compliance. EAV `size_in` no longer a write target for any importer |
| July 2026 | Size filter — converted from chip UI to standard checkboxes | Chip UI (`.size-chip` hidden-checkbox labels) removed. Size filter now uses `.filter-option` checkboxes identical to Brand/Configuration/Style. Labels: `36"`, `20" & Under`, `84" & Over`. Commit `f38dc43`. |
| July 2026 | Size filter chip display style — universal rule (superseded) | ~~Stacked rows, left-border accent + tint + ✓ checkmark~~ — replaced by standard checkbox UI above. |
| July 2026 | `CSV_ATTR_KEYS` in `adminController.js`: removed `'size_in'` | Audit Fix #2 — CSV export/import no longer references stale EAV key; width handled as direct column |
| July 2026 | `searchSync.js`: `size_in` indexed from `products.width_in` not EAV | Audit Fix #3 — search index now reads canonical source; EAV attr_key list trimmed accordingly |

---

## File Map (Key Files — current state)

```
BVO Node.js/
├── src/
│   ├── config/
│   │   ├── colorFamilies.js          ← Color taxonomy — FAMILIES, normalize(), CABINET_KEYS, METAL_KEYS
│   │   └── database.js               ← bvoPool (MySQL)
│   ├── controllers/
│   │   ├── adminController.js        ← CSV import, CRUD, color report, IMG_URL_COLS, NUMERIC_CHECKBOX_KEYS
│   │   ├── collectionsController.js  ← Filter logic, primaryFamilyPool, hwColorFamiliesConfig, FAMILY_HEX
│   │   └── homeController.js         ← getFeaturedModels() + getFeaturedProducts() (COALESCE image fix)
│   ├── data/
│   │   └── modelFamilies.js          ← ⚠️ DEAD — Issue #3 — delete this file
│   ├── jobs/
│   │   └── importJamesMartinFeed.js  ← JM XLSX importer — two-pass normalize + lookupColorMapping()
│   └── models/
│       └── Product.js                ← findByCategory (color_family direct + pav_hw EAV EXISTS subquery)
├── views/
│   ├── layouts/
│   │   ├── main.ejs                  ← <%- style %> / <%- script %> placeholders (contentFor bug fixed)
│   │   └── admin.ejs                 ← Same; includes Color Report nav link
│   ├── partials/
│   │   └── header.ejs                ← Two-track mega menu; heart nav icon
│   └── pages/
│       ├── collection.ejs            ← Primary + hw color filter UI; model card swatches; pagination
│       ├── vanity-models.ejs         ← Model card grid (DB-driven swatches)
│       ├── product.ejs               ← Product detail + trust bar
│       └── admin/
│           ├── color-report.ejs      ← Null color_family bulk-fix tool
│           └── products.ejs          ← Import UI (wireImport overlay — do not break)
├── public/
│   ├── css/
│   │   ├── site.css                  ← Main styles incl. swatch--wood-grain
│   │   └── site2.css                 ← Overflow split (Hostinger 80KB CDN limit)
│   └── js/
│       └── site.js                   ← Color filter, hw filter, mobile drawer, carousel, etc.
└── database/
    └── migrations/
        └── 001–013  ✅ all applied
```

---

## Git Commit Reference

| Commit | Description |
|---|---|
| `d7f312f` | fix: narrow AJAX detection in requireAdmin — URL-encoded form saves must still redirect |
| `58fae23` | fix: theme preview sends url-encoded body; admin auth returns 401 JSON for AJAX |
| `fd7faa2` | fix: gitignore theme_settings.json — prevent git pull from overwriting admin saves |
| `e2994f0` | fix: register missing product image reorder route in admin.js |
| `f38dc43` | feat(collection): size filter — chip UI → standard checkboxes |
| `68cd48e` | fix(admin): image handlers — JSON errors, multer wrapper, sort_order fallback |
| `7141b4b` | fix(admin): add AJAX image JS — upload, set-primary, delete, reorder + drag-drop (#21) |
| `79a2b42` | fix(collection): vanity sidebar — skip drawer_count, always show Vanity Style filter |
| `8c80f0b` | feat(collection): Configuration + Vanity Style filters added to vanity sidebar |
| `597ad73` | feat(collection): QTY display on product cards — capped at 4, zero-stock overlay |
| `e5f8df4` | fix(collection): mirror images on size click — add category_id filter to mgCsRows query |
| `4c122af` | fix(main): bust site.js CDN cache — add ?v=2 to script tag |
| `96fbc5b` | feat(collection): dynamic price update on model-group cards — price maps + data attributes |
| `6a93abd` | feat(index): dynamic price update on homepage carousel model cards |
| `6109788` | fix(css): product card image background white — consistent with model cards (Rule 13) |
| `eb1e9b1` | fix(css): model card images — contain (no crop), white background, flex-centered (Rule 13) |
| `9524372` | fix(home): scope homepage featured models to bathroom-vanities; remove stale slug refs |
| `c5e8483` | fix(home): model-group sources from bathroom-vanities; rflposSync CAT_MAP retired vanities slug |
| `0baf6c6` | fix(collection): scope model-group queries to category_id; apply SIZE_BUCKETS to model cards |
| *(committed July 2026)* | fix(audit-1+2+3): width_in canonical source — JM importer, CSV_ATTR_KEYS, searchSync |
| `0246fe4` | feat: SIZE_BUCKETS shared config + megaMenuData middleware + dynamic header sizes + colors |
| `176a306` | fix(issue-7): size filter — chip UI, width_in canonical source, ±2" tolerance, dynamic availability |
| `a9da495` | feat: hw finish color filter JS handlers (site.js) |
| `84f03a0` | feat(Issue#1): full colorFamilies.js rollout — color filter system + admin color report |
| `9d636fc` | Fix pagination layout bug: windowed pages + flex-wrap |
| `5270e16` | fix: strip inch marks from size option display on cards |
| `09b5d89` | fix: CSS Grid min-width: 0 on grid children — fixes card stretch overflow |
| `4eddde9` | refactor: unify product + model card approach — remove JS IIFEs, restore template slice(0,4) |
| `8969a87` | fix: split site.css → site.css + site2.css (Hostinger 80KB CDN limit) |
| `fb1159b` | Mobile layout: responsive carousel, filter drawer, fix related products grid |
| `7f292fb` | Bug 3: fix listing-grid mobile breakpoint + increase PER_PAGE to 24 |
| `0d7dc99` | bug(5): BVO primary color approach on vanity-models filter sidebar |
| `0f3b19c` | feat(bug-4): swatch image swap on product + model cards; deselect toggle |
| `060fbe2` | Task #67 — Product gallery redesign: stacked grid desktop + swipe carousel + lightbox |
| `9b5f1fe` | Task #66 — Expand product images to 30 |
| `dc96c60` | feat(19G.3): add Shop By Finish column to mega menu |
| `7be0c51` | feat(19G.5): Favorites / heart icon — full implementation |
| `8de0bc8` | feat: two-track mega menu on Vanities nav link (19G.3) |
| `f64342b` | feat: wood grain swatches (19G.4) + trust icons (19G.6) |
| `d44df1c` | Expand JM_STYLE_MAP — cover all discovered JM theme strings |
| `8f475f2` | fix: B1–B4 + G3 — codebase review bug fixes |
| `b70bc67` | migration 010: taxonomy fix |

---

## Next Session Checklist
1. Read this brief + `BVO_ISSUE1_BRIEF.md` before touching anything
2. Current open issues: #6 (findByCategory missing model/color columns), #7 (size data gap)
3. **Taxonomy overhaul (Audit Fix #3):** Implementation steps listed in that section — get approval for each step before executing. Start with DB changes (phpMyAdmin), then importer fix, then controller/view updates.
4. Follow the one-by-one issue process: present findings → wait for approval → implement → verify → brief update

---

*Last updated: July 2026 — Taxonomy overhaul locked (Audit Fix #3). New 4-value product_type system and two new SEO display categories approved. Root cause of Cabinet Only routing bug confirmed (PRODUCT_CATEGORY_MAP singular/plural mismatch). Audit issues #3/#4/#5 all resolved. Issues #6 and #7 open (diagnosed, not yet fixed). Rose added to colorFamilies.js, cherry added to mega menu (commit 0fb0274). Bundle builder complete (bundleController.js, bundle.js, bundle-builder.ejs). ⚠️ Commits fd7faa2, e2994f0, 58fae23, d7f312f, 0fb0274 PENDING PUSH to GitHub.*

## ⚠️ Next Session Start Checklist
1. Read this brief + `BVO_ISSUE1_BRIEF.md` + `PROJECT_BRIEF.md` before touching anything
2. **Push pending commits to GitHub:** `git push origin main` (commits `fd7faa2`, `e2994f0`, `58fae23`, `d7f312f`, `0fb0274` are local only — GitHub credentials required)
3. **Taxonomy overhaul (Audit Fix #3) — NEXT PRIORITY:** Step 1 = DB changes in phpMyAdmin (add categories, update product_type values, fix Storage-misrouted Cabinet Only SKUs). Present SQL, wait for approval, then execute.
4. **If site is crashing on Hostinger:** see "Recovery" steps in Recent Change #5 above
5. Owner re-explains color/filter CX objectives → Claude writes to brief IN REAL TIME (still missing)
6. Fix Issue #6: add `p.model, p.color, p.color_family` to `findByCategory()` SELECT in `Product.js`
7. Resolve Issue #7: confirm size data populated after JM re-import (part of taxonomy fix)
