#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * mutate_email_templates_have_senders.js
 *
 * A gate nobody has seen FAIL is a decoration. This breaks the wiring on
 * purpose, three ways, and asserts the gate notices each one — then puts
 * every file back byte-for-byte.
 *
 * ⚠️ THE GATE'S MAIN RULE NEEDS A DATABASE, SO IT IS NOT MUTATED HERE.
 * What IS mutated is the scanner the main rule depends on: if the scanner
 * cannot see a send, the main rule reports a wired template as orphaned
 * (false alarm) or — far worse, and the reason this file exists — keeps
 * reporting green after somebody deletes a real send.
 *
 * ⚠️ A MUTATION THAT CANNOT BE APPLIED MUST NOT VANISH. If the source has
 * moved on and an anchor no longer matches, that is reported as a FAILURE,
 * not skipped quietly. A harness that silently tests nothing is worse than
 * none, because it reports success. (Same rule as commit be48863.)
 *
 * Run:  node gates/mutate_email_templates_have_senders.js
 * Exit: 0 = every mutation was caught, 1 = at least one slipped through
 * ───────────────────────────────────────────────────────────────────────── */

const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'gate_email_templates_have_senders.js');
const POLL = path.join(ROOT, 'src/jobs/shipmentStatusPoll.js');

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

let pass = 0, fail = 0;
const ok = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};

/** Run the gate's static half; return its stdout (it may exit non-zero). */
function runGate() {
  try {
    return execFileSync('node', [GATE, '--no-db'], { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}

console.log('\nmutate_email_templates_have_senders — break it, prove it notices\n');

/* Baseline: the gate must be green and must SEE both new sends before
   anything is touched. Mutating from a broken baseline proves nothing. */
const baseline = runGate();
ok(/out_for_delivery\s+src\/jobs\/shipmentStatusPoll/.test(baseline),
   'baseline: the gate sees the out_for_delivery send');
ok(/order_delivered\s+src\/jobs\/shipmentStatusPoll/.test(baseline),
   'baseline: the gate sees the order_delivered send');
ok(/sendOnce\(\) reaches brevo\.sendTemplate/.test(baseline),
   'baseline: the wrapper assertion passes');

const MUTATIONS = [
  {
    name: 'delete the out_for_delivery send',
    file: POLL,
    find: `sendOnce(ctx, 'out_for_delivery'`,
    repl: `sendOnce(ctx, 'REMOVED_BY_MUTATION'`,
    expect: out => !/out_for_delivery\s+src\/jobs\/shipmentStatusPoll/.test(out),
    why: 'The gate still lists out_for_delivery as sent after the call was removed. '
       + 'That is GAP-01 able to recur with the gate reporting green.',
  },
  {
    name: 'hide the send inside a comment (the GAP-01 near-miss)',
    file: POLL,
    find: `        const r = await sendOnce(ctx, 'order_delivered', 'delivered_email_sent_at', {`,
    repl: `        /* const r = await sendOnce(ctx, 'order_delivered', 'delivered_email_sent_at', { */ const r = 'skipped'; const _unused = ({`,
    expect: out => !/order_delivered\s+src\/jobs\/shipmentStatusPoll/.test(out),
    why: 'A commented-out send was counted as a real one. This is exactly how '
       + 'three comments about out_for_delivery made the original gap look wired.',
  },
  {
    name: 'make the sendOnce wrapper stop sending',
    file: POLL,
    find: 'const res = await brevo.sendTemplate(key, ctx.to, vars, ctx.name);',
    repl: 'const res = { ok: true };   // MUTATION: sends nothing',
    expect: out => /FAIL sendOnce\(\) reaches brevo\.sendTemplate/.test(out),
    why: 'The wrapper no longer sends, yet the gate still trusts every key routed '
       + 'through it. Two templates would report as wired while going nowhere.',
  },
];

for (const m of MUTATIONS) {
  console.log(`\n--- ${m.name} ---`);
  const before = fs.readFileSync(m.file, 'utf8');
  const hash   = sha(m.file);

  /* ⚠️ A MISSING ANCHOR IS A FAILURE, NOT A SKIP. */
  if (!before.includes(m.find)) {
    ok(false, `anchor not found in ${path.relative(ROOT, m.file)}`,
       `Looked for: ${m.find}\n         The source has moved on and this mutation `
       + `tested NOTHING. Re-anchor it rather than deleting it.`);
    continue;
  }

  fs.writeFileSync(m.file, before.replace(m.find, m.repl));
  try {
    const out = runGate();
    ok(m.expect(out), 'the gate notices', m.why);
  } finally {
    fs.writeFileSync(m.file, before);
    ok(sha(m.file) === hash, 'source restored byte-for-byte',
       'The working tree was left modified. Check git status before committing.');
  }
}

/* The gate must be green again once everything is restored — otherwise a
   later failure gets blamed on the gate rather than on this harness. */
console.log('\n--- after restore ---');
const after = runGate();
ok(/out_for_delivery\s+src\/jobs\/shipmentStatusPoll/.test(after)
   && /order_delivered\s+src\/jobs\/shipmentStatusPoll/.test(after),
   'the gate is green again and sees both sends');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
