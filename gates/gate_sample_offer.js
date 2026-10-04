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

  console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
  process.exit(fail ? 1 : 0);
}
