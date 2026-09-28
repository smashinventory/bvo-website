'use strict';

/**
 * orderConfirmController.js — the optional "confirm your email" step.
 *
 * Reached from a button in the order confirmation email. Confirms an
 * ADDRESS; grants nothing. See emailVerificationService.js for why this
 * exists and why it is not a gate.
 *
 * ══════════════════════════════════════════════════════════════════════
 * GET LOOKS, POST COMMITS — AND THAT IS THE WHOLE SECURITY MODEL
 *
 * Mail scanners follow links. Brevo's own event log records Gmail
 * "Loaded by proxy" against our messages, which is exactly that class of
 * automated fetch. If GET confirmed on sight, a scanner would mark
 * orders verified with no human ever involved — and the only value this
 * flag has is telling a rep whether a HUMAN reached that mailbox.
 *
 * So the link lands on a page with a button. A machine gets the page; a
 * person gets past it. If you are ever tempted to "simplify" this into a
 * one-click GET, you are deleting the feature.
 *
 * ══════════════════════════════════════════════════════════════════════
 * NO SESSION IS EVER CREATED HERE
 *
 * A 7-day link sitting in a mailbox is a far weaker credential than a
 * 20-minute one-shot code, and order confirmations get forwarded all the
 * time. Anyone forwarded the mail would otherwise land inside the
 * buyer's account. This file must never touch req.session.customerId,
 * and gate_order_email_verification.js fails the build if it does.
 */

const verify = require('../services/emailVerificationService');

/* What the buyer is told. Deliberately vague about WHY a token failed:
   expired, already used and never-existed all read the same. The
   difference is of no use to the buyer and of some use to someone
   probing tokens. */
const BAD_TOKEN =
  'This confirmation link has expired or has already been used. '
  + 'You can confirm your email by signing in with a code instead — '
  + 'your order is not affected either way.';

/* ── GET /orders/confirm?t=… ─────────────────────────────────────── */
exports.page = async (req, res, next) => {
  try {
    const token  = String(req.query.t || '');
    const result = await verify.peek(token);

    if (!result.ok) {
      return res.status(400).render('pages/order-confirm', {
        pageTitle: 'Confirm your email | BathroomVanitiesOutlet.com',
        metaDesc:  '', noindex: true,
        state: 'invalid', message: BAD_TOKEN,
        token: '', orderNumber: '', email: '',
        csrfToken: res.locals.csrfToken,
      });
    }

    /* Already confirmed — by an earlier click, or by a code sign-in
       after the order. Not an error, and must not be shown as one. */
    if (result.already) {
      return res.render('pages/order-confirm', {
        pageTitle: 'Email confirmed | BathroomVanitiesOutlet.com',
        metaDesc:  '', noindex: true,
        state: 'done', message: '',
        token: '', orderNumber: result.order.order_number || '',
        email: result.order.guest_email || '',
        csrfToken: res.locals.csrfToken,
      });
    }

    return res.render('pages/order-confirm', {
      pageTitle: 'Confirm your email | BathroomVanitiesOutlet.com',
      metaDesc:  '', noindex: true,
      state: 'ask', message: '',
      /* Echoed into a hidden field so the POST carries it. Kept out of
         the POST's own query string for the same reason the email link
         is the only place it appears: URLs end up in history and logs. */
      token,
      orderNumber: result.order.order_number || '',
      email:       result.order.guest_email || '',
      csrfToken:   res.locals.csrfToken,
    });
  } catch (err) { next(err); }
};

/* ── POST /orders/confirm ────────────────────────────────────────── */
exports.submit = async (req, res, next) => {
  try {
    const token  = String(req.body.token || '');
    const result = await verify.confirm(token);

    if (!result.ok) {
      return res.status(400).render('pages/order-confirm', {
        pageTitle: 'Confirm your email | BathroomVanitiesOutlet.com',
        metaDesc:  '', noindex: true,
        state: 'invalid', message: BAD_TOKEN,
        token: '', orderNumber: '', email: '',
        csrfToken: res.locals.csrfToken,
      });
    }

    return res.render('pages/order-confirm', {
      pageTitle: 'Email confirmed | BathroomVanitiesOutlet.com',
      metaDesc:  '', noindex: true,
      state: 'done', message: '',
      token: '', orderNumber: result.orderNumber || '', email: '',
      csrfToken: res.locals.csrfToken,
    });
  } catch (err) { next(err); }
};

/* ── GET /checkout/verify-status ─────────────────────────────────── */
/**
 * Backs the poll on the order-received page, so a confirmation that
 * lands while the buyer is still looking flips the panel in place.
 *
 * READS THE SESSION, NEVER A QUERY PARAMETER. An endpoint that answered
 * "is <id> verified?" for any id supplied by the caller would be a free
 * oracle over the customer table. The only customer this can report on
 * is the one whose order this browser just placed.
 *
 * Returns verified:false for anything it cannot answer — an expired
 * session polling for two minutes is not an error worth surfacing.
 */
exports.status = async (req, res) => {
  const id = (req.session && (req.session.orderCustomerId || req.session.customerId)) || null;
  if (!id) return res.json({ verified: false });
  const s = await verify.statusForCustomer(id);
  return res.json({ verified: !!s.verified });
};
