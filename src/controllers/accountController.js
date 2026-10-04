'use strict';

const Customer         = require('../models/Customer');
const { bvoPool }      = require('../config/database');
const authCode         = require('../services/authCodeService');
const brevo            = require('../services/brevoService');
const device           = require('../services/deviceService');
/* A successful code sign-in IS proof of the mailbox, so it marks the
   address verified — the same fact the post-order confirm link records.
   See emailVerificationService.js. */
const emailVerify      = require('../services/emailVerificationService');

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
/* ONE SOURCE FOR THE LIFETIME, interpolated everywhere it is stated.

   Three screens and one email all tell the buyer how long a code lasts,
   and until 2026-09-28 each carried its own hand-typed "ten minutes".
   Raising the TTL without finding all four would leave the page lying to
   the buyer about the one fact they need. Read from the service so it
   cannot drift; gate_code_ttl_copy.js fails the build if it ever does. */
const CODE_TTL_MINUTES     = authCode._limits.CODE_TTL_MINUTES;
const BURST_WINDOW_MINUTES = authCode._limits.BURST_WINDOW_MINUTES;
exports.CODE_TTL_MINUTES   = CODE_TTL_MINUTES;

const CODE_ERRORS = {
  invalid_email:     'Enter a valid email address.',
  cooldown:          'We just sent a code. Give it a minute before asking for another.',
  /* The BURST window, not the TTL — this refusal is about how often you
     may ask, which is a different clock. They were the same number until
     the two constants were separated; stating the wrong one would send
     the buyer away for twice as long as they need to wait. */
  too_many_resends:  `That is as many codes as we can send right now. Wait ${BURST_WINDOW_MINUTES} minutes and try again.`,
  email_hour_cap:    'Too many codes for this address in the last hour. Try again later.',
  ip_hour_cap:       'Too many sign-in attempts from this connection. Try again later.',
  bad_code:          'That code is not right. Check it and try again.',
  too_many_attempts: 'That code is now dead after too many tries. Ask for a new one.',
  send_failed:       'We could not send the code. Please try again in a moment.',
  /* Not an enumeration leak. Reaching this requires the address to be on
     OUR blocklist, which only happens because that person clicked
     Unsubscribe on mail we sent them or marked it as spam — they already
     know the address exists and is theirs. */
  blocked:           'This email address has unsubscribed from our messages, so we cannot send a sign-in code to it. Call us on the number at the foot of the page and we will restore it, or sign in with a different address.',
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
<p>It works for ${CODE_TTL_MINUTES} minutes, once. Do not share it or forward this email —
anyone with this code can sign in as you.</p>
<p>If you did not ask to sign in, you can ignore this. Nobody can get in
without the code, and it expires shortly.</p>`,
  };
}

/* ── THE ONLY PLACE A CUSTOMER SESSION IS ESTABLISHED ──────────────────
   Extracted 2026-09-28 when the device-recognition path became a SECOND
   caller of session.regenerate(). The first one had already shipped a
   bug: regenerate() destroys everything on the session, and THE CART
   LIVES THERE (server.js ~499), so signing in silently emptied it.

   Duplicating the carry-across logic would have reintroduced that bug in
   the new path, so there is now exactly one function that does this and
   both callers use it. If a third sign-in route ever appears, it uses
   this too.

   customerId is deliberately NOT carried across — establishing it fresh
   on a new session id is the entire point of regenerating (session
   fixation). Only anonymous, non-identifying state survives. */
async function establishSession(req, customer, email) {
  const carried = {
    cart:          req.session.cart,
    checkoutDraft: req.session.checkoutDraft,
    checkoutOld:   req.session.checkoutOld,
  };

  await new Promise((resolve, reject) =>
    req.session.regenerate(err => err ? reject(err) : resolve())
  );

  for (const [k, v] of Object.entries(carried)) {
    if (v !== undefined) req.session[k] = v;
  }

  req.session.customerId = customer.id;
  req.session.customer   = {
    id: customer.id,
    firstName: customer.first_name || '',
    email,
  };
  await Customer.updateLastLogin(customer.id);
}

/* Sign-in from an unrecognised device. Structure captured from Wayfair
   2026-09-27, spec §8.2; wording is BVO's own.

   IN CODE, NOT THE DATABASE — same reason as fallbackCodeEmail above,
   and it matters more here: a SECURITY notification that silently does
   not send because a row is missing is worse than one that is slightly
   out of date. sendTemplate('auth_new_device') is still tried first, so
   an editable row added from the admin wins if it exists.

   Every choice below has a reason, from the capture:
     Title NEUTRAL — "Security alert" reads as a breach and generates
       support calls; most recipients are the legitimate user.
     NO NAME in the greeting, ACCOUNT ADDRESS in the body — so the
       reader can tell WHICH account and spot instantly if it is not
       theirs.
     REASSURANCE BEFORE WARNING, for the same reason.
     DEVICE IS COARSE, no IP and no city — enough to recognise yourself,
       not enough to alarm or to dox.
     ANTI-PHISHING BOX — the strongest element in the original. It
       teaches the reader to check every future mail claiming to be us. */
function newDeviceEmail({ email, deviceLabel, when, secureUrl }) {
  return {
    subject: 'New sign-in to your BVO account',
    html: `<p>Hi,</p>
<p>Your account, <strong>${email}</strong>, was just used to sign in on a new device.</p>
<table style="margin:16px 0;font-size:14px">
<tr><td style="padding:2px 14px 2px 0;color:#666">Time</td><td>${when}</td></tr>
<tr><td style="padding:2px 14px 2px 0;color:#666">Device</td><td>${deviceLabel}</td></tr>
</table>
<p><strong>If this was you, no action is needed.</strong></p>
<p>If it was not, secure your account. That signs out every remembered
device and cancels any sign-in codes we have sent:</p>
<p style="margin:18px 0"><a href="${secureUrl}"
  style="background:#182840;color:#fff;padding:11px 20px;text-decoration:none;border-radius:4px;display:inline-block">Secure my account</a></p>
<p style="font-size:13px;color:#666">That link works for 24 hours.</p>
<div style="margin-top:24px;padding:14px;background:#f7f5f1;border-left:3px solid #b8860b;font-size:13px;line-height:1.6">
<strong>How do you know this email is really from us?</strong><br>
Every link we send starts with <strong>https://www.bathroomvanitiesoutlet.com</strong>.
If a link claiming to be from BVO starts with anything else, it is not from us.
</div>`,
  };
}

/* Formatted for a human, with the offset shown. A bare UTC timestamp in
   a security email is unreadable to the person who has to judge whether
   2am was them. */
function signInTimeLabel(d = new Date()) {
  /* ⚠️ dateStyle/timeStyle CANNOT be combined with component options
     like timeZoneName. Doing so throws `TypeError: Invalid option :
     option` on EVERY call, on every Node build — it is a spec rule, not
     an environment quirk.

     That shipped in cfce433 and broke every code sign-in: the code
     verified, the row was consumed, the secure token was written, and
     THEN this threw — so the buyer was signed in but saw
     "That code is not right." Found 2026-09-28 from the auth-code table,
     which showed consumed_at set on a code the user was told was wrong.

     Component options only, therefore. */
  try {
    return d.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });
  } catch {
    /* Belt and braces. A timestamp in a notification is never worth an
       exception on the sign-in path. */
    return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }
}

/* ── POST /account/code ── Send a sign-in code ──────────────────── */
/* Behaves IDENTICALLY for a known and an unknown address. The account is
   created on successful verification, not here — so this endpoint has no
   "does that account exist" answer to leak. */
exports.sendCode = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const ip    = clientIp(req);

  /* BLOCKLIST CHECK, BEFORE issueCode.
     Brevo puts an Unsubscribe button above every message — including a
     sign-in code — and cannot be told not to on this plan. One click
     blocklists the address against our sender, and Brevo then ACCEPTS
     every later send and quietly delivers nothing. Without this check the
     buyer sits on "Check your email" forever, resends until the hourly
     cap, and has no way to learn why.

     Checked BEFORE the code is issued so a blocked address does not burn
     a rate-limit slot on mail that cannot arrive.

     isBlocked() fails open: if Brevo is unreachable or the answer is
     uncertain it returns false and the normal path runs. A wrong refusal
     here would be worse than the problem it fixes. */
  if (await brevo.isBlocked(email)) {
    console.warn('[account.sendCode] BLOCKED address attempted sign-in:', email);
    return res.status(403).json({ ok: false, error: CODE_ERRORS.blocked });
  }

  /* ── RECOGNISED DEVICE: SKIP THE CODE ENTIRELY (item 26) ──────────
     Owner-approved 2026-09-28. This is what makes the cookie worth
     having: a repeat buyer on their own laptop never waits on an email,
     so a Brevo outage stops blocking purchases.

     ORDER MATTERS. The account is looked up FIRST, then the cookie is
     checked AGAINST THAT customer id. A cookie is bound to one
     customer — presenting it while typing somebody else's address must
     do nothing, and the binding is enforced inside recognise() as part
     of the WHERE, not as an afterthought.

     NO ENUMERATION LEAK. findByEmail returning null is indistinguishable
     from an unrecognised device: both fall through to the normal
     send-a-code path with the identical response. The only way to reach
     the fast path is to already hold a valid cookie for that exact
     account, which means you were already signed in as them. */
  try {
    const known = await Customer.findByEmail(email);
    if (known) {
      const dev = await device.recognise(req, known.id);
      if (dev) {
        await establishSession(req, known, email);

        const rt = req.body.return_to;
        const safeReturn = rt && /^\/(?!\/)/.test(rt) ? rt : '/account';
        console.log('[account.sendCode] device recognised, code skipped for', email);
        return res.json({ ok: true, skipped: true, redirect: safeReturn });
      }
    }
  } catch (err) {
    /* FAILS CLOSED: any error here falls through to the code path. A
       broken lookup must never become a free sign-in. */
    console.error('[account.sendCode] device check failed, sending a code:',
                  err && err.message);
  }

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

    /* Proven address. Sign in or create, one step.

       The source comes from the client, which knows WHY it sent the visitor
       here — the bundle builder redirects with ?message=save-bundle, the
       heart button with ?message=save. It is normalised against a closed
       list, so an unknown or absent value becomes NULL ("unknown" in the
       report) rather than inventing a category. It is only ever written on
       a row that is CREATED here; an existing customer keeps whatever
       acquired them first. */
    const customer = await Customer.findOrCreateByEmail(email, req.body.source);
    if (!customer) return res.status(500).json({ ok: false, error: CODE_ERRORS.send_failed });

    /* ── THIS IS EMAIL VERIFICATION, AND IT ALWAYS WAS ─────────────
       Typing back a code that was mailed to an address proves ownership
       of that mailbox — the exact thing the post-order confirm link
       proves, by a stronger route (20 minutes vs 7 days, one shot, rate
       limited, typed by a human rather than clicked).

       Recording it here means anyone who has ever signed in is verified
       and never sees the confirm prompt, and it is why the flag is
       meaningful from day one rather than filling in slowly as people
       happen to click links.

       Deliberately NOT awaited into the response path's error handling:
       markVerifiedByCode never throws and returns false on failure. A
       sign-in must not fail because a flag would not write. */
    emailVerify.markVerifiedByCode(email)
      .catch(err => console.error('[account.verify] verify flag failed:',
                                  err && err.message));

    /* One helper, both sign-in paths. See establishSession above for
       why regenerate() cannot simply be called inline. */
    await establishSession(req, customer, email);

    /* ── REMEMBER THIS DEVICE (item 26) ────────────────────────────
       Opt-in, unchecked by default. This grants 90 days of signing in
       with no code, so it is a real decision and must not be made for
       the buyer — the opposite of the delivery-SMS box, which is
       pre-checked because it is transactional. */
    let rememberedLabel = null;
    if (req.body.remember_device === true || req.body.remember_device === '1') {
      const r = await device.remember(res, customer.id, {
        userAgent: req.get('user-agent'),
        ip:        clientIp(req),
      });
      rememberedLabel = r.ok ? r.label : null;
    }

    /* ── NEW-DEVICE NOTIFICATION (spec §8.2) ───────────────────────
       Sent when someone signs in with a CODE, which by definition means
       this browser was not recognised. Not sent on the fast path — that
       one required an existing valid cookie, so it is by definition a
       device they already told us to trust.

       NOT sent to a brand-new account: the sign-in that CREATES an
       account cannot be suspicious, and a security warning as the first
       thing a customer ever receives from BVO is alarming and useless.

       Fire-and-forget. A security notification is valuable, but not
       worth failing the sign-in it is reporting. */
    /* ⚠️ THE WHOLE BLOCK IS WRAPPED, not just the mail call.
       The comment above said "fire-and-forget", but only the brevo
       promise actually was — issueSecureToken, newDeviceEmail() and
       signInTimeLabel() all ran synchronously in the critical path, so
       ANY throw took down the sign-in they were reporting on. One did
       (see signInTimeLabel). A security notification must never be able
       to fail the authentication it describes. */
    try {
    if (!customer.created) {
      const secureToken = await authCode.issueSecureToken(email, clientIp(req));
      if (secureToken) {
        const label = require('../utils/deviceLabel')(req.get('user-agent'));
        const secureUrl = `${req.protocol}://${req.get('host')}`
                        + `/account/secure?t=${encodeURIComponent(secureToken)}`;
        const mail = newDeviceEmail({
          email, deviceLabel: label,
          when: signInTimeLabel(), secureUrl,
        });
        brevo.sendTemplate('auth_new_device', email, {
          email, device_label: label,
          signin_time: signInTimeLabel(), secure_url: secureUrl,
        }).then(sent => (!sent || sent.skipped)
          ? brevo.sendRaw(email, mail.subject, mail.html) : null)
          .catch(err => console.error('[account.verify] new-device email failed:',
                                      err && err.message));
      }
    }
    } catch (notifyErr) {
      console.error('[account.verify] new-device notification failed (sign-in unaffected):',
                    notifyErr && notifyErr.message);
    }

    /* Rejects protocol-relative URLs like //evil.com, which pass a naive
       startsWith('/'). Same guard as the password login. */
    const rt = req.body.return_to;
    const safeReturn = rt && /^\/(?!\/)/.test(rt) ? rt : '/account';

    /* ── DO WE STILL NEED A NAME? ─────────────────────────────────
       Asked AFTER verification, never before, and this is a security
       constraint rather than a design preference. Showing a name field
       conditionally on the code screen would mean the page knew whether
       that address already had an account — turning the code endpoint
       into an enumeration oracle, which the comment on findOrCreateByEmail
       exists to prevent. By this line the address is proven and the
       session established, so the question is safe to ask.

       Only when we do not already have one. A returning customer with a
       name is never asked again, including on every future sign-in. */
    const needsName = !String(customer.first_name || '').trim();

    return res.json({ ok: true, created: customer.created,
                      remembered: rememberedLabel, redirect: safeReturn,
                      needsName });
  } catch (err) { next(err); }
};

/* ── POST /account/name ───────────────────────────────────────────────
   Save the name collected straight after a code sign-in.

   requireAuth in the route, and the id comes from the SESSION — never
   from the body. A customer_id in the payload would let anyone rename
   anyone.

   First name is required, last name optional (owner's decision,
   2026-10-04). "Required" is enforced here as well as in the browser:
   client-side validation is a courtesy to the typist, not a control.

   NEVER OVERWRITES A NAME WE ALREADY HAVE. The prompt only appears when
   first_name is blank, but a second tab, a replayed request or a stale
   page could still post. The WHERE clause makes that a no-op instead of
   letting a blank or a typo clobber a good record. */
exports.saveName = async (req, res) => {
  try {
    const first = String(req.body.first_name || '').trim().slice(0, 100);
    const last  = String(req.body.last_name  || '').trim().slice(0, 100);
    if (!first) return res.status(400).json({ ok: false, error: 'Please enter your first name.' });

    await Customer.setNameIfMissing(req.session.customerId, first, last);

    /* Keep the session copy in step, or the dashboard greets them with
       "there" until they next sign in. */
    if (req.session.customer) {
      req.session.customer.first_name = first;
      if (last) req.session.customer.last_name = last;
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('[account.saveName]', err);
    return res.status(500).json({ ok: false, error: 'Could not save that just now.' });
  }
};

/* ── GET /account/secure ── "Secure my account" ──────────────────────
   Spec §8.2 flagged this as needing DESIGN, not assumption, because at
   BVO it does NOT mean "change your password" — there is no password.
   It means, and this is the whole definition:

     1. revoke every remembered device, so no cookie can sign in again
     2. cancel every outstanding sign-in code for that address
     3. destroy the current session on this browser

   The customer is then in a clean state: the only way back in is a
   fresh code to their inbox, which is the one channel we cannot revoke
   for them and the one they are presumed to control.

   NO LOGIN REQUIRED, deliberately. The person clicking may be locked
   out, or may be the legitimate owner while an attacker holds a live
   session. Requiring a sign-in to secure an account under attack is the
   wrong way round. The 256-bit single-use token IS the authorisation.

   GET rather than POST because it is a link in an email, and a link is
   what someone in a panic can actually use. The token is single-use, so
   a prefetching mail client burns it — which fails SAFE: the worst case
   is that a device the owner trusts gets signed out.

   TRADE ACCOUNTS: spec §8.3 says a compromised trade login is a pricing
   leak that points back at BVO's MAP position, so the owner should be
   notified. NOT built here — it needs a decision about who is notified
   and how, and guessing would put an unrequested alert in someone's
   inbox. Recorded as the open item it is. */
exports.secureAccount = async (req, res, next) => {
  try {
    const token = String(req.query.t || '');
    const result = await authCode.consumeSecureToken(token);

    if (!result.ok) {
      return res.status(400).render('pages/account/secured', {
        pageTitle: 'Link expired | BathroomVanitiesOutlet.com',
        metaDesc: '', noindex: true,
        ok: false, devicesRevoked: 0, codesRevoked: 0,
      });
    }

    const customer = await Customer.findByEmail(result.email);
    let devicesRevoked = 0;
    if (customer) {
      const d = await device.revokeAll(customer.id);
      devicesRevoked = d.count;
    }
    const codesRevoked = await authCode.revokeAllCodes(result.email);

    device.forget(res);

    /* Destroy this browser's session too. If the clicker IS the
       attacker, this costs them their session; if it is the owner, they
       sign in again with a code in thirty seconds. */
    await new Promise(resolve => req.session.destroy(() => resolve()));

    console.warn('[account.secure] account secured for', result.email,
                 '- devices:', devicesRevoked, 'codes:', codesRevoked);

    return res.render('pages/account/secured', {
      pageTitle: 'Account secured | BathroomVanitiesOutlet.com',
      metaDesc: '', noindex: true,
      ok: true, devicesRevoked, codesRevoked,
    });
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
    /* Passed, not hard-typed into the template. See CODE_TTL_MINUTES. */
    codeTtlMinutes: CODE_TTL_MINUTES,
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
