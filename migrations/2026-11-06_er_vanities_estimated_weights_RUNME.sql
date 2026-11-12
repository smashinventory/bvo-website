-- ─────────────────────────────────────────────────────────────────────────
-- 2026-11-06_er_vanities_estimated_weights_RUNME.sql
--
-- Fills weight_lbs for the 77 ER Vanities cabinet SKUs that carry NO shipping
-- weight, so Google Merchant Center stops rejecting them for
-- "Missing shipping weight [shipping_weight]".
--
-- Run in phpMyAdmin against the BVO database. Safe to run twice: every
-- statement is guarded by "weight_lbs IS NULL", so a real weight entered
-- later is never overwritten by an estimate.
--
-- ⚠️ NO information_schema. This DB user is denied it (#1044).
--
-- ═════════════════════════════════════════════════════════════════════════
-- ⚠️ NOTE 1 — THESE ARE ESTIMATES, AND THEY GO IN weight_lbs, NOT
-- total_ship_weight_lbs. THAT DISTINCTION IS THE ENTIRE POINT OF THIS FILE.
--
--   total_ship_weight_lbs  ->  pre-fills WWEX FREIGHT QUOTES
--                              (src/controllers/shippingController.js:273)
--   weight_lbs             ->  read ONLY as the Google feed's fallback
--                              (src/controllers/feedController.js:198)
--
-- Putting an estimate in total_ship_weight_lbs would hand a guessed number to
-- a freight carrier. Under-estimate a 276 lb vanity and BVO eats the
-- difference on a real shipment, with nothing on screen admitting the number
-- was invented. Left NULL, the shipping form stays blank and a human has to
-- weigh it -- which is the correct behaviour for a number nobody measured.
--
-- Owner decision, 2026-11-06: weight_lbs only.
--
-- WHEN REAL WEIGHTS ARRIVE from ER Vanities, write them to
-- total_ship_weight_lbs. feedController prefers that column automatically, so
-- these estimates retire themselves rather than needing to be hunted down.
--
-- ⚠️ NOTE 2 — EVERY DERIVED NUMBER HERE IS CROSS-BRAND. Zero ER Vanities SKUs
-- carry a weight anywhere in the catalogue, so there is no same-brand peer to
-- average. All figures are the MEDIAN of James Martin cabinet-only SKUs at the
-- nearest size. Median rather than mean because the samples contain genuine
-- outliers -- the 36" set spans 47 lb to 201 lb. ER construction may differ
-- from James Martin and nobody has verified that it does not.
--
-- The 41.5" group is INTERPOLATED, not averaged. The only two James Martin
-- 42" cabinets both weigh 119 lb, which is LIGHTER than the 36" median of
-- 147 lb. A wider cabinet weighing less than a narrower one is a data error,
-- not a measurement, so those two were excluded and the value interpolated
-- between the 36" and 48" medians instead. Averaging them would have
-- published a number that is visibly wrong on its face.
--
-- ⚠️ NOTE 3 — THE FOUR BRIDGE CABINETS ARE OWNER-SUPPLIED, NOT DERIVED.
-- They are the only Side Cabinets in the whole feed, so there was nothing to
-- compare them against. The owner supplied 90 lb for 3-drawer bridges and
-- 45 lb for single-drawer on 2026-11-06.
--
-- One judgement call inside that: Bristol-BridgeMUCounter ("Make-Up Bridge")
-- is a counter span, not a drawer unit, so neither bucket fits it exactly.
-- It was put in the 45 lb group as the nearer of the two. If it is actually
-- just a top with no cabinet box, it is lighter than 45 and worth correcting.
-- ═════════════════════════════════════════════════════════════════════════


-- ── BEFORE: confirm 77 rows are missing a weight ─────────────────────────
SELECT COUNT(*) AS er_cabinets_without_any_weight
  FROM products
 WHERE brand = 'ER Vanities'
   AND weight_lbs IS NULL
   AND total_ship_weight_lbs IS NULL;
-- expect 77


-- 23.5" single — median of 10 James Martin 24" cabinets (69-88 lb)
--    2 SKU(s)
UPDATE products SET weight_lbs = 78
 WHERE weight_lbs IS NULL
   AND sku IN (
       'London-23.5-DOAK-MB',
       'London-23.5-WH-BN'
   );

-- 29.5" single — median of 39 James Martin 30" cabinets (52-251 lb)
--    14 SKU(s)
UPDATE products SET weight_lbs = 116
 WHERE weight_lbs IS NULL
   AND sku IN (
       'Bristol-29.5-NWA-BG',
       'Kensington-29.5L-DOAK-MB',
       'Kensington-29.5L-NVBLU-BG',
       'Kensington-29.5L-WH-BN',
       'Kensington-29.5R-DOAK-MB',
       'Kensington-29.5R-NVBLU-BG',
       'Kensington-29.5R-WH-BN',
       'London-29.5-WH-BN',
       'London-29.5-DOAK-MB',
       'Oxford-29.5-BLK-BG',
       'Oxford-29.5-CAMGRN-BG',
       'Oxford-29.5-WA-MB',
       'Windsor-29.5-NVBLU-BG',
       'Windsor-29.5-WH-BN'
   );

-- 35.5" single — median of 71 James Martin 36" cabinets (47-201 lb)
--    17 SKU(s)
UPDATE products SET weight_lbs = 147
 WHERE weight_lbs IS NULL
   AND sku IN (
       'Bristol-35.5-NWA-BG',
       'Kensington-35.5L-DOAK-MB',
       'Kensington-35.5L-MGR-BN',
       'Kensington-35.5L-NVBLU-BG',
       'Kensington-35.5L-WH-BN',
       'Kensington-35.5R-DOAK-MB',
       'Kensington-35.5R-MGR-BN',
       'Kensington-35.5R-NVBLU-BG',
       'Kensington-35.5R-WH-BN',
       'London-35.5R-DOAK-MB',
       'London-35.5R-WH-BN',
       'Oxford-35.5-BLK-BG',
       'Oxford-35.5-CAMGRN-BG',
       'Oxford-35.5-WA-MB',
       'Windsor-35.5L-WH-BN',
       'Windsor-35.5R-NVBLU-BG',
       'Windsor-35.5R-WH-BN'
   );

-- 41.5" single — INTERPOLATED between 36" (147) and 48" (214). See note 2.
--    8 SKU(s)
UPDATE products SET weight_lbs = 180
 WHERE weight_lbs IS NULL
   AND sku IN (
       'Bristol-41.5-NWA-BG',
       'Kensington-41.5-DOAK-MB',
       'Kensington-41.5-MGR-BN',
       'Kensington-41.5-NVBLU-BG',
       'Kensington-41.5-WH-BN',
       'Oxford-41.5-BLK-BG',
       'Oxford-41.5-CAMGRN-BG',
       'Oxford-41.5-WA-MB'
   );

-- 47.5" single — median of 65 James Martin 48" cabinets (89-267 lb)
--    10 SKU(s)
UPDATE products SET weight_lbs = 214
 WHERE weight_lbs IS NULL
   AND sku IN (
       'Bristol-47.5-NWA-BG',
       'Kensington-47.5-MGR-BN',
       'Kensington-47.5-WH-BN',
       'London-47.5-DOAK-MB',
       'London-47.5-WH-BN',
       'Oxford-47.5-CAMGRN-BG',
       'Oxford-47.5-BLK-BG',
       'Oxford-47.5-WA-MB',
       'Windsor-47.5-NVBLU-BG',
       'Windsor-47.5-WH-BN'
   );

-- 59.5" SINGLE sink — median of 33 James Martin 60" single cabinets (210-269 lb)
--    7 SKU(s)
UPDATE products SET weight_lbs = 234
 WHERE weight_lbs IS NULL
   AND sku IN (
       'Bristol-59.5S-NWA-BG',
       'Kensington-59.5S-MGR-BN',
       'Kensington-59.5S-WH-BN',
       'London-59.5S-DOAK-MB',
       'London-59.5S-WH-BN',
       'Windsor-59.5S-NVBLU-BG',
       'Windsor-59.5S-WH-BN'
   );

-- 59.5" DOUBLE sink — median of 50 James Martin 60" double cabinets (163-274 lb)
--    7 SKU(s)
UPDATE products SET weight_lbs = 227
 WHERE weight_lbs IS NULL
   AND sku IN (
       'Bristol-59.5D-NWA-BG',
       'Kensington-59.5D-MGR-BN',
       'Kensington-59.5D-WH-BN',
       'London-59.5D-DOAK-MB',
       'London-59.5D-WH-BN',
       'Windsor-59.5D-WH-BN',
       'Windsor-59.5D-NVBLU-BG'
   );

-- 71.5" double — median of 57 James Martin 72" double cabinets (87-377 lb)
--    7 SKU(s)
UPDATE products SET weight_lbs = 276
 WHERE weight_lbs IS NULL
   AND sku IN (
       'Bristol-71.5-NWA-BG',
       'Kensington-71.5-MGR-BN',
       'Kensington-71.5-WH-BN',
       'London-71.5-DOAK-MB',
       'London-71.5-WH-BN',
       'Windsor-71.5-NVBLU-BG',
       'Windsor-71.5-WH-BN'
   );

-- Linen tower — median of 4 James Martin linen cabinets (141-179 lb)
--    1 SKU(s)
UPDATE products SET weight_lbs = 165
 WHERE weight_lbs IS NULL
   AND sku IN (
       'Windsor-LC-WH-BN'
   );

-- 3-drawer bridge — OWNER-SUPPLIED, 2026-11-06. Not derived. See note 3.
--    1 SKU(s)
UPDATE products SET weight_lbs = 90
 WHERE weight_lbs IS NULL
   AND sku IN (
       'Bristol-Bridge3DE-NWA-BG'
   );

-- Single-drawer / make-up bridge — OWNER-SUPPLIED, 2026-11-06. See note 3.
--    3 SKU(s)
UPDATE products SET weight_lbs = 45
 WHERE weight_lbs IS NULL
   AND sku IN (
       'Kensington-BridgeCabinet-MG-BN',
       'Kensington-BridgeCabinet-WH-BN',
       'Bristol-BridgeMUCounter-NWA-BG'
   );


-- ── AFTER: verify ────────────────────────────────────────────────────────
SELECT COUNT(*) AS still_missing
  FROM products
 WHERE brand = 'ER Vanities'
   AND weight_lbs IS NULL
   AND total_ship_weight_lbs IS NULL;
-- expect 0

SELECT weight_lbs, COUNT(*) AS skus
  FROM products
 WHERE brand = 'ER Vanities' AND weight_lbs IS NOT NULL
 GROUP BY weight_lbs
 ORDER BY weight_lbs;
-- expect:  45 x3 | 78 x2 | 90 x1 | 116 x14 | 147 x17 | 165 x1
--         180 x8 | 214 x10 | 227 x7 | 234 x7 | 276 x7      = 77 total

-- ⚠️ total_ship_weight_lbs MUST still be NULL for all 77. If this returns
-- anything but 0, an estimate reached the freight-quote path and WWEX quotes
-- are now being built from a guess.
SELECT COUNT(*) AS estimates_leaked_into_freight_path
  FROM products
 WHERE brand = 'ER Vanities' AND total_ship_weight_lbs IS NOT NULL;
-- expect 0
