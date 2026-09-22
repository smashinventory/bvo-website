-- ---------------------------------------------------------------------------
-- ER Vanities -> BVO  ·  POST-LOAD VERIFICATION
-- Read-only. Paste into phpMyAdmin -> bvo_website -> SQL tab -> Go.
--
-- Replaces the verification block that failed with #1267. Cause: migration 005
-- created product_attribute_values with DEFAULT CHARSET=utf8mb4 and NO COLLATE
-- clause, so on MariaDB 10.6 it took the server default utf8mb4_uca1400_ai_ci,
-- while products is explicitly utf8mb4_unicode_ci. Comparing a column from each
-- needs COLLATE on one side. This is the same fault PROJECT_BRIEF documents for
-- temp-table joins.
-- ---------------------------------------------------------------------------

-- 1. Row counts. Expect: products 78 | images 341 | attributes 2018
--                        bullets 624 | documents 54 | components 37
SELECT 'products' AS tbl, COUNT(*) AS n FROM products WHERE brand = 'ER Vanities'
UNION ALL SELECT 'images', COUNT(*) FROM product_images pi
  JOIN products p ON p.id = pi.product_id WHERE p.brand = 'ER Vanities'
UNION ALL SELECT 'attributes', COUNT(*) FROM product_attribute_values a
  JOIN products p ON p.id = a.product_id WHERE p.brand = 'ER Vanities'
UNION ALL SELECT 'bullets', COUNT(*) FROM product_bullets b
  JOIN products p ON p.id = b.product_id WHERE p.brand = 'ER Vanities'
UNION ALL SELECT 'documents', COUNT(*) FROM product_documents d
  JOIN products p ON p.id = d.product_id WHERE p.brand = 'ER Vanities'
UNION ALL SELECT 'components', COUNT(*) FROM product_components
  WHERE component_sku LIKE 'Kensington-Bridge%'
     OR component_sku LIKE 'Bristol-Bridge%'
     OR component_sku LIKE 'Windsor-LC%';

-- 2. Taxonomy split. Expect 59 Single Sink Cabinet Only, 14 Double,
--    4 Side Cabinet (cat 6), 1 Linen Cabinet (cat 6).
SELECT category_id, product_type, COUNT(*) AS n
  FROM products WHERE brand = 'ER Vanities'
 GROUP BY category_id, product_type ORDER BY n DESC;

-- 3. Collections. Expect 5, all ER Vanities, none with a NULL id on a product.
SELECT c.id, c.slug, c.name, c.brand, COUNT(p.id) AS products
  FROM collections c LEFT JOIN products p ON p.collection_id = c.id
 WHERE c.brand = 'ER Vanities' GROUP BY c.id ORDER BY c.name;

SELECT COUNT(*) AS products_with_no_collection
  FROM products WHERE brand = 'ER Vanities' AND collection_id IS NULL;   -- expect 0

-- 4. Every product must carry the inventory sync key. Expect ZERO rows.
SELECT sku FROM products
 WHERE brand = 'ER Vanities' AND (rflpos_item_id IS NULL OR rflpos_item_id = '');

-- 5. Hero image per product. Expect ONE row: Windsor-35.5L-NVBLU-BG,
--    which genuinely has no imagery yet.
SELECT p.sku, COUNT(pi.id) AS imgs, COALESCE(SUM(pi.is_primary),0) AS primaries
  FROM products p LEFT JOIN product_images pi ON pi.product_id = p.id
 WHERE p.brand = 'ER Vanities'
 GROUP BY p.id HAVING primaries <> 1 OR imgs = 0;

-- 6. Colour trio must agree (Rule 5): products.color, products.color_family,
--    and the cabinet_finish EAV row. COLLATE on the EAV side — see the header.
--    Expect ZERO rows.
SELECT p.sku, p.color, p.color_family, a.value_text AS eav_cabinet_finish
  FROM products p
  LEFT JOIN product_attribute_values a
    ON a.product_id = p.id AND a.attr_key = 'cabinet_finish'
 WHERE p.brand = 'ER Vanities'
   AND (a.value_text IS NULL
        OR a.value_text COLLATE utf8mb4_unicode_ci <> p.color);

-- 7. ER is the FIRST brand to populate these two filter groups — both were
--    defined but empty. Expect country_origin 78, ships_ltl 78, drawer_side 20.
SELECT a.attr_key, COUNT(*) AS n
  FROM product_attribute_values a JOIN products p ON p.id = a.product_id
 WHERE p.brand = 'ER Vanities'
   AND a.attr_key IN ('country_origin','ships_ltl','drawer_side','style','mount_type')
 GROUP BY a.attr_key ORDER BY n DESC;

-- 8. mount_type must land in ONE group with James Martin, not two.
--    Expect 'Floor Standing' only, now ~4,735 across both brands.
SELECT value_text, COUNT(*) AS n
  FROM product_attribute_values WHERE attr_key = 'mount_type'
 GROUP BY value_text ORDER BY n DESC;

-- 9. Eyeball three finished products end to end.
SELECT p.sku, p.name, p.product_type, p.price, p.compare_price, p.mpn,
       p.width_in, p.height_in, p.depth_in, c.name AS collection,
       (SELECT COUNT(*) FROM product_images  x WHERE x.product_id = p.id) AS imgs,
       (SELECT COUNT(*) FROM product_bullets x WHERE x.product_id = p.id) AS bullets,
       (SELECT COUNT(*) FROM product_documents x WHERE x.product_id = p.id) AS docs
  FROM products p LEFT JOIN collections c ON c.id = p.collection_id
 WHERE p.sku IN ('Kensington-59.5D-MGR-BN','Bristol-29.5-NWA-BG','Windsor-LC-WH-BN');
