-- ---------------------------------------------------------------------------
-- BVO · customer analytics — test exclusion + signup attribution
-- Generated 2026-10-04.
--
-- THREE COLUMNS. No table is created, renamed or dropped, and no existing
-- column changes type. Every ADD is nullable or carries a default, so nothing
-- that writes to customers or orders today needs to know these exist.
--
-- ── WHY is_test ────────────────────────────────────────────────────────────
-- Every customer and order in the database on this date was created during
-- pre-cutover testing (9 customers, 11 orders, all 28-29 Sept, including the
-- sample order placed as a live test). Counted as real they would poison
-- every metric from the first day: an AOV of $3,495 and a 100% account-order
-- rate that describe nobody.
--
-- A FLAG, NOT A DATE CUTOFF. "created_at < cutover" is implicit, invisible at
-- the call site, and wrong the first time anyone places a test order next
-- month. A column can be read, reasoned about, and toggled in the admin when
-- the next test happens.
--
-- Seeded by id, not by date: every row that exists AS THIS SCRIPT RUNS is a
-- test. That is a statement of fact about this moment, and it cannot
-- mis-classify a real order placed while the migration is being run.
--
-- ── WHY signup_source ──────────────────────────────────────────────────────
-- The report that matters in six months — which of these efforts actually
-- produced customers — needs a field captured at signup. It cannot be
-- backfilled: once someone has signed up without it, the answer for that
-- person is gone. Adding the column costs nothing now and is impossible
-- later, which is the whole argument for doing it today.
--
-- Existing rows are left NULL rather than guessed at. The reports show that
-- as "unknown" and say so, because inventing attribution for nine test rows
-- would be a lie that looks like data.
--
-- HOW TO RUN. phpMyAdmin -> bvo_website -> SQL tab -> paste -> Go.
-- Verification SELECTs at the bottom. Rollback below that.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;

-- ── 1. Columns ─────────────────────────────────────────────────────────────
ALTER TABLE `customers`
  ADD COLUMN `signup_source` VARCHAR(40) DEFAULT NULL
    COMMENT 'What produced this account: bundle_save, sample_request, checkout, newsletter, direct. NULL = before attribution existed.',
  ADD COLUMN `is_test` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Excluded from every analytics metric. Set by hand for staff and test accounts.';

ALTER TABLE `orders`
  ADD COLUMN `is_test` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Excluded from every analytics metric.';

-- Reports filter on these, and both tables will grow.
ALTER TABLE `customers` ADD KEY `idx_is_test_created` (`is_test`, `created_at`);
ALTER TABLE `orders`    ADD KEY `idx_is_test_created` (`is_test`, `created_at`);

-- ── 2. Flag everything that exists right now ───────────────────────────────
-- Scoped by id so the statement describes exactly the rows present when it
-- runs. A real order arriving mid-migration gets a higher id and is untouched.
UPDATE `customers` SET `is_test` = 1
 WHERE `id` <= (SELECT * FROM (SELECT COALESCE(MAX(`id`), 0) FROM `customers`) AS x);

UPDATE `orders` SET `is_test` = 1
 WHERE `id` <= (SELECT * FROM (SELECT COALESCE(MAX(`id`), 0) FROM `orders`) AS y);

-- ── VERIFY ────────────────────────────────────────────────────────────────
SELECT 'customers' AS tbl, COUNT(*) AS total,
       SUM(is_test = 1) AS flagged_test,
       SUM(is_test = 0) AS counted_as_real
  FROM customers
UNION ALL
SELECT 'orders', COUNT(*), SUM(is_test = 1), SUM(is_test = 0) FROM orders;
-- Expect counted_as_real = 0 on BOTH rows today. Every real customer and
-- order from here on is created with is_test = 0 by default.

SHOW COLUMNS FROM customers LIKE 'signup\_source';
-- Expect one row, varchar(40), NULL allowed.

-- ── ROLLBACK ──────────────────────────────────────────────────────────────
-- Drops only what this script added. No data other than these columns is
-- affected, because nothing else was written.
-- ALTER TABLE `customers` DROP KEY `idx_is_test_created`,
--                         DROP COLUMN `is_test`,
--                         DROP COLUMN `signup_source`;
-- ALTER TABLE `orders`    DROP KEY `idx_is_test_created`,
--                         DROP COLUMN `is_test`;
