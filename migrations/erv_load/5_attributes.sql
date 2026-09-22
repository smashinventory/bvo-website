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
-- STEP 5 — product_attribute_values  (the sidebar filters)
-- ---------------------------------------------------------------------------
-- An attr_key with no attribute_definitions row stores fine but never appears
-- as a filter — that is deliberate for height_in, depth_in, prop65,
-- watersense_certified and warranty, which are spec-table content.
-- style is multi-value: one row per canonical bucket, never a joined string.
-- ===========================================================================

DELETE pav FROM product_attribute_values pav
  JOIN products p ON p.id = pav.product_id
 WHERE p.brand = 'ER Vanities';

INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Natural White Ash', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Coastal', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Natural White Ash', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Coastal', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Natural White Ash', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Coastal', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Natural White Ash', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Coastal', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Natural White Ash', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Coastal', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Natural White Ash', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Coastal', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Natural White Ash', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Coastal', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Natural White Ash', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Coastal', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 0
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Natural White Ash', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Coastal', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 0
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Desert Oak', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 1
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Left', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Navy Blue', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Left', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Left', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Desert Oak', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 1
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Right', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Navy Blue', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Right', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Right', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Desert Oak', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Left', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Metal Gray', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Left', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Navy Blue', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Left', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Left', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Desert Oak', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Right', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Metal Gray', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Right', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Navy Blue', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Right', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Right', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Desert Oak', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Metal Gray', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Navy Blue', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Metal Gray', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Metal Gray', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 6
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 6
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Metal Gray', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Metal Gray', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 6
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 6
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Metal Gray', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 0
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 0
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Desert Oak', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Desert Oak', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Desert Oak', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Right', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Right', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Desert Oak', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Desert Oak', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 6
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 6
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Desert Oak', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Desert Oak', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 6
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Farmhouse', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 6
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Black', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Mid-Century Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Industrial', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Sage Green', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Mid-Century Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Industrial', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Whitewashed Ash', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Mid-Century Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Industrial', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Black', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Mid-Century Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Industrial', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Sage Green', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Mid-Century Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Industrial', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Whitewashed Ash', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Mid-Century Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Industrial', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Black', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Mid-Century Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Industrial', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Sage Green', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Mid-Century Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Industrial', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Whitewashed Ash', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Mid-Century Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Industrial', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Sage Green', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Mid-Century Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Industrial', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Black', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Mid-Century Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Industrial', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Whitewashed Ash', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Matte Black', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Mid-Century Modern', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Industrial', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Scandinavian', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Navy Blue', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Navy Blue', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 5
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Left', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 5
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Left', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Navy Blue', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 5
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Right', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 5
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'drawer_side', 'Right', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Navy Blue', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 6
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Navy Blue', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 1
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 9
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Navy Blue', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 6
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Navy Blue', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Gold', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 6
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 2
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_doors', NULL, 4
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'num_drawers', NULL, 6
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'height_in', NULL, 33.75
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'depth_in', NULL, 21.625
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'cabinet_finish', 'Bright White', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'hardware_finish', 'Brushed Nickel', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Traditional', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'Transitional', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'style', 'European / Old World', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'mount_type', 'Floor Standing', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_count', NULL, 0
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'sink_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'backsplash_included', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'has_makeup_counter', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'freepower_compatible', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'wireless_charging', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_hinges', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'soft_close_slides', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'primary_material', 'Solid Wood (Poplar)', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'assembly_required', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ada_compliant', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'country_origin', 'Vietnam', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'ships_ltl', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'prop65', 'Yes', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'watersense_certified', 'No', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT id, 'warranty', '30 Day Full Return, 1 Year Limited', NULL
  FROM products WHERE rflpos_item_id = 'PR1021';

-- VERIFY step 5 — expect 2018 rows.
SELECT COUNT(*) AS eav_rows FROM product_attribute_values pav
  JOIN products p ON p.id = pav.product_id WHERE p.brand = 'ER Vanities';

-- ER is the first brand to populate these two — both filter groups have been
-- defined but empty. Expect 78 each.
SELECT attr_key, COUNT(*) AS n FROM product_attribute_values pav
  JOIN products p ON p.id = pav.product_id
 WHERE p.brand = 'ER Vanities' AND attr_key IN ('country_origin','ships_ltl','drawer_side')
 GROUP BY attr_key;


