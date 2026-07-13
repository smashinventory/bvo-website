-- ============================================================
-- Migration 002 — Taxonomy, Attribute System & Search Indexes
-- BathroomVanitiesOutlet.com
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ── 1. Extend products table ─────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN product_type      VARCHAR(100)  NULL AFTER category_id
    COMMENT 'e.g. single-sink-vanity, shower-system, sink-faucet',
  ADD COLUMN primary_image_url VARCHAR(500)  NULL AFTER product_type
    COMMENT 'Denormalised primary image URL for fast search indexing';

-- ── 2. Composite indexes for collection page filter queries ──────────
--    These are the queries that kill performance at 10k+ products
--    without the right indexes.

ALTER TABLE products
  ADD INDEX idx_cat_type_active  (category_id, product_type, is_active),
  ADD INDEX idx_cat_price_active (category_id, price, is_active),
  ADD INDEX idx_brand_active     (brand, is_active),
  ADD INDEX idx_featured_sort    (is_featured, sort_order),
  ADD INDEX idx_is_new           (is_new, is_active),
  ADD INDEX idx_product_type     (product_type, is_active);

-- Full-text index for MySQL search bar fallback (pre-Typesense)
ALTER TABLE products
  ADD FULLTEXT INDEX idx_fulltext_search (name, short_desc, brand);

-- ── 3. Attribute Definitions ─────────────────────────────────────────
--    Defines WHICH filter groups appear in the sidebar for each
--    category. category_id NULL = applies to ALL categories.

CREATE TABLE IF NOT EXISTS attribute_definitions (
  id            INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  category_id   INT UNSIGNED     NULL
    COMMENT 'FK to categories.id — NULL means global / all categories',
  attr_key      VARCHAR(50)      NOT NULL
    COMMENT 'Machine key used in query params: size, finish, style …',
  display_name  VARCHAR(100)     NOT NULL
    COMMENT 'Human label shown in the sidebar filter group',
  filter_type   ENUM(
    'checkbox',       -- list of checkboxes (brand, style, mount_type …)
    'range',          -- numeric min/max slider (size_in, price …)
    'color_swatch',   -- checkbox + colour circle (finish)
    'boolean'         -- single yes/no toggle (sink_included …)
  ) NOT NULL DEFAULT 'checkbox',
  sort_order    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  is_active     TINYINT(1)       NOT NULL DEFAULT 1,
  INDEX idx_category  (category_id),
  INDEX idx_key       (attr_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. Product Attribute Values ──────────────────────────────────────
--    Stores each product's values for each attribute definition.
--    Composite indexes make filtered queries fast at scale.

CREATE TABLE IF NOT EXISTS product_attribute_values (
  product_id   INT UNSIGNED     NOT NULL,
  attr_def_id  INT UNSIGNED     NOT NULL,
  value_text   VARCHAR(255)     NULL
    COMMENT 'For checkbox / color_swatch / boolean filters',
  value_num    DECIMAL(10,2)    NULL
    COMMENT 'For range filters — size in inches, weight, etc.',
  PRIMARY KEY (product_id, attr_def_id),
  INDEX idx_filter_text  (attr_def_id, value_text),
  INDEX idx_filter_num   (attr_def_id, value_num),
  FOREIGN KEY (product_id)  REFERENCES products(id)  ON DELETE CASCADE,
  FOREIGN KEY (attr_def_id) REFERENCES attribute_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 5. Seed attribute_definitions ───────────────────────────────────
--    These match category IDs from 001_initial_schema.sql SEED:
--      1 = Vanities  2 = Mirrors  3 = Faucets
--      4 = Accessories  5 = Lighting  6 = Storage
--    NULL category_id = applies to all (e.g. Brand is global).

-- GLOBAL (all categories)
INSERT INTO attribute_definitions (category_id, attr_key, display_name, filter_type, sort_order) VALUES
  (NULL, 'brand',   'Brand',   'checkbox', 0);

-- ── VANITIES (category_id = 1) ──
--    cabinet_finish = dominant body/cabinet color (primary filter surface)
--    hardware_finish = knobs/pulls finish (secondary — separate group in sidebar)
--    These are intentionally split so a navy vanity with gold pulls doesn't
--    appear under "Gold" when a shopper filters by cabinet color.
INSERT INTO attribute_definitions (category_id, attr_key, display_name, filter_type, sort_order) VALUES
  (1, 'product_type',     'Vanity Type',      'checkbox',     1),
  (1, 'size_in',          'Vanity Size',       'range',        2),
  (1, 'cabinet_finish',   'Cabinet Color',     'color_swatch', 3),
  (1, 'hardware_finish',  'Hardware Finish',   'color_swatch', 4),
  (1, 'style',            'Style',             'checkbox',     5),
  (1, 'mount_type',       'Mount Type',        'checkbox',     6),
  (1, 'sink_count',       'Number of Sinks',   'checkbox',     7),
  (1, 'sink_included',    'Sink Included',     'boolean',      8);

-- ── FAUCETS (category_id = 3) ──
INSERT INTO attribute_definitions (category_id, attr_key, display_name, filter_type, sort_order) VALUES
  (3, 'product_type',  'Faucet Type',    'checkbox',     1),
  (3, 'finish',        'Finish / Color', 'color_swatch', 2),
  (3, 'faucet_config', 'Configuration',  'checkbox',     3),
  (3, 'handle_type',   'Handle Type',    'checkbox',     4),
  (3, 'spout_type',    'Spout Style',    'checkbox',     5),
  (3, 'flow_rate_gpm', 'Flow Rate',      'range',        6);

-- ── MIRRORS (category_id = 2) ──
INSERT INTO attribute_definitions (category_id, attr_key, display_name, filter_type, sort_order) VALUES
  (2, 'product_type', 'Mirror Type',    'checkbox',     1),
  (2, 'width_in',     'Width',          'range',        2),
  (2, 'shape',        'Shape',          'checkbox',     3),
  (2, 'finish',       'Frame Finish',   'color_swatch', 4),
  (2, 'has_led',      'LED / Lighted',  'boolean',      5),
  (2, 'has_defogger', 'Anti-Fog',       'boolean',      6);

-- ── LIGHTING (category_id = 5) ──
INSERT INTO attribute_definitions (category_id, attr_key, display_name, filter_type, sort_order) VALUES
  (5, 'product_type', 'Fixture Type',   'checkbox',     1),
  (5, 'finish',       'Finish / Color', 'color_swatch', 2),
  (5, 'num_lights',   'Number of Lights','range',       3),
  (5, 'bulb_type',    'Bulb Type',      'checkbox',     4),
  (5, 'style',        'Style',          'checkbox',     5);

-- ── ACCESSORIES / STORAGE (category_id = 4 + 6) ──
INSERT INTO attribute_definitions (category_id, attr_key, display_name, filter_type, sort_order) VALUES
  (4, 'product_type', 'Accessory Type', 'checkbox',     1),
  (4, 'finish',       'Finish / Color', 'color_swatch', 2),
  (4, 'material',     'Material',       'checkbox',     3),
  (6, 'product_type', 'Storage Type',   'checkbox',     1),
  (6, 'finish',       'Finish / Color', 'color_swatch', 2),
  (6, 'material',     'Material',       'checkbox',     3),
  (6, 'width_in',     'Width',          'range',        4);

-- ── 6. Colour swatch lookup ──────────────────────────────────────────
--    Optional helper table — maps finish value_text → hex colour
--    so the sidebar can render swatches without hardcoding in the UI.

CREATE TABLE IF NOT EXISTS finish_colors (
  finish_name  VARCHAR(100) PRIMARY KEY,
  hex_color    CHAR(7)      NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO finish_colors (finish_name, hex_color) VALUES
  ('White',              '#FFFFFF'),
  ('Gray Oak',           '#9E9488'),
  ('Espresso',           '#3B1F0E'),
  ('Navy Blue',          '#182840'),
  ('Sage Green',         '#5A7A5A'),
  ('Walnut',             '#7B4F2E'),
  ('Matte Black',        '#1C1C1C'),
  ('Chrome',             '#C0C0C0'),
  ('Brushed Nickel',     '#8C8680'),
  ('Oil-Rubbed Bronze',  '#4A3728'),
  ('Polished Gold',      '#CFB53B'),
  ('Brushed Gold',       '#B5924C'),
  ('Polished Brass',     '#B5A642'),
  ('Antique Bronze',     '#614E3C'),
  ('Matte White',        '#F0EEE9');
