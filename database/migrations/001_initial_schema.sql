-- ================================================================
-- BVO Website — Initial Schema
-- Run: npm run migrate
-- ================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ── Categories ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id           INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  parent_id    INT UNSIGNED               DEFAULT NULL,
  slug         VARCHAR(120)      NOT NULL UNIQUE,
  name         VARCHAR(200)      NOT NULL,
  description  TEXT,
  image_url    VARCHAR(500),
  sort_order   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_active    TINYINT(1)        NOT NULL DEFAULT 1,
  meta_title   VARCHAR(255),
  meta_desc    VARCHAR(500),
  created_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_parent (parent_id),
  KEY idx_slug   (slug),
  KEY idx_active (is_active, sort_order),
  CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Products ─────────────────────────────────────────────────────
-- source_flag: 'rflpos' | 'salsify' | 'csv' | 'manual'
CREATE TABLE IF NOT EXISTS products (
  id              INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  category_id     INT UNSIGNED               DEFAULT NULL,
  sku             VARCHAR(100)      NOT NULL UNIQUE,
  slug            VARCHAR(255)      NOT NULL UNIQUE,
  name            VARCHAR(500)      NOT NULL,
  brand           VARCHAR(200),
  short_desc      TEXT,
  long_desc       LONGTEXT,
  -- Pricing
  price           DECIMAL(10,2)     NOT NULL DEFAULT 0.00,
  compare_price   DECIMAL(10,2)              DEFAULT NULL,  -- "was" price
  cost            DECIMAL(10,2)              DEFAULT NULL,  -- internal only
  -- Source tracking
  source_flag     ENUM('rflpos','salsify','csv','manual') NOT NULL DEFAULT 'manual',
  rflpos_item_id  VARCHAR(100)               DEFAULT NULL, -- link back to RFLPOS
  salsify_id      VARCHAR(200)               DEFAULT NULL,
  -- Status
  is_active       TINYINT(1)        NOT NULL DEFAULT 1,
  is_featured     TINYINT(1)        NOT NULL DEFAULT 0,
  is_new          TINYINT(1)        NOT NULL DEFAULT 0,
  -- Dimensions / shipping
  weight_lbs      DECIMAL(8,2)               DEFAULT NULL,
  width_in        DECIMAL(8,2)               DEFAULT NULL,
  depth_in        DECIMAL(8,2)               DEFAULT NULL,
  height_in       DECIMAL(8,2)               DEFAULT NULL,
  -- SEO
  meta_title      VARCHAR(255),
  meta_desc       VARCHAR(500),
  -- Timestamps
  created_at      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_category   (category_id),
  KEY idx_sku        (sku),
  KEY idx_slug       (slug),
  KEY idx_source     (source_flag),
  KEY idx_featured   (is_featured, is_active),
  KEY idx_rflpos_id  (rflpos_item_id),
  CONSTRAINT fk_prod_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Product images ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_images (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  product_id  INT UNSIGNED  NOT NULL,
  url         VARCHAR(500)  NOT NULL,
  alt_text    VARCHAR(300),
  sort_order  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  is_primary  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product   (product_id),
  KEY idx_primary   (product_id, is_primary),
  CONSTRAINT fk_img_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Product attributes (flexible key-value specs) ────────────────
CREATE TABLE IF NOT EXISTS product_attributes (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  product_id  INT UNSIGNED  NOT NULL,
  attr_key    VARCHAR(100)  NOT NULL,  -- e.g. 'finish', 'number_of_sinks'
  attr_value  VARCHAR(500)  NOT NULL,
  sort_order  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_product (product_id),
  KEY idx_key     (attr_key),
  CONSTRAINT fk_attr_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Inventory ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  product_id       INT UNSIGNED  NOT NULL UNIQUE,
  qty_on_hand      INT           NOT NULL DEFAULT 0,
  qty_reserved     INT           NOT NULL DEFAULT 0,  -- held in open orders
  reorder_point    INT           NOT NULL DEFAULT 0,
  allow_backorder  TINYINT(1)   NOT NULL DEFAULT 0,
  last_synced_at   DATETIME               DEFAULT NULL,  -- last pull from source
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product (product_id),
  CONSTRAINT fk_inv_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Customers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  email           VARCHAR(255)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255),  -- NULL = guest / social
  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  phone           VARCHAR(30),
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  email_verified  TINYINT(1)   NOT NULL DEFAULT 0,
  accepts_marketing TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at   DATETIME               DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Customer addresses ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_addresses (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  customer_id  INT UNSIGNED  NOT NULL,
  is_default   TINYINT(1)   NOT NULL DEFAULT 0,
  first_name   VARCHAR(100),
  last_name    VARCHAR(100),
  company      VARCHAR(200),
  address1     VARCHAR(300)  NOT NULL,
  address2     VARCHAR(300),
  city         VARCHAR(150)  NOT NULL,
  state        CHAR(2)       NOT NULL,
  zip          VARCHAR(20)   NOT NULL,
  country      CHAR(2)       NOT NULL DEFAULT 'US',
  phone        VARCHAR(30),
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_customer (customer_id),
  CONSTRAINT fk_addr_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Orders ───────────────────────────────────────────────────────
-- status: pending | confirmed | processing | shipped | delivered | cancelled | refunded
CREATE TABLE IF NOT EXISTS orders (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  order_number    VARCHAR(50)     NOT NULL UNIQUE,  -- e.g. BVO-20260001
  customer_id     INT UNSIGNED               DEFAULT NULL,
  guest_email     VARCHAR(255)               DEFAULT NULL,
  status          ENUM('pending','confirmed','processing','shipped','delivered','cancelled','refunded')
                                  NOT NULL DEFAULT 'pending',
  -- Totals
  subtotal        DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  shipping_cost   DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  tax             DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  discount        DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  total           DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  -- Addresses (snapshot at order time)
  ship_first_name VARCHAR(100),
  ship_last_name  VARCHAR(100),
  ship_address1   VARCHAR(300),
  ship_address2   VARCHAR(300),
  ship_city       VARCHAR(150),
  ship_state      CHAR(2),
  ship_zip        VARCHAR(20),
  ship_country    CHAR(2)         NOT NULL DEFAULT 'US',
  -- Fulfillment
  tracking_number VARCHAR(200),
  carrier         VARCHAR(100),
  shipped_at      DATETIME                   DEFAULT NULL,
  delivered_at    DATETIME                   DEFAULT NULL,
  notes           TEXT,
  -- Source sync
  rflpos_order_id VARCHAR(100)               DEFAULT NULL,
  -- Timestamps
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_number  (order_number),
  KEY idx_customer      (customer_id),
  KEY idx_status        (status),
  KEY idx_rflpos_order  (rflpos_order_id),
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Order items ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id           INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  order_id     INT UNSIGNED   NOT NULL,
  product_id   INT UNSIGNED               DEFAULT NULL,
  sku          VARCHAR(100)   NOT NULL,
  name         VARCHAR(500)   NOT NULL,
  qty          SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  unit_price   DECIMAL(10,2)  NOT NULL,
  line_total   DECIMAL(10,2)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order   (order_id),
  KEY idx_product (product_id),
  CONSTRAINT fk_item_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── RFLPOS sync log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rflpos_sync_log (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  sync_type     ENUM('product','inventory','order') NOT NULL,
  direction     ENUM('pull','push') NOT NULL,
  records_ok    INT           NOT NULL DEFAULT 0,
  records_err   INT           NOT NULL DEFAULT 0,
  error_detail  TEXT,
  started_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at   DATETIME               DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_type (sync_type, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Supplier import log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_import_log (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  supplier      VARCHAR(100)  NOT NULL,  -- 'james_martin_salsify', 'csv_generic', etc.
  import_method ENUM('salsify_api','csv_upload','csv_ftp') NOT NULL,
  records_ok    INT           NOT NULL DEFAULT 0,
  records_err   INT           NOT NULL DEFAULT 0,
  error_detail  TEXT,
  filename      VARCHAR(255)           DEFAULT NULL,
  started_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at   DATETIME               DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_supplier (supplier, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Seed: top-level categories ───────────────────────────────────
INSERT IGNORE INTO categories (slug, name, description, sort_order) VALUES
  ('vanities',     'Bathroom Vanities', 'Single, double, and freestanding bathroom vanities', 1),
  ('mirrors',      'Mirrors',           'Framed, frameless, and lighted bathroom mirrors',   2),
  ('faucets',      'Faucets',           'Bathroom sink, shower, and tub faucets',            3),
  ('accessories',  'Accessories',       'Towel bars, toilet paper holders, and more',        4),
  ('lighting',     'Lighting',          'Vanity lights, sconces, and ceiling fixtures',      5),
  ('storage',      'Storage',           'Medicine cabinets, shelving, and storage solutions',6);
