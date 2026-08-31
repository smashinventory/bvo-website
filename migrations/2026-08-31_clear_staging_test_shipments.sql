-- ═══════════════════════════════════════════════════════════════════
-- Clear staging test shipments
--
-- Safe to run while WWEX_ENV=staging. These rows record transactions in
-- WWEX's STAGING environment — no carrier was dispatched and nothing was
-- charged. They do not appear in the production SpeedShip portal because
-- that portal only shows production data.
--
-- RUN THE SELECT FIRST and eyeball the rows before deleting anything.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. REVIEW — what is currently in the table ─────────────────────
SELECT id,
       order_id,
       bol_number,
       pro_number,
       carrier,
       total_charge,
       status,
       ship_date,
       created_at
FROM shipments
ORDER BY id;

-- ── 2. DELETE — the two staging test shipments ─────────────────────
-- Adjust the id list to match what the SELECT above returned.
-- DELETE FROM shipments WHERE id IN (1, 2);

-- ── Alternative: wipe every shipment and restart numbering at 1.
-- Only safe while NO real production shipment has been booked.
-- TRUNCATE TABLE shipments;

-- ── 3. VERIFY ──────────────────────────────────────────────────────
-- SELECT COUNT(*) AS remaining FROM shipments;


-- ═══════════════════════════════════════════════════════════════════
-- 4. REVERT THE ORDER STATUSES
--
-- Deleting a shipments row does NOT undo the order update. bookShipment()
-- runs a separate statement:
--     UPDATE orders SET status='shipped', tracking_number=? WHERE id=?
-- so BVO-20260001 and BVO-20260002 still read "Shipped" with no shipment
-- attached to them.
-- ═══════════════════════════════════════════════════════════════════

-- Review first:
SELECT id, order_number, status, tracking_number, updated_at
FROM orders
WHERE status = 'shipped'
ORDER BY id;

-- Then revert the test orders (adjust the ids to match the SELECT):
-- UPDATE orders
--    SET status = 'confirmed',
--        tracking_number = NULL,
--        updated_at = NOW()
--  WHERE id IN (1, 2);

-- Verify:
-- SELECT id, order_number, status, tracking_number FROM orders ORDER BY id;


-- ═══════════════════════════════════════════════════════════════════
-- 5. ORPHANED BOOKING — ATE34769194
--
-- The second test booking (order BVO-20260002, SEFL, quote Q14293357)
-- SUCCEEDED at WWEX but was never written to the shipments table: the
-- INSERT referenced pickup_txn_id before that column existed, and
-- safeQuery() swallowed the error silently, so the UI still reported
-- "Shipment Booked".
--
-- It is a STAGING shipment, so nothing real was dispatched and no action
-- is required. Recorded here only so the missing row is explained rather
-- than looking like data loss.
--
--   BOL                  ATE34769194
--   PRO                  139796118
--   productTransactionId a175747d-d064-4053-acf5-8f09d6049255
--   pickupTxnId          26c3f457-06a7-47b1-8c64-e786145d2dee
--
-- The silent-failure bug is fixed: the booking INSERT now uses mustQuery()
-- and reports the BOL back to the operator if the write ever fails again.
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- ⚠️  BEFORE SWITCHING WWEX_ENV TO production
--
-- The shipments table has no column recording which WWEX environment a
-- row came from. Once you flip to production, staging test rows and real
-- shipments will sit side by side with no way to tell them apart — and a
-- staging row can never be voided, tracked or documented against the
-- production API.
--
-- So: clear all staging rows FIRST, then switch WWEX_ENV.
--
-- If you would rather keep the history, add an environment column before
-- the switch instead:
--
--   ALTER TABLE shipments
--     ADD COLUMN wwex_env VARCHAR(12) NOT NULL DEFAULT 'staging'
--     AFTER product_type;
--
--   UPDATE shipments SET wwex_env = 'staging';
--
-- and have bookShipment() write wwex.WWEX_ENV on every insert. Say the
-- word and I will wire that up.
-- ═══════════════════════════════════════════════════════════════════
