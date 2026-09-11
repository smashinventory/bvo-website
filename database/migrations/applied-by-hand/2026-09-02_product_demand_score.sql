-- ═══════════════════════════════════════════════════════════════════
-- 2026-09-02 — demand_score on products
--
-- PURPOSE
--   Let collection pages sort by popularity using a MACRO MARKET SIGNAL:
--   how fast a SKU depletes at the James Martin warehouse, which is
--   industry-wide demand rather than BVO's own sales.
--
--   This is a deliberate choice. Our own order history is thin, and the
--   whole point is to surface what the market buys, not what we happen to
--   have sold. If BVO sales are ever blended in, that is a later decision.
--
-- WHERE THE NUMBER COMES FROM
--   jmv_daily_movement.demand_min, summed over a trailing window, joined to
--   products on SKU. Written nightly by jmvMovementRollup.js — never by hand.
--
-- WINDOW
--   All available valid days, capped at 90. Only ~10 days of history exist
--   today, so a fixed 30-day window would silently score most SKUs on
--   partial data. This way the score strengthens as history accumulates
--   instead of being wrong now and right later.
--
-- ZERO IS NORMAL, NOT MISSING
--   Most SKUs will score 0 in a short window, and non-James-Martin products
--   have no JMV signal at all and will always score 0. That is why the sort
--   falls back to the existing featured ordering on ties — a popularity sort
--   with everything tied must degrade to today's behaviour, not to something
--   arbitrary. At ~90% James Martin inventory the gap is not material.
--
-- Run once against the BVO production database.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE products
  ADD COLUMN demand_score     INT UNSIGNED NOT NULL DEFAULT 0
    COMMENT 'JM warehouse depletion over the scoring window. 0 = no signal.',
  ADD COLUMN demand_scored_at DATE NULL
    COMMENT 'Date the nightly rollup last wrote demand_score.',
  ADD COLUMN demand_days      SMALLINT UNSIGNED NOT NULL DEFAULT 0
    COMMENT 'Valid snapshot days the score covers — for judging confidence.';

-- Sort index. demand_score DESC leads every popularity ORDER BY; the
-- remaining columns match the featured tiebreak so the whole sort can be
-- served from the index rather than a filesort.
ALTER TABLE products
  ADD INDEX idx_demand_score (demand_score DESC, is_featured DESC, sort_order);

-- ── VERIFY ─────────────────────────────────────────────────────────
-- SHOW COLUMNS FROM products LIKE 'demand%';
--   Expect three rows: demand_score, demand_scored_at, demand_days.

-- ── AFTER THE FIRST ROLLUP RUN ─────────────────────────────────────
-- Expect a non-trivial number of scored rows, all James Martin:
--
-- SELECT COUNT(*) AS scored,
--        MAX(demand_score) AS top_score,
--        MAX(demand_days)  AS days_covered,
--        MAX(demand_scored_at) AS last_written
--   FROM products WHERE demand_score > 0;
--
-- SELECT sku, name, demand_score
--   FROM products WHERE demand_score > 0
--  ORDER BY demand_score DESC LIMIT 20;
--
-- If scored = 0 after a rollup, the SKU join is failing — compare
-- products.sku against jmv_daily_movement.sku for formatting drift
-- (case, whitespace, prefix) before assuming there is simply no demand.
-- ═══════════════════════════════════════════════════════════════════
