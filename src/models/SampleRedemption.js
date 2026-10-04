'use strict';

/**
 * SampleRedemption — who has already taken their 2 free samples.
 *
 * Schema: migrations/2026-10-04_sample_redemptions_RUNME.sql
 * Offer:  src/config/sampleOffer.js
 *
 * ──────────────────────────────────────────────────────────────────────
 * THE RULE IS ONE PER EMAIL **AND** ONE PER MAILING ADDRESS.
 *
 * Email alone is unlimited — anyone can make another address. A mailing
 * address costs the taker something, because the samples physically
 * arrive there. Both halves block.
 *
 * ⚠️ THE ENFORCEMENT IS THE TWO UNIQUE INDEXES, NOT THE isEligible()
 * BELOW. isEligible is a courtesy: it exists so the cart can show the
 * discount and so the customer can be told before they pay. The thing
 * that actually prevents a second redemption is the INSERT failing with
 * ER_DUP_ENTRY, which no race between two tabs and no caller bug can
 * get around. If you ever find yourself tempted to drop an index
 * because "the controller checks it", read that sentence again.
 *
 * ──────────────────────────────────────────────────────────────────────
 * FAIL CLOSED, ALWAYS.
 *
 * Every function here returns "not eligible" on error. A database blip
 * must not hand out free product: a customer who should have got the
 * discount and did not will ask, and we can fix one order by hand. The
 * opposite failure is silent, unbounded, and discovered in the P&L.
 */

const { bvoPool } = require('../config/database');
const addressKey  = require('../utils/addressKey');

/** Lowercase + trim. The unique index is on the stored bytes, so
 *  "Sam@x.com" and "sam@x.com" would otherwise be two redemptions. */
function normEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

/**
 * May this email / address still take the free samples?
 *
 * Either half already present means no. Called with whatever is known:
 * on the cart page there may be no address yet, in which case only the
 * email half can be checked and the address is re-checked at checkout
 * once it has been typed. That is why checkout must call this AGAIN
 * rather than trusting a flag from the cart.
 *
 * @param {string} email
 * @param {object|null} address  shape per addressKey(); null to skip
 * @returns {Promise<{eligible:boolean, reason:string|null}>}
 */
async function isEligible(email, address) {
  const e = normEmail(email);
  /* No email, no offer. Not an error — the cart page of a signed-out
     visitor legitimately has nothing to check — but it cannot be
     eligible either, because eligibility is per person. */
  if (!e) return { eligible: false, reason: 'no_email' };

  const key = address ? addressKey(address) : null;

  try {
    /* One query for both halves. Separate queries would be two
       round-trips and, worse, two places for the condition to drift. */
    const [rows] = await bvoPool.query(
      `SELECT email, address_key FROM sample_redemptions
        WHERE email = ? OR (? IS NOT NULL AND address_key = ?)
        LIMIT 1`,
      [e, key, key]
    );
    if (!rows.length) return { eligible: true, reason: null };
    /* Which half matched is worth knowing: the message to the customer
       differs, and "someone at your address already did" is the one that
       generates a support email if stated carelessly. */
    return {
      eligible: false,
      reason: rows[0].email === e ? 'email_used' : 'address_used',
    };
  } catch (err) {
    console.error('[sampleRedemption] isEligible failed:', err && err.message);
    return { eligible: false, reason: 'error' };
  }
}

/**
 * Record that the samples were given. Call AFTER the order exists.
 *
 * ⚠️ A DUPLICATE IS A NORMAL OUTCOME, NOT AN ERROR. Two tabs, a double
 * submit, or a Stripe webhook retry can all land here twice. ER_DUP_ENTRY
 * means "already redeemed", which is exactly the state we wanted, so it
 * returns ok:false WITHOUT logging an error — the alternative is a noisy
 * log that trains everyone to ignore it.
 *
 * @returns {Promise<{ok:boolean, duplicate?:boolean}>}
 */
async function record({ email, address, customerId, orderId, freeQty }) {
  const e = normEmail(email);
  if (!e) return { ok: false };
  if (!address) return { ok: false };

  try {
    await bvoPool.query(
      `INSERT INTO sample_redemptions
         (email, address_key, customer_id, order_id, free_qty)
       VALUES (?,?,?,?,?)`,
      [e, addressKey(address), customerId || null, orderId || null,
       Math.max(0, parseInt(freeQty, 10) || 0)]
    );
    return { ok: true };
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') return { ok: false, duplicate: true };
    console.error('[sampleRedemption] record failed:', err && err.message);
    return { ok: false };
  }
}

module.exports = { isEligible, record, _internals: { normEmail } };
