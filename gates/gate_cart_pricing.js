'use strict';
/* Gate for src/utils/cartPricing.js.
 *
 * PART 1 is the one that matters most: the extraction must be a NO-OP for
 * every cart that can exist today. The three formulas it replaced are
 * reimplemented here verbatim from the pre-2026-10-04 source, and a
 * matrix of cart shapes is run through both. Any disagreement in CENTS
 * is a failure. Without this, "I only centralised it" is a claim rather
 * than a fact — and the thing being centralised is what charges cards.
 *
 * PART 2 asserts the free-sample rule, including the cases that give
 * money away: qty on one line, more samples than the free allowance,
 * ineligible customers, and non-samples never being free.
 *
 * PART 3 asserts all three call sites actually delegate, because a
 * promotion that reaches the cart page but not Stripe is the specific
 * bug this whole structure exists to prevent.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

const P = require(path.join(ROOT, 'src/utils/cartPricing'));
const SAMPLE = require(path.join(ROOT, 'src/config/sampleOffer'));

/* ── The three ORIGINAL formulas, copied verbatim from the pre-extraction
      source. Do NOT "tidy" these to call the new module: their whole
      purpose is to be an independent witness. ───────────────────────── */
function OLD_recalc(items) {                    // cartController.recalc
  const raw = items.reduce((s, i) => {
    const disc      = parseFloat(i.bundle_discount_pct) || 0;
    const unitPrice = (parseFloat(i.price) || 0) * (1 - disc / 100);
    return s + i.qty * unitPrice;
  }, 0);
  return parseFloat(raw.toFixed(2));
}
function OLD_calcTotal(items) {                 // checkoutController.calcTotal
  return items.reduce((sum, i) => {
    const disc  = parseFloat(i.bundle_discount_pct) || 0;
    const price = parseFloat(i.price || 0) * (1 - disc / 100);
    return sum + price * (i.qty || 1);
  }, 0);
}
function OLD_stripeCents(items) {               // stripeService.buildLineItems
  return items.map(it => {
    const disc = parseFloat(it.bundle_discount_pct) || 0;
    const unit = parseFloat(it.price || 0) * (1 - disc / 100);
    return Math.round(unit * 100) * (it.qty || 1);
  }).reduce((a, b) => a + b, 0);
}

console.log('--- PART 1: the extraction is a no-op on existing carts ---');
/* Prices chosen for float trouble, not for realism: 16.49 and 0.07 are
   the classic *100 rounding traps, and 1299.99 with 15% off lands on a
   half-cent. A matrix of round numbers would pass while broken. */
const PRICES  = [0, 0.07, 9.99, 16.49, 129.95, 1299.99, 2499.5];
const DISCS   = [0, 5, 10, 15];
const QTYS    = [1, 2, 3, 99];
const carts = [];
PRICES.forEach(p => DISCS.forEach(d => QTYS.forEach(q => {
  carts.push([{ product_id: 1, price: p, bundle_discount_pct: d, qty: q }]);
})));
/* Multi-line, mixed-discount: a real bundle plus a loose item. */
carts.push([
  { product_id: 1, price: 1299.99, bundle_discount_pct: 15, qty: 1, bundle_id: 'b1' },
  { product_id: 2, price: 449.0,   bundle_discount_pct: 15, qty: 1, bundle_id: 'b1' },
  { product_id: 3, price: 89.99,   bundle_discount_pct: 0,  qty: 2 },
]);
/* The poisoned shapes that really occurred. */
carts.push([{ product_id: 4, price: null,        bundle_discount_pct: 0, qty: 1 }]);
carts.push([{ product_id: 5, price: undefined,   bundle_discount_pct: 0, qty: 1 }]);
carts.push([{ product_id: 6, price: 'oops',      bundle_discount_pct: 0, qty: 1 }]);
carts.push([{ product_id: 7, price: 99,          bundle_discount_pct: 0 /* no qty */ }]);
carts.push([]);

/* ⚠️ THE THREE OLD FORMULAS DID NOT AGREE WITH EACH OTHER, and finding
   that out is what this part of the gate was for.
 *
 *   recalc / calcTotal:  round the LINE TOTAL once  -> unit * qty, then 2dp
 *   stripe:              round the UNIT, then * qty -> what Stripe charges
 *
 * On any line whose discounted unit price lands on a half cent, those
 * differ. Across realistic BVO prices with the 5/10/15% bundle tiers and
 * qty 2-4, ~60k combinations disagree by up to 2c, and in roughly 70% of
 * them THE CARD WAS CHARGED MORE THAN THE CART DISPLAYED. It is reachable
 * in production: the bundle builder carries mirror_qty and faucet_qty, so
 * a discounted line with qty > 1 is an ordinary state.
 *
 * cartPricing resolves it by matching STRIPE, because Stripe's number is
 * the money. The consequence is deliberate: the cart page and
 * orders.subtotal may now differ from their old value by a cent or two
 * on such a line, and in exchange the figure shown is the figure charged.
 *
 * So the assertion is NOT "identical to all three". It is:
 *   - EXACTLY equal to the charge (stripe), always; and
 *   - within 2c of the old display, never further. */
/* ⚠️ SECOND FINDING: on poisoned cart shapes the OLD formulas returned
   NaN, not a wrong number.
 *
 *   price: 'oops'      -> OLD stripe sent unit_amount: NaN to Stripe
 *   a line with no qty -> OLD recalc returned NaN as the cart subtotal
 *
 * Both shapes really occurred — an old FormData bug wrote items with
 * null prices into live sessions, which is why cartController still
 * self-heals them. Bug-for-bug equality with NaN is not a goal, so those
 * shapes are compared separately: the new module must return a finite,
 * sane number, and the old one is recorded here as broken rather than
 * quietly matched. */
const finite = v => Number.isFinite(v);
const sane = c => finite(OLD_recalc(c)) && finite(OLD_calcTotal(c)) && finite(OLD_stripeCents(c));
const saneCarts = carts.filter(sane);
const junkCarts = carts.filter(c => !sane(c));

let chargeMismatch = null;
let driftBreach    = null;
saneCarts.forEach((c) => {
  /* sampleEligible omitted -> defaults false. No cart that exists today
     has is_sample set, so the promotion must not engage here. */
  const a = P.toCents(P.priceCart(c).subtotal);
  if (a !== OLD_stripeCents(c) && !chargeMismatch) {
    chargeMismatch = { c, a, b: OLD_stripeCents(c) };
  }
  /* ⚠️ THE BOUND IS PER UNIT, NOT A FLAT CEILING, and getting that wrong
     is what first failed this assertion at 50c.
     Rounding the unit can move it by at most half a cent, and Stripe
     bills unit_amount * quantity — so the gap against a formula that
     rounded the line total once grows with qty. A line of 99 legitimately
     diverges by ~50c. Allowing 1c per unit is the real invariant;
     anything beyond it is not rounding and must fail. */
  const budget = P.itemCount(c);
  const worst  = Math.max(Math.abs(a - P.toCents(OLD_recalc(c))),
                          Math.abs(a - P.toCents(OLD_calcTotal(c))));
  if (worst > budget && !driftBreach) driftBreach = { c, worst, budget };
});
ok(`${junkCarts.length} poisoned shape(s) made the OLD code produce NaN`,
   junkCarts.length > 0, 'the junk fixtures stopped being junk - check them');
ok('every poisoned shape now prices finite and non-negative',
   junkCarts.every(c => {
     const v = P.priceCart(c).subtotal;
     return Number.isFinite(v) && v >= 0;
   }), 'NaN or negative survived');
ok(`all ${carts.length} cart shapes charge EXACTLY what Stripe charged before`,
   !chargeMismatch,
   chargeMismatch ? `new ${chargeMismatch.a}c vs charged ${chargeMismatch.b}c on ${JSON.stringify(chargeMismatch.c)}` : '');
ok('the display moves by at most 1c PER UNIT vs the old display formula',
   !driftBreach,
   driftBreach ? `drifted ${driftBreach.worst}c on ${driftBreach.budget} unit(s) - not rounding` : '');
ok('and it moves TOWARDS the charged figure, never away',
   !chargeMismatch, 'display and charge still disagree');
ok('no cart in the matrix produced NaN',
   carts.every(c => Number.isFinite(P.priceCart(c).subtotal)), 'NaN leaked');
ok('an empty cart is 0.00', P.priceCart([]).subtotal === 0, 'non-zero');

console.log('--- PART 2: the free-sample rule ---');
const S = (price, qty) => ({ product_id: 90, price, qty, is_sample: true, bundle_discount_pct: 0 });
const V = (price, qty) => ({ product_id: 10, price, qty, is_sample: false, bundle_discount_pct: 0 });
const E = { sampleEligible: true };

ok(`FREE_COUNT is ${SAMPLE.FREE_COUNT} and the rule uses it`,
   P.priceCart([S(9.99, 5)], E).freeUnits === SAMPLE.FREE_COUNT,
   String(P.priceCart([S(9.99, 5)], E).freeUnits));

let r = P.priceCart([S(9.99, 1), S(9.99, 1)], E);
ok('2 samples -> both free, subtotal 0.00', r.subtotal === 0 && r.freeUnits === 2,
   `${r.subtotal} / ${r.freeUnits}`);
ok('2 samples -> discount is 19.98', r.discount === 19.98, String(r.discount));

r = P.priceCart([S(9.99, 1), S(9.99, 1), S(9.99, 1), S(9.99, 1)], E);
ok('4 samples -> 2 free, pay 19.98', r.subtotal === 19.98, String(r.subtotal));
ok('4 samples -> only 2 free units', r.freeUnits === 2, String(r.freeUnits));

/* Quantity on ONE line must behave like separate lines - the same basket
   must not price differently depending on how it was added. */
const asLines = P.priceCart([S(9.99,1),S(9.99,1),S(9.99,1),S(9.99,1)], E).subtotal;
const asQty   = P.priceCart([S(9.99, 4)], E).subtotal;
ok('qty 4 on one line == 4 separate lines', asLines === asQty, `${asLines} vs ${asQty}`);

r = P.priceCart([S(9.99, 1)], E);
ok('1 sample -> free, and does not go negative', r.subtotal === 0, String(r.subtotal));

r = P.priceCart([S(9.99, 2)], {});
ok('INELIGIBLE -> full price, no discount',
   r.subtotal === 19.98 && r.discount === 0, `${r.subtotal} / ${r.discount}`);
r = P.priceCart([S(9.99, 2)]);
ok('eligibility OMITTED -> full price (fails closed)',
   r.subtotal === 19.98, String(r.subtotal));

r = P.priceCart([V(1299.99, 1)], E);
ok('a vanity is never free', r.subtotal === 1299.99 && r.freeUnits === 0,
   `${r.subtotal} / ${r.freeUnits}`);
r = P.priceCart([V(1299.99, 1), S(9.99, 3)], E);
ok('mixed cart -> 2 samples free, vanity untouched',
   r.subtotal === 1309.98, String(r.subtotal));

/* The dearest units are the free ones. All samples are 9.99 today, so
   this is the assertion that keeps the rule fair if that changes. */
r = P.priceCart([S(4.99, 1), S(19.99, 1), S(9.99, 1)], E);
ok('the 2 DEAREST sample units are the free ones',
   r.subtotal === 4.99, `${r.subtotal} (expected 4.99 - the cheapest left to pay)`);

/* is_sample must not be forgeable from anything the client controls. */
ok('a truthy-but-not-true is_sample is NOT a sample',
   P.priceCart([{ product_id: 1, price: 9.99, qty: 1, is_sample: 'true' }], E).freeUnits === 0,
   'a string passed the sample test');
ok('a name containing "Sample" is NOT a sample',
   P.priceCart([{ product_id: 1, price: 9.99, qty: 1, name: 'Wood Sample - Oak' }], E).freeUnits === 0,
   'the name decided the discount');

console.log('--- PART 3: all three call sites delegate ---');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const files = {
  'cartController.js':     'src/controllers/cartController.js',
  'checkoutController.js': 'src/controllers/checkoutController.js',
  'stripeService.js':      'src/services/stripeService.js',
};
Object.entries(files).forEach(([label, rel]) => {
  const code = strip(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  ok(`${label} requires cartPricing`,
     /require\(['"][^'"]*cartPricing['"]\)/.test(code), 'not wired');
  /* THE KEY NEGATIVE ASSERTION. The old formula must be GONE, not merely
     unused — a leftover copy is what the next person will edit.
     Matches the SHAPE "something / 100" preceded by "1 -", not a
     particular variable name: a mutation using `d` instead of `disc`
     walked straight through the earlier name-based version. */
  ok(`${label} no longer computes (1 - x / 100) itself`,
     !/1\s*-\s*[^;)]{0,24}\/\s*100/.test(code),
     'a private copy of the pricing formula survives');
});

console.log('--- PART 4: the discount REACHES THE CHARGE (behavioural) ---');
/* ⚠️ PART 3 IS NOT ENOUGH ON ITS OWN. Mutation testing showed that
   dropping the options argument in stripeService left every text
   assertion green while the card was billed in full — the exact
   cart-says-free, card-says-$19.98 bug. The only way to gate that is to
   run the function. */
const stripeSvc = require(path.join(ROOT, 'src/services/stripeService'));
const BLI = stripeSvc._internals && stripeSvc._internals.buildLineItems;
ok('stripeService exposes buildLineItems for gating', typeof BLI === 'function',
   'cannot assert the charge without it');

if (typeof BLI === 'function') {
  const sampleCart = [S(9.99, 1), S(9.99, 1), S(9.99, 1)];
  const charged = li => li.reduce((s, x) => s + x.price_data.unit_amount * x.quantity, 0);

  const full = BLI(sampleCart);
  ok('ineligible -> Stripe is asked for 2997c', charged(full) === 2997, `${charged(full)}c`);

  const promo = BLI(sampleCart, { sampleEligible: true });
  ok('ELIGIBLE -> Stripe is asked for 999c, not 2997c',
     charged(promo) === 999, `${charged(promo)}c - the card is being overcharged`);

  /* The charge must equal the cart's own figure, to the cent. This is
     the invariant the whole module exists for. */
  ok('the Stripe total EQUALS the cart subtotal, to the cent',
     charged(promo) === P.toCents(P.priceCart(sampleCart, E).subtotal),
     `${charged(promo)}c charged vs ${P.toCents(P.priceCart(sampleCart, E).subtotal)}c shown`);

  const qtyCart = [S(9.99, 4)];
  ok('free units are removed from QUANTITY, not zero-priced',
     BLI(qtyCart, { sampleEligible: true }).every(l => l.quantity === 2),
     JSON.stringify(BLI(qtyCart, { sampleEligible: true }).map(l => l.quantity)));
  ok('a wholly free line drops out of the Stripe payload entirely',
     BLI([S(9.99, 2)], { sampleEligible: true }).length === 0,
     'a $0.00 line was sent to Stripe');
}

console.log('--- PART 5: is_sample is set from the DB, never the client ---');
const cartSrc = strip(fs.readFileSync(path.join(ROOT, 'src/controllers/cartController.js'), 'utf8'));
const assign = (cartSrc.match(/isSample\s*=\s*[^;]+;/) || [''])[0];
ok('isSample is assigned from the product row',
   /rows\[0\]\.category_id/.test(assign), assign || 'no assignment found');
ok('isSample is NOT assigned from the request',
   !/req\.(body|query|params)/.test(assign), assign);
ok('the category id comes from the shared config, not a literal',
   /SAMPLE\.CATEGORY_ID/.test(assign), assign);
/* The price lookup is the control this module leans on. If that comment
   and that query stop agreeing, free samples are the least of it. */
ok('the price is still read from the DB in the same query',
   /SELECT price, compare_price, category_id FROM products/.test(cartSrc),
   'the authoritative lookup changed shape');

console.log('--- PART 6: no NaN reaches a reported figure ---');
/* The earlier NaN assertion passed a mutation because toCents() rescues
   NaN by itself (NaN || 0 === 0), so a broken num() never showed up in
   the subtotal. The per-line figures are where it surfaces. */
const nanCart = [{ product_id: 1, price: 'oops', qty: 2, bundle_discount_pct: 0 }];
const nanLines = P.priceCart(nanCart).lines;
ok('line unitPrice is finite on junk input',
   nanLines.every(l => Number.isFinite(l.unitPrice)), 'NaN unitPrice');
ok('line lineTotal is finite on junk input',
   nanLines.every(l => Number.isFinite(l.lineTotal)), 'NaN lineTotal');
ok('discount is finite and never negative',
   carts.concat([nanCart]).every(c => {
     const d = P.priceCart(c, E).discount;
     return Number.isFinite(d) && d >= 0;
   }), 'NaN or negative discount');

/* ─── NOTHING WITH NO PRICE GETS INTO A CART ───────────────────────────────
 * A standing commercial control, added 2026-10-05 at the owner's request:
 * "I always add this $0 guard so that if we accidentally forget to add a
 * price and the system logs 0 that we don't get orders on it."
 *
 * Not a response to a live defect - all 6,059 active products were measured
 * clean on the day it went in. It exists for the day one is not.
 *
 * ⚠️ WHY THE CODE NEEDS IT. cartController.add does:
 *       pricef = parseFloat(rows[0].price) || 0;
 * A NULL price does not throw there, it becomes the NUMBER 0 - so an
 * unpriced product is silently free and perfectly addable. The coercion that
 * makes the rest of the handler safe is the same one that would give away
 * stock.
 */
{
  const fs2 = require('fs'), path2 = require('path');
  const cc = fs2.readFileSync(path2.join(__dirname, '..', 'src/controllers/cartController.js'), 'utf8')
    /* Comments stripped: the block above and the one in the controller both
       discuss this guard at length, so a search over raw text matches prose
       rather than code. */
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  ok('cart/add blocks a non-positive price',
     /if\s*\(\s*!Number\.isFinite\(pricef\)\s*\|\|\s*pricef\s*<=\s*0\s*\)/.test(cc),
     'an unpriced product can be ordered for nothing');

  /* The guard is worthless if it runs after the item is already in the cart. */
  const iLookup = cc.indexOf('pricef');
  const iGuard  = cc.search(/!Number\.isFinite\(pricef\)\s*\|\|\s*pricef\s*<=\s*0/);
  const iPush   = cc.indexOf('cart.items.push(');
  ok('it runs after the DB price lookup and before the item is added',
     iLookup > -1 && iGuard > iLookup && iPush > iGuard,
     'the guard is in the wrong place to stop anything');

  /* ⚠️ NO is_sample BYPASS. All 69 samples carry a real $10 price; the
     promotion discounts the two most expensive UNITS IN THE CART later, in
     this module. A sample arriving at zero is therefore itself a defect, and
     an exemption here would reopen exactly the hole the guard closes. */
  const guardBlock = cc.slice(iGuard, iGuard + 600);
  ok('the guard has no sample exemption',
     !/isSample/.test(guardBlock),
     'an is_sample bypass would let a zero-priced item through');

  /* Prove the predicate against the shapes MySQL and the client actually
     produce, rather than trusting the regex above. */
  const blocked = p => { const f = parseFloat(p) || 0; return !Number.isFinite(f) || f <= 0; };
  const cases = [['1902.78', false], ['10.00', false], ['0.00', true], ['0', true],
                 [null, true], [undefined, true], ['', true], ['abc', true], ['-5', true]];
  const wrong = cases.filter(([v, want]) => blocked(v) !== want);
  ok(`the price predicate is correct for all ${cases.length} input forms`,
     wrong.length === 0, `wrong: ${wrong.map(w => JSON.stringify(w[0])).join(', ')}`);

  /* ─── THE SECOND LINE ───────────────────────────────────────────────
   * cart/add stops a zero-priced item getting IN. It cannot help with a
   * line that is already there: a session predating the guard, or a
   * product edited to zero AFTER it was legitimately added. cart/update
   * re-checks on every quantity change, which is the moment the customer
   * is moving toward checkout with that line. */
  ok('cart/update drops zero-priced lines already in the cart',
     /_zeroLines/.test(cc) && /cart\.items\s*=\s*cart\.items\.filter\(i\s*=>\s*!_drop\.has/.test(cc),
     'an item priced to zero after it was added survives to checkout');
  ok('that sweep coerces with Number() too',
     /const p = Number\(i && i\.price\)/.test(cc),
     'cart lines are session JSON, so "0.00" is a truthy string');
  ok('dropped lines strip their bundle-mates’ discount',
     /_zeroLines\.forEach\([\s\S]{0,160}stripBundleGroup/.test(cc),
     'the rest of the bundle keeps a discount it no longer qualifies for');

  /* Prove the sweep, not just its spelling. */
  {
    const sweep = items => {
      const bad = items.filter(i => { const p = Number(i && i.price); return !Number.isFinite(p) || p <= 0; });
      const drop = new Set(bad.map(l => l.product_id));
      return items.filter(i => !drop.has(i.product_id)).map(i => i.product_id).join(',');
    };
    const kept = sweep([
      { product_id: 'a', price: '1902.78' }, { product_id: 'b', price: '10.00' },
      { product_id: 'c', price: '0.00' },    { product_id: 'd', price: 0 },
      { product_id: 'e', price: null },      { product_id: 'f', price: undefined },
      { product_id: 'g', price: '-5' },      { product_id: 'h', price: 'abc' },
    ]);
    ok('the sweep keeps only the two real-priced lines', kept === 'a,b', `kept: ${kept}`);
  }
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
