# BVO Issue #1 — colorFamilies.js Rollout Brief

> Rollout log for colorFamilies.js — the colour family buckets and normalisation.
## BathroomVanitiesOutlet.com — Node.js/Express/EJS storefront

> **Purpose:** Persistent cross-session log for the full colorFamilies.js rollout.
> Read this at the start of every session before taking any action.
> Path: `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO_ISSUE1_BRIEF.md`

---

## Critical Rules (never override)

| Rule | Detail |
|---|---|
| RFLPOS DB | READ-ONLY for sync — NEVER write, modify, or delete |
| Credentials | Never re-display sensitive credentials in chat |
| Logos | NEVER regenerate. Primary = BVOLOGOSQ_512.png, Round = BVOLOGOCIRCLE_2000.png |
| Navy #182840 | INK/TEXT ONLY — never as background |
| Git prefix | Always: `cd "/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js" &&` |
| Rule 1 | Read entire brief before any action; ask if assumption needed |
| Rule 2 | No action without approval — present findings first |
| Rule 3 | Forbidden from making changes based on assumptions |
| Rule 4 | Always provide exact commands in copyable code blocks |
| Rule 5 | Three fields must always stay in sync: `products.color`, `products.color_family`, `cabinet_finish` EAV |
| Rule 6 | Scope discipline — only do what current task requires |
| Rule 7 | Run post-import verification queries after every import |

---

## Architecture Overview

### Color System
- **Two-layer for Vanities:** Primary = Cabinet Color (`products.color` + `products.color_family`), Secondary = Hardware Finish (EAV `hardware_finish`)
- **Single-layer for Mirrors/Faucets/Accessories/Lighting/Storage:** the finish IS the primary color
- **`normalize(value, 'cabinet'|'metal'|'all')`** in `src/config/colorFamilies.js` — context-aware
- HW URL params: `hw_color_family` / `hw_color_exact`
- GitHub auto-deploy: git push → Hostinger deploys automatically
- Local: `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js`

### Key Files
| File | Role |
|---|---|
| `src/config/colorFamilies.js` | Canonical color taxonomy — FAMILIES, normalize(), CABINET_KEYS, METAL_KEYS |
| `src/controllers/collectionsController.js` | Builds colorFamiliesConfig, hwColorFamiliesConfig, primaryFamilyPool; parses filter params |
| `src/models/Product.js` | findByCategory() — SQL filtering using color_family + EAV hw filter (pav_hw alias) |
| `views/pages/collection.ejs` | Color swatch filter UI; hw color secondary picker; pagination |
| `src/jobs/importJamesMartinFeed.js` | James Martin XLSX importer — maps vendor colors to color_family |
| `views/pages/admin/products.ejs` | Admin import UI (existing wireImport() overlay — do not break) |

### Important Constants / Patterns
- `hwColorFilters = { families: string[], exact: string[] }` — secondary color layer
- `data-hw-color-key` / `data-hw-color-exact` — HTML data attrs for hw swatch JS
- `pav_hw` alias — used in Product.js HW filter EXISTS subquery
- `color_mappings` DB table — vendor_color → family_key persistent fallback (see Task #34-D)
- `visibleFamilies` filter in collection.ejs — `fam.members.some(m => availFinishesLower.includes(m))` — requires vendor color names in family members
- `buildPageWindow(page, pages)` — windowed pagination returning array with nulls for ellipsis
- James Martin feed columns: `Vanity Base Color/Finish` (col 134), `Hardware Finish` (col 140), `Finish/Color of Product` (col 135)

---

## Task Status

### ✅ COMPLETED

#### Task #30 — `src/config/colorFamilies.js` — Initial build
- 10 cabinet families + 7 metallic families
- Context-aware `normalize(rawValue, context='all')`
- 'Matte Black' intentionally in both `black` (cabinet) and `matte_black` (metal) families
- 'Silver' and 'Pewter' removed from gray cabinet family → moved to chrome/pewter metal families
- Exports: `FAMILIES`, `normalize`, `getFamily`, `CABINET_KEYS`, `METAL_KEYS`
- JM-specific overrides already in members (exact match beats partial): 'Silver Apricot' → wood_l, 'Champagne Tiger' → wood_l, 'Olive Ash Eclipse' → wood_d, 'Natural Ash' → wood_l

#### Task #32 — `views/pages/collection.ejs` — Full color filter rewrite (7 changes)
- Change 1: hw_color hidden inputs added to filter form
- Change 2: Condition expanded from `cabinet_finish` only to `cabinet_finish || finish`
- Change 3: Removed stale `availFinishes` override (was masking controller-passed values)
- Change 4: Replaced broken `finishHex` branch with hw color family swatch picker + `return` fallback for other color_swatch attrs
- Change 5: Sort form — added hw hidden inputs
- Change 6: Pagination filterQs — added hw params
- Change 7: Pagination current page fixed from `<a>` to semantic `<span>`
- ✅ Verification: `grep -n "finishHex"` confirmed — no finishHex in active code

#### Task #33 — `src/models/Product.js` — FINISH_HEX removed, hwColorFilters wired
- Removed entire `FINISH_HEX` constant (was lines 7-24) and its export
- Added `const { FAMILIES } = require('../config/colorFamilies');`
- Added `hwColorFilters = {}` to `findByCategory()` destructuring
- Added HW filter block after existing color family filter — uses `pav_hw` alias EXISTS subquery
  - Matches metallic family members from FAMILIES OR exact hw_color_exact strings
  - Full code block in Product.js ~line 230 area

---

### ✅ COMPLETED (continued)

#### Task #34 — Import guard + controller + colorFamilies additions

**Vendor color mapping decisions (all confirmed by user):**
| Vendor color (col 134) | Decision | Family key |
|---|---|---|
| Sable | Dark Wood | `wood_d` |
| Pistachio | Green | `green` |
| Pecan | Med Wood | `wood_m` |
| Smokey Celadon | Green (not gray) | `green` |
| Radiant Gold | Brushed gold metallic cabinet finish | `gold` (metal family) |
| Brushed Nickel (in cabinet col) | Nickel | `nickel` (metal family) |

> **Architectural note from user on Radiant Gold:** "We would need to add the metallic finish to the filter same for any vanity that has Matte Black, Brushed Nickel, or Chrome as its primary color." → Led to Change #34-C expanding primaryFamilyPool.

**Sub-tasks:**
- [x] **#34-A** `colorFamilies.js` — Add: Pistachio+Smokey Celadon→green, Pecan→wood_m, Sable→wood_d, Radiant Gold→gold
- [x] **#34-B** `importJamesMartinFeed.js` — Fix context bug + added `lookupColorMapping()` DB fallback helper (degrades gracefully if table missing)
- [x] **#34-C** `collectionsController.js` — Expanded vanity `primaryFamilyPool` to `FAMILIES` (all types)
- [x] **#34-D** SQL — `CREATE TABLE IF NOT EXISTS color_mappings` (presented for user to run on Hostinger — see below)

> **Note on Brushed Nickel:** Already in `nickel` family members — no colorFamilies.js change needed. The two-pass normalize fix in #34-B handles it correctly via `normalize(rawColor, 'cabinet') || normalize(rawColor, 'all')`.

---

### ⏳ PENDING

#### Task #35 — Admin null color_family report ✅ COMPLETE
- `GET /admin/products/color-report` — lists unmapped vendor colors grouped by color+category with product count
- `POST /admin/products/color-report` — bulk-updates `products.color_family` + upserts `color_mappings`
- View: `views/pages/admin/color-report.ejs` — dropdown per vendor color (cabinet/metal families), context selector, Apply button
- Sidebar nav link "Color Report" added to `views/layouts/admin.ejs`
- Summary cards: unmapped vendor color count, no-color-string count, saved mappings count

#### Task #36 — Git commit and deploy all Issue #1 changes ✅ COMPLETE
- Commit `84f03a0` — covers Tasks #30 #31 #32 #33 #34 #35 (793 insertions, 187 deletions, 9 files)
- Push command: `cd "/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js" && git push origin main`
- Hostinger auto-deploys on push

#### site.js — hw color filter JS handlers ✅ COMPLETE (commit a9da495)
- Add event handlers for `data-hw-color-key` and `data-hw-color-exact` data attributes
- Drives hw finish filter form submission
- Not yet started — needed for full hw color filter functionality in browser

#### Audit Issues #3–#7
- To be addressed after Issue #1 complete

---

## Color Mapping Reference — James Martin Feed

### Vanity Base Color/Finish → color_family (two-pass: cabinet first, then all)
Handled automatically by `normalize(rawColor, 'cabinet') || normalize(rawColor, 'all')` after Task #34-B.

### Hardware Finish → hardware_finish EAV (raw text, no normalize)
Stored as-is in EAV. Values include combos like 'Brushed Nickel/Matte Black/Radiant Gold' and 'N/A'.
These are filtered via hw color filter using family member substring matching at query time.

---

## Git Notes

```bash
# Always prefix with:
cd "/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js"

# Pending unpushed commit:
# 9d636fc — pagination fix (from Task #32)

# Deploy = push to GitHub (auto-deploys to Hostinger)
```

---

## color_mappings Table SQL (run on Hostinger)

```sql
CREATE TABLE IF NOT EXISTS color_mappings (
  vendor_color VARCHAR(255) NOT NULL,
  context      VARCHAR(20)  NOT NULL DEFAULT 'cabinet',
  family_key   VARCHAR(50)  NOT NULL,
  notes        VARCHAR(255) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (vendor_color, context)
);
```

---

*Last updated: Session — Issue #1 fully complete including site.js hw filter JS (commit a9da495). Two commits pending push: 84f03a0 + a9da495. Audit issues #3–#7 are next.*
