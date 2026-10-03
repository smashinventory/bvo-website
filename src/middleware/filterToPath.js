'use strict';

/* filterToPath.js — 301 an old ?param= URL to its clean path.
 *
 *   /collections/bathroom-vanities?style=Traditional
 *     -> 301 -> /collections/bathroom-vanities/style/traditional
 *
 *   /collections/bathroom-vanities?model=Bristol&brand=ER%20Vanities
 *     -> 301 -> /collections/vanity-models/er-vanities/bristol
 *
 * MOUNT ORDER MATTERS: this must run BEFORE pathToFilter. pathToFilter turns
 * a clean path into req.query; if this ran after it, it would see that query
 * and redirect back to the path it just came from — an infinite loop.
 * Mounted first in src/routes/collections.js, and it only ever reads the
 * query of the INCOMING request.
 *
 * CONSERVATIVE ON PURPOSE: it redirects only when the query is exactly one
 * recognised facet (or exactly model+brand). A URL carrying anything else —
 * a sort, a page number, two facets — is left alone, because one facet in
 * the path and the rest as parameters is the design, and rewriting a
 * multi-facet URL would change which products it returns.
 */

const P = require('../config/pathFilters');

module.exports = function filterToPath(req, res, next) {
  const q = req.query || {};
  const keys = Object.keys(q);
  if (!keys.length) return next();                 // clean path already

  // req.path here is relative to /collections, e.g. '/bathroom-vanities'
  const parts = String(req.path || '').split('/').filter(Boolean);
  if (parts.length !== 1) return next();           // only the bare collection
  const collection = parts[0];

  const one = k => typeof q[k] === 'string';       // arrays mean multi-select

  try {
    // ?model=X&brand=Y  ->  /collections/vanity-models/<brand>/<model>
    if (keys.length === 2 && one('model') && one('brand')) {
      const p = P.modelPath(q.model, q.brand);
      if (p) return res.redirect(301, p);
      return next();
    }

    if (keys.length === 1 && one(keys[0])) {
      const p = P.pathFor(collection, keys[0], q[keys[0]]);
      if (p) return res.redirect(301, p);
    }
    return next();
  } catch (err) {
    // A redirect failure must never take a collection page down.
    console.error('[filterToPath] %s — %s', req.originalUrl, err.message);
    return next();
  }
};
