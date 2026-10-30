-- ═══════════════════════════════════════════════════════════════════════
-- 029_privacy_policy_ad_sharing.sql — Privacy Policy discloses the Meta pixel
--
-- Owner-approved 2026-10-30 ("middle path"): the Meta pixel runs by default,
-- with an opt-out at /privacy-choices and automatic Global Privacy Control.
-- The policy said "We do not share it for cross-context behavioral
-- advertising", which stops being true the moment the pixel fires.
--
-- RUN THIS BEFORE (or at the same time as) the pixel deploy.
--
-- TARGETED REPLACE()s, NOT A FULL OVERWRITE. Migration 014 says edits are
-- made in the admin page editor once live, so overwriting the whole page
-- could wipe an admin edit. Each REPLACE swaps one exact fragment and
-- touches nothing else. A fragment that does not match changes NOTHING —
-- silently — so the verification query at the bottom checks every new
-- fragment and must show 1 in every column.
--
-- Also corrects two statements that were already inaccurate:
--   * Payment processor: Authorize.Net -> Stripe (switched 2026-09-25)
--   * "our cookie banner" — the site has no cookie banner
--
-- NOT LEGAL ADVICE.
-- ═══════════════════════════════════════════════════════════════════════

UPDATE pages SET content =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(content,

  -- 1. Effective date
  '<em>Effective September 8, 2026</em>',
  '<em>Effective October 30, 2026</em>'),

  -- 2. The Short Version
  '<li><strong>We do not share it for cross-context behavioral advertising.</strong></li>',
  '<li><strong>We share limited browsing information with advertising partners such as Meta (Facebook) to measure and show our ads. You can opt out at any time on our <a href="/privacy-choices">Your Privacy Choices</a> page, and we automatically honor Global Privacy Control.</strong></li>'),

  -- 3. Payment processor (first mention)
  'card details are collected and processed by Authorize.Net.',
  'card details are collected and processed by Stripe.'),

  -- 4. Payment processor (sharing table)
  '<tr><td><strong>Authorize.Net</strong></td>',
  '<tr><td><strong>Stripe</strong></td>'),

  -- 5. New sharing-table row for Meta, after Microsoft Clarity
  '<td>Understanding how visitors use the site</td></tr>',
  '<td>Understanding how visitors use the site</td></tr>
<tr><td><strong>Meta Platforms</strong> (Facebook and Instagram pixel)</td><td>Pages viewed, products viewed and added to cart, checkouts and purchase values, device and browser information, IP address and cookie identifiers</td><td>Measuring and showing our ads on Facebook and Instagram. Unless you opt out.</td></tr>'),

  -- 6. No cookie banner exists
  'You can control cookies through our cookie banner and your browser settings.',
  'You can control cookies through your browser settings.'),

  -- 7. The forward-looking paragraph becomes the actual disclosure
  'and in future, advertising and conversion measurement tags. If we begin using advertising tags that share information for cross-context behavioral advertising, we will update this policy and provide an opt-out before doing so.</p>',
  'and advertising and conversion measurement tags such as the Meta pixel described below.</p>

<h2>Advertising and Your Opt-Out</h2>
<p>We use the <strong>Meta pixel</strong> on this site. It tells Meta (Facebook and Instagram) which pages and products you view, when you add to cart or check out, and the value of a purchase, along with device information, IP address and cookie identifiers. We use this to measure whether our ads work and to show our ads to people likely to be interested. We do not sell your personal information, but under some state privacy laws, including California&rsquo;s, this counts as &ldquo;sharing&rdquo; for cross-context behavioral advertising.</p>
<p><strong>You can opt out at any time</strong> on our <a href="/privacy-choices">Your Privacy Choices</a> page, also linked at the bottom of every page. Once you opt out, the Meta pixel is not loaded in that browser. We also automatically treat a <strong>Global Privacy Control</strong> signal from your browser as an opt-out. Opting out does not affect your cart, account or orders.</p>
<p>Meta uses this information under its own privacy policy. You can also manage ad preferences in your Facebook and Instagram settings.</p>'),

  -- 8. Rights list
  '<li><strong>Opt out of marketing</strong> — unsubscribe at any time</li>',
  '<li><strong>Opt out of marketing</strong> — unsubscribe at any time</li>
<li><strong>Opt out of sharing</strong> — on our <a href="/privacy-choices">Your Privacy Choices</a> page, or with Global Privacy Control</li>')

WHERE slug = 'privacy-policy';

-- ── Verification — every column must be 1, and old_claim must be 0 ──
SELECT slug,
       content LIKE '%Effective October 30, 2026%'              AS date_updated,
       content LIKE '%advertising partners such as Meta%'       AS short_version,
       content LIKE '%processed by Stripe.%'                    AS stripe_text,
       content LIKE '%<strong>Stripe</strong></td>%'            AS stripe_row,
       content LIKE '%Meta Platforms%'                          AS meta_row,
       content NOT LIKE '%our cookie banner%'                   AS no_banner_claim,
       content LIKE '%Advertising and Your Opt-Out%'            AS ad_section,
       content LIKE '%Opt out of sharing</strong>%'             AS rights_item,
       content LIKE '%not share it for cross-context%'          AS old_claim
FROM pages WHERE slug = 'privacy-policy';
