-- Migration 012: favorites table (19G.5)
-- Run in phpMyAdmin against the BVO database.
-- Safe to re-run: uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS favorites (
  id          BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED     NOT NULL,
  product_id  INT UNSIGNED     NOT NULL,
  created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_customer_product (customer_id, product_id),
  KEY        idx_customer_id     (customer_id),

  CONSTRAINT fk_fav_customer FOREIGN KEY (customer_id)
    REFERENCES customers (id) ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_fav_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
