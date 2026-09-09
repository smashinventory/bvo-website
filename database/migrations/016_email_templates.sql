-- ═══════════════════════════════════════════════════════════════════════
-- 016_email_templates.sql — rewrite all 9 transactional email templates
--
-- ── REWRITTEN TWICE. READ THIS BEFORE TOUCHING IT. ───────────────────
-- v1 assumed `email_templates` did not exist, because nothing in
-- database/migrations/ creates it. The table has held 9 active templates
-- since the order-management build in August. v1 used INSERT IGNORE, so
-- every row was skipped, the approved copy never landed, and the file
-- reported success.
--
-- 16 of the 41 live tables have no CREATE in database/migrations/. See
-- BVO_AUDIT_BRIEF.md → LIVE DATABASE INVENTORY. Absence of a migration is
-- not evidence that a table is absent.
--
-- v2 replaced only order_confirmed, with copy written in a neutral
-- corporate register — a numbered compliance list headed "Six things worth
-- knowing". That is not BVO's voice. The voice was never written down in
-- any brief; the TEMPLATES THEMSELVES are the artifact that carries it.
-- Read them before rewriting them.
--
-- ── THE VOICE ────────────────────────────────────────────────────────
--   * Subject is a benefit or a feeling, never a status. Emoji at the end.
--   * "Dream bathroom" is the recurring motif.
--   * Present-tense momentum: in motion · it is moving · we are on it.
--   * A human is promised: "a real person will get back to you".
--   * Sign-off is a short emotional phrase + The BVO Team.
--   * Short paragraphs. Warm. Never bureaucratic.
--
-- The operational and legal content still has to land — the delivery
-- receipt clause decides who absorbs a damaged $2,500 vanity. It is framed
-- as protecting the customer's outcome ("things that turn a dream bathroom
-- into a nightmare"), not as protecting us. Same information, opposite
-- posture.
--
-- ── VARIABLE DISCIPLINE ──────────────────────────────────────────────
-- Each template uses ONLY the variables its caller actually supplies.
-- brevoService.substituteVars() renders an unknown {{var}} as an empty
-- string — no error, just a silent blank in a live customer email.
--
--   order_confirmed        checkoutController   first_name, order_number,
--                                               order_items_html, order_total,
--                                               estimated_ship_window
--   vanity_in_preparation  ordersController     first_name, product_name, transit_days
--   order_shipped          ordersController     first_name, product_name,
--                                               tracking_url, carrier, estimated_delivery
--   return_approved        returnsController    first_name, ra_number,
--                                               resolution_type, refund_timeline
--   return_resolved        returnsController    first_name, product_name,
--                                               resolution_type, resolution_detail
--
-- out_for_delivery, order_delivered, review_request and cross_sell have
-- NO code path calling them. They are written and left active so they are
-- ready when wired, but nothing sends them today.
--
-- ── RA, NOT RMA ──────────────────────────────────────────────────────
-- returnsController generates raNumber and passes ra_number. The policy
-- pages were corrected to match on 9 Sept. Do not reintroduce "RMA".
--
-- Safe to re-run: every statement is a full overwrite of one row. It WILL
-- overwrite copy edited in the admin editor, so once applied, edit at
-- /admin/settings/email-templates and not here.
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

-- ── order_confirmed ──
UPDATE email_templates SET
  label     = 'Order Confirmed',
  subject   = 'Your dream bathroom is officially in motion ✨',
  body_html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">
  <p style="margin:0 0 18px">Hi {{customer_first_name}},</p>

  <p style="margin:0 0 20px">You made a great choice, and we are on it.</p>

  <p style="margin:0 0 6px;color:#7a7264;font-size:13px">Order <strong>{{order_number}}</strong></p>
  {{order_items_html}}
  <p style="font-size:17px;margin:14px 0 24px"><strong>Order total: {{order_total}}</strong></p>

  <p style="margin:0 0 20px">We take making your dream bathroom seriously. So with your outcome in mind, we need a small favour: two minutes to acquaint yourself with the handful of things that turn a dream bathroom into a nightmare. Every one of them is avoidable, and every one of them is avoided by you knowing about it now.</p>

  <p style="margin:0 0 16px"><strong>1. Nobody home when the truck arrives.</strong><br>
  Your vanity comes by freight, not parcel. The carrier calls to schedule, and someone has to be there to receive and sign. A missed appointment means redelivery and storage fees, and a vanity sitting in a terminal instead of your bathroom.</p>

  <div style="border-left:3px solid #c9a227;padding:14px 18px;margin:0 0 18px;background:#fdfaf3">
    <p style="margin:0"><strong>2. Signing before you look. This is the one that matters most.</strong><br>
    If the packaging looks damaged, refuse the shipment and call us the same day. If you accept it and spot any damage, write it on the delivery receipt <em>before</em> you sign, and photograph it. Writing &ldquo;subject to inspection&rdquo; does not count. <strong>Once a clean receipt is signed, the carrier and the manufacturer will both deny the claim</strong> &mdash; and at that point nobody can recover it, including us. Ninety seconds of looking protects your entire order.</p>
  </div>

  <p style="margin:0 0 16px"><strong>3. Breaking down the crate too soon.</strong><br>
  Keep the crate and all packaging until you are certain you are keeping the vanity. Returns have to go back in their original packaging, and an unpacked vanity costs considerably more to return than one still boxed.</p>

  <p style="margin:0 0 16px"><strong>4. Telling us too late.</strong><br>
  Visible damage or a missing box: within <strong>48 hours</strong>. Damage you find after unpacking: within <strong>21 days</strong>. We have to file with the manufacturer inside their window, so these are firm &mdash; and a day early is worth a great deal more than a day late.</p>

  <p style="margin:0 0 16px"><strong>5. Losing track of the return window.</strong><br>
  <strong>30 days from your order date</strong>, and email us for an RA number first &mdash; anything sent back without one gets refused at the dock. If your delivery runs late, you get at least 10 days from the day it actually arrives.</p>

  <p style="margin:0 0 20px"><strong>6. A charge that looks wrong.</strong><br>
  We placed an authorization hold when you ordered and charge it when your order is confirmed. If your bank shows a hold that later disappears, that is normal &mdash; authorizations expire after about a week, and we re-confirm before capture. Nothing is charged if we cancel beforehand.</p>

  <p style="margin:0 0 20px">Curbside delivery with liftgate is included, and your vanity can weigh 200 to 400 lbs &mdash; so line up a second pair of hands for the walk from the curb.</p>

  <p style="margin:0 0 18px">Again: our only goal here is making sure your dream bathroom never turns into a dreaded nightmare.</p>

  <p style="margin:0 0 18px">Your vanity ships in approximately <strong>{{estimated_ship_window}}</strong>, and you will get live tracking the moment it is on its way.</p>

  <p style="margin:0 0 4px">Questions? Reply to this email &mdash; a real person will get back to you.</p>

  <p style="margin:18px 0 0">Thank you for honoring us with your business. We look forward to being part of your special project.</p>
  <p style="margin:22px 0 0">Warmly,<br><strong>The BVO Team</strong></p>

  <hr style="border:0;border-top:1px solid #e5e0d8;margin:26px 0 20px">
  <p style="margin:0 0 18px;font-size:13px;color:#7a7264">
    <a href="https://bathroomvanitiesoutlet.com/pages/shipping-policy" style="color:#c9a227">Shipping Policy</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/returns-policy" style="color:#c9a227">Returns &amp; Refunds</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/terms-and-conditions" style="color:#c9a227">Terms &amp; Conditions</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/privacy-policy" style="color:#c9a227">Privacy Policy</a>
  </p>
  <p style="margin:0;font-size:13px;color:#7a7264">
    <a href="mailto:support@bathroomvanitiesoutlet.com" style="color:#c9a227">support@bathroomvanitiesoutlet.com</a> &middot; (877) 777-1948<br>
    BathroomVanitiesOutlet.com &mdash; Smash Inventory Solutions, LLC
  </p>
</div>',
  is_active = 1
WHERE trigger_key = 'order_confirmed';

-- ── vanity_in_preparation ──
UPDATE email_templates SET
  label     = 'Vanity In Preparation',
  subject   = 'Your {{product_name}} is being prepared for you',
  body_html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">
  <p style="margin:0 0 18px">Hi {{customer_first_name}},</p>

  <p style="margin:0 0 18px">Great news &mdash; your <strong>{{product_name}}</strong> is now being meticulously prepared for its journey to your dream bathroom.</p>

  <p style="margin:0 0 18px">You will receive a shipping confirmation with a live tracking link the moment it departs. Typical transit time once it ships is <strong>{{transit_days}} business days</strong>.</p>

  <p style="margin:0 0 18px">One thing to line up while you wait: freight delivery is curbside, someone needs to be there to sign, and your vanity can weigh 200 to 400 lbs. A second pair of hands for the walk from the curb makes the day go smoothly.</p>

  <p style="margin:0 0 4px">Any questions about installation, accessories, or anything else &mdash; we are here.</p>
  <p style="margin:22px 0 0">Talk soon,<br><strong>The BVO Team</strong></p>

  <hr style="border:0;border-top:1px solid #e5e0d8;margin:26px 0 20px">
  <p style="margin:0 0 18px;font-size:13px;color:#7a7264">
    <a href="https://bathroomvanitiesoutlet.com/pages/shipping-policy" style="color:#c9a227">Shipping Policy</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/returns-policy" style="color:#c9a227">Returns &amp; Refunds</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/terms-and-conditions" style="color:#c9a227">Terms &amp; Conditions</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/privacy-policy" style="color:#c9a227">Privacy Policy</a>
  </p>
  <p style="margin:0;font-size:13px;color:#7a7264">
    <a href="mailto:support@bathroomvanitiesoutlet.com" style="color:#c9a227">support@bathroomvanitiesoutlet.com</a> &middot; (877) 777-1948<br>
    BathroomVanitiesOutlet.com &mdash; Smash Inventory Solutions, LLC
  </p>
</div>',
  is_active = 1
WHERE trigger_key = 'vanity_in_preparation';

-- ── order_shipped ──
UPDATE email_templates SET
  label     = 'Order Shipped',
  subject   = 'It is on its way — your {{product_name}} is in transit 🚚',
  body_html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">
  <p style="margin:0 0 18px">Hi {{customer_first_name}},</p>

  <p style="margin:0 0 18px">It is moving. Your <strong>{{product_name}}</strong> is in transit and headed to you.</p>

  <p style="margin:0 0 18px">
    <a href="{{tracking_url}}" style="color:#c9a227;font-weight:700">Follow its journey here &rarr;</a><br>
    <span style="color:#7a7264;font-size:14px">Carrier: {{carrier}} &middot; Estimated arrival: {{estimated_delivery}}</span>
  </p>

  <p style="margin:0 0 18px">Now the part that protects everything. Please read it once before delivery day &mdash; it is ninety seconds of your time and it is the difference between a dream bathroom and a very expensive headache.</p>

  <div style="border-left:3px solid #c9a227;padding:14px 18px;margin:0 0 18px;background:#fdfaf3">
    <p style="margin:0 0 10px"><strong>Inspect before you sign.</strong></p>
    <p style="margin:0 0 10px">If the packaging looks damaged, <strong>refuse the shipment</strong> and call us the same day. We will arrange a replacement.</p>
    <p style="margin:0 0 10px">If you accept it and spot any damage, <strong>write it on the delivery receipt before you sign</strong>, and photograph it. Photograph the pallet on the truck if you can.</p>
    <p style="margin:0 0 10px">Writing &ldquo;subject to inspection&rdquo; does <strong>not</strong> count. If a box is missing, note how many.</p>
    <p style="margin:0"><strong>Once a clean receipt is signed, the carrier and the manufacturer will both deny the claim</strong> &mdash; and nobody can recover it after that, including us.</p>
  </div>

  <p style="margin:0 0 18px">Delivery is curbside with liftgate, someone must be present to sign, and the carrier will call to schedule. Keep all packaging until you are certain you are keeping it.</p>

  <p style="margin:0 0 4px">If anything comes up with the shipment, we will be on it before you even know about it.</p>
  <p style="margin:22px 0 0">Almost there,<br><strong>The BVO Team</strong></p>

  <hr style="border:0;border-top:1px solid #e5e0d8;margin:26px 0 20px">
  <p style="margin:0 0 18px;font-size:13px;color:#7a7264">
    <a href="https://bathroomvanitiesoutlet.com/pages/shipping-policy" style="color:#c9a227">Shipping Policy</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/returns-policy" style="color:#c9a227">Returns &amp; Refunds</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/terms-and-conditions" style="color:#c9a227">Terms &amp; Conditions</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/privacy-policy" style="color:#c9a227">Privacy Policy</a>
  </p>
  <p style="margin:0;font-size:13px;color:#7a7264">
    <a href="mailto:support@bathroomvanitiesoutlet.com" style="color:#c9a227">support@bathroomvanitiesoutlet.com</a> &middot; (877) 777-1948<br>
    BathroomVanitiesOutlet.com &mdash; Smash Inventory Solutions, LLC
  </p>
</div>',
  is_active = 1
WHERE trigger_key = 'order_shipped';

-- ── out_for_delivery ──
UPDATE email_templates SET
  label     = 'Out For Delivery',
  subject   = 'Today is the day — your {{product_name}} arrives 🎉',
  body_html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">
  <p style="margin:0 0 18px">Hi {{customer_first_name}},</p>

  <p style="margin:0 0 18px">Your <strong>{{product_name}}</strong> is out for delivery with {{carrier}} today.</p>

  <p style="margin:0 0 18px"><a href="{{tracking_url}}" style="color:#c9a227;font-weight:700">Track it live &rarr;</a></p>

  <div style="border-left:3px solid #c9a227;padding:14px 18px;margin:0 0 18px;background:#fdfaf3">
    <p style="margin:0 0 10px"><strong>Ninety seconds before you sign:</strong></p>
    <p style="margin:0 0 8px">&bull; Packaging damaged? <strong>Refuse it</strong> and call us today.</p>
    <p style="margin:0 0 8px">&bull; Any damage at all? <strong>Write it on the delivery receipt before signing</strong> and photograph it.</p>
    <p style="margin:0 0 8px">&bull; &ldquo;Subject to inspection&rdquo; does not count. Missing a box? Note how many.</p>
    <p style="margin:0">&bull; Sign clean and the claim is gone &mdash; for you and for us.</p>
  </div>

  <p style="margin:0 0 18px">Delivery is curbside, so have a second pair of hands ready. Keep every piece of packaging until you are certain you are keeping it.</p>

  <p style="margin:0 0 4px">Anything at all goes sideways, call us at (877) 777-1948 while the driver is still there.</p>
  <p style="margin:22px 0 0">Enjoy every minute,<br><strong>The BVO Team</strong></p>

  <hr style="border:0;border-top:1px solid #e5e0d8;margin:26px 0 20px">
  <p style="margin:0 0 18px;font-size:13px;color:#7a7264">
    <a href="https://bathroomvanitiesoutlet.com/pages/shipping-policy" style="color:#c9a227">Shipping Policy</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/returns-policy" style="color:#c9a227">Returns &amp; Refunds</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/terms-and-conditions" style="color:#c9a227">Terms &amp; Conditions</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/privacy-policy" style="color:#c9a227">Privacy Policy</a>
  </p>
  <p style="margin:0;font-size:13px;color:#7a7264">
    <a href="mailto:support@bathroomvanitiesoutlet.com" style="color:#c9a227">support@bathroomvanitiesoutlet.com</a> &middot; (877) 777-1948<br>
    BathroomVanitiesOutlet.com &mdash; Smash Inventory Solutions, LLC
  </p>
</div>',
  is_active = 1
WHERE trigger_key = 'out_for_delivery';

-- ── order_delivered ──
UPDATE email_templates SET
  label     = 'Order Delivered',
  subject   = 'Your {{product_name}} has arrived ✨',
  body_html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">
  <p style="margin:0 0 18px">Hi {{customer_first_name}},</p>

  <p style="margin:0 0 18px">Your <strong>{{product_name}}</strong> has been delivered. This is the good part.</p>

  <p style="margin:0 0 18px">Two things worth doing today, while it is still easy:</p>

  <p style="margin:0 0 16px"><strong>Unpack and look it over.</strong> If you find damage that was not visible through the packaging, tell us within <strong>21 days</strong> and we will handle it with the manufacturer. After that window they will not accept the claim.</p>

  <p style="margin:0 0 18px"><strong>Hold on to the packaging.</strong> Keep the crate and every carton until the install is done and you are certain. Returns have to travel in their original packaging.</p>

  <p style="margin:0 0 4px">Send us a photo when it is in &mdash; we genuinely love seeing them.</p>
  <p style="margin:22px 0 0">Enjoy it,<br><strong>The BVO Team</strong></p>

  <hr style="border:0;border-top:1px solid #e5e0d8;margin:26px 0 20px">
  <p style="margin:0 0 18px;font-size:13px;color:#7a7264">
    <a href="https://bathroomvanitiesoutlet.com/pages/shipping-policy" style="color:#c9a227">Shipping Policy</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/returns-policy" style="color:#c9a227">Returns &amp; Refunds</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/terms-and-conditions" style="color:#c9a227">Terms &amp; Conditions</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/privacy-policy" style="color:#c9a227">Privacy Policy</a>
  </p>
  <p style="margin:0;font-size:13px;color:#7a7264">
    <a href="mailto:support@bathroomvanitiesoutlet.com" style="color:#c9a227">support@bathroomvanitiesoutlet.com</a> &middot; (877) 777-1948<br>
    BathroomVanitiesOutlet.com &mdash; Smash Inventory Solutions, LLC
  </p>
</div>',
  is_active = 1
WHERE trigger_key = 'order_delivered';

-- ── review_request ──
UPDATE email_templates SET
  label     = 'Review Request',
  subject   = 'How is the dream bathroom coming along?',
  body_html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">
  <p style="margin:0 0 18px">Hi {{customer_first_name}},</p>

  <p style="margin:0 0 18px">It has been a little while since your <strong>{{product_name}}</strong> arrived, and we have been wondering how it turned out.</p>

  <p style="margin:0 0 18px">If it landed the way you hoped, would you tell someone? A short review helps the next person standing where you were a few weeks ago, trying to work out whether a vanity they cannot touch is the right one.</p>

  <p style="margin:0 0 22px"><a href="{{google_review_url}}" style="background:#c9a227;color:#fff;padding:11px 22px;border-radius:4px;text-decoration:none;font-weight:700;display:inline-block">Leave a review</a></p>

  <p style="margin:0 0 4px">And if something is not right, reply to this email instead &mdash; we would much rather fix it than read about it.</p>
  <p style="margin:22px 0 0">Thank you,<br><strong>The BVO Team</strong></p>

  <hr style="border:0;border-top:1px solid #e5e0d8;margin:26px 0 20px">
  <p style="margin:0 0 18px;font-size:13px;color:#7a7264">
    <a href="https://bathroomvanitiesoutlet.com/pages/shipping-policy" style="color:#c9a227">Shipping Policy</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/returns-policy" style="color:#c9a227">Returns &amp; Refunds</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/terms-and-conditions" style="color:#c9a227">Terms &amp; Conditions</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/privacy-policy" style="color:#c9a227">Privacy Policy</a>
  </p>
  <p style="margin:0;font-size:13px;color:#7a7264">
    <a href="mailto:support@bathroomvanitiesoutlet.com" style="color:#c9a227">support@bathroomvanitiesoutlet.com</a> &middot; (877) 777-1948<br>
    BathroomVanitiesOutlet.com &mdash; Smash Inventory Solutions, LLC
  </p>
</div>',
  is_active = 1
WHERE trigger_key = 'review_request';

-- ── cross_sell ──
UPDATE email_templates SET
  label     = 'Cross-sell — Complete the Look',
  subject   = 'One more thing for your dream bathroom ✨',
  body_html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">
  <p style="margin:0 0 18px">Hi {{customer_first_name}},</p>

  <p style="margin:0 0 18px">Now that your <strong>{{product_name}}</strong> is in, there are a few pieces that were designed to sit alongside it &mdash; matching mirrors, tops and hardware from the same collection, in the same finish.</p>

  <p style="margin:0 0 22px"><a href="{{cross_sell_url}}" style="background:#c9a227;color:#fff;padding:11px 22px;border-radius:4px;text-decoration:none;font-weight:700;display:inline-block">See the matching pieces</a></p>

  <p style="margin:0 0 4px">Not sure what pairs with what? Reply and we will tell you exactly &mdash; a real person, not a catalogue.</p>
  <p style="margin:22px 0 0">Here to help,<br><strong>The BVO Team</strong></p>

  <hr style="border:0;border-top:1px solid #e5e0d8;margin:26px 0 20px">
  <p style="margin:0 0 18px;font-size:13px;color:#7a7264">
    <a href="https://bathroomvanitiesoutlet.com/pages/shipping-policy" style="color:#c9a227">Shipping Policy</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/returns-policy" style="color:#c9a227">Returns &amp; Refunds</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/terms-and-conditions" style="color:#c9a227">Terms &amp; Conditions</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/privacy-policy" style="color:#c9a227">Privacy Policy</a>
  </p>
  <p style="margin:0;font-size:13px;color:#7a7264">
    <a href="mailto:support@bathroomvanitiesoutlet.com" style="color:#c9a227">support@bathroomvanitiesoutlet.com</a> &middot; (877) 777-1948<br>
    BathroomVanitiesOutlet.com &mdash; Smash Inventory Solutions, LLC
  </p>
</div>',
  is_active = 1
WHERE trigger_key = 'cross_sell';

-- ── return_approved ──
UPDATE email_templates SET
  label     = 'Return Approved — RA Issued',
  subject   = 'Your return is approved — RA {{ra_number}}',
  body_html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">
  <p style="margin:0 0 18px">Hi {{customer_first_name}},</p>

  <p style="margin:0 0 18px">Your return is approved. Sometimes a piece is not the right piece, and that is completely fine &mdash; let us make this the easy part.</p>

  <p style="margin:0 0 18px">Your authorization number is <strong>RA {{ra_number}}</strong>, and the resolution will be a <strong>{{resolution_type}}</strong>.</p>

  <div style="border-left:3px solid #c9a227;padding:14px 18px;margin:0 0 18px;background:#fdfaf3">
    <p style="margin:0 0 10px"><strong>Three things that keep this simple:</strong></p>
    <p style="margin:0 0 8px">&bull; <strong>Write RA {{ra_number}} on the outside of the carton.</strong> Anything arriving without it is refused at the dock.</p>
    <p style="margin:0 0 8px">&bull; <strong>Reply to this email before you ship.</strong> Return destinations vary by item, so we will confirm exactly where yours goes. Do not send it to our office &mdash; that address is not a warehouse.</p>
    <p style="margin:0">&bull; <strong>It must be in its original packaging</strong>, and the carrier has to collect within <strong>14 days</strong> or the authorization expires.</p>
  </div>

  <p style="margin:0 0 18px">Return shipping and a restocking fee apply as set out in our returns policy. Once we receive and inspect it, your refund is issued within <strong>{{refund_timeline}} business days</strong> to your original payment method.</p>

  <p style="margin:0 0 4px">Anything unclear, just reply &mdash; we will walk you through it.</p>
  <p style="margin:22px 0 0">We will take care of it,<br><strong>The BVO Team</strong></p>

  <hr style="border:0;border-top:1px solid #e5e0d8;margin:26px 0 20px">
  <p style="margin:0 0 18px;font-size:13px;color:#7a7264">
    <a href="https://bathroomvanitiesoutlet.com/pages/shipping-policy" style="color:#c9a227">Shipping Policy</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/returns-policy" style="color:#c9a227">Returns &amp; Refunds</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/terms-and-conditions" style="color:#c9a227">Terms &amp; Conditions</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/privacy-policy" style="color:#c9a227">Privacy Policy</a>
  </p>
  <p style="margin:0;font-size:13px;color:#7a7264">
    <a href="mailto:support@bathroomvanitiesoutlet.com" style="color:#c9a227">support@bathroomvanitiesoutlet.com</a> &middot; (877) 777-1948<br>
    BathroomVanitiesOutlet.com &mdash; Smash Inventory Solutions, LLC
  </p>
</div>',
  is_active = 1
WHERE trigger_key = 'return_approved';

-- ── return_resolved ──
UPDATE email_templates SET
  label     = 'Return Resolved',
  subject   = 'All sorted — your {{resolution_type}} is on its way',
  body_html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#2c2c2c;max-width:620px;margin:0 auto;padding:24px">
  <p style="margin:0 0 18px">Hi {{customer_first_name}},</p>

  <p style="margin:0 0 18px">We have received and inspected your <strong>{{product_name}}</strong>, and your return is now closed out.</p>

  <p style="margin:0 0 18px"><strong>{{resolution_detail}}</strong></p>

  <p style="margin:0 0 18px">It goes back to your original payment method. Your bank may take a few more days to post it on their side &mdash; that part is out of our hands, but it is on its way.</p>

  <p style="margin:0 0 4px">We hope the next one is exactly right. When you are ready to look again, we are here &mdash; and we would still very much like to be part of your dream bathroom.</p>
  <p style="margin:22px 0 0">Thank you,<br><strong>The BVO Team</strong></p>

  <hr style="border:0;border-top:1px solid #e5e0d8;margin:26px 0 20px">
  <p style="margin:0 0 18px;font-size:13px;color:#7a7264">
    <a href="https://bathroomvanitiesoutlet.com/pages/shipping-policy" style="color:#c9a227">Shipping Policy</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/returns-policy" style="color:#c9a227">Returns &amp; Refunds</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/terms-and-conditions" style="color:#c9a227">Terms &amp; Conditions</a> &middot;
    <a href="https://bathroomvanitiesoutlet.com/pages/privacy-policy" style="color:#c9a227">Privacy Policy</a>
  </p>
  <p style="margin:0;font-size:13px;color:#7a7264">
    <a href="mailto:support@bathroomvanitiesoutlet.com" style="color:#c9a227">support@bathroomvanitiesoutlet.com</a> &middot; (877) 777-1948<br>
    BathroomVanitiesOutlet.com &mdash; Smash Inventory Solutions, LLC
  </p>
</div>',
  is_active = 1
WHERE trigger_key = 'return_resolved';

-- ── Verification ──────────────────────────────────────────────────────
-- Expect 9 rows, all active, every body well over 1,000 characters.
-- Anything still near its old length means that UPDATE missed.
SELECT trigger_key, is_active, CHAR_LENGTH(body_html) AS body_len
FROM email_templates ORDER BY id;

-- Expect ZERO rows. These are the variables NO caller supplies; any
-- template still using one would render a silent blank.
SELECT trigger_key, 'uses an unsupplied variable' AS problem
FROM email_templates
WHERE body_html LIKE '%{{estimated_ship_window}}%' AND trigger_key <> 'order_confirmed'
   OR body_html LIKE '%{{return_address}}%'
   OR body_html LIKE '%{{rma_number}}%'
   OR body_html LIKE '%{{refund_amount}}%';

-- Expect ZERO rows. RA is the house term.
SELECT trigger_key FROM email_templates WHERE body_html LIKE '%RMA%' OR subject LIKE '%RMA%';
