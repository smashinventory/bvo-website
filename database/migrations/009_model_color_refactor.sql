-- ============================================================
--  Migration 009 — Model + Color architecture cleanup
--  Run: node database/migrations/run.js 009
--
--  Replaces the fragmented color_primary / color_secondary system
--  with three clean columns directly on the products table:
--
--    model        — vanity collection name (e.g. "London", "Bristol")
--                   groups SKUs for model card swatches; replaces
--                   the hardcoded modelFamilies.js lookup
--
--    color        — brand's exact color name (e.g. "Desert Oak",
--                   "Natural White Ash") — shown in filter sub-chip
--                   dropdown and on the product page
--
--    color_family — normalized family key (e.g. "wood_m", "wood_l")
--                   derived from normalize(color) at import time;
--                   drives the top-level color swatch filter circle
--
--  Also drops the now-redundant color_family column from the EAV
--  table (product_attribute_values) — color filtering now hits the
--  products table directly, no JOIN needed.
-- ============================================================

-- ── 1. Add new columns to products ──────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS model        VARCHAR(100) NULL
    COMMENT 'Vanity collection/model name — e.g. London, Bristol, Kensington',
  ADD COLUMN IF NOT EXISTS color        VARCHAR(100) NULL
    COMMENT 'Brand exact color name — e.g. Desert Oak, Navy Blue, White Ash',
  ADD COLUMN IF NOT EXISTS color_family VARCHAR(30)  NULL
    COMMENT 'Normalized family key — white|cream|gray|black|blue|green|wood_l|wood_m|wood_d|metallic';

-- ── 2. Index color_family for fast filter queries ────────────
ALTER TABLE products
  ADD INDEX IF NOT EXISTS idx_products_color_family (color_family),
  ADD INDEX IF NOT EXISTS idx_products_model        (model);

-- ── 3. Drop old redundant color columns ─────────────────────
ALTER TABLE products
  DROP COLUMN IF EXISTS color_primary,
  DROP COLUMN IF EXISTS color_secondary;

-- ── 4. Drop color_family from EAV table ─────────────────────
--  Color filtering now uses products.color_family directly.
--  The EAV cabinet_finish rows are kept for attribute filter UI
--  (the sub-chip exact-match dropdown) but color_family on that
--  table is no longer queried.
ALTER TABLE product_attribute_values
  DROP COLUMN IF EXISTS color_family;
