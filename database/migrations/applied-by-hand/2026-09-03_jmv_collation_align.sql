-- ═══════════════════════════════════════════════════════════════════
-- 2026-09-03 — align jmv_* table collations with the rest of the schema
--
-- THE ERROR THIS FIXES
--   Illegal mix of collations (utf8mb4_uca1400_ai_ci,IMPLICIT)
--   and (utf8mb4_unicode_ci,IMPLICIT) for operation '='
--
--   Raised by the nightly rollup the moment it tried to join
--   jmv_daily_movement.sku to products.sku.
--
-- ROOT CAUSE — a declaration omission, not a data problem
--   migrations/014_jmv_velocity.sql created all four jmv_* tables as:
--
--     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--
--   with no COLLATE. When no collation is given, the server supplies its
--   own default for that charset. On the MariaDB version these tables were
--   created under, that default is utf8mb4_uca1400_ai_ci. Every older table
--   in this schema — products included — is utf8mb4_unicode_ci.
--
--   So the schema disagrees with itself, and any '=' between a jmv_* string
--   column and a non-jmv one fails. Nothing is wrong with the data.
--
-- WHY NOT JUST COLLATE THE QUERY
--   It was written that way first. It works, and it is the wrong fix: it
--   leaves the next join to fail identically, and it forfeits the index on
--   every query that needs the workaround. The tables are the problem.
--
-- COST
--   Roughly 5,200 SKUs across ~11 snapshot days:
--     jmv_daily_movement   ~57k rows
--     jmv_snapshots        ~57k rows
--     jmv_dimensions       ~5.2k rows
--     jmv_snapshot_validity   ~11 rows
--   CONVERT TO rebuilds each table and its indexes. At this size that is
--   seconds, not a maintenance window. Run it whenever.
--
-- SAFETY
--   CONVERT TO CHARACTER SET with the same charset (utf8mb4 -> utf8mb4)
--   changes only the collation. No transcoding, no risk of mangling
--   characters. Collation affects comparison and sorting, not storage.
--   sku values are ASCII part numbers, so sort order does not shift.
-- ═══════════════════════════════════════════════════════════════════


-- ── 1. BEFORE — see the disagreement ───────────────────────────────
--
-- NOTE: SHOW, not information_schema. Hostinger's shared MySQL does not
-- grant this DB user access to information_schema:
--
--   #1044 - Access denied for user '...'@'127.0.0.1'
--           to database 'information_schema'
--
-- The first version of this file used information_schema and failed on
-- exactly that. SHOW TABLE STATUS needs no special privilege and returns
-- the same Collation column.
SHOW TABLE STATUS LIKE 'jmv\_%';
SHOW TABLE STATUS LIKE 'products';
-- Read the Collation column.
-- Expect BEFORE: products = utf8mb4_unicode_ci
--                jmv_*    = utf8mb4_uca1400_ai_ci   <- the problem


-- ── 2. CONVERT ─────────────────────────────────────────────────────
ALTER TABLE jmv_snapshot_validity
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE jmv_dimensions
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE jmv_snapshots
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE jmv_daily_movement
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- ── 3. VERIFY the collations changed ───────────────────────────────
-- All four must now read utf8mb4_unicode_ci in the Collation column.
SHOW TABLE STATUS LIKE 'jmv\_%';

-- Whole-database sweep, if you want it. Scan the Collation column for
-- anything that is not utf8mb4_unicode_ci — a table that has drifted is
-- better found now than at the next join someone writes.
--   SHOW TABLE STATUS;


-- ── 4. VERIFY the join that was actually failing ───────────────────
-- THIS IS THE TEST THAT MATTERS. Everything above is diagnosis; this is
-- the statement the rollup could not execute.
--
-- Expect a non-zero count. If it raises "Illegal mix of collations",
-- step 2 did not take — re-run the ALTERs individually and read each result.
SELECT COUNT(*) AS matching_skus
  FROM products p
  JOIN jmv_daily_movement m ON m.sku = p.sku;


-- ═══════════════════════════════════════════════════════════════════
-- 5. OPTIONAL — stop this recurring for tables created in future
--
-- The database's own default collation is what a CREATE TABLE inherits
-- when no COLLATE is given. If it is still a uca1400 variant, the next
-- table someone creates without an explicit COLLATE reintroduces exactly
-- this bug.
--
-- Check it WITHOUT information_schema (no privilege for it on this host):
--
--   SELECT @@character_set_database, @@collation_database;
--
-- If it is not utf8mb4_unicode_ci:
--
--   ALTER DATABASE `u222311468_BVO_website`
--     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--
-- This changes the DEFAULT for new tables only. It does not touch existing
-- tables — those are handled by step 2. Shared hosting sometimes withholds
-- ALTER DATABASE; if it is denied, the belt-and-braces fix is already in
-- place: migrations/014_jmv_velocity.sql now declares COLLATE explicitly,
-- as every migration should.
-- ═══════════════════════════════════════════════════════════════════
