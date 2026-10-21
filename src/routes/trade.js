'use strict';

/* Public trade-application routes. Mounted at /trade by server.js.
   Admin review lives under /admin/trade — see src/routes/admin.js, which
   applies requireAdmin to everything below its line 35. */

const express = require('express');
const router  = express.Router();
const trade   = require('../controllers/tradeController');

router.get('/apply', trade.applyPage);

/* ⚠️ uploadMiddleware BEFORE the handler, and multer errors are caught
   here rather than reaching the generic handler. A rejected file type or
   an oversized upload is a user mistake, not a 500 — and the generic
   handler would leak multer's message to the page. */
router.post('/apply',
  (req, res, next) => trade.uploadMiddleware(req, res, (err) => {
    if (!err) return next();
    req.session.flash = {
      type: 'error',
      msg: /File too large/i.test(err.message)
        ? 'That file is over 10MB. Please upload a smaller photo or PDF.'
        : (err.message || 'That file could not be accepted.'),
    };
    return res.redirect('/trade/apply');
  }),
  trade.submit);

module.exports = router;
