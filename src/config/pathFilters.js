'use strict';

/* pathFilters.js — slug -> the query the collections controller already reads.
 *
 * Turns  /collections/bathroom-vanities?style=Traditional
 * into   /collections/bathroom-vanities/style/traditional
 * so internal links carry no query string. (Seobility flags any internal URL
 * with a "?" as a dynamic parameter; a parameterised filter also canonicals
 * to its parent, so those URLs cannot rank.)
 *
 * DATA ONLY. No filtering happens here and none of it changes. Every `value`
 * below is the literal string collectionsController already expects in
 * req.query — copied from filterLandingPages.js, colorFamilies.js and
 * themeSettings.js, not invented. src/middleware/pathToFilter.js rewrites the
 * URL into that query and the controller cannot tell the difference.
 *
 * BRAND IS NOT HERE. themeSettings stores ?brand=james-martin while the live
 * crawl shows ?brand=James%20Martin%20Vanities, and products.brand holds the
 * second. Some stored brand links may already be broken — converting them
 * would hide that behind a redirect. Left as a parameter pending that check.
 */

const FACETS = {
  style: {
    param: 'style',
    on: ['bathroom-vanities', 'bathroom-vanities-with-tops', 'bathroom-vanity-cabinets'],
    values: {
      'traditional':        'Traditional',
      'transitional':       'Transitional',
      'modern':             'Modern',
      'farmhouse':          'Farmhouse',
      'mid-century-modern': 'Mid-Century Modern',
      'industrial':         'Industrial',
      'coastal':            'Coastal',
      'scandinavian':       'Scandinavian',
      /* "European / Old World" has a slash in it, which cannot survive in a
         path segment. That is why this is a table and not slugify-at-runtime. */
      'european-old-world': 'European / Old World',
    },
  },

  /* Slug is the human word, value is the internal key. */
  finish: {
    param: 'color_family',
    on: ['bathroom-vanities', 'bathroom-vanities-with-tops', 'bathroom-vanity-cabinets'],
    values: {
      'white': 'white', 'cream': 'cream', 'gray': 'gray', 'black': 'black',
      'blue': 'blue', 'green': 'green',
      'light-wood': 'wood_l', 'med-wood': 'wood_m', 'dark-wood': 'wood_d',
    },
  },

  size: {
    param: 'size_in',
    on: ['bathroom-vanities', 'bathroom-vanities-with-tops', 'bathroom-vanity-cabinets'],
    values: {
      '20-inch-and-under': '20-', '25-inch': '25', '30-inch': '30',
      '36-inch': '36', '42-inch': '42', '48-inch': '48',
      '60-inch': '60', '72-inch': '72', '84-inch-and-over': '84+',
    },
  },

  sink: {
    param: 'type',
    on: ['bathroom-vanities-with-tops'],
    values: {
      'single': 'Single Sink Vanity With Top',
      'double': 'Double Sink Vanity With Top',
    },
  },

  /* Brand. Values are products.brand verbatim — the full name, which is
     what the controller matches on. (themeSettings separately stores some
     ?brand=james-martin slug links; those are a different, pre-existing
     mismatch and are not what this maps.) */
  brand: {
    param: 'brand',
    on: ['vanity-models', 'bathroom-vanities', 'bathroom-vanities-with-tops',
         'bathroom-vanity-cabinets'],
    values: {
      'james-martin-vanities': 'James Martin Vanities',
      'er-vanities':           'ER Vanities',
    },
  },

  /* FAUCET TYPES. Only bathroom-faucets was mapped until 2026-10-06, which
     is why Kitchen Faucets and the rest stayed on ?product_type= and never
     got the keyword into the URL. */
  'product-type': {
    param: 'product_type',
    on: ['faucets'],
    values: {
      'bathroom-faucets': 'Bathroom Faucets',
      'kitchen-faucets':  'Kitchen Faucets',
      'shower-fixtures':  'Shower Fixtures',
      'tub-fillers':      'Tub Fillers',
      'bar-faucets':      'Bar Faucets',
      'laundry-faucets':  'Laundry Faucets',
    },
  },
  /* ACCESSORY TYPES — A SEPARATE FACET SLUG ON PURPOSE.
     The obvious move was to add 'accessories' to the `on` list above and
     put these values in with the faucets. That would be wrong: `on` and
     `values` are independent, so every value would become valid on every
     listed collection, and /collections/accessories/product-type/
     kitchen-faucets would resolve to a 200 page with zero products —
     which allPaths() would then put in the sitemap. Two entries with
     disjoint `on` lists keep the value sets apart. facet(), pathFor(),
     clean() and allPaths() all already handle two facets sharing a param,
     so this costs a data row and no code.
     It also matches the sidebar, which labels this group "Accessory Type". */
  'accessory-type': {
    param: 'product_type',
    on: ['accessories'],
    values: {
      'bathroom-accessories': 'Bathroom Accessories',
      'plumbing-accessories': 'Plumbing Accessories',
      'knobs-legs':           'Knobs & Legs',
      'metal-base':           'Metal Base',
      'bench':                'Bench',
    },
  },
};

/* /collections/bathroom-vanities/on-sale -> ?on_sale=1 */
const FLAGS = {
  'on-sale': {
    param: 'on_sale', value: '1',
    on: ['bathroom-vanities', 'bathroom-vanities-with-tops',
         'bathroom-vanity-cabinets', 'faucets'],
  },
};

/* Model pages: /collections/vanity-models/<brand>/<model>
 *
 * Brand first, because that is how the catalogue is segregated. Brand is
 * mandatory, not a tie-break: Bristol exists under BOTH brands (James Martin
 * 300 products, plus ER Vanities), so a bare /bristol would be ambiguous.
 *
 * Plain data, from:
 *   SELECT DISTINCT model, brand FROM products
 *   WHERE is_active = 1 AND category_id = 1 AND model <> ''
 * Re-run that when James Martin adds a model and add the row.
 */
const MODELS = {
    'er-vanities/bristol':                 { brand: "ER Vanities", model: "Bristol" },
    'er-vanities/kensington':              { brand: "ER Vanities", model: "Kensington" },
    'er-vanities/london':                  { brand: "ER Vanities", model: "London" },
    'er-vanities/oxford':                  { brand: "ER Vanities", model: "Oxford" },
    'er-vanities/windsor':                 { brand: "ER Vanities", model: "Windsor" },
    'james-martin-vanities/addison':       { brand: "James Martin Vanities", model: "Addison" },
    'james-martin-vanities/alicante':      { brand: "James Martin Vanities", model: "Alicante'" },
    'james-martin-vanities/allamari':      { brand: "James Martin Vanities", model: "Allamari" },
    'james-martin-vanities/amberly':       { brand: "James Martin Vanities", model: "Amberly" },
    'james-martin-vanities/athens':        { brand: "James Martin Vanities", model: "Athens" },
    'james-martin-vanities/auburn':        { brand: "James Martin Vanities", model: "Auburn" },
    'james-martin-vanities/bellamy':       { brand: "James Martin Vanities", model: "Bellamy" },
    'james-martin-vanities/bellshire':     { brand: "James Martin Vanities", model: "Bellshire" },
    'james-martin-vanities/boston':        { brand: "James Martin Vanities", model: "Boston" },
    'james-martin-vanities/breckenridge':  { brand: "James Martin Vanities", model: "Breckenridge" },
    'james-martin-vanities/bristol':       { brand: "James Martin Vanities", model: "Bristol" },
    'james-martin-vanities/britannia':     { brand: "James Martin Vanities", model: "Britannia" },
    'james-martin-vanities/brittany':      { brand: "James Martin Vanities", model: "Brittany" },
    'james-martin-vanities/brookfield':    { brand: "James Martin Vanities", model: "Brookfield" },
    'james-martin-vanities/brooklyn':      { brand: "James Martin Vanities", model: "Brooklyn" },
    'james-martin-vanities/celeste':       { brand: "James Martin Vanities", model: "Celeste" },
    'james-martin-vanities/chianti':       { brand: "James Martin Vanities", model: "Chianti" },
    'james-martin-vanities/chicago':       { brand: "James Martin Vanities", model: "Chicago" },
    'james-martin-vanities/columbia':      { brand: "James Martin Vanities", model: "Columbia" },
    'james-martin-vanities/de-soto':       { brand: "James Martin Vanities", model: "De Soto" },
    'james-martin-vanities/emmeline':      { brand: "James Martin Vanities", model: "Emmeline" },
    'james-martin-vanities/gracyn':        { brand: "James Martin Vanities", model: "Gracyn" },
    'james-martin-vanities/hudson':        { brand: "James Martin Vanities", model: "Hudson" },
    'james-martin-vanities/kinnsden':      { brand: "James Martin Vanities", model: "Kinnsden" },
    'james-martin-vanities/laurent':       { brand: "James Martin Vanities", model: "Laurent" },
    'james-martin-vanities/linden':        { brand: "James Martin Vanities", model: "Linden" },
    'james-martin-vanities/linear':        { brand: "James Martin Vanities", model: "Linear" },
    'james-martin-vanities/lorelai':       { brand: "James Martin Vanities", model: "Lorelai" },
    'james-martin-vanities/lucian':        { brand: "James Martin Vanities", model: "Lucian" },
    'james-martin-vanities/malibu':        { brand: "James Martin Vanities", model: "Malibu" },
    'james-martin-vanities/mantova':       { brand: "James Martin Vanities", model: "Mantova" },
    'james-martin-vanities/marcello':      { brand: "James Martin Vanities", model: "Marcello" },
    'james-martin-vanities/marigot':       { brand: "James Martin Vanities", model: "Marigot" },
    'james-martin-vanities/mercer-island': { brand: "James Martin Vanities", model: "Mercer Island" },
    'james-martin-vanities/metropolitan':  { brand: "James Martin Vanities", model: "Metropolitan" },
    'james-martin-vanities/myrrin':        { brand: "James Martin Vanities", model: "Myrrin" },
    'james-martin-vanities/olena':         { brand: "James Martin Vanities", model: "Olena" },
    'james-martin-vanities/palisades':     { brand: "James Martin Vanities", model: "Palisades" },
    'james-martin-vanities/portland':      { brand: "James Martin Vanities", model: "Portland" },
    'james-martin-vanities/solene':        { brand: "James Martin Vanities", model: "Solene" },
};

/* ── lookups: pure, no DB ─────────────────────────────────────────────── */

function facet(collection, facetSlug, valueSlug) {
  const f = FACETS[String(facetSlug || '').toLowerCase()];
  if (!f || !f.on.includes(String(collection || '').toLowerCase())) return null;
  const value = f.values[String(valueSlug || '').toLowerCase()];
  return value === undefined ? null : { [f.param]: value };
}

function flag(collection, flagSlug) {
  const f = FLAGS[String(flagSlug || '').toLowerCase()];
  if (!f || !f.on.includes(String(collection || '').toLowerCase())) return null;
  return { [f.param]: f.value };
}

function model(brandSlug, modelSlug) {
  const m = MODELS[`${String(brandSlug || '').toLowerCase()}/${String(modelSlug || '').toLowerCase()}`];
  return m ? { model: m.model, brand: m.brand } : null;
}

/* For link emitters. One slugify, used only to BUILD a path — never to
   resolve one, which is always a lookup above. */
const slug = s => String(s == null ? '' : s)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function modelPath(modelName, brandName) {
  const b = slug(brandName), m = slug(modelName);
  if (!b || !m || !MODELS[`${b}/${m}`]) return null;
  return `/collections/vanity-models/${b}/${m}`;
}

/* value -> slug, for the megamenu links. Returns null for an unknown value
   so the template can fall back to the ?param= form rather than emit a
   broken path. */
function slugOf(facetSlug, value) {
  const f = FACETS[facetSlug];
  if (!f) return null;
  for (const [k, v] of Object.entries(f.values)) if (v === value) return k;
  return null;
}
const sizePath   = v => slugOf('size', String(v));
const brandPath  = v => slugOf('brand', String(v));
const finishPath = v => slugOf('finish', String(v));

/* Convert a stored ?param= URL to its clean path, or return it unchanged.
   Theme Editor links live in the settings file, so they cannot be fixed in
   code — this cleans them as they render. One param only; anything else is
   left alone. */
function clean(url) {
  const u = String(url || '');
  const m = /^\/collections\/([a-z0-9-]+)\?([a-z_]+)=([^&]+)$/.exec(u);
  if (!m) return u;
  const [, collection, param, raw] = m;
  let value;
  try { value = decodeURIComponent(raw.replace(/\+/g, ' ')); } catch (e) { return u; }

  if (param === 'on_sale' && value === '1') {
    return FLAGS['on-sale'].on.includes(collection)
      ? `/collections/${collection}/on-sale` : u;
  }
  for (const [facetSlug, f] of Object.entries(FACETS)) {
    if (f.param !== param || !f.on.includes(collection)) continue;
    const valueSlug = slugOf(facetSlug, value);
    if (valueSlug) return `/collections/${collection}/${facetSlug}/${valueSlug}`;
  }
  return u;
}

/* The reverse of facet()/flag(): given the query a controller would read,
   the clean path that produces it — or null if there isn't one. Used by the
   301 so an old ?param= URL can find its new home. */
function pathFor(collection, param, value) {
  const c = String(collection || '').toLowerCase();
  const v = String(value == null ? '' : value);
  for (const [flagSlug, f] of Object.entries(FLAGS)) {
    if (f.param === param && f.value === v && f.on.includes(c)) {
      return `/collections/${c}/${flagSlug}`;
    }
  }
  for (const [facetSlug, f] of Object.entries(FACETS)) {
    if (f.param !== param || !f.on.includes(c)) continue;
    const valueSlug = slugOf(facetSlug, v);
    if (valueSlug) return `/collections/${c}/${facetSlug}/${valueSlug}`;
  }
  return null;
}

/* Every facet and flag path this file can serve. For the sitemap, so it
   cannot list a URL the router does not resolve. Model paths come from
   MODELS via modelPath() and are added separately. */
function allPaths() {
  const out = [];
  for (const [facetSlug, f] of Object.entries(FACETS)) {
    for (const valueSlug of Object.keys(f.values)) {
      for (const c of f.on) out.push(`/collections/${c}/${facetSlug}/${valueSlug}`);
    }
  }
  for (const [flagSlug, f] of Object.entries(FLAGS)) {
    for (const c of f.on) out.push(`/collections/${c}/${flagSlug}`);
  }
  return out;
}

module.exports = { FACETS, FLAGS, MODELS, facet, flag, model, slug, clean, pathFor, allPaths,
                   modelPath, slugOf, sizePath, finishPath, brandPath };
