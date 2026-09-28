-- ======================================================================
-- 2026-09-27_wipe_test_data_RUNME.sql
--
-- DESTRUCTIVE. Deletes every customer and every order.
--
-- Owner, 2026-09-27: "all the current customer accounts are test
-- accounts. They can all be deleted." and "we can also delete all the
-- orders. as they are all tests too."
--
-- ⚠️ THIS IS NOT RE-RUNNABLE IN ANY MEANINGFUL SENSE. Running it twice
-- is harmless only because the second run finds nothing left. There is
-- no undo. TAKE A DUMP FIRST — phpMyAdmin → Export → Quick → SQL. It
-- costs thirty seconds and it is the only thing standing between a
-- mis-click and a rebuild.
--
-- ⛔ DO NOT RUN THIS AFTER GO-LIVE. Once one real customer has ordered,
-- this file deletes a financial record. If you are reading it at
-- cutover and unsure whether real orders exist, STOP and run section 0
-- on its own first.
--
-- WHAT IS NOT TOUCHED, deliberately:
--   products, product_images, product_videos, collections, model_groups
--   pages, blog_posts, nav_menus, inspiration_pages
--   email_templates, app_settings, carrier_rules
--   jmv_* (supplier inventory — nothing to do with customers)
--   admin credentials (ADMIN_PW_B64 lives in the environment)
--
-- NO COMMENT CLAUSES, lines under 80 — same paste-safety rules as the
-- sibling migrations from this day.
-- ======================================================================


-- ----------------------------------------------------------------------
-- 0. LOOK BEFORE YOU LEAP. Run this section ALONE first.
-- ----------------------------------------------------------------------
-- If any of these numbers surprises you, stop and investigate. In
-- particular a non-zero count in the second query means money moved,
-- which is exactly the case this file must never be run against.

SELECT 'customers'           AS what, COUNT(*) AS rows_now FROM customers
UNION ALL SELECT 'orders',            COUNT(*) FROM orders
UNION ALL SELECT 'order_items',       COUNT(*) FROM order_items
UNION ALL SELECT 'order_events',      COUNT(*) FROM order_events
UNION ALL SELECT 'shipments',         COUNT(*) FROM shipments
UNION ALL SELECT 'favorites',         COUNT(*) FROM favorites
UNION ALL SELECT 'customer_auth_codes', COUNT(*) FROM customer_auth_codes;

-- Orders that actually took money. EXPECT ZERO on a test install.
-- Anything here is a real payment and this file must not be run.
SELECT id, order_number, payment_status, total, created_at
  FROM orders
 WHERE payment_status IN ('paid','captured','authorized','partially_refunded')
 ORDER BY id;


-- ----------------------------------------------------------------------
-- 1. Children first.
-- ----------------------------------------------------------------------
-- There are no foreign keys on this schema, so nothing enforces the
-- order — which means nothing WARNS you either. Deleting parents first
-- would silently leave child rows pointing at ids that no longer exist,
-- and those survive a later reseed to attach themselves to a brand-new
-- order that happens to reuse the id. Children first, always.
--
-- DELETE rather than TRUNCATE throughout: TRUNCATE cannot be rolled
-- back and ignores the WHERE clauses that make section 3 safe. The
-- tables are small; the speed difference is irrelevant.

DELETE FROM order_items;
DELETE FROM order_events;
DELETE FROM shipments;


-- ----------------------------------------------------------------------
-- 2. Optional children — only if these tables exist on your install.
-- ----------------------------------------------------------------------
-- Guarded, because they are referenced in code but may not have been
-- created yet. An unguarded DELETE from a missing table aborts the
-- whole script and leaves the wipe half-done.

SET @s := (SELECT IF((SELECT COUNT(*) FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_documents') > 0,
  'DELETE FROM order_documents', 'SELECT ''no order_documents table'''));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s := (SELECT IF((SELECT COUNT(*) FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_returns') > 0,
  'DELETE FROM order_returns', 'SELECT ''no order_returns table'''));
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ----------------------------------------------------------------------
-- 3. Orders, then customers.
-- ----------------------------------------------------------------------

DELETE FROM orders;
DELETE FROM favorites;
DELETE FROM customer_auth_codes;
DELETE FROM customers;


-- ----------------------------------------------------------------------
-- 4. Reset the id counters.
-- ----------------------------------------------------------------------
-- Cosmetic, and worth it: the first real order being id 1 rather than
-- id 58 makes "is this test data?" answerable at a glance forever after.
--
-- order_number is NOT derived from this id — it is
-- BVO-YYYY-MM-DD-NNNNN, assigned when the Stripe session is created —
-- so resetting cannot collide with any number already issued.

ALTER TABLE orders      AUTO_INCREMENT = 1;
ALTER TABLE order_items AUTO_INCREMENT = 1;
ALTER TABLE customers   AUTO_INCREMENT = 1;


-- ======================================================================
-- VERIFY. Every count must be 0.
-- ======================================================================

SELECT 'customers'           AS what, COUNT(*) AS rows_left FROM customers
UNION ALL SELECT 'orders',            COUNT(*) FROM orders
UNION ALL SELECT 'order_items',       COUNT(*) FROM order_items
UNION ALL SELECT 'order_events',      COUNT(*) FROM order_events
UNION ALL SELECT 'shipments',         COUNT(*) FROM shipments
UNION ALL SELECT 'favorites',         COUNT(*) FROM favorites
UNION ALL SELECT 'customer_auth_codes', COUNT(*) FROM customer_auth_codes;

-- Products must be UNTOUCHED. A zero here means something went very
-- wrong and the dump you took in the header is now load-bearing.
SELECT 'products (must NOT be 0)' AS what, COUNT(*) AS rows_left FROM products;
