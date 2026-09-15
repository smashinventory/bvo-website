-- ─────────────────────────────────────────────────────────────────────
--  Configuration facet for Bathroom Faucets (Widespread / Single Hole /
--  Center Set / Vessel).
--
--  NO CODE CHANGES NEEDED FOR THE FACET ITSELF. The collection sidebar
--  already builds checkbox groups from attribute_definitions, reads the
--  option list from product_attribute_values via
--  Product.getAllAttributeValues(), and filters with one EXISTS subquery
--  per attr_key in Product.findByCategory(). All three layers exist. What
--  has been missing is the data. This migration supplies it.
--
--  WHY THE NAME IS THE SOURCE
--  Huntington Brass encodes drilling in the product name and nowhere else
--  structured:
--
--      Joy Widespread — Chrome          -> Widespread
--      Joy Single Control — Chrome      -> Single Hole
--      Sevaun Center Set — Matte Black  -> Center Set
--      Euro Vessel Filler — Chrome      -> Vessel
--
--  These are the same four buckets FAUCET_DRILLING_SQL in
--  bundleController uses, and deliberately so: the collection page and
--  step 4 of the bundle builder must never disagree about what a faucet
--  fits. The push script gates that the token lists match.
--
--  BRANCH ORDER IS LOAD-BEARING. Widespread is tested first so a future
--  "X Lavatory Widespread" is not caught by the Lavatory test. 'Lavatory'
--  maps to Single Hole because HB's own copy for the only Lavatory model
--  reads "Single handle, single hole lavatory faucet".
--
--  KITCHEN FAUCETS ARE DELIBERATELY NOT TAGGED
--  Their names carry no drilling at all, and their descriptions say most
--  units fit BOTH: "Can be mounted on a standard single hole sink, three
--  hole sink or custom drilled counter top." Inferring a single value from
--  that would be inventing data. The last query below prints the 84
--  kitchen SKUs as a worklist to tag by hand.
--
--  Untagged products are NOT hidden. They appear normally in the grid and
--  are simply absent when a Configuration value is selected.
--
--  SAFETY
--  - INSERT IGNORE on the definition; re-running is a no-op.
--  - Values scoped to brand + product_type + category. No other row is
--    touched.
--  - ON DUPLICATE KEY UPDATE on the values (PK is product_id, attr_key),
--    so a re-run refreshes rather than erroring, and hand edits to OTHER
--    attributes are untouched.
-- ─────────────────────────────────────────────────────────────────────

START TRANSACTION;

-- ── 1. The attribute definition ────────────────────────────────────
-- sort_order 2 puts Configuration directly under Brand/Type.
INSERT IGNORE INTO attribute_definitions
  (category_id, attr_key, display_name, filter_type, sort_order)
SELECT c.id, 'faucet_config', 'Configuration', 'checkbox', 2
  FROM categories c
 WHERE c.slug = 'faucets';

SELECT 'DEFINITION' AS phase, id, category_id, attr_key, display_name, filter_type, sort_order
  FROM attribute_definitions
 WHERE attr_key = 'faucet_config';

-- ── 2. Values for Bathroom Faucets ─────────────────────────────────
INSERT INTO product_attribute_values (product_id, attr_key, value_text)
SELECT p.id,
       'faucet_config',
       CASE
         WHEN p.name LIKE '%Widespread%'                             THEN 'Widespread'
         WHEN p.name LIKE '%Single Control%'
           OR p.name LIKE '%Single Hole%'
           OR p.name LIKE '%Single-Hole%'
           OR p.name LIKE '%Lavatory%'                               THEN 'Single Hole'
         WHEN p.name LIKE '%Center Set%' OR p.name LIKE '%Centerset%' THEN 'Center Set'
         WHEN p.name LIKE '%Vessel%'                                 THEN 'Vessel'
       END AS cfg
  FROM products p
  JOIN categories c ON c.id = p.category_id
 WHERE c.slug         = 'faucets'
   AND p.product_type = 'Bathroom Faucets'
   AND p.is_active    = 1
   AND (
         p.name LIKE '%Widespread%'     OR p.name LIKE '%Single Control%'
      OR p.name LIKE '%Single Hole%'    OR p.name LIKE '%Single-Hole%'
      OR p.name LIKE '%Lavatory%'       OR p.name LIKE '%Center Set%'
      OR p.name LIKE '%Centerset%'      OR p.name LIKE '%Vessel%'
       )
ON DUPLICATE KEY UPDATE value_text = VALUES(value_text);

-- ── Verify ─────────────────────────────────────────────────────────
-- Expect 149 total across four values, and untagged = 0.
SELECT 'TAGGED' AS phase, pav.value_text, COUNT(*) AS skus
  FROM product_attribute_values pav
  JOIN products p ON p.id = pav.product_id
 WHERE pav.attr_key = 'faucet_config'
 GROUP BY pav.value_text
 ORDER BY skus DESC;

SELECT 'UNTAGGED BATHROOM FAUCETS' AS phase, COUNT(*) AS n
  FROM products p
  JOIN categories c ON c.id = p.category_id
 WHERE c.slug = 'faucets' AND p.product_type = 'Bathroom Faucets' AND p.is_active = 1
   AND NOT EXISTS (SELECT 1 FROM product_attribute_values v
                    WHERE v.product_id = p.id AND v.attr_key = 'faucet_config');

-- ── 3. Kitchen worklist — tag these by hand ────────────────────────
-- One row per kitchen MODEL, not per SKU, so this is 22 decisions rather
-- than 84. Whatever you choose for a model applies to all its finishes.
SELECT p.model,
       COUNT(*) AS skus,
       MIN(p.sku) AS example_sku,
       CASE WHEN MAX(p.long_desc LIKE '%single hole%') = 1
             AND MAX(p.long_desc LIKE '%three hole%')  = 1 THEN 'copy says BOTH'
            WHEN MAX(p.long_desc LIKE '%single hole%') = 1 THEN 'copy says single hole'
            WHEN MAX(p.long_desc LIKE '%3-hole%')      = 1
              OR MAX(p.long_desc LIKE '%three hole%')  = 1 THEN 'copy says 3-hole'
            ELSE 'copy says nothing'
       END AS hint
  FROM products p
  JOIN categories c ON c.id = p.category_id
 WHERE c.slug = 'faucets' AND p.product_type = 'Kitchen Faucets' AND p.is_active = 1
 GROUP BY p.model
 ORDER BY p.model;

COMMIT;
