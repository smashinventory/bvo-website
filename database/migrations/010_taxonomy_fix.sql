-- ============================================================
--  Migration 010 — Taxonomy Fix
--  BathroomVanitiesOutlet.com
--
--  Fixes found during pre-import schema audit (July 2026):
--
--  1. Add `vanity-tops` category (missing from seed)
--  2. Add attribute_definitions for vanity-tops
--  3. Remove duplicate size_in + sink_count rows in attr_defs
--     (migrations 002 AND 003 both inserted them; no UNIQUE
--     constraint existed, so both landed — sidebar showed
--     each filter twice)
--  4. Rename num_drawers → drawer_count in attribute_definitions
--     (adminController CSV_ATTR_KEYS and EAV both use
--     'drawer_count'; migration 003 seeded it as 'num_drawers'
--     causing the drawer filter to always return empty results)
--  5. Add missing vanity attr_defs: door_style, sink_type,
--     countertop_included (all written to EAV by importer but
--     had no definition so never appeared in sidebar)
--  6. Add UNIQUE constraint on attribute_definitions to
--     prevent future duplicate insertions
--  7. DROP orphan product_attributes table (created in 001,
--     never written to by importer; its FK caused TRUNCATE
--     errors on the products table)
--
--  NOTE: drawer_count / faucet_holes / sink_count are stored
--  as value_num in the EAV (they are in NUMERIC_ATTR_KEYS).
--  Checkbox-type filters query value_text. A follow-up code
--  change to _saveSpecs() should also populate value_text for
--  these so checkbox filtering works correctly (tracked
--  separately as a TODO in PROJECT_BRIEF.md).
-- ============================================================


-- ── 1. Add vanity-tops category ──────────────────────────────
INSERT IGNORE INTO categories (slug, name, description, sort_order, is_active)
VALUES ('vanity-tops', 'Vanity Tops', 'Bathroom vanity countertops and tops', 7, 1);


-- ── 2. Remove duplicate attribute_definitions for vanities ───
-- Keep the first-inserted row (lowest id); delete the higher-id
-- duplicate created by migration 003's un-guarded INSERT.

DELETE FROM attribute_definitions
WHERE attr_key = 'size_in'
  AND category_id = 1
  AND id = (
    SELECT id FROM (
      SELECT MAX(id) AS id
      FROM attribute_definitions
      WHERE attr_key = 'size_in' AND category_id = 1
    ) t
  );

DELETE FROM attribute_definitions
WHERE attr_key = 'sink_count'
  AND category_id = 1
  AND id = (
    SELECT id FROM (
      SELECT MAX(id) AS id
      FROM attribute_definitions
      WHERE attr_key = 'sink_count' AND category_id = 1
    ) t
  );

-- Ensure size_in sorts first among vanity filters (primary filter)
UPDATE attribute_definitions
SET sort_order = 1
WHERE attr_key = 'size_in' AND category_id = 1;


-- ── 3. Rename num_drawers → drawer_count ─────────────────────
UPDATE attribute_definitions
SET attr_key = 'drawer_count'
WHERE attr_key = 'num_drawers' AND category_id = 1;


-- ── 4. Add missing vanity attribute_definitions ──────────────
-- Inserted with sort_order > 20 to trail the existing vanity
-- defs from migrations 002 and 003.
INSERT IGNORE INTO attribute_definitions
  (category_id, attr_key, display_name, filter_type, sort_order, is_active)
VALUES
  (1, 'door_style',          'Door Style',          'checkbox', 21, 1),
  (1, 'sink_type',           'Sink Type',           'checkbox', 22, 1),
  (1, 'countertop_included', 'Countertop Included', 'boolean',  23, 1);

-- mirror_included: product-detail field only, intentionally
-- excluded from sidebar filters.


-- ── 5. Add attribute_definitions for vanity-tops ─────────────
-- Uses a CROSS JOIN on categories to avoid hardcoding the id.
INSERT IGNORE INTO attribute_definitions
  (category_id, attr_key, display_name, filter_type, sort_order, is_active)
SELECT c.id, d.attr_key, d.display_name, d.filter_type, d.sort_order, 1
FROM categories c
CROSS JOIN (
  SELECT 'product_type'         AS attr_key,
         'Top Type'             AS display_name,
         'checkbox'             AS filter_type,
         1                      AS sort_order
  UNION ALL SELECT 'size_in',            'Width',                  'range',        2
  UNION ALL SELECT 'countertop_material','Countertop Material',    'checkbox',     3
  UNION ALL SELECT 'countertop_included','Sink Included',          'boolean',      4
  UNION ALL SELECT 'faucet_holes',       'Faucet Holes',           'checkbox',     5
  UNION ALL SELECT 'cabinet_finish',     'Color',                  'color_swatch', 6
) d
WHERE c.slug = 'vanity-tops';


-- ── 6. Add UNIQUE constraint on attribute_definitions ─────────
-- Prevents duplicate (category_id, attr_key) pairs.
-- MySQL allows multiple NULLs in a UNIQUE index (NULL != NULL),
-- so global attrs (category_id IS NULL) remain safe.
ALTER TABLE attribute_definitions
  ADD UNIQUE KEY uq_attrdef_cat_key (category_id, attr_key);


-- ── 7. Drop orphan product_attributes table ───────────────────
-- Created in migration 001. The importer has always written to
-- product_attribute_values (migration 005) instead. This table
-- is permanently empty and its FK on products(id) caused
-- TRUNCATE failures during data reloads.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS product_attributes;
SET FOREIGN_KEY_CHECKS = 1;
