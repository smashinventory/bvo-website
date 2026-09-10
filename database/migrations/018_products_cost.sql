-- ═══════════════════════════════════════════════════════════════════
-- 018 — products.cost
--
-- Our landed unit cost from James Martin. Derived, not quoted per item.
--
-- Established 2026-09-10 from six invoice lines across three SKUs, two
-- separate quotes. Cost is a flat percentage of MSRP, identical to three
-- decimal places regardless of size, collection or price point:
--
--   SKU                 MSRP        cost      cost/MSRP
--   D200-V36-CSN-3WZ  4,234.00   1,371.816    32.400%
--   D100-V36-PBO-1WZ  4,690.00   1,519.560    32.400%
--   D404-V72-SWO-3WZ  8,470.00   2,744.280    32.400%
--
-- A second quote set came in at exactly 33.300% on the same three SKUs —
-- a different tier, not a different formula. Ratio between the two sets is
-- 1.0278 on every line. 32.4% is the rate in force; if the tier changes,
-- change JM_COST_FACTOR in importJamesMartinFeed.js and re-run the backfill
-- below. Do NOT hand-edit rows.
--
-- Scope: James Martin only. ER Vanities (78 products) is a different vendor
-- on unknown terms — its cost stays NULL rather than being invented at JM's
-- rate. 86 JM products have no MSRP (mostly samples and shelves) and also
-- stay NULL; a cost of 0 would read as free rather than as unknown.
--
-- Sanity: at current prices this puts gross margin at 50.8–51.0% across all
-- 5,132 priced JM products, and nothing is currently sold below cost.
--
-- Safe to re-run — the backfill is idempotent.
-- ═══════════════════════════════════════════════════════════════════

-- The column already exists in the live schema —
--   `cost` decimal(10,2) DEFAULT NULL
-- — and every one of the 5,297 rows is NULL, so nothing is being overwritten.
-- Kept as IF NOT EXISTS so this migration also works on a fresh database.
ALTER TABLE `products`
  ADD COLUMN IF NOT EXISTS `cost` DECIMAL(10,2) NULL AFTER `compare_price`;

-- ── Backfill ───────────────────────────────────────────────────────
-- MSRP x 0.324, to the cent. Only where we have an MSRP to derive from.
UPDATE `products`
   SET `cost` = ROUND(`compare_price` * 0.324, 2)
 WHERE `brand` = 'James Martin Vanities'
   AND `compare_price` IS NOT NULL
   AND `compare_price` > 0;

-- ── Verify ─────────────────────────────────────────────────────────
-- Expect: ~5,132 costed, 0 with cost above price, margin around 50.9%
SELECT
  COUNT(*)                                                   AS jm_products,
  SUM(CASE WHEN cost IS NOT NULL THEN 1 ELSE 0 END)          AS costed,
  SUM(CASE WHEN cost IS NULL     THEN 1 ELSE 0 END)          AS no_cost,
  SUM(CASE WHEN cost > price     THEN 1 ELSE 0 END)          AS below_cost,
  ROUND(AVG(CASE WHEN cost > 0 AND price > 0
                 THEN (price - cost) / price * 100 END), 2)  AS avg_margin_pct
FROM `products`
WHERE `brand` = 'James Martin Vanities';

-- Spot-check the three SKUs the factor was derived from.
-- Expect cost 1371.82 / 1519.56 / 2744.28.
SELECT sku, compare_price AS msrp, price AS map, cost,
       ROUND(cost / compare_price * 100, 3) AS cost_pct_of_msrp
  FROM `products`
 WHERE sku IN ('D200-V36-CSN-3WZ', 'D100-V36-PBO-1WZ', 'D404-V72-SWO-3WZ');
