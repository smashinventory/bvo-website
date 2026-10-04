#!/usr/bin/env node
/**
 * gate_saved_bundles.js
 *
 * Guards "Save Your Bundle", added 2026-10-04.
 *
 * THE FAILURE MODES THIS EXISTS TO CATCH:
 *
 *  1. ONE CUSTOMER DELETING ANOTHER'S BUNDLE. The delete must scope on
 *     customer_id INSIDE the WHERE clause, not fetch-then-compare. A
 *     fetch-then-compare is one early return away from being wrong, and the
 *     bug is invisible until someone enumerates ids. Classic IDOR.
 *
 *  2. requireAuth ON THE SAVE ROUTE. That middleware REDIRECTS. The save is
 *     reached by fetch(), which follows redirects silently, so the browser
 *     would receive a login PAGE and try to JSON.parse it. The visitor sees
 *     "could not save" with no reason and no log. The handler must return
 *     401 itself, and the route must carry no auth middleware.
 *
 *  3. A STORED PRICE. saved_bundles holds product ids, never prices. A
 *     snapshot taken at save time and shown three weeks later is a figure
 *     the customer could reasonably expect us to honour. Asserted as the
 *     ABSENCE of price columns in the migration and the PRESENCE of a live
 *     products read in the page handler.
 *
 *  4. NAV DRIFT. The account nav is copy-pasted across four views with no
 *     shared partial. It had ALREADY drifted before this change —
 *     orders.ejs was missing Saved Items entirely. A link that exists on
 *     three pages out of four is how a feature quietly becomes unreachable.
 *
 * It cannot tell you whether anyone saves a bundle. That is a question for
 * the analytics, not the test suite.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fails = 0;
const ok    = m => console.log('  PASS  ' + m);
const bad   = m => { console.log('  FAIL  ' + m); fails++; };
const check = (c, m) => c ? ok(m) : bad(m);

/* Comments stripped before every scan. This gate's own rationale above names
   "requireAuth" and "price", and a raw scan would match the explanation
   rather than the code — a trap this repo has already shipped once. */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ctrl     = strip(read('src/controllers/bundleController.js'));
const acctRte  = strip(read('src/routes/account.js'));
const bundRte  = strip(read('src/routes/bundle.js'));
const sql      = read('migrations/2026-10-04_saved_bundles.sql').replace(/^--.*$/gm, '');
const main     = read('views/layouts/main.ejs');

console.log('\ngate_saved_bundles');
console.log('='.repeat(72));

/* ── 1. The delete cannot cross customers ───────────────────────────────── */
console.log('\n1. A customer can only delete their own bundle');
const del = ctrl.match(/exports\.deleteSavedBundle[\s\S]{0,900}?\n\};/);
check(!!del, 'deleteSavedBundle exists');
if (del) {
  const d = del[0];
  check(/DELETE FROM saved_bundles[\s\S]{0,120}WHERE[\s\S]{0,60}customer_id\s*=\s*\?/i.test(d),
    'customer_id is in the WHERE clause of the DELETE itself');
  check(/req\.session\.customerId/.test(d),
    'the customer id comes from the SESSION, never from the request body or params');
  check(!/req\.(body|query)\.customer/i.test(d),
    'customer id is never taken from client input');
}

/* ── 2. The save route returns 401 rather than redirecting ──────────────── */
console.log('\n2. The fetch()ed save route answers, it does not redirect');
check(/router\.post\(\s*'\/save'/.test(bundRte), 'POST /bundle/save is routed');
const saveLine = (bundRte.match(/router\.post\(\s*'\/save'[^\n]*/) || [''])[0];
check(!/requireAuth/.test(saveLine),
  'POST /bundle/save carries NO requireAuth (it redirects; fetch would parse a login page)');
check(!/requireAuth/.test(bundRte),
  'the bundle router does not import or use requireAuth anywhere');
const save = ctrl.match(/exports\.saveBundle[\s\S]{0,2600}?\n\};/);
check(!!save, 'saveBundle exists');
if (save) {
  check(/status\(401\)/.test(save[0]), 'saveBundle returns 401 when signed out');
  check(/req\.session[\s\S]{0,40}customerId/.test(save[0]), 'it reads the session for the customer');
  check(/INSERT INTO saved_bundles/i.test(save[0]), 'it inserts into saved_bundles');
  check(/customer_id/.test(save[0]), 'the insert records which customer owns the row');
}
/* The two account-side routes DO redirect, and SHOULD be guarded. */
check(/router\.get\('\/bundles',\s*requireAuth/.test(acctRte.replace(/\s+/g, ' ').replace(/ ,/g, ',')) ||
      /\/bundles'[^\n]*requireAuth/.test(acctRte),
  'GET /account/bundles IS behind requireAuth (a page, so a redirect is correct)');
check(/\/bundles\/:id\/delete'[^\n]*requireAuth/.test(acctRte),
  'POST /account/bundles/:id/delete IS behind requireAuth');

/* ── 3. No stored price ─────────────────────────────────────────────────── */
console.log('\n3. Prices are read live, never stored');
check(/CREATE TABLE IF NOT EXISTS\s+`?saved_bundles`?/i.test(sql), 'the migration creates saved_bundles');
/* Two ways, because one is not enough. `\btotal\b` does NOT match
   `saved_total` — the underscore is a word character, so there is no
   boundary — and a mutation adding exactly that column slipped straight
   through the first version of this check. Caught by mutation test.
   The type check is the backstop: a saved bundle has no monetary column
   of any kind, so no DECIMAL/FLOAT/DOUBLE belongs in this table whatever
   it is named. */
check(!/\w*(price|total|amount|cost|subtotal)\w*\s*`?\s+(DECIMAL|FLOAT|DOUBLE|INT|BIGINT)/i.test(sql),
  'no column named like money (price / total / amount / cost), including suffixed forms');
check(!/\b(DECIMAL|FLOAT|DOUBLE)\s*\(/i.test(sql),
  'no DECIMAL / FLOAT / DOUBLE column at all — a saved bundle stores no money');
const page = ctrl.match(/exports\.savedBundlesPage[\s\S]{0,3000}?\n\};/);
check(!!page, 'savedBundlesPage exists');
if (page) {
  check(/FROM products/i.test(page[0]), 'the page reads products live to price a saved bundle');
  check(/is_active/.test(page[0]), 'it checks is_active so a withdrawn product drops out');
}

/* ── 4. The migration only adds ─────────────────────────────────────────── */
console.log('\n4. The migration adds and does not take away');
/* Matched as STATEMENTS, not as words. `ON DELETE CASCADE` is a foreign-key
   clause and `ON UPDATE current_timestamp()` is a column default — both
   contain a destructive keyword and neither destroys anything. A bare \b
   word match flagged the FK this migration is supposed to have, which is a
   gate that goes red on correct SQL. */
check(!/\b(DROP\s+(TABLE|COLUMN|DATABASE|INDEX)|ALTER\s+TABLE|TRUNCATE\s+TABLE?|DELETE\s+FROM|UPDATE\s+\w+\s+SET)\b/i.test(sql),
  'no DROP TABLE / ALTER TABLE / TRUNCATE / DELETE FROM / UPDATE…SET outside comments');
check(/REFERENCES\s+`?customers`?/i.test(sql), 'foreign key to customers');
check(/ON DELETE CASCADE/i.test(sql), 'bundles are removed with their customer, not orphaned');

/* ── 5. One definition of a bundle's shape ──────────────────────────────── */
console.log('\n5. The four slots are defined once');
check(/const BUNDLE_SLOTS\s*=/.test(ctrl), 'BUNDLE_SLOTS exists');
const slots = (ctrl.match(/const BUNDLE_SLOTS\s*=[\s\S]*?\];/) || [''])[0];
for (const s of ['cabinet', 'top', 'mirror', 'faucet']) {
  check(slots.includes(`'${s}'`) || slots.includes(`${s}_id`), `BUNDLE_SLOTS covers ${s}`);
}
check(/BUNDLE_SLOTS\.forEach|for \(const s of BUNDLE_SLOTS\)/.test(ctrl),
  'the read path iterates BUNDLE_SLOTS rather than restating the four slots');

/* ── 6. The nav link exists on EVERY account page ───────────────────────── */
console.log('\n6. Saved Bundles is reachable from every account page');
const navViews = ['dashboard', 'orders', 'favorites', 'bundles'];
for (const v of navViews) {
  const t = read(`views/pages/account/${v}.ejs`);
  check(t.includes('/account/bundles'), `account/${v}.ejs links to /account/bundles`);
  check(t.includes('/account/favorites'), `account/${v}.ejs links to /account/favorites (drift check)`);
}

/* ── 7. CSS shipped and cache busted ────────────────────────────────────── */
console.log('\n7. Styles in both files, behind a bumped cache key');
for (const f of ['public/css/site2.css', 'public/css/site-bundle.css']) {
  check(/\.sb-card\{/.test(read(f)), `${f} carries .sb-card`);
  check(/\.bb-save-btn\{/.test(read(f)), `${f} carries .bb-save-btn`);
}
const v = main.match(/site-bundle\.css\?v=(\d+)/);
check(v && Number(v[1]) >= 33,
  `bundle cache key >= 33 (found ${v ? v[1] : 'none'}) — numeric, so a later bump stays green`);

/* ── The two buttons are one size ───────────────────────────────────────
   They sit one above the other, so unequal widths read as a mistake. Both
   conditions are needed and neither is sufficient alone:
     - the group must STRETCH, or each button sizes to its own text
     - both must share ONE size declaration, or padding drifts on one and
       the heights stop matching
   Asserted as the shared selector rather than as two matching rules,
   because two rules that happen to agree today are not a guarantee. */
for (const f of ['public/css/site2.css', 'public/css/site-bundle.css']) {
  const css = read(f);
  const grp = (css.match(/\.bb-sum-btn-group\{[^}]*flex-direction:column[^}]*\}/) || [''])[0];
  check(/align-items:\s*stretch/.test(grp),
    `${f}: the button group stretches its children (is: ${grp.match(/align-items:[^;}]*/) || 'unset'})`);
  check(/\.bb-cart-btn,\s*\.bb-save-btn\{/.test(css),
    `${f}: both buttons share ONE size declaration`);
}

/* ── 8. The builder wires the button ────────────────────────────────────── */
console.log('\n8. The builder button is wired');
const bb = read('views/pages/bundle-builder.ejs');
check(/id="bb-save-bundle"/.test(bb), 'the Save button exists');
check(/bb-save-bundle'\)\)\s*\{\s*saveBundle\(\)/.test(bb.replace(/\s+/g, ' ')) ||
      /saveBundle\(\)/.test(bb), 'the click handler calls saveBundle()');
/* ── THE MOUNT PREFIX ───────────────────────────────────────────────────
   The router defines '/save'; server.js decides what that becomes. It is
   mounted at '/bundle-builder', NOT '/bundle', and the first version of
   this feature shipped a client posting to '/bundle/save' — a 404, which
   fetch() reports as a failed save with no clue why. The original gate
   checked the route path INSIDE the router and the fetch target
   separately, so both were "correct" and the join between them was wrong.

   Derived from server.js, never written out here: hardcoding the prefix
   would make this assertion agree with itself rather than with the app. */
const serverJs = strip(read('src/server.js'));
const mountM   = serverJs.match(/app\.use\(\s*'([^']+)'\s*,\s*require\(\s*'\.\/routes\/bundle'\s*\)\s*\)/);
check(!!mountM, 'the bundle router mount is found in server.js');
if (mountM) {
  const prefix = mountM[1];
  console.log(`         (bundle router is mounted at ${prefix})`);
  check(bb.includes(`fetch('${prefix}/save'`),
    `the builder posts to ${prefix}/save — the REAL mounted path, not the router-local one`);
  check(!/fetch\('\/bundle\/save'/.test(bb),
    'the builder does not post to /bundle/save (that prefix is not mounted)');

  /* Every link the feature emits to the builder must use the same prefix. */
  for (const f of ['views/pages/account/bundles.ejs', 'views/pages/bundle-builder.ejs']) {
    const t = read(f);
    check(!/(href|encodeURIComponent\()\s*=?\s*['"]\/bundle['"]/.test(t),
      `${f} has no link to the unmounted /bundle`);
  }
}
check(/status === 401/.test(bb), 'it handles the signed-out 401 by sending them to sign in');
check(/'Add Bundle to Cart'/.test(bb), 'Add to Cart is still present and unchanged');

console.log('\n' + '='.repeat(72));
console.log(fails === 0 ? 'gate_saved_bundles: PASS\n'
                        : `gate_saved_bundles: ${fails} FAILURE(S)\n`);
process.exit(fails === 0 ? 0 : 1);
