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
  const _helpers = (idx.match(/const _ALLOWED_TAGS[\s\S]*?\n\}/) || [''])[0]
                 + '\n'
                 + (idx.match(/function _cssColor\(v\)[\s\S]*?\n\}/) || [''])[0];
  ok('the real view helpers were found for the render harness',
     /_ALLOWED_TAGS/.test(_helpers) && /_cssColor/.test(_helpers),
     'the harness would be testing stubs, not shipped code');
  const renderBanner = sb => ejs.render(
    '<% ' + _helpers + ' %>' + blockSrc,
    { sectionKey: 'sample_banner', sb_: sb, sampleOffer: SAMPLE });
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
     /class="section"/.test(full) && !/iwt-section/.test(full),
     'iwt-section has no horizontal padding and is a 2-column grid');
  ok('and it does NOT use the 2-column grid when there is no image',
     !/iwt-grid/.test(full), 'the text would sit in the narrow 40% column');
  ok('with an image it DOES use the grid, still inside .section',
     /iwt-grid/.test(withImg) && /class="section"/.test(withImg), 'padding would be lost');

  const alignOf = a => {
    const h = renderBanner(Object.assign({}, SB_FIXTURE, { text_align: a }));
    return (h.match(/<div class="section-header" style="([^"]*)"/) || [])[1] || '';
  };
  ['left', 'center', 'right'].forEach(a =>
    ok(`text_align ${a} is applied`, alignOf(a).indexOf('text-align:' + a) > -1, alignOf(a)));
  ok('left pins the block left',  /margin-right:auto/.test(alignOf('left'))
                                  && !/margin-left:auto/.test(alignOf('left')), alignOf('left'));
  ok('right pins the block right', /margin-left:auto/.test(alignOf('right'))
                                  && !/margin-right:auto/.test(alignOf('right')), alignOf('right'));
  ok('an invalid alignment falls back to center',
     alignOf('../../etc').indexOf('text-align:center') > -1, alignOf('../../etc'));

  /* The colour attribute is written with the RAW tag, so the value must
     be validated or it is attribute injection. */
  const styleOf = v => {
    const h = renderBanner(Object.assign({}, SB_FIXTURE, { bg_color: v }));
    return (h.match(/<section[^>]*style="([^"]*)"/) || [])[1] || '';
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
