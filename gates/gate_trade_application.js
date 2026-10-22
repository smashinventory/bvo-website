'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_trade_application.js
 *
 * TWO RULES, BOTH FOUND MISSING ON 2026-10-22 WHEN THE FIRST REAL
 * APPLICATION WENT THROUGH:
 *
 *   1. AN APPLICATION MUST TELL SOMEBODY IT EXISTS.
 *      submit() inserted the row and sent NOTHING — no mail to support@,
 *      none to the applicant. Meanwhile the page promised "we usually come
 *      back within one business day", a promise whose only enforcement was
 *      somebody remembering to open /admin/trade. The owner routes
 *      support@ to their phone precisely so nothing is missed, and this
 *      route walked straight past it.
 *
 *   2. ONE LIVE APPLICATION PER BUSINESS.
 *      Nothing stopped a resubmission. The status banner said "pending"
 *      and then rendered a complete empty form underneath it. A second
 *      submit wrote another row AND STORED ANOTHER COPY OF THE DOCUMENTS —
 *      business cards and resale certificates, which can carry an SSN.
 *      That is why they live outside the web root, and why extra copies
 *      are a retention problem and not just clutter.
 *
 * ⚠️ WHY THE NOTIFY CHECKS ARE WORTH HAVING AT ALL:
 *    brevo.sendTemplate DOES NOT THROW on a missing template row — it
 *    returns {skipped}. So "we send an email now" can quietly become "we
 *    send nothing" again without a single error anywhere. That is the
 *    exact shape of the original defect, which is why the fallback to
 *    sendRaw is asserted and not merely present.
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ejs  = require('ejs');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};

const CTRL_RAW = fs.readFileSync(
  path.join(ROOT, 'src/controllers/tradeController.js'), 'utf8');
/* Comments in this file quote the old behaviour at length. Strip them, or
   a grep for "sendRaw" matches the paragraph explaining sendRaw. The Rule
   18 corollary, which has now cost a pass in five separate gates. */
const CTRL = CTRL_RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\n1. One live application per business — the rule, executed');

/* ⚠️ A PLACEHOLDER DB_PASS, AND IT IS NOT A SHORTCUT.
   src/config/database.js calls process.exit(1) at require time when
   DB_PASS is unset — correct for a server, fatal for a gate. tradeController
   now requires brevoService, which requires that config, so loading the
   controller at all needs the variable present.

   Nothing here connects: _blockingApplication takes rows that this gate
   supplies, and no query runs. The value is deliberately not a credential.
   If a future check needs real data, that check belongs somewhere with a
   database, not here. */
if (!process.env.DB_PASS) process.env.DB_PASS = 'gate-no-connection';

const trade = require(path.join(ROOT, 'src/controllers/tradeController.js'));
const blocking = trade._blockingApplication;

check(typeof blocking === 'function',
  'the duplicate rule is exported so it can be executed, not just read');

/* ⚠️ HARDCODED STATUSES. Looping over _BLOCKING_STATUSES would make the
   test agree with any change to that list — delete 'approved' from it and
   the gate would simply stop testing 'approved'. Rule 18. */
check(!!blocking([{ id: 1, status: 'pending' }]),
  "a PENDING application blocks a resubmission",
  'Without this, a double-click writes a second row and a second copy of the uploaded documents.');
check(!!blocking([{ id: 1, status: 'approved' }]),
  "an APPROVED application blocks a resubmission",
  'They already have the account. Re-applying can only confuse the queue.');
check(blocking([{ id: 1, status: 'declined' }]) === null,
  "a DECLINED application does NOT block — they may apply again",
  'A business that fixes whatever got it declined must have a route back. Blocking declined turns one bad day into a permanent ban.');
check(blocking([]) === null && blocking(null) === null && blocking(undefined) === null,
  'no previous application does not block',
  'The query uses .catch(() => [[]]), so an empty result must mean "go ahead" and never "silently refuse every applicant".');

console.log('\n1b. Fraud keeps evidence; a closure request purges');

/* ⚠️ THE TWO ACTIONS ARE EASY TO GET BACKWARDS AND EXPENSIVE BOTH WAYS.
   Purging a fraudulent applicant's documents destroys the only evidence
   we hold if they dispute a charge or return under another name. Keeping
   a closure-requesting customer's ID documents means still holding the
   thing they asked us to stop holding. Owner's decision, 2026-10-22.
   Hardcoded, not read from the config under test — Rule 18. */
const RA = trade._REVOKE_ACTIONS;
check(RA && RA.fraud && RA.fraud.purge === false,
  'FRAUD does NOT purge the documents',
  'They are the evidence. Destroying them on our own say-so leaves nothing to show when it matters.');
check(RA && RA.closed && RA.closed.purge === true,
  'CLOSED DOES purge the documents',
  "The customer asked us to close the account; continuing to hold their business card and resale certificate is the thing they asked us to stop.");
check(RA.fraud.status === 'fraud' && RA.closed.status === 'closed',
  'each action records its own status, so the two are distinguishable later');

check(trade._BLOCKING_STATUSES.includes('fraud'),
  "a FRAUD-flagged applicant cannot simply reapply",
  'Letting a flagged account resubmit the same day and land back in the queue looking new makes the review pointless.');
check(!trade._BLOCKING_STATUSES.includes('closed'),
  'a CLOSED account MAY apply again',
  'They asked to leave. They are allowed to change their mind.');

/* Every status the model can produce must be viewable in the queue, or
   those rows are invisible — the controller falls back to 'pending' for
   anything it does not recognise. */
const QS = trade._QUEUE_STATUSES;
for (const s of ['pending', 'approved', 'declined', 'fraud', 'closed']) {
  check(QS.includes(s), `the queue can filter to '${s}'`,
    `Rows with status '${s}' cannot be viewed at all — the filter silently falls back to 'pending'.`);
}

console.log('\n2. The guard runs server-side, before the INSERT');

/* ⚠️ KNOWN LIMIT OF THIS SECTION — READ BEFORE TRUSTING IT.
   These checks read the SOURCE. They prove the guard is called and that
   the call sits before the INSERT. They CANNOT prove it still has an
   effect: mutation A3 rewrote the line as

       const blocking = (false) && _blockingApplication(dupRows);

   which leaves every string these checks look for exactly where it was,
   and the gate stayed green on a disabled guard.

   Closing that properly means executing submit(), which needs a live
   database and real req/res objects — this gate deliberately runs without
   either (see the DB_PASS note above). So the honest boundary is:

     • guard DELETED              → caught (A1)
     • 'declined' wrongly added   → caught (A2)
     • guard REORDERED past insert→ caught (position check below)
     • guard DISABLED in place    → NOT CAUGHT

   Section 1 is the compensating control: the rule itself is executed, so
   a wrong rule cannot hide. What is untested is whether submit() still
   obeys it. If this route ever grows a second duplicate-related defect,
   that gap is the first place to look. */

const iGuard  = CTRL.indexOf('_blockingApplication(dupRows)');
const iInsert = CTRL.indexOf('INSERT INTO trade_applications');
check(iGuard !== -1, 'submit() consults the duplicate rule');
check(iGuard !== -1 && iInsert !== -1 && iGuard < iInsert,
  'and does so BEFORE the INSERT',
  'After the insert is too late — the duplicate row and the duplicate documents already exist.');
check(/discard\(files\);[\s\S]{0,400}?already have an application/.test(CTRL),
  'a refused duplicate DISCARDS the files it just received',
  'Otherwise the rejected attempt still leaves personal documents on disk with no row pointing at them and no retention clock — the exact thing discard() was written for.');

console.log('\n3. Somebody is told — both halves');

check(/sendRaw\(\s*adminTo/.test(CTRL),
  'support@ (or TRADE_NOTIFY_EMAIL) is emailed when an application lands',
  'This is the whole point. Before today an application was invisible unless someone opened /admin/trade.');
check(/TRADE_NOTIFY_EMAIL/.test(CTRL),
  'the recipient is configurable without a code change');
check(/sendTemplate\('trade_application_received'/.test(CTRL),
  'the applicant gets an acknowledgement');
check(/sent\.skipped[\s\S]{0,300}?sendRaw\(\s*email/.test(CTRL),
  'and a raw fallback when that template row does not exist',
  'sendTemplate returns {skipped} rather than throwing when the template is missing. Without the fallback the applicant silently gets nothing — which is precisely the bug being fixed.');

console.log('\n4. Notification failure must not break a committed application');

/* ⚠️ THE ORDER MATTERS AND SO DOES THE CATCH. The row is already
   committed by the time these run. An uncaught throw here produces a 500
   on a submission that SUCCEEDED, and the applicant applies again. */
const iInsertEnd = CTRL.indexOf('adminTo');
check(iInsertEnd > iInsert,
  'notifications are sent AFTER the row is committed',
  'Sending first would mean an email promising an application that failed to save.');
const notifyBlock = CTRL.slice(iInsertEnd, CTRL.indexOf('res.redirect', iInsertEnd));
check((notifyBlock.match(/catch\s*\(/g) || []).length >= 2,
  'BOTH sends are individually wrapped in try/catch',
  'One shared catch means a failure in the admin notify skips the applicant acknowledgement entirely.');
check(/ADMIN NOTIFY FAILED/.test(CTRL_RAW),
  'a failed admin notify is logged loudly and by name',
  'If Brevo is down the application still saves — but somebody has to be able to find out that nobody was told.');

console.log('\n5. The documents are NOT emailed');

check(!/sendWithAttachments/.test(CTRL),
  'uploaded documents are never attached to the notification',
  'Business cards and resale certificates can contain an SSN. They are deliberately kept outside the web root and viewed through the authenticated admin route; emailing them copies that data into a mailbox with different retention and access.');

console.log('\n6. The form is hidden while an application is live');

const VIEW = fs.readFileSync(path.join(ROOT, 'views/pages/trade-apply.ejs'), 'utf8');
const render = status => ejs.render(VIEW, {
  existing: status ? { status } : null,
  csrfToken: 't', cspNonce: 'n', termsVersion: 'v1', flash: null, old: {},
  pageTitle: 'x', metaDesc: 'x', noindex: true,
}, { filename: path.join(ROOT, 'views/pages/trade-apply.ejs') });

/* ⚠️ RENDERED, NOT GREPPED. A conditional around the form is easy to read
   as correct and still emit the form — only running it settles it. */
for (const [status, shouldShow] of [[null, true], ['pending', false],
                                    ['approved', false], ['declined', true]]) {
  const out = render(status);
  const hasForm = /<form[^>]*id="tradeForm"/.test(out);
  check(hasForm === shouldShow,
    `${status || '(no application)'}: form is ${shouldShow ? 'shown' : 'hidden'}`,
    shouldShow
      ? 'This applicant has no live application and must be able to apply.'
      : 'An empty form under a "pending" banner reads as an invitation to submit again — which costs another copy of their documents.');
  check(/type="file"/.test(out) === shouldShow,
    `${status || '(no application)'}: file inputs ${shouldShow ? 'present' : 'absent'}`,
    'The upload fields are the part that matters — they are what duplicates the stored documents.');
}

console.log(
  fail === 0
    ? `\nGREEN  ${pass} passed, 0 failed`
    : `\ngate_trade_application: FAILED ${fail} of ${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);
