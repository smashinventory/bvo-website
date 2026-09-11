-- ════════════════════════════════════════════════════════════════════
--  022 — repair 021. Run this even if 021 appeared to succeed.
--
--  WHAT WENT WRONG
--
--  021 named the new rows with:
--      REPLACE(p.name, 'Stone Sample -', 'Swatch Sample -')
--
--  MySQL's REPLACE() is case-SENSITIVE. The live rows are named
--  "STONE SAMPLE - PHANTOME", uppercase. REPLACE found no match, so the
--  three new products were inserted carrying the ORIGINAL name — three
--  duplicates of the stone samples rather than three swatch samples.
--
--  LIKE, by contrast, IS case-insensitive under utf8mb4_unicode_ci. So
--  every later step in 021 lied in a consistent direction:
--    · step 2 copied 0 images  — nothing matched 'Swatch Sample -%'
--    · step 3 updated 0 rows   — same reason
--    · the "every swatch has an image" check returned 0 rows and looked
--      like a pass, because there were no swatch rows to check. A
--      vacuous pass, which is the worst kind.
--    · the final count read 6 stone / 0 swatch — the one honest signal.
--
--  LEFT AS-IS THE JUNK IS HARMFUL. getStoneSamples() reads names LIKE
--  'Stone Sample -%' case-insensitively, so these three imageless rows
--  are candidates. Ties are broken by name, and they share a name with
--  the real samples — so the imageless row can win and blank a swatch
--  that works today.
--
--  Idempotent. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════

-- Before (expect: 3 junk rows, named like a stone sample, no images):
SELECT sku, name, is_active, price
  FROM products
 WHERE sku LIKE 'SWATCH-%'
 ORDER BY sku;

-- 1. Rename by position, not by matching a case. Everything after the
--    first '-' is the finish, whatever case the prefix happens to use.
UPDATE products
   SET name = CONCAT('Swatch Sample - ',
                     TRIM(SUBSTRING(name FROM LOCATE('-', name) + 1)))
 WHERE sku LIKE 'SWATCH-%'
   AND name NOT LIKE 'Swatch Sample -%';

-- 2. Now the imagery copy can find its targets.
INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
SELECT sw.id, pi.url, pi.alt_text, pi.sort_order, pi.is_primary
  FROM products sw
  JOIN products orig ON orig.sku = REPLACE(sw.sku, 'SWATCH-', '')
  JOIN product_images pi ON pi.product_id = orig.id
 WHERE sw.sku LIKE 'SWATCH-%'
   AND NOT EXISTS (SELECT 1 FROM product_images x
                    WHERE x.product_id = sw.id AND x.url = pi.url);

UPDATE products sw
  JOIN products orig ON orig.sku = REPLACE(sw.sku, 'SWATCH-', '')
   SET sw.primary_image_url = orig.primary_image_url
 WHERE sw.sku LIKE 'SWATCH-%'
   AND sw.primary_image_url IS NULL;

-- ── Verification. These COUNT rather than look for absence, because an
--    empty result was exactly how 021 fooled itself. ──

-- Expect swatch_samples = 3 and stone_samples = 3.
SELECT
  SUM(name LIKE 'Stone Sample -%')  AS stone_samples,
  SUM(name LIKE 'Swatch Sample -%') AS swatch_samples
FROM products
WHERE brand = 'James Martin Vanities' AND category_id = 10;

-- Expect 3 rows, each with an image and each named Swatch Sample.
SELECT sw.sku, sw.name, sw.is_active, sw.price,
       (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id = sw.id) AS images,
       sw.primary_image_url IS NOT NULL AS has_primary
  FROM products sw
 WHERE sw.sku LIKE 'SWATCH-%'
 ORDER BY sw.sku;

-- Expect 0 rows — no swatch left without imagery.
SELECT sw.sku, sw.name
  FROM products sw
 WHERE sw.sku LIKE 'SWATCH-%'
   AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = sw.id)
   AND sw.primary_image_url IS NULL;

-- Expect 0 rows — none of them sellable or visible.
SELECT sku, name, is_active, price
  FROM products
 WHERE sku LIKE 'SWATCH-%'
   AND (is_active <> 0 OR price <> 0);

-- ────────────────────────────────────────────────────────────────────
--  The finish name keeps whatever case the stone sample used, e.g.
--  "Swatch Sample - PHANTOME". That is fine: the lookup lowercases both
--  sides (finishKey in bundleController), so PHANTOME pairs with
--  top_finish "Phantome".
-- ────────────────────────────────────────────────────────────────────
