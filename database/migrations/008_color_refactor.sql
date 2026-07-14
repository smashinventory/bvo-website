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
ALTER TABLE products
  DROP COLUMN IF EXISTS meta_description,
  DROP COLUMN IF EXISTS color_family;

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
