-- ════════════════════════════════════════════════════════════════════
-- Email verification, uncoupled from the transaction.
-- Owner-approved 2026-09-28.
--
-- WHY THIS EXISTS
--
-- Checkout used to REQUIRE a six-digit code before the buyer could reach
-- page 1 (requireIdentity + /checkout/identify). On 2026-09-28 Brevo's
-- own event log showed a code email accepted at 11:59 and DELIVERED at
-- 12:10 — eleven minutes — against a code that expired at ten. A second
-- code was still undelivered thirteen minutes after issue.
--
-- A checkout that waits on a third-party mail hop is hostage to Brevo,
-- Gmail and the buyer's mail app. Gmail defers mail from senders it does
-- not recognise, which means the delay lands hardest on addresses we
-- have never mailed before — first-time buyers, the ones we can least
-- afford to lose.
--
-- So verification stops being a gate and becomes a service: confirm your
-- email to track delivery and get order updates. Optional for the buyer,
-- an internal fraud indicator for us. Never blocks an order.
--
-- ────────────────────────────────────────────────────────────────────
-- WHY THE VERIFIED FLAG IS ON THE CUSTOMER, NOT THE ORDER
--
-- Proving you own an address is a fact about a PERSON, not about one
-- purchase. Per-order flags would make a loyal repeat buyer who did not
-- bother clicking on order #4 look more suspicious than a first-time
-- fraudster — exactly backwards.
--
-- The cost is that verification is retroactive across a buyer's orders.
-- The compensation is a sharper signal for free: comparing
-- customers.email_verified_at against orders.created_at separates
-- "confirmed two minutes after checkout" from "confirmed six months ago"
-- from "never". The order detail screen shows that comparison, because
-- it is what the rep wants before the verification call.
--
-- ────────────────────────────────────────────────────────────────────
-- WHY THE TOKEN IS ON THE ORDER
--
-- The link ships inside one specific order confirmation email. Keeping
-- the token on that order means we know which message prompted the
-- confirmation, and a buyer with three open orders cannot have one
-- link silently overwritten by the next.
--
-- MariaDB 11.8.9 supports IF NOT EXISTS on ADD COLUMN and CREATE INDEX,
-- so this file is safe to run twice.
-- ════════════════════════════════════════════════════════════════════

-- ── customers: the verified fact ────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS email_verified_at DATETIME NULL
    COMMENT 'When this address was proven. NULL = never.',
  -- 'code'       — signed in with a six-digit code. STRONGER evidence:
  --                ten minutes, one shot, rate limited, typed by a human.
  -- 'order_link' — clicked Confirm in an order email. Weaker: seven days,
  --                and confirmation emails get forwarded.
  -- The rep should see which. They are not the same claim.
  ADD COLUMN IF NOT EXISTS email_verified_method VARCHAR(16) NULL
    COMMENT 'code | order_link';

-- ── orders: the one-shot confirm token ──────────────────────────────
ALTER TABLE orders
  -- sha256 of a 256-bit random token, hex. The raw token exists only in
  -- the email. A leaked orders table cannot be used to confirm anything,
  -- same rule as customer_devices and the secure-account tokens.
  ADD COLUMN IF NOT EXISTS email_verify_token CHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS email_verify_sent_at DATETIME NULL,
  -- Seven days, not ten minutes. This is not a credential — it cannot
  -- sign anyone in and cannot show anyone anything. A short expiry here
  -- would only manufacture failures.
  ADD COLUMN IF NOT EXISTS email_verify_expires_at DATETIME NULL,
  -- Which order actually produced the confirmation. Lets the order
  -- detail screen say "confirmed from this order" rather than implying
  -- every order was confirmed separately.
  ADD COLUMN IF NOT EXISTS email_verified_at DATETIME NULL;

-- Looked up BY HASH on every confirm click. Not UNIQUE: in MariaDB a
-- UNIQUE index does not constrain NULLs, so it would buy nothing here
-- beyond what 256 bits of randomness already guarantees.
CREATE INDEX IF NOT EXISTS idx_orders_email_verify_token
  ON orders (email_verify_token);

-- The admin orders list filters and sorts on this.
CREATE INDEX IF NOT EXISTS idx_customers_email_verified_at
  ON customers (email_verified_at);

-- ── BACKFILL: anyone who has already signed in with a code ──────────
--
-- These people have ALREADY proven they own their address — that is
-- what a code sign-in is. Leaving them NULL would show every existing
-- account as unconfirmed and make the flag meaningless on day one.
--
-- consumed_at IS NOT NULL is the proof: the code was not merely sent,
-- it was typed back correctly. purpose='login' excludes secure_account
-- tokens, which share this table and prove nothing about the mailbox.
-- COLLATE utf8mb4_unicode_ci IS LOAD-BEARING. Without it this fails:
--
--   #1267 - Illegal mix of collations
--           (utf8mb4_uca1400_ai_ci,IMPLICIT) and
--           (utf8mb4_unicode_ci,IMPLICIT) for operation '='
--
-- The schema is split. Tables predating the MariaDB 11 upgrade are
-- utf8mb4_unicode_ci; anything created after it — customer_auth_codes
-- (2026-09-27), customer_addresses and customer_devices (2026-09-28) —
-- took the newer server default. Comparing an email column across that
-- line is illegal until one side is forced.
--
-- Nothing else in the app hits this yet, because every other cross-table
-- link is on customer_id (an integer) and every single-table filter
-- compares a column to a bound parameter, which adopts that column's
-- collation. This backfill is the first query to join text across the
-- two eras. It will not be the last — see OPEN_ITEMS.
--
-- EXPLICIT beats IMPLICIT, so naming it on one side settles the whole
-- comparison.
UPDATE customers c
   SET c.email_verified_at = (
         SELECT MIN(a.consumed_at)
           FROM customer_auth_codes a
          WHERE a.email = c.email COLLATE utf8mb4_unicode_ci
            AND a.purpose = 'login'
            AND a.consumed_at IS NOT NULL
       ),
       c.email_verified_method = 'code'
 WHERE c.email_verified_at IS NULL
   AND EXISTS (
         SELECT 1 FROM customer_auth_codes a
          WHERE a.email = c.email COLLATE utf8mb4_unicode_ci
            AND a.purpose = 'login'
            AND a.consumed_at IS NOT NULL
       );

-- ── THE CONFIRM BUTTON IN THE ORDER CONFIRMATION EMAIL ──────────────
--
-- brevoService.substituteVars only replaces {{placeholders}} that are
-- ALREADY IN THE TEMPLATE ROW. Passing confirm_button_html from the
-- controller does nothing unless the body contains the token, so the
-- template has to be edited here or the button silently never appears.
--
-- The controller supplies the WHOLE BLOCK or an empty string — never a
-- bare URL. If the token could not be minted, the variable is '' and the
-- email renders clean rather than showing a dead button.
--
-- ANCHORED ON THE SHORTEST FRAGMENT THAT STILL IDENTIFIES THE SPOT, and
-- that is a correction, not a style choice.
--
-- The first version of this anchored on the whole paragraph INCLUDING
-- its opening tag, copied from
-- database/migrations/016_email_templates.sql:
--
--   <p style="font-size:17px;margin:14px 0 24px"><strong>Order total: …
--
-- It matched nothing on the live database and reported "0 rows
-- affected". The live body is 3842 characters; the one in 016_ is about
-- three times that, because the templates were rewritten in the
-- BVO-voice pass and that rewrite was never captured back into a
-- migration. The repo's record of these emails is stale, so 016_ is not
-- a safe source for anything but history.
--
-- The lesson generalises: anchor on the smallest fragment that is
-- unambiguous — here the <strong> and its closing </p> — never on
-- styling attributes, which are exactly what a copy rewrite changes.
--
-- Guarded by NOT LIKE so a second run cannot insert it twice.
UPDATE email_templates
   SET body_html = REPLACE(
         body_html,
         '<strong>Order total: {{order_total}}</strong></p>',
         '<strong>Order total: {{order_total}}</strong></p>
{{confirm_button_html}}'
       )
 WHERE trigger_key = 'order_confirmed'
   AND body_html NOT LIKE '%confirm_button_html%';

-- Expect 1 on a first run, 0 on a re-run. ROW_COUNT() alone cannot tell
-- those apart, so the real check is the LIKE below, which asserts the
-- END STATE rather than the effect of one statement.
SELECT ROW_COUNT() AS templates_updated;

-- THIS is the one that matters. 0 here means the Confirm button will
-- silently never appear in any order confirmation — a feature that
-- looks built and does nothing.
SELECT body_html LIKE '%{{confirm_button_html}}%' AS has_confirm_button
  FROM email_templates WHERE trigger_key = 'order_confirmed';

-- ── VERIFY ──────────────────────────────────────────────────────────
-- Expect: verified_customers > 0 if anyone has ever signed in.
SELECT COUNT(*) AS verified_customers
  FROM customers WHERE email_verified_at IS NOT NULL;

-- SHOW COLUMNS, *NOT* INFORMATION_SCHEMA.
--
-- This host denies it outright:
--   #1044 - Access denied for user 'u222311468_Admin1'@'127.0.0.1'
--           to database 'information_schema'
--
-- That is unusual — most MySQL installs grant everyone a row-filtered
-- view of information_schema — and it is not something to rediscover
-- halfway through a migration, because the failure aborts the rest of
-- the file. SHOW COLUMNS needs no special grant and returns the same
-- facts. Do not reintroduce INFORMATION_SCHEMA in any migration here.
SHOW COLUMNS FROM customers LIKE 'email_verified%';
SHOW COLUMNS FROM orders    LIKE 'email_verif%';
