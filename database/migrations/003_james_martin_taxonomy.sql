-- ============================================================
--  Migration 003 — James Martin Taxonomy Alignment
--  Aligns BVO schema with JM's comprehensive etail feed.
--  JM's field names are treated as the canonical standard;
--  future vendor feeds will map TO these via vendor_field_maps.
-- ============================================================

-- ── 1. Collections (named JM design families) ───────────────
CREATE TABLE IF NOT EXISTS collections (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(120) NOT NULL UNIQUE,
  name        VARCHAR(255) NOT NULL,
  brand       VARCHAR(100) DEFAULT 'James Martin',
  description TEXT,
  image_url   VARCHAR(500),
  is_active   TINYINT(1)  NOT NULL DEFAULT 1,
  sort_order  SMALLINT    NOT NULL DEFAULT 0,
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. Product bullets (ordered feature list, up to 12) ─────
CREATE TABLE IF NOT EXISTS product_bullets (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  sort_order  TINYINT      NOT NULL DEFAULT 1,
  bullet_text TEXT         NOT NULL,
  INDEX idx_bullets_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. Per-box shipping dimensions ──────────────────────────
--  JM ships complex vanities in up to 14 component box types,
--  each with up to 2 boxes. Sparse flat columns → clean rows.
CREATE TABLE IF NOT EXISTS product_shipping_boxes (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id        INT UNSIGNED NOT NULL,
  component_type    VARCHAR(60)  NOT NULL,
  -- e.g. 'Vanity Cabinet' | 'Vanity Top' | 'Sink' | 'Mirror'
  --      'Vanity Base' | 'Backsplash' | 'Bench' | 'Storage Cabinet'
  --      'Shelf' | 'Drawer Unit' | 'Pulls' | 'Linen Cabinet'
  --      'Hutch' | 'Knobs and Legs'
  box_number        TINYINT      NOT NULL DEFAULT 1,
  ship_height_in    DECIMAL(8,2),
  ship_width_in     DECIMAL(8,2),
  ship_depth_in     DECIMAL(8,2),
  gross_weight_lbs  DECIMAL(8,2),
  cubes             DECIMAL(8,3),
  INDEX idx_ship_boxes_product (product_id, component_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. Certifications (UL / UPC / CUPC / ADA / Prop 65 / FC) ─
CREATE TABLE IF NOT EXISTS product_certifications (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  cert_type   VARCHAR(20)  NOT NULL,
  -- 'UL' | 'UPC' | 'CUPC' | 'FC' | 'ADA' | 'PROP65'
  cert_number VARCHAR(120),
  factory_ref VARCHAR(120),
  expires_at  DATE,
  INDEX idx_certs_product (product_id, cert_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5. Product documents (spec sheets, assembly instructions) ─
CREATE TABLE IF NOT EXISTS product_documents (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  doc_type    VARCHAR(40)  NOT NULL,
  -- 'spec_sheet' | 'top_spec_sheet' | 'component_spec_sheet'
  -- 'assembly_instructions' | 'assembly_instructions_2'
  url         VARCHAR(500) NOT NULL,
  label       VARCHAR(120),
  INDEX idx_docs_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 6. Component cross-references (vanity ↔ top/sink/base) ──
CREATE TABLE IF NOT EXISTS product_components (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_sku      VARCHAR(80) NOT NULL,
  component_sku   VARCHAR(80) NOT NULL,
  component_role  VARCHAR(40) NOT NULL,
  -- 'top' | 'sink' | 'mirror' | 'base' | 'component'
  seq             TINYINT NOT NULL DEFAULT 1,
  INDEX idx_comp_parent (parent_sku),
  INDEX idx_comp_child  (component_sku),
  UNIQUE KEY uq_comp (parent_sku, component_sku, component_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 7. Accessory cross-links ─────────────────────────────────
CREATE TABLE IF NOT EXISTS product_accessories (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_sku     VARCHAR(80) NOT NULL,
  accessory_sku   VARCHAR(80) NOT NULL,
  INDEX idx_acc_product    (product_sku),
  INDEX idx_acc_accessory  (accessory_sku),
  UNIQUE KEY uq_acc (product_sku, accessory_sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 8. Vendor field maps (for future non-JM supplier onboarding)
--  Empty now; populated when adding Strasser, Ronbow, Virtu, etc.
CREATE TABLE IF NOT EXISTS vendor_field_maps (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vendor_name  VARCHAR(60)  NOT NULL,
  vendor_field VARCHAR(255) NOT NULL,   -- the vendor's column name
  bvo_table    VARCHAR(60)  NOT NULL,   -- 'products' | 'attr' | 'cert' | 'doc' | etc.
  bvo_field    VARCHAR(120) NOT NULL,   -- BVO canonical field / attr_key
  transform_fn VARCHAR(60),             -- 'yesNo' | 'slugify' | 'decimal' | 'date' | null
  notes        TEXT,
  INDEX idx_vfm_vendor (vendor_name),
  UNIQUE KEY uq_vfm (vendor_name, vendor_field)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 9. Extend products table with JM-aligned columns ─────────
-- Guard each ALTER with a check so the migration is re-runnable.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS vendor_sku         VARCHAR(80)   AFTER sku,
  ADD COLUMN IF NOT EXISTS collection_id      INT UNSIGNED  AFTER category_id,
  ADD COLUMN IF NOT EXISTS component_role     VARCHAR(40)   AFTER brand,
  ADD COLUMN IF NOT EXISTS vendor_group_id    VARCHAR(40)   AFTER component_role,
  ADD COLUMN IF NOT EXISTS upc                VARCHAR(30)   AFTER slug,
  ADD COLUMN IF NOT EXISTS country_origin     VARCHAR(60),
  ADD COLUMN IF NOT EXISTS warranty           VARCHAR(120),
  ADD COLUMN IF NOT EXISTS lead_time_days     SMALLINT,
  ADD COLUMN IF NOT EXISTS ships_ltl          TINYINT(1)    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freight_class      VARCHAR(10),
  ADD COLUMN IF NOT EXISTS harmonized_code    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS total_ship_weight_lbs DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS prop65             TINYINT(1)    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS release_date       DATE,
  ADD COLUMN IF NOT EXISTS status             ENUM('active','discontinued','coming_soon','special_order')
                                              NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS meta_title         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS meta_description   VARCHAR(320);

-- Index for collection lookups
ALTER TABLE products
  ADD INDEX IF NOT EXISTS idx_products_collection (collection_id),
  ADD INDEX IF NOT EXISTS idx_products_vendor_sku (vendor_sku),
  ADD INDEX IF NOT EXISTS idx_products_upc (upc),
  ADD INDEX IF NOT EXISTS idx_products_status (status);

-- ── 10. Attribute definitions — JM taxonomy additions ─────────
--  Fills out the filter sidebar for vanities beyond Migration 002.
--  category_id = 1  → Vanities only
--  category_id NULL → applies to all categories

INSERT IGNORE INTO attribute_definitions
  (attr_key, display_name, filter_type, category_id, sort_order, is_active)
VALUES
  -- Vanity-specific (category_id = 1)
  ('countertop_material',   'Countertop Material',    'checkbox', 1,    5),
  ('countertop_finish',     'Countertop Finish',       'checkbox', 1,    6),
  ('countertop_thickness',  'Countertop Thickness',    'range',    1,    7),
  ('sink_count',            'Number of Sinks',         'checkbox', 1,    8),
  ('soft_close_hinges',     'Soft-Close Hinges',       'boolean',  1,    9),
  ('soft_close_slides',     'Soft-Close Drawers',      'boolean',  1,   10),
  ('backsplash_included',   'Backsplash Included',     'boolean',  1,   11),
  ('num_drawers',           'Number of Drawers',       'range',    1,   12),
  ('num_doors',             'Number of Doors',         'range',    1,   13),
  ('bowl_shape',            'Bowl Shape',              'checkbox', 1,   14),
  ('sink_material',         'Sink Material',           'checkbox', 1,   15),
  ('sink_installation',     'Sink Installation',       'checkbox', 1,   16),
  ('has_makeup_counter',    'Makeup Counter',          'boolean',  1,   17),
  ('distressed_finish',     'Distressed Finish',       'boolean',  1,   18),
  ('wireless_charging',     'Wireless Charging',       'boolean',  1,   19),
  ('freepower_compatible',  'FreePower Compatible',    'boolean',  1,   20),
  ('size_in',               'Vanity Width',            'range',    1,    1),

  -- Global / all categories (category_id = NULL)
  ('ada_compliant',         'ADA Compliant',           'boolean',  NULL, 50),
  ('assembly_required',     'Assembly Required',       'boolean',  NULL, 51),
  ('primary_material',      'Construction Material',   'checkbox', NULL, 52),
  ('country_origin',        'Country of Origin',       'checkbox', NULL, 53),
  ('ships_ltl',             'Shipping Method',         'checkbox', NULL, 54);
