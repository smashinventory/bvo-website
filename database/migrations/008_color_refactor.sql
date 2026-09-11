-- ============================================================
--  Migration 008 — Color refactor + orphan column cleanup
--  Run: node database/migrations/run.js 008
-- ============================================================

-- ── 1. Drop orphan columns ───────────────────────────────────
--  meta_description: migration 003 accidentally added this alongside
--                    the original meta_desc column. Controller uses meta_desc.
--  color_family:     migration 004 added this as a direct column, but it
--                    was only ever captured via EAV specs. Replaced by
--                    color_primary below.
--
--  ⚠ THE color_family DROP IS OBSOLETE AND NOW GUARDED. ⚠
--
--  Migration 009 reversed this decision and brought products.color_family
--  back as the live color filter — it is populated on ~4,700 rows and
--  read by the mega menu, search, collections, product pages and the JM
--  importer.
--
--  So on a re-run this line dropped a live column and 009 re-added it
--  EMPTY. No error, no warning: the colour filters simply went blank.
--  That is the worst failure shape there is, and the reason it could
--  happen is that run.js has no ledger — it executes every .sql here on
--  every `npm run migrate`, and these files are also pasted into
--  phpMyAdmin by hand, where no ledger would help.
--
--  meta_description is genuinely orphaned and still dropped
--  unconditionally. color_family is dropped ONLY if it holds no data,
--  which is the only state in which 008's original intent still applies.
ALTER TABLE products
  DROP COLUMN IF EXISTS meta_description;

SET @cf_has_data := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'products'
        AND COLUMN_NAME  = 'color_family') = 0,
    0,
    (SELECT COUNT(*) FROM products
      WHERE color_family IS NOT NULL AND color_family <> ''))
);

SELECT IF(@cf_has_data > 0,
          CONCAT('008 KEEPING products.color_family — ', @cf_has_data,
                 ' populated rows. 009 supersedes this drop.'),
          '008 dropping products.color_family — no data present.')
       AS color_family_status;

SET @sql := IF(@cf_has_data > 0,
  'DO 0',
  'ALTER TABLE products DROP COLUMN IF EXISTS color_family');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 2. Add primary / secondary color columns ─────────────────
--  color_primary:   normalized filter color (Black, White, Gray, Brown…)
--                   powers the color filter in collections/search
--  color_secondary: vendor-specific color name (Dark Onyx, Espresso,
--                   Antique Coffee…) shown on product page and in GMC feed
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS color_primary   VARCHAR(50)  NULL
    COMMENT 'Normalized filter color for collection pages (Black, White, Gray, Brown…)',
  ADD COLUMN IF NOT EXISTS color_secondary VARCHAR(100) NULL
    COMMENT 'Vendor-specific color name (Dark Onyx, Espresso, Antique Coffee…)';
