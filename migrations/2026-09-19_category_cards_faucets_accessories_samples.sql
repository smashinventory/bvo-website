/* ============================================================================
   CATEGORY CARDS — Faucets, Accessories, Samples onto Bunny
   2026-09-19

   WHY
   These were the last three cards not on the pull zone.

     faucets      encrypted-tbn0.gstatic.com   2.8 KB   225x225
     accessories  /images/uploads/...jpg      43.7 KB   618x593
     samples      /images/uploads/...jpg      62.2 KB   562x614

   The Faucets card was the urgent one, and not for weight. It was a hotlink
   to a Google Images cache thumbnail: 225x225 stretched into a ~386x360 slot
   on a phone so it rendered soft, on a URL Google can retire without notice,
   and it was someone else's photograph served from Google's infrastructure on
   a commercial storefront. It is replaced with our own catalogue photo —
   Joy Widespread, PVD Satin Brass, W4582116-14 image 1 — which already lives
   on Bunny under the product SKU and which we have every right to use.

   The other two are local admin uploads. Being local they get no resizer, so
   index.ejs cannot append ?width= to them (it only does that for the Bunny
   host, because no resizer exists on the Hostinger disk).

   WHAT CHANGED IN THE FILES
   Nothing visible. .cat-img is height:180px with object-fit:cover, so the
   browser was already cropping these to their centre 14:9 band and discarding
   the rest. The new files ARE that band — centre-cropped, then downscaled to
   560x360 WebP q90, matching the seven cards already on Bunny.

     faucets       2.8 KB ->  6.8 KB   (larger, and far sharper: 225px -> 560px)
     accessories  43.7 KB -> 17.8 KB   (59% off)
     samples      62.2 KB -> 38.8 KB   (38% off; detailed mood board, compresses hard)

   PREREQUISITE
   Run jmv_sync/bunny_upload_assets.sh first, or these three cards go blank.

   TOUCHES ONE COLUMN ON ONE TABLE: categories.image_url. Three rows.
   ============================================================================ */


/* --- STEP 1 — confirm all three objects are live. In a BROWSER. -----------
   https://images.bathroomvanitiesoutlet.com/site/category-cards/faucets-v2.webp
   https://images.bathroomvanitiesoutlet.com/site/category-cards/accessories-v2.webp
   https://images.bathroomvanitiesoutlet.com/site/category-cards/samples-v2.webp

   All three must return an image. Do not run STEP 3 until they do.
   -------------------------------------------------------------------------- */


/* --- STEP 2 — current values. Read only. KEEP THIS OUTPUT. ---------------- */

SELECT slug, image_url
FROM categories
WHERE slug IN ('faucets', 'accessories', 'samples')
ORDER BY slug;

/*  Expect: faucets on encrypted-tbn0.gstatic.com, the other two on
    /images/uploads/. This output is your rollback — nothing else records
    the old filenames.                                                       */


/* --- STEP 3 — the write. 3 rows. ------------------------------------------ */

UPDATE categories
SET image_url = 'https://images.bathroomvanitiesoutlet.com/site/category-cards/faucets-v2.webp'
WHERE slug = 'faucets';

UPDATE categories
SET image_url = 'https://images.bathroomvanitiesoutlet.com/site/category-cards/accessories-v2.webp'
WHERE slug = 'accessories';

UPDATE categories
SET image_url = 'https://images.bathroomvanitiesoutlet.com/site/category-cards/samples-v2.webp'
WHERE slug = 'samples';

/*  Each should report 1 row affected. If any reports 0, the slug differs from
    what the homepage links to — stop and say so rather than guessing.        */


/* --- STEP 4 — verify every active card and its host ----------------------- */

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

/*  Expect ALL Bunny. No Google cache, no local paths. That closes out the
    category-card work that started on 2026-09-17.                           */


/* --- ROLLBACK -------------------------------------------------------------- */

/*
   Paste the old values from the STEP 2 output, e.g.

   UPDATE categories SET image_url = '<old value from step 2>' WHERE slug = 'faucets';

   Note the faucets rollback restores a Google Images hotlink. If that card
   ever needs changing again, replace it with another of our own photographs
   rather than reverting to that URL.
*/
