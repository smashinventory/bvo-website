-- ═══════════════════════════════════════════════════════════════════════
--  Migration 031 — WC product family
--
--  The WC feed is NOT all bathroom vanities. Measured across the archive:
--
--    family        2021    2026-11   what it is
--    ------------------------------------------------------------------
--    vanity        1,034      869    "Chestnut 24\" Single Bathroom Vanity"
--    faucet          382      243    "Vintage Classic Basin Cocks Lavatory Faucets"
--    kitchen_sink    199        0    "33x22 Double Bowl Stainless Steel Apron Front"
--    washstand       150      133    "Embassy 30 Inch Wide Single Wash Stand"
--    accessory        52       26    robe hooks, bath caddies, P-trap kits
--    cabinet          14       18    "Madison Collection Linen Cabinet"
--    mirror            3       12    "Metal Rectangular Mirror 18\" X 24\""
--
--  A third of the current feed is faucets and accessories, and the 2021 feed
--  carried 199 KITCHEN sinks. Reporting "WC demand" across all of that answers
--  no question anyone asked. Sam's scope (2026-11-25): bathroom vanities.
--
--  ⚠️ THERE IS NO SEPARATE "VANITY TOP" SKU.
--  The top is part of the vanity: CH24CW03GK *is* the cabinet-and-top, and the
--  catalogue's top_material / top_finish columns describe the top that ships
--  with it. So tops are a DIMENSION of the vanity, never a product line of
--  their own. Any future "top demand" card must cut wc_dimensions.top_material
--  within family='vanity' — it must not look for top SKUs, because there are
--  none to find.
--
--  Additive only. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════

-- MariaDB has no ADD COLUMN IF NOT EXISTS before 10.0.2 in all builds, and
-- Hostinger's phpMyAdmin reports a duplicate-column error rather than a
-- warning. Guard it so a re-run is genuinely harmless.
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'wc_dimensions'
     AND COLUMN_NAME  = 'product_family'
);

SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE wc_dimensions
     ADD COLUMN product_family VARCHAR(24) DEFAULT NULL AFTER base_sku,
     ADD INDEX idx_wcd_family (product_family)',
  'SELECT "031: product_family already present — nothing to do" AS note'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── Verification ─────────────────────────────────────────────────────
--  After the rollup re-runs its dimension pass, this should show the seven
--  families above and ZERO NULLs. A NULL means the classifier met a SKU shape
--  it does not know, which is a real finding, not a tidy-up: it is how a new
--  WC product line announces itself.
--
--   SELECT COALESCE(product_family,'** UNCLASSIFIED **') AS family,
--          COUNT(*) AS skus, COUNT(DISTINCT base_sku) AS models
--     FROM wc_dimensions
--    GROUP BY product_family
--    ORDER BY skus DESC;
