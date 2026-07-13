'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/cartController');

router.get('/',        controller.index);
router.post('/add',    controller.add);
router.post('/update', controller.update);
router.post('/remove', controller.remove);

module.exports = router;
