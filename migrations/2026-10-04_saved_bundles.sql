-- ---------------------------------------------------------------------------
-- BVO · saved_bundles — "Save Your Bundle"
-- Generated 2026-10-04.
--
-- ONE NEW TABLE. Nothing existing is altered or dropped. No product data is
-- touched. The bundle builder's own logic is unchanged — this only records
-- which products a signed-in customer picked.
--
-- WHY PRODUCT IDs AND NOT A PRICE SNAPSHOT
-- A saved bundle is a shortlist, not a quote. Someone returning three weeks
-- later must see CURRENT price and availability, not a stale figure they
-- would reasonably expect us to honour. Storing ids means the dashboard
-- re-reads products on every view and a discontinued item simply drops out.
--
-- ON DELETE CASCADE on customer_id: if a customer is removed, their saved
-- bundles go with them rather than lingering as orphans pointing at a
-- customer_id that no longer exists.
--
-- The four slot columns mirror the builder's own state object exactly
-- (cabinet / top / mirror / faucet, with quantities on the two that can
-- repeat). No JSON blob: these four are a fixed, known shape, and columns
-- stay queryable — "which cabinets get saved most" is a useful question.
--
-- HOW TO RUN. phpMyAdmin -> bvo_website -> SQL tab -> paste -> Go.
-- RUN THIS BEFORE DEPLOYING THE CODE. The save endpoint writes to this
-- table; if the code lands first, a save returns a 500.
-- Verification SELECT is at the bottom. Rollback is below that.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `saved_bundles` (
  `id`          INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` INT(10) UNSIGNED NOT NULL,
  `name`        VARCHAR(120)     DEFAULT NULL COMMENT 'Reserved: user-given label. Unused in the first pass.',
  `cabinet_id`  INT(10) UNSIGNED DEFAULT NULL,
  `top_id`      INT(10) UNSIGNED DEFAULT NULL,
  `mirror_id`   INT(10) UNSIGNED DEFAULT NULL,
  `mirror_qty`  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `faucet_id`   INT(10) UNSIGNED DEFAULT NULL,
  `faucet_qty`  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `created_at`  TIMESTAMP        NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_created` (`customer_id`, `created_at`),
  CONSTRAINT `fk_saved_bundles_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── VERIFY ────────────────────────────────────────────────────────────────
SELECT COUNT(*) AS saved_bundles_rows FROM saved_bundles;
-- Expect 0 on a fresh install.

SHOW CREATE TABLE saved_bundles;
-- Expect the FK to customers(id) with ON DELETE CASCADE.

-- ── ROLLBACK ──────────────────────────────────────────────────────────────
-- Safe: this table is new and nothing else references it.
-- DROP TABLE IF EXISTS saved_bundles;
