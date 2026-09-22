/* ============================================================================
   THE LAST NINE — Cloudinary product images to Bunny
   2026-09-22

   After the Salsify work, product_images held 9 rows on res.cloudinary.com,
   across three ER Vanities products:

     Kensington-29.5L-WH-BN           5 images
     Kensington-BridgeCabinet-WH-BN   2 images
     Kensington-BridgeCabinet-MG-BN   2 images

   The files were downloaded from Cloudinary unchanged (no re-encoding: the
   Cloudinary copies are already optimised, and converting them to WebP made
   several of them LARGER) and uploaded to the pull zone under the SKU, with
   the same file names. Cloudinary's f_auto,q_auto path prefix is dropped —
   Bunny's optimiser handles format and width itself.

   ⚠ PREREQUISITE: run jmv_sync/bunny_upload_assets.sh first. STEP 1 checks it.

   No map table is involved. These products are not in the James Martin feed,
   so no importer overwrites them.
   ============================================================================ */

/* --- STEP 1 — spot-check two objects in a BROWSER ---------------------------
   https://images.bathroomvanitiesoutlet.com/Kensington-29.5L-WH-BN/bathroom-vanity-kensington-30l-bright-white-pr0972-3.jpg
   https://images.bathroomvanitiesoutlet.com/Kensington-BridgeCabinet-MG-BN/bridge-drawer-kensington-23-metal-gray-1.jpg
   -------------------------------------------------------------------------- */

/* --- STEP 2 — before (read only) ------------------------------------------ */
SELECT p.sku, pi.sort_order, pi.url
FROM product_images pi
JOIN products p ON p.id = pi.product_id
WHERE pi.url LIKE '%cloudinary%'
ORDER BY p.sku, pi.sort_order;
/*  Expect 9 rows. Keep this output: it is the rollback. */

/* --- STEP 3 — THE WRITE ---------------------------------------------------- */
/*  Keeps the file name, swaps the host and the path for the SKU folder.       */
UPDATE product_images pi
JOIN products p ON p.id = pi.product_id
SET pi.url = CONCAT('https://images.bathroomvanitiesoutlet.com/', p.sku, '/',
                    SUBSTRING_INDEX(SUBSTRING_INDEX(pi.url, '?', 1), '/', -1))
WHERE pi.url LIKE '%cloudinary%';
/*  Expect 9 rows affected. */

/* --- STEP 4 — verify ------------------------------------------------------- */
SELECT
  SUM(url LIKE '%images.bathroomvanitiesoutlet.com%') AS on_bunny,
  SUM(url LIKE '%cloudinary%')                        AS still_cloudinary,
  SUM(url LIKE '%images.salsify.com%')                AS still_salsify,
  COUNT(*)                                            AS total_rows
FROM product_images;
/*  Expect still_cloudinary = 0, still_salsify = 0, on_bunny = total_rows. */

/* --- ROLLBACK -------------------------------------------------------------- */
/*  Paste the old URLs from the STEP 2 output back in, one UPDATE per row:
    UPDATE product_images SET url='<old>' WHERE product_id=(SELECT id FROM products
      WHERE sku='<sku>') AND sort_order=<n>;                                   */
