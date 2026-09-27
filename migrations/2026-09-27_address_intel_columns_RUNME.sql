-- ======================================================================
--  2026-09-27_address_intel_columns_RUNME.sql
--
--  Columns for list items 16 and 17 - Google Places Autocomplete and
--  Address Validation. Added BEFORE the code that writes them, so the
--  build has somewhere to put its output instead of growing a migration
--  bolted on afterwards.
--
--  Safe to re-run: every statement is ADD COLUMN IF NOT EXISTS.
--  MariaDB 11.8.9 supports it.
--
--  NO NEW TABLE, AND WHY
--  One order has exactly one ship-to address. A separate table would buy
--  nothing but a join on every order page and a second place for the
--  address to disagree with itself. These live beside ship_lat / ship_lng
--  / ship_geocode_source / ship_geocoded_at, which are already on orders
--  and already carry the same 1:1 relationship.
--
--  NULL MEANS NOT ASKED, NOT CLEAN
--  Every column below stays NULL when the call was never made or the
--  response did not carry the fact. A NULL ship_usps_dpv does NOT mean
--  USPS declined to confirm the address - it means we never asked. No
--  screen built on these columns may render an absent value as a
--  negative one. Orders placed before this ships are all NULL and none of
--  them are suspect.
--
--  THERE IS NO RESIDENTIAL/BUSINESS FIELD IN THIS API
--  Checked against the validateAddress response reference on 2026-09-27:
--  UspsData carries dpvConfirmation, dpvCmra, dpvVacant, dpvNoStat,
--  dpvNoSecureLocation, dpvDoorNotAccessible and carrierRoute. It does
--  NOT carry a USPS RDI residential indicator. The residential flag that
--  drives the freight surcharge stays the buyer's checkbox. Do not go
--  looking for an RDI field later on the assumption it was missed.
-- ======================================================================

-- ----------------------------------------------------------------------
--  From Autocomplete (item 17)
-- ----------------------------------------------------------------------

-- Google's stable identifier for the address. The only thing that lets us
-- ask Google about this exact address again later without paying for a
-- fresh geocode. Documented as opaque and as having no guaranteed maximum
-- length; 255 is the width Google's own examples assume.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_place_id VARCHAR(255) DEFAULT NULL
  COMMENT 'Google Place ID for the delivery address. NULL = never resolved by Google';

-- Google's own one-line rendering of the address, kept ALONGSIDE the
-- typed fields rather than replacing them. In a dispute or a carrier
-- claim, the question is often what the address actually was versus what
-- the buyer typed, and that is only answerable if both survive.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_formatted_address VARCHAR(255) DEFAULT NULL
  COMMENT 'Google formatted_address. Evidence, NOT the address of record - the ship_* fields are';

-- The column people skip and later wish they had.
--
-- An address picked from the dropdown and left alone is different
-- evidence from one typed by hand, and different again from one picked
-- and then edited - the third case is how a valid autocompleted street
-- acquires a house number that does not exist on it.
--
-- It is also the only way to know whether autocomplete is being USED. If
-- this column is overwhelmingly 'typed' then the Places spend is buying
-- nothing and should be switched off.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_address_source VARCHAR(16) DEFAULT NULL
  COMMENT 'autocomplete | typed | edited. edited = picked from the dropdown then changed by hand';

-- ----------------------------------------------------------------------
--  From Address Validation (item 16)
-- ----------------------------------------------------------------------

-- NULL here with a non-null address means validation was never attempted,
-- which is the state every pre-existing order is in. It is NOT a failure.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_validated_at DATETIME DEFAULT NULL
  COMMENT 'When Address Validation ran. NULL = never asked, NOT validated-and-dirty';

-- Our own reduction of the response to one word, so a screen does not
-- have to re-derive it. Google's possibleNextAction is still in Preview
-- (pre-GA) as of 2026-09-27, so this is computed from the stable fields -
-- granularity, addressComplete and the has* booleans - not read from it.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_validation_verdict VARCHAR(24) DEFAULT NULL
  COMMENT 'pass | fix | suspect. Ours, derived from the stable verdict fields, not from possibleNextAction';

-- The field that says HOW FAR DOWN Google could confirm. SUB_PREMISE
-- means the apartment was confirmed; PREMISE means the building was but
-- the apartment was not; ROUTE means only the street. A 300 lb crate to a
-- ROUTE-only address is a refused delivery waiting to happen.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_validation_granularity VARCHAR(20) DEFAULT NULL
  COMMENT 'validationGranularity: SUB_PREMISE, PREMISE, PREMISE_PROXIMITY, BLOCK, ROUTE, OTHER';

-- Comma-separated, because these are flags to eyeball on one admin row,
-- not things to query or join on. Carries the has* booleans that were
-- true plus incomplete, plus missing_subpremise when Google reports a
-- missing apartment number - the single commonest cause of a failed
-- freight delivery to a multi-unit building.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_validation_flags VARCHAR(160) DEFAULT NULL
  COMMENT 'CSV: unconfirmed, inferred, replaced, spell_corrected, incomplete, missing_subpremise';

-- ----------------------------------------------------------------------
--  USPS data inside the validation response
-- ----------------------------------------------------------------------

-- dpvConfirmation. Y = confirmed deliverable. S = the building is
-- confirmed but the apartment number is not. D = confirmed but an
-- apartment number is MISSING. N = not deliverable.
--
-- S and D are the interesting ones and they are NOT failures - they are
-- "the street is real, the unit is wrong or absent", which is exactly the
-- case worth a phone call before booking freight.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_usps_dpv VARCHAR(4) DEFAULT NULL
  COMMENT 'USPS dpvConfirmation: Y confirmed, S unit unconfirmed, D unit missing, N undeliverable';

-- CSV of the USPS warning flags that came back Y. Each one is a real
-- signal on a freight order:
--   cmra                 - commercial mail receiving agency. A mailbox
--                          store presented as a street address. On a
--                          1,600 dollar vanity, worth knowing.
--   vacant               - USPS records nobody as living there.
--   no_stat              - not continuously occupied, or not serviced.
--   no_secure_location   - the door is reachable but carriers will not
--                          leave a package there.
--   door_not_accessible  - carriers cannot reach a door at all.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_usps_flags VARCHAR(80) DEFAULT NULL
  COMMENT 'CSV of USPS Y flags: cmra, vacant, no_stat, no_secure_location, door_not_accessible';

-- Four characters: a one-letter prefix and a three-digit route. The
-- prefix is the useful part - R is a rural route, H a highway contract
-- route, B a PO Box section, G general delivery. R and H both hint at a
-- long or awkward approach; B and G mean there is no door to deliver a
-- crate to at all.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_usps_carrier_route VARCHAR(8) DEFAULT NULL
  COMMENT 'USPS carrierRoute. Prefix C city, R rural, H highway contract, B PO Box section, G general delivery';

-- ----------------------------------------------------------------------
--  NO INDEXES, DELIBERATELY
--
--  Nothing reads these by value. The order detail page already has the
--  row by primary key, and at 100-200 orders a month a filter on
--  ship_validation_verdict is a scan of a trivially small table. An index
--  here would cost write time on every order and buy nothing measurable.
--  Add one when there is a query that actually needs it, not before.
-- ----------------------------------------------------------------------

-- ======================================================================
--  VERIFY. Expect 10 rows. Anything missing means that ALTER did not run.
-- ======================================================================
SHOW COLUMNS FROM orders WHERE Field IN (
  'ship_place_id','ship_formatted_address','ship_address_source',
  'ship_validated_at','ship_validation_verdict','ship_validation_granularity',
  'ship_validation_flags',
  'ship_usps_dpv','ship_usps_flags','ship_usps_carrier_route');
