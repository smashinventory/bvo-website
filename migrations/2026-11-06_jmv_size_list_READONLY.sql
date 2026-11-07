-- ─────────────────────────────────────────────────────────────────────────
-- 2026-11-06_jmv_size_list_READONLY.sql
--
-- Produces the exact retailer-search list for the review capture: every
-- James Martin collection paired with the widths BVO actually stocks.
--
-- READ ONLY. No INSERT, UPDATE, DELETE or DDL anywhere in this file. Run it,
-- copy the result, paste it back.
--
-- ⚠️ WHY THIS EXISTS. The first capture attempt searched Home Depot for the
-- collection name alone — "james martin bristol". That returned ZERO products
-- while "james martin bristol 48" returned 23. A bare collection search also
-- redirected outright for "boston", landing on a single mirror product page.
-- So an unsized sweep records "no reviews" for collections that plainly have
-- them, which is the one failure mode this whole feature cannot tolerate:
-- "could not check" quietly becoming "nothing to report".
--
-- Driving the search list from the catalogue fixes that AND narrows it: we
-- only ever collect figures about widths you can actually sell.
-- ─────────────────────────────────────────────────────────────────────────


-- ── 1. THE SEARCH LIST, ONE ROW PER SEARCH ───────────────────────────────
-- Widths are rounded and bucketed to the labels the retailers use, matching
-- src/config/sizeBuckets.js. Searching "36" finds a 35.9in listing; searching
-- "35.9" finds nothing.
SELECT
  p.model                                   AS collection,
  CASE
    WHEN ROUND(p.width_in) <= 22 THEN '20'
    WHEN ROUND(p.width_in) BETWEEN 23 AND 27 THEN '25'
    WHEN ROUND(p.width_in) BETWEEN 28 AND 32 THEN '30'
    WHEN ROUND(p.width_in) BETWEEN 34 AND 38 THEN '36'
    WHEN ROUND(p.width_in) BETWEEN 40 AND 44 THEN '42'
    WHEN ROUND(p.width_in) BETWEEN 46 AND 50 THEN '48'
    WHEN ROUND(p.width_in) BETWEEN 52 AND 56 THEN '54'
    WHEN ROUND(p.width_in) BETWEEN 58 AND 62 THEN '60'
    WHEN ROUND(p.width_in) BETWEEN 64 AND 68 THEN '66'
    WHEN ROUND(p.width_in) BETWEEN 70 AND 74 THEN '72'
    WHEN ROUND(p.width_in) >= 82 THEN '84'
    ELSE CAST(ROUND(p.width_in) AS CHAR)
  END                                       AS size_label,
  COUNT(*)                                  AS skus,
  CONCAT('james+martin+', LOWER(REPLACE(p.model,' ','+')), '+',
    CASE
      WHEN ROUND(p.width_in) <= 22 THEN '20'
      WHEN ROUND(p.width_in) BETWEEN 23 AND 27 THEN '25'
      WHEN ROUND(p.width_in) BETWEEN 28 AND 32 THEN '30'
      WHEN ROUND(p.width_in) BETWEEN 34 AND 38 THEN '36'
      WHEN ROUND(p.width_in) BETWEEN 40 AND 44 THEN '42'
      WHEN ROUND(p.width_in) BETWEEN 46 AND 50 THEN '48'
      WHEN ROUND(p.width_in) BETWEEN 52 AND 56 THEN '54'
      WHEN ROUND(p.width_in) BETWEEN 58 AND 62 THEN '60'
      WHEN ROUND(p.width_in) BETWEEN 64 AND 68 THEN '66'
      WHEN ROUND(p.width_in) BETWEEN 70 AND 74 THEN '72'
      WHEN ROUND(p.width_in) >= 82 THEN '84'
      ELSE CAST(ROUND(p.width_in) AS CHAR)
    END)                                    AS hd_query
FROM products p
WHERE p.brand = 'James Martin Vanities'
  AND p.is_active = 1
  AND p.model IS NOT NULL AND p.model <> ''
  AND p.width_in IS NOT NULL AND p.width_in > 0
GROUP BY collection, size_label
ORDER BY collection, CAST(size_label AS UNSIGNED);


-- ── 2. THE SAME THING, ONE ROW PER COLLECTION ────────────────────────────
-- Easier to read and to paste back. Ordered by SKU count, so the collections
-- carrying the most of your catalogue get captured first and the long tail
-- can be stopped whenever it stops being worth the page loads.
SELECT
  p.model                                             AS collection,
  COUNT(*)                                            AS total_skus,
  COUNT(DISTINCT CASE
    WHEN ROUND(p.width_in) <= 22 THEN '20'
    WHEN ROUND(p.width_in) BETWEEN 23 AND 27 THEN '25'
    WHEN ROUND(p.width_in) BETWEEN 28 AND 32 THEN '30'
    WHEN ROUND(p.width_in) BETWEEN 34 AND 38 THEN '36'
    WHEN ROUND(p.width_in) BETWEEN 40 AND 44 THEN '42'
    WHEN ROUND(p.width_in) BETWEEN 46 AND 50 THEN '48'
    WHEN ROUND(p.width_in) BETWEEN 52 AND 56 THEN '54'
    WHEN ROUND(p.width_in) BETWEEN 58 AND 62 THEN '60'
    WHEN ROUND(p.width_in) BETWEEN 64 AND 68 THEN '66'
    WHEN ROUND(p.width_in) BETWEEN 70 AND 74 THEN '72'
    WHEN ROUND(p.width_in) >= 82 THEN '84'
    ELSE CAST(ROUND(p.width_in) AS CHAR) END)         AS size_count,
  GROUP_CONCAT(DISTINCT
    CASE
      WHEN ROUND(p.width_in) <= 22 THEN '20'
      WHEN ROUND(p.width_in) BETWEEN 23 AND 27 THEN '25'
      WHEN ROUND(p.width_in) BETWEEN 28 AND 32 THEN '30'
      WHEN ROUND(p.width_in) BETWEEN 34 AND 38 THEN '36'
      WHEN ROUND(p.width_in) BETWEEN 40 AND 44 THEN '42'
      WHEN ROUND(p.width_in) BETWEEN 46 AND 50 THEN '48'
      WHEN ROUND(p.width_in) BETWEEN 52 AND 56 THEN '54'
      WHEN ROUND(p.width_in) BETWEEN 58 AND 62 THEN '60'
      WHEN ROUND(p.width_in) BETWEEN 64 AND 68 THEN '66'
      WHEN ROUND(p.width_in) BETWEEN 70 AND 74 THEN '72'
      WHEN ROUND(p.width_in) >= 82 THEN '84'
      ELSE CAST(ROUND(p.width_in) AS CHAR) END
    ORDER BY CAST(CASE
      WHEN ROUND(p.width_in) <= 22 THEN '20'
      WHEN ROUND(p.width_in) BETWEEN 23 AND 27 THEN '25'
      WHEN ROUND(p.width_in) BETWEEN 28 AND 32 THEN '30'
      WHEN ROUND(p.width_in) BETWEEN 34 AND 38 THEN '36'
      WHEN ROUND(p.width_in) BETWEEN 40 AND 44 THEN '42'
      WHEN ROUND(p.width_in) BETWEEN 46 AND 50 THEN '48'
      WHEN ROUND(p.width_in) BETWEEN 52 AND 56 THEN '54'
      WHEN ROUND(p.width_in) BETWEEN 58 AND 62 THEN '60'
      WHEN ROUND(p.width_in) BETWEEN 64 AND 68 THEN '66'
      WHEN ROUND(p.width_in) BETWEEN 70 AND 74 THEN '72'
      WHEN ROUND(p.width_in) >= 82 THEN '84'
      ELSE CAST(ROUND(p.width_in) AS CHAR) END AS UNSIGNED)
    SEPARATOR ',')                                    AS sizes
FROM products p
WHERE p.brand = 'James Martin Vanities'
  AND p.is_active = 1
  AND p.model IS NOT NULL AND p.model <> ''
  AND p.width_in IS NOT NULL AND p.width_in > 0
GROUP BY collection
ORDER BY total_skus DESC, collection;


-- ── 3. SANITY CHECKS ─────────────────────────────────────────────────────
-- ⚠️ A COLLECTION WITH NO WIDTH IS INVISIBLE TO QUERY 1 AND 2. It would be
-- silently skipped by the capture and then look like "no reviews found",
-- which is the exact confusion this file exists to prevent. Surface them.
SELECT p.model AS collection_with_no_usable_width, COUNT(*) AS skus
FROM products p
WHERE p.brand = 'James Martin Vanities'
  AND p.is_active = 1
  AND p.model IS NOT NULL AND p.model <> ''
  AND (p.width_in IS NULL OR p.width_in <= 0)
GROUP BY p.model
ORDER BY skus DESC;
-- Any rows here must be captured by hand or have their widths fixed first.

-- Totals, so the search count is known before the capture starts.
SELECT COUNT(DISTINCT p.model) AS collections,
       COUNT(*)                AS active_skus
FROM products p
WHERE p.brand = 'James Martin Vanities'
  AND p.is_active = 1
  AND p.model IS NOT NULL AND p.model <> '';

-- Cross-check against the 40 model landing pages in src/config/pathFilters.js.
-- A mismatch means either a model page points at nothing, or a collection has
-- products and no page. Both are worth knowing before capturing anything.
