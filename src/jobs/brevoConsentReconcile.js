#!/usr/bin/env node
'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   brevoConsentReconcile.js — pull Brevo's blocklist, record it, tell the owner.

   Task #374, owner decision 2026-10-23: flag for review. NOT auto-downgrade.

   ────────────────────────────────────────────────────────────────────────────
   WHY A DAILY JOB AND NOT A WEBHOOK

   A webhook was the obvious answer and it is the worse one here:

   1. A webhook endpoint that flips consent flags is an UNAUTHENTICATED WRITE
      to a compliance record. Brevo does not sign its webhooks the way Stripe
      does, so the only protection available is a secret in the URL — which
      lands in access logs, proxies and anyone's browser history. The Stripe
      webhook in server.js is safe because signature verification authenticates
      it; there is no equivalent here.

   2. A webhook only ever tells you about events AFTER you wire it up. This
      job BACKFILLS — the first run captures every address already blocked,
      which on day one is the entire history nobody was watching.

   3. Brevo's marketing-unsubscribe event is not the only way mail stops.
      Hard bounces, spam complaints and admin blocks all end delivery and
      none of them is an "unsubscribe". Reading the blocklist catches all
      four; subscribing to one event type catches one.

   4. BVO already runs overnight crons and the owner has no SSH. One more
      line in the existing crontab is cheaper than a public endpoint.

   The cost is up to 24 hours of latency. For a flag the owner reviews by
   hand, that is not a cost worth a public write endpoint.

   ────────────────────────────────────────────────────────────────────────────
   ⚠️ A TRUNCATED LIST MUST NEVER CLEAR A BLOCK

   fetchBlockedContacts() stops at BLOCKLIST_MAX_PAGES and returns
   partial:true when it may not have reached the end. On a partial list,
   absence is not evidence of anything — so this job NEVER restores on a
   partial run. Treating a truncated page as "everyone else is fine" would
   silently mark blocked customers reachable and resume mailing them, which
   is the one outcome worse than not running at all.

   ⚠️ CONSENT IS NOT AUTO-RESTORED

   Coming off the blocklist sets email_blocked = 0 — we can reach them again.
   It does NOT set accepts_marketing back to 1. Permission withdrawn has to be
   given again, by them; an admin pressing unblock so a receipt can go out is
   not the customer asking for promotions. Gated.
   ═══════════════════════════════════════════════════════════════════════════ */

const brevo = require('../services/brevoService');
/* ⚠️ THE TIER RULE IS EXECUTED, NOT RE-IMPLEMENTED.
   First draft of this file asked /trade|elite/i against the tier string.
   That is a second, divergent definition of "is this a trade customer" —
   it would have counted a future tier called 'trade_pending' and missed a
   rename. tiers.isTradeTier is the one source and it is already used for
   MAP-gated pricing, which is the decision that actually matters. */
const { isTradeTier } = require('../utils/tiers');

function pool() { return require('../config/database').bvoPool; }

/* Set BREVO_RECONCILE_NOTIFY=0 for the first (backfill) run so shipping this
   does not send one notification per historical unsubscribe. Default is on —
   a quiet default would mean the feature silently does nothing. */
const BACKFILL_NOTIFY = process.env.BREVO_RECONCILE_NOTIFY !== '0';

const norm = e => String(e || '').trim().toLowerCase();

/* ── Pure, so the gate can execute the rule rather than re-implement it ──
   Given the blocklist and the current DB state, what should change?
   No I/O, no dates, no randomness. */
function diff(blockedNow, dbRows, { partial = false } = {}) {
  const set = new Set([...blockedNow].map(norm));
  const toBlock = [];
  const toRestore = [];

  for (const row of dbRows) {
    const isBlocked = set.has(norm(row.email));
    const wasBlocked = String(row.email_blocked) === '1' || row.email_blocked === 1;

    if (isBlocked && !wasBlocked) {
      toBlock.push(row);
    } else if (!isBlocked && wasBlocked) {
      /* ⚠️ THE PARTIAL GUARD. See the header. On a truncated list we cannot
         tell "not blocked" from "not reached", so we leave it alone. */
      if (!partial) toRestore.push(row);
    }
  }
  return { toBlock, toRestore, skippedRestores: partial ? dbRows.filter(r =>
    (String(r.email_blocked) === '1' || r.email_blocked === 1) && !set.has(norm(r.email))
  ).length : 0 };
}

/* Reason strings Brevo returns, kept as a documentation list only — the
   value written to the DB is whatever Brevo actually said, never mapped
   through this. Here so the next reader knows what they will see. */
const KNOWN_REASONS = [
  'unsubscribedViaMA', 'unsubscribedViaEmail', 'unsubscribedViaApi',
  'adminBlocked', 'hardBounce', 'contactFlaggedAsSpam',
];

/** Brevo returns reason as an object on some endpoints and a string on others. */
function reasonOf(contact) {
  const r = contact && contact.reason;
  if (!r) return null;
  if (typeof r === 'string') return r.slice(0, 64);
  return String(r.code || r.message || '').slice(0, 64) || null;
}

async function run() {
  const started = Date.now();
  console.log('[consent] reconcile starting');

  const res = await brevo.fetchBlockedContacts();
  if (!res.ok) {
    /* Fail loudly and change NOTHING. A fetch failure is indistinguishable
       from an empty blocklist if you let it through, and an empty blocklist
       would restore every blocked customer at once. */
    console.error('[consent] ABORT — could not read the blocklist:', res.error);
    return { ok: false, error: res.error };
  }
  if (res.partial) {
    console.warn('[consent] blocklist is TRUNCATED (hit the page cap). ' +
      'New blocks will be recorded; restores are skipped this run.');
  }

  const byEmail = new Map();
  for (const c of res.contacts || []) {
    const e = norm(c.email);
    if (e) byEmail.set(e, c);
  }

  /* tier is a COLUMN on customers (customers.tier, one of the STORED values
     in utils/tiers.js) — not a join. There is no customer_tiers table. */
  const [rows] = await pool().query(
    `SELECT id, email, email_blocked, accepts_marketing,
            COALESCE(tier, '') AS tier
       FROM customers
      WHERE email IS NOT NULL AND email <> ''`
  );

  const { toBlock, toRestore, skippedRestores } =
    diff(byEmail.keys(), rows, { partial: !!res.partial });

  let blocked = 0, restored = 0;
  const tradeHits = [];

  for (const row of toBlock) {
    const reason = reasonOf(byEmail.get(norm(row.email)));
    const isTrade = isTradeTier(row.tier || '');
    try {
      /* ⚠️ accepts_marketing goes to 0 HERE and only here. The unsubscribe
         IS the withdrawal of permission, and the column is what every
         marketing send reads. */
      await pool().query(
        `UPDATE customers
            SET email_blocked = 1, email_blocked_at = NOW(),
                email_blocked_reason = ?, email_checked_at = NOW(),
                accepts_marketing = 0
          WHERE id = ?`, [reason, row.id]);
      await pool().query(
        `INSERT INTO email_consent_events
           (customer_id, email, event, reason, source, was_trade)
         VALUES (?, ?, 'blocked', ?, 'reconcile', ?)`,
        [row.id, row.email, reason, isTrade ? 1 : 0]);
      blocked++;
      if (isTrade) tradeHits.push({ email: row.email, reason, tier: row.tier });
    } catch (err) {
      console.error(`[consent] failed to record block for ${row.email}:`, err.message);
    }
  }

  for (const row of toRestore) {
    try {
      /* ⚠️ accepts_marketing IS DELIBERATELY NOT TOUCHED. See the header. */
      await pool().query(
        `UPDATE customers
            SET email_blocked = 0, email_blocked_at = NULL,
                email_blocked_reason = NULL, email_checked_at = NOW()
          WHERE id = ?`, [row.id]);
      await pool().query(
        `INSERT INTO email_consent_events
           (customer_id, email, event, reason, source, was_trade)
         VALUES (?, ?, 'restored', NULL, 'reconcile', ?)`,
        [row.id, row.email, isTradeTier(row.tier || '') ? 1 : 0]);
      restored++;
    } catch (err) {
      console.error(`[consent] failed to record restore for ${row.email}:`, err.message);
    }
  }

  /* Stamp everyone we actually checked, so a stale email_checked_at is a
     signal the job stopped running rather than that nobody unsubscribed. */
  if (!res.partial) {
    await pool().query(
      'UPDATE customers SET email_checked_at = NOW() WHERE email IS NOT NULL AND email <> \'\''
    ).catch(err => console.error('[consent] checked_at stamp failed:', err.message));
  }

  if (tradeHits.length && BACKFILL_NOTIFY) {
    await notifyOwner(tradeHits).catch(err =>
      console.error('[consent] owner notification failed:', err && err.message));
  } else if (tradeHits.length) {
    console.log(`[consent] ${tradeHits.length} trade block(s) recorded, ` +
      'notification suppressed by BREVO_RECONCILE_NOTIFY=0');
  }

  console.log(`[consent] done in ${Date.now() - started}ms — ` +
    `${blocked} newly blocked, ${restored} restored, ` +
    `${tradeHits.length} of them trade` +
    (skippedRestores ? `, ${skippedRestores} restore(s) skipped (truncated list)` : ''));

  return { ok: true, blocked, restored, trade: tradeHits.length, partial: !!res.partial };
}

/** One digest, not one mail per customer. */
async function notifyOwner(hits) {
  const to = process.env.TRADE_NOTIFY_EMAIL || 'support@bathroomvanitiesoutlet.com';
  const lines = hits.map(h =>
    `<li><strong>${h.email}</strong> — ${h.tier || 'trade'} — ${h.reason || 'reason not given'}</li>`
  ).join('');

  /* ⚠️ sendRaw is POSITIONAL — (toEmail, subject, htmlBody, toName).
     First draft passed an object, which would have sent to "[object
     Object]" with an undefined subject. node --check does not catch it. */
  await brevo.sendRaw(
    to,
    `Trade account${hits.length > 1 ? 's' : ''} stopped receiving email (${hits.length})`,
      `<p>${hits.length} trade customer${hits.length > 1 ? 's are' : ' is'} now on Brevo's ` +
      `blocklist, so we cannot email them — including order confirmations and sign-in codes, ` +
      `not just promotions.</p><ul>${lines}</ul>` +
      `<p>Their trade pricing has <strong>not</strong> been changed. Review them in the trade ` +
      `queue and decide. If this was a mistake on their part, the diagnostics page can unblock ` +
      `the address; that restores delivery but does not restore marketing consent, which they ` +
      `have to give again.</p>`
  );
}

module.exports = { run, _diff: diff, _reasonOf: reasonOf, _KNOWN_REASONS: KNOWN_REASONS };

/* Run directly: node src/jobs/brevoConsentReconcile.js */
if (require.main === module) {
  run()
    .then(r => process.exit(r.ok ? 0 : 1))
    .catch(err => { console.error('[consent] fatal:', err); process.exit(1); });
}
