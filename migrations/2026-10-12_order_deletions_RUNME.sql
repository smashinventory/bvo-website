-- ─────────────────────────────────────────────────────────────────────────
-- 2026-10-12  order_deletions — the audit trail behind admin order deletion
--
-- WHY A HARD DELETE AND NOT A FLAG. `orders` is read in roughly thirty places
-- across ten files (ordersController, adminController, checkoutController,
-- shippingController, returnsController, customerAnalyticsController,
-- siteAnalyticsController, emailVerificationService, shipmentStatusPoll).
-- A deleted_at flag would have to be filtered in every one of them, and a
-- single missed filter means a deleted order silently keeps counting toward a
-- revenue KPI. A DELETE is consistent everywhere the moment it runs.
--
-- WHY AN AUDIT TABLE ANYWAY. The delete button is permanent; the test-data
-- cleanup it was built for is not. Someone will eventually point it at a real
-- order. This table is NOT a soft delete and nothing reads it at runtime — it
-- is a flight recorder, so "what was order X and who removed it" has an
-- answer. Because no application query reads it, it adds no filter surface.
--
-- The full order row goes in as JSON rather than as columns: the shape of
-- `orders` will keep changing, and a snapshot that silently stops capturing
-- new columns is worse than no snapshot.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `order_deletions` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,

  -- Denormalised on purpose: these four are what you search by when someone
  -- asks "where did that order go", and they must survive the orders row.
  `order_id`        INT UNSIGNED    NOT NULL,
  `order_number`    VARCHAR(50)     NOT NULL,
  `order_total`     DECIMAL(10,2)       NULL,
  `order_status`    VARCHAR(32)         NULL,

  -- Non-NULL here is the loud case: money was taken and the record was still
  -- removed. The handler refuses this unless explicitly forced.
  `payment_captured_at` DATETIME        NULL,
  `stripe_payment_intent` VARCHAR(255)  NULL,

  `order_snapshot`  JSON                NULL,  -- the whole row, as it was
  `child_counts`    JSON                NULL,  -- {items, events, shipments, returns, samples}

  `deleted_by`      VARCHAR(100)    NOT NULL DEFAULT 'admin',
  `deleted_reason`  VARCHAR(255)        NULL,
  `deleted_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_order_number` (`order_number`),
  KEY `idx_deleted_at`   (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify:
--   SELECT COUNT(*) FROM order_deletions;
