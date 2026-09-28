'use strict';

/**
 * emailDiagnosticsController.js — is the email channel actually alive?
 *
 * Built 2026-09-27 after discovering that NO EMAIL HAD EVER LEFT THIS
 * SITE, and that five plausible theories about why were all wrong. Each
 * one cost a round trip. This asks Brevo directly instead.
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS AT ALL, AND WHY IT SHOULD STAY
 *
 * brevoService NEVER THROWS. It returns {skipped:true} or {ok:false}, and
 * checkoutController deliberately ignores that result — a Brevo outage
 * must never fail an order whose card has already been authorised. That
 * is the right call, and its unavoidable cost is that a dead email
 * channel looks exactly like a healthy one.
 *
 * Nothing else in the system will ever tell you. This page is the only
 * thing that will, so do not delete it as "temporary".
 *
 * ──────────────────────────────────────────────────────────────────────
 * THE CHECKS, AND WHAT EACH ONE RULES OUT
 *
 *   1. Is BREVO_API_KEY present in the environment at all?
 *   2. GET /v3/account — does the key AUTHENTICATE? Sends nothing, costs
 *      nothing. A 401 here ends the investigation immediately.
 *   3. GET /v3/senders — which addresses does Brevo ACTUALLY accept?
 *      Compared against the address the app is configured to send from,
 *      because those being different is invisible from everywhere else.
 *   4. Optional test send, reporting Brevo's UNEDITED error body.
 *
 * Each one eliminates a whole class of cause. Together they cannot leave
 * the question open.
 *
 * ──────────────────────────────────────────────────────────────────────
 * THE KEY IS NEVER DISPLAYED
 *
 * Only its length and last four characters, which is enough to tell "not
 * set" from "set to the wrong thing" or "set with a trailing newline" —
 * the three states that matter — without putting a live credential on a
 * screen that might be shared in a support thread or a screenshot.
 */

const axios = require('axios');

const BREVO_BASE  = 'https://api.brevo.com/v3';
const FROM_EMAIL  = process.env.BREVO_FROM_EMAIL || 'support@bathroomvanitiesoutlet.com';
const FROM_NAME   = process.env.BREVO_FROM_NAME  || 'BVO — Bathroom Vanities Outlet';
const TIMEOUT_MS  = 10000;

/** Never the key itself. Length and last four are enough to distinguish
 *  absent / wrong / whitespace-damaged, which is all we need. */
function keyFingerprint() {
  const k = process.env.BREVO_API_KEY;
  if (!k) return { present: false };
  return {
    present: true,
    length: k.length,
    endsWith: k.slice(-4),
    /* A trailing newline from a copy-paste into a panel field is a real
       and genuinely baffling cause — the key looks right and every
       request 401s. */
    hasWhitespace: k !== k.trim(),
  };
}

async function brevoGet(path) {
  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, reason: 'no_key' };
  try {
    const r = await axios.get(`${BREVO_BASE}${path}`, {
      headers: { 'api-key': key, Accept: 'application/json' },
      timeout: TIMEOUT_MS,
    });
    return { ok: true, status: r.status, data: r.data };
  } catch (err) {
    return {
      ok: false,
      reason: 'http',
      status: err.response?.status || null,
      /* Brevo's own words, unedited. Paraphrasing an API error is how
         five theories happened. */
      body: err.response?.data || err.message,
      /* A DNS or TLS failure has no response at all, and means the
         request never left the server — a completely different problem
         from Brevo refusing it. */
      noResponse: !err.response,
    };
  }
}

/* ── GET /admin/diagnostics/email ───────────────────────────────── */
exports.page = async (req, res, next) => {
  try {
    const key = keyFingerprint();

    /* Both calls are free and send nothing. */
    const account = key.present ? await brevoGet('/account')          : null;
    const senders = key.present ? await brevoGet('/senders')          : null;

    /* The comparison that matters: Brevo refuses any send from an
       address it does not hold as a sender. Nothing else in the system
       ever surfaces a mismatch between this list and FROM_EMAIL. */
    const senderList = (senders && senders.ok && senders.data && Array.isArray(senders.data.senders))
      ? senders.data.senders.map(s => ({
          email:  String(s.email || ''),
          name:   String(s.name  || ''),
          active: s.active !== false,
        }))
      : [];

    const fromMatches = senderList.some(
      s => s.email.toLowerCase() === String(FROM_EMAIL).toLowerCase()
    );

    /* The blocklist. Anyone on it cannot receive a sign-in code, which on
       a passwordless site means they cannot reach their account — and
       nothing else in the admin surfaces it. */
    const brevo = require('../services/brevoService');
    brevo.clearBlocklistCache();          // an admin looking at this wants it fresh
    const blocked = key.present ? await brevo.fetchBlockedContacts() : null;

    res.render('pages/admin/diagnostics-email', {
      pageTitle: 'Email diagnostics',
      key, account, senders, senderList, fromMatches, blocked,
      fromEmail: FROM_EMAIL,
      fromName:  FROM_NAME,
      testResult:    req.session.emailTestResult    || null,
      unblockResult: req.session.emailUnblockResult || null,
      csrfToken: res.locals.csrfToken,
    });
    delete req.session.emailTestResult;
    delete req.session.emailUnblockResult;
  } catch (err) { next(err); }
};

/* ── POST /admin/diagnostics/email/test ─────────────────────────── */
/* A real send to an address the admin types. Reports Brevo's raw
   response either way — success or failure. */
exports.sendTest = async (req, res, next) => {
  try {
    const to = String(req.body.to || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
      req.session.emailTestResult = { ok: false, summary: 'That is not a valid email address.' };
      return res.redirect('/admin/diagnostics/email');
    }

    const key = process.env.BREVO_API_KEY;
    if (!key) {
      req.session.emailTestResult = { ok: false, summary: 'BREVO_API_KEY is not set in the environment.' };
      return res.redirect('/admin/diagnostics/email');
    }

    const stamp = new Date().toISOString();
    try {
      const r = await axios.post(`${BREVO_BASE}/smtp/email`, {
        sender:      { name: FROM_NAME, email: FROM_EMAIL },
        to:          [{ email: to }],
        replyTo:     { name: FROM_NAME, email: process.env.BREVO_REPLY_TO || FROM_EMAIL },
        subject:     `BVO email test — ${stamp}`,
        htmlContent: `<p>This is a test from the BVO admin email diagnostics page.</p>
<p>If you are reading this, the email channel works: the API key authenticates,
the sender is accepted, and Brevo delivered it.</p>
<p>Sent ${stamp} from ${FROM_EMAIL}.</p>`,
        /* Mirrors brevoService: a test that omits the plain-text part is
           a WORSE sample than real mail, so a junk-folder result here
           would over-report the problem. */
        textContent: `This is a test from the BVO admin email diagnostics page.

If you are reading this, the email channel works: the API key authenticates,
the sender is accepted, and Brevo delivered it.

Sent ${stamp} from ${FROM_EMAIL}.`,
        tags:        ['diagnostics_test'],
      }, {
        headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: TIMEOUT_MS,
      });

      req.session.emailTestResult = {
        ok: true,
        summary: `Brevo accepted it (HTTP ${r.status}). Check the inbox — and the spam folder.`,
        messageId: r.data?.messageId || null,
      };
    } catch (err) {
      req.session.emailTestResult = {
        ok: false,
        /* NO RESPONSE means the request never reached Brevo — DNS, TLS,
           blocked egress, a timeout. Utterly different from Brevo
           refusing it, and the distinction is the whole point. */
        summary: err.response
          ? `Brevo refused it — HTTP ${err.response.status}.`
          : 'The request never reached Brevo at all (no response). DNS, TLS, blocked outbound, or a timeout.',
        status: err.response?.status || null,
        body: err.response?.data
          ? JSON.stringify(err.response.data, null, 2)
          : String(err.code || err.message || 'unknown'),
      };
    }

    return res.redirect('/admin/diagnostics/email');
  } catch (err) { next(err); }
};

/* ── POST /admin/diagnostics/email/unblock ──────────────────────── */
/* Removes an address from Brevo's transactional blocklist, which is the
   only way a customer who clicked Unsubscribe on a sign-in code gets
   back into their account. Deliberately one address at a time and
   explicitly clicked: unblocking someone who genuinely asked to stop
   hearing from us is not a bulk operation. */
exports.unblock = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      req.session.emailUnblockResult = { ok: false, summary: 'That is not a valid email address.' };
      return res.redirect('/admin/diagnostics/email');
    }

    const brevo = require('../services/brevoService');
    const r = await brevo.unblockContact(email);

    req.session.emailUnblockResult = r.ok
      ? { ok: true, summary: `${email} removed from the blocklist. They can receive mail and sign in again.` }
      : {
          ok: false,
          /* 404 means Brevo has no such entry — worth saying plainly
             rather than as a raw error, because it usually means someone
             already unblocked them. */
          summary: r.status === 404
            ? `Brevo has no blocklist entry for ${email}. Nothing to remove.`
            : `Brevo refused the unblock${r.status ? ` — HTTP ${r.status}` : ''}.`,
          body: r.error ? JSON.stringify(r.error, null, 2) : null,
        };

    return res.redirect('/admin/diagnostics/email');
  } catch (err) { next(err); }
};
