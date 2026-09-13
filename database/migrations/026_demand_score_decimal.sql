-- ════════════════════════════════════════════════════════════════════
--  026 — demand_score must hold fractions
--
--  JMV_COMBO_DEMAND_DEFINITION.md §8 repoints products.demand_score at the
--  Estimated Combo Demand figure. That figure is fractional by nature: one
--  base's demand is allocated across the tops it is offered with, so a base
--  selling 21 units distributes 13.55 / 1.63 / 1.42 / … across its combos.
--
--  The column is int(10) unsigned. Measured on the window in the 2026-09-08
--  data — 858 units allocated across 4,198 combos, mean 0.20:
--
--      >= 1.0  survives the cast        146    3.5%
--      0.5-1.0 rounds to 1              198    4.7%
--      0-0.5   rounds to 0            3,018   71.9%
--      already 0                        836   19.9%
--                                     -----
--      distinct non-zero scores            9
--
--  92% would land on 0. Zero means "no signal", so they would all tie and
--  fall through to the secondary sort key — alphabetical, for almost the
--  whole vanity catalogue. The fractions ARE the ranking.
--
--  DECIMAL(10,2) and not FLOAT, deliberately. Two decimals is exactly what
--  the estimator already rounds to, and that rounding is load-bearing:
--  float arithmetic leaves differences around 1e-16 which reshuffle genuine
--  ties, and a sku tiebreak cannot resolve them because the values are not
--  quite equal. Measured 2026-09-12: 1,448 positions moved on noise alone.
--  A fixed-point column stores what the query produced and nothing more.
--
--  10,2 gives a ceiling of 99,999,999.99. Measured on production at the
--  moment this ran: 4,273 scored rows, min 1.00, max 732.00. (An earlier
--  draft of this comment said "maximum near 25" — that was cabinet SKUs
--  only; a fast-moving top accumulates far more over a 20-day window.)
--
--  NOT NULL DEFAULT 0 is preserved — the rollup relies on unscored products
--  reading 0 rather than NULL so DESC puts them last and the tie-breakers
--  order them predictably. See the comments in homeController.
--
--  REVERSIBLE. Narrowing back truncates the fractions and cannot restore
--  them, but nothing is lost that the next rollup will not rewrite:
--    ALTER TABLE products MODIFY demand_score INT UNSIGNED NOT NULL DEFAULT 0;
-- ════════════════════════════════════════════════════════════════════

-- ⚠ SHOW COLUMNS, NOT information_schema.
--
--  The application DB user has no grant on information_schema on this host:
--
--      #1044 - Access denied for user 'u222311468_Admin1'@'127.0.0.1'
--              to database 'information_schema'
--
--  phpMyAdmin reports that failure against the NEXT statement in the file,
--  which makes it look as though the ALTER was refused when it was the
--  verify SELECT. Hit 2026-09-12 on the first run of this migration.
--
--  Migration 023 already avoided information_schema.STATISTICS for a
--  different reason — it returned zero rows straight after a successful
--  CREATE INDEX while SHOW INDEX listed all eight. Two independent
--  failures, same conclusion: on this database, use SHOW.

-- Before — expect int(10) unsigned.
SHOW COLUMNS FROM products LIKE 'demand_score';

-- ── The change ──────────────────────────────────────────────────────
--  MODIFY keeps the column in place, so idx_demand_score
--  (demand_score DESC, is_featured DESC, sort_order) is rebuilt in place by
--  the engine. The index does not need dropping and must NOT be dropped —
--  it is what keeps the storefront popularity sort off a filesort.
ALTER TABLE products
  MODIFY demand_score DECIMAL(10,2) NOT NULL DEFAULT 0
  COMMENT 'JM depletion over the scoring window. Combos carry Estimated Combo Demand (modelled, JMV_COMBO_DEMAND_DEFINITION.md); all other types carry observed drawdown. 0 = no signal.';

-- ── Verify ──────────────────────────────────────────────────────────
--  Expect Type = decimal(10,2), Null = NO, Default = 0.00.
--  Reports the value rather than asserting absence — an empty result set is
--  how a broken check disguises itself as a pass.
SHOW COLUMNS FROM products LIKE 'demand_score';

--  The index must still exist and still lead on demand_score.
--  SHOW INDEX, not information_schema.STATISTICS: on 2026-09-11 STATISTICS
--  returned zero rows immediately after a successful CREATE INDEX on this
--  same database while SHOW INDEX listed all eight. Cause never established.
SHOW INDEX FROM products WHERE Key_name = 'idx_demand_score';

--  Existing values survive the widening — expect the same count and the same
--  maximum as before the ALTER, now with .00 decimals.
SELECT COUNT(*)          AS scored_rows,
       MIN(demand_score) AS min_score,
       MAX(demand_score) AS max_score
  FROM products
 WHERE demand_score > 0;

-- ────────────────────────────────────────────────────────────────────
--  This migration only widens the column. It does NOT change what gets
--  written into it — that is the rollup change shipped alongside. Running
--  this alone is safe and has no visible effect: every current value is a
--  whole number and stays one until the next rollup.
-- ────────────────────────────────────────────────────────────────────
