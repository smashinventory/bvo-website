-- ---------------------------------------------------------------------------
-- ER Vanities -> BVO  ·  CATALOGUE LOAD
-- Generated 2026-09-05 from the reviewed source files.
--
-- 78 SKUs. BVO has no product import route, so this is the load.
--
-- HOW TO RUN. phpMyAdmin -> bvo_website -> SQL tab. Run ONE STEP AT A TIME and
-- read the verification SELECT at the end of each before moving on. Every step
-- is idempotent: re-running it will not duplicate rows.
--
-- WHAT THE PRE-LOAD DIAGNOSTIC ESTABLISHED (run 2026-09-05):
--   * 0 of these 78 exist in BVO — clean insert, no slug collisions
--   * no 'Ethan Roth' rows exist, so no rebrand migration is needed
--   * the 4-value product_type taxonomy is LIVE, so we load into it
--   * mount_type canonical string is 'Floor Standing', not 'Freestanding'
--   * collections.slug 'bristol' is taken by James Martin (id 28)
--
-- ROLLBACK is at the bottom of this file. Read it before you start.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;
SET SESSION sql_mode = 'STRICT_ALL_TABLES';


-- ===========================================================================
-- STEP 9 — FINAL VERIFICATION
-- ===========================================================================

SELECT 'products'    AS tbl, COUNT(*) AS n FROM products WHERE brand = 'ER Vanities'
UNION ALL SELECT 'images', COUNT(*) FROM product_images pi
  JOIN products p ON p.id=pi.product_id WHERE p.brand='ER Vanities'
UNION ALL SELECT 'attributes', COUNT(*) FROM product_attribute_values a
  JOIN products p ON p.id=a.product_id WHERE p.brand='ER Vanities'
UNION ALL SELECT 'bullets', COUNT(*) FROM product_bullets b
  JOIN products p ON p.id=b.product_id WHERE p.brand='ER Vanities'
UNION ALL SELECT 'documents', COUNT(*) FROM product_documents d
  JOIN products p ON p.id=d.product_id WHERE p.brand='ER Vanities';
-- Expect: products 78 | images 341 | attributes 2018 | bullets 624 | documents 54

-- Every ER product must carry a sync key, or inventory sync silently skips it.
SELECT sku FROM products WHERE brand = 'ER Vanities' AND (rflpos_item_id IS NULL OR rflpos_item_id = '');
-- ^ expect ZERO rows.

-- Colour trio must agree (Rule 5): products.color, color_family, cabinet_finish EAV.
SELECT p.sku, p.color, p.color_family, a.value_text AS eav_cabinet_finish
  FROM products p LEFT JOIN product_attribute_values a
    ON a.product_id = p.id AND a.attr_key = 'cabinet_finish'
 WHERE p.brand = 'ER Vanities' AND (a.value_text IS NULL OR a.value_text <> p.color);
-- ^ expect ZERO rows.


-- ===========================================================================
-- ROLLBACK — removes everything this file created
-- ---------------------------------------------------------------------------
-- Child rows cascade on products delete, EXCEPT product_components, which is
-- keyed on SKU strings and has no foreign key. Delete it explicitly.
-- ---------------------------------------------------------------------------
-- DELETE FROM product_components
--  WHERE component_sku LIKE 'Kensington-Bridge%'
--     OR component_sku LIKE 'Bristol-Bridge%'
--     OR component_sku LIKE 'Windsor-LC%';
-- DELETE FROM products WHERE brand = 'ER Vanities';
-- DELETE FROM collections WHERE brand = 'ER Vanities';
-- DELETE FROM attribute_definitions WHERE attr_key = 'drawer_side';
-- ===========================================================================

