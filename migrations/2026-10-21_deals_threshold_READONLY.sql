-- ════════════════════════════════════════════════════════════════════════
-- 2026-10-21 — READ ONLY. How many products qualify at each discount
-- threshold? Nothing is written. Safe to run on live.
--
-- WHY: the Deals page will filter on MSRP→price discount instead of the
-- current "any discount at all" (collectionsController.js:189, which is why
-- almost every vanity qualifies today). The owner wants 40% but needs to
-- know it is not so restrictive that the page looks empty.
--
-- ⚠️ THE DISCOUNT BASIS IS (compare_price - price) / compare_price.
-- compare_price is MSRP, price is what BVO charges. Dividing by price
-- instead would overstate every figure — a $100 item at $50 is 50% off
-- MSRP, not 100%.
--
-- compare_price > 0 is required, not just NOT NULL: a zero MSRP would
-- divide by zero and MariaDB returns NULL rather than erroring, which would
-- silently drop those rows from every bucket.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. THE CURVE — how many products survive at each threshold ─────────
SELECT
  COUNT(*)                                            AS discounted_now,
  SUM(CASE WHEN pct >= 0.20 THEN 1 ELSE 0 END)        AS at_20pct,
  SUM(CASE WHEN pct >= 0.30 THEN 1 ELSE 0 END)        AS at_30pct,
  SUM(CASE WHEN pct >= 0.35 THEN 1 ELSE 0 END)        AS at_35pct,
  SUM(CASE WHEN pct >= 0.40 THEN 1 ELSE 0 END)        AS at_40pct,
  SUM(CASE WHEN pct >= 0.45 THEN 1 ELSE 0 END)        AS at_45pct,
  SUM(CASE WHEN pct >= 0.50 THEN 1 ELSE 0 END)        AS at_50pct,
  SUM(CASE WHEN pct >= 0.60 THEN 1 ELSE 0 END)        AS at_60pct,
  ROUND(MAX(pct) * 100, 1)                            AS deepest_discount_pct
FROM (
  SELECT (p.compare_price - p.price) / p.compare_price AS pct
    FROM products p
   WHERE p.is_active = 1
     AND p.compare_price IS NOT NULL
     AND p.compare_price > 0
     AND p.compare_price > p.price
) t;
-- READ: `at_40pct` is the answer. The owner wants comfortably more than 24.
-- `discounted_now` is what the Sale page shows today.

-- ── 2. AT 40%, WHAT KIND OF PRODUCTS ARE THEY? ─────────────────────────
-- A page of 200 cabinet knobs is not a deals page. This says whether the
-- 40% pool is actually vanities or mostly cheap accessories.
SELECT c.name                                   AS category,
       p.brand,
       COUNT(*)                                 AS products,
       ROUND(AVG((p.compare_price - p.price) / p.compare_price) * 100, 1) AS avg_pct_off,
       ROUND(MIN(p.price), 2)                   AS cheapest,
       ROUND(MAX(p.price), 2)                   AS dearest
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
 WHERE p.is_active = 1
   AND p.compare_price IS NOT NULL
   AND p.compare_price > 0
   AND (p.compare_price - p.price) / p.compare_price >= 0.40
 GROUP BY c.name, p.brand
 ORDER BY products DESC;

-- ── 3. A LOOK AT THE TOP 20 ────────────────────────────────────────────
-- ⚠️ ORDER BY repeats the expression rather than using the `pct` alias.
-- MariaDB #1247: ORDER BY cannot reference a SELECT alias in every context,
-- and this project has been bitten by it once already (Rule 21).
SELECT p.sku, p.name, p.brand,
       p.compare_price AS msrp,
       p.price,
       ROUND((p.compare_price - p.price) / p.compare_price * 100, 1) AS pct_off
  FROM products p
 WHERE p.is_active = 1
   AND p.compare_price IS NOT NULL
   AND p.compare_price > 0
   AND (p.compare_price - p.price) / p.compare_price >= 0.40
 ORDER BY (p.compare_price - p.price) / p.compare_price DESC, p.sku ASC
 LIMIT 20;
