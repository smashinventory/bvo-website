-- FILE 4 of 4 — VERIFY. Read-only. Returns two results.
--
-- Result 1 must be:
--   2081 4604 | 2206 376 | 2032 293 | 2729 290 | NULL 175 | 595 120
--   574 72 | 5938 66 | 504635 27 | 4700 21 | 6356 13 | 441 2
--
-- Result 2 must be: invalid_paths_remaining = 0

SELECT COALESCE(google_product_category,'NULL') AS category, COUNT(*) AS n
  FROM products
 WHERE is_active = 1
 GROUP BY google_product_category
 ORDER BY n DESC;

SELECT COUNT(*) AS invalid_paths_remaining
  FROM products
 WHERE google_product_category LIKE '%>%';
