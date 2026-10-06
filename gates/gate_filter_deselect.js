#!/usr/bin/env node
'use strict';

/* gate_filter_deselect.js
 *
 * THE BUG THIS GATE EXISTS TO PREVENT
 *
 * The filter panel does not navigate by submitting #filter-form. public/js/site.js
 * has four handlers that each build a URLSearchParams and then navigate. If any of
 * them navigates by assigning to window.location.search, the CURRENT PATH IS KEPT.
 * On a clean-path URL — /collections/bathroom-vanities/style/farmhouse — that means
 * unchecking Farmhouse writes an empty query, the /style/farmhouse path survives,
 * pathToFilter re-applies style=Farmhouse, and the filter re-selects itself. The
 * user cannot clear it. That was the live bug.
 *
 * WHAT IS ASSERTED
 *
 *   1. ZERO assignments to window.location.search survive in site.js. This is the
 *      condition, not an idiom: any navigation that only rewrites the search
 *      preserves the path, and preserving the path is the bug.
 *   2. Both helpers exist and every read of the active filter set goes through
 *      _bvoFilterParams (so a delete acts on a set that includes the path facet).
 *   3. The SHIPPED _bvoFilterGo body is extracted from site.js and EXECUTED against
 *      a stub. It must navigate to the form's data-base-path, and must fall back to
 *      the current pathname when the attribute is absent.
 *   4. The SHIPPED _bvoFilterParams body is extracted and EXECUTED. It must seed
 *      from data-filter-query when present, and from window.location.search when not.
 *   5. The real middleware chain publishes the merged query as res.locals.filterQuery
 *      for every URL shape — clean path, clean path + query, bare collection.
 *   6. publishFilterQuery is mounted AFTER pathToFilter (before it, req.url is not
 *      yet rewritten and the published value would be missing the path facet).
 *   7. collection.ejs hands the JS a base path identical to the one "Clear all"
 *      already uses, so the two can never drift.
 *
 * Deliberately NOT asserted: variable names inside the minified handlers, or the
 * order of parameters in an output query string. Those are how the code is written,
 * not whether the deselect works. Pinning them makes this gate fail against a
 * correct rewrite.
 *
 * No DOM library is used on purpose — jsdom is not a dependency of this project.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let fails = 0, checks = 0;
function ok(label, cond, detail) {
  checks++;
  if (cond) { console.log('  ok   ' + label); }
  else { fails++; console.log('  FAIL ' + label + (detail ? '\n         ' + detail : '')); }
}
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

/* Strip comments without eating the // in https://  (a naive stripper does). */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');
}

console.log('\ngate_filter_deselect — the filter panel must be able to clear a clean-path filter\n');

// ── 1. no navigation may preserve the path ───────────────────────────────────
const siteJs = read('public/js/site.js');
const searchAssign = (siteJs.match(/location\s*\.\s*search\s*=/g) || []).length;
ok('site.js makes no assignment to location.search (that would keep the clean path)',
   searchAssign === 0, 'found ' + searchAssign);

// ── 2. one navigation helper, and every read seeded through it ───────────────
ok('window._bvoFilterGo is defined',     /window\._bvoFilterGo\s*=\s*function/.test(siteJs));
ok('window._bvoFilterParams is defined', /window\._bvoFilterParams\s*=\s*function/.test(siteJs));

const rawReads = (siteJs.match(/new URLSearchParams\(window\.location\.search\)/g) || []).length;
ok('no filter handler reads window.location.search directly', rawReads === 0,
   'found ' + rawReads + ' — each one cannot see a facet that lives in the path');

const goCalls = (siteJs.match(/window\._bvoFilterGo\(/g) || []).length;
ok('every filter control navigates through the one helper (4 controls)', goCalls === 4,
   'found ' + goCalls + ' call sites');

// ── 3 + 4. execute the SHIPPED helper bodies ─────────────────────────────────
function extract(name) {
  const i = siteJs.indexOf('window.' + name + '=function');
  if (i === -1) return null;
  // walk braces from the first { after the signature
  const s = siteJs.indexOf('{', i);
  let d = 0;
  for (let j = s; j < siteJs.length; j++) {
    if (siteJs[j] === '{') d++;
    else if (siteJs[j] === '}') { d--; if (d === 0) return siteJs.slice(i, j + 1); }
  }
  return null;
}

function stub(attrs, loc) {
  const el = attrs && {
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    dataset: {},
  };
  return {
    document: { getElementById: (id) => (id === 'filter-form' ? el : null) },
    window:   { location: loc },
  };
}

const goSrc = extract('_bvoFilterGo');
ok('_bvoFilterGo body is extractable from the shipped file', !!goSrc);

if (goSrc) {
  const make = (attrs, loc) => {
    const env = stub(attrs, loc);
    const w = { location: loc };
    new Function('window', 'document', goSrc)(w, env.document);
    return w._bvoFilterGo;
  };

  let href = null;
  const loc = { pathname: '/collections/bathroom-vanities/style/farmhouse',
                search: '', set href(v) { href = v; }, get href() { return href; } };
  let go = make({ 'data-base-path': '/collections/bathroom-vanities' }, loc);

  href = null; go('');
  ok('deselecting the last filter lands on the collection root, not the /style/ path',
     href === '/collections/bathroom-vanities', 'got ' + href);

  href = null; go('size_in=36');
  ok('a remaining filter is carried as a query on the collection root',
     href === '/collections/bathroom-vanities?size_in=36', 'got ' + href);

  // fallback: no attribute (lookbook and any page without the form) = old behavior
  let href2 = null;
  const loc2 = { pathname: '/collections/lookbook', search: '?a=1',
                 set href(v) { href2 = v; }, get href() { return href2; } };
  const go2 = make(null, loc2);
  href2 = null; go2('a=1&size_in=36');
  ok('with no data-base-path it falls back to the current pathname (unchanged behavior)',
     href2 === '/collections/lookbook?a=1&size_in=36', 'got ' + href2);
}

const paramsSrc = extract('_bvoFilterParams');
ok('_bvoFilterParams body is extractable from the shipped file', !!paramsSrc);

if (paramsSrc) {
  const make = (attrs, loc) => {
    const env = stub(attrs, loc);
    const w = { location: loc };
    new Function('window', 'document', 'URLSearchParams', paramsSrc)(
      w, env.document, URLSearchParams);
    return w._bvoFilterParams;
  };

  let p = make({ 'data-filter-query': 'size_in=36&style=Farmhouse' },
               { pathname: '/collections/bathroom-vanities/style/farmhouse', search: '' })();
  ok('seeds from the server-published query, so a path facet is visible to a delete',
     p.get('style') === 'Farmhouse' && p.get('size_in') === '36',
     'got ' + p.toString());

  p = make({ 'data-filter-query': '' }, { pathname: '/collections/bathroom-vanities',
                                          search: '?size_in=36' })();
  ok('falls back to the live query string when nothing was published',
     p.get('size_in') === '36', 'got ' + p.toString());
}

// ── 5. the real middleware chain publishes the merged query ──────────────────
const filterToPath       = require(path.join(ROOT, 'src/middleware/filterToPath'));
const pathToFilter       = require(path.join(ROOT, 'src/middleware/pathToFilter'));
const publishFilterQuery = require(path.join(ROOT, 'src/middleware/publishFilterQuery'));

function chain(url) {
  const [p, q] = url.split('?');
  const query = {};
  if (q) for (const [k, v] of new URLSearchParams(q)) {
    if (k in query) query[k] = [].concat(query[k], v); else query[k] = v;
  }
  const req = { url, path: p, query, method: 'GET', protocol: 'https',
                get: () => 'www.bathroomvanitiesoutlet.com' };
  const res = { locals: {}, redirect: (c, to) => { res._redir = [c, to]; } };
  filterToPath(req, res, () => {
    if (res._redir) return;
    pathToFilter(req, res, () => publishFilterQuery(req, res, () => {}));
  });
  return res;
}

let r = chain('/bathroom-vanities/style/farmhouse');
const fq = new URLSearchParams(r.locals.filterQuery || '');
ok('a clean path publishes the facet it stands for',
   fq.get('style') === 'Farmhouse', 'got ' + JSON.stringify(r.locals.filterQuery));

r = chain('/bathroom-vanities/style/farmhouse?size_in=36');
const fq2 = new URLSearchParams(r.locals.filterQuery || '');
ok('a clean path plus a query publishes BOTH',
   fq2.get('style') === 'Farmhouse' && fq2.get('size_in') === '36',
   'got ' + JSON.stringify(r.locals.filterQuery));

r = chain('/bathroom-vanities/style/farmhouse?sort=popularity');
ok('sort survives (the JM-feed popularity order is not dropped)',
   new URLSearchParams(r.locals.filterQuery || '').get('sort') === 'popularity',
   'got ' + JSON.stringify(r.locals.filterQuery));

r = chain('/bathroom-vanities');
ok('a bare collection publishes an empty filter set', r.locals.filterQuery === '',
   'got ' + JSON.stringify(r.locals.filterQuery));

// the clean path must be terminal — otherwise deselect could ping-pong
r = chain('/bathroom-vanities/style/farmhouse');
ok('the clean path does not redirect (no loop with filterToPath)', !r._redir,
   r._redir ? '301 -> ' + r._redir[1] : '');

// ── 6. mount order ───────────────────────────────────────────────────────────
const routes = stripComments(read('src/routes/collections.js'));
const iPath = routes.indexOf('pathToFilter');
const iPub  = routes.indexOf('publishFilterQuery');
ok('publishFilterQuery is mounted', iPub !== -1);
ok('publishFilterQuery runs AFTER pathToFilter (before it, req.url is not rewritten)',
   iPath !== -1 && iPub > iPath, 'pathToFilter@' + iPath + ' publishFilterQuery@' + iPub);

// ── 7. the base path cannot drift from "Clear all" ───────────────────────────
const view = read('views/pages/collection.ejs');
const m = view.match(/id="filter-form"[\s\S]{0,400}?data-base-path="([^"]+)"/);
ok('the filter form carries data-base-path', !!m);
ok('the filter form carries data-filter-query',
   /id="filter-form"[\s\S]{0,400}?data-filter-query="[^"]*filterQuery/.test(view));
if (m) {
  const clearAll = view.match(/class="filter-clear-top"/)
    ? view.match(/<a href="([^"]+)"[^>]*class="filter-clear-top"/) : null;
  ok('data-base-path is the same value "Clear all" uses (they cannot drift)',
     !!clearAll && clearAll[1] === m[1],
     'base=' + m[1] + '  clear=' + (clearAll ? clearAll[1] : 'not found'));
}

console.log('\n' + (fails
  ? 'gate_filter_deselect: FAILED ' + fails + ' of ' + checks
  : 'gate_filter_deselect: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
