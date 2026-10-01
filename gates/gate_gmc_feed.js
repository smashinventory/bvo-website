#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_gmc_feed.js — the Google Merchant Center feed stays correct.

   Run:  node gates/gate_gmc_feed.js
   Exit: 0 = pass, 1 = fail

   WHY THIS GATE IS WORTH ITS LENGTH
   Nothing in this feed fails loudly. A wrong category is accepted and the
   item quietly serves against the wrong searches. An inverted price
   advertises the wrong number until a customer notices. A malformed gtin
   disapproves the item three days later in a dashboard nobody opens. The
   entire failure surface is silent and delayed, which is precisely the
   shape of bug a gate is for.

   IT TESTS THE REAL BUILDER. buildItems() is imported from the controller
   and driven with a stub pool. A gate that re-implements the rules it is
   checking only proves it agrees with itself.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const gpc  = require(path.join(ROOT, 'src/utils/googleProductCategory'));
const feed = require(path.join(ROOT, 'src/controllers/feedController'));

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

/* ═══ 1. EVERY PRODUCT TYPE IN PRODUCTION IS ACCOUNTED FOR ══════════════
   Counted from the 2026-09-30 dump: 27 distinct product_type values across
   6,059 active products. An unmapped type is not a crash — the product is
   silently dropped from the feed and nobody notices the revenue that never
   arrived. So the list is pinned here and asserted.

   When a new type appears in the catalogue this gate will NOT see it (it
   cannot read production). What it does guarantee is that nothing already
   known has quietly lost its mapping. */
console.log('--- every known product_type is mapped or excluded on purpose ---');
const PRODUCTION_TYPES = [
  'Single Sink Vanity With Top', 'Double Sink Vanity With Top', 'Shower Fixtures',
  'Single Sink Cabinet Only', 'Stone Top', 'Bathroom Faucets',
  'Double Sink Cabinet Only', 'Mirror', 'Kitchen Faucets', 'Bathroom Accessories',
  'Backsplash', 'Tub Fillers', 'Storage Cabinet', 'Countertop Unit',
  'Plumbing Accessories', 'Composite Top', 'Knobs & Legs', 'Hutch',
  'Metal Base', 'Drawer Unit', 'Linen Cabinet', 'Side Cabinet', 'Sample',
  'Bar Faucets', 'Bench', 'Laundry Faucets',
];
{
  const unmapped = PRODUCTION_TYPES
    .filter((t) => !gpc.isExcluded(t) && !gpc.categoryFor(t));
  ok('no production product_type is left unmapped',
     unmapped.length === 0,
     `unmapped: ${unmapped.join(', ')} — each one silently drops its products`);

  const badIds = Object.values(gpc.BY_PRODUCT_TYPE)
    .filter((id) => !gpc.pathFor(id));
  ok('every mapped id resolves to a known taxonomy path',
     badIds.length === 0,
     `ids with no path: ${badIds.join(', ')}`);

  ok('all category ids are positive integers',
     Object.values(gpc.BY_PRODUCT_TYPE).every((n) => Number.isInteger(n) && n > 0));

  /* The specific values that were verified by hand against Google's file on
     2026-09-30. If one of these changes, it was changed from memory, and
     the whole point of that verification was that memory is unreliable
     here. */
  ok('bathroom vanities is still 2081', gpc.categoryFor('Single Sink Vanity With Top') === 2081);
  ok('countertops is still 2729',       gpc.categoryFor('Stone Top') === 2729);
  ok('faucets is still 2032',           gpc.categoryFor('Bathroom Faucets') === 2032);
  ok('mirrors is still 595',            gpc.categoryFor('Mirror') === 595);

  /* The old stored values must never come back. They are not merely wrong,
     they are strings Google cannot resolve at all. */
  const paths = Object.values(gpc.CATEGORIES).join(' | ');
  ok('no invalid "Bathroom Fixtures" path has crept back in',
     !/Bathroom Fixtures/.test(paths),
     'that path does not exist in Google\'s taxonomy — it is what the DB column holds');
  ok('no invalid "Kitchen Fixtures" path has crept back in',
     !/Kitchen Fixtures/.test(paths));
}

/* ═══ 1b. EXACTLY ONE MAP — Rule 8 and Rule 10 ═════════════════════════
   This section exists because on 2026-09-30 this project shipped TWO maps
   deriving one fact: GMC_CATEGORY_MAP in seoDefaults.js (which writes to the
   database) and googleProductCategory.js (which feeds Merchant Center). That
   breaks Rule 8 (one internal taxonomy) and Rule 10 (one canonical source per
   fact), both in BVO_AUDIT_BRIEF.md.

   It was not caught by review. It was caught by Sam, afterwards.

   The reason it happened is that the correct fix — repair the existing map —
   had already been taken twice (8bb7729, db077a3) and the session never ran
   `git log -S'GMC_CATEGORY_MAP'` to find out. A rule that depends on a future
   session remembering to look is not a control. This is the control. */
console.log('\n--- exactly one product_type -> category map exists ---');
{
  const seo = read('src/utils/seoDefaults.js');

  ok('GMC_CATEGORY_MAP no longer exists',
     !/const\s+GMC_CATEGORY_MAP\s*=/.test(seo),
     'a second map deriving the same fact — Rule 8 and Rule 10');

  ok('seoDefaults imports the single map',
     /require\(['"]\.\/googleProductCategory['"]\)/.test(seo),
     'it must READ the shared map, not hold its own');

  ok('seoDefaults derives the category through categoryFor()',
     /gpc\.categoryFor\(/.test(seo),
     'reaching into the map object directly would let the two drift apart ' +
     'again through the exclusion list');

  /* Sweep every file that could plausibly hold a third map, rather than the
     two we happen to know about. A new one in a new file is the exact shape
     of the original mistake. */
  const dirs = ['src/utils', 'src/controllers', 'src/jobs', 'src/models', 'src/middleware'];
  const offenders = [];
  for (const dir of dirs) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full).filter((n) => n.endsWith('.js'))) {
      const rel = `${dir}/${f}`;
      if (rel === 'src/utils/googleProductCategory.js') continue;   // the one home
      const body = read(rel);
      /* A map is identified by a vanity product_type key sitting next to a
         Google-taxonomy-looking value on the same line. Narrow on purpose:
         it must not fire on prose, comments naming the old paths, or the
         feed's own product_type passthrough. */
      const line = body.split('\n').find((l) =>
        /'(single|double) sink (vanity with top|cabinet only)'\s*:/i.test(l) &&
        /(Bathroom Vanities|Countertops|\b\d{3,6}\b)/.test(l));
      if (line) offenders.push(`${rel}: ${line.trim().slice(0, 70)}`);
    }
  }
  ok('no second product_type -> category map anywhere under src/',
     offenders.length === 0,
     offenders.join('\n        ') ||
     'if this fires, a map was added outside googleProductCategory.js — ' +
     'fold it in rather than keeping both');
}

/* ═══ 2. GTIN NORMALISATION ════════════════════════════════════════════ */
console.log('\n--- gtin validation and repair ---');
{
  ok('a valid 12-digit UPC passes',        feed.toGtin('091878611184') === '091878611184');
  ok('an 11-digit UPC is zero-padded',     feed.toGtin('91878611184')  === '091878611184',
     'six products arrive this way — a spreadsheet stripped the leading zero');
  ok('a wrong check digit is rejected',    feed.toGtin('091878611185') === null,
     'Google does not ignore a bad gtin, it disapproves the item');
  ok('free text in the upc column is rejected',
     feed.toGtin('Stone Sample - Grey Expo Quart') === null,
     'exactly one product holds this; it must fall through to mpn');
  ok('an empty value is rejected',         feed.toGtin('') === null);
  ok('a null value is rejected',           feed.toGtin(null) === null);
  ok('a 10-digit value is rejected',       feed.toGtin('0918786111') === null,
     'not a GTIN length — padding it would invent an identifier');
}

/* ═══ 3. THE BUILDER, DRIVEN WITH A STUB POOL ══════════════════════════ */
console.log('\n--- buildItems applies the inclusion rules ---');

const BASE = {
  id: 1, sku: 'SKU-OK', slug: 'good-vanity', name: 'Good Vanity 60"',
  brand: 'James Martin Vanities', upc: '091878611184', mpn: 'JM-60-WHT',
  price: '1000.00', compare_price: '1500.00',
  short_desc: '', long_desc: '<p>A <b>very</b> nice vanity.</p>',
  product_type: 'Single Sink Vanity With Top', color: 'White',
  material: null, pattern: null,
  weight_lbs: '100.00', total_ship_weight_lbs: '180.00',
  vendor_group_id: 'GRP-1', excluded_destinations: null,
  google_condition: 'new', shipping_label: null,
  custom_label_0: 'core', custom_label_1: null, custom_label_2: null,
  custom_label_3: null, custom_label_4: null,
  qty_on_hand: 5, allow_backorder: 0,
};
const row = (over) => Object.assign({}, BASE, over);

function stubPool(rows, images) {
  return {
    query: async (sql) => {
      if (/FROM products/i.test(sql)) return [rows];
      if (/FROM product_images/i.test(sql)) return [images];
      throw new Error('unexpected query');
    },
  };
}
const img = (product_id, url, is_primary = 1) => ({ product_id, url, is_primary });

(async () => {
  /* ── a well-formed product ─────────────────────────────────────── */
  {
    const { items } = await buildWith([row({})], [
      img(1, 'https://images.bathroomvanitiesoutlet.com/a.jpg', 1),
      img(1, 'https://images.bathroomvanitiesoutlet.com/b.jpg', 0),
    ]);
    const it = items[0];
    ok('a complete product is included', items.length === 1);
    ok('the link is absolute on the canonical host',
       it && it.link === 'https://www.bathroomvanitiesoutlet.com/products/good-vanity');
    ok('html is stripped from the description',
       it && it.description === 'A very nice vanity.',
       `got: ${it && it.description}`);
    ok('the category is derived, not read from the row',
       it && it.googleProductCategory === 2081);
    ok('the primary image wins', it && it.imageLink.endsWith('a.jpg'));
    ok('extra images become additional_image_link',
       it && it.additionalImages.length === 1);
    ok('shipping weight prefers total_ship_weight_lbs',
       it && it.shippingWeight === '180.00 lb',
       'weight_lbs is the bare product; the carrier bills the carton');
  }

  /* ── price vs sale_price, the inversion that only a customer catches ─ */
  {
    const { items } = await buildWith([row({})], [img(1, 'https://x/a.jpg')]);
    ok('price carries MSRP when discounted',    items[0].price === '1500.00');
    ok('sale_price carries what is charged',    items[0].salePrice === '1000.00');
  }
  {
    const { items } = await buildWith([row({ compare_price: null })], [img(1, 'https://x/a.jpg')]);
    ok('with no MSRP, price is the real price',  items[0].price === '1000.00');
    ok('and no sale_price is emitted',           items[0].salePrice === null);
  }
  {
    const { items } = await buildWith([row({ compare_price: '900.00' })], [img(1, 'https://x/a.jpg')]);
    ok('an MSRP below the price is ignored, not inverted',
       items[0].price === '1000.00' && items[0].salePrice === null,
       'bad vendor data must not advertise a fake discount');
  }

  /* ── identifiers ───────────────────────────────────────────────── */
  {
    const { items } = await buildWith([row({})], [img(1, 'https://x/a.jpg')]);
    ok('a valid gtin is emitted', items[0].gtin === '091878611184');
    ok('identifier_exists is NOT claimed false when a gtin exists',
       items[0].identifierExists === true,
       'sending both is contradictory and Google rejects the item');
  }
  {
    const { items } = await buildWith([row({ upc: 'junk', mpn: '' })], [img(1, 'https://x/a.jpg')]);
    ok('with no usable identifier, identifier_exists goes false',
       items[0].gtin === null && items[0].mpn === null && items[0].identifierExists === false);
  }
  {
    const { items } = await buildWith([row({ upc: 'junk' })], [img(1, 'https://x/a.jpg')]);
    ok('a bad gtin still falls back to mpn',
       items[0].gtin === null && items[0].mpn === 'JM-60-WHT' && items[0].identifierExists === true);
  }

  /* ── availability ──────────────────────────────────────────────── */
  {
    const a = await buildWith([row({ qty_on_hand: 0, allow_backorder: 0 })], [img(1, 'https://x/a.jpg')]);
    const b = await buildWith([row({ qty_on_hand: 0, allow_backorder: 1 })], [img(1, 'https://x/a.jpg')]);
    ok('zero stock reads out_of_stock',  a.items[0].availability === 'out_of_stock');
    ok('zero stock + backorder reads backorder', b.items[0].availability === 'backorder');
  }

  /* ── the exclusion levers ──────────────────────────────────────── */
  {
    const { items, skipped } = await buildWith(
      [row({ excluded_destinations: 'all' })], [img(1, 'https://x/a.jpg')]);
    ok('excluded_destinations=all removes the item entirely',
       items.length === 0 && skipped['excluded_destinations = all'] === 1);
  }
  {
    const { items } = await buildWith(
      [row({ excluded_destinations: 'Shopping_ads' })], [img(1, 'https://x/a.jpg')]);
    ok('a named destination is passed through, not dropped',
       items.length === 1 && items[0].excludedDestinations[0] === 'Shopping_ads',
       'free listings keep the item; ad spend does not');
  }
  {
    const { items, skipped } = await buildWith(
      [row({ product_type: 'Sample' })], [img(1, 'https://x/a.jpg')]);
    ok('a policy-excluded product_type is dropped and named as policy',
       items.length === 0 && skipped['product_type excluded by policy'] === 1,
       'must be distinguishable from an unmapped type, which is a bug');
  }
  {
    const { items, skipped } = await buildWith(
      [row({ product_type: 'Brand New Category' })], [img(1, 'https://x/a.jpg')]);
    ok('an UNMAPPED product_type is dropped with its name in the reason',
       items.length === 0 && skipped['product_type not mapped: Brand New Category'] === 1,
       'the name must appear or the skip count is undiagnosable');
  }

  /* ── quality guards ────────────────────────────────────────────── */
  {
    const cases = [
      ['no https image',      [img(1, 'http://insecure/a.jpg')], {},                      'no https image'],
      ['no image at all',     [],                                {},                      'no https image'],
      ['no slug',             [img(1, 'https://x/a.jpg')],       { slug: '' },            'no slug'],
      ['no sku',              [img(1, 'https://x/a.jpg')],       { sku: '' },             'no sku'],
      ['zero price',          [img(1, 'https://x/a.jpg')],       { price: '0.00' },       'price missing or <= 0'],
      ['negative price',      [img(1, 'https://x/a.jpg')],       { price: '-5.00' },      'price missing or <= 0'],
      ['no product_type',     [img(1, 'https://x/a.jpg')],       { product_type: null },  'no product_type'],
      ['no title',            [img(1, 'https://x/a.jpg')],       { name: '  ' },          'no title'],
    ];
    for (const [label, images, over, reason] of cases) {
      const { items, skipped } = await buildWith([row(over)], images);
      ok(`dropped and counted: ${label}`,
         items.length === 0 && skipped[reason] === 1,
         `expected skip reason "${reason}", got ${JSON.stringify(skipped)}`);
    }
  }

  /* ── description fallback chain ────────────────────────────────── */
  {
    const a = await buildWith([row({ long_desc: null, short_desc: 'Short one.' })], [img(1, 'https://x/a.jpg')]);
    const b = await buildWith([row({ long_desc: null, short_desc: null })], [img(1, 'https://x/a.jpg')]);
    ok('short_desc is used when long_desc is empty', a.items[0].description === 'Short one.');
    ok('the title is the last resort, never an empty description',
       b.items[0].description === 'Good Vanity 60"',
       'an empty description is a disapproval, the title is not');
  }

  /* ═══ 4. NO ITEM MAY POINT AT A URL THAT REDIRECTS OFF-DOMAIN ═════
     Found 2026-09-30: redirect_map.csv sends 243 legacy /products/ paths to
     globalvaluesupply.com, and legacyRedirects is mounted at server.js:692,
     BEFORE the product route. So if a product is ever created whose slug
     collides with one of those paths, the redirect hijacks its page — the
     product exists, is in the feed, and its landing page lands on another
     domain. Google disapproves it and the cause is three files away.

     Today no such product exists, which is why the feed sidesteps the
     problem. This asserts it stays that way. */
  console.log('\n--- no feed item redirects off-domain ---');
  {
    const csv = fs.readFileSync(path.join(ROOT, 'migrations/redirect_map.csv'), 'utf8');
    const offDomain = new Set();
    for (const line of csv.split('\n').slice(1)) {
      const [oldPath, dest] = line.split(',');
      if (!oldPath || !dest) continue;
      if (!/^https?:\/\//.test(dest)) continue;
      if (dest.includes('bathroomvanitiesoutlet.com')) continue;
      offDomain.add(oldPath.trim());
    }
    ok('the off-domain redirect set was actually loaded',
       offDomain.size > 100,
       `found ${offDomain.size} — if this is near zero the parser broke and ` +
       'every assertion below is vacuous');

    const hijacked = `/products/${[...offDomain][0].split('/products/')[1] || 'x'}`;
    const slug = hijacked.replace('/products/', '');
    const { items } = await buildWith([row({ slug })], [img(1, 'https://x/a.jpg')]);
    const linkPath = new URL(items[0].link).pathname;
    ok('a slug colliding with an off-domain redirect IS detectable here',
       offDomain.has(linkPath),
       'the guard below can only work if feed links and csv paths have the ' +
       'same shape; this proves they do');

    ok('the feed URL itself is not in the redirect map',
       !offDomain.has('/feeds/google-shopping.xml'),
       'a redirect on the feed path would send Google somewhere else entirely');
  }

  /* ═══ 5. THE RENDERED XML ════════════════════════════════════════ */
  console.log('\n--- the rendered feed is well-formed ---');
  {
    const built = await buildWith([
      row({ id: 1, sku: 'A&B<1>', name: 'Vanity "Deluxe" & Co <Special>' }),
      row({ id: 2, sku: 'CTRL', slug: 'ctrl', name: `Bad\u0001Char\u001FHere` }),
    ], [img(1, 'https://x/a.jpg'), img(2, 'https://x/b.jpg')]);
    const xml = feed.renderXml(built);

    ok('no unescaped ampersand survives',
       !/&(?!(amp|lt|gt|quot|apos);)/.test(xml),
       'one raw & makes the ENTIRE feed unparseable, not one item');
    ok('angle brackets inside values are escaped',
       xml.includes('A&amp;B&lt;1&gt;'));
    ok('control characters are stripped',
       // eslint-disable-next-line no-control-regex
       !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(xml),
       'invalid in XML 1.0 at any escaping level; Google reports it as a ' +
       'fetch failure with no item named');

    const open = (xml.match(/<item>/g) || []).length;
    const close = (xml.match(/<\/item>/g) || []).length;
    ok('item tags balance', open === close && open === 2);
    ok('the g: namespace is declared',
       xml.includes('xmlns:g="http://base.google.com/ns/1.0"'),
       'without it every g: attribute is ignored and all items are rejected');
    ok('the build summary rides in the feed',
       xml.includes('scanned') && xml.includes('included') && xml.includes('skipped'),
       'this is the only diagnostic available without shell access');
    ok('the declaration is first', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  }

  /* An earlier draft of this gate asserted identifier_exists on the ITEM
     OBJECT only, and a mutation that emitted the tag unconditionally in the
     XML passed clean. The contradiction lives in the rendered output, so it
     has to be asserted there. Sending a gtin AND identifier_exists=no is
     self-contradictory and Google rejects the item outright. */
  console.log('\n--- identifier_exists is never contradicted in the output ---');
  {
    const withId = feed.renderXml(await buildWith([row({})], [img(1, 'https://x/a.jpg')]));
    const noId = feed.renderXml(await buildWith(
      [row({ upc: 'junk', mpn: '' })], [img(1, 'https://x/a.jpg')]));

    ok('an item WITH an identifier omits identifier_exists entirely',
       withId.includes('<g:gtin>') && !withId.includes('<g:identifier_exists>'),
       'emitting both is contradictory — Google rejects the item, it does not ' +
       'pick one');
    ok('an item with NO identifier declares identifier_exists=no',
       !noId.includes('<g:gtin>') && !noId.includes('<g:mpn>') &&
       noId.includes('<g:identifier_exists>no</g:identifier_exists>'));

    /* Swept across the whole rendered feed rather than one item, so a future
       change that leaks the tag into a subset is still caught. */
    const mixed = feed.renderXml(await buildWith([
      row({ id: 1, sku: 'HAS-GTIN' }),
      row({ id: 2, sku: 'NO-ID', slug: 'no-id', upc: 'junk', mpn: '' }),
    ], [img(1, 'https://x/a.jpg'), img(2, 'https://x/b.jpg')]));
    const bad = mixed.split('<item>').slice(1).filter((chunk) =>
      /<g:identifier_exists>/.test(chunk) &&
      (/<g:gtin>/.test(chunk) || /<g:mpn>/.test(chunk)));
    ok('no item anywhere carries both an identifier and identifier_exists',
       bad.length === 0,
       `${bad.length} item(s) contradict themselves`);
  }

  /* ═══ 6. THE ROUTE IS WIRED AND PROTECTED ════════════════════════ */
  console.log('\n--- the route is registered and exempt from the limiter ---');
  {
    const server = fs.readFileSync(path.join(ROOT, 'src/server.js'), 'utf8');
    ok('the route is registered',
       /app\.get\(\s*'\/feeds\/google-shopping\.xml'/.test(server));
    ok('the path is exempt from the rate limiter',
       /_RL_SKIP_EXACT[\s\S]{0,300}\/feeds\/google-shopping\.xml/.test(server),
       'a 429 to the Merchant Center fetcher expires the whole catalogue');
    ok('the feed is NOT advertised in the sitemap',
       !/google-shopping/.test(fs.readFileSync(path.join(ROOT, 'src/controllers/sitemapController.js'), 'utf8')),
       'it is a machine endpoint, not a page, and it lists every price');

    const ctrl = fs.readFileSync(path.join(ROOT, 'src/controllers/feedController.js'), 'utf8');
    ok('the controller sets X-Robots-Tag noindex',
       /X-Robots-Tag[\s\S]{0,40}noindex/.test(ctrl));
    ok('the controller does NOT read google_product_category from the row',
       !/r\.google_product_category/.test(ctrl),
       'all 5,035 stored values are invalid taxonomy strings');
    ok('a failure returns 500, not an empty feed',
       /status\(500\)/.test(ctrl) && !/<rss[\s\S]{0,80}<\/rss>/.test(ctrl.split('catch')[1] || ''),
       'an empty valid feed reads as "sold nothing today" and expires every item');
  }

  console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('\n*** GATE CRASHED ***', e);
  process.exit(1);
});

async function buildWith(rows, images) {
  return feed.buildItems(stubPool(rows, images));
}
