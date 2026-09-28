-- ════════════════════════════════════════════════════════════════════
-- Saved pickup addresses, selectable on the shipping create form.
-- Owner-approved 2026-09-28.
--
-- WHY
--
-- The origin panel on /admin/shipping/create was HARD-CODED as value=
-- attributes in the template — 50 Ernest W Barrett Pkwy NW, Marietta,
-- every time. Owner: "we sometimes have the order picked up from the
-- vendor. So, we need the ability to add addresses that can be saved to
-- a dropdown selector."
--
-- A hard-coded origin is not just inconvenient. It is the address the
-- carrier is dispatched to. Getting it wrong means a truck at the wrong
-- dock and a missed pickup window.
--
-- ────────────────────────────────────────────────────────────────────
-- WHAT IS DELIBERATELY *NOT* BUILT — AUTO-SELECT BY VENDOR
--
-- Recorded so nobody adds it later thinking it was an oversight.
--
-- Owner, 2026-09-28: "Leave out auto select vendor for now as many
-- vendors have multiple pick up addresses and we do not have a way of
-- programmatically knowing which to ship from - we have to manually
-- check in the pre-shipping phase."
--
-- A vendor -> address link would therefore be WRONG more often than
-- right, and wrong here dispatches a truck to the wrong warehouse. The
-- dropdown is a human choice on purpose.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pickup_addresses (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- What the operator sees in the dropdown. The whole point of the
  -- feature: "RFL Marietta" is recognisable where a street address is
  -- not, especially when several vendors sit in the same city.
  nickname      VARCHAR(80)  NOT NULL,

  company       VARCHAR(120) NULL,
  contact_name  VARCHAR(120) NULL,

  -- WWEX REJECTS A BOOKING WITH NO ORIGIN PHONE ("Origin Phone is
  -- required"), so this is NOT NULL. The same defect cost a round of
  -- failed bookings on the destination side in September.
  phone         VARCHAR(30)  NOT NULL,
  phone_ext     VARCHAR(10)  NULL,

  address1      VARCHAR(200) NOT NULL,
  address2      VARCHAR(200) NULL,
  city          VARCHAR(100) NOT NULL,
  state         CHAR(2)      NOT NULL,
  zip           VARCHAR(10)  NOT NULL,
  country       CHAR(2)      NOT NULL DEFAULT 'US',

  -- Maps to WWEX originAddress.locationType. Empty string = standard
  -- commercial, which is the API's own default. Curated values only —
  -- see the select in create.ejs; a value outside the enum is silently
  -- ignored by WWEX rather than rejected.
  location_type VARCHAR(40)  NULL,

  -- Gate codes, dock hours, "ask for Mike", appointment requirements.
  -- Not sent to the carrier; it is for whoever books the pickup.
  notes         TEXT         NULL,

  -- EXACTLY ONE default, enforced in the controller rather than by a
  -- constraint: MySQL cannot express "at most one row where is_default
  -- = 1" without a generated column or a trigger, and both are harder
  -- to reason about than a transaction that clears the others first.
  is_default    TINYINT(1)   NOT NULL DEFAULT 0,

  -- DEACTIVATE, NEVER DELETE. shipments.pickup_address_id points here,
  -- and a deleted row turns a historic shipment's origin into a dangling
  -- id. Inactive rows drop out of the dropdown and stay readable.
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,

  sort_order    INT          NOT NULL DEFAULT 0,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uniq_nickname (nickname),
  KEY idx_active_sort (is_active, sort_order, nickname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- COLLATE NAMED EXPLICITLY. The server default here is
-- utf8mb4_uca1400_ai_ci and the rest of this schema is unicode_ci;
-- customer_auth_codes took the default on 2026-09-27 and produced
-- "#1267 Illegal mix of collations" the first time anything joined text
-- across the two. See OPEN_ITEMS.

-- ── Seed the address that was hard-coded in the template ────────────
-- Owner named it: "The current address needs a nick name of RFL
-- Marietta." Values copied verbatim from create.ejs so nothing on the
-- form changes until a second address is added.
INSERT INTO pickup_addresses
  (nickname, company, phone, address1, city, state, zip, country, is_default, is_active, sort_order)
SELECT 'RFL Marietta', 'Bathroom Vanities Outlet', '7706352030',
       '50 Ernest W Barrett Pkwy NW', 'Marietta', 'GA', '30066', 'US', 1, 1, 0
 WHERE NOT EXISTS (SELECT 1 FROM pickup_addresses WHERE nickname = 'RFL Marietta');

-- ── Which origin a shipment actually used ───────────────────────────
-- Owner approved recording this.
--
-- NOTE, corrected while wiring it up: shipments ALREADY stores
-- origin_company, origin_city, origin_state and origin_zip, so the
-- address itself was never lost. What was missing is WHICH SAVED
-- ADDRESS it was — and that is the legible answer. "RFL Marietta" tells
-- you ours-or-the-vendor's at a glance; "Marietta, GA" does not once
-- two vendors share a city.
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS pickup_address_id INT UNSIGNED NULL AFTER order_id,
  -- A SNAPSHOT, not a join. Addresses get edited and deactivated; a
  -- shipment from eighteen months ago must still say where it left
  -- from, even if that row has since been renamed or retired.
  ADD COLUMN IF NOT EXISTS pickup_nickname VARCHAR(80) NULL AFTER pickup_address_id;

CREATE INDEX IF NOT EXISTS idx_shipments_pickup ON shipments (pickup_address_id);

-- ── VERIFY ──────────────────────────────────────────────────────────
-- SHOW, not INFORMATION_SCHEMA: this host denies that database (#1044)
-- and the denial aborts the rest of the file.
SELECT id, nickname, company, city, state, zip, is_default, is_active
  FROM pickup_addresses ORDER BY sort_order, nickname;

SHOW COLUMNS FROM shipments LIKE 'pickup_%';

-- Expect 1. More than one default is a bug in the controller.
SELECT COUNT(*) AS default_count FROM pickup_addresses WHERE is_default = 1;
