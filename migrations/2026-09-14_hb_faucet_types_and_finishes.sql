-- ─────────────────────────────────────────────────────────────────────
--  Huntington Brass, part 2: finish swatch colours + retype 5 faucets.
--
--  Follows 2026-09-14_hb_backfill_model.sql. Run that one first.
--
--  ── A. color_family ────────────────────────────────────────────────
--  The import wrote `color` ("PVD Satin Brass") but never `color_family`.
--  swatchHtml() in bundle-builder.ejs reads:
--
--      var hex = FAMILY_HEX[sku.color_family || ''] || '#C9B89A';
--
--  so every HB swatch rendered as that fallback tan — two identical beige
--  circles under a faucet labelled "Chrome". Same silent-omission shape as
--  the missing `model` column.
--
--  The family keys below are not invented here. They come from
--  src/config/colorFamilies.js, which is what James Martin mirrors and
--  faucets already use, so an HB Chrome chip and a JM Chrome chip are the
--  same grey:
--
--      chrome       #C0C0C0      nickel   #8C8680
--      gold         #B5924C      matte_black #1C1C1C
--
--  Verified against normalize(finish, 'metal') over all 768 rows: 752 map,
--  16 are "No finish" and correctly stay NULL. Those 16 are drain and
--  adapter parts that have no finish to show.
--
--  ── B. product_type for 5 faucets ──────────────────────────────────
--  HB files these under Category "Bathroom Faucets", so the import typed
--  them that way. Their own descriptions disagree:
--
--      W9110501     HB Pro Bar Faucet      "addition to the bar"
--      W9120601-10  Isabelle Bar Faucet    "dual handle bar faucet"
--      W9120629-10  Isabelle Bar Faucet    "dual handle bar faucet"
--      W9510501-30  HB Pro Laundry         "addition to the laundry room"
--      W9510501-40  HB Pro Laundry         "addition to the laundry room"
--
--  They stay in the `faucets` category — they are faucets and should be
--  browsable. Only the type changes, which takes them out of step 4 of the
--  bundle builder and gives them their own facet on the collection page.
--
--  The importer carries a matching PRODUCT_TYPE_OVERRIDE_BY_SKU so the next
--  import does not put them back. Data fix plus importer fix, or neither.
--
--  SAFETY
--  - Both UPDATEs are scoped to brand = 'Huntington Brass'.
--  - A is guarded on color_family being empty, so it is idempotent and
--    will not overwrite a hand-corrected family.
--  - B is keyed on five explicit SKUs. Not a LIKE on the name: "Bar" and
--    "Laundry" appear in kitchen and utility products that are correctly
--    typed already, and a name match would sweep those up too.
-- ─────────────────────────────────────────────────────────────────────

START TRANSACTION;

SELECT 'BEFORE' AS phase,
       SUM(color_family IS NULL OR color_family = '')          AS no_family,
       SUM(product_type = 'Bathroom Faucets')                  AS bathroom_faucets
  FROM products
 WHERE brand = 'Huntington Brass';

-- ── A. Finish -> swatch family ─────────────────────────────────────
UPDATE products
   SET color_family = CASE
         WHEN color = 'Chrome'                              THEN 'chrome'
         WHEN color IN ('Satin Nickel', 'PVD Satin Nickel') THEN 'nickel'
         WHEN color = 'PVD Satin Brass'                     THEN 'gold'
         WHEN color = 'Matte Black'                         THEN 'matte_black'
         ELSE color_family        -- 'No finish' and anything unforeseen
       END
 WHERE brand = 'Huntington Brass'
   AND (color_family IS NULL OR color_family = '');

-- ── B. Bar and laundry faucets are not bathroom faucets ────────────
UPDATE products
   SET product_type = CASE sku
         WHEN 'W9110501'    THEN 'Bar Faucets'
         WHEN 'W9120601-10' THEN 'Bar Faucets'
         WHEN 'W9120629-10' THEN 'Bar Faucets'
         WHEN 'W9510501-30' THEN 'Laundry Faucets'
         WHEN 'W9510501-40' THEN 'Laundry Faucets'
       END
 WHERE brand = 'Huntington Brass'
   AND sku IN ('W9110501','W9120601-10','W9120629-10','W9510501-30','W9510501-40');

-- ── Verify ─────────────────────────────────────────────────────────
-- no_family should be 16 (the "No finish" parts), bathroom_faucets 149.
SELECT 'AFTER' AS phase,
       SUM(color_family IS NULL OR color_family = '')          AS no_family,
       SUM(product_type = 'Bathroom Faucets')                  AS bathroom_faucets,
       SUM(product_type IN ('Bar Faucets','Laundry Faucets'))  AS retyped
  FROM products
 WHERE brand = 'Huntington Brass';

-- Every finish should now carry a family. 'No finish' is the only NULL.
SELECT color, color_family, COUNT(*) AS skus
  FROM products
 WHERE brand = 'Huntington Brass'
 GROUP BY color, color_family
 ORDER BY skus DESC;

-- What step 4 will offer an 8" widespread top: 13 models, no bar,
-- no laundry, no center set.
SELECT model,
       COUNT(*) AS finishes,
       GROUP_CONCAT(DISTINCT color_family ORDER BY color_family) AS families
  FROM products
 WHERE brand        = 'Huntington Brass'
   AND product_type = 'Bathroom Faucets'
   AND is_active    = 1
   AND name LIKE '%Widespread%'
 GROUP BY model
 ORDER BY model;

COMMIT;
