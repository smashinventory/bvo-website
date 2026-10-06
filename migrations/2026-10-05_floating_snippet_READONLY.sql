-- ============================================================================
-- 2026-10-05_floating_snippet_READONLY.sql
--
-- READ ONLY. One SELECT. No CREATE, no ALTER, no INSERT, no UPDATE.
--
-- ─── WHAT IS ALREADY SETTLED ────────────────────────────────────────────────
--   * mount_type has exactly two values in the catalogue: 'Floor Standing'
--     and 'Pedestal'. The importer's canonical set also includes
--     'Wall Mounted' (importJamesMartinFeed.js:1214), so the taxonomy
--     supports it - no product has ever received it.
--   * Every VANITY has a mount_type. The ~1,275 active products with no
--     mount_type row are all non-vanities (shower fixtures, tops, faucets,
--     mirrors, backsplash, benches), because the importer only derives it
--     when categoryId === 1. The "untagged gap" theory is dead.
--   * NO product name contains floating / wall mounted / wall-hung /
--     suspended. All 100 matches in the previous query were description-only.
--   * The vanities that matched are two JM collections, both tagged
--     'Floor Standing': CHICAGO (30/36/48, Glossy White / Smokey Celadon /
--     Walnut Whisper) and MERCER ISLAND (72 Single, Glossy White).
--
-- ─── THE ONE THING STILL UNKNOWN ────────────────────────────────────────────
-- WHICH word matched, and what the sentence actually says. Two readings, and
-- they point opposite ways:
--
--   "...floating vanity..." / "...mounts to the wall..."
--        -> the /wall/ regex at line 1220 missed it, the product fell to the
--           else branch and was written 'Floor Standing'. Misclassification
--           CONFIRMED. The floating guide has real inventory behind it.
--
--   "...wall-mounted faucet required..." / "...do not wall mount..."
--        -> incidental text. FALSE POSITIVE. James Martin does not make
--           floating vanities, and the floating article is targeting a
--           product BVO cannot sell.
--
-- Guessing between these is how a wrong assertion gets written into a commit
-- message. This query prints the surrounding text so the data answers it.
--
-- ⚠️ DIAGNOSIS ONLY, and REPORTING ONLY. Nothing here feeds a rendering
-- query, and no fix to the importer is proposed - that is product-data code
-- and out of scope per the standing instruction. This only establishes which
-- of the two readings is true.
-- ============================================================================

SELECT
  p.id,
  p.slug,
  p.name,
  COALESCE(mt.value_text, '(none)') AS mount_type,

  /* Which term is present, listed rather than ranked, so a description
     containing several shows all of them. */
  CONCAT_WS(', ',
    CASE WHEN LOWER(CONCAT(COALESCE(p.long_desc,''), ' ', COALESCE(p.short_desc,''))) LIKE '%floating%'   THEN 'floating'   END,
    CASE WHEN LOWER(CONCAT(COALESCE(p.long_desc,''), ' ', COALESCE(p.short_desc,''))) LIKE '%wall mount%' THEN 'wall mount' END,
    CASE WHEN LOWER(CONCAT(COALESCE(p.long_desc,''), ' ', COALESCE(p.short_desc,''))) LIKE '%wall-mount%' THEN 'wall-mount' END,
    CASE WHEN LOWER(CONCAT(COALESCE(p.long_desc,''), ' ', COALESCE(p.short_desc,''))) LIKE '%wall hung%'  THEN 'wall hung'  END,
    CASE WHEN LOWER(CONCAT(COALESCE(p.long_desc,''), ' ', COALESCE(p.short_desc,''))) LIKE '%wall-hung%'  THEN 'wall-hung'  END,
    CASE WHEN LOWER(CONCAT(COALESCE(p.long_desc,''), ' ', COALESCE(p.short_desc,''))) LIKE '%suspended%'  THEN 'suspended'  END
  ) AS terms_found,

  /* 120 characters either side of the first hit on 'floating', falling back
     to 'wall mount'. LOCATE returns 0 when absent, hence the GREATEST(...,1)
     guard - SUBSTRING with a 0 or negative start behaves differently across
     versions and would quietly return the wrong window. */
  SUBSTRING(
    CONCAT(COALESCE(p.long_desc,''), ' ', COALESCE(p.short_desc,'')),
    GREATEST(
      COALESCE(NULLIF(LOCATE('floating', LOWER(CONCAT(COALESCE(p.long_desc,''), ' ', COALESCE(p.short_desc,'')))), 0),
               NULLIF(LOCATE('wall',     LOWER(CONCAT(COALESCE(p.long_desc,''), ' ', COALESCE(p.short_desc,'')))), 0),
               1) - 120,
      1),
    260
  ) AS snippet

FROM products p
LEFT JOIN product_attribute_values mt
       ON mt.product_id = p.id AND mt.attr_key = 'mount_type'
WHERE p.is_active = 1
  AND p.product_type NOT IN ('Knobs & Legs', 'Bathroom Accessories', 'Plumbing Accessories')
  AND (
       LOWER(COALESCE(p.long_desc, ''))  LIKE '%floating%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%floating%'
    OR LOWER(COALESCE(p.long_desc, ''))  LIKE '%wall mount%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%wall mount%'
    OR LOWER(COALESCE(p.long_desc, ''))  LIKE '%wall-mount%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%wall-mount%'
    OR LOWER(COALESCE(p.long_desc, ''))  LIKE '%wall hung%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%wall hung%'
    OR LOWER(COALESCE(p.long_desc, ''))  LIKE '%wall-hung%'
    OR LOWER(COALESCE(p.short_desc, '')) LIKE '%wall-hung%'
  )
/* One row per MODEL rather than per finish-and-countertop permutation. The
   previous query returned 100 rows that were really about four vanities -
   Chicago 30/36/48 and Mercer Island 72 - because each model exists once per
   finish per stone top. Grouping on the first two words of the name collapses
   that so the answer is readable. */
GROUP BY SUBSTRING_INDEX(p.name, ' ', 2), mount_type, terms_found, snippet
ORDER BY mount_type, p.name
LIMIT 40;
