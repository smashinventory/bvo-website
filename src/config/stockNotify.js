'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * BACK-IN-STOCK NOTIFICATION RULES
 *
 * Pure functions and constants. REQUIRES NOTHING — no database, no services,
 * no config. That is deliberate and it is the whole point of this file.
 *
 * ⚠️ WHY THIS FILE EXISTS SEPARATELY FROM THE JOB. The first version of the
 * James Martin review gate required themeSettings, which required
 * src/config/database, which read DB_PASS from .env — and DB_PASS is not set
 * on the owner's laptop. The gate died with a FATAL before asserting a single
 * thing. The rules were correct; they were simply unreachable.
 *
 * So: every decision a human might later want to change, or a gate might want
 * to prove, lives here as a pure function. The job (src/jobs/stockNotify.js)
 * queries and sends. It owns no thresholds.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ── TUNABLES ──────────────────────────────────────────────────────────────
 * Owner decisions, 2026-11-09. Each one has a reason; change the reason too
 * if you change the number.
 */
const RULES = {
  /* A request older than this is dead. Someone who asked in March about a
     vanity they have since bought elsewhere does not want an email in June —
     they want to never hear from you again, and they will say so with the
     spam button. Expiring silently costs one lost notice; not expiring costs
     deliverability on the whole Brevo account, which also carries the order
     confirmations. */
  EXPIRY_DAYS: 90,

  /* Per run. A supplier restocking 400 SKUs overnight must not turn into 400
     emails in one burst — that is the shape of a sending-reputation incident,
     and the remainder simply goes out on the next run an hour later. */
  MAX_PER_RUN: 200,

  /* Below this, treat the product as still unavailable. Guards against a
     sync writing a transient 0 -> 1 -> 0 and firing a notice for stock that
     was never really there. */
  MIN_QTY: 1,
};

/* ── EMAIL VALIDITY ────────────────────────────────────────────────────────
 * Deliberately permissive. This is a capture form on a product page, not an
 * identity check: the cost of rejecting a real address is a lost customer,
 * the cost of accepting a bad one is one bounced send. Err toward accepting.
 */
function normaliseEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isPlausibleEmail(raw) {
  const e = normaliseEmail(raw);
  if (e.length < 6 || e.length > 254) return false;
  if (/\s/.test(e)) return false;
  const at = e.indexOf('@');
  if (at < 1 || at !== e.lastIndexOf('@')) return false;
  const domain = e.slice(at + 1);
  if (domain.length < 3 || !domain.includes('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;
  return true;
}

/* ── SHOULD THIS REQUEST BE NOTIFIED RIGHT NOW? ────────────────────────────
 * The single decision the job is allowed to act on.
 *
 * ⚠️ SUPPRESSION IS NOT CHECKED HERE, AND THAT IS INTENTIONAL.
 * Owner decision 2026-11-09: a person who typed their address into a
 * "notify me" box has made a fresh, specific, affirmative request for ONE
 * email about ONE product. That outranks a previous global unsubscribe —
 * particularly because issue #376 means some of those unsubscribes were
 * accidental (a one-click link on an auth email kills all mail).
 *
 * What the previous unsubscribe DOES still block is everything else: the
 * marketing opt-in on this form is unticked by default and re-subscribes
 * nobody who does not actively tick it. See `wantsMarketing`.
 */
function shouldNotify(row, now = new Date()) {
  if (!row)                      return { ok: false, reason: 'no row' };
  if (row.notified_at)           return { ok: false, reason: 'already notified' };
  if (!isPlausibleEmail(row.email)) return { ok: false, reason: 'implausible email' };

  const qty = Number(row.qty_on_hand);
  if (!Number.isFinite(qty) || qty < RULES.MIN_QTY) {
    return { ok: false, reason: `still out of stock (qty ${row.qty_on_hand})` };
  }

  const age = ageInDays(row.created_at, now);
  if (age === null)              return { ok: false, reason: 'no created_at' };
  if (age > RULES.EXPIRY_DAYS) {
    return { ok: false, reason: `request is ${Math.round(age)} days old, over the ${RULES.EXPIRY_DAYS}-day limit`, expired: true };
  }

  return { ok: true, reason: 'in stock, request live' };
}

function ageInDays(created, now = new Date()) {
  const t = created instanceof Date ? created.getTime() : Date.parse(created);
  if (!Number.isFinite(t)) return null;
  return (now.getTime() - t) / 86400000;
}

/* ── MARKETING OPT-IN ──────────────────────────────────────────────────────
 * ⚠️ THE CHECKBOX ON THE FORM IS UNTICKED AND MUST STAY UNTICKED.
 *
 * A pre-ticked box that re-subscribes someone who previously opted out is the
 * highest-probability spam-complaint source there is, and Brevo scores
 * complaint rate at the ACCOUNT level — the same account that delivers order
 * confirmations and shipping notices for $5,000 freight orders. The marketing
 * upside is a handful of subscribers; the downside is order mail landing in
 * spam. It is not a close trade.
 *
 * Only an explicit, affirmative "on" counts. Anything else is a no.
 */
function wantsMarketing(formValue) {
  return formValue === 'on' || formValue === '1' || formValue === 'true' || formValue === true;
}

module.exports = {
  RULES,
  normaliseEmail,
  isPlausibleEmail,
  shouldNotify,
  ageInDays,
  wantsMarketing,
};
