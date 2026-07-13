'use strict';
const express = require('express');
const router  = express.Router();

router.use('/search', require('./search'));

router.get('/', (req, res) => res.json({ status: 'ok', version: '1.0' }));

module.exports = router;
