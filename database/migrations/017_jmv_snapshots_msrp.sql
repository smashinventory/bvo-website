-- ═══════════════════════════════════════════════════════════════════
-- 017 — jmv_snapshots.msrp
--
-- Per JMV_REVENUE_DEFINITION.md §4, price resolution is:
--
--   1. MAP from that day's snapshot
--   2. MSRP × 0.66 from that day's snapshot   <-- this column
--   3. MSRP × 0.66 from products.compare_price (current value, retroactive)
--   4. excluded from BOTH revenue and units
--
-- jmv_snapshots captured qty and map_price only, so rule 2 had no input and
-- a SKU priced by MSRP alone fell straight through to rule 3 — one current
-- value applied backwards across the whole window.
--
-- This column does nothing for existing history; snapshots already written
-- stay NULL and correctly fall through to rule 3. It exists so that history
-- from this date forward is priced from the day's own MSRP.
--
-- ── Why not information_schema ──────────────────────────────────────
-- The first version of this migration guarded the ALTER with
--
--   SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE ...)
--
-- and failed on Hostinger with:
--
--   #1044 — Access denied for user 'u222311468_Admin1'@'127.0.0.1'
--           to database 'information_schema'
--
-- The shared-hosting grant does not include information_schema, so @col came
-- back NULL, @sql came back NULL, and PREPARE died. Nothing was applied.
--
-- MariaDB supports IF NOT EXISTS on ADD COLUMN directly, which needs no
-- catalogue read and is idempotent on its own. SHOW COLUMNS likewise runs on
-- the table's own grant.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE `jmv_snapshots`
  ADD COLUMN IF NOT EXISTS `msrp` DECIMAL(10,2) NULL AFTER `map_price`;

-- ── Verify ─────────────────────────────────────────────────────────
-- Expect exactly one row: msrp / decimal(10,2) / YES / NULL
SHOW COLUMNS FROM `jmv_snapshots` LIKE 'msrp';
