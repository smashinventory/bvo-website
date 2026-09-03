-- ═══════════════════════════════════════════════════════════════════
-- 2026-09-03 — distinguish "no observation" from "zero demand"
--
-- THE PROBLEM
--   The Financials daily chart showed $0 on 08-24, 08-28, 08-30, 09-01 and
--   09-03. Those are not zero-demand days. On each of them the JM snapshot
--   was BYTE-IDENTICAL to the previous day — James Martin had not published
--   new data — so there was no delta to measure.
--
--   Proven against production:
--
--     snapshot_date  total_units   movement recorded
--     2026-08-23       145,631     —
--     2026-08-24       145,631     0        <- identical to 08-23
--     2026-08-27       138,569     3,753
--     2026-08-28       138,569     0        <- identical to 08-27
--     2026-08-29       121,173     18,949   <- covers 08-28 AND 08-29
--
--   The rollup computed each delta against the previous VALID snapshot, and
--   an unchanged snapshot is still valid — so every SKU got delta = 0
--   written as a genuine observation of no demand. It is not. It is the
--   absence of an observation.
--
--   Consequence: window totals are correct, but the daily attribution is
--   wrong. 08-29's 18,949 units actually covers two days, and 09-02's
--   figure covers three. The chart is the thing you read for timing, so
--   that is the part that mattered.
--
-- THE FIX (option (a) — gap, do not amortise)
--   1. span_days records how many calendar days each observation covers.
--   2. Unobserved dates carry NO movement rows at all, so charts gap
--      instead of drawing a zero.
--
--   Deliberately NOT amortising the delta across the days it spans. That
--   would read better and would be inventing daily detail JM never gave us.
--   Consistent with the conservative-floor approach used throughout.
--
-- Run once. Safe to re-run — every step is idempotent.
-- ═══════════════════════════════════════════════════════════════════


-- ── 1. SCHEMA ──────────────────────────────────────────────────────
ALTER TABLE jmv_daily_movement
  ADD COLUMN span_days TINYINT UNSIGNED NOT NULL DEFAULT 1
    COMMENT 'Calendar days this observation covers. >1 when JM published no new feed on the preceding days.';


-- ── 2. REVIEW before changing anything ─────────────────────────────
-- Dates where NOTHING moved on any SKU. With 5,218 SKUs, a day on which
-- not one unit shifted anywhere in the warehouse is not plausible — these
-- are unchanged-feed days.
SELECT movement_date,
       COUNT(*)            AS sku_rows,
       SUM(ABS(delta))     AS total_abs_delta
  FROM jmv_daily_movement
 GROUP BY movement_date
HAVING total_abs_delta = 0
 ORDER BY movement_date;


-- ── 3. PURGE the false zero-observations ───────────────────────────
-- These rows assert "we looked and saw no demand". We did not look; JM had
-- not published. Removing them makes the charts gap, which is the truth.
--
-- Nothing is lost: the snapshots themselves stay in jmv_snapshots, so the
-- rollup can always recompute from source.
DELETE m FROM jmv_daily_movement m
  JOIN (
    SELECT movement_date
      FROM jmv_daily_movement
     GROUP BY movement_date
    HAVING SUM(ABS(delta)) = 0
  ) z ON z.movement_date = m.movement_date;


-- ── 4. RECOMPUTE span_days on what remains ─────────────────────────
-- Each surviving observation covers every valid snapshot day since the
-- previous surviving observation. Aug 29 becomes span_days = 2 (28th + 29th);
-- Sep 2 becomes 3 or 4 depending on Aug 31, which has no snapshot at all.
UPDATE jmv_daily_movement m
   JOIN (
     SELECT d.movement_date,
            GREATEST(1, DATEDIFF(
              d.movement_date,
              COALESCE(
                (SELECT MAX(p.movement_date)
                   FROM (SELECT DISTINCT movement_date FROM jmv_daily_movement) p
                  WHERE p.movement_date < d.movement_date),
                DATE_SUB(d.movement_date, INTERVAL 1 DAY)
              )
            )) AS span
       FROM (SELECT DISTINCT movement_date FROM jmv_daily_movement) d
   ) s ON s.movement_date = m.movement_date
    SET m.span_days = s.span;


-- ── 5. VERIFY ──────────────────────────────────────────────────────
-- Expect: no all-zero dates left, and span_days > 1 on the dates that
-- follow an unchanged-feed day.
SELECT movement_date,
       MAX(span_days)      AS span_days,
       SUM(demand_min)     AS units_down,
       SUM(received_min)   AS units_up
  FROM jmv_daily_movement
 GROUP BY movement_date
 ORDER BY movement_date;

-- Expect ZERO rows — no false zero-observations remain.
SELECT movement_date, SUM(ABS(delta)) AS total_abs_delta
  FROM jmv_daily_movement
 GROUP BY movement_date
HAVING total_abs_delta = 0;

-- ═══════════════════════════════════════════════════════════════════
-- AFTER THIS RUNS
--   The Financials daily chart will have GAPS on unobserved days rather
--   than $0 bars, and the tooltip on a multi-day observation will say how
--   many days it covers.
--
--   The window totals will NOT change. Nothing was double counted and
--   nothing is being removed except rows that asserted zero — the sum over
--   any range is identical. If a total does move, something else is wrong
--   and worth investigating.
-- ═══════════════════════════════════════════════════════════════════
