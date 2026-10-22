'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_trade_meter.js
 *
 * THE RULE: A FULL BAR MEANS ELITE. NOTHING ELSE MAY RENDER AS FULL.
 *
 * The Elite Trade meter on /collections/sale shows a trade account how far
 * they are from 20%. Two defects, both found 2026-10-22 by EXECUTING the
 * thing rather than reading it:
 *
 *   1. $19,999 is 99.995%, and `Math.round(pct * 10) / 10` turned that into
 *      exactly 100.0. A visually FULL bar, on an account still being
 *      charged 15%. The customer reads a full bar, concludes they
 *      qualified, and finds out otherwise at checkout. That is the same
 *      harm clause 4 of the trade terms exists to prevent — a rate moving
 *      without warning — except delivered as a picture, which is worse
 *      because nobody proofreads a picture.
 *
 *   2. At and above $20,000, `remaining` is $0, and the single-branch
 *      markup rendered "$0 more in the next 12 months unlocks 20%" — to
 *      the customers who had already unlocked it. Addressed to your best
 *      accounts, and nonsense.
 *
 * ⚠️ THE TEMPLATE WAS ALSO CARRYING A STALE COMMENT claiming the controller
 * did not supply tradeMeter yet ("that is Stage 2"). It had been wired
 * since 37270a4 on 2026-10-21. A finished feature read as unbuilt for a
 * day. Second stale comment to mislead this project in one session — the
 * other claimed /checkout/return did not settle orders. Section 4 below
 * asserts the wiring EXISTS, so the comment can never again be the only
 * record of whether it does.
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ejs  = require('ejs');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};

const tiers = require(path.join(ROOT, 'src/utils/tiers.js'));

console.log('\n1. pct === 100 if and only if the threshold is actually reached');

/* ⚠️ EXECUTED, AND THE BOUNDARY VALUES ARE HARDCODED.
   Deriving these from ELITE_THRESHOLD would make the test agree with any
   change to ELITE_THRESHOLD — Rule 18. $19,999 is here because it is the
   exact value that broke, not because it is threshold-1. */
for (const [spend, wantFull] of [[0, false], [10000, false], [19999, false],
                                 [19999.99, false], [20000, true], [31000, true]]) {
  const m = tiers.spendMeter(spend);
  check((m.pct === 100) === wantFull,
    `$${spend}: bar is ${wantFull ? 'full' : 'NOT full'} (pct ${m.pct})`,
    wantFull
      ? 'Reached but the bar is short — an Elite account looks unqualified.'
      : 'NOT reached but the bar renders full. This is the 2026-10-22 defect: the customer sees a complete bar and is still charged 15%.');
  check(m.reached === wantFull, `$${spend}: reached flag is ${wantFull}`);
}

check(tiers.spendMeter(19999).pct < 100 && tiers.spendMeter(19999).pct > 99,
  '$19,999 still reads as nearly-there, not reset to zero',
  'Capping must not throw away the progress — it should look close, because it IS close.');

console.log('\n2. pct never escapes 0–100 whatever it is fed');

for (const bad of [-5000, NaN, undefined, null, '12000', Infinity, 1e9]) {
  const m = tiers.spendMeter(bad);
  check(Number.isFinite(m.pct) && m.pct >= 0 && m.pct <= 100,
    `spendMeter(${String(bad)}) -> finite pct in range (${m.pct})`,
    'This value reaches a style="width:X%" attribute. A NaN or negative renders a broken bar.');
}
check(tiers.spendMeter('12000').pct > 0,
  "a numeric STRING is still measured, not silently zeroed",
  'rollingSpend arrives from a SQL SUM, which mysql2 can hand back as a string for DECIMAL columns.');

console.log('\n3. The template branches on reached — no "$0 more unlocks 20%"');

const SRC = fs.readFileSync(path.join(ROOT, 'views/pages/collection.ejs'), 'utf8');
const s = SRC.indexOf('<% if (_showT) { %>');
const frag = SRC.slice(s, SRC.indexOf('<% } %>', SRC.indexOf('</section>', s)) + 7);

const render = spend => ejs.render(frag, {
  _showT: true, _dbt: {}, cspNonce: 'x',
  tradeMeter: spend === null ? undefined : tiers.spendMeter(spend),
});

for (const spend of [20000, 31000]) {
  const out = render(spend);
  check(!/\$0 more/.test(out),
    `$${spend}: does NOT say "$0 more ... unlocks 20%"`,
    'remainingLabel is $0 up here. Printing it tells an Elite account they have not qualified.');
  check(/Elite Trade/.test(out) && /20% off/.test(out),
    `$${spend}: states the account is ON Elite Trade`);
  check(/is-reached/.test(out),
    `$${spend}: the fill carries the reached style`,
    'At 99.9 vs 100 the widths are a pixel apart — colour is what distinguishes the states.');
}

for (const spend of [0, 8400, 19999]) {
  const out = render(spend);
  check(/more in the next 12 months unlocks 20%/.test(out),
    `$${spend}: still shows the amount remaining`);
  check(!/is-reached/.test(out),
    `$${spend}: fill does NOT carry the reached style`);
  check(!/You're on Elite Trade/.test(out),
    `$${spend}: does not claim the customer is Elite`);
}

/* ⚠️ THE RENDERED WIDTH, NOT JUST THE FUNCTION'S pct.
   Mutation T3b: replace `width:<%= tradeMeter.pct %>` with the template
   re-deriving `(spent/target)*100` itself. Every check above still passed
   — section 1 tests the pure function, and the checks here test the TEXT.
   Nothing looked at the number that actually reaches the style attribute,
   which is the only number the customer sees.

   The defect this gate exists for lives in exactly that gap: a bar that
   is full when the account is not Elite. So read the width out of the
   rendered HTML and hold it to the same rule. */
const widthOf = out => {
  const m = out.match(/width:\s*([\d.]+)%/);
  return m ? parseFloat(m[1]) : null;
};
for (const [spend, wantFull] of [[0, false], [8400, false], [19999, false],
                                 [20000, true], [31000, true]]) {
  const w = widthOf(render(spend));
  check(w !== null, `$${spend}: the bar renders a width at all`);
  check(w !== null && (w === 100) === wantFull,
    `$${spend}: RENDERED width is ${wantFull ? '100%' : 'under 100%'} (got ${w}%)`,
    wantFull
      ? 'An Elite account must see a full bar.'
      : 'The rendered bar is full on an account still paying 15%. If spendMeter is correct, the template is re-deriving the width instead of using tradeMeter.pct.');
  check(w !== null && w === tiers.spendMeter(spend).pct,
    `$${spend}: rendered width equals tradeMeter.pct exactly`,
    'The template must use the value it was given. Re-deriving puts the arithmetic somewhere no unit test looks.');
}

console.log('\n4. The meter is actually wired, and says the rolling/capture truth');

/* ⚠️ THE STALE-COMMENT GUARD. The template claimed for a day that the
   controller did not supply this. Assert the WIRING, not the comment. */
const CTRL = fs.readFileSync(
  path.join(ROOT, 'src/controllers/collectionsController.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

check(/tierService\.forRequest\(req\)/.test(CTRL),
  'the controller resolves the tier for the request');
check(/^\s*tradeMeter,\s*$/m.test(CTRL),
  'and passes tradeMeter into the render locals',
  'Without this the banner silently falls back to the logged-out teaser for every trade account, and nothing errors — EJS `typeof` guards see undefined.');

check(!/tradeMeter is NOT yet supplied/.test(SRC),
  'the stale "Stage 2 / not yet supplied" comment is gone',
  'It was false from 37270a4 onward and described a finished feature as unbuilt.');

const live = render(8400);
check(/rolling|ages out|last 12 months|next 12 months/i.test(live),
  'the copy says the window is rolling',
  'Trade terms clause 4: the rate can fall, and we promise to say so rather than let it surprise them.');
check(/payment is charged|when we fulfil/i.test(live),
  'and that spend counts on CAPTURE, not on order',
  'capture_method is manual and the only path is an admin button, so the lag is real and can be days. Without this line the meter looks broken to a customer who just spent $9,000.');

console.log('\n5. MAP: a logged-out visitor sees no figures at all');

const out = render(null);
check(!/\$\d/.test(out.replace(/\$20,000 in a rolling/g, '')),
  'the logged-out teaser exposes no account figures',
  'tierService returns RETAIL with meter null for an anonymous request; this asserts the template agrees.');
check(/Spend \$20,000 in a rolling 12 months/.test(out),
  'but still states the public ladder, which is not MAP-sensitive');

console.log(
  fail === 0
    ? `\nGREEN  ${pass} passed, 0 failed`
    : `\ngate_trade_meter: FAILED ${fail} of ${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);
