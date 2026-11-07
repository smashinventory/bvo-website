-- ─────────────────────────────────────────────────────────────────────────
-- 2026-11-06_jmv_brittany_hd_RESTORE_RUNME.sql
--
-- ⚠️ THIS UNDOES THE PREVIOUS "CORRECTION". That correction was wrong.
--
-- Sequence of events, so nobody repeats it:
--
--   1. Captured Brittany with a loose regex pairing "productLabel" to
--      "averageRating" across up to 4,000 characters. Got 245. Loaded it.
--   2. Saw the pool 4.5588/34 appear under BOTH Brittany and Breckenridge
--      and concluded the regex was straddling product boundaries.
--   3. Rewrote the parser to split the page on "itemId" and read each
--      product's fields from within its own block. Got 212. Declared the 245
--      corrupt, deleted it, loaded 212.
--   4. The itemId parser then returned ZERO reviewed products for Bristol
--      and Myrrin on pages that plainly had them. Inspection showed why: on
--      some Home Depot pages "itemId" delimits COLOUR SWATCHES, not products
--      ("itemId":"330023082","label":"Mid-Century Walnut"). Those blocks
--      carry no productLabel, so the parser silently dropped real products.
--      212 was an UNDERCOUNT produced by a broken parser.
--
-- THE CORRECT EXTRACTION, confirmed by inspecting the markup: a product's
-- rating sits roughly 1,900 characters after its own "productLabel", and no
-- other productLabel intervenes. So bound each product's window by the NEXT
-- productLabel rather than by a fixed character count or by itemId:
--
--     const hits = [...html.matchAll(/"productLabel":"([^"]{0,160})"/g)];
--     for each hit i: slice from hits[i].index to hits[i+1].index
--     read averageRating and totalReviews from WITHIN that slice only
--
-- Under that parser Brittany 36" returns 245 on two consecutive runs, and the
-- original loose regex independently agreed at 245. Two different methods,
-- four runs, same answer. 212 came from one method that is now disproven.
--
-- ⚠️ AND 4.5588/34 WAS NEVER A BUG. Re-checked with the bounded parser: the
-- only product on the Breckenridge results page with 34 reviews is a
-- BRITTANY vanity, which Home Depot cross-lists into Breckenridge results.
-- The "^Breckenridge" name filter correctly excludes it. The thing that
-- looked like contamination was Home Depot showing a neighbouring product.
--
-- ⚠️ HOME DEPOT RESULT SETS REALLY DO VARY PER REQUEST. Separately proven
-- with the correct parser: Breckenridge 36" returned 4 pools / 15 reviews,
-- then 8 pools / 30 reviews, seconds apart. So a Home Depot figure is a
-- FLOOR and the rule stands: capture more than once and keep the LOWEST
-- reading. Brittany's 245 is the lowest of everything observed.
-- ─────────────────────────────────────────────────────────────────────────


-- ── 1. CLEAR THE UNDERCOUNTED ROWS ───────────────────────────────────────
DELETE FROM jmv_review_pools
 WHERE capture_batch = '2026-11'
   AND brand         = 'James Martin Vanities'
   AND collection    = 'Brittany'
   AND retailer      = 'home_depot';
-- expect 7 rows removed


-- ── 2. RESTORE THE VERIFIED TEN ──────────────────────────────────────────
-- /s/james+martin+brittany+36, bounded parser, identical on two runs, and
-- independently matched by the original regex. 10 pools, 245 reviews, 4.54.
INSERT INTO jmv_review_pools
  (capture_batch, brand, collection, retailer, pool_key, rating, review_count, source_url)
VALUES
('2026-11','James Martin Vanities','Brittany','home_depot','4.5957/47',4.5957,47,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.5854/41',4.5854,41,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.5833/36',4.5833,36,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.5588/34',4.5588,34,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.5455/33',4.5455,33,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.7143/14',4.7143,14,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.2857/14',4.2857,14,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.2/10',   4.2000,10,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.1111/9', 4.1111, 9,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.8571/7', 4.8571, 7,'/s/james+martin+brittany+36')
ON DUPLICATE KEY UPDATE
  rating       = VALUES(rating),
  review_count = VALUES(review_count),
  captured_at  = NOW();


-- ── 3. VERIFY ────────────────────────────────────────────────────────────
SELECT retailer, COUNT(*) AS pools, SUM(review_count) AS reviews,
       ROUND(SUM(rating * review_count) / SUM(review_count), 2) AS weighted_avg
  FROM jmv_review_pools
 WHERE capture_batch = '2026-11' AND collection = 'Brittany'
 GROUP BY retailer WITH ROLLUP;
-- expect: ferguson    44 / 162 / 4.51
--         home_depot  10 / 245 / 4.54
--         (rollup)    54 / 407 / 4.53   -> the page shows 4.5 / 407
