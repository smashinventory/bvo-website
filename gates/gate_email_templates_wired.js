#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_email_templates_wired.js
 *
 * THE RULE: every email template that is ACTIVE in the database must have
 * something in src/ that actually sends it.
 *
 * WHY THIS EXISTS. On 2026-10-27 a gap analysis found four templates sitting
 * active in email_templates with no sender anywhere in the codebase:
 *
 *     out_for_delivery   "Today is the day — your dream vanity ... 🎉"
 *     order_delivered    "Your new bathroom chapter starts now"
 *     review_request     "How is the new vanity looking?"
 *     cross_sell         "The mirror that was made for your vanity"
 *
 * A customer spending $2,195 heard from BVO at purchase and at shipment and
 * then never again. No delivery confirmation, no review request, no
 * cross-sell. shipmentStatusPoll.js flips an order to 'delivered' and does
 * not require brevoService at all.
 *
 * ⚠️ THE PART THAT MAKES THIS A GATE AND NOT A NOTE. Earlier that same day
 * the out_for_delivery SUBJECT LINE was rewritten to the owner's wording,
 * gated, committed and pushed — polished copy on an email with no sender.
 * Nothing in the test suite could notice, because every existing gate asks
 * "is this template well-formed?" and none asked "does anything send it?"
 *
 * ── WHY A MANIFEST AND NOT A DB QUERY ──────────────────────────────────
 * Rule 14: a gate must RUN without opening a database connection, or it
 * cannot run in CI or on a laptop. So the live keys are checked in here as
 * a manifest. That has a real cost — the manifest can drift from the live
 * table — so TEMPLATE_MANIFEST carries the date it was taken and there is
 * a check below that fails if it looks stale against the migrations.
 *
 * Refresh it with:
 *     SELECT trigger_key, is_active FROM email_templates ORDER BY trigger_key;
 *
 * Run:  node gates/gate_email_templates_wired.js
 * Exit: 0 = pass, 1 = fail
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* ── THE MANIFEST ──────────────────────────────────────────────────────
   Taken from the live database 2026-10-27, refreshed 2026-11-12. All rows
   were is_active=1.

   ⚠️ back_in_stock WAS ADDED BY THE STALENESS CHECK, NOT BY HAND. The
   template went live on 2026-11-09 (migration 2026-11-09_stock_notifications)
   and this manifest was not updated with it, so the gate failed exactly as
   designed — "in a migration but not the manifest". It is wired:
   src/jobs/stockNotify.js sends it from the daily cron. That check is the
   only thing standing between this manifest and quiet rot, which is why it
   compares against the migrations rather than trusting the date. */
const MANIFEST_DATE = '2026-11-12';
const TEMPLATE_MANIFEST = [
  'back_in_stock',
  'cart_recovery',
  'cross_sell',
  'order_confirmed',
  'order_delivered',
  'order_shipped',
  'out_for_delivery',
  'return_approved',
  'return_resolved',
  'review_request',
  'vanity_in_preparation',
];

/* ⚠️ KNOWN ORPHANS — ACCEPTED, NOT IGNORED.
   A template listed here is active in the database with no sender, and that
   is a recorded decision rather than an oversight. Each entry must carry a
   reason and the task that will close it. The gate PASSES on these but
   PRINTS them every run, so they cannot quietly become permanent.

   ⚠️ DELETING AN ENTRY HERE WITHOUT WIRING THE TEMPLATE FAILS THE GATE.
   That is the point: the only ways out are to wire it or to deactivate it
   in the database. "Stop checking" is not one of them. */
const ACCEPTED_ORPHANS = {
  out_for_delivery: 'GAP-01 — needs a sender in shipmentStatusPoll when a carrier reports out-for-delivery',
  order_delivered:  'GAP-01 — needs a sender in shipmentStatusPoll when status flips to delivered',
  review_request:   'GAP-01 — needs a delayed send after delivery; subject wording also still open',
  cross_sell:       'GAP-01 — needs a delayed send after delivery',
};

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};

/* Comments stripped before any search. A comment mentioning a trigger_key is
   not a sender — out_for_delivery had exactly three references in src/ and
   all three were ENUM commentary. This gate was written knowing that, since
   the same trap bit three separate gates on 2026-10-27. */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

console.log('\ngate_email_templates_wired — every live template has a sender\n');

/* ── Collect every key that something actually SENDS ──────────────────── */
const files = walk(path.join(ROOT, 'src'));
const senders = new Map();   // key -> file that sends it

/* A sender is a sendTemplate call whose first argument is a string literal,
   OR a module-scope constant passed to sendTemplate (cartRecovery.js uses
   TEMPLATE_KEY). Both forms are resolved; anything else is not a send. */
for (const f of files) {
  if (f.endsWith('emailTemplatesController.js')) continue;   // admin CRUD, not a sender
  const src = strip(fs.readFileSync(f, 'utf8'));

  for (const m of src.matchAll(/sendTemplate\(\s*'([a-z0-9_]+)'/g)) {
    senders.set(m[1], path.relative(ROOT, f));
  }
  /* const FOO = 'key' ... sendTemplate(FOO, */
  for (const m of src.matchAll(/sendTemplate\(\s*([A-Z_][A-Z0-9_]*)\s*,/g)) {
    const constRe = new RegExp(`${m[1]}\\s*=\\s*'([a-z0-9_]+)'`);
    const hit = src.match(constRe);
    if (hit) senders.set(hit[1], path.relative(ROOT, f));
  }
}

console.log(`  (found ${senders.size} template(s) with a real sender in src/)\n`);

/* ── 1. EVERY TEMPLATE IS EITHER WIRED OR AN ACCEPTED ORPHAN ─────────── */
console.log('--- every live template is wired, or accepted and listed ---');
{
  const unexplained = [];
  for (const key of TEMPLATE_MANIFEST) {
    if (senders.has(key)) continue;
    if (Object.prototype.hasOwnProperty.call(ACCEPTED_ORPHANS, key)) continue;
    unexplained.push(key);
  }

  check(unexplained.length === 0,
        'no template is active with an unexplained missing sender',
        unexplained.length
          ? 'ORPHANED: ' + unexplained.join(', ') +
            '\n         Either wire a sendTemplate call, deactivate the row ' +
            '(is_active = 0), or add it to ACCEPTED_ORPHANS with a reason ' +
            'and the task that closes it.'
          : null);
}

/* ── 2. AN ACCEPTED ORPHAN MUST STILL BE AN ORPHAN ───────────────────── */
console.log('\n--- the accepted-orphan list does not go stale ---');
{
  const nowWired = Object.keys(ACCEPTED_ORPHANS).filter(k => senders.has(k));
  check(nowWired.length === 0,
        'nothing on the accepted-orphan list has quietly been wired',
        nowWired.length
          ? nowWired.join(', ') + ' now HAS a sender — remove from ' +
            'ACCEPTED_ORPHANS so the gate starts protecting it properly. ' +
            'A stale exemption is a check nobody is running.'
          : null);

  const notInManifest = Object.keys(ACCEPTED_ORPHANS)
    .filter(k => !TEMPLATE_MANIFEST.includes(k));
  check(notInManifest.length === 0,
        'every accepted orphan is a real template',
        notInManifest.length ? 'not in the manifest: ' + notInManifest.join(', ') : null);

  for (const [k, why] of Object.entries(ACCEPTED_ORPHANS)) {
    check(typeof why === 'string' && why.length > 25,
          `${k} carries a reason`,
          'an exemption with no reason becomes permanent by default');
  }
}

/* ── 3. THE MANIFEST ITSELF ──────────────────────────────────────────── */
console.log('\n--- the manifest is plausible against the migrations ---');
{
  /* ⚠️ THE MANIFEST IS A SNAPSHOT AND SNAPSHOTS ROT. This cannot verify the
     live table without a database, so it does the next best thing: every
     trigger_key INSERTed by a migration must appear in the manifest. A new
     template added by migration and forgotten here would otherwise be
     invisible to this gate entirely. */
  const migDir = path.join(ROOT, 'migrations');
  const keys = new Set();
  for (const f of fs.readdirSync(migDir).filter(f => f.endsWith('.sql'))) {
    const sql = fs.readFileSync(path.join(migDir, f), 'utf8')
                  .replace(/^\s*--.*$/gm, '');          // strip SQL comments
    const ins = sql.matchAll(/INSERT INTO email_templates[\s\S]{0,400}?VALUES\s*\(\s*'([a-z0-9_]+)'/g);
    for (const m of ins) keys.add(m[1]);
  }

  const missing = [...keys].filter(k => !TEMPLATE_MANIFEST.includes(k));
  check(missing.length === 0,
        `every migration-inserted template is in the manifest (${keys.size} found)`,
        missing.length
          ? 'in a migration but not the manifest: ' + missing.join(', ') +
            '\n         Re-take the manifest: SELECT trigger_key, is_active ' +
            'FROM email_templates ORDER BY trigger_key;'
          : null);

  check(/^\d{4}-\d{2}-\d{2}$/.test(MANIFEST_DATE),
        `the manifest records when it was taken (${MANIFEST_DATE})`);
}

/* ── 4. REPORT ───────────────────────────────────────────────────────── */
console.log('\n--- current state ---');
for (const key of TEMPLATE_MANIFEST) {
  if (senders.has(key))  console.log(`  sends    ${key.padEnd(24)} ${senders.get(key)}`);
  else                   console.log(`  ORPHAN   ${key.padEnd(24)} ${ACCEPTED_ORPHANS[key] || '(unexplained)'}`);
}

console.log(fail ? `\n*** ${fail} of ${pass + fail} CHECKS FAILED ***`
                 : `\nALL ${pass} CHECKS PASS`);
process.exit(fail ? 1 : 0);
