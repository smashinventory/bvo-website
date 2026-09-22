-- ---------------------------------------------------------------------------
-- ER Vanities -> BVO  ·  CATALOGUE LOAD
-- Generated 2026-09-05 from the reviewed source files.
--
-- 78 SKUs. BVO has no product import route, so this is the load.
--
-- HOW TO RUN. phpMyAdmin -> bvo_website -> IMPORT tab -> choose this file -> Go.
-- Use IMPORT, not the SQL tab: the file is ~975 KB and the textarea chokes on
-- it, while Import takes it as an upload.
--
-- It runs in one pass. The nine steps are ordered by dependency and each ends
-- with a verification SELECT whose expected count sits in a comment above it.
--
-- Every statement is idempotent. Parent rows use ON DUPLICATE KEY UPDATE; child
-- tables DELETE-then-INSERT scoped to brand = 'ER Vanities'. If it fails
-- partway, fix and re-run the whole file — nothing duplicates.
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
-- STEP 1 — collections
-- ---------------------------------------------------------------------------
-- collections.brand DEFAULTS to 'James Martin', so brand is set explicitly on
-- every row. 'bristol' already belongs to James Martin (id 28), so ER's Bristol
-- takes the slug 'bristol-er-vanities' — slug is UNIQUE.
-- ===========================================================================

INSERT INTO collections (slug, name, brand, is_active, sort_order)
VALUES ('bristol-er-vanities', 'Bristol', 'ER Vanities', 1, 30)
ON DUPLICATE KEY UPDATE name = VALUES(name), brand = VALUES(brand), is_active = VALUES(is_active);
INSERT INTO collections (slug, name, brand, is_active, sort_order)
VALUES ('kensington', 'Kensington', 'ER Vanities', 1, 31)
ON DUPLICATE KEY UPDATE name = VALUES(name), brand = VALUES(brand), is_active = VALUES(is_active);
INSERT INTO collections (slug, name, brand, is_active, sort_order)
VALUES ('london', 'London', 'ER Vanities', 1, 32)
ON DUPLICATE KEY UPDATE name = VALUES(name), brand = VALUES(brand), is_active = VALUES(is_active);
INSERT INTO collections (slug, name, brand, is_active, sort_order)
VALUES ('oxford', 'Oxford', 'ER Vanities', 1, 33)
ON DUPLICATE KEY UPDATE name = VALUES(name), brand = VALUES(brand), is_active = VALUES(is_active);
INSERT INTO collections (slug, name, brand, is_active, sort_order)
VALUES ('windsor', 'Windsor', 'ER Vanities', 1, 34)
ON DUPLICATE KEY UPDATE name = VALUES(name), brand = VALUES(brand), is_active = VALUES(is_active);

-- VERIFY step 1 — expect 5 rows, all brand 'ER Vanities'.
SELECT id, slug, name, brand FROM collections WHERE brand = 'ER Vanities' ORDER BY name;


-- ===========================================================================
-- STEP 2 — attribute_definitions: drawer_side
-- ---------------------------------------------------------------------------
-- Left vs right is a plumbing constraint, not a preference: a shopper whose
-- supply lines sit on one side cannot use the other. 20 of 78 ER SKUs carry a
-- value and James Martin has no equivalent field, so this filter group will
-- show ER products only.
-- Guarded by NOT EXISTS, so re-running is safe.
-- ===========================================================================

INSERT INTO attribute_definitions
  (category_id, attr_key, display_name, filter_type, sort_order, is_active)
SELECT 1, 'drawer_side', 'Drawer Side', 'checkbox', 24, 1 FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM attribute_definitions WHERE attr_key = 'drawer_side');

-- VERIFY step 2 — expect exactly 1 row.
SELECT id, category_id, attr_key, display_name, filter_type
  FROM attribute_definitions WHERE attr_key = 'drawer_side';


-- ===========================================================================
-- STEP 3 — products  (78 rows)
-- ---------------------------------------------------------------------------
-- Column mapping worth knowing:
--   our meta_description  -> products.meta_desc      (different name)
--   our bvo_product_type  -> products.product_type   (the LIVE 4-value taxonomy;
--                                                     our own 'Vanity' label is
--                                                     not a BVO value)
--   our rflpos_sku        -> products.rflpos_item_id (the inventory sync key)
--   our vendor_sku        -> products.sku AND products.vendor_sku
--   collection_id resolved by subquery on the slug written in step 1.
--
-- cost is deliberately NOT set: costing stays in RFLPos (Sam, 2026-09-05).
-- gtin/upc, weight_lbs, freight_class, harmonized_code are pending the
-- manufacturer and load as NULL rather than as a guess.
-- ===========================================================================

INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Bristol-29.5-NWA-BG', 'Bristol-29.5-NWA-BG', 'bristol-29-5-bathroom-vanity-in-natural-white-ash', 'Bristol 29.5" Bathroom Vanity in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 1, 'Single Sink Cabinet Only', 'base', 'PR1269', 1049.99, 1499.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Natural White Ash', 'wood_l', 'Bristol-30-NWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Bristol', 'Bristol 30″ bathroom vanity in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Natural white ash does something a painted finish can''t — it brings light into a room without brightening it, so the space feels open and unhurried even when the window is small.

Poplar wood solids and ash veneers over a solid wood frame, with seven layers of coating built up soft and smooth. UV resistant, so the pale tone stays pale rather than yellowing the way untreated light woods do. Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.

Zinc alloy hardware in brushed gold, holding its finish long after the fixtures around it have started to dull.

The kind of bathroom you''re happy to walk into at the end of a long day — and one that still looks like this years from now.', 'Bristol 30″ Bathroom Vanity in Natural White Ash | Bathroom Vanities Outlet', 'Bristol 30″ vanity in natural white ash. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Bristol-35.5-NWA-BG', 'Bristol-35.5-NWA-BG', 'bristol-35-5-bathroom-vanity-in-natural-white-ash', 'Bristol 35.5" Bathroom Vanity in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 1, 'Single Sink Cabinet Only', 'base', 'PR1270', 1199.99, 1749.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Natural White Ash', 'wood_l', 'Bristol-36-NWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Bristol', 'Bristol 36″ bathroom vanity in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Natural white ash does something a painted finish can''t — it brings light into a room without brightening it, so the space feels open and unhurried even when the window is small.

Poplar wood solids and ash veneers over a solid wood frame, with seven layers of coating built up soft and smooth. UV resistant, so the pale tone stays pale rather than yellowing the way untreated light woods do. Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.

Zinc alloy hardware in brushed gold, holding its finish long after the fixtures around it have started to dull.

The kind of bathroom you''re happy to walk into at the end of a long day — and one that still looks like this years from now.', 'Bristol 36″ Bathroom Vanity in Natural White Ash | Bathroom Vanities Outlet', 'Bristol 36″ vanity in natural white ash. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Bristol-41.5-NWA-BG', 'Bristol-41.5-NWA-BG', 'bristol-41-5-bathroom-vanity-in-natural-white-ash', 'Bristol 41.5" Bathroom Vanity in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 1, 'Single Sink Cabinet Only', 'base', 'PR1271', 1549.99, 2249.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Natural White Ash', 'wood_l', 'Bristol-42-NWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Bristol', 'Bristol 42″ bathroom vanity in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Natural white ash does something a painted finish can''t — it brings light into a room without brightening it, so the space feels open and unhurried even when the window is small.

Poplar wood solids and ash veneers over a solid wood frame, with seven layers of coating built up soft and smooth. UV resistant, so the pale tone stays pale rather than yellowing the way untreated light woods do. Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.

Zinc alloy hardware in brushed gold, holding its finish long after the fixtures around it have started to dull.

The kind of bathroom you''re happy to walk into at the end of a long day — and one that still looks like this years from now.', 'Bristol 42″ Bathroom Vanity in Natural White Ash | Bathroom Vanities Outlet', 'Bristol 42″ vanity in natural white ash. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Bristol-47.5-NWA-BG', 'Bristol-47.5-NWA-BG', 'bristol-47-5-bathroom-vanity-in-natural-white-ash', 'Bristol 47.5" Bathroom Vanity in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 1, 'Single Sink Cabinet Only', 'base', 'PR1272', 1649.99, 2349.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Natural White Ash', 'wood_l', 'Bristol-48-NWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Bristol', 'Bristol 48″ bathroom vanity in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Natural white ash does something a painted finish can''t — it brings light into a room without brightening it, so the space feels open and unhurried even when the window is small.

Poplar wood solids and ash veneers over a solid wood frame, with seven layers of coating built up soft and smooth. UV resistant, so the pale tone stays pale rather than yellowing the way untreated light woods do. Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.

Zinc alloy hardware in brushed gold, holding its finish long after the fixtures around it have started to dull.

The kind of bathroom you''re happy to walk into at the end of a long day — and one that still looks like this years from now.', 'Bristol 48″ Bathroom Vanity in Natural White Ash | Bathroom Vanities Outlet', 'Bristol 48″ vanity in natural white ash. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Bristol-59.5D-NWA-BG', 'Bristol-59.5D-NWA-BG', 'bristol-59-5-double-sink-bathroom-vanity-in-natural-white-ash', 'Bristol 59.5" Double Sink Bathroom Vanity in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 1, 'Double Sink Cabinet Only', 'base', 'PR1273', 1799.99, 2599.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Natural White Ash', 'wood_l', 'Bristol-60D-NWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Bristol', 'Bristol 60″ double sink bathroom vanity in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Natural white ash does something a painted finish can''t — it brings light into a room without brightening it, so the space feels open and unhurried even when the window is small.

Poplar wood solids and ash veneers over a solid wood frame, with seven layers of coating built up soft and smooth. UV resistant, so the pale tone stays pale rather than yellowing the way untreated light woods do. Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.

Zinc alloy hardware in brushed gold, holding its finish long after the fixtures around it have started to dull.

The kind of bathroom you''re happy to walk into at the end of a long day — and one that still looks like this years from now.', 'Bristol 60″ Bathroom Vanity in Natural White Ash | Bathroom Vanities Outlet', 'Bristol 60″ double sink vanity in natural white ash. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Bristol-59.5S-NWA-BG', 'Bristol-59.5S-NWA-BG', 'bristol-59-5-single-sink-bathroom-vanity-in-natural-white-ash', 'Bristol 59.5" Single Sink Bathroom Vanity in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 1, 'Single Sink Cabinet Only', 'base', 'PR1274', 1849.99, 2649.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Natural White Ash', 'wood_l', 'Bristol-60S-NWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Bristol', 'Bristol 60″ single sink bathroom vanity in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Natural white ash does something a painted finish can''t — it brings light into a room without brightening it, so the space feels open and unhurried even when the window is small.

Poplar wood solids and ash veneers over a solid wood frame, with seven layers of coating built up soft and smooth. UV resistant, so the pale tone stays pale rather than yellowing the way untreated light woods do. Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.

Zinc alloy hardware in brushed gold, holding its finish long after the fixtures around it have started to dull.

The kind of bathroom you''re happy to walk into at the end of a long day — and one that still looks like this years from now.', 'Bristol 60″ Bathroom Vanity in Natural White Ash | Bathroom Vanities Outlet', 'Bristol 60″ single sink vanity in natural white ash. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Bristol-71.5-NWA-BG', 'Bristol-71.5-NWA-BG', 'bristol-71-5-bathroom-vanity-in-natural-white-ash', 'Bristol 71.5" Bathroom Vanity in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 1, 'Double Sink Cabinet Only', 'base', 'PR1275', 1949.99, 2799.99, 71.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Natural White Ash', 'wood_l', 'Bristol-72-NWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Bristol', 'Bristol 72″ bathroom vanity in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Natural white ash does something a painted finish can''t — it brings light into a room without brightening it, so the space feels open and unhurried even when the window is small.

Poplar wood solids and ash veneers over a solid wood frame, with seven layers of coating built up soft and smooth. UV resistant, so the pale tone stays pale rather than yellowing the way untreated light woods do. Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.

Zinc alloy hardware in brushed gold, holding its finish long after the fixtures around it have started to dull.

The kind of bathroom you''re happy to walk into at the end of a long day — and one that still looks like this years from now.', 'Bristol 72″ Bathroom Vanity in Natural White Ash | Bathroom Vanities Outlet', 'Bristol 72″ vanity in natural white ash. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Bristol-Bridge3DE-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bristol-24-3-drawer-bridge-in-natural-white-ash', 'Bristol 24" 3-Drawer Bridge in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 6, 'Side Cabinet', 'base', 'PR1277', 649.99, 949.99, 24, 20, 18, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Natural White Ash', 'wood_l', 'Bristol-24-3dr-NWA', 'Home & Garden > Furniture > Cabinets & Storage', 'new', 1, 'freight', 'mid-range', 'Side Cabinet', 'catalog', 'freight', 'Bristol', 'Bristol 24″ 3-drawer bridge unit in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Two vanities become one piece. A bridge unit closes the gap between them — turning separate cabinets into a single run that looks designed rather than assembled.

Matched in natural white ash with brushed gold so the seam disappears. Solid wood frame, all-wood construction and seven layers of coating, finished to the same standard as the vanities either side of it.

Under-mounted soft-close glides and soft-close hinges throughout, so the middle of your vanity run is as quiet as the ends.

The piece that makes two cabinets read as one deliberate wall of storage.', 'Bristol 24″ 3-Drawer Bridge Unit in Natural White Ash | Bathroom Vanities Outlet', 'Bristol 24″ 3-drawer bridge unit in natural white ash. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Bristol-BridgeMUCounter-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bristol-24-make-up-bridge-in-natural-white-ash', 'Bristol 24" Make-Up Bridge in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 6, 'Side Cabinet', 'base', 'PR1276', 549.99, 799.99, 24, 8, 18, 'Vietnam', '30 Day Full Return, 1 Year Limited', 0, 1, 'Natural White Ash', 'wood_l', 'Bristol-24-MU-NWA', 'Home & Garden > Furniture > Cabinets & Storage', 'new', 1, 'standard', 'mid-range', 'Side Cabinet', 'catalog', 'ground', 'Bristol', 'Bristol 24″ make-up bridge unit in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Two vanities become one piece. A bridge unit closes the gap between them — turning separate cabinets into a single run that looks designed rather than assembled.

Matched in natural white ash with brushed gold so the seam disappears. Solid wood frame, all-wood construction and seven layers of coating, finished to the same standard as the vanities either side of it.

Under-mounted soft-close glides and soft-close hinges throughout, so the middle of your vanity run is as quiet as the ends.

The piece that makes two cabinets read as one deliberate wall of storage.', 'Bristol 24″ Make-Up Bridge Unit in Natural White Ash | Bathroom Vanities Outlet', 'Bristol 24″ make-up bridge unit in natural white ash. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-29.5L-DOAK-MB', 'Kensington-29.5L-DOAK-MB', 'kensington-29-5-left-drawers-bathroom-vanity-in-desert-oak', 'Kensington 29.5" Left Drawers Bathroom Vanity in Desert Oak', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'Kensington-29.5L-DOAK-MB', 1199.99, 1749.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Desert Oak', 'wood_m', 'Kensington-30L-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 30″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Desert oak with matte black stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White and Navy Blue.**', 'Kensington 30″ Bathroom Vanity in Desert Oak | Bathroom Vanities Outlet', 'Kensington 30″ vanity in desert oak. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-29.5L-NVBLU-BG', 'Kensington-29.5L-NVBLU-BG', 'kensington-29-5-left-drawers-bathroom-vanity-in-navy-blue', 'Kensington 29.5" Left Drawers Bathroom Vanity in Navy Blue', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0974', 1099.99, 1599.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Navy Blue', 'blue', 'Kensington-30L-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 30″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Navy blue with brushed gold stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White and Desert Oak.**', 'Kensington 30″ Bathroom Vanity in Navy Blue | Bathroom Vanities Outlet', 'Kensington 30″ vanity in navy blue. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-29.5L-WH-BN', 'Kensington-29.5L-WH-BN', 'kensington-29-5-left-drawers-bathroom-vanity-in-bright-white', 'Kensington 29.5" Left Drawers Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0972', 1049.99, 1499.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Kensington-30L-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 30″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Bright white with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Desert Oak and Navy Blue.**', 'Kensington 30″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Kensington 30″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-29.5R-DOAK-MB', 'Kensington-29.5R-DOAK-MB', 'kensington-29-5-right-drawers-bathroom-vanity-in-desert-oak', 'Kensington 29.5" Right Drawers Bathroom Vanity in Desert Oak', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'Kensington-29.5R-DOAK-MB', 1199.99, 1749.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Desert Oak', 'wood_m', 'Kensington-30R-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 30″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Desert oak with matte black stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White and Navy Blue.**', 'Kensington 30″ Bathroom Vanity in Desert Oak | Bathroom Vanities Outlet', 'Kensington 30″ vanity in desert oak. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-29.5R-NVBLU-BG', 'Kensington-29.5R-NVBLU-BG', 'kensington-29-5-right-drawers-bathroom-vanity-in-navy-blue', 'Kensington 29.5" Right Drawers Bathroom Vanity in Navy Blue', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0971', 1099.99, 1599.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Navy Blue', 'blue', 'Kensington-30R-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 30″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Navy blue with brushed gold stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White and Desert Oak.**', 'Kensington 30″ Bathroom Vanity in Navy Blue | Bathroom Vanities Outlet', 'Kensington 30″ vanity in navy blue. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-29.5R-WH-BN', 'Kensington-29.5R-WH-BN', 'kensington-29-5-right-drawers-bathroom-vanity-in-bright-white', 'Kensington 29.5" Right Drawers Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0969', 1049.99, 1499.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Kensington-30R-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 30″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Bright white with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Desert Oak and Navy Blue.**', 'Kensington 30″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Kensington 30″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-35.5L-DOAK-MB', 'Kensington-35.5L-DOAK-MB', 'kensington-35-5-left-drawers-bathroom-vanity-in-desert-oak', 'Kensington 35.5" Left Drawers Bathroom Vanity in Desert Oak', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'Kensington-35.5L-DOAK-MB', 1424.99, 2049.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Desert Oak', 'wood_m', 'Kensington-36L-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Desert oak with matte black stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White, Metal Gray and Navy Blue.**', 'Kensington 36″ Bathroom Vanity in Desert Oak | Bathroom Vanities Outlet', 'Kensington 36″ vanity in desert oak. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-35.5L-MGR-BN', 'Kensington-35.5L-MGR-BN', 'kensington-35-5-left-drawers-bathroom-vanity-in-metal-gray', 'Kensington 35.5" Left Drawers Bathroom Vanity in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0979', 1149.99, 1649.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Metal Gray', 'gray', 'Kensington-36L-MGR', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Metal gray with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White, Desert Oak and Navy Blue.**', 'Kensington 36″ Bathroom Vanity in Metal Gray | Bathroom Vanities Outlet', 'Kensington 36″ vanity in metal gray. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-35.5L-NVBLU-BG', 'Kensington-35.5L-NVBLU-BG', 'kensington-35-5-left-drawers-bathroom-vanity-in-navy-blue', 'Kensington 35.5" Left Drawers Bathroom Vanity in Navy Blue', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0980', 1199.99, 1749.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Navy Blue', 'blue', 'Kensington-36L-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Navy blue with brushed gold stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White, Desert Oak and Metal Gray.**', 'Kensington 36″ Bathroom Vanity in Navy Blue | Bathroom Vanities Outlet', 'Kensington 36″ vanity in navy blue. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-35.5L-WH-BN', 'Kensington-35.5L-WH-BN', 'kensington-35-5-left-drawers-bathroom-vanity-in-bright-white', 'Kensington 35.5" Left Drawers Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0978', 1149.99, 1649.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Kensington-36L-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Bright white with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Desert Oak, Metal Gray and Navy Blue.**', 'Kensington 36″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Kensington 36″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-35.5R-DOAK-MB', 'Kensington-35.5R-DOAK-MB', 'kensington-35-5-right-drawers-bathroom-vanity-in-desert-oak', 'Kensington 35.5" Right Drawers Bathroom Vanity in Desert Oak', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'Kensington-35.5R-DOAK-MB', 1424.99, 2049.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Desert Oak', 'wood_m', 'Kensington-36R-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Desert oak with matte black stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White, Metal Gray and Navy Blue.**', 'Kensington 36″ Bathroom Vanity in Desert Oak | Bathroom Vanities Outlet', 'Kensington 36″ vanity in desert oak. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-35.5R-MGR-BN', 'Kensington-35.5R-MGR-BN', 'kensington-35-5-right-drawers-bathroom-vanity-in-metal-gray', 'Kensington 35.5" Right Drawers Bathroom Vanity in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0976', 1149.99, 1649.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Metal Gray', 'gray', 'Kensington-36R-MGR', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Metal gray with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White, Desert Oak and Navy Blue.**', 'Kensington 36″ Bathroom Vanity in Metal Gray | Bathroom Vanities Outlet', 'Kensington 36″ vanity in metal gray. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-35.5R-NVBLU-BG', 'Kensington-35.5R-NVBLU-BG', 'kensington-35-5-right-drawers-bathroom-vanity-in-navy-blue', 'Kensington 35.5" Right Drawers Bathroom Vanity in Navy Blue', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0977', 1199.99, 1749.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Navy Blue', 'blue', 'Kensington-36R-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Navy blue with brushed gold stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White, Desert Oak and Metal Gray.**', 'Kensington 36″ Bathroom Vanity in Navy Blue | Bathroom Vanities Outlet', 'Kensington 36″ vanity in navy blue. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-35.5R-WH-BN', 'Kensington-35.5R-WH-BN', 'kensington-35-5-right-drawers-bathroom-vanity-in-bright-white', 'Kensington 35.5" Right Drawers Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0975', 1149.99, 1649.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Kensington-36R-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Bright white with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Desert Oak, Metal Gray and Navy Blue.**', 'Kensington 36″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Kensington 36″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-41.5-DOAK-MB', 'Kensington-41.5-DOAK-MB', 'kensington-41-5-bathroom-vanity-in-desert-oak', 'Kensington 41.5" Bathroom Vanity in Desert Oak', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'Kensington-41.5-DOAK-MB', 1649.99, 2349.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Desert Oak', 'wood_m', 'Kensington-42-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 42″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Desert oak with matte black stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White, Metal Gray and Navy Blue.**', 'Kensington 42″ Bathroom Vanity in Desert Oak | Bathroom Vanities Outlet', 'Kensington 42″ vanity in desert oak. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-41.5-MGR-BN', 'Kensington-41.5-MGR-BN', 'kensington-41-5-bathroom-vanity-in-metal-gray', 'Kensington 41.5" Bathroom Vanity in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0982', 1474.99, 2099.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Metal Gray', 'gray', 'Kensington-42-MGR', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 42″ bathroom vanity in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Metal gray with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White, Desert Oak and Navy Blue.**', 'Kensington 42″ Bathroom Vanity in Metal Gray | Bathroom Vanities Outlet', 'Kensington 42″ vanity in metal gray. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-41.5-NVBLU-BG', 'Kensington-41.5-NVBLU-BG', 'kensington-41-5-bathroom-vanity-in-navy-blue', 'Kensington 41.5" Bathroom Vanity in Navy Blue', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0983', 1524.99, 2199.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Navy Blue', 'blue', 'Kensington-42-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 42″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Navy blue with brushed gold stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White, Desert Oak and Metal Gray.**', 'Kensington 42″ Bathroom Vanity in Navy Blue | Bathroom Vanities Outlet', 'Kensington 42″ vanity in navy blue. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-41.5-WH-BN', 'Kensington-41.5-WH-BN', 'kensington-41-5-bathroom-vanity-in-bright-white', 'Kensington 41.5" Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0981', 1474.99, 2099.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Kensington-42-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 42″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Bright white with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Desert Oak, Metal Gray and Navy Blue.**', 'Kensington 42″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Kensington 42″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-47.5-MGR-BN', 'Kensington-47.5-MGR-BN', 'kensington-47-5-bathroom-vanity-in-metal-gray', 'Kensington 47.5" Bathroom Vanity in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0986', 1724.99, 2449.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Metal Gray', 'gray', 'Kensington-48-MGR', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 48″ bathroom vanity in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Metal gray with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White.**', 'Kensington 48″ Bathroom Vanity in Metal Gray | Bathroom Vanities Outlet', 'Kensington 48″ vanity in metal gray. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-47.5-WH-BN', 'Kensington-47.5-WH-BN', 'kensington-47-5-bathroom-vanity-in-bright-white', 'Kensington 47.5" Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0985', 1724.99, 2449.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Kensington-48-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 48″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Bright white with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Metal Gray.**', 'Kensington 48″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Kensington 48″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-59.5D-MGR-BN', 'Kensington-59.5D-MGR-BN', 'kensington-59-5-double-sink-bathroom-vanity-in-metal-gray', 'Kensington 59.5" Double Sink Bathroom Vanity in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Double Sink Cabinet Only', 'base', 'PR0988', 1849.99, 2649.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Metal Gray', 'gray', 'Kensington-60D-MGR', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 60″ double sink bathroom vanity in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Two sinks, and suddenly nobody''s waiting. That''s the whole point of a double vanity, and the Kensington gets the rest of the morning out of your way too.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Metal gray with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White.**', 'Kensington 60″ Bathroom Vanity in Metal Gray | Bathroom Vanities Outlet', 'Kensington 60″ double sink vanity in metal gray. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-59.5D-WH-BN', 'Kensington-59.5D-WH-BN', 'kensington-59-5-double-sink-bathroom-vanity-in-bright-white', 'Kensington 59.5" Double Sink Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Double Sink Cabinet Only', 'base', 'PR0987', 1849.99, 2649.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Kensington-60D-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 60″ double sink bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Two sinks, and suddenly nobody''s waiting. That''s the whole point of a double vanity, and the Kensington gets the rest of the morning out of your way too.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Bright white with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Metal Gray.**', 'Kensington 60″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Kensington 60″ double sink vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-59.5S-MGR-BN', 'Kensington-59.5S-MGR-BN', 'kensington-59-5-single-sink-bathroom-vanity-in-metal-gray', 'Kensington 59.5" Single Sink Bathroom Vanity in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0990', 1899.99, 2699.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Metal Gray', 'gray', 'Kensington-60S-MGR', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 60″ single sink bathroom vanity in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Metal gray with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.', 'Kensington 60″ Bathroom Vanity in Metal Gray | Bathroom Vanities Outlet', 'Kensington 60″ single sink vanity in metal gray. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-59.5S-WH-BN', 'Kensington-59.5S-WH-BN', 'kensington-59-5-single-sink-bathroom-vanity-in-bright-white', 'Kensington 59.5" Single Sink Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0989', 1899.99, 2699.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Kensington-60S-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 60″ single sink bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Bright white with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.', 'Kensington 60″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Kensington 60″ single sink vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-71.5-MGR-BN', 'Kensington-71.5-MGR-BN', 'kensington-71-5-bathroom-vanity-in-metal-gray', 'Kensington 71.5" Bathroom Vanity in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Double Sink Cabinet Only', 'base', 'PR0992', 1999.99, 2849.99, 71.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Metal Gray', 'gray', 'Kensington-72-MGR', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 72″ bathroom vanity in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Metal gray with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Bright White.**', 'Kensington 72″ Bathroom Vanity in Metal Gray | Bathroom Vanities Outlet', 'Kensington 72″ vanity in metal gray. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-71.5-WH-BN', 'Kensington-71.5-WH-BN', 'kensington-71-5-bathroom-vanity-in-bright-white', 'Kensington 71.5" Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Double Sink Cabinet Only', 'base', 'PR0991', 1999.99, 2849.99, 71.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Kensington-72-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 72″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Mornings go quicker when nothing is in your way. The Kensington is built around that — every bit of storage where you''d reach for it, nothing on the counter that doesn''t need to be.

The pull-out shelf has a power station built in, so the hairdryer and the toothbrush charge out of sight and your counter stays clear. Tip-out drawers swallow the small things that otherwise migrate everywhere. Under-mounted soft-close glides and soft-close hinges mean the drawers and doors close themselves, quietly — which matters most at 6am when someone else is still asleep.

Bright white with brushed nickel stays neutral enough to outlive whatever you paint the walls next. Poplar wood solids and veneers over a solid wood frame, seven layers of coating, zinc alloy hardware — an investment that still looks stunning years from now.

Storage that works this hard is what turns a shared bathroom back into a room you don''t dread.

**Also in Metal Gray.**', 'Kensington 72″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Kensington 72″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-BridgeCabinet-MG-BN', 'Kensington-BridgeCabinet-MG-BN', 'kensington-23-bridge-drawer-in-metal-gray', 'Kensington 23" Bridge Drawer in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 6, 'Side Cabinet', 'base', 'Kensington-BridgeCabinet-MG-BN', 424.99, 649.99, 23, 8, 18, 'Vietnam', '30 Day Full Return, 1 Year Limited', 0, 1, 'Metal Gray', 'gray', 'Kensington-24-1dr-MGR', 'Home & Garden > Furniture > Cabinets & Storage', 'new', 1, 'standard', 'budget', 'Side Cabinet', 'catalog', 'ground', 'Kensington', 'Kensington 23″ bridge drawer unit in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Two vanities become one piece. A bridge unit closes the gap between them — turning separate cabinets into a single run that looks designed rather than assembled.

Matched in metal gray with brushed nickel so the seam disappears. Solid wood frame, all-wood construction and seven layers of coating, finished to the same standard as the vanities either side of it.

Under-mounted soft-close glides and soft-close hinges throughout, so the middle of your vanity run is as quiet as the ends.

The piece that makes two cabinets read as one deliberate wall of storage.

**Also in Bright White.**', 'Kensington 23″ Bridge Drawer Unit in Metal Gray | Bathroom Vanities Outlet', 'Kensington 23″ bridge drawer unit in metal gray. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Kensington-BridgeCabinet-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'kensington-23-bridge-drawer-in-bright-white', 'Kensington 23" Bridge Drawer in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 6, 'Side Cabinet', 'base', 'Kensington-BridgeCabinet-WH-BN', 424.99, 649.99, 23, 8, 18, 'Vietnam', '30 Day Full Return, 1 Year Limited', 0, 1, 'Bright White', 'white', 'Kensington-24-1dr-WHT', 'Home & Garden > Furniture > Cabinets & Storage', 'new', 1, 'standard', 'budget', 'Side Cabinet', 'catalog', 'ground', 'Kensington', 'Kensington 23″ bridge drawer unit in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Note: Stock images are of our old version. The new version has power outlet in the bottom drawer. We are in the process of updating the images. Please feel free to contact us for more accurate images. New version has two drawers and a removable power station in one larger bottom drawer.**

Two vanities become one piece. A bridge unit closes the gap between them — turning separate cabinets into a single run that looks designed rather than assembled.

Matched in bright white with brushed nickel so the seam disappears. Solid wood frame, all-wood construction and seven layers of coating, finished to the same standard as the vanities either side of it.

Under-mounted soft-close glides and soft-close hinges throughout, so the middle of your vanity run is as quiet as the ends.

The piece that makes two cabinets read as one deliberate wall of storage.

**Also in Metal Gray.**', 'Kensington 23″ Bridge Drawer Unit in Bright White | Bathroom Vanities Outlet', 'Kensington 23″ bridge drawer unit in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('London-23.5-DOAK-MB', 'London-23.5-DOAK-MB', 'london-23-5-bathroom-vanity-in-desert-oak', 'London 23.5" Bathroom Vanity in Desert Oak', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR0994', 924.99, 1349.99, 23.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Desert Oak', 'wood_m', 'London-24-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 24″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

There''s a moment, about a week in, when you stop noticing a vanity and start trusting it. Desert oak gets you there fast — warm, calm, and settled enough that the room arranges itself around it.

The drawers are the tell. Dovetail joints and under-mounted soft-close glides mean they stay tight and true years in, instead of loosening into the wobble that makes a bathroom feel tired. Birch plywood and solid wood where it carries weight. Tip-out drawers at the sink, so the clutter that collects there finally has a home.

Seven layers of coating over a solid wood frame — the reason this still photographs well in year six. Zinc alloy hardware in matte black that wears its finish rather than losing it.

A bathroom you''ll be glad you did once, properly, instead of twice.

**Also in Bright White.**', 'London 24″ Bathroom Vanity in Desert Oak | Bathroom Vanities Outlet', 'London 24″ vanity in desert oak. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('London-23.5-WH-BN', 'London-23.5-WH-BN', 'london-23-5-bathroom-vanity-in-bright-white', 'London 23.5" Bathroom Vanity in Bright White', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR0993', 799.99, 1149.99, 23.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'London-24-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 24″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

There''s a moment, about a week in, when you stop noticing a vanity and start trusting it. Bright white gets you there fast — warm, calm, and settled enough that the room arranges itself around it.

The drawers are the tell. Dovetail joints and under-mounted soft-close glides mean they stay tight and true years in, instead of loosening into the wobble that makes a bathroom feel tired. Birch plywood and solid wood where it carries weight. Tip-out drawers at the sink, so the clutter that collects there finally has a home.

Seven layers of coating over a solid wood frame — the reason this still photographs well in year six. Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.

A bathroom you''ll be glad you did once, properly, instead of twice.

**Also in Desert Oak.**', 'London 24″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'London 24″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('London-29.5-WH-BN', 'London-29.5-WH-BN', 'london-29-5-bathroom-vanity-in-bright-white', 'London 29.5" Bathroom Vanity in Bright White', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR0995', 874.99, 1249.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'London-30-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 30″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

There''s a moment, about a week in, when you stop noticing a vanity and start trusting it. Bright white gets you there fast — warm, calm, and settled enough that the room arranges itself around it.

The drawers are the tell. Dovetail joints and under-mounted soft-close glides mean they stay tight and true years in, instead of loosening into the wobble that makes a bathroom feel tired. Birch plywood and solid wood where it carries weight. Tip-out drawers at the sink, so the clutter that collects there finally has a home.

Seven layers of coating over a solid wood frame — the reason this still photographs well in year six. Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.

A bathroom you''ll be glad you did once, properly, instead of twice.', 'London 30″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'London 30″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('London-29.5-DOAK-MB', 'London-29.5-DOAK-MB', 'london-29-5-bathroom-vanity-in-desert-oak', 'London 29.5" Bathroom Vanity in Desert Oak', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR0996', 974.99, 1399.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Desert Oak', 'wood_m', 'London-30-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 30″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

There''s a moment, about a week in, when you stop noticing a vanity and start trusting it. Desert oak gets you there fast — warm, calm, and settled enough that the room arranges itself around it.

The drawers are the tell. Dovetail joints and under-mounted soft-close glides mean they stay tight and true years in, instead of loosening into the wobble that makes a bathroom feel tired. Birch plywood and solid wood where it carries weight. Tip-out drawers at the sink, so the clutter that collects there finally has a home.

Seven layers of coating over a solid wood frame — the reason this still photographs well in year six. Zinc alloy hardware in matte black that wears its finish rather than losing it.

A bathroom you''ll be glad you did once, properly, instead of twice.', 'London 30″ Bathroom Vanity in Desert Oak | Bathroom Vanities Outlet', 'London 30″ vanity in desert oak. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('London-35.5R-DOAK-MB', 'London-35.5R-DOAK-MB', 'london-35-5-right-drawers-bathroom-vanity-in-desert-oak', 'London 35.5" Right Drawers Bathroom Vanity in Desert Oak', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR0998', 1149.99, 1649.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Desert Oak', 'wood_m', 'London-36R-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 36″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

There''s a moment, about a week in, when you stop noticing a vanity and start trusting it. Desert oak gets you there fast — warm, calm, and settled enough that the room arranges itself around it.

The drawers are the tell. Dovetail joints and under-mounted soft-close glides mean they stay tight and true years in, instead of loosening into the wobble that makes a bathroom feel tired. Birch plywood and solid wood where it carries weight. Tip-out drawers at the sink, so the clutter that collects there finally has a home.

Seven layers of coating over a solid wood frame — the reason this still photographs well in year six. Zinc alloy hardware in matte black that wears its finish rather than losing it.

A bathroom you''ll be glad you did once, properly, instead of twice.

**Also in Bright White.**', 'London 36″ Bathroom Vanity in Desert Oak | Bathroom Vanities Outlet', 'London 36″ vanity in desert oak. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('London-35.5R-WH-BN', 'London-35.5R-WH-BN', 'london-35-5-right-drawers-bathroom-vanity-in-bright-white', 'London 35.5" Right Drawers Bathroom Vanity in Bright White', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR0997', 999.99, 1449.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'London-36R-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 36″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

There''s a moment, about a week in, when you stop noticing a vanity and start trusting it. Bright white gets you there fast — warm, calm, and settled enough that the room arranges itself around it.

The drawers are the tell. Dovetail joints and under-mounted soft-close glides mean they stay tight and true years in, instead of loosening into the wobble that makes a bathroom feel tired. Birch plywood and solid wood where it carries weight. Tip-out drawers at the sink, so the clutter that collects there finally has a home.

Seven layers of coating over a solid wood frame — the reason this still photographs well in year six. Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.

A bathroom you''ll be glad you did once, properly, instead of twice.

**Also in Desert Oak.**', 'London 36″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'London 36″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('London-47.5-DOAK-MB', 'London-47.5-DOAK-MB', 'london-47-5-bathroom-vanity-in-desert-oak', 'London 47.5" Bathroom Vanity in Desert Oak', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR1000', 1599.99, 2299.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Desert Oak', 'wood_m', 'London-48-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 48″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

There''s a moment, about a week in, when you stop noticing a vanity and start trusting it. Desert oak gets you there fast — warm, calm, and settled enough that the room arranges itself around it.

The drawers are the tell. Dovetail joints and under-mounted soft-close glides mean they stay tight and true years in, instead of loosening into the wobble that makes a bathroom feel tired. Birch plywood and solid wood where it carries weight. Tip-out drawers at the sink, so the clutter that collects there finally has a home.

Seven layers of coating over a solid wood frame — the reason this still photographs well in year six. Zinc alloy hardware in matte black that wears its finish rather than losing it.

A bathroom you''ll be glad you did once, properly, instead of twice.

**Also in Bright White.**', 'London 48″ Bathroom Vanity in Desert Oak | Bathroom Vanities Outlet', 'London 48″ vanity in desert oak. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('London-47.5-WH-BN', 'London-47.5-WH-BN', 'london-47-5-bathroom-vanity-in-bright-white', 'London 47.5" Bathroom Vanity in Bright White', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR0999', 1449.99, 2099.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'London-48-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 48″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

There''s a moment, about a week in, when you stop noticing a vanity and start trusting it. Bright white gets you there fast — warm, calm, and settled enough that the room arranges itself around it.

The drawers are the tell. Dovetail joints and under-mounted soft-close glides mean they stay tight and true years in, instead of loosening into the wobble that makes a bathroom feel tired. Birch plywood and solid wood where it carries weight. Tip-out drawers at the sink, so the clutter that collects there finally has a home.

Seven layers of coating over a solid wood frame — the reason this still photographs well in year six. Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.

A bathroom you''ll be glad you did once, properly, instead of twice.

**Also in Desert Oak.**', 'London 48″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'London 48″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('London-59.5D-DOAK-MB', 'London-59.5D-DOAK-MB', 'london-59-5-double-sink-bathroom-vanity-in-desert-oak', 'London 59.5" Double Sink Bathroom Vanity in Desert Oak', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Double Sink Cabinet Only', 'base', 'PR1002', 1774.99, 2549.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Desert Oak', 'wood_m', 'London-60D-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 60″ double sink bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

There''s a moment, about a week in, when you stop noticing a vanity and start trusting it. Desert oak gets you there fast — warm, calm, and settled enough that the room arranges itself around it.

The drawers are the tell. Dovetail joints and under-mounted soft-close glides mean they stay tight and true years in, instead of loosening into the wobble that makes a bathroom feel tired. Birch plywood and solid wood where it carries weight. Tip-out drawers at the sink, so the clutter that collects there finally has a home.

Seven layers of coating over a solid wood frame — the reason this still photographs well in year six. Zinc alloy hardware in matte black that wears its finish rather than losing it.

A bathroom you''ll be glad you did once, properly, instead of twice.

**Also in Bright White.**', 'London 60″ Bathroom Vanity in Desert Oak | Bathroom Vanities Outlet', 'London 60″ double sink vanity in desert oak. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('London-59.5D-WH-BN', 'London-59.5D-WH-BN', 'london-59-5-double-sink-bathroom-vanity-in-bright-white', 'London 59.5" Double Sink Bathroom Vanity in Bright White', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Double Sink Cabinet Only', 'base', 'PR1001', 1649.99, 2349.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'London-60D-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 60″ double sink bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

There''s a moment, about a week in, when you stop noticing a vanity and start trusting it. Bright white gets you there fast — warm, calm, and settled enough that the room arranges itself around it.

The drawers are the tell. Dovetail joints and under-mounted soft-close glides mean they stay tight and true years in, instead of loosening into the wobble that makes a bathroom feel tired. Birch plywood and solid wood where it carries weight. Tip-out drawers at the sink, so the clutter that collects there finally has a home.

Seven layers of coating over a solid wood frame — the reason this still photographs well in year six. Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.

A bathroom you''ll be glad you did once, properly, instead of twice.

**Also in Desert Oak.**', 'London 60″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'London 60″ double sink vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('London-59.5S-DOAK-MB', 'London-59.5S-DOAK-MB', 'london-59-5-single-sink-bathroom-vanity-in-desert-oak', 'London 59.5" Single Sink Bathroom Vanity in Desert Oak', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR1004', 1824.99, 2599.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Desert Oak', 'wood_m', 'London-60S-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 60″ single sink bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

There''s a moment, about a week in, when you stop noticing a vanity and start trusting it. Desert oak gets you there fast — warm, calm, and settled enough that the room arranges itself around it.

The drawers are the tell. Dovetail joints and under-mounted soft-close glides mean they stay tight and true years in, instead of loosening into the wobble that makes a bathroom feel tired. Birch plywood and solid wood where it carries weight. Tip-out drawers at the sink, so the clutter that collects there finally has a home.

Seven layers of coating over a solid wood frame — the reason this still photographs well in year six. Zinc alloy hardware in matte black that wears its finish rather than losing it.

A bathroom you''ll be glad you did once, properly, instead of twice.

**Also in Bright White.**', 'London 60″ Bathroom Vanity in Desert Oak | Bathroom Vanities Outlet', 'London 60″ single sink vanity in desert oak. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('London-59.5S-WH-BN', 'London-59.5S-WH-BN', 'london-59-5-single-sink-bathroom-vanity-in-bright-white', 'London 59.5" Single Sink Bathroom Vanity in Bright White', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR1003', 1724.99, 2449.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'London-60S-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 60″ single sink bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

There''s a moment, about a week in, when you stop noticing a vanity and start trusting it. Bright white gets you there fast — warm, calm, and settled enough that the room arranges itself around it.

The drawers are the tell. Dovetail joints and under-mounted soft-close glides mean they stay tight and true years in, instead of loosening into the wobble that makes a bathroom feel tired. Birch plywood and solid wood where it carries weight. Tip-out drawers at the sink, so the clutter that collects there finally has a home.

Seven layers of coating over a solid wood frame — the reason this still photographs well in year six. Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.

A bathroom you''ll be glad you did once, properly, instead of twice.

**Also in Desert Oak.**', 'London 60″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'London 60″ single sink vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('London-71.5-DOAK-MB', 'London-71.5-DOAK-MB', 'london-71-5-bathroom-vanity-in-desert-oak', 'London 71.5" Bathroom Vanity in Desert Oak', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Double Sink Cabinet Only', 'base', 'PR1006', 1949.99, 2799.99, 71.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Desert Oak', 'wood_m', 'London-72-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 72″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

There''s a moment, about a week in, when you stop noticing a vanity and start trusting it. Desert oak gets you there fast — warm, calm, and settled enough that the room arranges itself around it.

The drawers are the tell. Dovetail joints and under-mounted soft-close glides mean they stay tight and true years in, instead of loosening into the wobble that makes a bathroom feel tired. Birch plywood and solid wood where it carries weight. Tip-out drawers at the sink, so the clutter that collects there finally has a home.

Seven layers of coating over a solid wood frame — the reason this still photographs well in year six. Zinc alloy hardware in matte black that wears its finish rather than losing it.

A bathroom you''ll be glad you did once, properly, instead of twice.

**Also in Bright White.**', 'London 72″ Bathroom Vanity in Desert Oak | Bathroom Vanities Outlet', 'London 72″ vanity in desert oak. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('London-71.5-WH-BN', 'London-71.5-WH-BN', 'london-71-5-bathroom-vanity-in-bright-white', 'London 71.5" Bathroom Vanity in Bright White', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Double Sink Cabinet Only', 'base', 'PR1005', 1799.99, 2599.99, 71.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'London-72-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 72″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

There''s a moment, about a week in, when you stop noticing a vanity and start trusting it. Bright white gets you there fast — warm, calm, and settled enough that the room arranges itself around it.

The drawers are the tell. Dovetail joints and under-mounted soft-close glides mean they stay tight and true years in, instead of loosening into the wobble that makes a bathroom feel tired. Birch plywood and solid wood where it carries weight. Tip-out drawers at the sink, so the clutter that collects there finally has a home.

Seven layers of coating over a solid wood frame — the reason this still photographs well in year six. Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.

A bathroom you''ll be glad you did once, properly, instead of twice.

**Also in Desert Oak.**', 'London 72″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'London 72″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Oxford-29.5-BLK-BG', 'Oxford-29.5-BLK-BG', 'oxford-29-5-bathroom-vanity-in-black', 'Oxford 29.5" Bathroom Vanity in Black', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1024', 974.99, 1399.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Black', 'black', 'Oxford-30-BLK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 30″ bathroom vanity in peppercorn black with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Assembly: the legs attach on arrival. Nothing else requires assembly — the cabinet ships built.**

Small bathrooms don''t have to feel like compromises. Peppercorn black against brushed gold turns the room nobody looked twice at into the one guests mention on the way out — and at 30 inches it fits where a bigger cabinet won''t, without the cramped look of a pedestal.

Flat panel doors keep the lines quiet so the finish does the talking. Seven layers of it, soft and smooth with full coverage, which is why it still looks new after years of steam and wiping down. A premium sealant holds it against moisture and UV, so the colour you chose stays the colour you see.

Underneath: solid wood frame, all-wood construction. Not a cabinet you replace in five years — an investment that keeps looking stunning the whole time you own it. Zinc alloy hardware in brushed gold that still looks right years in rather than wearing dull, and soft-close hinges so the doors settle instead of banging.

The smallest room in the house, and the one that finally feels finished.

**Also in Sage Green and Whitewashed Ash.**', 'Oxford 30″ Bathroom Vanity in Peppercorn Black | Bathroom Vanities Outlet', 'Oxford 30″ vanity in peppercorn black. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Oxford-29.5-CAMGRN-BG', 'Oxford-29.5-CAMGRN-BG', 'oxford-29-5-bathroom-vanity-in-sage-green', 'Oxford 29.5" Bathroom Vanity in Sage Green', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1023', 974.99, 1399.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Sage Green', 'green', 'Oxford-30-SGE', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 30″ bathroom vanity in sage green with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Assembly: the legs attach on arrival. Nothing else requires assembly — the cabinet ships built.**

Small bathrooms don''t have to feel like compromises. Sage green against brushed gold turns the room nobody looked twice at into the one guests mention on the way out — and at 30 inches it fits where a bigger cabinet won''t, without the cramped look of a pedestal.

Flat panel doors keep the lines quiet so the finish does the talking. Seven layers of it, soft and smooth with full coverage, which is why it still looks new after years of steam and wiping down. A premium sealant holds it against moisture and UV, so the colour you chose stays the colour you see.

Underneath: solid wood frame, all-wood construction. Not a cabinet you replace in five years — an investment that keeps looking stunning the whole time you own it. Zinc alloy hardware in brushed gold that still looks right years in rather than wearing dull, and soft-close hinges so the doors settle instead of banging.

The smallest room in the house, and the one that finally feels finished.

**Also in Peppercorn Black and Whitewashed Ash.**', 'Oxford 30″ Bathroom Vanity in Sage Green | Bathroom Vanities Outlet', 'Oxford 30″ vanity in sage green. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Oxford-29.5-WA-MB', 'Oxford-29.5-WA-MB', 'oxford-29-5-bathroom-vanity-in-whitewashed-ash', 'Oxford 29.5" Bathroom Vanity in Whitewashed Ash', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1264', 1099.99, 1599.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Whitewashed Ash', 'wood_l', 'Oxford-30-WWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 30″ bathroom vanity in whitewashed ash with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Assembly: the legs attach on arrival. Nothing else requires assembly — the cabinet ships built.**

Small bathrooms don''t have to feel like compromises. Whitewashed ash against matte black turns the room nobody looked twice at into the one guests mention on the way out — and at 30 inches it fits where a bigger cabinet won''t, without the cramped look of a pedestal.

Flat panel doors keep the lines quiet so the finish does the talking. Seven layers of it, soft and smooth with full coverage, which is why it still looks new after years of steam and wiping down. A premium sealant holds it against moisture and UV, so the colour you chose stays the colour you see.

Underneath: solid wood frame, all-wood construction. Not a cabinet you replace in five years — an investment that keeps looking stunning the whole time you own it. Zinc alloy hardware in matte black that still looks right years in rather than wearing dull, and soft-close hinges so the doors settle instead of banging.

The smallest room in the house, and the one that finally feels finished.

**Also in Peppercorn Black and Sage Green.**', 'Oxford 30″ Bathroom Vanity in Whitewashed Ash | Bathroom Vanities Outlet', 'Oxford 30″ vanity in whitewashed ash. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Oxford-35.5-BLK-BG', 'Oxford-35.5-BLK-BG', 'oxford-35-5-bathroom-vanity-in-black', 'Oxford 35.5" Bathroom Vanity in Black', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1026', 1099.99, 1599.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Black', 'black', 'Oxford-36-BLK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 36″ bathroom vanity in peppercorn black with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Assembly: the legs attach on arrival. Nothing else requires assembly — the cabinet ships built.**

Small bathrooms don''t have to feel like compromises. Peppercorn black against brushed gold turns the room nobody looked twice at into the one guests mention on the way out — and at 36 inches it fits where a bigger cabinet won''t, without the cramped look of a pedestal.

Flat panel doors keep the lines quiet so the finish does the talking. Seven layers of it, soft and smooth with full coverage, which is why it still looks new after years of steam and wiping down. A premium sealant holds it against moisture and UV, so the colour you chose stays the colour you see.

Underneath: solid wood frame, all-wood construction. Not a cabinet you replace in five years — an investment that keeps looking stunning the whole time you own it. Zinc alloy hardware in brushed gold that still looks right years in rather than wearing dull, and soft-close hinges so the doors settle instead of banging.

The smallest room in the house, and the one that finally feels finished.

**Also in Sage Green and Whitewashed Ash.**', 'Oxford 36″ Bathroom Vanity in Peppercorn Black | Bathroom Vanities Outlet', 'Oxford 36″ vanity in peppercorn black. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Oxford-35.5-CAMGRN-BG', 'Oxford-35.5-CAMGRN-BG', 'oxford-35-5-bathroom-vanity-in-sage-green', 'Oxford 35.5" Bathroom Vanity in Sage Green', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1025', 1099.99, 1599.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Sage Green', 'green', 'Oxford-36-SGE', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 36″ bathroom vanity in sage green with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Assembly: the legs attach on arrival. Nothing else requires assembly — the cabinet ships built.**

Small bathrooms don''t have to feel like compromises. Sage green against brushed gold turns the room nobody looked twice at into the one guests mention on the way out — and at 36 inches it fits where a bigger cabinet won''t, without the cramped look of a pedestal.

Flat panel doors keep the lines quiet so the finish does the talking. Seven layers of it, soft and smooth with full coverage, which is why it still looks new after years of steam and wiping down. A premium sealant holds it against moisture and UV, so the colour you chose stays the colour you see.

Underneath: solid wood frame, all-wood construction. Not a cabinet you replace in five years — an investment that keeps looking stunning the whole time you own it. Zinc alloy hardware in brushed gold that still looks right years in rather than wearing dull, and soft-close hinges so the doors settle instead of banging.

The smallest room in the house, and the one that finally feels finished.

**Also in Peppercorn Black and Whitewashed Ash.**', 'Oxford 36″ Bathroom Vanity in Sage Green | Bathroom Vanities Outlet', 'Oxford 36″ vanity in sage green. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Oxford-35.5-WA-MB', 'Oxford-35.5-WA-MB', 'oxford-35-5-bathroom-vanity-in-whitewashed-ash', 'Oxford 35.5" Bathroom Vanity in Whitewashed Ash', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1265', 1199.99, 1749.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Whitewashed Ash', 'wood_l', 'Oxford-36-WWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 36″ bathroom vanity in whitewashed ash with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Assembly: the legs attach on arrival. Nothing else requires assembly — the cabinet ships built.**

Small bathrooms don''t have to feel like compromises. Whitewashed ash against matte black turns the room nobody looked twice at into the one guests mention on the way out — and at 36 inches it fits where a bigger cabinet won''t, without the cramped look of a pedestal.

Flat panel doors keep the lines quiet so the finish does the talking. Seven layers of it, soft and smooth with full coverage, which is why it still looks new after years of steam and wiping down. A premium sealant holds it against moisture and UV, so the colour you chose stays the colour you see.

Underneath: solid wood frame, all-wood construction. Not a cabinet you replace in five years — an investment that keeps looking stunning the whole time you own it. Zinc alloy hardware in matte black that still looks right years in rather than wearing dull, and soft-close hinges so the doors settle instead of banging.

The smallest room in the house, and the one that finally feels finished.

**Also in Peppercorn Black and Sage Green.**', 'Oxford 36″ Bathroom Vanity in Whitewashed Ash | Bathroom Vanities Outlet', 'Oxford 36″ vanity in whitewashed ash. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Oxford-41.5-BLK-BG', 'Oxford-41.5-BLK-BG', 'oxford-41-5-bathroom-vanity-in-black', 'Oxford 41.5" Bathroom Vanity in Black', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1028', 1374.99, 1999.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Black', 'black', 'Oxford-42-BLK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 42″ bathroom vanity in peppercorn black with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Assembly: the legs attach on arrival. Nothing else requires assembly — the cabinet ships built.**

Small bathrooms don''t have to feel like compromises. Peppercorn black against brushed gold turns the room nobody looked twice at into the one guests mention on the way out — and at 42 inches it fits where a bigger cabinet won''t, without the cramped look of a pedestal.

Flat panel doors keep the lines quiet so the finish does the talking. Seven layers of it, soft and smooth with full coverage, which is why it still looks new after years of steam and wiping down. A premium sealant holds it against moisture and UV, so the colour you chose stays the colour you see.

Underneath: solid wood frame, all-wood construction. Not a cabinet you replace in five years — an investment that keeps looking stunning the whole time you own it. Zinc alloy hardware in brushed gold that still looks right years in rather than wearing dull, and soft-close hinges so the doors settle instead of banging.

The smallest room in the house, and the one that finally feels finished.

**Also in Sage Green and Whitewashed Ash.**', 'Oxford 42″ Bathroom Vanity in Peppercorn Black | Bathroom Vanities Outlet', 'Oxford 42″ vanity in peppercorn black. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Oxford-41.5-CAMGRN-BG', 'Oxford-41.5-CAMGRN-BG', 'oxford-41-5-bathroom-vanity-in-sage-green', 'Oxford 41.5" Bathroom Vanity in Sage Green', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1027', 1374.99, 1999.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Sage Green', 'green', 'Oxford-42-SGE', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 42″ bathroom vanity in sage green with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Assembly: the legs attach on arrival. Nothing else requires assembly — the cabinet ships built.**

Small bathrooms don''t have to feel like compromises. Sage green against brushed gold turns the room nobody looked twice at into the one guests mention on the way out — and at 42 inches it fits where a bigger cabinet won''t, without the cramped look of a pedestal.

Flat panel doors keep the lines quiet so the finish does the talking. Seven layers of it, soft and smooth with full coverage, which is why it still looks new after years of steam and wiping down. A premium sealant holds it against moisture and UV, so the colour you chose stays the colour you see.

Underneath: solid wood frame, all-wood construction. Not a cabinet you replace in five years — an investment that keeps looking stunning the whole time you own it. Zinc alloy hardware in brushed gold that still looks right years in rather than wearing dull, and soft-close hinges so the doors settle instead of banging.

The smallest room in the house, and the one that finally feels finished.

**Also in Peppercorn Black and Whitewashed Ash.**', 'Oxford 42″ Bathroom Vanity in Sage Green | Bathroom Vanities Outlet', 'Oxford 42″ vanity in sage green. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Oxford-41.5-WA-MB', 'Oxford-41.5-WA-MB', 'oxford-41-5-bathroom-vanity-in-whitewashed-ash', 'Oxford 41.5" Bathroom Vanity in Whitewashed Ash', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1266', 1474.99, 2099.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Whitewashed Ash', 'wood_l', 'Oxford-42-WWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 42″ bathroom vanity in whitewashed ash with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Assembly: the legs attach on arrival. Nothing else requires assembly — the cabinet ships built.**

Small bathrooms don''t have to feel like compromises. Whitewashed ash against matte black turns the room nobody looked twice at into the one guests mention on the way out — and at 42 inches it fits where a bigger cabinet won''t, without the cramped look of a pedestal.

Flat panel doors keep the lines quiet so the finish does the talking. Seven layers of it, soft and smooth with full coverage, which is why it still looks new after years of steam and wiping down. A premium sealant holds it against moisture and UV, so the colour you chose stays the colour you see.

Underneath: solid wood frame, all-wood construction. Not a cabinet you replace in five years — an investment that keeps looking stunning the whole time you own it. Zinc alloy hardware in matte black that still looks right years in rather than wearing dull, and soft-close hinges so the doors settle instead of banging.

The smallest room in the house, and the one that finally feels finished.

**Also in Peppercorn Black and Sage Green.**', 'Oxford 42″ Bathroom Vanity in Whitewashed Ash | Bathroom Vanities Outlet', 'Oxford 42″ vanity in whitewashed ash. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Oxford-47.5-CAMGRN-BG', 'Oxford-47.5-CAMGRN-BG', 'oxford-47-5-bathroom-vanity-in-sage-green', 'Oxford 47.5" Bathroom Vanity in Sage Green', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1029', 1499.99, 2149.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Sage Green', 'green', 'Oxford-48-SGE', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 48″ bathroom vanity in sage green with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Assembly: the legs attach on arrival. Nothing else requires assembly — the cabinet ships built.**

Small bathrooms don''t have to feel like compromises. Sage green against brushed gold turns the room nobody looked twice at into the one guests mention on the way out — and at 48 inches it fits where a bigger cabinet won''t, without the cramped look of a pedestal.

Flat panel doors keep the lines quiet so the finish does the talking. Seven layers of it, soft and smooth with full coverage, which is why it still looks new after years of steam and wiping down. A premium sealant holds it against moisture and UV, so the colour you chose stays the colour you see.

Underneath: solid wood frame, all-wood construction. Not a cabinet you replace in five years — an investment that keeps looking stunning the whole time you own it. Zinc alloy hardware in brushed gold that still looks right years in rather than wearing dull, and soft-close hinges so the doors settle instead of banging.

The smallest room in the house, and the one that finally feels finished.', 'Oxford 48″ Bathroom Vanity in Sage Green | Bathroom Vanities Outlet', 'Oxford 48″ vanity in sage green. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Oxford-47.5-BLK-BG', 'Oxford-47.5-BLK-BG', 'oxford-47-5-bathroom-vanity-in-black', 'Oxford 47.5" Bathroom Vanity in Black', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1030', 1499.99, 2149.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Black', 'black', 'Oxford-48-BLK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 48″ bathroom vanity in peppercorn black with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Assembly: the legs attach on arrival. Nothing else requires assembly — the cabinet ships built.**

Small bathrooms don''t have to feel like compromises. Peppercorn black against brushed gold turns the room nobody looked twice at into the one guests mention on the way out — and at 48 inches it fits where a bigger cabinet won''t, without the cramped look of a pedestal.

Flat panel doors keep the lines quiet so the finish does the talking. Seven layers of it, soft and smooth with full coverage, which is why it still looks new after years of steam and wiping down. A premium sealant holds it against moisture and UV, so the colour you chose stays the colour you see.

Underneath: solid wood frame, all-wood construction. Not a cabinet you replace in five years — an investment that keeps looking stunning the whole time you own it. Zinc alloy hardware in brushed gold that still looks right years in rather than wearing dull, and soft-close hinges so the doors settle instead of banging.

The smallest room in the house, and the one that finally feels finished.

**Also in Whitewashed Ash.**', 'Oxford 48″ Bathroom Vanity in Peppercorn Black | Bathroom Vanities Outlet', 'Oxford 48″ vanity in peppercorn black. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Oxford-47.5-WA-MB', 'Oxford-47.5-WA-MB', 'oxford-47-5-bathroom-vanity-in-whitewashed-ash', 'Oxford 47.5" Bathroom Vanity in Whitewashed Ash', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1267', 1599.99, 2299.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Whitewashed Ash', 'wood_l', 'Oxford-48-WWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 48″ bathroom vanity in whitewashed ash with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

**Assembly: the legs attach on arrival. Nothing else requires assembly — the cabinet ships built.**

Small bathrooms don''t have to feel like compromises. Whitewashed ash against matte black turns the room nobody looked twice at into the one guests mention on the way out — and at 48 inches it fits where a bigger cabinet won''t, without the cramped look of a pedestal.

Flat panel doors keep the lines quiet so the finish does the talking. Seven layers of it, soft and smooth with full coverage, which is why it still looks new after years of steam and wiping down. A premium sealant holds it against moisture and UV, so the colour you chose stays the colour you see.

Underneath: solid wood frame, all-wood construction. Not a cabinet you replace in five years — an investment that keeps looking stunning the whole time you own it. Zinc alloy hardware in matte black that still looks right years in rather than wearing dull, and soft-close hinges so the doors settle instead of banging.

The smallest room in the house, and the one that finally feels finished.

**Also in Peppercorn Black.**', 'Oxford 48″ Bathroom Vanity in Whitewashed Ash | Bathroom Vanities Outlet', 'Oxford 48″ vanity in whitewashed ash. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-29.5-NVBLU-BG', 'Windsor-29.5-NVBLU-BG', 'windsor-29-5-bathroom-vanity-in-navy-blue', 'Windsor 29.5" Bathroom Vanity in Navy Blue', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1008', 974.99, 1399.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Navy Blue', 'blue', 'Windsor-30-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 30″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Some bathrooms are functional. This one''s a retreat. Tapered legs and hand-carved pilasters give the Windsor a presence that reads traditional up close and transitional from the doorway — the kind of piece that makes the whole room feel considered before you''ve added a single towel.

Navy blue with brushed gold keeps it from feeling heavy. Poplar wood solids and veneers on a solid wood frame, finished in seven layers so it holds its depth of colour through years of steam.

Everything closes itself. Soft-close hinged doors, under-mounted soft-close glides on every drawer — no slam, no bang, nobody woken. Tip-out drawers and a pull-out shelf with power station keep the counter clear, which is most of what makes a bathroom feel calm.

A bathroom you walk into at the end of the day and feel your shoulders drop.

**Also in Bright White.**', 'Windsor 30″ Bathroom Vanity in Navy Blue | Bathroom Vanities Outlet', 'Windsor 30″ vanity in navy blue. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-29.5-WH-BN', 'Windsor-29.5-WH-BN', 'windsor-29-5-bathroom-vanity-in-bright-white', 'Windsor 29.5" Bathroom Vanity in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1007', 924.99, 1349.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Windsor-30-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 30″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Some bathrooms are functional. This one''s a retreat. Tapered legs and hand-carved pilasters give the Windsor a presence that reads traditional up close and transitional from the doorway — the kind of piece that makes the whole room feel considered before you''ve added a single towel.

Bright white with brushed nickel keeps it from feeling heavy. Poplar wood solids and veneers on a solid wood frame, finished in seven layers so it holds its depth of colour through years of steam.

Everything closes itself. Soft-close hinged doors, under-mounted soft-close glides on every drawer — no slam, no bang, nobody woken. Tip-out drawers and a pull-out shelf with power station keep the counter clear, which is most of what makes a bathroom feel calm.

A bathroom you walk into at the end of the day and feel your shoulders drop.

**Also in Navy Blue.**', 'Windsor 30″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Windsor 30″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-35.5L-NVBLU-BG', 'Windsor-35.5L-NVBLU-BG', 'windsor-35-5-left-drawers-bathroom-vanity-in-navy-blue', 'Windsor 35.5" Left Drawers Bathroom Vanity in Navy Blue', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1012', 1149.99, 1649.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Navy Blue', 'blue', 'Windsor-36L-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 36″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Some bathrooms are functional. This one''s a retreat. Tapered legs and hand-carved pilasters give the Windsor a presence that reads traditional up close and transitional from the doorway — the kind of piece that makes the whole room feel considered before you''ve added a single towel.

Navy blue with brushed gold keeps it from feeling heavy. Poplar wood solids and veneers on a solid wood frame, finished in seven layers so it holds its depth of colour through years of steam.

Everything closes itself. Soft-close hinged doors, under-mounted soft-close glides on every drawer — no slam, no bang, nobody woken. Tip-out drawers and a pull-out shelf with power station keep the counter clear, which is most of what makes a bathroom feel calm.

A bathroom you walk into at the end of the day and feel your shoulders drop.

**Also in Bright White.**', 'Windsor 36″ Bathroom Vanity in Navy Blue | Bathroom Vanities Outlet', 'Windsor 36″ vanity in navy blue. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-35.5L-WH-BN', 'Windsor-35.5L-WH-BN', 'windsor-35-5-left-drawers-bathroom-vanity-in-bright-white', 'Windsor 35.5" Left Drawers Bathroom Vanity in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1011', 1099.99, 1599.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Windsor-36L-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 36″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Some bathrooms are functional. This one''s a retreat. Tapered legs and hand-carved pilasters give the Windsor a presence that reads traditional up close and transitional from the doorway — the kind of piece that makes the whole room feel considered before you''ve added a single towel.

Bright white with brushed nickel keeps it from feeling heavy. Poplar wood solids and veneers on a solid wood frame, finished in seven layers so it holds its depth of colour through years of steam.

Everything closes itself. Soft-close hinged doors, under-mounted soft-close glides on every drawer — no slam, no bang, nobody woken. Tip-out drawers and a pull-out shelf with power station keep the counter clear, which is most of what makes a bathroom feel calm.

A bathroom you walk into at the end of the day and feel your shoulders drop.

**Also in Navy Blue.**', 'Windsor 36″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Windsor 36″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-35.5R-NVBLU-BG', 'Windsor-35.5R-NVBLU-BG', 'windsor-35-5-right-drawers-bathroom-vanity-in-navy-blue', 'Windsor 35.5" Right Drawers Bathroom Vanity in Navy Blue', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1010', 1149.99, 1649.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Navy Blue', 'blue', 'Windsor-36R-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 36″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Some bathrooms are functional. This one''s a retreat. Tapered legs and hand-carved pilasters give the Windsor a presence that reads traditional up close and transitional from the doorway — the kind of piece that makes the whole room feel considered before you''ve added a single towel.

Navy blue with brushed gold keeps it from feeling heavy. Poplar wood solids and veneers on a solid wood frame, finished in seven layers so it holds its depth of colour through years of steam.

Everything closes itself. Soft-close hinged doors, under-mounted soft-close glides on every drawer — no slam, no bang, nobody woken. Tip-out drawers and a pull-out shelf with power station keep the counter clear, which is most of what makes a bathroom feel calm.

A bathroom you walk into at the end of the day and feel your shoulders drop.

**Also in Bright White.**', 'Windsor 36″ Bathroom Vanity in Navy Blue | Bathroom Vanities Outlet', 'Windsor 36″ vanity in navy blue. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-35.5R-WH-BN', 'Windsor-35.5R-WH-BN', 'windsor-35-5-right-drawers-bathroom-vanity-in-bright-white', 'Windsor 35.5" Right Drawers Bathroom Vanity in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1009', 1099.99, 1599.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Windsor-36R-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 36″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Some bathrooms are functional. This one''s a retreat. Tapered legs and hand-carved pilasters give the Windsor a presence that reads traditional up close and transitional from the doorway — the kind of piece that makes the whole room feel considered before you''ve added a single towel.

Bright white with brushed nickel keeps it from feeling heavy. Poplar wood solids and veneers on a solid wood frame, finished in seven layers so it holds its depth of colour through years of steam.

Everything closes itself. Soft-close hinged doors, under-mounted soft-close glides on every drawer — no slam, no bang, nobody woken. Tip-out drawers and a pull-out shelf with power station keep the counter clear, which is most of what makes a bathroom feel calm.

A bathroom you walk into at the end of the day and feel your shoulders drop.

**Also in Navy Blue.**', 'Windsor 36″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Windsor 36″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-47.5-NVBLU-BG', 'Windsor-47.5-NVBLU-BG', 'windsor-47-5-bathroom-vanity-in-navy-blue', 'Windsor 47.5" Bathroom Vanity in Navy Blue', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1014', 1549.99, 2249.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Navy Blue', 'blue', 'Windsor-48-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 48″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Some bathrooms are functional. This one''s a retreat. Tapered legs and hand-carved pilasters give the Windsor a presence that reads traditional up close and transitional from the doorway — the kind of piece that makes the whole room feel considered before you''ve added a single towel.

Navy blue with brushed gold keeps it from feeling heavy. Poplar wood solids and veneers on a solid wood frame, finished in seven layers so it holds its depth of colour through years of steam.

Everything closes itself. Soft-close hinged doors, under-mounted soft-close glides on every drawer — no slam, no bang, nobody woken. Tip-out drawers and a pull-out shelf with power station keep the counter clear, which is most of what makes a bathroom feel calm.

A bathroom you walk into at the end of the day and feel your shoulders drop.

**Also in Bright White.**', 'Windsor 48″ Bathroom Vanity in Navy Blue | Bathroom Vanities Outlet', 'Windsor 48″ vanity in navy blue. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-47.5-WH-BN', 'Windsor-47.5-WH-BN', 'windsor-47-5-bathroom-vanity-in-bright-white', 'Windsor 47.5" Bathroom Vanity in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1013', 1499.99, 2149.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Windsor-48-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 48″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Some bathrooms are functional. This one''s a retreat. Tapered legs and hand-carved pilasters give the Windsor a presence that reads traditional up close and transitional from the doorway — the kind of piece that makes the whole room feel considered before you''ve added a single towel.

Bright white with brushed nickel keeps it from feeling heavy. Poplar wood solids and veneers on a solid wood frame, finished in seven layers so it holds its depth of colour through years of steam.

Everything closes itself. Soft-close hinged doors, under-mounted soft-close glides on every drawer — no slam, no bang, nobody woken. Tip-out drawers and a pull-out shelf with power station keep the counter clear, which is most of what makes a bathroom feel calm.

A bathroom you walk into at the end of the day and feel your shoulders drop.

**Also in Navy Blue.**', 'Windsor 48″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Windsor 48″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-59.5D-WH-BN', 'Windsor-59.5D-WH-BN', 'windsor-59-5-double-sink-bathroom-vanity-in-bright-white', 'Windsor 59.5" Double Sink Bathroom Vanity in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Double Sink Cabinet Only', 'base', 'PR1015', 1724.99, 2449.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Windsor-60D-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 60″ double sink bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Some bathrooms are functional. This one''s a retreat. Tapered legs and hand-carved pilasters give the Windsor a presence that reads traditional up close and transitional from the doorway — the kind of piece that makes the whole room feel considered before you''ve added a single towel.

Bright white with brushed nickel keeps it from feeling heavy. Poplar wood solids and veneers on a solid wood frame, finished in seven layers so it holds its depth of colour through years of steam.

Everything closes itself. Soft-close hinged doors, under-mounted soft-close glides on every drawer — no slam, no bang, nobody woken. Tip-out drawers and a pull-out shelf with power station keep the counter clear, which is most of what makes a bathroom feel calm.

A bathroom you walk into at the end of the day and feel your shoulders drop.', 'Windsor 60″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Windsor 60″ double sink vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-59.5S-NVBLU-BG', 'Windsor-59.5S-NVBLU-BG', 'windsor-59-5-single-sink-bathroom-vanity-in-navy-blue', 'Windsor 59.5" Single Sink Bathroom Vanity in Navy Blue', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1018', 1849.99, 2649.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Navy Blue', 'blue', 'Windsor-60S-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 60″ single sink bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Some bathrooms are functional. This one''s a retreat. Tapered legs and hand-carved pilasters give the Windsor a presence that reads traditional up close and transitional from the doorway — the kind of piece that makes the whole room feel considered before you''ve added a single towel.

Navy blue with brushed gold keeps it from feeling heavy. Poplar wood solids and veneers on a solid wood frame, finished in seven layers so it holds its depth of colour through years of steam.

Everything closes itself. Soft-close hinged doors, under-mounted soft-close glides on every drawer — no slam, no bang, nobody woken. Tip-out drawers and a pull-out shelf with power station keep the counter clear, which is most of what makes a bathroom feel calm.

A bathroom you walk into at the end of the day and feel your shoulders drop.

**Also in Bright White.**', 'Windsor 60″ Bathroom Vanity in Navy Blue | Bathroom Vanities Outlet', 'Windsor 60″ single sink vanity in navy blue. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-59.5S-WH-BN', 'Windsor-59.5S-WH-BN', 'windsor-59-5-single-sink-bathroom-vanity-in-bright-white', 'Windsor 59.5" Single Sink Bathroom Vanity in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1017', 1774.99, 2549.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Windsor-60S-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 60″ single sink bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Some bathrooms are functional. This one''s a retreat. Tapered legs and hand-carved pilasters give the Windsor a presence that reads traditional up close and transitional from the doorway — the kind of piece that makes the whole room feel considered before you''ve added a single towel.

Bright white with brushed nickel keeps it from feeling heavy. Poplar wood solids and veneers on a solid wood frame, finished in seven layers so it holds its depth of colour through years of steam.

Everything closes itself. Soft-close hinged doors, under-mounted soft-close glides on every drawer — no slam, no bang, nobody woken. Tip-out drawers and a pull-out shelf with power station keep the counter clear, which is most of what makes a bathroom feel calm.

A bathroom you walk into at the end of the day and feel your shoulders drop.

**Also in Navy Blue.**', 'Windsor 60″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Windsor 60″ single sink vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-59.5D-NVBLU-BG', 'Windsor-59.5D-NVBLU-BG', 'windsor-59-5-double-sink-bathroom-vanity-in-navy-blue', 'Windsor 59.5" Double Sink Bathroom Vanity in Navy Blue', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Double Sink Cabinet Only', 'base', 'PR1016', 1799.99, 2599.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Navy Blue', 'blue', 'Windsor-60D-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 60″ double sink bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Some bathrooms are functional. This one''s a retreat. Tapered legs and hand-carved pilasters give the Windsor a presence that reads traditional up close and transitional from the doorway — the kind of piece that makes the whole room feel considered before you''ve added a single towel.

Navy blue with brushed gold keeps it from feeling heavy. Poplar wood solids and veneers on a solid wood frame, finished in seven layers so it holds its depth of colour through years of steam.

Everything closes itself. Soft-close hinged doors, under-mounted soft-close glides on every drawer — no slam, no bang, nobody woken. Tip-out drawers and a pull-out shelf with power station keep the counter clear, which is most of what makes a bathroom feel calm.

A bathroom you walk into at the end of the day and feel your shoulders drop.', 'Windsor 60″ Bathroom Vanity in Navy Blue | Bathroom Vanities Outlet', 'Windsor 60″ double sink vanity in navy blue. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-71.5-NVBLU-BG', 'Windsor-71.5-NVBLU-BG', 'windsor-71-5-bathroom-vanity-in-navy-blue', 'Windsor 71.5" Bathroom Vanity in Navy Blue', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Double Sink Cabinet Only', 'base', 'PR1020', 1999.99, 2849.99, 71.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Navy Blue', 'blue', 'Windsor-72-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 72″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Some bathrooms are functional. This one''s a retreat. Tapered legs and hand-carved pilasters give the Windsor a presence that reads traditional up close and transitional from the doorway — the kind of piece that makes the whole room feel considered before you''ve added a single towel.

Navy blue with brushed gold keeps it from feeling heavy. Poplar wood solids and veneers on a solid wood frame, finished in seven layers so it holds its depth of colour through years of steam.

Everything closes itself. Soft-close hinged doors, under-mounted soft-close glides on every drawer — no slam, no bang, nobody woken. Tip-out drawers and a pull-out shelf with power station keep the counter clear, which is most of what makes a bathroom feel calm.

A bathroom you walk into at the end of the day and feel your shoulders drop.

**Also in Bright White.**', 'Windsor 72″ Bathroom Vanity in Navy Blue | Bathroom Vanities Outlet', 'Windsor 72″ vanity in navy blue. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-71.5-WH-BN', 'Windsor-71.5-WH-BN', 'windsor-71-5-bathroom-vanity-in-bright-white', 'Windsor 71.5" Bathroom Vanity in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Double Sink Cabinet Only', 'base', 'PR1019', 1899.99, 2699.99, 71.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Windsor-72-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 72″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

Some bathrooms are functional. This one''s a retreat. Tapered legs and hand-carved pilasters give the Windsor a presence that reads traditional up close and transitional from the doorway — the kind of piece that makes the whole room feel considered before you''ve added a single towel.

Bright white with brushed nickel keeps it from feeling heavy. Poplar wood solids and veneers on a solid wood frame, finished in seven layers so it holds its depth of colour through years of steam.

Everything closes itself. Soft-close hinged doors, under-mounted soft-close glides on every drawer — no slam, no bang, nobody woken. Tip-out drawers and a pull-out shelf with power station keep the counter clear, which is most of what makes a bathroom feel calm.

A bathroom you walk into at the end of the day and feel your shoulders drop.

**Also in Navy Blue.**', 'Windsor 72″ Bathroom Vanity in Bright White | Bathroom Vanities Outlet', 'Windsor 72″ vanity in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);
INSERT INTO products (sku, vendor_sku, slug, name, brand, model, collection_id, category_id, product_type, component_role, rflpos_item_id, price, compare_price, width_in, height_in, depth_in, country_origin, warranty, ships_ltl, prop65, color, color_family, mpn, google_product_category, google_condition, identifier_exists, shipping_label, custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4, short_desc, long_desc, meta_title, meta_desc, status, is_active, is_new, is_featured, source_flag)
VALUES ('Windsor-LC-WH-BN', 'Windsor-LC-WH-BN', 'windsor-linen-tower-in-bright-white', 'Windsor Linen Tower in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 6, 'Linen Cabinet', 'base', 'PR1021', 1199.99, 1749.99, 24, 72, 18, 'Vietnam', '30 Day Full Return, 1 Year Limited', 1, 1, 'Bright White', 'white', 'Windsor-24-LC-WHT', 'Home & Garden > Furniture > Cabinets & Storage', 'new', 1, 'freight', 'mid-range', 'Linen Cabinet', 'catalog', 'freight', 'Windsor', 'Windsor 24″ linen tower in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Some images may show accessories and styling for inspiration.**

Everything that doesn''t belong on the counter, finally somewhere. A linen tower is the difference between a bathroom you tidy and a bathroom that stays tidy.

Bright white with brushed nickel, matched to the Windsor vanities so the room reads as one piece rather than two purchases. Solid wood frame, all-wood construction, seven layers of coating — it holds up to a damp room for years without looking tired.

Soft-close doors and under-mounted soft-close glides, so the tall cabinet nearest your head at 6am is the quietest thing in the room.

The storage that keeps the rest of the room looking the way you wanted it to.', 'Windsor 24″ Linen Tower in Bright White | Bathroom Vanities Outlet', 'Windsor 24″ linen tower in bright white. Solid wood frame, seven layers of coating, zinc alloy hardware and soft-close doors and drawers.', 'active', 1, 0, 0, 'manual')
ON DUPLICATE KEY UPDATE
  vendor_sku=VALUES(vendor_sku), name=VALUES(name), brand=VALUES(brand),
  model=VALUES(model), collection_id=VALUES(collection_id),
  category_id=VALUES(category_id), product_type=VALUES(product_type),
  component_role=VALUES(component_role), rflpos_item_id=VALUES(rflpos_item_id),
  price=VALUES(price), compare_price=VALUES(compare_price),
  width_in=VALUES(width_in), height_in=VALUES(height_in), depth_in=VALUES(depth_in),
  country_origin=VALUES(country_origin), warranty=VALUES(warranty),
  ships_ltl=VALUES(ships_ltl), prop65=VALUES(prop65),
  color=VALUES(color), color_family=VALUES(color_family), mpn=VALUES(mpn),
  google_product_category=VALUES(google_product_category),
  google_condition=VALUES(google_condition),
  identifier_exists=VALUES(identifier_exists), shipping_label=VALUES(shipping_label),
  custom_label_0=VALUES(custom_label_0), custom_label_1=VALUES(custom_label_1),
  custom_label_2=VALUES(custom_label_2), custom_label_3=VALUES(custom_label_3),
  custom_label_4=VALUES(custom_label_4),
  short_desc=VALUES(short_desc), long_desc=VALUES(long_desc),
  meta_title=VALUES(meta_title), meta_desc=VALUES(meta_desc),
  status=VALUES(status), is_active=VALUES(is_active), source_flag=VALUES(source_flag);

-- VERIFY step 3 — expect 78 / 78 / 78 and no NULL collection_id.
SELECT COUNT(*) AS er_products,
       COUNT(DISTINCT slug) AS distinct_slugs,
       COUNT(DISTINCT rflpos_item_id) AS distinct_sync_keys,
       SUM(collection_id IS NULL) AS null_collection
  FROM products WHERE brand = 'ER Vanities';

SELECT category_id, product_type, COUNT(*) AS n
  FROM products WHERE brand = 'ER Vanities'
 GROUP BY category_id, product_type ORDER BY n DESC;


-- ===========================================================================
-- STEP 4 — product_images
-- ---------------------------------------------------------------------------
-- Delivered from Cloudinary with f_auto,q_auto so the browser gets AVIF/WebP
-- where supported. sort_order 0 is the hero (is_primary = 1).
-- DELETE-then-INSERT scoped to ER products only, so re-running replaces rather
-- than duplicates.
-- ===========================================================================

DELETE pi FROM product_images pi
  JOIN products p ON p.id = pi.product_id
 WHERE p.brand = 'ER Vanities';

INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-30-natural-white-ash-pr1269-1.jpg', 'Bristol 30 inch bathroom vanity in Natural White Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-30-natural-white-ash-pr1269-2.jpg', 'Bristol 30 inch bathroom vanity in Natural White Ash, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-30-natural-white-ash-pr1269-3.jpg', 'Bristol 30 inch bathroom vanity in Natural White Ash, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-30-natural-white-ash-pr1269-4.jpg', 'Bristol 30 inch bathroom vanity in Natural White Ash, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-36-natural-white-ash-pr1270-1.jpg', 'Bristol 36 inch bathroom vanity in Natural White Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-36-natural-white-ash-pr1270-2.jpg', 'Bristol 36 inch bathroom vanity in Natural White Ash, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-36-natural-white-ash-pr1270-3.jpg', 'Bristol 36 inch bathroom vanity in Natural White Ash, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-36-natural-white-ash-pr1270-4.jpg', 'Bristol 36 inch bathroom vanity in Natural White Ash, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-42-natural-white-ash-pr1271-1.jpg', 'Bristol 42 inch bathroom vanity in Natural White Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-42-natural-white-ash-pr1271-2.jpg', 'Bristol 42 inch bathroom vanity in Natural White Ash, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-42-natural-white-ash-pr1271-3.jpg', 'Bristol 42 inch bathroom vanity in Natural White Ash, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-42-natural-white-ash-pr1271-4.jpg', 'Bristol 42 inch bathroom vanity in Natural White Ash, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-42-natural-white-ash-pr1271-5.jpg', 'Bristol 42 inch bathroom vanity in Natural White Ash, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-42-natural-white-ash-pr1271-6.jpg', 'Bristol 42 inch bathroom vanity in Natural White Ash, product view', 5, 0
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-42-natural-white-ash-pr1271-7.jpg', 'Bristol 42 inch bathroom vanity in Natural White Ash, product view', 6, 0
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-48-natural-white-ash-pr1272-1.jpg', 'Bristol 48 inch bathroom vanity in Natural White Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-48-natural-white-ash-pr1272-2.jpg', 'Bristol 48 inch bathroom vanity in Natural White Ash, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-48-natural-white-ash-pr1272-3.jpg', 'Bristol 48 inch bathroom vanity in Natural White Ash, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-48-natural-white-ash-pr1272-4.jpg', 'Bristol 48 inch bathroom vanity in Natural White Ash, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-48-natural-white-ash-pr1272-5.jpg', 'Bristol 48 inch bathroom vanity in Natural White Ash, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-48-natural-white-ash-pr1272-6.jpg', 'Bristol 48 inch bathroom vanity in Natural White Ash, product view', 5, 0
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-48-natural-white-ash-pr1272-7.jpg', 'Bristol 48 inch bathroom vanity in Natural White Ash, product view', 6, 0
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60d-natural-white-ash-pr1273-1.jpg', 'Bristol 60 inch double sink bathroom vanity in Natural White Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60d-natural-white-ash-pr1273-2.jpg', 'Bristol 60 inch double sink bathroom vanity in Natural White Ash, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60d-natural-white-ash-pr1273-3.jpg', 'Bristol 60 inch double sink bathroom vanity in Natural White Ash, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60d-natural-white-ash-pr1273-4.jpg', 'Bristol 60 inch double sink bathroom vanity in Natural White Ash, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60s-natural-white-ash-pr1274-1.jpg', 'Bristol 60 inch single sink bathroom vanity in Natural White Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60s-natural-white-ash-pr1274-2.jpg', 'Bristol 60 inch single sink bathroom vanity in Natural White Ash, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60s-natural-white-ash-pr1274-3.jpg', 'Bristol 60 inch single sink bathroom vanity in Natural White Ash, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-60s-natural-white-ash-pr1274-4.jpg', 'Bristol 60 inch single sink bathroom vanity in Natural White Ash, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-72-natural-white-ash-pr1275-1.jpg', 'Bristol 72 inch bathroom vanity in Natural White Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-72-natural-white-ash-pr1275-2.jpg', 'Bristol 72 inch bathroom vanity in Natural White Ash, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-72-natural-white-ash-pr1275-3.jpg', 'Bristol 72 inch bathroom vanity in Natural White Ash, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-3-drawer-bristol-bridge3de-natural-white-ash-pr1277-1.jpg', 'Bristol bridge3de inch bathroom vanity in Natural White Ash, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-3-drawer-bristol-bridge3de-natural-white-ash-pr1277-2.jpg', 'Bristol bridge3de inch bathroom vanity in Natural White Ash, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-3-drawer-bristol-bridge3de-natural-white-ash-pr1277-3.jpg', 'Bristol bridge3de inch bathroom vanity in Natural White Ash, bridge configuration', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-3-drawer-bristol-bridge3de-natural-white-ash-pr1277-4.jpg', 'Bristol bridge3de inch bathroom vanity in Natural White Ash, bridge configuration', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-counter-bristol-bridgemucounter-natural-white-pr1276-1.jpg', 'Bristol bridgemucounter inch bathroom vanity in Natural White Ash, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-counter-bristol-bridgemucounter-natural-white-pr1276-2.jpg', 'Bristol bridgemucounter inch bathroom vanity in Natural White Ash, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-counter-bristol-bridgemucounter-natural-white-pr1276-3.jpg', 'Bristol bridgemucounter inch bathroom vanity in Natural White Ash, bridge configuration', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/vanity-bridge-counter-bristol-bridgemucounter-natural-white-pr1276-4.jpg', 'Bristol bridgemucounter inch bathroom vanity in Natural White Ash, bridge configuration', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-desert-oak-1.jpg', 'Kensington 30 inch left drawers bathroom vanity in Desert Oak, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-desert-oak-2.jpg', 'Kensington 30 inch left drawers bathroom vanity in Desert Oak, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-desert-oak-3.jpg', 'Kensington 30 inch left drawers bathroom vanity in Desert Oak, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-desert-oak-4.jpg', 'Kensington 30 inch left drawers bathroom vanity in Desert Oak, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-navy-blue-pr0974-1.jpg', 'Kensington 30 inch left drawers bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-navy-blue-pr0974-2.jpg', 'Kensington 30 inch left drawers bathroom vanity in Navy Blue, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-navy-blue-pr0974-3.jpg', 'Kensington 30 inch left drawers bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30r-desert-oak-1.jpg', 'Kensington 30 inch right drawers bathroom vanity in Desert Oak, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30r-desert-oak-2.jpg', 'Kensington 30 inch right drawers bathroom vanity in Desert Oak, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30r-desert-oak-3.jpg', 'Kensington 30 inch right drawers bathroom vanity in Desert Oak, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30r-desert-oak-4.jpg', 'Kensington 30 inch right drawers bathroom vanity in Desert Oak, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30r-navy-blue-pr0971-1.jpg', 'Kensington 30 inch right drawers bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30r-navy-blue-pr0971-2.jpg', 'Kensington 30 inch right drawers bathroom vanity in Navy Blue, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30r-navy-blue-pr0971-3.jpg', 'Kensington 30 inch right drawers bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-1.jpg', 'Kensington 30 inch right drawers bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-2.jpg', 'Kensington 30 inch right drawers bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-3.jpg', 'Kensington 30 inch right drawers bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-4.jpg', 'Kensington 30 inch right drawers bathroom vanity in Bright White, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 30 inch right drawers bathroom vanity in Bright White, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-desert-oak-1.jpg', 'Kensington 36 inch left drawers bathroom vanity in Desert Oak, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-desert-oak-2.jpg', 'Kensington 36 inch left drawers bathroom vanity in Desert Oak, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-desert-oak-3.jpg', 'Kensington 36 inch left drawers bathroom vanity in Desert Oak, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-desert-oak-4.jpg', 'Kensington 36 inch left drawers bathroom vanity in Desert Oak, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-metal-gray-pr0979-1.jpg', 'Kensington 36 inch left drawers bathroom vanity in Metal Gray, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-metal-gray-pr0979-2.jpg', 'Kensington 36 inch left drawers bathroom vanity in Metal Gray, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-metal-gray-pr0979-3.jpg', 'Kensington 36 inch left drawers bathroom vanity in Metal Gray, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-metal-gray-pr0979-4.jpg', 'Kensington 36 inch left drawers bathroom vanity in Metal Gray, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-metal-gray-pr0979-5.jpg', 'Kensington 36 inch left drawers bathroom vanity in Metal Gray, catalogue photo', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 36 inch left drawers bathroom vanity in Metal Gray, showroom photograph', 5, 0
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-navy-blue-pr0980-1.jpg', 'Kensington 36 inch left drawers bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-navy-blue-pr0980-2.jpg', 'Kensington 36 inch left drawers bathroom vanity in Navy Blue, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-navy-blue-pr0980-3.jpg', 'Kensington 36 inch left drawers bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-bright-white-pr0978-1.jpg', 'Kensington 36 inch left drawers bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-bright-white-pr0978-2.jpg', 'Kensington 36 inch left drawers bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-bright-white-pr0978-3.jpg', 'Kensington 36 inch left drawers bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-bright-white-pr0978-4.jpg', 'Kensington 36 inch left drawers bathroom vanity in Bright White, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36l-bright-white-pr0978-5.jpg', 'Kensington 36 inch left drawers bathroom vanity in Bright White, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 36 inch left drawers bathroom vanity in Bright White, showroom photograph', 5, 0
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-desert-oak-1.jpg', 'Kensington 36 inch right drawers bathroom vanity in Desert Oak, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-desert-oak-2.jpg', 'Kensington 36 inch right drawers bathroom vanity in Desert Oak, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-desert-oak-3.jpg', 'Kensington 36 inch right drawers bathroom vanity in Desert Oak, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-desert-oak-4.jpg', 'Kensington 36 inch right drawers bathroom vanity in Desert Oak, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-metal-gray-pr0976-1.jpg', 'Kensington 36 inch right drawers bathroom vanity in Metal Gray, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-metal-gray-pr0976-2.jpg', 'Kensington 36 inch right drawers bathroom vanity in Metal Gray, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-metal-gray-pr0976-3.jpg', 'Kensington 36 inch right drawers bathroom vanity in Metal Gray, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-metal-gray-pr0976-4.jpg', 'Kensington 36 inch right drawers bathroom vanity in Metal Gray, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-navy-blue-pr0977-1.jpg', 'Kensington 36 inch right drawers bathroom vanity in Navy Blue, render view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-navy-blue-pr0977-2.jpg', 'Kensington 36 inch right drawers bathroom vanity in Navy Blue, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-navy-blue-pr0977-3.jpg', 'Kensington 36 inch right drawers bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-navy-blue-pr0977-4.jpg', 'Kensington 36 inch right drawers bathroom vanity in Navy Blue, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-bright-white-pr0975-1.jpg', 'Kensington 36 inch right drawers bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-bright-white-pr0975-2.jpg', 'Kensington 36 inch right drawers bathroom vanity in Bright White, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-bright-white-pr0975-3.jpg', 'Kensington 36 inch right drawers bathroom vanity in Bright White, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-36r-bright-white-pr0975-4.jpg', 'Kensington 36 inch right drawers bathroom vanity in Bright White, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 36 inch right drawers bathroom vanity in Bright White, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-desert-oak-1.jpg', 'Kensington 42 inch bathroom vanity in Desert Oak, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-desert-oak-2.jpg', 'Kensington 42 inch bathroom vanity in Desert Oak, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-desert-oak-3.jpg', 'Kensington 42 inch bathroom vanity in Desert Oak, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-desert-oak-4.jpg', 'Kensington 42 inch bathroom vanity in Desert Oak, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-desert-oak-5.jpg', 'Kensington 42 inch bathroom vanity in Desert Oak, studio render', 4, 0
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-desert-oak-6.jpg', 'Kensington 42 inch bathroom vanity in Desert Oak, studio render', 5, 0
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-metal-gray-pr0982-1.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-metal-gray-pr0982-2.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-metal-gray-pr0982-3.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-metal-gray-pr0982-4.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-metal-gray-pr0982-5.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-metal-gray-pr0982-6.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, catalogue photo', 5, 0
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-metal-gray-pr0982-7.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, catalogue photo', 6, 0
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 42 inch bathroom vanity in Metal Gray, showroom photograph', 7, 0
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-navy-blue-pr0983-1.jpg', 'Kensington 42 inch bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-navy-blue-pr0983-2.jpg', 'Kensington 42 inch bathroom vanity in Navy Blue, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-navy-blue-pr0983-3.jpg', 'Kensington 42 inch bathroom vanity in Navy Blue, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-navy-blue-pr0983-4.jpg', 'Kensington 42 inch bathroom vanity in Navy Blue, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-navy-blue-pr0983-5.jpg', 'Kensington 42 inch bathroom vanity in Navy Blue, studio render', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-navy-blue-pr0983-6.jpg', 'Kensington 42 inch bathroom vanity in Navy Blue, studio render', 5, 0
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-bright-white-pr0981-1.jpg', 'Kensington 42 inch bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-bright-white-pr0981-2.jpg', 'Kensington 42 inch bathroom vanity in Bright White, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-bright-white-pr0981-3.jpg', 'Kensington 42 inch bathroom vanity in Bright White, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-bright-white-pr0981-4.jpg', 'Kensington 42 inch bathroom vanity in Bright White, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-bright-white-pr0981-5.jpg', 'Kensington 42 inch bathroom vanity in Bright White, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-bright-white-pr0981-6.jpg', 'Kensington 42 inch bathroom vanity in Bright White, catalogue photo', 5, 0
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-42-bright-white-pr0981-7.jpg', 'Kensington 42 inch bathroom vanity in Bright White, catalogue photo', 6, 0
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 42 inch bathroom vanity in Bright White, showroom photograph', 7, 0
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-1.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-2.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-3.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-4.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-5.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-6.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, catalogue photo', 5, 0
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-7.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, catalogue photo', 6, 0
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-metal-gray-pr0986-8.jpg', 'Kensington 48 inch bathroom vanity in Metal Gray, catalogue photo', 7, 0
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-1.jpg', 'Kensington 48 inch bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-2.jpg', 'Kensington 48 inch bathroom vanity in Bright White, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-3.jpg', 'Kensington 48 inch bathroom vanity in Bright White, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-4.jpg', 'Kensington 48 inch bathroom vanity in Bright White, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-5.jpg', 'Kensington 48 inch bathroom vanity in Bright White, render view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-6.jpg', 'Kensington 48 inch bathroom vanity in Bright White, catalogue photo', 5, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-7.jpg', 'Kensington 48 inch bathroom vanity in Bright White, catalogue photo', 6, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-48-bright-white-pr0985-8.jpg', 'Kensington 48 inch bathroom vanity in Bright White, catalogue photo', 7, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 48 inch bathroom vanity in Bright White, showroom photograph', 8, 0
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-metal-gray-pr0988-1.jpg', 'Kensington 60 inch double sink bathroom vanity in Metal Gray, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-metal-gray-pr0988-2.jpg', 'Kensington 60 inch double sink bathroom vanity in Metal Gray, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-metal-gray-pr0988-3.jpg', 'Kensington 60 inch double sink bathroom vanity in Metal Gray, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-metal-gray-pr0988-4.jpg', 'Kensington 60 inch double sink bathroom vanity in Metal Gray, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 60 inch double sink bathroom vanity in Metal Gray, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-bright-white-pr0987-1.jpg', 'Kensington 60 inch double sink bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-bright-white-pr0987-2.jpg', 'Kensington 60 inch double sink bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-bright-white-pr0987-3.jpg', 'Kensington 60 inch double sink bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60d-bright-white-pr0987-4.jpg', 'Kensington 60 inch double sink bathroom vanity in Bright White, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 60 inch double sink bathroom vanity in Bright White, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60s-metal-gray-pr0990-1.jpg', 'Kensington 60 inch single sink bathroom vanity in Metal Gray, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60s-metal-gray-pr0990-2.jpg', 'Kensington 60 inch single sink bathroom vanity in Metal Gray, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60s-metal-gray-pr0990-3.jpg', 'Kensington 60 inch single sink bathroom vanity in Metal Gray, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-60s-metal-gray-pr0990-4.jpg', 'Kensington 60 inch single sink bathroom vanity in Metal Gray, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 60 inch single sink bathroom vanity in Metal Gray, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-59s-bright-white-pr0989-1.jpg', 'Kensington 59 inch single sink bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-59s-bright-white-pr0989-2.jpg', 'Kensington 59 inch single sink bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-59s-bright-white-pr0989-3.jpg', 'Kensington 59 inch single sink bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 59 inch single sink bathroom vanity in Bright White, showroom photograph', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-metal-gray-pr0992-1.jpg', 'Kensington 72 inch bathroom vanity in Metal Gray, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-metal-gray-pr0992-2.jpg', 'Kensington 72 inch bathroom vanity in Metal Gray, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-metal-gray-pr0992-3.jpg', 'Kensington 72 inch bathroom vanity in Metal Gray, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-metal-gray-pr0992-4.jpg', 'Kensington 72 inch bathroom vanity in Metal Gray, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 72 inch bathroom vanity in Metal Gray, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-bright-white-pr0991-1.jpg', 'Kensington 72 inch bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-bright-white-pr0991-2.jpg', 'Kensington 72 inch bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-bright-white-pr0991-3.jpg', 'Kensington 72 inch bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-72-bright-white-pr0991-4.jpg', 'Kensington 72 inch bathroom vanity in Bright White, catalogue photo', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-kensington-bright-white-5.jpg', 'Kensington 72 inch bathroom vanity in Bright White, showroom photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-24-desert-oak-pr0994-1.jpg', 'London 24 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-24-desert-oak-pr0994-2.jpg', 'London 24 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-24-desert-oak-pr0994-3.jpg', 'London 24 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-24-desert-oak-pr0994-4.jpg', 'London 24 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-24-bright-white-pr0993-1.jpg', 'London 24 inch bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-24-bright-white-pr0993-2.jpg', 'London 24 inch bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-24-bright-white-pr0993-3.jpg', 'London 24 inch bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-bright-white-pr0995-1.jpg', 'London 30 inch bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-bright-white-pr0995-2.jpg', 'London 30 inch bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-bright-white-pr0995-3.jpg', 'London 30 inch bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-desert-oak-pr0996-1.jpg', 'London 30 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-desert-oak-pr0996-2.jpg', 'London 30 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-desert-oak-pr0996-3.jpg', 'London 30 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-desert-oak-pr0996-4.jpg', 'London 30 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-30-desert-oak-pr0996-5.jpg', 'London 30 inch bathroom vanity in Desert Oak, composite view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-36r-desert-oak-pr0998-1.jpg', 'London 36 inch right drawers bathroom vanity in Desert Oak, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-36r-desert-oak-pr0998-2.jpg', 'London 36 inch right drawers bathroom vanity in Desert Oak, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-36r-desert-oak-pr0998-3.jpg', 'London 36 inch right drawers bathroom vanity in Desert Oak, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-36r-desert-oak-pr0998-4.jpg', 'London 36 inch right drawers bathroom vanity in Desert Oak, composite view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-36r-bright-white-pr0997-1.jpg', 'London 36 inch right drawers bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-36r-bright-white-pr0997-2.jpg', 'London 36 inch right drawers bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-36r-bright-white-pr0997-3.jpg', 'London 36 inch right drawers bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-48-desert-oak-pr1000-1.jpg', 'London 48 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-48-desert-oak-pr1000-2.jpg', 'London 48 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-48-desert-oak-pr1000-3.jpg', 'London 48 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-48-desert-oak-pr1000-4.jpg', 'London 48 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-48-bright-white-pr0999-1.jpg', 'London 48 inch bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-48-bright-white-pr0999-2.jpg', 'London 48 inch bathroom vanity in Bright White, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-48-bright-white-pr0999-3.jpg', 'London 48 inch bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60d-desert-oak-pr1002-1.jpg', 'London 60 inch double sink bathroom vanity in Desert Oak, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60d-desert-oak-pr1002-2.jpg', 'London 60 inch double sink bathroom vanity in Desert Oak, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60d-desert-oak-pr1002-3.jpg', 'London 60 inch double sink bathroom vanity in Desert Oak, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60d-bright-white-pr1001-1.jpg', 'London 60 inch double sink bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60d-bright-white-pr1001-2.jpg', 'London 60 inch double sink bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60d-bright-white-pr1001-3.jpg', 'London 60 inch double sink bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60s-desert-oak-pr1004-1.jpg', 'London 60 inch single sink bathroom vanity in Desert Oak, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60s-desert-oak-pr1004-2.jpg', 'London 60 inch single sink bathroom vanity in Desert Oak, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60s-desert-oak-pr1004-3.jpg', 'London 60 inch single sink bathroom vanity in Desert Oak, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60s-desert-oak-pr1004-4.jpg', 'London 60 inch single sink bathroom vanity in Desert Oak, composite view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60s-bright-white-pr1003-1.jpg', 'London 60 inch single sink bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60s-bright-white-pr1003-2.jpg', 'London 60 inch single sink bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-60s-bright-white-pr1003-3.jpg', 'London 60 inch single sink bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-desert-oak-pr1006-1.jpg', 'London 72 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-desert-oak-pr1006-2.jpg', 'London 72 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-desert-oak-pr1006-3.jpg', 'London 72 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-desert-oak-pr1006-4.jpg', 'London 72 inch bathroom vanity in Desert Oak, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-desert-oak-pr1006-5.jpg', 'London 72 inch bathroom vanity in Desert Oak, composite view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-bright-white-pr1005-1.jpg', 'London 72 inch bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-bright-white-pr1005-2.jpg', 'London 72 inch bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-london-72-bright-white-pr1005-3.jpg', 'London 72 inch bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-black-pr1024-1.jpg', 'Oxford 30 inch bathroom vanity in Black, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-black-pr1024-2.jpg', 'Oxford 30 inch bathroom vanity in Black, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-black-pr1024-3.jpg', 'Oxford 30 inch bathroom vanity in Black, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-black-pr1024-4.jpg', 'Oxford 30 inch bathroom vanity in Black, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-sage-green-pr1023-1.jpg', 'Oxford 30 inch bathroom vanity in Sage Green, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-sage-green-pr1023-2.jpg', 'Oxford 30 inch bathroom vanity in Sage Green, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-sage-green-pr1023-3.jpg', 'Oxford 30 inch bathroom vanity in Sage Green, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-sage-green-pr1023-4.jpg', 'Oxford 30 inch bathroom vanity in Sage Green, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-whitewashed-ash-pr1264-1.jpg', 'Oxford 30 inch bathroom vanity in Whitewashed Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-whitewashed-ash-pr1264-2.jpg', 'Oxford 30 inch bathroom vanity in Whitewashed Ash, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-whitewashed-ash-pr1264-3.jpg', 'Oxford 30 inch bathroom vanity in Whitewashed Ash, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-whitewashed-ash-pr1264-4.jpg', 'Oxford 30 inch bathroom vanity in Whitewashed Ash, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-30-whitewashed-ash-pr1264-5.jpg', 'Oxford 30 inch bathroom vanity in Whitewashed Ash, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-black-pr1026-1.jpg', 'Oxford 36 inch bathroom vanity in Black, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-black-pr1026-2.jpg', 'Oxford 36 inch bathroom vanity in Black, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-black-pr1026-3.jpg', 'Oxford 36 inch bathroom vanity in Black, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-sage-green-pr1025-1.jpg', 'Oxford 36 inch bathroom vanity in Sage Green, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-sage-green-pr1025-2.jpg', 'Oxford 36 inch bathroom vanity in Sage Green, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-sage-green-pr1025-3.jpg', 'Oxford 36 inch bathroom vanity in Sage Green, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-sage-green-pr1025-4.jpg', 'Oxford 36 inch bathroom vanity in Sage Green, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-whitewashed-ash-pr1265-1.jpg', 'Oxford 36 inch bathroom vanity in Whitewashed Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-whitewashed-ash-pr1265-2.jpg', 'Oxford 36 inch bathroom vanity in Whitewashed Ash, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-whitewashed-ash-pr1265-3.jpg', 'Oxford 36 inch bathroom vanity in Whitewashed Ash, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-whitewashed-ash-pr1265-4.jpg', 'Oxford 36 inch bathroom vanity in Whitewashed Ash, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-36-whitewashed-ash-pr1265-5.jpg', 'Oxford 36 inch bathroom vanity in Whitewashed Ash, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-black-pr1028-1.jpg', 'Oxford 42 inch bathroom vanity in Black, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-black-pr1028-2.jpg', 'Oxford 42 inch bathroom vanity in Black, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-black-pr1028-3.jpg', 'Oxford 42 inch bathroom vanity in Black, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-black-pr1028-4.jpg', 'Oxford 42 inch bathroom vanity in Black, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-sage-green-pr1027-1.jpg', 'Oxford 42 inch bathroom vanity in Sage Green, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-sage-green-pr1027-2.jpg', 'Oxford 42 inch bathroom vanity in Sage Green, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-sage-green-pr1027-3.jpg', 'Oxford 42 inch bathroom vanity in Sage Green, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-sage-green-pr1027-4.jpg', 'Oxford 42 inch bathroom vanity in Sage Green, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-1.jpg', 'Oxford 42 inch bathroom vanity in Whitewashed Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-2.jpg', 'Oxford 42 inch bathroom vanity in Whitewashed Ash, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-3.jpg', 'Oxford 42 inch bathroom vanity in Whitewashed Ash, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-4.jpg', 'Oxford 42 inch bathroom vanity in Whitewashed Ash, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-5.jpg', 'Oxford 42 inch bathroom vanity in Whitewashed Ash, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-6.jpg', 'Oxford 42 inch bathroom vanity in Whitewashed Ash, product view', 5, 0
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-42-whitewashed-ash-pr1266-7.jpg', 'Oxford 42 inch bathroom vanity in Whitewashed Ash, product view', 6, 0
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-sage-green-pr1029-1.jpg', 'Oxford 48 inch bathroom vanity in Sage Green, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-sage-green-pr1029-2.jpg', 'Oxford 48 inch bathroom vanity in Sage Green, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-sage-green-pr1029-3.jpg', 'Oxford 48 inch bathroom vanity in Sage Green, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-sage-green-pr1029-4.jpg', 'Oxford 48 inch bathroom vanity in Sage Green, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-black-pr1030-1.jpg', 'Oxford 48 inch bathroom vanity in Black, front view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-black-pr1030-2.jpg', 'Oxford 48 inch bathroom vanity in Black, angled view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-black-pr1030-3.jpg', 'Oxford 48 inch bathroom vanity in Black, doors open', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-black-pr1030-4.jpg', 'Oxford 48 inch bathroom vanity in Black, styled in a modern bathroom', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-whitewashed-ash-pr1267-1.jpg', 'Oxford 48 inch bathroom vanity in Whitewashed Ash, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-whitewashed-ash-pr1267-2.jpg', 'Oxford 48 inch bathroom vanity in Whitewashed Ash, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-whitewashed-ash-pr1267-3.jpg', 'Oxford 48 inch bathroom vanity in Whitewashed Ash, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-whitewashed-ash-pr1267-4.jpg', 'Oxford 48 inch bathroom vanity in Whitewashed Ash, render view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-whitewashed-ash-pr1267-5.jpg', 'Oxford 48 inch bathroom vanity in Whitewashed Ash, product view', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-whitewashed-ash-pr1267-6.jpg', 'Oxford 48 inch bathroom vanity in Whitewashed Ash, product view', 5, 0
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-oxford-48-whitewashed-ash-pr1267-7.jpg', 'Oxford 48 inch bathroom vanity in Whitewashed Ash, product view', 6, 0
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-navy-blue-pr1008-1.jpg', 'Windsor 30 inch bathroom vanity in Navy Blue, render view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-navy-blue-pr1008-2.jpg', 'Windsor 30 inch bathroom vanity in Navy Blue, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-navy-blue-pr1008-3.jpg', 'Windsor 30 inch bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-bright-white-pr1007-1.jpg', 'Windsor 30 inch bathroom vanity in Bright White, render view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-bright-white-pr1007-2.jpg', 'Windsor 30 inch bathroom vanity in Bright White, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-bright-white-pr1007-3.jpg', 'Windsor 30 inch bathroom vanity in Bright White, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-bright-white-pr1007-4.jpg', 'Windsor 30 inch bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-30-bright-white-pr1007-5.jpg', 'Windsor 30 inch bathroom vanity in Bright White, studio render', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-8.jpg', 'Windsor 36 inch left drawers bathroom vanity in Bright White, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-9.jpg', 'Windsor 36 inch left drawers bathroom vanity in Bright White, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-10.jpg', 'Windsor 36 inch left drawers bathroom vanity in Bright White, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-11.jpg', 'Windsor 36 inch left drawers bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-navy-blue-6.jpg', 'Windsor 36 inch right drawers bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-navy-blue-7.jpg', 'Windsor 36 inch right drawers bathroom vanity in Navy Blue, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-8.jpg', 'Windsor 36 inch right drawers bathroom vanity in Bright White, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-9.jpg', 'Windsor 36 inch right drawers bathroom vanity in Bright White, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-10.jpg', 'Windsor 36 inch right drawers bathroom vanity in Bright White, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/shared-windsor-bright-white-11.jpg', 'Windsor 36 inch right drawers bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-navy-blue-pr1014-1.jpg', 'Windsor 48 inch bathroom vanity in Navy Blue, render view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-navy-blue-pr1014-2.jpg', 'Windsor 48 inch bathroom vanity in Navy Blue, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-navy-blue-pr1014-3.jpg', 'Windsor 48 inch bathroom vanity in Navy Blue, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-navy-blue-pr1014-4.jpg', 'Windsor 48 inch bathroom vanity in Navy Blue, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-navy-blue-pr1014-5.jpg', 'Windsor 48 inch bathroom vanity in Navy Blue, studio render', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-navy-blue-pr1014-6.jpg', 'Windsor 48 inch bathroom vanity in Navy Blue, studio render', 5, 0
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-bright-white-pr1013-1.jpg', 'Windsor 48 inch bathroom vanity in Bright White, render view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-bright-white-pr1013-2.jpg', 'Windsor 48 inch bathroom vanity in Bright White, render view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-bright-white-pr1013-3.jpg', 'Windsor 48 inch bathroom vanity in Bright White, render view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-bright-white-pr1013-4.jpg', 'Windsor 48 inch bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-bright-white-pr1013-5.jpg', 'Windsor 48 inch bathroom vanity in Bright White, studio render', 4, 0
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-48-bright-white-pr1013-6.jpg', 'Windsor 48 inch bathroom vanity in Bright White, studio render', 5, 0
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60d-bright-white-pr1015-1.jpg', 'Windsor 60 inch double sink bathroom vanity in Bright White, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60d-bright-white-pr1015-2.jpg', 'Windsor 60 inch double sink bathroom vanity in Bright White, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60d-bright-white-pr1015-3.jpg', 'Windsor 60 inch double sink bathroom vanity in Bright White, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60d-bright-white-pr1015-4.jpg', 'Windsor 60 inch double sink bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60s-navy-blue-pr1018-1.jpg', 'Windsor 60 inch single sink bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60s-navy-blue-pr1018-2.jpg', 'Windsor 60 inch single sink bathroom vanity in Navy Blue, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60s-navy-blue-pr1018-3.jpg', 'Windsor 60 inch single sink bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60s-bright-white-pr1017-1.jpg', 'Windsor 60 inch single sink bathroom vanity in Bright White, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60s-bright-white-pr1017-2.jpg', 'Windsor 60 inch single sink bathroom vanity in Bright White, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60s-bright-white-pr1017-3.jpg', 'Windsor 60 inch single sink bathroom vanity in Bright White, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-60s-bright-white-pr1017-4.jpg', 'Windsor 60 inch single sink bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-59d-navy-blue-pr1016-1.jpg', 'Windsor 59 inch double sink bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-59d-navy-blue-pr1016-2.jpg', 'Windsor 59 inch double sink bathroom vanity in Navy Blue, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-59d-navy-blue-pr1016-3.jpg', 'Windsor 59 inch double sink bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-59d-navy-blue-pr1016-4.jpg', 'Windsor 59 inch double sink bathroom vanity in Navy Blue, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-navy-blue-pr1020-1.jpg', 'Windsor 72 inch bathroom vanity in Navy Blue, studio render', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-navy-blue-pr1020-2.jpg', 'Windsor 72 inch bathroom vanity in Navy Blue, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-navy-blue-pr1020-3.jpg', 'Windsor 72 inch bathroom vanity in Navy Blue, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-navy-blue-pr1020-4.jpg', 'Windsor 72 inch bathroom vanity in Navy Blue, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-bright-white-pr1019-1.jpg', 'Windsor 72 inch bathroom vanity in Bright White, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-bright-white-pr1019-2.jpg', 'Windsor 72 inch bathroom vanity in Bright White, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-bright-white-pr1019-3.jpg', 'Windsor 72 inch bathroom vanity in Bright White, styled in a modern bathroom', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-windsor-72-bright-white-pr1019-4.jpg', 'Windsor 72 inch bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/linen-tower-windsor-lc-bright-white-pr1021-1.jpg', 'Windsor lc inch bathroom vanity in Bright White, styled in a modern bathroom', 0, 1
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/linen-tower-windsor-lc-bright-white-pr1021-2.jpg', 'Windsor lc inch bathroom vanity in Bright White, studio render', 1, 0
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/linen-tower-windsor-lc-bright-white-pr1021-3.jpg', 'Windsor lc inch bathroom vanity in Bright White, studio render', 2, 0
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/linen-tower-windsor-lc-bright-white-pr1021-4.jpg', 'Windsor lc inch bathroom vanity in Bright White, studio render', 3, 0
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bridge-drawer-kensington-23-metal-gray-1.jpg', 'Kensington 23 inch bridge drawer in Metal Gray, shown between two vanities', 0, 1
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bridge-drawer-kensington-23-metal-gray-2.jpg', 'Kensington 23 inch bridge drawer in Metal Gray, shown between two vanities', 1, 0
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bridge-drawer-kensington-23-bright-white-1.jpg', 'Kensington 23 inch bridge drawer in Bright White, shown between two vanities', 0, 1
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bridge-drawer-kensington-23-bright-white-2.jpg', 'Kensington 23 inch bridge drawer in Bright White, shown between two vanities', 1, 0
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-bright-white-pr0972-1.jpg', 'Kensington 30 inch left drawers bathroom vanity in Bright White, product view', 0, 1
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-bright-white-pr0972-2.jpg', 'Kensington 30 inch left drawers bathroom vanity in Bright White, product view', 1, 0
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-bright-white-pr0972-3.jpg', 'Kensington 30 inch left drawers bathroom vanity in Bright White, product view', 2, 0
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-bright-white-pr0972-4.jpg', 'Kensington 30 inch left drawers bathroom vanity in Bright White, product view', 3, 0
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT id, 'https://res.cloudinary.com/bathroom-vanities-outlet/image/upload/f_auto,q_auto/bathroom-vanities-outlet/er-vanities/bathroom-vanity-kensington-30l-bright-white-pr0972-5.jpg', 'Kensington 30 inch left drawers bathroom vanity in Bright White, styled room photograph', 4, 0
  FROM products WHERE rflpos_item_id = 'PR0972';

-- VERIFY step 4 — expect 341 rows and exactly one primary per product.
SELECT COUNT(*) AS image_rows FROM product_images pi
  JOIN products p ON p.id = pi.product_id WHERE p.brand = 'ER Vanities';

SELECT p.sku, COUNT(*) AS imgs, SUM(pi.is_primary) AS primaries
  FROM products p LEFT JOIN product_images pi ON pi.product_id = p.id
 WHERE p.brand = 'ER Vanities'
 GROUP BY p.id HAVING primaries <> 1 OR imgs = 0;
-- ^ expect ONE row: Windsor-35.5L-NVBLU-BG, which has no imagery yet.


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


-- ===========================================================================
-- STEP 6 — product_bullets  (8 per SKU)
-- ===========================================================================

DELETE pb FROM product_bullets pb
  JOIN products p ON p.id = pb.product_id
 WHERE p.brand = 'ER Vanities';

INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1269';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1270';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1271';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1272';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1273';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1274';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '72″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1275';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, 'Freestanding, and dimensioned to close the gap between two vanities so the run reads as one deliberate wall of storage instead of two purchases.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1277';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction over a solid wood frame — an investment that keeps looking stunning the whole time you own it.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with great coverage, so the tone stays exactly as warm as the day you unpacked it.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, chosen for a finish that lasts rather than one that only looks good in the box.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so nothing slams and nothing wakes the house.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Open, unhurried storage with a built-in rod for toilet paper, keeping the counter clear and the room feeling bigger than it is.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, 'Freestanding, and dimensioned to close the gap between two vanities so the run reads as one deliberate wall of storage instead of two purchases.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1276';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '1 door and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '1 door and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '1 door and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '1 door and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '1 door and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '1 door and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '72″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — every bit of it where you''d reach for it, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '72″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you''d reach for it, with a built-in rod for toilet paper, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, 'Freestanding, and dimensioned to close the gap between two vanities so the run reads as one deliberate wall of storage instead of two purchases.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-MG-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'All-wood construction on a solid wood frame — built to take a busy shared bathroom for years and still look like the day it arrived.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating over every surface, so daily steam, splashes and wipe-downs leave it looking new rather than tired.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, with a long-lasting finish that still reads crisp years after the fixtures around it have started to dull.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges: everything closes itself, quietly — which matters most at 6am when someone else is still asleep.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you''d reach for it, with a built-in rod for toilet paper, and nothing left on the counter that doesn''t need to be.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, 'Freestanding, and dimensioned to close the gap between two vanities so the run reads as one deliberate wall of storage instead of two purchases.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'Kensington-BridgeCabinet-WH-BN';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 1 drawer, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '24″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 1 drawer, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '24″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 1 drawer, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 1 drawer, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 4 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '72″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame and all-wood construction throughout, so it stays square and true instead of loosening the way a bathroom cabinet usually does.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating built up soft and smooth — the reason this still photographs well in year six.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel that wears its finish rather than losing it.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges, so drawers stay tight and true for years and nothing ever slams.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage, so every day-to-day thing is within reach and the clutter that collects on a bathroom counter is finally out of sight.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '72″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1024';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1023';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1264';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1026';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1025';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1265';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1028';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1027';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '42″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1266';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1029';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1030';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame, all-wood construction — a cabinet you buy once, not one you replace in five years.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Seven layers of coating, soft and smooth with full coverage, so the colour you chose is still the colour you see after years of steam and wiping down.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in matte black — a long-lasting finish that still looks right years in rather than wearing dull.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Under-mounted soft-close glides and soft-close hinges — doors and drawers settle themselves instead of banging.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage laid out where you actually reach for it, with a built-in rod for toilet paper, so the counter and floor stay clear in a room with no space to spare.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships built apart from the legs, which attach on arrival. Nothing else needs assembling — so it is standing and level within minutes, not an evening.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1267';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 1 drawer, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 1 drawer, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '30″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 5 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 5 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 5 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 5 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '36″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '48″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '2 doors and 9 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide and freestanding — sized to fit the space you have without the cramped look of something too small for the wall.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '60″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed gold, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '72″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, '4 doors and 6 drawers, plus a built-in rod for toilet paper storage — generous enough that the room stays calm, because a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, '72″ wide, freestanding, and laid out for two sinks — so nobody is waiting their turn on a weekday morning.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully assembled. Cabinet only: tops and faucets are sold separately, so you choose the surface rather than settling for the one that came with it.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1019';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 1, 'Solid wood frame with all-wood construction, so the presence it has on day one is the presence it still has a decade in.'
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 2, 'Finished in seven layers of coating, which is how it holds its depth of colour through years of hot showers.'
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 3, 'Zinc alloy hardware in brushed nickel, weighted and long-lasting, so the details you notice up close keep looking deliberate.'
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 4, 'Soft-close hinged doors and under-mounted soft-close glides on every drawer. No slam, no bang, nobody woken.'
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 5, 'Storage generous enough to keep the room calm, with a built-in rod for toilet paper — a clear counter is most of what makes a bathroom feel like a retreat.'
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 6, 'Freestanding and sized to stand beside the vanity rather than crowd it — vertical storage where the floor space is doing nothing.'
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 7, 'Ships fully built — no assembly, no flat-pack evening, just carry it in and stand it up.'
  FROM products WHERE rflpos_item_id = 'PR1021';
INSERT INTO product_bullets (product_id, sort_order, bullet_text)
SELECT id, 8, 'Made in Vietnam, with a 30-day full return window and a 1-year limited warranty — the part that matters after the delivery truck has gone.'
  FROM products WHERE rflpos_item_id = 'PR1021';

-- VERIFY step 6 — expect 624 rows, 8 per product.
SELECT COUNT(*) AS bullet_rows FROM product_bullets pb
  JOIN products p ON p.id = pb.product_id WHERE p.brand = 'ER Vanities';


-- ===========================================================================
-- STEP 7 — product_documents  (use manuals, 54 SKUs)
-- ---------------------------------------------------------------------------
-- Oxford and Bristol have no manufacturer manual yet, and neither do the
-- components — 24 SKUs with no row here is correct, not a gap.
-- ===========================================================================

DELETE pd FROM product_documents pd
  JOIN products p ON p.id = pd.product_id
 WHERE p.brand = 'ER Vanities';

INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-30l-use-manual.pdf', 'Kensington 29.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5L-DOAK-MB';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-30l-use-manual.pdf', 'Kensington 29.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0974';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-30l-use-manual.pdf', 'Kensington 29.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0972';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-30r-use-manual.pdf', 'Kensington 29.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'Kensington-29.5R-DOAK-MB';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-30r-use-manual.pdf', 'Kensington 29.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0971';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-30r-use-manual.pdf', 'Kensington 29.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0969';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36l-use-manual.pdf', 'Kensington 35.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5L-DOAK-MB';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36l-use-manual.pdf', 'Kensington 35.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0979';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36l-use-manual.pdf', 'Kensington 35.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0980';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36l-use-manual.pdf', 'Kensington 35.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0978';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36r-use-manual.pdf', 'Kensington 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'Kensington-35.5R-DOAK-MB';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36r-use-manual.pdf', 'Kensington 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0976';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36r-use-manual.pdf', 'Kensington 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0977';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-36r-use-manual.pdf', 'Kensington 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0975';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-42-use-manual.pdf', 'Kensington 41.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'Kensington-41.5-DOAK-MB';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-42-use-manual.pdf', 'Kensington 41.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0982';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-42-use-manual.pdf', 'Kensington 41.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0983';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-42-use-manual.pdf', 'Kensington 41.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0981';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-48-use-manual.pdf', 'Kensington 47.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0986';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-48-use-manual.pdf', 'Kensington 47.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0985';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-60d-use-manual.pdf', 'Kensington 59.5D Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0988';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-60d-use-manual.pdf', 'Kensington 59.5D Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0987';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-60s-use-manual.pdf', 'Kensington 59.5S Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0990';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-60s-use-manual.pdf', 'Kensington 59.5S Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0989';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-72-use-manual.pdf', 'Kensington 71.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0992';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-kensington-72-use-manual.pdf', 'Kensington 71.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0991';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-24-use-manual.pdf', 'London 23.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0994';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-24-use-manual.pdf', 'London 23.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0993';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-30-use-manual.pdf', 'London 29.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0995';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-30-use-manual.pdf', 'London 29.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0996';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-36r-use-manual.pdf', 'London 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0998';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-36r-use-manual.pdf', 'London 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0997';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-48-use-manual.pdf', 'London 47.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1000';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-48-use-manual.pdf', 'London 47.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR0999';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-60d-use-manual.pdf', 'London 59.5D Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1002';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-60d-use-manual.pdf', 'London 59.5D Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1001';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-60s-use-manual.pdf', 'London 59.5S Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1004';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-60s-use-manual.pdf', 'London 59.5S Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1003';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-72-use-manual.pdf', 'London 71.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1006';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-london-72-use-manual.pdf', 'London 71.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1005';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-30-use-manual.pdf', 'Windsor 29.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1008';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-30-use-manual.pdf', 'Windsor 29.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1007';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-36l-use-manual.pdf', 'Windsor 35.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1012';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-36l-use-manual.pdf', 'Windsor 35.5L Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1011';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-36r-use-manual.pdf', 'Windsor 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1010';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-36r-use-manual.pdf', 'Windsor 35.5R Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1009';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-48-use-manual.pdf', 'Windsor 47.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1014';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-48-use-manual.pdf', 'Windsor 47.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1013';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-60d-use-manual.pdf', 'Windsor 59.5D Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1015';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-60s-use-manual.pdf', 'Windsor 59.5S Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1018';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-60s-use-manual.pdf', 'Windsor 59.5S Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1017';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-60d-use-manual.pdf', 'Windsor 59.5D Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1016';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-72-use-manual.pdf', 'Windsor 71.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1020';
INSERT INTO product_documents (product_id, doc_type, url, label)
SELECT id, 'assembly_instructions', 'https://res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/er-vanities-windsor-72-use-manual.pdf', 'Windsor 71.5 Use & Care Manual'
  FROM products WHERE rflpos_item_id = 'PR1019';

-- VERIFY step 7 — expect 54 rows.
SELECT COUNT(*) AS document_rows FROM product_documents pd
  JOIN products p ON p.id = pd.product_id WHERE p.brand = 'ER Vanities';


-- ===========================================================================
-- STEP 8 — product_components  (bridge units and the linen tower)
-- ---------------------------------------------------------------------------
-- Keyed on SKU strings, not product ids, per the table's own design.
-- Matched on collection + cabinet finish + hardware finish: a bright white
-- bridge between two navy cabinets is not a pairing.
-- product_accessories is deliberately left EMPTY — mirroring this relationship
-- into a second table is the two-homes-for-one-fact problem Rule 10 prevents.
-- ===========================================================================

INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-29.5-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-35.5-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-41.5-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-47.5-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-59.5D-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-59.5S-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-71.5-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-29.5-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-35.5-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-41.5-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-47.5-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-59.5D-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-59.5S-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-71.5-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-35.5L-MGR-BN', 'Kensington-BridgeCabinet-MG-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-35.5R-MGR-BN', 'Kensington-BridgeCabinet-MG-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-41.5-MGR-BN', 'Kensington-BridgeCabinet-MG-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-47.5-MGR-BN', 'Kensington-BridgeCabinet-MG-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-59.5D-MGR-BN', 'Kensington-BridgeCabinet-MG-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-59.5S-MGR-BN', 'Kensington-BridgeCabinet-MG-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-71.5-MGR-BN', 'Kensington-BridgeCabinet-MG-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-29.5L-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-29.5R-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-35.5L-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-35.5R-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-41.5-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-47.5-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-59.5D-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-59.5S-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-71.5-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Windsor-29.5-WH-BN', 'Windsor-LC-WH-BN', 'linen', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Windsor-35.5L-WH-BN', 'Windsor-LC-WH-BN', 'linen', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Windsor-35.5R-WH-BN', 'Windsor-LC-WH-BN', 'linen', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Windsor-47.5-WH-BN', 'Windsor-LC-WH-BN', 'linen', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Windsor-59.5D-WH-BN', 'Windsor-LC-WH-BN', 'linen', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Windsor-59.5S-WH-BN', 'Windsor-LC-WH-BN', 'linen', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Windsor-71.5-WH-BN', 'Windsor-LC-WH-BN', 'linen', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);

-- VERIFY step 8 — expect 37 rows.
SELECT COUNT(*) AS component_rows FROM product_components
 WHERE component_sku LIKE 'Kensington-Bridge%'
    OR component_sku LIKE 'Bristol-Bridge%'
    OR component_sku LIKE 'Windsor-LC%';


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

