-- ============================================================
--  Migration 007 — GMC identifier_exists flag
--  identifier_exists = 1  → product has a GTIN/MPN (default)
--  identifier_exists = 0  → custom product, no GTIN/MPN
--                           (maps to Shopify "Custom Product = TRUE"
--                            and GMC feed attribute identifier_exists: no)
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS identifier_exists TINYINT(1) NOT NULL DEFAULT 1
    COMMENT 'GMC: 1=has GTIN or MPN, 0=custom product (no unique identifier)';
