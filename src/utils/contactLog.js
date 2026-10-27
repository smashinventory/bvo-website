'use strict';

/**
 * contactLog — one definition of "when did we last reach out to this
 * person, and how did it go?"
 *
 * WHY THIS EXISTS. Order 23 abandoned a $2,195 cart having declined
 * marketing, so she can only ever be phoned. She was phoned and a message
 * was left, and nothing recorded it. The hourly cart-recovery call list
 * prints her name and number every run; the admin order page shows no
 * contact history at all. Two people working that list call the same
 * customer about the same abandoned cart.
 *
 * THREE CALLERS, ONE RULE. The order detail panel, the cart-recovery job,
 * and the gate all have to agree on what counts as contact and how recent
 * is too recent. A second copy of that rule in the job is how the panel
 * and the list end up disagreeing about whether somebody has been called.
 *
 * ⚠️ THE POOL IS REQUIRED LAZILY, inside the functions that need it, for
 * the same reason cartRecovery.js does it: the gate must be able to load
 * this file and run the pure rules without a database. A module-scope
 * require would open a connection at import and the gate could not run at
 * all. The pure half of this file is everything above readLastContact.
 */

let _pool = null;
function pool() {
  if (!_pool) _pool = require('../config/database').bvoPool;
  return _pool;
}

/* ─────────────────────────────────────────────────────────────────────
   WHAT AN OUTCOME CAN BE

   ⚠️ NOT A DATABASE ENUM, and the migration says why: this is a label a
   human reads, not a discriminator code branches on. The validation lives
   here so there is exactly one list, and adding "texted" is a one-line
   change rather than an ALTER on a live table.

   The ORDER matters for nothing; the KEYS are what gets stored.
───────────────────────────────────────────────────────────────────────── */
const CONTACT_OUTCOMES = {
  spoke:          'Spoke with them',
  left_voicemail: 'Left a voicemail',
  no_answer:      'No answer',
  bad_number:     'Bad or disconnected number',
  note:           'Note (not a call)',
};

/* The kinds this module owns. The email kinds — template, blank,
   receipt_resend — are written by customerOutreachController and appear on
   the same timeline, but they are not logged through here. */
const CONTACT_KINDS = ['call', 'note'];

/* ⚠️ DEFAULT SUPPRESSION WINDOW, IN DAYS. A voicemail on Monday must not
   produce another call on Tuesday. Three days leaves room for a second
   attempt before the cart ages out of the 14-day recovery window, which a
   seven-day window would not. Changing this changes the call list only —
   it never suppresses an email, because emails have their own send-once
   guard in orders.recovery_emailed_at. */
const SUPPRESS_DAYS = 3;

/* bad_number is the exception: no amount of waiting fixes a disconnected
   number, so it suppresses permanently rather than for SUPPRESS_DAYS.
   Calling a dead number repeatedly is the purest form of the waste this
   module exists to stop. */
const PERMANENT_OUTCOMES = ['bad_number'];

function isValidOutcome(v) {
  return Object.prototype.hasOwnProperty.call(CONTACT_OUTCOMES, String(v || ''));
}

function outcomeLabel(v) {
  return CONTACT_OUTCOMES[String(v || '')] || String(v || '');
}

/* ─────────────────────────────────────────────────────────────────────
   THE SUBJECT LINE

   customer_messages.subject is NOT NULL (confirmed by SHOW COLUMNS,
   2026-10-27) and it is what the timeline renders as each row's headline.
   A call has no subject of its own, so one is composed. Relaxing the
   column instead would have left email rows with a headline and call rows
   without, and a timeline where half the entries render blank is a
   timeline nobody trusts.
───────────────────────────────────────────────────────────────────────── */
function subjectFor(kind, outcome) {
  if (kind === 'note') return 'Note';
  const label = outcomeLabel(outcome);
  return `Phone call — ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

/* ─────────────────────────────────────────────────────────────────────
   SHOULD THE CALL LIST SKIP THIS PERSON?

   ⚠️ PURE, AND IT TAKES THE CLOCK AS AN ARGUMENT. A function that reads
   Date.now() internally cannot be tested at a boundary, and the boundary
   is the only interesting part: "exactly 3 days ago" has to resolve the
   same way every time rather than depending on when the suite runs.

   Returns { skip, reason } rather than a bare boolean, because the call
   list prints the reason. A name silently missing from a list is
   indistinguishable from a bug.
───────────────────────────────────────────────────────────────────────── */
function suppression(last, now = new Date(), days = SUPPRESS_DAYS) {
  if (!last || !last.created_at) return { skip: false, reason: null };

  if (PERMANENT_OUTCOMES.includes(last.outcome)) {
    return { skip: true, reason: `${outcomeLabel(last.outcome).toLowerCase()} — do not call` };
  }

  const then = new Date(last.created_at);
  if (Number.isNaN(then.getTime())) return { skip: false, reason: null };

  const ageDays = (now.getTime() - then.getTime()) / 86400000;
  /* STRICTLY LESS THAN. At exactly `days` old the suppression has expired
     and the person is callable again — otherwise a 3-day window silently
     behaves as 4. */
  if (ageDays < days) {
    return { skip: true, reason: `contacted ${describeAge(ageDays)} (${outcomeLabel(last.outcome).toLowerCase()})` };
  }
  return { skip: false, reason: null };
}

function describeAge(days) {
  if (days < 1 / 24) return 'minutes ago';
  if (days < 1)      return `${Math.round(days * 24)}h ago`;
  return `${Math.floor(days)}d ago`;
}

/* One line for the call list and the order panel. */
function describe(last) {
  if (!last || !last.created_at) return 'never contacted';
  const d = new Date(last.created_at);
  const when = Number.isNaN(d.getTime())
    ? String(last.created_at)
    : d.toISOString().slice(0, 10);
  return `${when} ${outcomeLabel(last.outcome) || last.kind || 'contacted'}`;
}

/* ═══ BELOW THIS LINE EVERYTHING TOUCHES THE DATABASE ════════════════ */

/* ⚠️ MATCHES ON customer_id OR to_email, NOT customer_id ALONE. Every
   guest order has customer_id NULL, and those are exactly the people the
   call list is full of. Keying only on customer_id would report "never
   contacted" for them forever, no matter how many times they were called.
   Both columns are already indexed (idx_customer, idx_to_email) — see
   STEP 4 of the migration. */
async function readLastContact({ customerId = null, email = null } = {}) {
  if (!customerId && !email) return null;

  const where = [];
  const args  = [];
  if (customerId) { where.push('customer_id = ?'); args.push(customerId); }
  if (email)      { where.push('to_email = ?');    args.push(String(email).trim().toLowerCase()); }

  const [rows] = await pool().query(
    `SELECT id, kind, outcome, created_at, actor, subject
       FROM customer_messages
      WHERE (${where.join(' OR ')})
        AND kind IN ('call','note')
      ORDER BY created_at DESC
      LIMIT 1`,
    args
  );
  return (rows && rows[0]) || null;
}

/* The whole timeline for the order detail panel — calls AND emails, since
   "what have we said to this person" does not care which channel it went
   through. */
async function readTimeline({ customerId = null, email = null, limit = 50 } = {}) {
  if (!customerId && !email) return [];

  const where = [];
  const args  = [];
  if (customerId) { where.push('customer_id = ?'); args.push(customerId); }
  if (email)      { where.push('to_email = ?');    args.push(String(email).trim().toLowerCase()); }

  const [rows] = await pool().query(
    `SELECT id, order_id, kind, outcome, contact_phone, to_email,
            subject, sent_ok, error, actor, created_at
       FROM customer_messages
      WHERE ${where.join(' OR ')}
      ORDER BY created_at DESC
      LIMIT ?`,
    [...args, Number(limit) || 50]
  );
  return rows || [];
}

/* ⚠️ PURE, AND SPLIT OUT ON PURPOSE. The key-building is the part with a
   bug in it — drop the email key and every guest order reads "never
   contacted" forever — and it was previously buried inside a function
   that needs a database, so no gate could reach it. A rule a gate cannot
   execute is a rule the gate has to re-implement, which is the Rule 18
   trap. This takes query rows and returns the map; readLastContactBulk
   does the query and calls this. */
function indexContacts(found) {
  const out = new Map();
  /* ASC order means a later row overwrites an earlier one, so each key
     ends up holding the MOST RECENT contact. Sorting DESC and keeping the
     first would need a has() check on every iteration; this is the same
     result with less to get wrong. */
  for (const r of (found || [])) {
    if (r.customer_id) out.set(`id:${r.customer_id}`, r);
    /* ⚠️ THE EMAIL KEY IS NOT OPTIONAL. Every guest order has
       customer_id NULL and those are most of the call list. Without this
       line the feature appears to work for signed-in customers and
       silently does nothing for everybody else. */
    if (r.to_email)    out.set(`em:${String(r.to_email).toLowerCase()}`, r);
  }
  return out;
}

/* Bulk version for the call list: one query for every candidate rather
   than one per row. Returns a Map keyed by BOTH the customer id and the
   lowercased email, so a caller can look up whichever it has. */
async function readLastContactBulk(rows) {
  if (!Array.isArray(rows) || !rows.length) return new Map();

  const ids    = [...new Set(rows.map(r => r.customer_id).filter(Boolean))];
  const emails = [...new Set(rows.map(r => String(r.email || '').trim().toLowerCase()).filter(Boolean))];
  if (!ids.length && !emails.length) return out;

  const where = [];
  const args  = [];
  if (ids.length)    { where.push(`customer_id IN (${ids.map(() => '?').join(',')})`); args.push(...ids); }
  if (emails.length) { where.push(`to_email IN (${emails.map(() => '?').join(',')})`); args.push(...emails); }

  const [found] = await pool().query(
    `SELECT customer_id, to_email, kind, outcome, created_at
       FROM customer_messages
      WHERE (${where.join(' OR ')})
        AND kind IN ('call','note')
      ORDER BY created_at ASC`,
    args
  );

  return indexContacts(found);
}

/* Look a row up in the bulk map by whichever key it has. */
function lookup(map, row) {
  if (!map || !row) return null;
  const byId = row.customer_id ? map.get(`id:${row.customer_id}`) : null;
  const byEm = row.email ? map.get(`em:${String(row.email).trim().toLowerCase()}`) : null;
  if (byId && byEm) {
    return new Date(byId.created_at) >= new Date(byEm.created_at) ? byId : byEm;
  }
  return byId || byEm || null;
}

module.exports = {
  CONTACT_OUTCOMES, CONTACT_KINDS, SUPPRESS_DAYS, PERMANENT_OUTCOMES,
  isValidOutcome, outcomeLabel, subjectFor, indexContacts,
  suppression, describe, describeAge,
  readLastContact, readTimeline, readLastContactBulk, lookup,
};
