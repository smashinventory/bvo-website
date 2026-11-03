-- ═══════════════════════════════════════════════════════════════════════
-- BVO — send markers for the post-delivery emails (GAP-01)   ** v2 **
--
-- ⚠️ REPLACES 2026-11-02_email_send_markers.sql, WHICH CANNOT RUN ON THIS
-- HOST. That version guarded each ALTER with a SELECT against
-- information_schema. The application's DB user has no rights there:
--
--     #1044 - Access denied for user 'u222311468_Admin1'@'127.0.0.1'
--             to database 'information_schema'
--
-- Every guard therefore returned nothing, @sql became NULL, and
-- `PREPARE s FROM NULL` failed — four times, plus both verification
-- SELECTs. phpMyAdmin still reported "25 queries executed", because that
-- counts statements ATTEMPTED. Nothing was added.
--
-- ⚠️ THE LESSON, RECORDED SO IT IS NOT REPEATED: a migration that needs
-- information_schema is not portable to this database. Use SHOW, which
-- needs only rights on the table itself.
--
-- v2 uses ADD COLUMN IF NOT EXISTS — supported by MariaDB 10.0+ and
-- MySQL 8.0.29+. STEP 0 tells you whether this server qualifies. If it
-- does not, STEP 2b has the plain ALTER to run instead.
--
-- Run in phpMyAdmin against the BVO database.
-- ═══════════════════════════════════════════════════════════════════════


-- ── STEP 0: IS `IF NOT EXISTS` AVAILABLE HERE? ───────────────────────
-- Read this BEFORE running anything below.
--   MariaDB any 10.x  → yes, use STEP 2a
--   MySQL 8.0.29+     → yes, use STEP 2a
--   MySQL below that  → no,  use STEP 2b
SELECT VERSION() AS server_version;


-- ── STEP 1: LOOK FIRST ───────────────────────────────────────────────
-- SHOW needs no information_schema rights. Expect an EMPTY result if the
-- failed v1 run added nothing, which is what we believe happened.
SHOW COLUMNS FROM `orders` LIKE '%_sent_at';


-- ── STEP 2a: ADD THE MARKERS (MariaDB / MySQL 8.0.29+) ───────────────
-- Re-runnable. Each is skipped with a warning, not an error, if present.
ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `ofd_email_sent_at`       DATETIME NULL DEFAULT NULL
      COMMENT 'out_for_delivery email sent; NULL = never',
  ADD COLUMN IF NOT EXISTS `delivered_email_sent_at` DATETIME NULL DEFAULT NULL
      COMMENT 'order_delivered email sent; NULL = never',
  ADD COLUMN IF NOT EXISTS `review_request_sent_at`  DATETIME NULL DEFAULT NULL
      COMMENT 'review_request email sent; NULL = never',
  ADD COLUMN IF NOT EXISTS `cross_sell_sent_at`      DATETIME NULL DEFAULT NULL
      COMMENT 'cross_sell email sent; NULL = never';

-- The delayed passes scan "delivered more than N days ago, not yet sent".
-- Without this that is a full scan of `orders`, twice per poll, twice a day.
ALTER TABLE `orders`
  ADD INDEX IF NOT EXISTS `idx_orders_delivered_at` (`delivered_at`);


-- ── STEP 2b: ONLY IF STEP 0 SAID NO ──────────────────────────────────
-- Plain ALTERs. NOT re-runnable: a second run errors with #1060 Duplicate
-- column name, which is harmless but alarming. Run these ONE AT A TIME so
-- a failure on one does not hide the others.
--
-- ALTER TABLE `orders` ADD COLUMN `ofd_email_sent_at`       DATETIME NULL DEFAULT NULL;
-- ALTER TABLE `orders` ADD COLUMN `delivered_email_sent_at` DATETIME NULL DEFAULT NULL;
-- ALTER TABLE `orders` ADD COLUMN `review_request_sent_at`  DATETIME NULL DEFAULT NULL;
-- ALTER TABLE `orders` ADD COLUMN `cross_sell_sent_at`      DATETIME NULL DEFAULT NULL;
-- ALTER TABLE `orders` ADD INDEX  `idx_orders_delivered_at` (`delivered_at`);


-- ── STEP 3: PROVE IT ─────────────────────────────────────────────────
-- ⚠️ COUNTING ROWS HERE IS NOT A CHECK, AND THE FIRST RUN PROVED IT.
-- `LIKE '%_sent_at'` also matches `email_verify_sent_at`, which already
-- existed, so this returns FIVE rows when all four are present. Worse:
-- if one of the four were missing it would still return four, and a
-- "four rows, looks right" reading would call a broken migration a pass.
--
-- Read the NAMES, not the count. All four must appear:
--   ofd_email_sent_at  delivered_email_sent_at
--   review_request_sent_at  cross_sell_sent_at
SHOW COLUMNS FROM `orders` LIKE '%_sent_at';

-- Each by name. Each of these four must return exactly one row — which
-- cannot be satisfied by an unrelated column matching a pattern.
SHOW COLUMNS FROM `orders` LIKE 'ofd_email_sent_at';
SHOW COLUMNS FROM `orders` LIKE 'delivered_email_sent_at';
SHOW COLUMNS FROM `orders` LIKE 'review_request_sent_at';
SHOW COLUMNS FROM `orders` LIKE 'cross_sell_sent_at';

-- Expect one row: idx_orders_delivered_at.
SHOW INDEX FROM `orders` WHERE Key_name = 'idx_orders_delivered_at';

-- Must return 0 — nothing may be pre-marked as sent.
SELECT COUNT(*) AS should_be_zero_premarked
  FROM `orders`
 WHERE ofd_email_sent_at       IS NOT NULL
    OR delivered_email_sent_at IS NOT NULL
    OR review_request_sent_at  IS NOT NULL
    OR cross_sell_sent_at      IS NOT NULL;

-- What the first cron run would pick up, excluding test rows the same way
-- cartRecovery.js:192 does. With five orders this should be 0 or 1.
SELECT
  SUM(delivered_at IS NOT NULL AND is_test = 0
      AND delivered_at <= DATE_SUB(NOW(), INTERVAL  7 DAY)) AS review_backlog,
  SUM(delivered_at IS NOT NULL AND is_test = 0
      AND delivered_at <= DATE_SUB(NOW(), INTERVAL 21 DAY)) AS cross_sell_backlog,
  SUM(is_test = 1)                                          AS test_orders_excluded
  FROM `orders`;
