/* ============================================================================
   CATEGORY CARDS — swap four cards to the owner's own artwork
   2026-09-17

   The owner replaced four of the seven card images with compositions of their
   own making. Those files are uploaded to Bunny as NEW object keys with a -v2
   suffix rather than overwriting the existing ones, so there is no edge-cached
   older copy to purge and the previous version stays available as a fallback.

   The other three cards — bathroom-mirrors, storage, vanity-models — are left
   exactly as they are.

   TOUCHES ONE COLUMN ON ONE TABLE: categories.image_url. Four rows.

   PREREQUISITE: run jmv_sync/bunny_upload_assets.sh first, or these four
   cards go blank.
   ============================================================================ */


/* --- STEP 1 — confirm the four objects are live. In a BROWSER. ------------
   https://images.bathroomvanitiesoutlet.com/site/category-cards/bathroom-vanities-v2.webp
   https://images.bathroomvanitiesoutlet.com/site/category-cards/bathroom-vanities-with-tops-v2.webp
   https://images.bathroomvanitiesoutlet.com/site/category-cards/bathroom-vanity-cabinets-v2.webp
   https://images.bathroomvanitiesoutlet.com/site/category-cards/bathroom-vanity-tops-v2.webp
   -------------------------------------------------------------------------- */


/* --- STEP 2 — current values. Read only. Keep the output. ----------------- */

SELECT slug, image_url
FROM categories
WHERE slug IN ('bathroom-vanities','bathroom-vanities-with-tops',
               'bathroom-vanity-cabinets','bathroom-vanity-tops')
ORDER BY slug;


/* --- STEP 3 — the write. -------------------------------------------------- */

UPDATE categories c
JOIN (
  SELECT 'bathroom-vanities'            AS slug, 'bathroom-vanities-v2.webp'            AS f
  UNION ALL SELECT 'bathroom-vanities-with-tops', 'bathroom-vanities-with-tops-v2.webp'
  UNION ALL SELECT 'bathroom-vanity-cabinets',    'bathroom-vanity-cabinets-v2.webp'
  UNION ALL SELECT 'bathroom-vanity-tops',        'bathroom-vanity-tops-v2.webp'
) v ON v.slug = c.slug
SET c.image_url = CONCAT(
      'https://images.bathroomvanitiesoutlet.com/site/category-cards/', v.f);

/*  Four rows affected. If it says fewer, a slug did not match — stop.        */


/* --- STEP 4 — verify all seven cards. ------------------------------------- */

SELECT slug, image_url
FROM categories
WHERE is_active = 1 AND parent_id IS NULL
ORDER BY sort_order;


/* --- ROLLBACK — the previous renders are still in Bunny, untouched -------- */

/*
UPDATE categories c
JOIN (
  SELECT 'bathroom-vanities'            AS slug, 'bathroom-vanities.webp'            AS f
  UNION ALL SELECT 'bathroom-vanities-with-tops', 'bathroom-vanities-with-tops.webp'
  UNION ALL SELECT 'bathroom-vanity-cabinets',    'bathroom-vanity-cabinets.webp'
  UNION ALL SELECT 'bathroom-vanity-tops',        'bathroom-vanity-tops.webp'
) v ON v.slug = c.slug
SET c.image_url = CONCAT(
      'https://images.bathroomvanitiesoutlet.com/site/category-cards/', v.f);
*/
