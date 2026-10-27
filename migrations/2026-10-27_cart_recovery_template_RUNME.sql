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
-- ── WHAT SITS WHERE THE DELIVERY PARAGRAPH USED TO ─────────────────────
-- A "talk to a bathroom specialist" block. Same position, opposite job:
-- reassurance instead of warning.
--
-- ⚠️ DELIBERATELY CARRIES NO NUMBER. A draft said "we have helped
-- thousands of customers". BVO is new and the orders table had four rows
-- when this was written, so that claim was not substantiable — and a
-- figure a reader can doubt undermines the confidence it was meant to
-- build. "Someone who sees them every day" does the same work and is
-- true on day one. If a volume claim is ever added it needs a real number
-- behind it.
--
-- The separate "Call us on {{phone}}" paragraph that used to sit lower
-- down was removed when this went in: the phone now appears once in the
-- body and once in the footer, rather than three times.
--
-- ── WHY THERE IS NO DELIVERY PARAGRAPH ─────────────────────────────────
-- An earlier draft carried a curbside/liftgate/200–400 lbs note, on the
-- reasoning that delivery is the biggest expectation gap in the business
-- and a likely reason somebody stops at the payment step.
--
-- Owner's decision, 2026-10-27: remove it. A recovery email's job is to
-- REMOVE friction, not re-raise an objection. The customer has already
-- seen the curbside terms at checkout — checkout-delivery.ejs shows them
-- and orders.delivery_terms_ack_at records the acknowledgement — so
-- repeating it re-litigates something they had already settled. If they
-- stopped for an unrelated reason, a paragraph about 400 lbs on a
-- liftgate plants a doubt that was not there.
--
-- ⚠️ DO NOT ADD IT BACK WITHOUT THAT CONVERSATION. gate_cart_recovery.js
-- asserts its absence, so a well-meaning re-insertion fails the gate
-- rather than quietly shipping.
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
    -- ⚠️ NO TIMEFRAME CLAIM. This read "a couple of days ago" until the
    -- first real send went to a cart minutes old. MIN_AGE_HOURS = 4, so
    -- hours is the common case and days is the exception. See
    -- 2026-10-27_cart_recovery_timing_RUNME.sql.
    '<p>We see that your shopping session was interrupted, and we have kept your cart ready for you:</p>',
    '<p style="border:1px solid #E8E4DC;border-radius:8px;padding:14px;margin:18px 0">',
      '<strong>{{product_name}}</strong><br>',
      '<span style="color:#787063">$', '{{cart_total}}</span>',
    '</p>',
    '<p><a href="{{product_url}}" style="display:inline-block;background:#182840;color:#ffffff;',
      'text-decoration:none;padding:13px 26px;border-radius:6px;font-weight:bold">',
      'Pick up where you left off &rarr;</a></p>',
    '<p>If something got in the way &mdash; a question about the finish, the payment step ',
      'not working, or anything else &mdash; just reply to this email and a person will read it.</p>',
    '<div style="background:#F4F7F4;border-left:3px solid #6B8C74;padding:14px 16px;margin:18px 0">',
      '<p style="margin:0 0 8px"><strong>Not sure? Talk to a bathroom specialist.</strong></p>',
      '<p style="margin:0">Choosing a vanity is easier with someone who sees them every day. ',
      'If you have questions about sizing, finishes, or what pairs with what, our specialists ',
      'are glad to walk you through it before you order &mdash; call <strong>{{phone}}</strong> ',
      'or just reply to this email.</p>',
    '</div>',
    '<p><strong>One more thing.</strong> Our free Platinum Member program takes ',
      '<strong>10% off your first order</strong>. It takes a minute to join and you can do ',
      'it before you check out:</p>',
    '<p><a href="{{offer_url}}" style="display:inline-block;background:#6B8C74;color:#ffffff;',
      'text-decoration:none;padding:13px 26px;border-radius:6px;font-weight:bold">',
      'Join and take 10% off &rarr;</a></p>',
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
-- Expect: one row, is_active = 0, the has_* flags = 1, and BOTH
-- *_should_be_0 flags = 0.
SELECT id, trigger_key, is_active, subject,
       body_html LIKE '%{{product_url}}%'     AS has_product_link,
       body_html LIKE '%{{offer_url}}%'       AS has_offer_link,
       body_html LIKE '%{{unsubscribe_url}}%' AS has_unsub,
       body_html LIKE '%{{postal_address}}%'  AS has_address,
       body_html LIKE '%curbside%'            AS curbside_should_be_0,
       body_html LIKE '%collections/sale%'    AS wrong_link_should_be_0
  FROM email_templates WHERE trigger_key = 'cart_recovery';


-- ── STEP 4: WHEN YOU ARE READY, AND NOT BEFORE ─────────────────────────
-- Send yourself a test first:
--   node src/jobs/cartRecovery.js --dry-run     (lists, sends nothing)
-- Read the rendered email. Check the unsubscribe link opens the confirm
-- page. THEN:
--
-- UPDATE email_templates SET is_active = 1 WHERE trigger_key = 'cart_recovery';
