-- ============================================================================
-- 2026-10-05_zero_price_audit_READONLY.sql
--
-- READ ONLY. Three SELECTs. No CREATE, no ALTER, no INSERT, no UPDATE.
--
-- ─── WHY ────────────────────────────────────────────────────────────────────
-- Request: block out any item with a $0 value.
--
-- That is safe to do bluntly, because nothing in this catalogue is
-- legitimately free. Confirmed in code, not assumed:
--
--   src/utils/cartPricing.js      all 69 samples carry a real price; the two
--                                 most expensive UNITS IN THE CART are
--                                 discounted to zero at cart level
--   src/controllers/cartController.js:180  is_sample is derived from
--                                 category_id = 10 - it is NOT a column on
--                                 products, which is why this file groups on
--                                 category_id rather than on is_sample
--
-- So a products row at price 0 is a DATA DEFECT, not a free product.
--
-- ⚠️ WHAT THIS QUERY IS FOR. The size of the population decides the scope of
-- the rule. Three rows is a harmless safety net. Three hundred rows is a
-- change that silently removes stock from the storefront, and would need to
-- be a pricing fix first and a display rule second. Writing the block before
-- knowing which it is would be guessing with the catalogue.
--
-- Columns used (price, is_active, product_type, category_id, slug, name, sku,
-- brand, updated_at) all come from the INSERT list in
-- importJamesMartinFeed.js, which is authoritative because it writes them.
--
-- HOW TO RUN: phpMyAdmin shows only the first result set when blocks are run
-- together. Run the three blocks one at a time.
-- ============================================================================


-- ─── 1. HOW BIG IS THE PROBLEM? ────────────────────────────────────────────
-- NULL and 0 are counted separately on purpose: a NULL price is "never
-- priced" (an import gap) while 0.00 is "priced at zero" (someone typed it,
-- or a feed sent it). They usually have different causes and different fixes.

SELECT
  COUNT(*)                                                      AS active_products,
  SUM(CASE WHEN p.price IS NULL THEN 1 ELSE 0 END)              AS price_is_null,
  SUM(CASE WHEN p.price = 0 THEN 1 ELSE 0 END)                  AS price_is_zero,
  SUM(CASE WHEN p.price < 0 THEN 1 ELSE 0 END)                  AS price_is_negative,
  SUM(CASE WHEN p.price IS NULL OR p.price <= 0 THEN 1 ELSE 0 END) AS total_blocked,
  SUM(CASE WHEN p.category_id = 10 THEN 1 ELSE 0 END)           AS samples_total,
  SUM(CASE WHEN p.category_id = 10 AND (p.price IS NULL OR p.price <= 0) THEN 1 ELSE 0 END)
                                                                AS samples_at_zero
FROM products p
WHERE p.is_active = 1;
-- samples_at_zero SHOULD BE 0. If it is not, the free-sample promotion is
-- discounting something that is already zero, and the cart maths needs
-- looking at before any display rule is added.


-- ─── 2. WHICH PRODUCT TYPES ARE AFFECTED? ──────────────────────────────────
-- Tells you whether this is a stray handful or a whole category that never
-- got priced.

SELECT
  COALESCE(NULLIF(TRIM(p.product_type), ''), '(blank)') AS product_type,
  COUNT(*)                                             AS zero_or_null,
  MIN(p.slug)                                          AS example_slug
FROM products p
WHERE p.is_active = 1
  AND (p.price IS NULL OR p.price <= 0)
GROUP BY COALESCE(NULLIF(TRIM(p.product_type), ''), '(blank)')
ORDER BY zero_or_null DESC;


-- ─── 3. THE ACTUAL ROWS (first 100) ────────────────────────────────────────
-- So the cause is visible rather than guessed. compare_price is included
-- because a row with an MSRP but no price is an import gap, whereas a row
-- with neither was probably never meant to be sold.

SELECT
  p.id, p.sku, p.slug, p.name, p.brand,
  p.price, p.compare_price, p.product_type, p.category_id,
  p.updated_at
FROM products p
WHERE p.is_active = 1
  AND (p.price IS NULL OR p.price <= 0)
ORDER BY p.product_type, p.id
LIMIT 100;
