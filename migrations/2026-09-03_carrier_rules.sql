-- ═══════════════════════════════════════════════════════════════════════
-- 2026-09-03_carrier_rules.sql
-- Carrier requirements that WWEX does not return.
--
-- ADDITIVE ONLY. Creates one new table and seeds two rows. Touches nothing
-- that exists. Nothing in the app reads this table yet — wiring comes in a
-- later, separate change so this can be applied and inspected on its own.
--
-- ── WHY THIS TABLE EXISTS ──────────────────────────────────────────────
-- SpeedShip's web UI shows carrier rules that never reach our integration.
-- Verified 2026-09-03 by clicking the rate for all 12 carriers on a
-- Marietta GA -> Chicago IL quote:
--
--   RL Carriers   BLOCKING modal on rate selection — labeling requirement
--   TForce        INLINE banner, no acknowledgement — 3pm pickup cutoff
--
-- Ten others showed nothing.
--
-- We then proved the API does not carry them, rather than assuming it:
--   * scanned an entire live shopFlow response for prose BY VALUE, not by
--     field name. Only hit was specialInstructions — our own input echoed
--     back, identical on all six offers.
--   * the root 'message' key we had never read contains 'Shop Offers
--     created.' A status string.
--   * primaryVendor declares latestPickupTime, pickupWindow, pickupDays,
--     businessHours, commentList, coverageDetails, notificationWindow —
--     and every one is NULL for every carrier.
--
-- So this is a maintained table by necessity, not by preference. It is a
-- copy of someone else's policy, which is exactly why last_verified_at
-- exists: the table cannot know when the carrier changes their mind, so it
-- records when a human last checked instead of pretending to be current.
--
-- ── THE DESIGN DECISION WORTH KEEPING ──────────────────────────────────
-- applies_at splits rules by WHO HAS TO ACT, which is the whole point:
--
--   'book'  affects the booking itself. rule_value is machine-readable so
--           the system can APPLY it (compare a cutoff against the clock)
--           rather than print a sentence and hope somebody reads it.
--
--   'pack'  an instruction for the hands doing the physical work. For BVO
--           that is the VENDOR's warehouse — James Martin palletises and
--           hands off to the carrier. So a 'pack' rule has to travel with
--           the paperwork, not sit in an admin screen the vendor never
--           opens. SpeedShip's modal interrupts the wrong person; copying
--           that pattern into BVO would interrupt the wrong person twice.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS carrier_rules (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- SCAC is the join key: it is what WWEX returns on every offer
  -- (primaryVendor.scac). preferredName varies in case and punctuation
  -- ('RL Carriers', 'TFORCE FREIGHT') and is display text, not an id.
  scac              VARCHAR(10)  NOT NULL,
  carrier_name      VARCHAR(100) NULL COMMENT 'display only — never join on this',

  rule_type         VARCHAR(32)  NOT NULL COMMENT 'pickup_cutoff | labeling | packaging | other',

  -- book = changes the booking. pack = instruction for whoever handles the
  -- freight. Drives WHERE the rule surfaces; see the header note.
  applies_at        VARCHAR(8)   NOT NULL COMMENT 'book | pack',

  -- Machine-readable form, when the rule has one. '15:00' for a cutoff.
  -- NULL for rules that are purely instructional.
  rule_value        VARCHAR(64)  NULL,
  rule_tz           VARCHAR(32)  NULL COMMENT "e.g. 'shipper_local' — a cutoff without a zone is a guess",

  -- Human form. For 'pack' rules this is what gets printed or emailed, so
  -- it is written to be read by a warehouse, not by us.
  rule_text         TEXT         NULL,

  -- Provenance. These are transcriptions of someone else's policy; where we
  -- got it decides how much to trust it and where to re-check.
  source            VARCHAR(255) NULL,
  last_verified_at  DATE         NULL COMMENT 'when a HUMAN last confirmed this against the carrier/SpeedShip',

  is_active         TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uk_carrier_rule (scac, rule_type),
  KEY idx_lookup (is_active, applies_at, scac)
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
/* COLLATE IS EXPLICIT ON PURPOSE. utf8mb4 with no COLLATE resolves to
   utf8mb4_uca1400_ai_ci on newer MariaDB and utf8mb4_unicode_ci on older —
   which is how the jmv tables ended up unjoinable against products with
   'Illegal mix of collations'. This table will be joined against shipments
   and products, so the collation is stated rather than inherited. */
COLLATE=utf8mb4_unicode_ci;


-- ── SEED ───────────────────────────────────────────────────────────────
-- ON DUPLICATE KEY UPDATE so re-running is safe, but it deliberately does
-- NOT overwrite rule_text: if someone has since corrected the wording by
-- hand, a re-run of this file must not silently revert their edit. Only
-- last_verified_at and is_active are refreshed.

INSERT INTO carrier_rules
  (scac, carrier_name, rule_type, applies_at, rule_value, rule_tz, rule_text, source, last_verified_at, is_active)
VALUES
  ('RLCA', 'RL Carriers', 'labeling', 'pack', NULL, NULL,
   'R&L requires that each handling unit display both shipper and consignee information. Affix shipping labels or additional BOL copies to each handling unit. If the freight is palletised, one label per pallet is sufficient.',
   'speedship.com quote UI — blocking modal on rate selection, observed 2026-09-03',
   '2026-09-03', 1),

  ('UPGF', 'TForce Freight', 'pickup_cutoff', 'book', '15:00', 'shipper_local',
   'Any pickup request received after 3pm shipper local time will be scheduled for the following business day.',
   'speedship.com quote UI — inline banner on the rate row, observed 2026-09-03',
   '2026-09-03', 1)
ON DUPLICATE KEY UPDATE
  last_verified_at = VALUES(last_verified_at),
  is_active        = VALUES(is_active);


-- ── VERIFY ─────────────────────────────────────────────────────────────
-- No information_schema: the DB user on this host does not have access to
-- it, and a query against it aborts the whole import with #1044 while
-- phpMyAdmin still reports the earlier statements as succeeding. That is
-- how a previous migration reported '8 queries executed' having run none
-- of its ALTERs.
SELECT scac, carrier_name, rule_type, applies_at, rule_value, rule_tz,
       last_verified_at, is_active
FROM carrier_rules
ORDER BY applies_at, scac;

-- EXPECTED: exactly 2 rows.
--   UPGF  TForce Freight  pickup_cutoff  book  15:00  shipper_local  2026-09-03  1
--   RLCA  RL Carriers     labeling       pack  NULL   NULL           2026-09-03  1
--
-- ⚠ RLCA is confirmed from our own API responses (primaryVendor.scac).
--   UPGF is TForce Freight's known SCAC but has NOT been observed in a BVO
--   response yet — the staging rate shop returned 6 carriers and TForce was
--   not among them. Confirm it against a production rate shop that returns
--   TForce before relying on the cutoff to move a ship date.
