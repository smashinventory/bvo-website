-- ======================================================================
-- 2026-10-04_sample_redemptions_RUNME.sql
--
-- The ledger behind "2 free samples, once per email AND mailing address".
--
-- ⚠️ CREATE, and this one really is new. GREP THE INITIAL SCHEMA BEFORE
-- WRITING ANY CREATE TABLE -- customer_addresses and email_templates were
-- both nearly re-created after already existing. Checked: no
-- sample_redemptions in 001_initial_schema.sql or any later migration.
--
-- NO COMMENT CLAUSES, lines under 80. Three migrations died on
-- 2026-09-27 when a long line carrying a COMMENT string was chopped
-- mid-literal between the chat window and the phpMyAdmin textarea.
--
-- ⚠️ THE USE LINE BELOW IS NOT OPTIONAL. The first run of this file
-- failed with "#1109 - Unknown table 'sample_redemptions' in
-- information_schema" because phpMyAdmin was sitting in
-- information_schema at the time. Every earlier migration here relied on
-- whichever database happened to be selected in the sidebar, which works
-- right up until it does not -- and the failure mode is a table created
-- in the wrong schema, or silently not created at all, with the
-- verification queries reporting on a schema nobody meant.
-- Naming the database makes the file correct regardless of where the
-- cursor was when somebody pressed Go.
-- ======================================================================

USE `u222311468_BVO_website`;


-- ----------------------------------------------------------------------
-- WHY A TABLE AND NOT A QUERY OVER ORDER HISTORY
-- ----------------------------------------------------------------------
-- "Has this email had a free sample before" is answerable from
-- order_items, and that was the first plan: no new state, and the
-- history cannot drift out of step with reality because it IS reality.
--
-- Adding the ADDRESS half of the rule is what changed it. The address
-- identity is addressKey() -- a SHA-256 of the place_id, or of the
-- normalised address string when there is no place_id. That is a
-- JavaScript function. MySQL cannot compute it in a WHERE clause, so
-- "has anyone at this address redeemed" cannot be asked of the order
-- rows directly without pulling every order into Node and hashing it.
--
-- So the key gets stored once, at redemption, in a table whose UNIQUE
-- INDEXES ARE THE RULE:
--
--   uniq_sample_email    one free-sample redemption per email, ever
--   uniq_sample_address  one per mailing address, ever
--
-- Expressed as constraints rather than as an application check on
-- purpose. An INSERT that would be the second redemption FAILS at the
-- database, whatever the calling code believes, and whatever two
-- concurrent requests believe about each other. An if() in a controller
-- is a check two tabs can race; a unique index is not.


-- ----------------------------------------------------------------------
-- WHY THE ADDRESS HALF EXISTS AT ALL
-- ----------------------------------------------------------------------
-- Owner's addition, and it is the right one. Email is free and
-- unlimited: anyone can take 2 free samples per throwaway address for as
-- long as they care to. A mailing address is not free -- the samples
-- physically arrive somewhere -- so the address is the half of the rule
-- that actually costs the taker something to evade.
--
-- Both halves are enforced. Either one being already present blocks the
-- freebie, which means a second person at one household cannot claim
-- again, and one person cannot claim again from a new mailbox.


CREATE TABLE IF NOT EXISTS `u222311468_BVO_website`.`sample_redemptions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,

  -- Lowercased and trimmed by the application before it gets here. The
  -- unique index is on the stored bytes, so "Sam@x.com" and "sam@x.com"
  -- would be two redemptions if normalisation were skipped.
  `email` varchar(255) NOT NULL,

  -- addressKey(): CHAR(64) hex. See src/utils/addressKey.js. Same column
  -- type and same derivation as customer_addresses.address_key, so the
  -- two can be compared if that is ever useful.
  `address_key` char(64) NOT NULL,

  -- Who and which order, for support questions ("why was I charged?").
  -- NULLABLE and WITHOUT A FOREIGN KEY on customer_id, deliberately:
  -- this row must OUTLIVE the customer. A FK with ON DELETE CASCADE
  -- would mean deleting an account resets the offer, which turns account
  -- deletion into the evasion route. Same reasoning as orders.customer_id,
  -- which also carries no constraint.
  `customer_id` int(10) unsigned DEFAULT NULL,
  `order_id` int(10) unsigned DEFAULT NULL,

  -- How many were actually given. Recorded rather than assumed, so
  -- changing FREE_COUNT later does not rewrite history.
  `free_qty` tinyint(3) unsigned NOT NULL DEFAULT 0,

  `created_at` datetime NOT NULL DEFAULT current_timestamp(),

  PRIMARY KEY (`id`),

  -- ── THE RULE ──
  UNIQUE KEY `uniq_sample_email` (`email`),
  UNIQUE KEY `uniq_sample_address` (`address_key`),

  -- For the support lookup "what did this order include".
  KEY `idx_sample_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------
-- NO BACKFILL
-- ----------------------------------------------------------------------
-- Nobody has been given a free sample yet, so there is nothing to
-- record. The 9 existing customers are all pre-cutover test records
-- (customers.is_test = 1) and none has a sample order.
--
-- If the offer had been running, a backfill would be wrong anyway: the
-- address_key of a past order would have to be recomputed in Node, and
-- guessing which past purchases "count" as a redemption would deny the
-- freebie to people who had merely bought a sample at $9.99.


-- ======================================================================
-- VERIFY. Expect the table, both unique indexes, and 0 rows.
-- ======================================================================

SHOW COLUMNS FROM `u222311468_BVO_website`.`sample_redemptions`;

-- Expect exactly two unique keys: uniq_sample_email and
-- uniq_sample_address. SHOW INDEX rather than information_schema, so
-- this reads the table in front of it instead of depending on
-- DATABASE() -- which is what reported on the wrong schema the first
-- time this file was run.
SHOW INDEX FROM `u222311468_BVO_website`.`sample_redemptions`;

SELECT COUNT(*) AS rows_now FROM `u222311468_BVO_website`.`sample_redemptions`;


-- ----------------------------------------------------------------------
-- ROLLBACK
-- ----------------------------------------------------------------------
-- DROP TABLE `u222311468_BVO_website`.`sample_redemptions`;
--
-- ⚠️ Dropping it does NOT just remove a feature: it forgets who has
-- already taken free samples, so everyone becomes eligible again. Only
-- drop it alongside reverting the code that reads it.
