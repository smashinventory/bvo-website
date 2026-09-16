-- ═══════════════════════════════════════════════════════════════════
--  MIRROR COLOUR BACKFILL
--  Generated 2026-09-16 by scripts/gen_mirror_colour_sql.js
--  Source: JMV-product-feed_imported_2026-09-16.xlsx
--
--  WHAT THIS TOUCHES
--    products.color          }  on category bathroom-mirrors only
--    products.color_family   }
--    product_attribute_values rows with attr_key = color_family_alt
--
--  Nothing else. No price, no MAP, no inventory, no images, no other
--  EAV key, no other category, no other product type.
--
--  WHERE THE VALUES CAME FROM
--  Every family key below is a literal produced by
--  colorFamilies.resolveBuckets() — the same function the importer uses.
--  There is no CASE, no join to another product, no tie-break and no
--  pattern matching in this file. It applies decisions; it does not make
--  any.
--
--  SAFE TO RE-RUN. The UPDATEs are idempotent and the alt rows are
--  deleted before being re-inserted.
-- ═══════════════════════════════════════════════════════════════════

SET @mirror_cat := (SELECT id FROM categories WHERE slug = 'bathroom-mirrors');

-- Stop here if the slug is wrong, rather than silently updating 0 rows.
-- Run this line on its own first: it must return a number, not NULL.
SELECT @mirror_cat AS mirror_category_id;

-- ── BEFORE ─────────────────────────────────────────────────────────
SELECT color_family, COUNT(*) AS n
  FROM products
 WHERE category_id = @mirror_cat AND is_active = 1
 GROUP BY color_family ORDER BY n DESC;


-- ── 1. COLOUR AND PRIMARY FAMILY ───────────────────────────────────

-- Bright White  ->  white   [10 products]
UPDATE products
   SET color = 'Bright White', color_family = 'white'
 WHERE category_id = @mirror_cat
   AND sku IN ('244-MR32-BW', '660-M26-BW', '157-M29-BW', '735-M48-BW', '735-M30-BW', '660-M30-BW', '735-M26-BW', '238-107-M27-BW', '157-M44-BW', '650-M22-BW');

-- Matte Black  ->  black   (also shows under matte_black)   [9 products]
UPDATE products
   SET color = 'Matte Black', color_family = 'black'
 WHERE category_id = @mirror_cat
   AND sku IN ('715-M48-MB', '105-M30-MBK', '715-M36-MB', '715-M30-MB', '715-MR30-MB', '715-M26-MB', '715-MO30-MB', '715-MA24-MB', '715-MO24-MB');

-- Champagne Brass  ->  gold   (also shows under cream)   [8 products]
UPDATE products
   SET color = 'Champagne Brass', color_family = 'gold'
 WHERE category_id = @mirror_cat
   AND sku IN ('715-MA24-CB', '715-MO30-CB', '715-MO24-CB', '715-M36-CB', '715-M48-CB', '715-M26-CB', '715-M30-CB', '715-MR30-CB');

-- Whitewashed Walnut  ->  wood_m   [7 products]
UPDATE products
   SET color = 'Whitewashed Walnut', color_family = 'wood_m'
 WHERE category_id = @mirror_cat
   AND sku IN ('735-M26-WWW', '735-M48-WWW', '735-M30-WWW', '157-M44-WW', '620-M28-WW', '735-M36-WWW', '157-M29-WW');

-- Urban Gray  ->  gray   [5 products]
UPDATE products
   SET color = 'Urban Gray', color_family = 'gray'
 WHERE category_id = @mirror_cat
   AND sku IN ('735-M26-UGR', '735-M30-UGR', '650-M22-UGR', '735-M36-UGR', '735-M48-UGR');

-- Glossy White  ->  white   [5 products]
UPDATE products
   SET color = 'Glossy White', color_family = 'white'
 WHERE category_id = @mirror_cat
   AND sku IN ('571-M28-GW', 'E444-M36-GW', 'E444-M30-GW', '803-M35.4-GW', 'E444-M48-GW');

-- Burnished Mahogany  ->  wood_d   [5 products]
UPDATE products
   SET color = 'Burnished Mahogany', color_family = 'wood_d'
 WHERE category_id = @mirror_cat
   AND sku IN ('735-M26-BNM', '650-M22-BNM', '735-M48-BNM', '735-M30-BNM', '735-M36-BNM');

-- Black Onyx  ->  black   [5 products]
UPDATE products
   SET color = 'Black Onyx', color_family = 'black'
 WHERE category_id = @mirror_cat
   AND sku IN ('650-M22-BKO', '735-M26-BKO', '735-M36-BKO', '735-M48-BKO', '735-M30-BKO');

-- Light Natural Oak  ->  wood_l   [4 products]
UPDATE products
   SET color = 'Light Natural Oak', color_family = 'wood_l'
 WHERE category_id = @mirror_cat
   AND sku IN ('735-M36-LNO', '735-M30-LNO', '735-M48-LNO', '735-M26-LNO');

-- Radiant Gold  ->  gold   [4 products]
UPDATE products
   SET color = 'Radiant Gold', color_family = 'gold'
 WHERE category_id = @mirror_cat
   AND sku IN ('909-M24-RGD', '903-M35.4-RG-OX', '105-M30-RGD', '909-M36-RG');

-- Mid-Century Walnut  ->  wood_m   [4 products]
UPDATE products
   SET color = 'Mid-Century Walnut', color_family = 'wood_m'
 WHERE category_id = @mirror_cat
   AND sku IN ('735-M26-WLT', '735-M30-WLT', '242-MO28-WLT', '735-M48-WLT');

-- Satin Nickel  ->  nickel   [3 products]
UPDATE products
   SET color = 'Satin Nickel', color_family = 'nickel'
 WHERE category_id = @mirror_cat
   AND sku IN ('715-M26-SN', '715-MA24-SN', '715-MO24-SN');

-- Smokey Celadon  ->  green   [3 products]
UPDATE products
   SET color = 'Smokey Celadon', color_family = 'green'
 WHERE category_id = @mirror_cat
   AND sku IN ('735-M30-SC', '735-M48-SC', '735-M26-SC');

-- Mid-Century Acacia  ->  wood_m   [3 products]
UPDATE products
   SET color = 'Mid-Century Acacia', color_family = 'wood_m'
 WHERE category_id = @mirror_cat
   AND sku IN ('E444-M30-MCA', 'E444-M48-MCA', 'E444-M36-MCA');

-- Whitewashed Oak  ->  wood_l   [3 products]
UPDATE products
   SET color = 'Whitewashed Oak', color_family = 'wood_l'
 WHERE category_id = @mirror_cat
   AND sku IN ('735-M26-WWO', '735-M30-WWO', '735-M36-WWO');

-- Brushed Nickel  ->  nickel   [2 products]
UPDATE products
   SET color = 'Brushed Nickel', color_family = 'nickel'
 WHERE category_id = @mirror_cat
   AND sku IN ('909-M24-BNK', '105-M30-BNK');

-- Modern Iron  ->  no family. 2 product(s) deliberately left
--   NULL; they appear under no colour swatch. Agreed with Sam 2026-09-15:
--   "If they do not, then they will not appear in any bucket."

-- Sable Oak  ->  wood_d   [2 products]
UPDATE products
   SET color = 'Sable Oak', color_family = 'wood_d'
 WHERE category_id = @mirror_cat
   AND sku IN ('D680-M26-SBK', 'D680-M30-SBK');

-- Silver Gray  ->  gray   (also shows under chrome)   [2 products]
UPDATE products
   SET color = 'Silver Gray', color_family = 'gray'
 WHERE category_id = @mirror_cat
   AND sku IN ('148-M29-SL', '157-M29-SL');

-- White Mother of Pearl  ->  white   [2 products]
UPDATE products
   SET color = 'White Mother of Pearl', color_family = 'white'
 WHERE category_id = @mirror_cat
   AND sku IN ('725-MR30-MOP', '725-M26-MOP');

-- Natural  ->  no family. 2 product(s) deliberately left
--   NULL; they appear under no colour swatch. Agreed with Sam 2026-09-15:
--   "If they do not, then they will not appear in any bucket."

-- Honey Alder  ->  wood_l   [2 products]
UPDATE products
   SET color = 'Honey Alder', color_family = 'wood_l'
 WHERE category_id = @mirror_cat
   AND sku IN ('500-M26-HON', '500-M40-HON');

-- Honey Oak  ->  wood_l   [2 products]
UPDATE products
   SET color = 'Honey Oak', color_family = 'wood_l'
 WHERE category_id = @mirror_cat
   AND sku IN ('660-M26-HNO', '660-M30-HNO');

-- Weathered Oak  ->  wood_l   [2 products]
UPDATE products
   SET color = 'Weathered Oak', color_family = 'wood_l'
 WHERE category_id = @mirror_cat
   AND sku IN ('D680-M26-WTO', 'D680-M30-WTO');

-- Saddle Brown  ->  wood_m   [2 products]
UPDATE products
   SET color = 'Saddle Brown', color_family = 'wood_m'
 WHERE category_id = @mirror_cat
   AND sku IN ('157-M29-SBR', '157-M44-SBR');

-- Seaside Oak  ->  wood_l   [1 product]
UPDATE products
   SET color = 'Seaside Oak', color_family = 'wood_l'
 WHERE category_id = @mirror_cat
   AND sku IN ('D225-M28-SSO');

-- Limestone  ->  no family. 1 product(s) deliberately left
--   NULL; they appear under no colour swatch. Agreed with Sam 2026-09-15:
--   "If they do not, then they will not appear in any bucket."

-- Sage Green  ->  green   [1 product]
UPDATE products
   SET color = 'Sage Green', color_family = 'green'
 WHERE category_id = @mirror_cat
   AND sku IN ('157-M29-SGR');

-- Natural Ash  ->  wood_l   [1 product]
UPDATE products
   SET color = 'Natural Ash', color_family = 'wood_l'
 WHERE category_id = @mirror_cat
   AND sku IN ('803-M35.4-NTA');

-- Silver with Delft Blue  ->  blue   (also shows under chrome)   [1 product]
UPDATE products
   SET color = 'Silver with Delft Blue', color_family = 'blue'
 WHERE category_id = @mirror_cat
   AND sku IN ('963-M30-SL-DB');

-- Matte White with Gold  ->  white   (also shows under gold)   [1 product]
UPDATE products
   SET color = 'Matte White with Gold', color_family = 'white'
 WHERE category_id = @mirror_cat
   AND sku IN ('710-M36-MWG');

-- Victory Blue  ->  blue   [1 product]
UPDATE products
   SET color = 'Victory Blue', color_family = 'blue'
 WHERE category_id = @mirror_cat
   AND sku IN ('650-M22-VBL');

-- Sable  ->  wood_d   [1 product]
UPDATE products
   SET color = 'Sable', color_family = 'wood_d'
 WHERE category_id = @mirror_cat
   AND sku IN ('D125-M28-SBL');

-- Carbon Oak  ->  wood_l   [1 product]
UPDATE products
   SET color = 'Carbon Oak', color_family = 'wood_l'
 WHERE category_id = @mirror_cat
   AND sku IN ('246-M28-CBO');

-- Antique Black  ->  black   [1 product]
UPDATE products
   SET color = 'Antique Black', color_family = 'black'
 WHERE category_id = @mirror_cat
   AND sku IN ('147-114-5135');

-- Coastal Driftwood  ->  wood_l   [1 product]
UPDATE products
   SET color = 'Coastal Driftwood', color_family = 'wood_l'
 WHERE category_id = @mirror_cat
   AND sku IN ('D125-M28-CSD');

-- Serenity Blue  ->  blue   [1 product]
UPDATE products
   SET color = 'Serenity Blue', color_family = 'blue'
 WHERE category_id = @mirror_cat
   AND sku IN ('D225-M28-SRB');

-- Brushed Gold  ->  gold   [1 product]
UPDATE products
   SET color = 'Brushed Gold', color_family = 'gold'
 WHERE category_id = @mirror_cat
   AND sku IN ('943-M36-BGD');


-- ── 2. ADDITIONAL SWATCHES (dual bucket) ───────────────────────────
--
--  Approved by Sam 2026-09-16: a shopper filtering Cream may well want a
--  Champagne Brass mirror, so it appears under both.
--
--  The DELETE runs first so re-running this file cannot double the rows,
--  and so a colour that stops bleeding loses its stale entry.

DELETE pav
  FROM product_attribute_values pav
  JOIN products p ON p.id = pav.product_id
 WHERE p.category_id = @mirror_cat
   AND pav.attr_key = 'color_family_alt';

-- Matte Black also shows under matte_black   [9]
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT p.id, 'color_family_alt', 'matte_black', NULL
  FROM products p
 WHERE p.category_id = @mirror_cat
   AND p.sku IN ('715-M48-MB', '105-M30-MBK', '715-M36-MB', '715-M30-MB', '715-MR30-MB', '715-M26-MB', '715-MO30-MB', '715-MA24-MB', '715-MO24-MB');

-- Champagne Brass also shows under cream   [8]
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT p.id, 'color_family_alt', 'cream', NULL
  FROM products p
 WHERE p.category_id = @mirror_cat
   AND p.sku IN ('715-MA24-CB', '715-MO30-CB', '715-MO24-CB', '715-M36-CB', '715-M48-CB', '715-M26-CB', '715-M30-CB', '715-MR30-CB');

-- Silver Gray also shows under chrome   [2]
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT p.id, 'color_family_alt', 'chrome', NULL
  FROM products p
 WHERE p.category_id = @mirror_cat
   AND p.sku IN ('148-M29-SL', '157-M29-SL');

-- Silver with Delft Blue also shows under chrome   [1]
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT p.id, 'color_family_alt', 'chrome', NULL
  FROM products p
 WHERE p.category_id = @mirror_cat
   AND p.sku IN ('963-M30-SL-DB');

-- Matte White with Gold also shows under gold   [1]
INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num)
SELECT p.id, 'color_family_alt', 'gold', NULL
  FROM products p
 WHERE p.category_id = @mirror_cat
   AND p.sku IN ('710-M36-MWG');


-- ── AFTER — these are the numbers to check ─────────────────────────
--
-- Expect 106 mirrors carrying a family and a NULL row of 5.

SELECT color_family, COUNT(*) AS n
  FROM products
 WHERE category_id = @mirror_cat AND is_active = 1
 GROUP BY color_family ORDER BY n DESC;

-- Expect 21 rows across the alt families.

SELECT pav.value_text AS also_shows_under, COUNT(*) AS n
  FROM product_attribute_values pav
  JOIN products p ON p.id = pav.product_id
 WHERE p.category_id = @mirror_cat
   AND pav.attr_key = 'color_family_alt'
 GROUP BY pav.value_text ORDER BY n DESC;
