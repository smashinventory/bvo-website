-- ═══════════════════════════════════════════════════════════════════
-- 2026-09-02 — VERIFY order_events.event_type before trusting the new
--              'shipment_booked' audit row
--
-- WHY THIS EXISTS:
--   We just learned the hard way that MySQL in non-strict mode does NOT
--   error when you write a value outside an ENUM — it silently stores an
--   EMPTY STRING. That is how shipments.status ended up blank and a whole
--   shipment vanished from the UI.
--
--   The booking path now writes event_type = 'shipment_booked', which has
--   never been written before. If event_type happens to be an ENUM that
--   does not include it, every booking audit row will be written blank and
--   we will have built an audit trail that quietly records nothing.
--
--   'shipment_voided' already writes successfully, so the column is at
--   least 16 characters wide. That rules out a truncation problem but says
--   nothing about ENUM membership.
--
-- RUN STEP 1 BEFORE relying on the booking audit trail.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. WHAT IS THE COLUMN? ─────────────────────────────────────────
SHOW COLUMNS FROM order_events LIKE 'event_type';

--   VARCHAR(n)  → nothing to do. Skip the rest of this file.
--   ENUM(...)   → read the list. If 'shipment_booked' is NOT in it,
--                 continue to step 2.


-- ── 2. ONLY IF IT IS AN ENUM MISSING THE VALUE ─────────────────────
-- Add the value rather than widening to VARCHAR — an ENUM here is a
-- feature, not a mistake: it stops typos in event names.
--
-- Include EVERY value the code can write. Current writers:
--   shippingController.js  → 'shipment_booked', 'shipment_voided',
--                            'in_transit', 'delivered'
--   shipmentStatusPoll.js  → 'in_transit', 'delivered'
--   ordersController.js    → 'note_added', plus any eventType passed in
--
-- COPY THE EXISTING MEMBERS FROM STEP 1 INTO THIS LIST FIRST.
-- Running it as written would DROP any member not named here.
--
-- ALTER TABLE order_events
--   MODIFY event_type ENUM(
--     'status_change',
--     'note_added',
--     'shipment_booked',
--     'shipment_voided',
--     'in_transit',
--     'delivered'
--     -- ← add every value shown in step 1 that is missing above
--   ) NOT NULL;


-- ── 3. VERIFY — expect zero rows ───────────────────────────────────
-- SELECT id, order_id, event_type, created_at
--   FROM order_events
--  WHERE event_type = '' OR event_type IS NULL
--  ORDER BY id DESC;


-- ── 4. AFTER THE NEXT BOOKING — expect one row ─────────────────────
-- SELECT order_id, event_type, from_status, to_status, actor, notes, created_at
--   FROM order_events
--  WHERE event_type = 'shipment_booked'
--  ORDER BY id DESC LIMIT 5;


-- ═══════════════════════════════════════════════════════════════════
-- SEPARATE ISSUE — reconcile BVO-20260004
--
-- That order carries shipment ATE34769491 (Booked) but still reads
-- 'confirmed'. With no audit row we cannot tell whether the booking's
-- order UPDATE failed silently or the status was changed by hand during
-- the earlier test cleanup. Either way the data is wrong today.
--
-- Review first:
-- SELECT o.id, o.order_number, o.status AS order_status,
--        s.id AS shipment_id, s.bol_number, s.status AS ship_status
--   FROM orders o
--   JOIN shipments s ON s.order_id = o.id
--  WHERE s.status NOT IN ('voided')
--    AND o.status NOT IN ('shipped','in_transit','delivered','cancelled','refunded');
--
-- Then, for each row returned, decide deliberately:
--   UPDATE orders SET status = 'shipped', updated_at = NOW() WHERE id = <id>;
--
-- These are staging test orders, so correcting them by hand is fine.
-- Do NOT blanket-update in production without reviewing the list.
-- ═══════════════════════════════════════════════════════════════════
