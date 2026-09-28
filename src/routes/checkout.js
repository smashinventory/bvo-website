'use strict';

/* Checkout routes — three pages, Stripe on the last one only.
 *
 *   1  GET  /checkout            who you are, where it goes
 *      POST /checkout/info       writes the DRAFT order
 *   2  GET  /checkout/delivery   curbside terms, notes, acknowledgement
 *      POST /checkout/delivery
 *   3  GET  /checkout/payment    Stripe session created here
 *      POST /checkout/session    AJAX; returns the client_secret
 *
 * Why the split: Stripe's Shipping Address Element cannot be pre-filled
 * or satisfied from the API, so BVO has to own the ship-to field — which
 * means collecting it before Stripe exists.
 * See docs/briefs/BVO_CHECKOUT_SPEC.md.
 *
 * NOTE: POST /checkout/webhook is NOT mounted here. It lives in
 * server.js, before the body parsers and before CSRF validation, because
 * it needs the raw request body for signature verification and carries no
 * session token. Mounting it in this router would break both. */

const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/checkoutController');
const orderConfirm = require('../controllers/orderConfirmController');

// ── 0. Identity — OPTIONAL SINCE 2026-09-28 ──────────────────────
//
// requireIdentity USED TO GUARD EVERY ROUTE BELOW. It was removed, and
// it must not come back. Brevo's event log showed a sign-in code
// accepted at 11:59 and delivered at 12:10 — eleven minutes — against a
// code that expired at ten. Gmail defers mail from senders it does not
// recognise, so the delay falls hardest on addresses we have never
// mailed: FIRST-TIME BUYERS. A checkout that cannot start until a
// third-party mail hop completes is a checkout hostage to Gmail.
//
// /identify survives as an OPTIONAL sign-in — a returning buyer who
// wants their saved addresses prefilled can choose to wait for a code.
// Nobody is forced through it. Email is now an ordinary field on page 1,
// and identity is established as a CONSEQUENCE of ordering rather than a
// precondition for it. See src/services/emailVerificationService.js.
router.get ('/identify',  ctrl.identifyPage);

// ── RETURN FROM STRIPE ───────────────────────────────────────────
// Where Stripe sends the buyer back, after the card is authorised.
// Read-only: returnFromStripe decides which page to show, the webhook is
// what actually advances the order, and success reads only the order id
// the server itself put on the session.
router.get ('/return',    ctrl.returnFromStripe);
router.get ('/success',   ctrl.success);
router.get ('/cancel',    ctrl.cancel);

// Backs the poll on the order-received page, so a confirmation that
// arrives while the buyer is still looking flips the panel in place.
// Reads the customer id off the SESSION, never a query parameter — an
// endpoint answering "is <id> verified?" for a caller-supplied id would
// be a free oracle over the customer table.
router.get ('/verify-status', orderConfirm.status);

// ── 1. Your information ──────────────────────────────────────────
router.get ('/',          ctrl.show);
router.post('/info',      ctrl.saveInfo);

// ── 2. Delivery ──────────────────────────────────────────────────
router.get ('/delivery',  ctrl.deliveryPage);
router.post('/delivery',  ctrl.saveDelivery);

// ── 3. Payment ───────────────────────────────────────────────────
router.get ('/payment',   ctrl.paymentPage);

// AJAX. Assigns the order number, flips draft -> pending, creates the
// Stripe Checkout Session. Named /session because that is what it makes;
// nothing is charged and the browser does not navigate.
router.post('/session',   ctrl.createSession);

// The delivery type and phone extension: the two facts Stripe has no
// field for. Writes through the order id held in the server session,
// never one from the body.
router.post('/order-details', ctrl.setOrderDetails);

module.exports = router;
