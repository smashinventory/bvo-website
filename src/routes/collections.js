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
   its previous behavior. See docs/architecture/VANITY_SIDEBAR_FILTERS.md
   section 10. */
/* ORDER MATTERS. filterToPath 301s an old ?param= URL to its clean path and
   must run FIRST — pathToFilter turns a clean path into req.query, so if the
   redirect ran after it, it would see that query and redirect back to the
   path it came from. An infinite loop. */
router.use(require('../middleware/filterToPath'));
router.use(require('../middleware/pathToFilter'));
/* READ ONLY. Publishes res.locals.filterQuery — the query the request is
   actually filtered by — so the filter panel's JS can navigate to the base
   path instead of only rewriting location.search (which keeps the clean path
   and makes a deselected filter re-apply itself). Must run AFTER pathToFilter.
   TO DISABLE: comment out this one line. */
router.use(require('../middleware/publishFilterQuery'));

router.get('/',      controller.index);
router.get('/:slug', controller.show);

module.exports = router;
