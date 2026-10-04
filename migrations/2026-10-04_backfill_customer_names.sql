-- ---------------------------------------------------------------------------
-- BVO · backfill customers.first_name / last_name from their orders
-- Generated 2026-10-04.
--
-- NO SCHEMA CHANGE. first_name and last_name already exist. This only fills
-- rows where they are empty, from a name the customer already gave us.
--
-- ── WHY THIS EXISTS ────────────────────────────────────────────────────────
-- Customer.findOrCreateByEmail inserts first_name = '' and last_name = '',
-- and until 2026-10-04 NOTHING ever wrote them again — there was no UPDATE
-- against those columns anywhere in the codebase. Meanwhile every order
-- carries ship_first_name and ship_last_name, typed by the buyer at
-- checkout. The names were always there; they were simply never copied
-- across.
--
-- Checkout now copies the name forward on every new order, so this script is
-- a one-off for the history that predates that change.
--
-- ── ONLY WHERE WE HAVE NOTHING ─────────────────────────────────────────────
-- The WHERE clause skips any customer who already has a first name. A
-- customer who typed their name into the sign-in prompt must not be
-- overwritten by a shipping name from an order placed for someone else — a
-- gift, or a contractor ordering for a client.
--
-- ── WHICH ORDER ────────────────────────────────────────────────────────────
-- The most recent non-cancelled one. Not the first: a name changes (marriage,
-- a correction to a typo) and the latest is the better guess. Cancelled
-- orders are excluded because a cancelled order is the likeliest place for a
-- mistyped name to live.
--
-- Rows with no order at all are left empty and will be asked at next sign-in.
--
-- HOW TO RUN. phpMyAdmin -> bvo_website -> SQL tab -> paste -> Go.
-- Verification SELECTs below. Rollback is NOT provided — see the note there.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;

-- ── BEFORE ─────────────────────────────────────────────────────────────────
SELECT COUNT(*) AS customers_with_no_first_name
  FROM customers
 WHERE first_name IS NULL OR first_name = '';

-- ── BACKFILL ───────────────────────────────────────────────────────────────
UPDATE customers c
  JOIN (
        SELECT o.customer_id,
               SUBSTRING_INDEX(GROUP_CONCAT(o.ship_first_name
                 ORDER BY o.created_at DESC SEPARATOR 0x1F), 0x1F, 1) AS first_name,
               SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(o.ship_last_name, '')
                 ORDER BY o.created_at DESC SEPARATOR 0x1F), 0x1F, 1) AS last_name
          FROM orders o
         WHERE o.customer_id IS NOT NULL
           AND o.status <> 'cancelled'
           AND o.ship_first_name IS NOT NULL
           AND o.ship_first_name <> ''
         GROUP BY o.customer_id
       ) n ON n.customer_id = c.id
   SET c.first_name = n.first_name,
       c.last_name  = CASE WHEN (c.last_name IS NULL OR c.last_name = '')
                           THEN n.last_name ELSE c.last_name END
 WHERE c.first_name IS NULL OR c.first_name = '';
-- GROUP_CONCAT + SUBSTRING_INDEX is "the value from the newest row" in one
-- pass. 0x1F (unit separator) is the delimiter because a comma, pipe or
-- semicolon can legitimately appear in a name and would split it.

-- ── AFTER ──────────────────────────────────────────────────────────────────
SELECT COUNT(*) AS still_with_no_first_name
  FROM customers
 WHERE first_name IS NULL OR first_name = '';
-- Expect this to equal the number of customers who have never ordered.
-- Those are asked for a name at their next sign-in.

SELECT c.id, c.email, c.first_name, c.last_name,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS orders
  FROM customers c
 ORDER BY c.id;

-- ── ROLLBACK ───────────────────────────────────────────────────────────────
-- NOT PROVIDED, deliberately. Undoing this means blanking names, and after
-- this runs there is no way to tell a name that came from here from one the
-- customer typed themselves — so an automated revert would destroy real data
-- to undo a copy. If a single record is wrong, correct that record.
