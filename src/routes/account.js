'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/accountController');
const { requireAuth } = require('../middleware/auth');

router.get('/login',              controller.loginPage);
router.post('/login',             controller.login);
router.get('/register',           controller.registerPage);
router.post('/register',          controller.register);
router.post('/logout',            controller.logout);

/* Passwordless sign-in. The six-digit code IS the login - spec 7.2.
   Both sit under the existing authLimiter mounted in server.js for
   /account/login and /account/register; see the note there. */
router.post('/code',              controller.sendCode);
router.post('/verify',            controller.verifyCode);
router.get('/orders',             requireAuth, controller.orders);
router.get('/favorites',          requireAuth, controller.favoritesPage);
router.post('/favorites/toggle',  requireAuth, controller.toggleFavorite);
router.post('/newsletter',        controller.newsletter);
router.get('/',                   requireAuth, controller.dashboard);

module.exports = router;
