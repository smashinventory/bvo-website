'use strict';

/**
 * requireIdentity — nobody reaches checkout anonymously.
 *
 * Spec: BVO_CHECKOUT_SPEC.md 7.1 (guest checkout superseded) and 7.2.
 * Owner, 2026-09-27: "on cart page and they select checkout — if they do
 * not have an account, we take them through a quick account setup or
 * sign in."
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHY THIS IS MIDDLEWARE ON EVERY ROUTE, NOT A CHECK INSIDE show()
 *
 * Checkout is six routes, not one. A guard inside the first page is
 * skipped by anyone who opens /checkout/delivery directly — a bookmark,
 * a back button after a session expires, a link pasted from a previous
 * visit. Each of those lands mid-flow with no identity, and every
 * downstream handler then has to cope with a customerId that might not
 * be there.
 *
 * Applied to the whole router instead, the guarantee is structural: past
 * this point req.session.customerId EXISTS. Handlers stop guarding.
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHY IT REMEMBERS WHERE THEY WERE GOING
 *
 * Bouncing someone from /checkout/delivery to the front of checkout
 * after they sign in loses the page they were on. returnTo is recorded
 * on the session and honoured by POST /account/verify, which already
 * validates it against protocol-relative URLs.
 */

/* Only checkout paths are ever stored, so a poisoned returnTo cannot
   send a freshly-signed-in buyer somewhere unrelated. The verify
   endpoint validates the shape too; this narrows it further. */
const SAFE_RETURN = /^\/checkout(\/[a-z-]*)?$/;

module.exports = function requireIdentity(req, res, next) {
  if (req.session && req.session.customerId) return next();

  /* A POST arriving without identity means the session expired mid
     checkout. Two kinds reach here and they need different answers:

     AJAX (/checkout/session, /checkout/order-details) is waiting on
     JSON. A 302 to an HTML page would be parsed as a failed request
     with no usable message, so it gets an explicit 401 its handler can
     show. Chosen over 403 because the fix IS to authenticate.

     A form POST (/checkout/info, /checkout/delivery) gets the redirect.
     Its body is lost either way — but sending the buyer to a sign-in
     screen and back into checkout is recoverable, where a JSON blob
     rendered in the browser window is not. */
  const wantsJson = req.xhr
    || /json/i.test(String(req.get('accept') || ''))
    || /json/i.test(String(req.get('content-type') || ''));

  if (req.method !== 'GET' && wantsJson) {
    return res.status(401).json({
      ok: false,
      error: 'Your session expired. Please sign in again to finish checking out.',
    });
  }

  if (req.method !== 'GET') {
    req.session.returnTo = '/checkout';
    return res.redirect('/checkout/identify');
  }

  const wanted = String(req.originalUrl || '').split('?')[0];
  req.session.returnTo = SAFE_RETURN.test(wanted) ? wanted : '/checkout';

  return res.redirect('/checkout/identify');
};

module.exports.SAFE_RETURN = SAFE_RETURN;
