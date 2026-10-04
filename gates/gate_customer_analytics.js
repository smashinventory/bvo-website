#!/usr/bin/env node
/**
 * gate_customer_analytics.js
 *
 * Guards the Customers & Acquisition dashboard, added 2026-10-04.
 *
 * THE FAILURE MODES THIS EXISTS TO CATCH — all of which produce a page that
 * looks completely fine:
 *
 *  1. A METRIC COUNTING TEST RECORDS. Every customer and order in the
 *     database on 2026-10-04 was pre-cutover testing. Counted as real they
 *     report an AOV of $3,495 and a 100% account-order rate describing
 *     nobody. One analytics query missing `is_test = 0` is a wrong number
 *     presented with total confidence, and nothing errors.
 *
 *  2. A PANEL DRAWING A CHART IT CANNOT SUPPORT. Cohort retention over nine
 *     customers is not a weak signal, it is noise in the costume of a
 *     finding — and a chart is read as a claim whether or not the number
 *     under it is sound. Every report must carry a `sufficient` verdict and
 *     the template must branch on it.
 *
 *  3. ATTRIBUTION SPLITTING ITSELF. If one caller writes 'bundle' and
 *     another 'bundle_save', the source report silently reports one real
 *     number as two smaller wrong ones. The closed list in
 *     config/signupSources.js is the only permitted vocabulary.
 *
 *  4. SOURCE OVERWRITTEN ON SIGN-IN. signup_source answers "what acquired
 *     this customer". Writing it on every sign-in turns it into a
 *     last-touch field and the original answer is gone forever.
 *
 *  5. AN UNGUARDED ADMIN ROUTE. These pages list every customer email you
 *     hold.
 *
 * It cannot tell you whether the numbers are interesting. That is a read.
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const ejs  = require('ejs');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fails = 0;
const ok    = m => console.log('  PASS  ' + m);
const bad   = m => { console.log('  FAIL  ' + m); fails++; };
const check = (c, m) => c ? ok(m) : bad(m);

/* Comments stripped before every scan: this gate's own prose names is_test,
   signup_source and requireAuth, and a raw scan would match the explanation
   instead of the code — the trap this repo has shipped before. */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ctrl   = strip(read('src/controllers/customerAnalyticsController.js'));
const routes = strip(read('src/routes/admin.js'));
const model  = strip(read('src/models/Customer.js'));
const sql    = read('migrations/2026-10-04_customer_analytics.sql').replace(/^\s*--.*$/gm, '');

console.log('\ngate_customer_analytics');
console.log('='.repeat(72));

/* ── 1. No analytics query can see a test record ────────────────────────── */
console.log('\n1. Test records are excluded from every metric');

/* The controller may name those tables ONLY through the shared fragments.
   A raw `FROM customers` is how one query quietly starts counting tests. */
const rawCustomer = (ctrl.match(/FROM\s+customers(?!\s*WHERE\s+is_test)/gi) || []);
const rawOrder    = (ctrl.match(/FROM\s+orders\b/gi) || []);
check(/const REAL_CUSTOMER\s*=/.test(ctrl) && /const REAL_ORDER\s*=/.test(ctrl),
  'the shared table fragments exist');
/* EACH fragment separately. A whole-file search for "is_test = 0" was the
   first version of this check, and it stayed GREEN while C_OK was neutered
   to '1=1' — because O_OK still contained the string. Every customer metric
   was counting test records and the suite said fine. Caught by mutation
   test, which is the only reason this line reads the way it does. */
const cOk = (ctrl.match(/const C_OK\s*=\s*(['"`])(.*?)\1/) || [])[2] || '';
const oOk = (ctrl.match(/const O_OK\s*=\s*(['"`])(.*?)\1/) || [])[2] || '';
check(/\bis_test = 0\b/.test(cOk), `C_OK itself excludes test customers (is: ${cOk || 'missing'})`);
check(/\bis_test = 0\b/.test(oOk), `O_OK itself excludes test orders (is: ${oOk || 'missing'})`);

/* Known, deliberate exceptions, each justified in the controller:
     - detail()     reads one customer unfiltered, so a test account can be
                    opened and recognised as one
     - toggleTest() writes the flag
     - the excluded-count query, which exists to COUNT the tests
   Anything beyond these is a new unfiltered read and must be deliberate. */
const ALLOWED_RAW = 3;
check(rawCustomer.length + rawOrder.length <= ALLOWED_RAW,
  `at most ${ALLOWED_RAW} deliberate unfiltered reads (found ${rawCustomer.length + rawOrder.length})`);

/* Every aggregate that reports a figure must carry the predicate. */
for (const fn of ['kpis', 'trend', 'sources', 'repeatRate', 'ltv', 'cohorts', 'list']) {
  const m = ctrl.match(new RegExp(`(async )?function ${fn}\\s*\\([\\s\\S]{0,2600}?\\n\\}`));
  if (!m) { bad(`${fn}() not found`); continue; }
  check(/REAL_CUSTOMER|REAL_ORDER/.test(m[0]) && /C_OK|O_OK/.test(m[0]),
    `${fn}() filters through the shared fragments`);
}
check(/O_OK\s*=\s*['"`][^'"`]*is_test = 0[^'"`]*status <> 'cancelled'/.test(ctrl),
  'order metrics also exclude cancelled orders');

/* ── 2. Insufficient data degrades honestly ─────────────────────────────── */
console.log('\n2. A report without the data says so, and draws nothing');
check(/const NEED\s*=/.test(ctrl), 'thresholds are declared in one place');
for (const k of ['trend', 'sources', 'repeat', 'ltv', 'cohort']) {
  check(new RegExp(`${k}:\\s*\\{`).test(ctrl), `NEED.${k} is defined`);
}
check(/sufficient:\s*false/.test(ctrl), 'reports can return an insufficient verdict');
check(/months:\s*3/.test(ctrl),
  'cohort requires elapsed TIME as well as population — retention cannot be measured faster than it happens');

/* Rendered, not grepped: the template is what decides whether a chart is
   drawn, so the template is what gets run. */
{
  const tpl  = read('views/pages/admin/marketing/customers.ejs');
  const body = s => s.replace(/<style>[\s\S]*?<\/style>/g, '');
  const base = { cspNonce: 'n', csrfToken: 't', q: '', sort: 'recent',
    kpis: { customers: 0, new7d: 0, new30d: 0, orders: 0, revenue: 0, guestOrders: 0,
            aov: null, verified: 0, optedIn: 0, favorites: 0, bundles: 0 },
    excluded: { customers: 9, orders: 11 }, listing: { rows: [], total: 0, page: 1, pages: 1 } };
  const insuf = n => ({ sufficient: false, need: n, have: 0, rows: [] });
  const empty = ejs.render(tpl, { ...base,
    trend: insuf('10 customers'), sources: insuf('10 customers'),
    repeatRate: { sufficient: false, need: '25 customers', have: 0 }, ltv: insuf('25 orders'),
    cohorts: { sufficient: false, need: '100 customers and 3 months', have: '0 customers', rows: [] } });

  check(!/<canvas/.test(empty), 'no canvas when the data is insufficient');
  check(!/cdnjs/.test(empty), 'Chart.js is not even requested when there is nothing to draw');
  check((body(empty).match(/class="ca-pending"/g) || []).length === 5,
    'all five reports render their shortfall instead of a graphic');
  check(/Excluding 9 test customers and 11 test orders/.test(empty.replace(/\s+/g, ' ')),
    'the page states how many records it is ignoring');
  check(/Avg order[\s\S]{0,200}—/.test(empty),
    'AOV renders an em-dash with no orders — "$0 average" is a claim, "—" is not');

  const full = ejs.render(tpl, { ...base,
    kpis: { ...base.kpis, customers: 120, orders: 40, revenue: 140000, aov: 3500 },
    trend: { sufficient: true, rows: [{ day: '2026-10-01', signups: 3, orders: 1 }] },
    sources: { sufficient: true, rows: [{ key: 'bundle_save', label: 'Saved a bundle', n: 40, pct: 40 }] },
    repeatRate: { sufficient: true, oneTime: 30, repeat: 10, rate: 25 },
    ltv: { sufficient: true, rows: [{ band: 'Under $1k', customers: 5, avg_spend: 600 }] },
    cohorts: { sufficient: true, rows: [{ cohort: '2026-10', month_n: 0, buyers: 12 }] } });
  check(/<canvas id="caTrend"/.test(full), 'the chart IS drawn once the data supports it');
  check((body(full).match(/class="ca-pending"/g) || []).length === 0, 'no shortfall panels when sufficient');
}

/* ── 3. One vocabulary for attribution ──────────────────────────────────── */
console.log('\n3. Signup source cannot split into near-duplicates');
const SRC = require(path.join(ROOT, 'src/config/signupSources'));
check(typeof SRC.clean === 'function' && typeof SRC.label === 'function', 'the normaliser exists');
check(SRC.clean('bundle_save') === 'bundle_save', 'a known key passes through');
check(SRC.clean('BUNDLE_SAVE') === 'bundle_save', 'case is normalised');
check(SRC.clean('bundle') === null, 'a near-miss becomes NULL, not a new category');
check(SRC.clean(undefined) === null && SRC.clean('') === null, 'absent input is NULL');
check(SRC.label(null) === 'Unknown', 'NULL has an honest label');
check(/SIGNUP_SOURCES\.clean\(/.test(model),
  'Customer.js writes signup_source through the normaliser, never raw');
check((model.match(/INSERT INTO customers/g) || []).length ===
      (model.match(/SIGNUP_SOURCES\.clean\(/g) || []).length,
  'EVERY customer insert passes through the normaliser');

/* ── 4. Source is acquisition, not last touch ───────────────────────────── */
console.log('\n4. An existing customer keeps the source that acquired them');
const foc = model.match(/async findOrCreateByEmail[\s\S]{0,1200}?\n  \},/);
check(!!foc, 'findOrCreateByEmail found');
if (foc) {
  check(!/UPDATE customers[\s\S]{0,120}signup_source/i.test(foc[0]),
    'it never UPDATEs signup_source on an existing row');
  check(/if \(existing\) return/.test(foc[0]),
    'an existing customer returns before any write');
}

/* ── 5. The admin routes are guarded ────────────────────────────────────── */
console.log('\n5. These pages are behind the admin guard');
check(/\/marketing\/customers'/.test(routes), 'the routes are registered');
/* admin.js guards the whole router rather than per-route; assert that is
   still true rather than looking for a per-line middleware that was never
   there. Derived from the file, so a change to the scheme fails here. */
const guard = /router\.use\(\s*requireAdmin|router\.use\(\s*adminAuth|requireAdmin\s*\)/.test(routes)
           || /app\.use\('\/admin'[^\n]*requireAdmin/.test(strip(read('src/server.js')));
check(guard, 'the admin router is behind an auth guard');
check(!/marketing\/customers[^\n]*\bpublic\b/i.test(routes), 'no route is marked public');

/* ── 6. The migration only adds ─────────────────────────────────────────── */
console.log('\n6. The migration adds columns and takes nothing away');
check(/ADD COLUMN `signup_source`/.test(sql), 'signup_source added');
check(/ADD COLUMN `is_test`/.test(sql), 'is_test added');
check(!/\b(DROP\s+(TABLE|COLUMN|DATABASE)|TRUNCATE|DELETE\s+FROM)\b/i.test(sql),
  'no DROP / TRUNCATE / DELETE outside comments');
check(/UPDATE `customers` SET `is_test` = 1/.test(sql) && /UPDATE `orders` SET `is_test` = 1/.test(sql),
  'existing rows are flagged as tests');
check(/MAX\(`id`\)/.test(sql),
  'flagged by id, not by date — a real order arriving mid-migration is untouched');
check(/DEFAULT 0/.test(sql), 'new rows default to NOT a test');

console.log('\n' + '='.repeat(72));
console.log(fails === 0 ? 'gate_customer_analytics: PASS\n'
                        : `gate_customer_analytics: ${fails} FAILURE(S)\n`);
process.exit(fails === 0 ? 0 : 1);
