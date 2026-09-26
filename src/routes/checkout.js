'use strict';

/* Checkout routes — Stripe, embedded Payment Element.
 *
 * The comments here described a Clover flow until 2026-09-25. Clover was
 * never built; Authorize.net replaced it and was never activated; Stripe
 * replaces that. See docs/briefs/BVO_COMMERCE_STACK_BRIEF.md §1.
 *
 * NOTE: POST /checkout/webhook is NOT mounted here. It lives in
 * server.js, before the body parsers and before CSRF validation, because
 * it needs the raw request body for signature verification and carries no
 * session token. Mounting it in this router would break both. */

const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/checkoutController');

// GET  /checkout           — review page; mounts the Payment Element
router.get ('/',        ctrl.show);

// POST /checkout/session   — AJAX. Writes the order, returns a client_secret.
//                            Named /session rather than / because it creates
//                            a Stripe Checkout Session, not an order in the
//                            old submit-the-form sense — nothing is charged
//                            and the browser does not navigate.
router.post('/session', ctrl.createSession);

// POST /checkout/delivery-type — AJAX. Residential or commercial, written
//                            to our own order row because Stripe has no
//                            field for it. Writes through the order id held
//                            in the server session, never one from the body.
router.post('/delivery-type', ctrl.setDeliveryType);

// GET  /checkout/return    — where Stripe sends the buyer back. Read-only:
//                            decides which page to show. The webhook, not
//                            this, is what advances the order.
router.get ('/return',  ctrl.returnFromStripe);

// GET  /checkout/success   — confirmation
router.get ('/success', ctrl.success);

// GET  /checkout/cancel    — abandoned or failed
router.get ('/cancel',  ctrl.cancel);

module.exports = router;
