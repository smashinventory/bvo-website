'use strict';

/**
 * emailVerificationService.js — proving an address is owned, WITHOUT
 * making anyone wait for it.
 *
 * ══════════════════════════════════════════════════════════════════════
 * WHY THIS REPLACED THE CHECKOUT GATE — READ BEFORE CHANGING ANYTHING
 *
 * Until 2026-09-28, checkout REQUIRED a six-digit code before the buyer
 * could reach page 1 (requireIdentity + /checkout/identify). Brevo's own
 * event log then showed this:
 *
 *     11:59  "Your BVO code is 314851"   Sent
 *     12:03  "Your BVO code is 184254"   Sent
 *     12:10  "Your BVO code is 314851"   DELIVERED   <- 11 minutes
 *     12:11  "Your BVO code is 314851"   Loaded by proxy
 *
 * The 11:59 code expired at 12:09:28. It was delivered at 12:10 and
 * opened at 12:11. The buyer typed a number that had been dead for
 * ninety seconds and was told "That code is not right". The second code
 * was still undelivered thirteen minutes after issue.
 *
 * Nothing was broken. The key authenticated, the sender was valid, 292
 * credits remained, nobody was blocklisted, and Brevo returned HTTP 201.
 * Gmail simply DEFERS mail from senders it does not recognise, and BVO
 * is a new domain on Brevo's shared IP. The deferral therefore lands
 * hardest on addresses we have never mailed before — first-time buyers,
 * the people a store can least afford to lose.
 *
 * So the architectural error was never "which auth method". It was
 * putting a third-party network round-trip INSIDE the checkout path.
 * A password would not have fixed it: password reset is an email
 * round-trip too, so the dependency moves rather than disappears.
 *
 * Verification is now a SERVICE TO THE BUYER — confirm your email to
 * track delivery and get order updates — and an internal fraud
 * indicator for us. It is optional, it happens after the card is
 * authorised, and it must never block an order. If you are about to
 * make it blocking again, re-read the log above first.
 *
 * ══════════════════════════════════════════════════════════════════════
 * TWO PATHS, ONE FACT
 *
 * A confirm link proves the person can read mail at that address.
 * A six-digit code proves the person can read mail at that address.
 * There is NO difference in what is established, so both mark the
 * customer verified. method records which, because they are not equally
 * strong evidence:
 *
 *   'code'       20 minutes, one shot, rate limited, typed by a human.
 *   'order_link' 7 days, clickable, and confirmation emails get
 *                forwarded constantly.
 *
 * On a fraud call "signed in with a code eight minutes before ordering"
 * is a much better story than "clicked a link", which is the entire
 * reason the column exists.
 *
 * ══════════════════════════════════════════════════════════════════════
 * THE LINK MUST NEVER CREATE A SESSION
 *
 * Tempting — same proof, why not hand them a session. No: a 7-day link
 * sitting in a mailbox is a far weaker credential than a 20-minute
 * one-shot code, and order confirmations are forwarded all the time
 * ("send me the receipt"). Anyone forwarded that mail would land inside
 * the buyer's account with their addresses and order history.
 *
 * confirm() therefore returns a plain result and touches no session.
 * gate_order_email_verification.js asserts the controller never calls
 * establishSession or writes req.session.customerId on this path.
 */

const crypto      = require('crypto');
const { bvoPool } = require('../config/database');

/* Seven days, not ten minutes. This is NOT a credential: it cannot sign
   anyone in and cannot show anyone anything. A short expiry would only
   manufacture failures on the exact mail path we already know runs
   eleven minutes late. */
const TOKEN_TTL_DAYS = 7;

/* 256 bits. Same strength as the device tokens and the secure-account
   tokens, and for the same reason: it is looked up BY HASH with no email
   alongside it, so the token alone has to be unguessable. */
const TOKEN_BYTES = 32;

/* Stored hashed, never raw. A leaked orders table cannot confirm
   anything. NOT salted with the email — the link carries only ?t=...
   (putting an address in a URL leaks it into browser history, referrer
   headers and every proxy log on the way), so the lookup must work from
   the token alone. Safe here where it would not be for six digits:
   there is no preimage attack on 256 random bits. */
const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');

const normEmail = e => String(e || '').trim().toLowerCase();

/**
 * Mint a confirm token for one order.
 *
 * Returns the RAW token, which exists only in the email from here on.
 * Returns null on any failure — the caller sends the confirmation email
 * regardless, just without a Confirm button. A missing button is a
 * missing convenience; a thrown error here would cost the buyer their
 * order confirmation.
 *
 * @returns {Promise<string|null>}
 */
async function issueOrderToken(orderId) {
  if (!orderId) return null;
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  try {
    await bvoPool.query(
      `UPDATE orders
          SET email_verify_token      = ?,
              email_verify_sent_at    = NOW(),
              email_verify_expires_at = (NOW() + INTERVAL ? DAY)
        WHERE id = ?`,
      [hashToken(token), TOKEN_TTL_DAYS, orderId]
    );
    return token;
  } catch (err) {
    console.error('[emailVerify] issueOrderToken failed for order', orderId,
                  '-', err && err.message);
    return null;
  }
}

/**
 * Look a token up WITHOUT consuming it. Backs the GET page, which must
 * be safe to load repeatedly.
 *
 * THIS IS HALF OF THE SCANNER DEFENCE. Mail scanners follow links —
 * Brevo's own log records Gmail "Loaded by proxy" against our messages.
 * A GET that confirmed on sight would let a machine mark orders verified
 * with no human involved, destroying the exact fraud signal the flag
 * exists to give. So GET only LOOKS; POST commits.
 *
 * @returns {Promise<{ok:boolean, order?:object, reason?:string}>}
 */
async function peek(token) {
  const t = String(token || '');
  if (!/^[0-9a-f]{64}$/.test(t)) return { ok: false, reason: 'bad_token' };

  try {
    const [[row]] = await bvoPool.query(
      `SELECT o.id, o.order_number, o.guest_email, o.customer_id,
              o.email_verified_at,
              c.email_verified_at AS customer_verified_at
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.email_verify_token = ?
          AND o.email_verify_expires_at > NOW()
        LIMIT 1`,
      [hashToken(t)]
    );
    if (!row) return { ok: false, reason: 'bad_token' };

    /* Already done is NOT an error. A buyer who clicks the link twice,
       or who signed in with a code after ordering, should see "you're
       confirmed" — not a failure they cannot act on. */
    if (row.customer_verified_at) return { ok: true, order: row, already: true };

    return { ok: true, order: row };
  } catch (err) {
    console.error('[emailVerify] peek failed:', err && err.message);
    return { ok: false, reason: 'error' };
  }
}

/**
 * Commit the confirmation. Called ONLY from the POST handler.
 *
 * Marks the CUSTOMER verified — proving you own an address is a fact
 * about a person, not about one purchase. Per-order flags would make a
 * loyal repeat buyer who did not bother clicking on order #4 look more
 * suspicious than a first-time fraudster, which is exactly backwards.
 *
 * The order also gets its own email_verified_at so the admin can say
 * WHICH order produced the confirmation.
 *
 * GRANTS NO SESSION. See the header.
 *
 * @returns {Promise<{ok:boolean, orderNumber?:string, reason?:string}>}
 */
async function confirm(token) {
  const found = await peek(token);
  if (!found.ok) return { ok: false, reason: found.reason };

  const order = found.order;
  const conn  = await bvoPool.getConnection();
  try {
    await conn.beginTransaction();

    /* Token cleared FIRST, inside the transaction. One shot: a
       forwarded email cannot be replayed by a second reader, and a
       double-click cannot race itself into two writes. */
    await conn.query(
      `UPDATE orders
          SET email_verify_token = NULL,
              email_verified_at  = COALESCE(email_verified_at, NOW())
        WHERE id = ?`,
      [order.id]
    );

    if (order.customer_id) {
      /* COALESCE, not a plain SET. If they already verified by code,
         that EARLIER and STRONGER record stands — overwriting it with
         'order_link' would downgrade the evidence and move the
         timestamp, breaking the verified-vs-ordered comparison the
         order screen shows. First proof wins. */
      await conn.query(
        `UPDATE customers
            SET email_verified_at     = COALESCE(email_verified_at, NOW()),
                email_verified_method = COALESCE(email_verified_method, 'order_link')
          WHERE id = ?`,
        [order.customer_id]
      );
    }

    await conn.commit();
    return { ok: true, orderNumber: order.order_number, already: !!found.already };
  } catch (err) {
    try { await conn.rollback(); } catch { /* nothing useful to do */ }
    console.error('[emailVerify] confirm failed for order', order.id,
                  '-', err && err.message);
    return { ok: false, reason: 'error' };
  } finally {
    conn.release();
  }
}

/**
 * Mark verified from a successful CODE SIGN-IN.
 *
 * Typing back a code that was mailed to an address proves ownership of
 * that mailbox — the same thing the link proves, by a stronger route.
 * Anyone who has ever signed in is therefore verified and never sees
 * the confirm prompt.
 *
 * Keyed on EMAIL, not customer id: accountController calls this at the
 * moment of verification, which for a brand-new buyer is also the
 * moment the customer row is created.
 *
 * Never throws. A sign-in must not fail because a flag would not write.
 */
async function markVerifiedByCode(rawEmail) {
  const email = normEmail(rawEmail);
  if (!email) return false;
  try {
    /* COALESCE again: an address verified by link three weeks ago keeps
       that date. But the METHOD is allowed to upgrade to 'code' — code
       is the stronger evidence, and a rep should see the best proof we
       hold, not the first one we happened to get. */
    const [r] = await bvoPool.query(
      `UPDATE customers
          SET email_verified_at     = COALESCE(email_verified_at, NOW()),
              email_verified_method = 'code'
        WHERE email = ?`,
      [email]
    );
    return (r.affectedRows || 0) > 0;
  } catch (err) {
    console.error('[emailVerify] markVerifiedByCode failed:', err && err.message);
    return false;
  }
}

/**
 * Clear verification. For whenever a customer's address CHANGES.
 *
 * Verification belongs to an address, not to a person in the abstract.
 * Carrying a verified flag across an email change would mean claiming
 * we had proof of an address nobody has ever proven — and since a
 * changed address is a classic account-takeover step, that is the worst
 * possible place to be over-trusting.
 *
 * Nothing calls this yet: there is no change-email flow (it is its own
 * scope item — admin screen, customer-merge logic and an audit trail).
 * It lives here so that flow has the correct hook waiting rather than
 * inventing its own rule later.
 */
async function clearVerification(customerId) {
  if (!customerId) return false;
  try {
    await bvoPool.query(
      `UPDATE customers
          SET email_verified_at = NULL, email_verified_method = NULL
        WHERE id = ?`,
      [customerId]
    );
    return true;
  } catch (err) {
    console.error('[emailVerify] clearVerification failed:', err && err.message);
    return false;
  }
}

/** Is this customer's address proven? Backs the success-page poll. */
async function statusForCustomer(customerId) {
  if (!customerId) return { verified: false };
  try {
    const [[row]] = await bvoPool.query(
      'SELECT email_verified_at, email_verified_method FROM customers WHERE id = ?',
      [customerId]
    );
    if (!row || !row.email_verified_at) return { verified: false };
    return { verified: true, method: row.email_verified_method || null };
  } catch (err) {
    console.error('[emailVerify] statusForCustomer failed:', err && err.message);
    return { verified: false };
  }
}

module.exports = {
  issueOrderToken,
  peek,
  confirm,
  markVerifiedByCode,
  clearVerification,
  statusForCustomer,
  TOKEN_TTL_DAYS,
  /* Exported so the gates can exercise the real hashing rather than
     re-implementing it and testing their own copy. */
  _hashToken: hashToken,
};
