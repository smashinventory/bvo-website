#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_contact_log.js
 *
 * THE RULES, IN ORDER OF WHAT THEY COST WHEN BROKEN:
 *
 *  1. LOGGING A CALL MUST NOT SEND ANYTHING. The people on the call list
 *     are there precisely BECAUSE they cannot be emailed — order 23
 *     declined marketing. A handler that logged a call and also fired a
 *     "sorry we missed you" email would mail the one group the whole
 *     design exists to protect.
 *
 *  2. THE SAME PERSON IS NOT CALLED TWICE. That is the entire feature. A
 *     suppression window that is computed and then ignored, or keyed only
 *     on customer_id so every guest order reads "never contacted", leaves
 *     the problem exactly where it was while looking fixed.
 *
 *  3. NOBODY IS SILENTLY DROPPED. A suppressed row moves to `held` and is
 *     PRINTED. A name that just vanishes from a list is indistinguishable
 *     from a bug, and the operator cannot tell "already called" from
 *     "lost".
 *
 *  4. THE TIMELINE IS KEYED TO THE PERSON, NOT THE ORDER. Filtering by
 *     order_id is the obvious thing the column invites, and it reports
 *     "never contacted" for exactly the repeat customer most likely to
 *     have been called already.
 *
 *  5. A CALL IS NOT A FAILED EMAIL. sent_ok means "the thing we recorded
 *     happened". Writing 0 for a call that took place makes every call
 *     render as a failure in the timeline and in the analytics counts.
 *
 * ⚠️ SECTIONS 1-3 *RUN* contactLog.js AND cartRecovery.js ON REAL ROW
 * SHAPES, AT THE BOUNDARIES. A gate that re-implements its subject agrees
 * with the bug. Only the controller, the view and the migration — which
 * cannot be executed without a database and a request — are grepped.
 *
 * Run:  node gates/gate_contact_log.js
 * Exit: 0 = pass, 1 = fail
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'gate-fixture-secret';
/* Both loadable without a database: their pools are lazy. */
const cl  = require(path.join(ROOT, 'src/utils/contactLog'));
const job = require(path.join(ROOT, 'src/jobs/cartRecovery'));

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};
const read  = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ⚠️ EJS COMMENTS MUST GO BEFORE ANY GREP OF A VIEW, and this gate is the
   proof: the first version checked the view for "No contact recorded" and
   PASSED after the mutation removed it, because the explanatory comment
   two lines above the markup quotes the same phrase. A comment satisfying
   a grep for the code it describes is the Rule 18 corollary, and it has
   now bitten this project in gate_cart_recovery (collections/sale), in
   gate_manual_tracking (M10) and here. Strip first, then match. */
const stripEjs = s => s.replace(/<%#[\s\S]*?%>/g, '');

console.log('\ngate_contact_log — nobody gets called twice\n');

/* ═══ 1. THE WINDOW, EXECUTED AT ITS BOUNDARIES ══════════════════════ */
console.log('--- the suppression window (running the real rule) ---');
{
  const NOW = new Date('2026-10-27T12:00:00Z');
  const at  = (iso, outcome) => ({ created_at: iso, outcome, kind: 'call' });

  check(cl.suppression(null, NOW).skip === false,
        'never contacted means callable');

  check(cl.suppression(at('2026-10-27T11:00:00Z', 'left_voicemail'), NOW).skip === true,
        'contacted an hour ago is suppressed',
        'this is the hourly cron case — without it the same person is ' +
        'printed as callable twelve times a day');

  /* ⚠️ THE BOUNDARY, BOTH SIDES. SUPPRESS_DAYS is read from the module
     rather than hardcoded here, so changing the constant moves the test
     with it instead of silently failing. */
  const D = cl.SUPPRESS_DAYS;
  const justInside = new Date(NOW.getTime() - (D * 86400000) + 60000);
  const exactly    = new Date(NOW.getTime() - (D * 86400000));
  const justOutside= new Date(NOW.getTime() - (D * 86400000) - 60000);

  check(cl.suppression(at(justInside.toISOString(), 'no_answer'), NOW).skip === true,
        `one minute inside the ${D}-day window is suppressed`);
  check(cl.suppression(at(exactly.toISOString(), 'no_answer'), NOW).skip === false,
        `EXACTLY ${D} days old is callable again`,
        'a >= here would make the window silently one day longer than ' +
        'the constant says');
  check(cl.suppression(at(justOutside.toISOString(), 'no_answer'), NOW).skip === false,
        `one minute outside the ${D}-day window is callable`);

  /* bad_number must not expire. */
  const ancient = at('2025-01-01T00:00:00Z', 'bad_number');
  check(cl.suppression(ancient, NOW).skip === true,
        'a bad number is suppressed FOREVER, not for the window',
        'no amount of waiting fixes a disconnected number; redialling it ' +
        'is the purest form of the waste this exists to stop');
  check(cl.PERMANENT_OUTCOMES.includes('bad_number'),
        'bad_number is on the permanent list');

  /* ⚠️ FAILS OPEN, NOT CLOSED. An unparseable date must mean "call them",
     never "skip them" — the cost of one extra call is a minute, the cost
     of silently never calling a $2,195 cart is the cart. */
  check(cl.suppression(at('not-a-date', 'spoke'), NOW).skip === false,
        'an unreadable date fails OPEN (call them anyway)',
        'suppressing on bad data would drop carts with no trace');

  check(cl.suppression(at(justInside.toISOString(), 'spoke'), NOW).reason,
        'a suppressed row carries a human reason',
        'the call list prints it; a name missing with no reason reads ' +
        'as a bug');
}

/* ═══ 2. TRIAGE — NOTHING IS DROPPED ═════════════════════════════════ */
console.log('\n--- held is a THIRD list, not a deletion ---');
{
  const NOW = new Date('2026-10-27T12:00:00Z');
  const rows = [
    { order_number:'A', total:2195, email:'a@b.com', customer_id:7,
      accepts_marketing:0, marketing_consent_at:'2026-10-25', email_blocked:0 },
    { order_number:'B', total:400,  email:'c@d.com', customer_id:8,
      accepts_marketing:1, marketing_consent_at:'2026-10-20', email_blocked:0 },
    /* ⚠️ customer_id NULL — A GUEST ORDER. The call list is full of these
       and they are the case an id-only lookup silently breaks. */
    { order_number:'C', total:900,  email:'e@f.com', customer_id:null,
      accepts_marketing:0, marketing_consent_at:null, email_blocked:0 },
  ];

  const map = new Map();
  map.set('id:7', { created_at:'2026-10-26T15:00:00Z', outcome:'left_voicemail', kind:'call' });
  map.set('em:e@f.com', { created_at:'2026-10-26T15:00:00Z', outcome:'no_answer', kind:'call' });
  /* ⚠️ B IS THE EMAILABLE ONE, AND SHE WAS CALLED YESTERDAY TOO. Without
     this entry the "still emailed" check below passes even when
     suppression has been wrongly applied to the email list, because
     nothing would have suppressed her anyway. The fixture has to contain
     the case the rule is about. */
  map.set('id:8', { created_at:'2026-10-26T15:00:00Z', outcome:'spoke', kind:'call' });

  const t = map && job.triage(rows, map, NOW);

  check(t.email.length + t.call.length + t.held.length === rows.length,
        'every row lands on exactly one of the three lists',
        'a dropped row is a cart nobody ever follows up and no log line ' +
        'anywhere says so');

  check(t.held.some(r => r.order_number === 'A'),
        'a customer contacted yesterday is HELD, not called again');

  /* ⚠️ THE GUEST-ORDER CASE. This is the check that fails if somebody
     "simplifies" the lookup to customer_id only. */
  check(t.held.some(r => r.order_number === 'C'),
        'a GUEST order (customer_id NULL) is matched by email and held',
        'keying only on customer_id reports "never contacted" for every ' +
        'guest order forever, which is most of the call list');

  /* ⚠️ B WAS CALLED YESTERDAY AND IS STILL EMAILED. Suppression governs
     the CALL list only. Email has its own send-once guard
     (recovery_emailed_at) and a different consent basis entirely, so
     letting a phone call block the recovery email would silently halve
     the feature while every gate still looked green. */
  check(t.email.map(r => r.order_number).join() === 'B',
        'a customer called yesterday is STILL emailed',
        'suppression governs the CALL list; email has its own send-once ' +
        'guard in recovery_emailed_at and its own consent basis');

  check(t.held.every(r => r.held_because),
        'every held row says why it is held');

  /* Called with no map at all — the pure path the other gate uses. */
  const t2 = job.triage(rows);
  check(t2.held.length === 0 && t2.call.length === 2,
        'with no contact history, nothing is suppressed',
        'suppression is an enrichment; a failure to read history must ' +
        'never mean a shorter call list');

  /* Both lists still sorted by value. */
  const t3 = job.triage(rows, new Map(), NOW);
  check(t3.call[0].order_number === 'A',
        'the call list is still highest-value first');
}

/* ═══ 3. THE LOOKUP PICKS THE MOST RECENT ════════════════════════════ */
console.log('\n--- when both keys match, the newer contact wins ---');
{
  const map = new Map();
  map.set('id:7',       { created_at:'2026-10-20T00:00:00Z', outcome:'no_answer' });
  map.set('em:a@b.com', { created_at:'2026-10-26T00:00:00Z', outcome:'spoke' });
  /* ⚠️ THE KEY-BUILDING, EXECUTED. This is split out of
     readLastContactBulk precisely so a gate can reach it without a
     database — the email key is the line whose removal silently breaks
     every guest order, and a grep for it would be satisfied by the
     comment that explains it. */
  const idx = cl.indexContacts([
    { customer_id:7, to_email:'A@B.com', created_at:'2026-10-20T00:00:00Z', outcome:'no_answer' },
    { customer_id:7, to_email:'A@B.com', created_at:'2026-10-26T00:00:00Z', outcome:'spoke' },
    { customer_id:null, to_email:'g@h.com', created_at:'2026-10-25T00:00:00Z', outcome:'left_voicemail' },
  ]);
  check(idx.has('em:g@h.com'),
        'indexContacts keys a guest contact by EMAIL',
        'customer_id is NULL on every guest order; without the email key ' +
        'most of the call list can never match and reads "never ' +
        'contacted" forever');
  check(idx.has('id:7') && idx.get('id:7').outcome === 'spoke',
        'the last row for a key wins (rows arrive oldest-first)');
  check(cl.indexContacts(null).size === 0 && cl.indexContacts([]).size === 0,
        'indexContacts handles empty input');

  const got = cl.lookup(map, { customer_id:7, email:'A@B.com' });
  check(got && got.outcome === 'spoke',
        'the more recent of the two matches is used',
        'taking the id match unconditionally would report a stale call ' +
        'and under-suppress');
  check(cl.lookup(map, { customer_id:null, email:'  A@B.COM  ' }),
        'email matching is case- and whitespace-insensitive');
  check(cl.lookup(null, {}) === null && cl.lookup(map, null) === null,
        'empty inputs do not throw');
}

/* ═══ 4. LOGGING A CALL SENDS NOTHING ════════════════════════════════ */
console.log('\n--- logContact records, it does not send ---');
{
  const src = strip(read('src/controllers/customerOutreachController.js'));
  const h = src.slice(src.indexOf('exports.logContact'),
                      src.indexOf('function escapeHtml'));

  check(h.length > 400, 'the logContact handler was located');

  /* ⚠️ THE RULE THIS WHOLE FEATURE RESTS ON. */
  check(!/brevo\./.test(h) && !/sendTemplate/.test(h) && !/orderEmails\./.test(h),
        'logContact calls NO mail service at all',
        'the people on the call list are there BECAUSE they cannot be ' +
        'emailed — order 23 declined marketing one minute before ' +
        'abandoning a $2,195 cart');

  check(/sentOk:\s*true/.test(h),
        'a logged call is recorded as sent_ok = 1',
        'sent_ok means "the thing we recorded happened"; a 0 makes every ' +
        'call render as a failed email in the timeline and the analytics');

  check(/contactLog\.isValidOutcome/.test(h),
        'the outcome is validated against the SHARED list',
        'the column is a VARCHAR so the list can change without an ' +
        'ALTER — which only holds while there is exactly one list');

  check(/contactLog\.subjectFor/.test(h),
        'the subject is composed by the shared helper',
        'customer_messages.subject is NOT NULL and is the timeline ' +
        'headline; a blank one renders an empty row');

  check(/toEmail:\s*clean\(order\.email\)/.test(h),
        'the address is stored even though nothing was emailed',
        'this is what joins a call to an email about the same person ' +
        'when customer_id is NULL, i.e. every guest order');

  /* The log must not be gated on reaching anybody. */
  check(!/outcome\s*===\s*'spoke'/.test(h),
        'the log is written whatever the outcome',
        '"no answer" is the row that stops the next person dialling the ' +
        'same number ten minutes later');
}

/* ═══ 5. THE INSERT CARRIES THE NEW COLUMNS ══════════════════════════ */
console.log('\n--- the writer actually persists outcome and phone ---');
{
  const src = strip(read('src/controllers/customerOutreachController.js'));
  const ins = src.slice(src.indexOf('INSERT INTO customer_messages'),
                        src.indexOf('return r.insertId'));

  check(/outcome/.test(ins) && /contact_phone/.test(ins),
        'the INSERT names outcome and contact_phone',
        'without them every call logs with a NULL outcome and the ' +
        'suppression rule can never fire');

  /* ⚠️ COLUMNS, PLACEHOLDERS *AND* BOUND ARGUMENTS — ALL THREE.
     An earlier version counted only the first two and MISSED the
     mutation that deletes a single line from the argument array: the
     column list still says `outcome`, the VALUES still has its `?`, and
     only the JS array is one short. Everything then silently shifts by
     one — contact_phone lands in outcome, error lands in contact_phone —
     or the driver throws, depending on the count. Counting the args is
     the only check that sees it. */
  const cols = (ins.match(/\(([^)]*)\)\s*VALUES/) || [])[1] || '';
  const nCols = cols.split(',').filter(s => s.trim()).length;
  const nQs   = ((ins.match(/VALUES\s*\(([^)]*)\)/) || [])[1] || '')
                  .split(',').filter(s => s.trim() === '?').length;

  /* Top-level commas only — fields.x || null contains no commas, but a
     nested call like String(a, b) would, so depth is tracked. */
  const argsSrc = (ins.match(/\[([\s\S]*?)\]\s*\)?\s*;?\s*$/) || [])[1] || '';
  let depth = 0, nArgs = argsSrc.trim() ? 1 : 0;
  for (const ch of argsSrc) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) nArgs++;
  }

  check(nCols > 0 && nCols === nQs,
        `the column list and the placeholders agree (${nCols} each)`,
        'a mismatch throws only when this path runs, which is the path ' +
        'least likely to be exercised before a customer needs it');
  check(nArgs === nCols,
        `the bound arguments match the columns (${nArgs} vs ${nCols})`,
        'one missing argument shifts every later value into the wrong ' +
        'column — outcome gets the phone number — with no error at all');

  check(/fields\.toEmail\s*\|\|\s*null/.test(ins),
        'an absent address becomes an explicit NULL',
        'to_email is nullable now; passing undefined to the driver is ' +
        'not the same as passing null');
}

/* ═══ 6. THE PANEL IS KEYED TO THE PERSON ════════════════════════════ */
console.log('\n--- the order page shows the PERSON\'s history ---');
{
  const ctl = strip(read('src/controllers/ordersController.js'));
  const d = ctl.slice(ctl.indexOf('contactTimeline:'), ctl.indexOf('contactOutcomes:'));

  check(d.length > 50, 'the timeline is loaded in the detail handler');

  /* ⚠️ THE ship_name-SHAPED BUG. order.email does not exist: the detail
     query aliases c.email to customer_email, and o.* supplies
     guest_email. An undefined would silently fall back to customer_id
     alone and report "never contacted" for every guest order. */
  check(/customer_email/.test(d) && /guest_email/.test(d),
        'it reads customer_email || guest_email, not order.email',
        'orders has no `email` column — order.email is undefined, which ' +
        'is not an error and not null: the lookup would quietly degrade ' +
        'to customer_id only and report "never contacted" for every ' +
        'guest order, forever, with nothing in any log');

  check(!/order_id\s*[:=]\s*order\.id/.test(d),
        'the timeline is NOT filtered to this order',
        'filtering by order_id is what the column invites and it reports ' +
        '"never contacted" for exactly the repeat customer most likely ' +
        'to have been called already');

  check(/catch/.test(d),
        'a timeline failure degrades instead of 500ing the order page',
        'an empty panel is honest about knowing nothing; a page that ' +
        'will not load tells the operator nothing at all');

  /* ⚠️ COMMENTS STRIPPED — see stripEjs. Without it the check below
     passes on a view whose empty state was deleted, because the comment
     explaining the empty state quotes its text. */
  const view = stripEjs(read('views/pages/admin/orders/detail.ejs'));
  check(/log-contact/.test(view), 'the view posts to the log-contact route');
  check(/No contact recorded/.test(view),
        'an empty timeline says so in words',
        'blank space reads as a broken feature or is not noticed');
  check(/contactOutcomes\[/.test(view),
        'the dropdown is built from the shared outcome list',
        'a hand-written <option> list is a second copy that drifts');

  const routes = strip(read('src/routes/admin.js'));
  check(/log-contact['"],\s*outreachCtrl\.logContact/.test(routes),
        'the route is wired to the handler');
}

/* ═══ 7. THE MIGRATION ═══════════════════════════════════════════════ */
console.log('\n--- the migration widens, it does not rewrite ---');
{
  const sql = read('migrations/2026-10-27_contact_log_RUNME.sql');

  check(/MODIFY COLUMN to_email VARCHAR\(255\) NULL/i.test(sql),
        'to_email becomes nullable');
  check(/ADD COLUMN outcome/i.test(sql) && /ADD COLUMN contact_phone/i.test(sql),
        'both new columns are added');

  /* ⚠️ NOTHING DESTRUCTIVE. Three rows of real outreach history exist. */
  check(!/\bDROP\b/i.test(sql) && !/\bTRUNCATE\b/i.test(sql) &&
        !/\bDELETE\s+FROM\b/i.test(sql),
        'the migration drops, truncates and deletes nothing',
        'there is real outreach history in this table');

  check(/SELECT COUNT\(\*\)/i.test(sql),
        'it verifies the row count is unchanged afterwards');

  /* The no-index decision is deliberate and recorded; if somebody adds
     one it should be because they measured, not by reflex. */
  check(/SHOW INDEX/i.test(sql),
        'it points at the existing indexes rather than adding more');
}

console.log(fail ? `\n*** ${fail} of ${pass + fail} CHECKS FAILED ***`
                 : `\nALL ${pass} CHECKS PASS`);
process.exit(fail ? 1 : 0);
