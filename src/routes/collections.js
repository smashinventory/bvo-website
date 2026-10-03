'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/collectionsController');

/* ── Clean-path filters ────────────────────────────────────────────────
   Translates /collections/bathroom-vanities/style/traditional into
   /collections/bathroom-vanities?style=Traditional, internally, BEFORE the
   routes below match. The controller is unmodified and receives the same
   query object it gets from a ?style= URL today.

   Mounted as middleware rather than as its own route on purpose: a second
   route would mean a second copy of the filter logic, and one code path
   reached two ways cannot drift from itself.

   A path that does not resolve is left alone and falls through to
   '/:slug' below, which answers it exactly as it does today.

   TO DISABLE THE WHOLE FEATURE: comment out this one line. Clean paths
   stop resolving, every ?param= URL keeps working, and the site is back to
   its previous behaviour. See docs/architecture/PATH_FILTERS_ROLLBACK.md. */
router.use(require('../middleware/pathToFilter'));

router.get('/',      controller.index);
router.get('/:slug', controller.show);

module.exports = router;
