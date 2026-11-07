-- ─────────────────────────────────────────────────────────────────────────
-- 2026-11-06_jmv_review_pools_RUNME.sql
--
-- Moves the James Martin retailer review figures out of hardcoded defaults
-- and into two tables, so 40 collections across several retailers and
-- quarterly re-checks have somewhere to live with history.
--
-- Run in phpMyAdmin against the BVO database. Safe to run twice.
--
-- ⚠️ NO information_schema ANYWHERE. This DB user is denied it (#1044), and
-- the 2026-11-02 migration failed precisely because its guards queried it:
-- every guard returned NULL, PREPARE s FROM NULL failed, and phpMyAdmin
-- still reported "25 queries executed". CREATE TABLE IF NOT EXISTS and
-- ADD ... IF NOT EXISTS are native on this server (MariaDB 11.8.9), so no
-- guard query is needed at all.
-- ─────────────────────────────────────────────────────────────────────────


-- ── 1. THE RAW CAPTURE ───────────────────────────────────────────────────
-- One row per REVIEW POOL per retailer per capture run.
--
-- ⚠️ A POOL IS NOT A PRODUCT. Home Depot shares one review pool across every
-- finish of a model+top combination: six different Brittany 36" finishes all
-- report exactly 47 reviews at 4.5957, because it is one pool surfaced six
-- times. Storing one row per product tile would multiply that pool by six and
-- inflate the published count roughly fourfold. The pool is identified by its
-- (rating, count) pair, which is what pool_key holds.
--
-- Keeping the raw pools rather than a single per-collection total is what
-- makes the number auditable later: "where did 245 come from" has an answer.
CREATE TABLE IF NOT EXISTS jmv_review_pools (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,

  capture_batch   VARCHAR(32)   NOT NULL
                  COMMENT 'Groups one collection run, e.g. 2026-11. Re-running a batch replaces it.',

  -- ⚠️ BRAND IS STORED AND IS PART OF THE KEY. "Bristol" exists under both
  -- James Martin Vanities and ER Vanities. A collection-name-only key would
  -- let one brand inherit the other brand's reviews, silently.
  brand           VARCHAR(64)   NOT NULL DEFAULT 'James Martin Vanities',
  collection      VARCHAR(64)   NOT NULL COMMENT 'model_groups.model_name, e.g. Brittany',

  retailer        VARCHAR(32)   NOT NULL COMMENT 'home_depot | ferguson | wayfair | lowes',

  pool_key        VARCHAR(64)   NOT NULL
                  COMMENT 'Identity of the pool, normally "<rating>/<count>". Distinct pools, not distinct listings.',

  -- 4.5957 needs one integer digit and four decimals.
  rating          DECIMAL(5,4)  NOT NULL,
  review_count    INT UNSIGNED  NOT NULL,

  size_in         VARCHAR(16)   NULL COMMENT 'Nullable: a pool can span sizes, and often does.',
  sample_product  VARCHAR(255)  NULL COMMENT 'One representative listing, for auditing where a figure came from.',
  source_url      VARCHAR(512)  NULL,

  captured_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  -- Makes a re-run idempotent: the same pool in the same batch updates in
  -- place rather than duplicating. Without this, running the refresh twice
  -- doubles every count and nothing complains.
  UNIQUE KEY uniq_pool (capture_batch, retailer, brand, collection, pool_key),

  KEY idx_lookup (brand, collection, capture_batch),
  KEY idx_batch  (capture_batch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 2. WHAT IS ALLOWED ON THE SITE ───────────────────────────────────────
-- The publish decision, kept apart from the data on purpose.
--
-- ⚠️ THIS IS THE OFF-SWITCH, AND IT HAS TO WORK IN A HURRY. The hardcoded
-- version needed a per-figure `show` flag because a key in DEFAULTS could
-- never be deleted. Here the equivalent is is_published: one UPDATE takes a
-- wrong number off the site without a deploy and without touching the raw
-- capture, so the evidence survives the retraction.
CREATE TABLE IF NOT EXISTS jmv_review_collections (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,

  brand           VARCHAR(64)   NOT NULL DEFAULT 'James Martin Vanities',
  collection      VARCHAR(64)   NOT NULL,

  is_published    TINYINT(1)    NOT NULL DEFAULT 0
                  COMMENT 'Default 0. A newly captured collection stays dark until someone looks at it.',

  -- Optional manual override. Normally NULL and the figure is DERIVED from
  -- jmv_review_pools; set these only to pin a number you can defend for a
  -- reason the data does not capture. Both must be set together.
  override_rating DECIMAL(3,2)  NULL,
  override_count  INT UNSIGNED  NULL,

  suppressed_reason VARCHAR(255) NULL
                  COMMENT 'Why it is dark, in words. e.g. "HD 3.43 vs FG 4.57 - 1.14 spread".',

  notes           VARCHAR(512)  NULL,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uniq_collection (brand, collection)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 3. SEED THE PUBLISH FLAGS FROM WHAT IS LIVE TODAY ────────────────────
-- Exactly the three currently on the site, plus the two deliberately dark,
-- so the table starts by describing reality rather than an empty slate.
INSERT INTO jmv_review_collections (brand, collection, is_published, suppressed_reason)
VALUES
  ('James Martin Vanities', 'Brittany',     1, NULL),
  ('James Martin Vanities', 'Bristol',      1, NULL),
  ('James Martin Vanities', 'Myrrin',       1, NULL),
  ('James Martin Vanities', 'Lorelai',      0, 'Only 12 reviews across both retailers - under the 30 floor.'),
  ('James Martin Vanities', 'Breckenridge', 0, 'Home Depot 3.43 vs Ferguson 4.57 - a 1.14 spread, over the 0.5 limit. #2 seller, so the worst place to publish a number nobody can stand behind.')
ON DUPLICATE KEY UPDATE
  is_published      = VALUES(is_published),
  suppressed_reason = VALUES(suppressed_reason);


-- ── 4. VERIFY ────────────────────────────────────────────────────────────
-- ⚠️ CHECK EACH TABLE BY NAME. "SHOW TABLES LIKE 'jmv_review%'" would also
-- match a pre-existing jmv_review_anything and read as success. The
-- 2026-11-02 migration shipped a verification step with exactly that flaw.
SHOW TABLES LIKE 'jmv_review_pools';         -- expect 1 row
SHOW TABLES LIKE 'jmv_review_collections';   -- expect 1 row

SELECT collection, is_published, suppressed_reason
  FROM jmv_review_collections
 WHERE brand = 'James Martin Vanities'
 ORDER BY is_published DESC, collection;
-- expect 5 rows: Bristol/Brittany/Myrrin published=1, Breckenridge/Lorelai=0

SELECT COUNT(*) AS pool_rows FROM jmv_review_pools;
-- expect 0 - the collector has not run yet. The site keeps using the
-- hardcoded figures until it has.
