/* ═══════════════════════════════════════════════════════════════════════════
   consentUnblock.js — fresh consent lifts an UNSUBSCRIBE block, and nothing
   else.

   WHY THIS EXISTS (owner, 2026-10-24). Brevo adds an Unsubscribe button to
   every message it sends, transactional included, and one click blocklists
   the address against our sender — stopping order confirmations and delivery
   notices, not just marketing.

   The owner's point, which was the right one: the checkout consent box
   ("notify me about this order", pre-ticked) should put that customer back
   in touch. It did not, and the reason is not obvious from the UI:

     THE TICK WRITES customers.accepts_marketing IN **OUR** DATABASE.
     THE BLOCK LIVES ON **BREVO'S** SIDE.
     Ours cannot override theirs. Brevo refuses the send before our flag is
     ever consulted, so the customer ticks the box, orders, and still hears
     nothing.

   Until now unblockContact was called from exactly one place: an admin
   pressing a button on the Email Health page. This makes the common case
   self-healing and removes the need for a second email provider.

   ⚠️ AND IT IS DELIBERATELY NOT "UNBLOCK ON CONSENT".
   It is "unblock on consent IF the block was an unsubscribe". The reason
   recorded against the block decides, and the default is to refuse:

     unsubscribe  -> a PREFERENCE. The customer expressed it and may
                     reverse it. Fresh explicit consent is exactly that.
     hardBounce   -> the mailbox DOES NOT EXIST. Consent cannot make a dead
                     address live. Re-sending to a known hard bounce is one
                     of the fastest ways to wreck sender reputation, which
                     would damage delivery for every other customer.
     spam report  -> they reported us. Unblocking and resuming send after a
                     complaint is reckless both reputationally and legally,
                     and a ticked box on a checkout page is not a retraction
                     of a spam complaint.

   So this FAILS CLOSED: an unrecognised or missing reason does not unblock.
   Refusing to restore costs one phone call; wrongly restoring a bounce or a
   complaint costs everyone's deliverability. The two blocked addresses on
   this account at the time of writing were both hardBounce, which is
   precisely the case that must NOT be auto-restored.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

/* Lazy — config/database exits the process without DB_PASS, and a module a
   gate cannot load is one the gate has to re-implement. Same reasoning as
   offerClaim.js and pendingBundle.js. */
function pool() { return require('../config/database').bvoPool; }

/**
 * May a block with this reason be lifted by the customer giving consent?
 *
 * PURE, and exported so a gate can EXECUTE the policy rather than match the
 * text of it (Rule 14). This is the whole safety decision of the file.
 *
 * ⚠️ ALLOW-LIST, NOT A DENY-LIST. Brevo's reason strings vary by endpoint
 * and have changed before — `unsubscribedViaMA`, `unsubscribedViaEmail`,
 * plain `unsubscribed`. A deny-list of "hardBounce, spam" would silently
 * start auto-restoring anything Brevo invents next. Matching the one family
 * we mean, and refusing everything else, fails in the safe direction.
 */
function mayUnblock(reason) {
  if (reason === null || reason === undefined) return false;
  const r = String(reason).trim();
  if (!r) return false;
  /* "unsubscribed", "unsubscribedViaMA", "unsubscribedViaEmail", "Unsubscribe".
     NOTE the deliberate absence of any hardBounce or spam case: they fall
     through to false, which is the point. */
  return /unsubscrib/i.test(r);
}

/**
 * Called when a customer gives fresh marketing/notification consent.
 *
 * ⚠️ NEVER THROWS. This runs on the checkout and account paths. A Brevo
 * outage must not fail an order or a sign-up because of a courtesy unblock.
 * Every exit returns a reason code instead, so the caller can log without
 * branching on exceptions.
 *
 * @returns {Promise<{ok:boolean, action:string, reason?:string}>}
 */
async function restoreOnConsent(email) {
  const addr = String(email || '').trim().toLowerCase();
  if (!addr) return { ok: false, action: 'no-email' };

  try {
    const [rows] = await pool().query(
      `SELECT id, email_blocked, email_blocked_reason
         FROM customers WHERE email = ? LIMIT 1`, [addr]
    );
    const row = rows && rows[0];
    if (!row) return { ok: false, action: 'no-customer' };

    /* ⚠️ '1' AND 1. mysql2 returns TINYINT as a number, but this column is
       read as a string in two other places in this codebase, so both are
       accepted rather than assuming. An unselected column would be
       undefined here, which correctly falls through to not-blocked. */
    const isBlocked = String(row.email_blocked) === '1' || row.email_blocked === 1;
    if (!isBlocked) return { ok: true, action: 'not-blocked' };

    if (!mayUnblock(row.email_blocked_reason)) {
      /* Said out loud: this is the hardBounce / spam case, and it is the
         one an admin needs to know about, because the customer believes
         they have just opted in and will still hear nothing. */
      console.warn('[consentUnblock] refusing auto-restore for', addr,
                   '- reason:', row.email_blocked_reason);
      return { ok: false, action: 'reason-not-restorable',
               reason: row.email_blocked_reason };
    }

    const brevo = require('./brevoService');
    const r = await brevo.unblockContact(addr);
    if (!r.ok) {
      console.error('[consentUnblock] Brevo refused the unblock for', addr, r.error);
      return { ok: false, action: 'brevo-failed' };
    }

    /* Local flags cleared only AFTER Brevo confirms. The reverse order would
       leave our record saying "reachable" while Brevo still refuses to send
       — a lie that the nightly reconcile would then have to undo. */
    await pool().query(
      `UPDATE customers
          SET email_blocked = 0, email_blocked_at = NULL,
              email_blocked_reason = NULL, email_checked_at = NOW()
        WHERE id = ?`, [row.id]
    );

    /* Same audit table the nightly job writes to, so the history of an
       address is one list rather than two that have to be merged. */
    await pool().query(
      `INSERT INTO email_consent_events
         (customer_id, email, event, reason, source, was_trade)
       VALUES (?, ?, 'restored', 'consent given', 'consent', 0)`,
      [row.id, addr]
    ).catch(() => {});

    console.log('[consentUnblock] restored', addr, 'after fresh consent');
    return { ok: true, action: 'restored' };
  } catch (err) {
    console.error('[consentUnblock] failed for', addr, err && err.message);
    return { ok: false, action: 'error' };
  }
}

module.exports = { mayUnblock, restoreOnConsent };
