-- ════════════════════════════════════════════════════════════════════
--  019 — Radius Cut depth correction (interim, pending JM feed fix)
--
--  JM's feed reports depth 23.5" on five Radius Cut tops and on 46 combos
--  built from RC tops. The correct value is 21.5".
--
--  Evidence (JMV_CATALOGUE_STRUCTURE.md §2.3):
--    1. The 36" 060-series widespread spec sheet reads 21 1/2" [546mm].
--    2. JM publishes one drawing per size + configuration, shared across
--       finishes. Each wrong SFR SKU shares its drawing with a VSL or WZ
--       SKU already recorded at 21.5". One drawing, one depth.
--    3. RC tops are only ever paired with Gracyn, Allamari and Lucian —
--       cabinets at 21.38-21.5". A 23.5" RC top has nothing to sit on.
--
--  INVARIANT: if a SKU is RC (060 prefix), its depth is 21.5".
--
--  Two distinct defects are corrected here:
--    A.  5 RC tops              — source error
--    B. 30 *SFR combos          — inherited from A
--    C. 16 Gracyn W/F combos    — INDEPENDENT; their tops are already
--                                 correct at 21.5", only the combo is wrong.
--                                 Fixing A would not have fixed these.
--
--  Reported to James Martin 2026-09-11. This migration is the interim
--  correction. The durable guard is in importJamesMartinFeed.js, which
--  re-applies the rule on every import — without it the next feed run
--  silently restores 23.5".
--
--  Idempotent. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════

-- Rows this will touch, BEFORE (expect 51):
SELECT COUNT(*) AS will_change
  FROM product_attribute_values v
  JOIN products p ON p.id = v.product_id
 WHERE v.attr_key = 'depth_in'
   AND p.brand = 'James Martin Vanities'
   AND v.value_num <> 21.5
   AND ( p.sku LIKE '060-%'
      OR EXISTS (SELECT 1 FROM product_components pc
                  WHERE pc.parent_sku = p.sku
                    AND pc.component_role = 'top'
                    AND pc.component_sku LIKE '060-%') );

UPDATE product_attribute_values v
  JOIN products p ON p.id = v.product_id
   SET v.value_num  = 21.5,
       v.value_text = '21.5'
 WHERE v.attr_key = 'depth_in'
   AND p.brand = 'James Martin Vanities'
   AND v.value_num <> 21.5
   AND ( p.sku LIKE '060-%'
      OR EXISTS (SELECT 1 FROM product_components pc
                  WHERE pc.parent_sku = p.sku
                    AND pc.component_role = 'top'
                    AND pc.component_sku LIKE '060-%') );

-- Verify: must return 0 rows.
SELECT p.sku, v.value_num AS still_wrong
  FROM product_attribute_values v
  JOIN products p ON p.id = v.product_id
 WHERE v.attr_key = 'depth_in'
   AND p.brand = 'James Martin Vanities'
   AND v.value_num <> 21.5
   AND ( p.sku LIKE '060-%'
      OR EXISTS (SELECT 1 FROM product_components pc
                  WHERE pc.parent_sku = p.sku
                    AND pc.component_role = 'top'
                    AND pc.component_sku LIKE '060-%') );

-- Confirm the corrected population (expect 188 rows, all 21.5):
SELECT v.value_num AS depth, COUNT(*) AS n
  FROM product_attribute_values v
  JOIN products p ON p.id = v.product_id
 WHERE v.attr_key = 'depth_in'
   AND p.brand = 'James Martin Vanities'
   AND ( p.sku LIKE '060-%'
      OR EXISTS (SELECT 1 FROM product_components pc
                  WHERE pc.parent_sku = p.sku
                    AND pc.component_role = 'top'
                    AND pc.component_sku LIKE '060-%') )
 GROUP BY v.value_num;
