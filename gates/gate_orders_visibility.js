'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_orders_visibility.js
 *
 * THE RULE: THE DEFAULT ORDER LIST NEVER SILENTLY HIDES A ROW.
 *
 * Until 2026-10-22 the "All Statuses" option sent an empty status and the
 * controller quietly appended
 *
 *     AND o.status NOT IN ('draft','pending')
 *
 * The reasoning was sound — a draft is a half-typed checkout, a pending row
 * is an open Stripe session, and neither is work. The consequence was not.
 * BVO-2026-10-19-00122 and BVO-2026-10-21-00125 sat at 'pending' holding
 * live Stripe authorisations for $657 and $2,694.60, and were absent from
 * the ONE screen that would have revealed it, under a label saying "All".
 *
 * Worse: 'draft' is not in ORDER_STATUSES, so a draft row could not be
 * reached by any dropdown selection at all. It was unreachable through the
 * UI entirely.
 *
 * WHAT THIS GUARDS:
 *
 *   1. "All" MEANS ALL. An empty status filter adds no status predicate.
 *   2. HIDING IS OPT-IN AND NAMED. ACTIVE_ONLY is a distinct value, never
 *      the empty string — conflating the two is the original bug.
 *   3. THE ROWS ARE MARKED. A hidden row and an unmarked row are the same
 *      failure wearing different clothes.
 *   4. THE TEMPLATE'S COLUMNS ARE SELECTED. The badge reads
 *      stripe_session_id; an unselected column is undefined, so the badge
 *      would silently never render. This project's signature defect, and
 *      the reason this gate exists at all.
 *   5. THE RAG STRIP STAYS MEANINGFUL. Listing abandoned rows must not
 *      count them as work, or the strip becomes noise and people stop
 *      reading it — which recreates the blindness by another route.
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};

const cfg = require(path.join(ROOT, 'src/config/orderStatuses.js'));
const CTRL = fs.readFileSync(
  path.join(ROOT, 'src/controllers/ordersController.js'), 'utf8');
const VIEW = fs.readFileSync(
  path.join(ROOT, 'views/pages/admin/orders/index.ejs'), 'utf8');

/* Comments on this project quote old code at length — including the very
   predicate this gate forbids. Strip before matching. Rule 18 corollary. */
const CTRL_CODE = CTRL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const VIEW_CODE = VIEW.replace(/<%#[\s\S]*?%>/g, '');

console.log('\n1. "All Statuses" means all statuses');

check(!/NOT IN \('draft','pending'\)/.test(CTRL_CODE)
   && !/NOT IN \('draft', 'pending'\)/.test(CTRL_CODE),
  'the default list carries NO hardcoded draft/pending exclusion',
  'This literal is the 2026-10-22 defect. Hiding is now opt-in via ACTIVE_ONLY.');

/* Execute the branch rather than read it: build the WHERE the way the
   controller does and assert the empty case adds nothing. */
function buildWhere(status) {
  let where = 'WHERE 1=1'; const params = [];
  if (status === cfg.ACTIVE_ONLY) {
    where += ` AND o.status NOT IN (${cfg.ABANDONED_STATUSES.map(() => '?').join(',')})`;
    params.push(...cfg.ABANDONED_STATUSES);
  } else if (status) {
    where += ' AND o.status = ?'; params.push(status);
  }
  return { where, params };
}
check(buildWhere('').where === 'WHERE 1=1',
  'an empty status adds no predicate at all',
  'If this ever grows a clause again, a paid order can hide behind it.');
check(buildWhere('pending').params.includes('pending'),
  'an explicit status still filters to it');
check(/status === ACTIVE_ONLY/.test(CTRL_CODE),
  'the controller branches on ACTIVE_ONLY, not on a bare string');

console.log('\n2. Hiding is opt-in, named, and never the empty string');

check(cfg.ACTIVE_ONLY && cfg.ACTIVE_ONLY !== '',
  'ACTIVE_ONLY is a real value, not the empty string',
  'Empty means ALL. Conflating "all" with "active" is the original bug.');
check(Array.isArray(cfg.ABANDONED_STATUSES)
   && cfg.ABANDONED_STATUSES.includes('draft')
   && cfg.ABANDONED_STATUSES.includes('pending'),
  "ABANDONED_STATUSES covers 'draft' and 'pending'");
check(cfg.isAbandonedStatus('pending') === true
   && cfg.isAbandonedStatus('confirmed') === false
   && cfg.isAbandonedStatus('auth_only') === false,
  'isAbandonedStatus answers correctly for the states that matter');
check(new RegExp(`value="<%= ACTIVE_ONLY %>"`).test(VIEW_CODE)
   || /ACTIVE_ONLY/.test(VIEW_CODE),
  'the dropdown offers the opt-in hide explicitly');

console.log('\n3. Abandoned rows are MARKED, not removed');

check(/isAbandonedStatus\(o\.status\)/.test(VIEW_CODE),
  'the list badges abandoned rows',
  'A row shown but indistinguishable is the same failure as a row hidden.');
check(/stripe_session_id/.test(VIEW_CODE),
  'and distinguishes one that REACHED STRIPE from one that never did',
  'A session id is the difference between "cart abandoned" and "they may have paid".');

console.log('\n4. Every column the template reads is SELECTed');

/* The exact trap from docs §10: the drift guard read order.subtotal while
   the SELECT never fetched it, so toCents(undefined) was 0 and checkout
   409'd for fourteen days. */
for (const col of ['stripe_session_id', 'payment_status', 'status']) {
  check(new RegExp(`o\\.${col}\\b`).test(CTRL_CODE),
    `the list query selects ${col}`,
    'An unselected column is undefined, not null, and nothing throws. The badge would silently never render.');
}
/* ⚠️ THE LOCALS LINE, NOT THE IDENTIFIER ANYWHERE.
   This read `/isAbandonedStatus,/ || /isAbandonedStatus/` — and the second
   alternative matched the USAGE inside the ragCounts loop, so deleting it
   from the render locals left the gate green. mutate_orders_visibility V7
   found it. Same loose-grep shape as the four holes in
   gate_newsletter_signups and the three in gate_revenue_definition: a
   pattern that matches something ADJACENT to the thing being asserted.

   Anchored to a line that is nothing but the identifier and a comma, which
   is what a locals entry looks like and what a call site never does. */
/* ⚠️ THE TRAILING COMMENT IS ALLOWED FOR, AND LEAVING IT OUT COST A PASS.
   CTRL_CODE strips only FULL-LINE // comments; a trailing `// why` survives,
   so `^\s*name,\s*$` never matched the real locals line. Caught by running
   the gate rather than by reading it — the fourth time today that an
   assertion looked right and matched nothing. */
const LOCALS = n => `^\\s*${n},\\s*(\\/\\/.*)?$`;
const localsLine = n => new RegExp(LOCALS(n), 'm');
const countLocals = n => (CTRL_CODE.match(new RegExp(LOCALS(n), 'gm')) || []).length;

check(localsLine('isAbandonedStatus').test(CTRL_CODE),
  'isAbandonedStatus is passed to the template',
  'An EJS local that is missing throws ReferenceError and 500s the page.');
check(countLocals('isAbandonedStatus') >= 2,
  'and at BOTH render sites, not just one',
  'This controller renders the list from two places. Supplying the local at one leaves the other 500ing on the first abandoned row — and a gate that accepts one of two reports success for the wrong reason.');
check(localsLine('ACTIVE_ONLY').test(CTRL_CODE),
  'ACTIVE_ONLY is passed to the template');
check(countLocals('ACTIVE_ONLY') >= 2,
  'and at both render sites');

console.log('\n5. The RAG strip still counts work, not noise');

check(/if \(!isAbandonedStatus\(o\.status\)\) ragCounts\[o\.rag\]\+\+/.test(CTRL_CODE),
  'abandoned rows are listed but excluded from the RAG counts',
  'computeRag scores an abandoned cart RED (no vendor PO, no shipment). Counting them makes "Need Attention" meaningless, people stop reading it, and the blindness returns by another route.');

console.log('\n6. A decided order is not work — the RAG rule reads status');

/* ⚠️ EXECUTED, NOT READ. computeRag ignored order.status completely until
   2026-10-22 and no amount of reading it showed that: the code was correct
   -looking and returned a wrong colour. Calling it with a delivered order
   is the only thing that reveals it. Rule 14 is why it is exported. */
const { __computeRag: rag } = require(path.join(ROOT, 'src/controllers/ordersController.js'));
const hoursAgo = h => new Date(Date.now() - h * 36e5).toISOString();
const ord = (status, h) => ({ status, created_at: hoursAgo(h) });

/* 22 days old with NO vendor PO — the condition that made everything red
   while the JM email path was dead (task #369). */
/* ⚠️ HARDCODED, NOT LOOPED OVER cfg.TERMINAL_ORDER_STATUSES.
   The first version iterated the config list — so deleting 'cancelled'
   from it simply stopped testing 'cancelled', and the gate stayed green on
   a real regression. mutate_orders_visibility V14 found it. A test that
   draws its cases from its own subject agrees with every change to that
   subject; gate_order_delete hardcodes ORDER_CHILD_TABLES for exactly this
   reason. Rule 18. */
for (const st of ['delivered', 'cancelled', 'refunded']) {
  check(cfg.TERMINAL_ORDER_STATUSES.includes(st),
    `'${st}' is declared terminal in the config`);
  check(rag(ord(st, 22 * 24), null, null, null) === 'green',
    `a '${st}' order with no vendor PO is GREEN`,
    `Nothing further is owed. Before this, every ${st} order stayed red forever and no action by the owner could clear it, because no action was an input to the rule.`);
}

check(rag(ord('confirmed', 22 * 24), null, null, null) === 'red',
  "a 'confirmed' order with no vendor PO is still RED",
  'This is real work — the vendor still has to be told.');

/* ⚠️ THE ORDERING PROPERTY. A return lands on a delivered order by
   definition; if the terminal check ran first it would be invisible. */
check(rag(ord('delivered', 22 * 24), null, null,
          { status: 'requested', requested_at: hoursAgo(48) }) === 'red',
  'an open return on a DELIVERED order still flags RED',
  'Returns are tested BEFORE the terminal check. Reversing that order silences a return at the exact moment it matters.');

for (const st of ['shipped', 'in_transit']) {
  check(!cfg.TERMINAL_ORDER_STATUSES.includes(st),
    `'${st}' is NOT treated as terminal`,
    'Goods are moving. The ETA and tracking-scan rules are the attention those still need; calling them decided would silence a stalled delivery.');
}

console.log(
  fail === 0
    ? `\nGREEN  ${pass} passed, 0 failed`
    : `\ngate_orders_visibility: FAILED ${fail} of ${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);
