#!/usr/bin/env node
/**
 * gate_filter_landing_pages.js
 *
 * Guards the filtered-collection landing pages added 2026-10-02.
 *
 * WHAT THEY ARE
 * /collections/bathroom-vanities?style=Farmhouse used to serve the parent
 * collection's title and meta and canonicalise to the parent, so it could
 * never rank for "farmhouse bathroom vanity". When one promotable filter is
 * active and it has enough products behind it, the page now carries its own
 * title, meta, H1 and intro, and canonicalises to itself.
 *
 * THE TWO FAILURE MODES THIS EXISTS TO CATCH, both silent:
 *
 *  1. PROMOTION THAT NEVER FIRES. The content keys must match the query
 *     values the megamenu actually emits. One mismatched key — 'Mid Century'
 *     for 'Mid-Century Modern' — and that page quietly never promotes. No
 *     error, no log, just a page that stayed ordinary. Asserted by
 *     cross-checking the keys against the live nav links in settings.
 *
 *  2. PROMOTION THAT FIRES TOO WIDELY. Dropping the threshold, or breaking
 *     the "exactly one filter" rule, pushes hundreds of thin near-duplicate
 *     URLs into the index. That is the standard way faceted navigation
 *     damages a site, and it looks like nothing is wrong until traffic falls.
 *
 * It cannot tell you whether the COPY is any good. That is a read, not a
 * test.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ejs = require('ejs');   // renders the header block to test the H1 branches

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fails = 0;
const ok    = m => console.log('  PASS  ' + m);
const bad   = m => { console.log('  FAIL  ' + m); fails++; };
const check = (c, m) => c ? ok(m) : bad(m);

const LAND  = require(path.join(ROOT, 'src/config/filterLandingPages'));
const ctrl  = read('src/controllers/collectionsController.js');
const tmpl  = read('views/pages/collection.ejs');
const sett  = read('src/services/themeSettings.js');

console.log('\n=== gate_filter_landing_pages ===\n');

/* ───────────── 1. the content itself ───────────── */
console.log('-- content map --');
const all = LAND.allEntries();
check(all.length === 38, `38 filter values have content (found ${all.length})`);
{
  const byC = {};
  for (const e of all) byC[e.collection] = (byC[e.collection] || 0) + 1;
  check(byC['bathroom-vanities'] === 27, `27 vanity values (found ${byC['bathroom-vanities']})`);
  check(byC['faucets']           ===  6, `6 faucet types (found ${byC['faucets']})`);
  check(byC['accessories']       ===  5, `5 accessory types (found ${byC['accessories']})`);
  check(all.every(e => e.collection && e.param && e.value),
        'every entry carries a collection, a param and a value');
}

const dup = a => [...new Set(a.filter((v, i) => a.indexOf(v) !== i))];
for (const [field, vals] of [['title', all.map(e => e.title)],
                             ['meta',  all.map(e => e.meta)],
                             ['h1',    all.map(e => e.h1)]]) {
  const d = dup(vals);
  check(d.length === 0, `every ${field} is unique${d.length ? ' — dupes: ' + JSON.stringify(d) : ''}`);
}

/* Length bands. Not pedantry: a title over ~60 chars is truncated in results,
   and the whole point of this work was that these pages say something
   specific. A truncated or empty one defeats it. */
const longTitles = all.filter(e => e.title.length > 60).map(e => `${e.value}:${e.title.length}`);
check(longTitles.length === 0, `no title over 60 chars${longTitles.length ? ' — ' + longTitles.join(', ') : ''}`);
const badMeta = all.filter(e => e.meta.length < 110 || e.meta.length > 170).map(e => `${e.value}:${e.meta.length}`);
check(badMeta.length === 0, `every meta 110-170 chars${badMeta.length ? ' — ' + badMeta.join(', ') : ''}`);
const badIntro = all.filter(e => { const w = e.intro.trim().split(/\s+/).length; return w < 35 || w > 75; })
                    .map(e => `${e.value}:${e.intro.trim().split(/\s+/).length}w`);
check(badIntro.length === 0, `every intro 35-75 words${badIntro.length ? ' — ' + badIntro.join(', ') : ''}`);

/* Filler check. The brief was that each intro says something true and useful
   about the category. These phrases are the tell that it does not. */
const FILLER = /wide (range|selection|variety) of|browse our|shop our (great|wide)|something for everyone|look no further|best prices/i;
const filler = all.filter(e => FILLER.test(e.intro)).map(e => e.value);
check(filler.length === 0, `no filler phrasing in intros${filler.length ? ' — ' + filler.join(', ') : ''}`);

/* ───────────── 2. the keys MATCH what the nav emits ───────────── */
console.log('\n-- content keys match the live filter values --');
{
  /* THE SILENT FAILURE. A key here that no link ever produces is a page that
     can never promote, and nothing reports it. Cross-checked against the
     megamenu's own style links in themeSettings — the same list the nav
     renders from. */
  const i = sett.indexOf('const DEFAULTS');
  const S = vm.runInNewContext(
    sett.slice(i, sett.indexOf('\n};', i) + 3).replace(/^const DEFAULTS\s*=/, 'x =') + '\nx;',
    { require: m => require(path.resolve(ROOT, 'src/services', m)) }
  );
  const navStyles = ((S.nav.vanities_mega || {}).style_links || [])
    .map(l => decodeURIComponent((l.url.split('style=')[1] || '').replace(/\+/g, ' ')))
    .filter(Boolean);

  check(navStyles.length === 9, `nav emits 9 style links (found ${navStyles.length})`);
  const contentStyles = Object.keys(LAND.STYLE);
  const missing = navStyles.filter(s => !contentStyles.includes(s));
  const extra   = contentStyles.filter(s => !navStyles.includes(s));
  check(missing.length === 0, `every nav style has content${missing.length ? ' — missing: ' + missing.join(', ') : ''}`);
  check(extra.length === 0,   `no content for a style the nav never links${extra.length ? ' — orphaned: ' + extra.join(', ') : ''}`);

  /* Colour keys are family keys, not labels — 'wood_m', not 'Med Wood'. Using
     the label would silently never match. */
  const colorKeys = Object.keys(LAND.COLOR);
  check(colorKeys.every(k => /^[a-z_]+$/.test(k)),
        `colour keys are family keys, not display labels (${colorKeys.join(', ')})`);
  check(colorKeys.length === 9, `9 colour families have content (found ${colorKeys.length})`);
  check(Object.keys(LAND.SIZE).length === 9, '9 size buckets have content');
}

/* ───────────── 3. the threshold ───────────── */
console.log('\n-- the promotion threshold --');
/* THE NUMBER IS NOT PINNED HERE, ON PURPOSE. It was — three assertions on the
   literal 25 — and that meant changing a tunable setting turned this gate red
   for no reason, which is the same spelling-pin failure that has bitten this
   project repeatedly. What must actually hold is that the two defaults AGREE
   and that neither is zero: a fallback of 0 would promote every thin page on a
   config slip, which is the one outcome the threshold exists to prevent. */
const settDefault = (sett.match(/filter_landing_min_products:\s*(\d+)/) || [])[1];
const ctrlDefault = (ctrl.match(/filter_landing_min_products\s*\?\?\s*(\d+)/) || [])[1];
check(settDefault !== undefined, 'themeSettings defines a threshold default');
check(ctrlDefault !== undefined, 'the controller defines a fallback threshold');
check(settDefault === ctrlDefault,
      `the two defaults agree (themeSettings ${settDefault}, controller ${ctrlDefault})`);
check(Number(ctrlDefault) > 0,
      'the fallback is not 0 (0 would promote every thin page on a config slip)');
check(/filter_landing_min_products/.test(ctrl),
      'the controller reads the threshold by name');

/* THE SETTING MUST BE REACHABLE. For days the comment in filterLandingPages.js
   and the architecture doc both said this number was "tunable in the Theme
   Editor without a deploy". It was not — the key existed in the defaults and
   the controller read it, but no field rendered it, so the only way to change
   it was to hand-edit data/theme_settings.json on the server. A setting nobody
   can reach is a constant with extra steps, and a doc that says otherwise is
   worse than no doc. Asserted here so the claim cannot go stale again. */
{
  const theme = read('views/pages/admin/theme.ejs');
  check(/seo\.filter_landing_min_products/.test(theme),
        'the Theme Editor renders a field for the threshold (the docs claim it is tunable)');
}
check(!/<\s*25\b/.test(ctrl.split('const _landing')[1] || '') ||
      /minProducts/.test(ctrl),
      'the comparison uses the settings value, not a hardcoded number');

/* ───────────── 4. the promotion LOGIC, executed ───────────── */
console.log('\n-- promotion logic (real code, lifted and run) --');
{
  const start = ctrl.indexOf('const _landing = (() => {');
  const end   = ctrl.indexOf('})();', start) + 5;
  check(start > 0, 'the _landing block was found in the controller');

  if (start > 0) {
    /* The `const` binding is stripped so the IIFE's completion value is
       returned. Reading it off the vm context instead returns undefined for
       every case — which looks exactly like "nothing ever promotes", and did
       when this harness was first written. */
    const iife = ctrl.slice(start, end).replace(/^const _landing = /, '');
    const run = o => {
      const c = {
        filterLandingPages: LAND,
        /* `slug` is new: lookup() is keyed by collection first, so the lifted
           block cannot run without knowing which collection it is on.
           Defaulting to bathroom-vanities leaves every case below unchanged. */
        slug: o.slug || 'bathroom-vanities',
        isVanityCategory: o.isVanityCategory !== false,
        activeFilterGroupCount: o.groups === undefined ? 1 : o.groups,
        attrFilters: o.attrFilters || {},
        colorFamilyParam: o.colorFamilyParam || [],
        colorExactParam: o.colorExactParam || [],
        result: { total: o.total === undefined ? 1000 : o.total },
        /* Follows the real default rather than a literal, so this harness
           cannot drift from the shipped threshold. */
        res: { locals: { settings: { seo: { filter_landing_min_products:
                 o.min === undefined ? Number(settDefault) : o.min } } } },
        console,
      };
      vm.createContext(c);
      return vm.runInContext(iife, c);
    };

    const T = (label, got, want) =>
      check(want === null ? !got : (!!got && got.title === want), label);

    T('style=Farmhouse (951) promotes',
      run({ attrFilters: { style: ['Farmhouse'] }, total: 951 }),
      'Farmhouse Bathroom Vanities | Rustic & Shaker | BVO');
    T('color_family=white (956) promotes',
      run({ colorFamilyParam: ['white'], total: 956 }),
      'White Bathroom Vanities | Bright, Classic Finishes | BVO');
    T('size_in=36 (742) promotes',
      run({ attrFilters: { size_in: ['36'] }, total: 742 }),
      '36 Inch Bathroom Vanities | Single Sink | BVO');

    /* The boundary is derived from the shipped default, not written as a
       literal. Pinning 24/25 meant that retuning a setting broke this gate —
       which is what happened when the threshold moved to 10. What matters is
       that the boundary HOLDS wherever it is set, not where it currently is. */
    const TH = Number(settDefault);
    T(`one below threshold (${TH - 1}) does NOT`,
      run({ attrFilters: { style: ['Coastal'] }, total: TH - 1 }), null);
    T(`exactly at threshold (${TH}) DOES`,
      run({ attrFilters: { style: ['Coastal'] }, total: TH }),
      'Coastal Bathroom Vanities | Light & Airy Designs | BVO');
    T('a 2-product value never promotes at any sane threshold',
      run({ attrFilters: { style: ['Coastal'] }, total: 2 }), null);
    T('two PROMOTABLE filters do NOT promote',
      run({ attrFilters: { style: ['Farmhouse'] }, colorFamilyParam: ['white'], groups: 2, total: 500 }), null);

    /* ADDED AFTER THE MUTATION SWEEP FOUND A HOLE.
       The case above sets TWO promotable filters, so `candidates.length !== 1`
       rejects it on its own and the activeFilterGroupCount guard is never
       reached. Deleting that guard entirely left the gate green.

       This is the case that needs it: ONE promotable filter plus a filter
       that is not promotable at all. candidates.length is 1, so only the
       group count can catch it. Without the guard, ?style=Farmhouse&brand=X
       would self-canonicalise and serve the plain Farmhouse title — a
       brand-and-style combination indexed as if it were the style category,
       which is precisely the faceted-navigation duplication the threshold
       work exists to avoid. */
    T('one promotable + one non-promotable filter does NOT promote',
      run({ attrFilters: { style: ['Farmhouse'] }, groups: 2, total: 900 }), null);
    T('...and three groups does NOT either',
      run({ attrFilters: { size_in: ['60'] }, groups: 3, total: 1277 }), null);
    T('two values in one group do NOT',       run({ attrFilters: { style: ['Farmhouse', 'Modern'] }, total: 900 }), null);
    /* THE DUPLICATE-COPY GUARD, and the reason the isVanityCategory gate could
       be removed. style/color_family/size_in are facets on three collections.
       Only bathroom-vanities has copy written for them, so the other two must
       return null — if they ever start promoting, three collections are
       serving one identical title and meta, self-canonical, which is the exact
       failure this whole file exists to prevent. */
    T('vanities-with-tops + style=Farmhouse does NOT (no copy for it)',
      run({ slug: 'bathroom-vanities-with-tops', attrFilters: { style: ['Farmhouse'] }, total: 900 }), null);
    T('vanity-cabinets + style=Farmhouse does NOT (no copy for it)',
      run({ slug: 'bathroom-vanity-cabinets', attrFilters: { style: ['Farmhouse'] }, total: 900 }), null);
    T('an unknown collection does NOT',
      run({ slug: 'zzz-not-a-collection', attrFilters: { style: ['Farmhouse'] }, total: 900 }), null);

    /* product_type — faucets and accessories. Keyed off attrFilters, NOT the
       `productTypes` variable, which reads req.query.type and is empty on a
       clean /product-type/ path. If this is ever re-keyed to productTypes
       these go null and nothing else reports it. */
    T('faucets + product_type=Kitchen Faucets (84) promotes',
      run({ slug: 'faucets', attrFilters: { product_type: ['Kitchen Faucets'] }, total: 84 }),
      'Kitchen Faucets | Pull-Down Sprayer & Single Handle | BVO');
    T('faucets + product_type=Shower Fixtures (376) promotes',
      run({ slug: 'faucets', attrFilters: { product_type: ['Shower Fixtures'] }, total: 376 }),
      'Shower Fixtures & Trim Kits | Heads, Arms & Valves | BVO');
    T('accessories + product_type=Knobs & Legs (21) promotes',
      run({ slug: 'accessories', attrFilters: { product_type: ['Knobs & Legs'] }, total: 21 }),
      'Vanity Knobs & Leg Sets | James Martin Parts | BVO');
    T('accessories + Bench (2) does NOT — below threshold',
      run({ slug: 'accessories', attrFilters: { product_type: ['Bench'] }, total: 2 }), null);
    T('a faucet type on the accessories collection does NOT',
      run({ slug: 'accessories', attrFilters: { product_type: ['Kitchen Faucets'] }, total: 84 }), null);
    T('an accessory type on the faucets collection does NOT',
      run({ slug: 'faucets', attrFilters: { product_type: ['Bench'] }, total: 84 }), null);
    T('unknown value does NOT',               run({ attrFilters: { style: ['ZZZUnknown'] }, total: 900 }), null);
    T('colour + exact-colour does NOT',       run({ colorFamilyParam: ['white'], colorExactParam: ['Pure White'], total: 900 }), null);
    T('threshold 0 promotes a thin page',     run({ attrFilters: { style: ['Coastal'] }, total: 7, min: 0 }),
      'Coastal Bathroom Vanities | Light & Airy Designs | BVO');
    T('threshold 5000 blocks a fat page',     run({ attrFilters: { style: ['Transitional'] }, total: 2808, min: 5000 }), null);
  }
}

/* ───────────── 5. canonical + template ───────────── */
console.log('\n-- canonical and template --');
check(/effectiveCanonical/.test(ctrl), 'a separate effective canonical is computed');
/* THE CANONICAL MUST BE THE CLEAN PATH. Until 2026-10-06 it was built as
   `${canonicalUrl}?${param}=${value}` — but filterToPath 301s that form to the
   clean path, so every promoted page declared a canonical that redirected back
   to the page itself, while the sitemap listed the clean path. Verified live
   before changing it: /collections/bathroom-vanities/style/farmhouse was
   canonicalling to /collections/bathroom-vanities?style=Farmhouse. */
check(/pathFilters\.pathFor\(slug,\s*_landing\.param,\s*_landing\.value\)/.test(ctrl),
      'the landing canonical is built from pathFor(), i.e. the clean path');
check(/\$\{canonicalUrl\}\?\$\{_landing\.param\}=\$\{encodeURIComponent\(_landing\.value\)\}/.test(ctrl),
      'the ?param= form survives as the fallback for a value with no clean path');

/* ── every promotable value must HAVE a clean path, and must not leak ──
   A landing value with no entry in pathFilters still works, but silently
   falls back to the ?param= canonical and loses the keyword from the URL —
   which is most of the point of promoting it. This catches the half-done
   case: copy written, slug forgotten. */
{
  const PF = require(path.join(ROOT, 'src/config/pathFilters'));
  const noPath = all.filter(e => !PF.pathFor(e.collection, e.param, e.value))
                    .map(e => `${e.collection}/${e.value}`);
  check(noPath.length === 0,
        `every landing value has a clean path${noPath.length ? ' — missing: ' + noPath.join(', ') : ''}`);

  /* The disjoint-value invariant. product-type and accessory-type share the
     param `product_type` and are kept apart only by their `on` lists. Merging
     them into one facet would make every value valid on both collections, and
     /collections/accessories/product-type/kitchen-faucets would resolve to a
     200 page with zero products — which allPaths() would then put in the
     sitemap. */
  const collections = [...new Set(all.map(e => e.collection))];
  const leaks = [];
  for (const e of all) {
    for (const c of collections) {
      if (c === e.collection) continue;
      if (PF.pathFor(c, e.param, e.value)) leaks.push(`${e.value} resolves on ${c}`);
    }
  }
  check(leaks.length === 0,
        `no filter value resolves on a collection it does not belong to${leaks.length ? ' — ' + leaks.join('; ') : ''}`);

  /* allPaths feeds the sitemap directly, so a value in pathFilters with no
     products behind it becomes an indexed empty page. Checked the other way
     round: every product-type/accessory-type path must be one we have copy
     for, because those two facets exist only to serve these landing pages. */
  const typePaths = PF.allPaths().filter(p => /\/(product-type|accessory-type)\//.test(p));
  check(typePaths.length === 11,
        `11 product/accessory type paths in the sitemap (found ${typePaths.length})`);
}
check(/canonicalUrl:\s*effectiveCanonical/.test(ctrl), 'the render uses it');
check(/landing:\s+_landing/.test(ctrl), 'landing is passed to the template');

/* ONE H1. A promoted page must SWAP the heading, not add a second one.
   ── CHANGED 2026-10-03 ───────────────────────────────────────────────
   This was `h1s === 2`, counting <h1> occurrences in the whole file. That
   pinned the NUMBER OF BRANCHES, which is a spelling, not a condition: the
   header is an if/else chain, a model landing branch was added to it, and
   the count went red on a correct change while proving nothing about the
   rendered page. It is now asserted by RENDERING each branch — which is
   what the comment above always meant, and which survives a fourth
   branch being added later. */
{
  const hdr    = tmpl.slice(tmpl.indexOf('<div class="cat-header">'),
                            tmpl.indexOf('<!-- Breadcrumb -->'));
  const render = locals => ejs.render(hdr + '</div></div>', locals);
  const base   = { category: { name: 'Bathroom Vanities- All', slug: 'bathroom-vanities', description: 'd' },
                   modelSeo: null, modelCopy: null };
  const promoted = render({ ...base, landing: { h1: 'Farmhouse Bathroom Vanities', intro: 'i' } });
  const ordinary = render({ ...base, landing: null });

  check((promoted.match(/<h1[\s>]/g) || []).length === 1, 'a promoted page emits exactly one H1');
  check((ordinary.match(/<h1[\s>]/g) || []).length === 1, 'an unpromoted page emits exactly one H1');
  check(/<h1>Farmhouse Bathroom Vanities<\/h1>/.test(promoted),
        'the promoted H1 is the landing heading');
  check(!/<h1>Bathroom Vanities- All<\/h1>/.test(promoted),
        'the promoted H1 REPLACES the collection name rather than adding to it');
  check(/<h1>Bathroom Vanities- All<\/h1>/.test(ordinary),
        'an unpromoted page still gets the collection name');

  /* Mutual exclusion, asserted by rendering the one case that can break it:
     BOTH a model page and a promotable filter at once. The structural
     "is it an if/else" check below passes even when the chain is split
     into separate ifs, because the final else survives — so only this
     renders the failure. Caught by mutation test, not by inspection. */
  const both = render({ ...base,
    modelSeo: { label: 'ER Vanities Bristol' },
    modelCopy: { model_name: 'Bristol', brand: 'ER Vanities', description: 'a' },
    landing: { h1: 'Farmhouse Bathroom Vanities', intro: 'i' } });
  check((both.match(/<h1[\s>]/g) || []).length === 1,
        'model page + promotable filter together still emit exactly one H1');
}
check(/typeof landing !== 'undefined' && landing/.test(tmpl),
      'the template guards on landing being defined');
check(/<h1><%= landing\.h1 %><\/h1>/.test(tmpl), 'the promoted branch renders landing.h1');
check(/class="cat-intro"/.test(tmpl), 'the intro paragraph is rendered');
/* The two branches must be mutually exclusive — an if/else, not two ifs. */
check(/<% } else { %>/.test(tmpl.slice(tmpl.indexOf('cat-header-inner'), tmpl.indexOf('</div>\n</div>'))),
      'the branches are if/else, so a page can never render both headings');

/* ───────────── 6. the CSS ships ───────────── */
console.log('\n-- CSS --');
for (const f of ['public/css/site.css', 'public/css/site-bundle.css']) {
  const css = read(f);
  check(/\.cat-header\s+\.cat-intro\s*\{/.test(css),
        `${f}: .cat-header .cat-intro rule present`);
  /* Specificity matters here. `.cat-header p` is (0,1,1) and sets amber at
     .875rem; a bare `.cat-intro` is (0,1,0) and would LOSE, rendering the
     intro as a block of small amber text. Two classes = (0,2,0). */
  check(!/(^|})\.cat-intro\s*\{/.test(css),
        `${f}: not written as a bare .cat-intro, which .cat-header p would beat`);
}
/* COMPARED AS A NUMBER, NOT PINNED TO 28. This was written as
   /site-bundle\.css\?v=28/ and went red the moment the next unrelated change
   bumped the stylesheet to 29 — it asserted "the version is the version I
   happened to write", which is true until someone does the right thing.
   What has to hold is that the version is at or past the one this feature's
   CSS landed in. */
{
  const m = read('views/layouts/main.ejs').match(/site-bundle\.css\?v=(\d+)/);
  check(!!m && Number(m[1]) >= 28,
        `the cache buster is at or past this feature's version (v=${m ? m[1] : 'NONE'} >= 28)`);
}

/* ───────────── 7. the corrected Vanity Style record ───────────── */
console.log('\n-- the Vanity Style correction holds --');
{
  const doc  = read('docs/architecture/VANITY_SIDEBAR_FILTERS.md');
  const part = read('views/partials/filters/vanity-style.ejs');
  /* Nine of the 27 landing pages depend on ?style= filtering. Four places in
     this codebase used to say it did not work, and the governing document
     told maintainers to treat wiring it as outstanding work. If that wording
     returns, someone will "fix" a working filter and these pages with it. */
  check(/VANITY STYLE FILTERS/.test(doc), 'the doc records that style DOES filter');
  check(!/^## 5\. ⚠ VANITY STYLE DOES NOT FILTER/m.test(doc),
        'the old "DOES NOT FILTER" heading is gone');
  check(!/Do not describe this filter as working/.test(doc.replace(/It read "[\s\S]*?outstanding work\./, '')),
        'the instruction not to call it working is gone (outside the quoted history)');
  check(!/KNOWN GAP/.test(part), 'the sidebar partial no longer claims a known gap');
  check(/THIS FILTER WORKS/.test(part), 'the sidebar partial records that it works');
  check(!/does NOT read req\.query\.style/.test(ctrl),
        'the controller header no longer claims style is unread');
}

console.log(`\n${fails ? 'FAILED: ' + fails + ' assertion(s)' : 'All assertions passed.'}\n`);
process.exit(fails ? 1 : 0);
