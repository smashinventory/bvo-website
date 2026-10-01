-- FILE 2 of 4 — DRY RUN. Read-only. Nothing is changed by it.
-- Expect: rows_total 6079 | rows_changing 5890 | rows_unchanged 189
-- If rows_changing is not 5890, STOP. Do not run file 3.

SELECT COUNT(*)              AS rows_total,
       SUM(will_change)      AS rows_changing,
       SUM(1 - will_change)  AS rows_unchanged
FROM (
  SELECT CASE WHEN IFNULL(google_product_category,'') <> IFNULL(CASE LOWER(TRIM(product_type))
      WHEN 'single sink vanity with top' THEN '2081'
      WHEN 'double sink vanity with top' THEN '2081'
      WHEN 'single sink cabinet only'    THEN '2081'
      WHEN 'double sink cabinet only'    THEN '2081'
      WHEN 'stone top'                   THEN '2729'
      WHEN 'composite top'               THEN '2729'
      WHEN 'countertop unit'             THEN '2729'
      WHEN 'backsplash'                  THEN '2729'
      WHEN 'mirror'                      THEN '595'
      WHEN 'bathroom faucets'            THEN '2032'
      WHEN 'kitchen faucets'             THEN '2032'
      WHEN 'tub fillers'                 THEN '2032'
      WHEN 'bar faucets'                 THEN '2032'
      WHEN 'laundry faucets'             THEN '2032'
      WHEN 'shower fixtures'             THEN '2206'
      WHEN 'plumbing accessories'        THEN '504635'
      WHEN 'bathroom accessories'        THEN '574'
      WHEN 'knobs & legs'                THEN '4700'
      WHEN 'storage cabinet'             THEN '5938'
      WHEN 'linen cabinet'               THEN '5938'
      WHEN 'side cabinet'                THEN '5938'
      WHEN 'hutch'                       THEN '5938'
      WHEN 'drawer unit'                 THEN '5938'
      WHEN 'metal base'                  THEN '6356'
      WHEN 'bench'                       THEN '441'
      ELSE NULL
    END,'')
              THEN 1 ELSE 0 END AS will_change
    FROM products
) x;
