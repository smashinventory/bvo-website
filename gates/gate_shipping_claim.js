'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_shipping_claim.js
 *
 * THE RULE: NO CUSTOMER-FACING SURFACE PROMISES FREE SHIPPING WITHOUT
 * EXCEPTION, BECAUSE THE TRADE TERMS CARVE EXCEPTIONS OUT.
 *
 * On 2026-10-22 the trade terms gained clause 5: free shipping does not
 * apply automatically to remote areas, islands, APO/FPO addresses, or
 * destinations carrying carrier surcharges, and BVO reserves the right to
 * ask the customer to pay the difference or not proceed.
 *
 * At that moment TWELVE live surfaces still said "every order" or "all
 * orders" — including the SITE-WIDE DEFAULT META DESCRIPTION in server.js,
 * which is what Google shows for every page that does not set its own.
 *
 * That combination is the problem this gate exists to prevent. Terms that
 * carve out an exception, over marketing that promises none, is a
 * contradiction a customer can quote back at you — and the marketing is
 * the half they saw first.
 *
 * WHY A GATE AND NOT A ONE-TIME EDIT:
 *
 *   The absolute phrasing is the natural thing to write. It is shorter,
 *   it sells better, and every one of those twelve instances was written
 *   by someone acting reasonably. It WILL come back — in a new template,
 *   in a theme default, in a meta description — unless something fails
 *   when it does.
 *
 * ⚠️ THIS GATE CANNOT SEE THE DATABASE, AND THAT IS A REAL HOLE.
 *   themeSettings.js values are DEFAULTS. The live values may be
 *   overridden through the Theme Editor, and an override is invisible
 *   here. Clearing this gate proves the defaults are safe; it does NOT
 *   prove the live site is. The DB check is manual — see
 *   docs/reference/TRADE_TERMS_DRAFT_2026-10-22.md.
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};

/* Files that actually reach a customer. Deliberately enumerated rather
   than globbed:

   ⚠️ A GLOB WOULD SWEEP IN .bak FILES AND THE DEAD -1 TWINS.
   views/pages/index.ejs.bak-*, index-1.ejs and homeController-1.js all
   carry the old absolute phrasing. None is reachable — index-1.ejs has no
   route anywhere in src/, verified by grep — so including them would make
   this gate fail forever on code that cannot render, and the fix would be
   to weaken the gate. Dead files are a documentation problem, not a
   compliance one. */
const SURFACES = [
  'src/server.js',                        // ⚠️ site-wide default metaDesc
  'src/services/themeSettings.js',        // ⚠️ DEFAULTS ONLY — see header
  'src/controllers/homeController.js',
  'src/controllers/tradeController.js',
  'views/partials/footer.ejs',            // every page
  /* ⚠️ ADDED AFTER THE FIRST LIVE CHECK, WHICH THIS GATE PASSED AND THE
     SITE FAILED. index.ejs carries the trust-bar fallback and was not in
     the list, so "Shipping on every single order" sat in a template this
     gate never opened. A surface list is only as good as its coverage,
     and the only way to find the gap was to read the rendered page. */
  'views/pages/index.ejs',
  /* ⚠️ ADDED 2026-10-24, THE SECOND TIME THIS LIST PROVED INCOMPLETE, and
     the gap was the same shape as the index.ejs one above: a FALLBACK.

     header.ejs renders the promo strip on every page as
       <%= ps.message || '…' %>
     and the fallback read 'Free Shipping on Every Order'. It never
     rendered, because the saved promo message says "Most Orders" — so
     reading the live site could not have found it either, which is how it
     survived the first live check that caught index.ejs.

     The lesson the index.ejs note draws is "read the rendered page". This
     one adds the other half: a rendered page cannot show you a fallback
     that is currently being overridden. Both halves are needed. */
  'views/partials/header.ejs',
  'views/pages/collection.ejs',
  'views/pages/trade-apply.ejs',
  'views/pages/inspiration-guide.ejs',
  'views/pages/inspiration-hub.ejs',
];

/* The absolute claims. Each must be anchored to a SHIPPING context — bare
   /every order/ matches prose about order processing all over this
   codebase ("every order arrived", "409 on every order"), and a gate that
   fires on those gets deleted within a week. Rule 17a. */
/* ⚠️ "every SINGLE order" IS WHY THESE ALLOW A WORD BETWEEN.
   The first version used \b(every|all|any)\s+order — one \s+ — and
   "Shipping on every single order" slipped straight through it, in two
   theme defaults and an index.ejs fallback. The gate went green and the
   live homepage still carried the absolute claim in three places.

   Caught only by fetching the rendered page. A source-matching gate can
   confirm the patterns it knows about are gone; it cannot tell you which
   phrasing nobody thought of. Read the real page before believing it. */
const FORBIDDEN = [
  { re: /(?:free\s+)?(?:shipping|freight)[^.<\n]{0,40}\b(?:every|all|any)\s+(?:\w+\s+)?order/i,
    name: 'shipping … every/all/any [single] order' },
  { re: /\b(?:every|all|any)\s+(?:\w+\s+)?order[^.<\n]{0,40}(?:free\s+)?(?:shipping|freight)/i,
    name: 'every/all/any [single] order … shipping' },
  /* The stat-tile phrasing: value "Free", label "Shipping on every single
     order". The word "free" is in a different element, so neither pattern
     above can see it — the label alone has to be forbidden. */
  { re: /Shipping\s+on\s+(?:every|all|any)\s+(?:\w+\s+)?order/i,
    name: '"Shipping on every/all/any order" (stat tile label)' },
  { re: /every\s+order,\s*every\s+time/i,
    name: '"every order, every time"' },
  { re: /(?:free\s+)?(?:shipping|freight)\s*,\s*every\s+order/i,
    name: '"shipping, every order"' },
  { re: /always\s+free\s+(?:shipping|freight)|(?:shipping|freight)\s+is\s+always\s+free/i,
    name: '"always free shipping"' },
];

/* ⚠️ THE SURFACE LIST GUARDS ITSELF.
   Mutation M10: delete one entry from SURFACES and the gate goes green
   while the live page carries the absolute claim. That is not a
   hypothetical — it is the cheapest possible way to "fix" a failure, and
   it leaves no trace. The list is data this gate depends on, so the list
   is itself under test.

   Hardcoded, not derived from SURFACES — deriving it would make the
   assertion agree with any deletion, which is the Rule 18 failure this
   project has now hit in four separate gates. */
console.log('\n0. The surface list has not been quietly shortened');

const REQUIRED_SURFACES = [
  'src/server.js',
  'src/services/themeSettings.js',
  'src/controllers/homeController.js',
  'views/partials/footer.ejs',
  /* Added with the surface itself, 2026-10-24. The promo strip renders
     above every page, so dropping it from SURFACES would un-guard the
     most prominent claim on the site. */
  'views/partials/header.ejs',
  'views/pages/index.ejs',
  'views/pages/trade-apply.ejs',
];
for (const req of REQUIRED_SURFACES) {
  check(SURFACES.includes(req),
    `${req} is still in the surface list`,
    'Removing a file from SURFACES un-guards it silently and the gate still reports GREEN. If this file genuinely no longer exists or no longer faces customers, delete it from REQUIRED_SURFACES too — deliberately, in the same commit, where a reviewer sees it.');
}
check(SURFACES.length >= 9,
  `the list still covers at least 9 surfaces (currently ${SURFACES.length})`,
  'The claim appeared on 13 surfaces across 9 files. A shrinking list means coverage is being traded for a green run.');

console.log('\n1. No customer-facing surface makes an absolute shipping promise');

for (const rel of SURFACES) {
  const abs = path.join(ROOT, rel);
  check(fs.existsSync(abs), `${rel} exists`,
    'A surface listed here has moved or been renamed. Re-point the list rather than dropping the entry — dropping it is how a promise goes unguarded.');
  if (!fs.existsSync(abs)) continue;

  const raw = fs.readFileSync(abs, 'utf8');

  /* ⚠️ COMMENTS ARE STRIPPED, AND LEAVING THEM IN WOULD HAVE BROKEN THIS.
     The themeSettings edit carries a comment explaining the change, and
     that comment contains the words "every order" to say what it replaced.
     collection.ejs line ~258 quotes the old banner copy for the same
     reason. Both would match. This is the Rule 18 corollary that has now
     cost a pass in gate_stripe_reconcile (R11), gate_orders_visibility
     (V7) and here: quoting old code in a comment makes the comment
     satisfy a grep for that code. */
  const code = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')   // JS block
    .replace(/^\s*\/\/.*$/gm, '')       // JS full-line
    .replace(/<%#[\s\S]*?%>/g, '');     // EJS comment

  for (const { re, name } of FORBIDDEN) {
    const m = code.match(re);
    check(!m, `${rel} — no ${name}`,
      m ? `Found: "${m[0].trim()}"\n         The trade terms carve out remote areas, islands and APO/FPO. An absolute claim here contradicts them. Use "most orders".`
        : undefined);
  }
}

console.log('\n2. The replacement phrasing is actually present, not just absent');

/* ⚠️ ABSENCE IS NOT COMPLIANCE, AND THIS IS THE HALF A FORBID-ONLY GATE
   MISSES. Deleting the sentence passes every check above. So does
   replacing it with nothing. The claim is a selling point and it is
   supposed to still be there — qualified, not gone. */
const MUST_QUALIFY = [
  ['src/server.js',                   'site-wide default meta description'],
  ['views/partials/footer.ejs',        'footer, which renders on every page'],
  ['src/services/themeSettings.js',    'theme defaults'],
  ['views/pages/trade-apply.ejs',      'the trade application page'],
];
for (const [rel, what] of MUST_QUALIFY) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { check(false, `${rel} exists`); continue; }
  const code = fs.readFileSync(abs, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    .replace(/<%#[\s\S]*?%>/g, '');
  check(/(?:shipping|freight)\s+on\s+most\s+orders|most\s+orders\b/i.test(code),
    `${rel} still makes the qualified claim (${what})`,
    'The absolute phrasing is gone but nothing replaced it. Free shipping is a real selling point and should still be stated — as "most orders".');
}

console.log('\n3. The terms the copy must agree with actually exist');

const TERMS = path.join(ROOT, 'docs/reference/TRADE_TERMS_DRAFT_2026-10-22.md');
check(fs.existsSync(TERMS),
  'the trade terms document is in the repo',
  'This gate enforces consistency with a document. If the document is gone, the rule it encodes has no source and the next person cannot tell whether "most orders" is still right.');
if (fs.existsSync(TERMS)) {
  const t = fs.readFileSync(TERMS, 'utf8');
  for (const term of ['remote', 'APO', 'most orders']) {
    check(new RegExp(term, 'i').test(t),
      `the terms still carve out "${term}"`,
      'If the exclusions were removed from the terms, the copy could go back to an absolute claim — and this gate would be wrong, not the copy. Check which one changed.');
  }
}

console.log(
  fail === 0
    ? `\nGREEN  ${pass} passed, 0 failed`
    : `\ngate_shipping_claim: FAILED ${fail} of ${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);
