-- FILE 3 of 4 — THE UPDATE. This one changes data.
-- Only run it after file 2 returned 5890.
-- Expect: 5890 rows affected.

UPDATE products
   SET google_product_category = CASE LOWER(TRIM(product_type))
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
    END;
