#!/usr/bin/env node
'use strict';

/* gate_inventory_risk.js — the Stock watch strip on the orders dashboard.
 *
 * WHAT THIS FEATURE IS FOR. BVO_COMMERCE_STACK_BRIEF.md §2: "If vendor
 * stock is 2 or below, call the vendor for verbal confirmation." Staff make
 * that call on every order. This aims it at the orders that need it.
 *
 * THE RISKS WORTH GATING, in order of how badly each would mislead:
 *
 *   1. NULL READ AS ZERO. A SKU with no inventory row must be 'unknown',
 *      never 'in stock' and never 'oversold'. This was WRONG IN THE FIRST
 *      VERSION of classify(): Number(null) is 0, a perfectly finite number,
 *      so a missing row arrived as "zero stock" and classified as OVERSOLD.
 *      Nothing about the code read as wrong. Checks 1-6.
 *   2. Abandoned checkouts counted as demand. status='pending' is shared by
 *      real orders and carts nobody paid for; counting the latter inflates
 *      every figure. Checks 12-14.
 *   3. A fourth severity invented in the view, so the page and the rule
 *      disagree about what is an emergency. Checks 15-17.
 *   4. The strip reporting one page of the list rather than the queue.
 *   5. It blocking something. It must never refuse an order.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let checks = 0, fails = 0;
const ok    = m => { checks++; console.log('  ok   ' + m); };
const bad   = (m, d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const read  = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

/* Comments out. The module and the controller both EXPLAIN these rules at
   length and name every phrase asserted below; grepping raw source would
   match the rationale instead of the rule. Found four times on this project
   before it became reflex. */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ')
                    .replace(/^\s*\/\/.*$/gm, ' ')
                    .replace(/<%#[\s\S]*?%>/g, ' ');

process.env.DB_PASS = process.env.DB_PASS || 'gate-placeholder';

const INV      = require(path.join(ROOT, 'src/config/inventoryRisk'));
const CTRL_RAW = read('src/controllers/ordersController.js');
const CTRL     = strip(CTRL_RAW);
const VIEW_RAW = read('views/pages/admin/orders/index.ejs');
const VIEW     = strip(VIEW_RAW);
const MOD      = strip(read('src/config/inventoryRisk.js'));

console.log('\ngate_inventory_risk — the stock watch tells the truth\n');

/* ── 1. NULL IS NOT ZERO ─────────────────────────────────────────────── */
console.log('--- absence of data is not evidence of stock ---');
check(INV.classify({ stock_unknown: 1 }) === 'unknown',
      'an explicit stock_unknown flag is unknown');
check(INV.classify({ qty_on_hand: null, demand: 1 }) === 'unknown',
      'a NULL qty_on_hand is unknown, NOT oversold',
      'Number(null) is 0 — this exact case shipped wrong in the first version');
check(INV.classify({ qty_on_hand: undefined, demand: 1 }) === 'unknown',
      'an undefined qty_on_hand is unknown too');
check(INV.classify({ qty_on_hand: 0, demand: 1, allow_backorder: 0 }) !== 'unknown',
      'a REAL zero is not unknown — the two must stay distinguishable',
      'collapsing them would hide genuinely out-of-stock SKUs');
check(INV.classify({}) === 'unknown' && INV.classify(null) === 'unknown',
      'an empty or missing row is unknown, not a crash');
/* The guard exists. Note it is its PRESENCE that matters, not its
   position: moving it below Number() is behaviourally inert, which the
   harness demonstrated. Removing it is the defect, and checks 2 and 3
   above catch that by behaviour. This one documents the intent. */
check(/qty_on_hand === null/.test(MOD) && /qty_on_hand === undefined/.test(MOD),
      'the explicit null/undefined guard is present in the source',
      'without it Number(null) is 0 and a missing row reads as zero stock');

/* ── 2. THE LADDER ───────────────────────────────────────────────────── */
console.log('--- severity ---');
check(INV.classify({ qty_on_hand: 1, demand: 3, allow_backorder: 0 }) === 'oversold',
      'demand above stock is oversold');
check(INV.classify({ qty_on_hand: INV.LOW_STOCK_AT, demand: 1, allow_backorder: 0 }) === 'critical',
      `stock at the threshold (${INV.LOW_STOCK_AT}) is critical`);
check(INV.classify({ qty_on_hand: INV.LOW_STOCK_AT + 1, demand: 1, allow_backorder: 0 }) === 'ok',
      'one above the threshold is ok — the boundary is inclusive');
check(INV.classify({ qty_on_hand: 1, demand: 9, allow_backorder: 1 }) === 'backorder',
      'a backorderable SKU is never oversold',
      'the vendor has agreed to supply; calling that an emergency hides real ones');
check(INV.LOW_STOCK_AT === 2,
      'the threshold is 2, matching SOP §2',
      'if the SOP changes, change it here — not in a query');

/* ── 3. ONLY REAL ORDERS ARE DEMAND ──────────────────────────────────── */
console.log('--- abandoned checkouts are not demand ---');
const REV = require(path.join(ROOT, 'src/config/revenue')).predicates('o');
check(typeof REV.IS_REAL === 'string' && REV.IS_REAL.length > 0,
      'revenue.js exposes IS_REAL');
/* ⚠️ PER STATE, NOT AS ONE LITERAL CLAUSE. This matched the whole string
   `NOT IN ('draft', 'pending')`, so it went red on 2026-10-21 when 'failed'
   was ADDED — a stricter, more correct rule. A gate that fails on a right
   answer gets edited away, and then it guards nothing. Each state is its
   own assertion, which still fails if one is dropped. */
for (const [st, why] of [
  ['draft',   "status='pending' alone also matches carts nobody paid for"],
  ['pending', 'an abandoned checkout is not demand'],
  ['failed',  'a DECLINED card must not reserve vendor stock — nothing was ever committed to that customer'],
]) {
  check(new RegExp(`payment_status NOT IN \\([^)]*'${st}'`).test(REV.IS_REAL),
        `IS_REAL excludes the '${st}' placeholder state`, why);
}
check(/is_test = 0/.test(REV.IS_REAL) && /status <> 'cancelled'/.test(REV.IS_REAL),
      'and excludes test rows and cancellations');
check(REV.IS_COUNTED.startsWith(REV.IS_REAL) && REV.IS_AUTHORIZED.startsWith(REV.IS_REAL),
      'IS_REAL is genuinely the shared base of the other two, not a fourth variant',
      'if it drifts, three predicates disagree about what an order is');
check(/REV_BASE/.test(CTRL) && /predicates\('o'\)\.IS_REAL/.test(CTRL),
      'the controller uses IS_REAL, aliased to o');
check(!INV.OPEN_DEMAND_STATUSES.includes('shipped') &&
      !INV.OPEN_DEMAND_STATUSES.includes('delivered') &&
      !INV.OPEN_DEMAND_STATUSES.includes('cancelled'),
      'shipped, delivered and cancelled are not open demand',
      'their allocation is already made or released');

/* ── 4. THE VIEW RENDERS THE RULE, NOT ITS OWN ───────────────────────── */
console.log('--- one source for severity ---');
check(/INV\.LABELS\[/.test(VIEW_RAW),
      'the view reads labels from INV.LABELS');
check(!/'oversold'|"oversold"/.test(VIEW),
      'the view does not hard-code a severity name',
      'a fourth state invented here would never match the rule');
check(Object.keys(INV.LABELS).sort().join(',') === 'backorder,critical,oversold,unknown',
      'LABELS covers exactly the four severities and no more');
check(/severity === 'unknown' \? '—'/.test(VIEW_RAW),
      "the view prints an em dash for unknown, never a number",
      'a 0 there asserts a fact we do not have');

/* ── 5. SCOPE AND SAFETY ─────────────────────────────────────────────── */
console.log('--- scope, performance and blast radius ---');
const listFn = (CTRL.match(/exports\.list[\s\S]*?\n};/) || [''])[0];
check(/FROM order_items oi/.test(listFn),
      'the risk aggregate lives in list()');
/* ⚠️ THE WINDOW RUNS TO THE END OF THE SQL LITERAL, not to GROUP BY. The
   first version stopped at `GROUP BY oi.sku`, so a LIMIT appended AFTER
   that — the only place anyone would put one — fell outside the window and
   the mutation was MISSED. */
const aggSql = (listFn.match(/FROM order_items[\s\S]*?GROUP BY oi\.sku[\s\S]{0,40}/) || [''])[0];
check(aggSql.length > 0 && !/LIMIT/i.test(aggSql),
      'the aggregate is NOT limited to the current page',
      'the strip answers a question about the whole queue, not one page of it');
/* ⚠️ SCOPED TO list(), NOT THE FILE. ordersController has four
   `FROM order_items oi` queries — detail() and the delete path use the
   others, legitimately. Counting file-wide asserted 1 and found 4, which
   is the check being wrong rather than the code. The claim that matters
   is that THE LIST HANDLER runs exactly one. */
check((listFn.match(/FROM order_items oi/g) || []).length === 1,
      'list() runs exactly one aggregate, not one per row',
      'a per-order lookup would be N+1 on every page view');
check(/catch \(err\)[\s\S]{0,400}inventory risk query failed/.test(CTRL),
      'the query fails soft and is logged',
      'a prioritisation aid must not take the orders dashboard down');
check(/COALESCE\(oi\.product_id, p\.id\)/.test(CTRL),
      'inventory is joined through COALESCE(product_id, products.sku match)',
      'order_items.product_id is ON DELETE SET NULL — product_id alone drops orphans');

/* ── 6. IT MUST NEVER BLOCK ──────────────────────────────────────────── */
console.log('--- it warns, it does not refuse ---');
const CART = strip(read('src/controllers/cartController.js'));
check(!/inventoryRisk|qty_on_hand/.test(CART),
      'the cart does not consult stock',
      'SOP §2 makes staff the control; a hard block refuses orders on stale data');
/* ⚠️ SCOPED TO THE try BLOCK. A fixed 1500-character window from the
   phrase "inventory risk" ran off the end of list() and into detail()'s
   `return res.status(404)` — flagging an unrelated, correct 404 as if the
   risk path rejected a request. Same over-match shape as the
   cookielessShare declaration grep. Bounded by the block instead. */
const riskBlock = (listFn.match(/let inventoryRisk[\s\S]*?inventory risk query failed[^\n]*\n/) || [''])[0];
check(riskBlock.length > 0, 'the risk block can be isolated for inspection');
check(!/throw |res\.status\(/.test(riskBlock),
      'nothing in the risk path rejects a request',
      'it is a prioritisation aid; refusing an order is never its job');

/* ── 7. STALENESS IS VISIBLE ─────────────────────────────────────────── */
console.log('--- the snapshot says how old it is ---');
check(INV.isStale(null) === true, 'never synced counts as stale');
check(INV.isStale(new Date()) === false, 'a fresh sync is not stale');
check(INV.isStale(new Date(Date.now() - (INV.STALE_AFTER_HOURS + 2) * 3600e3)) === true,
      `a sync older than ${INV.STALE_AFTER_HOURS}h is stale`);
check(INV.STALE_AFTER_HOURS > 24,
      'the window is longer than the nightly cycle',
      'a 24h window would flag every morning before the feed runs');
check(/inv-risk-stale|stock data is stale/.test(VIEW_RAW),
      'the view warns when the feed has not run');
check(/stock as of/.test(VIEW_RAW),
      'and prints the as-of time when it has',
      'a figure with no age invites false confidence in a nightly snapshot');

/* ── 8. qty_reserved STAYS UNUSED ────────────────────────────────────── */
console.log('--- the trap column ---');
check(!/qty_reserved/.test(CTRL) && !/qty_reserved/.test(MOD),
      'neither the controller nor the rule reads qty_reserved',
      'the column exists, is commented "held in open orders", and is NEVER WRITTEN — it is always 0');

/* ── 9. IT LOADS ─────────────────────────────────────────────────────── */
console.log('--- it loads ---');
let loadOk = true;
try {
  require(path.join(ROOT, 'src/controllers/ordersController.js'));
  require(path.join(ROOT, 'src/routes/admin.js'));
} catch (e) { loadOk = false; bad('the controller and routes load', e.message); }
if (loadOk) ok('the controller and routes load at require time');

/* ── 10. THE VIEW RENDERS, ALL FOUR STATES ───────────────────────────── */
console.log('--- the view renders every severity ---');
try {
  const ejs = require('ejs');
  const F   = 'views/pages/admin/orders/index.ejs';
  const mk  = r => ({ ...r, severity: INV.classify(r) });
  const skus = [
    mk({ sku: 'A', name: 'Oversold item',  demand: 3, order_count: 2, order_ids: '11,12', qty_on_hand: 1, allow_backorder: 0 }),
    mk({ sku: 'B', name: 'Low item',       demand: 1, order_count: 1, order_ids: '13',    qty_on_hand: 2, allow_backorder: 0 }),
    mk({ sku: 'C', name: 'Unknown item',   demand: 1, order_count: 1, order_ids: '14',    stock_unknown: 1, qty_on_hand: null }),
  ].filter(r => INV.isActionable(r.severity));

  const locals = {
    ...require(path.join(ROOT, 'src/config/orderDeleteReasons')),
    ORDER_STATUSES: require(path.join(ROOT, 'src/config/orderStatuses')).ORDER_STATUSES,
    /* ⚠️ ADDED 2026-10-22 WITH THE ABANDONED-ROW BADGE, AND THIS GATE IS
       WHY IT WAS CAUGHT. The orders list now marks draft/pending rows
       instead of hiding them, which needs two new locals. A missing EJS
       local is a ReferenceError that 500s the whole page — and the
       source-matching gate written alongside the feature could not see it,
       because it checked that the CONTROLLER passes them, not that the
       TEMPLATE can render without them.

       Rule 18: these come from the real module, not typed out, so the
       fixture cannot drift from what a real request carries. */
    isAbandonedStatus: require(path.join(ROOT, 'src/config/orderStatuses')).isAbandonedStatus,
    ACTIVE_ONLY:       require(path.join(ROOT, 'src/config/orderStatuses')).ACTIVE_ONLY,
    activePage: 'orders', pageTitle: 'Orders', flash: null,
    orders: [
      { id: 11, order_number: 'A1', rag: 'green', status: 'confirmed', inventoryRisk: true,  total: 1, created_at: new Date(), customer_name: 'x', guest_email: 'x@y.z' },
      { id: 90, order_number: 'A2', rag: 'green', status: 'confirmed', inventoryRisk: false, total: 1, created_at: new Date(), customer_name: 'y', guest_email: 'y@y.z' },
    ],
    total: 2, page: 1, pages: 1, limit: 25, status: '', search: '',
    ragCounts: { red: 0, yellow: 0, green: 2 },
    inventoryRisk: { skus, orderIds: new Set([11, 12, 13, 14]), counts: {}, lastSyncedAt: new Date(), stale: false },
    INV, csrfToken: 't', cspNonce: 'n',
  };
  const html = ejs.render(read(F), locals, { filename: path.join(ROOT, F) });

  check(html.includes('Stock watch'),            'the strip renders');
  check(html.includes(INV.LABELS.oversold.text), 'the oversold row renders');
  check(html.includes(INV.LABELS.critical.text), 'the critical row renders');
  check(html.includes(INV.LABELS.unknown.text),  'the unknown row renders');
  check((html.match(/inv-flag/g) || []).length === 1,
        'the row flag appears on the affected order only',
        'a flag on every row stops being read');

  /* Healthy and empty: the strip must disappear entirely rather than
     render an empty box that trains people to ignore the area. */
  const quiet = ejs.render(read(F), {
    ...locals,
    inventoryRisk: { skus: [], orderIds: new Set(), counts: {}, lastSyncedAt: new Date(), stale: false },
    orders: locals.orders.map(o => ({ ...o, inventoryRisk: false })),
  }, { filename: path.join(ROOT, F) });
  check(!quiet.includes('Stock watch'), 'a healthy, current queue renders no strip at all');

  /* The controller's own failure default must still render. */
  const broke = ejs.render(read(F), {
    ...locals,
    inventoryRisk: { skus: [], orderIds: new Set(), counts: {}, lastSyncedAt: null, stale: true },
  }, { filename: path.join(ROOT, F) });
  check(broke.length > 0 && /never synced|stale/.test(broke),
        "the query-failed default renders and says the data is missing");
} catch (e) {
  bad('the view renders', e.message);
}

console.log('\n' + (fails
  ? 'gate_inventory_risk: FAILED ' + fails + ' of ' + checks
  : 'gate_inventory_risk: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
