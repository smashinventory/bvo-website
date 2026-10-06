-- ============================================================================
-- 2026-10-05_article_source_READONLY.sql
--
-- READ ONLY. Three SELECTs. No CREATE, no ALTER, no INSERT, no UPDATE.
--
-- ─── WHAT THIS REPLACES ─────────────────────────────────────────────────────
-- 2026-10-05_guide_inventory_READONLY.sql asked for per-guide product COUNTS,
-- on the assumption the listicle images would come from the showcase query
-- (raising its LIMIT 4 and adding a numbered renderer — code).
--
-- Scope is now content only: the images go in the article body HTML as <img>
-- tags, so nothing in src/ or views/ changes and every edit is an UPDATE on
-- pages.content. That makes counts the wrong output. I need the actual rows —
-- name, slug, price, image URL — because those are what get written into the
-- article.
--
-- Run THIS instead. Only query 1 of the old script is still worth keeping
-- (the ten guides and their sizes), and it has already come back.
--
-- Every column named below is one inspirationController.js queries in
-- production today. None is a guess.
--
-- HOW TO RUN: phpMyAdmin shows only the FIRST result set when statements are
-- run together. Run the three blocks ONE AT A TIME and paste each result.
-- ============================================================================


-- ─── 1. WHAT ATTRIBUTES ACTUALLY EXIST ─────────────────────────────────────
-- ⚠️ WHY THIS IS FIRST. _slugToProductMatch() has no rule for
-- "floating-bathroom-vanity-ideas" — no colour family, no width, no sink
-- count, and _slugToStyle() returns null for it. So that guide currently
-- shows generic top-demand vanities rather than floating ones.
--
-- There may well be a mount-type attribute that would fix it. I am NOT going
-- to conclude it doesn't exist from grepping the code — that is exactly the
-- mistake I made earlier today with `style`, where I grepped for a column on
-- products, found none, and wrongly asserted the attribute was absent. The
-- owner corrected it with a screenshot.
--
-- So: list every key in the table and let the data answer. This also shows
-- whether anything useful exists for "master", "small" and "luxury" beyond
-- the width proxies the matcher uses now.

SELECT
  pav.attr_key,
  COUNT(*)                          AS total_rows,
  COUNT(DISTINCT pav.product_id)    AS products,
  COUNT(DISTINCT pav.value_text)    AS distinct_values,
  GROUP_CONCAT(DISTINCT pav.value_text ORDER BY pav.value_text SEPARATOR ' | ') AS values_list
FROM product_attribute_values pav
JOIN products p ON p.id = pav.product_id AND p.is_active = 1
GROUP BY pav.attr_key
ORDER BY products DESC;


-- ─── 2. THE ACTUAL PRODUCTS PER GUIDE, WITH IMAGE URLS ─────────────────────
-- One block per "ideas" guide, matched exactly the way the live showcase
-- matches, then UNION'd. Up to 30 per guide so I can see the real ceiling and
-- pick the best for each numbered item.
--
-- The guide_slug column is a literal label, not a join — these conditions
-- mirror _slugToProductMatch() rather than calling it, because this is SQL.
-- If a guide returns 6 rows, a 25-item listicle is not available for it and
-- the format for that guide changes. That is the whole point of running this.
--
-- "floating" is deliberately left as an unfiltered block for now: the matcher
-- has no rule for it, so this shows what it is currently serving. Query 1
-- decides whether a real filter is available.
--
-- image is COALESCE(primary_image_url, product_images.is_primary) — the same
-- expression the showcase uses, so what comes back is what would render.

SELECT guide_slug, id, slug, name, brand, price, color_family, width_in, image
FROM (
  SELECT 'farmhouse' AS guide_slug, p.id, p.slug, p.name, p.brand, p.price,
         p.color_family, p.width_in,
         COALESCE(p.primary_image_url, pi.url) AS image,
         COALESCE(p.demand_score, 0) AS ds, p.is_featured AS feat
  FROM products p
  LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
  JOIN product_attribute_values pav ON pav.product_id = p.id
       AND pav.attr_key = 'style' AND pav.value_text = 'Farmhouse'
  WHERE p.is_active = 1

  UNION ALL
  SELECT 'modern', p.id, p.slug, p.name, p.brand, p.price,
         p.color_family, p.width_in,
         COALESCE(p.primary_image_url, pi.url),
         COALESCE(p.demand_score, 0), p.is_featured
  FROM products p
  LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
  JOIN product_attribute_values pav ON pav.product_id = p.id
       AND pav.attr_key = 'style' AND pav.value_text = 'Modern'
  WHERE p.is_active = 1

  UNION ALL
  SELECT 'white', p.id, p.slug, p.name, p.brand, p.price,
         p.color_family, p.width_in,
         COALESCE(p.primary_image_url, pi.url),
         COALESCE(p.demand_score, 0), p.is_featured
  FROM products p
  LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
  WHERE p.is_active = 1 AND LOWER(p.color_family) LIKE '%white%'

  UNION ALL
  SELECT 'double-sink', p.id, p.slug, p.name, p.brand, p.price,
         p.color_family, p.width_in,
         COALESCE(p.primary_image_url, pi.url),
         COALESCE(p.demand_score, 0), p.is_featured
  FROM products p
  LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
  JOIN product_attribute_values pav ON pav.product_id = p.id
       AND pav.attr_key = 'sink_count' AND pav.value_text = '2'
  WHERE p.is_active = 1

  UNION ALL
  SELECT '60-inch', p.id, p.slug, p.name, p.brand, p.price,
         p.color_family, p.width_in,
         COALESCE(p.primary_image_url, pi.url),
         COALESCE(p.demand_score, 0), p.is_featured
  FROM products p
  LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
  WHERE p.is_active = 1 AND p.width_in BETWEEN 58 AND 62

  UNION ALL
  SELECT 'small', p.id, p.slug, p.name, p.brand, p.price,
         p.color_family, p.width_in,
         COALESCE(p.primary_image_url, pi.url),
         COALESCE(p.demand_score, 0), p.is_featured
  FROM products p
  LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
  WHERE p.is_active = 1 AND p.width_in <= 36

  UNION ALL
  SELECT 'master', p.id, p.slug, p.name, p.brand, p.price,
         p.color_family, p.width_in,
         COALESCE(p.primary_image_url, pi.url),
         COALESCE(p.demand_score, 0), p.is_featured
  FROM products p
  LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
  WHERE p.is_active = 1 AND p.width_in >= 60

  UNION ALL
  SELECT 'floating (NO FILTER - see query 1)', p.id, p.slug, p.name, p.brand,
         p.price, p.color_family, p.width_in,
         COALESCE(p.primary_image_url, pi.url),
         COALESCE(p.demand_score, 0), p.is_featured
  FROM products p
  LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
  WHERE p.is_active = 1
) u
WHERE image IS NOT NULL AND image <> ''
ORDER BY guide_slug, ds DESC, feat DESC, id ASC;
-- If this returns too many rows to paste comfortably, add:
--   LIMIT 240
-- or run it once per guide by uncommenting a single block.


-- ─── 3. BRITISH SPELLINGS IN THE ARTICLE BODIES ────────────────────────────
-- The only spelling target in scope. I wrote these ten articles and have been
-- writing "colour" and "centre" all session, so the bodies get checked rather
-- than assumed clean. A guide returning no rows is clean.
--
-- Counted against the stored HTML, which is what the crawler sees. Code and
-- config are explicitly NOT in scope - colorFamilies.js holds 'Grey' as a
-- deliberate vendor-feed alias and must not be touched.

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
