'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   pathToFilter.js — translate a clean path into the query the controller
   already reads. Then get out of the way.

   /collections/bathroom-vanities/style/traditional
       ↓  (internally, invisibly)
   /collections/bathroom-vanities?style=Traditional
       ↓
   collectionsController.show, completely unmodified

   ── THE DESIGN CONSTRAINT THIS EXISTS TO HONOUR ────────────────────────
   Sam's instruction, 2026-10-03: get the dynamic parameters out of the
   URLs, and do not touch anything to do with filtering or product data.

   Those two look contradictory — a clean URL has to end up applying a
   filter. They are reconciled by putting the translation ENTIRELY in front
   of the existing code. This middleware's only output is a mutated
   req.url and req.query. Downstream, collectionsController receives the
   exact same query object it receives today from a `?style=` URL and
   cannot tell the difference.

   What is therefore NOT changed, and must never be changed from here:
     · how any filter is applied                  (collectionsController)
     · what a product_type is or which products carry it
     · category or collection assignment
     · colour family definitions                  (config/colorFamilies)
     · the bundle builder, the importer, the EAV attribute tables

   gates/gate_path_filters.js asserts this boundary by diffing
   collectionsController.js against its committed hash. If the filter code
   changes, the gate goes red, whatever the reason.

   ── WHY A URL REWRITE AND NOT A NEW CONTROLLER ─────────────────────────
   A second controller would be a second copy of the filter logic, which is
   exactly the Rule 10 violation that causes drift. One code path, reached
   two ways.

   ── WHY req.query IS ASSIGNED EXPLICITLY ───────────────────────────────
   Express 4 parses req.query ONCE, in the query middleware at app level,
   before any router runs. Mutating req.url afterwards does not re-trigger
   it — req.query would still hold the query of the original request, which
   for a clean path is empty. So the filter would silently not apply and
   the page would render the unfiltered grid: a working-looking page with
   the wrong products on it, and nothing in the logs.

   Both are set. The gate asserts both.

   ── UNKNOWN SLUGS FALL THROUGH, THEY DO NOT 404 HERE ───────────────────
   If a path does not resolve, this middleware does nothing and calls
   next(). /collections/:slug then handles it exactly as it does today —
   which for a nonsense slug is the existing 404 path. Deciding to 404 here
   would be this file taking a routing decision that belongs to the router.
   ═══════════════════════════════════════════════════════════════════════ */

const pathFilters = require('../config/pathFilters');
const modelSlug   = require('../utils/modelSlug');

/* Model pages need the (model, brand) pairs to resolve a slug, and the
   committed snapshot is the store. Loaded once, lazily, and a missing or
   malformed file is survivable: model paths simply do not resolve and fall
   through to the existing router. A missing config must never 500 the
   storefront. */
let _modelIndex = null;
let _modelIndexTried = false;
function modelIndex() {
  if (_modelIndexTried) return _modelIndex;
  _modelIndexTried = true;
  try {
    const snap = require('../config/modelSlugs.json');
    const { index, collisions } = modelSlug.buildIndex(snap.pairs || []);
    if (collisions.length) {
      /* Reported, not thrown. A collision is a build-time error that
         gate_model_slugs catches; at request time the safe behaviour is to
         serve the pages that are unambiguous. */
      console.error('[pathToFilter] %d model slug collision(s): %s',
        collisions.length, collisions.map(c => c.slug).join(', '));
    }
    _modelIndex = index;
  } catch (err) {
    console.warn('[pathToFilter] no usable src/config/modelSlugs.json (%s) — '
               + 'model paths will fall through to the existing router',
                 err.code || err.message);
    _modelIndex = null;
  }
  return _modelIndex;
}

/** Rewrite req so the existing router sees `?param=value` on `/collections/<slug>`. */
function rewrite(req, slug, params) {
  const qs = new URLSearchParams();
  /* Anything the visitor already had in the query string is preserved and
     wins over nothing — a path carries one facet, and extra facets stay as
     parameters by design (one facet deep; see pathFilters.js). Sort order,
     pagination and the like ride along untouched. */
  for (const [k, v] of Object.entries(req.query || {})) {
    if (Array.isArray(v)) v.forEach(x => qs.append(k, x));
    else if (v !== undefined && v !== null) qs.append(k, v);
  }
  for (const [k, v] of Object.entries(params)) qs.set(k, v);

  const search = qs.toString();
  req.url = `/${slug}${search ? '?' + search : ''}`;

  /* Express 4 memoises req.query before the router runs, so it is set here
     explicitly. Without this the filter silently does not apply. */
  const merged = {};
  for (const k of qs.keys()) {
    const all = qs.getAll(k);
    merged[k] = all.length > 1 ? all : all[0];
  }
  req.query = merged;

  /* Breadcrumb for anything that wants to know this was a clean path —
     nothing reads it today, and it keeps the decision debuggable. */
  req.pathFilter = { slug, params };
}

module.exports = function pathToFilter(req, res, next) {
  /* Mounted on the /collections router, so req.path is already relative:
     '/bathroom-vanities/style/traditional'. */
  const parts = String(req.path || '').split('/').filter(Boolean);

  try {
    /* ── /collections/vanity-models/<brand-slug>/<model-slug> ─────────
       Brand first, two segments, because that is how the catalogue is
       already segregated — Sam 2026-10-03: "we currently segregate them by
       having Brand/model."

       CHECKED BEFORE THE FACET BRANCH. Both are three segments, so whichever
       runs first wins. 'vanity-models' is not a facet name and could not
       resolve as one, but relying on that would make the ordering an
       accident rather than a decision. */
    if (parts.length === 3 && parts[0] === 'vanity-models') {
      const idx = modelIndex();
      if (idx) {
        const pair = modelSlug.resolve(modelSlug.indexKey(parts[1], parts[2]), idx);
        if (pair) {
          rewrite(req, 'bathroom-vanities', { model: pair.model, brand: pair.brand });
          return next();
        }
      }
      return next();
    }

    /* ── /collections/<collection>/<facet>/<value> ─────────────────── */
    if (parts.length === 3) {
      const hit = pathFilters.resolveFacet(parts[0], parts[1], parts[2]);
      if (hit) {
        rewrite(req, parts[0], { [hit.param]: hit.value });
        return next();
      }
      return next();
    }

    /* ── /collections/<collection>/<flag> ──────────────────────────────
       Two segments and not vanity-models: a flag such as on-sale. Checked
       AFTER the model branch so a flag slug cannot shadow a model. */
    if (parts.length === 2) {
      const hit = pathFilters.resolveFlag(parts[0], parts[1]);
      if (hit) {
        rewrite(req, parts[0], { [hit.param]: hit.value });
        return next();
      }
      return next();
    }

    return next();
  } catch (err) {
    /* A translation failure must never take a collection page down. Fall
       through and let the existing router answer, which is the behaviour
       before this file existed. */
    console.error('[pathToFilter] %s — falling through: %s', req.path, err.message);
    return next();
  }
};
