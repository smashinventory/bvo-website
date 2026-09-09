-- ═══════════════════════════════════════════════════════════════════════
-- 016_email_templates.sql — align the live order_confirmed template
--
-- ── REWRITTEN 2026-09-09. THE FIRST VERSION OF THIS FILE WAS WRONG. ───
-- It was written on the assumption that `email_templates` did not exist,
-- because nothing in database/migrations/ creates it. The table exists and
-- has held 9 active templates since the order-management build in August.
--
-- The first version therefore:
--   * CREATE TABLE IF NOT EXISTS with a schema that did NOT match live
--     (varchar(64/255/500) + MEDIUMTEXT + a created_at column and an index
--      that live does not have) — a no-op here, but it would have built a
--      DIFFERENT table on a fresh install, and
--   * INSERT IGNORE'd five templates, every one of which was skipped. The
--     approved order_confirmed copy silently never landed, and the file
--     reported success.
--
-- 16 of the 41 live tables have no CREATE in database/migrations/. See
-- BVO_AUDIT_BRIEF.md → LIVE DATABASE INVENTORY. Absence of a migration is
-- not evidence that a table is absent.
--
-- ── WHAT THIS FILE NOW DOES ──────────────────────────────────────────
-- ONE thing: replaces the body and subject of `order_confirmed` with the
-- six-point copy approved 2026-09-08. Nothing else is touched.
--
-- The other EIGHT templates are left exactly as they are. Four of them
-- (out_for_delivery, order_delivered, review_request, cross_sell) have no
-- code path calling them; that is a separate decision, not a migration.
--
-- ── VARIABLES ────────────────────────────────────────────────────────
-- This body uses, and checkoutController supplies, exactly:
--     {{customer_first_name}} {{order_number}} {{order_date}}
--     {{order_items_html}}    {{order_total}}
--
-- The template being REPLACED used {{product_name}} and
-- {{estimated_ship_window}}, which checkoutController does NOT send.
-- brevoService.substituteVars() renders an unknown placeholder as an empty
-- string, so had this not been corrected the first live confirmation email
-- would have gone out with two blank gaps and no error anywhere.
--
-- ── DDL ──────────────────────────────────────────────────────────────
-- Mirrors the LIVE schema exactly, read from the 2026-09-08 mysqldump. It
-- exists so a fresh install builds the same table, not a similar one. On
-- the live database it is a no-op.
--
-- Safe to re-run: the UPDATE is a full overwrite of that one row. It WILL
-- overwrite edits made in the admin editor, so once this is applied, edit
-- the copy at /admin/settings/email-templates and not here.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `email_templates` (
  `id`          int(10) unsigned NOT NULL AUTO_INCREMENT,
  `trigger_key` varchar(100) NOT NULL,
  `label`       varchar(200) NOT NULL,
  `subject`     varchar(300) NOT NULL,
  `body_html`   longtext     NOT NULL,
  `is_active`   tinyint(1)   NOT NULL DEFAULT 1,
  `updated_at`  datetime     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `trigger_key` (`trigger_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── order_confirmed — replace subject + body ──────────────────────────
UPDATE email_templates SET
  subject   = 'Your BVO order {{order_number}} is confirmed',
  body_html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">

  <h1 style="font-size:22px;margin:0 0 4px">Thank you, {{customer_first_name}}.</h1>
  <p style="margin:0 0 20px;color:#7a7264">Order <strong>{{order_number}}</strong> &middot; {{order_date}}</p>

  {{order_items_html}}

  <p style="font-size:17px;margin:16px 0 28px"><strong>Order total: {{order_total}}</strong></p>

  <hr style="border:0;border-top:1px solid #e5e0d8;margin:0 0 24px">

  <h2 style="font-size:17px;margin:0 0 16px">Six things worth knowing</h2>

  <p style="margin:0 0 16px"><strong>1. Someone must be there to receive it.</strong><br>
  Your vanity ships by freight, curbside with liftgate. The driver brings it to the curb and lowers it &mdash; not into your home. A vanity can weigh 200&ndash;400 lbs, so plan for help. The carrier will call to schedule; missed appointments mean redelivery and storage charges.</p>

  <div style="border-left:3px solid #c9a227;padding:12px 16px;margin:0 0 16px;background:#fdfaf3">
    <p style="margin:0"><strong>2. Inspect it before you sign &mdash; this is the important one.</strong><br>
    If the packaging is damaged, refuse the shipment and call us the same day. If you accept it and see any damage, write it on the delivery receipt before signing and photograph it. <em>&ldquo;Subject to inspection&rdquo; does not count.</em> <strong>Once a clean receipt is signed, the carrier and manufacturer will deny the claim, and we cannot recover it.</strong> Ninety seconds protects your whole order.</p>
  </div>

  <p style="margin:0 0 16px"><strong>3. Keep the crate and all packaging.</strong><br>
  Until you are certain you are keeping it. Returns must be in original packaging &mdash; an unpacked vanity carries a higher restocking fee than one still boxed.</p>

  <p style="margin:0 0 16px"><strong>4. Report problems quickly.</strong><br>
  Visible damage or missing boxes: <strong>48 hours</strong>. Concealed damage: <strong>21 days</strong>. We have to file with the manufacturer inside their window, so these are firm.</p>

  <p style="margin:0 0 16px"><strong>5. Returns.</strong><br>
  <strong>30 days from your order date</strong>, and email us for an RA first &mdash; returns sent without one are refused. Return shipping and a restocking fee apply. If delivery runs late, you will have at least 10 days from the day it arrives.</p>

  <p style="margin:0 0 24px"><strong>6. About your payment.</strong><br>
  We have placed an authorization hold on your card and will charge it when your order is confirmed. If your bank shows a hold that later disappears, that is normal &mdash; authorizations expire after about a week, and if your order takes longer we will re-confirm before capture of payment and shipping is scheduled. Nothing is charged if we cancel before capture of payment.</p>

  <hr style="border:0;border-top:1px solid #e5e0d8;margin:0 0 20px">

  <p style="margin:0 0 20px;font-size:13px;color:#7a7264">
    Full details:
    <a href="https://bathroomvanitiesoutlet.com/pages/shipping-policy" style="color:#c9a227">Shipping Policy</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/returns-policy" style="color:#c9a227">Returns &amp; Refunds</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/terms-and-conditions" style="color:#c9a227">Terms &amp; Conditions</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/privacy-policy" style="color:#c9a227">Privacy Policy</a>
  </p>

  <p style="margin:0;font-size:13px;color:#7a7264">
    Questions? <a href="mailto:support@bathroomvanitiesoutlet.com" style="color:#c9a227">support@bathroomvanitiesoutlet.com</a> or (877) 777-1948.<br>
    BathroomVanitiesOutlet.com &mdash; Smash Inventory Solutions, LLC
  </p>

</div>',
  is_active = 1
WHERE trigger_key = 'order_confirmed';

-- ── Verification ──────────────────────────────────────────────────────
-- Expect exactly ONE row changed. Zero means the trigger_key is wrong.
SELECT ROW_COUNT() AS rows_changed;

-- Expect 9 rows. order_confirmed should now be ~3,800 chars; the other
-- eight unchanged. If order_confirmed is still ~597, the UPDATE missed.
SELECT trigger_key, is_active, CHAR_LENGTH(body_html) AS body_len
FROM email_templates ORDER BY id;

-- Expect ZERO rows. Any {{variable}} in order_confirmed that
-- checkoutController does not supply renders as an empty string.
SELECT 'order_confirmed uses an unsupplied variable' AS problem
FROM email_templates
WHERE trigger_key = 'order_confirmed'
  AND (body_html LIKE '%{{product_name}}%'
    OR body_html LIKE '%{{estimated_ship_window}}%'
    OR body_html LIKE '%{{tracking_url}}%'
    OR body_html LIKE '%{{carrier}}%');
