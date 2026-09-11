-- ═══════════════════════════════════════════════════════════════════════
--  Migration 014 — JMV Velocity & Demand analytics tables
--  Run once in phpMyAdmin or via mysql CLI.
--  Safe to re-run: all statements use IF NOT EXISTS / IGNORE.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Raw daily snapshots ───────────────────────────────────────────
--  One row per (date, sku). Written by jmvMovementRollup.js before any
--  delta math. Covers ALL 5,218+ feed SKUs, not just sync scope.
-- ⚠️ EVERY CREATE TABLE BELOW MUST DECLARE COLLATE EXPLICITLY.
--
-- These four tables originally read `DEFAULT CHARSET=utf8mb4` with no
-- collation. Omitting it does not mean "use the project default" — it means
-- "let the server pick", and the server these were created on picked
-- utf8mb4_uca1400_ai_ci, while the rest of this schema is
-- utf8mb4_unicode_ci.
--
-- The result was that any '=' between a jmv_* string column and a column in
-- an older table failed outright:
--
--   Illegal mix of collations (utf8mb4_uca1400_ai_ci,IMPLICIT)
--   and (utf8mb4_unicode_ci,IMPLICIT) for operation '='
--
-- It stayed hidden until the first cross-table join was written — the
-- demand-score update in jmvMovementRollup.js, months later.
--
-- Existing databases are repaired by
--   migrations/2026-09-03_jmv_collation_align.sql
-- The COLLATE clauses here stop a fresh install recreating the problem.

CREATE TABLE IF NOT EXISTS jmv_snapshots (
  snapshot_date  DATE         NOT NULL,
  sku            VARCHAR(64)  NOT NULL,
  qty            INT          NOT NULL DEFAULT 0,
  map_price      DECIMAL(10,2),
  PRIMARY KEY (snapshot_date, sku),
  INDEX idx_sku  (sku),
  INDEX idx_date (snapshot_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. Snapshot validity log ─────────────────────────────────────────
--  Tracks whether each nightly drop was usable. A day whose row count
--  deviates >10% from the trailing median is marked invalid and excluded
--  from all rate math (treat as missing, not as zero demand).
CREATE TABLE IF NOT EXISTS jmv_snapshot_validity (
  snapshot_date  DATE         NOT NULL PRIMARY KEY,
  row_count      INT          NOT NULL,
  is_valid       TINYINT(1)   NOT NULL DEFAULT 1,
  notes          VARCHAR(500)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. SKU dimension table ───────────────────────────────────────────
--  Loaded from dimensions.csv.gz (weekly refresh). Drives every cut in
--  the reports: collection, finish, size, theme, etc.
--  CRITICAL: group_number is the dedupe key — always MAX not SUM.
CREATE TABLE IF NOT EXISTS jmv_dimensions (
  sku            VARCHAR(64)   NOT NULL PRIMARY KEY,
  collection     VARCHAR(100),
  group_number   VARCHAR(64),          -- dedupe key: MAX depletion per group
  product_type   VARCHAR(64),          -- Vanity / Cabinet / Top / Mirror / …
  vanity_type    VARCHAR(64),          -- Freestanding / Floating / Dual Mount
  base_finish    VARCHAR(100),
  top_finish     VARCHAR(100),
  top_material   VARCHAR(64),
  size_nominal   DECIMAL(5,1),         -- parsed from Product Name (e.g. 48.0)
  fits_size      DECIMAL(5,1),         -- for accessories only — size they fit
  theme          VARCHAR(64),
  sinks          TINYINT,              -- 0 / 1 / 2
  hardware       VARCHAR(64),
  freepower      TINYINT(1)   DEFAULT 0,
  released       VARCHAR(64),          -- "2025 - March" for cohort analysis
  updated_at     DATE,
  INDEX idx_collection   (collection),
  INDEX idx_group        (group_number),
  INDEX idx_product_type (product_type),
  INDEX idx_base_finish  (base_finish),
  INDEX idx_size         (size_nominal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. Daily movement rollup ─────────────────────────────────────────
--  One row per (date, sku). Computed by jmvMovementRollup.js.
--
--  Restock detection:
--    delta < 0  → depletion: demand_min = -delta
--    delta > 0  → restock:   received_min = delta, received_max = delta + qty_prev
--                             demand_est = trailing 14d avg (flagged estimated)
--    delta = 0  → no movement
--
--  NEVER call demand_min "units sold" — it is observed drawdown (minimum demand).
--  Restock days hide real sales; demand_est imputes from the trailing average.
CREATE TABLE IF NOT EXISTS jmv_daily_movement (
  movement_date  DATE         NOT NULL,
  sku            VARCHAR(64)  NOT NULL,
  qty_end        INT          NOT NULL,   -- qty at end of this day
  delta          INT          NOT NULL,   -- qty_end - qty_prev (signed)
  demand_min     INT          NOT NULL DEFAULT 0,   -- confirmed minimum drawdown
  received_min   INT          NOT NULL DEFAULT 0,   -- confirmed minimum received
  received_max   INT          NOT NULL DEFAULT 0,   -- upper bound received
  demand_est     DECIMAL(6,1),                      -- imputed on restock days
  is_restock     TINYINT(1)   NOT NULL DEFAULT 0,
  is_estimated   TINYINT(1)   NOT NULL DEFAULT 0,
  is_valid       TINYINT(1)   NOT NULL DEFAULT 1,   -- 0 = feed-gap day
  PRIMARY KEY (movement_date, sku),
  INDEX idx_sku    (sku),
  INDEX idx_date   (movement_date),
  INDEX idx_valid  (is_valid, movement_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
