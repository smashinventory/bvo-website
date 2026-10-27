-- ═══════════════════════════════════════════════════════════════════════
-- 2026-10-27_cart_recovery_RUNME.sql
-- Abandoned-cart outreach: the record of who was contacted.
--
-- ADDITIVE ONLY. Three nullable columns on `orders`. Nothing existing
-- changes behaviour, no data is modified.
--
-- ── WHY COLUMNS ON orders AND NOT A NEW TABLE ──────────────────────────
-- An abandoned cart IS an order row — status='pending' with no capture.
-- ordersController already documents this: "Abandoned checkouts are
-- hidden, not deleted. They stay in the table: they are the
-- abandoned-checkout record." A parallel table would duplicate that and
-- the two would disagree the first time a row was cancelled or deleted.
--
-- ── THE COLUMNS ────────────────────────────────────────────────────────
-- recovery_emailed_at   When a recovery email was SENT. NULL = never.
--                       ⚠️ THE SEND-ONCE GUARD. Without it, a job that
--                       runs hourly emails the same person every hour
--                       until they buy or unsubscribe. The cost of that
--                       mistake is a spam complaint against a Brevo
--                       account with almost no sending history, which is
--                       expensive to undo and cheap to avoid.
--
-- recovery_stage        Which touch was last sent ('first','second').
--                       Present now so a second touch can be added later
--                       without another migration and without a boolean
--                       that cannot tell "one sent" from "both sent".
--
-- recovery_outcome      Set by hand in admin: 'recovered', 'called',
--                       'no_contact', 'declined'. The honest record of
--                       what the outreach actually achieved, which is
--                       the only way to know later whether this feature
--                       pays for itself.
--
-- ── WHAT THIS MIGRATION DELIBERATELY DOES NOT DO ───────────────────────
-- ⚠️ IT ADDS NO CONSENT COLUMN. Marketing consent already lives on
-- `customers.accepts_marketing` with its timestamp, source and IP, and
-- the unsubscribe state on `customers.email_blocked`. A second consent
-- flag here would be a second definition of the same fact, and the two
-- would drift — see src/services/consentUnblock.js for how carefully the
-- existing one is maintained. The recovery job READS those; it never
-- writes its own.
-- ═══════════════════════════════════════════════════════════════════════


-- ── STEP 1: LOOK FIRST ─────────────────────────────────────────────────
-- If any of these return a row, the migration has already been applied.
SHOW COLUMNS FROM orders LIKE 'recovery_emailed_at';
SHOW COLUMNS FROM orders LIKE 'recovery_stage';
SHOW COLUMNS FROM orders LIKE 'recovery_outcome';


-- ── STEP 2: ADD THEM ───────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS recovery_emailed_at DATETIME NULL
    COMMENT 'When a cart-recovery email was sent. NULL = never. Send-once guard.',
  ADD COLUMN IF NOT EXISTS recovery_stage VARCHAR(16) NULL
    COMMENT 'Which touch was last sent: first, second.',
  ADD COLUMN IF NOT EXISTS recovery_outcome VARCHAR(24) NULL
    COMMENT 'Set by hand: recovered, called, no_contact, declined.';

-- Index on the send-once guard: the finder query filters on it every run,
-- and an unindexed NULL check scans the whole orders table forever.
ALTER TABLE orders
  ADD INDEX IF NOT EXISTS idx_recovery (recovery_emailed_at, status);


-- ── STEP 3: PROVE IT ───────────────────────────────────────────────────
SHOW COLUMNS FROM orders LIKE 'recovery_%';
SHOW INDEX FROM orders WHERE Key_name = 'idx_recovery';

-- Every existing row must be NULL — nobody has been contacted yet.
-- Expect: one row, n = total orders, all three counts 0.
SELECT COUNT(*)                        AS n,
       COUNT(recovery_emailed_at)      AS emailed_should_be_0,
       COUNT(recovery_stage)           AS staged_should_be_0,
       COUNT(recovery_outcome)         AS outcome_should_be_0
  FROM orders;
