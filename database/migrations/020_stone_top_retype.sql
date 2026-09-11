-- ════════════════════════════════════════════════════════════════════
--  020 — retype 24 stone tops mis-typed as Composite Top
--
--  The importer decides Stone vs Composite from a regex over the product
--  name and the Vanity Countertop Material field. It knew 'quartz',
--  'marble' and 'silestone' — but not 'eclos' or 'carrara'.
--
--  JM names the BRAND, not the substance:
--    · Eclos Zero Silica  — Cosentino's zero-silica engineered stone.
--                           22 SKUs, all Phantome (PHT) or Tajnar (TJR).
--    · "Carrara White"    — a marble. The word "marble" never appears in
--                           the product name. 2 SKUs.
--
--  The tell: hasCharger was rescuing seven Eclos tops by accident, so
--  050-S48-FP-TJR-SNK was Stone while 050-S48-TJR-SNK — same slab, no
--  charging pad — was Composite.
--
--  CUSTOMER-VISIBLE. These 24 will start appearing on stone-top
--  collection pages and in stone filters, and leave the composite ones.
--  That is the correct outcome, not a side effect.
--
--  Six of the 22 Eclos SKUs are Radius Cut tops, which getTops() filters
--  on product_type = 'Stone Top' — so the shallow collections (Gracyn,
--  Allamari, Lucian) were getting a partial top list in the bundle
--  builder even once their cabinets were admitted.
--
--  The permanent fix is STONE_TERMS in importJamesMartinFeed.js. This
--  migration only corrects rows already imported.
--
--  NOT TOUCHED: the 26 genuinely-composite tops — Solid Surface (080,
--  410) and Mineral Composite (CS, CSP, SWB). Their material fields say
--  so plainly and the predicate below cannot reach them.
--
--  Idempotent. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════

-- Rows this will touch, BEFORE (expect 24):
SELECT COUNT(*) AS will_change
  FROM products p
 WHERE p.brand = 'James Martin Vanities'
   AND p.product_type = 'Composite Top'
   AND ( p.name LIKE '%Eclos%' OR p.name LIKE '%Carrara%' );

-- Itemised, so the change is on the record before it is made:
SELECT p.sku, p.product_type AS was, p.name
  FROM products p
 WHERE p.brand = 'James Martin Vanities'
   AND p.product_type = 'Composite Top'
   AND ( p.name LIKE '%Eclos%' OR p.name LIKE '%Carrara%' )
 ORDER BY p.sku;

UPDATE products p
   SET p.product_type = 'Stone Top'
 WHERE p.brand = 'James Martin Vanities'
   AND p.product_type = 'Composite Top'
   AND ( p.name LIKE '%Eclos%' OR p.name LIKE '%Carrara%' );

-- Verify: must return 0 rows.
SELECT p.sku, p.product_type AS still_composite
  FROM products p
 WHERE p.brand = 'James Martin Vanities'
   AND p.product_type = 'Composite Top'
   AND ( p.name LIKE '%Eclos%' OR p.name LIKE '%Carrara%' );

-- Confirm the split. Expect Stone Top 177, Composite Top 26.
SELECT p.product_type, COUNT(*) AS n
  FROM products p
 WHERE p.brand = 'James Martin Vanities'
   AND p.product_type IN ('Stone Top', 'Composite Top')
 GROUP BY p.product_type;

-- Confirm all 27 Radius Cut tops are now Stone Top (expect one row: 27).
SELECT p.product_type, COUNT(*) AS n
  FROM products p
 WHERE p.brand = 'James Martin Vanities'
   AND p.sku LIKE '060-%'
 GROUP BY p.product_type;
