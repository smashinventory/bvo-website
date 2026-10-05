'use strict';
/* THE PUBLIC SLICE OF site4.css MUST BE IN site-bundle.css.
 *
 * ⚠️ WHY THIS GATE EXISTS. site4.css is two files in one trenchcoat:
 * everything above the ORDER MANAGEMENT banner is PUBLIC responsive
 * polish (checkout layout, PDP colour chips, nav touch targets, the
 * split hero, the mobile mega-menu, button hover states, and the rule
 * that stacks the bundle-teaser cards on a phone); everything below is
 * admin-only and is loaded separately by layouts/admin.ejs.
 *
 * Only the public half belongs in the public bundle. site4.css itself
 * reaches no public page - site-bundle.css is the only stylesheet the
 * storefront loads.
 *
 * On 2026-09-?? commit 83e81b4 ("Passwordless sign-in") rebuilt the
 * bundle with a plain `cat brand.css site.css site2.css` and dropped the
 * entire public slice - 7,892 bytes, 46 selector groups. NOTHING FAILED.
 * No build broke, no page 404'd, every gate passed. The site simply lost
 * a layer of responsive polish on every page and stayed that way for
 * weeks, until the owner noticed cards that used to line up no longer
 * did and said "something we did is undoing a lot of our styling".
 *
 * He was right, and he should not have had to be the detector. A silent
 * subtraction is the worst failure mode there is: the only evidence is
 * an absence, and absences do not show up in a diff you are reading for
 * what you added.
 *
 * The old main.ejs recipe made this worse by specifying the boundary as
 * A BYTE COUNT (`head -c 7984`), which drifts every time site4.css is
 * edited and tells you nothing when it is wrong. The boundary is now the
 * ORDER MANAGEMENT comment - a thing you can see.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

const MARK = '/* ================================================================\n   ORDER MANAGEMENT';

const s4  = fs.readFileSync(path.join(ROOT, 'public/css/site4.css'), 'utf8');
const bun = fs.readFileSync(path.join(ROOT, 'public/css/site-bundle.css'), 'utf8');

console.log('--- the boundary is findable ---');
const i = s4.indexOf(MARK);
ok('site4.css still has the ORDER MANAGEMENT banner', i > -1,
   'the public/admin boundary marker is gone - do not guess a byte count, restore the marker');
if (i < 0) { console.log('\n*** 1 GATE(S) FAILED ***'); process.exit(1); }

const publicSlice = s4.slice(0, i);
ok('the public slice is non-trivial', publicSlice.length > 5000,
   `only ${publicSlice.length} bytes above the banner - the marker has probably moved`);

console.log('--- the whole public slice is in the bundle ---');
/* Byte-for-byte containment, not a selector spot-check. A spot-check
   passes while half the slice is missing; that is how this went
   unnoticed. */
ok('site-bundle.css contains the ENTIRE public slice', bun.indexOf(publicSlice) > -1,
   'the public responsive polish is missing from the only stylesheet the storefront loads');

console.log('--- and the admin half is NOT ---');
/* The mirror failure: a plain `cat … site4.css` ships ~15KB of admin CSS
   to every visitor. */
const adminSlice = s4.slice(i);
const adminMarkers = ['.rag-dot', '.rag-pill'];
adminMarkers.forEach(m => ok(`${m} (admin-only) is absent from the public bundle`,
  bun.indexOf(m) === -1, 'admin CSS is being shipped to every storefront visitor'));
ok('the admin half is not present wholesale', bun.indexOf(adminSlice.slice(0, 2000)) === -1,
   'the whole of site4.css has been concatenated in');

console.log('--- specific rules the owner noticed, named so the failure is legible ---');
/* These are assertions about the SYMPTOM, not about spelling. If one of
   these goes red, the thing the owner will see is written next to it. */
[['.bt-cards-row{flex-direction:column',
  'bundle-teaser cards stop stacking on a phone - they wrap 2-up with the + signs stranded'],
 ['.checkout-card',       'the checkout cards lose their mobile layout'],
 ['.pdp-color-chip',      'product-page colour chips lose their sizing'],
 ['.nav-cart-btn',        'the nav cart and hamburger lose their 44px touch targets']]
  .forEach(([needle, symptom]) => ok(`present: ${needle}`, bun.indexOf(needle) > -1, symptom));

console.log('--- the cache-busting version moves when the bundle does ---');
/* Restoring 7,892 bytes and NOT bumping ?v= means every returning
   visitor and the Hostinger CDN keep serving the broken bundle. */
const lay = fs.readFileSync(path.join(ROOT, 'views/layouts/main.ejs'), 'utf8');
const v = (lay.match(/site-bundle\.css\?v=(\d+)/) || [])[1];
ok('the bundle link carries a ?v=', !!v, 'no cache bust - the CDN keeps the old file');
ok('?v= is at least 36 (the restore)', +v >= 36, `?v=${v} predates the slice restore`);

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
