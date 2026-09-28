-- ======================================================================
-- 2026-09-28_customer_devices_RUNME.sql
--
-- Scope item 26 — "Remember this device", 90 days, plus the new-device
-- notification email (spec §8.2).
--
-- Owner-approved 2026-09-28: a recognised device SKIPS the six-digit
-- code entirely. That is the point — it stops every repeat purchase
-- depending on email delivery, a channel proved fragile on 2026-09-27.
--
-- Safe to re-run. Lines under 80, no COMMENT clauses — same paste rules
-- as the other migrations from this week.
--
-- ⚠️ GREP FIRST. `customer_devices` is NOT in 001_initial_schema.sql
-- (checked 2026-09-28), unlike `customer_addresses` which was and very
-- nearly got a duplicate CREATE. Verified absent before writing this.
-- ======================================================================


-- ----------------------------------------------------------------------
-- 1. customer_devices
-- ----------------------------------------------------------------------
-- ⚠️ THE COOKIE VALUE IS NEVER STORED. Only sha256 of it.
--
-- This token is a BEARER CREDENTIAL: whoever holds it signs in without
-- an email code. Storing the raw value would mean a leaked table is a
-- leaked set of live logins — the same reasoning that hashes the
-- six-digit codes in customer_auth_codes.
--
-- Not salted per-row, unlike the auth codes. Those are six digits, so a
-- stolen table would be brute-forced instantly without a salt; this is
-- 256 bits of crypto.randomBytes, where a plain sha256 preimage attack
-- is not a thing. The lookup has to be by hash, which a per-row salt
-- would make impossible without scanning every row.

CREATE TABLE IF NOT EXISTS customer_devices (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id   INT UNSIGNED NOT NULL,
  token_hash    CHAR(64)     NOT NULL,
  device_label  VARCHAR(40)      NULL DEFAULT NULL,
  first_seen_ip VARCHAR(45)      NULL DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  DATETIME         NULL DEFAULT NULL,
  expires_at    DATETIME     NOT NULL,
  revoked_at    DATETIME         NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_device_token (token_hash),
  KEY idx_device_customer (customer_id),
  CONSTRAINT fk_device_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ON DELETE CASCADE, same as customer_addresses and for the same
-- reason: a device grant is not a financial record. Delete the customer
-- and every device that could sign in as them must go too — leaving one
-- behind would be a live credential for an account that no longer
-- exists.


-- ----------------------------------------------------------------------
-- 2. NO EMAIL TEMPLATE IN THIS FILE, DELIBERATELY
-- ----------------------------------------------------------------------
-- A first draft of this migration INSERTed the new-device email into
-- email_templates. It was removed before anyone ran it, for two
-- reasons.
--
-- PASTE SAFETY. The template HTML is a multi-line string literal with
-- lines up to 191 characters. That is EXACTLY what killed three
-- migrations on 2026-09-27: a long line carrying a string literal gets
-- chopped between the chat window and the phpMyAdmin textarea, and MySQL
-- reports `Ending quote ' was expected`. The opening and closing lines
-- of such a literal also have odd quote parity by construction, so the
-- usual paste checks cannot distinguish them from a real fault.
--
-- AND THE ESTABLISHED PATTERN SAYS NOT TO. accountController already
-- carries fallbackCodeEmail() in code, with the reason written beside
-- it: "An auth email that silently does not send is a login outage, so
-- this never depends on a database row existing."
--
-- That applies harder to a SECURITY notification. The new-device email
-- lives in code as fallbackNewDeviceEmail(), and sendTemplate() is
-- still tried first — so an editable `auth_new_device` row can be added
-- from the admin later and will win, but its ABSENCE can never silence
-- the warning.


-- ======================================================================
-- VERIFY
-- ======================================================================

SHOW COLUMNS FROM customer_devices;

-- No auth_new_device row is expected — the email lives in code. If one
-- exists because someone added it from the admin, that is fine and it
-- takes precedence.
SELECT COUNT(*) AS optional_template_row
  FROM email_templates WHERE trigger_key = 'auth_new_device';

SELECT COUNT(*) AS devices_now FROM customer_devices;
