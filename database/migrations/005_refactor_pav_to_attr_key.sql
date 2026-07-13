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
-- Impact: Any existing rows are lost — but the table was empty due
-- to the insert failure, so there is no data loss in practice.
-- Re-run the importer after applying this migration.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS product_attribute_values;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE product_attribute_values (
  product_id   INT UNSIGNED     NOT NULL,
  attr_key     VARCHAR(50)      NOT NULL
    COMMENT 'Machine key — mirrors attribute_definitions.attr_key for fast lookups',
  value_text   VARCHAR(255)     NULL
    COMMENT 'For checkbox / color_swatch / boolean filters',
  value_num    DECIMAL(10,2)    NULL
    COMMENT 'For range filters — size in inches, weight, etc.',
  color_family VARCHAR(30)      NULL
    COMMENT 'Normalised color bucket — white|cream|gray|black|blue|green|wood_l|wood_m|wood_d',
  PRIMARY KEY (product_id, attr_key),
  INDEX idx_pav_key_text   (attr_key, value_text),
  INDEX idx_pav_key_num    (attr_key, value_num),
  INDEX idx_pav_color      (attr_key, color_family),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
