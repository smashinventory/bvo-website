'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/accountController');
const bundleController = require('../controllers/bundleController');
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

/* "Secure my account" — the link in the new-device email.
   GET on purpose: it is a link in an email, and a link is what someone
   in a panic can use. NO auth middleware, also on purpose — the person
   clicking may be locked out, or may be the owner while an attacker
   holds a live session. The single-use 256-bit token IS the
   authorisation. See the controller for the full reasoning. */
router.get('/secure',             controller.secureAccount);
router.get('/orders',             requireAuth, controller.orders);
router.get('/favorites',          requireAuth, controller.favoritesPage);
router.post('/favorites/toggle',  requireAuth, controller.toggleFavorite);

/* Saved bundles. Handled by bundleController, not accountController, so the
   shape of a bundle — four slots, two carrying quantities — is defined in
   ONE file. Splitting "save" from "list" across two controllers would mean
   a fifth slot had to be added in both, and the omission would be silent. */
router.get('/bundles',              requireAuth, bundleController.savedBundlesPage);
router.post('/bundles/:id/delete',  requireAuth, bundleController.deleteSavedBundle);
router.post('/newsletter',        controller.newsletter);
router.get('/',                   requireAuth, controller.dashboard);

module.exports = router;
