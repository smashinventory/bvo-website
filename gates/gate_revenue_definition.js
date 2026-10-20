'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_revenue_definition.js
 *
 * THE RULE, in the owner's words (2026-10-19):
 *   "both the units and the revenue do not count until the authorization
 *    is captured."
 *
 * ONE rule, not two. A unit sold and a dollar earned become real at the
 * same moment, and no screen may disagree about when that is.
 *
 * WHAT WENT WRONG. Every dashboard carried its own WHERE clause and they
 * did not agree. The shared one in customerAnalyticsController read
 *
 *     o.is_test = 0 AND o.status <> 'cancelled'
 *
 * which excludes test rows and cancellations and NOTHING ELSE. An
 * abandoned checkout leaves status='pending', payment_status='pending'
 * (checkoutController:1522) and counted as both an order and a sale.
 * Customer 11 read "3 orders, $1,971" having paid nothing — three failed
 * attempts at one $657 purchase, on the days checkout itself was broken.
 *
 * WHAT THIS GUARDS:
 *
 *   1. ONE DEFINITION. No controller may hand-roll the predicate again.
 *   2. THE SQL AND THE JS AGREE. There are two implementations — a SQL
 *      fragment and a JS function — and they are run over the SAME fixture
 *      rows here. Two implementations of one rule is precisely how a
 *      definition starts drifting.
 *   3. EVERY MONEY SUM IS GATED. A SUM over order totals with no
 *      capture-gated WHERE is the bug, restated.
 *   4. THE COLUMNS THE PREDICATE READS ARE SELECTED. The JS version reads
 *      payment_captured_at off a row; a query that does not select it
 *      yields undefined and silently zeroes every total.
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};
const read = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

/* Comment-stripped. Every string checked below also appears in the prose
   explaining it — the mistake that cost four missed mutations on
   gate_newsletter_signups earlier today. */
const strip = s => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/^\s*\/\/.*$/gm,     m => m.replace(/[^\n]/g, ' '));

const CONSUMERS = [
  'src/controllers/customerAnalyticsController.js',
  'src/controllers/siteAnalyticsController.js',
  'src/controllers/ordersController.js',
  'src/controllers/adminController.js',
];

console.log('\ngate_revenue_definition — nothing counts until it is captured\n');

/* ── 1. the module ───────────────────────────────────────────────────── */
console.log('--- one definition ---');

let revenue = null;
try { revenue = require(path.join(ROOT, 'src/config/revenue.js')); }
catch (e) { check(false, 'src/config/revenue.js loads', e.message); }

if (!revenue) {
  console.log('\ngate_revenue_definition: FAILED — the module did not load\n');
  process.exit(1);
}

check(typeof revenue.predicates === 'function', 'it exports predicates()');
check(typeof revenue.isCounted  === 'function', 'it exports isCounted()');
check(typeof revenue.isAuthorized === 'function', 'it exports isAuthorized()');

const P = revenue.predicates('o');
check(/payment_captured_at IS NOT NULL/.test(P.IS_COUNTED),
      'IS_COUNTED requires a capture',
      'This is the whole rule. Without it, an authorization counts as a sale.');
check(/is_test = 0/.test(P.IS_COUNTED),
      'IS_COUNTED excludes test rows');
check(/status <> 'cancelled'/.test(P.IS_COUNTED),
      'IS_COUNTED excludes cancelled orders');
check(/payment_status NOT IN \('draft', 'pending'\)/.test(P.IS_COUNTED),
      'IS_COUNTED excludes the two placeholder payment states',
      "'pending' is what an abandoned checkout leaves behind — the original bug.");
check(/payment_captured_at IS NULL/.test(P.IS_AUTHORIZED),
      'IS_AUTHORIZED is the uncaptured side');

/* The alias goes into SQL. A caller-supplied identifier is the one place
   this module could become an injection point. */
let threw = false;
try { revenue.predicates('o; DROP TABLE orders; --'); } catch { threw = true; }
check(threw, 'a non-identifier table alias is refused, not interpolated');
check(revenue.predicates('').IS_COUNTED.startsWith('is_test'),
      "an empty alias produces unprefixed SQL for `FROM orders`");

/* ── 2. the SQL and the JS agree ─────────────────────────────────────── */
console.log('');
console.log('--- the two implementations agree ---');

/* Fixtures chosen to hit every branch, including the ones that produced
   the live bug. Each row is evaluated by the JS predicate and compared to
   what the SQL fragment would decide for the same values — the SQL is
   evaluated here by substituting the row in, which is what makes this a
   real comparison rather than two assertions of the same belief. */
const FIXTURES = [
  { label: 'abandoned checkout (the $1,971 bug)',
    row: { is_test: 0, status: 'pending', payment_status: 'pending', payment_captured_at: null },
    counted: false, authorized: false },

  { label: 'cart still being filled in',
    row: { is_test: 0, status: 'pending', payment_status: 'draft', payment_captured_at: null },
    counted: false, authorized: false },

  { label: 'authorized, awaiting capture',
    row: { is_test: 0, status: 'confirmed', payment_status: 'auth_only', payment_captured_at: null },
    counted: false, authorized: true },

  { label: 'captured — a real sale',
    row: { is_test: 0, status: 'confirmed', payment_status: 'captured',
           payment_captured_at: '2026-10-19 12:00:00' },
    counted: true, authorized: false },

  { label: 'captured then cancelled',
    row: { is_test: 0, status: 'cancelled', payment_status: 'captured',
           payment_captured_at: '2026-10-19 12:00:00' },
    counted: false, authorized: false },

  { label: 'test order, captured',
    row: { is_test: 1, status: 'confirmed', payment_status: 'captured',
           payment_captured_at: '2026-10-19 12:00:00' },
    counted: false, authorized: false },

  { label: 'is_test as the string "1" (mysql2 can return either)',
    row: { is_test: '1', status: 'confirmed', payment_status: 'captured',
           payment_captured_at: '2026-10-19 12:00:00' },
    counted: false, authorized: false },

  { label: 'refunded — captured stays true, gross revenue keeps it',
    row: { is_test: 0, status: 'refunded', payment_status: 'captured',
           payment_captured_at: '2026-10-19 12:00:00' },
    counted: true, authorized: false },
];

/* Evaluate the SQL fragment against a row, by substitution. Not a database
   — a tiny interpreter for the handful of operators the predicate uses. It
   exists so the SQL is actually EXECUTED against the fixture rather than
   eyeballed. */
function evalSql(frag, row) {
  return frag.split(' AND ').every(clause => {
    const c = clause.trim();
    let m;
    if ((m = c.match(/^o\.(\w+) IS NOT NULL$/)))  return row[m[1]] != null;
    if ((m = c.match(/^o\.(\w+) IS NULL$/)))      return row[m[1]] == null;
    if ((m = c.match(/^o\.(\w+) = (\d+)$/)))      return Number(row[m[1]]) === Number(m[2]);
    if ((m = c.match(/^o\.(\w+) <> '([^']*)'$/))) return row[m[1]] !== m[2];
    if ((m = c.match(/^o\.(\w+) NOT IN \((.+)\)$/))) {
      const vals = m[2].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
      return !vals.includes(row[m[1]]);
    }
    throw new Error('gate cannot evaluate SQL clause: ' + c);
  });
}

FIXTURES.forEach(f => {
  let sqlCounted, sqlAuth;
  try {
    sqlCounted = evalSql(P.IS_COUNTED, f.row);
    sqlAuth    = evalSql(P.IS_AUTHORIZED, f.row);
  } catch (e) {
    check(false, `SQL evaluates: ${f.label}`, e.message);
    return;
  }
  const jsCounted = revenue.isCounted(f.row);
  const jsAuth    = revenue.isAuthorized(f.row);

  check(sqlCounted === f.counted && jsCounted === f.counted,
        `${f.label} → counted: ${f.counted}`,
        `SQL said ${sqlCounted}, JS said ${jsCounted}, expected ${f.counted}`);
  check(sqlAuth === f.authorized && jsAuth === f.authorized,
        `${f.label} → in flight: ${f.authorized}`,
        `SQL said ${sqlAuth}, JS said ${jsAuth}, expected ${f.authorized}`);
});

/* Counted and authorized are mutually exclusive by construction. If both
   were ever true for one row, revenue and in-flight would double-count it. */
check(FIXTURES.every(f => !(f.counted && f.authorized)),
      'no row is both counted and in flight');

/* ── 3. nobody hand-rolls it ─────────────────────────────────────────── */
console.log('');
console.log('--- no controller redefines the rule ---');

CONSUMERS.forEach(f => {
  const code = strip(read(f));
  check(/config\/revenue/.test(code),
        `${path.basename(f)} loads the shared definition`);

  /* ⚠️ NO NEGATIVE LOOKAHEAD. The first version was
         /is_test = 0 AND o?\.?status <> 'cancelled'(?!.*payment_captured_at)/
     over a whitespace-collapsed file — so the whole file became ONE line
     and `.*payment_captured_at` always matched something further down,
     cancelling every hit. The harness proved it: restoring the exact old
     predicate into customerAnalytics was MISSED.

     A plain substring search for the ungated literal, with no escape
     hatch. If a report genuinely needs a variation, it goes in
     src/config/revenue.js — not back into a controller. */
  const flat = code.replace(/\s+/g, ' ');
  const ungatedLiteral =
    /is_test = 0 AND o\.status <> 'cancelled'"/.test(flat) ||
    /is_test = 0 AND status <> 'cancelled'"/.test(flat);
  check(!ungatedLiteral,
        `${path.basename(f)} does not re-declare the old ungated filter`,
        "The old predicate let every abandoned checkout through — it is the " +
        "$1,971. If a report needs a variation, add it to src/config/revenue.js.");
});

/* ── 4. every money sum is gated ─────────────────────────────────────── */
console.log('');
console.log('--- every sum over order totals is capture-gated ---');

CONSUMERS.forEach(f => {
  const code = strip(read(f));
  /* Find each SUM/AVG over an order total and look ahead for a gated
     WHERE or JOIN condition within the same statement. */
  /* ⚠️ THE AGGREGATE ITSELF MUST BE GATED — not merely sitting near one.
     The first version accepted any `CASE WHEN ${...}` within 200
     characters, so an ungated SUM(total) passed simply because a SIBLING
     column in the same SELECT was gated. The harness caught it: reverting
     the KPI strip to SUM(total) was MISSED.

     Two legitimate shapes, and nothing else:
       a) SUM(CASE WHEN ${PREDICATE} THEN total END)  — gated in place
       b) SUM(total) … WHERE ${PREDICATE}             — gated by the query */
  const GATE_RE = /\$\{[A-Za-z_.]*(COUNTED|O_OK|IS_AUTHORIZED|REV_COUNTED|AUTHORIZED)\}/;
  const sums = [...code.matchAll(/(?:SUM|AVG)\(\s*(?:CASE WHEN [^)]*?THEN\s*)?(?:o\.)?total\b/g)];
  const ungated = sums.filter(m => {
    /* (a) gated in place: the predicate sits INSIDE this aggregate's own
       CASE WHEN, between SUM( and the column. */
    if (GATE_RE.test(m[0])) return false;
    /* (b) gated by the statement: a WHERE/JOIN condition later in the same
       query. Bounded so it cannot borrow the gate from the NEXT query. */
    const stmt = code.slice(m.index, m.index + 900).split('`)')[0];
    return !new RegExp('(WHERE|AND)\\s*' + GATE_RE.source).test(stmt);
  });
  check(ungated.length === 0,
        `${path.basename(f)}: all ${sums.length} order-total aggregates are gated`,
        ungated.length
          ? `${ungated.length} SUM/AVG over order totals with no capture-gated ` +
            'WHERE within the statement. That is the original bug.'
          : '');
});

/* ── 5. the JS predicate's columns are selected ──────────────────────── */
console.log('');
console.log('--- the JS predicate can actually see its columns ---');

{
  const code = strip(read('src/controllers/customerAnalyticsController.js'));
  /* ⚠️ THE `spent` LINE SPECIFICALLY. The first version tested for
     `revenue.isCounted OR revenue.isAuthorized` anywhere in the file — so
     reverting `spent` to the old is_test-only filter still passed, because
     the in-flight line a few rows below still used isAuthorized. The
     harness caught that too.

     The check now names the field whose value was wrong. */
  check(/spent:\s*orders\.filter\(revenue\.isCounted\)/.test(code.replace(/\s+/g, ' ')),
        'the detail page computes `spent` with revenue.isCounted()',
        'It previously filtered on is_test alone — that is the $1,971 on ' +
        'customer 11, who had paid nothing.');
  check(/inFlight:\s*orders\.filter\(revenue\.isAuthorized\)/.test(code.replace(/\s+/g, ' ')),
        'and reports in-flight money with revenue.isAuthorized()');

  /* The query feeding it must select both columns the predicate reads. An
     unselected column is undefined, every row fails isCounted(), and the
     page shows $0 for a customer who has paid — silently. */
  const sel = code.match(/SELECT o\.id, o\.order_number[\s\S]{0,400}?FROM orders o/);
  check(!!sel, 'the detail order query was located');
  if (sel) {
    ['payment_status', 'payment_captured_at', 'is_test', 'status'].forEach(c =>
      check(new RegExp('o\\.' + c + '\\b').test(sel[0]),
            `it selects ${c}`,
            `revenue.isCounted() reads ${c}. Unselected, it is undefined, and ` +
            'every total silently becomes $0 — the same class as the checkout ' +
            '409 and the NULL payment intent in order_deletions.'));
  }
}

console.log('');
if (fail) {
  console.log(`gate_revenue_definition: FAILED ${fail} of ${pass + fail} checks\n`);
  process.exit(1);
}
console.log(`gate_revenue_definition: all ${pass} checks pass\n`);
