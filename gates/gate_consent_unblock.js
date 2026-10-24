'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   gate_consent_unblock.js — fresh consent lifts an UNSUBSCRIBE block and
   nothing else.

   WHY (owner, 2026-10-24). Brevo puts an Unsubscribe button on every send.
   The owner's observation was that the checkout consent box ought to put a
   blocked customer back in touch — and it did not, because the box writes
   customers.accepts_marketing in OUR database while the block lives on
   BREVO'S side. Ours never overrides theirs.

   THE DANGEROUS HALF IS THE REFUSAL, NOT THE RESTORE. "Unblock whenever
   someone consents" would be a one-line change and would be wrong:

     hardBounce  — the mailbox does not exist. Consent cannot make a dead
                   address live, and repeatedly sending to a known hard
                   bounce is among the fastest ways to wreck sender
                   reputation, degrading delivery for every other customer.
                   Both addresses blocked on this account at the time of
                   writing are hardBounce, so this is the LIVE case.
     spam report — they reported us. A ticked box on a checkout page is not
                   a retraction of a complaint.

   So mayUnblock() is an ALLOW-LIST and the gate's job is mostly to prove it
   still refuses. It is pure and exported precisely so this runs the real
   policy instead of matching its text (Rule 14).
   ═══════════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (c ? '' : '   <- ' + d));
  if (!c) fail++;
};

const cu = require(path.join(ROOT, 'src/services/consentUnblock.js'));

/* ── 1. THE POLICY, EXECUTED ──────────────────────────────────────── */
console.log('--- which blocks may consent lift? ---');

/* Brevo's reason strings differ by endpoint; all of these appear in the
   wild for the unsubscribe family. */
for (const r of ['unsubscribed', 'unsubscribedViaMA', 'unsubscribedViaEmail',
                 'Unsubscribe', 'UNSUBSCRIBED']) {
  ok('lifts: ' + r, cu.mayUnblock(r) === true, 'refused a genuine unsubscribe');
}

/* ⚠️ THE CHECKS THAT MATTER. */
for (const r of ['hardBounce', 'hard_bounce', 'HardBounce']) {
  ok('REFUSES: ' + r, cu.mayUnblock(r) === false,
     'a dead mailbox would be re-enabled — this wrecks sender reputation');
}
for (const r of ['spam', 'contactFlaggedAsSpam', 'complaint', 'adminBlocked']) {
  ok('REFUSES: ' + r, cu.mayUnblock(r) === false,
     'sending resumed after a complaint or an admin block');
}

/* Fails closed on absence. An unselected column is undefined, never an
   error — the project's signature defect — and undefined must not read as
   "safe to unblock". */
for (const [label, v] of [['null', null], ['undefined', undefined],
                          ['empty string', ''], ['whitespace', '   ']]) {
  ok('REFUSES a missing reason (' + label + ')', cu.mayUnblock(v) === false,
     'a missing reason was treated as restorable');
}

/* A reason Brevo has not invented yet must refuse, not allow. This is the
   allow-list vs deny-list decision, asserted. */
ok('REFUSES an unrecognised future reason',
   cu.mayUnblock('someNewReasonBrevoAdds2027') === false,
   'a deny-list would have allowed this');

/* ── 2. WIRING ────────────────────────────────────────────────────── */
console.log('--- wired to the places consent is actually given ---');

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const chk  = strip(fs.readFileSync(path.join(ROOT, 'src/controllers/checkoutController.js'), 'utf8'));
const acct = strip(fs.readFileSync(path.join(ROOT, 'src/controllers/accountController.js'), 'utf8'));
const svc  = strip(fs.readFileSync(path.join(ROOT, 'src/services/consentUnblock.js'), 'utf8'));

ok('checkout consent triggers a restore',
   /consentUnblock\.restoreOnConsent/.test(chk),
   'the pre-ticked checkout box still will not reach a blocked customer');
ok('checkout only restores when they actually consented',
   /if\s*\(\s*wantsMarketing\s*\)/.test(chk),
   'it would unblock people who DECLINED, which inverts the consent');
ok('newsletter signup triggers a restore',
   /consentUnblock\.restoreOnConsent/.test(acct),
   're-subscribing would not reach Brevo');

/* It runs on checkout. A rejected promise there must not fail an order. */
ok('the checkout call cannot reject into the request',
   /restoreOnConsent\([^)]*\)\s*\n?\s*\.catch\(/.test(chk),
   'an unhandled rejection on the checkout path');

/* ── 3. THE SERVICE'S OWN SAFETY PROPERTIES ───────────────────────── */
console.log('--- service invariants ---');

ok('the reason is consulted before unblocking',
   svc.indexOf('mayUnblock(row.email_blocked_reason)') !== -1,
   'restoreOnConsent does not check the reason at all');

const iMay   = svc.indexOf('mayUnblock(row.email_blocked_reason)');
const iCall  = svc.indexOf('brevo.unblockContact');
ok('the check happens BEFORE the Brevo call',
   iMay !== -1 && iCall !== -1 && iMay < iCall,
   'a hard bounce would be unblocked and only then judged');

const iUnblock = svc.indexOf('brevo.unblockContact');
const iClear   = svc.indexOf('email_blocked = 0');
ok('local flags clear only AFTER Brevo confirms',
   iUnblock !== -1 && iClear !== -1 && iUnblock < iClear,
   'our record would claim reachable while Brevo still refuses');

ok('mayUnblock is exported for execution, not kept private',
   typeof cu.mayUnblock === 'function', 'not exported');

console.log(fail ? '\n*** ' + fail + ' GATE(S) FAILED ***' : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
