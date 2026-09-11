-- ════════════════════════════════════════════════════════════════════
--  024 — put the 66 mis-filed sample products into the Samples category
--
--  SYMPTOM: /collections/samples shows three cards. Every wood and metal
--  sample is missing, and so are 15 of the 18 stone samples.
--
--  The page is not broken. The data is. Measured on production:
--
--      kind    category             count
--      Stone   samples                  3   <- all the page can show
--      Stone   bathroom-vanities       15
--      Wood    bathroom-vanities       47
--      Metal   bathroom-vanities        4
--
--  66 sample products sit in bathroom-vanities with product_type = NULL.
--  Two consequences, and the second is the worse one:
--    1. They cannot appear on /collections/samples.
--    2. They ARE appearing in the vanities collection — 66 nine-dollar
--       chips of wood listed among vanities.
--
--  AUTHORITY: jmv_dimensions.product_type, which carries the vendor's
--  own classification — 'Sample - Wood' (47), 'Sample - Stone' (18),
--  'Sample - Metal' (4) = 69 rows. That is the join key, NOT a LIKE on
--  the product name: 'Dune Mist Wood Sample' and 'Metal Sample -
--  Brushed Nickel' put the word in different places, and name matching
--  would also sweep up any vanity that happens to mention a sample.
--
--  Idempotent. Safe to re-run: the UPDATE is a no-op once rows are in
--  category 10, and the diagnostic SELECTs have no side effects.
-- ════════════════════════════════════════════════════════════════════

-- Before — expect 3 in samples, 66 stranded in bathroom-vanities.
SELECT c.slug AS category, COUNT(*) AS n
  FROM products p
  JOIN jmv_dimensions jd ON jd.sku = p.sku
  LEFT JOIN categories c ON c.id = p.category_id
 WHERE jd.product_type LIKE 'Sample - %'
   AND p.is_active = 1
 GROUP BY c.slug
 ORDER BY n DESC;

-- ── 1. Move them, and give them a product_type ──────────────────────
--  product_type is set to 'Sample' to match the three that are already
--  filed correctly. The finer grain (wood / stone / metal) stays
--  available through jmv_dimensions for any filter that wants it.
UPDATE products p
  JOIN jmv_dimensions jd ON jd.sku = p.sku
   SET p.category_id  = 10,
       p.product_type = 'Sample'
 WHERE jd.product_type LIKE 'Sample - %'
   AND (p.category_id <> 10 OR p.product_type IS NULL);

-- ── 2. One name is plural, and that alone hides it ──────────────────
--  SS-CSP2 is named "Stone Samples - Charcoal Soapstone". The bundle
--  builder's swatch lookup matches names LIKE 'Stone Sample -%', so the
--  stray "s" makes this product invisible to it no matter which category
--  it sits in. Charcoal Soapstone therefore renders as a blank tile even
--  though its swatch image exists.
--
--  Scoped to the one SKU deliberately. A blanket REPLACE of 'Samples'
--  with 'Sample' across the table would also rewrite legitimate names.
UPDATE products
   SET name = 'Stone Sample - Charcoal Soapstone'
 WHERE sku = 'SS-CSP2'
   AND name <> 'Stone Sample - Charcoal Soapstone';

-- ── Verify ──────────────────────────────────────────────────────────
--  COUNT, not absence — an empty result set is how a broken check
--  disguises itself as a pass. Expect one row: samples, 69.
SELECT c.slug AS category, p.product_type, COUNT(*) AS n
  FROM products p
  JOIN jmv_dimensions jd ON jd.sku = p.sku
  LEFT JOIN categories c ON c.id = p.category_id
 WHERE jd.product_type LIKE 'Sample - %'
   AND p.is_active = 1
 GROUP BY c.slug, p.product_type;

-- Expect 0 — no sample left outside the Samples category.
SELECT p.sku, p.name, p.category_id
  FROM products p
  JOIN jmv_dimensions jd ON jd.sku = p.sku
 WHERE jd.product_type LIKE 'Sample - %'
   AND p.is_active = 1
   AND p.category_id <> 10;

-- And confirm the vanities collection is no longer carrying them.
SELECT COUNT(*) AS samples_still_in_vanities
  FROM products p
  JOIN categories c ON c.id = p.category_id
  JOIN jmv_dimensions jd ON jd.sku = p.sku
 WHERE c.slug = 'bathroom-vanities'
   AND jd.product_type LIKE 'Sample - %';

-- ────────────────────────────────────────────────────────────────────
--  THE IMPORTER IS THE REAL FIX. This migration repairs today's rows;
--  importJamesMartinFeed.js must route 'Sample - *' to category 10 on
--  every future feed, or the next import undoes this. See the
--  PRODUCT_CATEGORY_MAP change shipped alongside.
-- ────────────────────────────────────────────────────────────────────
