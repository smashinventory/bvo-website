-- ─────────────────────────────────────────────────────────────────────────
-- 2026-11-06_jmv_pools_bristol_myrrin_RUNME.sql
--
-- Captures Bristol and Myrrin. Run in phpMyAdmin. Safe to run twice.
--
-- RESULT:
--   Bristol  4.4 / 220  (live now: 4.3 / 184 from the hardcoded fallback)
--   Myrrin   4.9 /  40  (live now: 4.9 /  33)
--
-- Both clear both publish rules on two retailers:
--   Bristol  ferguson 127 @ 4.48 | home_depot 93 @ 4.31 | spread 0.17
--   Myrrin   ferguson  30 @ 4.87 | home_depot 10 @ 5.00 | spread 0.13
--
-- ⚠️ BRISTOL'S RATING DROPS, 4.3 -> 4.4. It goes UP, but note it moved at
-- all: the hardcoded 4.3 came from a partial sample. This is the figure the
-- data supports.
--
-- ─────────────────────────────────────────────────────────────────────────
-- HOW THESE WERE CAPTURED — follow this exactly, the alternatives are wrong
--
-- FERGUSON (complete, deterministic). Search "james martin <collection>
-- vanity"; it redirects to a real collection page (/james-martin-vanities-
-- bristol/c82044943). Walk ?page=1,2,3... deduping by Ferguson's own SKU id.
--   ⚠️ STOP WHEN A PAGE REPEATS SKUs YOU HAVE ALREADY SEEN. Ferguson wraps
--   back to page 1 past the last page rather than returning empty. Summing
--   pages blindly double-counts. Breckenridge page 3 returned page 1 exactly.
--
-- HOME DEPOT (a floor, not a census). Per-product parsing, bounded by the
-- NEXT product label:
--     const hits=[...html.matchAll(/"productLabel":"([^"]{0,160})"/g)];
--     slice from hits[i].index to hits[i+1].index, read averageRating and
--     totalReviews from WITHIN that slice only.
--   ⚠️ DO NOT SPLIT ON "itemId". On some pages itemId delimits COLOUR
--   SWATCHES, not products ("itemId":"330023082","label":"Mid-Century
--   Walnut"), and the parser silently returns ZERO reviewed products on
--   pages that plainly have them. That mistake produced a wrong Brittany
--   figure that reached the live site.
--   ⚠️ DO NOT use one loose regex spanning a fixed character count either.
--   Home Depot packs products close together and the match runs past the end
--   of one product into the next.
--   ⚠️ CAPTURE TWICE AND KEEP THE LOWER READING. Home Depot result sets
--   genuinely vary per request — Breckenridge 36" returned 15 then 30
--   reviews seconds apart under the correct parser. Both figures below were
--   identical on two consecutive runs.
--
-- A Home Depot pool is shared across every finish of a model, so pool_key is
-- the (rating/count) pair, which identifies the POOL. Ferguson counts per
-- SKU, so its pool_key is the SKU id.
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO jmv_review_pools
  (capture_batch, brand, collection, retailer, pool_key, rating, review_count, source_url)
VALUES
-- ══ BRISTOL — Ferguson, pages 1-2 of /james-martin-vanities-bristol/c82044943
('2026-11','James Martin Vanities','Bristol','ferguson','1526353',4.6857,35,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1526354',4.3750, 8,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1526358',4.1667, 6,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1526361',5.0000, 1,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1526364',5.0000, 3,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1526367',5.0000, 1,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1526369',5.0000, 3,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1621186',4.6667, 3,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1621187',2.8000, 5,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1631342',4.5000, 2,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1631353',4.7500, 4,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1631367',5.0000, 2,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1631371',4.0000, 3,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1631372',5.0000, 2,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1631381',4.0000, 1,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1631406',5.0000, 2,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1672152',4.6667, 6,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1688485',3.6667, 3,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1688488',5.0000, 2,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1840079',5.0000, 2,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1840081',4.0000, 1,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1840087',5.0000, 1,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1903964',4.0000, 4,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1903965',3.6667, 3,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1903966',5.0000, 4,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1903967',3.5714, 7,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','1903969',4.7500, 4,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','2000405',5.0000, 1,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','2000413',5.0000, 3,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','2000421',5.0000, 2,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','2000427',5.0000, 1,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','2000428',4.0000, 1,'/james-martin-vanities-bristol/c82044943'),
('2026-11','James Martin Vanities','Bristol','ferguson','2103082',5.0000, 1,'/james-martin-vanities-bristol/c82044943'),
-- ══ BRISTOL — Home Depot, /s/james+martin+bristol+48, identical on 2 runs
('2026-11','James Martin Vanities','Bristol','home_depot','4.3333/24',4.3333,24,'/s/james+martin+bristol+48'),
('2026-11','James Martin Vanities','Bristol','home_depot','4.3043/23',4.3043,23,'/s/james+martin+bristol+48'),
('2026-11','James Martin Vanities','Bristol','home_depot','4.2727/22',4.2727,22,'/s/james+martin+bristol+48'),
('2026-11','James Martin Vanities','Bristol','home_depot','4.2381/21',4.2381,21,'/s/james+martin+bristol+48'),
('2026-11','James Martin Vanities','Bristol','home_depot','5/3',      5.0000, 3,'/s/james+martin+bristol+48'),

-- ══ MYRRIN — Ferguson, pages 1-2 of /james-martin-vanities-myrrin/c82046273
('2026-11','James Martin Vanities','Myrrin','ferguson','1997884',5.0000, 6,'/james-martin-vanities-myrrin/c82046273'),
('2026-11','James Martin Vanities','Myrrin','ferguson','1997885',5.0000, 2,'/james-martin-vanities-myrrin/c82046273'),
('2026-11','James Martin Vanities','Myrrin','ferguson','1997887',5.0000, 1,'/james-martin-vanities-myrrin/c82046273'),
('2026-11','James Martin Vanities','Myrrin','ferguson','1997888',5.0000, 2,'/james-martin-vanities-myrrin/c82046273'),
('2026-11','James Martin Vanities','Myrrin','ferguson','1997891',5.0000, 1,'/james-martin-vanities-myrrin/c82046273'),
('2026-11','James Martin Vanities','Myrrin','ferguson','1997896',5.0000, 6,'/james-martin-vanities-myrrin/c82046273'),
('2026-11','James Martin Vanities','Myrrin','ferguson','1997897',5.0000, 2,'/james-martin-vanities-myrrin/c82046273'),
('2026-11','James Martin Vanities','Myrrin','ferguson','1997900',3.0000, 2,'/james-martin-vanities-myrrin/c82046273'),
('2026-11','James Martin Vanities','Myrrin','ferguson','1997909',5.0000, 2,'/james-martin-vanities-myrrin/c82046273'),
('2026-11','James Martin Vanities','Myrrin','ferguson','1997910',5.0000, 1,'/james-martin-vanities-myrrin/c82046273'),
('2026-11','James Martin Vanities','Myrrin','ferguson','1997919',5.0000, 1,'/james-martin-vanities-myrrin/c82046273'),
('2026-11','James Martin Vanities','Myrrin','ferguson','1997921',5.0000, 1,'/james-martin-vanities-myrrin/c82046273'),
('2026-11','James Martin Vanities','Myrrin','ferguson','1997922',5.0000, 1,'/james-martin-vanities-myrrin/c82046273'),
('2026-11','James Martin Vanities','Myrrin','ferguson','1997929',5.0000, 2,'/james-martin-vanities-myrrin/c82046273'),
-- ══ MYRRIN — Home Depot, /s/james+martin+myrrin+36, identical on 2 runs
('2026-11','James Martin Vanities','Myrrin','home_depot','5/7',5.0000,7,'/s/james+martin+myrrin+36'),
('2026-11','James Martin Vanities','Myrrin','home_depot','5/2',5.0000,2,'/s/james+martin+myrrin+36'),
('2026-11','James Martin Vanities','Myrrin','home_depot','5/1',5.0000,1,'/s/james+martin+myrrin+36')
ON DUPLICATE KEY UPDATE
  rating       = VALUES(rating),
  review_count = VALUES(review_count),
  source_url   = VALUES(source_url),
  captured_at  = NOW();


-- ── VERIFY ───────────────────────────────────────────────────────────────
SELECT collection, retailer, COUNT(*) AS pools, SUM(review_count) AS reviews,
       ROUND(SUM(rating * review_count) / SUM(review_count), 2) AS weighted_avg
  FROM jmv_review_pools
 WHERE capture_batch = '2026-11' AND collection IN ('Bristol','Myrrin')
 GROUP BY collection, retailer WITH ROLLUP;
-- expect Bristol: ferguson 33 / 127 / 4.48, home_depot 5 / 93 / 4.31, sub 38 / 220 / 4.41
--        Myrrin : ferguson 14 /  30 / 4.87, home_depot 3 / 10 / 5.00, sub 17 /  40 / 4.90

-- All three published collections, after this runs:
SELECT c.collection, c.is_published,
       SUM(p.review_count) AS reviews,
       ROUND(SUM(p.rating*p.review_count)/SUM(p.review_count),1) AS shown_rating
  FROM jmv_review_collections c
  JOIN jmv_review_pools p
    ON p.brand = c.brand AND p.collection = c.collection
 WHERE p.capture_batch = '2026-11'
 GROUP BY c.collection, c.is_published
 ORDER BY reviews DESC;
-- expect Brittany 407 / 4.5, Bristol 220 / 4.4, Myrrin 40 / 4.9
