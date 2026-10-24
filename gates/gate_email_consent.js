#!/usr/bin/env node
'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   gate_email_consent.js — task #374, the unsubscribe mechanism.

   The decision rule (diff) is a PURE FUNCTION and is EXECUTED here, not
   grepped. Rule 14: a gate that re-implements the rule it is checking
   agrees with the implementation by construction and proves nothing.

   The check that matters most is the TRUNCATED LIST one. Brevo's blocklist
   is paged and fetchBlockedContacts() gives up at 2000 addresses, flagging
   partial:true. If a truncated page is treated as the whole truth, every
   blocked customer missing from it gets marked reachable and we resume
   mailing people who opted out. That is worse than the job never running.
   ═══════════════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* ⚠️ config/database HARD-EXITS without DB_PASS, and brevoService requires
   it at module scope (line 19), so requiring the job would kill this gate
   before the first check. Stubbed the same way gate_remember_device does.

   The stub is never actually called — every check below either executes the
   PURE diff function or reads source text. If a future check needs a query,
   push onto `queries` here and assert on it rather than reaching for a real
   connection. */
const Module = require('module');
const origLoad = Module._load;
const queries = [];
Module._load = function (request) {
  if (request.indexOf('config/database') !== -1) {
    return { bvoPool: { query: async (sql, params) => {
      queries.push({ sql, params }); return [[]];
    } } };
  }
  return origLoad.apply(this, arguments);
};

let pass = 0, fail = 0;
const ok = (c, label, why) => {
  if (c) { pass++; console.log(`  ok   ${label}`); }
  else   { fail++; console.log(`  FAIL ${label}${why ? `   <- ${why}` : ''}`); }
};

const JOB_RAW = fs.readFileSync(path.join(ROOT, 'src/jobs/brevoConsentReconcile.js'), 'utf8');
const JOB = JOB_RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const job  = require(path.join(ROOT, 'src/jobs/brevoConsentReconcile.js'));
const diff = job._diff;

console.log('\n1. The decision rule is executable, not just readable');
ok(typeof diff === 'function', 'diff is exported',
  'Without this the rule can only be grepped, and a gate that greps a rule tests nothing.');

console.log('\n2. Transitions only — the job must be idempotent');
{
  const rows = [
    { id: 1, email: 'new@x.com',     email_blocked: 0 },
    { id: 2, email: 'already@x.com', email_blocked: 1 },
    { id: 3, email: 'fine@x.com',    email_blocked: 0 },
  ];
  const r = diff(['new@x.com', 'already@x.com'], rows);
  ok(r.toBlock.length === 1 && r.toBlock[0].id === 1,
    'a newly blocked address is picked up',
    `blocked ${JSON.stringify(r.toBlock.map(x => x.id))}`);
  ok(!r.toBlock.some(x => x.id === 2),
    'an already-blocked address is NOT re-reported',
    'Re-reporting means a duplicate event row and a fresh owner email every single night.');
  ok(r.toRestore.length === 0, 'an unblocked, never-blocked address is left alone', 'spurious restore');
}

console.log('\n3. Restores happen on a COMPLETE list');
{
  const rows = [{ id: 7, email: 'came.back@x.com', email_blocked: 1 }];
  const r = diff([], rows, { partial: false });
  ok(r.toRestore.length === 1 && r.toRestore[0].id === 7,
    'off the blocklist on a full read = restored',
    'Someone unblocked in Brevo stays marked unreachable forever.');
}

console.log('\n4. ⚠️ A TRUNCATED LIST NEVER CLEARS A BLOCK');
{
  const rows = [
    { id: 7, email: 'blocked.but.unseen@x.com', email_blocked: 1 },
    { id: 8, email: 'also.blocked@x.com',       email_blocked: 1 },
  ];
  const r = diff([], rows, { partial: true });
  ok(r.toRestore.length === 0,
    'absence from a partial list restores NOBODY',
    'THE DANGEROUS ONE. A truncated page read as complete marks opted-out customers reachable and resumes mailing them.');
  ok(r.skippedRestores === 2,
    'and the skipped count is reported so a silent no-op is visible',
    'If the job silently does nothing on every run, nobody finds out until a complaint.');

  /* A partial list must still RECORD new blocks — those are positive
     evidence and are safe regardless of truncation. */
  const r2 = diff(['fresh@x.com'], [{ id: 9, email: 'fresh@x.com', email_blocked: 0 }], { partial: true });
  ok(r2.toBlock.length === 1,
    'but a new block IS still recorded on a partial list',
    'Presence on the list is positive evidence; truncation does not make it doubtful.');
}

console.log('\n5. Email matching is case- and whitespace-insensitive');
{
  const rows = [{ id: 11, email: '  Mixed.Case@X.com ', email_blocked: 0 }];
  const r = diff(['mixed.case@x.com'], rows);
  ok(r.toBlock.length === 1,
    'Brevo lowercase vs DB mixed case still matches',
    'Brevo normalises addresses; the DB does not. A case mismatch silently never matches and the job reports 0 forever.');
}

console.log('\n6. Consent is withdrawn on block, and NOT handed back on restore');
{
  const iBlock = JOB.indexOf("event, reason, source, was_trade");
  const blockStmt = JOB.slice(JOB.indexOf('for (const row of toBlock)'),
                              JOB.indexOf('for (const row of toRestore)'));
  const restoreStmt = JOB.slice(JOB.indexOf('for (const row of toRestore)'),
                                JOB.indexOf('checked_at stamp') > 0
                                  ? JOB.indexOf('res.partial', JOB.indexOf('for (const row of toRestore)'))
                                  : JOB.length);

  ok(/accepts_marketing\s*=\s*0/.test(blockStmt),
    'blocking sets accepts_marketing = 0',
    'The unsubscribe IS the withdrawal of permission. Without this, marketing sends keep reading a stale 1.');
  ok(!/accepts_marketing/.test(restoreStmt),
    'restoring does NOT touch accepts_marketing',
    'Permission withdrawn must be given again BY THE CUSTOMER. An admin unblocking an address so a receipt can go out is not consent to promotions.');
  ok(/email_blocked\s*=\s*0/.test(restoreStmt),
    'but it does clear email_blocked',
    'Deliverability and permission are separate facts; the restore is about reachability.');
}

console.log('\n7. A failed fetch changes nothing');
{
  const head = JOB.slice(JOB.indexOf('const res = await brevo.fetchBlockedContacts'),
                         JOB.indexOf('const byEmail'));
  ok(/if\s*\(!res\.ok\)/.test(head) && /return\s*\{\s*ok:\s*false/.test(head),
    'a blocklist read failure aborts before any write',
    'An errored fetch looks exactly like an empty blocklist — letting it through restores EVERY blocked customer at once.');
  ok(JOB.indexOf('if (!res.ok)') < JOB.indexOf('UPDATE customers'),
    'and it aborts BEFORE the first UPDATE',
    'ordering');
}

console.log('\n8. The tier rule is executed, not re-implemented');
ok(/require\(.*utils\/tiers.*\)/.test(JOB) && /isTradeTier\(/.test(JOB),
  'trade detection uses tiers.isTradeTier',
  'A second definition of "is trade" drifts from the one that gates MAP pricing.');
ok(!/\/trade\|elite\/i/.test(JOB),
  'and there is no ad-hoc tier regex left',
  'The first draft of this job matched /trade|elite/i, which would count a tier called trade_pending and miss a rename.');

console.log('\n9. The owner notification');
{
  const notify = JOB.slice(JOB.indexOf('async function notifyOwner'));
  ok(/sendRaw\(\s*\n?\s*to,/.test(notify) || /sendRaw\(to,/.test(notify),
    'sendRaw is called POSITIONALLY',
    'sendRaw is (toEmail, subject, htmlBody, toName). An object argument sends to "[object Object]" with no subject, and node --check passes it.');
  ok(!/sendRaw\(\s*\{/.test(JOB),
    'and never with an object',
    'Same defect, stated as an absolute.');
  ok(/hits\.map/.test(notify) && (notify.match(/sendRaw/g) || []).length === 1,
    'one digest, not one email per customer',
    'A batch of historical unsubscribes would otherwise fire a mail per row on the backfill run.');
  ok(/TRADE_NOTIFY_EMAIL/.test(notify),
    'the recipient is configurable without a code change',
    'Same rule as the trade application notification.');
  ok(/not\s*<\/strong>\s*been changed|<strong>not<\/strong> been changed/.test(notify),
    'and it says the pricing was NOT changed',
    'Owner decision was flag-for-review. A notification that does not say so invites the owner to assume the system already acted.');
}

console.log('\n10. Pricing is never changed by this job');
/* ⚠️ NOT ANCHORED ON "SET". First version matched /SET\s+tier\s*=/, which a
   mutation walked straight through by appending ", tier = 'none'" to an
   existing SET clause — the assignment was there, just not immediately
   after the keyword. Any `tier =` in this file is now a failure. The SELECT
   uses COALESCE(tier, '') and the reads use row.tier, neither of which
   assigns, so there is nothing legitimate for this to catch. */
ok(!/\btier\s*=/.test(JOB),
  'the job never writes customers.tier',
  'Owner decision 2026-10-23: flag for review, do NOT auto-downgrade. A customer who unsubscribes from one promo must not silently lose 15-20% mid-project.');

console.log('\n11. The migration matches what the code writes');
{
  const SQL = fs.readFileSync(path.join(ROOT, 'migrations/email_consent_2026-10-23.sql'), 'utf8');
  for (const col of ['email_blocked', 'email_blocked_at', 'email_blocked_reason', 'email_checked_at']) {
    ok(SQL.includes(col) && JOB.includes(col),
      `${col} is in BOTH the migration and the job`,
      'A column the code writes and the migration does not create fails at runtime, after deploy.');
  }
  ok(/CREATE TABLE IF NOT EXISTS email_consent_events/.test(SQL),
    'email_consent_events is created',
    'The job inserts into it unconditionally.');
  for (const col of ['was_trade', 'source', 'reason', 'event']) {
    ok(new RegExp(`\\b${col}\\b`).test(SQL),
      `email_consent_events.${col} exists`,
      'INSERT names this column.');
  }
}

console.log(
  fail === 0
    ? `\nGREEN  ${pass} passed, 0 failed`
    : `\ngate_email_consent: FAILED ${fail} of ${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);
