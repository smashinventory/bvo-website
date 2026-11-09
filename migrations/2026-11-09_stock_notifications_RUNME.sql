-- ─────────────────────────────────────────────────────────────────────────
-- 2026-11-09_stock_notifications_RUNME.sql
--
-- Back-in-stock capture. 1,178 of 5,873 feed products (20%) are out of
-- stock, including 725 in Single Sink Vanity With Top — the largest and
-- most-searched category. Until now an out-of-stock product page was a dead
-- end: a disabled OUT OF STOCK button, a wishlist link, and cross-sells to
-- four different models. Nothing captured the one thing worth capturing,
-- which is that this person wanted THIS vanity.
--
-- Run in phpMyAdmin against the BVO database. Safe to run twice.
--
-- ⚠️ NO information_schema. This DB user is denied it (#1044).
--
-- ⚠️ THE USE LINE IS NOT OPTIONAL. Same reason as
-- 2026-10-04_sample_redemptions_RUNME.sql records: a migration that relies
-- on whichever database the phpMyAdmin sidebar happened to have selected
-- works right up until it does not, and the failure is a table created in
-- the wrong schema with the verification queries reporting on a schema
-- nobody meant.
--
-- ⚠️ THE email_templates COLUMNS ARE label AND body_html. NOT name AND
-- html_body. The first version of this file guessed them and died on
-- "#1054 - Unknown column 'name'" AFTER the CREATE TABLE had already
-- succeeded — so the table existed, the template did not, and the feature
-- would have captured addresses and silently never emailed anyone.
-- gate_stock_notify.js now asserts these names against the columns the
-- code actually selects.
-- ─────────────────────────────────────────────────────────────────────────

USE `u222311468_BVO_website`;

CREATE TABLE IF NOT EXISTS stock_notifications (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,

  product_id    INT UNSIGNED  NOT NULL,
  sku           VARCHAR(64)   NOT NULL
                COMMENT 'Denormalised on purpose: if the product row is ever deleted, the demand signal survives for reporting.',

  email         VARCHAR(254)  NOT NULL COMMENT 'Stored lower-cased and trimmed.',

  -- ⚠️ UNTICKED BY DEFAULT ON THE FORM, SO DEFAULT 0 HERE.
  -- A pre-ticked box re-subscribing someone who already opted out is the
  -- fastest route to spam complaints, and Brevo scores complaint rate at the
  -- ACCOUNT level — the same account that sends order confirmations.
  marketing_opt_in TINYINT(1) NOT NULL DEFAULT 0,

  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notified_at   DATETIME      NULL
                COMMENT 'Set when the back-in-stock email is sent. NULL = still waiting. The job keys off this.',

  unsub_token   VARCHAR(128)  NULL COMMENT 'Signed token for the one-click unsubscribe in the notice.',
  source_url    VARCHAR(512)  NULL COMMENT 'Where they asked from, for attribution.',
  user_agent    VARCHAR(255)  NULL,
  ip_hash       VARCHAR(64)   NULL COMMENT 'Hashed, not raw — abuse throttling only.',

  PRIMARY KEY (id),

  -- One person, one product, one request. A double submit updates in place
  -- instead of queueing two emails about the same vanity.
  UNIQUE KEY uniq_request (product_id, email),

  -- The job's hot path: "everything still waiting".
  KEY idx_pending (notified_at, product_id),
  KEY idx_email   (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── THE EMAIL ───────────────────────────────────────────────────────────
-- Reuses the existing email_templates + Brevo path that cartRecovery already
-- uses. Voice: plain, short, no exclamation marks, no false urgency — the
-- person asked for this and already wants it.
INSERT INTO email_templates (trigger_key, label, subject, body_html, is_active)
VALUES (
  'back_in_stock',
  'Back in stock notice',
  '{{product_name}} is back in stock',
  CONCAT(
    '<p>Hi,</p>',
    '<p>You asked us to let you know when the <strong>{{product_name}}</strong> ',
    'was available again. It is back in stock now.</p>',
    '<p><a href="{{product_url}}" style="display:inline-block;background:#8a6d2f;color:#fff;',
    'padding:14px 28px;border-radius:4px;text-decoration:none;font-weight:bold">',
    'View {{product_name}}</a></p>',
    '<p>{{price_line}}</p>',
    '<p>Stock on these moves, and we are not holding one aside — this note goes ',
    'to everyone who asked.</p>',
    '<p>Questions about fit, finish, or delivery? Reply to this email and a ',
    'product expert will answer.</p>',
    '<p>— BathroomVanitiesOutlet.com</p>',
    '<hr style="border:none;border-top:1px solid #e6e3dc;margin:24px 0">',
    '<p style="font-size:12px;color:#777">You received this because you asked to be ',
    'notified about this one item. You will not get another email about it. ',
    '<a href="{{unsubscribe_url}}">Unsubscribe from all email</a>.</p>'
  ),
  1
)
ON DUPLICATE KEY UPDATE
  label     = VALUES(label),
  subject   = VALUES(subject),
  body_html = VALUES(body_html),
  is_active = VALUES(is_active);


-- ── VERIFY ──────────────────────────────────────────────────────────────
SHOW TABLES LIKE 'stock_notifications';          -- expect 1 row

SELECT COUNT(*) AS requests FROM stock_notifications;
-- expect 0 — nobody has asked yet

SELECT trigger_key, label, is_active, subject
  FROM email_templates WHERE trigger_key = 'back_in_stock';
-- expect 1 row, is_active = 1
