'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/bundleController');

router.get('/', controller.getBundleBuilder);

module.exports = router;
