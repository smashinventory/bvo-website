-- ════════════════════════════════════════════════════════════════════
--  021 — Swatch Samples: separate the stone PICTURE from the stone SAMPLE
--
--  The bundle builder's stone swatch reads its image from the sellable
--  "Stone Sample - X" product. That ties a display asset to a sellable
--  item's lifecycle: Tajnar sat at QTY 0 while its swatch was the only
--  thing on the page telling anyone what Tajnar looks like, and
--  deactivating or deleting the sample would have blanked the swatch.
--
--  This creates a parallel "Swatch Sample - X" product per finish:
--    · is_active = 0  — never reaches a collection page or search
--    · price    = 0   — not sellable, no inventory row
--    · images copied from the Stone Sample
--
--  bundleController reads Swatch Sample first and falls back to Stone
--  Sample, and reads BOTH ignoring is_active and stock. So the swatch
--  survives the sample going out of stock, off sale, or away entirely.
--
--  It also unblocks the other twelve finishes: a swatch image can now be
--  added for a stone we do not sell a sample of, through the normal admin
--  product screen, with no code change.
--
--  NAMING IS LOAD-BEARING. The text after "Swatch Sample - " must match
--  jmv_dimensions.top_finish exactly (case-insensitive):
--      Cala Blue · Carrara White · Charcoal Soapstone ·
--      Eternal Jasmine Pearl · Eternal Marfil · Eternal Serena ·
--      Ethereal Noctis · Grey Expo · Lime Delight · Parisien Bleu ·
--      Phantome · Siberian · Tajnar · Victorian Silver · White Zeus
--
--  Idempotent. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════

-- What exists now (expect 3 Stone Sample, 0 Swatch Sample):
SELECT
  SUM(name LIKE 'Stone Sample -%')  AS stone_samples,
  SUM(name LIKE 'Swatch Sample -%') AS swatch_samples
FROM products
WHERE brand = 'James Martin Vanities' AND category_id = 10;

-- 1. One Swatch Sample per existing Stone Sample.
INSERT INTO products
      (sku, slug, name, brand, category_id, product_type,
       price, compare_price, is_active, short_desc)
SELECT CONCAT('SWATCH-', p.sku),
       CONCAT('swatch-', p.slug),
       REPLACE(p.name, 'Stone Sample -', 'Swatch Sample -'),
       p.brand, p.category_id, p.product_type,
       0, NULL, 0,
       'Display swatch image only. Not for sale.'
  FROM products p
 WHERE p.brand = 'James Martin Vanities'
   AND p.category_id = 10
   AND p.name LIKE 'Stone Sample -%'
   AND NOT EXISTS (SELECT 1 FROM products x
                    WHERE x.sku = CONCAT('SWATCH-', p.sku));

-- 2. Copy the imagery across.
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT sw.id, pi.url, pi.alt_text, pi.sort_order, pi.is_primary
  FROM products sw
  JOIN products orig ON orig.sku = REPLACE(sw.sku, 'SWATCH-', '')
  JOIN product_images pi ON pi.product_id = orig.id
 WHERE sw.name LIKE 'Swatch Sample -%'
   AND NOT EXISTS (SELECT 1 FROM product_images x
                    WHERE x.product_id = sw.id AND x.url = pi.url);

-- 3. Mirror primary_image_url so either read path works.
UPDATE products sw
  JOIN products orig ON orig.sku = REPLACE(sw.sku, 'SWATCH-', '')
   SET sw.primary_image_url = orig.primary_image_url
 WHERE sw.name LIKE 'Swatch Sample -%'
   AND sw.primary_image_url IS NULL;

-- Verify: every Swatch Sample has at least one image (expect 0 rows).
SELECT sw.sku, sw.name
  FROM products sw
 WHERE sw.name LIKE 'Swatch Sample -%'
   AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = sw.id)
   AND sw.primary_image_url IS NULL;

-- Verify: none of them is sellable (expect 0 rows).
SELECT sku, name, is_active, price
  FROM products
 WHERE name LIKE 'Swatch Sample -%'
   AND (is_active <> 0 OR price <> 0);

-- Final state (expect 3 and 3):
SELECT
  SUM(name LIKE 'Stone Sample -%')  AS stone_samples,
  SUM(name LIKE 'Swatch Sample -%') AS swatch_samples
FROM products
WHERE brand = 'James Martin Vanities' AND category_id = 10;

-- ────────────────────────────────────────────────────────────────────
--  STILL MISSING — twelve finishes have no swatch image of any kind:
--    Cala Blue, Carrara White, Charcoal Soapstone, Eternal Jasmine
--    Pearl, Eternal Marfil, Eternal Serena, Ethereal Noctis, Grey Expo,
--    Lime Delight, Parisien Bleu, Victorian Silver, White Zeus
--
--  Until they exist the builder shows the finish's initials. To add one:
--  create a product in category 10 named exactly
--  "Swatch Sample - <finish>", brand James Martin Vanities, price 0,
--  is_active 0, and upload the swatch photo. No code change needed.
-- ────────────────────────────────────────────────────────────────────
