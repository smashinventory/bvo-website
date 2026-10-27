#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_cart_recovery.js
 *
 * THE RULES, IN ORDER OF WHAT THEY COST WHEN BROKEN:
 *
 *  1. NOBODY IS EMAILED WHO SAID NO. Order 23 — the first abandoned cart
 *     this site ever took — ticked yes to delivery texts and no to
 *     marketing in the same submit, one minute before stopping. Emailing
 *     her would have contradicted a choice she had just made.
 *
 *  2. A PAID ORDER IS NOT AN ABANDONED CART. 'pending' alone is ambiguous
 *     (config/inventoryRisk.js makes the same point): a paid order passes
 *     through it. Lose the payment_status filter and the job emails
 *     "did you forget something?" to people who have already bought.
 *
 *  3. NOBODY IS EMAILED TWICE. Without the send-once guard, an hourly
 *     cron mails the same person every hour until they buy or complain.
 *
 *  4. THE OFFER LINK MUST ACTUALLY ENROL. offerClaim.js grants the 10%
 *     only to somebody with offer_enrolled_at; /collections/sale sets it
 *     for nobody, so linking there promises a discount checkout refuses.
 *
 *  5. THE VALUE GOES SOMEWHERE EVEN WHEN THE EMAIL CANNOT. Declined,
 *     never-asked and blocked customers land on a call list with phone
 *     numbers, highest value first. Order 23 was $2,195.
 *
 * ⚠️ THE TRIAGE SECTION *RUNS* cartRecovery.js ON REAL ROW SHAPES. A gate
 * that re-implements its subject agrees with the bug. Only the SQL and
 * the template, which cannot be executed without a database, are grepped.
 *
 * Run:  node gates/gate_cart_recovery.js
 * Exit: 0 = pass, 1 = fail
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'gate-fixture-secret';
/* Loadable without a database because the pool is required lazily inside
   the functions that use it — see the note at the top of the job. */
const job = require(path.join(ROOT, 'src/jobs/cartRecovery'));

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};
const read  = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\ngate_cart_recovery — nobody who said no, nobody twice\n');

/* ═══ 1. CONSENT, EXECUTED ═══════════════════════════════════════════ */
console.log('--- who may be emailed (running the real rule) ---');
{
  const consented  = { email: 'a@b.com', accepts_marketing: 1, marketing_consent_at: '2026-10-20', email_blocked: 0 };
  /* The order-23 shape: asked, declined. Flag AND timestamp both set. */
  const declined   = { email: 'a@b.com', accepts_marketing: 0, marketing_consent_at: '2026-10-25', email_blocked: 0 };
  /* Flag 0 only because it defaults to 0 — nobody ever asked. */
  const neverAsked = { email: 'a@b.com', accepts_marketing: 0, marketing_consent_at: null,         email_blocked: 0 };
  const blocked    = { email: 'a@b.com', accepts_marketing: 1, marketing_consent_at: '2026-10-20', email_blocked: 1 };
  const noEmail    = { email: '',        accepts_marketing: 1, marketing_consent_at: '2026-10-20', email_blocked: 0 };

  check(job.emailEligibility(consented) === 'ok', 'a consenting customer is emailable');
  check(job.emailEligibility(declined) === 'declined',
        'somebody who was ASKED and declined is excluded',
        'this is the order-23 shape — the first real abandoned cart');
  check(job.emailEligibility(neverAsked) === 'never_asked',
        'somebody never asked is excluded AND distinguished from declined',
        'the flag alone cannot tell them apart; the timestamp can, and ' +
        '"nobody asked" is a fixable gap while "they said no" is not');
  check(job.emailEligibility(blocked) === 'blocked',
        'a blocked address is excluded even WITH consent',
        'consent does not resurrect a bounced or complained address');
  check(job.emailEligibility(noEmail) === 'no_email', 'no address, no email');

  /* The switch must be consulted, not bypassed. */
  check(job.EMAIL_WHO && job.EMAIL_WHO.declined === false,
        'the default does NOT email people who declined');
  check(job.EMAIL_WHO.never_asked === false,
        'the default does NOT email people never asked');

  /* And it must actually do something when flipped — a switch nothing
     reads is decoration. */
  job.EMAIL_WHO.never_asked = true;
  check(job.emailEligibility(neverAsked) === 'ok',
        'flipping never_asked makes them emailable',
        'a switch nothing reads is decoration');
  check(job.emailEligibility(declined) === 'declined',
        'flipping never_asked does NOT also release the declined',
        'the two must stay independent — that is the whole point of ' +
        'distinguishing them');
  job.EMAIL_WHO.never_asked = false;
}

/* ═══ 2. TRIAGE — NOTHING IS DROPPED ═════════════════════════════════ */
console.log('\n--- everybody lands somewhere, highest value first ---');
{
  const rows = [
    { order_number: 'A', total: 2195, email: 'a@b.com', accepts_marketing: 0, marketing_consent_at: '2026-10-25', email_blocked: 0 },
    { order_number: 'B', total: 400,  email: 'c@d.com', accepts_marketing: 1, marketing_consent_at: '2026-10-20', email_blocked: 0 },
    { order_number: 'C', total: 900,  email: 'e@f.com', accepts_marketing: 0, marketing_consent_at: null,         email_blocked: 0 },
  ];
  const t = job.triage(rows);

  check(t.email.length + t.call.length === rows.length,
        'every row ends up on exactly one list',
        'a dropped row is a cart nobody ever follows up');
  check(t.email.map(r => r.order_number).join() === 'B', 'only the consenting one is emailed');
  check(t.call[0].order_number === 'A',
        'the call list is sorted by value, highest first',
        'attention runs out before the list does');
  check(t.call.every(r => r.excluded_because),
        'every excluded row carries WHY',
        'a call list that does not say why is a list nobody can act on');
  check(job.triage([]).email.length === 0 && job.triage(null).call.length === 0,
        'empty and null inputs do not throw');
}

/* ═══ 3. THE QUERY ═══════════════════════════════════════════════════ */
console.log('\n--- the finder cannot pick up a paid order ---');
{
  const src = strip(read('src/jobs/cartRecovery.js'));
  const q = src.slice(src.indexOf('async function findAbandoned'), src.indexOf('async function run'));

  check(/payment_status/.test(q),
        'the query filters on payment_status',
        "'pending' alone is ambiguous — a PAID order passes through it, " +
        'and emailing them "did you forget?" is the worst false positive');
  check(/recovery_emailed_at IS NULL/.test(q),
        'the send-once guard is in the query',
        'without it an hourly cron mails the same person hourly');
  check(/is_test\s*=\s*0/.test(q), 'test orders are excluded');
  check(/INTERVAL \? DAY/.test(q),
        'there is an UPPER age bound, not just a lower one',
        'without it the first run emails every abandoned cart in history ' +
        'at once, from a domain with no sending reputation');
  check(/o\.total >= \?/.test(q), 'a minimum basket value applies');
}

/* ═══ 4. THE SEND ════════════════════════════════════════════════════ */
console.log('\n--- sending is ordered so a failure cannot silence somebody ---');
{
  const src = strip(read('src/jobs/cartRecovery.js'));
  const run = src.slice(src.indexOf('async function run'));

  const sendIdx  = run.indexOf('sendTemplate');
  const stampIdx = run.indexOf('recovery_emailed_at = NOW()');
  check(sendIdx > 0 && stampIdx > sendIdx,
        'the row is stamped AFTER the send resolves, not before',
        'stamping first means a failed send is never retried and the ' +
        'customer is silently skipped forever');

  check(/offer=platinum&optin=1/.test(run),
        'the offer link is the one that actually enrols',
        '/collections/sale sets offer_enrolled_at for nobody, so it ' +
        'promises a discount offerClaim.js will refuse');
  check(!/collections\/sale/.test(run),
        'the job does NOT link to the generic sale page');
  check(/unsubscribe_url/.test(run) && /postal_address/.test(run),
        'every send carries an unsubscribe link and a postal address',
        'both are required in commercial email');
  check(/dryRun/.test(run), 'there is a --dry-run that sends nothing');
  check(/ER_BAD_FIELD_ERROR/.test(run),
        'a missing migration is reported plainly, not as a stack trace');
}

/* ═══ 5. THE TEMPLATE ARRIVES INACTIVE ═══════════════════════════════ */
console.log('\n--- the template cannot send itself the moment it is inserted ---');
{
  const sql = read('migrations/2026-10-27_cart_recovery_template_RUNME.sql');
  check(/is_active\s*\)/.test(sql) && /,\s*0\s*\)\s*;/.test(sql),
        'the template is INSERTed inactive',
        'a template that goes live on insert gives nobody a chance to ' +
        'read it first');
  check(/\{\{unsubscribe_url\}\}/.test(sql) && /\{\{postal_address\}\}/.test(sql),
        'the body carries the unsubscribe link and postal address');
  check(/\{\{product_url\}\}/.test(sql),
        'the body links to the PRODUCT, not a category');
  /* ⚠️ SCOPED TO THE INSERT, NOT THE WHOLE FILE. The first version of
     this check grepped the file with comments stripped and FAILED on
     correct code: Step 3's verification query contains
     `body_html LIKE '%collections/sale%' AS wrong_link_should_be_0`,
     which is the file checking for the same mistake this gate checks
     for. A check that cannot tell a link from an assertion about links
     is the loose matching this project keeps getting bitten by. */
  const insert = sql.slice(sql.indexOf('INSERT INTO email_templates'),
                           sql.indexOf('-- ── STEP 3'));
  check(insert.length > 200, 'the INSERT statement was located');
  check(!/collections\/sale/.test(insert),
        'the template BODY does not link to the generic sale page',
        'that page enrols nobody in the offer the email promises');
  /* And the file still checks for it after the fact. */
  check(/wrong_link_should_be_0/.test(sql),
        'the migration verifies the same thing against the live row');
  check(/curbside/.test(sql),
        'the delivery expectation is set in the email',
        'curbside is the biggest expectation gap in the business and a ' +
        'likely reason somebody stops at the payment step');
}

console.log(fail ? `\n*** ${fail} of ${pass + fail} CHECKS FAILED ***`
                 : `\nALL ${pass} CHECKS PASS`);
process.exit(fail ? 1 : 0);
