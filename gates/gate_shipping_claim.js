'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   gate_shipping_claim.js — no customer-facing template promises free
   shipping on EVERY order. Task #371.

   THE CLAIM IS NOT TRUE, and that is the whole point. The shipping policy
   itself carves out freight, remote addresses and oversized items. "Free
   shipping on every order, with no minimum purchase" is a commercial
   promise the business cannot keep, and it is the kind of sentence that
   gets quoted back during a chargeback.

   The owner corrected the homepage first. This gate exists because the
   phrase then turned up in three more places, and the most instructive one
   was INVISIBLE:

     views/partials/header.ejs read
       <%= ps.message || 'Free Shipping on Every Order' %>
     The saved setting says "Most Orders", so the fallback never rendered.
     Clearing the promo message in the Theme Editor — an ordinary admin
     action — would have silently restored the bad claim to the top of
     every page on the site. A defect that only appears when a setting is
     cleared will not be found by looking at the site.

   SCOPE, STATED HONESTLY. This checks TEMPLATES only. The same claim also
   lives in the `pages` table (shipping-policy and about-us), which a gate
   cannot reach without a database — Rule 14. Those are fixed by SQL and
   re-checked live; see the #371 notes. A green gate here does NOT mean the
   phrase is gone from the site, and saying so is better than implying a
   coverage this cannot have.
   ═══════════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const ROOT  = path.join(__dirname, '..');
const VIEWS = path.join(ROOT, 'views');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (c ? '' : '   <- ' + d));
  if (!c) fail++;
};

/* Admin templates are staff-facing: "every order" there is description,
   not a promise. .bak files are snapshots of superseded work and are not
   served. Everything else in views/ is customer-facing. */
const SKIP = /(^|\/)admin(\/|$)|\.bak/;

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = path.relative(VIEWS, p);
    if (SKIP.test(rel)) continue;
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.ejs')) files.push(p);
  }
})(VIEWS);

ok('found customer-facing templates to check', files.length > 0, 'none found');

/* ⚠️ EJS COMMENTS AND JS COMMENTS BOTH STRIPPED FIRST.
   header.ejs and index-1.ejs now carry comments that QUOTE the old string
   verbatim, to explain why it was changed. Without stripping, this gate
   would fail on the very fix it is guarding — and the tempting repair
   would be to delete the explanation. Rule 18 corollary, live. */
function strip(src) {
  return src
    .replace(/<%#[\s\S]*?%>/g, '')        // EJS comment tag
    .replace(/<%\/\*[\s\S]*?\*\/%>/g, '') // JS block comment inside EJS
    .replace(/\/\*[\s\S]*?\*\//g, '')     // plain JS block comment
    .replace(/^[ \t]*\/\/.*$/gm, '');     // line comment
}

const CLAIM = /every\s+order/i;

const offenders = [];
for (const f of files) {
  const code = strip(fs.readFileSync(f, 'utf8'));
  if (!CLAIM.test(code)) continue;
  const line = code.split('\n').findIndex(l => CLAIM.test(l)) + 1;
  offenders.push(path.relative(ROOT, f) + ':' + line);
}

ok('no customer-facing template claims "every order"',
   offenders.length === 0,
   offenders.join(', '));

/* The two places it actually was, pinned so a regression names itself
   rather than just reporting a count. */
const header = strip(fs.readFileSync(path.join(VIEWS, 'partials/header.ejs'), 'utf8'));
ok('the promo-strip FALLBACK is policy-safe',
   /ps\.message\s*\|\|\s*'Free Shipping on Most Orders'/.test(header),
   'clearing the promo message would restore an unsupportable claim');

ok('the fallback still exists at all',
   /ps\.message\s*\|\|/.test(header),
   'the fallback was deleted — an empty promo strip renders a blank bar');

console.log('\ntemplates checked: ' + files.length);
console.log('⚠️ templates only — the `pages` table is not covered here. See the header.');
console.log(fail ? '\n*** ' + fail + ' GATE(S) FAILED ***' : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
