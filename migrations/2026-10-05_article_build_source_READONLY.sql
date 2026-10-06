-- ============================================================================
-- 2026-10-05_article_build_source_READONLY.sql
--
-- READ ONLY. Two SELECTs. No CREATE, no ALTER, no INSERT, no UPDATE.
--
-- THE LAST QUERY BEFORE I BUILD. Everything the article rewrite needs.
--
-- ─── HOW TO HAND IT BACK (don't paste it) ───────────────────────────────────
-- Query 1 returns ~160 rows with long image URLs. Pasting that into chat is
-- miserable and lossy. Instead, in phpMyAdmin:
--
--   run query 1  ->  "Export" under the results  ->  format CSV  ->  Go
--   save the file into the project folder as:   docs/briefs/article_source.csv
--
-- I read it from the folder directly. Query 2 is 0-40 short rows, so pasting
-- that one is fine.
--
-- ─── DESIGN NOTES ───────────────────────────────────────────────────────────
-- ONE ROW PER MODEL, not per SKU. The catalogue stores a separate SKU for
-- every finish x countertop permutation - the Chicago 30" alone is ~15 rows.
-- A listicle wants distinct models, so ROW_NUMBER() partitions by model and
-- keeps the highest-demand SKU of each. Without this, "25 ideas" would be the
-- same vanity 25 times in different stone tops.
--
-- EXISTS, NOT JOIN, FOR THE STYLE FILTER. style is multi-value; a JOIN would
-- multiply rows for any vanity holding several styles.
--
-- FLOATING IS MATCHED BY MODEL NAME, deliberately. The mount_type attribute
-- cannot answer it - see docs/briefs/MOUNT_TYPE_DEFECT.md. Allamari and
-- Marcello are the floating inventory per the owner. This is a one-off
-- diagnostic pick for writing content, NOT a filter that renders - the gate in
-- gate_guide_showcase.js forbids name-matching for product selection and that
-- still stands.
--
-- Every column is one the importer writes or inspirationController queries.
-- Checked against the INSERT list in importJamesMartinFeed.js:228-241.
-- ============================================================================


-- ─── 1. PRODUCTS PER GUIDE, WITH IMAGES AND CAPTION MATERIAL ───────────────

SELECT guide_slug, rn AS item_no, model, name, slug, brand, price, compare_price,
       color_family, width_in, cabinet_finish, primary_material,
       hardware_finish, countertop_finish, drawer_count, sink_count, image
FROM (
  SELECT
    g.guide_slug,
    p.model, p.name, p.slug, p.brand, p.price, p.compare_price,
    p.color_family, p.width_in,
    COALESCE(p.primary_image_url, pi.url) AS image,

    (SELECT value_text FROM product_attribute_values
      WHERE product_id = p.id AND attr_key = 'cabinet_finish'    LIMIT 1) AS cabinet_finish,
    (SELECT value_text FROM product_attribute_values
      WHERE product_id = p.id AND attr_key = 'primary_material'  LIMIT 1) AS primary_material,
    (SELECT value_text FROM product_attribute_values
      WHERE product_id = p.id AND attr_key = 'hardware_finish'   LIMIT 1) AS hardware_finish,
    (SELECT value_text FROM product_attribute_values
      WHERE product_id = p.id AND attr_key = 'countertop_finish' LIMIT 1) AS countertop_finish,
    (SELECT value_text FROM product_attribute_values
      WHERE product_id = p.id AND attr_key = 'drawer_count'      LIMIT 1) AS drawer_count,
    (SELECT value_text FROM product_attribute_values
      WHERE product_id = p.id AND attr_key = 'sink_count'        LIMIT 1) AS sink_count,

    ROW_NUMBER() OVER (
      PARTITION BY g.guide_slug, COALESCE(NULLIF(p.model,''), p.slug)
      ORDER BY COALESCE(p.demand_score,0) DESC, p.is_featured DESC, p.id ASC
    ) AS model_rank,

    ROW_NUMBER() OVER (
      PARTITION BY g.guide_slug
      ORDER BY COALESCE(p.demand_score,0) DESC, p.is_featured DESC, p.id ASC
    ) AS rn

  FROM products p
  LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
  JOIN (
        SELECT 'farmhouse'   AS guide_slug UNION ALL SELECT 'modern'
        UNION ALL SELECT 'white'           UNION ALL SELECT 'double-sink'
        UNION ALL SELECT '60-inch'         UNION ALL SELECT 'small'
        UNION ALL SELECT 'master'          UNION ALL SELECT 'floating'
      ) g
    ON (
         (g.guide_slug = 'farmhouse' AND EXISTS (
            SELECT 1 FROM product_attribute_values s WHERE s.product_id = p.id
              AND s.attr_key = 'style' AND s.value_text = 'Farmhouse'))
      OR (g.guide_slug = 'modern' AND EXISTS (
            SELECT 1 FROM product_attribute_values s WHERE s.product_id = p.id
              AND s.attr_key = 'style' AND s.value_text = 'Modern'))
      OR (g.guide_slug = 'white'       AND LOWER(p.color_family) LIKE '%white%')
      OR (g.guide_slug = 'double-sink' AND EXISTS (
            SELECT 1 FROM product_attribute_values s WHERE s.product_id = p.id
              AND s.attr_key = 'sink_count' AND s.value_text = '2'))
      OR (g.guide_slug = '60-inch' AND p.width_in BETWEEN 58 AND 62)
      OR (g.guide_slug = 'small'   AND p.width_in <= 36)
      OR (g.guide_slug = 'master'  AND p.width_in >= 60)
      OR (g.guide_slug = 'floating' AND (
            LOWER(p.name) LIKE '%allamari%' OR LOWER(p.name) LIKE '%marcello%'))
    )
  WHERE p.is_active = 1
    AND COALESCE(p.primary_image_url, pi.url) IS NOT NULL
    AND COALESCE(p.primary_image_url, pi.url) <> ''
    AND p.product_type NOT IN (
          'Mirror', 'Backsplash', 'Stone Top', 'Composite Top',
          'Bathroom Faucets', 'Kitchen Faucets', 'Bar Faucets',
          'Laundry Faucets', 'Shower Fixtures', 'Tub Fillers',
          'Knobs & Legs', 'Bathroom Accessories', 'Plumbing Accessories',
          'Countertop Unit', 'Metal Base', 'Drawer Unit', 'Bench')
) t
WHERE model_rank = 1   /* one row per model, not per finish/top permutation */
  AND rn <= 60         /* generous headroom; I'll pick 15-25 per guide */
ORDER BY guide_slug, rn;


-- ─── 2. BRITISH SPELLINGS IN THE ARTICLE BODIES ────────────────────────────
-- The only spelling target in scope. Code and config are explicitly excluded:
-- colorFamilies.js holds 'Grey' as a deliberate vendor-feed alias and must not
-- be touched. Paste this one - it is short.

SELECT slug, word, hits FROM (
  SELECT p.slug, w.word,
         (CHAR_LENGTH(LOWER(p.content))
          - CHAR_LENGTH(REPLACE(LOWER(p.content), w.word, '')))
         / CHAR_LENGTH(w.word) AS hits
  FROM pages p
  CROSS JOIN (
    SELECT 'colour'      AS word UNION ALL SELECT 'coloured'
    UNION ALL SELECT 'centre'    UNION ALL SELECT 'centred'
    UNION ALL SELECT 'grey'      UNION ALL SELECT 'organise'
    UNION ALL SELECT 'organised' UNION ALL SELECT 'recognise'
    UNION ALL SELECT 'customise' UNION ALL SELECT 'personalise'
    UNION ALL SELECT 'optimise'  UNION ALL SELECT 'minimise'
    UNION ALL SELECT 'maximise'  UNION ALL SELECT 'analyse'
    UNION ALL SELECT 'catalogue' UNION ALL SELECT 'favourite'
    UNION ALL SELECT 'behaviour' UNION ALL SELECT 'honour'
    UNION ALL SELECT 'labour'    UNION ALL SELECT 'neighbour'
    UNION ALL SELECT 'metre'     UNION ALL SELECT 'litre'
    UNION ALL SELECT 'aluminium' UNION ALL SELECT 'enquire'
    UNION ALL SELECT 'enquiry'   UNION ALL SELECT 'whilst'
    UNION ALL SELECT 'amongst'   UNION ALL SELECT 'speciality'
    UNION ALL SELECT 'storey'    UNION ALL SELECT 'travelling'
    UNION ALL SELECT 'fulfilment' UNION ALL SELECT 'instalment'
    UNION ALL SELECT 'licence'   UNION ALL SELECT 'practise'
    UNION ALL SELECT 'defence'   UNION ALL SELECT 'mould'
    UNION ALL SELECT 'draught'   UNION ALL SELECT 'kerb'
    UNION ALL SELECT 'tyre'      UNION ALL SELECT 'jewellery'
  ) w
  WHERE p.page_type = 'inspiration'
) t
WHERE hits > 0
ORDER BY slug, hits DESC, word;
