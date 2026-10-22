'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_payment_retry.js
 *
 * THE RULE: A DECLINE IS THE MIDDLE OF A CHECKOUT, NOT THE END OF ONE.
 *
 * WHAT WENT WRONG, 2026-10-21. handleSessionCompleted — the handler that
 * turns a Stripe authorisation into an order — was guarded on
 *
 *     WHERE id = ? AND payment_status = 'pending'
 *
 * A buyer whose card is declined and who then retries successfully does
 * not arrive on 'pending'. payment_intent.payment_failed has already moved
 * the row to 'failed'. So the UPDATE matched nothing, affectedRows was 0,
 * and the handler took its replay path: returned 200 to Stripe, wrote no
 * order, sent no confirmation email.
 *
 * Every outward sign was correct, which is why it ran for days:
 *   · Stripe showed the authorisation (uncaptured, money held)
 *   · the success page said "authorised" — it reads the PaymentIntent
 *     from Stripe directly, not the order row
 *   · the webhook delivery log showed 200 OK with {"received": true}
 * Only the admin order list disagreed, by not listing the order at all.
 *
 * It cost order 00122 ($657, a real customer who had been declined once)
 * and order 00125 ($2,694.60). Both sat with live authorisations that no
 * screen on the site could see.
 *
 * WHAT THIS GATE GUARDS:
 *
 *   1. THE AUTHORISATION GUARD ACCEPTS 'failed'. The actual defect.
 *   2. IT STILL REFUSES THE DECIDED STATES. 'auth_only', 'captured',
 *      'canceled' and 'refunded' must never be re-opened — that is what
 *      makes a webhook redelivery a no-op instead of a second email, and
 *      what stops a refunded order silently becoming live again. Widening
 *      a guard is exactly the kind of fix that overshoots.
 *   3. A TERMINAL EVENT CARRIES ITS PaymentIntent ID. One order owns many
 *      PIs once a buyer retries. Matched on order_id alone, a cancel for a
 *      DEAD attempt moves an order a LATER attempt authorised — money held
 *      at Stripe, order marked canceled. Structural, not yet observed.
 *   4. THE CHECKOUT STILL OWNS A DECLINED ORDER. EDITABLE and the
 *      page-3 writes must admit 'failed', or the buyer who was declined is
 *      thrown back to step 1 with their details gone, at the exact moment
 *      they were about to try another card.
 *   5. 'failed' IS NOT REVENUE AND NOT IN FLIGHT. Same root cause in
 *      revenue.js — see gate_revenue_definition for the other half.
 *
 * ⚠️ RULE 14: no gate opens a database connection. The guard is therefore
 * EXECUTED through buildPaymentStatusUpdate, which returns the real
 * {sql, params}, and the row-matching below is derived FROM that output —
 * never from a second copy of the rule. Rule 18: a test that restates its
 * subject agrees with the bug.
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};

/* The controller opens a pool lazily, so it loads without a database. */
process.env.DB_PASS = process.env.DB_PASS || 'gate-no-db';
const checkout = require(path.join(ROOT, 'src/controllers/checkoutController.js'));
const revenue  = require(path.join(ROOT, 'src/config/revenue.js'));
const SRC = fs.readFileSync(
  path.join(ROOT, 'src/controllers/checkoutController.js'), 'utf8');

/* ── A row matcher DERIVED FROM THE EMITTED STATEMENT ──────────────────
   Reads the allowed-from values out of the real params array and the
   PI clause out of the real SQL. If the builder stops emitting either,
   this stops matching — which is the point. */
function wouldMatch(built, row) {
  const { sql, params } = built;
  const n = (sql.match(/payment_status IN \(([^)]*)\)/) || [, ''])[1]
              .split(',').filter(Boolean).length;
  const allowedFrom = params.slice(2, 2 + n);
  if (!allowedFrom.includes(row.payment_status)) return false;

  if (/payment_transaction_id IS NULL OR payment_transaction_id = \?/.test(sql)) {
    const piId = params[2 + n];
    if (row.payment_transaction_id != null &&
        row.payment_transaction_id !== piId) return false;
  }
  return true;
}

const DECIDED = ['auth_only', 'captured', 'canceled', 'refunded'];

console.log('\n1. The authorisation guard — the defect itself');

/* handleSessionCompleted's UPDATE is a template literal inside an async DB
   call, so it cannot be executed here. The STATE SET is extracted from it
   and asserted member by member, which fails both on a removal and on an
   over-wide addition — unlike matching the whole clause as a string. */
const authClause = (SRC.match(
  /payment_authorized_at = NOW\(\)\s*\n\s*WHERE id = \? AND payment_status IN \(([^)]*)\)/
) || [, null])[1];

check(authClause !== null,
      'the authorisation UPDATE guard was located',
      'If this fails the regex drifted from the source — fix the gate, not by deleting it.');

const authStates = (authClause || '').split(',')
  .map(s => s.trim().replace(/'/g, '')).filter(Boolean);

check(authStates.includes('pending'),
      "it accepts 'pending' — the first-attempt-succeeds path");
check(authStates.includes('failed'),
      "it accepts 'failed' — THE DECLINE-THEN-RETRY PATH",
      'This single missing state stranded orders 00122 and 00125 with live authorisations.');
for (const st of DECIDED) {
  check(!authStates.includes(st),
        `it refuses '${st}' — a decided state is never re-opened`,
        st === 'auth_only'
          ? 'Accepting it would make every webhook REDELIVERY write again and send a second confirmation email.'
          : `Accepting it would let a late event resurrect a ${st} order.`);
}

console.log('\n2. Terminal events are scoped to their own PaymentIntent');

const cancelOnOwnPi = checkout._buildPaymentStatusUpdate(
  42, 'canceled', checkout._CANCELABLE_FROM, 'pi_LIVE');

check(/payment_transaction_id/.test(cancelOnOwnPi.sql),
      'the statement carries a PaymentIntent condition when given a PI id');

check(wouldMatch(cancelOnOwnPi, {
        payment_status: 'auth_only', payment_transaction_id: 'pi_LIVE' }),
      'a cancel for the order\'s OWN PaymentIntent does move it');

check(!wouldMatch(cancelOnOwnPi, {
        payment_status: 'auth_only', payment_transaction_id: 'pi_DEAD_ATTEMPT' }),
      'a cancel for a SUPERSEDED attempt does NOT touch the live order',
      'Without this, a trailing cancel marks an order canceled while Stripe still holds the money.');

check(wouldMatch(cancelOnOwnPi, {
        payment_status: 'pending', payment_transaction_id: null }),
      'before authorisation (no PI recorded yet) a terminal event still applies',
      'payment_transaction_id is NULL until the authorisation lands; declines must still register.');

/* ⚠️ THE CALL SITES, NOT JUST THE BUILDER.
   Found by mutate_payment_gate M6: every assertion above passes a PI id in
   by hand, so they all stayed green when the webhook switch stopped
   passing one. The builder being capable of scoping to a PaymentIntent is
   worth nothing if the two handlers that need it omit the argument — and
   `piId` is optional by design, so omitting it is silent. Assert that both
   terminal cases hand over the event's own object id. */
for (const [evt, label] of [
  ['payment_intent\\.canceled',       'canceled'],
  ['payment_intent\\.payment_failed', 'payment_failed'],
]) {
  const body = (SRC.match(
    new RegExp(`case '${evt}':([\\s\\S]*?)break;`)
  ) || [, ''])[1];
  check(/event\.data\.object\.id/.test(body),
        `the ${label} handler passes its own PaymentIntent id`,
        'Without it the event moves whatever order its metadata names, regardless of which attempt it describes.');
}

const failUpd = checkout._buildPaymentStatusUpdate(
  42, 'failed', checkout._OPEN_PAYMENT_STATES, 'pi_2');

check(wouldMatch(failUpd, { payment_status: 'failed', payment_transaction_id: null }),
      'a SECOND decline is recorded, not discarded',
      "allowedFrom must include 'failed' or the second of two declines is a silent no-op.");

check(!wouldMatch(failUpd, { payment_status: 'auth_only', payment_transaction_id: null }),
      'a late failure can NEVER move an already-authorised order',
      'This is the inverse hazard of the one above and matters just as much.');

for (const st of ['captured', 'refunded']) {
  check(!wouldMatch(failUpd, { payment_status: st, payment_transaction_id: null }),
        `a late failure cannot move a '${st}' order`);
}

console.log('\n3. The checkout keeps the order while the buyer retries');

check(/'failed'/.test(checkout._EDITABLE),
      "EDITABLE admits 'failed'",
      'A declined buyer is still standing on the payment page. Without this they are bounced to step 1 with their details gone.');
check(/'draft'/.test(checkout._EDITABLE) && /'pending'/.test(checkout._EDITABLE),
      "EDITABLE still admits 'draft' and 'pending'");
for (const st of DECIDED) {
  check(!new RegExp(`'${st}'`).test(checkout._EDITABLE),
        `EDITABLE refuses '${st}' — an authorised order is not editable`,
        'A buyer must not change the delivery class of an order already booked with the carrier.');
}

const detailsGuard = (SRC.match(
  /UPDATE orders SET \$\{sets\.join\(', '\)\}\s*\n\s*WHERE id = \? AND payment_status IN \(([^)]*)\)/
) || [, null])[1];
check(detailsGuard !== null && /failed/.test(detailsGuard),
      "setOrderDetails accepts 'failed'",
      'Delivery type and phone extension were silently dropped for any buyer who had been declined.');
check(detailsGuard !== null && !/auth_only/.test(detailsGuard),
      'setOrderDetails still refuses an authorised order');

const revertGuard = (SRC.match(
  /payment_status = 'draft'\s*\n\s*WHERE id = \? AND payment_status IN \(([^)]*)\)/
) || [, null])[1];
check(revertGuard !== null && /failed/.test(revertGuard),
      "the provider-outage revert accepts 'failed'",
      'A buyer declined once and then hitting a Stripe outage was stuck with no way back to the form.');

console.log('\n4. A declined payment is neither revenue nor money in flight');

const base = { is_test: 0, status: 'confirmed', payment_captured_at: null };
check(revenue.isAuthorized({ ...base, payment_status: 'failed' }) === false,
      "isAuthorized() is false for 'failed'",
      'A decline is the opposite of a hold. Counting it claims money Stripe is not holding.');
check(revenue.isAuthorized({ ...base, payment_status: 'auth_only' }) === true,
      "isAuthorized() is still true for 'auth_only'");
check(revenue.isCounted({ ...base, payment_status: 'failed',
                          payment_captured_at: '2026-10-21' }) === false,
      "isCounted() is false for 'failed' even with a capture timestamp",
      'Belt and braces: the two columns should never disagree, and if they do, the stricter answer wins.');
check(/'failed'/.test(revenue.O.IS_REAL),
      "the SQL predicate also excludes 'failed'",
      'IS_REAL drives the inventory-risk strip — a decline must not reserve stock.');

/* The JS and SQL twins must agree, or one of them is lying. Same fixture
   rows through both, which is the check that caught the drift when
   'failed' was added to the SQL list and not to the JS one. */
let agree = true;
for (const ps of ['draft', 'pending', 'failed', 'auth_only', 'captured']) {
  const inSql = !new RegExp(`'${ps}'`).test(revenue._internals.PLACEHOLDER_PAYMENT);
  const inJs  = revenue.isAuthorized({ ...base, payment_status: ps });
  if (inSql !== inJs) { agree = false; console.log(`         disagree on '${ps}'`); }
}
check(agree, 'the SQL list and the JS predicate agree on every payment state',
      'Two implementations of one rule is how a definition starts drifting.');

console.log(
  fail === 0
    ? `\nGREEN  ${pass} passed, 0 failed`
    : `\ngate_payment_retry: FAILED ${fail} of ${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);
