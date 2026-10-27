'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * unsubscribeToken.js — a signed, stateless unsubscribe link.
 *
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────
 * There is no first-party unsubscribe anywhere in this codebase. The
 * mechanism recorded as "LIVE" (#374) is entirely server-side at Brevo:
 * their List-Unsubscribe header and their account-wide blocklist.
 *
 * ⚠️ BREVO'S BLOCKLIST IS NOT A SUBSTITUTE, AND THE DIFFERENCE IS THE
 * WHOLE POINT. A Brevo block stops EVERY message to that address,
 * including the six-digit sign-in code. On a passwordless site that
 * locks the person out of their own account — see #376, which is open
 * for exactly this reason. This token flips ONE flag,
 * customers.accepts_marketing, and leaves transactional mail alone.
 *
 * ── STATELESS, BY DESIGN ───────────────────────────────────────────────
 * The token is an HMAC of the email address. Nothing is stored, so there
 * is no token table to migrate, no expiry sweep, and no way for a link in
 * a year-old email to stop working — which matters, because an
 * unsubscribe link that has expired is an unsubscribe link that does not
 * work, and that is the complaint that costs a sending reputation.
 *
 * ── KEY SEPARATION ─────────────────────────────────────────────────────
 * ⚠️ SESSION_SECRET IS NOT USED DIRECTLY. It is run through HMAC with a
 * fixed purpose string first, so the key that signs unsubscribe links is
 * not the same bytes that sign session cookies. Using one secret for two
 * purposes means a weakness found in either reaches both; deriving costs
 * one hash and removes that coupling. No new environment variable, which
 * matters here because env values are set by hand in the Hostinger panel.
 *
 * ── NO DATABASE ────────────────────────────────────────────────────────
 * Nothing in this file opens a connection, so a gate can RUN these
 * functions rather than re-describe them. A gate that re-implements its
 * subject agrees with the bug.
 * ───────────────────────────────────────────────────────────────────────── */

const crypto = require('crypto');

const PURPOSE = 'bvo-unsubscribe-v1';

/* Derived once per process. Throws loudly at require time if the secret is
   missing — a silently unsigned token would verify nothing while looking
   like it worked, which is the worst of both. */
function key() {
  const base = process.env.SESSION_SECRET;
  if (!base) throw new Error('SESSION_SECRET is not set — cannot sign unsubscribe links');
  return crypto.createHmac('sha256', base).update(PURPOSE).digest();
}

/* Email addresses are compared case-insensitively here. The local part is
   technically case-sensitive per RFC 5321, but no mail provider in
   practice treats it so, and a token that fails because somebody's client
   capitalised the address is an unsubscribe that does not work. */
function normalise(email) {
  return String(email || '').trim().toLowerCase();
}

function sign(email) {
  const e = normalise(email);
  if (!e) return null;
  const mac = crypto.createHmac('sha256', key()).update(e).digest('base64url').slice(0, 32);
  return `${Buffer.from(e, 'utf8').toString('base64url')}.${mac}`;
}

/**
 * The email this token is for, or null.
 *
 * ⚠️ timingSafeEqual, NOT ===. String comparison short-circuits on the
 * first differing byte, so the time it takes leaks how much of a guess was
 * correct and a token can be recovered byte by byte. The lengths are
 * compared first because timingSafeEqual throws on a length mismatch.
 */
function verify(token) {
  const raw = String(token || '');
  const dot = raw.lastIndexOf('.');
  if (dot < 1) return null;

  let email;
  try {
    email = Buffer.from(raw.slice(0, dot), 'base64url').toString('utf8');
  } catch { return null; }

  const e = normalise(email);
  if (!e || !e.includes('@')) return null;

  const given    = Buffer.from(raw.slice(dot + 1), 'utf8');
  const expected = Buffer.from(
    crypto.createHmac('sha256', key()).update(e).digest('base64url').slice(0, 32), 'utf8');

  if (given.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(given, expected)) return null;
  return e;
}

/** The full link to put in an email footer. */
function url(email, base = 'https://www.bathroomvanitiesoutlet.com') {
  const t = sign(email);
  return t ? `${base}/unsubscribe?t=${encodeURIComponent(t)}` : null;
}

module.exports = { sign, verify, url, normalise, PURPOSE };
