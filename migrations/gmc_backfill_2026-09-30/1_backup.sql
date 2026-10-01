-- FILE 1 of 4 — BACKUP. Run this first. Nothing is changed by it.
-- Expect the result: rows_backed_up = 6079

DROP TABLE IF EXISTS _bk_gmc_category_20260930;

CREATE TABLE _bk_gmc_category_20260930 AS
SELECT id, sku, product_type, google_product_category AS old_value
  FROM products;

SELECT COUNT(*) AS rows_backed_up FROM _bk_gmc_category_20260930;
