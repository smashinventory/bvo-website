'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * unsubscribeController.js — the first-party unsubscribe.
 *
 * ⚠️ THIS TURNS OFF MARKETING ONLY. It writes customers.accepts_marketing
 * and nothing else. It does NOT touch Brevo's account-wide blocklist,
 * because that blocklist stops EVERY message to an address including the
 * six-digit sign-in code — on a passwordless site that locks somebody out
 * of their own account. That is #376, still open. A person who no longer
 * wants offers must keep being able to sign in and to receive the receipt
 * for an order they placed.
 *
 * ── GET SHOWS, POST ACTS, AND THAT IS NOT PEDANTRY ─────────────────────
 * Mail clients and security gateways PREFETCH links to scan them. A GET
 * that unsubscribed on sight would silently revoke consent for anybody
 * whose employer runs a link scanner, and we would never know: the
 * customer stops hearing from us and nobody complains, because nobody
 * noticed. So GET renders a page with one button and POST does the work.
 *
 * RFC 8058 one-click (the "Unsubscribe" button in Gmail's header) also
 * POSTs, so it lands on the same handler and works without the page.
 * ───────────────────────────────────────────────────────────────────────── */

const { bvoPool } = require('../config/database');
const token = require('../utils/unsubscribeToken');

/* Behind Hostinger's proxy, req.ip is the proxy unless trust proxy is set.
   Recorded as evidence of WHERE the preference was expressed, so a wrong
   value is misleading rather than harmless. */
function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.ip || null;
}

/* ── GET /unsubscribe?t=… ──────────────────────────────────────────── */
exports.page = (req, res, next) => {
  const email = token.verify(req.query.t);
  /* A bad or missing token is a 404, not an error page explaining that
     the token was invalid. The link either works or the page does not
     exist; saying "invalid token" invites somebody to start guessing. */
  if (!email) return next();

  return res.render('pages/unsubscribe', {
    pageTitle: 'Unsubscribe | BathroomVanitiesOutlet.com',
    metaDesc:  '',
    noindex:   true,
    email,
    t:         String(req.query.t || ''),
    done:      false,
  });
};

/* ── POST /unsubscribe ─────────────────────────────────────────────── */
exports.submit = async (req, res, next) => {
  /* Token from the body (our form) or the query (RFC 8058 one-click, which
     POSTs to the List-Unsubscribe URL with its query string intact). */
  const raw   = req.body?.t || req.query?.t;
  const email = token.verify(raw);
  if (!email) return next();

  try {
    /* ⚠️ NO ROW IS CREATED IF THE ADDRESS IS UNKNOWN, AND THE PAGE STILL
       SAYS IT WORKED. Reporting "we have no record of you" would turn
       this into an address-existence oracle: anybody could test whether
       a given person shops here. An unknown address has no marketing to
       receive, so saying "done" is both safe and true. */
    await bvoPool.query(
      `UPDATE customers
          SET accepts_marketing        = 0,
              marketing_consent_at     = NOW(),
              marketing_consent_source = 'unsubscribe_link',
              marketing_consent_ip     = ?
        WHERE email = ?`,
      [clientIp(req), email]
    );

    /* The timestamp is set even though the flag is 0, on purpose. The
       pair is what distinguishes "asked and declined" from "never
       asked" — see the note in checkoutController. An unsubscribe that
       left consent_at NULL would read, later, as somebody who was never
       asked, and could be asked again. */

    return res.render('pages/unsubscribe', {
      pageTitle: 'Unsubscribed | BathroomVanitiesOutlet.com',
      metaDesc:  '',
      noindex:   true,
      email,
      t:         '',
      done:      true,
    });
  } catch (err) {
    /* ⚠️ DOES NOT SWALLOW. An unsubscribe that silently fails is the
       worst outcome available: the customer is told they are off the
       list, we keep mailing them, and the next step is a spam report.
       Loud, logged, and the person sees an honest error with a human to
       contact. */
    console.error('[unsubscribe]', err.code, err.sqlMessage || err.message);
    return next(err);
  }
};
