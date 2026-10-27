-- ═══════════════════════════════════════════════════════════════════════
-- 2026-10-27_contact_log_RUNME.sql
-- Phone calls and internal notes join the outreach timeline.
--
-- THE PROBLEM. Order 23 abandoned a $2,195 cart and declined marketing, so
-- she can never be emailed — she can only be phoned. She was phoned, and a
-- message was left. Nothing in this system records that. The next person
-- to open the order, or to read the hourly cart-recovery call list, sees a
-- name and a number and no indication anyone has already tried. With one
-- person calling that is a small annoyance. With two it is a customer
-- being rung repeatedly about a cart they abandoned on purpose.
--
-- ── WHY customer_messages AND NOT A NEW NOTES TABLE ────────────────────
-- A second table would split the answer to one question — "what have we
-- said to this person?" — across two places, and whichever one a given
-- screen forgot to query would be the one holding the call. The 2026-10-19
-- header already argues this table is keyed to a PERSON rather than an
-- order, which is exactly the grain a call log needs. One timeline.
--
-- ⚠️ kind IS VARCHAR(24), NOT AN ENUM. Confirmed by SHOW COLUMNS on
-- 2026-10-27. So 'call' and 'note' need no schema change at all — the
-- column already accepts them. Only the three changes below are required,
-- which is why this migration is as small as it is.
--
-- ── WHAT to_email MEANS NOW ────────────────────────────────────────────
-- It was "the address we sent to". It becomes "the address identifying
-- this person", and it stays populated for a call whenever we know it,
-- because that is what lets a call and an email about the same person line
-- up on one timeline when customer_id is NULL (every guest order).
--
-- It becomes NULLable only for the case where we genuinely have no
-- address — a phone-only contact. A NOT NULL there would force a '' or a
-- fake value into the column that every later lookup would have to know to
-- ignore, which is the kind of silent sentinel this project keeps paying
-- for elsewhere.
--
-- ⚠️ THIS WIDENS WHAT IS ALLOWED, IT CHANGES NOTHING EXISTING. All three
-- current rows are emails with a real address. Nothing is rewritten.
-- ═══════════════════════════════════════════════════════════════════════


-- ── STEP 1: LOOK FIRST ─────────────────────────────────────────────────
-- Expect 3 rows, every kind an email kind, every to_email populated.
SELECT id, kind, to_email, subject, sent_ok, actor, created_at
  FROM customer_messages ORDER BY id;


-- ── STEP 2: to_email BECOMES OPTIONAL ──────────────────────────────────
-- MODIFY, not CHANGE: same name, same type, same collation, only the
-- nullability moves. Existing values are untouched.
ALTER TABLE customer_messages
  MODIFY COLUMN to_email VARCHAR(255) NULL
  COMMENT 'Address identifying the person at contact time. NULL only for a phone-only contact.';


-- ── STEP 3: THE TWO NEW COLUMNS ────────────────────────────────────────
-- outcome is the whole point of logging a call. "We called" does not tell
-- the next person whether to call again; "left_voicemail" and "spoke" lead
-- to completely different next actions, and "bad_number" says stop.
--
-- NULL rather than a default, because an email has no outcome and a
-- default would quietly assert one.
ALTER TABLE customer_messages
  ADD COLUMN outcome VARCHAR(24) NULL AFTER sent_ok,
  ADD COLUMN contact_phone VARCHAR(40) NULL AFTER outcome;

-- ⚠️ NOT AN ENUM, DELIBERATELY. shipments.product_type is an ENUM because
-- it is a discriminator code reads and branches on. This is a human label
-- a human reads. An ENUM here would mean an ALTER every time somebody
-- wants to record "texted". The application validates against its own
-- list; see CONTACT_OUTCOMES in customerOutreachController.js.
--
-- The values that list allows:
--   spoke           reached them, had a conversation
--   left_voicemail  rang, left a message
--   no_answer       rang, no answer, no message left
--   bad_number      the number is wrong or disconnected
--   note            not a call at all, just something worth recording


-- ── STEP 4: NO NEW INDEXES ─────────────────────────────────────────────
-- Deliberately none. SHOW INDEX on 2026-10-19 created:
--   idx_customer (customer_id, created_at)   ← the last-contact lookup
--   idx_to_email (to_email)                  ← the guest-order fallback
-- Both already cover exactly the two queries this change introduces.
-- Adding a third would be write cost for nothing. Verify with:
SHOW INDEX FROM customer_messages;


-- ── STEP 5: PROVE IT ───────────────────────────────────────────────────
-- Expect: to_email Null = YES, and outcome + contact_phone present.
SHOW COLUMNS FROM customer_messages;

-- And expect 3 — unchanged. If this is not 3, something rewrote rows and
-- STEP 2 was not the MODIFY it claims to be.
SELECT COUNT(*) AS rows_still FROM customer_messages;
