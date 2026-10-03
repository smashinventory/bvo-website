-- ═══════════════════════════════════════════════════════════════════════
-- 2026-10-03_model_facts_v2.sql
--
-- READ-ONLY. Supersedes 2026-10-02_model_facts.sql.
-- Set "Number of rows" to 100 before running query B, or you get 25 of 44.
--
-- ─── WHY THERE IS A v2 ─────────────────────────────────────────────────
-- v1 computed its facts over every row in category 1, and category 1 is
-- not all vanities. The diagnostic on 2026-10-03 found:
--
--   Boston    42 of 42 products have product_type = NULL
--             1.10" to 63", $172-$1,922, Stainless Steel,
--             finishes Brushed Nickel / Matte Black / Radiant Gold
--
-- That is hardware, not a vanity line. v1 would have produced the intro
-- "Boston vanities from 1 inch wide", on a live page.
--
--   Columbia  20 NULL rows alongside 42 real vanities. The NULL rows drag
--             the stated range from 31.5"-72.5" / $708-$4,773 down to
--             13.78"-72.2" / $93.72-$4,773. Both numbers are true of the
--             query; only one is true of the product line.
--
--   Bellshire 120" and De Soto 120.5" are REAL double-sink widths, not
--             errors. 22 and 0 NULL rows respectively. Both keep their
--             pages.
--
-- So: product_type IS NULL means "not a vanity" in this catalogue, and
-- every fact below excludes it. Query A finds every model of Boston's
-- kind, rather than assuming Boston is the only one — which is the part
-- v1 got wrong by not asking.
-- ═══════════════════════════════════════════════════════════════════════

SET SESSION group_concat_max_len = 32768;


-- ───────────────────────────────────────────────────────────────────────
-- A. MODELS THAT ARE NOT VANITY LINES
--    Every row has product_type NULL, so there is no single-sink,
--    double-sink or cabinet-only product anywhere in the model. These get
--    NO model page. Boston should appear. Anything else that appears is a
--    find.
-- ───────────────────────────────────────────────────────────────────────
SELECT
  p.brand,
  p.model,
  COUNT(*)                                        AS products,
  SUM(p.product_type IS NULL)                     AS null_type,
  CONCAT(CAST(MIN(p.width_in) AS SIGNED), '"-',
         CAST(MAX(p.width_in) AS SIGNED), '"')    AS width_range,
  CONCAT('$', FORMAT(MIN(p.price), 0), '-$', FORMAT(MAX(p.price), 0))
                                                  AS price_range,
  GROUP_CONCAT(DISTINCT p.color ORDER BY p.color SEPARATOR ', ')
                                                  AS finishes
FROM products p
WHERE p.is_active = 1 AND p.category_id = 1
  AND p.model IS NOT NULL AND p.model <> ''
GROUP BY p.brand, p.model
HAVING SUM(p.product_type IS NOT NULL) = 0
ORDER BY products DESC;


-- ───────────────────────────────────────────────────────────────────────
-- A2. HOW MUCH ACCESSORY NOISE EACH REAL MODEL CARRIES
--     Models that keep their page, with the count of NULL-type rows that
--     v1 was folding into their size and price ranges. Mostly a sanity
--     check that excluding NULL does not empty anything out.
-- ───────────────────────────────────────────────────────────────────────
SELECT
  p.brand,
  p.model,
  COUNT(*)                                        AS all_rows,
  SUM(p.product_type IS NULL)                     AS excluded_null,
  SUM(p.product_type IS NOT NULL)                 AS real_vanities
FROM products p
WHERE p.is_active = 1 AND p.category_id = 1
  AND p.model IS NOT NULL AND p.model <> ''
GROUP BY p.brand, p.model
HAVING SUM(p.product_type IS NULL) > 0
   AND SUM(p.product_type IS NOT NULL) > 0
ORDER BY excluded_null DESC;


-- ───────────────────────────────────────────────────────────────────────
-- B. THE FACTS, over vanities only.    ← SET ROWS TO 100 FIRST
--
--    Everything here is NOT NULL product_type, so the ranges describe the
--    product line rather than the category.
--
--    `configs` is new and is the fact most worth having: whether a model
--    comes single, double, cabinet-only, or all three. "Brittany runs
--    26-84 inches, single and double, cabinet-only or with a top" is a
--    sentence. "Brittany is available in many options" is not.
--
--    primary_material and style both live in product_attribute_values,
--    not on products — v1 nearly selected p.primary_material, which does
--    not exist. Checked against homeController.js:92 and :107.
-- ───────────────────────────────────────────────────────────────────────
SELECT
  p.brand,
  p.model,
  COUNT(*)                                                  AS products,

  CONCAT(CAST(MIN(p.width_in) AS SIGNED), '"-',
         CAST(MAX(p.width_in) AS SIGNED), '"')              AS width_range,
  COUNT(DISTINCT CAST(p.width_in AS SIGNED))                AS width_count,

  -- single / double / cabinet-only, shortened so the cell is readable
  GROUP_CONCAT(DISTINCT
    REPLACE(REPLACE(REPLACE(p.product_type,
      'Single Sink ', 'S:'), 'Double Sink ', 'D:'), ' With Top', '+top')
    ORDER BY p.product_type SEPARATOR ' / ')                AS configs,

  COUNT(DISTINCT p.color_family)                            AS fam_n,
  GROUP_CONCAT(DISTINCT p.color_family ORDER BY p.color_family SEPARATOR ',')
                                                            AS families,
  GROUP_CONCAT(DISTINCT p.color ORDER BY p.color SEPARATOR ', ')
                                                            AS finishes,

  CONCAT('$', FORMAT(MIN(p.price), 0), '-$', FORMAT(MAX(p.price), 0))
                                                            AS price_range,

  -- Reported verbatim, never paraphrased. A wrong solid-wood claim is
  -- legal exposure (src/utils/cardBadge.js). Note the source data has at
  -- least one typo — Amberly reads "Rubber Wood | Ruber Wood" — so these
  -- get read before they get written, not pasted.
  (SELECT GROUP_CONCAT(DISTINCT pav.value_text ORDER BY pav.value_text SEPARATOR ' | ')
     FROM product_attribute_values pav
     JOIN products p2 ON p2.id = pav.product_id
    WHERE pav.attr_key = 'primary_material'
      AND p2.model = p.model AND p2.brand = p.brand
      AND p2.is_active = 1 AND p2.category_id = 1
      AND p2.product_type IS NOT NULL)                      AS materials,

  (SELECT GROUP_CONCAT(DISTINCT pav.value_text ORDER BY pav.value_text SEPARATOR ', ')
     FROM product_attribute_values pav
     JOIN products p2 ON p2.id = pav.product_id
    WHERE pav.attr_key = 'style'
      AND p2.model = p.model AND p2.brand = p.brand
      AND p2.is_active = 1 AND p2.category_id = 1
      AND p2.product_type IS NOT NULL)                      AS styles

FROM products p
WHERE p.is_active     = 1
  AND p.category_id   = 1
  AND p.model IS NOT NULL AND p.model <> ''
  AND p.product_type IS NOT NULL          -- ← the v1 fix
GROUP BY p.brand, p.model
ORDER BY p.brand, products DESC;
--       ^ brand first, so the ER Vanities models are not all in the back
--         half of the result where v1 left them unread.
