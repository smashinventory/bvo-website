'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   pathFilters.js — slug ⇄ filter value. DATA ONLY, NO LOGIC.

   WHAT THIS IS FOR
   Turning this:
       /collections/bathroom-vanities?style=Traditional
   into this:
       /collections/bathroom-vanities/style/traditional

   Seobility flags every internal URL carrying a query string ("dynamic
   parameters"). 43 of the site's internal links carry one. The only real
   fix is for the URL to stop having a `?` in it — masking with nofollow or
   JavaScript links silences the warning by cutting the page off from the
   equity that would let it rank.

   ── WHAT THIS FILE DOES NOT DO, AND MUST NEVER DO ──────────────────────
   It does not filter anything. It does not decide what a product is, what
   category or collection it belongs to, which product_type it carries, or
   which colour family it falls into. It is a lookup table between a URL
   segment and the EXACT string the existing controller already expects in
   req.query.

   The filtering stays entirely in collectionsController.js and is not
   touched. src/middleware/pathToFilter.js rewrites the URL into the query
   string the controller reads today, and the controller cannot tell the
   difference. That boundary is the whole design, and
   gates/gate_path_filters.js asserts it.

   ── THE VALUES ARE COPIED, NOT INVENTED ────────────────────────────────
   Every `value` below is the literal string the controller parses and the
   filter SQL matches on. Read out of the live code and the live database on
   2026-10-03, not typed from memory:

     style         src/config/filterLandingPages.js GROUPS.style.values
     color_family  src/config/colorFamilies.js FAMILIES (type 'cabinet')
     size_in       src/config/filterLandingPages.js GROUPS.size_in.values
     type          src/services/themeSettings.js nav type links + products
     product_type  src/services/themeSettings.js faucets link
     brand         products.brand, VERBATIM — see the warning below

   A wrong value here fails SILENTLY: the page renders with no filter
   applied, looking like a working page with the wrong products on it. The
   gate cross-checks every value against the config files above, so a drift
   in either direction goes red.

   ── ⚠ BRAND IS NOT IMPLEMENTED HERE YET, DELIBERATELY ──────────────────
   themeSettings.js stores brand links as `?brand=james-martin`, while the
   live crawl shows `?brand=James%20Martin%20Vanities`. Those are different
   strings and `products.brand` holds the second. Some stored brand links
   may therefore already be returning unfiltered pages.

   That is a pre-existing bug with its own entry on the open-items list, and
   converting a broken URL to a path would hide it behind a redirect. BRAND
   IS LEFT AS A PARAMETER until that mismatch is checked against the live
   database. Flagged to Sam 2026-10-03; validation agreed as a follow-up.
   ═══════════════════════════════════════════════════════════════════════ */

/* Each facet: the query parameter the controller reads, and the slug→value
   pairs. `collections` lists which collection slugs the facet is valid on —
   a size filter on /collections/faucets is not a page, and the middleware
   refuses rather than rendering an empty grid. */
const FACETS = {

  /* ── style ───────────────────────────────────────────────────────────
     "european-old-world" rather than "european-%2F-old-world": the value
     contains a slash, which cannot survive in a path segment. That is the
     whole reason a slug table exists instead of slugifying at runtime. */
  style: {
    param: 'style',
    collections: ['bathroom-vanities', 'bathroom-vanities-with-tops', 'bathroom-vanity-cabinets'],
    values: {
      'traditional':         'Traditional',
      'transitional':        'Transitional',
      'modern':              'Modern',
      'farmhouse':           'Farmhouse',
      'mid-century-modern':  'Mid-Century Modern',
      'industrial':          'Industrial',
      'coastal':             'Coastal',
      'scandinavian':        'Scandinavian',
      'european-old-world':  'European / Old World',
    },
  },

  /* ── finish / colour family ──────────────────────────────────────────
     The slug is the human word; the value is the internal key. "dark-wood"
     reads better than "wood-d" and `wood_d` is what the column holds.
     Never the other way round: the key is an implementation detail and the
     URL is public. */
  finish: {
    param: 'color_family',
    collections: ['bathroom-vanities', 'bathroom-vanities-with-tops', 'bathroom-vanity-cabinets'],
    values: {
      'white':       'white',
      'cream':       'cream',
      'gray':        'gray',
      'black':       'black',
      'blue':        'blue',
      'green':       'green',
      'light-wood':  'wood_l',
      'med-wood':    'wood_m',
      'dark-wood':   'wood_d',
    },
  },

  /* ── size ────────────────────────────────────────────────────────────
     '20-' and '84+' carry characters that are legal in a path but read
     badly and encode inconsistently across tools. Spelled out instead. */
  size: {
    param: 'size_in',
    collections: ['bathroom-vanities', 'bathroom-vanities-with-tops', 'bathroom-vanity-cabinets'],
    values: {
      '20-inch-and-under': '20-',
      '25-inch':           '25',
      '30-inch':           '30',
      '36-inch':           '36',
      '42-inch':           '42',
      '48-inch':           '48',
      '60-inch':           '60',
      '72-inch':           '72',
      '84-inch-and-over':  '84+',
    },
  },

  /* ── sink configuration ──────────────────────────────────────────────
     Valid only on the with-tops collection, which is where the megamenu
     links point. */
  'sink': {
    param: 'type',
    collections: ['bathroom-vanities-with-tops'],
    values: {
      'single': 'Single Sink Vanity With Top',
      'double': 'Double Sink Vanity With Top',
    },
  },

  /* ── product type, faucets only ──────────────────────────────────────
     One stored Theme Editor link uses this. Kept narrow on purpose: the
     general product_type space is the internal taxonomy and does not belong
     in public URLs. */
  'product-type': {
    param: 'product_type',
    collections: ['faucets'],
    values: {
      'bathroom-faucets': 'Bathroom Faucets',
    },
  },
};

/* on_sale is a flag, not a value, so it gets its own single-segment form:
   /collections/bathroom-vanities/on-sale  ->  ?on_sale=1 */
const FLAGS = {
  'on-sale': {
    param: 'on_sale',
    value: '1',
    collections: ['bathroom-vanities', 'bathroom-vanities-with-tops',
                  'bathroom-vanity-cabinets', 'faucets'],
  },
};

/* ── lookups. Pure, no I/O, no DB. ─────────────────────────────────── */

/** Resolve a path pair to { param, value } or null. Never throws. */
function resolveFacet(collectionSlug, facetSlug, valueSlug) {
  const f = FACETS[String(facetSlug || '').toLowerCase()];
  if (!f) return null;
  if (!f.collections.includes(String(collectionSlug || '').toLowerCase())) return null;
  const value = f.values[String(valueSlug || '').toLowerCase()];
  if (value === undefined) return null;
  return { param: f.param, value };
}

/** Resolve a single-segment flag to { param, value } or null. */
function resolveFlag(collectionSlug, flagSlug) {
  const f = FLAGS[String(flagSlug || '').toLowerCase()];
  if (!f) return null;
  if (!f.collections.includes(String(collectionSlug || '').toLowerCase())) return null;
  return { param: f.param, value: f.value };
}

/** The canonical path for a facet value, for link emitters. null if unknown. */
function facetPath(collectionSlug, facetSlug, valueSlug) {
  return resolveFacet(collectionSlug, facetSlug, valueSlug)
    ? `/collections/${collectionSlug}/${facetSlug}/${valueSlug}`
    : null;
}

/** Reverse: given a param and its value, the slug pair that produces it.
    Used by the 301 so the old parameter URL can find its new home. */
function slugFor(param, value) {
  for (const [facetSlug, f] of Object.entries(FACETS)) {
    if (f.param !== param) continue;
    for (const [valueSlug, v] of Object.entries(f.values)) {
      if (v === value) return { facetSlug, valueSlug, collections: f.collections };
    }
  }
  for (const [flagSlug, f] of Object.entries(FLAGS)) {
    if (f.param === param && f.value === String(value)) {
      return { flagSlug, collections: f.collections };
    }
  }
  return null;
}

/** Every path this file can serve. For the sitemap and for the gate. */
function allPaths() {
  const out = [];
  for (const [facetSlug, f] of Object.entries(FACETS)) {
    for (const valueSlug of Object.keys(f.values)) {
      for (const c of f.collections) out.push(`/collections/${c}/${facetSlug}/${valueSlug}`);
    }
  }
  for (const [flagSlug, f] of Object.entries(FLAGS)) {
    for (const c of f.collections) out.push(`/collections/${c}/${flagSlug}`);
  }
  return out;
}

module.exports = { FACETS, FLAGS, resolveFacet, resolveFlag, facetPath, slugFor, allPaths };
