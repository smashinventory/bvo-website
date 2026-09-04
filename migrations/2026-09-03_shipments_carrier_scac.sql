-- ═══════════════════════════════════════════════════════════════════════
-- 2026-09-03_shipments_carrier_scac.sql
-- STEP 3 of 3 — give shipments a SCAC so carrier_rules can actually match.
--
-- ADDITIVE. One nullable column. No default, no backfill, no data touched.
-- Every existing row keeps working; carrier_scac is simply NULL on them.
--
-- ── WHY ────────────────────────────────────────────────────────────────
-- shipments stores `carrier` — the DISPLAY name WWEX returns:
--
--   'RL Carriers'   'TFORCE FREIGHT'   'FEDEX FREIGHT ECONOMY'
--
-- Case and punctuation vary by carrier and are not ours to control.
-- carrier_rules joins on SCAC ('RLCA', 'UPGF'). Without this column, the
-- pack-time lookup in emailDocuments would compare a display name against a
-- SCAC, match nothing, and look exactly like 'no rules apply'.
--
-- That is the same fault caught one layer up in 08f3032, where rate rows
-- carried no SCAC either. It is worth naming the pattern: a join key that
-- is almost right produces silence, not an error, and silence is
-- indistinguishable from success.
--
-- A name-based fallback was considered and REJECTED. 'RL Carriers' vs
-- 'R+L Carriers' vs 'RLCA' is precisely the fragility SCAC exists to avoid,
-- and a match that works most of the time is worse here than one that is
-- honestly absent — this text tells a warehouse how to label freight.
--
-- ── SCOPE ──────────────────────────────────────────────────────────────
-- Existing shipments are all test bookings, to be cancelled, so nothing of
-- value is left un-annotated. Going forward bookShipment writes the SCAC it
-- already receives from the selected rate.
-- ═══════════════════════════════════════════════════════════════════════

-- IF NOT EXISTS is not available for ADD COLUMN on this MariaDB version, so
-- re-running this file will error with #1060 Duplicate column name. That is
-- SAFE and means the column is already present — it is not a partial apply.
ALTER TABLE shipments
  ADD COLUMN carrier_scac VARCHAR(10) NULL
    COMMENT 'WWEX primaryVendor.scac — the join key for carrier_rules. carrier is display text.'
    AFTER carrier;

CREATE INDEX idx_shipments_carrier_scac ON shipments (carrier_scac);


-- ── VERIFY ─────────────────────────────────────────────────────────────
-- No information_schema: the DB user has no access, and querying it aborts
-- the import with #1044 while phpMyAdmin still reports earlier statements as
-- having succeeded.
SHOW COLUMNS FROM shipments LIKE 'carrier_scac';

-- EXPECTED: one row —
--   carrier_scac | varchar(10) | YES | MUL | NULL |
--
-- Then this should return every existing shipment with carrier_scac NULL,
-- which is correct and expected. They are the test bookings.
SELECT id, carrier, carrier_scac, status, created_at
FROM shipments
ORDER BY created_at DESC
LIMIT 20;
