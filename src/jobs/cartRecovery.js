'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   cartRecovery.js — abandoned-cart outreach.

   Run:  node src/jobs/cartRecovery.js            (sends)
         node src/jobs/cartRecovery.js --dry-run  (reports, sends nothing)

   ────────────────────────────────────────────────────────────────────────────
   ⚠️ CONSENT IS A GATE, NOT A PREFERENCE TO WEIGH UP.

   The first abandoned cart this site ever took, order 23, decided the design.
   The customer ticked "yes" to delivery texts and "no" to marketing email in
   the same submit, one minute before she stopped. The flag and its timestamp
   were both set, which is how we know she was ASKED and DECLINED rather than
   never asked. Emailing her an offer would have contradicted a choice she had
   just made deliberately.

   So: an email goes only to somebody who said yes. Everybody else — declined,
   never asked, no address, blocked — lands on a CALL LIST with their phone
   number, because the value is still there and a phone call breaks no
   promise. That cart was $2,195.

   ⚠️ THE OFFER AGREES WITH THE GATE, WHICH IS NOT A COINCIDENCE.
   offerClaim.js requires customers.accepts_marketing as condition 2 of 3 for
   the Platinum Member 10%. Somebody who declined marketing is not eligible
   for the discount anyway, so emailing them an offer would have promised
   something checkout would then refuse. The two rules point the same way.

   ────────────────────────────────────────────────────────────────────────────
   ⚠️ "NEVER ASKED" IS NOT CONSENT, AND IS NOT THE SAME AS "DECLINED".

   accepts_marketing is NOT NULL DEFAULT 0, so the flag alone cannot tell the
   two apart — the timestamp is what distinguishes them. Both are excluded
   from email, but they are reported separately, because "nobody ever asked
   them" is a fixable gap in the checkout and "they said no" is not.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ⚠️ REQUIRED LAZILY. src/config/database.js calls process.exit when DB_PASS
   is unset, so a top-level require makes this module unloadable without a
   live environment — and a module a gate cannot LOAD is one the gate has to
   re-implement, which is the Rule 18 trap. Deferring keeps the pure rules
   below executable by a gate while the database parts stay as they are. */
function pool() { return require('../config/database').bvoPool; }

const unsubToken = require('../utils/unsubscribeToken');
/* Pure rules at module scope; its pool is lazy too, so this stays loadable
   by the gate without a database. One definition of "recently contacted",
   shared with the admin order page — a second copy here is how the list and
   the panel end up disagreeing about whether somebody has been called. */
const contactLog = require('../utils/contactLog');

/* ── TUNING ─────────────────────────────────────────────────────────────── */

/* Old enough that somebody who stepped away mid-checkout has come back, young
   enough that the decision is still live. One touch only; a second needs
   recovery_stage and a deliberate decision about frequency. */
const MIN_AGE_HOURS = 4;

/* ⚠️ AN UPPER BOUND, NOT JUST A LOWER ONE. Without it, the first run after
   deployment emails every abandoned cart in history at once — people who
   walked away months ago, in one burst, from a sending domain with almost no
   reputation. That is how a new domain gets itself filtered. */
const MAX_AGE_DAYS = 14;

/* A cart worth an email. Below this the postage of attention costs more than
   the basket. */
const MIN_VALUE = 50;

const TEMPLATE_KEY = 'cart_recovery';

/* ── WHO MAY BE EMAILED — THE ONE SWITCH ────────────────────────────────
   ⚠️ THIS IS A BUSINESS DECISION, NOT A LEGAL REQUIREMENT, AND IT IS HERE
   RATHER THAN BURIED IN A CONDITION SO THAT CHANGING IT IS DELIBERATE.

   US CAN-SPAM is opt-OUT: a commercial email is lawful without prior
   consent provided it carries accurate headers, a truthful subject, a
   valid postal address and a working unsubscribe honoured promptly. All
   four are present. Recipients are US, so GDPR/CASL opt-in rules do not
   apply. (Not legal advice.)

   The settings below are therefore a choice about risk and manners:

   'declined'    — they were ASKED and said no (flag 0, timestamp set).
                   Default false. Sending here contradicts a preference
                   they expressed deliberately, is arguably a CAN-SPAM
                   opt-out violation, and promises the Platinum 10% that
                   offerClaim.js will refuse them for lacking consent.

   'never_asked' — the flag is 0 only because it defaults to 0 and nobody
                   asked (timestamp NULL). Default false, but this is the
                   defensible one to flip: no preference is being
                   contradicted, because none was ever recorded. Flipping
                   it is lawful under CAN-SPAM. Weigh it against a young
                   sending domain.

   Anyone on Brevo's blocklist, or with no address, is never emailed under
   any setting — those are not preferences, they are facts. */
const EMAIL_WHO = {
  declined:    false,
  never_asked: false,
};

/* ── THE PURE RULES ─────────────────────────────────────────────────────── */

/**
 * Why this row may or may not be emailed.
 *
 * ⚠️ PURE AND EXPORTED so a gate can RUN it on real row shapes instead of
 * describing it in a second copy that drifts. Returns a reason string, never
 * a bare boolean, because "why not" is what the call list needs to show.
 */
function emailEligibility(row) {
  if (!row) return 'no_row';
  const email = String(row.email || '').trim();
  if (!email) return 'no_email';
  if (Number(row.email_blocked) === 1) return 'blocked';

  /* The timestamp is what separates "asked and declined" from "never asked".
     Both block the email; only one of them is a gap worth fixing. */
  if (Number(row.accepts_marketing) !== 1) {
    const why = row.marketing_consent_at ? 'declined' : 'never_asked';
    /* The switch is consulted here and nowhere else, so there is one
       definition of who may be mailed. */
    return EMAIL_WHO[why] ? 'ok' : why;
  }
  return 'ok';
}

/** Split a batch into who gets mailed and who gets called. */
/* ⚠️ THREE LISTS NOW, NOT TWO — `held` IS NEW (2026-10-27).

   The hourly cron made a latent problem visible. recovery_emailed_at is
   stamped only on the EMAIL path, so somebody on the call list is never
   stamped and reprints every single run — order 23 appeared twelve times a
   day for as long as her cart stayed inside the 14-day window. Worse than
   the noise: with more than one person working that list, she gets rung
   about the same abandoned cart repeatedly.

   So a row that was contacted recently moves to `held` instead of `call`.

   ⚠️ held IS RETURNED, NOT DISCARDED, and run() prints it. A name that
   simply vanishes from a list is indistinguishable from a bug, and the
   operator needs to see "we already called her Tuesday" rather than
   wonder where the $2,195 cart went. Same reasoning as excluded_because.

   `lastMap` is optional. Called without it — as the gate's pure triage
   checks do — nothing is suppressed and the behaviour is exactly what it
   was before. Suppression is an enrichment, never a prerequisite. */
function triage(rows, lastMap = null, now = new Date()) {
  const email = [], call = [], held = [];
  for (const r of rows || []) {
    const why = emailEligibility(r);
    if (why === 'ok') { email.push(r); continue; }

    const last = lastMap ? contactLog.lookup(lastMap, r) : null;
    const s    = contactLog.suppression(last, now);
    const row  = { ...r, excluded_because: why, last_contact: last || null };

    if (s.skip) held.push({ ...row, held_because: s.reason });
    else        call.push(row);
  }
  /* Highest value first: a call list is worked top-down and somebody's
     attention runs out before the list does. */
  const byValue = (a, b) => Number(b.total || 0) - Number(a.total || 0);
  call.sort(byValue);
  held.sort(byValue);
  return { email, call, held };
}

/* ── THE QUERY ──────────────────────────────────────────────────────────── */

async function findAbandoned() {
  /* ⚠️ 'pending' ALONE IS AMBIGUOUS — see config/inventoryRisk.js, which
     makes the same point. A paid order passes through pending too. The
     payment_status filter is what makes this an ABANDONED checkout rather
     than a new one, and dropping it would email people who have paid. */
  const [rows] = await pool().query(
    `SELECT o.id, o.order_number, o.total, o.created_at,
            o.ship_first_name, o.ship_phone,
            COALESCE(c.email, o.guest_email)        AS email,
            c.id                                    AS customer_id,
            c.accepts_marketing, c.marketing_consent_at, c.email_blocked,
            (SELECT oi.name FROM order_items oi
              WHERE oi.order_id = o.id ORDER BY oi.id ASC LIMIT 1) AS first_item,
            (SELECT p.slug FROM order_items oi
               LEFT JOIN products p ON p.id = oi.product_id
              WHERE oi.order_id = o.id ORDER BY oi.id ASC LIMIT 1) AS first_slug
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.status = 'pending'
        AND (o.payment_status IS NULL OR o.payment_status IN ('draft','pending'))
        AND o.is_test = 0
        AND o.recovery_emailed_at IS NULL
        AND o.total >= ?
        AND o.created_at <= DATE_SUB(NOW(), INTERVAL ? HOUR)
        AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY o.total DESC`,
    [MIN_VALUE, MIN_AGE_HOURS, MAX_AGE_DAYS]
  );
  return rows || [];
}

/* ── THE RUN ────────────────────────────────────────────────────────────── */

async function run({ dryRun = false } = {}) {
  const started = new Date();
  const say = (...a) => console.log('[cart-recovery]', ...a);

  let rows;
  try {
    rows = await findAbandoned();
  } catch (err) {
    /* ER_BAD_FIELD_ERROR here means the 2026-10-27 migration has not run.
       Said plainly: it is the one failure a deploy can realistically cause. */
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      say('FATAL: orders is missing the recovery_* columns. Run ' +
          'migrations/2026-10-27_cart_recovery_RUNME.sql');
      return { ok: false, reason: 'migration_missing' };
    }
    throw err;
  }

  /* ⚠️ ONE QUERY FOR EVERY CANDIDATE, not one per row. The list is short
     today; it is short because the shop is new, which is not a property to
     design around.

     A failure here must NOT take the run down: not knowing who was called
     is a reason to show the whole list, never a reason to email nobody. So
     it degrades to an unsuppressed list and says so, rather than throwing. */
  let lastMap = null;
  try {
    lastMap = await contactLog.readLastContactBulk(rows);
  } catch (err) {
    say(`WARN: could not read contact history (${err.code || err.message}) — ` +
        'showing the full call list unsuppressed');
  }

  const { email, call, held } = triage(rows, lastMap);
  say(`${rows.length} abandoned cart(s): ${email.length} emailable, ` +
      `${call.length} to call, ${held.length} already contacted`);

  /* The call list is printed EVERY run, dry or not. It is the half of the
     output a human acts on, and a report nobody sees is a report that does
     not exist. */
  const line = c =>
    `  $${Number(c.total).toFixed(2).padStart(9)}  ${c.order_number}  ` +
    `${c.ship_first_name || '(no name)'}  ${c.ship_phone || '(no phone)'}  ` +
    `[${c.excluded_because}]  ${c.first_item || ''}`;

  if (call.length) {
    say('— CALL LIST (highest value first) —');
    for (const c of call) {
      /* Prior contact is shown even when it did not suppress: "we spoke on
         the 20th" changes how the next call opens. */
      const prior = c.last_contact ? `  — last: ${contactLog.describe(c.last_contact)}` : '';
      say(line(c) + prior);
    }
  }

  /* ⚠️ PRINTED, NOT SILENTLY DROPPED. This is the list that stops the
     second person ringing the same customer, and it is also the only
     evidence that suppression is working rather than eating rows. */
  if (held.length) {
    say(`— ALREADY CONTACTED (held ${contactLog.SUPPRESS_DAYS}d, no action) —`);
    for (const c of held) say(line(c) + `  — ${c.held_because}`);
  }

  if (dryRun) {
    say('--dry-run: nothing sent, nothing stamped');
    return { ok: true, found: rows.length, emailed: 0, toCall: call.length, held: held.length, dryRun: true };
  }

  const brevo = require('../services/brevoService');
  let sent = 0, failed = 0;

  for (const r of email) {
    try {
      await brevo.sendTemplate(TEMPLATE_KEY, r.email, {
        customer_first_name: r.ship_first_name || 'there',
        product_name:        r.first_item || 'your order',
        product_url:         r.first_slug
          ? `https://www.bathroomvanitiesoutlet.com/products/${r.first_slug}`
          : 'https://www.bathroomvanitiesoutlet.com/',
        cart_total:          Number(r.total).toLocaleString('en-US', { minimumFractionDigits: 2 }),
        /* The link that actually enrols somebody in the 10%. NOT
           /collections/sale, which enrols nobody — see offerClaim.js. */
        offer_url:           'https://www.bathroomvanitiesoutlet.com/account/login?offer=platinum&optin=1',
        unsubscribe_url:     unsubToken.url(r.email) || '',
        postal_address:      'Smash Inventory Solutions, LLC, 5120 Old Ellis Pt, Suite C, Roswell, GA 30076',
        phone:               '(877) 777-1948',
      });

      /* ⚠️ STAMPED ONLY AFTER THE SEND RESOLVES. Stamping first would mean a
         failed send is never retried and the customer is silently skipped
         forever; stamping after means a crash between the two can at worst
         send one duplicate, which is the lesser harm. */
      await pool().query(
        `UPDATE orders SET recovery_emailed_at = NOW(), recovery_stage = 'first' WHERE id = ?`,
        [r.id]
      );
      sent++;
      say(`  sent  ${r.order_number}  ${r.email}  $${Number(r.total).toFixed(2)}`);
    } catch (err) {
      failed++;
      say(`  FAIL  ${r.order_number}  ${err.code || ''} ${err.message}`);
    }
  }

  say(`done in ${((Date.now() - started) / 1000).toFixed(1)}s — ` +
      `sent ${sent}, failed ${failed}, to call ${call.length}`);
  return { ok: failed === 0, found: rows.length, emailed: sent, failed, toCall: call.length, held: held.length };
}

module.exports = {
  run, triage, emailEligibility, findAbandoned,
  MIN_AGE_HOURS, MAX_AGE_DAYS, MIN_VALUE, TEMPLATE_KEY, EMAIL_WHO,
};

/* Run directly: node src/jobs/cartRecovery.js [--dry-run] */
if (require.main === module) {
  /* ⚠️ dotenv IS LOADED HERE, AND ONLY HERE. A direct run has nothing
     else to load it, so without this the first thing that touches the
     pool dies with "DB_PASS is not set in .env" — which reads as a
     missing password rather than a missing require, and sends somebody
     looking in the wrong place. The header of this file advertises a
     direct run, so a direct run has to work.

     NOT at module scope: cart_recovery.sh loads a SPECIFIC env file
     (hbuilds/config/.env, outside the deploy tree) before requiring
     this, and dotenv does not override variables that are already set —
     but putting the call at module scope would still mean a require
     from anywhere silently pulled in whatever .env happened to sit in
     the working directory. Scoped to the CLI path, that cannot happen. */
  try { require('dotenv').config(); } catch { /* dotenv optional */ }

  run({ dryRun: process.argv.includes('--dry-run') })
    .then(r => process.exit(r.ok ? 0 : 1))
    .catch(err => { console.error('[cart-recovery] fatal:', err); process.exit(1); });
}
