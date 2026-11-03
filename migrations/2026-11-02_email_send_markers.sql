-- ═══════════════════════════════════════════════════════════════════════
-- ⛔ SUPERSEDED — DO NOT RUN. Kept as the record of why.
--
-- Attempted 2026-11-02. Every ALTER here is guarded by a SELECT against
-- information_schema, and the application's DB user has no rights there:
--
--     #1044 - Access denied for user 'u222311468_Admin1'@'127.0.0.1'
--             to database 'information_schema'
--
-- So each guard returned nothing, @sql became NULL, and `PREPARE s FROM
-- NULL` failed. phpMyAdmin reported "25 queries executed" anyway —
-- that counts statements ATTEMPTED, not statements that did anything.
-- No column was added.
--
-- ➡️ Use 2026-11-02_email_send_markers_v2.sql, which uses SHOW and
--    ADD COLUMN IF NOT EXISTS instead.
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- BVO — send markers for the post-delivery emails (GAP-01)
--
-- Four templates in `email_templates` have been active since August and
-- no code path has ever sent them. Wiring them needs somewhere to record
-- that a send happened.
--
-- ⚠️ THESE COLUMNS ARE THE ENTIRE SAFETY MECHANISM, NOT BOOKKEEPING.
-- shipmentStatusPoll runs twice a day. Without a marker, every run that
-- sees a delivered order would send the delivery email again — four a day
-- to the same customer until the shipment ages out of the 45-day window.
-- The poll's own status writes are protected by ORDER_PROGRESSION, which
-- only guards status; it does nothing for emails.
--
-- ⚠️ ON `orders`, NOT `shipments`, AND THAT IS A CHOICE. An order that
-- ships in two parts has two shipment rows. Hanging the markers off
-- shipments would email the customer once per carton; hanging them off
-- the order means one "out for delivery" even when two trucks arrive on
-- different days. One email per order is the right side of that trade for
-- the customer; it is recorded here so the limitation is known rather
-- than discovered.
--
-- ⚠️ NULL MEANS "NEVER SENT" AND IS THE ONLY THING THE POLL TESTS.
-- Do not backfill these with NOW() to "tidy" them — that silently
-- suppresses the email for every row touched.
--
-- Safe to run twice: each ADD COLUMN is guarded by an existence check, so
-- a second run reports 'already present' instead of erroring.
--
-- Run in phpMyAdmin against the BVO database.
-- ═══════════════════════════════════════════════════════════════════════


-- ── STEP 1: LOOK FIRST ───────────────────────────────────────────────
-- Expect 0 rows if this has never been run.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'orders'
   AND COLUMN_NAME IN ('ofd_email_sent_at','delivered_email_sent_at',
                       'review_request_sent_at','cross_sell_sent_at');


-- ── STEP 2: ADD THE FOUR MARKERS ─────────────────────────────────────
-- MySQL has no ADD COLUMN IF NOT EXISTS before 8.0.29 / MariaDB 10.0, and
-- this server's version is not worth guessing, so each one is wrapped in
-- a prepared statement that becomes a no-op when the column is there.

-- ofd_email_sent_at
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'ofd_email_sent_at') > 0,
  'SELECT ''ofd_email_sent_at already present'' AS note',
  'ALTER TABLE `orders` ADD COLUMN `ofd_email_sent_at` DATETIME NULL DEFAULT NULL
     COMMENT ''out_for_delivery email sent; NULL = never''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- delivered_email_sent_at
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'delivered_email_sent_at') > 0,
  'SELECT ''delivered_email_sent_at already present'' AS note',
  'ALTER TABLE `orders` ADD COLUMN `delivered_email_sent_at` DATETIME NULL DEFAULT NULL
     COMMENT ''order_delivered email sent; NULL = never''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- review_request_sent_at
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'review_request_sent_at') > 0,
  'SELECT ''review_request_sent_at already present'' AS note',
  'ALTER TABLE `orders` ADD COLUMN `review_request_sent_at` DATETIME NULL DEFAULT NULL
     COMMENT ''review_request email sent; NULL = never''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- cross_sell_sent_at
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'cross_sell_sent_at') > 0,
  'SELECT ''cross_sell_sent_at already present'' AS note',
  'ALTER TABLE `orders` ADD COLUMN `cross_sell_sent_at` DATETIME NULL DEFAULT NULL
     COMMENT ''cross_sell email sent; NULL = never''');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;


-- ── STEP 3: INDEX THE DELAYED-SEND LOOKUP ────────────────────────────
-- The review and cross-sell passes scan for "delivered more than N days
-- ago and not yet sent". Without an index that is a full table scan of
-- `orders` twice per poll, twice a day, forever.
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
      AND INDEX_NAME = 'idx_orders_delivered_at') > 0,
  'SELECT ''idx_orders_delivered_at already present'' AS note',
  'ALTER TABLE `orders` ADD INDEX `idx_orders_delivered_at` (`delivered_at`)');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;


-- ── STEP 4: PROVE IT ─────────────────────────────────────────────────
-- Expect 4 rows, every one DATETIME and YES-nullable.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'orders'
   AND COLUMN_NAME IN ('ofd_email_sent_at','delivered_email_sent_at',
                       'review_request_sent_at','cross_sell_sent_at')
 ORDER BY COLUMN_NAME;

-- Must return 4.
SELECT COUNT(*) AS should_be_four
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
   AND COLUMN_NAME IN ('ofd_email_sent_at','delivered_email_sent_at',
                       'review_request_sent_at','cross_sell_sent_at');

-- Must return 0 — nothing may be pre-marked as sent.
SELECT COUNT(*) AS should_be_zero_premarked
  FROM `orders`
 WHERE ofd_email_sent_at      IS NOT NULL
    OR delivered_email_sent_at IS NOT NULL
    OR review_request_sent_at  IS NOT NULL
    OR cross_sell_sent_at      IS NOT NULL;

-- How many orders the delayed passes will pick up on the first run.
-- Expect a small number; if this is large, STOP and read the note in
-- STEP 2 before letting the cron fire.
SELECT
  SUM(delivered_at IS NOT NULL
      AND delivered_at <= DATE_SUB(NOW(), INTERVAL 7 DAY))  AS review_backlog,
  SUM(delivered_at IS NOT NULL
      AND delivered_at <= DATE_SUB(NOW(), INTERVAL 21 DAY)) AS cross_sell_backlog
  FROM `orders`;
