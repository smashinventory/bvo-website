/* ============================================================================
   IMAGE HOST AUDIT — read only, changes nothing
   2026-09-17

   Counts every image URL the database stores, bucketed by the host serving it.
   Written after finding a product gallery still on images.salsify.com when the
   repoint was believed complete (d200-v36-csn-3wz, verified live 2026-09-17).

   Run all of it. Nothing here writes.
   ============================================================================ */

/* --- 1. Everything, by table and host ------------------------------------ */

SELECT 'product_images.url' AS source, bucket, COUNT(*) AS n FROM (
  SELECT CASE
    WHEN url LIKE '%images.bathroomvanitiesoutlet.com%' THEN '1 Bunny'
    WHEN url LIKE '%images.salsify.com%'                THEN '2 Salsify'
    WHEN url LIKE '%res.cloudinary.com%'                THEN '3 Cloudinary'
    WHEN url LIKE '%cdn.shopify.com%'                   THEN '4 Shopify'
    WHEN url LIKE '%gstatic.com%'                       THEN '5 Google cache'
    WHEN url LIKE 'http%'                               THEN '6 other remote'
    ELSE                                                     '7 local path'
  END AS bucket FROM product_images) t GROUP BY bucket

UNION ALL
SELECT 'products.primary_image_url', bucket, COUNT(*) FROM (
  SELECT CASE
    WHEN primary_image_url LIKE '%images.bathroomvanitiesoutlet.com%' THEN '1 Bunny'
    WHEN primary_image_url LIKE '%images.salsify.com%'                THEN '2 Salsify'
    WHEN primary_image_url LIKE '%res.cloudinary.com%'                THEN '3 Cloudinary'
    WHEN primary_image_url LIKE '%cdn.shopify.com%'                   THEN '4 Shopify'
    WHEN primary_image_url LIKE '%gstatic.com%'                       THEN '5 Google cache'
    WHEN primary_image_url LIKE 'http%'                               THEN '6 other remote'
    WHEN primary_image_url IS NULL OR primary_image_url = ''           THEN '8 null/empty'
    ELSE                                                                   '7 local path'
  END AS bucket FROM products) t GROUP BY bucket

UNION ALL
SELECT 'categories.image_url', bucket, COUNT(*) FROM (
  SELECT CASE
    WHEN image_url LIKE '%images.bathroomvanitiesoutlet.com%' THEN '1 Bunny'
    WHEN image_url LIKE '%gstatic.com%'                       THEN '5 Google cache'
    WHEN image_url LIKE 'http%'                               THEN '6 other remote'
    WHEN image_url IS NULL OR image_url = ''                   THEN '8 null/empty'
    ELSE                                                           '7 local path'
  END AS bucket FROM categories) t GROUP BY bucket

UNION ALL
SELECT 'model_groups.custom_image', bucket, COUNT(*) FROM (
  SELECT CASE
    WHEN custom_image LIKE '%images.bathroomvanitiesoutlet.com%' THEN '1 Bunny'
    WHEN custom_image LIKE '%images.salsify.com%'                THEN '2 Salsify'
    WHEN custom_image LIKE 'http%'                               THEN '6 other remote'
    WHEN custom_image IS NULL OR custom_image = ''                THEN '8 null/empty'
    ELSE                                                              '7 local path'
  END AS bucket FROM model_groups) t GROUP BY bucket

UNION ALL
SELECT 'pages.og_image', bucket, COUNT(*) FROM (
  SELECT CASE
    WHEN og_image LIKE '%images.bathroomvanitiesoutlet.com%' THEN '1 Bunny'
    WHEN og_image LIKE 'http%'                               THEN '6 other remote'
    WHEN og_image IS NULL OR og_image = ''                    THEN '8 null/empty'
    ELSE                                                           '7 local path'
  END AS bucket FROM pages) t GROUP BY bucket

ORDER BY source, bucket;


/* --- 2. If product_images still shows Salsify, WHICH products? ------------ */

SELECT p.sku, p.brand, p.product_type, COUNT(*) AS imgs, MIN(pi.url) AS sample_url
FROM product_images pi
JOIN products p ON p.id = pi.product_id
WHERE pi.url LIKE '%images.salsify.com%'
GROUP BY p.sku, p.brand, p.product_type
ORDER BY imgs DESC
LIMIT 40;


/* --- 3. How many distinct products, and are they the 469 accessories? ----- */

SELECT COUNT(DISTINCT p.id) AS products_on_salsify,
       COUNT(*)             AS images_on_salsify,
       SUM(p.is_active)     AS of_those_active
FROM product_images pi
JOIN products p ON p.id = pi.product_id
WHERE pi.url LIKE '%images.salsify.com%';
