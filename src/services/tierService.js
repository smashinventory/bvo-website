/* ═══════════════════════════════════════════════════════════════════════════
   tierService.js — the bridge between the database and src/utils/tiers.js.

   tiers.js is PURE: it knows the ladder, the percentages and the rules, and
   it answers questions when you hand it facts. This file is the only place
   that goes and FETCHES those facts. Keeping them apart is what lets a gate
   execute the rules without a database — Rule 18, and the same split as
   cartPricing/sampleOffer.

   ⚠️ NOTHING HERE DECIDES A PRICE. It resolves a tier and hands the
   percentage to cartPricing.priceCart({ tierPct }). One computation, one
   place, as the header of cartPricing demands.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

/* ⚠️ REQUIRED LAZILY, INSIDE THE FUNCTIONS THAT USE IT.
   src/config/database.js calls process.exit when DB_PASS is unset, so a
   top-level require makes this whole module unloadable without a live
   environment — and a module a gate cannot LOAD is a module the gate has
   to re-implement, which is the Rule 18 trap. Deferring the require keeps
   the pure logic (session handling, the tier rules) executable by a gate
   while the database parts stay exactly as they were at runtime. */
function pool() { return require('../config/database').bvoPool; }
const tiers = require('../utils/tiers');

/* IS_COUNTED = captured, not test, not cancelled. The single source for
   what counts as revenue — src/config/revenue.js, owner's rule 2026-10-19.
   Aliased to 'o' because the query below joins orders as o. */
const REV_COUNTED = require('../config/revenue').predicates('o').IS_COUNTED;

/* What retail looks like. Returned whenever anything is missing, unknown or
   logged out, so every failure path on this file is FULL PRICE. A bug here
   that fails open discounts the whole catalogue. */
const RETAIL = Object.freeze({
  tier: tiers.RESOLVED.NONE,
  label: tiers.LABELS.none,
  pct: 0,
  storedTier: tiers.STORED.NONE,
  rollingSpend: 0,
  hasCapturedOrder: false,
  isTrade: false,
  meter: null,
});

/**
 * Rolling 12-month CAPTURED revenue for one customer.
 *
 * ⚠️ CAPTURE, NOT ORDER DATE — and the window is measured from
 * payment_captured_at for the same reason. An order placed 400 days ago and
 * captured yesterday is money received this month. Using created_at would
 * let a long-authorised order age out while its cash was still recent.
 */
async function rollingSpend(customerId) {
  if (!customerId) return 0;
  const [rows] = await pool().query(
    `SELECT COALESCE(SUM(o.total), 0) AS spend
       FROM orders o
      WHERE o.customer_id = ?
        AND ${REV_COUNTED}
        AND o.payment_captured_at >= (NOW() - INTERVAL ? DAY)`,
    [customerId, tiers.ROLLING_DAYS]
  ).catch(err => {
    /* Logged, never swallowed. A silent failure here reads as "spend is
       zero", which quietly demotes an Elite Trade account to 15% with
       nothing on the page to explain why. */
    console.error('[tierService] rollingSpend FAILED:', err.code, err.sqlMessage || err.message);
    return [[{ spend: 0 }]];
  });
  const n = parseFloat(rows && rows[0] && rows[0].spend);
  return Number.isFinite(n) ? n : 0;
}

/** Has this customer EVER had an order captured? Decides the first-order offer. */
async function hasCapturedOrder(customerId) {
  if (!customerId) return false;
  const [rows] = await pool().query(
    `SELECT 1 FROM orders o WHERE o.customer_id = ? AND ${REV_COUNTED} LIMIT 1`,
    [customerId]
  ).catch(err => {
    console.error('[tierService] hasCapturedOrder FAILED:', err.code, err.sqlMessage || err.message);
    /* ⚠️ FAILS CLOSED, DELIBERATELY. On error we claim they HAVE ordered,
       which withholds the first-order discount. The opposite default would
       hand 10% to everyone the moment this query broke. */
    return [[{ 1: 1 }]];
  });
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Resolve the tier for a request.
 *
 * @param {object} req  needs req.session.customerId
 * @returns {Promise<object>} never throws; retail on any failure
 */
async function forRequest(req) {
  const customerId = req && req.session && req.session.customerId;

  /* ⚠️ MAP: no session, no trade pricing. tiers.resolveTier enforces this
     too — belt and braces, because this is the rule James Martin can
     withhold shipments over. */
  if (!customerId) return RETAIL;

  try {
    const [rows] = await pool().query(
      'SELECT tier, offer_enrolled_at, accepts_marketing FROM customers WHERE id = ? LIMIT 1',
      [customerId]
    );
    const row = rows && rows[0];
    if (!row) return RETAIL;

    const storedTier = row.tier || tiers.STORED.NONE;

    /* Only ask the expensive questions the stored tier actually needs. */
    const needSpend = storedTier === tiers.STORED.PLATINUM_TRADE;
    const needFirst = storedTier === tiers.STORED.PLATINUM_MEMBER;

    const [spend, ordered] = await Promise.all([
      needSpend ? rollingSpend(customerId)      : Promise.resolve(0),
      needFirst ? hasCapturedOrder(customerId)  : Promise.resolve(false),
    ]);

    const tier = tiers.resolveTier({
      storedTier,
      rollingSpend: spend,
      hasCapturedOrder: ordered,
      isLoggedIn: true,
    });

    return {
      tier,
      label: tiers.tierLabel(tier),
      /* Number(), and the pure module requires a real number — a string
         here could never become a discount, by construction. */
      pct: tiers.tierPct(tier),
      storedTier,
      rollingSpend: spend,
      hasCapturedOrder: ordered,
      isTrade: tiers.isTradeTier(tier),
      /* The meter is for trade accounts only. A retail customer has no
         journey to 20% and showing them one is noise. */
      meter: (storedTier === tiers.STORED.PLATINUM_TRADE) ? tiers.spendMeter(spend) : null,
    };
  } catch (err) {
    console.error('[tierService] forRequest FAILED:', err.code, err.sqlMessage || err.message);
    return RETAIL;
  }
}

/**
 * Build the opts object for cartPricing.priceCart().
 *
 * ⚠️ ONE HELPER, CALLED BY EVERY PRICING SITE, AND THAT IS THE POINT.
 * The cart page, orders.subtotal and the Stripe line items all derive from
 * the same opts object today — that is how cartPricing guarantees the
 * displayed price, the stored price and the charge agree. Adding the tier
 * anywhere OTHER than here would break that guarantee silently: the cart
 * would show 15% off and Stripe would bill full price, or worse the
 * reverse.
 *
 * ⚠️ FAILS TO RETAIL. tierPct 0 produces byte-identical behaviour to
 * before this existed, so any failure in tier resolution charges full
 * price rather than discounting the catalogue.
 *
 * @param {object} req
 * @param {boolean} sampleEligible  resolved by the caller, as before
 */
async function priceOptsFor(req, sampleEligible) {
  const t = await forRequest(req);
  return {
    sampleEligible: !!sampleEligible,
    /* Number, never a string — cartPricing REFUSES strings so that a query
       parameter can never become a discount. See effectiveDiscountPct. */
    tierPct: Number(t.pct) || 0,
    /* Carried for the view so the cart can name the tier it applied
       rather than showing an unexplained deduction. */
    _tier: t,
  };
}

module.exports = { forRequest, priceOptsFor, rollingSpend, hasCapturedOrder, RETAIL };
