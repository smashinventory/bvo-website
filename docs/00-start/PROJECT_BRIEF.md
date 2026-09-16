# BVO (BathroomVanitiesOutlet.com) — Project Brief

> What BVO is, its scope and history, and the owner preferences every session should follow.
*Read this at the start of every session. Update it when decisions change.*

---

## ⚠️ RULES — READ BEFORE DOING ANYTHING

**RULE 1 — READ THE ENTIRE BRIEF FIRST**
At the start of every session, read this entire document before taking any action. If anything is unclear or a task requires an assumption to proceed, stop and ask the owner. Never guess. Never infer. Ask.

**RULE 2 — NO ACTION WITHOUT APPROVAL**
Do not begin any implementation task, script change, migration, code edit, or data transformation until the owner has explicitly reviewed and approved the plan. Present findings first. Wait for a clear "go ahead" before executing. No exceptions.

**RULE 3 — NO ASSUMPTION-BASED CHANGES**
Claude is forbidden from making any change to any file — code, data, spreadsheet, or document — based on its own assumptions or interpretations. Before touching any file, show exactly what will be changed and wait for explicit approval. This includes "small" fixes, typo corrections, formatting changes, and data transformations. If it modifies a file, it requires approval first. No exceptions.

**RULE 4 — ALWAYS PROVIDE EXACT COMMANDS + SHOW SCRIPTS IN CHAT**
Any time the owner needs to take an action (run a script, apply a migration, push to git, etc.), always provide the exact command in a copyable code block with a label (🖥️ TERMINAL, 🗄️ SQL/phpMyAdmin, 🌐 HOSTINGER, etc.). Never assume the owner will know what to run.

Additionally: whenever a script, SQL migration, or any other file content needs to be run or copied by the owner (even if Claude already wrote the file to disk), always display the full contents inline in chat as a copyable code block. Do not just say "run the file at path/to/file.sql" — paste the actual content so the owner can copy it directly without opening a file.

**RULE 5 — COLOR FAMILY INTEGRITY**
The color family system has three data points that must always stay in sync for every product:
- `products.color` — the exact manufacturer color name (e.g., "Champagne Tiger")
- `products.color_family` — the normalized family key derived from `color` via `normalize()` in `colorFamilies.js` (e.g., "wood_l")
- `cabinet_finish` EAV row — must store the same string as `products.color`

These three must always agree. If they drift, the filter sidebar shows sub-chips that return 0 results.
- Never store a truncated or variant of the color name in one field and the full name in another.
- `colorFamilies.js` is the single source of truth for family assignments. All color decisions made by the owner are recorded there with comments. Never change a family assignment without owner direction.
- The owner manually reviewed every James Martin designer color name and assigned each to a family. Those assignments are in `colorFamilies.js` under `// JM additions` comments. Do not alter them.

**RULE 6 — SCOPE DISCIPLINE**
Only do what the current task requires. Do not make changes to files, logic, or data outside the explicit scope of the task, even if something looks wrong. Flag it, do not fix it. Fixing out-of-scope items without approval is what causes regressions.

**RULE 7 — NO SIDE EFFECTS DURING IMPORTS**
After every import, run the post-import verification queries in Section 14A before declaring success. Never assume an import is clean. Silent failures (wrong brand name, wrong mount_type, unmapped styles) have occurred before and must be caught immediately.

---

> **📋 OWNER PREFERENCE — ALWAYS PROVIDE COMMANDS + SHOW SCRIPTS INLINE**
> Any time the owner needs to take an action (run a script, apply a migration, push to git, install a package, etc.), always provide the exact command(s) with a brief instruction explaining what it does and why. Never assume the owner will know what to run. Format as a copyable code block.
>
> **Scripts and file contents the owner must copy/paste (SQL migrations, shell scripts, etc.) must always be displayed in full in chat as a copyable block — even if Claude already wrote them to disk.** Never just reference a file path and tell the owner to open it.

---

## 1. What This Project Is

**BathroomVanitiesOutlet.com (BVO)** is a premium e-commerce website for bathroom vanities and related products, currently migrating from Shopify to a custom Node.js / Express / EJS storefront.

**Business model:** A hybrid of a curated brand website (à la PotteryBarn.com) and a product marketplace (à la Wayfair.com). We carry a large multi-brand inventory (10,000+ products target) while maintaining a premium, brand-forward aesthetic.

**Sister company:** Renovate for Less (RFL) — a brick-and-mortar bathroom vanity retailer in Atlanta, GA. RFL operates on a proprietary ERP/POS called **RFLPos** (accessed at RFLPos.com). BVO shares supplier relationships with RFL and the systems will eventually sync.

**Hosting:** Custom Node.js app on Hostinger.
- Temp URL: `https://slategrey-falcon-350174.hostingersite.com/`
- Live domain (after migration): `www.BathroomVanitiesOutlet.com`

---

## 2. Brands We Carry

| Brand | DB `brand` value | Notes |
|---|---|---|
| **James Martin** | `James Martin Vanities` | Primary premium brand, large catalog. Full name in DB is "James Martin Vanities" — "James Martin" is conversational shorthand only. All queries must use the full name. |
| **ER Vanities** | `ER Vanities` | RFL supplier brand. **Rebrand of Ethan Roth** — see the callout below. `Ethan Roth` is the RETIRED value; it survives only in the RFLPos database, which is read-only. |
| **Atlanta Vanities & Bathworks** | `Atlanta Vanity` | RFL supplier brand |
| **Nearmé** | `Nearme` | RFL supplier brand |
| **Water Creations** | `Water Creations` | Additional supplier |
| *(more brands to be added)* | | Expansion ongoing |

> **⚠️ ER VANITIES IS THE REBRAND OF ETHAN ROTH (decided 2026-09-05, Sam).**
> `Ethan Roth` is retired as a BVO brand value. The canonical BVO `brand` string
> is now **`ER Vanities`**. Anything still reading `Ethan Roth` is either stale
> or belongs to RFLPos.
>
> - **BVO database** — `products.brand` and `collections.brand` migrate to `ER Vanities`.
> - **RFLPos database** — NOT touched. RFLPos is read-only (Rule: never write to it),
>   and its brand table still holds `Ethan Roth` (id 26) and `Ethan Roth Old SKUs`
>   (id 630). The sync layer must therefore MAP `Ethan Roth` → `ER Vanities` on the
>   way in, exactly as Rule 8 requires of every other vendor value. Do not "fix"
>   RFLPos to match.
> - **Product names and descriptions** carrying the literal words "Ethan Roth"
>   are a separate pass from the `brand` column — the column is the filter, the
>   copy is customer-facing text.
> - **`enrich_bvo_v7.py`** branches on `brand_val == 'Ethan Roth'` (lines 486, 495).
>   Those comparisons break silently the moment the DB value changes: no error,
>   just RFL cabinet attributes quietly not being set. They must change in the
>   same pass as the data.

> **⚠️ JM brand name:** Every SQL query, migration, and script must use `brand = 'James Martin Vanities'`. Using `brand = 'James Martin'` silently matches zero rows — this caused the Step 3 product_type de-slugify to do nothing in migration 011 and was not caught until a post-import audit (July 2026).

**RFL-affiliated brands** (ER Vanities, Atlanta Vanities & Bathworks, Nearmé) are especially important because their inventory must eventually sync bidirectionally with the RFLPos system to avoid double-selling.

---

## 3. RFLPos Integration — Sync Strategy

**Goal:** Prevent double-selling shared RFL inventory.

| Phase | Direction | What it does |
|---|---|---|
| Phase 1 (current) | RFLPos → BVO (read-only) | BVO reads RFLPos inventory qty on sale; updates our stock levels |
| Phase 2 (future) | Bidirectional | BVO sales decrement RFLPos inventory; RFLPos sales decrement BVO |

**⚠️ Critical constraint:** The RFLPos system is the main operating system for the sister company's day-to-day retail operations. Any disruption would severely impact their business. **NEVER write to, modify, or delete anything in the RFLPos database.**

---

## 4. SEO Strategy & Current Rankings

BVO has significant existing SEO equity that must be preserved through the Shopify → Node.js migration.

**Current domain authority (BathroomVanitiesOutlet.com):**
- DA: 55 | PA: 40 | Spam Score: 2% | Domain Age: 6 years 3 months
- Currently ranks **top 5** on many high-intent bathroom vanity keywords (e.g., "Bathroom Vanities Outlet")

**Migration plan to protect rankings:**
1. Thorough testing on temp URL before cutover
2. All URLs, redirects, and canonical tags preserved exactly
3. Business address moved to a premium Atlanta virtual office (for local SEO signals)
4. Toll-free number stood up: **(877) 777-1948**
5. Node.js site must be fully SEO-ready before going live (sitemap, robots.txt, structured data, page speed)

**SEO is a top priority.** No deploy to production until rankings protection is confirmed.

---

## 5. Key Desired Outcomes

### Customer Experience
- Aesthetically pleasing, premium design (see `BVO-BrandFinal.jpg` in project folder — Section 7 below)
- Easy navigation across a large inventory (10,000+ products)
- Best-in-class conversion methodology — product pages, model cards, color/size filtering, CTAs
- Fast, mobile-first performance

### Platform Readiness (Plug & Play Rollout)
The site must be architected so we can bolt on these integrations without major rework:

| Category | Examples |
|---|---|
| Commerce | Shopify Buy Button, Google Shopping, Amazon |
| Payment | Stripe, PayPal, Affirm/financing |
| Logistics | ShipBob, UPS, FedEx |
| Marketing | HubSpot, Klaviyo, Mailchimp |
| Analytics | Google Analytics 4, Meta Pixel, Hotjar |
| Social | Instagram Shopping, Pinterest, TikTok Shop |

### Long-term
- Sustained top SERP rankings across bathroom vanity keywords
- Bidirectional RFLPos sync (Phase 2)
- Full marketplace capability — customer reviews, multiple sellers, dropship

---

## 6. Tech Stack

- **Runtime:** Node.js + Express
- **Views:** EJS via `express-ejs-layouts`
- **Database:** MySQL (accessed via `bvoPool` from `src/config/database.js`)
- **Repo path:** `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js/`
- **Git remote:** `https://github.com/smashinventory/bvo-website.git`
- **Git prefix:** Always `cd "/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js" && git ...`

---

## 6A. Database Operations — How to Run SQL on Hostinger

### Running migrations / SQL scripts

**`npm run migrate` does NOT work locally.** The local Mac has no MySQL. All SQL must be run on Hostinger where the live database is.

**Standard method — phpMyAdmin:**
> 🗄️ SQL/phpMyAdmin: Log into Hostinger → phpMyAdmin → select `bvo_website` database → **SQL tab** → paste the SQL → click **Go**

**For migration files** (`database/migrations/*.sql`), paste the file contents directly into the SQL tab. The migration runner (`npm run migrate`) is only usable via SSH on the Hostinger server — prefer phpMyAdmin for one-off migrations.

---

### ⚠️ Hostinger MariaDB collation warning

Hostinger runs **MariaDB 10.6+**, NOT MySQL. MariaDB 10.6 changed the default collation to `utf8mb4_uca1400_ai_ci`. Production BVO tables were created with `utf8mb4_unicode_ci` (set explicitly in all migrations).

**This causes #1267 collation mismatch errors** whenever a `CREATE TEMPORARY TABLE` is JOINed against a production table, because the temp table inherits the MariaDB default collation.

**The fix — always use explicit `COLLATE` in the JOIN condition:**
```sql
-- ✅ CORRECT — explicit COLLATE in ON clause overrides the mismatch
INNER JOIN _my_temp_table t ON t.some_col COLLATE utf8mb4_unicode_ci = prod.value_text

-- ❌ WRONG — column-level COLLATE in CREATE TABLE doesn't reliably fix it
-- ❌ WRONG — DEFAULT CHARSET=utf8mb4 COLLATE=... before AS SELECT is invalid MariaDB syntax
```

**Rule:** Any time you write a temp table that JOINs against `product_attribute_values`, `products`, or any other production table on a VARCHAR column — add `COLLATE utf8mb4_unicode_ci` to the temp table side of the JOIN `ON` clause.

---

### ⚠️ Deleting all product data (FK constraint workaround)

`TRUNCATE TABLE products` fails in MariaDB when FK constraints exist (`#1701`). `SET FOREIGN_KEY_CHECKS = 0` is unreliable across phpMyAdmin sessions.

**The correct approach — DELETE in child-first order (no FK flag needed):**
```sql
DELETE FROM product_attribute_values;
DELETE FROM product_images;
DELETE FROM product_documents;
DELETE FROM inventory;
DELETE FROM products;
```

Run all five lines together in the SQL tab. This respects FK order so no constraint errors occur.

---

## 6B. Deployment — How to Redeploy on Hostinger

Every time code changes are pushed to GitHub, you must redeploy on Hostinger before the live site sees them.

**Step-by-step:**

> **🖥️ TERMINAL (Mac)** — Push local commits to GitHub first:
> ```bash
> cd "/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js" && git push
> ```

> **🌐 HOSTINGER hPanel** — Then redeploy:
> 1. Log in at [hpanel.hostinger.com](https://hpanel.hostinger.com)
> 2. Go to **Hosting → Node.js**
> 3. Find your BVO app and click **Pull** (or **Deploy** / **Restart** — exact label depends on your plan)
> 4. Wait for the status to show green / running

If Hostinger has SSH access enabled on your plan, you can also do it in one step from terminal:
> **🖥️ TERMINAL (SSH into server):**
> ```bash
> cd /path/to/app && git pull && pm2 restart bvo
> ```
> (Replace `/path/to/app` with the actual server path — confirm this once and record it here.)

**When do you need to redeploy?**
Any time Claude edits a `.js`, `.ejs`, `.json`, or any other code file and you `git push`. Database changes (SQL run in phpMyAdmin) take effect immediately — no redeploy needed for those.

---

## 6B. Action Label Key

When Claude gives instructions that require you to do something, the step will be prefixed with one of these labels:

| Label | Means |
|---|---|
| **🖥️ TERMINAL** | Run in Terminal on your Mac |
| **🌐 HOSTINGER** | Do in Hostinger hPanel (browser) |
| **🗄️ SQL / phpMyAdmin** | Run in phpMyAdmin on Hostinger |
| **🌍 BROWSER** | Visit a URL or click something in Chrome |
| **📁 FILE** | Open / edit a file on your computer |

---

## 7. Brand & Design Reference

**📌 Review `BVO-BrandFinal.jpg` in the project folder before any design/UI work.**
This image contains the agreed brand aesthetic, color palette, typography, and visual tone.
All UI decisions (fonts, colors, spacing, component style) must align with it.

*(A formal write-up of the brand guidelines — tone, taxonomy, filtering methodology — is pending from the owner. It will be documented here when ready.)*

---

## 8. Critical Constraints — Never Violate

1. **RFLPOS database is READ-ONLY** — NEVER write to, modify, or delete anything in the RFLPOS database.
2. **Do not share or re-display sensitive credentials** in chat.
3. **NEVER regenerate logos.**
   - Primary logo: `BVOLOGOSQ_512.png`
   - Round contexts only: `BVOLOGOCIRCLE_2000.png`
4. **Navy `#182840` = ink/text ONLY** — never use as a background color.

---

## 9. Known Bug — `contentFor('script')` Kills All JS

**Root cause:** `express-ejs-layouts` — if `<%- contentFor('script') %>` appears in a child template, it outputs a marker string into the body. `parseScripts()` extracts `<script>` tags into `locals.script`, then `parseContents()` finds the marker and resets `locals.script = ''`, wiping all JS on the page.

**Fix:** Delete the single `<%- contentFor('script') %>` line from any affected file. Never add it back.

**Already fixed in:**
- `views/pages/admin/theme.ejs` (commit `c536856`)
- `views/pages/admin/products.ejs` (commit `317906a`)
- `views/pages/admin/bulk-edit.ejs` (commit `cf08692`)
- `views/pages/admin/product-edit.ejs` (commit `cf08692`)

---

## 10. Database — Current State

Migrations live in `database/migrations/`. Run with `node database/migrations/run.js <number>`.

**Key tables:**
- `products` — main product table, `source_flag` = `rflpos | salsify | csv | manual`
- `categories`
- `product_attribute_values` — EAV table with `attr_key`, `value_text`, `value_num`
- `attribute_definitions` — defines filter types per category
- `product_documents`
- `inventory`

**Migrations — ALL APPLIED (001–010):**

| # | Description | Status |
|---|---|---|
| 001–008 | Initial schema, GMC fields, EAV, etc. | ✅ Applied |
| 009 | `model` + `color_family` on products; drop `color_primary`, `color_secondary` | ✅ Applied |
| 010 | Taxonomy fix: vanity-tops category, dedup attr_defs, rename `num_drawers → drawer_count`, add missing vanity attr_defs, UNIQUE constraint, drop orphan `product_attributes` table | ✅ Applied (commit `b70bc67`) |

---

## 10B. Category Taxonomy — Approved List

| slug | Name | Status | Notes |
|---|---|---|---|
| `vanities` | Bathroom Vanities | ✅ Active | Cabinet-only SKUs. No top, no sink bundled for RFL brands. |
| `vanity-tops` | Vanity Tops | ✅ Active | Quartz/stone countertop SKUs sold separately from cabinet. Sink NOT included — sold separately. |
| `storage` | Storage | ✅ Active | Linen cabinets, hutches, makeup cabinets/drawers, wall cabinets, linen towers. All modular storage pieces that accompany a vanity but are NOT a vanity. Includes RFL Bridge cabinets (Bridge3DE, BridgeHutch, BridgeMUCabinet, BridgeMUCounter) and Linen Cabinets (LC). |
| `vanity-sets` | Vanity Sets | ✅ Active | Curated modular combinations — e.g. vanity + matching linen tower + top — shown together as a set. Products in this category are cross-referenced from `vanities`, `storage`, and `vanity-tops`. Think of this as a "build your set" collection, similar to Ariel's "Vanity With Linen Storage" section. Details to be designed when first sets are ready to publish. |
| `accessories` | Accessories | ✅ Active | Hardware, pulls, knobs, drains, channel drains. **Mirrors are a subcategory here** — `category_slug = 'accessories'`, `product_type = 'Mirror'`. No standalone `mirrors` category. |
| `sale` | Sale | ✅ Virtual | Query-driven, no DB row needed |

**14 RFL Bridge/LC SKUs — reclassified to `storage` (owner decision, July 2026):**
The following SKUs were previously miscategorized as `vanities`. They are bridge cabinets, hutch units, makeup counters, and linen cabinets — modular storage pieces, not standalone vanities. Moved to `storage` in `enrich_bvo_v7.py`:
- Bristol-Bridge3DE-NWA-BG, Bristol-BridgeMUCounter-NWA-BG
- Kensington-BridgeCabinet-DOAK-MB, Kensington-BridgeCabinet-MG-BN, Kensington-BridgeCabinet-NVBLU-BG, Kensington-BridgeCabinet-WH-BN
- London-Bridge3DE-Doak-MB, London-Bridge3DE-Wh-BN, London-BridgeHutch-Doak-MB, London-BridgeHutch-Wh-BN, London-BridgeMUCabinet-Doak-MB, London-BridgeMUCabinet-Wh-BN
- Windsor-LC-NVBLU-BG, Windsor-LC-WH-BN

**⚠️ Plumbing categories — CIRCLE BACK:**
The following categories are needed for future product imports and must be designed as a group (shared metallic finish filter system, faucet hole count, flow rate, etc.). Do not create these ad hoc — plan together:
- `faucets` — Bathroom faucets, widespread, single-hole, vessel
- `tubs` — Freestanding, alcove, drop-in bathtubs
- `shower-enclosures` — Shower glass, frameless, semi-frameless
- `shower-systems` — Shower heads, rain heads, body sprays, thermostatic valves
- `drains` — Linear drains, shower drains, pop-up drains

**`attr_drawer_count` and `attr_door_count` — deliberately ignored:**
These attributes are of very low importance. Customers do not search or filter by drawer/door count — the product images make this self-evident. Decision (owner, July 2026): leave blank, do not show on product page when blank, do not include in any storefront filters. Confirmed: neither attribute appears in any current filter code. Admin edit panel retains them as optional manual-entry fields only.

**Category rules for RFL brands (Atlanta Vanity, ER Vanities, Nearmé):**
- Cabinet SKU (`category_slug = vanities`): `attr_sink_included = No`, `attr_countertop_included = No`, `attr_mirror_included = No`
- Top SKU (`category_slug = vanity-tops`): `attr_countertop_included = Yes`, `attr_sink_included = No` (sink sold separately), `attr_countertop_material` derived from product name where possible

---

## 11. ✅ Architecture Cleanup — COMPLETED (commit `a860f3f`)

The fragmented color + model system has been replaced with a clean 3-column approach directly on `products`:

| Column | Example | Purpose |
|---|---|---|
| `model` | `"London"` | Groups SKUs on model cards; replaces hardcoded `modelFamilies.js` |
| `color` | `"Desert Oak"` | Brand's exact color name → shown in filter sub-chip dropdown |
| `color_family` | `"wood_m"` | Normalized bucket key → drives top-level swatch circle + filter |

**Rules:**
- `color_family` = `normalize(color)` computed at import time — no EAV needed
- Model card swatches = `SELECT DISTINCT color, color_family WHERE model = ?` — no hardcoded JS
- Color filter = `WHERE p.color_family IN (...)` on products table directly

**What was done:**
- Migration 009 written
- `adminController.js`: import/export uses `model` + `color_family`; `normalizeColor()` auto-derives family
- `Product.js`: color filter hits `products.color_family` directly — no EAV JOIN
- `collectionsController.js`: vanity-models fully DB-driven; `finishMap` built for sidebar; regular collection builds `modelColorMap` from DB
- `homeController.js`: replaced static `MODEL_FAMILIES` with live `getFeaturedModels()` DB query
- All three view templates (`collection.ejs`, `vanity-models.ejs`, `index.ejs`): DB-driven swatch rendering

**Still needs:**
1. Owner runs `node database/migrations/run.js 009` locally
2. Enrichment script rewrite (see Section 13)
3. Re-import clean XLSX/CSV after migration runs

---

## 12. Color Family System — `src/config/colorFamilies.js`

`normalize(rawValue)` → family key (exact match first, then partial substring, then null)

| key | label | hex | Notable members |
|---|---|---|---|
| `white` | White | `#f5f5f3` | White, Pure White, Soft White, Bright White |
| `cream` | Cream | `#e8d9b8` | Cream, Ivory, Champagne, Antique White |
| `gray` | Gray | `#8a8f96` | Gray, Grey, Ash, Charcoal Gray, Slate, Metal Gray |
| `black` | Black | `#2a2a2a` | Matte Black, Black, Ebony, Dark Charcoal |
| `blue` | Blue | `#182840` | Navy Blue, Navy, Cobalt Blue, Midnight Blue |
| `green` | Green | `#4a7c59` | Green, Sage Green, Forest Green, Hunter Green |
| `wood_l` | Light Wood | `#c9b89a` | Oak, Maple, Birch, White Oak, White Ash, Natural White Ash, Whitewashed Ash |
| `wood_m` | Med Wood | `#8b6840` | Walnut, Warm Brown, Teak, Medium Wood, Desert Oak |
| `wood_d` | Dark Wood | `#3e2a14` | Espresso, Dark Walnut, Java, Umber |

**No metallic family yet.** Gold, Nickel, Chrome → `null`. Add when plumbing filter is built.

**Pitfall:** "Ash" matches gray via substring, so "White Ash" must be an explicit member of wood_l — it is, as of commit `76b11c6`.

---

## 13. BVO Product Naming Convention

`{Model}-{SizeRaw}-{ColorCode}-{HardwareCode}`

Examples: `London-47.5-DOAK-MB`, `Bristol-23.5-NWA-BG`, `Kennesaw-35.5L-DKGR-BN`

**Color codes → color (brand name):**
```
WH / WHT      → White
BLK           → Black
DKBLU / NVBLU → Navy Blue
DKGR / DRKG   → Charcoal (gray family)
DOAK          → Desert Oak (wood_m)
NWA / NWASH   → Natural White Ash (wood_l)
WA            → White Ash (wood_l)
MGR / MG      → Metal Gray (gray)
CAMGRN        → Camo Green (green family)
VNGRN         → Venetian Green (green family)
SGE           → Sage Green
```

**Hardware codes → finish:**
```
BG → Brushed Gold  |  BN → Brushed Nickel  |  MB → Matte Black
PN → Polished Nickel  |  CH → Chrome
```

---

## 14. Enrichment Script

**Current script:** `enrich_bvo_v7.py` in the project root.

**Input:** `bvo-products-enriched.xlsx` (project root)
**Output:** `bvo-products-enriched-v2.xlsx` (project root)

### ⚠️ Project Root File Inventory — Know Before You Import

| File | Role | Safe to import? |
|---|---|---|
| `bvo-products-enriched.xlsx` | Script INPUT — raw Shopify/RFL data, unprocessed | ❌ NO |
| `bvo-products-enriched-v2.xlsx` | Script OUTPUT — enriched, BVO-canonical values | ✅ YES (export as CSV first) |
| `bvo-products-2026-07-14.csv` | BVO admin export snapshot (July 14) — empty mount_type | ❌ NO — pre-fix snapshot |
| `bvo-products-import.csv` | Previous 280-row import-ready CSV (pre-v7) | ❌ NO — outdated |
| `shopify products export*.csv` | Raw Shopify exports — source data for the XLSX | ❌ NO — raw Shopify format |

**Rule: if the filename does not end in `-v2` or later, do not import it.**

### RFL Enrichment Workflow — Correct Steps

1. Run the enrichment script: `python3 enrich_bvo_v7.py`
2. Open `bvo-products-enriched-v2.xlsx`, export/save as CSV
3. Import that CSV via `/admin/products/import`
4. Run the 4 post-import verification queries (Section 14A) before considering the import done

### ⚠️ What happens if you import the wrong file

Importing the raw XLSX/CSV input bypasses all of `enrich_bvo_v7.py`'s fixes. In July 2026 this caused:
- 179 RFL products stored with `mount_type = 'Furniture'` (Shopify-native value, not a BVO canonical type)
- Required emergency SQL cleanup across 3 brands (Atlanta Vanity, Ethan Roth, Nearme)
- Root cause: `bvo-products-enriched.csv` was imported instead of `bvo-products-enriched-v2.xlsx` output

`bvo-products-enriched.csv` has been **deleted** to prevent recurrence. Do not recreate it.

### 14A. Post-Import Verification Queries (run after every RFL import)

```sql
-- 1. Brand counts — confirm all 3 RFL brands present
SELECT brand, COUNT(*) AS products FROM products
WHERE brand IN ('Atlanta Vanity','Ethan Roth','Nearme')
GROUP BY brand;

-- 2. mount_type — must only show BVO canonical values
SELECT DISTINCT value_text FROM product_attribute_values WHERE attr_key = 'mount_type';
-- Expected: Floor Standing, Wall Mounted (and/or Pedestal if applicable). FAIL if 'Furniture' appears.

-- 3. Unmapped style check — must return zero rows
SELECT DISTINCT value_text, COUNT(*) AS n
FROM product_attribute_values
WHERE attr_key = 'style'
  AND value_text NOT IN (
    'Traditional','Transitional','Modern','Farmhouse',
    'Mid-Century Modern','Industrial','Coastal','Scandinavian','European / Old World'
  )
GROUP BY value_text;

-- 4. Products missing style by brand
SELECT p.brand, COUNT(*) AS no_style
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM product_attribute_values pav
  WHERE pav.product_id = p.id AND pav.attr_key = 'style'
)
GROUP BY p.brand;
```

### What `enrich_bvo_v7.py` does

- Sets `attr_mount_type` to BVO canonical values (Floor Standing / Wall Mounted / Pedestal) based on product name keywords
- Clears non-BVO values like `'Furniture'` from `attr_mount_type`
- Classifies uncategorized vanity tops → `category_slug = 'vanity-tops'`
- Reclassifies Bridge/Hutch/LC → `category_slug = 'storage'`
- Sets RFL-brand attributes: ADA=No, has_electrical=No, assembly_required=Yes, adjustable_shelves=Yes, soft_close_hinges=Yes, soft_close_slides=Yes
- Derives `model` and `color_family` from product name/SKU
- Normalizes `attr_style` via MODEL_STYLES lookup
- Standardizes google_product_category paths

---

## 15. Completed Work

| Item | Commit(s) |
|---|---|
| Fixed `contentFor('script')` JS-killing bug (4 admin pages) | `c536856`, `317906a`, `cf08692` |
| Built enrichment pipeline: 5 Shopify exports → 294-product XLSX | — |
| GMC field population | — |
| Theme editor: fixed editing, polished CSS, fixed JS bugs | — |
| Admin products: import CSV, bulk edit, filter sidebar | — |
| Migrations 001–008 applied | — |
| `colorFamilies.js`: Desert Oak → wood_m, White Ash → wood_l, Metal Gray → gray | `76b11c6` |
| Full DB-driven model + color architecture (migration 009, all views + controllers) | `a860f3f` |
| **Migration 010**: taxonomy fix — vanity-tops, dedup attr_defs, rename `num_drawers → drawer_count`, UNIQUE constraint, drop orphan `product_attributes` | `b70bc67` |
| **Bug fixes B1–B4 + G3** — full codebase review pass (see Section 20) | `8f475f2` |
| **bvo-products-import.csv** — 280-row enriched CSV ready for import | — |

---

## 16. Pending / Next Session

**Priority 1 — Owner actions (immediate):**
1. `git push` — push 2 unpushed commits (`b70bc67` + `8f475f2`) to GitHub
2. Pull on server + restart Node process
3. Import `bvo-products-import.csv` via `/admin/products/import` (280 products)
4. Post-import spot-check: homepage featured products show images; size/color/sink-count filters return results; product detail page shows specs

**Priority 2 — Stale code cleanup (non-blocking):**
- Delete `src/data/modelFamilies.js` — entire file dead/superseded by migration 009
- Update `Category.js` hardcoded fallback map to include `vanity-tops` and new attr_defs (`door_style`, `sink_type`, `countertop_included`) — low priority (DB-down emergency path only)
- Drop `finish_colors` DB table — never queried; `FINISH_HEX` is hardcoded in Product.js

**Priority 3 — Feature roadmap:**
- Wood grain texture swatches for `wood_l`, `wood_m`, `wood_d` color family circles (owner decision 19G.4)
- Heart / Favorites feature — top-right of product cards + account creation funnel (19G.5)
- 4 trust icons below product image gallery (19G.6)
- Two-track mega menu (functional + collection) (19G.3)
- `metallicFamilies.js` + hardware finish filter system (Section 18C)
- `vanity-sets` category + first set combinations (Section 10B)
- James Martin import script (Section 18B)

**Future roadmap:**
- GMC Feed endpoint (`/feeds/google-merchant.xml`)
- SEO: sitemap.xml, robots.txt, structured data (JSON-LD), page speed audit
- RFLPos read sync (Phase 1) — inventory qty updates on RFL sales
- Stripe + PayPal + Affirm payment integration
- Google Analytics 4 + Meta Pixel
- Google Shopping / Meta Commerce catalog feed
- RFLPos bidirectional sync (Phase 2)
- Domain migration: temp URL → BathroomVanitiesOutlet.com

**Phase 2 — Shipping & Order Management (after website, cart, and inventory feeds are live):**
Focus: build out the operational layer for fulfillment — carrier rate-shopping, LTL booking, order routing, and tracking.

Shipping data is captured now and stored in DB (see `product_shipping_boxes` table — per-component box dimensions and weights from the JM feed), but is intentionally excluded from the customer-facing product page. Data currently captured per SKU:
- Per-component shipping boxes: height, width, depth, gross weight, cubic feet (`product_shipping_boxes` table — component types: Vanity Cabinet, Vanity Top, Sink, Mirror, Backsplash, Bench, Storage Cabinet, Shelf, Drawer Unit, Pulls, Linen Cabinet, Hutch, Knobs and Legs)
- Total shipping weight (`products.total_ship_weight_lbs`)
- Ships LTL or Ground flag (`products.ships_ltl`)
- Freight class (`products.freight_class`)
- Harmonized tariff code (`products.harmonized_code`)

Phase 2 work items:
- Carrier rate-shopping API (LTL + parcel) using stored box dimensions
- Pallet configuration logic (multi-box SKUs, pallet stacking rules)
- Admin shipping dashboard — view per-order freight cost estimates
- Order routing: assign fulfillment to correct warehouse/dropship vendor
- Tracking number ingestion + customer-facing order status page
- Returns / RMA workflow

---

## 20A. Architecture Decision — Product Images Expanded to 30 (July 2026)

**Decision:** Flat image URL column capacity expanded from 7 (`image_2_url`–`image_7_url`) to 30 (`image_2_url`–`image_30_url`).

**Migration:** `data/migrations/013_image_columns.sql` — adds `image_8_url`–`image_30_url` as `VARCHAR(500) NULL`.

**Admin UI:** `product-edit.ejs` shows fields 2–5 by default; "+ Add More Images" button reveals fields 6–30. No change to the upload-based `product_images` table workflow.

**Import sheet impact:** When product upload tasks are reached, the BVO CSV import template must be updated to include `image_2_url`–`image_30_url` columns. `enrich_bvo_v7.py` will also need corresponding output columns at that time.

**Dual-system note:** The primary image display path reads from `product_images` table. `Product.findBySlug()` now falls back to flat URL columns only when `product_images` is empty for that product, synthesizing them into the same `product.images` array shape.

**IMG_URL_COLS constant:** `adminController.js` defines `IMG_URL_COLS = Array.from({length:29}, (_, i) => \`image_\${i+2}_url\`)` at module level. All INSERT/UPDATE/CSV queries build their image column lists from this constant — add/remove columns here to propagate everywhere.

---

## 20. Bug Fixes — Codebase Review (July 2026, commit `8f475f2`)

Five bugs found and fixed during pre-import code review:

| ID | File | Bug | Fix |
|---|---|---|---|
| **B1** | `homeController.js` | `getFeaturedProducts()` used `pi.url` only — no image shown after CSV import because importer writes `products.primary_image_url`, not `product_images` | `COALESCE(p.primary_image_url, pi.url) AS primary_image` |
| **B2** | `Product.js` | Model filter used `LIKE p.name` (stale assumption pre-migration-009 when no `model` column existed) | Exact match: `LOWER(p.model) = LOWER(?)` |
| **B3** | `product.ejs` | Dead reference to `attr.attr_value` from the dropped `product_attributes` table — always `undefined` | Removed dead assignment |
| **B4** | `collection.ejs` | Light-swatch hex detection array had mixed-case values (`#F5F5F3`) but comparison used `.toLowerCase()` — never matched, all swatches got dark-text class | All hex values in array lowercased |
| **G3** | `adminController.js` | `sink_count`, `drawer_count`, `faucet_holes` in `NUMERIC_ATTR_KEYS` → `value_text = null` on import. Checkbox filter queries `value_text IN (...)` → always empty | Added `NUMERIC_CHECKBOX_KEYS` set; these three keys now store both `value_text` AND `value_num`. `size_in` stays num-only (range filter) |

**Key principle going forward:** Any attr_key with `filter_type = 'checkbox'` in `attribute_definitions` must have `value_text` populated in the EAV. Only pure range/numeric filters can rely solely on `value_num`.

---

## 17. File Map (Key Files)

```
BVO Node.js/
├── src/
│   ├── config/
│   │   ├── colorFamilies.js        ← Color family system + normalize() — source of truth
│   │   └── database.js             ← bvoPool (MySQL)
│   ├── controllers/
│   │   ├── adminController.js      ← CSV import/export, product CRUD, bulk edit
│   │   │                             CSV_ATTR_KEYS, NUMERIC_ATTR_KEYS, NUMERIC_CHECKBOX_KEYS
│   │   ├── collectionsController.js← Filter logic, vanity-models DB query, finishMap
│   │   └── homeController.js       ← getFeaturedModels() + getFeaturedProducts() (COALESCE image fix)
│   ├── data/
│   │   └── modelFamilies.js        ← ⚠️ DEAD FILE — superseded by migration 009, safe to delete
│   └── models/
│       └── Product.js              ← findByCategory (model = exact match on products.model)
│                                     color filter SQL (products.color_family direct, no EAV)
├── views/pages/
│   ├── admin/
│   │   ├── products.ejs            ← Product list + import + bulk bar
│   │   ├── product-edit.ejs        ← Full product editor + GMC section
│   │   ├── bulk-edit.ejs           ← Inline grid bulk editor
│   │   └── theme.ejs               ← Theme editor
│   ├── collection.ejs              ← Category listing + filter sidebar + product cards (swatch fix)
│   ├── product.ejs                 ← Product detail page (dead attr.attr_value ref removed)
│   ├── vanity-models.ejs           ← Model card grid (DB-driven swatches)
│   └── index.ejs                   ← Homepage (featuredModels carousel)
├── database/migrations/
│   ├── 001–009  ✅ all applied
│   └── 010_taxonomy_fix.sql        ← ✅ applied — vanity-tops, attr_defs, UNIQUE constraint
├── bvo-products-enriched-v2.xlsx   ← Source file used for import CSV
├── bvo-products-import.csv         ← ✅ 280-row import-ready CSV (upload via /admin/products/import)
├── BVO-BrandFinal.jpg              ← Brand design reference — review before any UI work
└── PROJECT_BRIEF.md                ← This file
```

---

## 18. Source Mapping Conventions

*Read this before writing any import script. These are the canonical rules for moving external data into the BVO database.*

---

### 18A. RFLPos → BVO

**What RFLPos is:** The ERP/POS system of our sister company Renovate for Less (RFL). It holds live inventory for the RFL-affiliated brands (Atlanta Vanity, ER Vanities, Nearmé). RFLPos still stores that brand as `Ethan Roth`; the sync maps it to `ER Vanities`.

**⚠️ NEVER write to RFLPos.** Phase 1 = read-only qty sync. Phase 2 = bidirectional (future).

**`source_flag` value:** `'rflpos'`

#### SKU Name Parsing

RFLPos product names follow the BVO SKU convention:
```
{Model}-{SizeRaw}-{ColorCode}-{HardwareCode}
Examples: London-47.5-DOAK-MB   Atlanta-59.5D-NVBLU-BG   Kensington-35.5L-NWA-BN
```

| Segment | Rule | BVO column |
|---|---|---|
| First alpha segment (before first numeric) | Title-case; apply MODEL_ALIASES | `model` |
| Size segment (numeric, optional suffix) | Strip suffix for width | `width_in`, `attr_size_in` |
| Size segment — `D` suffix (e.g. `59.5D`) | → 2 sinks | `attr_sink_count = '2'` |
| Size segment — `L`/`R` suffix | Left/right config — note only | (no separate column yet) |
| Color code | Decode via COLOR_CODE_MAP below | `color` |
| Hardware code | Decode via HARDWARE_CODE_MAP below | `attr_hardware_finish` |

#### MODEL_ALIASES
```
{ 'newyork': 'New York', 'ny': 'New York' }
```
Model extraction rule: first hyphen segment, must be purely alpha (`/^[A-Za-z]{3,}$/`), vanity products only.

#### COLOR_CODE_MAP (RFLPos codes → brand color name)
```
WH / WHT       → White
BLK            → Black
DKBLU / NVBLU  → Navy Blue
DOAK           → Desert Oak
NWA / NWASH    → Natural White Ash
WA             → White Ash
MGR / MG       → Metal Gray
CAMGRN         → Camo Green
VNGRN          → Venetian Green
SGE            → Sage Green
DKGR / DRKG    → Charcoal Gray
```
After decode: `color_family` = server-derived via `normalize(color)` from `colorFamilies.js`. **Never store raw codes in the DB.**

#### HARDWARE_CODE_MAP (RFLPos codes → exact finish name)
```
BG  → Brushed Gold
BN  → Brushed Nickel
MB  → Matte Black
PN  → Polished Nickel
CH  → Chrome
```
After decode: `attr_hardware_finish_family` = server-derived via `normalizeHardwareFinish(attr_hardware_finish)` from `metallicFamilies.js`.

#### Field Defaults (RFLPos brands)
| Field | Atlanta Vanity | ER Vanities | Nearmé |
|---|---|---|---|
| `attr_style` | *(see MODEL_STYLES — no brand default)* | *(see MODEL_STYLES)* | *(see MODEL_STYLES)* |
| `attr_mount_type` | Floor Standing | Floor Standing | Floor Standing |
| `brand` | Atlanta Vanity | ER Vanities | Nearmé |

**⚠️ Style is assigned at the MODEL level, not the brand level.** Brand-level style defaults are incorrect — the same brand can have models spanning multiple styles. See Section 18D for the authoritative MODEL_STYLES table.

**`attr_ada_compliant` for all RFL brands = `No`.** None of the RFL supplier products are ADA compliant. Set this field to `No` for every RFL SKU in `enrich_bvo_v7.py`. James Martin is handled separately — map from the `ADA Compliant` column in the Salsify feed (see 18B).

---

### 18B. James Martin Etail Feed → BVO

**⚠️ IMPORTER CONNECTION NOTE (critical — do not skip):**
The JM importer (`src/jobs/importJamesMartinFeed.js`) runs **server-side** via the Express
app's existing `bvoPool` MySQL connection. Never run it as a standalone local script — local
`.env` has `DB_HOST=127.0.0.1` which has no MySQL server. Always trigger imports through the
admin UI at `/admin/products` → "Import ▾" → "James Martin" button. This POSTs to
`/admin/products/import-jm`, which processes the XLSX on the server using `bvoPool`.
CLI usage (`node src/jobs/importJamesMartinFeed.js`) is only valid on the production server.

**Source file:** `James Martin - Etail Feed_2026_07_15.xlsx` (5,189 rows, 232 columns — 2026 feed)
**`source_flag` value:** `'salsify'` (James Martin uses Salsify PIM to distribute their feed)
**`brand` value:** `'James Martin'`

#### Column Mapping

| JM Feed Column | BVO Column | Notes |
|---|---|---|
| `Collection Name` | `model` | 84 unique collections; title-case as-is |
| `Product Name` | `name` | Full product name |
| `SKU` | `sku` | JM SKU — keep as-is |
| `Product Type` | `product_type` | Map 24 JM types → BVO category slugs (see below) |
| `Finish/Color of Product` | `color` | Exact brand name; 101 unique values |
| *(derived)* | `color_family` | `normalize(color)` via `colorFamilies.js` |
| `Hardware Finish` | `attr_hardware_finish` | Exact brand name; 17 unique values |
| *(derived)* | `attr_hardware_finish_family` | `normalizeHardwareFinish()` via `metallicFamilies.js` |
| `Theme/Style` | `attr_style` | JM uses combos like "Traditional, Transitional" — take first value |
| `Vanity Countertop Material` | `attr_countertop_material` | 16 types; Cultured Marble, Quartz, etc. |
| `Number of Sinks` | `attr_sink_count` | JM provides directly (0, 1, 2) |
| `Sink Installation Type` | `attr_sink_type` | Undermount, Vessel, Integrated, Drop-in |
| `ADA Compliant` | `attr_ada_compliant` | Yes / No |
| `Overall Width` | `width_in` | Convert to decimal inches if needed |
| `Overall Height` | `height_in` | |
| `Overall Depth` | `depth_in` | |
| `Weight` | `weight_lbs` | |
| `MAP Price` | `price` | Minimum advertised price (see pricing rules below) |
| `MSRP` | `compare_price` | Shown as crossed-out retail price |
| `Primary Image URL` | `primary_image_url` | JM CDN URLs — do NOT clear these (not RFLPos) |
| `UPC` | `upc` | |
| `Description` | `description` | |
| `Google Product Category` | `google_product_category` | Standardize to full string path if bare ID |
| `Number of Doors` | *(attr_door_count — future)* | Not in schema yet |
| `Number of Drawers` | `attr_drawer_count` | |
| `Faucet Holes` | `attr_faucet_holes` | |

#### JM Product Type → BVO Category Slug
```
Bathroom Vanity            → vanities
Vanity Mirror              → mirrors
Bathroom Sink              → sinks
Faucet                     → faucets (future category)
Vanity Top                 → vanity-tops (future category)
Linen Cabinet / Side Tower → storage (future category)
Medicine Cabinet           → storage
(all others)               → accessories
```

#### JM_STYLE_MAP (owner-approved, July 2026)

Maps raw JM `Theme/Style` column values → BVO taxonomy. Pipe-separated = multiple styles → multiple EAV rows on import.

| JM Raw Value | Count | → BVO Style(s) |
|---|---|---|
| "Transitional, Traditional" | 1,650 | Traditional \| Transitional |
| "Modern" | 1,635 | Modern |
| "Transitional" | 1,499 | Transitional |
| "Contemporary/Modern, Transitional" | 276 | Transitional \| Modern |
| "Traditional, Transitional" | 193 | Traditional \| Transitional |
| "Traditional" | 192 | Traditional |
| "Modern, Transitional" | 12 | Transitional \| Modern \| Mid-Century Modern \| Industrial |
| "Old World" | 5 | Traditional \| European / Old World |
| *(blank)* | 983 | *(leave empty)* |

```python
JM_STYLE_MAP = {
    'Transitional, Traditional':          'Traditional|Transitional',
    'Modern':                             'Modern',
    'Transitional':                       'Transitional',
    'Contemporary/Modern, Transitional':  'Transitional|Modern',
    'Traditional, Transitional':          'Traditional|Transitional',
    'Traditional':                        'Traditional',
    'Modern, Transitional':               'Transitional|Modern|Mid-Century Modern|Industrial',
    'Old World':                          'Traditional|European / Old World',
}
# If JM style value not in map → leave attr_style blank
```

#### JM Pricing Rules

**Display model:** `price` = MAP (what the customer pays), `compare_price` = MSRP (crossed-out retail reference).

**Back-calculated MAP rule (verified July 2026):**
Analysis of 4,761 JM products that carry both MAP and MSRP shows MAP is exactly **66% of MSRP** across every product type (range 65.85–67.85%, mean and median both 66.0%). JM computes MAP as `MSRP × 0.66`.

When MAP is absent from the feed, the importer back-calculates: `price = round(MSRP × 0.66, 2)`, `compare_price = MSRP`.

**Full pricing resolution logic (in order):**

| Condition | `price` | `compare_price` | `is_active` |
|---|---|---|---|
| Samples (Wood/Stone/Metal) | $9.99 | null | 1 (sellable — covers postage) |
| Has MAP | MAP | MSRP | 1 if status=active |
| No MAP, has MSRP | `round(MSRP × 0.66, 2)` | MSRP | 1 if status=active |
| No MAP, no MSRP | 0 | null | 0 (hidden until priced) |

#### Important JM-specific Rules
- **Images:** JM CDN URLs are valid — never flag them red. Only flag/clear images from RFLPos source.
- **Style parsing:** JM `Theme/Style` column uses comma-separated combos (e.g., "Traditional, Transitional"). Do NOT store the raw comma string. Look up the value in JM_STYLE_MAP (Section 18D), split the result on `|`, and INSERT one EAV row per style value. (The old "take first value only" note was wrong — superseded by JM_STYLE_MAP.)
- **Countertop:** JM vanities often include a top — `attr_countertop_included` can default to `'Yes'` when `Vanity Countertop Material` is not null/empty.
- **Sink count = 0:** JM uses 0 for cabinet-only (no top, no sink). Map to `attr_sink_count = '0'` and `attr_sink_included = 'No'`.

---

### 18C. Metallic Finish Family System

**File to create:** `src/config/metallicFamilies.js` (parallel to `colorFamilies.js`)

This single config drives hardware finish filtering for both vanity hardware AND plumbing fixtures.

| Family key | Label | Hex | Maps to (exact values) |
|---|---|---|---|
| `gold` | Gold | `#C9A84C` | Brushed Gold, Polished Gold, Champagne Bronze, Antique Brass, Warm Gold |
| `nickel` | Nickel | `#A8A9AD` | Brushed Nickel, Satin Nickel, Polished Nickel, Antique Nickel, Stainless |
| `chrome` | Chrome | `#D4D8DC` | Chrome, Polished Chrome, Brushed Chrome |
| `black` | Black | `#2A2A2A` | Matte Black, Flat Black, Oil-Rubbed Bronze *(folds into existing black family)* |
| `bronze` | Bronze | `#6B4423` | Brushed Bronze, Venetian Bronze, Dark Bronze |

**Decision (locked):** `matte_black` folds into the existing `black` family key — no separate metallic black. One "Black" concept site-wide.

**Column pattern** (same as cabinet color):
- `attr_hardware_finish` = exact brand name (sub-chip filter)
- `attr_hardware_finish_family` = normalized key (top-level swatch filter)
- `attr_faucet_finish` + `attr_faucet_finish_family` = same keys when plumbing is built

---

### 18D. Style Taxonomy — Master Reference

**9 approved style buckets (locked):**
Traditional | Transitional | Modern | Farmhouse | Mid-Century Modern | Industrial | Coastal | Scandinavian | European / Old World

**Rules:**
- Style is assigned at the **model level**, never the brand level. A brand can span multiple design aesthetics across its collection roster.
- Products inherit their model's style(s). Individual SKUs do not get separate style overrides unless the model itself has variants that cross style lines.
- Multiple styles per model are supported. In the XLSX, pipe-separated: `"Transitional|Modern|Farmhouse"`. The importer splits on `|` and creates one EAV row per value (`attr_key = 'style'`).
- For James Martin: parse `Theme/Style` column, map using JM_STYLE_MAP (see 18B), write pipe-separated result.
- If a model is not in MODEL_STYLES, leave `attr_style` blank — do NOT fall back to brand default.

**MODEL_STYLES (owner-approved, July 2026):**

| Model | Brand | Styles |
|---|---|---|
| London | ER Vanities | Transitional \| Modern \| Farmhouse |
| Bristol | ER Vanities | Traditional \| Transitional \| Coastal \| European / Old World |
| Oxford | ER Vanities | Modern \| Mid-Century Modern \| Industrial \| Scandinavian |
| Windsor | ER Vanities | Traditional \| Transitional \| European / Old World |
| Kensington | ER Vanities | Traditional \| Transitional \| European / Old World |
| Dallas | Nearmé | Transitional \| Modern \| Farmhouse \| Coastal |
| Miami | Nearmé | Transitional \| Modern \| Coastal |
| New York | Nearmé | Transitional \| Farmhouse \| Industrial \| Coastal |
| Atlanta | Atlanta Vanity | Traditional \| Transitional \| European / Old World |
| Kennesaw | Atlanta Vanity | Traditional \| Transitional |
| Marietta | Atlanta Vanity | Traditional \| Transitional |

**In the enrichment script (`MODEL_STYLES` dict):**
```python
MODEL_STYLES = {
    'London':     'Transitional|Modern|Farmhouse',
    'Bristol':    'Traditional|Transitional|Coastal|European / Old World',
    'Oxford':     'Modern|Mid-Century Modern|Industrial|Scandinavian',
    'Windsor':    'Traditional|Transitional|European / Old World',
    'Kensington': 'Traditional|Transitional|European / Old World',
    'Dallas':     'Transitional|Modern|Farmhouse|Coastal',
    'Miami':      'Transitional|Modern|Coastal',
    'New York':   'Transitional|Farmhouse|Industrial|Coastal',
    'Atlanta':    'Traditional|Transitional|European / Old World',
    'Kennesaw':   'Traditional|Transitional',
    'Marietta':   'Traditional|Transitional',
}
# James Martin models: populated at import time from JM feed + JM_STYLE_MAP
```

---

---

## 18E. Taxonomy Integrity — Canonical Values, Guardrails, and Known Bugs

> **🚨 SESSION-ZERO RULE — Read before touching any import script or migration.**
> BVO taxonomy is the canonical authority. James Martin (JM) values MUST be mapped to BVO's rigid taxonomy before they are stored in the database. **JM is never the standard — BVO is.** Migration 003 contains a comment claiming "JM's field names are treated as the canonical standard" — that comment is WRONG and was superseded by the BVO taxonomy decisions documented below. Ignore it.

---

### Canonical allowed values for every filterable field

| EAV `attr_key` | BVO Canonical Values | Notes |
|---|---|---|
| `mount_type` | `Floor Standing` · `Wall Mounted` · `Pedestal` | 3 values, exact strings — no variations |
| `style` | `Traditional` · `Transitional` · `Modern` · `Farmhouse` · `Mid-Century Modern` · `Industrial` · `Coastal` · `Scandinavian` · `European / Old World` | 9 buckets (Section 18D). Multi-value: one EAV row per style |
| `sink_included` | `Yes` · `No` | bool stored as text |
| `ada_compliant` | `Yes` · `No` | bool |
| `assembly_required` | `Yes` · `No` | bool |
| `soft_close_hinges` | `Yes` · `No` | bool |
| `soft_close_slides` | `Yes` · `No` | bool |
| `adjustable_shelves` | `Yes` · `No` | bool |
| `countertop_included` | `Yes` · `No` | bool |
| `backsplash_included` | `Yes` · `No` | bool |
| `sink_type` | `Undermount` · `Vessel` · `Integrated` · `Drop-In` | capitalize consistently |
| `bowl_shape` | `Rectangular` · `Square` · `Round` · `Oval` | capitalize consistently |
| `countertop_material` | `Quartz` · `Calacatta White Quartz` · `Carrara White Quartz` · `Pure White Quartz` · `Marble` · `Granite` · `Engineered Stone` · `Cultured Marble` · `Porcelain` · `Woodgrain` | JM values accepted as-is; RFL values derived from product name |
| `vanity_type` | `Freestanding` · `Floating / Wall-Mount` · `Single Sink` · `Double Sink` · `Corner` | EAV only (attr_key = vanity_type). See products.product_type note below |
| `sink_material` | `Porcelain` · `Vitreous China` · `Ceramic` · `Acrylic` · `Quartz` · `Engineered Stone` | |
| `primary_material` | `Solid Wood, Plywood` · `Wood, MDF` · `Wood` · `Plywood` · `MDF` | multi-material uses comma-separated list |

---

### `products.product_type` — dual-purpose field

The `products.product_type` column (VARCHAR, not EAV) powers **two different things**:

1. **Category routing in importers** — resolveCategoryId() uses the JM `Product Type` raw column to assign `category_id`. This is NOT stored.
2. **"Vanity Type" sidebar filter** — `getAllAttributeValues()` reads `products.product_type` directly to populate the filter.

**BVO canonical values for `product_type` on vanities (category 1):**

| JM Product Type / Vanity Type | BVO `product_type` to store |
|---|---|
| "Vanity" or blank Vanity Type | `'Freestanding Vanity'` |
| "Floating Console" or "Console Base" | `'Floating Console'` |
| "Console" | `'Pedestal / Console'` |
| (Wall-hung detected via product name) | `'Wall-Mount Vanity'` |

**⚠️ Current bug:** The JM importer slugifies the value: `slugify('Freestanding')` → `'freestanding'`. This stores lowercase slugs in the filter sidebar, showing customers "freestanding" and "floating-console" instead of "Freestanding Vanity" and "Floating Console". Must be fixed (see Pending Fixes below).

**For RFL brands** the enriched CSV import sets product_type via `enrich_bvo_v7.py` reclassification rules (e.g., 'Mirror', 'Linen Cabinet', 'Vanity Top') — these are already human-readable and correct.

---

### `mount_type` — canonical values are NOT what JM stores

| JM importer writes | BVO canonical | Status |
|---|---|---|
| `'Wall-Mount'` | `'Wall Mounted'` | ❌ BUG — filter mismatch |
| `'Freestanding'` | `'Floor Standing'` | ❌ BUG — filter mismatch |
| *(no Pedestal)* | `'Pedestal'` | JM doesn't produce Pedestal; RFL does |

**Impact:** A customer filtering by "Floor Standing" sees only RFL products. JM Floor Standing products have `mount_type = 'Freestanding'` and are invisible to that filter.

---

### `style` — must be split, not stored raw

| JM importer current behavior | BVO required behavior |
|---|---|
| Stores raw string: `"Transitional, Traditional"` as ONE EAV row | Look up in JM_STYLE_MAP → get `"Traditional\|Transitional"` → split on `\|` → insert TWO EAV rows: `('style', 'Traditional')` + `('style', 'Transitional')` |

**Impact:** Filtering for "Traditional" returns zero JM products even when they have "Transitional, Traditional" as their theme. Filter sidebar shows raw JM strings instead of BVO style buckets.

---

### ⚠️ JM_STYLE_MAP — Completeness Guardrail

**What went wrong (July 2026):** The initial JM_STYLE_MAP only covered ~20 known theme strings. JM's feed contains many more combinations — including typo variants where JM uses periods instead of commas as delimiters (e.g. `"Contemporary/Modern, Modern Farmhouse. Transitional"` vs `"Contemporary/Modern, Modern Farmhouse, Transitional"`). When the importer encounters a string not in the map, `insertStyleAttrs()` silently does nothing — the product gets **zero style rows**, making it invisible to all style filters. This went undetected until a manual taxonomy audit.

**Rule: Run this verification query after every JM import run:**

```sql
-- Unmapped style values — should return zero rows.
-- Any row here means JM introduced a new theme string not in JM_STYLE_MAP.
SELECT DISTINCT value_text, COUNT(*) AS affected_products
FROM product_attribute_values
WHERE attr_key = 'style'
  AND value_text NOT IN (
    'Traditional','Transitional','Modern','Farmhouse',
    'Mid-Century Modern','Industrial','Coastal','Scandinavian','European / Old World'
  )
GROUP BY value_text
ORDER BY value_text;
```

If this returns any rows, do ALL of the following before the next import:

1. Decide the correct BVO bucket mapping for each unmapped string (reference Section 18D canonical list).
2. Add the mapping to `JM_STYLE_MAP` in **both** `importJamesMartinFeed.js` **and** `fixJmStyleData.js` — they must stay identical.
3. Run the targeted SQL fix in phpMyAdmin (INSERT new rows + DELETE old, using the pattern in `011_jm_full_fix_phpMyAdmin.sql` comments).
4. Re-run the verification query to confirm zero unmapped rows remain.
5. Commit both JS files together.

**JM data quality note:** JM uses commas as multi-value delimiters but sometimes substitutes periods — both with and without a trailing space (`", "` vs `". "` vs `"."`). Map **every delimiter variant explicitly** as a separate key in JM_STYLE_MAP. Do not use regex or string-splitting inside `insertStyleAttrs()` — explicit keys make the mapping auditable.

**Products with zero style rows after an import** can be found with:

```sql
-- JM products missing style entirely
SELECT p.id, p.name, p.brand
FROM products p
WHERE p.brand = 'James Martin'
  AND NOT EXISTS (
    SELECT 1 FROM product_attribute_values pav
    WHERE pav.product_id = p.id AND pav.attr_key = 'style'
  )
ORDER BY p.id;
```

---

### `vanity_type` EAV key — orphaned

The JM ATTR_MAP writes `attr_key = 'vanity_type'` to the EAV. But `attribute_definitions` has NO row for `vanity_type` — only for `product_type` (display_name = 'Vanity Type'). The `vanity_type` EAV data:
- Does appear on product detail pages (via `findBySlug` LEFT JOIN)
- Does NOT appear in the filter sidebar (not in attribute_definitions)
- Duplicates information already in `products.product_type`

**Decision needed:** Either (a) add an `attribute_definition` for `vanity_type` to make it filterable, or (b) stop writing to it and rely on `products.product_type` only. Do not resolve this ad hoc — needs owner decision.

---

### JM Importer Fixes — STATUS: ✅ FULLY RESOLVED (July 2026)

**All four bugs fixed. DB data fully cleaned.** Migration 011 + importer edits applied. Style DB cleanup completed via phpMyAdmin SQL in two passes:
- Pass 1: Ran `011_jm_full_fix_phpMyAdmin.sql` — fixed mount_type, product_type, vanity_type orphans, and the JM entries already in the original JM_STYLE_MAP.
- Pass 2: Expanded JM_STYLE_MAP to cover additional JM theme strings found during verification (`'Contemporary'`, `'Modern Luxe'`, `'Modern Farmhouse'`, `'Boho, Contemporary/Modern'`, `'Modern Farmhouse, Transitional'`, `'Transitional, Farmhouse'`, `'Farmhouse, Rustic-Modern, Contemporary/Modern'`, 3 variants of `'Contemporary/Modern, Modern Farmhouse...'`). Ran targeted INSERT+DELETE SQL for each. All style EAV rows are now valid BVO canonical buckets.

`fixJmStyleData.js` is **no longer needed for the initial cleanup** — both phpMyAdmin passes are done. The expanded map is now in both `importJamesMartinFeed.js` and `fixJmStyleData.js` for future use.

**Schema decision made:** Option B (surrogate AUTO_INCREMENT PK on `product_attribute_values`). Migration 011 added `id BIGINT AUTO_INCREMENT PRIMARY KEY`, dropped the old `(product_id, attr_key)` compound PK, and added `idx_pav_product_attr (product_id, attr_key)` index for query performance. `replaceAttr()` changed from UPSERT to DELETE+INSERT.

**What was fixed:**

**✅ Fix JM-1: `mount_type` normalization**

```javascript
// CURRENT (wrong — stores JM-native values):
const mountType = /wall/i.test(productType) ? 'Wall-Mount' : 'Freestanding';

// CORRECT — use BVO canonical values:
let mountType;
if (/wall/i.test(productType) || /wall/i.test(vanityType || '')) {
  mountType = 'Wall Mounted';
} else if (/pedestal|console/i.test(productType) || /pedestal|console/i.test(vanityType || '')) {
  mountType = 'Pedestal';
} else {
  mountType = 'Floor Standing';
}
```

**✅ Fix JM-2: `style` — split via JM_STYLE_MAP and insert multiple EAV rows**

```javascript
// Add this map at the top of the file (mirrors enrich_bvo_v7.py):
const JM_STYLE_MAP = {
  'Transitional, Traditional':         'Traditional|Transitional',
  'Modern':                            'Modern',
  'Transitional':                      'Transitional',
  'Contemporary/Modern, Transitional': 'Transitional|Modern',
  'Traditional, Transitional':         'Traditional|Transitional',
  'Traditional':                       'Traditional',
  'Modern, Transitional':              'Transitional|Modern|Mid-Century Modern|Industrial',
  'Old World':                         'Traditional|European / Old World',
};

// In the EAV attr loop, REMOVE 'style' from ATTR_MAP and handle separately:
const rawTheme = clean(row['Theme (Contemporary/Modern, Transitional, Traditional, or Commercial)']);
if (rawTheme) {
  const mapped = JM_STYLE_MAP[rawTheme];
  const styles = mapped ? mapped.split('|') : [];  // blank if not in map
  for (const s of styles) {
    // Use a compound key to allow multiple rows: (product_id, 'style_'+idx) — OR
    // better: delete all existing style rows for this product first, then re-insert:
    await conn.query(`
      DELETE FROM product_attribute_values WHERE product_id = ? AND attr_key = ?
    `, [productId, 'style']);
    for (const [idx, styleVal] of styles.entries()) {
      // NOTE: style is multi-value so we need a different PK strategy.
      // Current PK is (product_id, attr_key) — only one row per attr_key per product.
      // For multi-value style, either: (a) pipe-separate in value_text, or
      // (b) change PK to allow multiple rows. Decision needed before implementing.
    }
  }
}
```

> **✅ Schema decision made (July 2026) — Option B chosen:** Migration 011 added a surrogate `id BIGINT AUTO_INCREMENT PRIMARY KEY`, dropped the old `(product_id, attr_key)` compound PK, and added `idx_pav_product_attr (product_id, attr_key)` for lookups. `replaceAttr()` changed to DELETE+INSERT. `insertStyleAttrs()` added for multi-row style. Filter queries in `Product.js` unchanged (already used `value_text IN (...)` which now correctly matches individual style rows). Run `fixJmStyleData.js` once on the server to fix existing style data.

**✅ Fix JM-3: `product_type` — store human-readable, not slugified**

```javascript
// CURRENT (wrong):
const productType = slugify(vanityType || productTypRaw || '');

// CORRECT — keep for category routing only; store clean display value:
const productType = cleanProductType(vanityType || productTypRaw);
// Where cleanProductType() maps to BVO canonical display values (see table above)
// and resolveCategoryId() continues to use productTypRaw (unchanged)
```

---

### Rules for ALL future import scripts (any vendor)

1. **Map to BVO taxonomy before storing.** Never write vendor-native values to filterable fields (`mount_type`, `style`, `product_type`, `sink_type`, `bowl_shape`, etc.).
2. **`mount_type` always = one of:** `Floor Standing` | `Wall Mounted` | `Pedestal`
3. **`style` always =** one or more of the 9 approved BVO buckets (Section 18D). Multi-value: one EAV row per bucket (surrogate PK allows this since migration 011).
4. **`product_type` (products column) = human-readable display value**, never slugified.
5. **Check `attribute_definitions`** before adding a new EAV `attr_key`. If no definition exists, the attribute is invisible to filters. Either add the definition or don't write the attribute.
6. **Duplicate check:** Do not write the same logical fact to two different fields (e.g., `vanity_type` EAV + `product_type` column). Pick one.
7. **After every JM import run**, execute the unmapped-style verification query in Section 18E. Zero rows = clean. Any rows = stop, fix JM_STYLE_MAP in both JS files, apply targeted SQL, verify again, then commit. Never leave unmapped style values in the DB.
8. **Silent failures are the worst failures.** `insertStyleAttrs()` produces zero rows — no error, no warning — when a JM theme string is absent from JM_STYLE_MAP. The product silently disappears from all style filters. Always verify after import; never assume the map is complete after a JM feed update.

---

## 19. Competitive Reference — Ariel Bath (arielbath.com)

*Researched July 2026. Site is Next.js / client-rendered — interactive elements (hover states, mega menu animation, product image carousels) require Chrome extension to document fully. Structural analysis is confirmed. Visual/interactive items marked ⚠️ need a Chrome session to capture screenshots.*

---

### 19A. Linen Cabinet & Bridge Cabinet — How Ariel Handles It

**Direct answer to BVO's 14 Bridge/LC SKU question:** Ariel keeps linen cabinets and wall cabinets completely OUT of the vanities category.

- `Storage` (top-level nav) → sub-categories: `Linen Cabinet` + `Wall Cabinet`
- Vanity + linen tower **combo sets** get a dedicated sub-category under Vanities: `Vanity With Linen Storage` — pre-matched sets, 68–93" combined width, sold as coordinated bundles
- Standalone linen/wall cabinets stay in Storage only, never pollute the vanities collection

**BVO recommendation (pending owner decision):** Reclassify the 14 Bridge/LC SKUs out of `vanities` → `storage` category (or `accessories` short-term). Create a `vanity-with-storage` virtual cross-sell collection once linen SKUs are in the DB. See Section 10B circle-back note.

---

### 19B. Navigation Bar & Mega Menu Structure

**Top-level nav (confirmed):**
```
Bathroom Vanities | Countertops | Storage | Bathtubs | Accessories | New In | Best Sellers | Sale
```

**"Bathroom Vanities" mega menu — ✅ FULLY CAPTURED (Chrome session July 2026)**

Four-column layout + right promo panel:

| Col 1 (no header) | Col 2: Shop By Size | Col 3: Shop By Finish | Col 4: Vanity Collections |
|---|---|---|---|
| Single Sink Vanity | 30" Bathroom Vanity | Oak Vanities | Cambridge |
| Double Sink Vanity | 36" Bathroom Vanity | White Vanities | Hepburn |
| Vanity Base Cabinet | 42" Bathroom Vanity | Black Oak Vanities | Kelly |
| Vanity With Linen Storage | 48" Bathroom Vanity | Brown Oak Vanities | Taylor |
| Floating Vanity | 54" Bathroom Vanity | Blue Vanities | Stafford |
| Freestanding Vanity | 60" Bathroom Vanity | Grey Vanities | Magnolia |
| Samples | 66" Bathroom Vanity | Green Vanities | Loren |
| | 72" Bathroom Vanity | Espresso Vanities | Milan |
| | 85" Bathroom Vanity | Black Vanities | West |
| | | | Show more → |

**Right panel:** Promo image card — "Member Exclusive Deal" lifestyle photo, "Bathroom Vanities" label, "Shop All Bathroom Vanities" link.

**"Storage" dropdown:** Linen Cabinet | Wall Cabinet

**Key insight for BVO:** Four distinct shopping modes in one menu — by type/configuration, by size (30"–85"), by finish/color, and by collection. BVO should mirror this. Our current nav only has the collection track. The size track and type track are the highest-conversion paths for customers who know what they want.

**BVO mega menu plan (locked, Section 19G):** Two-track (functional + collection). Size-based filtering is high priority — add 30/36/42/48/60/72" shortcuts.

---

### 19C. Collection / Model Cards

**Confirmed card structure on `/vanities/vanity-collections`:**
- Large lifestyle image (not white-background product shot)
- Collection name as heading
- `X Sizes | Y Colors` badge — tells customer the range before clicking
- 2–3 sentence design story description
- `Read more` expand link

18 named collections each have their own URL (`/vanities/vanity-collections/{name}`) — strong SEO play, each becomes an indexable landing page.

**BVO action:** Add `X Sizes | Y Colors` sub-label to our model cards on the vanity-models page. High-value, low-effort, sets expectation before click and reduces bounce.

⚠️ *Card hover effects (overlay darkening, image swap, scroll) need Chrome session.*

---

### 19D. Product Cards (PLP — Product Listing Page)

**✅ FULLY CAPTURED (Chrome session July 2026)**

**Type filter icon row (top of /vanities listing page):**
- 7 circular icons with line-art illustrations + labels: Single Sink Vanity | Double Sink Vanity | Vanity Base Cabinet | Vanity With Linen Storage | Floating Vanity | Freestanding Vanity | Samples
- These are visual sub-category shortcuts, not filter pills — clicking navigates to a filtered URL

**Filter bar (below icon row):**
`Sort by: Most viewed | Width ▾ | Color ▾ | Counter Top Sink Number ▾ | Vanity Type ▾ | Countertop ▾ | See all filters | 361 items`

**Card layout (4-column grid):**
- "Best Seller" / badge label — top-left corner of card image
- Heart icon (outline) — top-right corner of card image → save to favorites
- Product image (white background, full-bleed)
- Sale price in red/orange + strikethrough original price
- Product name (2-line truncated)
- Color swatches (small circles) + "+N" overflow indicator
- Compare checkbox appears below card on hover

**Hover effect (confirmed):** NOT image swap.
- Left `<` and right `>` navigation arrows appear on card image — lets user browse the product's image carousel without leaving the listing page
- `+ QUICK VIEW` button appears at bottom of card image
- No image darkening, no lifestyle image swap

**BVO note:** Our existing hover effect (if any) should add the image-carousel-in-card approach. It's more functional than a simple image swap — customers can scan multiple product shots from the grid.

---

### 19E. Product Page Features

**✅ FULLY CAPTURED (Chrome session July 2026)**

**Image gallery layout:**
- **Two-column hero**: Left = product-on-white-bg (main SKU image) with "Best Seller" badge; Right = large lifestyle photo in a real bathroom setting
- **Scrollable image strip below**: Additional angles — detail shots (e.g. "AMPLE STORAGE SPACE" overlay), door-open view, additional lifestyle shots
- **Below main image**: `360° View` button + `View At Home` (AR) button
- Image gallery spans the left ~2/3 of the page; right ~1/3 is the product info panel

**Product info panel (right column, sticky):**
- SKU code
- Full product title
- Star rating + review count (Bazaarvoice)
- Sale price (red) + strikethrough original price
- Dimensions (W x D x H)
- "View the [Collection] Collection" link
- **Finish selector**: labeled "Wood Finish: Oak" — color swatch circles (White / Gray / Oak / Brown / Navy / Black / Olive); selected swatch has highlighted border; **wood swatches show grain texture** (confirms our oak swatch should do the same)
- **Countertop selector**: labeled "Countertop: Carrara White Quartz" — swatch circles

**Member/financing bar (inline, above Add to Cart):**
- "🏷 Members save an extra 5%! Log in and use MEMBERX at checkout. *Valid on orders $100 or more."
- PayPal financing: "Starting at $52.80/mo or as low as 0% APR"
- Stock indicator: green dot + "In stock"

**Accordions (expandable):** Product Overview | Description | Specification

**Bundle & Save section:**
- Header: "Bundle & Save 10% More (2 items)"
- Sub-note: "* Bundle discount cannot be combined with other promo codes."
- Each bundle item shown as: thumbnail + name + price (with strikethrough) + color label + checkbox to include/exclude + "Customize" link for finish selection
- Bundle items seen: Vanity + Wall Cabinet + Linen Cabinet (3 items possible)
- Total shown at bottom: was $X → **$X.XX** with green "Bundle Discount ($X.XX)" badge
- CTA: "ADD BUNDLE TO CART" (full-width button)

**Trust icons (4 icons, BELOW the image gallery, full content-width row):**
| Icon | Label |
|---|---|
| 🛡️ shield | Warranty included |
| ✅ badge | Satisfaction guaranteed |
| 🚚 truck | Free shipping |
| 🛒 cart | Easy returns |

**Reviews section (below trust icons):**
- "Authentic Reviews™ powered by Bazaarvoice" badge
- Rating Snapshot bar chart (1–5 stars)
- Overall rating + count
- "X of Y (Z%) reviewers recommend this product"
- "Customer Images and Videos" section

**Persistent conversion bars (top of site):**
- "Order a FREE sample — Feel the wood and shop with ease of mind" rotating announcement bar
- "Log in for an extra 5% off with code MEMBERX" — member pricing bar (rotates with sample bar)
- "96-Hour Flash Sale: Up to 20% off" — promotional bar

---

### 19F. Favorites / Wishlist — Account Creation Funnel

**Confirmed:** Heart icon in top nav (`/my-favorite`) used as the primary account creation driver.

Flow:
1. Customer clicks heart on any product card or page
2. Prompted to log in / create account
3. Immediate reward: "extra 5% off with code MEMBERX"

This converts emotionally-engaged browsers into registered customers at the highest-intent moment (when they've found a product they want). **BVO should implement this exact flow.**

**BVO implementation note:** Heart icon top-right of product card. If not authenticated → redirect to login/register with member discount offer. Wishlist stored in DB linked to user account. Owner to decide on member discount incentive amount.

---

### 19G. Owner Decisions — Locked July 2026

**1. Storage category (✅ Decided)**
Linen cabinets, hutches, makeup drawers/cabinets → `storage` category. NOT vanities. The 14 Bridge/LC RFL SKUs reclassified accordingly (see Section 10B).

**2. Vanity Sets category (✅ Decided)**
New `vanity-sets` category for curated modular combinations — products that go together to build a complete set. See Section 10B for details. Design to be finalized when first sets are ready.

**3. Navigation — Two-track mega menu (✅ Decided)**
Functional track (Single / Double / With Storage / Base Cabinet) + Collection track. To be implemented when navigation rebuild is scoped.

**4. Collection cards — Wood grain color circles (✅ Decided)**
Keep BVO's existing color/size display approach. Add one enhancement: wood tone color swatches should use a **wood grain texture effect** (not flat paint color circles) to signal to customers that the finish is a stain/wood tone vs. a painted color. Ariel does this well. Apply to `wood_l`, `wood_m`, `wood_d` color family swatches in `colorFamilies.js` and wherever swatches render.

**5. Favorites / Heart icon (✅ Must-have)**
Heart icon on product cards (top-right) and product pages. If not authenticated → redirect to login/register with member discount incentive. Wishlist stored in DB linked to user account. To be scoped as a separate feature build.

**6. Product page — 4 trust icons below images (✅ Decided)**
Below the product image gallery on every product page, show 4 trust badges as icon + label:
- 🛡️ Warranty Included
- ✅ Satisfaction Guaranteed
- 🚚 Free Shipping
- ↩️ Easy Returns
Design to match BVO brand aesthetic (not generic). Icons sit in a horizontal row below the main image block.

**7. Chrome extension for Ariel visual capture (✅ To do)**
Install Claude in Chrome extension to capture: hover card effects, mega menu layout, product page image gallery/pagination, Bundle & Save UI, and product page image zoom. Install at: https://chromewebstore.google.com/detail/fcoeoabgfenejglbffodgkkbkcdhcgfn

### 19H. Chrome Session — Capture Status

**✅ Captured July 2026:**
- Mega menu: full 4-column layout + collections list + promo panel (19B)
- Card hover effects: carousel arrows + Quick View button (19D)
- Category icon filter row on PLP (19D)
- Product page: image gallery layout (2-col hero + scrollable strip) (19E)
- Product page: Bundle & Save UI and pricing display (19E)
- Trust icons: exact labels and layout (19E)
- Member pricing / PayPal financing bars (19E)
- Collection page layout: Stafford (text-left + lifestyle-right + filter bar)

**⏳ Still to capture (lower priority):**
- Card hover: collection cards (model landing page) hover animation
- Product page: image zoom behavior (click to enlarge / pinch zoom)
- Product page: "Complete the look" / related products section (if any)
- Possible "Recently viewed" section behavior
