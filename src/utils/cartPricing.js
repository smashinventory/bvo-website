'use strict';

/**
 * cartPricing.js — the ONE place a cart line's price is decided.
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 *
 * Before 2026-10-04 the same formula —
 *
 *     price * (1 - bundle_discount_pct / 100)
 *
 * — was written out three separate times:
 *
 *   1. cartController.recalc()          -> the number on the cart page
 *   2. checkoutController.calcTotal()   -> orders.subtotal in the DB
 *   3. stripeService.buildLineItems()   -> WHAT THE CARD IS CHARGED
 *
 * They agreed only because the line had been copied three times. Any
 * promotion added to fewer than all three produces a cart that shows one
 * figure and a card that is charged another, and (3) is the one that
 * takes the money. That is not a hypothetical: the free-sample offer is
 * exactly such a promotion, and it was the reason this file was written
 * before the offer was built rather than after.
 *
 * All three now delegate here. Adding a rule in this file reaches the
 * cart page, the stored order and Stripe at once, or it reaches none of
 * them — which is the only safe pair of outcomes.
 *
 * ⚠️ IF YOU ADD A PRICING RULE, ADD IT HERE. A rule added in a caller is
 * a rule that applies to one of the three readers.
 *
 * ──────────────────────────────────────────────────────────────────────
 * MONEY NEVER COMES FROM THE CLIENT
 *
 * Every field this module reads — price, bundle_discount_pct, is_sample —
 * is put on the cart item by cartController.add from a database row.
 * cartController.add explicitly refuses client-supplied prices, and that
 * refusal is the control this file depends on. Nothing here re-opens it:
 * no function takes a price or a discount as an argument.
 */

const SAMPLE = require('../config/sampleOffer');

/* Cents, not floats, for anything that becomes a charge. 16.49 * 100 is
   1648.9999999999998 in IEEE 754; Math.round rather than truncation,
   or every such line bills a cent short. Same reasoning and the same
   implementation as stripeService.toCents, which is the one that was
   already getting this right. */
function toCents(amount) {
  return Math.round(parseFloat(amount || 0) * 100);
}

/** A number, or 0. Never NaN.
 *
 *  Poisoned session entries are real: an old FormData bug put items with
 *  null prices into live carts, and a NaN here propagates silently into
 *  a total rather than failing. Treating junk as 0 is wrong in the safe
 *  direction — it undercharges visibly rather than producing "$NaN". */
function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function qtyOf(item) {
  const q = parseInt(item && item.qty, 10);
  return Number.isFinite(q) && q > 0 ? q : 1;
}

/**
 * The bundle discount, validated.
 *
 * cartController.add already restricts this to {0,5,10,15} on the way
 * in. Clamped again here because this module is the last thing between
 * a cart item and a charge, and a session written by an older build is
 * not covered by today's input validation.
 */
const ALLOWED_BUNDLE_DISC = new Set([0, 5, 10, 15]);
function bundleDiscountPct(item) {
  const d = num(item && item.bundle_discount_pct);
  return ALLOWED_BUNDLE_DISC.has(d) ? d : 0;
}

/**
 * The percentage actually applied to a line.
 *
 * ⚠️ REPLACE, NEVER STACK — owner 2026-10-20, TRADE_PROGRAM_SPEC §5:
 * "best one wins across bundle discount, first-order offer and trade."
 * So this is MAX, not a sum and not a compound. A bundled item at 15%
 * bought by an Elite Trade account at 20% gets 20% — once. Stacking them
 * would be 32% off a James Martin SKU that already sits at MAP, which
 * comes straight off the bone.
 *
 * @param {object} item
 * @param {number} tierPct  0 unless the CALLER resolved a tier. Never
 *                          inferred here: this module is pure and the tier
 *                          is a database question.
 */
function effectiveDiscountPct(item, tierPct) {
  const bundle = bundleDiscountPct(item);
  /* ⚠️ typeof === 'number', NOT Number(tierPct), AND THAT IS A SECURITY
     DECISION RATHER THAN A STYLE ONE.
     Coercing would accept the STRING '20' — and strings are what arrive
     from req.query, req.body and a session cookie. The day anyone wires
     this to a request, `?tierPct=20` becomes a 20% discount for anybody
     who types it. Requiring a real number means a query string cannot
     become a price change no matter how carelessly it is plumbed; the
     caller has to have resolved a tier deliberately.

     Number('') === 0 and Number(null) === 0 would also both be "right"
     here by accident. Refusing them outright is the same failure-closed
     stance the sample promotion takes two functions down. */
  const t = (typeof tierPct === 'number' && Number.isFinite(tierPct)
             && tierPct > 0 && tierPct <= 100) ? tierPct : 0;
  return Math.max(bundle, t);
}

/**
 * What one unit of this line costs after the best applicable discount,
 * BEFORE the sample promotion. This is the function that used to be copied
 * three times.
 *
 * The second argument is OPTIONAL and defaults to no tier, so every
 * existing caller keeps its exact previous behaviour.
 */
function unitPrice(item, tierPct) {
  return num(item && item.price) * (1 - effectiveDiscountPct(item, tierPct) / 100);
}

/**
 * Is this line a finish sample?
 *
 * ⚠️ READ FROM is_sample, WHICH cartController.add SETS FROM THE DB. It
 * is deliberately NOT derived from the name, the SKU prefix or anything
 * the client can influence — "Sample" appears in product names outside
 * category 10, and a name-based test would hand out free vanities to
 * anything called a sample.
 *
 * Missing means false. Carts already in a session from before is_sample
 * existed therefore get no discount rather than a wrong one: the
 * promotion fails CLOSED. A customer seeing no discount asks; a customer
 * charged for something shown as free charges back.
 */
function isSample(item) {
  return item && item.is_sample === true;
}

/**
 * Decide which sample units are free, and return a per-line free count.
 *
 * Returns a Map from the line's index to how many of its units are free,
 * so callers can price a line without re-deriving the rule.
 *
 * THE 2 MOST EXPENSIVE UNITS ARE THE FREE ONES. All 69 samples are
 * $9.99 today, so this is financially identical to any other rule right
 * now — it is written this way so it stays in the customer's favour if
 * samples are ever priced differently. A rule that happens to be free
 * today and unfair later is worse than one that is correct now.
 *
 * Quantity-aware: 1 line of qty 4 is 4 units, 2 of which are free. A
 * per-LINE rule would give away 2 units on a line of 4 and 2 units on
 * each of four lines of 1, which is the same customer getting a
 * different answer for the same basket.
 *
 * @param {Array} items
 * @param {boolean} eligible  false once this email/address has redeemed
 * @returns {{freeByIndex: Map<number,number>, freeUnits: number, discount: number}}
 */
function sampleFreebie(items, eligible) {
  const empty = { freeByIndex: new Map(), freeUnits: 0, discount: 0 };
  if (!eligible || !Array.isArray(items)) return empty;

  /* One entry per UNIT, each carrying the index of its line, sorted
     dearest first. Expanding to units is what makes the rule
     quantity-aware without a second code path. */
  const units = [];
  items.forEach((it, idx) => {
    if (!isSample(it)) return;
    const u = unitPrice(it);
    for (let n = 0; n < qtyOf(it); n += 1) units.push({ idx, price: u });
  });
  if (!units.length) return empty;

  units.sort((a, b) => b.price - a.price);
  const free = units.slice(0, SAMPLE.FREE_COUNT);

  const freeByIndex = new Map();
  let cents = 0;
  free.forEach(u => {
    freeByIndex.set(u.idx, (freeByIndex.get(u.idx) || 0) + 1);
    cents += toCents(u.price);
  });

  return {
    freeByIndex,
    freeUnits: free.length,
    discount: parseFloat((cents / 100).toFixed(2)),
  };
}

/**
 * Price a whole cart once, and hand back everything any caller needs.
 *
 * ⚠️ CALL THIS, DO NOT REIMPLEMENT ANY PART OF IT. The three readers
 * each need a slightly different shape — a number, a DB column, Stripe
 * line items — but they must all come from this one computation.
 *
 * @param {Array} items
 * @param {{sampleEligible?: boolean, tierPct?: number}} [opts]
 *        tierPct defaults to 0. Like sampleEligible it is opt-in per
 *        request, because the tier is a database question (what is stored,
 *        what is their rolling spend, have they ordered before) that this
 *        pure module must not answer for itself. Defaulting to 0 means a
 *        caller that forgets to ask charges full price rather than
 *        discounting every cart on the site.
 *        sampleEligible defaults to FALSE. The promotion is opt-in per
 *        request because eligibility is a database question (has this
 *        email or address already redeemed) that this pure module must
 *        not be answering for itself. Defaulting to false means a caller
 *        that forgets to ask charges full price rather than giving
 *        samples away to everyone forever.
 * @returns {{lines: Array, subtotal: number, discount: number,
 *            freeUnits: number, sampleUnits: number}}
 */
function priceCart(items, opts) {
  const list = Array.isArray(items) ? items : [];
  const eligible = !!(opts && opts.sampleEligible);
  const tPct = (opts && opts.tierPct) || 0;
  const { freeByIndex, freeUnits, discount } = sampleFreebie(list, eligible);

  /* What full price would have been, so the saving can be SHOWN. A
     discount the customer cannot see is a discount that generates a
     support email rather than a conversion. */
  let listCents = 0;

  let subCents = 0;
  let sampleUnits = 0;

  const lines = list.map((it, idx) => {
    const qty  = qtyOf(it);
    const unit = unitPrice(it, tPct);
    const listUnit = unitPrice(it, 0);
    const freeQty = Math.min(qty, freeByIndex.get(idx) || 0);
    const paidQty = qty - freeQty;
    const lineCents = toCents(unit) * paidQty;

    if (isSample(it)) sampleUnits += qty;
    subCents  += lineCents;
    listCents += toCents(listUnit) * paidQty;

    return {
      item: it,
      qty,
      freeQty,
      paidQty,
      unitPrice: parseFloat(unit.toFixed(2)),
      /* The pre-tier unit, for the struck-through price on the line. */
      listUnitPrice: parseFloat(listUnit.toFixed(2)),
      discountPct: effectiveDiscountPct(it, tPct),
      /* What this line actually adds to the bill, free units removed. */
      lineTotal: parseFloat((lineCents / 100).toFixed(2)),
      isSample: isSample(it),
    };
  });

  return {
    lines,
    /* NET of the freebie — the amount to pay. This is what cart.subtotal
       has always meant here (the bundle discount was already folded in
       before this file existed), so callers keep their meaning. */
    subtotal: parseFloat((subCents / 100).toFixed(2)),
    discount,
    freeUnits,
    sampleUnits,
    /* The tier's contribution, separated so the cart can show it as its
       own line rather than silently folding it into the subtotal. */
    tierPct: tPct,
    tierDiscount: parseFloat(((listCents - subCents) / 100).toFixed(2)),
    listSubtotal: parseFloat((listCents / 100).toFixed(2)),
  };
}

/** Sum of qty. Was cartController's own line; here so the cart badge and
 *  any other counter cannot disagree. */
function itemCount(items) {
  return (Array.isArray(items) ? items : []).reduce((s, i) => s + qtyOf(i), 0);
}

module.exports = {
  priceCart, unitPrice, isSample, itemCount, toCents,
  /* Exported for the gate, which proves the extraction is a no-op by
     running the old formula against the new one. Not for callers. */
  effectiveDiscountPct,
  _internals: { num, qtyOf, bundleDiscountPct, sampleFreebie },
};
