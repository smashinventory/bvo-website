'use strict';

/**
 * revenue.js — what counts as an ORDER, and what counts as MONEY.
 *
 * ⚠️ ONE SOURCE, EIGHT CONSUMERS. Before 2026-10-19 every dashboard carried
 * its own WHERE clause and they did not agree. The shared one in
 * customerAnalyticsController read:
 *
 *     o.is_test = 0 AND o.status <> 'cancelled'
 *
 * which excludes test rows and cancellations and NOTHING ELSE. A checkout
 * that was started and abandoned leaves status='pending',
 * payment_status='pending' (checkoutController:1522) — and sailed straight
 * into every figure on the site.
 *
 * WHAT THAT LOOKED LIKE. Customer 11's record read "3 orders, $1,971". He
 * had paid nothing. Those were three attempts at the same $657 purchase on
 * 2026-10-05, all of which failed because checkout itself was broken
 * (cbafe9f). The customer dashboard, the LTV figures, the cohort tables,
 * the KPI report and the admin home tile all inherited the same error.
 *
 * ── NOTHING COUNTS UNTIL THE MONEY IS CAPTURED ──────────────────────────
 *
 * ⚠️ THE OWNER'S RULE, stated 2026-10-19: "both the units and the revenue
 * do not count until the authorization is captured."
 *
 * So there is ONE test, not two. A unit sold and a dollar earned become
 * real at the same moment — capture — and no screen may disagree about
 * when that is.
 *
 *   IS_COUNTED — captured. Used for order counts AND dollar figures AND
 *                conversion AND cohorts AND "has this person bought".
 *
 * WHAT THIS DELIBERATELY HIDES. BVO captures at or near shipment, so an
 * order that is confirmed and awaiting freight appears NOWHERE in
 * analytics until it is captured. That is intended: an authorization is a
 * promise, not a sale, and a reversed one would otherwise have to be
 * unwound from figures that had already been reported.
 *
 *   IS_AUTHORIZED — the other side of that coin, exposed so a screen can
 *                   show what is in flight. It is NOT revenue and must
 *                   never be added to it.
 *
 * ── WHY payment_captured_at AND NOT payment_status ──────────────────────
 *
 * payment_captured_at is a TIMESTAMP: it is written once, when the money
 * moves, and it cannot drift. payment_status is a mutable label that also
 * has to represent refunds, disputes and cancellations — so "captured" can
 * stop being true later while the column still says it. A refunded order
 * keeps its captured timestamp AND gains a refund, which is the correct
 * basis for gross revenue; netting refunds off is a separate figure and a
 * separate decision, deliberately not buried in here.
 */

/* ── Test data ───────────────────────────────────────────────────────────
   is_test is set from the admin and sweeps the customer's orders with it.
   Every predicate below carries it, because a test exclusion that applies
   to some figures and not others is worse than none: the numbers stop
   reconciling and nobody can say why. */
const NOT_TEST = 'is_test = 0';

/* ── A REAL ORDER ────────────────────────────────────────────────────────
   Payment reached at least an authorization. In practice that means the
   Stripe webhook wrote a payment_status other than the two placeholder
   values the checkout flow sets on its way through:

     'draft'    — a cart being filled in
     'pending'  — details saved, payment never completed  ← the bug

   Cancelled orders are excluded as they always were: a released
   authorization is not a sale.

   ⚠️ NOT A WHITELIST OF GOOD STATUSES. A blacklist of the two placeholders
   is deliberate — a new payment_status added later (a dispute state, a
   partial capture) is a REAL order by default and shows up, rather than
   silently vanishing from every count until someone notices. The failure
   mode of a whitelist here is invisible under-reporting, which is the
   failure we are already fixing. */
/* ⚠️ 'failed' JOINED THIS LIST ON 2026-10-21, AND ITS ABSENCE WAS NOT
   HARMLESS. A declined card writes payment_status='failed'. With only
   'draft' and 'pending' excluded, such a row passed BASE — so IS_REAL
   counted it as stock committed to a customer, and IS_AUTHORIZED counted
   it as money held in flight. A decline is the opposite of money held.

   This is the same defect as the webhook guard fixed the same day: both
   treated 'failed' as a state outside the checkout rather than a stop
   along it. Orders 00122 and 00125 were being counted by both predicates
   while no money existed and no order was visible to staff.

   IS_COUNTED was never wrong, because it also demands payment_captured_at
   — which is exactly why this went unseen: every DOLLAR figure was right
   and only the unit and in-flight figures lied. */
const PLACEHOLDER_PAYMENT = "('draft', 'pending', 'failed')";

/* ── MONEY ───────────────────────────────────────────────────────────────
   Captured. One condition, no alias, no interpretation. */
const CAPTURED = 'payment_captured_at IS NOT NULL';

/**
 * Both predicates, prefixed for whatever the query calls the orders table.
 *
 * @param {string} a table alias, e.g. 'o'. Pass '' for an unaliased
 *        `FROM orders`. Anything else is rejected rather than interpolated:
 *        these strings go into SQL, and a caller-supplied alias is the one
 *        place this module could become an injection point.
 */
function predicates(a = 'o') {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$|^$/.test(a)) {
    throw new Error(`revenue.js: refusing a non-identifier table alias: ${a}`);
  }
  const p = a ? `${a}.` : '';

  /* Shared by both predicates: not a test row, not cancelled, and past the
     two placeholder payment states the checkout flow sets on its way
     through ('draft' = cart, 'pending' = details saved, payment never
     completed). */
  const BASE = `${p}${NOT_TEST} AND ${p}status <> 'cancelled' ` +
               `AND ${p}payment_status NOT IN ${PLACEHOLDER_PAYMENT}`;

  return {
    /* ⚠️ NOT FOR ANALYTICS. A real order, captured or not — the BASE above
       with no capture test at all.

       Added 2026-10-20 for the inventory-risk strip, which asks a question
       neither of the other two answers: "what is actually committed to a
       customer right now." An order authorised and awaiting the vendor call
       is not revenue (it fails IS_COUNTED, correctly) but it absolutely
       competes for vendor stock. IS_AUTHORIZED is the wrong side of the
       same coin — it would drop orders already captured and not yet shipped.

       It is exported so that consumer does not hand-roll a fourth variant
       of "not a test, not cancelled, not an abandoned checkout". Any figure
       involving MONEY must still use IS_COUNTED. */
    IS_REAL: BASE,

    /* ⚠️ THE ONLY PREDICATE ANALYTICS SHOULD USE. Units and dollars both
       wait for capture — one rule, so a count and a sum can never disagree
       about which orders are real. */
    IS_COUNTED: `${BASE} AND ${p}${CAPTURED}`,

    /* Authorized, not yet captured. Money held, not taken. Exposed so a
       screen can show what is in flight — NEVER added to revenue. */
    IS_AUTHORIZED: `${BASE} AND ${p}payment_captured_at IS NULL`,
  };
}

/* The common case, precomputed for the many queries that alias to `o`. */
const O = predicates('o');

/**
 * The JS-side equivalent, for the one place that sums in JavaScript
 * (customerAnalyticsController.detail reduces over rows it already has).
 *
 * ⚠️ MUST AGREE WITH THE SQL ABOVE. It is tested against it by
 * gate_revenue_definition, which runs both over the same fixture rows —
 * because two implementations of one rule is exactly how a definition
 * starts drifting, and this module exists to stop that.
 */
/* ⚠️ DERIVED FROM PLACEHOLDER_PAYMENT, NOT RETYPED FROM IT.
   The JS twin used to carry its own literal ['draft','pending']. When
   'failed' was added to the SQL list on 2026-10-21 the JS kept the old
   two, and the two implementations disagreed instantly — caught by
   gate_revenue_definition, which is the only reason it was a five-minute
   fix rather than another silent divergence. Parsing the one constant
   means there is nothing left to forget to update. */
const PLACEHOLDER_LIST = PLACEHOLDER_PAYMENT
  .replace(/[()']/g, '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function isCounted(row) {
  return String(row.is_test) !== '1'
      && row.status !== 'cancelled'
      && !PLACEHOLDER_LIST.includes(row.payment_status)
      && !!row.payment_captured_at;
}

function isAuthorized(row) {
  return String(row.is_test) !== '1'
      && row.status !== 'cancelled'
      && !PLACEHOLDER_LIST.includes(row.payment_status)
      && !row.payment_captured_at;
}

module.exports = {
  predicates,
  O,
  isCounted,
  isAuthorized,
  /* Exported for the gate, so it checks the real constants rather than a
     restatement of them. */
  _internals: { NOT_TEST, PLACEHOLDER_PAYMENT, CAPTURED },
};
