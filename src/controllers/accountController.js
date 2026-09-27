'use strict';

const Customer         = require('../models/Customer');
const { bvoPool }      = require('../config/database');
const authCode         = require('../services/authCodeService');
const brevo            = require('../services/brevoService');

/* ═══════════════════════════════════════════════════════════════════
   PASSWORDLESS LOGIN — the six-digit code IS the login.

   Spec: docs/briefs/BVO_CHECKOUT_SPEC.md 7.2, amended 2026-09-27. This
   REPLACES the bcrypt password system; it is not a second factor on top
   of one. The password system had no reset route at all, so keeping it
   meant building one. This deletes that requirement instead — the code
   is the reset.
   ═══════════════════════════════════════════════════════════════════ */

/* Client IP, one canonical expression. Mirrors clientIp() in
   checkoutController — behind Hostinger's proxy req.ip is the proxy. */
function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (fwd || req.ip || '').slice(0, 45) || null;
}

/* Every refusal a buyer can actually cause, in plain words. Deliberately
   NOT distinguishing "no account" from "wrong code" anywhere — see the
   service header on enumeration. */
const CODE_ERRORS = {
  invalid_email:     'Enter a valid email address.',
  cooldown:          'We just sent a code. Give it a minute before asking for another.',
  too_many_resends:  'That is as many codes as we can send right now. Wait ten minutes and try again.',
  email_hour_cap:    'Too many codes for this address in the last hour. Try again later.',
  ip_hour_cap:       'Too many sign-in attempts from this connection. Try again later.',
  bad_code:          'That code is not right. Check it and try again.',
  too_many_attempts: 'That code is now dead after too many tries. Ask for a new one.',
  send_failed:       'We could not send the code. Please try again in a moment.',
};

/* Fallback wording, used ONLY if the editable template is missing or
   inactive. An auth email that silently does not send is a login outage,
   so this never depends on a database row existing.

   The code is in the SUBJECT deliberately — a buyer reads it off a lock
   screen and never opens the mail, which is the shortest path back to
   checkout. See spec 8.1. */
function fallbackCodeEmail(code) {
  return {
    subject: `Your BVO code is ${code}`,
    html: `<p>Here is your sign-in code for BathroomVanitiesOutlet.com.</p>
<p style="font-size:30px;font-weight:700;letter-spacing:4px;margin:20px 0">${code}</p>
<p>It works for ten minutes, once. Do not share it or forward this email —
anyone with this code can sign in as you.</p>
<p>If you did not ask to sign in, you can ignore this. Nobody can get in
without the code, and it expires shortly.</p>`,
  };
}

/* ── POST /account/code ── Send a sign-in code ──────────────────── */
/* Behaves IDENTICALLY for a known and an unknown address. The account is
   created on successful verification, not here — so this endpoint has no
   "does that account exist" answer to leak. */
exports.sendCode = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const ip    = clientIp(req);

  const issued = await authCode.issueCode(email, ip, 'login');
  if (!issued.ok) {
    return res.status(429).json({
      ok: false,
      error: CODE_ERRORS[issued.reason] || CODE_ERRORS.send_failed,
      retryAfter: issued.retryAfter || null,
    });
  }

  /* The template is editable in admin; the fallback covers a missing or
     inactive row.

     BOTH RESULTS ARE CHECKED. brevoService NEVER THROWS — it returns
     {skipped:true} with no API key and {ok:false, error} when Brevo
     rejects. An earlier version of this handler checked neither and
     reported success regardless, so the buyer saw "Check your email"
     while nothing had been sent. For a login that is the worst possible
     failure: the one screen where the user cannot tell the difference
     between "wait longer" and "this is broken". */
  let sent;
  try {
    sent = await brevo.sendTemplate('auth_login_code', email, { code: issued.code });
    if (!sent || sent.skipped) {
      const f = fallbackCodeEmail(issued.code);
      sent = await brevo.sendRaw(email, f.subject, f.html);
    }
  } catch (err) {
    /* The code itself is NEVER logged. */
    console.error('[account.sendCode] send threw:', err && err.message);
    return res.status(502).json({ ok: false, error: CODE_ERRORS.send_failed });
  }

  if (!sent || !sent.ok) {
    /* Detail to the server log, generic message to the browser — a Brevo
       error body can carry account and sender information that has no
       business in a response. Same rule as the three AJAX handlers fixed
       earlier for leaking err.message. */
    console.error('[account.sendCode] NOT SENT to', email,
      '— skipped:', !!(sent && sent.skipped),
      '— error:', (sent && sent.error) ? JSON.stringify(sent.error).slice(0, 300) : 'none',
      '— BREVO_API_KEY set:', !!process.env.BREVO_API_KEY);
    return res.status(502).json({ ok: false, error: CODE_ERRORS.send_failed });
  }

  /* Opportunistic housekeeping - no cron to configure and forget. */
  authCode.purgeExpired().catch(() => {});

  return res.json({ ok: true, resendAfter: authCode._limits.RESEND_COOLDOWN_SEC });
};

/* ── POST /account/verify ── The code IS the login ──────────────── */
exports.verifyCode = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code  = String(req.body.code  || '').trim();

    const check = await authCode.verifyCode(email, code, 'login');
    if (!check.ok) {
      return res.status(401).json({
        ok: false,
        error: CODE_ERRORS[check.reason] || CODE_ERRORS.bad_code,
        attemptsLeft: check.attemptsLeft,
      });
    }

    /* Proven address. Sign in or create, one step. */
    const customer = await Customer.findOrCreateByEmail(email);
    if (!customer) return res.status(500).json({ ok: false, error: CODE_ERRORS.send_failed });

    /* Same session-fixation guard the password login used. */
    await new Promise((resolve, reject) =>
      req.session.regenerate(err => err ? reject(err) : resolve())
    );
    req.session.customerId = customer.id;
    req.session.customer   = { id: customer.id, firstName: customer.first_name || '', email };
    await Customer.updateLastLogin(customer.id);

    /* Rejects protocol-relative URLs like //evil.com, which pass a naive
       startsWith('/'). Same guard as the password login. */
    const rt = req.body.return_to;
    const safeReturn = rt && /^\/(?!\/)/.test(rt) ? rt : '/account';

    return res.json({ ok: true, created: customer.created, redirect: safeReturn });
  } catch (err) { next(err); }
};

/* ── GET /account/login ─────────────────────────────────────────── */
exports.loginPage = (req, res) => {
  if (req.session.customerId) return res.redirect('/account');
  res.render('pages/account/login', {
    pageTitle: 'Sign In | BathroomVanitiesOutlet.com',
    metaDesc:  '',
    error: null,
    returnTo: req.session.returnTo || '/account',
  });
};

/* ── POST /account/login ── GONE ────────────────────────────────── */
/* Passwords were removed 2026-09-27 — spec 7.2. The system had no reset
   route, so a forgotten password locked a customer out permanently.
   Keeping passwords meant building reset; passwordless deletes the
   requirement instead.

   The route is kept and answers plainly rather than 404ing, because a
   bookmarked form or a password manager will still POST here. */
exports.login = (req, res) => {
  res.status(410).redirect('/account/login');
};

/* ── /account/register ── FOLDED INTO SIGN-IN ───────────────────── */
/* There is no separate registration any more. Entering an address and
   proving it with a code either signs you in or creates the account —
   one action, spec 7.2. Both routes stay so old links and bookmarks land
   somewhere sensible instead of 404ing. */
exports.registerPage = (req, res) => {
  if (req.session.customerId) return res.redirect('/account');
  res.redirect('/account/login');
};

exports.register = (req, res) => {
  res.status(410).redirect('/account/login');
};

/* ── GET /account ── Dashboard ──────────────────────────────────── */
exports.dashboard = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.session.customerId);
    const orders   = await Customer.getOrders(req.session.customerId, 5);
    res.render('pages/account/dashboard', {
      pageTitle: 'My Account | BathroomVanitiesOutlet.com',
      metaDesc:  '',
      customer,
      orders,
    });
  } catch (err) { next(err); }
};

/* ── GET /account/orders ────────────────────────────────────────── */
exports.orders = async (req, res, next) => {
  try {
    const orders = await Customer.getOrders(req.session.customerId, 50);
    res.render('pages/account/orders', {
      pageTitle: 'My Orders | BathroomVanitiesOutlet.com',
      metaDesc:  '',
      orders,
    });
  } catch (err) { next(err); }
};

/* ── GET /account/favorites ─────────────────────────────────────── */
exports.favoritesPage = async (req, res, next) => {
  try {
    const products = await Customer.getFavoriteProducts(req.session.customerId);
    res.render('pages/account/favorites', {
      pageTitle: 'My Saved Items | BathroomVanitiesOutlet.com',
      metaDesc:  '',
      products,
    });
  } catch (err) { next(err); }
};

/* ── POST /account/favorites/toggle ─────────────────────────────── */
exports.toggleFavorite = async (req, res, next) => {
  try {
    const productId = parseInt(req.body.productId, 10);
    if (!productId) return res.status(400).json({ error: 'Invalid productId' });
    const result = await Customer.toggleFavorite(req.session.customerId, productId);
    res.json(result);
  } catch (err) { next(err); }
};

/* ── POST /account/logout ───────────────────────────────────────── */
exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/'));
};

/* ── POST /account/newsletter ───────────────────────────────────── */
// Accepts { email } JSON from the homepage newsletter form.
// Always returns { ok: true } — never reveals whether an account exists.
exports.newsletter = async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email.' });
    }

    /* Both writes stay non-fatal — this is a public endpoint and we always
       tell the visitor "thanks", never an internal error. But they were
       `.catch(() => {})`: a signup could vanish entirely with no trace, and
       the only symptom would be a marketing list that quietly stops growing.
       Nobody notices an absence. Now failures are logged. */
    await bvoPool.query(
      'UPDATE customers SET accepts_marketing=1 WHERE email=?', [email]
    ).catch(err => {
      console.error('[account] newsletter: accepts_marketing update failed for',
                    email, err.code, err.sqlMessage || err.message);
    });

    // newsletter_signups may not exist yet — INSERT IGNORE plus a logged catch.
    await bvoPool.query(
      `INSERT IGNORE INTO newsletter_signups (email, source, created_at)
       VALUES (?, 'homepage', NOW())`, [email]
    ).catch(err => {
      console.error('[account] newsletter: signup insert failed for',
                    email, err.code, err.sqlMessage || err.message);
      if (err.code === 'ER_NO_SUCH_TABLE') {
        console.error('[account]   newsletter_signups table does not exist — ' +
                      'every signup is being discarded.');
      }
    });

    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // never leak internal errors
  }
};
