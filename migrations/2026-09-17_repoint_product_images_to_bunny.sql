/* ============================================================================
   REPOINT product_images TO BUNNY — the one-time repair
   2026-09-17

   WHAT HAPPENED
   importJamesMartinFeed.js DELETEd each product's images and re-INSERTed the
   feed's images.salsify.com URLs on every run, and syncJMFeed.js fires it from
   cron whenever James Martin drops a workbook. Every previous repoint was
   undone at the next drop. Audited 2026-09-17:

       product_images   1,425 on Bunny      (Huntington Brass + ER Vanities)
                       56,623 on Salsify    (5,160 products, 56,606 active)
                            9 on Cloudinary

   ⚠ PREREQUISITE — DO NOT RUN THIS FIRST ⚠
   Commit acb13a6 teaches the importer to translate the host on the way in.
   That must be DEPLOYED before this runs, or the next feed drop reverts all
   of it again. Check that src/utils/cdnUrl.js exists on the server first.

   HOW THE JOIN WORKS
   image_cdn_map (source, source_key, sku, filename) holds the Bunny object for
   each vendor asset. source_key is the vendor asset id — the last path segment
   of the URL with its extension removed:

       https://images.salsify.com/image/upload/s--GOR4ExOu--/u9la1sa3.jpg
                                                             ^^^^^^^^  source_key

   The join is on (sku, source_key), never source_key alone: Salsify asset ids
   are not unique across SKUs — 31,879 collisions were measured when the map
   was built, so keying on the id alone would put one product's photo on
   another product's page.

   Steps 1-3 are read only. Step 4 is the write. Step 5 verifies.
   ============================================================================ */


/* --- STEP 1 — the damage, before touching anything ------------------------ */

SELECT
  SUM(url LIKE '%images.bathroomvanitiesoutlet.com%') AS on_bunny,
  SUM(url LIKE '%images.salsify.com%')                AS on_salsify,
  SUM(url LIKE '%cdn.shopify.com%')                   AS on_shopify,
  COUNT(*)                                            AS total_rows
FROM product_images;


/* --- STEP 2 — how many CAN be fixed --------------------------------------- */
/*  Extracts the asset id from the URL the same way src/utils/cdnUrl.js does:
    strip any ?query, take the segment after the last '/', drop the extension. */

SELECT COUNT(*) AS rows_with_a_mapping
FROM product_images pi
JOIN products p ON p.id = pi.product_id
JOIN image_cdn_map m
  ON  m.sku = p.sku
  AND m.source_key = SUBSTRING_INDEX(
        SUBSTRING_INDEX(SUBSTRING_INDEX(pi.url, '?', 1), '/', -1), '.', 1)
WHERE pi.url LIKE '%images.salsify.com%';


/* --- STEP 3 — what will be LEFT BEHIND, and on which SKUs ----------------- */
/*  These are images whose masters were never pulled to Bunny. They keep their
    Salsify URL and still display. Expect the 469 accessory products censused
    on 2026-09-16 (1,314 images) to appear here. */

SELECT p.sku, p.brand, COUNT(*) AS unmapped_images
FROM product_images pi
JOIN products p ON p.id = pi.product_id
LEFT JOIN image_cdn_map m
  ON  m.sku = p.sku
  AND m.source_key = SUBSTRING_INDEX(
        SUBSTRING_INDEX(SUBSTRING_INDEX(pi.url, '?', 1), '/', -1), '.', 1)
WHERE pi.url LIKE '%images.salsify.com%'
  AND m.sku IS NULL
GROUP BY p.sku, p.brand
ORDER BY unmapped_images DESC
LIMIT 50;


/* --- STEP 4 — THE WRITE --------------------------------------------------- */
/*  Only rows with a mapping are touched. Everything else is left exactly as
    it is — an unmapped image keeps working rather than going blank. */

UPDATE product_images pi
JOIN products p ON p.id = pi.product_id
JOIN image_cdn_map m
  ON  m.sku = p.sku
  AND m.source_key = SUBSTRING_INDEX(
        SUBSTRING_INDEX(SUBSTRING_INDEX(pi.url, '?', 1), '/', -1), '.', 1)
SET pi.url = CONCAT('https://images.bathroomvanitiesoutlet.com/', p.sku, '/', m.filename)
WHERE pi.url LIKE '%images.salsify.com%';

/*  The affected-rows count should match Step 2 exactly. If it is lower,
    stop and say so before running anything else.                            */


/* --- STEP 5 — verify ------------------------------------------------------ */

SELECT
  SUM(url LIKE '%images.bathroomvanitiesoutlet.com%') AS on_bunny,
  SUM(url LIKE '%images.salsify.com%')                AS still_salsify,
  COUNT(*)                                            AS total_rows
FROM product_images;

/*  Spot-check the product that exposed this, d200-v36-csn-3wz: */
SELECT pi.sort_order, pi.url
FROM product_images pi
JOIN products p ON p.id = pi.product_id
WHERE p.sku = 'D200-V36-CSN-3WZ'
ORDER BY pi.sort_order
LIMIT 5;


/* --- NO ROLLBACK SCRIPT, DELIBERATELY ------------------------------------- */
/*  Reverting would mean putting third-party CDN URLs back, which is the bug.
    If a Bunny object turns out to be missing, fix it by uploading that object
    rather than by repointing the row at Salsify. The Step 3 list is the
    authoritative record of what was NOT touched.                            */


/* --- AFTERWARDS ----------------------------------------------------------- */
/*  1. The search index stores its own copy of image URLs — re-run searchSync
       so results stop pointing at Salsify.
    2. Bunny's edge has never served most of these objects. The first request
       for each is a cache miss; they warm as traffic arrives.
    3. The unmapped set from Step 3 is the remaining work: pull those masters,
       upload them, extend image_cdn_map, then re-run Step 4.                */
