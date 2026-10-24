'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   gate_pending_bundle.js — a bundle built signed out survives sign-in.

   THE BUG (owner, 2026-10-24, in his words): "I go through the bundle
   builder and select save when I am not logged in. I enter my email, verify
   via code, then land in my dashboard with the bundle not being saved. I
   have to re-do the bundle and save again."

   Two faults, and this gate holds both shut:

     1. THE SELECTION WAS NEVER STORED. saveBundle answered a bare 401 and
        the builder's in-page state died with the redirect.
     2. ?next= WAS IGNORED. The builder sent next=, loginPage read
        req.session.returnTo (set only by requireAuth, which the builder
        never passes through) and fell back to '/account'. Hence the
        dashboard.

   THE THIRD FAULT IT PREVENTS is the one that would be introduced by a
   careless fix: forgetting the session carry-list. regenerate() runs
   between the Save press and the code sign-in. A pending bundle missing
   from establishSession's carried object is destroyed at exactly the moment
   it would be redeemed — invisibly, because the sign-in still succeeds.
   That is how the cart was emptied before 2026-09-28 and how every offer
   claim was lost before its key was added. The carry-list check below is
   the single most load-bearing assertion in this file.

   EXECUTED, NOT GREPPED. pendingBundle.js requires its DB pool lazily
   precisely so a gate can load it with no database and run the real rules.
   Rule 14: a gate that re-implements its subject agrees with the bug.
   ═══════════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (c ? '' : '   <- ' + d));
  if (!c) fail++;
};

const pb = require(path.join(ROOT, 'src/services/pendingBundle.js'));

/* ── 1. normalise(): what counts as a bundle ──────────────────────── */
console.log('--- normalise, executed ---');

ok('a real selection normalises',
   !!pb.normalise({ cabinet: '12', top: '34', mirrorQty: '2' }),
   'returned null for a valid bundle');

const n1 = pb.normalise({ cabinet: '12', top: '34', mirror: '', faucet: null, mirrorQty: '2' });
ok('ids are coerced to numbers', n1.cabinet_id === 12 && n1.top_id === 34,
   JSON.stringify(n1));
ok('absent ids become null, not 0 or NaN',
   n1.mirror_id === null && n1.faucet_id === null, JSON.stringify(n1));
ok('qty is carried', n1.mirror_qty === 2, String(n1.mirror_qty));
ok('missing qty defaults to 1', n1.faucet_qty === 1, String(n1.faucet_qty));

/* An empty bundle must not become a pending row. Otherwise a stray Save
   press plants a bundle that appears later, after an unrelated sign-in. */
ok('an EMPTY bundle normalises to null',
   pb.normalise({}) === null, 'empty object produced a row');
ok('ids that are not positive integers are rejected',
   pb.normalise({ cabinet: '0' }) === null &&
   pb.normalise({ cabinet: '-4' }) === null &&
   pb.normalise({ cabinet: 'abc' }) === null,
   'a junk id was accepted as a bundle');

/* Qty is attacker-supplied: it comes straight off a fetch body. */
const big = pb.normalise({ cabinet: '1', mirrorQty: '99999' });
ok('qty is capped', big.mirror_qty === pb.MAX_QTY, String(big.mirror_qty));
const neg = pb.normalise({ cabinet: '1', mirrorQty: '-3' });
ok('a negative qty falls back to 1, never goes negative',
   neg.mirror_qty === 1, String(neg.mirror_qty));

/* ── 2. The session round trip, executed ──────────────────────────── */
console.log('--- the session round trip ---');

const req = { session: {} };
ok('nothing pending on a fresh session', pb.hasPending(req) === false);

pb.markPending(req, { cabinet: '7', mirrorQty: '3' });
ok('markPending records it', pb.hasPending(req) === true);
ok('it is stored under the exported key',
   !!req.session[pb.PENDING_KEY], 'key mismatch');
ok('peek returns the row', (pb.peek(req) || {}).cabinet_id === 7,
   JSON.stringify(pb.peek(req)));

const emptyReq = { session: {} };
pb.markPending(emptyReq, {});
ok('markPending REFUSES an empty bundle',
   pb.hasPending(emptyReq) === false, 'an empty bundle was stashed');

pb.clearPending(req);
ok('clearPending removes it', pb.hasPending(req) === false);

/* settle() with nothing pending must not touch the database — if it tried,
   the lazy require would throw here, since this gate has no DB. */
(async () => {
  const r = await pb.settle({ session: {} }, 123);
  ok('settle with nothing pending is a no-op', r.ok === false && r.error === 'nothing-pending',
     JSON.stringify(r));

  /* THE KEY MUST BE CLEARED EVEN WHEN REDEMPTION CANNOT PROCEED. Left
     behind, it would retry the same doomed insert on every future sign-in
     forever. customerId is null here, so no DB call is reached. */
  const stuck = { session: {} };
  pb.markPending(stuck, { cabinet: '5' });
  const r2 = await pb.settle(stuck, null);
  ok('settle clears the key even when it cannot save',
     pb.hasPending(stuck) === false && r2.ok === false,
     'the pending bundle would be retried forever');

  /* ── 3. STATIC: the three wiring points ─────────────────────────── */
  console.log('--- wiring ---');

  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const acct = strip(fs.readFileSync(path.join(ROOT, 'src/controllers/accountController.js'), 'utf8'));
  const bund = strip(fs.readFileSync(path.join(ROOT, 'src/controllers/bundleController.js'), 'utf8'));

  /* THE CARRY LIST. Asserted against the EXPORTED key, not a literal
     string, so renaming PENDING_KEY in the service cannot leave this
     silently checking a name nothing uses any more. */
  const carried = acct.match(/const carried = \{[\s\S]*?\};/);
  ok('establishSession has a carry list', !!carried, 'not found');
  ok('⚠️ the pending bundle is CARRIED THROUGH regenerate()',
     !!carried && carried[0].includes('pendingBundle.PENDING_KEY'),
     'regenerate() will destroy the bundle at the moment it would be saved');

  /* Redemption must happen AFTER establishSession in both paths — before
     it, the key is about to be wiped. Index comparison with -1 guards,
     because "-1 < 500" is true and would pass on code with the call
     deleted (SESSION_HANDOFF §6). */
  const iEstablish = acct.indexOf('await establishSession');
  const iSettle    = acct.indexOf('pendingBundle.settle');
  ok('redemption is wired into the sign-in path',
     iSettle !== -1, 'pendingBundle.settle is never called');
  ok('redemption runs AFTER establishSession',
     iEstablish !== -1 && iSettle !== -1 && iSettle > iEstablish,
     'settle would read a session regenerate() is about to destroy');

  /* BOTH sign-in paths: the emailed code AND the recognised device. */
  const settleCount = (acct.match(/pendingBundle\.settle/g) || []).length;
  ok('BOTH sign-in paths redeem (code + recognised device)',
     settleCount >= 2,
     'only ' + settleCount + ' call site — returning visitors would lose the bundle');

  ok('saveBundle stashes before answering 401',
     /markPending/.test(bund) &&
     bund.indexOf('markPending') < bund.indexOf('sign-in-required'),
     'the 401 is sent without storing the selection');

  ok('saveBundle uses the shared insert, not its own SQL',
     /pendingBundle\.insert/.test(bund) && !/INSERT INTO saved_bundles/.test(bund),
     'a second INSERT exists and will drift from the redemption path');

  /* ?next= must be honoured, and guarded. */
  ok('loginPage honours ?next=', /req\.query\.next/.test(acct),
     'next= is ignored — every visitor lands on /account');
  /* ⚠️ SCOPED TO THE ASSIGNMENT STATEMENT, NOT THE WHOLE FILE.
     The first version of this check searched the entire controller for the
     guard pattern — and accountController already contains that identical
     regex TWICE, on the two return_to lines. So deleting the ?next= guard
     left an open redirect and the check stayed green. Caught by M8 of
     mutate_pending_bundle.sh, not by reading it.

     This is the SESSION_HANDOFF §6 family again: the pattern matched
     something ADJACENT to the thing under test. The fix is to assert on
     the statement that actually performs the assignment. */
  /* ⚠️ A WINDOW, NOT A REGEX SPANNING THE FILE. Two earlier attempts at
     this one check were both wrong, in opposite directions:

       1. Searching the WHOLE controller for the guard pattern — but
          accountController already contains that exact regex twice, on the
          two return_to lines, so deleting this guard stayed green.
       2. /if\s*\(([\s\S]*?)\)\s*req\.session\.returnTo = _next;/ — the
          non-greedy capture begins at the FIRST "if (" in the file and
          swallows everything up to the assignment, including those same
          two guards. Green again, for a second reason.

     Both are the SESSION_HANDOFF §6 shape: the pattern matched something
     adjacent to the subject. The reliable form is to bound the text to the
     statement itself — one line, immediately before the assignment. */
  const iAssign = acct.indexOf('req.session.returnTo = _next');
  const lineStart = iAssign === -1 ? -1 : acct.lastIndexOf('\n', iAssign);
  const stmt = iAssign === -1 ? '' : acct.slice(lineStart + 1, iAssign);

  ok('the ?next= assignment is guarded at all',
     iAssign !== -1 && /\bif\s*\(/.test(stmt),
     'returnTo is assigned from _next with no condition on the same line');
  ok('?next= rejects off-site and protocol-relative targets',
     /\(\?!/.test(stmt) && stmt.includes('^'),
     'open redirect: //evil.com would be accepted — guard is: ' + stmt.trim());

  console.log(fail ? '\n*** ' + fail + ' GATE(S) FAILED ***' : '\nALL GATES PASS');
  process.exit(fail ? 1 : 0);
})();
