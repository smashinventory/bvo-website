#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_account_paths.js — no file under src/ points at the dead account
   directory, and the paths that do exist point at the live one.

   Run:  node gates/gate_account_paths.js
   Exit: 0 = pass, 1 = fail

   WHY THIS IS ASSERTED RATHER THAN REVIEWED
   ─────────────────────────────────────────────────────────────────────────
   On 2026-09-30 at 00:37:54 Hostinger recorded "Website slategrey-falcon-
   350174.hostingersite.com domain was changed to bathroomvanitiesoutlet.com".
   That operation RENAMES /home/u222311468/domains/<name>. Every hardcoded
   path in the app was left pointing at a directory that no longer exists.

   Nothing failed. Nothing logged. Both consumers of those paths use
   recursive directory creation — fs.mkdirSync({recursive:true}) in
   server.js, mkdir -p in the shell guard — and recursive creation makes a
   missing tree instead of erroring. So the app built a GHOST JM_Feed at
   the dead path on every restart (Runtime Logs: restarting every ~4
   minutes) while James Martin's FTP wrote to the real one. Runtime Logs
   read Errors: 0 the whole time. The only visible symptom was a feed that
   stopped arriving, which is indistinguishable from the vendor not
   publishing.

   A failure with no error to grep for cannot be caught by reading logs.
   So the literal is asserted here instead.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* The dead name is assembled rather than written out, so that this gate
   file does not itself count as an occurrence when the check below scans
   the repo — and so a careless copy-paste out of here cannot reintroduce
   it as a usable literal. */
const DEAD = ['slategrey-falcon-350174', 'hostingersite', 'com'].join('.');
const LIVE = '/home/u222311468/domains/bathroomvanitiesoutlet.com';
const ACCOUNT_PREFIX = '/home/u222311468/domains/';

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) walk(rel, out);
    /* .bak files are frozen snapshots of older revisions kept deliberately.
       They are not required by anything and must not be rewritten. */
    else if (/\.(js|ejs)$/.test(e.name) && !e.name.includes('.bak')) out.push(rel);
  }
  return out;
}

const srcFiles = walk('src');

/* ═══ 1. THE DEAD DIRECTORY IS GONE FROM RUNTIME CODE ════════════════ */
console.log('--- the renamed-away directory is not referenced ---');
{
  const offenders = srcFiles.filter(f => {
    const body = fs.readFileSync(path.join(ROOT, f), 'utf8');
    /* Only a FILESYSTEM reference is a fault. checkoutController.js keeps
       the old HOSTNAME in ALLOWED_RETURN_HOSTS on purpose — the temp URL
       is still a working escape hatch and must keep returning from Stripe.
       A hostname in an allowlist is not a path, so the account prefix is
       what makes this a match. */
    return body.split('\n').some(l => l.includes(ACCOUNT_PREFIX) && l.includes(DEAD));
  });
  ok('no file under src/ builds a path from the dead directory',
     offenders.length === 0,
     offenders.join(', ') + ' — this path no longer exists; recursive mkdir ' +
     'will silently create a ghost tree there instead of failing');
}

/* ═══ 2. AND THE LIVE ONE IS ACTUALLY USED ══════════════════════════
   Deleting the constant outright would pass check 1. These name the four
   files that must carry a real path, so an empty or removed literal is a
   failure rather than a pass. */
console.log('\n--- the live directory is in place ---');
{
  const MUST_USE_LIVE = [
    'src/server.js',
    'src/jobs/syncJMFeed.js',
    'src/jobs/importHuntingtonBrass.js',
    'src/jobs/shipmentStatusPoll.js',
  ];
  for (const f of MUST_USE_LIVE) {
    const body = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(`${f} uses the live account directory`,
       body.includes(LIVE),
       `expected ${LIVE}`);
  }
}

/* ═══ 3. NO THIRD NAME CREPT IN ═════════════════════════════════════
   A typo in the new literal fails exactly like the old one did — silently,
   via recursive mkdir. Every account path in src/ must be the live one. */
console.log('\n--- every account path is the same account path ---');
{
  const seen = new Map();
  for (const f of srcFiles) {
    const body = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of body.matchAll(/\/home\/u222311468\/domains\/([A-Za-z0-9._-]+)/g)) {
      if (!seen.has(m[1])) seen.set(m[1], []);
      if (!seen.get(m[1]).includes(f)) seen.get(m[1]).push(f);
    }
  }
  const names = [...seen.keys()];
  ok('exactly one account directory name appears in src/',
     names.length <= 1,
     names.map(n => `${n} (${seen.get(n).join(', ')})`).join(' | '));
  if (names.length === 1) {
    ok('and it is bathroomvanitiesoutlet.com',
       names[0] === 'bathroomvanitiesoutlet.com', names[0]);
  }
}

/* ═══ 4. THE STRIPE RETURN ALLOWLIST IS EXACTLY THE TWO LIVE HOSTS ═══
   Both must be present: dropping either breaks Stripe's return_url on that
   host, and the failure only appears after a real payment has been taken.

   The staging host must be ABSENT. It was in this list as a deliberate
   fallback until 2026-09-30, when it turned out Hostinger had performed a
   domain change rather than adding an alias — the hostname now refuses
   connections. A dead entry in a Host allowlist protects nothing and only
   widens what a forged Host header can pass. */
console.log('\n--- checkout return hosts are exactly the live pair ---');
{
  const co = fs.readFileSync(path.join(ROOT, 'src/controllers/checkoutController.js'), 'utf8');
  const block = co.slice(co.indexOf('ALLOWED_RETURN_HOSTS'),
                         co.indexOf('ALLOWED_RETURN_HOSTS') + 400);
  ok('www host is allowed as a Stripe return origin',
     block.includes("'www.bathroomvanitiesoutlet.com'"));
  ok('apex host is allowed as a Stripe return origin',
     /'bathroomvanitiesoutlet\.com'/.test(block));
  ok('the dead staging host is NOT in the allowlist',
     !block.includes(DEAD),
     'that hostname no longer resolves to this site — keeping it is pure ' +
     'attack surface for a forged Host header');
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
