-- rename_accessories_category.sql — run once, 2026-10-06
--
-- WHY
--
-- The Accessories collection filters on product_type, and one of its values
-- is literally "Bathroom Accessories" — the same phrase the parent category
-- carried as its name, H1 and title. Promoting that filter to a self-
-- canonical landing page would have put a child page and its own parent in
-- competition for one term, which is the opposite of the point.
--
-- Sam's call: rename the parent to "Accessories". That is honest — the
-- collection is a genuinely mixed set (Huntington Brass hardware and drains,
-- James Martin vanity parts and benches) — and it hands the specific phrase
-- to the specific page that actually holds towel bars, rings, robe hooks and
-- paper holders.
--
-- AFTER THIS RUNS:
--   /collections/accessories                              H1 "Accessories"
--   /collections/accessories/accessory-type/
--       bathroom-accessories                              H1 "Bathroom
--                                                         Accessories —
--                                                         Towel Bars, Hooks
--                                                         & Rings"
--
-- The child page's copy lives in src/config/filterLandingPages.js under
-- ACCESSORY_TYPE. The comment on that entry points back here. If this rename
-- is ever reverted, that entry has to change too or the two pages fight
-- again.
--
-- The meta_title is changed as well, and deliberately. Leaving it as
-- "Bathroom Accessories- James Martin & Huntington Brass" would keep the
-- parent targeting the exact phrase we just handed to the child, so the
-- rename would have achieved nothing where it actually counts.
--
-- Nothing else keys off categories.name: the slug stays 'accessories', so
-- every URL, every link and every clean path is unchanged. This is display
-- text and SEO text only.

START TRANSACTION;

-- What it looks like now, for the record if this has to be undone:
--   name       = 'Bathroom Accessories'
--   meta_title = 'Bathroom Accessories- James Martin & Huntington Brass'
SELECT id, slug, name, meta_title, meta_desc
  FROM categories
 WHERE slug = 'accessories';

UPDATE categories
   SET name       = 'Accessories',
       meta_title = 'Bathroom Hardware, Drains & Vanity Parts',
       meta_desc  = 'Bathroom hardware, pop-up drains, vanity knob and leg '
                    'sets, stainless steel bases and upholstered benches '
                    'from Huntington Brass and James Martin Vanities.'
 WHERE slug = 'accessories'
   AND name = 'Bathroom Accessories';   -- no-op if already renamed

-- Must report exactly 1 row changed the first time, 0 on a re-run.
SELECT ROW_COUNT() AS rows_changed;

SELECT id, slug, name, meta_title, meta_desc
  FROM categories
 WHERE slug = 'accessories';

COMMIT;

-- TO UNDO:
-- UPDATE categories
--    SET name       = 'Bathroom Accessories',
--        meta_title = 'Bathroom Accessories- James Martin & Huntington Brass',
--        meta_desc  = 'Towel bars, toilet paper holders, knobs and more. '
--                     'Customize your bathroom with high quality accessories '
--                     'from major brands.'
--  WHERE slug = 'accessories';
-- ...and change the crumb/h1/title on the 'Bathroom Accessories' entry in
-- src/config/filterLandingPages.js back to something that does not collide.
