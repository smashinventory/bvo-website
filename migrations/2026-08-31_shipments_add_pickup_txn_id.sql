-- ═══════════════════════════════════════════════════════════════════
-- 2026-08-31 — shipments: add pickup_txn_id
--
-- WHY:
--   Voiding an LTL shipment failed with
--     "LTL does not support shipment only cancel; exception: AppException"
--
--   Per /LTL/integratedCancelFlow in the WWEX V4 Postman collection, an LTL
--   cancel must send TWO ids in cancelRQList: the shipment
--   productTransactionId AND the pickup transaction id returned by
--   quoteOrderFlow at booking time. BVO was only sending the first, and had
--   nowhere to store the second.
--
-- RUN THIS ONCE against the BVO production database (phpMyAdmin is fine).
-- Safe to re-run: the IF NOT EXISTS guard makes it idempotent on MySQL 8.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS pickup_txn_id VARCHAR(100) NULL
  AFTER product_transaction_id;

-- ── Verify ─────────────────────────────────────────────────────────
-- Expect one row showing pickup_txn_id / varchar(100) / YES
SHOW COLUMNS FROM shipments LIKE 'pickup_txn_id';

-- ── Note on existing rows ──────────────────────────────────────────
-- Shipments booked before this change have pickup_txn_id = NULL and cannot
-- be voided from the BVO admin. The controller now returns a clear message
-- telling the user to void those directly in the SpeedShip portal.
--
-- If your MySQL is older than 8.0 and rejects "ADD COLUMN IF NOT EXISTS",
-- use this instead:
--   ALTER TABLE shipments
--     ADD COLUMN pickup_txn_id VARCHAR(100) NULL AFTER product_transaction_id;
