'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/checkoutController');

// GET  /checkout          — order review + email form
router.get('/',         ctrl.show);

// POST /checkout          — create Clover session → redirect to payment page
router.post('/',        ctrl.process);

// GET  /checkout/success  — Clover redirects here after successful payment
router.get('/success',  ctrl.success);

// GET  /checkout/cancel   — Clover redirects here on cancel or failure
router.get('/cancel',   ctrl.cancel);

module.exports = router;
