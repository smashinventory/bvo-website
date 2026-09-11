-- ═══════════════════════════════════════════════════════════════════
-- 2026-09-02 — repair blank shipment status
--
-- CAUSE:
--   shipments.status is ENUM('booked','in_transit','delivered','exception','voided').
--   Code briefly wrote 'out_for_delivery', which is not in that ENUM. MySQL in
--   non-strict mode does NOT error on an invalid ENUM value — it silently
--   stores an EMPTY STRING. The affected row then matched no status filter,
--   so it vanished from the status poll and rendered with a blank badge.
--
--   Observed on shipment #1 (BOL ATE34769491): status = ''.
--
-- FIXED IN CODE:
--   'Out For Delivery' now maps to 'in_transit', and both the controller and
--   the poll job validate against SHIPMENT_STATUSES before any write, so an
--   unknown value can never reach the column again.
--
-- This script repairs rows already damaged.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. REVIEW — find affected rows ─────────────────────────────────
SELECT id, bol_number, pro_number, status, ship_date, order_id, updated_at
FROM shipments
WHERE status = '' OR status IS NULL
ORDER BY id;

-- ── 2. REPAIR ──────────────────────────────────────────────────────
-- 'booked' is the safe reset: the next status poll re-queries the carrier
-- and will set the true current state. Do NOT guess at in_transit or
-- delivered here — let the carrier be the source of truth.
-- UPDATE shipments
--    SET status = 'booked', updated_at = NOW()
--  WHERE status = '' OR status IS NULL;

-- ── 3. VERIFY — expect zero rows ───────────────────────────────────
-- SELECT COUNT(*) AS still_blank FROM shipments WHERE status = '' OR status IS NULL;

-- ── 4. CONFIRM the ENUM definition ─────────────────────────────────
-- SHOW COLUMNS FROM shipments LIKE 'status';
-- Expect: enum('booked','in_transit','delivered','exception','voided')

-- ═══════════════════════════════════════════════════════════════════
-- OPTIONAL — make MySQL fail loudly instead of silently
--
-- The root hazard is non-strict mode. Under STRICT_TRANS_TABLES an invalid
-- ENUM write raises an error instead of storing ''. Worth considering, but
-- test first: strict mode also rejects other sloppy writes elsewhere in the
-- app, so enabling it globally could surface unrelated failures.
--
--   SELECT @@sql_mode;
--
-- Hostinger shared MySQL may not permit changing this. Not required — the
-- code-level whitelist already prevents the bad write.
-- ═══════════════════════════════════════════════════════════════════
