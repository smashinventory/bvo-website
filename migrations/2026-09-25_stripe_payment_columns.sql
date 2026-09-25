-- ═══════════════════════════════════════════════════════════════════
--  orders — swap Authorize.net + FraudLabs columns for Stripe
--
--  CONTEXT
--  ───────
--  BVO has never processed a payment. All 14 columns dropped below are
--  empty. There is no data to preserve and no rollback to plan for.
--  See docs/briefs/BVO_COMMERCE_STACK_BRIEF.md.
--
--  None of these columns has a migration file — they were added ad hoc,
--  so their exact definitions are not recorded anywhere in the repo.
--  Every statement below therefore uses MariaDB's IF EXISTS /
--  IF NOT EXISTS extensions: the migration is idempotent and does not
--  need to know the current state. Safe to re-run.
--
--  ONE ALTER, not drop-then-re-add. Several names carry over unchanged
--  (payment_transaction_id, payment_status, payment_brand,
--  payment_last4) and should not churn.
--
--  ⚠️ RUN SECTION 0 FIRST. If either count is non-zero, STOP — something
--     has been processed and this migration's premise is wrong.
-- ═══════════════════════════════════════════════════════════════════


-- ── 0. SAFETY CHECK — run this alone, first ────────────────────────
--
-- Expected: with_txn = 0 AND with_fraud_screen = 0
--
--   SELECT COUNT(*)                      AS total_orders,
--          COUNT(payment_transaction_id) AS with_txn,
--          COUNT(fraudlabs_status)       AS with_fraud_screen
--     FROM orders;


-- ── 1. Drop the Authorize.net-specific columns ─────────────────────
--
-- payment_transaction_id, payment_status, payment_brand and
-- payment_last4 are NOT dropped — they carry over to Stripe unchanged.
--
--   payment_auth_code   Authorize.net auth code. Stripe has no analogue.
--   payment_avs_code    ANet letter codes (Y/X/A/Z/W). Stripe reports
--                       address checks as pass|fail|unavailable|unchecked
--                       inside the charge outcome — different domain, so
--                       reusing the column would mix two vocabularies.
--   payment_cvv_code    Same, for CVV (ANet M/N/P/S/U).
--   payment_afds_code   Advanced Fraud Detection Suite. An Authorize.net
--                       product. No Stripe equivalent at all.
ALTER TABLE orders
  DROP COLUMN IF EXISTS payment_auth_code,
  DROP COLUMN IF EXISTS payment_avs_code,
  DROP COLUMN IF EXISTS payment_cvv_code,
  DROP COLUMN IF EXISTS payment_afds_code;


-- ── 2. Drop the FraudLabs columns ──────────────────────────────────
--
-- FraudLabs Pro was cancelled 2026-09-25. Replaced by Stripe Radar,
-- whose fields are added in section 4.
ALTER TABLE orders
  DROP COLUMN IF EXISTS fraudlabs_score,
  DROP COLUMN IF EXISTS fraudlabs_status,
  DROP COLUMN IF EXISTS fraudlabs_ip_vpn,
  DROP COLUMN IF EXISTS fraudlabs_ip_tor,
  DROP COLUMN IF EXISTS fraudlabs_ip_proxy,
  DROP COLUMN IF EXISTS fraudlabs_email_risk;


-- ── 3. Widen / normalise the carried-over columns ──────────────────
--
-- payment_transaction_id now holds a Stripe PaymentIntent id (pi_…,
-- 27 chars today). VARCHAR(64) leaves headroom without being silly.
--
-- payment_status keeps its existing vocabulary — auth_only / captured /
-- pending — which maps onto Stripe's requires_capture / succeeded /
-- requires_payment_method. 'canceled' is added for released
-- authorisations, which Authorize.net never had a path for.
ALTER TABLE orders
  MODIFY COLUMN payment_transaction_id VARCHAR(64)  DEFAULT NULL
    COMMENT 'Stripe PaymentIntent id (pi_...). Capture and refund both key on this.',
  MODIFY COLUMN payment_status         VARCHAR(20)  DEFAULT NULL
    COMMENT 'pending | auth_only | captured | canceled | refunded | partially_refunded',
  MODIFY COLUMN payment_brand          VARCHAR(20)  DEFAULT NULL,
  MODIFY COLUMN payment_last4          VARCHAR(4)   DEFAULT NULL;


-- ── 4. Add the Stripe columns ──────────────────────────────────────
ALTER TABLE orders
  -- Checkout Session id (cs_...). Distinct from the PaymentIntent and
  -- easy to confuse: the session is what the browser confirms against;
  -- only the PaymentIntent can be captured or refunded. Stored so a
  -- webhook replay or a support query can be traced back to the session.
  ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(80) DEFAULT NULL
    COMMENT 'Stripe Checkout Session id (cs_...)' AFTER payment_transaction_id,

  -- Charge id (ch_...). The dispute and refund records in the Stripe
  -- dashboard key on the charge, not the PaymentIntent, so a chargeback
  -- investigation starts here.
  ADD COLUMN IF NOT EXISTS stripe_charge_id VARCHAR(64) DEFAULT NULL
    COMMENT 'Stripe Charge id (ch_...) — what a dispute record references'
    AFTER stripe_session_id,

  -- ── Radar ────────────────────────────────────────────────────────
  -- risk_score is populated only on Radar Plus/Pro. On Lite and Standard
  -- it is absent. NULL and 0 must stay distinguishable: 0 is a perfect
  -- score, NULL means "this tier does not provide one". Never DEFAULT 0.
  ADD COLUMN IF NOT EXISTS payment_risk_score TINYINT UNSIGNED DEFAULT NULL
    COMMENT 'Stripe Radar 0-99. NULL on Radar Lite/Standard — NULL is not zero',
  ADD COLUMN IF NOT EXISTS payment_risk_level VARCHAR(16) DEFAULT NULL
    COMMENT 'normal | elevated | highest | not_assessed',
  ADD COLUMN IF NOT EXISTS payment_seller_message VARCHAR(255) DEFAULT NULL
    COMMENT 'Stripe outcome.seller_message — plain-English reason, shown in the admin risk panel',

  -- ── Card checks ──────────────────────────────────────────────────
  -- Stripe's equivalents of AVS/CVV. Values are
  -- pass | fail | unavailable | unchecked — NOT the Authorize.net letter
  -- codes the old admin panel decoded. The risk panel must be rewritten
  -- against these, not have the old letters mapped onto them.
  ADD COLUMN IF NOT EXISTS payment_check_cvc   VARCHAR(16) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_check_zip   VARCHAR(16) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_check_line1 VARCHAR(16) DEFAULT NULL,

  -- ── Tax ──────────────────────────────────────────────────────────
  -- BVO has never charged sales tax. Stripe Tax computes it per the
  -- customer's address, so the figure is Stripe's, not ours:
  --   subtotal  = our calcTotal(), pre-tax
  --   tax_amount = session.total_details.amount_tax
  --   total      = session.amount_total  ← authoritative, never recomputed
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00
    COMMENT 'Stripe Tax calculated amount. Included in total.',

  -- ── Authorisation clock ──────────────────────────────────────────
  -- Card authorisations lapse after 7 days. Capture normally happens
  -- within 48 hours, but a stalled order can age out, and until now
  -- nothing tracked it (OPEN_ITEMS F1). This column is what the day-5
  -- and day-7 warnings will be computed from.
  --
  -- Authorisation and order creation are treated as simultaneous, so
  -- this could be derived from created_at — it is stored explicitly
  -- anyway so the alerting never silently depends on that assumption
  -- holding.
  ADD COLUMN IF NOT EXISTS payment_authorized_at DATETIME DEFAULT NULL
    COMMENT 'When the hold was placed. Expiry warnings count from here.',
  ADD COLUMN IF NOT EXISTS payment_captured_at DATETIME DEFAULT NULL
    COMMENT 'When funds were actually taken. NULL while still on hold.';


-- ── 5. Index the expiry query ──────────────────────────────────────
--
-- The day-5/day-7 sweep runs
--   WHERE payment_status = 'auth_only' AND payment_authorized_at < ?
-- on every poll. Without this it is a full scan of orders, growing with
-- the table forever.
ALTER TABLE orders
  ADD INDEX IF NOT EXISTS idx_auth_expiry (payment_status, payment_authorized_at);


-- ── 6. Verify ──────────────────────────────────────────────────────
--
--   SHOW COLUMNS FROM orders LIKE 'payment%';
--   SHOW COLUMNS FROM orders LIKE 'stripe%';
--   SHOW COLUMNS FROM orders LIKE 'tax_amount';
--
-- Expect: payment_transaction_id, payment_status, payment_brand,
--         payment_last4, payment_risk_score, payment_risk_level,
--         payment_seller_message, payment_check_cvc, payment_check_zip,
--         payment_check_line1, payment_authorized_at,
--         payment_captured_at, stripe_session_id, stripe_charge_id,
--         tax_amount
--
-- Expect GONE: payment_auth_code, payment_avs_code, payment_cvv_code,
--              payment_afds_code, and all six fraudlabs_*.
