'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/collectionsController');

router.get('/',      controller.index);
router.get('/:slug', controller.show);

module.exports = router;
