'use strict';

const express        = require('express');
const router         = express.Router();
const homeController       = require('../controllers/homeController');
const searchPageController = require('../controllers/searchPageController');

router.get('/', homeController.index);

/* /search — where site.js sends the shopper when they press Enter in the
   header search bar rather than clicking a suggestion. This route did not
   exist, so every one of those shoppers got a 404. Mounted here, on the
   root router, because it is a top-level page like the homepage. */
router.get('/search', searchPageController.index);

module.exports = router;
