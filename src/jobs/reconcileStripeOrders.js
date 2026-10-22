'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   reconcileStripeOrders.js — the backstop for a webhook that never arrived.

   WHY THIS EXISTS.

   Until 2026-10-21 the ONLY thing that could turn a Stripe authorisation
   into an order was the checkout.session.completed webhook. Nothing else
   wrote that transition, and nothing ever checked whether it had happened.
   GET /checkout/return deliberately does not — it is read-only so it cannot
   race the webhook and double-send the confirmation email — so when the
   webhook failed, the money was held at Stripe and NO SCREEN ON THE SITE
   KNEW THE ORDER EXISTED.

   That is not hypothetical. Orders 00122 and 00125 sat that way, and were
   found only because the owner happened to look at the admin list and count
   the rows. There was no alert, no error and no log line, because from the
   application's point of view nothing had gone wrong.

   The specific cause then was a guard that accepted only
   payment_status='pending' when a declined-then-retried buyer arrives on
   'failed'. That is fixed. This job exists because that was ONE CAUSE OF A
   CLASS, and the rest of the class is still entirely possible:

     · the webhook endpoint is disabled, deleted or its URL changes
     · the signing secret is rotated in Stripe and not in Hostinger, so
       every delivery 400s
     · Node is restarting (a deploy) through all of Stripe's retries
     · the handler throws AFTER res.json({received:true}) — it acknowledges
       first by design, so Stripe is already told "handled" and will never
       retry. Every exception in that window is permanent data loss.
     · a future edit to the handler reintroduces exactly this shape

   ⚠️ IT DRIVES THE WEBHOOK'S OWN HANDLER. checkoutController exports
   _handleSessionCompleted and this job calls it. It does NOT write its own
   UPDATE. Two implementations of "turn an authorisation into an order"
   would drift, and the second one is the one nobody tests — Rule 18. That
   also means every guard, every COALESCE and the confirmation email behave
   identically whether the webhook or this job settles the order.

   ⚠️ IT ONLY EVER SETTLES WHAT STRIPE SAYS IS AUTHORISED. The decision is
   shouldSettle(), a pure function, below. It is pure so a gate can execute
   it — Rule 14 forbids a gate opening a database connection, and this is
   the money path, so "the code reads correctly" is not evidence.

   WHAT IT WILL NOT DO
   ───────────────────
   · It never captures. Capture is a human decision on the admin screen.
   · It never cancels anything at Stripe.
   · It never touches an order Stripe reports as canceled or failed. A
     declined payment is left exactly where it is.
   · It cannot create money movement of any kind. The worst case if it is
     wrong is an order appearing that should not, which is visible and
     reversible — unlike the failure it exists to prevent.
   ═══════════════════════════════════════════════════════════════════════════ */

const DEFAULT_MIN_AGE_MINUTES = 15;
/* Stripe's own retry schedule runs for about three days. Fifteen minutes is
   long enough that a healthy-but-slow delivery is not raced, short enough
   that an order is recovered the same morning. */

const DEFAULT_MAX_AGE_DAYS = 10;
/* An uncaptured authorisation lapses after about 7 days. Past that there is
   nothing left to settle and chasing it only burns API calls — but the
   window is wider than 7 so a lapsed one is still SEEN and reported rather
   than silently skipped. */

/* PaymentIntent statuses that mean the customer's money is committed.
   'requires_capture' is the normal one under manual capture.
   'succeeded' covers an order captured directly at Stripe.
   'processing' is an async method still settling — real, not yet final. */
const AUTHORISED_PI = ['requires_capture', 'succeeded', 'processing'];

/* Order payment_status values this job is willing to move OUT of. The same
   set the webhook's own UPDATE accepts, for the same reason: these are the
   states a checkout is still open in. A decided order is never re-opened. */
const SETTLEABLE_FROM = ['pending', 'failed'];

/**
 * THE WHOLE DECISION, as a pure function.
 *
 * @param {string} piStatus       Stripe's PaymentIntent.status
 * @param {string} paymentStatus  our orders.payment_status
 * @returns {{settle: boolean, reason: string}}
 */
function shouldSettle(piStatus, paymentStatus) {
  if (!SETTLEABLE_FROM.includes(paymentStatus)) {
    /* Already decided here. Includes the ordinary case of the webhook
       having worked between our SELECT and now. */
    return { settle: false, reason: `order already '${paymentStatus}'` };
  }
  if (!AUTHORISED_PI.includes(piStatus)) {
    /* ⚠️ THE IMPORTANT HALF. Without this a canceled or failed intent
       would be handed to handleSessionCompleted, which stamps
       payment_authorized_at and would move a DEAD payment to a live-looking
       order. A decline must stay a decline. */
    return { settle: false, reason: `stripe says '${piStatus}'` };
  }
  return { settle: true, reason: `stripe says '${piStatus}'` };
}

/** Rows worth asking Stripe about. Exported so the gate can read the SQL. */
function buildCandidateQuery(minAgeMinutes, maxAgeDays) {
  return {
    sql: `
      SELECT id, order_number, stripe_session_id, payment_status, total, created_at
        FROM orders
       WHERE stripe_session_id IS NOT NULL
         AND stripe_session_id <> ''
         AND payment_status IN (${SETTLEABLE_FROM.map(() => '?').join(',')})
         AND created_at < (NOW() - INTERVAL ? MINUTE)
         AND created_at > (NOW() - INTERVAL ? DAY)
       ORDER BY created_at ASC`,
    params: [...SETTLEABLE_FROM, minAgeMinutes, maxAgeDays],
  };
}

async function run(opts = {}) {
  const minAge  = Number.isFinite(opts.minAgeMinutes) ? opts.minAgeMinutes : DEFAULT_MIN_AGE_MINUTES;
  const maxAge  = Number.isFinite(opts.maxAgeDays)    ? opts.maxAgeDays    : DEFAULT_MAX_AGE_DAYS;
  const dryRun  = !!opts.dryRun;

  /* Required lazily so this module can be loaded by a gate with no DB
     credentials present — same pattern as tierService. */
  const { bvoPool } = require('../config/database');
  const stripe   = require('../services/stripeService');
  const checkout = require('../controllers/checkoutController');

  const { sql, params } = buildCandidateQuery(minAge, maxAge);
  const [rows] = await bvoPool.query(sql, params);

  const report = { checked: 0, settled: [], left: [], errors: [] };

  for (const row of rows) {
    report.checked++;
    try {
      const fetched = await stripe.retrieveSession(row.stripe_session_id);
      if (!fetched.ok) {
        report.errors.push({ order: row.order_number, error: fetched.error });
        continue;
      }
      const pi = fetched.session.payment_intent;
      const piStatus = (typeof pi === 'object' && pi && pi.status) || 'none';

      const verdict = shouldSettle(piStatus, row.payment_status);
      if (!verdict.settle) {
        report.left.push({ order: row.order_number, reason: verdict.reason });
        continue;
      }

      if (dryRun) {
        report.settled.push({ order: row.order_number, total: row.total,
                              piStatus, dryRun: true });
        continue;
      }

      /* THE WEBHOOK'S OWN HANDLER. Not a copy of it. It re-fetches the
         session itself, which is one redundant API call and worth it: the
         alternative is this job passing it in and the two paths slowly
         growing different ideas about what a session looks like. */
      await checkout._handleSessionCompleted({
        id: row.stripe_session_id,
        metadata: { order_id: String(row.id) },
      });

      /* Read back rather than assume. The handler is guarded and may
         legitimately have done nothing. */
      const [[after]] = await bvoPool.query(
        'SELECT payment_status, status FROM orders WHERE id = ?', [row.id]);

      if (after && SETTLEABLE_FROM.includes(after.payment_status)) {
        report.errors.push({
          order: row.order_number,
          error: `handler ran but payment_status is still '${after.payment_status}'`,
        });
      } else {
        report.settled.push({
          order: row.order_number, total: row.total, piStatus,
          now: after ? `${after.status}/${after.payment_status}` : '?',
        });
      }
    } catch (err) {
      report.errors.push({ order: row.order_number, error: err.message });
    }
  }
  return report;
}

/* ── CLI ──────────────────────────────────────────────────────────────── */
if (require.main === module) {
  const args   = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const minArg = args.find(a => a.startsWith('--min-age='));
  const opts = {
    dryRun,
    minAgeMinutes: minArg ? parseInt(minArg.split('=')[1], 10) : undefined,
  };

  run(opts)
    .then(r => {
      const tag = dryRun ? ' (DRY RUN — nothing written)' : '';
      console.log(`[reconcileStripeOrders] checked ${r.checked}${tag}`);
      for (const s of r.settled) {
        console.log(`  SETTLED  ${s.order}  $${s.total}  ${s.piStatus}${s.now ? ' -> ' + s.now : ''}`);
      }
      for (const l of r.left) {
        console.log(`  left     ${l.order}  ${l.reason}`);
      }
      for (const e of r.errors) {
        console.error(`  ERROR    ${e.order}  ${e.error}`);
      }
      if (r.settled.length && !dryRun) {
        console.log(
          `\n⚠️  ${r.settled.length} order(s) were settled by the RECONCILER, ` +
          `which means the webhook did not do its job.\n` +
          `    Check Stripe -> Developers -> Webhooks -> Event deliveries ` +
          `before treating this as routine.`);
      }
      process.exit(r.errors.length ? 1 : 0);
    })
    .catch(err => {
      console.error('[reconcileStripeOrders] FAILED:', err.message);
      process.exit(1);
    });
}

module.exports = {
  run,
  shouldSettle,
  buildCandidateQuery,
  AUTHORISED_PI,
  SETTLEABLE_FROM,
  DEFAULT_MIN_AGE_MINUTES,
  DEFAULT_MAX_AGE_DAYS,
};
