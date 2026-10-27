-- ═══════════════════════════════════════════════════════════════════════
-- 2026-10-27_manual_tracking_RUNME.sql
-- Manual tracking entry for vendor-shipped orders.
--
-- ADDITIVE ONLY. Two nullable/defaulted columns on `shipments`. No data is
-- modified, no column is dropped, nothing existing changes behaviour.
--
-- ── WHY ────────────────────────────────────────────────────────────────
-- Some orders ship direct from the vendor. We never touch WWEX, we are
-- handed a tracking number and that is all. Today there is no way to
-- record one: both booking paths go through WWEX, so a vendor-shipped
-- order has no shipment row, no Track button, and no shipped email.
--
-- The row goes in `shipments` rather than a new table on purpose. The
-- customer tracking page, the order-detail panel, the status chips and
-- the order status propagation all already read that table. A parallel
-- "manual_tracking" table would mean every one of those surfaces needed a
-- second code path, and the second path is where they drift.
--
-- ── THE TWO COLUMNS ────────────────────────────────────────────────────
-- tracking_url   The link the VENDOR gave us, pasted verbatim.
--                ⚠️ THIS EXISTS BECAUSE CARRIER URL FORMATS ROT. FedEx
--                has changed its public tracking URL more than once and
--                published sources currently disagree on the parameter
--                (?trknbr= vs ?tracknumbers=). A hardcoded template that
--                breaks produces a dead link in the one email a customer
--                actually opens, which reads as "the carrier lost my
--                order". A pasted URL cannot rot. src/utils/shipMode.js
--                prefers this column over every built-in template.
--
-- entry_source   'wwex'   — booked through the API, as today
--                'manual' — somebody typed the number in
--                ⚠️ LOAD BEARING FOR THE STATUS POLL. A manual row has no
--                product_transaction_id, so asking WWEX about it is
--                meaningless. shipmentStatusPoll MUST skip these or it
--                will either error or, worse, overwrite a hand-entered
--                status with a lookup failure.
--
-- ── MODE ───────────────────────────────────────────────────────────────
-- No new column. `product_type` ENUM('LTL','SMALLPACK') already carries
-- it and is already what the customer copy keys on. The entry form writes
-- it explicitly instead of accepting the 'LTL' default, because the
-- default is the thing that silently made every parcel look like freight.
--
-- ── NOTE ON order_id ───────────────────────────────────────────────────
-- `shipments.order_id` is UNIQUE. One shipment per order, enforced by the
-- schema. The entry handler therefore UPSERTs — a second save corrects the
-- first rather than erroring or quietly creating a duplicate.
-- ═══════════════════════════════════════════════════════════════════════

-- ── STEP 1: LOOK BEFORE YOU TOUCH ──────────────────────────────────────
-- Run this first. If either column already exists, STOP — the migration
-- has been applied and Step 2 is a no-op at best.
SHOW COLUMNS FROM shipments LIKE 'tracking_url';
SHOW COLUMNS FROM shipments LIKE 'entry_source';


-- ── STEP 2: ADD THEM ───────────────────────────────────────────────────
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS tracking_url  VARCHAR(500) NULL
    COMMENT 'Carrier tracking link, pasted. Wins over any built-in template.',
  ADD COLUMN IF NOT EXISTS entry_source  ENUM('wwex','manual') NOT NULL DEFAULT 'wwex'
    COMMENT 'manual = typed in by hand; has no product_transaction_id, skip the WWEX status poll.';


-- ── STEP 3: PROVE IT ───────────────────────────────────────────────────
-- Expect: tracking_url VARCHAR(500) YES NULL
--         entry_source enum('wwex','manual') NO 'wwex'
SHOW COLUMNS FROM shipments LIKE 'tracking_url';
SHOW COLUMNS FROM shipments LIKE 'entry_source';

-- Every pre-existing row must read 'wwex' — the default backfills them,
-- and they genuinely were booked through the API.
-- Expect: one row, entry_source='wwex', n = (however many shipments exist)
SELECT entry_source, COUNT(*) AS n FROM shipments GROUP BY entry_source;
