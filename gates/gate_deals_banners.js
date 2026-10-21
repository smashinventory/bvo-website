#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   gate_deals_banners.js — the Deals banners on /collections/sale.

   RENDERS THE PAGE. Does not read the source for anything it can render
   instead. VANITY_SIDEBAR_FILTERS.md §6: an earlier gate counted size_in
   inputs in source, found 2, and called it correct while the live sidebar
   showed Size twice. Counting blocks cannot detect that; only rendering can.

   Fixtures come from tests/fixtures/collectionLocals.js — the shared file,
   so this gate and the order gates cannot disagree about what they test.
   Per Rule 18 the SALE fixture carries only what collectionsController
   actually passes; it deliberately omits displayMode and tradeMeter.
   ───────────────────────────────────────────────────────────────────────── */
'use strict';
const fs   = require('fs');
const path = require('path');
const ejs  = require('ejs');

const ROOT = path.resolve(__dirname, '..');
const COLLECTION = path.join(ROOT, 'views/pages/collection.ejs');
const THEME      = path.join(ROOT, 'views/pages/admin/theme.ejs');
const SETTINGS   = path.join(ROOT, 'src/services/themeSettings.js');
const CONTROLLER = path.join(ROOT, 'src/controllers/collectionsController.js');
const ADMINCTRL  = path.join(ROOT, 'src/controllers/adminController.js');
const PRODEDIT   = path.join(ROOT, 'views/pages/admin/product-edit.ejs');

let pass = 0, fail = 0;
const ok = (label, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (detail ? '\n         ' + detail : '')); }
};
const section = t => console.log('\n' + t);

const src        = fs.readFileSync(COLLECTION, 'utf8');
const themeSrc   = fs.readFileSync(THEME, 'utf8');
const settingsSrc= fs.readFileSync(SETTINGS, 'utf8');
const ctrlSrc    = fs.readFileSync(CONTROLLER, 'utf8');
const adminSrc   = fs.readFileSync(ADMINCTRL, 'utf8');
const prodEdit   = fs.readFileSync(PRODEDIT, 'utf8');

/* EJS comments are stripped before any source match. The block documents
   its own past bugs by name, so an unstripped scan flags the documentation
   as the defect — that happened to gate_social_share and is recorded in
   VANITY_SIDEBAR_FILTERS.md §13. */
const noComments = s => s.replace(/<%#[\s\S]*?%>/g, '');

const render = locals => ejs.render(src, locals, { filename: COLLECTION });

const { cases } = require(path.join(ROOT, 'tests/fixtures/collectionLocals.js'));
const SALE = cases['SALE (virtual)'];

/* ═══ 1. THE GUARD — the block renders on sale and NOWHERE else ═══════════ */
section('1. Render gating');

ok('the shared fixture file still has a SALE case',
   !!SALE, 'tests/fixtures/collectionLocals.js lost "SALE (virtual)"');

const MEMBER = '<section class="deals-offer deals-offer--member"';
const TRADE  = '<section class="deals-offer deals-offer--trade"';

if (SALE) {
  const saleOut = render(SALE);
  ok('sale renders the member banner',  saleOut.includes(MEMBER));
  ok('sale renders the trade banner',   saleOut.includes(TRADE));
  ok('sale emits exactly one <style> block',
     (saleOut.match(/<style/g) || []).length === 1);
}

/* Every other fixture must render NOTHING from this block. These are the
   real other render paths, not invented slugs. */
for (const [name, locals] of Object.entries(cases)) {
  if (name.startsWith('SALE')) continue;
  const out = render(locals);
  ok('no deals markup on ' + name,
     !out.includes(MEMBER) && !out.includes(TRADE) && !out.includes('<style'),
     'the block leaked onto a non-sale collection');
}

/* Slugs that do not exist as fixtures still must not render it. Cheap, and
   it covers the case where someone loosens the guard to a prefix match. */
for (const slug of ['sales', 'sale-items', 'on-sale', 'SALE', 'clearance']) {
  const out = render(Object.assign({}, SALE, { category: { id: null, slug } }));
  ok('slug "' + slug + '" renders nothing',
     !out.includes(MEMBER) && !out.includes(TRADE),
     'the guard is matching more than the exact slug "sale"');
}

/* ═══ 2. UNDEFINED LOCALS — the ReferenceError class ═════════════════════ */
section('2. Undefined locals cannot 500 the page');

/* In EJS a bare undefined local throws on EVALUATION — `&&` never gets to
   short-circuit. `category && category.slug` would 500 any render path that
   does not pass category.

   ⚠️ SCOPED TO THE DEALS BLOCK, NOT THE WHOLE PAGE, AND THAT IS THE POINT.
   The first version of this gate rendered all of collection.ejs with
   `category` absent and went red at line 43 — `<h1><%= category.name %></h1>`,
   pre-existing code that legitimately requires a category and that every
   real render path supplies. That is the gate asserting a condition
   production cannot produce, against code this scope does not own. The unit
   under test is the guard on the deals block: it must skip quietly on any
   locals it is handed, and never be the thing that 500s the page.

   Each case omits the local entirely rather than passing null, because
   absent and null are different failures and production hits absent. */
const blockOnly = (() => {
  const a = src.indexOf('<% if (typeof category');
  const b = src.indexOf('<!-- Mobile filter drawer overlay -->');
  if (a < 0 || b < a) { ok('the deals block was extractable for isolated render', false); return null; }
  return ejs.compile(src.slice(a, b), { filename: COLLECTION });
})();
ok('the deals block was extractable for isolated render', !!blockOnly);

const omit = (obj, keys) => {
  const o = Object.assign({}, obj);
  for (const k of keys) delete o[k];
  return o;
};
if (blockOnly) {
  for (const keys of [['category'], ['settings'], ['tradeMeter'],
                      ['category', 'settings'], ['settings', 'tradeMeter'],
                      ['category', 'settings', 'tradeMeter']]) {
    let threw = null;
    try { blockOnly(omit(SALE, keys)); } catch (e) { threw = e.message.split('\n')[0]; }
    ok('block: absent ' + keys.join(' + ') + ' does not throw', threw === null, threw);
  }
  for (const [label, patch] of [
    ['settings = null',             { settings: null }],
    ['settings = {}',               { settings: {} }],
    ['settings.deals_banners = {}', { settings: { deals_banners: {} } }],
    ['category = null',             { category: null }],
    ['category = {} (no slug)',     { category: {} }],
  ]) {
    let threw = null;
    try { blockOnly(Object.assign({}, SALE, patch)); } catch (e) { threw = e.message.split('\n')[0]; }
    ok('block: ' + label + ' does not throw', threw === null, threw);
  }
}

/* ═══ 3. THE ENABLED TOGGLES ═════════════════════════════════════════════ */
section('3. Per-banner enable toggles');

const withBanners = (m, t) => Object.assign({}, SALE,
  { settings: { deals_banners: { member: m, trade: t } } });

const vis = locals => {
  const o = render(locals);
  return (o.includes(MEMBER) ? 'M' : '-') + (o.includes(TRADE) ? 'T' : '-');
};
ok('no settings at all  -> both show (absent enabled means ON)', vis(SALE) === 'MT');
ok('member enabled:false -> trade only', vis(withBanners({ enabled: false }, {})) === '-T');
ok('trade  enabled:false -> member only', vis(withBanners({}, { enabled: false })) === 'M-');
ok('both   enabled:false -> neither, and no <style>',
   vis(withBanners({ enabled: false }, { enabled: false })) === '--' &&
   !render(withBanners({ enabled: false }, { enabled: false })).includes('<style'));
ok('both   enabled:true  -> both show', vis(withBanners({ enabled: true }, { enabled: true })) === 'MT');

/* The toggles only work because setDotPath coerces the strings teToggle
   posts. teToggle emits value="false"/"true", and `'false' !== false` is
   TRUE — so without the coercion a disabled banner would still render. */
ok('setDotPath still coerces the "true"/"false" strings teToggle posts',
   /===\s*'true'/.test(settingsSrc) && /===\s*'false'/.test(settingsSrc),
   "themeSettings lost its string->boolean coercion; every enabled toggle silently stops working");

/* ═══ 4. SEO — the heading outline belongs to the page, not the promo ════ */
section('4. SEO');

/* The page's H1 is "Sale". Promotional copy as the first two subheadings
   pushes the page's apparent subject away from discounted vanities. The
   offer headlines are <p class="deals-offer-head"> on purpose. */
const saleOut = render(SALE);
const blockOf = html => {
  const a = html.indexOf('<div class="deals-offers">');
  const b = html.indexOf('</div>', html.lastIndexOf('deals-offer-foot')) + 6;
  return a > -1 ? html.slice(a, b > a ? b : html.length) : '';
};
const blk = blockOf(saleOut);
ok('zero headings of ANY level inside the rendered block',
   !/<h[1-6][\s>]/i.test(blk),
   'a heading appeared in the deals block: ' + (blk.match(/<h[1-6][^>]*>/i) || [''])[0]);
ok('each banner is still named for assistive tech via aria-label',
   (saleOut.match(/aria-label="New customer offer"/) || []).length === 1 &&
   (saleOut.match(/aria-label="Trade account offer"/) || []).length === 1,
   'dropping the heading is only acceptable while aria-label names the region');

/* ═══ 5. LCP — the banner is above the fold ══════════════════════════════ */
section('5. Performance');

/* ⚠️ THE IMAGE IS RENDERED WITH ONE SUPPLIED, AND THAT IS DELIBERATE.
   The media column is wrapped in `if (_dbm.image)`, so a fixture carrying
   settings:{} renders no <img> at all and a presence test on it would pass
   vacuously — green because nothing was checked. In production the default
   image always arrives, because load() deep-merges DEFAULTS over the saved
   file. So: render with an image to check the attributes, and assert
   separately that a default actually ships. */
const imgOut = render(Object.assign({}, SALE, {
  settings: { deals_banners: { member: { image: 'https://images.example/x.webp', image_alt: 'A' } } },
}));
const img = (imgOut.match(/<img[^>]*>/) || [])[0] || '';
ok('an <img> renders once an image is set', img.length > 0,
   'the media column did not render with an image supplied');
ok('themeSettings ships a default banner image',
   /image:\s*'https:\/\/images\.bathroomvanitiesoutlet\.com/.test(settingsSrc),
   'with no default the banner ships with an empty media column');
ok('the media column collapses when the image is cleared',
   !render(Object.assign({}, SALE, { settings: { deals_banners: { member: {} } } }))
     .includes('<div class="deals-offer-media">'),
   'clearing the Theme Editor image field would leave an empty grey panel');
ok('the banner image is eager, not lazy',
   /loading="eager"/.test(img),
   'loading="lazy" on the likely LCP element defers the very thing the metric measures');
ok('the banner image is fetchpriority="high"', /fetchpriority="high"/.test(img));
ok('the banner image reserves its box (width AND height)',
   /width="\d+"/.test(img) && /height="\d+"/.test(img),
   'without both, the product grid below shifts as the image arrives (CLS)');

/* The <style> is nonce'd or CSP drops it silently and the banners render unstyled. */
ok('the inline <style> carries the CSP nonce',
   /<style nonce="[^"]+"/.test(saleOut),
   'CSP blocks an unsigned <style>; the banners would render with no styling at all');
ok('the nonce is the real request nonce, not a literal',
   /<style nonce="<%= cspNonce %>"/.test(noComments(src)),
   'a hardcoded nonce defeats CSP');

/* ═══ 6. CRITICAL PATHS — this block must touch no commerce data ═════════ */
section('6. Critical paths untouched');

const blkSrc = (() => {
  const s = noComments(src);
  const a = s.indexOf("category.slug === 'sale'");
  const b = s.indexOf('<!-- Mobile filter drawer overlay -->');
  return a > -1 && b > a ? s.slice(a, b) : '';
})();
ok('the deals block source was locatable', blkSrc.length > 0);
for (const forbidden of ['cart', 'checkout', 'price', 'compare_price',
                         'product_id', 'addToCart', 'csrf']) {
  ok('the block references no "' + forbidden + '"',
     !new RegExp('\\b' + forbidden + '\\b').test(blkSrc),
     'the banners are presentational; touching commerce data here is out of scope');
}

/* §10: the filter panel navigates from these two attributes, not by
   submitting the form. If the block were inside #filter-form, or either
   attribute went missing, deselecting a filter breaks. */
ok('#filter-form keeps data-base-path',   /data-base-path/.test(src));
ok('#filter-form keeps data-filter-query', /data-filter-query/.test(src));
const ffAt = src.indexOf('id="filter-form"');
const dealsAt = src.indexOf('<div class="deals-offers">');
ok('the deals block is OUTSIDE #filter-form',
   dealsAt > -1 && ffAt > -1 && dealsAt < ffAt,
   'markup inside the filter form changes what the deselect handlers see');

/* ═══ 7. RULE 5 — all three layers, both directions ══════════════════════ */
section('7. Rule 5 — settings need all three layers');

const editorKeys = new Set([...themeSrc.matchAll(/deals_banners\.(\w+)\.(\w+)/g)]
  .map(m => m[1] + '.' + m[2]));
const readKeys = new Set();
for (const m of noComments(src).matchAll(/_dbm\.(\w+)/g)) readKeys.add('member.' + m[1]);
for (const m of noComments(src).matchAll(/_dbt\.(\w+)/g)) readKeys.add('trade.' + m[1]);

const defKeys = new Set();
{
  const i = settingsSrc.indexOf('deals_banners');
  const blkS = settingsSrc.slice(i, settingsSrc.indexOf('\n  },', settingsSrc.indexOf('trade:', i)) + 5);
  let cur = null;
  for (const line of blkS.split('\n')) {
    const g = line.match(/^\s{4}(member|trade):\s*\{/); if (g) { cur = g[1]; continue; }
    const f = line.match(/^\s{6}(\w+):/); if (f && cur) defKeys.add(cur + '.' + f[1]);
  }
}
ok('the defaults block was parseable', defKeys.size > 0);
const missing = (a, b) => [...a].filter(x => !b.has(x));
ok('every field the storefront reads has an editor input',
   missing(readKeys, editorKeys).length === 0,
   'read but not editable: ' + missing(readKeys, editorKeys).join(' '));
ok('every editor input is read by the storefront',
   missing(editorKeys, readKeys).length === 0,
   'editable but never rendered — the admin types a value that does nothing: ' +
   missing(editorKeys, readKeys).join(' '));
ok('every field the storefront reads has a default',
   missing(readKeys, defKeys).length === 0,
   'read with no default: ' + missing(readKeys, defKeys).join(' '));
ok('every editor input has a default',
   missing(editorKeys, defKeys).length === 0,
   'editable with no default: ' + missing(editorKeys, defKeys).join(' '));

/* ═══ 8. THE THRESHOLD — empty is not zero ═══════════════════════════════ */
section('8. Discount threshold');

/* Number('') is 0 — finite, in range, and therefore accepted as a threshold
   of ZERO, which would dump every discounted product onto the page. The
   emptiness test must come BEFORE Number(). Same family as the
   Number(null) === 0 defect in src/config/inventoryRisk.js. */
ok("'' / null / undefined are tested BEFORE Number()",
   /_dealsRaw === ''[\s\S]{0,120}\?\s*NaN/.test(ctrlSrc),
   "a cleared Theme Editor box becomes Number('') === 0 and admits everything");
ok('the threshold is range-guarded and falls back to a shipped default',
   /Number\.isFinite\(dealsPct\)[\s\S]{0,120}0\.375/.test(ctrlSrc));
ok('the threshold default agrees with themeSettings',
   /deals_min_discount_pct:\s*37\.5/.test(settingsSrc) && /0\.375/.test(ctrlSrc),
   'the controller fallback and the stored default have drifted apart');

/* Executed, not just matched: the real expression, over the real cases. */
const frac = raw => {
  const pct = (raw === '' || raw === null || raw === undefined) ? NaN : Number(raw);
  return (Number.isFinite(pct) && pct >= 0 && pct <= 100) ? pct / 100 : 0.375;
};
ok("'' falls back to the default (NOT 0)", frac('') === 0.375);
ok('null falls back to the default',       frac(null) === 0.375);
ok('undefined falls back to the default',  frac(undefined) === 0.375);
ok('"abc" falls back to the default',      frac('abc') === 0.375);
ok('-5 and 150 fall back to the default',  frac(-5) === 0.375 && frac(150) === 0.375);
ok('a TYPED 0 is honoured — "show everything" is a legitimate request',
   frac(0) === 0 && frac('0') === 0);
ok('40 means 40%',                         frac(40) === 0.4);

/* ═══ 9. is_deal — the hand-pick, end to end ═════════════════════════════ */
section('9. is_deal');

ok('the sale query admits hand-picks regardless of discount',
   /p\.is_deal = 1\s*\n?\s*OR/.test(ctrlSrc),
   'with the threshold above the catalogue ceiling, the flag is the only way to seed the page');
ok('compare_price > 0 is required, not merely NOT NULL',
   /p\.compare_price > 0/.test(ctrlSrc),
   'a zero MSRP divides by zero; MariaDB returns NULL and the row vanishes with no explanation');
ok('hand-picks sort first',  /ORDER BY p\.is_deal DESC/.test(ctrlSrc));
ok('the sale query failure is logged, not swallowed',
   /sale query FAILED/.test(ctrlSrc),
   'a silent catch makes a broken query look like an empty promotion');

ok('the product edit form has an is_deal checkbox',
   /name="is_deal"/.test(prodEdit));
ok('the checkbox reflects the stored value',
   /product\?\.is_deal/.test(prodEdit),
   'without this the box never shows as ticked and clears on every save');
ok('_extractProductFields carries is_deal',
   /is_deal:\s*body\.is_deal\s*\?\s*1\s*:\s*0/.test(adminSrc),
   'an unchecked checkbox sends NO key, so this must be truthiness, not === "1"');
ok('the INSERT names is_deal',     /is_new, is_deal,/.test(adminSrc));
ok('the UPDATE sets is_deal',      /is_new=\?, is_deal=\?/.test(adminSrc));
ok('both statements bind it',
   (adminSrc.match(/d\.is_new, d\.is_deal/g) || []).length === 2,
   'create and update must both pass the value');

/* The INSERT is a hand-written VALUES list. Adding a column without its
   placeholder shifts every bind by one and writes garbage into the wrong
   columns — this was the live defect on 2026-10-21. Counted, not eyeballed. */
{
  const IMG = ['a', 'b', 'c'];
  const expand = t => t
    .replace(/\$\{IMG_URL_COLS\.join\(', '\)\}/g, IMG.join(', '))
    .replace(/\$\{IMG_URL_COLS\.map\(\(\) => '\?'\)\.join\(', '\)\}/g, IMG.map(() => '?').join(', '));
  const a = adminSrc.indexOf('INSERT INTO products');
  const q = expand(adminSrc.slice(a, adminSrc.indexOf("'manual')", a) + 10));
  const nCols = q.slice(q.indexOf('(') + 1, q.indexOf('VALUES')).split(',').filter(x => x.trim()).length;
  const vs = q.slice(q.indexOf('VALUES'));
  const nVals = vs.slice(vs.indexOf('(') + 1).split(',').filter(x => x.trim()).length;
  ok('productCreate: column count === VALUES slot count  (' + nCols + ' / ' + nVals + ')',
     nCols === nVals,
     'every manually created product would save shifted values');
}

/* ═══ 10. SIDEBAR FACETS — Brand, Type, Size, Price ═════════════════════ */
section('10. Sale sidebar facets');

const { buildSaleView, widthInBucket, numOrNull } = require(path.join(ROOT, 'src/utils/saleFacets.js'));

/* EXECUTED, not matched. The logic lives in a module precisely so this gate
   can run the real thing instead of re-implementing it — a test that
   re-implements its subject agrees with the bug (Rule 18). */
const POOL = [
  { brand:'ER Vanities',      product_type:'Single Sink Vanity With Top', width_in:30,   price:'899'  },
  { brand:'ER Vanities',      product_type:'Single Sink Cabinet Only',    width_in:36,   price:'699'  },
  { brand:'James Martin',     product_type:'Single Sink Vanity With Top', width_in:36,   price:'1799' },
  { brand:'Huntington Brass', product_type:'Bathroom Faucets',            width_in:null, price:'149'  },
  { brand:'Huntington Brass', product_type:null,                          width_in:null, price:null   },
];
const un = buildSaleView(POOL, {});

ok('brands are deduped and sorted',
   JSON.stringify(un.availableBrands) === JSON.stringify(['ER Vanities','Huntington Brass','James Martin']),
   JSON.stringify(un.availableBrands));
ok('a null product_type is left out of the Type facet',
   un.availableProductTypes.length === 3);
ok('Type carries {value,count} — the shape the legacy group renders',
   un.availableProductTypes.every(t => 'value' in t && 'count' in t));
ok('only POPULATED size buckets appear (Rule 10)',
   JSON.stringify(un.availableSizes) === JSON.stringify(['30','36']),
   JSON.stringify(un.availableSizes));

/* ⚠️ THE BUG THIS SECTION EXISTS FOR. Number(null) is 0, and 0 sits inside
   the first bucket (`20-`, {min:0,max:22}) — so before the guard, every
   faucet and accessory with no width_in matched a 20-inch size filter. */
ok('a null width does NOT match the 20- bucket  (Number(null) === 0)',
   widthInBucket(null, '20-') === false,
   'every widthless row would appear under a 20-inch filter');
ok("an empty-string width does not match 20-", widthInBucket('', '20-') === false);
ok('a real 20" width still DOES match 20-', widthInBucket(20, '20-') === true);
ok('filtering size=20- returns zero, not the widthless rows',
   buildSaleView(POOL, { size_in: '20-' }).products.length === 0);

/* Rule 10 in both directions: a facet must keep its own options. */
ok('filtering by Brand still offers every Brand',
   buildSaleView(POOL, { brand:'ER Vanities' }).availableBrands.length === 3,
   'the Brand list collapsed to the chosen value — the shopper cannot change their mind');
ok('filtering by Size still offers every Size',
   JSON.stringify(buildSaleView(POOL, { size_in:'30' }).availableSizes) === JSON.stringify(['30','36']));
ok('filtering by Type still offers every Type',
   buildSaleView(POOL, { type:'Bathroom Faucets' }).availableProductTypes.length === 3);
ok('but the PRODUCTS are narrowed',
   buildSaleView(POOL, { brand:'ER Vanities' }).products.length === 2);
ok('two facets intersect',
   buildSaleView(POOL, { brand:'ER Vanities', size_in:'36' }).total === 1);

/* The empty-is-not-zero family, third sighting in this scope. */
ok("numOrNull('') is null, not 0  (Number('') === 0)", numOrNull('') === null);
ok('an empty min_price filters nothing',
   buildSaleView(POOL, { min_price:'' }).products.length === 5);
ok('an unpriced row survives a price filter',
   buildSaleView(POOL, { min_price:'800' }).products.some(p => p.price == null),
   'a missing price treated as 0 would drop the row with nothing to explain why');

ok('price bounds come from the UNFILTERED pool',
   un.priceRange.min === 149 && un.priceRange.max === 1799,
   JSON.stringify(un.priceRange));
ok('an empty pool does not throw and still reports one page',
   (() => { const v = buildSaleView([], {}); return v.pages === 1 && v.products.length === 0; })());
ok('paging: 120 rows is 3 pages of 48, total stays 120',
   (() => {
     const big = Array.from({ length:120 }, () => ({ brand:'B', product_type:'T', width_in:30, price:'100' }));
     const v = buildSaleView(big, {});
     return v.pages === 3 && v.products.length === 48 && v.total === 120;
   })());
ok('an out-of-range page is clamped, not blank',
   buildSaleView(POOL, { page:'99' }).page === 1);

/* The page must RENDER the four groups, in this order, Brand first. §2:
   Brand is fifth on vanities and first everywhere else, and this page uses
   the non-vanity call site — no fourth call site was added. */
{
  const h = render(SALE);
  const side = h.split('<div class="filter-header">')[1] || h;
  const groups = [...side.matchAll(/class="filter-group-toggle"[^>]*>\s*([^<\n]+)/g)].map(m => m[1].trim());
  ok('the sidebar renders Brand | Type | Size | Price Range',
     JSON.stringify(groups) === JSON.stringify(['Brand','Type','Size','Price Range']),
     JSON.stringify(groups));
  ok('no filter group is rendered twice (G5)',
     groups.length === new Set(groups).size);
}

/* ═══ 11. CANONICAL AND noindex ══════════════════════════════════════════ */
section('11. Canonical / noindex on the filtered page');

/* Added WITH the facets. Before them the page had one URL and nothing to
   duplicate; every filter combination is now a distinct crawlable URL. */
ok('the sale branch passes a canonical',
   /canonicalUrl: saleCanonical/.test(ctrlSrc),
   'filtered permutations would each be independently indexable');
ok('the canonical is the CLEAN collection URL, not the filtered one',
   /saleCanonical = `\$\{_saleSiteUrl\}\/collections\/sale`/.test(ctrlSrc),
   'a canonical carrying the query string consolidates nothing');
ok('the canonical is absolute, built from siteUrl',
   /_saleSiteUrl = require\('\.\.\/utils\/siteUrl'\)\.base\(\)/.test(ctrlSrc));
ok('noindex trips at TWO active filter groups, matching the grid path',
   /saleNoindex = saleView\.activeGroups >= 2/.test(ctrlSrc));
ok('noindex is passed to the view', /noindex:      saleNoindex/.test(ctrlSrc));
ok('activeGroups counts the four groups and nothing else',
   buildSaleView(POOL, {}).activeGroups === 0 &&
   buildSaleView(POOL, { brand:'ER Vanities' }).activeGroups === 1 &&
   buildSaleView(POOL, { brand:'ER Vanities', size_in:'36' }).activeGroups === 2 &&
   buildSaleView(POOL, { min_price:'100', max_price:'900' }).activeGroups === 1,
   'min+max together are ONE group, not two');

/* ═══ 12. THE POOL CAP ═══════════════════════════════════════════════════ */
section('12. The qualifying pool is not truncated to one page');

ok('the SQL fetches a pool larger than one page',
   /LIMIT 300/.test(ctrlSrc),
   'at LIMIT 48 the facets would describe a truncated set and filters would search 48 of N');
ok('product_type and width_in are selected (the facets need them)',
   /p\.product_type, p\.width_in,/.test(ctrlSrc));
ok('the controller no longer hardcodes page/pages to 1',
   !/page: 1, pages: 1, perPage: 48/.test(ctrlSrc),
   'paging must come from the matched count');

/* ═══ 13. EVERY LINK RESOLVES TO A REAL ROUTE ═══════════════════════════
   ⚠️ THIS SECTION EXISTS BECAUSE 108 CHECKS SHIPPED THREE DEAD URLS.
   The banners went live with /account/join, /trade/apply and
   /account/signin as their CTA targets. None of the three has a route.
   Every gate was green because every gate asserted what the markup SAYS,
   and not one followed a link. CLAUDE.md: "render the page and LOOK at
   it… a bare 'verified' that means 'I believe it works' is worth less
   than nothing, because it stops him looking."                          */
section('13. Links resolve to real routes');

/* The real route table, read from the router rather than assumed. */
const accountRoutes = (() => {
  const src2 = fs.readFileSync(path.join(ROOT, 'src/routes/account.js'), 'utf8');
  return [...src2.matchAll(/router\.get\s*\(\s*'([^']+)'/g)].map(m => '/account' + m[1]);
})();
const serverSrc = fs.readFileSync(path.join(ROOT, 'src/server.js'), 'utf8');
const mounts = [...serverSrc.matchAll(/app\.use\(\s*'([^']+)'\s*,\s*require/g)].map(m => m[1]);

ok('the account router was readable', accountRoutes.length > 0);
ok('/account is mounted', mounts.includes('/account'));

/* Collect every URL the banners can emit — defaults AND whatever the
   rendered page actually contains. */
/* ⚠️ COMMENTS STRIPPED FIRST. The first run flagged /account/join and
   /account/signin as still present — they were, in the comments that
   explain why they were removed. The gate was reading its own
   documentation as the defect. Rule 18's corollary, on the gate side. */
const settingsCode = settingsSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const urlsFromSettings = [...settingsCode.matchAll(/(?:cta_url|signin_url):\s*'([^']*)'/g)]
  .map(m => m[1])
  .filter(u => u && (u.startsWith('/account') || u.startsWith('/trade')));
/* Rendered WITH a consent label, because that is what ships: the default
   in themeSettings carries one, and with an empty fixture the checkbox
   assertions below would pass vacuously on markup that never rendered. */
const rendered = render(Object.assign({}, SALE, { settings: { deals_banners: {
  member: { consent_label: 'Yes, send me deals', cta_url: '/account/register?offer=platinum' },
  trade:  { signin_text: 'Already have an account?' },
} } }));
const urlsFromPage = [
  ...[...rendered.matchAll(/<a[^>]+href="(\/[^"]*)"/g)].map(m => m[1]),
  ...[...rendered.matchAll(/<form[^>]+action="(\/[^"]*)"/g)].map(m => m[1]),
].filter(u => u.startsWith('/account') || u.startsWith('/trade'));

/* ⚠️ /trade/* IS A REAL ROUTE NOW, AND THIS GATE USED TO SAY IT COULD NOT BE.
   When the banners shipped, the trade application did not exist and the
   CTA pointed at a dead /trade/apply — so this section asserted that no
   /trade/* URL survived. Phase 2 built the form. Leaving that assertion
   would be Rule 19: "a gate that encodes a REVERSED decision is not
   stale, it is wrong." It is now resolved against the real router the
   same way account URLs are. */
const tradeRoutes = (() => {
  const f = path.join(ROOT, 'src/routes/trade.js');
  if (!fs.existsSync(f)) return [];
  return [...fs.readFileSync(f, 'utf8').matchAll(/router\.(?:get|post)\s*\(\s*'([^']+)'/g)]
    .map(m => '/trade' + m[1]);
})();

const resolves = u => {
  const p0 = u.split('?')[0].replace(/\/$/, '') || '/';
  return accountRoutes.includes(p0) || tradeRoutes.includes(p0);
};
for (const u of [...new Set([...urlsFromSettings, ...urlsFromPage])]) {
  ok('resolves to a real route: ' + u, resolves(u),
     'NO ROUTE — this 404s. Real account pages: ' + accountRoutes.join(' '));
}
ok('the trade router is mounted and /trade/apply exists',
   tradeRoutes.includes('/trade/apply'),
   'the trade CTA points here — if the router goes, it 404s again');
ok('/trade is mounted in server.js',
   /app\.use\('\/trade',\s*require\('\.\/routes\/trade'\)\)/.test(serverSrc));
ok('the dead /account/join is gone everywhere',
   !settingsCode.includes('/account/join') && !rendered.includes('/account/join'));
ok('the dead /account/signin is gone everywhere',
   !settingsCode.includes('/account/signin') && !rendered.includes('/account/signin'));

/* ═══ 14. THE CONSENT CONTROL IS REAL ═══════════════════════════════════
   It shipped as <span class="deals-consent-box" aria-hidden="true"> — a
   bordered 15px square that looked exactly like a checkbox and could not
   be ticked. "the click mark is not working."                           */
section('14. The consent checkbox is a real input');

ok('it is an <input type="checkbox">, not a styled span',
   /<input[^>]+type="checkbox"[^>]*class="deals-consent-box"/.test(rendered) ||
   /<input[^>]+class="deals-consent-box"[^>]*type="checkbox"/.test(rendered),
   'a div that looks like a checkbox cannot be ticked');
ok('it carries a name, so the tick reaches the server',
   /<input[^>]+name="optin"/.test(rendered),
   'an unnamed input submits nothing — the tick would be decorative');
ok('it is NOT aria-hidden', !/deals-consent-box[^>]*aria-hidden/.test(rendered));
ok('it sits inside a <label>, so the text is a click target too',
   /<label class="deals-consent">[\s\S]{0,200}?<input/.test(rendered));
ok('the CTA submits that form rather than bypassing it',
   /<form class="deals-consent-form"[\s\S]*?<button type="submit"[^>]*deals-offer-cta/.test(rendered),
   'a separate <a> alongside the form would skip the opt-in entirely');
{ /* Scoped to the MEMBER banner: the trade CTA shares the class, so a
     global count is 2 on correct markup. */
  /* ⚠️ ANCHOR ON THE <section> TAGS, NOT THE CLASS NAME. The bare class
     string matches inside the inline <style> block first, so slicing on it
     returns a few lines of CSS and every assertion over that slice is
     vacuous. Third time this exact confusion has bitten in this scope. */
  const memberHtml = rendered.slice(
    rendered.indexOf('<section class="deals-offer deals-offer--member"'),
    rendered.indexOf('<section class="deals-offer deals-offer--trade"'));
  ok('the member slice is markup, not stylesheet', memberHtml.includes('deals-offer-body'));
  ok('exactly ONE member CTA renders, not two',
     (memberHtml.match(/deals-offer-cta/g) || []).length === 1,
     'the old anchor and the new submit button both rendered');
}

/* A GET form drops the query string in its action — the offer param has to
   survive as hidden inputs or the signup page never learns which offer. */
ok('the form action carries no query string',
   !/<form class="deals-consent-form"[^>]+action="[^"]*\?/.test(rendered),
   'a GET form discards it; the param must be a hidden input');
ok('the offer param survives as a hidden input',
   /<input type="hidden" name="offer" value="platinum">/.test(rendered),
   'the signup page cannot tell which offer was claimed');

/* ═══ 15. THE BLOCK IS NOT FULL-BLEED ═══════════════════════════════════
   It sits between .breadcrumb and .listing-layout as a bare top-level div.
   Neither its neighbours nor any container give it horizontal padding, so
   without its own it ran edge-to-edge: "this layout is so off."          */
section('15. Horizontal alignment with the rest of the page');

const styleBlock = (rendered.match(/<style nonce="[^"]*">([\s\S]*?)<\/style>/) || [])[1] || '';
ok('the style block was extractable', styleBlock.length > 0);
ok('.deals-offers sets its own horizontal padding',
   /\.deals-offers\{[^}]*padding:[^}]*\}/.test(styleBlock),
   'with no container on this template, no padding means full-bleed');

const pad = (styleBlock.match(/\.deals-offers\{[^}]*padding:\s*([^;}]+)/) || [])[1] || '';
ok('that padding is 64px horizontally, matching .listing-layout',
   /64px/.test(pad), 'got: ' + pad);
ok('there is a mobile override, matching .listing-layout\'s 24px',
   /\.deals-offers\{padding:[^}]*24px/.test(styleBlock.replace(/\s+/g, '')),
   '64px of padding on a phone leaves almost no room for the banner');
ok('the media column height is capped',
   /\.deals-offer-media\{[^}]*max-height/.test(styleBlock),
   'the master image is 3500x3500 and will set the banner height otherwise');

console.log('\n' + (fail ? 'RED  ' : 'GREEN') + '  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
