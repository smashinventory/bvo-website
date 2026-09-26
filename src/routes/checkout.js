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

// GET /checkout/return — where Stripe sends the buyer back. Read-only:
//                        decides which page to show. The webhook, not
//                        this, is what advances the order.
router.get ('/return',    ctrl.returnFromStripe);
router.get ('/success',   ctrl.success);
router.get ('/cancel',    ctrl.cancel);

module.exports = router;
