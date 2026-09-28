-- ======================================================================
-- 2026-09-28_customer_addresses_key_notnull_RUNME.sql
--
-- Follow-up to 2026-09-28_customer_addresses_RUNME.sql, same day.
-- Run that one FIRST. This is safe to run twice.
--
-- WHY THIS EXISTS
--
-- `address_key` was created NULLable. In MariaDB a UNIQUE index treats
-- NULLs as DISTINCT, so `UNIQUE (customer_id, kind, address_key)` does
-- not constrain rows whose key is NULL -- three checkouts with a NULL
-- key produce three rows for one customer.
--
-- That is the exact failure the unique key exists to prevent: the upsert
-- stops deduping, times_used never rises, and the velocity count goes
-- back to counting ORDERS instead of distinct ADDRESSES -- flagging
-- every loyal customer who ships to the same house twice.
--
-- Demonstrated rather than assumed on 2026-09-28: with the column
-- NULLable, three inserts produced three rows; with it NOT NULL, the
-- insert was rejected at the schema.
--
-- Fixed here rather than left to the application because a code-level
-- guarantee holds only until someone writes a second insert path. The
-- table is EMPTY, so this costs nothing today; after data exists it
-- needs a backfill first.
-- ======================================================================


-- ----------------------------------------------------------------------
-- address_key NOT NULL
-- ----------------------------------------------------------------------
-- No DEFAULT, deliberately. A default would let an insert that forgot
-- the key succeed with a placeholder, and every such row would collide
-- with every other, which is a different and more confusing bug.
-- The write path must ALWAYS compute a key:
--   sha256(place_id)  when one exists
--   sha256(normalised address string)  when it does not

ALTER TABLE customer_addresses
  MODIFY COLUMN address_key CHAR(64) NOT NULL;


-- ======================================================================
-- VERIFY. address_key must read Null = NO.
-- ======================================================================

SHOW COLUMNS FROM customer_addresses WHERE Field = 'address_key';
