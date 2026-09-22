/* ============================================================================
   CATEGORY CARD IMAGES — point seven cards at Bunny
   2026-09-17

   SUPERSEDES migrations/2026-09-16_category_card_images.sql, which pointed the
   same cards at images.salsify.com. Run this one; do not run that one. If that
   one was already run, this simply overwrites the same seven rows.

   WHAT THIS FIXES
   ---------------
   Seven category cards point at encrypted-tbn0.gstatic.com — Google Images
   CACHE KEYS, which rotate and expire on Google's schedule. When they expire
   the homepage category row goes blank and nothing in any log says why.
   HOTLINKED_IMAGES_HANDOFF.md section A; cutover blocker.

   TOUCHES ONE COLUMN ON ONE TABLE: categories.image_url. Seven rows.

   ─────────────────────────────────────────────────────────────────────────
   WHY THE FILES ARE PRE-RENDERED RATHER THAN TRANSFORMED AT THE EDGE

   The handoff called for "resize to ~560x360, padded rather than cropped."
   Bunny Optimizer cannot pad. Its Dynamic Image API offers crop, aspect_ratio
   and crop_gravity — all three remove pixels — and has no background, pad,
   canvas or fit parameter (docs verified 2026-09-17). So ?width=560&height=360
   would crop to precisely the band object-fit:cover already crops to: fewer
   bytes, identical bad framing on the tall shots.

   Instead each card was rendered once from the same master already in Bunny:
   surrounding white trimmed, product scaled to fit with a 4% margin, padded
   to 560x360 on the shot's own background, saved WebP q90. 560x360 is 2x the
   rendered 280x180 card, so retina stays sharp and object-fit:cover has
   nothing left to crop. Generator: jmv_sync/make_category_cards.py.

   87 KB for all seven, against 3,591 KB for the seven originals.

   ─────────────────────────────────────────────────────────────────────────
   PREREQUISITE — THE FILES MUST BE IN BUNNY FIRST

   Run jmv_sync/bunny_upload_cards.sh before this migration, or all seven
   cards go blank. Confirm with Step 1.
   ============================================================================ */


/* --- STEP 1 — the files are live. Run this in a BROWSER, not here. --------
   Each should return an image, not a 404:

   https://images.bathroomvanitiesoutlet.com/site/category-cards/bathroom-vanities.webp
   https://images.bathroomvanitiesoutlet.com/site/category-cards/bathroom-vanities-with-tops.webp
   https://images.bathroomvanitiesoutlet.com/site/category-cards/bathroom-vanity-cabinets.webp
   https://images.bathroomvanitiesoutlet.com/site/category-cards/bathroom-vanity-tops.webp
   https://images.bathroomvanitiesoutlet.com/site/category-cards/bathroom-mirrors.webp
   https://images.bathroomvanitiesoutlet.com/site/category-cards/storage.webp
   https://images.bathroomvanitiesoutlet.com/site/category-cards/vanity-models.webp
   -------------------------------------------------------------------------- */


/* --- STEP 2 — what is there now. Read only. Keep this output. ------------- */

SELECT id, slug, name, image_url AS old_image_url
FROM categories
WHERE slug IN ('bathroom-vanities','bathroom-vanities-with-tops',
               'bathroom-vanity-cabinets','bathroom-vanity-tops',
               'bathroom-mirrors','storage','vanity-models')
ORDER BY sort_order, slug;

/*  Expect seven rows, every image_url on encrypted-tbn0.gstatic.com.
    Save this result — it is the only record of the old values.              */


/* --- STEP 3 — the write. -------------------------------------------------- */

UPDATE categories c
JOIN (
  SELECT 'bathroom-vanities'            AS slug, 'bathroom-vanities.webp'            AS f
  UNION ALL SELECT 'bathroom-vanities-with-tops', 'bathroom-vanities-with-tops.webp'
  UNION ALL SELECT 'bathroom-vanity-cabinets',    'bathroom-vanity-cabinets.webp'
  UNION ALL SELECT 'bathroom-vanity-tops',        'bathroom-vanity-tops.webp'
  UNION ALL SELECT 'bathroom-mirrors',            'bathroom-mirrors.webp'
  UNION ALL SELECT 'storage',                     'storage.webp'
  UNION ALL SELECT 'vanity-models',               'vanity-models.webp'
) v ON v.slug = c.slug
SET c.image_url = CONCAT(
      'https://images.bathroomvanitiesoutlet.com/site/category-cards/', v.f);

/*  UNION ALL rather than VALUES ... AS t(cols): this server is MariaDB and
    the VALUES table-constructor form is MySQL 8 only.                       */


/* --- STEP 4 — verify. ----------------------------------------------------- */

SELECT slug, image_url
FROM categories
WHERE slug IN ('bathroom-vanities','bathroom-vanities-with-tops',
               'bathroom-vanity-cabinets','bathroom-vanity-tops',
               'bathroom-mirrors','storage','vanity-models')
ORDER BY sort_order, slug;

/* Then the handoff's own audit query — it should come back with Samples and
   Faucets and nothing else from the categories block. Note the added Bunny
   exclusion, without which every replacement reports itself as a problem.   */

SELECT 'category' AS what, name AS label, slug AS ref, image_url AS url
  FROM categories
 WHERE image_url LIKE 'http%'
   AND image_url NOT LIKE '%salsify.com%'
   AND image_url NOT LIKE '%res.cloudinary.com%'
   AND image_url NOT LIKE '%images.bathroomvanitiesoutlet.com%';


/* --- ROLLBACK ------------------------------------------------------------- */

/*  There is no generated rollback: the old values are Google cache keys that
    cannot be reconstructed. That is the whole reason for this migration.
    Restore from the Step 2 output if it is ever needed, and understand that
    those URLs may already have expired.                                     */


/* --- AFTERWARDS ----------------------------------------------------------- */

/*  Still hotlinked after this runs, both known and logged:
      Samples  — bathvanityexperts.com. Pulled from this batch by the owner.
      Faucets  — gstatic. Now fixable: Huntington Brass imagery reached Bunny
                 after the handoff list was compiled. Awaiting a pick.
      Lighting — being deactivated (categories.is_active = 0), so it stops
                 rendering anywhere rather than being repointed.
    Plus, outside the categories table: the model tile, one HB product, and
    the two hero images in the Theme Editor.                                 */
