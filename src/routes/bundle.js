'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/bundleController');

router.get('/', controller.getBundleBuilder);

/* Save Your Bundle. NO requireAuth on purpose: that middleware REDIRECTS to
   the login page, and this is reached by fetch() — the redirect would be
   followed silently and the browser would try to JSON.parse a login page.
   The handler returns 401 instead, and the client sends the visitor to sign
   in with a next= back here. */
router.post('/save', controller.saveBundle);

module.exports = router;
