-- ════════════════════════════════════════════════════════════════════════
-- 2026-10-20 — drop the redundant customers.idx_email  (#8b)
--
-- WHAT IS REDUNDANT. database/migrations/001_initial_schema.sql declares the
-- column AND a key on the same column:
--
--     email  VARCHAR(255)  NOT NULL UNIQUE,     -- line 120  → index `email`
--     ...
--     KEY idx_email (email)                     -- line 132  → index `idx_email`
--
-- UNIQUE creates an index. So customers has carried TWO indexes on the same
-- single column since the first day of the project. `idx_email` can serve no
-- lookup that the unique index cannot: same column, same leading position,
-- and the unique one additionally enforces the constraint. Every INSERT and
-- every UPDATE of email has been maintaining both.
--
-- ⚠️ THIS IS HYGIENE, NOT PERFORMANCE. customers has a cardinality of 11.
-- The write saving is unmeasurable at this size and nobody should expect a
-- page to get faster. The reason to do it is that a duplicate index is a
-- thing future readers have to stop and reason about, and that schema reads
-- as if someone intended two different things.
--
-- ⚠️⚠️ THE DROP MUST BE TABLE-QUALIFIED, AND HERE IS WHY. The name
-- `idx_email` is NOT unique in this database. 2026-10-19_customer_outreach
-- created a second one:
--
--     customer_merges.idx_email (merged_email)   -- a DIFFERENT column
--
-- That one is not redundant and must survive. An unqualified or mistyped
-- drop that reached customer_merges would remove a working index with no
-- error and no obvious symptom. The statement below names the table, and
-- the verification at the bottom proves customer_merges still has its own.
--
-- SAFETY OF THE DROP ITSELF. No code anywhere names this index: there is not
-- one USE INDEX, FORCE INDEX or IGNORE INDEX in the repository, so no query
-- plan is pinned to it. Every foreign key that points at this table
-- references customers(id), not customers(email), so no constraint depends
-- on it. Grepped 2026-10-20.
--
-- RUN AS: one paste into phpMyAdmin / hPanel SQL. MariaDB.
-- REVERSIBLE: the rollback is at the bottom, commented out.
-- ════════════════════════════════════════════════════════════════════════

-- ⚠️ REWRITTEN 2026-10-21 — NO information_schema.
-- The first version used it throughout and would have failed on live with
--     #1044 - Access denied for user '...'@'127.0.0.1' to database
--     'information_schema'
-- Hostinger shared hosting does not grant the DB user access to it. SHOW
-- INDEX returns the same facts with no special privilege.
--
-- ⚠️ THE GUARD IS NOW YOURS, NOT THE SCRIPT'S, AND THAT IS A REAL CHANGE.
-- The original wrapped the DROP in a PREPARE/EXECUTE that read
-- information_schema.STATISTICS at run time and aborted on its own if no
-- UNIQUE index led on customers.email. SHOW INDEX cannot be read into a
-- variable or a subquery, so that automatic abort cannot be rebuilt without
-- the privilege we do not have.
--
-- So this is deliberately TWO STEPS. Rule 23 says never drop an index on
-- the word of a comment — step 1 prints the evidence and YOU confirm it
-- before step 2 removes anything. Do not run step 2 blind.

-- ════════════════════════════════════════════════════════════════════════
-- STEP 1 — RUN THIS ALONE FIRST. It changes nothing.
-- ════════════════════════════════════════════════════════════════════════
SHOW INDEX FROM customers WHERE Column_name = 'email';

-- READ THE OUTPUT BEFORE GOING ON. You are looking for TWO rows:
--
--   Key_name = <something>  Non_unique = 0   Seq_in_index = 1   <- the UNIQUE
--   Key_name = idx_email    Non_unique = 1   Seq_in_index = 1   <- the duplicate
--
-- ✅ BOTH present  -> idx_email is genuinely redundant. Go to step 2.
-- ⛔ NO row with Non_unique = 0 leading on email -> STOP. idx_email is then
--    the ONLY index on that column, and dropping it turns every email
--    lookup — every login, every checkout identify — into a table scan.
-- ⛔ NO row named idx_email -> already done, or never existed. Nothing to do.

-- Also confirm the name collision is understood before dropping anything:
SHOW INDEX FROM customer_merges WHERE Key_name = 'idx_email';
-- customer_merges has its OWN index called idx_email. It is NOT the target.
-- This is why step 2 names the table explicitly (Rule 23, second half).

-- ════════════════════════════════════════════════════════════════════════
-- STEP 2 — ONLY after step 1 showed BOTH rows on customers.
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE customers DROP INDEX IF EXISTS idx_email;

-- ── AFTER ──────────────────────────────────────────────────────────────
SHOW INDEX FROM customers WHERE Column_name = 'email';
-- EXPECTED: ONE row left — the UNIQUE one, Non_unique = 0.

SHOW INDEX FROM customer_merges WHERE Key_name = 'idx_email';
-- EXPECTED: UNCHANGED from step 1. If this is now empty, the wrong table
-- was altered — restore it from the rollback at the bottom immediately.
-- Anything else: stop and read the AFTER table above before doing more.

-- ── ROLLBACK (only if the verdict above is not 0 | 1 | 1) ──────────────
-- ALTER TABLE customers ADD INDEX idx_email (email);
