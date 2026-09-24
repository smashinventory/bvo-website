-- ═══════════════════════════════════════════════════════════════════
--  product_image_overrides — pin a better lead image per SKU
--
--  WHY THIS EXISTS
--  ───────────────
--  James Martin's feed decides image order, and image 1 becomes the lead
--  shot everywhere: bundle builder cards, collection grids, search
--  results, the product page gallery. For a small number of SKUs that
--  first image is unusable — a flat overhead into an open carcass, or a
--  shipping crate — and the shopper cannot tell what the vanity looks
--  like.
--
--  Editing product_images by hand does NOT work. importJamesMartinFeed.js
--  DELETEs every row for a product and re-INSERTs from the feed on each
--  run (see replaceImages()). A manual reorder survives until 04:30 the
--  next morning and then silently reverts, with nothing logged. This
--  table is the supported way to express "we prefer a different lead
--  shot", and the importer applies it on every run.
--
--  HOW THE MATCH WORKS
--  ───────────────────
--  match_suffix is compared against the END of the image URL, so it
--  survives the Bunny CDN host rewrite (the same file is matched whether
--  it is still on images.salsify.com or already on the CDN). JM's
--  filenames are per-SKU and end -1.webp, -2.webp, ... so '-2.webp'
--  means "promote the second image".
--
--  If nothing matches, the importer leaves the order alone and logs it.
--  An override that stops matching is a quiet no-op, not a crash.
--
--  THIS IS NOT A PLACE FOR BULK EDITS. Two rows today. If this grows past
--  a dozen the answer is better photography from the vendor, not more
--  rows — see the note on each row below.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS product_image_overrides (
  sku           VARCHAR(64)  NOT NULL,

  -- Matched against the END of the image URL. Usually '-2.webp'.
  match_suffix  VARCHAR(64)  NOT NULL,

  -- Why. Shown in the importer log and read by whoever finds this later.
  note          VARCHAR(255) NULL,

  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── The two SKUs found by the 2026-09-24 review ─────────────────────
--
-- All 289 James Martin vanity cabinets were reviewed image by image.
-- These are the only two whose lead shot fails to show the product.
--
-- Both replacements are image 2, a three-quarter view. NEITHER SKU HAS A
-- CLOSED-FRONT SHOT — James Martin photographed the sibling finishes of
-- the same cabinet head-on but not these. Worth raising with them; if
-- better photography arrives, delete the row rather than editing it.

INSERT INTO product_image_overrides (sku, match_suffix, note) VALUES
  ('503-V30-SC',  '-2.webp',
   'Chicago 30in Smokey Celadon: image 1 is a flat overhead into the open carcass. Image 2 is the only view showing shape, legs and finish. No closed-front shot exists in the set.'),
  ('655-V36-PCN', '-2.webp',
   'Palisades 36in Pecan: image 1 is a shipping crate. Image 2 is the product. No closed-front shot exists in the set.')
ON DUPLICATE KEY UPDATE
  match_suffix = VALUES(match_suffix),
  note         = VALUES(note),
  is_active    = 1;


-- Expected afterwards:
--   SELECT sku, match_suffix FROM product_image_overrides WHERE is_active = 1;
--   -> 2 rows
