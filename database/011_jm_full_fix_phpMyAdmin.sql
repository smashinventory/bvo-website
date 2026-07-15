-- ============================================================
--  BVO — JM Taxonomy Full Fix
--  Paste this entire script into phpMyAdmin SQL tab and run.
--  Run ONCE against the bvo_website database on Hostinger.
--
--  What this does (in order):
--   1. Adds surrogate AUTO_INCREMENT PK to product_attribute_values
--      (enables multi-row EAV entries per product — needed for style)
--   2. Fixes mount_type: 'Wall-Mount' → 'Wall Mounted',
--                        'Freestanding' → 'Floor Standing'
--   3. De-slugifies products.product_type for JM products
--      ('freestanding' → 'Freestanding', 'floating-console' → 'Floating Console', etc.)
--   4. Removes orphaned vanity_type EAV rows (no filter definition, duplicate of product_type)
--   5. Fixes style EAV data: splits JM comma-string themes into
--      individual BVO canonical style rows per product
-- ============================================================


-- ── STEP 1: Restructure product_attribute_values PK ──────────
--
-- Before: PRIMARY KEY (product_id, attr_key)  — one row max per attr per product
-- After:  PRIMARY KEY (id AUTO_INCREMENT)      — unlimited rows per attr per product
--         INDEX (product_id, attr_key)          — preserves query performance
--
-- NOTE: The FOREIGN KEY on product_id is on the column itself, not
-- the PK, so it is unaffected by dropping the primary key.
-- All three operations in one ALTER TABLE to avoid intermediate invalid state.

ALTER TABLE product_attribute_values
  DROP PRIMARY KEY,
  ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
  ADD PRIMARY KEY (id),
  ADD INDEX idx_pav_product_attr (product_id, attr_key);


-- ── STEP 2: Fix mount_type canonical values ───────────────────
--
-- JM importer was storing JM-native values.
-- BVO canonical: 'Wall Mounted' | 'Floor Standing' | 'Pedestal'

UPDATE product_attribute_values
SET    value_text = 'Wall Mounted'
WHERE  attr_key   = 'mount_type'
  AND  value_text = 'Wall-Mount';

UPDATE product_attribute_values
SET    value_text = 'Floor Standing'
WHERE  attr_key   = 'mount_type'
  AND  value_text = 'Freestanding';


-- ── STEP 3: De-slugify products.product_type for JM products ──
--
-- JM importer called slugify() on the Vanity Type field before storing,
-- producing lowercase hyphenated values in the sidebar filter.
-- Only touches brand='James Martin' rows.
-- RFL products (Ethan Roth / Atlanta Vanity / Nearme) already store
-- 'Freestanding' correctly via enrich_bvo_v7.py — not affected.

UPDATE products
SET    product_type = CASE product_type
  WHEN 'freestanding'          THEN 'Freestanding'
  WHEN 'floating-console'      THEN 'Floating Console'
  WHEN 'vanity'                THEN 'Vanity'
  WHEN 'vanity-top'            THEN 'Vanity Top'
  WHEN 'corner-vanity'         THEN 'Corner Vanity'
  WHEN 'wall-hung'             THEN 'Wall Hung'
  WHEN 'wall-mount'            THEN 'Wall Mounted'
  WHEN 'wall-mounted'          THEN 'Wall Mounted'
  WHEN 'console'               THEN 'Console'
  WHEN 'linen-cabinet'         THEN 'Linen Cabinet'
  WHEN 'medicine-cabinet'      THEN 'Medicine Cabinet'
  WHEN 'mirror'                THEN 'Mirror'
  WHEN 'accessory'             THEN 'Accessory'
  ELSE product_type
END
WHERE  brand = 'James Martin'
  AND  product_type IS NOT NULL;


-- ── STEP 4: Remove orphaned vanity_type EAV rows ─────────────
--
-- JM importer wrote attr_key='vanity_type' to EAV but there is
-- no attribute_definition for it, so it never appears in filters.
-- The same data already lives in products.product_type.

DELETE FROM product_attribute_values
WHERE  attr_key = 'vanity_type';


-- ── STEP 5: Fix style EAV data ───────────────────────────────
--
-- JM importer stored raw Theme strings like "Transitional, Traditional"
-- as a single EAV value_text. BVO requires one row per style bucket.
-- After Step 1, the table allows multiple rows — so we can now fix this.
--
-- Strategy:
--   5a. Build a temp mapping table (JM raw → up to 2 BVO buckets)
--   5b. Snapshot which products need updating + their new values
--   5c. Delete the old JM-valued style rows for those products
--   5d. Insert new individual BVO style rows
--
-- Rows already storing a valid single BVO bucket (e.g. 'Modern',
-- 'Traditional') are NOT in the mapping table and are left untouched.


-- 5a. JM → BVO style mapping
--     Only includes entries that actually need transformation.
--     Single valid BVO values already stored correctly are skipped.

-- Collation must match production tables (utf8mb4_unicode_ci).
-- Hostinger runs MariaDB 10.6+ which defaults to utf8mb4_uca1400_ai_ci;
-- without an explicit collation the JOIN on value_text throws error #1267.
CREATE TEMPORARY TABLE _jm_style_map (
  jm_raw  VARCHAR(255) NOT NULL,
  style1  VARCHAR(100) NOT NULL,
  style2  VARCHAR(100)     NULL DEFAULT NULL,
  PRIMARY KEY (jm_raw)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO _jm_style_map (jm_raw, style1, style2) VALUES
  -- Multi-value splits
  ('Transitional, Traditional',          'Traditional',          'Transitional'),
  ('Traditional, Transitional',          'Traditional',          'Transitional'),
  ('Contemporary/Modern, Transitional',  'Transitional',         'Modern'),
  ('Modern, Transitional',               'Transitional',         'Modern'),
  ('Transitional, Modern',               'Transitional',         'Modern'),
  ('Farmhouse, Traditional',             'Traditional',          'Farmhouse'),
  ('Old World',                          'Traditional',          'European / Old World'),
  ('Traditional, Old World',             'Traditional',          'European / Old World'),
  -- Single-value normalizations (JM string ≠ BVO bucket name)
  ('Contemporary/Modern',                'Modern',               NULL),
  ('Contemporary, Modern',               'Modern',               NULL),
  ('Commercial',                         'Modern',               NULL);


-- 5b. Snapshot products that need updating + their mapped values
--     (capture before delete so we know what to re-insert)

CREATE TEMPORARY TABLE _style_updates
  DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS
SELECT
  pav.product_id,
  m.style1,
  m.style2
FROM product_attribute_values pav
INNER JOIN _jm_style_map m ON m.jm_raw = pav.value_text
WHERE pav.attr_key = 'style';


-- 5c. Delete the old JM-valued style rows
--     (only rows whose value_text has a mapping entry — correct BVO rows untouched)

DELETE pav
FROM   product_attribute_values pav
INNER JOIN _jm_style_map m ON m.jm_raw = pav.value_text
WHERE  pav.attr_key = 'style';


-- 5d. Insert style1 for all affected products

INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT product_id, 'style', style1, NULL
FROM   _style_updates;


-- 5e. Insert style2 for products that map to two BVO buckets

INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT product_id, 'style', style2, NULL
FROM   _style_updates
WHERE  style2 IS NOT NULL;


-- 5f. Tidy up temp tables

DROP TEMPORARY TABLE IF EXISTS _style_updates;
DROP TEMPORARY TABLE IF EXISTS _jm_style_map;


-- ── VERIFICATION QUERIES ─────────────────────────────────────
-- Run these after the script completes to confirm the fixes.
-- Uncomment each block and run separately if needed.

-- Check mount_type values (should only see 'Wall Mounted', 'Floor Standing', 'Pedestal'):
-- SELECT DISTINCT value_text FROM product_attribute_values WHERE attr_key = 'mount_type';

-- Check product_type values for JM products (should be human-readable, no slugs):
-- SELECT DISTINCT product_type FROM products WHERE brand = 'James Martin' ORDER BY product_type;

-- Check style values (should be individual BVO buckets, no comma strings):
-- SELECT DISTINCT value_text FROM product_attribute_values WHERE attr_key = 'style' ORDER BY value_text;

-- Confirm no vanity_type orphan rows remain:
-- SELECT COUNT(*) FROM product_attribute_values WHERE attr_key = 'vanity_type';

-- Count style rows per product (any product with count > 1 had multi-value styles fixed):
-- SELECT product_id, COUNT(*) AS style_count
-- FROM product_attribute_values WHERE attr_key = 'style'
-- GROUP BY product_id HAVING style_count > 1 LIMIT 20;

-- ── DONE ─────────────────────────────────────────────────────
