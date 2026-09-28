'use strict';

/**
 * deviceService — "Remember this device", 90 days. Scope item 26.
 *
 * Owner-approved 2026-09-28: a recognised device SKIPS the six-digit
 * code entirely.
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHY THAT IS WORTH THE RISK, RECORDED SO IT IS NOT RE-ARGUED
 *
 * Without it, EVERY repeat purchase depends on email delivery. On
 * 2026-09-27 that channel was found to have never worked at all — an
 * SMTP key in an API-key slot, then an IP allowlist, then junk-folder
 * placement on a cold domain. If Brevo hiccups, nobody can check out.
 *
 * Second reason: every code email is another chance for a customer to
 * hit Unsubscribe and blocklist themselves from ALL transactional mail
 * (Brevo attaches List-Unsubscribe to every message and it cannot be
 * turned off below Enterprise). Fewer codes sent, less exposure.
 *
 * ──────────────────────────────────────────────────────────────────────
 * THIS TOKEN IS A BEARER CREDENTIAL. Treat it like one.
 *
 * Whoever holds the cookie signs in. So:
 *   - 256 bits from crypto.randomBytes, never Math.random
 *   - only sha256(token) is stored; a leaked table is not a set of logins
 *   - httpOnly (no JS can read it), Secure in production, SameSite=Lax
 *   - bound to ONE customer: presenting it for a different email is
 *     ignored, not an error
 *   - revocable in bulk, which is what "Secure my account" means here
 *
 * ──────────────────────────────────────────────────────────────────────
 * NOT SALTED PER ROW, unlike customer_auth_codes.
 *
 * Those are six digits: without a per-row salt a leaked table is brute
 * forced instantly. This is 256 random bits, where a sha256 preimage
 * attack is not a thing — and lookup has to be BY HASH, which a per-row
 * salt would make impossible without scanning every row.
 */

const crypto = require('crypto');

/* Lazy, for the same reason as authCodeService: requiring
   ../config/database at module load hard-exits without DB_PASS, which
   would make this file impossible to gate. */
let _pool = null;
function db() {
  if (!_pool) _pool = require('../config/database').bvoPool;
  return _pool;
}

const COOKIE_NAME = 'bvo_device';
const TTL_DAYS    = 90;
const TTL_MS      = TTL_DAYS * 24 * 60 * 60 * 1000;

/** 256 bits, hex. */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Read one cookie without cookie-parser.
 *
 * The app does not mount cookie-parser and this is the only cookie it
 * needs to read, so adding a dependency for one header would be a poor
 * trade. express-session parses its own.
 */
function readCookie(req, name = COOKIE_NAME) {
  const raw = (req && req.headers && req.headers.cookie) || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) {
      return decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  return null;
}

/**
 * Issue a token, store its hash, and set the cookie.
 * @returns {Promise<{ok:boolean, label?:string, error?:string}>}
 */
async function remember(res, customerId, { userAgent, ip } = {}) {
  const id = Number(customerId);
  if (!id) return { ok: false, error: 'no customer' };

  const deviceLabel = require('../utils/deviceLabel');
  const label = deviceLabel(userAgent);
  const token = generateToken();

  try {
    await db().query(
      `INSERT INTO customer_devices
         (customer_id, token_hash, device_label, first_seen_ip,
          last_seen_at, expires_at)
       VALUES (?, ?, ?, ?, NOW(), (NOW() + INTERVAL ? DAY))`,
      [id, hashToken(token), label, ip || null, TTL_DAYS]
    );

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      /* Lax, matching the session cookie. Strict would drop the cookie
         on the return from Stripe, so a buyer coming back from payment
         would look like a new device and be mailed a warning about
         their own purchase. */
      sameSite: 'lax',
      maxAge:   TTL_MS,
      path:     '/',
    });
    return { ok: true, label };
  } catch (err) {
    console.error('[device] remember failed:', err && err.message);
    return { ok: false, error: err && err.message };
  }
}

/**
 * Is the cookie on this request a live grant for this customer?
 *
 * ⚠️ BOUND TO THE CUSTOMER. The caller has an email typed into a form;
 * a cookie belonging to somebody else must NOT sign that email in. The
 * customer_id is part of the WHERE, not checked afterwards.
 *
 * FAILS CLOSED — any error answers false, and the buyer simply gets a
 * code. The opposite of isBlocked(), deliberately: there a false
 * positive locked someone out, here a false positive lets someone IN.
 */
async function recognise(req, customerId) {
  const id = Number(customerId);
  const token = readCookie(req);
  if (!id || !token || !/^[0-9a-f]{64}$/.test(token)) return null;

  try {
    const [[row]] = await db().query(
      `SELECT id, device_label FROM customer_devices
        WHERE token_hash = ? AND customer_id = ?
          AND revoked_at IS NULL AND expires_at > NOW()
        LIMIT 1`,
      [hashToken(token), id]
    );
    if (!row) return null;

    /* Sliding window: a device in regular use should not expire at 90
       days from first sight. Best-effort — a failed touch must not deny
       a valid sign-in. */
    db().query(
      `UPDATE customer_devices
          SET last_seen_at = NOW(), expires_at = (NOW() + INTERVAL ? DAY)
        WHERE id = ?`, [TTL_DAYS, row.id]
    ).catch(() => {});

    return { id: row.id, label: row.device_label };
  } catch (err) {
    console.error('[device] recognise failed (failing closed):', err && err.message);
    return null;
  }
}

/**
 * Revoke every device for a customer. This is half of what "Secure my
 * account" means at BVO — the other half is killing outstanding codes.
 */
async function revokeAll(customerId) {
  const id = Number(customerId);
  if (!id) return { ok: false, count: 0 };
  try {
    const [r] = await db().query(
      `UPDATE customer_devices SET revoked_at = NOW()
        WHERE customer_id = ? AND revoked_at IS NULL`, [id]);
    return { ok: true, count: r.affectedRows || 0 };
  } catch (err) {
    console.error('[device] revokeAll failed:', err && err.message);
    return { ok: false, count: 0 };
  }
}

/** Clear the cookie on this browser. Pairs with revokeAll on sign-out. */
function forget(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

module.exports = {
  remember, recognise, revokeAll, forget, readCookie,
  COOKIE_NAME, TTL_DAYS,
  _generateToken: generateToken,
  _hashToken: hashToken,
};
