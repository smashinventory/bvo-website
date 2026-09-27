'use strict';

/**
 * authCodeService.js — passwordless login. The six-digit code IS the login.
 *
 * Spec: docs/briefs/BVO_CHECKOUT_SPEC.md §7.2 (amended 2026-09-27) and
 * the scope brief's stage 2. This REPLACES the bcrypt password system —
 * it is not a second factor bolted on top of one.
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHY PASSWORDLESS, RECORDED SO IT IS NOT RE-ARGUED
 *
 * The password system that existed had no reset route at all. A customer
 * who forgot their password was locked out permanently. Keeping passwords
 * therefore meant BUILDING a reset flow — token, expiry, single use, its
 * own template — before going live. Passwordless does not satisfy that
 * requirement, it deletes it: the code IS the reset.
 *
 * Email also already has to work. A buyer who cannot receive email has a
 * failed freight delivery regardless, because the carrier appointment,
 * the tracking and the confirmation all travel that way. Making email the
 * identity adds no new failure mode.
 *
 * ──────────────────────────────────────────────────────────────────────
 * THE CODE IS NEVER STORED
 *
 * Only sha256(code + email) is written. A leaked table cannot be used to
 * log in, and hashing WITH the email means a code issued for one address
 * cannot verify another even if the same six digits come up.
 *
 * ──────────────────────────────────────────────────────────────────────
 * NO ENUMERATION, BY DESIGN RATHER THAN BY CAREFUL WORDING
 *
 * issueCode() behaves identically for a known and an unknown address: it
 * sends a code either way. The account is created on successful
 * verification, not before. So there is no "does this email have an
 * account" question for the endpoint to leak — the usual trap of
 * carefully matching response bodies and then leaking through timing
 * simply does not arise.
 *
 * ──────────────────────────────────────────────────────────────────────
 * THE PER-EMAIL CAP IS NOT ABOUT BRUTE FORCE
 *
 * Without it, anyone can type a stranger's address repeatedly and make
 * BVO send that stranger mail. Enough complaints and Brevo's
 * deliverability reputation degrades — the same channel that carries
 * order confirmations and delivery appointments. That is the real damage,
 * and it is why the cap is per ADDRESS as well as per IP.
 */

const crypto = require('crypto');

/* LAZY POOL, DELIBERATELY.
   Requiring ../config/database at module load hard-exits the process when
   DB_PASS is unset, which made this file impossible to import — so the
   pure parts (code generation, hashing, the limit constants) could only
   be exercised on a machine with a live .env. A test that needs a
   database password to check a sha256 is a test that gets skipped. */
let _pool = null;
function db() {
  if (!_pool) _pool = require('../config/database').bvoPool;
  return _pool;
}

/* Straight from the spec. Named rather than inlined so a future reader
   can see the whole policy in one place instead of grepping. */
const CODE_TTL_MINUTES     = 10;
const MAX_ATTEMPTS         = 5;    // wrong guesses before the code dies
const RESEND_COOLDOWN_SEC  = 60;
const MAX_CODES_PER_BURST  = 4;    // 1 initial + 3 resends, within the TTL
const MAX_CODES_EMAIL_HOUR = 5;
const MAX_CODES_IP_HOUR    = 10;

const normEmail = e => String(e || '').trim().toLowerCase();

/** sha256(code + email). Salted with the address so the same six digits
 *  issued to two people produce two different hashes. */
function hashCode(code, email) {
  return crypto.createHash('sha256')
    .update(`${code}:${normEmail(email)}`)
    .digest('hex');
}

/** Six digits, uniformly distributed. crypto.randomInt is rejection-
 *  sampled, so unlike `Math.random() * 900000 | 0` there is no modulo
 *  bias and no shortage of codes beginning with a zero. */
function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/**
 * Issue a code, subject to the rate limits.
 *
 * @returns {Promise<{ok:boolean, code?:string, reason?:string, retryAfter?:number}>}
 *   `code` is returned ONLY so the caller can mail it. It is never
 *   persisted and must never be logged or put in a response body.
 */
async function issueCode(rawEmail, ip, purpose = 'login') {
  const email = normEmail(rawEmail);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, reason: 'invalid_email' };
  }

  /* Cooldown first: it is the limit a legitimate impatient buyer hits,
     and it deserves a specific answer rather than a generic refusal. */
  const [[last]] = await db().query(
    `SELECT created_at, TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age
       FROM customer_auth_codes
      WHERE email = ? ORDER BY id DESC LIMIT 1`,
    [email]
  );
  if (last && last.age < RESEND_COOLDOWN_SEC) {
    return { ok: false, reason: 'cooldown', retryAfter: RESEND_COOLDOWN_SEC - last.age };
  }

  /* Burst: how many codes for this address are still within their TTL.
     One initial plus three resends. */
  const [[burst]] = await db().query(
    `SELECT COUNT(*) AS n FROM customer_auth_codes
      WHERE email = ? AND created_at > (NOW() - INTERVAL ? MINUTE)`,
    [email, CODE_TTL_MINUTES]
  );
  if (burst.n >= MAX_CODES_PER_BURST) return { ok: false, reason: 'too_many_resends' };

  const [[hourEmail]] = await db().query(
    `SELECT COUNT(*) AS n FROM customer_auth_codes
      WHERE email = ? AND created_at > (NOW() - INTERVAL 1 HOUR)`,
    [email]
  );
  if (hourEmail.n >= MAX_CODES_EMAIL_HOUR) return { ok: false, reason: 'email_hour_cap' };

  /* IP cap is separate and deliberately looser: a household, an office or
     a phone on carrier NAT can legitimately produce several sign-ins from
     one address. */
  if (ip) {
    const [[hourIp]] = await db().query(
      `SELECT COUNT(*) AS n FROM customer_auth_codes
        WHERE request_ip = ? AND created_at > (NOW() - INTERVAL 1 HOUR)`,
      [ip]
    );
    if (hourIp.n >= MAX_CODES_IP_HOUR) return { ok: false, reason: 'ip_hour_cap' };
  }

  const code = generateCode();
  await db().query(
    `INSERT INTO customer_auth_codes
       (email, code_hash, purpose, expires_at, request_ip)
     VALUES (?, ?, ?, (NOW() + INTERVAL ? MINUTE), ?)`,
    [email, hashCode(code, email), purpose, CODE_TTL_MINUTES, ip || null]
  );

  return { ok: true, code };
}

/**
 * Verify a code. Single use, and dead after MAX_ATTEMPTS wrong guesses.
 *
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
async function verifyCode(rawEmail, rawCode, purpose = 'login') {
  const email = normEmail(rawEmail);
  const code  = String(rawCode || '').trim();

  /* Shape-check before touching the database. Six digits is the only
     thing this can ever be. */
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'bad_code' };

  const [[row]] = await db().query(
    `SELECT id, code_hash, attempts, expires_at
       FROM customer_auth_codes
      WHERE email = ? AND purpose = ? AND consumed_at IS NULL
        AND expires_at > NOW()
      ORDER BY id DESC LIMIT 1`,
    [email, purpose]
  );

  /* No live code is reported as a bad code, not as "no code". The
     difference would tell an attacker whether an address is mid-login. */
  if (!row) return { ok: false, reason: 'bad_code' };

  if (row.attempts >= MAX_ATTEMPTS) {
    await db().query(
      'UPDATE customer_auth_codes SET consumed_at = NOW() WHERE id = ?', [row.id]);
    return { ok: false, reason: 'too_many_attempts' };
  }

  /* Count the attempt BEFORE comparing. If the comparison threw, or the
     process died mid-request, an uncounted attempt would hand an attacker
     unlimited guesses. */
  await db().query(
    'UPDATE customer_auth_codes SET attempts = attempts + 1 WHERE id = ?', [row.id]);

  const expected = hashCode(code, email);
  /* timingSafeEqual over two equal-length hex digests. Both are 64 chars
     by construction, so the length guard is belt-and-braces. */
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(row.code_hash), 'utf8');
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!match) {
    const left = MAX_ATTEMPTS - (row.attempts + 1);
    return { ok: false, reason: 'bad_code', attemptsLeft: left > 0 ? left : 0 };
  }

  /* Single use. Consumed the moment it works, so a code read over someone's
     shoulder is worthless a second later. */
  await db().query(
    'UPDATE customer_auth_codes SET consumed_at = NOW() WHERE id = ?', [row.id]);

  return { ok: true };
}

/**
 * Housekeeping. Rows are evidence of nothing once spent and expired —
 * they only accumulate email addresses. Called opportunistically rather
 * than on a cron, which is one fewer thing to configure and forget.
 */
async function purgeExpired(olderThanDays = 7) {
  try {
    const [r] = await db().query(
      `DELETE FROM customer_auth_codes
        WHERE created_at < (NOW() - INTERVAL ? DAY)`, [olderThanDays]);
    return r.affectedRows || 0;
  } catch (err) {
    console.error('[authCode] purge failed:', err && err.message);
    return 0;
  }
}

module.exports = {
  issueCode,
  verifyCode,
  purgeExpired,
  /* Exported for the gates, which exercise the pure parts directly rather
     than inferring them from a grep. */
  _hashCode: hashCode,
  _generateCode: generateCode,
  _limits: {
    CODE_TTL_MINUTES, MAX_ATTEMPTS, RESEND_COOLDOWN_SEC,
    MAX_CODES_PER_BURST, MAX_CODES_EMAIL_HOUR, MAX_CODES_IP_HOUR,
  },
};
