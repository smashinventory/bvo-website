'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/accountController');
const { requireAuth } = require('../middleware/auth');

router.get('/login',    controller.loginPage);
router.post('/login',   controller.login);
router.get('/register', controller.registerPage);
router.post('/register',controller.register);
router.post('/logout',  controller.logout);
router.get('/orders',   requireAuth, controller.orders);
router.get('/',         requireAuth, controller.dashboard);

module.exports = router;
