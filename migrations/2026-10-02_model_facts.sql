-- ═══════════════════════════════════════════════════════════════════════
-- 2026-10-02_model_facts.sql
--
-- READ-ONLY. One query. Run in phpMyAdmin and paste the whole result back.
--
-- PURPOSE
-- Facts for all 45 model pages, so the intro paragraph on each one says
-- something TRUE and SPECIFIC about that model rather than a reshuffled
-- template. "Brittany is available in a range of sizes and finishes" is
-- worth nothing; "Brittany runs 24 to 72 inches across seven finishes,
-- single and double sink, with a choice of quartz or marble top" is a page.
--
-- This is the same discipline as src/config/filterLandingPages.js, where
-- every intro was written from counted products rather than invented.
--
-- WHY ONE WIDE QUERY RATHER THAN SEVEN
-- So the output pastes back in one block. GROUP_CONCAT is capped by
-- group_concat_max_len (default 1024) — the SET below raises it for this
-- session only, which is a session variable, not a server change, and
-- resets when phpMyAdmin's connection closes.
--
-- Style lives in the EAV table (product_attribute_values, attr_key =
-- 'style'), not on products, which is why it needs its own subquery.
-- ═══════════════════════════════════════════════════════════════════════

SET SESSION group_concat_max_len = 32768;

SELECT
  p.brand,
  p.model,
  COUNT(*)                                                  AS products,

  -- Size span. The headline fact for a vanity line.
  CONCAT(
    CAST(MIN(p.width_in) AS SIGNED), '"-',
    CAST(MAX(p.width_in) AS SIGNED), '"'
  )                                                         AS width_range,
  COUNT(DISTINCT CAST(p.width_in AS SIGNED))                AS width_count,

  -- Finishes, by family and by the specific colour name customers see.
  COUNT(DISTINCT p.color_family)                            AS colour_families,
  GROUP_CONCAT(DISTINCT p.color_family ORDER BY p.color_family SEPARATOR ', ')
                                                            AS families,
  GROUP_CONCAT(DISTINCT p.color ORDER BY p.color SEPARATOR ', ')
                                                            AS finishes,

  -- What the line actually consists of: cabinet only, with top, double, etc.
  GROUP_CONCAT(DISTINCT p.product_type ORDER BY p.product_type SEPARATOR ', ')
                                                            AS product_types,

  -- Price span, for "from $X" copy. Rounded — these are display figures.
  CONCAT('$', FORMAT(MIN(p.price), 0), '-$', FORMAT(MAX(p.price), 0))
                                                            AS price_range,

  -- Construction. Never guessed: a mistaken solid-wood claim is legal
  -- exposure (see src/utils/cardBadge.js). Reported verbatim or not at all.
  --
  -- primary_material is NOT a products column — it lives in the EAV table
  -- under attr_key = 'primary_material' (src/controllers/homeController.js:92
  -- reads it that way). The first draft of this query selected
  -- p.primary_material and would simply have errored. Checked, not assumed.
  (SELECT GROUP_CONCAT(DISTINCT pav.value_text ORDER BY pav.value_text SEPARATOR ' | ')
     FROM product_attribute_values pav
     JOIN products p2 ON p2.id = pav.product_id
    WHERE pav.attr_key = 'primary_material'
      AND p2.model = p.model AND p2.brand = p.brand
      AND p2.is_active = 1 AND p2.category_id = 1)          AS materials,

  -- Style, same table, different key.
  (SELECT GROUP_CONCAT(DISTINCT pav.value_text ORDER BY pav.value_text SEPARATOR ', ')
     FROM product_attribute_values pav
     JOIN products p2 ON p2.id = pav.product_id
    WHERE pav.attr_key = 'style'
      AND p2.model = p.model AND p2.brand = p.brand
      AND p2.is_active = 1 AND p2.category_id = 1)          AS styles,

  -- Does the line have photography? primary_image_url is the real column;
  -- `primary_image` is an alias controllers build with COALESCE over
  -- product_images (homeController:81).
  SUM(CASE WHEN p.primary_image_url IS NOT NULL AND p.primary_image_url <> ''
           THEN 1 ELSE 0 END)                               AS with_image

FROM products p
WHERE p.is_active   = 1
  AND p.category_id = 1
  AND p.model IS NOT NULL AND p.model <> ''
GROUP BY p.brand, p.model
ORDER BY products DESC;


-- ───────────────────────────────────────────────────────────────────────
-- If any column name above is wrong for this schema, the whole query
-- errors rather than returning partial data. These two show what exists:
-- ───────────────────────────────────────────────────────────────────────
-- SHOW COLUMNS FROM products;
-- SELECT DISTINCT attr_key FROM product_attribute_values ORDER BY attr_key;
--
-- The second one is worth running regardless — it lists every attribute
-- the catalogue actually carries. If there is a 'sink_count',
-- 'mount_type', 'top_material' or similar in there, say so and the intros
-- can use it. Right now this query only asks for 'style' and
-- 'primary_material' because those are the two the application code
-- reads, which is not the same as the two that exist.
