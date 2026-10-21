-- ════════════════════════════════════════════════════════════════════════
-- 2026-10-21 — Platinum Member / Platinum Trade / Elite Trade
-- SCOPE_45 item 40, Phase 2. TRADE_PROGRAM_SPEC.md is the artifact of record.
--
-- ⚠️ NO information_schema. Hostinger does not grant the DB user access to
-- it — the first is_deal migration failed on live with #1044. SHOW COLUMNS
-- and SHOW INDEX return the same facts with no special privilege. Every
-- migration on this project must now follow that rule.
--
-- ⚠️ EVERY STATEMENT IS IDEMPOTENT (IF NOT EXISTS). Re-running is a no-op.
--
-- RUN AS: one paste into hPanel SQL, or import the file. MariaDB.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. BEFORE ──────────────────────────────────────────────────────────
SHOW COLUMNS FROM customers LIKE 'tier';
-- EXPECTED: empty before running.


-- ── 2. THE TIER COLUMN ─────────────────────────────────────────────────
-- ⚠️ ONE COLUMN WITH A VALUE, NOT THREE BOOLEANS. is_trade + is_elite +
-- is_member would permit nonsense combinations (all three true?) and need
-- reconciling on every read. TRADE_PROGRAM_SPEC §1.
--
-- ⚠️ 'elite_trade' IS DELIBERATELY NOT A PERMITTED VALUE HERE.
-- Elite is COMPUTED at price time from rolling 12-month captured revenue —
-- never stored. Writing it would freeze a customer at 20% after their spend
-- aged out, and the rolling window exists precisely so it CAN age out. If
-- you find 'elite_trade' in this column, something has written a computed
-- value and the rolling rule is broken.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS tier VARCHAR(20) NOT NULL DEFAULT 'none'
  COMMENT 'none | platinum_member | platinum_trade. NEVER elite_trade - that is computed from rolling spend. See src/utils/tiers.js';


-- ── 3. THE OFFER GRANT MARKER ──────────────────────────────────────────
-- ⚠️ THIS COLUMN IS WHY THE 10% IS NOT A BLANKET MARGIN CUT.
-- Checkout requires an account (item 22: "NO GUEST. Account required"), so
-- EVERY first-time buyer creates one. A rule of "has an account and has not
-- ordered before" would therefore grant 10% to 100% of new customers,
-- silently — on James Martin products that already sit at MAP, straight off
-- the bone.
--
-- So eligibility is an explicit GRANT. This timestamp is set ONLY by the
-- deals-page claim, never by the checkout signup path.
--
-- ⚠️ NOT signup_source. That column stays, for reporting. It is attribution
-- metadata, and a money grant inferred from a descriptive label changes
-- silently the day someone re-labels a path.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS offer_enrolled_at DATETIME DEFAULT NULL
  COMMENT 'Set ONLY by the deals-page claim. Never by checkout signup. TRADE_PROGRAM_SPEC section 6.';

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS trade_applied_at DATETIME DEFAULT NULL;
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS trade_approved_at DATETIME DEFAULT NULL;

ALTER TABLE customers
  ADD INDEX IF NOT EXISTS idx_customers_tier (tier);


-- ── 3b. THE RATE IS FROZEN ONTO THE ORDER ──────────────────────────────
-- ⚠️ WITHOUT THIS COLUMN, CHECKOUT REFUSES TO CHARGE SOME ORDERS.
--
-- checkoutController re-prices the cart at payment time and compares it to
-- orders.subtotal, refusing to charge if they differ — correct, and it is
-- what stops a buyer being billed a figure they never saw.
--
-- But the tier is a LIVE calculation. Resolve it twice and it can change
-- between the two reads:
--   · Platinum Member has two orders in flight. Order A captures. Order B
--     re-resolves at payment, now has a captured order, tier drops to
--     retail, expected != subtotal, and B is REFUSED.
--   · A trade account crosses $20,000 mid-session and moves 15% -> 20%
--     between placing and paying. Same refusal.
--
-- So the rate that priced the order is STORED on it, and the payment check
-- uses the stored figure. The order is then also auditable: you can see
-- what rate was applied without recomputing a rolling window as it was
-- twelve months ago, which is not recoverable after the fact.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tier_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00
  COMMENT 'The tier rate FROZEN at order creation. Payment re-check uses THIS, never a fresh resolve. See src/services/tierService.js';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tier_at_order VARCHAR(20) DEFAULT NULL
  COMMENT 'Which tier produced tier_pct. For the admin and for disputes.';


-- ── 4. ONE OFFER PER HOUSEHOLD ─────────────────────────────────────────
-- Owner: one per household/address, NOT per email. sample_redemptions is
-- the working precedent for exactly this.
--
-- ⚠️ KEYED ON THE GOOGLE place_id, NOT AN ADDRESS STRING. Item 27 already
-- settled the reasoning: "three spellings of one street are ONE place_id,
-- and string dedup would false-flag honest customers." The place_id is
-- already captured and stored by items 15/17.
CREATE TABLE IF NOT EXISTS member_offer_redemptions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  customer_id    INT          NOT NULL,
  order_id       INT          DEFAULT NULL,
  place_id       VARCHAR(255) DEFAULT NULL,
  email          VARCHAR(255) DEFAULT NULL,
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  redeemed_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  /* UNIQUE on place_id is what enforces one-per-household at the DB level
     rather than in application code that can be raced by two tabs.
     NULL place_id does NOT collide in MariaDB — several rows may carry
     NULL — which is the wanted behaviour: a customer with no verified
     address yet is caught by the email key below instead. */
  UNIQUE KEY uniq_mor_place (place_id),
  UNIQUE KEY uniq_mor_email (email),
  KEY idx_mor_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 5. TRADE APPLICATIONS ──────────────────────────────────────────────
-- ⚠️ THE DOCUMENT PATH IS NOT PUBLIC, AND THIS IS NOT A PREFERENCE.
-- TRADE_PROGRAM_SPEC: "business licences can carry personal data, and sole
-- proprietors sometimes use an SSN as the tax ID. These documents need a
-- retention period, restricted access, and a line in the Privacy Policy.
-- Do NOT store them in a publicly reachable uploads directory."
--
-- doc_path therefore holds a path OUTSIDE public/, served only through an
-- authenticated admin route. If you ever find one of these under public/,
-- that is a personal-data exposure, not a tidiness issue.
CREATE TABLE IF NOT EXISTS trade_applications (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  customer_id       INT          DEFAULT NULL,
  email             VARCHAR(255) NOT NULL,
  business_name     VARCHAR(255) NOT NULL,
  business_type     VARCHAR(100) DEFAULT NULL,
  phone             VARCHAR(40)  DEFAULT NULL,
  intended_use      TEXT         DEFAULT NULL,
  /* Business card: the ONLY document required to qualify. Owner 2026-10-21:
     "Biz card to qualify - sales tax id if they want sales tax exemption."
     The two are decoupled, which narrows the privacy exposure a long way. */
  card_doc_path     VARCHAR(500) DEFAULT NULL,
  card_doc_name     VARCHAR(255) DEFAULT NULL,
  /* Resale certificate: OPTIONAL, collected only from applicants claiming
     sales-tax exemption. Anyone without one is charged tax normally. */
  wants_tax_exempt  TINYINT(1)   NOT NULL DEFAULT 0,
  tax_id            VARCHAR(64)  DEFAULT NULL,
  resale_doc_path   VARCHAR(500) DEFAULT NULL,
  resale_doc_name   VARCHAR(255) DEFAULT NULL,
  /* Terms evidence. Reuses the SHAPE of the existing consent columns on
     customers rather than inventing a second scheme — timestamp, IP and
     the VERSION of the copy agreed to. */
  terms_version     VARCHAR(20)  DEFAULT NULL,
  terms_accepted_at DATETIME     DEFAULT NULL,
  terms_ip          VARCHAR(45)  DEFAULT NULL,
  /* Marketing consent is OPTIONAL on this path and approval must NEVER
     depend on it. For Platinum Member the tick IS the claim; for trade the
     consideration is a legitimate business, not an email permission. */
  accepts_marketing TINYINT(1)   NOT NULL DEFAULT 0,
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending',
  review_note       TEXT         DEFAULT NULL,
  reviewed_by       VARCHAR(255) DEFAULT NULL,
  reviewed_at       DATETIME     DEFAULT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ta_status (status),
  KEY idx_ta_customer (customer_id),
  KEY idx_ta_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── 6. AFTER ───────────────────────────────────────────────────────────
SHOW COLUMNS FROM customers LIKE 'tier';
-- EXPECTED: one row — varchar(20), NO, default 'none'

SHOW COLUMNS FROM customers LIKE 'offer_enrolled_at';
-- EXPECTED: one row — datetime, YES, default NULL

SHOW COLUMNS FROM orders LIKE 'tier_pct';
-- EXPECTED: one row — decimal(5,2), NO, default 0.00

SHOW TABLES LIKE 'member_offer_redemptions';
SHOW TABLES LIKE 'trade_applications';
-- EXPECTED: one row each.

SELECT tier, COUNT(*) AS customers FROM customers GROUP BY tier;
-- EXPECTED: a single row — none | <your total customer count>.
-- Nobody is promoted by this migration. Every tier is earned afterwards.


-- ── ROLLBACK ───────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS trade_applications;
-- DROP TABLE IF EXISTS member_offer_redemptions;
-- ALTER TABLE customers DROP INDEX idx_customers_tier;
-- ALTER TABLE customers DROP COLUMN trade_approved_at;
-- ALTER TABLE customers DROP COLUMN trade_applied_at;
-- ALTER TABLE customers DROP COLUMN offer_enrolled_at;
-- ALTER TABLE orders DROP COLUMN tier_at_order;
-- ALTER TABLE orders DROP COLUMN tier_pct;
-- ALTER TABLE customers DROP COLUMN tier;
