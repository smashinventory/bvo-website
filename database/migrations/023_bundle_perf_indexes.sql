-- ════════════════════════════════════════════════════════════════════
--  023 — the two composite indexes behind the bundle builder's 11s TTFB
--
--  MEASURED in Chrome against the live page before any fix:
--      server think time (TTFB) ... 11,056 ms
--      HTML download .................. 94 ms
--      slowest of 14 assets ........... 51 ms
--  None of it was the browser. All eleven seconds were six queries.
--
--  The application-level fix (caching the catalogue in memory) is
--  already shipped and took warm loads to ~60 ms. This migration
--  addresses the underlying cost, so the COLD build — still ~10.2 s,
--  once per TTL and on every restart — stops being slow too.
--
--  Both indexes are additive. No data is touched.
--
--  MySQL does NOT support CREATE INDEX IF NOT EXISTS (MariaDB does), so
--  each is guarded through information_schema. Idempotent, and safe to
--  paste into phpMyAdmin.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. jmv_dimensions — the cabinet -> combo self-join ───────────────
--  getCabinetTopMap() joins jmv_dimensions to itself on
--    product_type + collection + base_finish + size_nominal
--  The table carries FOUR SEPARATE single-column indexes on exactly
--  those columns and no composite, so the optimiser picks one, uses it
--  to narrow, then filters the remaining three by hand — per cabinet,
--  across 5,218 rows, multiplied through product_components (8,940) and
--  four computed SKU forms.
--
--  Column order is join selectivity, most selective first after the
--  constant: product_type is pinned to a literal in the query, so it
--  leads; collection then base_finish then size_nominal follow the ON
--  clause.
SET @ix := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'jmv_dimensions'
     AND INDEX_NAME   = 'idx_jmv_combo_key'
);
SET @sql := IF(@ix > 0,
  'SELECT ''idx_jmv_combo_key already present'' AS status',
  'CREATE INDEX idx_jmv_combo_key ON jmv_dimensions
     (product_type, collection, base_finish, size_nominal)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 2. products — the CHIP_SQL correlated subquery ───────────────────
--  CHIP_SQL runs ONCE PER OUTPUT ROW (289 cabinets + 182 tops +
--  mirrors), matching brand + model + color + category_id. Only
--  idx_products_model(model) is usable today, so each execution narrows
--  by model and then filters brand, color and category by hand.
--
--  category_id is last deliberately: it is pinned to the constant 10,
--  so it is the cheapest to check and the least selective to lead with.
SET @ix := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'products'
     AND INDEX_NAME   = 'idx_products_chip_lookup'
);
SET @sql := IF(@ix > 0,
  'SELECT ''idx_products_chip_lookup already present'' AS status',
  'CREATE INDEX idx_products_chip_lookup ON products
     (brand, model, color, category_id)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── Verify — expect both rows present ───────────────────────────────
--  COUNT, not absence. An empty result set is how a broken check
--  disguises itself as a pass.
SELECT TABLE_NAME, INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
   AND INDEX_NAME IN ('idx_jmv_combo_key', 'idx_products_chip_lookup')
 GROUP BY TABLE_NAME, INDEX_NAME;

-- ────────────────────────────────────────────────────────────────────
--  AFTER RUNNING: restart the app (or wait out the 15-minute cache
--  TTL) and watch the runtime log for
--      [bundle] catalogue rebuilt in NNNNms (289 cabinets, 177 tops)
--  Baseline to beat: 10,183 ms.
-- ────────────────────────────────────────────────────────────────────
