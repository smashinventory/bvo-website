-- ═══════════════════════════════════════════════════════════════════════
-- 016_email_templates.sql — create the email_templates table + seed
--
-- ── WHY THIS EXISTS ───────────────────────────────────────────────────
-- `email_templates` is read by src/services/brevoService.js and written by
-- src/controllers/emailTemplatesController.js, and has an admin editor at
-- /admin/settings/email-templates. It has never had a CREATE statement —
-- not in any migration, not as a self-heal in code.
--
-- Five trigger keys are already referenced by live code:
--     order_confirmed        (added by this change, checkoutController)
--     order_shipped          ordersController.bookShipment
--     vanity_in_preparation  ordersController.sendVendorOrder
--     return_approved        returnsController
--     return_resolved        returnsController
--
-- brevoService.getTemplate() runs OUTSIDE the try block in sendTemplate,
-- so a missing table throws out of the send rather than being caught. That
-- is fixed in the same commit as this migration.
--
-- ── is_active ─────────────────────────────────────────────────────────
-- Only `order_confirmed` is seeded ACTIVE. Its copy was written and
-- approved 8 Sept 2026. The other four are seeded INACTIVE with working
-- but unreviewed drafts, so that:
--   * the rows exist and are editable in the admin editor, and
--   * nothing sends unreviewed copy to a customer.
-- getTemplate() filters on is_active = 1, so an inactive template makes
-- sendTemplate log and skip — which is the current behaviour minus the
-- throw. Activate each one from the admin editor after reading it.
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS + INSERT IGNORE on a UNIQUE
-- trigger_key. Re-running will NOT overwrite copy edited in the admin.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS email_templates (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  trigger_key  VARCHAR(64)  NOT NULL UNIQUE,
  label        VARCHAR(255) NOT NULL,
  subject      VARCHAR(500) NOT NULL,
  body_html    MEDIUMTEXT   NOT NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT NOW(),
  updated_at   DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_email_templates_active (trigger_key, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── order_confirmed — ACTIVE ──────────────────────────────────────────
-- Variables available (substituted by brevoService.substituteVars):
--   {{customer_first_name}} {{order_number}} {{order_date}}
--   {{order_items_html}}    {{order_total}}
--
-- The six points below are the approved set, in the order the customer
-- lives them. Bullet 2 is the one that carries real money: once a clean
-- delivery receipt is signed, James Martin and the carrier both deny the
-- claim, and the loss lands on BVO or the customer. POLICY_ANSWERS.md R6
-- calls for it to appear here specifically, because this is the email that
-- actually gets read.
INSERT IGNORE INTO email_templates (trigger_key, label, subject, body_html, is_active) VALUES
('order_confirmed',
 'Order Confirmation',
 'Your BVO order {{order_number}} is confirmed',
 '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">

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
  <strong>30 days from your order date</strong>, and email us for an RMA first &mdash; returns sent without one are refused. Return shipping and a restocking fee apply. If delivery runs late, you will have at least 10 days from the day it arrives.</p>

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
 1);

-- ── The four already-referenced keys — INACTIVE drafts ────────────────
-- These exist so the code paths that call them stop hitting a missing
-- table. Read and activate each from /admin/settings/email-templates.
INSERT IGNORE INTO email_templates (trigger_key, label, subject, body_html, is_active) VALUES
('order_shipped',
 'Order Shipped',
 'Your BVO order has shipped',
 '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">
  <p>Hi {{customer_first_name}},</p>
  <p>Your {{product_name}} is on its way with {{carrier}}, estimated {{estimated_delivery}}.</p>
  <p><a href="{{tracking_url}}">Track your shipment</a></p>
  <div style="border-left:3px solid #c9a227;padding:12px 16px;margin:16px 0;background:#fdfaf3">
    <p style="margin:0"><strong>Inspect before you sign.</strong> If the packaging is damaged, refuse the shipment and call us the same day. If you accept it and see damage, write it on the delivery receipt before signing and photograph it. &ldquo;Subject to inspection&rdquo; does not count &mdash; once a clean receipt is signed the claim cannot be recovered.</p>
  </div>
  <p>Someone must be present to receive and sign. Delivery is curbside with liftgate.</p>
  <p style="font-size:13px;color:#7a7264"><a href="https://bathroomvanitiesoutlet.com/pages/shipping-policy">Shipping Policy</a> &middot; support@bathroomvanitiesoutlet.com &middot; (877) 777-1948</p>
</div>',
 0),

('vanity_in_preparation',
 'Vanity In Preparation',
 'Your BVO order is being prepared',
 '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">
  <p>Hi {{customer_first_name}},</p>
  <p>Your {{product_name}} is being prepared for shipment. Transit is typically {{transit_days}} business days once it leaves the warehouse, and we will send tracking as soon as it ships.</p>
  <p style="font-size:13px;color:#7a7264">support@bathroomvanitiesoutlet.com &middot; (877) 777-1948</p>
</div>',
 0),

('return_approved',
 'Return Approved (RMA issued)',
 'Your return has been approved — RMA {{rma_number}}',
 '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">
  <p>Hi {{customer_first_name}},</p>
  <p>Your return is approved. Your RMA number is <strong>{{rma_number}}</strong>.</p>
  <p>Please return to: {{return_address}}</p>
  <p><strong>Write the RMA number on the outside of the carton.</strong> Items shipped without an RMA, or sent to our office address, are refused. The carrier must collect within 14 days or the authorization expires.</p>
  <p>Items must be in original packaging. Return shipping and a restocking fee apply as set out in our returns policy.</p>
  <p style="font-size:13px;color:#7a7264"><a href="https://bathroomvanitiesoutlet.com/pages/returns-policy">Returns &amp; Refunds</a> &middot; support@bathroomvanitiesoutlet.com</p>
</div>',
 0),

('return_resolved',
 'Return Resolved (refund issued)',
 'Your refund has been issued',
 '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">
  <p>Hi {{customer_first_name}},</p>
  <p>We have received and inspected your return, and a refund of <strong>{{refund_amount}}</strong> has been issued to your original payment method.</p>
  <p>Your bank may take a few more days to post it.</p>
  <p style="font-size:13px;color:#7a7264">support@bathroomvanitiesoutlet.com &middot; (877) 777-1948</p>
</div>',
 0);

-- ── Verification ──────────────────────────────────────────────────────
-- Expect 5 rows: order_confirmed active, the other four inactive.
SELECT trigger_key, label, is_active, CHAR_LENGTH(body_html) AS body_len
FROM email_templates ORDER BY id;

-- Expect ZERO rows. Any trigger_key called in code with no row here is a
-- send that silently does nothing.
SELECT k.trigger_key AS missing_template
FROM (
  SELECT 'order_confirmed' AS trigger_key UNION ALL
  SELECT 'order_shipped'            UNION ALL
  SELECT 'vanity_in_preparation'    UNION ALL
  SELECT 'return_approved'          UNION ALL
  SELECT 'return_resolved'
) k
LEFT JOIN email_templates t ON t.trigger_key = k.trigger_key
WHERE t.id IS NULL;
