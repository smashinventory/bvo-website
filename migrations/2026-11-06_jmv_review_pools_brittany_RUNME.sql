-- ─────────────────────────────────────────────────────────────────────────
-- 2026-11-06_jmv_review_pools_brittany_RUNME.sql
--
-- First real capture: Brittany. Run in phpMyAdmin. Safe to run twice (the
-- unique key on (capture_batch, retailer, brand, collection, pool_key) turns
-- a re-run into an UPDATE rather than a duplicate).
--
-- RESULT ONCE LOADED:  4.5 / 407 reviews, spread 0.03 across two retailers.
-- The live page currently shows 4.5 / 143 from the hardcoded fallback, so the
-- rating does not move and the count roughly triples. Both are floors.
--
-- ⚠️ TWO SOURCES, TWO DIFFERENT KINDS OF NUMBER.
--
--   ferguson   — COMPLETE. Ferguson has a real collection page
--                (/james-martin-vanities-brittany/c82044939) that pages
--                deterministically. Walked pages 1-4, 44 SKUs with reviews,
--                zero SKU overlap, byte-identical across repeat runs. The
--                pool_key is Ferguson's own SKU id, so dedupe is principled
--                rather than coincidental.
--
--   home_depot — A FLOOR, NOT A CENSUS, AND DELIBERATELY THE LOWER READING.
--                Home Depot's search is NON-DETERMINISTIC: the identical
--                query run twice seconds apart returned 10 pools / 245
--                reviews and then 12 pools / 349. Three pools appeared in the
--                second run that were absent from the first. So a Home Depot
--                total cannot be reproduced, and the 245 below is the LOWER
--                of the two observations. Every pool in it is real; the set
--                is simply incomplete. Taking the lower reading is what keeps
--                the published claim true: "across N reviews" holds for any N
--                at or below the real total. Taking the higher one would not.
--
-- ⚠️ A HOME DEPOT POOL IS NOT A PRODUCT. One review pool is shared across
-- every finish of a model: six different Brittany 36" listings all report
-- exactly 47 reviews at 4.5957. pool_key here is the (rating/count) pair
-- precisely because that identifies the POOL. Keying on the product id would
-- have multiplied this collection roughly fourfold.
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO jmv_review_pools
  (capture_batch, brand, collection, retailer, pool_key, rating, review_count, source_url)
VALUES
-- ── FERGUSON — complete, keyed on Ferguson SKU ids ───────────────────────
('2026-11','James Martin Vanities','Brittany','ferguson','1526521',4.8889, 9,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1526522',4.8571, 7,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1526529',3.8571, 7,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1526532',4.2500,16,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1526538',4.3333, 3,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1526541',5.0000, 3,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1526543',5.0000, 1,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1526544',4.3333, 3,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1526547',3.6667, 3,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1561948',4.7500, 4,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1600552',4.6000, 5,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1605227',4.2000, 5,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1621232',4.7500, 8,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1630480',4.2000, 5,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1630481',4.8333, 6,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1630484',5.0000, 4,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1630489',3.5000, 2,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1630493',4.0000, 4,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1630495',5.0000, 3,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1630496',4.7500, 8,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1630497',4.0000, 4,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1630508',3.6667, 3,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1630510',5.0000, 1,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1840228',4.0000, 3,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1840230',5.0000, 1,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1840232',5.0000, 1,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1904018',5.0000, 4,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1904019',4.8750, 8,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1904021',3.8000, 5,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1904022',3.5000, 2,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1904023',5.0000, 1,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','1904024',4.5714, 7,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','2000009',5.0000, 1,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','2000013',2.0000, 1,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','2000017',5.0000, 1,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','2000505',5.0000, 2,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','2000509',5.0000, 3,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','2000511',5.0000, 1,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','2000513',5.0000, 2,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','2000517',5.0000, 1,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','2011197',5.0000, 1,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','2020203',5.0000, 1,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','2026062',5.0000, 1,'/james-martin-vanities-brittany/c82044939'),
('2026-11','James Martin Vanities','Brittany','ferguson','2067303',5.0000, 1,'/james-martin-vanities-brittany/c82044939'),

-- ── HOME DEPOT — the LOWER of two observations. Floor, not census. ───────
-- pool_key is the (rating/count) pair: that is what identifies a POOL,
-- which Home Depot shares across every finish of a model.
('2026-11','James Martin Vanities','Brittany','home_depot','4.5957/47',4.5957,47,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.5854/41',4.5854,41,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.5833/36',4.5833,36,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.5588/34',4.5588,34,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.5455/33',4.5455,33,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.2857/14',4.2857,14,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.7143/14',4.7143,14,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.2/10',   4.2000,10,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.1111/9', 4.1111, 9,'/s/james+martin+brittany+36'),
('2026-11','James Martin Vanities','Brittany','home_depot','4.8571/7', 4.8571, 7,'/s/james+martin+brittany+36')
ON DUPLICATE KEY UPDATE
  rating       = VALUES(rating),
  review_count = VALUES(review_count),
  source_url   = VALUES(source_url),
  captured_at  = NOW();


-- ── VERIFY ───────────────────────────────────────────────────────────────
SELECT retailer, COUNT(*) AS pools, SUM(review_count) AS reviews,
       ROUND(SUM(rating * review_count) / SUM(review_count), 2) AS weighted_avg
  FROM jmv_review_pools
 WHERE capture_batch = '2026-11' AND collection = 'Brittany'
 GROUP BY retailer WITH ROLLUP;
-- expect: ferguson 44 / 162 / 4.51
--         home_depot 10 / 245 / 4.54
--         (rollup)   54 / 407 / 4.53   -> the page will show 4.5 / 407

-- Nothing changes on the site until this row is published, and it already is:
SELECT collection, is_published FROM jmv_review_collections
 WHERE collection = 'Brittany';
-- expect is_published = 1, so the page switches from the hardcoded 143 to 407
-- on the next cache expiry (10 minutes) or app restart.
