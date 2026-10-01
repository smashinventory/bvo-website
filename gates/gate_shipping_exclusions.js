#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_shipping_exclusions.js — checkout refuses what the published
   Shipping Policy refuses, and the two state lists never drift apart.

   Run:  node gates/gate_shipping_exclusions.js
   Exit: 0 = pass, 1 = fail

   WHY THIS EXISTS
   Until 2026-10-01 the site accepted Alaska and Hawaii orders while
   /pages/shipping-policy said, in writing, that it did not ship there. A
   Honolulu shopper could pay and get a confirmation for an order that was
   never going to move. Nothing failed; the code and the page simply
   disagreed, and only a human reading both would ever have noticed.

   That is the class of defect this gate is for: not a crash, a quiet
   contradiction between what we publish and what we do.

   THE TWO LISTS ARE THE REAL RISK. The state list exists twice and must —
   one is the dropdown the buyer sees, one is the server check that decides
   what enters the database. They cannot be collapsed into one without a
   shared module the EJS can also read. So they are asserted identical here
   instead. Removing a state from only one of them is the easiest possible
   mistake and produces either an option that fails on submit with no
   explanation, or a state nobody can select.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

const ctrl = read('src/controllers/checkoutController.js');
const view = read('views/pages/checkout-info.ejs');

/* Pull both lists out of source rather than importing the controller —
   requiring it pulls in config/database, which refuses to load without
   credentials a gate does not have. */
function serverStates() {
  const m = ctrl.match(/const US_STATES = new Set\(\(([\s\S]*?)\)\s*\.split\(' '\)\)/);
  if (!m) return null;
  return m[1].split('+').map((s) => s.replace(/['"\n\r]/g, '').trim())
             .join(' ').split(/\s+/).filter(Boolean);
}
function viewStates() {
  const m = view.match(/const STATES = \[([\s\S]*?)\];/);
  if (!m) return null;
  return (m[1].match(/'([A-Z]{2})'/g) || []).map((s) => s.replace(/'/g, ''));
}

/* ═══ 1. THE TWO LISTS ARE THE SAME LIST ════════════════════════════ */
console.log('--- the dropdown and the server agree ---');
const srv = serverStates();
const vw = viewStates();
{
  ok('US_STATES was found in checkoutController.js', Array.isArray(srv) && srv.length > 10,
     'the regex no longer matches — the gate is blind, fix it before trusting it');
  ok('STATES was found in checkout-info.ejs', Array.isArray(vw) && vw.length > 10,
     'same — a gate that cannot find its subject passes vacuously');

  if (srv && vw) {
    const a = [...new Set(srv)].sort();
    const b = [...new Set(vw)].sort();
    const onlyServer = a.filter((s) => !b.includes(s));
    const onlyView = b.filter((s) => !a.includes(s));
    ok('every state the server accepts is in the dropdown',
       onlyServer.length === 0,
       `server-only: ${onlyServer.join(' ')} — unreachable, nobody can select them`);
    ok('every state in the dropdown is accepted by the server',
       onlyView.length === 0,
       `dropdown-only: ${onlyView.join(' ')} — the buyer picks it, then submit fails ` +
       'with "Choose a state", which reads as a broken form');
    ok('the two lists are identical', a.join(' ') === b.join(' '));
  }
}

/* ═══ 2. WHAT THE PUBLISHED POLICY EXCLUDES ═════════════════════════
   /pages/shipping-policy: "We do not currently ship to Alaska, Hawaii,
   Puerto Rico, US territories, or international addresses. We also cannot
   ship to PO boxes, freight forwarders, or storage facilities." */
console.log('\n--- the excluded destinations are actually refused ---');
{
  for (const s of ['AK', 'HI']) {
    ok(`${s} is not accepted by the server`, srv && !srv.includes(s),
       'the policy page says we do not ship there');
    ok(`${s} is not offered in the dropdown`, vw && !vw.includes(s));
  }
  for (const t of ['PR', 'VI', 'GU', 'AS', 'MP']) {
    ok(`territory ${t} is not accepted`, srv && !srv.includes(t));
  }
  ok('the continental states are all still accepted',
     srv && ['CA', 'TX', 'NY', 'FL', 'GA', 'WA', 'ME'].every((s) => srv.includes(s)),
     'over-trimming the list is worse than the bug this fixes');
  ok('DC is still accepted', srv && srv.includes('DC'),
     'DC is continental and deliverable; it is not a territory');
  ok('48 states plus DC',
     srv && srv.length === 49,
     `found ${srv && srv.length} — expected 49`);
}

/* ═══ 3. ZIP PREFIXES, SO STATE AND ZIP CANNOT DISAGREE ═════════════
   The form posts state and ZIP independently. Without this, picking a
   neighbouring state with a Honolulu ZIP walks straight through. */
console.log('\n--- AK/HI ZIP prefixes are refused too ---');
{
  ok('a NON_DELIVERABLE_ZIP3 set exists', /NON_DELIVERABLE_ZIP3\s*=\s*new Set/.test(ctrl));
  for (const z of ['995', '996', '997', '998', '999']) {
    ok(`Alaska prefix ${z} is listed`, new RegExp(`'${z}'`).test(ctrl));
  }
  for (const z of ['967', '968']) {
    ok(`Hawaii prefix ${z} is listed`, new RegExp(`'${z}'`).test(ctrl));
  }
  ok('the ZIP check runs in validateInfo',
     /NON_DELIVERABLE_ZIP3\.has\(/.test(ctrl),
     'defined but never consulted is the same as absent');
  ok('it checks the first three digits',
     /ship_zip'\)\.slice\(0,\s*3\)/.test(ctrl));
}

/* ═══ 4. FORWARDERS AND STORAGE ════════════════════════════════════
   Deliberately a speed bump, not a gate — see the comment on
   NON_DELIVERABLE_PATTERNS. These assertions check it fires on the obvious
   cases and, more importantly, that it does NOT fire on ordinary addresses. */
console.log('\n--- forwarder / storage patterns ---');
{
  ok('NON_DELIVERABLE_PATTERNS exists', /NON_DELIVERABLE_PATTERNS\s*=\s*\[/.test(ctrl));
  ok('nonDeliverableReason is called from validateInfo',
     /nonDeliverableReason\(\[/.test(ctrl),
     'the list is useless unless something consults it');
  ok('it checks address2 and the recipient name, not just address1',
     /nonDeliverableReason\(\[v\('ship_address1'\), v\('ship_address2'\), v\('ship_name'\)\]\)/.test(ctrl),
     '"CubeSmart" lands in ship_name as often as in the street line');

  /* Exercise the real regexes rather than re-describing them. */
  const block = ctrl.slice(ctrl.indexOf('NON_DELIVERABLE_PATTERNS'),
                           ctrl.indexOf('function nonDeliverableReason'));
  const pats = [...block.matchAll(/re:\s*(\/[^/]+\/i)/g)]
    .map((m) => { try { return eval(m[1]); } catch { return null; } })  // eslint-disable-line no-eval
    .filter(Boolean);
  ok('the patterns compile', pats.length >= 10, `compiled ${pats.length}`);

  const hits = (s) => pats.some((re) => re.test(s));
  const MUST_BLOCK = [
    'ABC Freight Forwarding', 'Global Freight Forwarder', 'Pacific Shipping Agent',
    'Public Storage #4471', 'Extra Space Storage', 'CubeSmart Self Storage',
    'Life Storage Unit 221', 'U-Haul Moving & Storage', 'A1 Self-Storage',
    'Storage Facility B', 'Metro Storage Center',
  ];
  for (const s of MUST_BLOCK) ok(`blocks: ${s}`, hits(s));

  /* The assertions that matter most. A regex greedy enough to catch every
     forwarder also rejects real customers, and a blocked genuine order costs
     more than one that slips through. */
  const MUST_PASS = [
    '1420 Storage Road',            // a street named Storage
    '88 Cargo Lane',                // a street named Cargo
    '50 Ernest Barrett Pkwy NW',    // the real ship-from address
    '2217 Peachtree Street NE Apt 4',
    '14 Freight Street',            // a street named Freight, no forwarder word
    'Agent Smith',                  // a surname
    '9 Storage Hill Drive',
  ];
  for (const s of MUST_PASS) ok(`allows: ${s}`, !hits(s),
    'a false positive here silently blocks a paying customer');
}

/* ═══ 4b. NO GUARD IS PRESENT-BUT-DISABLED ═════════════════════════
   Added after the first mutation sweep, which caught 7 of 9. The two it
   missed both left the code in place and switched it off:

     else if (false && NON_DELIVERABLE_ZIP3.has(...))     -> MISSED
     if (false)  // was the PO box test                   -> MISSED

   Every assertion above looks for the PRESENCE of a string, so a check that
   still exists but can never fire reads as healthy. That is not a contrived
   mutation either — it is exactly what a quick "disable this for a minute to
   test something" edit looks like when it never gets reverted.

   So this section asserts the opposite: that nothing inside validateInfo is
   short-circuited by a literal. */
console.log('\n--- no validation guard is disabled in place ---');
{
  const start = ctrl.indexOf('function validateInfo');
  const body = start < 0 ? '' : ctrl.slice(start, ctrl.indexOf('\n}', start));
  ok('validateInfo was located', body.length > 400,
     'the slice failed — every assertion in this section is vacuous');

  const disabled = [
    [/if\s*\(\s*false\s*[)&]/,       'if (false'],
    [/\bfalse\s*&&/,                 'false &&'],
    [/&&\s*false\b/,                 '&& false'],
    [/if\s*\(\s*true\s*\|\|/,        'true ||'],
  ];
  for (const [re, label] of disabled) {
    ok(`no "${label}" short-circuit in validateInfo`, !re.test(body),
       'a guard that is present but can never fire is the same as no guard, ' +
       'and reads as healthy to every other check here');
  }

  /* Each guard must also still be reachable — asserted by its error key
     appearing on the left of an assignment, not merely as a string. */
  for (const key of ['ship_state', 'ship_zip', 'ship_address1']) {
    ok(`errors.${key} is still assigned in validateInfo`,
       new RegExp(`errors\\.${key}\\s*=`).test(body));
  }
}

/* ═══ 5. THE MESSAGES EXPLAIN THEMSELVES ═══════════════════════════ */
console.log('\n--- refusals say why ---');
{
  ok('AK/HI get a reason, not "Choose a state"',
     /cannot deliver to Alaska or Hawaii/.test(ctrl),
     'a generic error in front of someone who just picked Hawaii reads as a ' +
     'broken form; they retry, fail again, and leave');
  ok('the AK/HI ZIP message names the states',
     /ZIP code is in Alaska or Hawaii/.test(ctrl));
  ok('the forwarder message asks for the real destination',
     /final delivery address/.test(ctrl));
  ok('the storage message gives the reason',
     /present to inspect and sign/.test(ctrl),
     'ties the refusal to the inspection requirement the policy page explains');
  ok('the PO box check still exists',
     /cannot deliver to a PO box/.test(ctrl),
     'this one predates the change and must survive it');
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
