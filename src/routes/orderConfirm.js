'use strict';

/* Confirm-your-email, reached from a button in the order confirmation
 * email. Public and identity-free by design: the token IS the proof, and
 * the person clicking it has, by definition, not signed in.
 *
 * TWO ROUTES, NOT ONE, AND THAT IS DELIBERATE.
 * GET renders a page with a button; POST commits. Mail scanners follow
 * links — Gmail's "Loaded by proxy" appears against our own messages in
 * Brevo's event log — so a GET that confirmed on sight would let a
 * machine mark orders verified with no human involved, which is the only
 * thing this flag is for. Do not collapse these into one handler.
 *
 * No rate limiter: the token is 256 bits and looked up by hash, so there
 * is nothing here to guess at a useful rate, and a limiter would risk
 * locking out a real buyer clicking twice.
 */

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/orderConfirmController');

router.get ('/confirm', ctrl.page);
router.post('/confirm', ctrl.submit);

module.exports = router;
