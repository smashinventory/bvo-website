-- ─────────────────────────────────────────────────────────────────────────
-- 2026-10-19  customer outreach — message log, phone backfill, merge audit
--
-- CONTEXT. Order 16 (Heather, michael.wesseler@gmail.com, $657) failed at
-- checkout on 2026-10-05 and sat unreachable for fourteen days, because the
-- admin had no way to email a customer: no Contact button, no resend, and no
-- record of anything anyone sent by hand from their own Outlook. This file
-- is the storage half of fixing that.
--
-- Three unrelated-looking changes, one reason: all three are things the
-- outreach panel needs to exist before it can be honest about what it did.
-- ─────────────────────────────────────────────────────────────────────────


-- ══ 1. customer_messages — every admin-initiated send ════════════════════
--
-- WHY A NEW TABLE AND NOT order_events. order_events is keyed to an order
-- with ON DELETE CASCADE, and most outreach is not about an order — it is
-- about a person. Logging a "we tried to reach you" message as an order
-- event would also make it vanish the moment that order is deleted, which
-- is precisely when you most want to know who was told what.
--
-- WHY IT STORES THE BODY. A log that records "a template was sent" cannot
-- answer the only question that ever matters later: what did we actually
-- say? Templates are edited in the admin (email_templates.body_html has no
-- version history), so the template as it stands today is not evidence of
-- what went out last month. The rendered body is snapshotted.
--
-- NAMING follows the existing customer_* family — customer_addresses,
-- customer_auth_codes, customer_devices. SHOW TABLES on 2026-10-19
-- confirmed no %message% or %outreach% table already exists.

CREATE TABLE IF NOT EXISTS `customer_messages` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,

  -- BOTH nullable, and that is deliberate.
  --   customer_id NULL — a message to an order that was never linked to a
  --     customer record (every order before 2026-10-01 is one).
  --   order_id   NULL — general outreach about no order in particular.
  -- At least one is always set in practice; neither is required, because a
  -- NOT NULL here would mean a send that could not be logged, and an
  -- unloggable send is how we got here.
  `customer_id`   INT UNSIGNED      NULL,
  `order_id`      INT UNSIGNED      NULL,

  -- The address as typed AT SEND TIME. Not a join to customers.email: the
  -- whole point of the typo-correction flow is that this address changes,
  -- and a join would silently rewrite history to the corrected value.
  `to_email`      VARCHAR(255)  NOT NULL,
  `to_name`       VARCHAR(200)      NULL,

  -- 'template' | 'blank' | 'receipt_resend'
  `kind`          VARCHAR(24)   NOT NULL,
  -- email_templates.trigger_key when kind='template' or 'receipt_resend'.
  -- A VARCHAR copy, not an FK: a template can be renamed or deleted and the
  -- log must not change or block that.
  `template_key`  VARCHAR(100)      NULL,

  `subject`       VARCHAR(300)  NOT NULL,
  `body_html`     LONGTEXT          NULL,   -- rendered, as sent

  -- Outcome. FALSE with an error is a first-class row, not an absence: the
  -- operator needs "we tried at 14:02 and Brevo refused it" on the record,
  -- otherwise the next person re-sends into the same blocklist.
  `sent_ok`       TINYINT(1)    NOT NULL DEFAULT 0,
  `error`         VARCHAR(500)      NULL,

  `actor`         VARCHAR(100)  NOT NULL DEFAULT 'admin',
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_customer`   (`customer_id`, `created_at`),
  KEY `idx_order`      (`order_id`),
  KEY `idx_to_email`   (`to_email`),

  -- SET NULL, not CASCADE. Deleting an order must not erase the proof that
  -- we contacted the buyer — see order_deletions (2026-10-12) for the same
  -- reasoning applied to the order row itself.
  CONSTRAINT `fk_cmsg_customer` FOREIGN KEY (`customer_id`)
    REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cmsg_order` FOREIGN KEY (`order_id`)
    REFERENCES `orders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ══ 2. customer_merges — the audit trail for a typo correction ═══════════
--
-- customers.email is UNIQUE (`UNIQUE KEY email`). So correcting a typo'd
-- address can COLLIDE: the real address may already have a customer row
-- from a previous order. The UPDATE then fails with ER_DUP_ENTRY, and the
-- only honest resolutions are "merge the two rows" or "refuse".
--
-- The admin merges, and merging is destructive — one customers row stops
-- existing and its orders are re-pointed. That needs a flight recorder for
-- the same reason order_deletions does. Nothing reads this at runtime.

CREATE TABLE IF NOT EXISTS `customer_merges` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,

  `kept_id`         INT UNSIGNED  NOT NULL,
  `kept_email`      VARCHAR(255)  NOT NULL,
  `merged_id`       INT UNSIGNED  NOT NULL,   -- the row that was deleted
  `merged_email`    VARCHAR(255)  NOT NULL,

  `merged_snapshot` JSON              NULL,   -- the whole deleted row
  `moved_counts`    JSON              NULL,   -- {orders, addresses, messages}

  `actor`           VARCHAR(100)  NOT NULL DEFAULT 'admin',
  `reason`          VARCHAR(255)      NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_kept`  (`kept_id`),
  KEY `idx_email` (`merged_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ══ 3. BACKFILL customers.phone from orders.ship_phone ═══════════════════
--
-- THE BUG THIS REPAIRS. checkoutController.saveInfo copies the buyer's NAME
-- to their customer record (Customer.setNameIfMissing) but never their
-- PHONE — there was no setter for it. So customer 11 showed "no phone" on
-- the admin detail page while the order right beside it held a validated
-- E.164 number the buyer had typed in himself. That is what prompted this
-- whole piece of work.
--
-- The code fix is Customer.setPhoneIfMissing, called beside the name copy.
-- This statement repairs the rows already written.
--
-- ⚠️ customers has ONE phone column, VARCHAR(30), and NO extension column
-- (verified against the 2026-09-29 schema dump). orders.ship_phone_ext is
-- therefore NOT backfilled and is NOT concatenated in. An extension is a
-- property of how to reach someone AT A DELIVERY, which is an order fact;
-- gluing "x204" into a phone field would corrupt the one value that has to
-- stay dialable and E.164-shaped for SMS.
--
-- MIN(), not the latest: ship_phone is NOT NULL-checked at checkout, so any
-- non-empty value is a real validated number, and taking the earliest is
-- deterministic — re-running this cannot flip a value back and forth.
-- The WHERE clause makes it idempotent and non-destructive: a customer who
-- already has a phone keeps it.

UPDATE `customers` c
   SET c.`phone` = (
         SELECT MIN(o.`ship_phone`)
           FROM `orders` o
          WHERE o.`customer_id` = c.`id`
            AND o.`ship_phone` IS NOT NULL
            AND o.`ship_phone` <> ''
       )
 WHERE (c.`phone` IS NULL OR c.`phone` = '')
   AND EXISTS (
         SELECT 1 FROM `orders` o
          WHERE o.`customer_id` = c.`id`
            AND o.`ship_phone` IS NOT NULL
            AND o.`ship_phone` <> ''
       );


-- ─────────────────────────────────────────────────────────────────────────
-- Verify:
--   SHOW TABLES LIKE 'customer_m%';          -- expect customer_messages, customer_merges
--   SELECT COUNT(*) FROM customer_messages;  -- expect 0
--
--   -- every customer who has an order with a phone now has a phone:
--   SELECT c.id, c.email, c.phone, MIN(o.ship_phone) AS order_phone
--     FROM customers c
--     JOIN orders o ON o.customer_id = c.id
--    WHERE o.ship_phone <> ''
--    GROUP BY c.id, c.email, c.phone;
--   -- expect phone NON-EMPTY on every row. Customer 11 is the one to look at.
-- ─────────────────────────────────────────────────────────────────────────
