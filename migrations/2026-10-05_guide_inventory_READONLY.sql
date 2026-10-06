-- ============================================================================
-- 2026-10-05_guide_inventory_READONLY.sql
--
-- READ ONLY. Six SELECTs. No CREATE, no ALTER, no INSERT, no UPDATE.
-- Nothing in this file changes a table, a row, or a column.
--
-- ─── WHY THIS RUNS BEFORE ANY CODE IS WRITTEN ───────────────────────────────
-- The agreed plan turns the style/colour/config guides into numbered image
-- listicles, because that is the format winning those SERPs. A listicle needs
-- 15-25 numbered items, each one a product image plus a caption.
--
-- I do not know how many products the catalogue actually holds per guide.
-- The showcase query in inspirationController.js is LIMIT 4, so four has
-- always been enough and the real counts have never been needed. If the
-- Farmhouse style holds 8 vanities, "25 Farmhouse Ideas" cannot be built from
-- products and the format decision changes.
--
-- So the counts decide the build. Writing the listicle renderer first and
-- discovering the counts afterwards is the mistake I have made in this project
-- more than once.
--
-- Every column named below is taken from inspirationController.js, which
-- queries them in production today. None of them is a guess.
--
-- HOW TO RUN: phpMyAdmin usually shows only the FIRST result set when several
-- statements are run together, which is why only set 1 came back last time.
-- Run the six blocks ONE AT A TIME and paste each result.
-- ============================================================================


-- ─── 1. WHICH GUIDES ACTUALLY EXIST, AND HOW BIG THEY ARE ──────────────────
-- The controller's CATEGORIES list names 50 slugs; the hub renders only the
-- ones present in the table. I have been saying "10" based on an earlier
-- count. This is the authoritative list.
--
-- has_img looks for an <img tag in the stored HTML. The earlier check said
-- zero articles contain images; this re-confirms it against the same column
-- the listicle work will rewrite.

SELECT
  id,
  slug,
  sort_order,
  published_at,
  author_id,
  CHAR_LENGTH(content)                                        AS content_chars,
  ROUND(CHAR_LENGTH(content) / 6)                             AS rough_words,
  (CHAR_LENGTH(content) - CHAR_LENGTH(REPLACE(LOWER(content), '<h2', ''))) / 3  AS h2_count,
  (CHAR_LENGTH(content) - CHAR_LENGTH(REPLACE(LOWER(content), '<h3', ''))) / 3  AS h3_count,
  (CHAR_LENGTH(content) - CHAR_LENGTH(REPLACE(LOWER(content), '<img', ''))) / 4 AS img_count,
  og_image IS NOT NULL AND og_image <> ''                     AS has_og_image
FROM pages
WHERE page_type = 'inspiration'
ORDER BY sort_order ASC, id ASC;


-- ─── 2. STYLE COVERAGE — how many vanities per style value ─────────────────
-- style is a MULTI-VALUE EAV attribute, so a vanity can appear under several
-- values and these counts will sum to more than the catalogue. That is
-- correct and is what the showcase join already relies on.
--
-- This is the number that decides whether a style guide can be a 25-item
-- listicle, a 12-item one, or neither.

SELECT
  pav.value_text                      AS style_value,
  COUNT(DISTINCT p.id)                AS active_vanities,
  SUM(CASE WHEN COALESCE(p.primary_image_url, '') <> '' THEN 1 ELSE 0 END) AS with_direct_image
FROM product_attribute_values pav
JOIN products p ON p.id = pav.product_id AND p.is_active = 1
WHERE pav.attr_key = 'style'
GROUP BY pav.value_text
ORDER BY active_vanities DESC;


-- ─── 3. COLOUR COVERAGE ────────────────────────────────────────────────────
-- The guide slugs map onto color_family with a LIKE, so this groups on the
-- raw column rather than the mapped buckets - I want to see the real values,
-- including any that _COLOR_FAMILY_MAP does not currently reach.

SELECT
  COALESCE(NULLIF(TRIM(p.color_family), ''), '(blank)') AS color_family,
  COUNT(*)                                             AS active_vanities
FROM products p
WHERE p.is_active = 1
GROUP BY COALESCE(NULLIF(TRIM(p.color_family), ''), '(blank)')
ORDER BY active_vanities DESC;


-- ─── 4. SINK COUNT COVERAGE ────────────────────────────────────────────────
-- Decides the double-sink guide. value_text is a string in this table, which
-- is why the showcase query casts the match value with String().

SELECT
  pav.value_text        AS sink_count,
  COUNT(DISTINCT p.id)  AS active_vanities
FROM product_attribute_values pav
JOIN products p ON p.id = pav.product_id AND p.is_active = 1
WHERE pav.attr_key = 'sink_count'
GROUP BY pav.value_text
ORDER BY pav.value_text;


-- ─── 5. BRITISH SPELLINGS IN THE ARTICLE BODIES ────────────────────────────
-- The site is American English. The column is literally `color_family`. I
-- wrote these ten articles and I have been writing "colour" and "centre" all
-- session, so the bodies have to be checked rather than assumed clean.
--
-- One row per guide per offending word, with a count. A guide that returns no
-- rows is clean. Checked against the stored HTML, which is what the crawler
-- sees.
--
-- REPLACE() is case-insensitive here only because the column collation is
-- *_ci; the LIKE is explicit about it either way.

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


-- ─── 6. WIDTH COVERAGE ─────────────────────────────────────────────────────
-- Bucketed the way _slugToProductMatch() reads the slug: an "NN-inch" guide
-- matches NN-2 .. NN+2. These buckets are therefore the real ceiling on each
-- size guide, and they are also the input to the separate question of whether
-- the size guides should stay articles at all or point at the collection page.

SELECT
  CASE
    WHEN p.width_in IS NULL      THEN '(null)'
    WHEN p.width_in <= 24        THEN '<=24'
    WHEN p.width_in BETWEEN 28 AND 32 THEN '30 (28-32)'
    WHEN p.width_in BETWEEN 34 AND 38 THEN '36 (34-38)'
    WHEN p.width_in BETWEEN 46 AND 50 THEN '48 (46-50)'
    WHEN p.width_in BETWEEN 58 AND 62 THEN '60 (58-62)'
    WHEN p.width_in BETWEEN 70 AND 74 THEN '72 (70-74)'
    ELSE CONCAT('other: ', CAST(p.width_in AS CHAR))
  END                     AS width_bucket,
  COUNT(*)                AS active_vanities
FROM products p
WHERE p.is_active = 1
GROUP BY width_bucket
ORDER BY active_vanities DESC;
