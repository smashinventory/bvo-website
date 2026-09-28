'use strict';
/* Gate: no size row on Huntington Brass product cards.  2026-09-28
 *
 * Owner: "just remove size from all huntington brass products."
 *
 * Two ways this goes wrong, and both are silent:
 *   1. The row comes back on HB  — the meaningless "20-" returns.
 *   2. The row disappears from JAMES MARTIN — 30/36/48/60/72 is real
 *      information on a vanity, and losing it is a bigger regression
 *      than the bug being fixed. That is the one this gate mostly
 *      guards, because nobody would think to check it.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const visible = src => src
  .replace(/<%\/\*[\s\S]*?\*\/%>/g, '').replace(/<%#[\s\S]*?%>/g, '');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

const col = visible(read('views/pages/collection.ejs'));

console.log('--- the guard exists and is on BRAND ---');
ok('an HB flag is computed',
   /_pIsHB\s*=\s*String\(product\.brand \|\| ''\)/.test(col), 'no guard');
ok('it is case-insensitive and trimmed',
   /\.trim\(\)\.toLowerCase\(\) === 'huntington brass'/.test(col),
   '"HUNTINGTON BRASS" in the data would slip through');
ok('the size row is gated on it',
   /if \(_pSizes && _pSizes\.length && !_pIsHB\) \{/.test(col), 'the row still renders');

console.log('\n--- brand, not category or type ---');
/* The owner ruled out a type-based rule: "we dont seem to have type
   locked down". An HB item appears on /collections/accessories too, and
   a category rule would miss it there. */
ok('the guard does not key on product_type',
   !/_pIsHB[\s\S]{0,120}product_type/.test(col), 'a type rule would miss HB on accessories');
ok('the guard does not key on the collection slug',
   !/_pIsHB[\s\S]{0,120}(isVanityCategory|slug)/.test(col), 'HB outside faucets would keep the row');

console.log('\n--- nothing else lost ---');
/* The block must still EXIST for every other brand. */
ok('the size chip markup is still in the file',
   /model-card-size-btn/.test(col), 'the row was deleted outright, not gated');
ok('size chips still navigate for other brands',
   /data-variant-href="\/products\/<%= _pSzHref %>"/.test(col), 'other brands lost navigation');
ok('the finishes row is untouched',
   /model-card-swatches/.test(col), 'swatches removed by accident');
ok('the colour swap still emits data-variant',
   /data-variant="<%= JSON\.stringify\(_pSwSwap\)/.test(col), 'the swap regressed');


/* ═══ BUNDLE BUILDER ═══════════════════════════════════════════════
   Same "20-" chip appeared on step 4. Different file, same rule. */
const bb = read('views/pages/bundle-builder.ejs');

console.log('\n--- bundle builder step 4 ---');
ok('the HB check exists there too',
   /_bbIsHB\s*=\s*String\(_bbBrand\)\.trim\(\)\.toLowerCase\(\) === 'huntington brass'/.test(bb),
   'the size chip is still rendered on HB faucets');
ok('brand is read off the SKU, not the model group',
   /model\.skus && model\.skus\[0\] && model\.skus\[0\]\.brand/.test(bb),
   'groupByModel keys on model name only — there is no brand on the group object');
/* Hiding the chips alone leaves a "Size" label with nothing after it,
   which reads as a failed load rather than an absent field. */
ok('the whole picker ROW is hidden, not just the chips',
   /closest\('\.bb-picker-row'\)[\s\S]{0,160}style\.display = _bbIsHB \? 'none' : ''/.test(bb),
   'an orphan "Size" label with no chips under it');
ok('the row is restored for non-HB',
   /_bbIsHB \? 'none' : ''/.test(bb),
   'once hidden it would stay hidden when navigating to another brand');
/* A hidden chip is still in the DOM and still reachable by keyboard. */
ok('the chips are cleared as well as hidden',
   /_bbIsHB\) \{[\s\S]{0,200}sizesEl\.innerHTML = '';/.test(bb),
   'a hidden chip stays tabbable and would re-filter the step');
/* Step 4 is deliberately multi-brand — see bundleController getFaucets. */
ok('the guard is on brand, not on the step',
   !/step === 'faucet'[\s\S]{0,80}sizesEl\.innerHTML = ''/.test(bb),
   'a non-HB faucet with real widths would lose its chips');
ok('cabinet and mirror chips still render',
   /data-bucket="' \+ esc\(b\.label\)/.test(bb), 'the chip renderer was removed');

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
