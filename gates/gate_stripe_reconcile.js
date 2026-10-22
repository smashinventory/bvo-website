'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_stripe_reconcile.js
 *
 * THE RULE: AN AUTHORISATION AT STRIPE MUST ALWAYS BECOME AN ORDER HERE —
 * and a payment that is NOT authorised must never become one.
 *
 * The webhook was the only thing that could make that transition, and
 * nothing checked whether it had. When it failed, the money sat at Stripe
 * and no screen on the site knew the order existed. Orders 00122 and 00125
 * were found by the owner counting rows in the admin list.
 *
 * reconcileStripeOrders.js is the backstop. This gate guards the two ways
 * a backstop goes wrong:
 *
 *   1. IT STOPS CATCHING THINGS — the settleable set narrows, the
 *      authorised set narrows, or the query stops finding candidates. The
 *      failure is silent and identical to "nothing was wrong".
 *
 *   2. IT CATCHES TOO MUCH — a canceled or declined PaymentIntent is
 *      settled into a live-looking order. That is WORSE than the bug it
 *      replaces, because it manufactures an order against money nobody is
 *      holding, and it does so automatically and repeatedly.
 *
 * ⚠️ shouldSettle IS PURE PRECISELY SO THIS GATE CAN RUN IT. Rule 14: no
 * gate opens a database connection and none talks to Stripe. A decision
 * that exists only inside an async job can be checked only by reading it,
 * and reading is what let a one-word guard strand two paid orders.
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};

process.env.DB_PASS = process.env.DB_PASS || 'gate-no-db';
const job = require(path.join(ROOT, 'src/jobs/reconcileStripeOrders.js'));
const SRC = fs.readFileSync(
  path.join(ROOT, 'src/jobs/reconcileStripeOrders.js'), 'utf8');

/* Every PaymentIntent status Stripe can report, so the gate reasons over
   the whole space rather than the handful the author thought of. */
const ALL_PI = [
  'requires_payment_method', 'requires_confirmation', 'requires_action',
  'processing', 'requires_capture', 'canceled', 'succeeded',
];
const MONEY_IS_COMMITTED = ['requires_capture', 'succeeded', 'processing'];
const DECIDED_ORDER      = ['auth_only', 'captured', 'canceled', 'refunded'];

console.log('\n1. It settles exactly what it should');

for (const pi of MONEY_IS_COMMITTED) {
  for (const ps of ['pending', 'failed']) {
    check(job.shouldSettle(pi, ps).settle === true,
      `PI '${pi}' + order '${ps}' -> SETTLE`,
      ps === 'failed'
        ? 'This is the decline-then-retry case that stranded 00122 and 00125.'
        : 'This is an ordinary lost webhook.');
  }
}

console.log('\n2. It refuses everything else — the dangerous direction');

for (const pi of ALL_PI.filter(p => !MONEY_IS_COMMITTED.includes(p))) {
  for (const ps of ['pending', 'failed']) {
    check(job.shouldSettle(pi, ps).settle === false,
      `PI '${pi}' + order '${ps}' -> leave alone`,
      pi === 'canceled'
        ? 'Settling a CANCELED intent invents an order against money nobody holds — and this job runs unattended, so it would do it every 15 minutes.'
        : 'Nothing is committed yet; there is no authorisation to record.');
  }
}

for (const ps of DECIDED_ORDER) {
  check(job.shouldSettle('requires_capture', ps).settle === false,
    `an order already '${ps}' is never re-opened`,
    'A decided order re-settled would re-send the confirmation email at best, and resurrect a refunded order at worst.');
}

check(job.shouldSettle('none', 'pending').settle === false,
  'a session with no PaymentIntent at all is left alone',
  "An abandoned checkout has no intent; `typeof pi === 'object'` fails and piStatus is 'none'.");

console.log('\n3. The candidate query can actually find a stranded order');

const q = job.buildCandidateQuery(15, 10);
check(/stripe_session_id IS NOT NULL/.test(q.sql),
  'it only considers orders that reached Stripe',
  'Without a session id there is nothing to ask Stripe about.');
check(/stripe_session_id <> ''/.test(q.sql),
  "it treats an empty-string session id as absent",
  'An empty string is not NULL in MySQL and would be passed to Stripe as a lookup.');
for (const st of ['pending', 'failed']) {
  check(q.params.includes(st),
    `'${st}' is in the candidate set`,
    st === 'failed'
      ? 'Omitting it reproduces the exact blind spot this job exists to cover.'
      : 'This is the ordinary lost-webhook state.');
}
for (const st of DECIDED_ORDER) {
  check(!q.params.includes(st),
    `'${st}' is NOT in the candidate set`);
}
check(/created_at < \(NOW\(\) - INTERVAL \? MINUTE\)/.test(q.sql),
  'a minimum age keeps it from racing a healthy webhook');
check(/created_at > \(NOW\(\) - INTERVAL \? DAY\)/.test(q.sql),
  'a maximum age stops it chasing lapsed authorisations forever');
check(job.DEFAULT_MIN_AGE_MINUTES > 0 && job.DEFAULT_MIN_AGE_MINUTES <= 60,
  `the default minimum age (${job.DEFAULT_MIN_AGE_MINUTES} min) is sane`,
  'Zero races the webhook; hours mean a customer waits a morning for their email.');
check(job.DEFAULT_MAX_AGE_DAYS >= 7,
  `the default maximum age (${job.DEFAULT_MAX_AGE_DAYS} days) outlives a 7-day authorisation`,
  'Shorter than the authorisation lifetime and a lapsed order is never even reported.');

console.log('\n4. It drives the webhook handler, it does not reimplement it');

/* ⚠️ COMMENT-STRIPPED, AND THE CALL EXPRESSION, NOT THE NAME.
   Found by mutate_reconcile_gate R11: this read /_handleSessionCompleted/
   over the raw source, and the file's own header explains at length that it
   calls _handleSessionCompleted. So replacing the real call with
   Promise.resolve() left the prose behind and the gate stayed green while
   the backstop did nothing at all. Rule 18 corollary — quoting code in a
   comment makes the comment satisfy a grep for that code. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check(/await\s+checkout\._handleSessionCompleted\s*\(/.test(CODE),
  'it AWAITS checkoutController._handleSessionCompleted',
  'Rule 18: a second implementation of "authorisation becomes order" is the one nobody tests. Not awaiting it would also let the read-back below run before the write.');
check(!/UPDATE\s+orders\s+SET\s+payment_status/i.test(SRC),
  'it writes NO payment_status UPDATE of its own',
  'The moment it has its own UPDATE, the two paths start to differ and only one is gated.');
check(!/capturePayment|capture\(/.test(SRC),
  'it never captures',
  'Capture is a human decision. An unattended job must not take money.');
check(!/cancelAuthorization/.test(SRC),
  'it never cancels an authorisation at Stripe');

const checkoutSrc = fs.readFileSync(
  path.join(ROOT, 'src/controllers/checkoutController.js'), 'utf8');
check(/exports\._handleSessionCompleted\s*=/.test(checkoutSrc),
  'checkoutController still exports the handler this job depends on',
  'Removing the export breaks the backstop, and nothing else would notice.');

/* The handler the job calls must itself accept 'failed' — otherwise the
   reconciler faithfully finds every stranded order, calls the handler, and
   the handler quietly declines to act. Belt and braces across two files. */
/* ⚠️ ANCHORED ON payment_authorized_at, NOT ON THE CLAUSE ALONE.
   Found by mutate_reconcile_gate R13: `payment_status IN ('pending',
   'failed')` also appears in setOrderDetails, so narrowing the
   AUTHORISATION guard back to 'pending' left the other occurrence matching
   and the gate stayed green — while the backstop faithfully found every
   stranded order and the handler then refused to act on any of them. */
const authStates = ((checkoutSrc.match(
  /payment_authorized_at = NOW\(\)\s*\n\s*WHERE id = \? AND payment_status IN \(([^)]*)\)/
) || [, ''])[1]).split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);

check(authStates.includes('failed'),
  "the handler it calls accepts 'failed' too",
  'Otherwise this job finds the right rows and the handler does nothing with them — a backstop that reports success while fixing nothing.');
check(authStates.includes('pending'),
  "the handler it calls still accepts 'pending'");

console.log('\n5. The cron wrapper can actually start node');

/* ⚠️ THE GATE SAID NOTHING ABOUT THE WRAPPER, WHICH IS HOW THE BUG GOT IN.
   The first version of reconcile_stripe.sh ran a bare `node src/jobs/...`
   after `cd "$(dirname "$0")"`. Cron's PATH does not include node on
   Hostinger, so it would have exited 127 on EVERY run — writing one line to
   a log nobody reads while the owner believed the backstop was running.
   A backstop that silently never runs is worse than no backstop, because it
   is trusted. shipment_status_poll.sh had already solved and documented
   this; the wrapper now matches it, and this section keeps it that way. */
const WRAP_PATH = path.join(ROOT, 'reconcile_stripe.sh');
check(fs.existsSync(WRAP_PATH), 'the cron wrapper exists');

const WRAP = fs.existsSync(WRAP_PATH) ? fs.readFileSync(WRAP_PATH, 'utf8') : '';
const WRAP_CODE = WRAP.replace(/^\s*#.*$/gm, '');   // strip comments: they discuss `node`

check(/find_node\s*\(\)/.test(WRAP_CODE),
  'it resolves node explicitly rather than trusting PATH',
  "Cron's PATH has no node. A bare call exits 127 and the job never runs.");
check(/alt-nodejs\d+\/root\/bin\/node/.test(WRAP_CODE),
  'it searches the Hostinger alt-nodejs path',
  'root/bin/node, NOT root/usr/bin/node — getting that wrong is why an earlier job failed.');
check(!/^\s*node\s+src\/jobs/m.test(WRAP_CODE),
  'it does NOT invoke a bare `node`',
  'This exact line is what would have made the backstop a no-op on every cron run.');
check(/"\$NODE"\s+src\/jobs\/reconcileStripeOrders\.js/.test(WRAP_CODE),
  'it runs the reconciler through the resolved interpreter');
check(/exit 127/.test(WRAP_CODE),
  'it fails loudly and distinctly when node cannot be found');
check(/SETTLED/.test(WRAP_CODE),
  'the wrapper shouts when an order is settled',
  'A settlement means the WEBHOOK failed. Silence there is how this whole class of bug stayed invisible.');

console.log('\n6. Stated defaults match the documentation');

check(fs.existsSync(path.join(ROOT, 'docs/CHECKOUT_PAYMENT_LIFECYCLE.md')),
  'the lifecycle document exists',
  'This job is only half the fix; the other half is the state machine being written down.');

console.log(
  fail === 0
    ? `\nGREEN  ${pass} passed, 0 failed`
    : `\ngate_stripe_reconcile: FAILED ${fail} of ${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);
