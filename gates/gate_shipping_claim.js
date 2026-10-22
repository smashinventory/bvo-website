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
  'views/pages/collection.ejs',
  'views/pages/trade-apply.ejs',
  'views/pages/inspiration-guide.ejs',
  'views/pages/inspiration-hub.ejs',
];

/* The absolute claims. Each must be anchored to a SHIPPING context — bare
   /every order/ matches prose about order processing all over this
   codebase ("every order arrived", "409 on every order"), and a gate that
   fires on those gets deleted within a week. Rule 17a. */
const FORBIDDEN = [
  { re: /(?:free\s+)?(?:shipping|freight)[^.<\n]{0,40}\b(?:every|all|any)\s+order/i,
    name: 'shipping … every/all/any order' },
  { re: /\b(?:every|all|any)\s+order[^.<\n]{0,40}(?:free\s+)?(?:shipping|freight)/i,
    name: 'every/all/any order … shipping' },
  { re: /every\s+order,\s*every\s+time/i,
    name: '"every order, every time"' },
  { re: /(?:free\s+)?(?:shipping|freight)\s*,\s*every\s+order/i,
    name: '"shipping, every order"' },
  { re: /always\s+free\s+(?:shipping|freight)|(?:shipping|freight)\s+is\s+always\s+free/i,
    name: '"always free shipping"' },
];

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
