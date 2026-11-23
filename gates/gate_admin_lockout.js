#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_admin_lockout.js
 *
 * THE RULE: the admin login lockout must actually lock, actually unlock,
 * and actually forgive a good password — proven by RUNNING it, not by
 * grepping for it.
 *
 * WHY THIS EXISTS. Until 2026-11-22 the only brute-force protection on
 * /admin/login was express-rate-limit. Hostinger flagged
 * GHSA-cppf-2hm6-mrvm against it on 2026-11-18: prototype pollution makes
 * the counter return an inherited value, so the limiter silently stops
 * counting while still returning 200s. A control that fails OPEN and
 * QUIET is worse than no control, because nobody goes looking.
 *
 * The replacement lives in adminController (_loginAttempts). This gate is
 * the part that keeps it honest. A lockout nobody has watched engage is
 * decoration — the same lesson the free-samples gate cost us (see
 * CHECKOUT_PAYMENT_LIFECYCLE §10).
 *
 * ── WHY IT SETS DB_PASS ────────────────────────────────────────────────
 * Rule 14: a gate must RUN without opening a database connection.
 * adminController requires src/config/database, which REFUSES TO LOAD
 * without DB_PASS in the environment. The mysql2 pool is lazy — it does
 * not dial out until something queries — and this gate never queries. So
 * a placeholder satisfies the load-time guard without a connection ever
 * being attempted. This is the same wall that strands
 * gate_orders_visibility.js (task #407); that one genuinely needs a
 * database, this one does not.
 *
 * Run:  node gates/gate_admin_lockout.js
 * Exit: 0 = pass, 1 = fail
 * ───────────────────────────────────────────────────────────────────────── */

if (!process.env.DB_PASS) process.env.DB_PASS = 'gate-placeholder-never-dialled';

const L = require('../src/controllers/adminController').__lockoutInternals;

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};

console.log('\ngate_admin_lockout — the lockout engages, expires, and forgives\n');

/* ── 0. THE SEAM EXISTS ────────────────────────────────────────────────
   If someone deletes the lockout, this is what fails first and loudest,
   rather than every case below failing with an unreadable TypeError. */
console.log('--- the control is present at all ---');
check(L && typeof L.registerFailure === 'function',
      'adminController exposes __lockoutInternals',
      'The lockout has been removed or renamed. /admin/login is back to ' +
      'depending on express-rate-limit alone — see GHSA-cppf-2hm6-mrvm.');
if (fail) { console.log('\n*** 1 of 1 CHECKS FAILED ***'); process.exit(1); }

check(L.MAX >= 3 && L.MAX <= 10,
      `the threshold is a defensible number (${L.MAX})`,
      'Below 3 locks the owner out on ordinary typos; above 10 stops ' +
      'being a brute-force control.');
check(L.MS >= 5 * 60 * 1000,
      `the penalty is at least 5 minutes (${L.MS / 60000}m)`,
      'A lockout shorter than this is a speed bump, not a defence.');

/* ── 1. IT LOCKS, AND NOT ONE ATTEMPT EARLY ──────────────────────────── */
console.log('\n--- it locks on the Nth failure, and not before ---');
{
  L.reset();
  const ip = '198.51.100.7';
  const now = Date.now();

  let lockedEarly = null;
  for (let i = 1; i < L.MAX; i++) {
    L.registerFailure(ip, now);
    if (L.lockRemaining(ip, now) > 0 && lockedEarly === null) lockedEarly = i;
  }
  check(lockedEarly === null,
        `${L.MAX - 1} failures do NOT lock`,
        lockedEarly !== null
          ? `locked after only ${lockedEarly} — the owner would be shut out ` +
            'of their own store by ordinary mistyping'
          : null);

  L.registerFailure(ip, now);
  check(L.lockRemaining(ip, now) > 0,
        `failure #${L.MAX} DOES lock`,
        'The counter increments but never engages — the exact fail-open ' +
        'shape this gate exists to catch.');
}

/* ── 2. THE LOCK IS SCOPED TO ONE IP ─────────────────────────────────── */
console.log('\n--- one attacker cannot lock out everyone ---');
{
  L.reset();
  const now = Date.now();
  for (let i = 0; i < L.MAX; i++) L.registerFailure('203.0.113.9', now);

  check(L.lockRemaining('203.0.113.9', now) > 0, 'the offending IP is locked');
  check(L.lockRemaining('192.0.2.50', now) === 0,
        'a DIFFERENT IP is untouched',
        'The lock is global, so any stranger can lock the owner out of ' +
        'their own admin from anywhere. Keying must stay per-IP.');
}

/* ── 3. THE WINDOW ACTUALLY EXPIRES ──────────────────────────────────── */
console.log('\n--- the penalty ends, and ending it is a clean slate ---');
{
  L.reset();
  const ip  = '198.51.100.22';
  const now = Date.now();
  for (let i = 0; i < L.MAX; i++) L.registerFailure(ip, now);

  check(L.lockRemaining(ip, now + L.MS - 1000) > 0,
        'still locked one second before the window closes');
  check(L.size() === 1, 'precondition: the record survives a pre-expiry read');

  /* THE expiring read. Nothing else runs between here and the size check
     below — see the note on why that matters. */
  const after = L.lockRemaining(ip, now + L.MS + 1000);
  check(after === 0,
        'unlocked one second after the window closes',
        'A lockout that never lifts is a permanent outage of the admin panel.');

  /* ⚠️ THE SUBTLE ONE, AND THE ONE THAT NEARLY GOT AWAY.
     If expiry clears only `lockedUntil` and leaves `fails` at MAX, the
     very next wrong guess re-locks instantly — a 15-minute penalty
     silently becomes permanent. Serving the window must drop the whole
     record, not just the lock.

     The obvious way to test that is "fail once after expiry, assert not
     locked". THAT TEST PASSES ON THE BUG, which the mutation harness
     caught: _registerFailure prunes first, and by then the entry is old
     enough to be swept, so the prune hides the broken expiry. The prune
     and the lock window are the same length, so this is not a near miss
     — it masks the bug every time.

     So assert on the RECORD, via lockRemaining alone, with no call that
     could prune on the way past. */
  check(L.size() === 0,
        'serving the window DROPS the record, not just the lock',
        'lockedUntil was zeroed but fails stayed at the maximum. The next ' +
        'single wrong guess re-locks immediately, so the first lockout is ' +
        'effectively permanent.');
}

/* ── 4. A GOOD PASSWORD FORGIVES ─────────────────────────────────────── */
console.log('\n--- a successful login wipes the slate ---');
{
  L.reset();
  const ip = '198.51.100.31';
  const now = Date.now();
  for (let i = 0; i < L.MAX - 1; i++) L.registerFailure(ip, now);

  L.clearFailures(ip);
  for (let i = 0; i < L.MAX - 1; i++) L.registerFailure(ip, now);
  check(L.lockRemaining(ip, now) === 0,
        `${L.MAX - 1} failures, a success, then ${L.MAX - 1} more — still open`,
        'Success does not reset the counter, so a few typos today lock the ' +
        'owner out on a single typo tomorrow.');
}

/* ── 5. THE MAP CANNOT GROW WITHOUT BOUND ────────────────────────────── */
console.log('\n--- a rotating-IP attack cannot exhaust memory ---');
{
  L.reset();
  const now = Date.now();
  for (let i = 0; i < 500; i++) L.registerFailure(`10.0.${(i / 256) | 0}.${i % 256}`, now);
  const peak = L.size();

  /* One failure a full window later must sweep the stale 500. */
  L.registerFailure('172.16.0.1', now + L.MS + 1000);
  check(L.size() < peak,
        `${peak} stale entries are pruned once the window passes (now ${L.size()})`,
        'Nothing prunes the Map. A long attack from rotating IPs grows it ' +
        'until the process dies — a memory leak wearing a security hat.');
}

console.log(fail ? `\n*** ${fail} of ${pass + fail} CHECKS FAILED ***`
                 : `\nALL ${pass} CHECKS PASS`);
process.exit(fail ? 1 : 0);
