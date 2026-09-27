-- ======================================================================
--  2026-09-26_payment_risk_columns_RUNME.sql
--
--  Columns for list items 1, 2, 3, 5, 11, 12, 18 and 19.
--  Safe to re-run: every statement is ADD COLUMN IF NOT EXISTS or a
--  guarded index add. MariaDB 11.8.9 supports both.
--
--  WHY AN INDEX ON stripe_charge_id IS NOT OPTIONAL
--  Early Fraud Warning and dispute events identify the transaction by
--  CHARGE id, not order id. The webhook has to look the order up by that
--  column on every event, and it is currently unindexed - a full table
--  scan inside a handler Stripe times out at 20 seconds.
--
--  NULL IS NOT ZERO, AND NULL IS NOT "CLEAN"
--  Every risk column below stays NULL when Stripe did not supply the
--  fact. A 3DS result of NULL means 3DS was never invoked, which is the
--  normal case on a low-risk card - it does NOT mean authentication
--  failed, and it must never be rendered as though it did.
-- ======================================================================

-- Early Fraud Warning (item 1)
-- The issuer telling us a card was used fraudulently BEFORE a chargeback
-- exists. With capture_method 'manual' this is the single most valuable
-- signal we get: the money is still only held, so cancelling costs
-- nothing. Once captured, the same warning becomes a dispute.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_efw_at DATETIME DEFAULT NULL
  COMMENT 'When an Early Fraud Warning arrived. NOT NULL = cancel the auth, do not ship';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_efw_id VARCHAR(64) DEFAULT NULL
  COMMENT 'Stripe radar.early_fraud_warning id (issfr_...)';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_efw_reason VARCHAR(40) DEFAULT NULL
  COMMENT 'made_with_stolen_card, made_with_counterfeit_card, unauthorized_use_of_card, misc';

-- Disputes (item 2)
-- evidence_due_at is the one that costs money if missed: Stripe closes
-- the dispute as LOST when the deadline passes with no submission, and
-- there is no appeal on a default loss.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_id VARCHAR(64) DEFAULT NULL
  COMMENT 'Stripe dispute id (dp_...)';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_status VARCHAR(32) DEFAULT NULL
  COMMENT 'warning_needs_response, needs_response, under_review, won, lost, warning_closed';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_reason VARCHAR(48) DEFAULT NULL
  COMMENT 'fraudulent, product_not_received, credit_not_processed, duplicate, etc';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_amount DECIMAL(10,2) DEFAULT NULL
  COMMENT 'Amount disputed. May be less than the order total on a partial';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_evidence_due_at DATETIME DEFAULT NULL
  COMMENT 'HARD DEADLINE. Passing it loses the dispute by default, with no appeal';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_opened_at DATETIME DEFAULT NULL
  COMMENT 'First charge.dispute.created for this order';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_closed_at DATETIME DEFAULT NULL
  COMMENT 'When it resolved. Read dispute_status for which way';

-- 3DS outcome (item 3)
-- Recorded as evidence, NOT as a guarantee. Stripe's documentation is
-- explicit that a successful 3DS authentication does not guarantee a
-- liability shift, so no screen built on these columns may promise one.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_3ds_result VARCHAR(32) DEFAULT NULL
  COMMENT 'authenticated, attempt_acknowledged, not_authenticated, exempted, failed. NULL = 3DS not invoked, which is normal';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_3ds_flow VARCHAR(32) DEFAULT NULL
  COMMENT 'challenge or frictionless';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_3ds_eci VARCHAR(4) DEFAULT NULL
  COMMENT 'Electronic Commerce Indicator, e.g. 02 / 05 / 06 / 07';

-- Ship-to vs bill-to (item 5)
-- Computed once at authorisation rather than compared on every page
-- render, so the flag records what was true AT THE TIME - later edits to
-- either address do not silently rewrite history.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_bill_mismatch TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '1 = delivery address differs from the cardholder address at authorisation';

-- Terms-acceptance evidence (item 12)
-- delivery_terms_ack_at already exists. A timestamp alone is weak
-- evidence; these two make it defensible in a dispute.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_terms_ip VARCHAR(45) DEFAULT NULL
  COMMENT 'IP that ticked the curbside acknowledgement. 45 chars for IPv6';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_terms_version VARCHAR(32) DEFAULT NULL
  COMMENT 'Version of the curbside copy agreed to. Without it we cannot say WHAT they agreed to';

-- Geocode (items 18, 19)
-- US Census geocoder: free, no key, no quota. Written once per address so
-- the Street View panel later costs one lookup, not one per page view.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_lat DECIMAL(9,6) DEFAULT NULL
  COMMENT 'Delivery latitude. 6dp is about 0.1m - far finer than needed';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_lng DECIMAL(9,6) DEFAULT NULL
  COMMENT 'Delivery longitude';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_geocode_source VARCHAR(24) DEFAULT NULL
  COMMENT 'census, google, manual. Which authority produced the lat/lng';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_geocoded_at DATETIME DEFAULT NULL
  COMMENT 'When it was resolved. NULL with a non-null address = not attempted yet';

-- Indexes
-- MariaDB supports IF NOT EXISTS on ADD INDEX, so no information_schema
-- lookup is needed. That matters twice over: this user was refused with
-- "#1044 Access denied ... information_schema" on an earlier migration
-- today, and a top-level SELECT against it also switches phpMyAdmin's
-- active database so every later statement in the paste fails.
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_stripe_charge (stripe_charge_id);
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_dispute_due (dispute_status, dispute_evidence_due_at);
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_efw (payment_efw_at);

-- ======================================================================
--  VERIFY. Expect 20 rows. Anything missing means that ALTER did not run.
-- ======================================================================
SHOW COLUMNS FROM orders WHERE Field IN (
  'payment_efw_at','payment_efw_id','payment_efw_reason',
  'dispute_id','dispute_status','dispute_reason','dispute_amount',
  'dispute_evidence_due_at','dispute_opened_at','dispute_closed_at',
  'payment_3ds_result','payment_3ds_flow','payment_3ds_eci',
  'ship_bill_mismatch',
  'delivery_terms_ip','delivery_terms_version',
  'ship_lat','ship_lng','ship_geocode_source','ship_geocoded_at');

-- Expect 3 rows: idx_stripe_charge, idx_dispute_due, idx_efw.
SHOW INDEX FROM orders WHERE Key_name IN
  ('idx_stripe_charge','idx_dispute_due','idx_efw');
