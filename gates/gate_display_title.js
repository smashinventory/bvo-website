'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   gate_display_title.js — the shortened product heading.

   This rule runs over ~6,400 product names, most of which nobody will ever
   read before a customer does. The checks below are therefore less about
   "does it shorten correctly" and more about "what happens when it meets a
   name it was not written for".

   Run: node gates/gate_display_title.js
   ═══════════════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const RED = '\x1b[31m', GRN = '\x1b[32m', DIM = '\x1b[2m', OFF = '\x1b[0m';
let failures = 0;

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const section = t => console.log(`\n--- ${t} ---`);
function check(label, ok, why) {
  if (ok) { console.log(`  ${GRN}ok${OFF}   ${label}`); return; }
  failures += 1;
  console.log(`  ${RED}FAIL${OFF} ${label}${why ? `\n       ${DIM}${why}${OFF}` : ''}`);
}

const dt  = require('../src/utils/displayTitle');
const { displayTitle } = dt;

const VAN  = { brand: 'James Martin Vanities', product_type: 'Single Sink Vanity With Top' };
const DBL  = { brand: 'James Martin Vanities', product_type: 'Double Sink Vanity With Top' };
const CAB  = { brand: 'James Martin Vanities', product_type: 'Single Sink Cabinet Only' };
const MIR  = { brand: 'James Martin Vanities', product_type: 'Mirror' };
const HB   = { brand: 'Huntington Brass',      product_type: 'Bathroom Faucets' };

/* ── 1. THE RULE LOADS WITHOUT AN ENVIRONMENT ───────────────────────────── */
section('the rule is reachable without a database');
check('displayTitle.js has no top-level require',
  !/^\s*(const|let|var).*require\(/m.test(read('src/utils/displayTitle.js')),
  'a rule a gate cannot load is a rule the gate has to re-implement');

/* ── 2. IT DOES THE JOB ─────────────────────────────────────────────────── */
section('it shortens what it is meant to shorten');

check('the approved example matches the mockup exactly',
  displayTitle('Bristol 30" Single Vanity, Bright White w/ Single Hole 3 CM White Zeus Silestone Top & Backsplash', VAN)
    === 'Bristol 30" Single Vanity — Bright White w/ White Zeus Silestone Top',
  displayTitle('Bristol 30" Single Vanity, Bright White w/ Single Hole 3 CM White Zeus Silestone Top & Backsplash', VAN));

/* ⚠️ THE CONNECTOR MUST SURVIVE. Written as a STRIP rule, the stray-comma
   fix removed "w/" too and produced "Coastal Driftwood White Zeus Quartz
   Top" — two phrases run together with nothing joining them. */
check('a second comma is removed but the connector is kept',
  displayTitle('Gracyn 72" Double Vanity, Coastal Driftwood, w/ 3 CM White Zeus Quartz Top', DBL)
    === 'Gracyn 72" Double Vanity — Coastal Driftwood w/ White Zeus Quartz Top',
  displayTitle('Gracyn 72" Double Vanity, Coastal Driftwood, w/ 3 CM White Zeus Quartz Top', DBL));

check('decimal thicknesses are matched too',
  !/1\.5 CM/.test(displayTitle('Brittany 48" Single Vanity, Smokey Celadon w/ 1.5 CM Carrara Top', VAN)));

/* ⚠️ EVERY CASE BELOW CAME OFF THE REAL CATALOGUE, NOT OUT OF MY HEAD. The
   first version of the backsplash and hole rules matched one spelling
   each and left 32 live titles carrying the noise. A preview query over
   all 4,531 in-scope rows is what found them. The feed is not consistent
   and these four spellings all exist in the products table today. */
section('the feed spells the same attribute four different ways');

const FEED = [
  ['& Backsplash',
   'Brittany 72" Double Vanity, Bright White w/ Single Hole 3 CM White Zeus Silestone Top & Backsplash'],
  ['& Matching Backsplash (660-VMC120-BW-1WZ)',
   'Bellshire 120" Dual Vanity Set with 24" Make-Up Counter, Bright White w/Single Hole 3 cm White Zeus Silestone Top & Matching Backsplash'],
  ['and Matching Backsplash (435-V30-LNO-1WZ)',
   'Hudson 30" Single Vanity, Light Natural Oak w/ Single Hole 3 CM White Zeus Silestone Top and Matching Backsplash'],
  ['lowercase "3 cm" and spaceless "3CM"',
   'Breckenridge 48" Single Vanity, Whitewashed Oak w/ Single Hole 3CM White Zeus Silestone Top & Backsplash'],
];
for (const [label, name] of FEED) {
  const out = displayTitle(name, VAN);
  check(`${label} — backsplash removed`, !/Backsplash/i.test(out), out);
  check(`${label} — thickness removed`,  !/\d+\s*CM\b/i.test(out), out);
  check(`${label} — drilling removed`,   !/\bHole\b/i.test(out),  out);
}

/* ⚠️ A BARE "Hole", NO Single/Double IN FRONT. D404-V72-SWO-1WZ reads
   "w/ Hole 3 CM ..." in the database. The original rule matched only the
   two-word forms, so removing "3 CM" stranded the word on its own:
   "Sunwashed Oak w/ Hole White Zeus Silestone Top". */
check('a bare "Hole" is removed too (D404-V72-SWO-1WZ)',
  displayTitle('Marigot 72" Double Vanity, Sunwashed Oak w/ Hole 3 CM White Zeus Silestone Top', DBL)
    === 'Marigot 72" Double Vanity — Sunwashed Oak w/ White Zeus Silestone Top',
  displayTitle('Marigot 72" Double Vanity, Sunwashed Oak w/ Hole 3 CM White Zeus Silestone Top', DBL));

/* ⚠️ THE DASH-ONLY CASE. On a title with no noise token, the comma swap
   is the only change — and " — " is one character longer than ", ", so at
   zero tolerance isSafe rejected it and ~350 titles kept their comma
   while longer ones got the dash. */
check('a title whose ONLY change is the dash still gets the dash',
  displayTitle('Lorelai 36" Single Vanity, Black Onyx', VAN)
    === 'Lorelai 36" Single Vanity — Black Onyx',
  displayTitle('Lorelai 36" Single Vanity, Black Onyx', VAN));
/* ⚠️ THE ALLOWANCE IS A BUDGET, NOT A CONSTANT. A flat +1 was tried, and
   it broke the moment a title earned BOTH adding substitutions — the dash
   and a restored "w/" space — because that grows by two. isSafe now gets
   told how many characters the caller actually bought, and must spend
   exactly that. No spaces in the test strings: " x" is two characters,
   and writing it that way is how this check failed the first time. */
check('with no budget, any growth at all is still rejected',
  dt.isSafe('Lorelai 36" Vanityx', 'Lorelai 36" Vanity') === false,
  'the default must stay strict for any caller that does not pay');
check('a budget of 1 buys exactly one character, not two',
  dt.isSafe('Lorelai 36" Vanityx',  'Lorelai 36" Vanity', 1) === true &&
  dt.isSafe('Lorelai 36" Vanityxx', 'Lorelai 36" Vanity', 1) === false);
check('a budget of 2 buys the dash AND the restored space',
  dt.isSafe('Lorelai 36" Vanityxx',  'Lorelai 36" Vanity', 2) === true &&
  dt.isSafe('Lorelai 36" Vanityxxx', 'Lorelai 36" Vanity', 2) === false);
check('displayTitle passes a budget rather than a hard-coded number',
  /isSafe\(out, full, budget\)/.test(read('src/utils/displayTitle.js')) &&
  !/full\.length \+ [0-9]/.test(read('src/utils/displayTitle.js')),
  'a constant here is what discarded ~350 titles, then broke the two-change case');

/* ⚠️ THIS CASE IS CONSTRUCTED SO ONLY THE NORMALIZATION CAN PASS IT, AND
   THAT TOOK A SECOND ATTEMPT. The obvious case — the 660-VMC* "w/Single
   Hole" — proves nothing: every STRIP rule replaces its match with a
   SPACE, so removing "Single Hole " already turns "w/Single Hole 3 cm"
   into "w/ 3 cm" and the space appears whether the normalization exists
   or not. Deleting the line left the gate green, and the mutation
   harness is what caught it.

   Here nothing is stripped at all: "Sable w/White Zeus Quartz Top" has
   no drilling, no thickness and no backsplash, so the slash stays glued
   to the next word unless the normalization pulls them apart. */
const GLUED = 'Gracyn 72" Double Vanity, Sable w/White Zeus Quartz Top';
check('a missing space after w/ is restored when nothing was stripped',
  displayTitle(GLUED, DBL) === 'Gracyn 72" Double Vanity — Sable w/ White Zeus Quartz Top',
  displayTitle(GLUED, DBL));
check('the same space also survives the strip path (660-VMC120-BW-1WZ)',
  /w\/ White Zeus/.test(displayTitle(FEED[1][1], VAN)),
  displayTitle(FEED[1][1], VAN));
check('a w/ that already has its space is not doubled',
  !/w\/\s{2,}/.test(displayTitle(FEED[0][1], VAN)));

/* ── 3. SCOPE — THE PART THAT PROTECTS 6,000 OTHER PRODUCTS ─────────────── */
section('everything outside James Martin vanities is untouched');

const faucet = 'Huntington Brass Reflector Single Hole Faucet, Chrome';
check('a faucet is returned byte-for-byte', displayTitle(faucet, HB) === faucet,
  'the strip list is tuned on vanity names; "Single Hole" is the product here');

const mirror = 'Bristol 30" Mirror, Bright White w/ 3 CM Trim';
check('a James Martin MIRROR is out of scope', displayTitle(mirror, MIR) === mirror,
  'same brand, different naming pattern');

check('a cabinet-only vanity IS in scope', dt.isScoped(CAB.brand, CAB.product_type));

/* ⚠️ THE BRAND CHECK NEEDS ITS OWN CASE. The faucet above is excluded by
   its product_type, so deleting the brand check entirely still passed —
   the mutation harness caught that. This is another maker's vanity: same
   product type, different naming, must be untouched. */
const rival = 'Fresca Oxford 36" Single Vanity, Antique White w/ 3 CM Carrara Top';
check('another brand\'s vanity is untouched',
  displayTitle(rival, { brand: 'Fresca', product_type: 'Single Sink Vanity With Top' }) === rival,
  'the strip list is tuned on James Martin naming only');
check('isScoped rejects a non-JM brand outright',
  dt.isScoped('Fresca', 'Single Sink Vanity With Top') === false);
check('an unknown product type is excluded rather than guessed',
  displayTitle('Something 30" Thing, Red', { brand: 'James Martin Vanities', product_type: '' })
    === 'Something 30" Thing, Red');

/* ── 4. THE SAFETY NET ──────────────────────────────────────────────────── */
section('damaged output is discarded in favour of the original');

check('an empty name comes back empty, not as garbage', displayTitle('', VAN) === '');
check('null is tolerated', displayTitle(null, VAN) === '');
check('a result shorter than 12 chars is rejected', dt.isSafe('Bristol', 'Bristol 30" Single Vanity') === false);
/* ⚠️ THIS CASE IS CONSTRUCTED SO ONLY THE LENGTH CHECK CAN REJECT IT. The
   first attempt used ('aaaa…', 'short'), which the model-name check caught
   first — so deleting the length check still passed. Here the output
   starts with the right first word and is well over the minimum, leaving
   the length comparison as the only thing standing between a misfired
   replacement and the page. */
check('a result longer than the input is rejected',
  dt.isSafe('Bristol 30" Vanity Extra Extra Words', 'Bristol 30" Vanity') === false,
  'only the length check can catch this one');

/* Likewise: ≥12 chars, shorter than the input, starts correctly — the
   safety net as a whole must still be consulted at all. */
check('displayTitle actually calls the safety net',
  /return isSafe\(out, full, budget\) \? out : full;/.test(read('src/utils/displayTitle.js')),
  'the net is only worth having if the function asks it');
check('a result that loses the model name is rejected',
  dt.isSafe('Vanity — Bright White', 'Bristol 30" Single Vanity, Bright White') === false,
  'the first word is the model and must survive');

/* ── 5. NOTHING IS INVENTED ─────────────────────────────────────────────── */
section('every rule is a deletion, never a rewrite');

/* Every word in the output must have been in the input. This is the check
   that makes a wrong rule merely clumsy rather than false — a title that
   describes a different product is a far worse failure than a long one. */
const samples = [
  ['Bristol 30" Single Vanity, Bright White w/ Single Hole 3 CM White Zeus Silestone Top & Backsplash', VAN],
  ['Gracyn 72" Double Vanity, Coastal Driftwood, w/ 3 CM White Zeus Quartz Top', DBL],
  ['Brittany 48" Single Vanity, Smokey Celadon w/ 1.5 CM Carrara Top', VAN],
  ['Addison 36" Single Vanity, Glossy White', VAN],
  ...FEED.map(([, name]) => [name, VAN]),   // the four real feed spellings
];
/* ⚠️ THE INPUT IS TOKENIZED WITH THE SAME WHITESPACE NORMALIZATION THE
   RULE APPLIES, AND ONLY THAT. The feed writes "w/Single Hole", which
   tokenizes as one word "w/single"; the rule restores the missing space,
   so the output carries "w/" as a token of its own and this check called
   it invented. Normalizing both sides makes the comparison meaningful
   again. It does NOT weaken the check — no word is removed from the
   input set, a run-together pair is only split the same way the rule
   splits it, and any genuinely new word still fails. */
const sameSpacing = s => s.replace(/\bw\/(?=[A-Za-z0-9])/g, 'w/ ');

let invented = [];
for (const [name, p] of samples) {
  const inWords  = new Set(sameSpacing(name).toLowerCase().split(/[\s,]+/).filter(Boolean));
  const outWords = displayTitle(name, p).toLowerCase().split(/[\s,]+/).filter(Boolean);
  for (const w of outWords) {
    if (w === '—') continue;                       // the one substitution we allow
    if (!inWords.has(w)) invented.push(`${w} (from: ${name.slice(0, 40)}…)`);
  }
}
check('no word appears in the output that was not in the input',
  invented.length === 0, invented.join('; '));

/* ── 6. IT IS WIRED TO THE HEADING AND NOWHERE ELSE ─────────────────────── */
section('only the h1 uses it');

const pdp  = read('views/pages/product.ejs');
const ctrl = read('src/controllers/productsController.js');

check('the h1 renders the shortened title',
  /<h1 class="detail-title"><%= displayTitle\(product\.name, product\) %><\/h1>/.test(pdp));

check('the helper is passed to the view',
  /displayTitle,/.test(ctrl) && /require\('\.\.\/utils\/displayTitle'\)/.test(ctrl));

/* ⚠️ SEARCH LISTINGS MUST NOT MOVE. The page title, the meta description
   and the Product JSON-LD name all keep the real product name. */
check('the page <title> still uses the full product name',
  /pageTitle:\s*`\$\{product\.meta_title \|\| product\.name\}/.test(ctrl));
check('the structured-data name still uses the full product name',
  /name:\s*product\.name,/.test(ctrl));
check('the cart line item still carries the full product name',
  /name="name"\s+value="<%= product\.name %>"/.test(pdp),
  'an order confirmation must name the product as the customer will see it shipped');

console.log();
if (failures) { console.error(`${RED}${failures} check(s) failed.${OFF}`); process.exit(1); }
console.log(`${GRN}ALL DISPLAY TITLE GATES PASS${OFF}`);
