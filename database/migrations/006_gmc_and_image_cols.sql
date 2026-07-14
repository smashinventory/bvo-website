-- ============================================================
--  Migration 006 — Google Merchant Center fields + extra image columns
--  Run: node database/migrations/run.js 006
-- ============================================================

-- ── 1. Google Merchant Center fields on products ─────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS mpn                     VARCHAR(80)     NULL                    COMMENT 'Manufacturer Part Number',
  ADD COLUMN IF NOT EXISTS google_product_category VARCHAR(500)    NULL                    COMMENT 'Google taxonomy string, e.g. "Home & Garden > Bath > Vanities"',
  ADD COLUMN IF NOT EXISTS google_condition        ENUM('new','refurbished','used')
                                                   NOT NULL DEFAULT 'new'                  COMMENT 'GMC condition',
  ADD COLUMN IF NOT EXISTS color                   VARCHAR(100)    NULL,
  ADD COLUMN IF NOT EXISTS material                VARCHAR(200)    NULL,
  ADD COLUMN IF NOT EXISTS pattern                 VARCHAR(100)    NULL,
  ADD COLUMN IF NOT EXISTS age_group               ENUM('newborn','infant','toddler','kids','adult','all ages') NULL,
  ADD COLUMN IF NOT EXISTS gender                  ENUM('male','female','unisex')          NULL,
  ADD COLUMN IF NOT EXISTS shipping_label          VARCHAR(100)    NULL                    COMMENT 'GMC shipping label',
  ADD COLUMN IF NOT EXISTS custom_label_0          VARCHAR(100)    NULL,
  ADD COLUMN IF NOT EXISTS custom_label_1          VARCHAR(100)    NULL,
  ADD COLUMN IF NOT EXISTS custom_label_2          VARCHAR(100)    NULL,
  ADD COLUMN IF NOT EXISTS custom_label_3          VARCHAR(100)    NULL,
  ADD COLUMN IF NOT EXISTS custom_label_4          VARCHAR(100)    NULL,
  ADD COLUMN IF NOT EXISTS excluded_destinations   VARCHAR(500)    NULL                    COMMENT 'Comma-separated GMC excluded destinations',
  ADD COLUMN IF NOT EXISTS ads_redirect            VARCHAR(1000)   NULL                    COMMENT 'GMC ads redirect URL',
  -- ── Additional image URLs (beyond primary_image_url) ────────
  ADD COLUMN IF NOT EXISTS image_2_url             VARCHAR(500)    NULL,
  ADD COLUMN IF NOT EXISTS image_3_url             VARCHAR(500)    NULL,
  ADD COLUMN IF NOT EXISTS image_4_url             VARCHAR(500)    NULL,
  ADD COLUMN IF NOT EXISTS image_5_url             VARCHAR(500)    NULL,
  ADD COLUMN IF NOT EXISTS image_6_url             VARCHAR(500)    NULL,
  ADD COLUMN IF NOT EXISTS image_7_url             VARCHAR(500)    NULL;

-- ── 2. Enhance product_documents ────────────────────────────────
ALTER TABLE product_documents
  ADD COLUMN IF NOT EXISTS sort_order TINYINT      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS filename   VARCHAR(255)  NULL     COMMENT 'Original uploaded filename';
