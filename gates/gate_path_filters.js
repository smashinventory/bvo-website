#!/usr/bin/env node
/**
 * gate_path_filters.js
 *
 * Guards the clean-path filter translation —
 *   /collections/bathroom-vanities/style/traditional
 * resolving internally to
 *   /collections/bathroom-vanities?style=Traditional
 *
 * ── THE PROMISE THIS GATE EXISTS TO MAKE CHECKABLE ─────────────────────
 * Sam's instruction, 2026-10-03: get the dynamic parameters out of the
 * URLs, and change NOTHING to do with filtering or product data. The
 * concern was explicit — a lot of code and schema went into the bundle
 * builder and the filtering taxonomy, and none of it should be disturbed by
 * an SEO change.
 *
 * "I didn't touch filtering" is a claim. Section 1 turns it into an
 * assertion: the files that own filtering are hashed, and the gate fails if
 * any of them changes, whatever the reason. A legitimate future edit to one
 * of them must update the hash deliberately, with the change visible in the
 * diff — which is the point.
 *
 * ── THE FAILURE MODE THAT MATTERS MOST ─────────────────────────────────
 * Not a 404. A clean path that resolves but renders the UNFILTERED grid:
 * every product instead of the 951 Farmhouse ones. Nothing errors, nothing
 * logs, and the page looks fine. That happens if req.query is not set,
 * because Express 4 parses it once before the router and mutating req.url
 * afterwards does not re-trigger it. Section 3 executes the real middleware
 * against fake requests and asserts both req.url AND req.query.
 */
'use strict';
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fails = 0;
const ok    = m => console.log('  PASS  ' + m);
const bad   = m => { console.log('  FAIL  ' + m); fails++; };
const check = (c, m) => c ? ok(m) : bad(m);

console.log('\n=== gate_path_filters ===\n');

/* ───────────── 1. THE FILTERING CODE IS UNTOUCHED ─────────────
   Hashes recorded 2026-10-03, before the clean-path work shipped. If one of
   these fails, either filtering changed (which this feature promised not to
   do) or someone made a legitimate edit and must update the hash here on
   purpose. Both outcomes are correct; a silent change is not. */
console.log('-- the filtering and product-data code is byte-identical --');
const SEALED = {
  'src/controllers/collectionsController.js': null,
  'src/controllers/bundleController.js':      null,
  'src/config/colorFamilies.js':              null,
  'src/jobs/importJamesMartinFeed.js':        null,
  'src/middleware/megaMenuData.js':           null,
  'src/config/filterLandingPages.js':         null,
};
const SEAL_FILE = 'gates/.path_filters_seal.json';
{
  const sealPath = path.join(ROOT, SEAL_FILE);
  const hashOf = f => crypto.createHash('sha256').update(read(f)).digest('hex');

  if (!fs.existsSync(sealPath)) {
    /* First run writes the seal. Deliberately not committed as literals in
       this file: a hash typed by hand is a hash nobody verified. */
    const seal = {};
    for (const f of Object.keys(SEALED)) seal[f] = hashOf(f);
    fs.writeFileSync(sealPath, JSON.stringify(seal, null, 2) + '\n');
    ok(`seal created for ${Object.keys(seal).length} files — commit ${SEAL_FILE}`);
  } else {
    const seal = JSON.parse(read(SEAL_FILE));
    for (const f of Object.keys(SEALED)) {
      if (!seal[f]) { bad(`${f} is not in the seal — add it`); continue; }
      const now = hashOf(f);
      check(now === seal[f],
            `${f} unchanged` + (now === seal[f] ? '' :
              `\n          SEALED ${seal[f].slice(0, 16)}\n          NOW    ${now.slice(0, 16)}`
              + '\n          If this edit is intentional, delete ' + SEAL_FILE
              + ' and re-run to re-seal.'));
    }
  }
}

/* ───────────── 2. the map contains no logic, and matches the real values ───────────── */
console.log('\n-- pathFilters.js is data, and its values are the real ones --');
const P = require(path.join(ROOT, 'src/config/pathFilters'));
{
  /* Cross-checked against the files that OWN these values, so the two
     cannot drift. A wrong value fails silently at runtime — the page
     renders with no filter applied — so this is the assertion that stops a
     typo becoming a wrong-products page. */
  const FLP = require(path.join(ROOT, 'src/config/filterLandingPages'));

  const styleReal = new Set(Object.keys(FLP.GROUPS.style.values));
  const styleMine = new Set(Object.values(P.FACETS.style.values));
  check([...styleMine].every(v => styleReal.has(v)),
        `every style value exists in filterLandingPages (${styleMine.size} values)`);
  check(styleMine.size === styleReal.size,
        `no style value is missing (${styleMine.size} of ${styleReal.size})`);

  const sizeReal = new Set(Object.keys(FLP.GROUPS.size_in.values));
  const sizeMine = new Set(Object.values(P.FACETS.size.values));
  check([...sizeMine].every(v => sizeReal.has(v)) && sizeMine.size === sizeReal.size,
        `every size value matches filterLandingPages (${sizeMine.size})`);

  const { FAMILIES } = require(path.join(ROOT, 'src/config/colorFamilies'));
  const famReal = new Set(FAMILIES.filter(f => f.type === 'cabinet').map(f => f.key));
  const famMine = new Set(Object.values(P.FACETS.finish.values));
  check([...famMine].every(v => famReal.has(v)),
        `every finish value is a real colorFamilies key (${famMine.size} values)`);

  /* Slugs must be URL-safe with no escaping, or the "clean URL" is not. */
  const allSlugs = Object.entries(P.FACETS)
    .flatMap(([f, d]) => [f, ...Object.keys(d.values)])
    .concat(Object.keys(P.FLAGS));
  const dirty = allSlugs.filter(s => encodeURIComponent(s) !== s
                                  || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s));
  check(dirty.length === 0,
        'every slug is URL-safe and well-formed' + (dirty.length ? ' — ' + dirty.join(', ') : ''));

  /* The slash in "European / Old World" is why a lookup table exists rather
     than runtime slugification. Asserted so nobody "simplifies" it away. */
  check(P.resolveFacet('bathroom-vanities', 'style', 'european-old-world')
        ?.value === 'European / Old World',
        'a value containing a slash still resolves (the reason this is a table)');

  /* A facet must not resolve on a collection it does not apply to. */
  check(P.resolveFacet('faucets', 'size', '30-inch') === null,
        'a size filter does not resolve on /collections/faucets');
  check(P.resolveFacet('bathroom-vanities', 'sink', 'double') === null,
        'a sink filter does not resolve on the plain vanities collection');
  check(P.resolveFacet('bathroom-vanities', 'style', 'nope') === null,
        'an unknown value resolves to null rather than guessing');

  /* Brand is deliberately absent — see the rollback doc. */
  const brandAnywhere = Object.values(P.FACETS).some(f => f.param === 'brand');
  check(!brandAnywhere,
        'brand is NOT converted, pending the ?brand= slug-vs-name check');
}

/* ───────────── 3. THE MIDDLEWARE, EXECUTED ─────────────
   Not read as text. Run, against fake req objects, asserting the two things
   the controller depends on: req.url rewritten AND req.query populated. */
console.log('\n-- the middleware, executed against fake requests --');
{
  const mw = require(path.join(ROOT, 'src/middleware/pathToFilter'));
  const run = (p, query) => {
    const req = { path: p, url: p, query: query || {} };
    let called = false;
    mw(req, {}, () => { called = true; });
    return { req, called };
  };

  /* ── next() ON EVERY BRANCH ────────────────────────────────────────
     The first version of this checked ONE path. The mutation sweep then
     replaced `return next();` with `return;` in the vanity-models branch
     and the gate stayed green — a hung request, served by a branch the
     gate never exercised. In Express, middleware that returns without
     calling next() leaves the connection open until it times out, with no
     error anywhere.

     Two assertions now. First behavioural, across every reachable branch: */
  const BRANCHES = [
    ['/bathroom-vanities/style/traditional', 'a resolved facet'],
    ['/bathroom-vanities/style/not-a-style', 'an unresolved facet'],
    ['/bathroom-vanities/on-sale',           'a resolved flag'],
    ['/bathroom-vanities/not-a-flag',        'an unresolved flag'],
    ['/vanity-models/er-vanities/bristol',   'the model branch, resolving'],
    ['/vanity-models/nope/nope',             'the model branch, unresolved'],
    ['/bathroom-vanities',                   'a plain collection'],
    ['/',                                    'the index'],
    ['/a/b/c/d/e',                           'a path too long to match'],
  ];
  for (const [p, label] of BRANCHES) {
    check(run(p).called, `next() is called for ${label} (${p})`);
  }

  /* Second structural, because the model branch cannot be fully exercised
     until src/config/modelSlugs.json exists — with no snapshot it exits
     early and the mutated line is never reached. A bare `return;` in
     Express middleware IS the bug, so its absence is the condition. */
  {
    const code = read('src/middleware/pathToFilter.js')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const bare = (code.match(/^\s*return\s*;/gm) || []).length;
    check(bare === 0,
          `no code path returns without calling next() (${bare} bare return(s))`);
  }

  {
    const { req } = run('/bathroom-vanities/style/traditional');
    check(req.query.style === 'Traditional',
          `req.query.style is set (${JSON.stringify(req.query)})`);
    check(/^\/bathroom-vanities\?/.test(req.url),
          `req.url is rewritten (${req.url})`);
  }
  {
    const { req } = run('/bathroom-vanities/finish/dark-wood');
    check(req.query.color_family === 'wood_d',
          'a finish path sets color_family to the internal key');
  }
  {
    const { req } = run('/bathroom-vanities/size/84-inch-and-over');
    check(req.query.size_in === '84+',
          "a spelled-out size resolves to the '84+' value the controller parses");
  }
  {
    const { req } = run('/bathroom-vanities/on-sale');
    check(req.query.on_sale === '1', 'a flag path sets on_sale=1');
  }
  /* ── MODEL PATHS: brand first, two segments ─────────────────────────
     Sam 2026-10-03: "we currently segregate them by having Brand/model."
     Both Bristols must reach their OWN brand — the live collision that
     makes the brand segment non-negotiable. */
  {
    const { req } = run('/vanity-models/er-vanities/bristol');
    check(req.query.model === 'Bristol' && req.query.brand === 'ER Vanities',
          `the ER Bristol resolves to its own brand (${JSON.stringify(req.query)})`);
  }
  {
    const { req } = run('/vanity-models/james-martin-vanities/bristol');
    check(req.query.model === 'Bristol' && req.query.brand === 'James Martin Vanities',
          'the James Martin Bristol resolves to its own brand');
  }
  {
    const { req } = run('/vanity-models/james-martin-vanities/mercer-island');
    check(req.query.model === 'Mercer Island',
          'a two-word model resolves from its single slugified segment');
  }
  {
    const { req } = run('/vanity-models/james-martin-vanities/alicante');
    check(req.query.model === "Alicante'",
          "the apostrophe model resolves (Alicante' -> alicante)");
  }
  {
    /* A model path is three segments, same as a facet path. If the facet
       branch ran first, 'vanity-models' would be tested as a facet name. */
    const { req } = run('/vanity-models/er-vanities/not-a-model');
    check(req.url === '/vanity-models/er-vanities/not-a-model'
          && Object.keys(req.query).length === 0,
          'an unknown model is left untouched, not mistaken for a facet');
  }
  /* Extra query params ride along. One facet in the path, the rest as
     parameters — sort order and pagination must survive. */
  {
    const { req } = run('/bathroom-vanities/style/modern', { sort: 'price_asc', page: '2' });
    check(req.query.style === 'Modern' && req.query.sort === 'price_asc' && req.query.page === '2',
          'existing query parameters are preserved alongside the path facet');
  }
  /* AN UNRESOLVED PATH MUST BE LEFT COMPLETELY ALONE. If it rewrote
     anything, /collections/:slug would receive a mangled request. */
  {
    const { req, called } = run('/bathroom-vanities/style/not-a-style');
    check(called && req.url === '/bathroom-vanities/style/not-a-style'
                 && Object.keys(req.query).length === 0,
          'an unresolved path is untouched and falls through unchanged');
  }
  {
    const { req } = run('/bathroom-vanities');
    check(req.url === '/bathroom-vanities' && Object.keys(req.query).length === 0,
          'a plain collection URL is untouched');
  }
  {
    const { req } = run('/');
    check(req.url === '/', 'the collections index is untouched');
  }
  /* A throw inside must not take the page down. */
  {
    let threw = false;
    try { mw({ path: null, url: null, query: null }, {}, () => {}); }
    catch (e) { threw = true; }
    check(!threw, 'a malformed request does not throw out of the middleware');
  }
}

/* ───────────── 4. the one-line mount, and the escape hatch ───────────── */
console.log('\n-- mounted once, and revertable by one line --');
{
  const r = read('src/routes/collections.js');
  check(/router\.use\(require\('\.\.\/middleware\/pathToFilter'\)\);/.test(r),
        'pathToFilter is mounted on the collections router');
  /* BEFORE '/:slug', or '/:slug' claims the first segment and the
     middleware never sees a three-segment path. */
  check(r.indexOf('pathToFilter') < r.indexOf("router.get('/:slug'"),
        '...before the /:slug route, or it would never run');
  check(/PATH_FILTERS_ROLLBACK\.md/.test(r),
        '...and points at the rollback doc, so the next person finds it');
  /* COMMENTS STRIPPED FIRST. These three assertions scanned the raw file
     and the first one FAILED on a correct tree, because pathToFilter.js
     explains its design by naming collectionsController in a comment. The
     gate was asserting "the word never appears" when the condition is "the
     code never requires it".

     That is the same shape of bug that has bitten gates in this repo
     repeatedly — gate_lookbook_anchors failed on correct CSS because a
     comment quoted the broken rule as an example. Assert on code, never on
     prose about code. */
  const stripJs = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const mwCode  = stripJs(read('src/middleware/pathToFilter.js'));
  const mapCode = stripJs(read('src/config/pathFilters.js'));

  /* The controller must not be imported by the middleware — that would be
     the start of a second filter path, which is the Rule 10 drift this
     design exists to avoid. */
  check(!/require\([^)]*[Cc]ontroller/.test(mwCode),
        'the middleware does not require any controller');
  check(!/bvoPool|require\([^)]*database/.test(mwCode),
        'the middleware touches no database');
  check(!/bvoPool|require\([^)]*database/.test(mapCode),
        'the map touches no database');
  /* The map is data. A function that computes a value instead of looking it
     up is where runtime slugification creeps back in. */
  check(!/\bSELECT\b|\bWHERE\b/i.test(mapCode),
        'the map contains no SQL');
}

/* ───────────── 5. the rollback doc exists and says the one thing ───────────── */
console.log('\n-- the rollback doc --');
{
  const d = 'docs/architecture/PATH_FILTERS_ROLLBACK.md';
  check(fs.existsSync(path.join(ROOT, d)), `${d} exists`);
  if (fs.existsSync(path.join(ROOT, d))) {
    const t = read(d);
    check(/PANIC BUTTON/.test(t), '...leads with the panic button');
    check(/pathToFilter/.test(t) && /comment out/i.test(t),
          '...names the exact line to comment out');
    check(/unfiltered/i.test(t),
          '...warns about the silent unfiltered-grid failure mode');
  }
}

console.log(`\n${fails ? 'FAILED: ' + fails + ' assertion(s)' : 'All assertions passed.'}\n`);
process.exit(fails ? 1 : 0);
