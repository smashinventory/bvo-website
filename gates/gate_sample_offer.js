'use strict';
/* Gates for the free-sample offer: 2 free, once per email AND address.
 *
 * gate_cart_pricing already proves the DISCOUNT reaches the charge. This
 * file covers the half that decides WHO gets it, and the sequencing that
 * keeps the cart, the stored order and the card showing one number.
 *
 * ⚠️ THE SEQUENCING IS THE FRAGILE PART, not the arithmetic:
 *
 *   saveInfo       decide eligibility -> price order_items + subtotal
 *   createSession  RECOMPUTE from the stored order -> Stripe agrees
 *   webhook        only NOW record the redemption
 *
 * Recording at saveInfo is the obvious thing to do and is wrong twice:
 * createSession would find the redemption already written, price the
 * samples at full value, and bill a card for a figure the buyer never
 * saw; and an abandoned checkout would burn someone's one-time offer.
 * Several assertions below exist solely to pin that order down.
 */

const fs     = require('fs');
const ejs    = require('ejs');
const path   = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SAMPLE = require(path.join(ROOT, 'src/config/sampleOffer'));

console.log('--- THE $0 ORDER PATH ---');
/* ⚠️ THE BUG THIS REPLACED. Two free samples is a $0.00 order;
   buildLineItems correctly drops fully-free lines, so Stripe was handed
   ZERO line items and refused the session - leaving the Payment Element
   and the Billing Address Element as empty grey boxes under "We could
   not reach our payment provider". Nobody could get samples.

   A $0 order now takes no card. These assertions pair the switch to the
   path: the offer may only be ON while a route exists that can complete
   a $0 order, and that route must verify the total itself. */
const stripeSvc0 = require(path.join(ROOT, 'src/services/stripeService'));
const allFree = [
  { product_id: 1, name: 'Sample A', price: 9.99, qty: 1, is_sample: true },
  { product_id: 2, name: 'Sample B', price: 9.99, qty: 1, is_sample: true },
];
const zeroItems = stripeSvc0._internals.buildLineItems(allFree, { sampleEligible: true }).length === 0;
ok('an all-free cart still yields zero Stripe line items',
   zeroItems, 'if this changed, the reasoning below needs revisiting');

const ccFree = strip(fs.readFileSync(path.join(ROOT, 'src/controllers/checkoutController.js'), 'utf8'));
const routes = fs.readFileSync(path.join(ROOT, 'src/routes/checkout.js'), 'utf8');
ok('a $0 completion handler exists',
   /exports\.completeFreeOrder\s*=/.test(ccFree), 'a $0 cart cannot check out');
ok('it is routed',
   /router\.post\('\/free-order'/.test(routes), 'the handler is unreachable');

/* ⚠️⚠️ THE SECURITY ASSERTION. This route places an order WITHOUT
   payment, so it is the most abusable on the site. It must recompute the
   total itself and refuse anything non-zero - never trust a flag, a
   posted total, or the cart as displayed. */
const freeFn = (ccFree.match(/exports\.completeFreeOrder[\s\S]*?\n\};/) || [''])[0];
ok('the $0 route RECOMPUTES the total server-side',
   /buyerTotal\(cart\.items, order\)/.test(freeFn), 'it would trust the client');
ok('and refuses anything that is not zero',
   /toCents\(subtotal\) !== 0/.test(freeFn),
   'a $2,000 cart could be placed without payment');
ok('it takes no total from the request',
   !/req\.body\.(total|subtotal|amount|free)/.test(freeFn), 'client-supplied total');
ok('it is idempotent on a double submit',
   /payment_status = 'draft'/.test(freeFn) && /affectedRows === 0/.test(freeFn),
   'a double click would place two orders or send two emails');
ok('it burns the offer like the webhook does',
   /SampleRedemption\.record\(/.test(freeFn), 'the offer would be unlimited');

ok('the offer may be ON because the $0 path exists',
   !SAMPLE.ENABLED || (/exports\.completeFreeOrder\s*=/.test(ccFree)
                       && /router\.post\('\/free-order'/.test(routes)),
   'THE OFFER IS ON WITH NO $0 PATH - an all-free cart cannot check out');

console.log('--- the payment page hides the card for a $0 order ---');
const payView = fs.readFileSync(path.join(ROOT, 'views/pages/checkout-payment.ejs'), 'utf8');
ok('paymentPage computes isFreeOrder from the real total',
   /isFreeOrder = pricing\.toCents\(paySubtotal\) === 0/.test(ccFree), 'not computed');
ok('the view branches on it', /locals\.isFreeOrder/.test(payView), 'not wired');
/* ⚠️ RENDERED, not compared by source position. The first version of
   this assertion compared indexOf('isFreeOrder') against
   indexOf('js.stripe.com') and failed on correct code - source order
   tells you nothing about which branch runs. Render both. */
const payFixture = free => ({
  pageTitle: 'x', metaDesc: '', noindex: true, csrfToken: 't', cspNonce: 'n',
  settings: { global: {} },
  deliveryLocation: require(path.join(ROOT, 'src/utils/deliveryLocation')),
  cart: { items: [{ product_id: 1, slug: 's', name: 'Wood Sample', price: 9.99, qty: 1, image: '' }],
          count: 1, subtotal: 9.99 },
  order: { id: 1, order_number: 'DRAFT-x', guest_email: 'a@b.com',
           ship_first_name: 'Sam', ship_last_name: 'N', ship_address1: '1 X St',
           ship_address2: null, ship_city: 'Roswell', ship_state: 'GA', ship_zip: '30075',
           ship_address_type: 'residential', delivery_terms_ack_at: '2026-10-04', total: 0 },
  stripePublishableKey: 'pk_test_x',
  subtotal: free ? 0 : 9.99, isFreeOrder: free,
});
const payFile = path.join(ROOT, 'views/pages/checkout-payment.ejs');
const payFree = ejs.render(payView, payFixture(true),  { filename: payFile });
const payPaid = ejs.render(payView, payFixture(false), { filename: payFile });
ok('FREE order: stripe.js is not loaded at all',
   !/js\.stripe\.com/.test(payFree), 'the Stripe script would load and fail');
ok('FREE order: no card or billing element',
   !/payment-element/.test(payFree) && !/billing-address-element/.test(payFree),
   'empty Stripe iframes would render');
ok('FREE order: Place Order posts to the $0 route',
   /\/checkout\/free-order/.test(payFree), 'the button would do nothing');
ok('FREE order: it says no payment is needed',
   /No payment needed/.test(payFree), 'the customer is not told why there is no card field');
ok('PAID order: stripe.js IS loaded',
   /js\.stripe\.com/.test(payPaid), 'the paid path was broken');
ok('PAID order: card and billing elements are present',
   /payment-element/.test(payPaid) && /billing-address-element/.test(payPaid), 'broken');
ok('PAID order: it does NOT post to the $0 route',
   !/\/checkout\/free-order/.test(payPaid), 'a paid order could skip payment');

console.log('--- all four displayed subtotals honour the offer ---');
/* The second bug: only the STORED order was priced with the discount, so
   every screen showed $19.98 while the order behind it was $0.00. */
ok('no page renders a bare calcTotal(cart.items)',
   !/subtotal:\s*calcTotal\(cart\.items\)[,)]/.test(ccFree)
   && !/subtotal: calcTotal\(cart\.items\),/.test(ccFree),
   'a display page still ignores the offer');
ok('a shared buyerTotal helper exists',
   /async function buyerTotal\(/.test(ccFree), 'the four totals can drift again');

console.log('--- the promotion cannot fire anywhere while it is off ---');
const ccSrc = strip(fs.readFileSync(path.join(ROOT, 'src/controllers/checkoutController.js'), 'utf8'));
ok('checkout gates eligibility on ENABLED before asking the database',
   /SAMPLE_OFFER\.ENABLED[\s\S]{0,120}?isEligible\(/.test(ccSrc),
   'the promotion could still fire');
ok('the payment step gates on it too',
   (ccSrc.match(/SAMPLE_OFFER\.ENABLED/g) || []).length >= 2,
   'only one of the two eligibility calls is gated');
const cartSrc0 = strip(fs.readFileSync(path.join(ROOT, 'src/controllers/cartController.js'), 'utf8'));
ok('the cart suppresses the promise when off',
   /!SAMPLE\.ENABLED/.test(cartSrc0),
   'the cart would still say the samples come off at checkout');
ok('the banner is hidden when off',
   /sampleOffer\.ENABLED/.test(fs.readFileSync(path.join(ROOT, 'views/pages/index.ejs'), 'utf8')),
   'the homepage would advertise an offer checkout will not honour');

console.log('--- the offer config says what the owner decided ---');
ok('FREE_COUNT is 2', SAMPLE.FREE_COUNT === 2, String(SAMPLE.FREE_COUNT));
ok('CATEGORY_ID is 10', SAMPLE.CATEGORY_ID === 10, String(SAMPLE.CATEGORY_ID));
/* The $4.99 shipping charge was dropped: BVO advertises free shipping
   everywhere, so charging it on one cart type contradicts every other
   page. Its absence is asserted so it cannot creep back as a constant.
 *
 * ⚠️ CHECKING THE EXPORT IS NOT ENOUGH. A mutation that declared
 * `const SHIPPING = 4.99` without exporting it walked straight past
 * `SAMPLE.SHIPPING === undefined` — and an unexported constant is
 * exactly how a dropped decision gets quietly re-adopted, because the
 * next edit only has to add it to module.exports. So the SOURCE is
 * checked, with comments stripped (the file legitimately discusses
 * shipping at length in its header). */
ok('there is no exported shipping constant', SAMPLE.SHIPPING === undefined,
   'a shipping charge reappeared - see the header of sampleOffer.js');
const offerSrc = strip(fs.readFileSync(path.join(ROOT, 'src/config/sampleOffer.js'), 'utf8'));
ok('and none is DECLARED in the source either',
   !/\b(const|let|var)\s+SHIPPING\b/.test(offerSrc),
   'a shipping constant was declared - unexported today, exported tomorrow');
ok('no customer-facing copy mentions a shipping charge',
   !/\$\d+\.\d\d\s*shipping/i.test(JSON.stringify(SAMPLE.COPY)),
   JSON.stringify(SAMPLE.COPY));
ok('signup_source is in the closed vocabulary',
   require(path.join(ROOT, 'src/config/signupSources')).clean(SAMPLE.SIGNUP_SOURCE)
     === SAMPLE.SIGNUP_SOURCE,
   'attribution would silently record Unknown');

console.log('--- SampleRedemption: both halves block, and it fails closed ---');
const origLoad = Module._load;
let nextRows = [];
let lastSql  = '';
let lastErr  = null;
Module._load = function (request) {
  if (request.indexOf('config/database') !== -1) {
    return { bvoPool: { query: async (sql) => {
      lastSql = sql;
      if (lastErr) throw lastErr;
      return [nextRows];
    } } };
  }
  return origLoad.apply(this, arguments);
};
const SR = require(path.join(ROOT, 'src/models/SampleRedemption'));
Module._load = origLoad;

const ADDR = { address1: '45 Oak Ave', city: 'Alpharetta', state: 'GA', zip: '30004' };

(async () => {
  nextRows = []; lastErr = null;
  let r = await SR.isEligible('a@b.com', ADDR);
  ok('nothing on file -> eligible', r.eligible === true, JSON.stringify(r));
  /* ⚠️ SQL COMMENTS STRIPPED FIRST. A mutation that disabled the address
     half by commenting it out with `--` passed this assertion, because
     the text "address_key = ?" was still present — inside the comment.
     Same class of bug as a JS gate matching its own prose. */
  const sqlCode = lastSql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok('the query tests BOTH email and address_key',
     /email\s*=\s*\?/.test(sqlCode) && /address_key\s*=\s*\?/.test(sqlCode), sqlCode);
  /* And the address key is actually BOUND, not just named. Three
     placeholders go in: email, then the key twice (the IS NOT NULL
     guard and the comparison). */
  ok('the address key is bound as a parameter',
     (sqlCode.match(/\?/g) || []).length === 3,
     `${(sqlCode.match(/\?/g) || []).length} placeholders - expected 3`);

  nextRows = [{ email: 'a@b.com', address_key: 'x' }];
  r = await SR.isEligible('a@b.com', ADDR);
  ok('same EMAIL already redeemed -> blocked',
     r.eligible === false && r.reason === 'email_used', JSON.stringify(r));

  nextRows = [{ email: 'someone.else@x.com', address_key: 'x' }];
  r = await SR.isEligible('a@b.com', ADDR);
  ok('same ADDRESS, different email -> blocked',
     r.eligible === false && r.reason === 'address_used', JSON.stringify(r));

  nextRows = [];
  r = await SR.isEligible('', ADDR);
  ok('no email -> not eligible', r.eligible === false, JSON.stringify(r));

  lastErr = new Error('db down');
  r = await SR.isEligible('a@b.com', ADDR);
  ok('DATABASE ERROR -> not eligible (fails CLOSED)',
     r.eligible === false && r.reason === 'error',
     'a db blip would hand out free product');
  lastErr = null;

  const dup = new Error('dup'); dup.code = 'ER_DUP_ENTRY';
  lastErr = dup;
  const w = await SR.record({ email: 'a@b.com', address: ADDR, freeQty: 2 });
  ok('a duplicate record() is reported, not thrown',
     w.ok === false && w.duplicate === true, JSON.stringify(w));
  lastErr = null;

  ok('record() refuses with no address',
     (await SR.record({ email: 'a@b.com', address: null, freeQty: 2 })).ok === false,
     'an orphan row with no address key defeats the address half');
  ok('email is lowercased before storage',
     SR._internals.normEmail('  Sam@X.COM ') === 'sam@x.com',
     'case variants would be two redemptions');

  checkWiring();
})();

function checkWiring() {
  console.log('--- checkout wiring and SEQUENCE ---');
  const raw = fs.readFileSync(path.join(ROOT, 'src/controllers/checkoutController.js'), 'utf8');
  const code = strip(raw);
  const saveInfo = (code.match(/exports\.saveInfo[\s\S]*?\n\};/) || [''])[0];

  ok('saveInfo asks isEligible',
     /SampleRedemption\.isEligible\(/.test(saveInfo), 'eligibility never decided');
  ok('it asks with BOTH the email and the typed address',
     /isEligible\(\s*buyerEmail,\s*shipAddr\s*\)/.test(saveInfo),
     'one half of the rule is unenforced at checkout');

  /* The order matters: eligibility must be known BEFORE the subtotal is
     computed, or the stored order is priced on a stale answer. */
  const iE = saveInfo.indexOf('isEligible(');
  const iS = saveInfo.indexOf('calcTotal(cart.items');
  ok('eligibility is decided BEFORE the subtotal is computed',
     iE > -1 && iS > iE, `isEligible@${iE} subtotal@${iS}`);

  ok('the stored subtotal is priced WITH the options',
     /calcTotal\(cart\.items,\s*PRICE_OPTS\)/.test(saveInfo),
     'orders.subtotal would ignore the freebie');
  ok('order_items are priced WITH the same options',
     /priceCart\(cart\.items,\s*PRICE_OPTS\)/.test(saveInfo),
     'the line rows would disagree with the total');

  /* ⚠️ THE CENTRAL NEGATIVE ASSERTION. */
  ok('saveInfo does NOT record the redemption',
     !/SampleRedemption\.record\(/.test(saveInfo),
     'recording here makes createSession reprice and overcharge the card');

  const createSession = (code.match(/exports\.createSession[\s\S]*?\n\};/) || [''])[0];
  ok('createSession RECOMPUTES eligibility from the stored order',
     /isEligible\(\s*order\.guest_email,\s*shipAddrFromOrder\(order\)\s*\)/.test(createSession),
     'it would trust a flag instead of the order of record');
  ok('createSession passes the options to Stripe',
     /priceOpts:\s*PAY_OPTS/.test(createSession), 'the charge would ignore the freebie');
  ok('createSession refuses if the recomputed total differs from the stored one',
     /toCents\(expected\)\s*!==\s*pricing\.toCents\(order\.subtotal\)/.test(createSession),
     'a card could be charged a figure the buyer never saw');
  ok('and it refuses BEFORE calling Stripe',
     createSession.indexOf('subtotal drift') < createSession.indexOf('createCheckoutSession'),
     'the guard runs after the charge is set up');
  ok('createSession does NOT record the redemption either',
     !/SampleRedemption\.record\(/.test(createSession),
     'an abandoned checkout would burn the offer');

  const webhook = (code.match(/async function handleSessionCompleted[\s\S]*?\n\}/) || [''])[0];
  ok('the webhook DOES record the redemption',
     /SampleRedemption\.record\(/.test(webhook), 'the offer would be unlimited');
  ok('it records only when free units were actually given',
     /free_qty/.test(webhook), 'every order would consume the offer');
  ok('it reads the email and address off the ORDER, not a session',
     /guest_email/.test(webhook) && /shipAddrFromOrder\(row\)/.test(webhook),
     'a webhook has no session');
  ok('the redemption write is fire-and-forget',
     !/await\s+SampleRedemption\.record\(/.test(webhook),
     'a ledger write must not fail a paid order');

  console.log('--- stripeService passes the options through, never decides ---');
  const ss = strip(fs.readFileSync(path.join(ROOT, 'src/services/stripeService.js'), 'utf8'));
  ok('buildLineItems is given p.priceOpts',
     /buildLineItems\(p\.items,\s*p\.priceOpts\)/.test(ss), 'the charge ignores the freebie');
  ok('stripeService never asks the database who is eligible',
     !/SampleRedemption|isEligible/.test(ss),
     'two opinions about eligibility is how the cart and the card diverge');

  console.log('--- the cart page shows the offer honestly ---');
  const cc = strip(fs.readFileSync(path.join(ROOT, 'src/controllers/cartController.js'), 'utf8'));
  ok('cart index checks eligibility only for signed-in customers',
     /req\.session\.customerId/.test(cc) && /isEligible\(/.test(cc), 'not wired');
  ok('a signed-out visitor is NOT treated as eligible',
     /let sampleEligible = false/.test(cc),
     'an unverified discount would be applied to the total');

  const view = fs.readFileSync(path.join(ROOT, 'views/pages/cart.ejs'), 'utf8');
  ok("only the 'applied' state renders a discount row",
     /_ss === 'applied' && \(locals\.sampleDiscount/.test(view),
     'an unconfirmed discount could reduce the displayed total');
  ok('the total prefers sampleSubtotal over cart.subtotal',
     /sampleSubtotal != null \? sampleSubtotal : cart\.subtotal/.test(view),
     'the page would show recalc()s figure, computed without eligibility');
  ok('the unknown state promises the discount at checkout',
     /come off at checkout/.test(view), 'a signed-out visitor sees no offer at all');

  console.log('--- every CSS class used by the new markup exists ---');
  /* ⚠️ NOT just site-bundle.css. This first failed because three of the
     four classes live in site3.css, which main.ejs does NOT load
     globally — it is injected per page for performance, and cart.ejs
     links it itself on line 1. A gate that assumes one stylesheet
     reports a styling bug that does not exist, and would also miss a
     real one on any page that loads a different sheet.
     So: read the sheets THIS PAGE actually links, plus the global
     bundle, and look in the union. */
  const sheets = ['public/css/site-bundle.css'];
  (view.match(/href="\/css\/([a-z0-9.-]+\.css)/g) || []).forEach(m => {
    const f = 'public/css/' + m.replace(/.*\/css\//, '');
    if (sheets.indexOf(f) === -1) sheets.push(f);
  });
  ok('the page links site3.css, where the summary rules live',
     sheets.indexOf('public/css/site3.css') > -1,
     `sheets found: ${sheets.join(', ')}`);
  const CSS = sheets
    .filter(f => fs.existsSync(path.join(ROOT, f)))
    .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .join('\n');
  ['summary-savings', 'summary-savings--bundle', 'savings-label', 'summary-note']
    .forEach(c => ok(`.${c} exists in a sheet this page loads`,
      new RegExp('\\.' + c.replace(/-/g, '\\-') + '[\\s,{:>.]').test(CSS),
      'markup would render unstyled'));
  /* No new CSS was written for this change — the offer reuses the
     existing savings-row classes. Asserted so a future edit that adds a
     rule is forced to deal with the source-plus-bundle double edit and
     the ?v= bump rather than quietly skipping them. */
  ok('no NEW class was invented for the sample rows',
     !/sample-savings|sample-badge|sample-row/.test(view),
     'a new class needs a rule in the source AND the bundle AND a ?v= bump');

  console.log('--- the banner is registered in ALL FOUR lists ---');
  /* ⚠️ FOUR SEPARATE LISTS HAVE TO AGREE, and a key missing from any one
     of them fails SILENTLY — index.ejs's _isValidKey rejects the section
     and it simply never renders. featured_models nearly shipped
     invisible on a fresh install for exactly this reason; the comment in
     themeSettings.js records it. So each list is asserted by name. */
  const ts   = strip(fs.readFileSync(path.join(ROOT, 'src/services/themeSettings.js'), 'utf8'));
  const idx  = fs.readFileSync(path.join(ROOT, 'views/pages/index.ejs'), 'utf8');
  const thm  = fs.readFileSync(path.join(ROOT, 'views/pages/admin/theme.ejs'), 'utf8');
  /* ⚠️ themeSettings IS NOT REQUIRED HERE, for two reasons found the hard
     way. It pulls in config/database at module load and calls
     process.exit with "DB_PASS is not set in .env" when there is no live
     database — which killed this gate mid-run with a fatal that looked
     nothing like a gate failure. And DEFAULTS is not exported anyway;
     module.exports is { get, save, reload, persistToDb, initFromDb }, so
     requiring it yields nothing useful without a database to read.
 *
     So the DEFAULT order is parsed out of the source, which is exactly
     what ships to a fresh install. A gate must not need production
     credentials to run. */
  const orderSrc = (ts.match(/homepage_section_order:\s*\[([\s\S]*?)\]/) || ['', ''])[1];
  const order = (orderSrc.match(/'([a-z_0-9]+)'/g) || []).map(q => q.replace(/'/g, ''));
  ok('the default section order parsed', order.length > 5, `${order.length} keys`);
  const sbSrc = (ts.match(/sample_banner:\s*\{([\s\S]*?)\n  \},/) || ['', ''])[1];
  const sbHeading = (sbSrc.match(/heading:\s*'([^']*)'/) || ['', ''])[1];

  ok('1/4 themeSettings has a sample_banner default block',
     /sample_banner:\s*\{/.test(ts), 'no defaults - the section has no content');
  ok('2/4 it is in themeSettings homepage_section_order',
     /homepage_section_order:[\s\S]{0,400}?'sample_banner'/.test(ts), 'missing');
  ok('3/4 it is in index.ejs _DEFAULT_ORDER',
     /_DEFAULT_ORDER = \[[^\]]*'sample_banner'/.test(idx),
     '_isValidKey would reject it and the section would never render');
  ok('4/4 it is in theme.ejs _STATIC_KEYS',
     /_STATIC_KEYS = \[[^\]]*'sample_banner'/.test(thm), 'no Theme Editor panel');
  ok('and it has a Theme Editor panel + meta entry',
     /id="panel-sample_banner"/.test(thm) && /sample_banner:\s*\{\s*label:/.test(thm),
     'the panel or its label is missing');

  /* The owner asked for it under the hero. Asserted as a RELATIVE
     position, not an index, so inserting another section elsewhere does
     not fail this. */
  console.log('--- it sits under the hero ---');
  const iHero = Math.max(order.indexOf('hero'), order.indexOf('hero_mobile'));
  const iBan  = order.indexOf('sample_banner');
  ok('sample_banner comes after the hero', iBan > -1 && iBan > iHero,
     `hero@${iHero} banner@${iBan}`);
  ok('and before the vanity merchandising',
     iBan < order.indexOf('featured_section'),
     'the cheapest yes on the site should precede the $2,000 one');

  console.log('--- the FREE COUNT is not editable in the Theme Editor ---');
  /* A field saying "3 free samples" against a cart that gives 2 is a
     promise the site does not keep. Wording editable, arithmetic not. */
  ok('no free-count field in the panel',
     !/sample_banner\.(free_count|count|qty|free_qty)/.test(thm),
     'the banner could promise a number the cart does not honour');
  ok('the default heading matches FREE_COUNT',
     sbHeading.indexOf(String(SAMPLE.FREE_COUNT)) > -1,
     `heading "${sbHeading}" vs FREE_COUNT ${SAMPLE.FREE_COUNT}`);
  ok('the banner reads the count from sampleOffer when no heading is set',
     /sampleOffer\.FREE_COUNT/.test(idx), 'the fallback hardcodes a number');
  ok('homeController passes sampleOffer to the view',
     /sampleOffer:\s*require\(/.test(
       fs.readFileSync(path.join(ROOT, 'src/controllers/homeController.js'), 'utf8')),
     'sampleOffer would be undefined - a hard EJS error on the homepage');

  console.log('--- the banner markup renders, and degrades ---');
  const blockSrc = (idx.match(/<% if \(sectionKey === 'sample_banner'[\s\S]*?<% \} \/\* end sample_banner \*\/ %>/) || [''])[0];
  ok('the render block exists', !!blockSrc, 'no markup');
  /* ⚠️ THE REAL HELPERS, LIFTED OUT OF index.ejs - not stubs.
     The first version of this harness stubbed _safeTag and then broke
     when the block started calling _cssColor too. Worse, a stub means
     the gate tests ITS OWN copy of a helper rather than the one that
     ships: a broken _cssColor would sail through. Same lesson as the
     gate_saved_addresses harness that went stale against
     locals.deliveryLocation. */
  /* ⚠️ LIFT THE WHOLE HELPER REGION, not named functions one at a time.
     This harness previously named _safeTag, then had to add _cssColor,
     then broke again when the banner started calling _btnClass - three
     failures from the same cause. The region runs from _ALLOWED_TAGS to
     the end of _cssColor and covers every shared helper the section
     blocks use, so adding another does not break the gate. */
  const _hStart = idx.indexOf('const _ALLOWED_TAGS');
  const _hEndM  = idx.match(/function _cssColor\(v\)[\s\S]*?\n\}/);
  const _helpers = (_hStart > -1 && _hEndM)
    ? idx.slice(_hStart, idx.indexOf(_hEndM[0]) + _hEndM[0].length)
    : '';
  ok('the real view helpers were found for the render harness',
     /_ALLOWED_TAGS/.test(_helpers) && /_cssColor/.test(_helpers)
     && /_btnClass/.test(_helpers),
     'the harness would be testing stubs, not shipped code');
  /* ⚠️ ENABLED IS FORCED TRUE FOR THESE RENDERS, and only for them.
     The block is now gated on sampleOffer.ENABLED, which ships false
     while the $0 checkout path is missing - so rendering with the real
     config produces an empty string and every layout assertion below
     would "pass" by testing nothing. The kill switch is asserted
     separately at the top of this file, against the real config. These
     assertions are about the MARKUP, which must stay correct so the
     offer can be switched back on without re-finding the layout bugs. */
  const SAMPLE_ON = Object.assign({}, SAMPLE, { ENABLED: true });
  const renderBanner = sb => ejs.render(
    '<% ' + _helpers + ' %>' + blockSrc,
    { sectionKey: 'sample_banner', sb_: sb, sampleOffer: SAMPLE_ON });
  const SB_FIXTURE = {
    enabled: true, heading_level: 'p',
    eyebrow: 'See it in your own light', heading: sbHeading,
    subtitle: 'x', cta_text: 'Browse samples', cta_url: '/collections/samples', image: '',
  };
  const full = renderBanner(SB_FIXTURE);
  ok('it renders the CTA to the samples collection',
     /href="\/collections\/samples"/.test(full), full.slice(0, 200));
  ok('it renders the heading', /id="sb-heading"/.test(full), 'no heading');
  /* The CLS lesson from the hero and iwt sections: an empty image box
     reserves space for nothing and shifts everything below it. */
  ok('NO image column when no image is set',
     !/iwt-image-col/.test(full), 'an empty image box would shift the page');
  const withImg = renderBanner(Object.assign({}, SB_FIXTURE,
    { image: 'https://images.bathroomvanitiesoutlet.com/x.webp' }));
  ok('an image column appears when one IS set',
     /iwt-image-col/.test(withImg) && /loading="lazy"/.test(withImg), 'image not rendered lazily');
  ok('enabled:false renders nothing',
     renderBanner({ enabled: false }).trim() === '', 'the toggle does not work');

  console.log('--- alignment and colour controls ---');
  /* The first version of this banner reused .iwt-section, which is
     padding:5rem 0 (NO horizontal padding) inside a 40fr/60fr grid. With
     no image the text landed in the narrow column AND ran flush to the
     viewport edge. Asserted so it cannot be reintroduced. */
  ok('the no-image banner uses .section, not .iwt-section',
     /class="section sb-banner"/.test(full) && !/iwt-section/.test(full),
     'iwt-section has no horizontal padding and is a 2-column grid');
  ok('and it does NOT use the 2-column grid when there is no image',
     !/iwt-grid/.test(full), 'the text would sit in the narrow 40% column');
  ok('with an image it DOES use the grid, still inside .section',
     /iwt-grid/.test(withImg) && /class="section sb-banner"/.test(withImg), 'padding would be lost');

  /* ⚠️⚠️⚠️ THE ALIGNMENT IS CARRIED AS CUSTOM PROPERTIES AND READ ONLY
     ABOVE 861px. Everything below is about one fact: an INLINE style
     declaration cannot be overridden by a media query. Inline beats every
     stylesheet rule regardless of specificity; the only escape hatch is
     !important. So as long as the alignment was written inline on each
     element, mobile was stuck with the desktop choice - and mobile has to
     centre, because below 861px .iwt-grid collapses to one column and the
     two-column layout the control describes no longer exists. Honouring
     "left" there gave a left-pinned image above left-pinned text.

     A custom property fixes this because the VALUE is inline but the
     DECISION ABOUT WHERE IT APPLIES moves back into the stylesheet. The
     three assertions below are therefore: the variables are emitted, no
     element carries an inline alignment any more, and the stylesheet
     confines them to the desktop query while the mobile base centres.

     The earlier history is still worth knowing, because the variable
     values encode it: .iwt-text-col is display:flex; flex-direction:
     column, so align-items is the HORIZONTAL axis and text-align alone
     did nothing - two attempts failed that way. Hence --sb-items carries
     flex-start/center/flex-end, not the text keyword. */
  const varsOf = a => {
    const h = renderBanner(Object.assign({}, SB_FIXTURE, { text_align: a }));
    return (h.match(/<section[^>]*style="([^"]*)"/) || [])[1] || '';
  };
  [['left', 'flex-start', '0', 'auto'],
   ['center', 'center', 'auto', 'auto'],
   ['right', 'flex-end', 'auto', '0']].forEach(([a, items, ml, mr]) => {
    const v = varsOf(a);
    ok(`${a} emits --sb-items:${items}`, v.indexOf('--sb-items:' + items + ';') > -1, v);
    ok(`${a} emits --sb-text:${a}`,      v.indexOf('--sb-text:' + a + ';') > -1, v);
    ok(`${a} emits --sb-ml:${ml} --sb-mr:${mr}`,
       v.indexOf('--sb-ml:' + ml + ';') > -1 && v.indexOf('--sb-mr:' + mr + ';') > -1, v);
  });
  ok('an invalid alignment falls back to center',
     varsOf('../../etc').indexOf('--sb-items:center;') > -1, varsOf('../../etc'));

  /* If any of these grows an inline style again, mobile silently stops
     centring - and nothing else would catch it. */
  ['iwt-text-col', 'section-sub', 'section-header'].forEach(c => {
    const withImgAligned = renderBanner(Object.assign({}, SB_FIXTURE,
      { text_align: 'left', image: 'https://images.bathroomvanitiesoutlet.com/x.webp' }));
    const both = full + withImgAligned;
    ok(`.${c} carries NO inline style`,
       !new RegExp('class="[^"]*' + c + '[^"]*" style=').test(both),
       'an inline style here cannot be overridden by the mobile media query');
  });

  /* The rendered markup is only half the contract - the stylesheet is the
     other half, and the bundle is what browsers actually load. */
  const sbCss = fs.readFileSync(path.join(ROOT, 'public/css/site-bundle.css'), 'utf8');
  ok('the mobile base centres .sb-banner .iwt-text-col',
     /\.sb-banner \.iwt-text-col\{align-items:center;text-align:center\}/.test(sbCss),
     'mobile would inherit the desktop alignment');
  ok('the mobile base centres the image column too',
     /\.sb-banner \.iwt-image-col\{justify-content:center\}/.test(sbCss),
     'the image would stay pinned left above centred text');
  ok('the variables are read ONLY inside a min-width query',
     /@media \(min-width:861px\)\{[\s\S]{0,600}--sb-items/.test(sbCss),
     'if the var() rules sit outside the query, mobile follows the desktop choice');
  ok('every var() has a centred fallback',
     (sbCss.match(/var\(--sb-items,center\)/g) || []).length >= 2
     && /var\(--sb-ml,auto\)/.test(sbCss) && /var\(--sb-mr,auto\)/.test(sbCss),
     'a page rendered without the variables would lose its layout entirely');

  /* The colour attribute is written with the RAW tag, so the value must
     be validated or it is attribute injection. The --sb-* variables now
     share that attribute, so they are stripped before the comparison -
     they are generated from a validated whitelist, not from user text. */
  const styleOf = v => {
    const h = renderBanner(Object.assign({}, SB_FIXTURE, { bg_color: v }));
    return ((h.match(/<section[^>]*style="([^"]*)"/) || [])[1] || '')
      .replace(/--sb-[a-z]+:[^;]*;/g, '');
  };
  ok('a valid colour is applied', styleOf('#ffffff') === 'background:#ffffff;', styleOf('#ffffff'));
  [['" onload="alert(1)', 'quote break-out'],
   ['red;background:url(javascript:alert(1))', 'url() payload'],
   ['</style><script>alert(1)</script>', 'tag injection'],
   ['expression(alert(1))', 'IE expression']]
    .forEach(([v, label]) => ok(`injection rejected: ${label}`, styleOf(v) === '', styleOf(v)));

  console.log('--- the banner reuses existing CSS, adds none ---');
  const bundleCss = fs.readFileSync(path.join(ROOT, 'public/css/site-bundle.css'), 'utf8');
  const bannerClasses = new Set();
  (blockSrc.match(/class="([^"<%]+)"/g) || []).forEach(m =>
    m.replace(/class="|"/g, '').split(/\s+/).filter(Boolean).forEach(c => bannerClasses.add(c)));
  bannerClasses.forEach(c => ok(`.${c} already exists in site-bundle.css`,
    new RegExp('\\.' + c.replace(/-/g, '\\-') + '[\\s,{:>.]').test(bundleCss),
    'a NEW class needs the source AND the bundle AND a ?v= bump'));

  console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
  process.exit(fail ? 1 : 0);
}
