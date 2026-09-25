-- ═══════════════════════════════════════════════════════════════════
--  Myrrin (485) cabinet-only lead images — promote the bare-cabinet shot
--
--  WHAT WAS WRONG
--  ──────────────
--  James Martin photographs several Myrrin cabinet-only SKUs with a stone
--  countertop and faucet fitted. Those products ship WITHOUT a top. A
--  shopper on /collections/bathroom-vanity-cabinets sees a finished vanity
--  and pays a cabinet-only price — the kind of mismatch that turns into a
--  dispute after delivery, not a bounce.
--
--  This is NOT a filter fault. Every SKU below is correctly typed
--  'Single Sink Cabinet Only' / 'Double Sink Cabinet Only' and correctly
--  priced. The product_type filter in collectionsController.js (~line 319)
--  is doing its job. Only the photography is wrong.
--
--  For these seven, image 2 IS a clean closed-front bare-cabinet shot —
--  so this is a free fix, no vendor request needed.
--
--
--  WHY match_suffix IS A FULL FILENAME HERE
--  ────────────────────────────────────────
--  The two rows from 2026-09-24 use the bare suffix '-2.webp', which means
--  "promote whatever is currently second". If JM inserts a photo and
--  renumbers, that silently promotes a DIFFERENT image — possibly a worse
--  one — and nothing logs.
--
--  A full filename pins one specific photograph. If it stops matching, the
--  importer leaves the order alone and logs the miss (applyLeadOverride,
--  importJamesMartinFeed.js ~line 447). Failing loudly to the feed's own
--  order beats silently promoting an unreviewed image.
--
--  Prefer this form for new rows.
-- ═══════════════════════════════════════════════════════════════════


INSERT INTO product_image_overrides (sku, match_suffix, note) VALUES
  ('485-V36-CBO',    'myrrin-36-carbon-oak-485-v36-cbo-2.webp',
   'Myrrin 36in Carbon Oak: image 1 has a white stone top and gold faucet fitted; product is cabinet only. Image 2 is the bare cabinet, closed front.'),
  ('485-V36-WLT',    'myrrin-36-mid-century-walnut-485-v36-wlt-2.webp',
   'Myrrin 36in Walnut: image 1 has a top and faucet fitted; product is cabinet only. Image 2 is the bare cabinet, closed front.'),
  ('485-V48-M-CBO',  'myrrin-48-carbon-oak-485-v48-m-cbo-2.webp',
   'Myrrin 48in Carbon Oak: image 1 has a top and faucet fitted; product is cabinet only. Image 2 is the bare cabinet, closed front.'),
  ('485-V48-M-WLT',  'myrrin-48-mid-century-walnut-485-v48-m-wlt-2.webp',
   'Myrrin 48in Walnut: image 1 has a top and faucet fitted; product is cabinet only. Image 2 is the bare cabinet, closed front.'),
  ('485-V60D-CBO',   'myrrin-60-carbon-oak-485-v60d-cbo-2.webp',
   'Myrrin 60in Carbon Oak: image 1 has a top and two faucets fitted; product is cabinet only. Image 2 is the bare cabinet, closed front.'),
  ('485-V60D-M-WLT', 'myrrin-60-mid-century-walnut-485-v60d-m-wlt-2.webp',
   'Myrrin 60in Walnut: image 1 has a top and two faucets fitted; product is cabinet only. Image 2 is the bare cabinet, closed front.'),
  ('485-V72-M-CBO',  'myrrin-72-carbon-oak-485-v72-m-cbo-2.webp',
   'Myrrin 72in Carbon Oak: image 1 has a top and two faucets fitted; product is cabinet only. Image 2 is the bare cabinet, closed front.')
ON DUPLICATE KEY UPDATE
  match_suffix = VALUES(match_suffix),
  note         = VALUES(note),
  is_active    = 1;


-- ── Corrections to the 2026-09-24 rows ──────────────────────────────
--
-- 655-V36-PCN was labelled "Palisades 36in Pecan". It is BRITTANY.
-- Verified against the live catalogue: model = 'Brittany'. The wrong
-- model name in a note is how the next person re-investigates a SKU
-- that was already settled.
UPDATE product_image_overrides
   SET note = 'Brittany 36in Pecan: image 1 is a flat overhead into the open carcass. Image 2 is the only view showing shape, legs and finish. No closed-front shot exists in the set — raised with James Martin 2026-09-24.'
 WHERE sku = '655-V36-PCN';

UPDATE product_image_overrides
   SET note = 'Chicago 30in Smokey Celadon: image 1 is a flat overhead into the open carcass. Image 2 is a doors-open view — best available. No closed-front shot exists in the set — raised with James Martin 2026-09-24.'
 WHERE sku = '503-V30-SC';


-- ── Correction to a claim in 2026-09-24_product_image_overrides.sql ──
--
-- That file states: "All 289 James Martin vanity cabinets were reviewed
-- image by image. These are the only two whose lead shot fails to show
-- the product."
--
-- The second sentence is FALSE. The 2026-09-24 pass caught only overhead
-- and crate shots. A rescan on 2026-09-25, checking specifically for a
-- countertop fitted to a cabinet-only SKU, found 28 more:
--
--   Myrrin  (485) —  8 SKUs, 7 fixed here, 485-V72-M-WLT has no alternate
--   Lorelai (424) — 20 SKUs, ALL need vendor photography (every image 2
--                   is a rear/interior cutaway, unusable as a lead)
--
-- The other 261 JM cabinet SKUs are clean. See
-- migrations/CABINET_LEAD_IMAGE_REVIEW.md for the full SKU lists.
--
-- That file also warns "if this grows past a dozen the answer is better
-- photography from the vendor, not more rows". This takes the table to 9.
-- The 20 Lorelai SKUs are deliberately NOT added — they are a vendor
-- request, exactly as that note intends.


-- Verify:
--   SELECT sku, match_suffix FROM product_image_overrides
--    WHERE is_active = 1 ORDER BY sku;
--   -> 9 rows
--
-- Then the change is live after the next JM import (04:30) and the
-- catalogue rebuild that follows. To see it sooner, run the import by
-- hand, then trigger a rebuild.
