'use strict';

/* pathToFilter.js — rewrite a clean path into the query the controller reads.
 *
 *   /collections/bathroom-vanities/style/traditional
 *     -> req.url = /bathroom-vanities?style=Traditional, req.query = {...}
 *     -> router '/:slug' -> collectionsController.show, unmodified
 *
 * The controller, the filter SQL, product_type, colour families, the bundle
 * builder and the importer are all untouched. This runs in front of them and
 * its only output is a mutated req.url and req.query.
 *
 * TWO THINGS THAT MATTER HERE:
 *
 * 1. req.query is set EXPLICITLY. Express 4 parses it once, at app level,
 *    before any router — mutating req.url afterwards does not re-trigger it.
 *    Without this the page renders the UNFILTERED grid: 200 OK, nothing
 *    logged, every product instead of the filtered set.
 *
 * 2. An unresolved path is left completely alone. '/:slug' then answers it
 *    exactly as it does today.
 *
 * To disable: comment out the router.use line in src/routes/collections.js.
 * Every ?param= URL still works — none were removed.
 */

const P = require('../config/pathFilters');

function rewrite(req, slug, params) {
  const qs = new URLSearchParams();
  // Keep whatever was already there (sort, page, a second facet).
  for (const [k, v] of Object.entries(req.query || {})) {
    if (Array.isArray(v)) v.forEach(x => qs.append(k, x));
    else if (v != null) qs.append(k, v);
  }
  for (const [k, v] of Object.entries(params)) qs.set(k, v);

  const search = qs.toString();
  req.url = `/${slug}${search ? '?' + search : ''}`;

  const q = {};
  for (const k of qs.keys()) {
    const all = qs.getAll(k);
    q[k] = all.length > 1 ? all : all[0];
  }
  req.query = q;
}

module.exports = function pathToFilter(req, res, next) {
  // Mounted on /collections, so req.path is '/bathroom-vanities/style/...'
  const p = String(req.path || '').split('/').filter(Boolean);

  try {
    // /vanity-models/<brand>/<model>  — checked first; also 3 segments.
    if (p.length === 3 && p[0] === 'vanity-models') {
      const hit = P.model(p[1], p[2]);
      if (hit) rewrite(req, 'bathroom-vanities', hit);
      return next();
    }
    // /<collection>/<facet>/<value>
    if (p.length === 3) {
      const hit = P.facet(p[0], p[1], p[2]);
      if (hit) rewrite(req, p[0], hit);
      return next();
    }
    // /<collection>/<flag>
    if (p.length === 2) {
      const hit = P.flag(p[0], p[1]);
      if (hit) rewrite(req, p[0], hit);
      return next();
    }
    return next();
  } catch (err) {
    // A translation failure must never take a collection page down.
    console.error('[pathToFilter] %s — %s', req.path, err.message);
    return next();
  }
};
