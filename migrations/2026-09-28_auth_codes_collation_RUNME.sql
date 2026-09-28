-- ════════════════════════════════════════════════════════════════════
-- Align customer_auth_codes with the rest of the schema.
-- Owner-approved and ALREADY RUN on production 2026-09-28 (0.70s).
--
-- Recorded here because it was executed ad-hoc in phpMyAdmin and the
-- repo otherwise has no trace of it. A schema change that exists only
-- in a chat log is a schema change nobody can reproduce.
--
-- ────────────────────────────────────────────────────────────────────
-- WHAT WENT WRONG
--
-- customer_auth_codes was created 2026-09-27 WITHOUT naming a
-- collation, so it took the MariaDB 11 server default
-- (utf8mb4_uca1400_ai_ci). Every other table here is
-- utf8mb4_unicode_ci. Comparing a text column across that line raises:
--
--   #1267 - Illegal mix of collations
--           (utf8mb4_uca1400_ai_ci,IMPLICIT) and
--           (utf8mb4_unicode_ci,IMPLICIT) for operation '='
--
-- It stayed invisible for a day because every cross-table link in this
-- app is on customer_id (an integer), and every single-table filter
-- compares a column to a bound parameter — which adopts that column's
-- collation. The verification backfill in
-- 2026-09-28_order_email_verification_RUNME.sql was the first query to
-- join email text across the two eras, and it failed immediately.
--
-- ────────────────────────────────────────────────────────────────────
-- THE RULE THIS LEAVES BEHIND
--
-- NAME THE COLLATION EXPLICITLY ON EVERY NEW TABLE. Not because the
-- server default is wrong in the abstract, but because it does not
-- match what this schema already uses, and the mismatch surfaces as a
-- runtime error in whichever query happens to join across it first.
--
-- customer_addresses and customer_devices were both created the
-- following day and are FINE — their CREATE TABLE statements name
-- utf8mb4_unicode_ci. That is the difference, and it is the whole
-- difference.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE customer_auth_codes
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── VERIFY ──────────────────────────────────────────────────────────
-- Expect utf8mb4_unicode_ci. SHOW, not INFORMATION_SCHEMA: this host
-- denies that database outright (#1044).
SHOW TABLE STATUS LIKE 'customer_auth_codes';

-- And the join that started it should now work with no COLLATE clause
-- at all. Expect it to run; the count itself is not the point.
SELECT COUNT(*) AS joinable
  FROM customers c
  JOIN customer_auth_codes a ON a.email = c.email;
