-- ═══════════════════════════════════════════════════════════════════════
-- 2026-10-27_cart_recovery_template_RUNME.sql
-- The cart-recovery email template.
--
-- ⚠️ INSERTED is_active = 0. IT WILL NOT SEND UNTIL YOU TURN IT ON.
-- brevoService looks up `WHERE trigger_key = ? AND is_active = 1`, so an
-- inactive row is present, reviewable in Admin → Email Templates, and
-- inert. Read it, send yourself a test, then flip it. A template that
-- goes live the moment it is inserted gives nobody a chance to read it.
--
-- ── THE VARIABLES, AND WHERE THEY COME FROM ────────────────────────────
-- All supplied by src/jobs/cartRecovery.js. substituteVars is a plain
-- {{key}} replacement with NO conditionals and NO escaping, so:
--   • every variable must always be supplied, or it renders empty
--   • any branching has to happen in the job, not here
--
--   customer_first_name  ship_first_name, or "there"
--   product_name         first line item, or "your order"
--   product_url          the product page — NOT a general sale page.
--                        ⚠️ The draft of this email linked to
--                        /collections/sale, which makes somebody who had
--                        already configured a specific vanity in a
--                        specific finish go and find it again. That was
--                        the single biggest conversion leak in it.
--   cart_total           formatted, no currency symbol
--   offer_url            /account/login?offer=platinum&optin=1
--                        ⚠️ THIS is what enrols somebody in the 10%.
--                        offerClaim.js requires offer_enrolled_at AND
--                        accepts_marketing AND no prior captured order.
--                        /collections/sale enrols nobody.
--   unsubscribe_url      server-signed, from unsubscribeToken
--   postal_address       required by CAN-SPAM
--   phone                (877) 777-1948
--
-- ── WHY THE DELIVERY PARAGRAPH IS IN HERE ──────────────────────────────
-- A vanity is 200–400 lbs and arrives curbside on a liftgate. The
-- project's own checkout-delivery.ejs calls curbside "the single biggest
-- expectation gap in the business". Somebody who reaches the payment step
-- on a $2,195 freight item and stops may well have stopped over
-- delivery, not price. Naming it costs nothing if that is wrong and
-- recovers the sale if it is right.
-- ═══════════════════════════════════════════════════════════════════════


-- ── STEP 1: LOOK FIRST ─────────────────────────────────────────────────
-- Expect zero rows. If one comes back, the template already exists and
-- Step 2 would fail on the unique key — edit it in admin instead.
SELECT id, trigger_key, is_active FROM email_templates WHERE trigger_key = 'cart_recovery';


-- ── STEP 2: INSERT IT (INACTIVE) ───────────────────────────────────────
INSERT INTO email_templates (trigger_key, label, subject, body_html, is_active)
VALUES (
  'cart_recovery',
  'Abandoned cart — recovery',
  'Still deciding on the {{product_name}}?',
  CONCAT(
    '<p>Hi {{customer_first_name}},</p>',
    '<p>You were setting this up a couple of days ago, and we have kept it ready for you:</p>',
    '<p style="border:1px solid #E8E4DC;border-radius:8px;padding:14px;margin:18px 0">',
      '<strong>{{product_name}}</strong><br>',
      '<span style="color:#787063">$', '{{cart_total}}</span>',
    '</p>',
    '<p><a href="{{product_url}}" style="display:inline-block;background:#182840;color:#ffffff;',
      'text-decoration:none;padding:13px 26px;border-radius:6px;font-weight:bold">',
      'Pick up where you left off &rarr;</a></p>',
    '<p>If something got in the way &mdash; a question about the finish, the payment step ',
      'not working, or anything else &mdash; just reply to this email and a person will read it.</p>',
    '<div style="background:#F4F7F4;border-left:3px solid #6B8C74;padding:12px 14px;margin:18px 0">',
      '<p style="margin:0 0 8px"><strong>A note on delivery, since it surprises people.</strong></p>',
      '<p style="margin:0">A vanity this size ships by freight truck and is delivered ',
      '<strong>curbside</strong> &mdash; the driver lowers it to the kerb on a liftgate rather ',
      'than carrying it inside. It weighs 200&ndash;400&nbsp;lbs, so plan a hand. The carrier ',
      'calls you first to book a time. If that is the part you were unsure about, we would ',
      'rather talk it through now than after it is on a truck.</p>',
    '</div>',
    '<p><strong>One more thing.</strong> Our free Platinum Member program takes ',
      '<strong>10% off your first order</strong>. It takes a minute to join and you can do ',
      'it before you check out:</p>',
    '<p><a href="{{offer_url}}" style="display:inline-block;background:#6B8C74;color:#ffffff;',
      'text-decoration:none;padding:13px 26px;border-radius:6px;font-weight:bold">',
      'Join and take 10% off &rarr;</a></p>',
    '<p>Questions, or would you rather just talk it through? Call us on ',
      '<strong>{{phone}}</strong> &mdash; a real person answers.</p>',
    '<p>Best wishes,<br>Team BVO</p>',
    '<hr style="border:none;border-top:1px solid #E8E4DC;margin:24px 0 14px">',
    '<p style="font-size:12px;color:#787063;line-height:1.6">',
      'BVO &middot; {{postal_address}} &middot; {{phone}}<br>',
      'You are receiving this because you opted in to updates when you started your order. ',
      '<a href="{{unsubscribe_url}}" style="color:#787063">Unsubscribe</a>',
    '</p>'
  ),
  0
);


-- ── STEP 3: PROVE IT ───────────────────────────────────────────────────
-- Expect: one row, is_active = 0, and every flag below = 1.
SELECT id, trigger_key, is_active, subject,
       body_html LIKE '%{{product_url}}%'     AS has_product_link,
       body_html LIKE '%{{offer_url}}%'       AS has_offer_link,
       body_html LIKE '%{{unsubscribe_url}}%' AS has_unsub,
       body_html LIKE '%{{postal_address}}%'  AS has_address,
       body_html LIKE '%curbside%'            AS has_delivery_note,
       body_html LIKE '%collections/sale%'    AS wrong_link_should_be_0
  FROM email_templates WHERE trigger_key = 'cart_recovery';


-- ── STEP 4: WHEN YOU ARE READY, AND NOT BEFORE ─────────────────────────
-- Send yourself a test first:
--   node src/jobs/cartRecovery.js --dry-run     (lists, sends nothing)
-- Read the rendered email. Check the unsubscribe link opens the confirm
-- page. THEN:
--
-- UPDATE email_templates SET is_active = 1 WHERE trigger_key = 'cart_recovery';
