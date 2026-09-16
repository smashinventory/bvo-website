# Shopify Catalog Import — Standing Rules & Project Brief

> Standing rules for importing the Shopify catalogue.

Reusable playbook for loading supplier product feeds into Shopify.
First written Aug 23, 2026 during the James Martin (JMV) vanity catalog load.
Separate from `SESSION_BRIEF_2026-08-18.md`, which covers the RFL POS work only.

Store handle: `reno4lessroswell` (API address — the `.myshopify.com` name)
Storefront: **GlobalValueSupply.com** · **Single location** as of Aug 24, 2026

---

## 1. INVENTORY DISPLAY CAPPING RULE  ← apply to every supplier feed

Supplier feeds carry the **vendor's warehouse availability**, not what we own.
Publishing those raw makes the storefront claim tens of thousands of units and
destroys any chance of reconciling against the POS. Never load a feed quantity
straight through. Compress it with this ladder:

| Feed qty | Shopify shows |
|---|---|
| 0 – 3 | the true number (0, 1, 2, 3) |
| 4 – 6 | 4 |
| 7 – 9 | 5 |
| 10 – 12 | 6 |
| 13 – 20 | 7 |
| 21 or more | 8 |

Effect on the JMV load: **81,273 raw units → 24,979 displayed** across 4,476 SKUs.
Reads as a credible showroom, still signals "we have plenty," and never
advertises a number we would struggle to source.

Reference implementation:

```python
def cap(q):
    q = int(float(q or 0))
    if q <= 3:  return q
    if q <= 6:  return 4
    if q <= 9:  return 5
    if q <= 12: return 6
    if q <= 20: return 7
    return 8
```

Two guards that go with it:

- **True zeros stay zero.** 0–3 passes through untouched, so a genuinely
  out-of-stock SKU is never inflated into looking available.
- **Only stamp quantity on variant rows.** Extra image rows carry a Handle but
  no SKU. Gate the write on `SKU != ''`, or you will write "0" into ~49K image
  rows. (Cost us a rebuild on the JMV load.)

---

## 2. HARD-WON SHOPIFY GOTCHAS

### 2a. Inventory + the single-location decision
The product template's `Inventory quantity` column **applies only to
single-location stores**. With more than one location Shopify silently ignores
it and defaults every product to 0 — no error, no warning.

**Aug 23–24, 2026: we went single-location.** The multi-store setup was retired;
one location remains. Quantity now rides in the product CSV and there is **no
separate inventory import** on the normal path. Nightly stock/price updates run
through `jmv_sync/` (see its SETUP.md) rather than any CSV.

**One store, four names.** All the same store — the admin URL slug and the
`.myshopify.com` subdomain are independent and do NOT have to match:

| Name | Value | Used for |
|---|---|---|
| Admin URL slug | `reno4lessroswell` | `admin.shopify.com/store/…` (the DBA) |
| Store display name | Renovate for Less Outlet | Shopify's fallback Vendor on CSV import |
| Primary domain | `globalvaluesupply.com` | the storefront |
| **API address** | **`global-vehicle-supply`** | **all code / API config** |

Only the `.myshopify.com` name works for API calls. And the display name is why
a Vendor-less CSV preview shows "Renovate for Less Outlet".

If a second location is ever added back, quantity stops importing again and
stock has to go through Products → **Inventory** → Import with its own file:

```
Handle, Title, Option1 Name, Option1 Value, SKU, <EXACT LOCATION NAME>
```

The location **is** the column header, matched character-for-character
("Roswell" is not the name — the full street address is). Fallback files kept:
`JMV_Inventory_Import.csv`, `JMV_Inventory_TEST_20.csv`.

**Do not load an inventory file through Products → Import.** The product
importer accepts it, shows Vendor as the store name and Price $0.00, and
**overwrites matching handles** — wiping descriptions, category, type, color and
price. Cancel that screen if Vendor or Price look wrong.

### 2b. `Color (product.metafields.shopify.color-pattern)` is a metaobject reference
It rejects free text. Writing raw finish names ("Seaside Oak", "Bright White")
failed **2,063 of 2,238 products** with *"Validation failed: Value require that
you select a metaobject."* The 175 that survived were the standalone tops — the
only rows with a blank color. That 1:1 split is what identified the column.

Accepted values are the standard color handles, lowercase: `black`, `blue`,
`beige`, `brown`, `gray`, `green`, `white`, etc. **Verified working** on the
20-product test.

Mapping rule agreed with owner: **all woods → `brown`**; everything else to its
base color. The JMV mapping (33 finishes) is in §3.

Keep the descriptive finish name in **Tags** so nothing is lost — it stays
searchable and drives collection rules:
`Freestanding, Solene, Component, Bathroom Vanity, Seaside Oak`

### 2c. Single-variant products need `Title` / `Default Title`
For a product with no options, the CSV **must** carry
`Option1 name = Title` and `Option1 value = Default Title`.
Leave them blank and the variant never binds — and **price and inventory both
live on the variant**, so both land empty/0 while everything product-level
(title, category, type, vendor, tags, color) imports perfectly. That split is
the tell: *product-level fields fine, variant-level fields zero → check the
option columns.* Set these on every row that has a SKU, and on the matching
inventory-CSV rows too.

### 2d. Product category must be a full Shopify taxonomy path
Not a bare label. Ours: `Furniture > Cabinets & Storage > Vanities > Bathroom Vanities`

### 2e. File size limits
- Device commit caps at **20 MB per file** → split large catalogs.
- **Split on product-handle boundaries only.** Splitting mid-product orphans
  the image rows and breaks the gallery.
- JMV: 21.7 MB master → two parts, 11.3 MB + 10.4 MB.

---

## 3. JMV COLOR MAP (33 finishes → 7 handles)

| → handle | Finishes | Products |
|---|---|---|
| `brown` | Amber Birch, Burnished Mahogany, Carbon Oak, Chestnut, Coastal Driftwood, Honey Oak, Light Natural Oak, Mid-Century Acacia, Mid-Century Walnut, Pebble Oak, Pecan, Sable, Sable Oak, Saddle Brown, Seaside Oak, Silver Oak, Sunwashed Oak (+Shagreen), Walnut Whisper, Weathered Oak, Whitewashed Oak, Whitewashed Walnut | 2,733 |
| `white` | Bright White, Glossy White, Polished White and Light Mappa Burl | 806 |
| `green` | Smokey Celadon, Sage Green, Pistachio | 307 |
| `black` | Black Onyx | 264 |
| `blue` | Serenity Blue, Victory Blue | 188 |
| `gray` | Urban Gray | 98 |
| `beige` | Dune Mist | 27 |

Two judgment calls, revisit if they look wrong on the storefront:
`Dune Mist → beige` (neither wood nor obvious base color) and
`Smokey Celadon → green` (pale green-gray, 256 products).

---

## 4. PRODUCT SCOPE — what we load and sync

**Selection rule (the source of truth):** feed column 5 `Product Type` must be
one of **`Vanity`, `Cabinet`, `Top`**. Everything else is excluded.

Bathroom vanities, vanity cabinets and vanity tops only — no mirrors, no
accessories, at least for now. Applied identically by the catalog CSV build and
by the nightly `jmv_sync` job, so the two can never drift.

| Feed Product Type | In scope | Count (2026-08-24 feed) |
|---|---|---|
| Vanity | ✅ | 4,212 |
| Cabinet | ✅ | 332 |
| Top | ✅ | 203 |
| Mirror, Backsplash, Wood/Stone/Metal Sample, Side Cabinet, Countertop Unit, Metal Base, Drawer Unit, Floating Console, Console, Shelf, Hutch, Console Base, Knobs and Legs, Storage Cabinet, Linen Cabinet, Pull, Bench | ❌ | 471 total |

Note `Side Cabinet`, `Linen Cabinet` and `Storage Cabinet` are distinct types
from `Cabinet` and are **excluded** — only plain `Cabinet` is a vanity cabinet.

**To add a category later:** add its exact Product Type string to `ALLOWED_TYPES`
in `jmv_sync/jmv_shopify_sync.php` **and** load those products into Shopify
first. The sync only updates SKUs that already exist there — it never creates
products.

The feed grows: it held 4,476 in-scope SKUs at the Aug 22 catalog build and
4,747 by Aug 24. New in-scope SKUs are ignored by the sync until they're loaded
into Shopify (per §2a), so periodically re-run the catalog build to pick them up.

---

## 4b. STANDING FIELD DEFAULTS (JMV load)

| Field | Value |
|---|---|
| Vendor | James Martin |
| Product category | Furniture > Cabinets & Storage > Vanities > Bathroom Vanities |
| Type | `Vanity, Bathroom Vanity` (4,048) · `Cabinet, Bathroom Vanity` (253) · `Top, Vanity Top` (175) |
| Age group / Gender / Condition | Adult / Unisex / NEW |
| Inventory tracker | shopify |
| Continue selling when out of stock | Deny |
| Fulfillment service | manual |
| Weight unit | lb |
| First feed image | Image position 1 |

---

## 5. THE METHOD THAT ACTUALLY SAVES TIME

Both failures above were format guesses that only surfaced after a full import.
The pattern that beat them:

1. **Never full-import an unverified format.** Build a **20-product test file**
   first — 84 KB, imports in seconds, costs one minute.
2. **When a format is unknown, make Shopify tell you.** Set the field by hand on
   one product in admin, export that product, read the exact string it wrote.
   Same for locations: export the inventory CSV and copy the header verbatim.
3. **Check a variant-level field, not just the product list.** Product-level
   fields can all look right while price and inventory are silently empty.
4. **Read the import preview before confirming.** It reports how many rows
   matched a variant. Far below expected = handles didn't match; cancel there.
5. **Let the error arithmetic point at the column.** 2,063 failed / 175 passed
   matched the color-filled / color-blank split exactly. Counting the two groups
   found the bad column faster than reading 1,000 log lines.

---

## 6. FILE INVENTORY (in OnlineSmartPOS)

| File | Purpose |
|---|---|
| `Product_Template_JMV_8_22_2026_COLOR_part1.csv` | Products 1–2,238 — import 1st |
| `Product_Template_JMV_8_22_2026_COLOR_part2.csv` | Products 2,239–4,476 — import 2nd |
| `JMV_Inventory_Import.csv` | 4,476 rows, 24,979 capped units → Roswell — import 3rd |
| `JMV_Inventory_TEST_20.csv` | 20-row inventory smoke test |
| `Product_Template_TEST_20.csv` | 20-product catalog smoke test (already imported) |
| `Product_Template_JMV_8_22_2026_part1/2.csv` | Fallback: blank color column, imports clean |

## 7. OPEN ITEMS
1. Confirm the 20-row inventory test lands before running all 4,476.
2. Verify Fulfillment → "Use inventory at this location to fulfill online
   orders" is on for the Roswell location (appeared off; Shopify locks this
   control on the default location, so likely fine — check if items import with
   stock but still read unavailable).
3. 153 products have no description; 8 have no images.
4. Google product category for the 175 standalone tops (currently inherits
   Bathroom Vanities).
5. Tops have no color value — `Countertop Finish` is available if we want to
   map them later.
