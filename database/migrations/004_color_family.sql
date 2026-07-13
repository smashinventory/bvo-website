-- ============================================================
--  Migration 004 — Color Family Normalization
--  Adds color_family to product_attribute_values so filter
--  queries can match at the family level (e.g., "all blacks")
--  without enumerating every manufacturer color name.
--
--  No schema change is needed for the 84"+ size catch-all —
--  that is handled at query time with value_num >= 84.
-- ============================================================

ALTER TABLE product_attribute_values
  ADD COLUMN IF NOT EXISTS color_family VARCHAR(30) NULL
    COMMENT 'Normalized color bucket — white|cream|gray|black|blue|green|wood_l|wood_m|wood_d';

-- Composite index: fast filter queries on (attr_def_id, color_family)
ALTER TABLE product_attribute_values
  ADD INDEX IF NOT EXISTS idx_pav_color_family (attr_def_id, color_family);
