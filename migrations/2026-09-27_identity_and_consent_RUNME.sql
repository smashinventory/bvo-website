-- ======================================================================
-- 2026-09-27_identity_and_consent.sql
--
-- Identity on the order, and consent evidence on the customer.
-- Items: the /checkout/identify gate, and spec 9.2 / 9.2a consent.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS / DROP COLUMN IF EXISTS
-- throughout. MariaDB 11.8.9 supports both, same as
-- 2026-09-27_address_intel_columns_RUNME.sql.
--
-- NO COMMENT CLAUSES. Three migrations earlier on 2026-09-27 failed
-- because a long line carrying a COMMENT string was chopped mid-literal
-- between the chat window and the phpMyAdmin textarea, producing
-- `Ending quote ' was expected`. The explanations live in -- comments
-- instead, where truncation cannot leave an unterminated string.
-- Max line length in this file is deliberately kept under 80.
-- ======================================================================


-- ----------------------------------------------------------------------
-- 1. orders.customer_id
-- ----------------------------------------------------------------------
-- Until now an order carried an email address and nothing more, so
-- "show me this person's orders" was a string match on free text. With
-- identity settled before checkout starts, the order carries the key.
--
-- NOT a FOREIGN KEY, deliberately. Orders are financial records and
-- must outlive any customer row, including one deleted on request. A
-- hard constraint would also make orders refuse writes while customers
-- is mid-migration, and an order that cannot be written after a card is
-- authorised is a worse failure than an orphaned id.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id INT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON orders (customer_id);


-- ----------------------------------------------------------------------
-- 2. Consent evidence on customers
-- ----------------------------------------------------------------------
-- accepts_marketing ALREADY EXISTS and stays as the live flag - the
-- switch that decides whether we may send. Everything below is
-- EVIDENCE: when, from where, from which connection, and which wording.
--
-- Why a boolean is not enough. The TCPA obliges four years of consent
-- records and puts the burden of proof on the sender. "accepts = 1"
-- proves nothing about who ticked what, when, or against which version
-- of the copy.
--
-- The two channels are SEPARATE on purpose. Email marketing (CAN-SPAM,
-- opt-out regime) and delivery SMS (TCPA, express consent) are
-- different legal instruments with different defaults and different
-- revocation paths. Collapsing them into one column is exactly the
-- conflation that gets retailers sued. See spec 9.4.

-- 2a. Email marketing: WHEN.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS marketing_consent_at DATETIME DEFAULT NULL;

-- 2b. Email marketing: FROM WHICH SURFACE.
-- Written by the app as: checkout_info, account_page, admin.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS marketing_consent_source VARCHAR(40) DEFAULT NULL;

-- 2c. Email marketing: FROM WHICH CONNECTION.
-- 45 chars holds a full IPv6 address. Hostinger hands this app IPv6.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS marketing_consent_ip VARCHAR(45) DEFAULT NULL;

-- 2d. Delivery SMS: the live flag.
-- Separate from accepts_marketing and never to be read as marketing
-- permission. This channel carries delivery information ONLY, forever.
-- Spec 9.2a: the moment a promotion goes down this path, the
-- pre-checked default stops being defensible and consent has to be
-- re-collected from everyone who ever ticked it.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS delivery_sms_consent TINYINT(1) NOT NULL DEFAULT 0;

-- 2e. Delivery SMS: WHEN.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS delivery_sms_consent_at DATETIME DEFAULT NULL;

-- 2f. Delivery SMS: FROM WHICH SURFACE.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS delivery_sms_consent_source VARCHAR(40) DEFAULT NULL;

-- 2g. Delivery SMS: FROM WHICH CONNECTION.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS delivery_sms_consent_ip VARCHAR(45) DEFAULT NULL;

-- 2h. WHICH WORDING they agreed to.
-- Consent copy changes over four years. Producing "they ticked a box"
-- without being able to say WHICH box is a weak record. One short
-- version tag makes the evidence specific. First value: 2026-09-27a.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS consent_copy_version VARCHAR(20) DEFAULT NULL;


-- ----------------------------------------------------------------------
-- 3. Retire the password column
-- ----------------------------------------------------------------------
-- The bcrypt system is gone: the six-digit code IS the login. The old
-- system had no reset route at all, so keeping it meant BUILDING one.
-- Every account on this install is a test account, and the owner
-- confirmed on 2026-09-27 that the hashes can go.
--
-- Dropping rather than leaving it NULL is deliberate. A password column
-- nothing writes still reads as a live authentication path to the next
-- person who opens the schema, and a column holding credentials is a
-- thing to protect forever. The cheapest credential to secure is the
-- one that does not exist.
--
-- THIS IS THE ONLY DESTRUCTIVE STATEMENT IN THIS FILE. If this install
-- ever holds a real customer password, skip section 3 - everything
-- above works without it.

ALTER TABLE customers
  DROP COLUMN IF EXISTS password_hash;


-- ======================================================================
-- VERIFY. Expect 9 rows from the first query, 1 from the second,
-- and NO password_hash row.
-- ======================================================================

SHOW COLUMNS FROM customers WHERE Field IN (
  'accepts_marketing',
  'marketing_consent_at','marketing_consent_source','marketing_consent_ip',
  'delivery_sms_consent','delivery_sms_consent_at',
  'delivery_sms_consent_source','delivery_sms_consent_ip',
  'consent_copy_version',
  'password_hash'
);

SHOW COLUMNS FROM orders WHERE Field = 'customer_id';
