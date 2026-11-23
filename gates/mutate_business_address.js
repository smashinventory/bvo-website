#!/usr/bin/env node
'use strict';
/* Mutation harness for the business-address and hours checks added to
 * gate_structured_data.js on 2026-11-23.
 *
 * A gate nobody has watched FAIL is decoration. This breaks the address and
 * hours eight ways across FOUR files, asserts the gate catches every one,
 * then restores all four and proves each restore by SHA-256.
 *
 * The first two mutations are the ones that matter most. Hostinger's
 * AI-visibility scan offers 4 points for adding "Organization or
 * LocalBusiness", and 5120 Old Ellis Pt is an office and warehouse where
 * customers do not visit. Claiming a storefront for a scorecard point is the
 * specific mistake these checks exist to prevent, so they are the specific
 * mistakes tested here.
 *
 * Run: node gates/mutate_business_address.js
 */
const fs     = require('fs');
const cp     = require('child_process');
const path   = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(ROOT, 'gates/gate_structured_data.js');

const F = {
  sd: 'src/utils/structuredData.js',
  ts: 'src/services/themeSettings.js',
  pd: 'views/pages/product.ejs',
  cr: 'src/jobs/cartRecovery.js',
  hc: 'src/controllers/homeController.js',
};

/* Snapshot every file this harness can touch, before touching any. */
const original = {}, origHash = {};
for (const [k, rel] of Object.entries(F)) {
  original[k] = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  origHash[k] = crypto.createHash('sha256').update(original[k]).digest('hex');
}

/* U+2013 EN DASH, the character themeSettings.js actually stores. */
const EN = String.fromCharCode(0x2013);

const MUTATIONS = [
  { file: 'sd',
    name: 'the org claims LocalBusiness (the Hostinger temptation)',
    from: "'@type': ['Organization', 'OnlineStore'],",
    to:   "'@type': ['Organization', 'OnlineStore', 'LocalBusiness']," },

  { file: 'sd',
    name: 'the Organization supertype is dropped again',
    from: "'@type': ['Organization', 'OnlineStore'],",
    to:   "'@type': 'OnlineStore'," },

  { file: 'sd',
    name: 'openingHours added to the org (invites walk-ins to a warehouse)',
    from: "    url:     SITE_URL + '/',",
    to:   "    url:     SITE_URL + '/',\n    openingHours: 'Mo-Sa 09:00-17:30'," },

  { file: 'sd',
    name: 'the org becomes a Store',
    from: "'@type': ['Organization', 'OnlineStore'],",
    to:   "'@type': ['Organization', 'Store']," },

  { file: 'sd',
    name: 'the address is dropped again (the original finding)',
    from: '    ...(address ? { address } : {}),',
    to:   '    /* mutated: no address */' },

  { file: 'sd',
    name: 'a half-filled address is published instead of none',
    from: '  if (!street || !city || !region || !postal || !country) return null;',
    to:   '  /* mutated: partial addresses now escape */' },

  { file: 'ts',
    name: 'the human hours string drifts from the machine times',
    /* ⚠️ THE EN-DASH IS BUILT, NOT TYPED. themeSettings.js stores U+2013
       itself (confirmed with cat -A: e2 80 93), not the six-character text
       "–". The first version of this mutation searched for the escape
       sequence as literal text, matched nothing, and reported SKIPPED —
       which is exactly why the anchor-not-found branch below counts as a
       LEAK instead of printing quietly and moving on. Composing it from a
       char code keeps this file ASCII and leaves no doubt what is meant. */
    from: "contact_hours:          '9am" + EN + "5:30pm ET, Mon" + EN + "Sat',",
    to:   "contact_hours:          '9am" + EN + "5pm ET, Mon" + EN + "Fri'," },

  { file: 'pd',
    name: 'the hours get hardcoded back into the product page',
    from: '      <p class="pdp-expert-hours">Available <%= _expertHours %></p>',
    to:   '      <p class="pdp-expert-hours">Available 9am&ndash;5:30pm ET, Mon&ndash;Sat</p>' },

  /* ── THE HOMEPAGE LISTING ─────────────────────────────────────────── */

  { file: 'sd',
    name: 'the listing mints a NEW @id instead of the product page\'s',
    from: "          '@id':   `${url}#product`,",
    to:   "          '@id':   `${url}#listing-item`," },

  { file: 'sd',
    name: 'the "0.00" string guard is removed (a free vanity ships)',
    from: '    return Number.isFinite(n) && n > 0;',
    to:   '    return !!p.price;' },

  { file: 'sd',
    name: 'missing stock is guessed as InStock rather than left unstated',
    from: '      const avail = Number.isFinite(qty)',
    to:   '      const avail = true' + '\n        ? \'https://schema.org/InStock\' : undefined; const _unused = Number.isFinite(qty)' },

  { file: 'hc',
    name: 'the homepage stops emitting the listing at all',
    from: '      nodes:       [_featured],',
    to:   '      /* mutated: listing dropped */' },

  { file: 'cr',
    name: 'the CAN-SPAM address gets hardcoded at the send site again',
    from: '        postal_address:      postalAddressLine(),',
    to:   "        postal_address:      'Smash Inventory Solutions, LLC, 5120 Old Ellis Pt, Suite C, Roswell, GA 30076'," },
];

function runGate() {
  const r = cp.spawnSync('node', [GATE], { cwd: ROOT, encoding: 'utf8', timeout: 90000 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function restoreAll() {
  for (const [k, rel] of Object.entries(F)) {
    fs.writeFileSync(path.join(ROOT, rel), original[k]);
  }
}

let leaks = 0;
console.log('\nmutate_business_address — the gate must fail on each broken claim\n');

{
  const base = runGate();
  if (base.code !== 0) {
    console.log('  BASELINE FAILED — the gate does not pass on the real files.');
    console.log(base.out.split('\n').filter(l => /FAIL|\*\*\*/.test(l)).join('\n'));
    process.exit(1);
  }
  console.log('  baseline: gate passes on the real files\n');
}

for (const m of MUTATIONS) {
  const rel = F[m.file];
  if (!original[m.file].includes(m.from)) {
    console.log(`  SKIPPED (anchor not found in ${rel}) ${m.name}`);
    console.log('           The code moved; this mutation tests NOTHING while');
    console.log('           still printing tidily. Re-anchor it.');
    leaks++;
    continue;
  }
  fs.writeFileSync(path.join(ROOT, rel), original[m.file].replace(m.from, m.to));
  const r = runGate();
  restoreAll();                        // restore immediately, before the next one

  if (r.code !== 0) {
    const caught = (r.out.match(/FAIL [^\n]+/g) || []).slice(0, 2)
                     .map(s => s.replace(/\s+/g, ' ').trim()).join(' | ');
    console.log(`  caught   ${m.name}`);
    console.log(`           -> ${caught || '(gate errored rather than reporting)'}`);
  } else {
    console.log(`  *** LEAK ${m.name}`);
    console.log('           The gate PASSED on broken code. Not protected.');
    leaks++;
  }
}

/* ── PROVE THE RESTORE ──────────────────────────────────────────────────
   Four files, four hashes. A harness that throws before this point leaves
   production code mutated on disk; that has happened in this repo before,
   so the restore is verified rather than assumed. */
console.log('\n  restored:');
let bad = 0;
for (const [k, rel] of Object.entries(F)) {
  const h = crypto.createHash('sha256')
              .update(fs.readFileSync(path.join(ROOT, rel), 'utf8')).digest('hex');
  const okk = h === origHash[k];
  if (!okk) bad++;
  console.log(`    ${okk ? 'OK  ' : '*** MISMATCH'}  ${rel}  ${h.slice(0, 16)}`);
}
if (bad) { console.log('\n*** FILES LEFT MUTATED — fix before committing ***'); process.exit(1); }

const final = runGate();
console.log(`  gate on the restored files: ${final.code === 0 ? 'PASSES' : '*** FAILS ***'}`);

console.log(leaks ? `\n*** ${leaks} LEAK(S) ***`
                  : `\nALL ${MUTATIONS.length} MUTATIONS CAUGHT`);
process.exit(leaks || final.code ? 1 : 0);
