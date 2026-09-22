-- ═══════════════════════════════════════════════════════════════════
--  CATEGORY CARD IMAGES — replace hotlinked sources with owned ones
--  2026-09-16
--
--  WHAT THIS FIXES
--  Eight category cards point at encrypted-tbn0.gstatic.com (Google Images
--  CACHE KEYS, which rotate and expire on Google's schedule) or at other
--  retailers' bandwidth. OPEN_ITEMS item 6, cutover blocker.
--
--  Every replacement is a James Martin product shot from images.salsify.com
--  — imagery that ships with the feed and that BVO already serves 56,811 of.
--  Nothing new is sourced and there is no licensing question.
--
--  TOUCHES ONE COLUMN ON ONE TABLE: categories.image_url. Eight rows.
--
--  ─────────────────────────────────────────────────────────────────
--  WHY THE URLs CARRY A TRANSFORM
--
--  .cat-img is height:180px and .cat-img img is object-fit:cover, so the
--  browser crops whatever it is given to a ~280x180 landscape band. The
--  source shots are square (3500x3500) or portrait (3208x4808) — dropped in
--  raw, a portrait mirror renders as a horizontal slice through the middle
--  of the frame with the top and bottom of the mirror cut off.
--
--  Salsify is Cloudinary-backed, so the URLs are transformed server-side:
--
--      e_trim                    strip the surrounding white so the product
--                                fills the frame instead of floating in it
--      w_560,h_360               2x the rendered card box, for retina
--      c_pad,b_white             pad to the card's aspect on white rather
--                                than cropping the product
--      f_auto,q_auto             WebP where supported, auto quality
--
--  ⚠ The transform MUST come AFTER the s--SIGNATURE-- segment. Before it,
--  Salsify returns 404. Verified 2026-09-16, and recorded in OPEN_ITEMS
--  item 3 from the audit.
--
--  Side benefit: these render at roughly 25-40 KB instead of the multi-MB
--  originals, which is the same fix open item 3 wants applied catalogue-wide.
--
--  ─────────────────────────────────────────────────────────────────
--  NOT COVERED HERE — still hotlinked, still logged
--
--    Faucets   James Martin sells none. The Huntington Brass images are
--              themselves pulled from huntingtonbrass.com.
--    Lighting  No products in the feed to draw from at all.
--
--  And these four are admin-UI edits, not SQL:
--    Model tile   /admin/models  Brittany / James Martin Vanities
--    Product      /admin/products  Huntington Brass Sevaun Widespread
--    Hero x2      Theme Editor — they live in theme_settings.json, not a
--                 table, so no query will show them.
-- ═══════════════════════════════════════════════════════════════════

-- ── BEFORE ─────────────────────────────────────────────────────────
SELECT slug, name, image_url
  FROM categories
 WHERE image_url LIKE 'http%'
   AND image_url NOT LIKE '%salsify.com%'
   AND image_url NOT LIKE '%res.cloudinary.com%'
 ORDER BY slug;


-- ── 1. Bathroom Vanities ───────────────────────────────────────────
-- Bristol 60" Double Vanity, Saddle Brown w/ Victorian Silver top
-- Dark traditional with a marble top — reads as the flagship category.
UPDATE categories SET image_url =
  'https://images.salsify.com/image/upload/s--WhUSqwHq--/e_trim/w_560,h_360,c_pad,b_white,f_auto,q_auto/x9gov4lru1igl4wwjucn.jpg'
 WHERE slug = 'bathroom-vanities';

-- ── 2. Bathroom Vanities With Tops ─────────────────────────────────
-- Hudson 48" Single Vanity, Honey Oak w/ 3 CM Carrara Marble Top
-- Chosen because the top and the gold widespread faucet are unmistakable —
-- the card has to say "with top" at a glance to earn its slug.
UPDATE categories SET image_url =
  'https://images.salsify.com/image/upload/s--v0Fnkl7R--/e_trim/w_560,h_360,c_pad,b_white,f_auto,q_auto/ne8tvlqddxfszo1bmrrc.jpg'
 WHERE slug = 'bathroom-vanities-with-tops';

-- ── 3. Bathroom Vanity Cabinets (Cabinet Only) ─────────────────────
-- Solene 48" Single Vanity, Seaside Oak — NO top, open cut-outs visible.
-- The whole point of this category is "no countertop", and this shot shows
-- the bare carcass. A cabinet photographed with a top would undermine it.
UPDATE categories SET image_url =
  'https://images.salsify.com/image/upload/s--otOytQ9d--/e_trim/w_560,h_360,c_pad,b_white,f_auto,q_auto/nl4tfeoolculmabphyv0.jpg'
 WHERE slug = 'bathroom-vanity-cabinets';

-- ── 4. Bathroom Vanity Tops ────────────────────────────────────────
-- 60" Double Top, 3CM Phantome Eclos with two integrated sinks.
-- Dark stone against the white pad, so the slab edge is legible at 280px.
UPDATE categories SET image_url =
  'https://images.salsify.com/image/upload/s--X7blaha4--/e_trim/w_560,h_360,c_pad,b_white,f_auto,q_auto/trwj4dzlfqa0gshtkovc.jpg'
 WHERE slug = 'bathroom-vanity-tops';

-- ── 5. Bathroom Mirrors ────────────────────────────────────────────
-- Boston 30" Rectangular Mirror, Brushed Nickel.
-- Source is 3208x4808 portrait; e_trim + c_pad is what makes it usable in
-- a landscape card. Without the transform this one is a slice of frame.
UPDATE categories SET image_url =
  'https://images.salsify.com/image/upload/s--QSQZO60g--/e_trim/w_560,h_360,c_pad,b_white,f_auto,q_auto/phgrpt0vu6dvvlhfqrvl.jpg'
 WHERE slug = 'bathroom-mirrors';

-- ── 6. Storage ─────────────────────────────────────────────────────
-- Addison 12" Petite Tower Hutch, Mid-Century Acacia.
-- Preferred over the Milan white storage cabinet, which photographs as a
-- plain white box and would read as nothing at card size.
UPDATE categories SET image_url =
  'https://images.salsify.com/image/upload/s--Jl1R5o8I--/e_trim/w_560,h_360,c_pad,b_white,f_auto,q_auto/f1rndx4niiwbwujcxznp.jpg'
 WHERE slug = 'storage';

-- ── 7. Vanity Models ───────────────────────────────────────────────
-- Bristol 36" Single Vanity, Bright White.
-- White, so it sits apart from the two wood-finish vanity cards above it
-- in the same homepage row.
UPDATE categories SET image_url =
  'https://images.salsify.com/image/upload/s--nZ77HfgC--/e_trim/w_560,h_360,c_pad,b_white,f_auto,q_auto/g7zulsbmavttsve2mgy7.jpg'
 WHERE slug = 'vanity-models';

-- ── 8. Samples ─────────────────────────────────────────────────────
-- Wood Sample - Driftwood. A grain swatch fills the frame edge to edge,
-- which suits a category that IS the finish rather than a product.
UPDATE categories SET image_url =
  'https://images.salsify.com/image/upload/s--3RV9yiEV--/e_trim/w_560,h_360,c_pad,b_white,f_auto,q_auto/weqmm8frt7zxqjl3dc51.jpg'
 WHERE slug = 'samples';


-- ── AFTER ──────────────────────────────────────────────────────────
-- Expect only 'faucets' and 'lighting' to remain, both still hotlinked.
SELECT slug, name, image_url
  FROM categories
 WHERE image_url LIKE 'http%'
   AND image_url NOT LIKE '%salsify.com%'
   AND image_url NOT LIKE '%res.cloudinary.com%'
 ORDER BY slug;

-- And confirm all eight took (8 rows, every url on salsify):
SELECT slug, image_url
  FROM categories
 WHERE slug IN ('bathroom-vanities','bathroom-vanities-with-tops',
                'bathroom-vanity-cabinets','bathroom-vanity-tops',
                'bathroom-mirrors','storage','vanity-models','samples')
 ORDER BY slug;
