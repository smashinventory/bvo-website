'use strict';

/* publishFilterQuery.js — READ ONLY. Changes no filtering behavior.
 *
 * WHY THIS EXISTS
 *
 * The filter panel does not navigate by submitting #filter-form. public/js/site.js
 * has four handlers that each do `window.location.search = params`. Assigning to
 * location.search keeps the CURRENT PATH. On a clean-path URL such as
 *
 *     /collections/bathroom-vanities-all/style/farmhouse
 *
 * that is the deselect bug: unchecking Farmhouse writes an empty query but keeps
 * the /style/farmhouse path, pathToFilter re-applies style=Farmhouse, and the
 * filter re-selects itself. The user cannot clear it.
 *
 * The JS needs two facts the browser URL does not carry on a clean path:
 *
 *   1. the base path to navigate to      -> the view already knows it
 *                                           (/collections/<category.slug>, the
 *                                           same value "Clear all" uses)
 *   2. the query the page is ACTUALLY
 *      filtered by                       -> this file
 *
 * Mounted AFTER pathToFilter, so req.url is already rewritten. That makes the
 * published value correct for both URL shapes with no branching:
 *
 *   /bathroom-vanities-all/style/farmhouse  -> 'style=Farmhouse'
 *   /bathroom-vanities-all?size_in=36       -> 'size_in=36'
 *   /bathroom-vanities-all/style/farmhouse?size_in=36
 *                                           -> 'size_in=36&style=Farmhouse'
 *
 * It reads req.url and writes one response local. It does not touch req.query,
 * req.url, the controller, the filter SQL, product_type, color families, the
 * bundle builder or the importer.
 *
 * TO DISABLE: comment out the router.use line in src/routes/collections.js.
 * res.locals.filterQuery goes undefined, site.js falls back to
 * window.location.search, and the behavior is exactly what it was before.
 */

module.exports = function publishFilterQuery(req, res, next) {
  try {
    const u = String(req.url || '');
    const i = u.indexOf('?');
    res.locals.filterQuery = i === -1 ? '' : u.slice(i + 1);
  } catch (err) {
    // Must never take a collection page down. An empty value makes site.js
    // fall back to window.location.search — today's behavior.
    res.locals.filterQuery = '';
  }
  return next();
};
