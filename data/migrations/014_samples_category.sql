-- ============================================================
--  Migration 014 — Samples Category
--  BathroomVanitiesOutlet.com
--
--  Adds a standalone 'samples' category for finish and material
--  swatch products (Metal Samples, Stone Samples, Wood Samples).
--
--  Previously these were routed to Accessories (4) — incorrect.
--  Samples are a distinct browse/discovery category: customers
--  order swatches to confirm finish/material before purchasing
--  a vanity or countertop. They are not accessories.
--
--  Category ID: auto-assigned (INSERT IGNORE — safe to re-run).
--  sort_order 8 places Samples after Vanity Tops (7).
--
--  Run in phpMyAdmin against the BVO database.
-- ============================================================


-- ── 1. Add samples category ───────────────────────────────────
INSERT IGNORE INTO categories (slug, name, description, sort_order, is_active)
VALUES ('samples', 'Samples', 'Finish and material swatches for vanities and countertops', 8, 1);


-- ── 2. Add attribute_definitions for samples ─────────────────
-- product_type filter lets customers browse by sample type
-- (Metal Sample, Stone Sample, Wood Sample).
-- Uses CROSS JOIN on categories to avoid hardcoding the id.
INSERT IGNORE INTO attribute_definitions
  (category_id, attr_key, display_name, filter_type, sort_order, is_active)
SELECT c.id, d.attr_key, d.display_name, d.filter_type, d.sort_order, 1
FROM categories c
CROSS JOIN (
  SELECT 'product_type' AS attr_key,
         'Sample Type'  AS display_name,
         'checkbox'     AS filter_type,
         1              AS sort_order
  UNION ALL SELECT 'cabinet_finish', 'Finish / Color', 'color_swatch', 2
) d
WHERE c.slug = 'samples';
