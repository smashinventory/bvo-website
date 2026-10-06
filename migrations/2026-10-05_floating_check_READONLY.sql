-- ============================================================================
-- 2026-10-05_floating_check_READONLY.sql
--
-- READ ONLY. Two SELECTs. No CREATE, no ALTER, no INSERT, no UPDATE.
--
-- ─── THE ONE QUESTION ───────────────────────────────────────────────────────
-- Does the catalogue contain floating / wall-mounted vanities at all?
--
-- What the attribute inventory already settled: mount_type has exactly two
-- values, "Floor Standing" and "Pedestal", and none of the other 48 attr_keys
-- names a mount style. So NO ATTRIBUTE IDENTIFIES A FLOATING VANITY.
--
-- What it did NOT settle: mount_type covers 4,784 products while depth_in
-- covers 5,283, so roughly 499 products carry no mount_type row. A floating
-- vanity could sit in that gap, untagged.
--
-- This matters because /inspiration/floating-bathroom-vanity-ideas is one of
-- the ten live articles. If the catalogue carries none, that page is ranking
-- (or trying to) for a product BVO cannot sell, and its format question is
-- not "listicle or prose" but "should it exist".
--
-- ─── THE LIKELY CAUSE, FOUND IN THE IMPORTER ────────────────────────────────
-- importJamesMartinFeed.js:1216-1228 derives mount_type, and its canonical
-- set is 'Wall Mounted' | 'Floor Standing' | 'Pedestal'. So the taxonomy
-- ALREADY supports wall-mounted. Yet no product in the catalogue has it.
--
-- Line 1220 is why it may never fire:
--
--     if (/wall/i.test(vtLower) || /wall/i.test(ptLower)) mountType = 'Wall Mounted';
--
-- It tests for the word "wall" ONLY. Floating, wall-hung and wall-mounted are
-- the same product (owner confirmed). If the JM feed calls them "Floating",
-- the regex misses it, the product falls through to the else branch, and it is
-- written as 'Floor Standing' - silently, and looking like it worked.
--
-- WHAT THIS QUERY DECIDES:
--   rows showing "name: floating" with mount_type 'Floor Standing'
--       -> misclassification confirmed. The products exist; the tagging is
--          wrong. The floating guide has inventory to sell.
--   no rows at all
--       -> James Martin does not make them. The floating guide is an article
--          for a product BVO cannot sell, and its future is a separate
--          decision (retire, redirect, or keep as pure editorial).
--
-- ⚠️ REPORTING, NOT FIXING. The derivation lives in the importer, which is
-- product-data code. Per the standing instruction, no change is proposed to it
-- here - this file only establishes which of the two causes is real.
--
-- ⚠️ A LIKE against product.name is used here for DIAGNOSIS ONLY. The gate in
-- gate_guide_showcase.js forbids name-matching for PRODUCT SELECTION, and
-- correctly so - it mis-sorts the catalogue quietly while looking like it
-- worked. Reading the catalogue to answer a question is a different act from
-- filtering it to build a page. Nothing here feeds a query that renders.
-- ============================================================================


-- ─── 1. DOES THE WORD APPEAR ANYWHERE IN THE CATALOGUE? ────────────────────
-- Name and description, with the product's mount_type alongside so a
-- mislabelled floating vanity shows up as such.

SELECT
  p.id, p.slug, p.name, p.brand, p.width_in,
  COALESCE(mt.value_text, '(no mount_type row)') AS mount_type,
  CASE
    WHEN LOWER(p.name) LIKE '%floating%'      THEN 'name: floating'
    WHEN LOWER(p.name) LIKE '%wall mount%'    THEN 'name: wall mount'
    WHEN LOWER(p.name) LIKE '%wall-mount%'    THEN 'name: wall-mount'
    WHEN LOWER(p.name) LIKE '%wall hung%'     THEN 'name: wall hung'
    WHEN LOWER(p.name) LIKE '%wall-hung%'     THEN 'name: wall-hung'
    WHEN LOWER(p.name) LIKE '%suspended%'     THEN 'name: suspended'
    ELSE 'description only'
  END AS matched_on
  /* ⚠️ products has NO `description` column. The first draft of this file
     named one, which would have thrown ER_BAD_FIELD_ERROR (#1054) the moment
     it ran - the same mistake as nav_menus.slug earlier in this project.
     The real columns are `long_desc` and `short_desc`, confirmed from the
     INSERT column list in importJamesMartinFeed.js, which is authoritative
     because it writes them. */
FROM products p
LEFT JOIN product_attribute_values mt
       ON mt.product_id = p.id AND mt.attr_key = 'mount_type'
WHERE p.is_active = 1
  AND (
       LOWER(p.name)        LIKE '%floating%'
    OR LOWER(p.name)        LIKE '%wall mount%'
    OR LOWER(p.name)        LIKE '%wall-mount%'
    OR LOWER(p.name)        LIKE '%wall hung%'
    OR LOWER(p.name)                     LIKE '%suspended%'
    OR LOWER(p.name)                     LIKE '%wall-hung%'
    OR LOWER(COALESCE(p.long_desc, ''))  LIKE '%floating%'
    OR LOWER(COALESCE(p.long_desc, ''))  LIKE '%wall mount%'
    OR LOWER(COALESCE(p.long_desc, ''))  LIKE '%wall-mount%'
    OR LOWER(COALESCE(p.long_desc, ''))  LIKE '%wall hung%'
    OR LOWER(COALESCE(p.long_desc, ''))  LIKE '%wall-hung%'
    OR LOWER(COALESCE(p.long_desc, ''))  LIKE '%suspended%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%floating%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%wall mount%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%wall-mount%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%wall hung%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%wall-hung%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%suspended%'
  )
ORDER BY matched_on, p.id
LIMIT 100;


-- ─── 2. WHAT IS IN THE UNTAGGED GAP? ───────────────────────────────────────
-- The ~499 active products with no mount_type row. If floating vanities exist
-- untagged, this is where they are. Grouped by product_type so the answer is
-- one short result rather than 499 rows - most of this gap is likely tops,
-- mirrors and faucets, which have no mount style because the concept does not
-- apply to them.

SELECT
  COALESCE(NULLIF(TRIM(p.product_type), ''), '(blank)') AS product_type,
  COUNT(*) AS products_with_no_mount_type
FROM products p
LEFT JOIN product_attribute_values mt
       ON mt.product_id = p.id AND mt.attr_key = 'mount_type'
WHERE p.is_active = 1
  AND mt.product_id IS NULL
GROUP BY COALESCE(NULLIF(TRIM(p.product_type), ''), '(blank)')
ORDER BY products_with_no_mount_type DESC;
