-- ======================================================================
-- 2026-09-28_customer_addresses_RUNME.sql
--
-- Scope items 27 / 28, and the address-velocity data behind items 6 and 9.
-- Decisions recorded in BVO_PAYMENT_RISK_AND_CHECKOUT_SCOPE.md §7 Stage 3.
--
-- ⚠️ THIS IS AN ALTER, NOT A CREATE. `customer_addresses` has existed
-- since 001_initial_schema.sql. It is EMPTY and NO CODE TOUCHES IT --
-- BVO_AUDIT_BRIEF.md line 306 already said so. On 2026-09-28 a migration
-- to CREATE it was nearly written, which is the 2026-09-08
-- `email_templates` mistake repeating. GREP THE INITIAL SCHEMA BEFORE
-- WRITING ANY `CREATE TABLE`.
--
-- Empty table, so: no backfill, no lock of consequence, no risk.
-- Safe to re-run -- ADD COLUMN IF NOT EXISTS throughout (MariaDB 11.8.9).
--
-- NO COMMENT CLAUSES, lines under 80. Three migrations died on
-- 2026-09-27 when a long line carrying a COMMENT string was chopped
-- mid-literal between the chat window and the phpMyAdmin textarea.
-- ======================================================================


-- ----------------------------------------------------------------------
-- What is already there, from 001_initial_schema.sql
-- ----------------------------------------------------------------------
--   id, customer_id, is_default, first_name, last_name, company,
--   address1, address2, city, state, zip, country, phone, created_at
--   FK fk_addr_customer -> customers(id) ON DELETE CASCADE
--
-- The FK is CORRECT and differs from orders.customer_id on purpose. An
-- address is not a financial record: delete the customer and their
-- addresses should go with them. An ORDER must outlive the customer,
-- which is why that column has no constraint.
--
-- `is_default` already exists. That is scope item 29, which was DROPPED
-- on 2026-09-28 as meaningless with one address -- leaving the column
-- unused costs nothing and lets the decision reverse for free.


-- ----------------------------------------------------------------------
-- 1. kind -- shipping or billing in one table
-- ----------------------------------------------------------------------
-- The original table was shipping-only. Billing addresses arrive from
-- Stripe via the webhook (orders.bill_address1 / bill_city / bill_state
-- / bill_zip already exist), and the fraud question is asked of both:
-- "did the billing OR the ship-to change inside 90 days".
--
-- Two kinds in one table rather than two tables, because every query
-- that matters wants them together and a UNION on every read is worse
-- than one indexed column.

ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS kind ENUM('shipping','billing')
    NOT NULL DEFAULT 'shipping';


-- ----------------------------------------------------------------------
-- 2. address_key -- the dedup identity
-- ----------------------------------------------------------------------
-- A 64-char SHA-256 hex digest, NOT the raw place_id.
--
-- Why hashed rather than storing the place_id in the key column: Google
-- place IDs are variable length and can run long, and this column sits
-- in a UNIQUE index. A fixed CHAR(64) keeps the index small and its size
-- predictable, and lets ONE column carry both cases -- a hash of the
-- place_id when there is one, a hash of the normalised address string
-- when there is not.
--
-- ⚠️ THE KEY MUST BE DERIVED FROM THE place_id WHEREVER ONE EXISTS.
-- "123 Main St", "123 Main Street" and "123 Main St." are three strings
-- and ONE place_id. Dedup on the string and the velocity flag fires on
-- spelling variants -- false flags on honest customers, which trains
-- everyone to ignore the flag, which is worse than not having it.
--
-- Fall back to a normalised string hash only when place_id is absent.
-- orders.ship_address_source already tells us which case applies:
-- 'autocomplete' and 'edited' carry a place_id, 'typed' does not.

ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS address_key CHAR(64) NULL DEFAULT NULL;

-- The raw place_id kept alongside, for debugging and for re-deriving the
-- key if the hashing ever changes. Never used as the index.
ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS place_id VARCHAR(255) NULL DEFAULT NULL;

ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS formatted_address VARCHAR(255) NULL DEFAULT NULL;


-- ----------------------------------------------------------------------
-- 3. Fields the carrier needs that the original table lacked
-- ----------------------------------------------------------------------
-- A freight delivery is not a letter. The extension is how a business
-- delivery actually gets scheduled, and residential vs commercial
-- decides what truck and crew the carrier sends.

ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS phone_ext VARCHAR(8) NULL DEFAULT NULL;

-- residential | commercial
ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS address_type VARCHAR(16) NULL DEFAULT NULL;


-- ----------------------------------------------------------------------
-- 4. Address intelligence, carried forward from the order
-- ----------------------------------------------------------------------
-- Same meanings as the orders.ship_* columns added 2026-09-27. Copied
-- rather than joined: the order is what was used THEN, this row is what
-- we know NOW, and they are allowed to diverge.
--
-- Only the two that get READ are carried. The full USPS flag set stays
-- on the order, where the evidence belongs.

ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS lat DECIMAL(10,7) NULL DEFAULT NULL;

ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS lng DECIMAL(10,7) NULL DEFAULT NULL;

-- pass | fix | suspect -- ours, from the stable verdict fields
ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS validation_verdict VARCHAR(24) NULL DEFAULT NULL;

-- USPS dpvConfirmation: Y confirmed, S unit unconfirmed, D unit missing,
-- N undeliverable
ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS usps_dpv VARCHAR(4) NULL DEFAULT NULL;


-- ----------------------------------------------------------------------
-- 5. Velocity -- the columns the fraud question actually needs
-- ----------------------------------------------------------------------
-- created_at alone cannot answer "how many distinct addresses in the
-- last 90 days", because an address first seen two years ago and used
-- again yesterday is a recent use of an old address. last_used_at is the
-- column the query reads; times_used gives the rep a sense of whether
-- this is a regular destination or a one-off.

ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS last_used_at DATETIME NULL DEFAULT NULL;

ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS times_used INT UNSIGNED NOT NULL DEFAULT 0;


-- ----------------------------------------------------------------------
-- 6. The unique key -- REQUIRED, not an optimisation
-- ----------------------------------------------------------------------
-- This one is not optional the way the address-intel indexes were
-- (2026-09-27: "NO INDEXES, DELIBERATELY -- nothing reads these by
-- value"). Here the write path is an UPSERT:
--
--   INSERT ... ON DUPLICATE KEY UPDATE
--     last_used_at = NOW(), times_used = times_used + 1
--
-- Without this key every checkout inserts a duplicate row, times_used
-- never rises above 1, and the velocity count is a count of ORDERS
-- rather than of distinct ADDRESSES -- which would flag every repeat
-- customer shipping to the same house.
--
-- No separate index on (kind, last_used_at): at BVO's volume that query
-- is a scan of a trivially small table, and the same reasoning that
-- kept indexes off the address-intel columns applies.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_addr_customer_kind_key
  ON customer_addresses (customer_id, kind, address_key);

-- ⚠️ address_key is created NULLable above, and MariaDB treats NULLs as
-- DISTINCT in a unique index -- so NULL keys are NOT deduped. Run
-- 2026-09-28_customer_addresses_key_notnull_RUNME.sql straight after
-- this file. It is separate only because this one had already been run
-- when the hole was found.


-- ======================================================================
-- VERIFY. Expect 26 columns (14 original + 12 new) and the key.
-- ======================================================================

SHOW COLUMNS FROM customer_addresses;

SHOW INDEX FROM customer_addresses
 WHERE Key_name = 'uniq_addr_customer_kind_key';

SELECT COUNT(*) AS rows_now FROM customer_addresses;
