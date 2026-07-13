# James Martin Etail Feed — BVO Schema Analysis
*Reference: `James Martin - Etail Feed_2025_08_07.xlsx` · 231 columns · "Etail Products" sheet*

---

## 1. Purpose Classification of All 231 Columns

James Martin's feed is a flat single-table export covering seven distinct concerns. We keep these concerns separated in BVO's relational schema rather than flattening them.

### 1A · Core Catalog Identity (13 columns)
| JM Column | Maps To | Notes |
|---|---|---|
| Item Number | `products.sku` | Primary vendor SKU |
| Product Category | `categories.name` | Lookup/FK |
| Item Status | `products.is_active` | Active → 1, else 0; add `status` enum |
| Product Type | `products.product_type` | Machine-key slug |
| Vanity Type | `products.product_type` (refined) | More specific than Product Type; use as product_type when present |
| Group Number | `products.collection_id` | Groups variants and related pieces |
| Product Name | `products.name` | |
| MAP Price | `products.price` | Minimum Advertised Price = floor price |
| MSRP | `products.compare_price` | Crossed-out "was" price |
| Collection Name | `collections.name` (new table) | Named design collection |
| Group/Component | `products.component_role` | "Vanity", "Top", "Mirror", etc. |
| Mfg Name | `brands.name` (or `products.brand`) | Always "James Martin" in this feed |
| Release Date | `products.release_date` | |

### 1B · Marketing Copy (15 columns)
| JM Column | Maps To | Notes |
|---|---|---|
| One Paragraph Product Description | `products.description` | Full HTML-safe paragraph |
| One Paragraph Collection Description | `collections.description` | Shared across group |
| Optional Accessories | `product_accessories.accessory_sku` | Comma-delimited in JM; we normalize to rows |
| Bullet Feature 1–12 | `product_bullets` table | 12-slot array; store as ordered JSON or separate table |
| Theme | `product_attribute_values` (attr_key: `style`) | Contemporary/Modern · Transitional · Traditional · Commercial |

### 1C · Shipping & Logistics (106 columns — the heaviest section)
James Martin ships vanities in up to 14 component box types, each with up to 2 boxes (H/W/D/Weight/Cubes = 5 fields × 14 types × 2 boxes = 140 potential cells, ~106 actually populated).

**Component box types seen:**
Vanity Cabinet · Vanity Top · Sink · Mirror · Vanity Base · Backsplash · Bench · Storage Cabinet · Shelf · Drawer Unit · Pulls · Linen Cabinet · Hutch · Knobs and Legs

**Maps To:** `product_shipping_boxes` table (see §3)

| JM Column | Maps To |
|---|---|
| Total Shipping Weight | `products.total_ship_weight_lbs` |
| Ships LTL or Ground? | `products.ships_ltl` (boolean) |
| Harmonized Code | `products.harmonized_code` |
| Freight Class | `products.freight_class` |
| In Stock Lead Time | `products.lead_time_days` |

### 1D · Physical & Construction Attributes (30 columns → EAV)
These become `product_attribute_values` rows keyed by `attr_key`. The `attribute_definitions` table already exists — we add rows for any missing keys.

| JM Column | `attr_key` | `filter_type` | Category |
|---|---|---|---|
| Vanity Base Color/Finish | `cabinet_finish` | color_swatch | Vanity |
| Finish/Color of Product | `finish` | color_swatch | Mirror/Faucet/etc |
| Distressed Finish? | `distressed_finish` | boolean | Vanity |
| Hardware Finish | `hardware_finish` | color_swatch | Vanity |
| Vanity Countertop Material | `countertop_material` | checkbox | Vanity |
| Countertop Finish | `countertop_finish` | checkbox | Vanity |
| Countertop Thickness | `countertop_thickness` | range | Vanity |
| Primary Construction Material | `primary_material` | checkbox | All |
| Construction Material | `construction_material` | checkbox | All |
| Product Height | `height_in` | range | All |
| Product Width | `size_in` | range | All (primary size filter) |
| Product Depth | `depth_in` | range | All |
| Product Weight | `weight_lbs` | range | All |
| Assembly Required? | `assembly_required` | boolean | All |
| Number of Shelves | `num_shelves` | range | Vanity/Storage |
| Adjustable Shelves? | `adjustable_shelves` | boolean | Vanity/Storage |
| Number of Doors | `num_doors` | range | Vanity |
| Soft Close Hinges? | `soft_close_hinges` | boolean | Vanity |
| Number of Drawers | `num_drawers` | range | Vanity |
| Number of Tip Out Style Drawers | `tip_out_drawers` | range | Vanity |
| Soft Close Slides? | `soft_close_slides` | boolean | Vanity |
| Backsplash Included? | `backsplash_included` | boolean | Vanity |
| Backsplash Material | `backsplash_material` | checkbox | Vanity |
| Drawer Organizer | `drawer_organizer` | boolean | Vanity |
| Drawer Box | `drawer_box_material` | checkbox | Vanity |
| Includes Makeup Counter and Top? | `has_makeup_counter` | boolean | Vanity |
| ADA Compliant? | `ada_compliant` | boolean | All |
| Electrical component? | `has_electrical` | boolean | All |
| FreePower Compatible? | `freepower_compatible` | boolean | Vanity |
| Wireless Charging Unit? | `wireless_charging` | boolean | Vanity |

### 1E · Sink Attributes (10 columns → EAV, Vanity-specific)
| JM Column | `attr_key` | Notes |
|---|---|---|
| Number of Sinks Included | `sink_count` | 0, 1, or 2 |
| Bowl Shape | `bowl_shape` | Rectangle · Oval · Square |
| Sink has Overflow Drain? | `sink_overflow` | boolean |
| Drain Included? | `drain_included` | boolean |
| Sink Installation Type | `sink_installation` | Undermount · Drop-in · Vessel |
| Sink Material | `sink_material` | Porcelain · Ceramic · Stone · etc |
| Sink Back to Front | `sink_depth_in` | numeric range |
| Sink Width | `sink_width_in` | numeric range |
| Sink Depth | `sink_basin_depth_in` | numeric range |
| Center to Center Hole Spacing | `faucet_spread_in` | numeric; faucet deck hole spacing |

### 1F · Compliance & Certifications (16 columns → separate table)
| JM Column | `cert_type` | `cert_field` |
|---|---|---|
| Country of Origin | — | `products.country_origin` |
| Product Warranty | — | `products.warranty` |
| ADA Compliant? | `ADA` | boolean on product |
| Prop 65 Warning? | `PROP65` | `products.prop65` boolean |
| UL Certification? | `UL` | `product_certifications.cert_type` |
| James Martin UL Part Number | `UL` | `product_certifications.cert_number` |
| UL Part Number | `UL` | (secondary) |
| UL Factory/Expiration Date | `UL` | `product_certifications.expires_at` |
| UPC Certification? | `UPC` | same pattern |
| UPC Part Number | `UPC` | |
| UPC Factory/Expiration Date | `UPC` | |
| CUPC Certification? | `CUPC` | |
| CUPC Part Number | `CUPC` | |
| CUPC Factory/Expiration Date | `CUPC` | |
| UPC Code | — | `products.upc` |
| Wireless Charging Unit certifications | `FC`, `UL` | separate rows |

### 1G · Related SKUs / Component Cross-References (5 columns)
| JM Column | Maps To |
|---|---|
| Top Reference SKU 1 & 2 | `product_components` table, `component_role: 'top'` |
| Sink Reference SKU | `product_components`, `component_role: 'sink'` |
| Component 1 & 2 Reference SKU | `product_components`, `component_role: 'component'` |
| Optional Accessories | `product_accessories`, separate from components |

### 1H · Documents (5 columns → `product_documents` table)
| JM Column | `doc_type` |
|---|---|
| SPEC Sheet | `spec_sheet` |
| Top SPEC Sheet | `top_spec_sheet` |
| Component SPEC Sheet | `component_spec_sheet` |
| Assembly Instructions | `assembly_instructions` |
| Assembly Instructions.1 | `assembly_instructions_2` |

### 1I · Images (30 columns → `product_images` table)
Images.0 through Images.29 → rows in `product_images (product_id, url, sort_order, is_primary)`.
Up to 30 images per SKU. `is_primary = 1` where `sort_order = 0`.

---

## 2. What James Martin Gets Right

- **Finish separation**: `Vanity Base Color/Finish` + `Hardware Finish` as distinct fields — validates our `cabinet_finish` / `hardware_finish` split perfectly.
- **Component boxing detail**: shipping data broken out by component type is critical for accurate LTL quoting and damage liability.
- **12 bullet features**: lets marketers load features for every product type without truncation.
- **Group Number system**: cleanly links variants, tops, sinks, and mirrors into a product family.
- **Certification tracking with expiry dates**: critical for compliance (UL certifications expire; outdated products can't legally ship).
- **FreePower / wireless charging fields**: forward-thinking — new tech features are already in the feed.

---

## 3. Where BVO Improves on James Martin

| JM Weakness | BVO Improvement |
|---|---|
| **231 flat columns** — adding a new attribute requires a schema change and re-exporting | **EAV `product_attribute_values`** — add new attributes without touching the schema; new suppliers map to same attribute keys |
| **Shipping columns are sparse** — most rows have only 1-2 box types populated, other 100+ columns are NULL | **`product_shipping_boxes` table** — only rows that exist; zero NULL columns |
| **Images as 30 flat columns** — hard to query, impossible to add alt text or captions | **`product_images` table** — queryable, sortable, extensible with `alt_text`, `color_context` |
| **Certifications as flat columns** — non-extensible, can't add new cert type without schema change | **`product_certifications` table** — add any cert type; store expiry for automated warnings |
| **No `color_hex`** — no machine-readable color values for swatch rendering | **`finish_colors` DB table + `FINISH_HEX` map** — CSS swatches rendered server-side |
| **"Optional Accessories" as comma-delimited string** | **`product_accessories` table** — proper FK relationships, bidirectional |
| **No `sort_weight`** — can't control merchandising order in search results | **`sort_weight` = `is_featured×10 + is_new×5 + stock`** — merchandising without re-indexing |
| **No SEO fields** | **`products.meta_title`, `meta_description`, `canonical_url`** + JSON-LD in templates |
| **Collection description duplicated per-row** | **`collections` table** — single source of truth; collection page, breadcrumb, and SEO all pull from one place |
| **Theme is a single field** — only one style tag | **EAV `style` attribute** — can be multi-value; a product can be "Transitional" AND "Farmhouse" |

---

## 4. New Tables Needed (Migration 003)

```sql
-- Product collections (named design families)
CREATE TABLE collections (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug          VARCHAR(120) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  brand         VARCHAR(100),
  description   TEXT,
  image_url     VARCHAR(500),
  is_active     TINYINT(1) DEFAULT 1,
  sort_order    SMALLINT DEFAULT 0
);

-- Per-box shipping dimensions
CREATE TABLE product_shipping_boxes (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id      INT UNSIGNED NOT NULL,
  component_type  VARCHAR(60) NOT NULL,   -- 'vanity_cabinet','vanity_top','sink','mirror','base', etc.
  box_number      TINYINT DEFAULT 1,      -- 1 or 2
  ship_height_in  DECIMAL(8,2),
  ship_width_in   DECIMAL(8,2),
  ship_depth_in   DECIMAL(8,2),
  gross_weight_lbs DECIMAL(8,2),
  cubes           DECIMAL(8,3),
  INDEX (product_id, component_type)
);

-- Compliance certifications
CREATE TABLE product_certifications (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  cert_type   VARCHAR(20) NOT NULL,       -- 'UL','UPC','CUPC','ADA','PROP65','FC'
  cert_number VARCHAR(120),
  factory_ref VARCHAR(120),
  expires_at  DATE,
  INDEX (product_id, cert_type)
);

-- Product documents / PDFs
CREATE TABLE product_documents (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  doc_type    VARCHAR(40) NOT NULL,       -- 'spec_sheet','assembly_instructions','top_spec_sheet'
  url         VARCHAR(500) NOT NULL,
  label       VARCHAR(120),
  INDEX (product_id)
);

-- Component relationships (top, sink, base linked to vanity)
CREATE TABLE product_components (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_sku      VARCHAR(80) NOT NULL,
  component_sku   VARCHAR(80) NOT NULL,
  component_role  VARCHAR(40) NOT NULL,   -- 'top','sink','mirror','base','component'
  INDEX (parent_sku),
  INDEX (component_sku)
);

-- Accessory cross-links
CREATE TABLE product_accessories (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_sku    VARCHAR(80) NOT NULL,
  accessory_sku  VARCHAR(80) NOT NULL,
  INDEX (product_sku),
  INDEX (accessory_sku)
);

-- Bullet features (ordered list per product)
CREATE TABLE product_bullets (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  sort_order  TINYINT DEFAULT 0,
  bullet_text TEXT NOT NULL,
  INDEX (product_id)
);

-- Additional columns on products table (ALTER):
-- ALTER TABLE products ADD COLUMN collection_id INT UNSIGNED AFTER category_id;
-- ALTER TABLE products ADD COLUMN component_role VARCHAR(40);
-- ALTER TABLE products ADD COLUMN upc VARCHAR(30);
-- ALTER TABLE products ADD COLUMN country_origin VARCHAR(60);
-- ALTER TABLE products ADD COLUMN warranty VARCHAR(120);
-- ALTER TABLE products ADD COLUMN lead_time_days SMALLINT;
-- ALTER TABLE products ADD COLUMN ships_ltl TINYINT(1) DEFAULT 0;
-- ALTER TABLE products ADD COLUMN freight_class VARCHAR(10);
-- ALTER TABLE products ADD COLUMN harmonized_code VARCHAR(20);
-- ALTER TABLE products ADD COLUMN total_ship_weight_lbs DECIMAL(8,2);
-- ALTER TABLE products ADD COLUMN prop65 TINYINT(1) DEFAULT 0;
-- ALTER TABLE products ADD COLUMN release_date DATE;
-- ALTER TABLE products ADD COLUMN status ENUM('active','discontinued','coming_soon','special_order') DEFAULT 'active';
-- ALTER TABLE products ADD COLUMN meta_title VARCHAR(255);
-- ALTER TABLE products ADD COLUMN meta_description VARCHAR(320);
```

---

## 5. Additional `attribute_definitions` Seeds (for Migration 003)

These fill out the EAV filter sidebar for vanities beyond what Migration 002 seeded:

| `attr_key` | `display_name` | `filter_type` | `category_id` | `sort_order` |
|---|---|---|---|---|
| `countertop_material` | Countertop Material | checkbox | 1 (Vanities) | 5 |
| `sink_count` | Number of Sinks | checkbox | 1 | 6 |
| `soft_close_hinges` | Soft-Close Hinges | boolean | 1 | 7 |
| `soft_close_slides` | Soft-Close Drawers | boolean | 1 | 8 |
| `backsplash_included` | Backsplash Included | boolean | 1 | 9 |
| `ada_compliant` | ADA Compliant | boolean | NULL (global) | 10 |
| `assembly_required` | Assembly Required | boolean | NULL | 11 |
| `num_drawers` | Number of Drawers | range | 1 | 12 |
| `wireless_charging` | Wireless Charging | boolean | 1 | 13 |
| `bowl_shape` | Bowl Shape | checkbox | 1 | 14 |
| `sink_material` | Sink Material | checkbox | 1 | 15 |
| `primary_material` | Construction Material | checkbox | NULL | 16 |
| `distressed_finish` | Distressed Finish | boolean | 1 | 17 |

---

## 6. Column → Field Mapping Reference (for Importer Script)

```js
// src/jobs/importJamesMartinFeed.js — column mapping object
const JM_MAP = {
  // ── Products table ──────────────────────────────────────────────
  'Item Number':                         { table: 'products', col: 'sku' },
  'Product Name':                        { table: 'products', col: 'name' },
  'MAP Price':                           { table: 'products', col: 'price', type: 'decimal' },
  'MSRP':                                { table: 'products', col: 'compare_price', type: 'decimal' },
  'Item Status':                         { table: 'products', col: 'status', transform: statusMap },
  'Product Type':                        { table: 'products', col: 'product_type', transform: slugify },
  'Vanity Type':                         { table: 'products', col: 'product_type', transform: slugify, priority: 2 },
  'Group Number ':                       { table: 'products', col: 'vendor_group_id' },
  'Group/Component':                     { table: 'products', col: 'component_role' },
  'One Paragraph Product Description ':  { table: 'products', col: 'description' },
  'Release Date':                        { table: 'products', col: 'release_date', type: 'date' },
  'UPC Code':                            { table: 'products', col: 'upc' },
  'Country of Origin':                   { table: 'products', col: 'country_origin' },
  'Product Warranty':                    { table: 'products', col: 'warranty' },
  'In Stock Lead Time':                  { table: 'products', col: 'lead_time_days', type: 'int' },
  'Ships LTL or Ground?':               { table: 'products', col: 'ships_ltl', transform: ltlMap },
  'Freight Class':                       { table: 'products', col: 'freight_class' },
  'Harmonized Code':                     { table: 'products', col: 'harmonized_code' },
  'Total Shipping Weight':               { table: 'products', col: 'total_ship_weight_lbs', type: 'decimal' },
  'Prop 65 Warning? (Y/N)':             { table: 'products', col: 'prop65', transform: yesNo },
  'Mfg Name':                            { table: 'products', col: 'brand' },
  'Images':                              { table: 'product_images', col: 'url', sort_order: 0 },

  // ── EAV attributes ──────────────────────────────────────────────
  'Vanity Base Color/Finish':            { table: 'attr', key: 'cabinet_finish' },
  'Finish/Color of Product':             { table: 'attr', key: 'finish' },
  'Hardware Finish':                     { table: 'attr', key: 'hardware_finish' },
  'Distressed Finish? (Y/N)':           { table: 'attr', key: 'distressed_finish', transform: yesNo },
  'Vanity Countertop Material ':         { table: 'attr', key: 'countertop_material' },
  'Countertop Finish':                   { table: 'attr', key: 'countertop_finish' },
  'Countertop Thickness':                { table: 'attr', key: 'countertop_thickness', type: 'num' },
  'Primary Construction Material':       { table: 'attr', key: 'primary_material' },
  'Construction Material':               { table: 'attr', key: 'construction_material' },
  'Product Height':                      { table: 'attr', key: 'height_in', type: 'num' },
  'Product Width':                       { table: 'attr', key: 'size_in', type: 'num' },
  'Product Depth':                       { table: 'attr', key: 'depth_in', type: 'num' },
  'Product Weight':                      { table: 'attr', key: 'weight_lbs', type: 'num' },
  'Assembly Required? (Y/N)':           { table: 'attr', key: 'assembly_required', transform: yesNo },
  'Number of Shelves':                   { table: 'attr', key: 'num_shelves', type: 'num' },
  'Adjustable Shelves (Y/N)':           { table: 'attr', key: 'adjustable_shelves', transform: yesNo },
  'Number of Doors':                     { table: 'attr', key: 'num_doors', type: 'num' },
  'Soft Close Hinges? (Y/N)':           { table: 'attr', key: 'soft_close_hinges', transform: yesNo },
  'Number of Drawers':                   { table: 'attr', key: 'num_drawers', type: 'num' },
  'Number of Tip Out Style Drawers':     { table: 'attr', key: 'tip_out_drawers', type: 'num' },
  'Soft Close Slides? (Y/N)':           { table: 'attr', key: 'soft_close_slides', transform: yesNo },
  'Backsplash Included? (Y/N)':         { table: 'attr', key: 'backsplash_included', transform: yesNo },
  'Backsplash Material':                 { table: 'attr', key: 'backsplash_material' },
  'Drawer Organizer':                    { table: 'attr', key: 'drawer_organizer', transform: yesNo },
  'Number of Sinks Included (0, 1, or 2)': { table: 'attr', key: 'sink_count', type: 'num' },
  'Bowl Shape':                          { table: 'attr', key: 'bowl_shape' },
  'Sink has Overflow Drain?':           { table: 'attr', key: 'sink_overflow', transform: yesNo },
  'Drain Included?':                     { table: 'attr', key: 'drain_included', transform: yesNo },
  'Sink Installation Type ':             { table: 'attr', key: 'sink_installation' },
  'Sink Material ':                      { table: 'attr', key: 'sink_material' },
  'Sink Back to Front':                  { table: 'attr', key: 'sink_depth_in', type: 'num' },
  'Sink Width':                          { table: 'attr', key: 'sink_width_in', type: 'num' },
  'Sink Depth':                          { table: 'attr', key: 'sink_basin_depth_in', type: 'num' },
  'Center to Center Hole Spacing (Spacing from furthest left Faucet Handle to Furthest Right Faucet Handle)':
                                         { table: 'attr', key: 'faucet_spread_in', type: 'num' },
  'ADA Compliant?':                      { table: 'attr', key: 'ada_compliant', transform: yesNo },
  ' Electrical component (Y/N)':        { table: 'attr', key: 'has_electrical', transform: yesNo },
  'FreePower Compatible?':               { table: 'attr', key: 'freepower_compatible', transform: yesNo },
  'Wireless Charging Unit (Y/N)':       { table: 'attr', key: 'wireless_charging', transform: yesNo },
  'Theme (Contemporary/Modern, Transitional, Traditional, or Commercial)':
                                         { table: 'attr', key: 'style' },
  'Includes Makeup Counter and Top (Y/N)': { table: 'attr', key: 'has_makeup_counter', transform: yesNo },

  // ── Collections ─────────────────────────────────────────────────
  'Collection Name':                     { table: 'collections', col: 'name' },
  'One Paragraph Collection Description':{ table: 'collections', col: 'description' },

  // ── Bullets ─────────────────────────────────────────────────────
  'Bullet Feature 1':   { table: 'product_bullets', sort_order: 1 },
  'Bullet Feature 2':   { table: 'product_bullets', sort_order: 2 },
  'Bullet Feature 3':   { table: 'product_bullets', sort_order: 3 },
  'Bullet Feature 4':   { table: 'product_bullets', sort_order: 4 },
  'Bullet Feature 5':   { table: 'product_bullets', sort_order: 5 },
  'Bullet Feature 6':   { table: 'product_bullets', sort_order: 6 },
  'Bullet Feature 7':   { table: 'product_bullets', sort_order: 7 },
  'Bullet Feature 8':   { table: 'product_bullets', sort_order: 8 },
  'Bullet Feature 9':   { table: 'product_bullets', sort_order: 9 },
  'Bullet Feature 10':  { table: 'product_bullets', sort_order: 10 },
  'Bullet Feature 11':  { table: 'product_bullets', sort_order: 11 },
  'Bullet Feature 12':  { table: 'product_bullets', sort_order: 12 },

  // ── Certifications ───────────────────────────────────────────────
  'UL Certification?':                   { table: 'cert', type: 'UL', field: 'has_cert' },
  'James Martin UL Part Number':         { table: 'cert', type: 'UL', field: 'cert_number' },
  'UL Part Number':                      { table: 'cert', type: 'UL', field: 'alt_number' },
  'UL Factory/Expiration Date':          { table: 'cert', type: 'UL', field: 'expires_at' },
  'UPC Certification?':                  { table: 'cert', type: 'UPC', field: 'has_cert' },
  'UPC Part Number':                     { table: 'cert', type: 'UPC', field: 'cert_number' },
  'UPC Factory/Expiration Date':         { table: 'cert', type: 'UPC', field: 'expires_at' },
  'CUPC Certification?':                 { table: 'cert', type: 'CUPC', field: 'has_cert' },
  'CUPC Part Number':                    { table: 'cert', type: 'CUPC', field: 'cert_number' },
  'CUPC Factory/Expiration Date':        { table: 'cert', type: 'CUPC', field: 'expires_at' },

  // ── Documents ────────────────────────────────────────────────────
  'SPEC Sheet':                          { table: 'product_documents', type: 'spec_sheet' },
  'Top SPEC Sheet':                      { table: 'product_documents', type: 'top_spec_sheet' },
  'Component SPEC Sheet':                { table: 'product_documents', type: 'component_spec_sheet' },
  'Assembly Instructions':               { table: 'product_documents', type: 'assembly_instructions' },
  'Assembly Instructions.1':            { table: 'product_documents', type: 'assembly_instructions_2' },

  // ── Component cross-references ───────────────────────────────────
  'Top Reference SKU 1':                 { table: 'product_components', role: 'top', seq: 1 },
  'Top Reference SKU 2':                 { table: 'product_components', role: 'top', seq: 2 },
  'Sink Reference SKU':                  { table: 'product_components', role: 'sink', seq: 1 },
  'Component 1 Reference SKU':           { table: 'product_components', role: 'component', seq: 1 },
  'Component 2 Reference SKU':           { table: 'product_components', role: 'component', seq: 2 },
  'Optional Accessories (Part numbers that would be good accessories for this product)':
                                         { table: 'product_accessories', delim: ',' },
};

// Shipping box columns are parsed programmatically — pattern:
// "{ComponentType} Box {N} Shipping {Dimension|Weight|Cubes}"
// ComponentType = 'Vanity Cabinet' | 'Vanity Top' | 'Sink' | 'Mirror' |
//                 'Vanity Base' | 'Backsplash' | 'Bench' | 'Storage Cabinet' |
//                 'Shelf' | 'Drawer Unit' | 'Pulls' | 'Linen Cabinet' | 'Hutch' | 'Knobs and Legs'
```

---

## 7. Supplier Extensibility Strategy

When we onboard the next supplier (e.g., Strasser, Ronbow, Virtu), their feed columns map to the **same `attr_key` values** — we never add new `product_attribute_values` columns. We only add rows to `attribute_definitions` if they have a net-new filterable attribute.

The importer pattern:

```
Supplier Feed → Supplier Map (like JM_MAP above) → Canonical BVO Schema
                                                       ↓
                                              products + EAV attrs + images + certs + docs
```

Each supplier gets its own map file (`src/jobs/importers/jamesMartin.js`, `strasser.js`, etc.). The shared import engine (`src/jobs/importEngine.js`) handles the upserts.

---

*Created: July 2026 | Reference file: James Martin - Etail Feed_2025_08_07.xlsx*
