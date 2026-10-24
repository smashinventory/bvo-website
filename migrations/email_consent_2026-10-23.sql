-- ════════════════════════════════════════════════════════════════════════
-- email_consent_2026-10-23.sql — capture Brevo unsubscribes and blocks
--
-- Task #374. Clause 8 of the trade terms (37890bb) tells applicants they
-- can unsubscribe at any time, and that trade pricing and stock notices
-- stop with it. Nothing in the system noticed when they did.
--
-- ⚠️ WHY THIS MATTERS MORE THAN A MARKETING FLAG.
-- Brevo attaches List-Unsubscribe to EVERY message and it cannot be turned
-- off below Enterprise. So an unsubscribe from a promotion also blocks
-- order confirmations, shipping notices and sign-in codes. Until now the
-- only way to find out was the admin diagnostics page, which nobody has a
-- reason to open, or a customer ringing up asking where their receipt is.
--
-- Two separate things are recorded, deliberately:
--
--   customers.email_blocked*   CURRENT STATE. Can we reach this person?
--   email_consent_events       HISTORY. When did it change, and why?
--
-- The state is what every page needs to read cheaply. The history is what
-- makes a consent record defensible — "opted out on this date, restored on
-- that date, by this route" — and it is append-only.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Current state on the customer ───────────────────────────────────
-- email_blocked is about DELIVERABILITY, not permission. accepts_marketing
-- stays the record of permission. They move together on an unsubscribe but
-- they are not the same fact: an address can be undeliverable (hard bounce)
-- while consent was never withdrawn.
ALTER TABLE customers
  ADD COLUMN email_blocked        TINYINT(1)   NOT NULL DEFAULT 0 AFTER accepts_marketing,
  ADD COLUMN email_blocked_at     DATETIME     NULL               AFTER email_blocked,
  ADD COLUMN email_blocked_reason VARCHAR(64)  NULL               AFTER email_blocked_at,
  ADD COLUMN email_checked_at     DATETIME     NULL               AFTER email_blocked_reason;

-- Partial index use: the reconcile job and the trade queue both ask
-- "who is blocked", which is a small minority of rows.
ALTER TABLE customers
  ADD INDEX idx_customers_email_blocked (email_blocked);

-- ── 2. Append-only history ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_consent_events (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id   INT UNSIGNED NULL,
  email         VARCHAR(255) NOT NULL,
  -- 'blocked'  — appeared on Brevo's blocklist
  -- 'restored' — came off it (admin unblock, or Brevo-side removal)
  event         VARCHAR(16)  NOT NULL,
  -- Brevo's own reason string, stored verbatim and NOT normalised:
  -- unsubscribedViaMA, unsubscribedViaEmail, hardBounce,
  -- contactFlaggedAsSpam, adminBlocked, ... The vocabulary is theirs and
  -- they add to it, so mapping it here would silently drop new values.
  reason        VARCHAR(64)  NULL,
  -- 'reconcile' (the daily job) or 'admin' (someone pressed unblock)
  source        VARCHAR(32)  NOT NULL DEFAULT 'reconcile',
  -- Was this customer on a trade tier when it happened? Captured at the
  -- moment of the event because the tier can change afterwards, and the
  -- question "did we lose a trade customer's mail" has to stay answerable.
  was_trade     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ece_customer (customer_id, created_at),
  KEY idx_ece_email    (email),
  KEY idx_ece_event    (event, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. Verify ──────────────────────────────────────────────────────────
-- The DB user has no information_schema access (error #1044), so SHOW.
SHOW COLUMNS FROM customers LIKE 'email_%';
SHOW COLUMNS FROM email_consent_events;

-- ── 4. What the first run will do ──────────────────────────────────────
-- The reconcile job BACKFILLS: every address already on Brevo's blocklist
-- is picked up on the first run, not just unsubscribes from here on. So
-- expect a batch of 'blocked' events dated the day this ships, carrying
-- reasons from months ago. That is correct — it is the first time anyone
-- asked. The owner notification is suppressed on the backfill run (see
-- BACKFILL_NOTIFY in src/jobs/brevoConsentReconcile.js) so shipping this
-- does not fire one email per historical unsubscribe.
