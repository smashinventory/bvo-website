-- Migration 013: Expand flat image URL columns from 7 to 30
-- Run in phpMyAdmin against the BVO database.
-- Safe to re-run: uses IF NOT EXISTS on each column.
--
-- Decision (recorded 2026-07-14): Product image capacity expanded to 30.
-- Admin UI shows 5 fields by default with an "Add More Images" button.
-- Import sheet will be updated when product upload tasks are executed.

-- TEXT used instead of VARCHAR(500) to avoid the #1118 "Row size too large" error.
-- InnoDB stores TEXT off-page (excluded from the 65535-byte inline row limit).
-- Functionally identical to VARCHAR for URL storage; mysql2 returns both as strings.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_8_url  TEXT NULL AFTER image_7_url,
  ADD COLUMN IF NOT EXISTS image_9_url  TEXT NULL AFTER image_8_url,
  ADD COLUMN IF NOT EXISTS image_10_url TEXT NULL AFTER image_9_url,
  ADD COLUMN IF NOT EXISTS image_11_url TEXT NULL AFTER image_10_url,
  ADD COLUMN IF NOT EXISTS image_12_url TEXT NULL AFTER image_11_url,
  ADD COLUMN IF NOT EXISTS image_13_url TEXT NULL AFTER image_12_url,
  ADD COLUMN IF NOT EXISTS image_14_url TEXT NULL AFTER image_13_url,
  ADD COLUMN IF NOT EXISTS image_15_url TEXT NULL AFTER image_14_url,
  ADD COLUMN IF NOT EXISTS image_16_url TEXT NULL AFTER image_15_url,
  ADD COLUMN IF NOT EXISTS image_17_url TEXT NULL AFTER image_16_url,
  ADD COLUMN IF NOT EXISTS image_18_url TEXT NULL AFTER image_17_url,
  ADD COLUMN IF NOT EXISTS image_19_url TEXT NULL AFTER image_18_url,
  ADD COLUMN IF NOT EXISTS image_20_url TEXT NULL AFTER image_19_url,
  ADD COLUMN IF NOT EXISTS image_21_url TEXT NULL AFTER image_20_url,
  ADD COLUMN IF NOT EXISTS image_22_url TEXT NULL AFTER image_21_url,
  ADD COLUMN IF NOT EXISTS image_23_url TEXT NULL AFTER image_22_url,
  ADD COLUMN IF NOT EXISTS image_24_url TEXT NULL AFTER image_23_url,
  ADD COLUMN IF NOT EXISTS image_25_url TEXT NULL AFTER image_24_url,
  ADD COLUMN IF NOT EXISTS image_26_url TEXT NULL AFTER image_25_url,
  ADD COLUMN IF NOT EXISTS image_27_url TEXT NULL AFTER image_26_url,
  ADD COLUMN IF NOT EXISTS image_28_url TEXT NULL AFTER image_27_url,
  ADD COLUMN IF NOT EXISTS image_29_url TEXT NULL AFTER image_28_url,
  ADD COLUMN IF NOT EXISTS image_30_url TEXT NULL AFTER image_29_url;

-- Verification: confirm column count
-- SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'
-- AND COLUMN_NAME LIKE 'image_%_url';
-- Expected: 30 (primary_image_url + image_2_url ... image_30_url)
