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
VALUES ('Bristol-29.5-NWA-BG', 'Bristol-29.5-NWA-BG', 'bristol-29-5-bathroom-vanity-in-natural-white-ash', 'Bristol 29.5" Bathroom Vanity in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 1, 'Single Sink Cabinet Only', 'base', 'PR1269', 1049.99, 1499.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Natural White Ash', 'wood_l', 'Bristol-30-NWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Bristol', 'Bristol 30″ bathroom vanity in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Bristol-35.5-NWA-BG', 'Bristol-35.5-NWA-BG', 'bristol-35-5-bathroom-vanity-in-natural-white-ash', 'Bristol 35.5" Bathroom Vanity in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 1, 'Single Sink Cabinet Only', 'base', 'PR1270', 1199.99, 1749.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Natural White Ash', 'wood_l', 'Bristol-36-NWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Bristol', 'Bristol 36″ bathroom vanity in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Bristol-41.5-NWA-BG', 'Bristol-41.5-NWA-BG', 'bristol-41-5-bathroom-vanity-in-natural-white-ash', 'Bristol 41.5" Bathroom Vanity in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 1, 'Single Sink Cabinet Only', 'base', 'PR1271', 1549.99, 2249.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Natural White Ash', 'wood_l', 'Bristol-42-NWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Bristol', 'Bristol 42″ bathroom vanity in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Bristol-47.5-NWA-BG', 'Bristol-47.5-NWA-BG', 'bristol-47-5-bathroom-vanity-in-natural-white-ash', 'Bristol 47.5" Bathroom Vanity in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 1, 'Single Sink Cabinet Only', 'base', 'PR1272', 1649.99, 2349.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Natural White Ash', 'wood_l', 'Bristol-48-NWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Bristol', 'Bristol 48″ bathroom vanity in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Bristol-59.5D-NWA-BG', 'Bristol-59.5D-NWA-BG', 'bristol-59-5-double-sink-bathroom-vanity-in-natural-white-ash', 'Bristol 59.5" Double Sink Bathroom Vanity in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 1, 'Double Sink Cabinet Only', 'base', 'PR1273', 1799.99, 2599.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Natural White Ash', 'wood_l', 'Bristol-60D-NWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Bristol', 'Bristol 60″ double sink bathroom vanity in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Bristol-59.5S-NWA-BG', 'Bristol-59.5S-NWA-BG', 'bristol-59-5-single-sink-bathroom-vanity-in-natural-white-ash', 'Bristol 59.5" Single Sink Bathroom Vanity in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 1, 'Single Sink Cabinet Only', 'base', 'PR1274', 1849.99, 2649.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Natural White Ash', 'wood_l', 'Bristol-60S-NWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Bristol', 'Bristol 60″ single sink bathroom vanity in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Bristol-71.5-NWA-BG', 'Bristol-71.5-NWA-BG', 'bristol-71-5-bathroom-vanity-in-natural-white-ash', 'Bristol 71.5" Bathroom Vanity in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 1, 'Double Sink Cabinet Only', 'base', 'PR1275', 1949.99, 2799.99, 71.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Natural White Ash', 'wood_l', 'Bristol-72-NWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Bristol', 'Bristol 72″ bathroom vanity in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Bristol-Bridge3DE-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bristol-24-3-drawer-bridge-in-natural-white-ash', 'Bristol 24" 3-Drawer Bridge in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 6, 'Side Cabinet', 'base', 'PR1277', 649.99, 949.99, 24, 20, 18, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Natural White Ash', 'wood_l', 'Bristol-24-3dr-NWA', 'Home & Garden > Furniture > Cabinets & Storage', 'new', 1, 'freight', 'mid-range', 'Side Cabinet', 'catalog', 'freight', 'Bristol', 'Bristol 24″ 3-drawer bridge unit in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Bristol-BridgeMUCounter-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bristol-24-make-up-bridge-in-natural-white-ash', 'Bristol 24" Make-Up Bridge in Natural White Ash', 'ER Vanities', 'Bristol', (SELECT id FROM collections WHERE slug = 'bristol-er-vanities'), 6, 'Side Cabinet', 'base', 'PR1276', 549.99, 799.99, 24, 8, 18, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'No', 'Yes', 'Natural White Ash', 'wood_l', 'Bristol-24-MU-NWA', 'Home & Garden > Furniture > Cabinets & Storage', 'new', 1, 'standard', 'mid-range', 'Side Cabinet', 'catalog', 'ground', 'Bristol', 'Bristol 24″ make-up bridge unit in natural white ash with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-29.5L-DOAK-MB', 'Kensington-29.5L-DOAK-MB', 'kensington-29-5-left-drawers-bathroom-vanity-in-desert-oak', 'Kensington 29.5" Left Drawers Bathroom Vanity in Desert Oak', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'Kensington-29.5L-DOAK-MB', 1199.99, 1749.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Desert Oak', 'wood_m', 'Kensington-30L-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 30″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-29.5L-NVBLU-BG', 'Kensington-29.5L-NVBLU-BG', 'kensington-29-5-left-drawers-bathroom-vanity-in-navy-blue', 'Kensington 29.5" Left Drawers Bathroom Vanity in Navy Blue', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0974', 1099.99, 1599.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Navy Blue', 'blue', 'Kensington-30L-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 30″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-29.5L-WH-BN', 'Kensington-29.5L-WH-BN', 'kensington-29-5-left-drawers-bathroom-vanity-in-bright-white', 'Kensington 29.5" Left Drawers Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0972', 1049.99, 1499.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Kensington-30L-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 30″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-29.5R-DOAK-MB', 'Kensington-29.5R-DOAK-MB', 'kensington-29-5-right-drawers-bathroom-vanity-in-desert-oak', 'Kensington 29.5" Right Drawers Bathroom Vanity in Desert Oak', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'Kensington-29.5R-DOAK-MB', 1199.99, 1749.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Desert Oak', 'wood_m', 'Kensington-30R-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 30″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-29.5R-NVBLU-BG', 'Kensington-29.5R-NVBLU-BG', 'kensington-29-5-right-drawers-bathroom-vanity-in-navy-blue', 'Kensington 29.5" Right Drawers Bathroom Vanity in Navy Blue', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0971', 1099.99, 1599.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Navy Blue', 'blue', 'Kensington-30R-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 30″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-29.5R-WH-BN', 'Kensington-29.5R-WH-BN', 'kensington-29-5-right-drawers-bathroom-vanity-in-bright-white', 'Kensington 29.5" Right Drawers Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0969', 1049.99, 1499.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Kensington-30R-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 30″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-35.5L-DOAK-MB', 'Kensington-35.5L-DOAK-MB', 'kensington-35-5-left-drawers-bathroom-vanity-in-desert-oak', 'Kensington 35.5" Left Drawers Bathroom Vanity in Desert Oak', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'Kensington-35.5L-DOAK-MB', 1424.99, 2049.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Desert Oak', 'wood_m', 'Kensington-36L-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-35.5L-MGR-BN', 'Kensington-35.5L-MGR-BN', 'kensington-35-5-left-drawers-bathroom-vanity-in-metal-gray', 'Kensington 35.5" Left Drawers Bathroom Vanity in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0979', 1149.99, 1649.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Metal Gray', 'gray', 'Kensington-36L-MGR', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-35.5L-NVBLU-BG', 'Kensington-35.5L-NVBLU-BG', 'kensington-35-5-left-drawers-bathroom-vanity-in-navy-blue', 'Kensington 35.5" Left Drawers Bathroom Vanity in Navy Blue', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0980', 1199.99, 1749.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Navy Blue', 'blue', 'Kensington-36L-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-35.5L-WH-BN', 'Kensington-35.5L-WH-BN', 'kensington-35-5-left-drawers-bathroom-vanity-in-bright-white', 'Kensington 35.5" Left Drawers Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0978', 1149.99, 1649.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Kensington-36L-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-35.5R-DOAK-MB', 'Kensington-35.5R-DOAK-MB', 'kensington-35-5-right-drawers-bathroom-vanity-in-desert-oak', 'Kensington 35.5" Right Drawers Bathroom Vanity in Desert Oak', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'Kensington-35.5R-DOAK-MB', 1424.99, 2049.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Desert Oak', 'wood_m', 'Kensington-36R-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-35.5R-MGR-BN', 'Kensington-35.5R-MGR-BN', 'kensington-35-5-right-drawers-bathroom-vanity-in-metal-gray', 'Kensington 35.5" Right Drawers Bathroom Vanity in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0976', 1149.99, 1649.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Metal Gray', 'gray', 'Kensington-36R-MGR', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-35.5R-NVBLU-BG', 'Kensington-35.5R-NVBLU-BG', 'kensington-35-5-right-drawers-bathroom-vanity-in-navy-blue', 'Kensington 35.5" Right Drawers Bathroom Vanity in Navy Blue', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0977', 1199.99, 1749.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Navy Blue', 'blue', 'Kensington-36R-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-35.5R-WH-BN', 'Kensington-35.5R-WH-BN', 'kensington-35-5-right-drawers-bathroom-vanity-in-bright-white', 'Kensington 35.5" Right Drawers Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0975', 1149.99, 1649.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Kensington-36R-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 36″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-41.5-DOAK-MB', 'Kensington-41.5-DOAK-MB', 'kensington-41-5-bathroom-vanity-in-desert-oak', 'Kensington 41.5" Bathroom Vanity in Desert Oak', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'Kensington-41.5-DOAK-MB', 1649.99, 2349.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Desert Oak', 'wood_m', 'Kensington-42-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 42″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-41.5-MGR-BN', 'Kensington-41.5-MGR-BN', 'kensington-41-5-bathroom-vanity-in-metal-gray', 'Kensington 41.5" Bathroom Vanity in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0982', 1474.99, 2099.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Metal Gray', 'gray', 'Kensington-42-MGR', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 42″ bathroom vanity in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-41.5-NVBLU-BG', 'Kensington-41.5-NVBLU-BG', 'kensington-41-5-bathroom-vanity-in-navy-blue', 'Kensington 41.5" Bathroom Vanity in Navy Blue', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0983', 1524.99, 2199.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Navy Blue', 'blue', 'Kensington-42-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 42″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-41.5-WH-BN', 'Kensington-41.5-WH-BN', 'kensington-41-5-bathroom-vanity-in-bright-white', 'Kensington 41.5" Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0981', 1474.99, 2099.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Kensington-42-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 42″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-47.5-MGR-BN', 'Kensington-47.5-MGR-BN', 'kensington-47-5-bathroom-vanity-in-metal-gray', 'Kensington 47.5" Bathroom Vanity in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0986', 1724.99, 2449.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Metal Gray', 'gray', 'Kensington-48-MGR', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 48″ bathroom vanity in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-47.5-WH-BN', 'Kensington-47.5-WH-BN', 'kensington-47-5-bathroom-vanity-in-bright-white', 'Kensington 47.5" Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0985', 1724.99, 2449.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Kensington-48-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 48″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-59.5D-MGR-BN', 'Kensington-59.5D-MGR-BN', 'kensington-59-5-double-sink-bathroom-vanity-in-metal-gray', 'Kensington 59.5" Double Sink Bathroom Vanity in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Double Sink Cabinet Only', 'base', 'PR0988', 1849.99, 2649.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Metal Gray', 'gray', 'Kensington-60D-MGR', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 60″ double sink bathroom vanity in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-59.5D-WH-BN', 'Kensington-59.5D-WH-BN', 'kensington-59-5-double-sink-bathroom-vanity-in-bright-white', 'Kensington 59.5" Double Sink Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Double Sink Cabinet Only', 'base', 'PR0987', 1849.99, 2649.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Kensington-60D-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 60″ double sink bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-59.5S-MGR-BN', 'Kensington-59.5S-MGR-BN', 'kensington-59-5-single-sink-bathroom-vanity-in-metal-gray', 'Kensington 59.5" Single Sink Bathroom Vanity in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0990', 1899.99, 2699.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Metal Gray', 'gray', 'Kensington-60S-MGR', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 60″ single sink bathroom vanity in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-59.5S-WH-BN', 'Kensington-59.5S-WH-BN', 'kensington-59-5-single-sink-bathroom-vanity-in-bright-white', 'Kensington 59.5" Single Sink Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Single Sink Cabinet Only', 'base', 'PR0989', 1899.99, 2699.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Kensington-60S-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 60″ single sink bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-71.5-MGR-BN', 'Kensington-71.5-MGR-BN', 'kensington-71-5-bathroom-vanity-in-metal-gray', 'Kensington 71.5" Bathroom Vanity in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Double Sink Cabinet Only', 'base', 'PR0992', 1999.99, 2849.99, 71.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Metal Gray', 'gray', 'Kensington-72-MGR', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 72″ bathroom vanity in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-71.5-WH-BN', 'Kensington-71.5-WH-BN', 'kensington-71-5-bathroom-vanity-in-bright-white', 'Kensington 71.5" Bathroom Vanity in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 1, 'Double Sink Cabinet Only', 'base', 'PR0991', 1999.99, 2849.99, 71.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Kensington-72-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Kensington', 'Kensington 72″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-BridgeCabinet-MG-BN', 'Kensington-BridgeCabinet-MG-BN', 'kensington-23-bridge-drawer-in-metal-gray', 'Kensington 23" Bridge Drawer in Metal Gray', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 6, 'Side Cabinet', 'base', 'Kensington-BridgeCabinet-MG-BN', 424.99, 649.99, 23, 8, 18, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'No', 'Yes', 'Metal Gray', 'gray', 'Kensington-24-1dr-MGR', 'Home & Garden > Furniture > Cabinets & Storage', 'new', 1, 'standard', 'budget', 'Side Cabinet', 'catalog', 'ground', 'Kensington', 'Kensington 23″ bridge drawer unit in metal gray with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Kensington-BridgeCabinet-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'kensington-23-bridge-drawer-in-bright-white', 'Kensington 23" Bridge Drawer in Bright White', 'ER Vanities', 'Kensington', (SELECT id FROM collections WHERE slug = 'kensington'), 6, 'Side Cabinet', 'base', 'Kensington-BridgeCabinet-WH-BN', 424.99, 649.99, 23, 8, 18, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'No', 'Yes', 'Bright White', 'white', 'Kensington-24-1dr-WHT', 'Home & Garden > Furniture > Cabinets & Storage', 'new', 1, 'standard', 'budget', 'Side Cabinet', 'catalog', 'ground', 'Kensington', 'Kensington 23″ bridge drawer unit in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('London-23.5-DOAK-MB', 'London-23.5-DOAK-MB', 'london-23-5-bathroom-vanity-in-desert-oak', 'London 23.5" Bathroom Vanity in Desert Oak', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR0994', 924.99, 1349.99, 23.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Desert Oak', 'wood_m', 'London-24-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 24″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('London-23.5-WH-BN', 'London-23.5-WH-BN', 'london-23-5-bathroom-vanity-in-bright-white', 'London 23.5" Bathroom Vanity in Bright White', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR0993', 799.99, 1149.99, 23.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'London-24-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 24″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('London-29.5-WH-BN', 'London-29.5-WH-BN', 'london-29-5-bathroom-vanity-in-bright-white', 'London 29.5" Bathroom Vanity in Bright White', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR0995', 874.99, 1249.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'London-30-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 30″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('London-29.5-DOAK-MB', 'London-29.5-DOAK-MB', 'london-29-5-bathroom-vanity-in-desert-oak', 'London 29.5" Bathroom Vanity in Desert Oak', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR0996', 974.99, 1399.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Desert Oak', 'wood_m', 'London-30-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 30″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('London-35.5R-DOAK-MB', 'London-35.5R-DOAK-MB', 'london-35-5-right-drawers-bathroom-vanity-in-desert-oak', 'London 35.5" Right Drawers Bathroom Vanity in Desert Oak', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR0998', 1149.99, 1649.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Desert Oak', 'wood_m', 'London-36R-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 36″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('London-35.5R-WH-BN', 'London-35.5R-WH-BN', 'london-35-5-right-drawers-bathroom-vanity-in-bright-white', 'London 35.5" Right Drawers Bathroom Vanity in Bright White', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR0997', 999.99, 1449.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'London-36R-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 36″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('London-47.5-DOAK-MB', 'London-47.5-DOAK-MB', 'london-47-5-bathroom-vanity-in-desert-oak', 'London 47.5" Bathroom Vanity in Desert Oak', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR1000', 1599.99, 2299.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Desert Oak', 'wood_m', 'London-48-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 48″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('London-47.5-WH-BN', 'London-47.5-WH-BN', 'london-47-5-bathroom-vanity-in-bright-white', 'London 47.5" Bathroom Vanity in Bright White', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR0999', 1449.99, 2099.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'London-48-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 48″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('London-59.5D-DOAK-MB', 'London-59.5D-DOAK-MB', 'london-59-5-double-sink-bathroom-vanity-in-desert-oak', 'London 59.5" Double Sink Bathroom Vanity in Desert Oak', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Double Sink Cabinet Only', 'base', 'PR1002', 1774.99, 2549.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Desert Oak', 'wood_m', 'London-60D-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 60″ double sink bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('London-59.5D-WH-BN', 'London-59.5D-WH-BN', 'london-59-5-double-sink-bathroom-vanity-in-bright-white', 'London 59.5" Double Sink Bathroom Vanity in Bright White', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Double Sink Cabinet Only', 'base', 'PR1001', 1649.99, 2349.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'London-60D-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 60″ double sink bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('London-59.5S-DOAK-MB', 'London-59.5S-DOAK-MB', 'london-59-5-single-sink-bathroom-vanity-in-desert-oak', 'London 59.5" Single Sink Bathroom Vanity in Desert Oak', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR1004', 1824.99, 2599.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Desert Oak', 'wood_m', 'London-60S-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 60″ single sink bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('London-59.5S-WH-BN', 'London-59.5S-WH-BN', 'london-59-5-single-sink-bathroom-vanity-in-bright-white', 'London 59.5" Single Sink Bathroom Vanity in Bright White', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Single Sink Cabinet Only', 'base', 'PR1003', 1724.99, 2449.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'London-60S-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 60″ single sink bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('London-71.5-DOAK-MB', 'London-71.5-DOAK-MB', 'london-71-5-bathroom-vanity-in-desert-oak', 'London 71.5" Bathroom Vanity in Desert Oak', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Double Sink Cabinet Only', 'base', 'PR1006', 1949.99, 2799.99, 71.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Desert Oak', 'wood_m', 'London-72-DOK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 72″ bathroom vanity in desert oak with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('London-71.5-WH-BN', 'London-71.5-WH-BN', 'london-71-5-bathroom-vanity-in-bright-white', 'London 71.5" Bathroom Vanity in Bright White', 'ER Vanities', 'London', (SELECT id FROM collections WHERE slug = 'london'), 1, 'Double Sink Cabinet Only', 'base', 'PR1005', 1799.99, 2599.99, 71.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'London-72-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'London', 'London 72″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Oxford-29.5-BLK-BG', 'Oxford-29.5-BLK-BG', 'oxford-29-5-bathroom-vanity-in-black', 'Oxford 29.5" Bathroom Vanity in Black', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1024', 974.99, 1399.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Black', 'black', 'Oxford-30-BLK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 30″ bathroom vanity in peppercorn black with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Oxford-29.5-CAMGRN-BG', 'Oxford-29.5-CAMGRN-BG', 'oxford-29-5-bathroom-vanity-in-sage-green', 'Oxford 29.5" Bathroom Vanity in Sage Green', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1023', 974.99, 1399.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Sage Green', 'green', 'Oxford-30-SGE', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 30″ bathroom vanity in sage green with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Oxford-29.5-WA-MB', 'Oxford-29.5-WA-MB', 'oxford-29-5-bathroom-vanity-in-whitewashed-ash', 'Oxford 29.5" Bathroom Vanity in Whitewashed Ash', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1264', 1099.99, 1599.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Whitewashed Ash', 'wood_l', 'Oxford-30-WWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 30″ bathroom vanity in whitewashed ash with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Oxford-35.5-BLK-BG', 'Oxford-35.5-BLK-BG', 'oxford-35-5-bathroom-vanity-in-black', 'Oxford 35.5" Bathroom Vanity in Black', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1026', 1099.99, 1599.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Black', 'black', 'Oxford-36-BLK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 36″ bathroom vanity in peppercorn black with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Oxford-35.5-CAMGRN-BG', 'Oxford-35.5-CAMGRN-BG', 'oxford-35-5-bathroom-vanity-in-sage-green', 'Oxford 35.5" Bathroom Vanity in Sage Green', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1025', 1099.99, 1599.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Sage Green', 'green', 'Oxford-36-SGE', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 36″ bathroom vanity in sage green with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Oxford-35.5-WA-MB', 'Oxford-35.5-WA-MB', 'oxford-35-5-bathroom-vanity-in-whitewashed-ash', 'Oxford 35.5" Bathroom Vanity in Whitewashed Ash', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1265', 1199.99, 1749.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Whitewashed Ash', 'wood_l', 'Oxford-36-WWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 36″ bathroom vanity in whitewashed ash with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Oxford-41.5-BLK-BG', 'Oxford-41.5-BLK-BG', 'oxford-41-5-bathroom-vanity-in-black', 'Oxford 41.5" Bathroom Vanity in Black', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1028', 1374.99, 1999.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Black', 'black', 'Oxford-42-BLK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 42″ bathroom vanity in peppercorn black with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Oxford-41.5-CAMGRN-BG', 'Oxford-41.5-CAMGRN-BG', 'oxford-41-5-bathroom-vanity-in-sage-green', 'Oxford 41.5" Bathroom Vanity in Sage Green', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1027', 1374.99, 1999.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Sage Green', 'green', 'Oxford-42-SGE', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 42″ bathroom vanity in sage green with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Oxford-41.5-WA-MB', 'Oxford-41.5-WA-MB', 'oxford-41-5-bathroom-vanity-in-whitewashed-ash', 'Oxford 41.5" Bathroom Vanity in Whitewashed Ash', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1266', 1474.99, 2099.99, 41.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Whitewashed Ash', 'wood_l', 'Oxford-42-WWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 42″ bathroom vanity in whitewashed ash with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Oxford-47.5-CAMGRN-BG', 'Oxford-47.5-CAMGRN-BG', 'oxford-47-5-bathroom-vanity-in-sage-green', 'Oxford 47.5" Bathroom Vanity in Sage Green', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1029', 1499.99, 2149.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Sage Green', 'green', 'Oxford-48-SGE', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 48″ bathroom vanity in sage green with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Oxford-47.5-BLK-BG', 'Oxford-47.5-BLK-BG', 'oxford-47-5-bathroom-vanity-in-black', 'Oxford 47.5" Bathroom Vanity in Black', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1030', 1499.99, 2149.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Black', 'black', 'Oxford-48-BLK', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 48″ bathroom vanity in peppercorn black with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Oxford-47.5-WA-MB', 'Oxford-47.5-WA-MB', 'oxford-47-5-bathroom-vanity-in-whitewashed-ash', 'Oxford 47.5" Bathroom Vanity in Whitewashed Ash', 'ER Vanities', 'Oxford', (SELECT id FROM collections WHERE slug = 'oxford'), 1, 'Single Sink Cabinet Only', 'base', 'PR1267', 1599.99, 2299.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Whitewashed Ash', 'wood_l', 'Oxford-48-WWA', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Oxford', 'Oxford 48″ bathroom vanity in whitewashed ash with matte black hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-29.5-NVBLU-BG', 'Windsor-29.5-NVBLU-BG', 'windsor-29-5-bathroom-vanity-in-navy-blue', 'Windsor 29.5" Bathroom Vanity in Navy Blue', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1008', 974.99, 1399.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Navy Blue', 'blue', 'Windsor-30-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 30″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-29.5-WH-BN', 'Windsor-29.5-WH-BN', 'windsor-29-5-bathroom-vanity-in-bright-white', 'Windsor 29.5" Bathroom Vanity in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1007', 924.99, 1349.99, 29.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Windsor-30-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 30″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-35.5L-NVBLU-BG', 'Windsor-35.5L-NVBLU-BG', 'windsor-35-5-left-drawers-bathroom-vanity-in-navy-blue', 'Windsor 35.5" Left Drawers Bathroom Vanity in Navy Blue', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1012', 1149.99, 1649.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Navy Blue', 'blue', 'Windsor-36L-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 36″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-35.5L-WH-BN', 'Windsor-35.5L-WH-BN', 'windsor-35-5-left-drawers-bathroom-vanity-in-bright-white', 'Windsor 35.5" Left Drawers Bathroom Vanity in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1011', 1099.99, 1599.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Windsor-36L-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 36″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-35.5R-NVBLU-BG', 'Windsor-35.5R-NVBLU-BG', 'windsor-35-5-right-drawers-bathroom-vanity-in-navy-blue', 'Windsor 35.5" Right Drawers Bathroom Vanity in Navy Blue', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1010', 1149.99, 1649.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Navy Blue', 'blue', 'Windsor-36R-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 36″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-35.5R-WH-BN', 'Windsor-35.5R-WH-BN', 'windsor-35-5-right-drawers-bathroom-vanity-in-bright-white', 'Windsor 35.5" Right Drawers Bathroom Vanity in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1009', 1099.99, 1599.99, 35.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Windsor-36R-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 36″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-47.5-NVBLU-BG', 'Windsor-47.5-NVBLU-BG', 'windsor-47-5-bathroom-vanity-in-navy-blue', 'Windsor 47.5" Bathroom Vanity in Navy Blue', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1014', 1549.99, 2249.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Navy Blue', 'blue', 'Windsor-48-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 48″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-47.5-WH-BN', 'Windsor-47.5-WH-BN', 'windsor-47-5-bathroom-vanity-in-bright-white', 'Windsor 47.5" Bathroom Vanity in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1013', 1499.99, 2149.99, 47.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Windsor-48-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'mid-range', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 48″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-59.5D-WH-BN', 'Windsor-59.5D-WH-BN', 'windsor-59-5-double-sink-bathroom-vanity-in-bright-white', 'Windsor 59.5" Double Sink Bathroom Vanity in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Double Sink Cabinet Only', 'base', 'PR1015', 1724.99, 2449.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Windsor-60D-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 60″ double sink bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-59.5S-NVBLU-BG', 'Windsor-59.5S-NVBLU-BG', 'windsor-59-5-single-sink-bathroom-vanity-in-navy-blue', 'Windsor 59.5" Single Sink Bathroom Vanity in Navy Blue', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1018', 1849.99, 2649.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Navy Blue', 'blue', 'Windsor-60S-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 60″ single sink bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-59.5S-WH-BN', 'Windsor-59.5S-WH-BN', 'windsor-59-5-single-sink-bathroom-vanity-in-bright-white', 'Windsor 59.5" Single Sink Bathroom Vanity in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Single Sink Cabinet Only', 'base', 'PR1017', 1774.99, 2549.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Windsor-60S-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Single Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 60″ single sink bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-59.5D-NVBLU-BG', 'Windsor-59.5D-NVBLU-BG', 'windsor-59-5-double-sink-bathroom-vanity-in-navy-blue', 'Windsor 59.5" Double Sink Bathroom Vanity in Navy Blue', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Double Sink Cabinet Only', 'base', 'PR1016', 1799.99, 2599.99, 59.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Navy Blue', 'blue', 'Windsor-60D-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 60″ double sink bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-71.5-NVBLU-BG', 'Windsor-71.5-NVBLU-BG', 'windsor-71-5-bathroom-vanity-in-navy-blue', 'Windsor 71.5" Bathroom Vanity in Navy Blue', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Double Sink Cabinet Only', 'base', 'PR1020', 1999.99, 2849.99, 71.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Navy Blue', 'blue', 'Windsor-72-NVY', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 72″ bathroom vanity in navy blue with brushed gold hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-71.5-WH-BN', 'Windsor-71.5-WH-BN', 'windsor-71-5-bathroom-vanity-in-bright-white', 'Windsor 71.5" Bathroom Vanity in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 1, 'Double Sink Cabinet Only', 'base', 'PR1019', 1899.99, 2699.99, 71.5, 33.75, 21.625, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Windsor-72-WHT', 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities', 'new', 1, 'freight', 'premium', 'Double Sink Cabinet Only', 'catalog', 'freight', 'Windsor', 'Windsor 72″ bathroom vanity in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Cabinet only — Tops and Faucets sold separately. Some images may show tops or faucets for inspiration.**

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
VALUES ('Windsor-LC-WH-BN', 'Windsor-LC-WH-BN', 'windsor-linen-tower-in-bright-white', 'Windsor Linen Tower in Bright White', 'ER Vanities', 'Windsor', (SELECT id FROM collections WHERE slug = 'windsor'), 6, 'Linen Cabinet', 'base', 'PR1021', 1199.99, 1749.99, 24, 72, 18, 'Vietnam', '30 Day Full Return, 1 Year Limited', 'Yes', 'Yes', 'Bright White', 'white', 'Windsor-24-LC-WHT', 'Home & Garden > Furniture > Cabinets & Storage', 'new', 1, 'freight', 'mid-range', 'Linen Cabinet', 'catalog', 'freight', 'Windsor', 'Windsor 24″ linen tower in bright white with brushed nickel hardware. Solid wood frame, seven layers of coating, soft-close throughout.', '**Some images may show accessories and styling for inspiration.**

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


