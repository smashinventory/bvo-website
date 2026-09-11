-- ============================================================
-- Migration 005 — Refactor product_attribute_values
-- BathroomVanitiesOutlet.com
-- ============================================================
--
-- Problem: Migration 002 created product_attribute_values with
-- attr_def_id (FK to attribute_definitions.id), but the importer
-- writes attr_key directly. The mismatch left the EAV table empty,
-- causing all attribute-based filters to return 0 products.
--
-- Fix: Drop and recreate the table using attr_key as the natural
-- composite key. The importer INSERT already has the correct column
-- list and will work without any changes after this migration runs.
--
-- ⚠ THIS MIGRATION WAS ONCE A LOADED GUN. READ BEFORE EDITING. ⚠
--
-- The original version opened with an unconditional
--     DROP TABLE IF EXISTS product_attribute_values;
-- and carried the note "any existing rows are lost — but the table
-- was empty due to the insert failure, so there is no data loss in
-- practice."
--
-- That was true the day it was written. It is catastrophically false
-- now. The table holds ~176,000 rows and is the source of depth_in,
-- faucet_spread_in, wireless_charging, sink_count and
-- backsplash_included — which is to say the bundle builder, every
-- attribute filter, and the whole JM catalogue structure.
--
-- Two things made that dangerous rather than merely historical:
--   1. database/migrations/run.js has no ledger. It executes EVERY
--      .sql in the directory, in filename order, on every
--      `npm run migrate`. Nothing is ever marked as applied.
--   2. Migrations here are routinely pasted into phpMyAdmin by hand,
--      where no runner is involved at all and a ledger would not
--      help.
--
-- And it would have failed SILENTLY. Nothing errors; 019-022 would
-- then run against an empty table and report success with 0 rows
-- changed.
--
-- So the refactor is now GUARDED on its own completion test: if
-- attr_key already exists, this migration has already done its job
-- and must do nothing. Keep it that way. If you need to change the
-- schema of this table, write a new numbered migration — do not
-- reopen this one.
-- ============================================================

-- ── Guard ───────────────────────────────────────────────────
--  The whole point of 005 was to replace attr_def_id with attr_key.
--  The presence of attr_key IS the "already applied" signal.
SET @pav_already_refactored := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'product_attribute_values'
     AND COLUMN_NAME  = 'attr_key'
);

SELECT IF(@pav_already_refactored > 0,
          CONCAT('005 SKIPPED — attr_key already present, table holds ',
                 (SELECT COUNT(*) FROM product_attribute_values),
                 ' rows. Nothing dropped.'),
          '005 APPLYING — attr_def_id schema detected, refactoring.')
       AS status;

-- ── 1. Drop, but only if the refactor has NOT already happened ──
SET @sql := IF(@pav_already_refactored > 0,
  'DO 0',
  'DROP TABLE IF EXISTS product_attribute_values');
SET FOREIGN_KEY_CHECKS = 0;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET FOREIGN_KEY_CHECKS = 1;

-- ── 2. Recreate, but only in that same case ──────────────────
--  IF NOT EXISTS is belt to the guard's braces: if the guard is ever
--  broken, this still refuses to clobber a live table.
SET @sql := IF(@pav_already_refactored > 0,
  'DO 0',
  'CREATE TABLE IF NOT EXISTS product_attribute_values (
     product_id   INT UNSIGNED     NOT NULL,
     attr_key     VARCHAR(50)      NOT NULL
       COMMENT ''Machine key — mirrors attribute_definitions.attr_key for fast lookups'',
     value_text   VARCHAR(255)     NULL
       COMMENT ''For checkbox / color_swatch / boolean filters'',
     value_num    DECIMAL(10,2)    NULL
       COMMENT ''For range filters — size in inches, weight, etc.'',
     color_family VARCHAR(30)      NULL
       COMMENT ''Normalised color bucket — white|cream|gray|black|blue|green|wood_l|wood_m|wood_d'',
     PRIMARY KEY (product_id, attr_key),
     INDEX idx_pav_key_text   (attr_key, value_text),
     INDEX idx_pav_key_num    (attr_key, value_num),
     INDEX idx_pav_color      (attr_key, color_family),
     FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── Verify ──────────────────────────────────────────────────
--  Counts rather than looks for absence. An empty result set is how
--  a broken check disguises itself as a pass.
SELECT COUNT(*) AS pav_rows_after,
       IF(COUNT(*) = 0,
          'EMPTY — expected only on a genuinely first run. If this DB had data, STOP and restore.',
          'OK — rows intact.') AS verdict
  FROM product_attribute_values;
