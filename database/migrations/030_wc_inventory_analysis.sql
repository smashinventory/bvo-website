-- ═══════════════════════════════════════════════════════════════════════
--  Migration 030 — WC Inventory Analysis tables
--
--  Mirrors the JMV velocity schema (2026-09-03_jmv_velocity.sql) deliberately:
--  same four-table shape, same delta semantics, same validity gate, so the two
--  report sections read and reason alike. Differences from JMV are all
--  intentional and each one is justified in a comment below.
--
--  Run once in phpMyAdmin. Safe to re-run: every statement uses IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════
--
-- ⚠️ EVERY CREATE TABLE BELOW DECLARES COLLATE EXPLICITLY.
--
-- Same reason as the jmv_* tables. Hostinger runs MariaDB 10.6+, whose default
-- collation is utf8mb4_uca1400_ai_ci, while this schema is utf8mb4_unicode_ci.
-- Omitting COLLATE does not mean "use the project default", it means "let the
-- server pick" — and the server picks wrong. The jmv_* tables shipped without
-- it and every cross-table '=' against an older table failed:
--
--   Illegal mix of collations (utf8mb4_uca1400_ai_ci,IMPLICIT)
--   and (utf8mb4_unicode_ci,IMPLICIT) for operation '='
--
-- It stayed hidden for months, until the first join was written. These tables
-- join wc_dimensions.carried_sku against products.sku, so the same trap is
-- live here from day one.
--
-- ───────────────────────────────────────────────────────────────────────
--  THE THREE HAZARDS, AS THEY APPLY TO WC
-- ───────────────────────────────────────────────────────────────────────
--
-- 1. OPTION-CONFIG COUPLING → MAX per base_sku, never SUM.
--
--    This is WC's version of JMV's shared-component hazard, and it is larger.
--    A WC SKU encodes its bill of materials in the suffix:
--
--        PY30CW03GG-000000000
--        └─ base ──┘└ suffix ┘     suffix = [mirror:3][faucet:6]
--
--    The cabinet is stocked once; each mirror/faucet permutation is published
--    as its own SKU against that one cabinet pool. Measured on real snapshots:
--
--        2026-11-23   1,301 SKUs →   244 bases   SUM 33,713 vs MAX 8,871  = 3.80x
--        2025-06-16   1,555 SKUs →   249 bases   SUM 25,119 vs MAX 6,066  = 4.14x
--        2022-03-01   1,766 SKUs →   227 bases   SUM 46,388 vs MAX 7,737  = 6.00x
--
--    SUMMING ACROSS CONFIGS OVERSTATES BY 3.8–6.0x. Not a rounding problem —
--    a different answer. 39–60% of bases carry a byte-identical qty across
--    every config, which is the shared pool showing through directly.
--
--    Configs are NOT always identical, because a config is also capped by its
--    mirror or faucet stock — so a config can sit below its cabinet pool.
--    MAX per base is therefore the cabinet pool, and the conservative floor.
--
-- 2. METRIC LABEL → "observed drawdown (minimum demand)", NEVER "units sold".
--    Restock days hide real demand. Same rule, same wording as JMV.
--
-- 3. FEED GAPS → is_valid = 1 only, and span_days to size the observation.
--    Of 1,627 adjacent snapshot pairs, 1,470 are consecutive-day and 157 are
--    gapped. A gapped pair measures several days of movement; span_days says
--    how many, so a multi-day observation is not read as a one-day spike.
--
-- ───────────────────────────────────────────────────────────────────────
--  NO PRICING. ANYWHERE. EVER.
-- ───────────────────────────────────────────────────────────────────────
--  Scope decision, Sam, 2026-11-24: the WC reports are units only. There is
--  deliberately no map_price, no msrp, no cost, no revenue column in this
--  migration — which is the one real structural divergence from jmv_snapshots.
--
--  This is not an oversight to be helpfully corrected later. It removes the
--  entire class of problem that dominated the JMV build: pivot dedup, the
--  warranty haircut, revenue-basis definitions, unpriced-SKU counts. Adding a
--  price column here re-opens all of it. See docs/briefs/WC_REPORTS_SPEC.md §1.
-- ───────────────────────────────────────────────────────────────────────


-- ── 1. Raw daily snapshots ───────────────────────────────────────────
--  One row per (date, sku), written before any delta math — same contract as
--  jmv_snapshots. Full history is kept because processSnapshot() reads the
--  previous valid snapshot back OUT of this table to compute deltas; trimming
--  it would break the rollup, not just the archive.
--
--  Volume: 1,628 snapshots x ~1,300–1,800 SKUs = ~2.53M rows. Larger than the
--  JMV equivalent. Fine for InnoDB with the indexes below; the only awkward
--  part is the one-time import, which is chunked rather than pasted.
--
--  available_date has no JMV counterpart. It is WC's own restock ETA, and it
--  is what makes the stockout strip worth looking at: a SKU at zero WITH an
--  ETA is a wait, a SKU at zero WITHOUT one is an unknown. Kept as VARCHAR
--  because the feed sends it as M/D/YYYY and sometimes blank — parsed at read
--  time, not coerced at write time, so a format change cannot silently become
--  a NULL that reads as "no ETA".
CREATE TABLE IF NOT EXISTS wc_snapshots (
  snapshot_date   DATE         NOT NULL,
  sku             VARCHAR(64)  NOT NULL,
  qty             INT          NOT NULL DEFAULT 0,
  available_date  VARCHAR(32)  DEFAULT NULL,
  PRIMARY KEY (snapshot_date, sku),
  INDEX idx_wcs_sku  (sku),
  INDEX idx_wcs_date (snapshot_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 2. Snapshot validity log ─────────────────────────────────────────
--  A row here means "this date was evaluated and a conclusion was reached" —
--  which is what the rollup's already-processed check reads. Dates that
--  deliberately write NO movement rows (feed unchanged, or invalid row count)
--  still get a row here, otherwise they are re-parsed on every single run
--  for ever. That exact leak bit the JMV job; it is designed out here.
--
--  schema_variant is WC-specific. The feed changed format once, on 2024-07-09:
--      before  Original Sku, New Sku, Maximum of Stock, Maximum of Available Date
--      after   SKU, Available Qty, Available Date
--  Recording which parser read each day means a future format change shows up
--  as a visible variant rather than as mysteriously empty snapshots.
CREATE TABLE IF NOT EXISTS wc_snapshot_validity (
  snapshot_date   DATE         NOT NULL PRIMARY KEY,
  row_count       INT          NOT NULL,
  is_valid        TINYINT(1)   NOT NULL DEFAULT 1,
  schema_variant  VARCHAR(16)  DEFAULT NULL,   -- 'legacy' | 'modern'
  notes           VARCHAR(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 3. SKU dimension table ───────────────────────────────────────────
--  Drives every cut in the reports. Same role as jmv_dimensions.
--
--  base_sku IS THE DEDUPE KEY. It is to this table what group_number is to
--  jmv_dimensions: always MAX, never SUM (hazard 1). It is indexed for that
--  reason and nothing in the reporting layer may group on `sku` where it means
--  "a model".
--
--  ⚠️ ATTRIBUTE COVERAGE IS PARTIAL, AND THAT MUST STAY VISIBLE.
--  The only attribute source we have is the 2021 supplier catalogue
--  ("Water Creation product catalog 2021 NEW collections.xlsx", sheet
--  `Product Data - Vanity`, header on ROW 2). It holds 145 attribute columns
--  but only 284 rows carry a Supplier SKU — 64 distinct base SKUs, 13
--  collections — against 765 base SKUs in the feed. The 2020 catalogue adds
--  SKU + name for ~2,000 more and nothing else.
--
--  Measured against the current feed: 1,029 of 1,301 SKUs matched (79.1%),
--  but only ~22% carry cabinet_color / top_material / top_finish.
--
--  SKU-grammar decoding was tried and rejected as a fix: the 2-char prefix
--  predicts collection cleanly (9 of 11 codes), but 64 labelled bases is far
--  too thin to derive colour or top, and the apparently perfect top-material
--  mapping is just low variance in a small sample.
--
--  Therefore: every report that cuts by colour, top material, top finish,
--  sinks or mounting MUST surface the undescribed count alongside it. A card
--  reporting on a fifth of the catalogue while looking complete is worse than
--  no card. Sam declined to chase a newer catalogue (2026-11-24) — so this is
--  the known, accepted state, not a gap awaiting quiet repair.
--
--  carried_sku: the onboarding-priority overlay. BVO carries NO Water Creation
--  today (brands present: James Martin Vanities 5,233, Huntington Brass 768,
--  ER Vanities 78), so this is NULL for every row at seed time and fills in as
--  SKUs are onboarded. That is the point: "sells nationally, we don't stock
--  it" is the useful list, and it needs no hand-maintained mapping.
CREATE TABLE IF NOT EXISTS wc_dimensions (
  sku             VARCHAR(64)   NOT NULL PRIMARY KEY,
  base_sku        VARCHAR(64)   NOT NULL,          -- DEDUPE KEY — MAX, never SUM
  mirror_code     VARCHAR(8)    DEFAULT NULL,      -- suffix [0:3], '000' = none
  faucet_code     VARCHAR(16)   DEFAULT NULL,      -- suffix [3:9], '000000' = none
  has_mirror      TINYINT(1)    NOT NULL DEFAULT 0,
  has_faucet      TINYINT(1)    NOT NULL DEFAULT 0,
  collection      VARCHAR(100)  DEFAULT NULL,
  product_name    VARCHAR(255)  DEFAULT NULL,
  size_nominal    DECIMAL(5,1)  DEFAULT NULL,      -- parsed inches
  cabinet_color   VARCHAR(100)  DEFAULT NULL,      -- ~22% fill — see warning above
  cabinet_finish  VARCHAR(100)  DEFAULT NULL,
  top_material    VARCHAR(64)   DEFAULT NULL,      -- ~22% fill
  top_finish      VARCHAR(100)  DEFAULT NULL,      -- ~22% fill
  sinks           TINYINT       DEFAULT NULL,
  mounting        VARCHAR(64)   DEFAULT NULL,      -- Freestanding / Floating
  ada             TINYINT(1)    NOT NULL DEFAULT 0,
  carried_sku     VARCHAR(64)   DEFAULT NULL,      -- our products.sku once onboarded
  attr_source     VARCHAR(16)   DEFAULT NULL,      -- '2021' rich | '2020' name-only | NULL
  updated_at      DATE          DEFAULT NULL,
  INDEX idx_wcd_base       (base_sku),
  INDEX idx_wcd_collection (collection),
  INDEX idx_wcd_color      (cabinet_color),
  INDEX idx_wcd_size       (size_nominal),
  INDEX idx_wcd_top_mat    (top_material),
  INDEX idx_wcd_carried    (carried_sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 4. Daily movement rollup ─────────────────────────────────────────
--  One row per (date, sku). Identical delta semantics to jmv_daily_movement,
--  because the inference problem is identical:
--
--    delta < 0  → depletion: demand_min = -delta
--    delta > 0  → restock:   received_min = delta
--                            received_max = delta + qty_prev
--                            demand_est   = trailing 14d avg (is_estimated=1)
--    delta = 0  → no movement
--
--  NEVER call demand_min "units sold". It is observed drawdown — a minimum.
--  Restock days hide real demand, which is what demand_est imputes.
--
--  span_days: how many calendar days this observation covers. 1 normally, more
--  when the preceding days had no snapshot. JMV learned this the hard way —
--  without it, a two-day gap renders as a one-day spike and the demand that
--  really happened across both days is attributed to whichever date the feed
--  changed. WC has 157 gapped pairs out of 1,627, so this is not an edge case
--  here, it is 10% of the series.
--
--  is_valid = 0 marks a feed-gap or failed-validity day. Excluded from all
--  rate math: treat as MISSING, never as zero demand. A false zero is worse
--  than a hole, because a chart draws it as real.
CREATE TABLE IF NOT EXISTS wc_daily_movement (
  movement_date   DATE         NOT NULL,
  sku             VARCHAR(64)  NOT NULL,
  qty_end         INT          NOT NULL,                  -- qty at end of day
  delta           INT          NOT NULL,                  -- qty_end - qty_prev, signed
  demand_min      INT          NOT NULL DEFAULT 0,         -- observed drawdown (minimum)
  received_min    INT          NOT NULL DEFAULT 0,
  received_max    INT          NOT NULL DEFAULT 0,
  demand_est      DECIMAL(6,1) DEFAULT NULL,               -- imputed on restock days
  is_restock      TINYINT(1)   NOT NULL DEFAULT 0,
  is_estimated    TINYINT(1)   NOT NULL DEFAULT 0,
  is_valid        TINYINT(1)   NOT NULL DEFAULT 1,
  span_days       SMALLINT     NOT NULL DEFAULT 1,
  PRIMARY KEY (movement_date, sku),
  INDEX idx_wcm_sku   (sku),
  INDEX idx_wcm_date  (movement_date),
  INDEX idx_wcm_valid (is_valid, movement_date),
  INDEX idx_wcm_dem   (movement_date, demand_min)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── Verification — run these after the migration ─────────────────────
--  Expect four rows, every one utf8mb4_unicode_ci. Any row showing
--  utf8mb4_uca1400_ai_ci means the COLLATE clause was dropped in transit and
--  the joins will fail later, not now.
--
--   SELECT TABLE_NAME, TABLE_COLLATION
--     FROM information_schema.TABLES
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND TABLE_NAME LIKE 'wc_%'
--    ORDER BY TABLE_NAME;
