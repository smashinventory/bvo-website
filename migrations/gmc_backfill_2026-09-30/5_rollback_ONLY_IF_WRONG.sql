-- FILE 5 — ROLLBACK. Only run this if file 4 gave the wrong numbers.
-- Puts every value back exactly as it was before file 3.

UPDATE products p
  JOIN _bk_gmc_category_20260930 b ON b.id = p.id
   SET p.google_product_category = b.old_value;

SELECT COUNT(*) AS rows_restored FROM _bk_gmc_category_20260930;
