-- ─────────────────────────────────────────────────────────────────────────
-- 2026-11-06_jmv_pools_wave2_RUNME.sql
--
-- Adds the four collections unlocked by lowering MIN_REVIEWS from 30 to 5:
-- Addison, Laurent, Lorelai, Breckenridge.
--
-- Run in phpMyAdmin against the BVO database. Safe to run twice — uniq_pool
-- makes the INSERT idempotent.
--
-- ⚠️ NO information_schema. This DB user is denied it (#1044).
--
-- POOL KEYS. Ferguson is keyed by SKU: each listing has its own review set,
-- so every SKU is a distinct pool. Home Depot is keyed by "<rating>/<count>"
-- because HD shares one pool across every finish of a model — six Brittany
-- 36" tiles all report 47 @ 4.5957 because it is ONE pool shown six times.
-- Keying HD by listing would inflate its counts severalfold.
--
-- HOME DEPOT FIGURES ARE FLOORS. HD search result sets genuinely vary per
-- request (Breckenridge 36 returned 15 reviews on one run and 30 on another).
-- These are the LOWEST observation across runs, deliberately.
--
-- BRECKENRIDGE IS AN OVERRIDE, NOT A DERIVED FIGURE. See section 3.
-- ─────────────────────────────────────────────────────────────────────────


-- ── 1. THE RAW CAPTURE ───────────────────────────────────────────────────
INSERT INTO jmv_review_pools
  (capture_batch, brand, collection, retailer, pool_key, rating, review_count)
VALUES
  ('2026-11','James Martin Vanities','Addison','ferguson','1731061',5.0000,2),
  ('2026-11','James Martin Vanities','Addison','ferguson','1731071',5.0000,1),
  ('2026-11','James Martin Vanities','Addison','ferguson','1731072',2.3333,3),
  ('2026-11','James Martin Vanities','Addison','ferguson','1731075',5.0000,1),
  ('2026-11','James Martin Vanities','Addison','ferguson','1731076',5.0000,1),
  ('2026-11','James Martin Vanities','Addison','ferguson','1781097',5.0000,1),
  ('2026-11','James Martin Vanities','Addison','ferguson','1820344',5.0000,1),
  ('2026-11','James Martin Vanities','Addison','ferguson','1904043',5.0000,1),
  ('2026-11','James Martin Vanities','Addison','ferguson','1904045',5.0000,1),
  ('2026-11','James Martin Vanities','Addison','ferguson','1904046',5.0000,1),
  ('2026-11','James Martin Vanities','Laurent','ferguson','1887750',5.0000,1),
  ('2026-11','James Martin Vanities','Laurent','ferguson','1887765',5.0000,1),
  ('2026-11','James Martin Vanities','Laurent','ferguson','1887770',5.0000,1),
  ('2026-11','James Martin Vanities','Laurent','ferguson','1963937',5.0000,1),
  ('2026-11','James Martin Vanities','Laurent','ferguson','2000473',4.5000,2),
  ('2026-11','James Martin Vanities','Laurent','ferguson','2000477',5.0000,1),
  ('2026-11','James Martin Vanities','Laurent','ferguson','2055379',5.0000,1),
  ('2026-11','James Martin Vanities','Laurent','ferguson','2055396',2.0000,1),
  ('2026-11','James Martin Vanities','Laurent','ferguson','2055397',1.0000,1),
  ('2026-11','James Martin Vanities','Laurent','ferguson','2092111',1.0000,1),
  ('2026-11','James Martin Vanities','Lorelai','ferguson','1997832',5.0000,1),
  ('2026-11','James Martin Vanities','Lorelai','ferguson','1997833',5.0000,1),
  ('2026-11','James Martin Vanities','Lorelai','ferguson','1997835',4.0000,1),
  ('2026-11','James Martin Vanities','Lorelai','ferguson','1997839',5.0000,2),
  ('2026-11','James Martin Vanities','Lorelai','ferguson','1997844',5.0000,1),
  ('2026-11','James Martin Vanities','Lorelai','ferguson','1997857',5.0000,1),
  ('2026-11','James Martin Vanities','Lorelai','ferguson','1997870',5.0000,1),
  ('2026-11','James Martin Vanities','Lorelai','ferguson','2092064',5.0000,1),
  ('2026-11','James Martin Vanities','Lorelai','ferguson','2092074',5.0000,1),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','1887662',5.0000,1),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','1887670',4.3333,3),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','1887672',5.0000,2),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','1887677',4.6667,3),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','1887697',5.0000,1),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','1925137',4.4444,9),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','1963931',4.6667,3),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','1963932',5.0000,2),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','1963933',4.1429,7),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','1997816',5.0000,1),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','1997820',5.0000,3),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','1997828',5.0000,3),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','2055351',5.0000,1),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','2055362',5.0000,1),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','2063809',5.0000,1),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','2125302',5.0000,1),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','1997827',5.0000,1),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','1997830',5.0000,1),
  ('2026-11','James Martin Vanities','Breckenridge','ferguson','2055355',4.0000,1),
  ('2026-11','James Martin Vanities','Addison','home_depot','4.5/2',4.5000,2),
  ('2026-11','James Martin Vanities','Addison','home_depot','5/3',5.0000,3),
  ('2026-11','James Martin Vanities','Addison','home_depot','4.6667/3',4.6667,3),
  ('2026-11','James Martin Vanities','Addison','home_depot','5/2',5.0000,2),
  ('2026-11','James Martin Vanities','Addison','home_depot','3.5/2',3.5000,2),
  ('2026-11','James Martin Vanities','Breckenridge','home_depot','3/3',3.0000,3),
  ('2026-11','James Martin Vanities','Breckenridge','home_depot','3.8/5',3.8000,5),
  ('2026-11','James Martin Vanities','Breckenridge','home_depot','5/1',5.0000,1),
  ('2026-11','James Martin Vanities','Breckenridge','home_depot','4/6',4.0000,6)
ON DUPLICATE KEY UPDATE
  rating       = VALUES(rating),
  review_count = VALUES(review_count);


-- ── 2. PUBLISH THE THREE THAT PASS THE RULES ON THEIR OWN ────────────────
-- Addison      25 reviews @ 4.48, spread 0.20  (ferguson 4.38 / home_depot 4.58)
-- Laurent      11 reviews @ 3.91, spread 0     (ferguson only)
-- Lorelai      10 reviews @ 4.90, spread 0     (ferguson only)
--
-- Laurent publishes at 3.9. That is a real average of real reviews and the
-- owner chose on 2026-11-06 to show it rather than hide low scores — a rule
-- that only publishes flattering numbers is not a rule, it is a filter, and
-- a visitor who spots it once stops believing the other six.
INSERT INTO jmv_review_collections
  (brand, collection, is_published, override_rating, override_count, suppressed_reason, notes)
VALUES
  ('James Martin Vanities','Addison', 1, NULL, NULL, NULL,
   'Derived. 25 reviews across ferguson + home_depot, spread 0.20.'),
  ('James Martin Vanities','Laurent', 1, NULL, NULL, NULL,
   'Derived. 11 ferguson reviews @ 3.91. Low but real; owner approved publishing it 2026-11-06.'),
  ('James Martin Vanities','Lorelai', 1, NULL, NULL, NULL,
   'Derived. 10 ferguson reviews @ 4.90. Was dark under the old 30 floor.')
ON DUPLICATE KEY UPDATE
  is_published      = VALUES(is_published),
  override_rating   = VALUES(override_rating),
  override_count    = VALUES(override_count),
  suppressed_reason = VALUES(suppressed_reason),
  notes             = VALUES(notes);


-- ── 3. BRECKENRIDGE: A DELIBERATE OVERRIDE ───────────────────────────────
-- ⚠️ THIS ROW BYPASSES THE SPREAD RULE. DO NOT "FIX" IT BACK TO NULL.
--
-- Breckenridge aggregates to 60 reviews @ 4.43, but ferguson says 4.64 across
-- 45 reviews and home_depot says 3.80 across 15 — a 0.84 spread against a
-- 0.50 limit, so decide() refuses it.
--
-- The owner reviewed this on 2026-11-06 and chose to publish 4.4 / 60 anyway:
-- it is the #2 collection by volume, the disagreement is one-sided (HD's 3.80
-- rests on 15 reviews against Ferguson's 45), and 4.4 is the honest weighted
-- average of everything captured rather than a number picked to look good.
--
-- The spread rule itself is UNCHANGED at 0.5 and still blocks every other
-- collection. This is one recorded human decision, not a loosened threshold,
-- which is exactly what override_rating/override_count exist for.
INSERT INTO jmv_review_collections
  (brand, collection, is_published, override_rating, override_count, suppressed_reason, notes)
VALUES
  ('James Martin Vanities','Breckenridge', 1, 4.40, 60, NULL,
   'OVERRIDE, not derived. decide() refuses it: ferguson 4.64/45 vs home_depot 3.80/15 = 0.84 spread > 0.50 limit. Owner approved 4.4/60 on 2026-11-06. Re-confirm each quarterly refresh; if HD volume rises and the spread closes, clear the override and let it derive.')
ON DUPLICATE KEY UPDATE
  is_published      = VALUES(is_published),
  override_rating   = VALUES(override_rating),
  override_count    = VALUES(override_count),
  suppressed_reason = VALUES(suppressed_reason),
  notes             = VALUES(notes);


-- ── 4. VERIFY ────────────────────────────────────────────────────────────
SELECT collection, retailer, COUNT(*) AS pools, SUM(review_count) AS reviews
  FROM jmv_review_pools
 WHERE capture_batch = '2026-11'
   AND collection IN ('Addison','Laurent','Lorelai','Breckenridge')
 GROUP BY collection, retailer
 ORDER BY collection, retailer;
-- expect:
--   Addison      ferguson      10 pools, 13 reviews
--   Addison      home_depot     5 pools, 12 reviews
--   Breckenridge ferguson      19 pools, 45 reviews
--   Breckenridge home_depot     4 pools, 15 reviews
--   Laurent      ferguson      10 pools, 11 reviews
--   Lorelai      ferguson       9 pools, 10 reviews

SELECT collection, is_published, override_rating, override_count
  FROM jmv_review_collections
 WHERE brand = 'James Martin Vanities'
 ORDER BY is_published DESC, collection;
-- expect 7 rows published: Addison, Breckenridge (4.40/60), Brittany,
-- Bristol, Laurent, Lorelai, Myrrin. Breckenridge is the only one with an
-- override set.
