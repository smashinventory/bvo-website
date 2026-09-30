-- ═══════════════════════════════════════════════════════════════════════
-- 028_hero_card_framing.sql — measured product geometry per hero image
--
-- Owner-approved 2026-09-29 after a full survey (scripts/surveyHeroFill.js)
-- and two side-by-side mockups.
--
-- WHAT IS STORED, AND WHAT IS NOT
--   Only MEASUREMENTS: where the product sits inside its own source image.
--   No CSS, no pixel positions, no card dimensions. src/utils/cardFraming.js
--   turns these into a style at render time.
--
--   Kept apart on purpose. The card box is 210px tall today; if that ever
--   changes, or the target framing is retuned, it is one constant in one
--   JS file — not a 6,000-row UPDATE.
--
-- WHY KEYED ON source_url AND NOT product_id
--   importJamesMartinFeed.js and importHuntingtonBrass.js DELETE and
--   re-INSERT every product_images row on each run. That is how 56,623
--   rows reverted to Salsify URLs on 2026-09-17. A product_id key would
--   be orphaned at the next import and every card would silently revert.
--
--   cdnUrl.js rewrites vendor URLs to the same Bunny path deterministically,
--   so the URL survives. Several SKUs also share one master (10 of them on
--   2026-09-29) and keying on the image stores that geometry once.
--
-- NOTHING HERE TOUCHES AN IMAGE
--   No file is generated, uploaded, cropped or replaced. The storefront
--   keeps requesting the exact same URLs it requests today, with the same
--   srcset ladder off the same CDN. This table only says where in the
--   frame the product happens to be.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS hero_card_framing (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,

  /* The image this describes. 500 chars matches product_images.url. */
  source_url  VARCHAR(500) NOT NULL,

  /* Source canvas, pixels. */
  src_w       SMALLINT UNSIGNED NOT NULL,
  src_h       SMALLINT UNSIGNED NOT NULL,

  /* Product bounding box as a percentage of each axis. Percentages, not
     pixels, so the numbers stay valid whatever size the CDN serves. */
  fill_w      DECIMAL(5,2) NOT NULL,
  fill_h      DECIMAL(5,2) NOT NULL,

  /* Bounding-box centre offset from canvas centre, % of each axis.
     Signed: positive x is right, positive y is DOWN. This is the
     stagger — 537 vanities are more than 10px out once rendered. */
  off_x       DECIMAL(6,2) NOT NULL DEFAULT 0,
  off_y       DECIMAL(6,2) NOT NULL DEFAULT 0,

  /* 1 = white or transparent background cutout, safe to reframe.
     0 = lifestyle/room shot, or the product touches a canvas corner.
     Rows with 0 are stored for the record but MUST NOT be reframed:
     zooming a room scene crops the room. */
  bg_white    TINYINT(1) NOT NULL DEFAULT 0,

  /* Product type at measurement time. The fix is scoped to vanities and
     cabinets; a 15" linen top legitimately fills 20% of its frame and
     must not be enlarged to match a double vanity. */
  product_type VARCHAR(100) DEFAULT NULL,

  measured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_source (source_url),
  KEY idx_type (product_type, bg_white)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
