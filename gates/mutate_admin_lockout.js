#!/usr/bin/env node
'use strict';
/* Mutation harness for gate_admin_lockout.js.
 *
 * A gate nobody has watched FAIL is decoration. This breaks the lockout
 * six specific ways and asserts the gate catches every one, then restores
 * adminController.js and proves the restore by SHA-256.
 *
 * Each mutation is a real bug someone could plausibly introduce.
 *
 * Run: node gates/mutate_admin_lockout.js
 *
 * WHY .js AND NOT .sh like its 53 siblings: the mutations here contain
 * regex-ish punctuation and embedded newlines, and shell escaping mangled
 * two of them silently in an earlier harness in this repo — a mutation
 * that does not apply cleanly tests NOTHING and still prints a tidy pass.
 * Node does the substitution literally, so that failure mode is gone. The
 * anchor-not-found branch below counts as a leak for the same reason.
 */
const fs   = require('fs');
const cp   = require('child_process');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'src/controllers/adminController.js');
const GATE   = path.join(ROOT, 'gates/gate_admin_lockout.js');

const original = fs.readFileSync(TARGET, 'utf8');
const origHash = crypto.createHash('sha256').update(original).digest('hex');

const MUTATIONS = [
  { name: 'the lock never engages (counter increments, nothing happens)',
    from: 'if (rec.fails >= LOCKOUT_MAX_ATTEMPTS) rec.lockedUntil = now + LOCKOUT_MS;',
    to:   '/* mutated: never locks */' },

  { name: 'locks one attempt EARLY (owner shut out by ordinary typos)',
    from: 'if (rec.fails >= LOCKOUT_MAX_ATTEMPTS) rec.lockedUntil = now + LOCKOUT_MS;',
    to:   'if (rec.fails >= LOCKOUT_MAX_ATTEMPTS - 1) rec.lockedUntil = now + LOCKOUT_MS;' },

  { name: 'the lock never lifts (permanent admin outage)',
    from: '  if (rec.lockedUntil <= now) {',
    to:   '  if (false) {' },

  { name: 'expiry clears the lock but NOT the counter (penalty becomes permanent)',
    from: '    _loginAttempts.delete(key);\n    return 0;\n  }\n  return rec.lockedUntil - now;',
    to:   '    rec.lockedUntil = 0;\n    return 0;\n  }\n  return rec.lockedUntil - now;' },

  { name: 'a successful login does not reset the counter',
    from: 'function _clearFailures(key) {\n  _loginAttempts.delete(key);\n}',
    to:   'function _clearFailures(key) {\n  /* mutated: no-op */\n}' },

  { name: 'stale entries are never pruned (unbounded memory growth)',
    from: '    if (now - rec.seen > LOCKOUT_MS) _loginAttempts.delete(key);',
    to:   '    void rec; void key;' },

  { name: 'the lock is global, not per-IP (anyone can lock the owner out)',
    from: '  const rec = _loginAttempts.get(key);\n  if (!rec || !rec.lockedUntil) return 0;',
    to:   '  const rec = [..._loginAttempts.values()].find(r => r.lockedUntil) || _loginAttempts.get(key);\n  if (!rec || !rec.lockedUntil) return 0;' },
];

function runGate() {
  const r = cp.spawnSync('node', [GATE], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

let leaks = 0;

/* Baseline: the gate must PASS on the real file, or every result below
   is meaningless. */
console.log('\nmutate_admin_lockout — the gate must fail on each broken lockout\n');
{
  const base = runGate();
  if (base.code !== 0) {
    console.log('  BASELINE FAILED — the gate does not pass on the unmutated file.');
    console.log(base.out);
    process.exit(1);
  }
  console.log('  baseline: gate passes on the real file\n');
}

for (const m of MUTATIONS) {
  if (!original.includes(m.from)) {
    console.log(`  SKIPPED (anchor not found) ${m.name}`);
    console.log('           The code moved; this mutation no longer applies and is');
    console.log('           silently testing nothing. Re-anchor it.');
    leaks++;
    continue;
  }
  fs.writeFileSync(TARGET, original.replace(m.from, m.to));
  const r = runGate();
  if (r.code !== 0) {
    const caught = (r.out.match(/FAIL [^\n]+/g) || []).slice(0, 2).join(' | ');
    console.log(`  caught   ${m.name}`);
    console.log(`           → ${caught}`);
  } else {
    console.log(`  *** LEAK ${m.name}`);
    console.log('           The gate PASSED on broken code. It is not protecting this.');
    leaks++;
  }
}

/* ── RESTORE, AND PROVE IT ─────────────────────────────────────────────
   A harness that throws before this line leaves the controller mutated on
   disk. That happened once in this repo already, so the restore is
   verified by hash rather than assumed. */
fs.writeFileSync(TARGET, original);
const back = crypto.createHash('sha256').update(fs.readFileSync(TARGET, 'utf8')).digest('hex');
console.log(`\n  restored: ${back === origHash ? 'byte-for-byte OK' : '*** HASH MISMATCH ***'}`);
console.log(`  sha256:   ${back}`);
if (back !== origHash) process.exit(1);

const final = runGate();
console.log(`  gate on the restored file: ${final.code === 0 ? 'PASSES' : '*** FAILS ***'}`);

console.log(leaks ? `\n*** ${leaks} LEAK(S) — the gate does not cover these ***`
                  : `\nALL ${MUTATIONS.length} MUTATIONS CAUGHT`);
process.exit(leaks || final.code ? 1 : 0);
