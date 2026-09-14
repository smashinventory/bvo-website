-- ─────────────────────────────────────────────────────────────────────
--  Backfill products.model for the Huntington Brass import.
--
--  WHY
--  The 2026-09-13 HB import (hb_import.sql, 768 products) never wrote
--  products.model — the column was simply absent from the INSERT list.
--  It failed silently: groupByModel() in bundleController does
--
--      const m = row.model || 'Other';
--
--  so every one of the 768 rows fell into a single bucket named "Other".
--  In the bundle builder that renders as ONE carousel card labelled
--  "OTHER", counter "1 / 1", whose finish swatches are 669 unrelated
--  products — the first of which is a Slip Joint Adapter. It looked like
--  a filtering bug. It was a missing column.
--
--  WHAT model SHOULD BE
--  HB names are built as "<Series title> — <Finish>", e.g.
--
--      Joy Single Control — Chrome
--      Joy Single Control — PVD Satin Nickel
--      Joy Single Control — PVD Satin Brass
--      Joy Single Control — Matte Black
--
--  The part before the em dash is the Shopify product title, which is
--  exactly the model: one card, four finish swatches. Taking the bare
--  series ("Joy") instead would be WRONG — it would fold Joy Single
--  Control, Joy Widespread and Joy Vessel into one card and the swatch
--  row would show Chrome three times.
--
--  SAFETY
--  - Scoped to brand = 'Huntington Brass'. No other brand is touched.
--  - Only fills rows where model is NULL or empty, so a hand-edited
--    model survives a re-run. Idempotent.
--  - SUBSTRING_INDEX returns the whole string when the delimiter is
--    absent, so a finish-less product keeps its full name as the model
--    rather than going NULL. NULLIF guards the empty-string case.
--  - updated_at is ON UPDATE CURRENT_TIMESTAMP and will move for the
--    rows this changes. That is correct here: the row really did change.
--
--  The importer has been fixed too (src/jobs/importHuntingtonBrass.js,
--  buildModel()), so a future --live or --sql run writes model directly
--  and this backfill is never needed again.
-- ─────────────────────────────────────────────────────────────────────

START TRANSACTION;

-- Before: how many HB rows are missing a model?
SELECT 'BEFORE' AS phase,
       COUNT(*)                                                   AS hb_rows,
       SUM(model IS NULL OR model = '')                           AS missing_model,
       COUNT(DISTINCT NULLIF(model, ''))                          AS distinct_models
  FROM products
 WHERE brand = 'Huntington Brass';

UPDATE products
   SET model = NULLIF(TRIM(SUBSTRING_INDEX(name, ' — ', 1)), '')
 WHERE brand = 'Huntington Brass'
   AND (model IS NULL OR model = '');

-- After: every HB row should have a model, and distinct_models should be
-- in the low hundreds — one per series+type, NOT 1 and NOT 768.
SELECT 'AFTER' AS phase,
       COUNT(*)                                                   AS hb_rows,
       SUM(model IS NULL OR model = '')                           AS missing_model,
       COUNT(DISTINCT NULLIF(model, ''))                          AS distinct_models
  FROM products
 WHERE brand = 'Huntington Brass';

-- Spot check: the Bathroom Faucets that step 4 of the bundle builder
-- will actually offer, grouped the way the carousel groups them.
SELECT model,
       COUNT(*)                         AS finishes,
       GROUP_CONCAT(color ORDER BY color SEPARATOR ', ') AS swatches
  FROM products
 WHERE brand        = 'Huntington Brass'
   AND product_type = 'Bathroom Faucets'
   AND is_active    = 1
 GROUP BY model
 ORDER BY model
 LIMIT 25;

COMMIT;
