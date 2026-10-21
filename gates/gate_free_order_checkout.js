'use strict';
/**
 * gate_free_order_checkout.js — the $0.00 checkout must be completable.
 *
 * ⚠️ WHY THIS EXISTS. On 2026-10-20 the owner tried to order two free
 * samples and the Place Order button did nothing. The free-sample funnel
 * had been unfinishable since it shipped, and NOTHING caught it — no gate
 * covered this branch, and the bug is invisible to anyone testing a paid
 * order.
 *
 * TWO SEPARATE DEFECTS, one page:
 *
 * 1. THE BUTTON WAS DISABLED FOREVER. The markup renders
 *        <button id="payBtn" ... disabled>
 *    deliberately: on the Stripe path it must stay dead until Stripe
 *    reports the card and billing details are complete, which happens in
 *        payBtn.disabled = !session.canConfirm;
 *    inside the Stripe change handler. The free branch loads no Stripe, so
 *    that line never ran and nothing else cleared the attribute. A disabled
 *    button emits no click events, so the handler never fired.
 *
 * 2. THE SUMMARY SHOWED THE PRE-FREEBIE TOTAL. paymentPage passes two
 *    different numbers — `cart.subtotal` (the raw session cart, which knows
 *    nothing about sample eligibility) and `subtotal` (buyerTotal(), which
 *    prices the freebie). Both summary rows read the raw one, so the page
 *    said "Total $19.98" directly under a panel saying "your order comes to
 *    $0.00, no card required".
 *
 * WHAT THIS GATE WILL NOT DO. It renders the template; it does not run the
 * browser. It cannot prove a click reaches the server. What it CAN prove is
 * the exact precondition that was false for weeks: that on a free order the
 * button is not left disabled, and the figure shown is the one that will be
 * charged. Rule 14 — a gate asserts what it can actually observe, and says
 * what it cannot.
 */

const path = require('path');
const fs   = require('fs');
const ejs  = require('ejs');

const ROOT = path.join(__dirname, '..');
const TPL  = path.join(ROOT, 'views/pages/checkout-payment.ejs');
const src  = fs.readFileSync(TPL, 'utf8');

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

/* A cart of two $9.99 samples — the owner's exact case. */
const BASE = {
  pageTitle: '', metaDesc: '', noindex: true,
  cspNonce: 'n', csrfToken: 'tok',
  stripePublishableKey: 'pk_test_x',
  deliveryLocation: require('../src/utils/deliveryLocation'),
  order: {
    id: 1, ship_name: 'A', ship_address1: '1 X', ship_city: 'Y',
    ship_state: 'GA', ship_zip: '30075', ship_phone: '555',
    ship_phone_ext: null, guest_email: 'a@b.c',
    ship_address_type: 'residential', delivery_terms_ack_at: new Date(),
  },
  cart: {
    count: 2, subtotal: 19.98,
    items: [
      { name: 'Wood Sample - Carbon Oak',      price: 9.99, qty: 1, image: null },
      { name: 'Wood Sample - Whitewashed Oak', price: 9.99, qty: 1, image: null },
    ],
  },
};
const render = (o) =>
  ejs.render(src, Object.assign({}, BASE, o), { filename: TPL });

console.log('\n--- a $0.00 order must be completable ---');
const free = render({ isFreeOrder: true, subtotal: 0 });

/* ⚠️⚠️ THIS IS A POSITIONAL TEST, AND THE FIRST VERSION OF IT WAS USELESS.
   It read simply

       /payBtn\.disabled = false;/.test(free)

   which passes on the BROKEN code, because the branch's own fail() helper
   re-enables the button after an error:

       function fail(msg) { ...; payBtn.disabled = false; ... }

   That occurrence is unreachable until a request has already been made —
   it cannot un-stick a button that was never clickable. The mutation
   harness removed the real fix and this gate stayed green. A gate that
   cannot fail on the exact defect it was written for is worse than none,
   because it certifies the bug.

   So the assertion is about POSITION, not presence: the enable must come
   before fail() is even defined, i.e. it runs at top level on page load.
   Rule 17 — scope the check to the thing under test. */
const enableIdx = free.indexOf('payBtn.disabled = false;');
const failIdx   = free.indexOf('function fail(msg)');
const bindIdx   = free.indexOf("payBtn.addEventListener('click'");

ok('the free branch enables the button at TOP LEVEL, not only inside fail()',
   enableIdx > -1 && failIdx > -1 && enableIdx < failIdx,
   enableIdx === -1
     ? 'the button ships disabled and nothing re-enables it — Place Order is dead'
     : 'the only enable is inside fail(), which cannot run until a click that can never happen');

ok('and it does so BEFORE the click handler is bound',
   enableIdx > -1 && bindIdx > -1 && enableIdx < bindIdx,
   'enabling after the bind still leaves the first click dead');

ok('Place Order posts to /checkout/free-order',
   /fetch\('\/checkout\/free-order'/.test(free), 'no completion endpoint wired');

ok('no Stripe is loaded for a free order',
   !/js\.stripe\.com/.test(free),
   'Stripe cannot create a zero-amount session; loading it is what produced the empty grey boxes');

console.log('\n--- and it must show the figure it will actually charge ---');
ok('Total reads $0.00, not the pre-freebie subtotal',
   /id="sum-total">\$0\.00</.test(free),
   (free.match(/id="sum-total">([^<]*)/) || [])[1]);

ok('the freebie is shown as a line, not silently applied',
   /Free samples/.test(free), 'the buyer cannot see why the total dropped');

ok('the no-card panel and the total agree',
   /nothing to pay and no card required/.test(free) && /id="sum-total">\$0\.00</.test(free),
   'the page contradicted itself at the moment of commitment');

console.log('\n--- and it must not imply a card is involved ---');
/* ⚠️ Owner, 2026-10-20: the Stripe line under the button "is just confusing
   to someone who is being told that the samples are free and that there are
   no strings attached." It is also simply FALSE on this branch — no card is
   collected, Stripe is not loaded, nothing is authorized. The offer's whole
   promise is no-strings, and the last click is exactly where a reader looks
   for the catch. */
ok('no "your card is authorized now" under the button',
   !/card is authorized now/.test(free),
   'this describes something that does not happen on a $0.00 order');

ok('no Stripe processing claim at all on a free order',
   !/processed securely by Stripe/.test(free),
   'Stripe is not in this flow; saying so invites "so why do they need my card?"');

ok('card-brand logos are not shown',
   !/aria-label="Visa"/.test(free) && !/aria-label="Mastercard"/.test(free),
   'a list of ways to pay when there is nothing to pay');

ok('it says plainly that nothing is owed later either',
   /not now, not later/.test(free),
   'the no-strings promise has to be stated where the catch would be');

/* The non-card reassurance stays — none of it implies a charge. */
ok('the SSL / returns / shipping trust row is kept',
   /256-bit SSL/.test(free) && /Free Shipping/.test(free),
   'removing all reassurance is the opposite failure');

console.log('\n--- the Stripe path must be untouched ---');
const paid = render({ isFreeOrder: false, subtotal: 19.98 });

ok('the Stripe readiness gate is intact',
   /payBtn\.disabled = !session\.canConfirm;/.test(paid),
   'the paid button must stay dead until Stripe says the card is complete');

ok('the free-branch unconditional enable cannot reach the paid path',
   !/THE BUTTON SHIPS DISABLED/.test(paid),
   'a paid order would become confirmable with no card entered');

ok('the paid button still ships disabled in the markup',
   /id="payBtn"[^>]*disabled/.test(paid), 'it would be live before Stripe is ready');

ok('no "Free samples" row leaks onto a paid order',
   !/Free samples/.test(paid), 'a paid buyer would see a discount that does not exist');

ok('the Stripe reassurance is KEPT on a paid order',
   /processed securely by Stripe/.test(paid) && /card is authorized now/.test(paid),
   'a real card payment must still say how it is handled — this is the line that belongs there');

ok('card-brand logos are KEPT on a paid order',
   /aria-label="Visa"/.test(paid) && /aria-label="Mastercard"/.test(paid),
   'the buyer needs to know which cards are accepted');

ok('the free-order copy does not leak onto a paid order',
   !/not now, not later/.test(paid), 'telling a paying buyer nothing is owed would be a lie');

ok('Stripe IS loaded on the paid path',
   /js\.stripe\.com/.test(paid), 'nobody could pay');

ok('billing and payment elements still render',
   /billing-address-element/.test(paid) && /payment-element/.test(paid), '');

/* ⚠️ The paid Total is deliberately still cart.subtotal: the Stripe JS
   rewrites #sum-total from Stripe's own session totals once an address
   exists, and whether those are already net of a freebie is a SEPARATE
   open question. A mixed cart (a vanity plus two samples) may well show
   the same class of defect on the paid path. Not fixed, not assumed
   fixed — asserted as unchanged so the question stays visible. */
ok('paid Total still renders from cart.subtotal (unchanged, see note)',
   /id="sum-total">\$19\.98</.test(paid), '');

/* ═══ THE SUCCESS PAGE ══════════════════════════════════════════════════
   The owner saw this live on the first free order that ever completed: the
   confirmation promised a card hold, "your vanity" and a curbside delivery
   appointment — for two wood swatches, with no card collected. */
console.log('\n--- the confirmation page must describe what happened ---');

const STPL = path.join(ROOT, 'views/pages/checkout-success.ejs');
const ssrc = fs.readFileSync(STPL, 'utf8');
const SBASE = {
  pageTitle: '', metaDesc: '', noindex: true, cspNonce: 'n', csrfToken: 't',
  email: 'a@b.c', firstName: 'Sam', orderNumber: 'BVO-1001',
  emailVerified: true, settings: { global: { contact_email: 'info@x.com' } },
};
const srender = (o) => ejs.render(ssrc, Object.assign({}, SBASE, o), { filename: STPL });

const sfree = srender({ subtotal: 0, isFreeOrder: true });
ok('no card-hold promise on a free order',
   !/card is authorised/i.test(sfree),
   'no card was collected — this sentence is untrue, not merely redundant');
ok('does not call the samples a vanity',
   !/your\s+vanity/i.test(sfree), 'they ordered swatches');
ok('does not promise a curbside delivery appointment',
   !/curbside/i.test(sfree), 'samples go by post; nobody will call');
ok('says plainly that nothing was charged',
   /Nothing to pay/i.test(sfree) && /No card\s+was charged/i.test(sfree), '');

const spaid = srender({ subtotal: 2794, isFreeOrder: false });
ok('the paid confirmation is unchanged',
   /card is authorised, not yet charged/i.test(spaid)
   && /your\s+vanity is confirmed/i.test(spaid)
   && /curbside delivery appointment/i.test(spaid),
   'the paid path still needs to explain the hold');
ok('the free copy does not leak onto a paid order',
   !/Nothing to pay/i.test(spaid), 'a paying buyer must not be told nothing is owed');

/* ⚠️ completeFreeOrder did not set req.session.lastOrder at all — the paid
   path writes it from the Stripe session, this one only redirected. So
   success() read `{}` and rendered with no order number and total 0, or
   worse inherited the STALE values of a previous paid order. The flag is
   carried explicitly because an empty lastOrder also yields total 0. */
const ctrl = fs.readFileSync(path.join(ROOT, 'src/controllers/checkoutController.js'), 'utf8');
ok('completeFreeOrder populates req.session.lastOrder',
   /req\.session\.lastOrder = \{[\s\S]{0,400}free:\s*true/.test(ctrl),
   'the success page would read {} or a previous order’s details');
ok('success() derives the flag from that, not from a zero total',
   /isFreeOrder: !!order\.free/.test(ctrl),
   'total === 0 also means "we lost the order details" — the two must not be confused');

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nall free-order checkout gates pass');
process.exit(fail ? 1 : 0);
