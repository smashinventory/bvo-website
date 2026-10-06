-- ============================================================================
-- 2026-10-05_identifier_coverage_READONLY.sql
--
-- READ ONLY. Two SELECTs. No CREATE, no ALTER, no INSERT, no UPDATE.
--
-- ─── THE QUESTION ───────────────────────────────────────────────────────────
-- Google merchant listings want a product identifier: gtin (from a UPC) or
-- mpn, alongside brand. The importer already writes `upc` and `mpn` to the
-- products table, so the data layer exists. What is unknown is how POPULATED
-- those two columns actually are.
--
-- This decides how the Product schema emits them:
--   well populated  -> emit gtin12 / mpn, guarded per product so a blank row
--                      omits the property rather than publishing an empty one
--   mostly empty    -> emit mpn only, or neither, and do not pretend
--
-- An empty or invalid gtin is worse than no gtin: Google treats a malformed
-- identifier as an error on the item rather than ignoring it.
--
-- Columns used below (upc, mpn, identifier_exists, google_product_category,
-- product_type, brand, is_active) are all taken from the INSERT column list in
-- importJamesMartinFeed.js, which is authoritative because it writes them.
-- None is a guess.
--
-- HOW TO RUN: phpMyAdmin shows only the first result set when blocks are run
-- together. Run the two blocks one at a time.
-- ============================================================================


-- ─── 1. OVERALL COVERAGE ───────────────────────────────────────────────────
-- A UPC must be 12 digits to be a valid gtin12. Counting "non-empty" and
-- "looks like a valid UPC" separately on purpose: a column full of 'N/A' or
-- truncated codes would pass the first test and fail the second, and that
-- difference decides whether we can emit gtin at all.

SELECT
  COUNT(*)                                                             AS active_products,
  SUM(CASE WHEN COALESCE(TRIM(p.upc), '') <> '' THEN 1 ELSE 0 END)     AS upc_non_empty,
  SUM(CASE WHEN p.upc REGEXP '^[0-9]{12}$' THEN 1 ELSE 0 END)          AS upc_valid_gtin12,
  SUM(CASE WHEN p.upc REGEXP '^[0-9]{13}$' THEN 1 ELSE 0 END)          AS upc_valid_gtin13,
  SUM(CASE WHEN COALESCE(TRIM(p.mpn), '') <> '' THEN 1 ELSE 0 END)     AS mpn_non_empty,
  SUM(CASE WHEN COALESCE(TRIM(p.brand), '') <> '' THEN 1 ELSE 0 END)   AS brand_non_empty,
  SUM(CASE WHEN COALESCE(TRIM(p.google_product_category), '') <> '' THEN 1 ELSE 0 END)
                                                                       AS gpc_non_empty,
  SUM(CASE WHEN COALESCE(TRIM(p.identifier_exists), '') <> '' THEN 1 ELSE 0 END)
                                                                       AS identifier_exists_set
FROM products p
WHERE p.is_active = 1;


-- ─── 2. COVERAGE BY PRODUCT TYPE ───────────────────────────────────────────
-- Vanities are what matter most; if identifiers are present on vanities and
-- absent on accessories, that is a perfectly workable outcome and the schema
-- just guards per product.
--
-- sample_upc / sample_mpn show an actual value so the FORMAT can be eyeballed.
-- A column that is 100 percent populated with the string 'N/A' would otherwise
-- read as full coverage, which is exactly the sort of false green worth
-- designing against.

SELECT
  COALESCE(NULLIF(TRIM(p.product_type), ''), '(blank)')                AS product_type,
  COUNT(*)                                                             AS products,
  SUM(CASE WHEN p.upc REGEXP '^[0-9]{12,13}$' THEN 1 ELSE 0 END)       AS valid_upc,
  SUM(CASE WHEN COALESCE(TRIM(p.mpn), '') <> '' THEN 1 ELSE 0 END)     AS has_mpn,
  MAX(CASE WHEN COALESCE(TRIM(p.upc), '') <> '' THEN p.upc END)        AS sample_upc,
  MAX(CASE WHEN COALESCE(TRIM(p.mpn), '') <> '' THEN p.mpn END)        AS sample_mpn
FROM products p
WHERE p.is_active = 1
GROUP BY COALESCE(NULLIF(TRIM(p.product_type), ''), '(blank)')
ORDER BY products DESC;
