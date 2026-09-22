/* ============================================================================
   CATEGORY CARD — "Bathroom Vanities With Tops" back onto Bunny, right-sized
   2026-09-19

   WHY
   Lighthouse 2026-09-19 named this the single largest image cost on the
   homepage: 88.9 KiB of a 110 KiB total, 800x661 serving a ~386x360 slot.

   It was pointing at /images/uploads/emmeline-36-in-single-bathroom-vanity-
   with-top--1789661932485.webp — a local admin upload that overwrote the Bunny
   URL set on 2026-09-17. Being local, it also got no ?width= parameter, since
   index.ejs only appends that for the Bunny pull zone (no resizer exists on
   the Hostinger disk).

   WHAT CHANGED IN THE FILE
   Nothing visible. .cat-img is height:180px with object-fit:cover, so the
   browser already cropped this square image to its centre 14:9 band and threw
   the rest away. The new file IS that band — centre-cropped to 800x514, then
   downscaled to 560x360, WebP q90. Verified side by side before and after.

       88.9 KB  ->  27.2 KB      (~62 KB saved, ~70%)

   560x360 matches the other six cards: 2x the 280x180 desktop card, and
   comfortable headroom over the ~386x360 device-pixel slot on a phone.

   PREREQUISITE
   Run jmv_sync/bunny_upload_assets.sh first, or this card goes blank.

   TOUCHES ONE COLUMN ON ONE TABLE: categories.image_url. One row.
   ============================================================================ */


/* --- STEP 1 — confirm the object is live. In a BROWSER. -------------------
   https://images.bathroomvanitiesoutlet.com/site/category-cards/bathroom-vanities-with-tops-v3.webp
   -------------------------------------------------------------------------- */


/* --- STEP 2 — current value. Read only. Keep the output. ------------------ */

SELECT slug, image_url
FROM categories
WHERE slug = 'bathroom-vanities-with-tops';

/*  Expect the /images/uploads/... local path.                               */


/* --- STEP 3 — the write. 1 row. ------------------------------------------- */

UPDATE categories
SET image_url = 'https://images.bathroomvanitiesoutlet.com/site/category-cards/bathroom-vanities-with-tops-v3.webp'
WHERE slug = 'bathroom-vanities-with-tops';


/* --- STEP 4 — verify all ten active cards and their hosts ----------------- */

SELECT slug,
       CASE
         WHEN image_url LIKE '%images.bathroomvanitiesoutlet.com%' THEN 'Bunny'
         WHEN image_url LIKE '%gstatic.com%'                       THEN 'Google cache'
         WHEN image_url LIKE 'http%'                               THEN 'other remote'
         ELSE                                                           'local path'
       END AS host,
       image_url
FROM categories
WHERE is_active = 1 AND parent_id IS NULL
ORDER BY sort_order;

/*  Expect 7 Bunny, 1 Google cache (faucets), 2 local (samples, accessories).
    Those last three are the remaining card work.                            */


/* --- ROLLBACK -------------------------------------------------------------- */

/*
UPDATE categories
SET image_url = 'https://images.bathroomvanitiesoutlet.com/site/category-cards/bathroom-vanities-with-tops-v2.webp'
WHERE slug = 'bathroom-vanities-with-tops';

-- or back to the local upload, whose exact filename is in the Step 2 output.
*/
