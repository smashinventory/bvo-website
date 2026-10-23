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

console.log('\n1c. The application creates the account — it never assumes one');

/* ⚠️ THE DEFECT THIS REPLACES. submit() stored
   `req.session.customerId || null`, so anyone who applied without signing
   in first produced customer_id NULL. The tier lives on `customers`, so
   approval wrote to nothing: the admin saw "Approved", the applicant saw
   retail prices, and neither had any way to connect the two.

   Nothing on the site told a visitor to create an account first, and the
   form already collects email, business name and phone. Requiring a
   separate signup was not a rule anyone could have followed. */
check(/Customer\.findOrCreateByEmail\(/.test(CTRL),
  'submit() resolves or creates the customer account itself',
  'Without this, a logged-out applicant lands with customer_id NULL and approval has nowhere to put the tier.');
check(/^\s*customerId, email, businessName/m.test(CTRL),
  'the INSERT stores the RESOLVED id, not the session one',
  'Storing req.session.customerId is the original defect verbatim: NULL for every applicant who was not already signed in.');
check(!/req\.session\.customerId \|\| null, email, businessName/.test(CTRL),
  'the old session-or-null expression is gone from the INSERT');

/* applied_at and the marketing-consent record were also gated on the
   session. A new applicant ticked the opt-in box and nothing recorded it
   — losing the consent evidence for precisely the people who had just
   given it. */
/* ⚠️ ANCHORED TO THE STATEMENT, NOT TO `if (customerId) {`.
   That looser pattern matched somewhere else in the file, so mutation D3
   — re-gating these updates on the session — left the gate green. Check
   the PARAMETER each query is actually given, which is the thing that
   decides whether a new applicant's record is written. */
check(/trade_applied_at[\s\S]{0,160}?\[customerId\]/.test(CTRL),
  'applied_at is recorded against the RESOLVED customer',
  'Gated on req.session.customerId, a brand-new applicant gets no trade_applied_at at all.');
check(!/trade_applied_at[\s\S]{0,160}?\[req\.session\.customerId\]/.test(CTRL),
  'applied_at is NOT gated on the session');
check(/marketing_consent_ip[\s\S]{0,200}?\[ip, TERMS_VERSION, customerId\]/.test(CTRL),
  'marketing consent is recorded against the RESOLVED customer',
  "Gated on the session, an applicant who ticks the opt-in box and has no account yet has their consent silently discarded — losing the evidence for exactly the people who just gave it.");

const SOURCES = require(path.join(ROOT, 'src/config/signupSources.js'));
check(SOURCES.clean('trade_application') === 'trade_application',
  "'trade_application' is a registered signup source",
  'signupSources.clean() nulls anything unrecognised, so an unregistered key means these accounts report as "unknown" in the customer acquisition breakdown.');

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

console.log('\n4b. Documents can be VIEWED, and viewing them is safe');

/* ⚠️ THE ORIGINAL CODE WAS attachment-ONLY FOR A REAL REASON: a file
   named .png containing HTML would execute in the admin session if the
   browser rendered it. Inline viewing is only acceptable because three
   things hold together. Any one of them missing re-opens it. */
check(/INLINE_TYPES/.test(CTRL) && /path\.extname\(resolved\)/.test(CTRL),
  'the content-type comes from OUR extension, never the client mimetype',
  'file.mimetype is client-supplied and forgeable. The extension is what multer validated and what we wrote to disk.');
/* ⚠️ COUNTED, NOT MERELY PRESENT. `/nosniff/` matched the DOWNLOAD path,
   so mutation E1 stripped it from the INLINE path — the only one where
   it matters — and the gate stayed green. The inline response is the one
   a browser is asked to render; without nosniff that is exactly where an
   HTML-bearing .png becomes a document. Third time today a loose grep has
   matched something adjacent to the thing under test. */
check((CTRL.match(/X-Content-Type-Options['"]?,\s*'nosniff'/g) || []).length >= 2,
  'nosniff is set on BOTH the inline and download paths',
  'Present on only one of them is almost certainly the inline path missing it — which is the path that renders, and the whole reason inline viewing is safe.');
check(/Content-Security-Policy[\s\S]{0,80}?sandbox/.test(CTRL),
  'the response carries a CSP sandbox',
  'Belt and braces — an opaque origin with scripts disabled, so even a content-type mistake cannot reach the admin session.');
check(!/'\.svg'|image\/svg/.test(CTRL),
  'SVG is never an inline type',
  'SVG is a script-bearing document. It is not in ALLOWED_EXT either, and it must not creep into the inline map.');
check(!/'\.heic':/.test(CTRL.slice(CTRL.indexOf('INLINE_TYPES'), CTRL.indexOf('INLINE_TYPES') + 400)),
  'HEIC falls back to download rather than a blank tab',
  'No browser renders HEIC. An iPhone photo of a business card is the most likely upload here, so this is not an edge case.');
check((CTRL.match(/Cache-Control['"]?,\s*'private, no-store'/g) || []).length >= 2,
  'BOTH the view and download paths set private, no-store',
  "Express defaults the download path to 'public, max-age=0'. These are business cards and resale certificates — 'public' lets a shared proxy keep a copy. Found by reading the real response headers, not by assuming them.");

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

/* ═══════════════════════════════════════════════════════════════════════
   7. MARKETING CONSENT IS REQUIRED TO APPLY — owner decision 2026-10-23,
   reversing spec §4. See the tradeController header for the reasoning and
   for the List-Unsubscribe side effect.

   ⚠️ THE SERVER CHECK IS THE ONE THAT MATTERS. The browser disables the
   button, which buys nothing: devtools clears the attribute, and a direct
   POST never sees it. Asserted separately below so that deleting the
   server check cannot be masked by the client one still being present. */
console.log('\n7. Marketing consent is required, and enforced server-side');

const applyForm = render(null);

check(/name="accepts_marketing"/.test(applyForm),
  'the consent checkbox is on the form',
  'Required consent with no way to give it means nobody can apply at all.');

check(/id="t_mkt"/.test(applyForm),
  'it carries the id the submit gate hooks',
  'Without the id the browser gate silently never applies to it.');

/* Not "Optional" — the previous copy actively told applicants it made no
   difference. Copy that contradicts the validation is worse than no copy:
   they tick nothing, submit, and get an error that reads as a bug. */
check(!/\bOptional\b/.test(applyForm),
  'the form no longer calls it optional',
  'The old wording ("Optional - it makes no difference to whether you are approved") now contradicts a hard server check.');
check(/Required\./.test(applyForm),
  'it is labelled Required',
  'A required field that does not say so is a dead end the applicant cannot diagnose.');

/* The box must NOT be pre-ticked. A consent the applicant did not
   knowingly give is not consent, and a checked-by-default box is the
   textbook example — the whole evidence trail (source, timestamp, IP)
   recorded alongside it is worthless if the tick was ours. */
check(!/name="accepts_marketing"[^>]*\bchecked\b/.test(applyForm),
  'and it is NOT pre-ticked',
  'Pre-ticking manufactures the consent instead of collecting it, which makes the stored evidence indefensible.');

/* ⚠️ SERVER-SIDE. Matched on the validation statement, not on the string
   'accepts_marketing' appearing somewhere in the file — it appears in the
   INSERT and in the carry-back object regardless of whether anything
   checks it. */
check(/if\s*\(!acceptsMkt\)\s*\{/.test(CTRL),
  'submit() rejects an application without it',
  'The consent becomes advisory: the row records accepts_marketing = 0 and the applicant is approved anyway — the exact behaviour the owner reversed.');

/* Ordering: the rejection must land in the errors array that triggers
   discard(files), or a refused application still leaves its uploaded
   documents on disk with no row pointing at them. */
const iMkt  = CTRL.indexOf('if (!acceptsMkt)');
const iDisc = CTRL.indexOf('discard(files)', iMkt);
const iIns2 = CTRL.indexOf('INSERT INTO trade_applications');
check(iMkt !== -1 && iIns2 !== -1 && iMkt < iIns2,
  'it is checked BEFORE the insert',
  'Rejecting after the insert leaves a row for an application that was refused.');
check(iMkt !== -1 && iDisc !== -1 && iDisc < iIns2,
  'and a rejection discards the uploaded documents',
  'Orphaned tax certificates on disk with no row referencing them — nothing will ever clean those up.');

/* The browser gate, asserted separately. Not a security control; it is
   there so the applicant is not told "no" after filling the whole form. */
check(/mkt\s*\?\s*!mkt\.checked/.test(applyForm) || /!mkt\.checked/.test(applyForm),
  'the submit button is gated on it in the browser too',
  'Not a guard, but without it the applicant discovers the requirement only by being rejected.');

console.log(
  fail === 0
    ? `\nGREEN  ${pass} passed, 0 failed`
    : `\ngate_trade_application: FAILED ${fail} of ${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);
