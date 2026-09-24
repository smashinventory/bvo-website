#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   BUILD THE URL MIGRATION MAP.

   Reads the 661 indexed old URLs out of the Search Console export, reads the
   live new-site sitemap, and emits one row per old URL saying exactly where
   it should go and how confident we are.

   This script DECIDES NOTHING ON ITS OWN that a human has not already
   decided. Collection routing comes from COLLECTION_MAP below, which encodes
   the routing Sam settled on 2026-09-24:

       most old collections  -> the new BVO site
       brands/stock not on BVO -> GVS (globalvaluesupply.com)
       everything Ethan Roth -> GVS

   Products are matched by slug and nothing else. A product that does not
   match exactly comes out as REVIEW, never as a guess. Guessing here is how
   you end up with 200 redirects pointing at plausible-looking wrong items,
   which is worse than a 410 because nobody ever finds out.

   WHY THE SITEMAP AND NOT THE DB: the DB holds products; the sitemap holds
   what is actually PUBLISHED and reachable. A redirect to an unpublished
   product is a 404 with extra steps.

   Re-runnable. Run it again whenever the catalogue changes and diff the
   output — REVIEW rows should only ever go down.

   Usage:
       node scripts/buildRedirectMap.js
       node scripts/buildRedirectMap.js --new-site https://example.com
   ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const https = require('https');

/* ── Config ───────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const arg  = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

// The host currently SERVING the new site. Not the canonical hostname —
// during staging these differ, and we need the one that answers.
const NEW_SITE = arg('--new-site', 'https://slategrey-falcon-350174.hostingersite.com');

// Where redirects should POINT. Written www, because that is the canonical.
const BVO = 'https://www.bathroomvanitiesoutlet.com';

// GVS canonicalises to NON-www. Writing www here would make every
// cross-domain redirect a two-hop chain: old -> www.gvs -> gvs.
const GVS = 'https://globalvaluesupply.com';

const REPO_ROOT = path.resolve(__dirname, '..');
const PROJECT   = path.resolve(REPO_ROOT, '..');

const GSC_TABLE = path.join(
  PROJECT,
  'bathroomvanitiesoutlet.com-Coverage-2026-09-24',
  'bathroomvanitiesoutlet.com-Coverage-Valid-2026-09-24',
  'Table.csv'
);

const OUT_DIR = path.join(PROJECT, 'migration');
const OUT_MAP = path.join(OUT_DIR, 'redirect_map.csv');
const OUT_REV = path.join(OUT_DIR, 'redirect_review.csv');

/* ── Collection routing — the human decisions, in one table ───────────── */
/*
   dest      : absolute destination URL
   why       : shown in the CSV so a reviewer can tell WHY, not just WHERE
   confidence: HIGH  = like-for-like, the new page shows the same things
               MED   = reasonable but broader/narrower than the original
*/
const C = (dest, why, confidence) => ({ dest, why, confidence });

const COLLECTION_MAP = {
  // ── stays on BVO ────────────────────────────────────────────────────
  'bathroom-vanities':
    C(`${BVO}/collections/bathroom-vanities`, 'direct equivalent', 'HIGH'),
  'bathroom-vanities-1':
    C(`${BVO}/collections/bathroom-vanities`, 'duplicate of bathroom-vanities', 'HIGH'),
  'all-products':
    C(`${BVO}/collections`, 'catch-all index', 'MED'),
  'all':
    C(`${BVO}/collections`, 'catch-all index', 'MED'),
  'wood-bathroom-vanity-cabinets':
    C(`${BVO}/collections/bathroom-vanity-cabinets`, 'cabinets-only equivalent', 'HIGH'),
  'double-bathroom-vanity':
    C(`${BVO}/collections/bathroom-vanities?sink_count=2`, 'double-sink filter', 'MED'),
  'bathroom-vanities-80-inches-plus':
    C(`${BVO}/collections/bathroom-vanities?min_size_in=80`, '80in-plus filter', 'MED'),
  'james-martin-bathroom-vanities':
    C(`${BVO}/collections/bathroom-vanities?brand=James%20Martin`, 'brand filter', 'HIGH'),
  // Not in the GSC export, but it IS the parent of many nested product paths
  // in the Shopify redirect table. Needed so those resolve rather than 410.
  'james-martin-vanities':
    C(`${BVO}/collections/bathroom-vanities?brand=James%20Martin`, 'brand filter', 'HIGH'),
  'bathroom-vanity-wall-mirrors':
    C(`${BVO}/collections/bathroom-mirrors`, 'direct equivalent', 'HIGH'),

  // ── goes to GVS — not carried on the new BVO catalogue ──────────────
  'in-stock-bathroom-vanities-at-norcross':
    C(`${GVS}/collections/bathroom-vanities-outlet`, 'in-stock showroom stock lives on GVS', 'HIGH'),
  'in-stock-bathroom-vanity-tops-with-sink':
    C(`${GVS}/collections/bathroom-vanities-outlet`, 'in-stock tops live on GVS', 'MED'),
  'in-stock-bathroom-vanity-tops-without-sink':
    C(`${GVS}/collections/bathroom-vanities-outlet`, 'in-stock tops live on GVS', 'MED'),
  'freestanding-and-other-tubs':
    C(`${GVS}/collections/bathroom-vanities-outlet`, 'tubs not carried on new BVO', 'MED'),
  'in-stock-faucets-and-fixtures-norcross-showroom':
    C(`${GVS}/collections/bathroom-vanities-outlet`, 'showroom fixtures live on GVS', 'MED'),
  'nearme-bath-vanity-collection':
    C(`${GVS}/collections/bathroom-vanities-outlet`, 'Nearme brand lives on GVS', 'HIGH'),
  'atlanta-vanities-bathworks':
    C(`${GVS}/collections/bathroom-vanities-outlet`, 'Atlanta V&B brand lives on GVS', 'HIGH'),
  'er-vanities':
    C(`${GVS}/collections/bathroom-vanities-outlet`, 'Ethan Roth -> GVS per 2026-09-24', 'HIGH'),
  'ethan-roth-vanities':
    C(`${GVS}/collections/bathroom-vanities-outlet`, 'Ethan Roth -> GVS per 2026-09-24', 'HIGH'),
};

/* Old /pages/* handles that have a real new-site equivalent. Anything not
   listed here falls through to REVIEW — a policy page for a brand we no
   longer carry should probably 410, but that is Sam's call, not mine. */
/* ── Hand-matched products — Sam's review, 2026-09-24 ─────────────────
   These matched nothing by slug on either catalogue, so each was looked at
   individually and searched for by model name across all 6,047 BVO and
   5,081 GVS slugs. Exact overrides only; anything not listed falls through
   to the category rules below. */
const PRODUCT_OVERRIDES = {
  // Confident: same product, the handle simply differs.
  '24-osa-teak-vanity-natural-teak-vanity-cabinet-only':
    [`${GVS}/products/osa-24-vanity-in-natural-teak-base-only`, 'HIGH', 'hand-matched: same product on GVS'],
  'clifden-36-white-vanity-with-quartz-top':
    [`${GVS}/products/clifden-36-vanity-in-white-with-stone-top`, 'HIGH', 'hand-matched: same product on GVS'],
  'bristol-29-5-in-all-wood-vanity-in-natural-white-ash-cabinet-only-copy':
    [`${BVO}/products/bristol-29-5-bathroom-vanity-in-natural-white-ash`, 'HIGH', 'hand-matched: same product on BVO'],

  // Colour-only swap. Same model, same size, different finish — the shopper
  // lands on the vanity they searched for and can see that it exists.
  'marietta-53-5-inch-single-bathroom-vanity-in-blue':
    [`${GVS}/products/marietta-53-5-inch-single-bathroom-vanity-in-white`, 'MED',
     'hand-matched: same model+size, colour differs (blue not made in 53.5)'],
  'york-60-in-vanities-in-grey':
    [`${GVS}/products/york-60-in-vanities-in-navy-blue`, 'MED',
     'hand-matched: same model+size, colour differs'],

  // SIZE mismatches deliberately NOT matched to a product. Someone shopping
  // a 24in vanity cannot use a 36in one — that is a bounce, not a sale. They
  // go to the vanities collection filtered to the size they actually wanted,
  // which is a real answer to the question they were asking.
  'clifden-24-white-vanity-with-quartz-top':
    [`${BVO}/collections/bathroom-vanities?size_in=24`, 'MED',
     'hand-reviewed: only a 36in Clifden exists; size intent preserved instead'],
  'clifden-30-white-vanity-with-quartz-top':
    [`${BVO}/collections/bathroom-vanities?size_in=30`, 'MED',
     'hand-reviewed: only a 36in Clifden exists; size intent preserved instead'],
  '30-bradford-vanity-in-walnut-with-pure-white-quartz-top':
    [`${BVO}/collections/bathroom-vanities?size_in=30`, 'MED',
     'hand-reviewed: only a 36in Bradford exists; size intent preserved instead'],
  '60-portage-peak-vanity-in-light-oak':
    [`${BVO}/collections/bathroom-vanities?size_in=60`, 'MED',
     'hand-reviewed: Portage Peak differs on BOTH size and colour'],
};

/* Models confirmed absent from BOTH catalogues on 2026-09-24 — searched by
   name across every BVO and GVS slug, not assumed. Routed to the vanities
   collection at the size in the handle, because the size is the part of the
   shopper's intent still worth honouring. */
const DISCONTINUED_MODELS =
  /^(the-gabi-|24-adare-|80-avery-|sheffield-80-|grand-84-|24-droplet-|80-inch-all-wood-double)/;

/* ── Category fallbacks for products with no equivalent ───────────────
   Sam's call, 2026-09-24: category redirect rather than 410. At ~64 URLs
   the soft-404 risk is low and a shopper lands somewhere usable. All four
   BVO destinations were checked live and return 200 with products on the
   page — a redirect to an empty collection is a dead end with extra steps.
   Order matters: first match wins. */
const PRODUCT_CATEGORY_RULES = [
  [/tier-\d+-(top-)?add-on|quartz-top-add-on|top-add-on|^stock-top/,
   `${BVO}/collections/bathroom-vanity-tops`, 'vanity top / add-on with no standalone page'],
  [/^(delta|grohe|pfister|moen|kohler|danze|gerber|american-standard|porter|pivotal|silverton|arkitek)|faucet|tissue-holder|mixing-valve/,
   `${BVO}/collections/faucets`, 'discontinued third-party faucet/fixture'],
  [/^elegant-(decor|lighting)|^mr[0-9a-z]{4,}|mirror/,
   `${BVO}/collections/bathroom-mirrors`, 'discontinued mirror'],
  [/tub/,
   `${GVS}/collections/bathroom-vanities-outlet`, 'freestanding tub — new BVO carries none; GVS does'],
  [/shower|valve/,
   `${GVS}/collections/bathroom-vanities-outlet`, 'shower door/valve — new BVO carries none; GVS does'],
  [/vanity|cabinet/,
   `${BVO}/collections/bathroom-vanities`, 'vanity with no equivalent on either catalogue'],
];

/* Genuinely nothing to point at, on either site, in any category. */
const GONE = /vinyl-plank|^appointment$/;

/* Pull a size out of a handle so the collection destination can keep it.
   Matches 24-foo, foo-36-inch, foo-59-5-inch. Ignores anything over 96
   (model numbers, SKUs) and under 18 (thickness, quantities). */
function sizeFromHandle(h) {
  const m = /(?:^|-)(\d{2})(?:-5)?(?:-|$|inch|in)/.exec(h);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 18 && n <= 96 ? n : null;
}

const PAGE_MAP = {
  'about-us':        `${BVO}/pages/about-us`,
  'contact-us':      `${BVO}/pages/contact-us`,
  'privacy-policy':  `${BVO}/pages/privacy-policy`,

  // ── Sam's review, 2026-09-24 ────────────────────────────────────────
  // Brand policy pages. All three are LIVE on Shopify (checked, 200), and
  // all three say the same thing in brand-specific words: how returns work.
  // The new site states that once, so they converge.
  'james-martin-policies':     `${BVO}/pages/returns-policy`,
  'kube-bath-policies':        `${BVO}/pages/returns-policy`,
  'delta-faucet-return-policy': `${BVO}/pages/returns-policy`,

  // Appointments still happen, handled through the contact form.
  'appointment-scheduler':     `${BVO}/pages/contact-us`,

  // ALREADY 404 ON SHOPIFY as of 2026-09-24 — verified, not assumed. These
  // sit in the GSC "Valid" export only because Google's last crawl predates
  // their deletion, so there is no live ranking to preserve and the redirect
  // inherits nothing. Mapped anyway (costs nothing, avoids a second 404),
  // and Sam is rebuilding both as new location pages. RE-POINT THESE at the
  // new pages when they exist — that is where the local value will come
  // from, not from this redirect.
  'bathroom-vanities-near-norcross-location-info':
    `${BVO}/collections/bathroom-vanities`,
  'bathroom-vanities-atlanta-ga-norcross-roswell-marietta':
    `${BVO}/collections/bathroom-vanities`,
};

/* Old blog posts. Both are LIVE on Shopify with real content. The new
   site's /blog is EMPTY ("No posts yet"), so pointing informational URLs
   there would land a reader on nothing — /inspiration carries the 11 real
   guides and is the honest destination until the posts are migrated. */
const BLOG_MAP = {
  'bathroom-vanity-with-top-selecting-the-right-combo-matters':
    [`${BVO}/inspiration/bathroom-vanity-buying-guide`, 'closest guide on the same topic'],
  'single-sink-bathroom-vanity-cabinets-what-you-should-consider-when-buying':
    [`${BVO}/inspiration/how-to-choose-a-bathroom-vanity`, 'closest guide on the same topic'],
};
const BLOG_INDEX = `${BVO}/inspiration`;

/* ── Helpers ──────────────────────────────────────────────────────────── */

function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects: ' + url));
    https.get(url, { headers: { 'User-Agent': 'BVO-migration/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).href, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let b = '';
      res.setEncoding('utf8');
      res.on('data', c => { b += c; });
      res.on('end', () => resolve(b));
    }).on('error', reject);
  });
}

/* Strip everything that is not the path we match on:
     - the scheme/host, www or not
     - Shopify's pr_* recommendation tracking params
     - trailing slash
   Query params we CARE about (page, constraint, q) are preserved. */
function normalise(raw) {
  let u;
  try { u = new URL(raw.trim()); } catch { return null; }
  const keep = new URLSearchParams();
  for (const [k, v] of u.searchParams) {
    if (k.startsWith('pr_') || k.startsWith('utm_')) continue;
    keep.set(k, v);
  }
  let p = u.pathname.replace(/\/+$/, '') || '/';
  const q = keep.toString();
  return { path: p, query: q, full: p + (q ? '?' + q : '') };
}

function csvCell(s) {
  s = String(s == null ? '' : s);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/* ── Classification ───────────────────────────────────────────────────── */

/*
   Returns { dest, status, confidence, why }

   status is what the middleware will DO:
     301     permanent redirect to dest
     410     gone — deliberately, because nothing on either site matches
     REVIEW  a human has to decide; the middleware must not ship with these
*/
function classify(n, newProductSlugs, newCollectionSlugs, gvsProductSlugs) {
  const seg = n.path.split('/').filter(Boolean);

  // ── home ───────────────────────────────────────────────────────────
  if (seg.length === 0) {
    return { dest: `${BVO}/`, status: 301, confidence: 'HIGH', why: 'homepage' };
  }

  // ── /products/<handle>  and  /collections/<c>/products/<handle> ────
  const pIdx = seg.indexOf('products');
  if (pIdx >= 0 && seg[pIdx + 1]) {
    const handle = seg[pIdx + 1];
    if (newProductSlugs.has(handle)) {
      return {
        dest: `${BVO}/products/${handle}`,
        status: 301, confidence: 'HIGH',
        why: pIdx === 0 ? 'exact slug match' : 'exact slug match (nested path stripped)',
      };
    }
    // TIER 2 — the same product on GVS.
    //
    // Both catalogues were fed from the same source, so a product dropped
    // from the new BVO often still exists on GVS under the IDENTICAL handle.
    // That is an exact, verifiable match to a real product page — far better
    // than sweeping the URL onto a collection, which Google reads as a soft
    // 404 when you do it a few hundred times.
    if (gvsProductSlugs.has(handle)) {
      return {
        dest: `${GVS}/products/${handle}`,
        status: 301, confidence: 'HIGH',
        why: 'not on new BVO; exact same handle exists on GVS',
      };
    }

    // Shopify appends -1, -2 ... to de-duplicate handles, and "copy-of-" to
    // duplicated products. Strip those and try again — same product, and the
    // suffix is an artefact of the old store, not a different item.
    const stripped = handle.replace(/^copy-of-/, '').replace(/-\d+$/, '');
    if (stripped !== handle) {
      if (newProductSlugs.has(stripped)) {
        return {
          dest: `${BVO}/products/${stripped}`,
          status: 301, confidence: 'MED',
          why: `Shopify duplicate handle; matched base slug "${stripped}" on BVO`,
        };
      }
      if (gvsProductSlugs.has(stripped)) {
        return {
          dest: `${GVS}/products/${stripped}`,
          status: 301, confidence: 'MED',
          why: `Shopify duplicate handle; matched base slug "${stripped}" on GVS`,
        };
      }
    }

    // Nested under a collection we route to GVS? Then the product is a
    // GVS product, and the collection page is the honest destination.
    if (pIdx > 0 && COLLECTION_MAP[seg[1]] && COLLECTION_MAP[seg[1]].dest.startsWith(GVS)) {
      return {
        dest: COLLECTION_MAP[seg[1]].dest,
        status: 301, confidence: 'MED',
        why: `product not on new BVO; parent collection routes to GVS (${seg[1]})`,
      };
    }
    // TIER 4 — hand-matched by Sam, 2026-09-24.
    if (PRODUCT_OVERRIDES[handle]) {
      const [dest, confidence, why] = PRODUCT_OVERRIDES[handle];
      return { dest, status: 301, confidence, why };
    }

    // TIER 5 — model confirmed discontinued on both catalogues. Keep the
    // size, lose the model.
    if (DISCONTINUED_MODELS.test(handle)) {
      const size = sizeFromHandle(handle);
      return {
        dest: `${BVO}/collections/bathroom-vanities` + (size ? `?size_in=${size}` : ''),
        status: 301, confidence: 'MED',
        why: `model discontinued on both catalogues${size ? `; ${size}in size intent preserved` : ''}`,
      };
    }

    // TIER 6 — nothing anywhere, in any category.
    if (GONE.test(handle)) {
      return { dest: '', status: 410, confidence: 'HIGH', why: 'no equivalent in any category on either site' };
    }

    // TIER 7 — category fallback.
    for (const [re, dest, why] of PRODUCT_CATEGORY_RULES) {
      if (re.test(handle)) return { dest, status: 301, confidence: 'MED', why };
    }

    return {
      dest: '', status: 'REVIEW', confidence: 'NONE',
      why: 'no new product with this slug and no category rule matched — decide by hand',
    };
  }

  // ── /collections/... ───────────────────────────────────────────────
  if (seg[0] === 'collections') {
    const handle = seg[1];

    if (!handle) {
      return { dest: `${BVO}/collections`, status: 301, confidence: 'HIGH', why: 'collection index' };
    }

    // /collections/types?q=... — Shopify search-style URLs.
    if (handle === 'types') {
      const qs = new URLSearchParams(n.query);
      const constraint = qs.get('constraint') || '';
      const m = /^(\d+)-inch/.exec(constraint);
      if (m) {
        return {
          dest: `${BVO}/collections/bathroom-vanities?size_in=${m[1]}`,
          status: 301, confidence: 'MED',
          why: `types/constraint=${constraint} -> size_in=${m[1]}`,
        };
      }
      return {
        dest: `${BVO}/collections/bathroom-vanities`, status: 301, confidence: 'MED',
        why: 'types/* search URL with no size constraint',
      };
    }

    const hit = COLLECTION_MAP[handle];
    if (!hit) {
      return {
        dest: '', status: 'REVIEW', confidence: 'NONE',
        why: `collection handle "${handle}" is not in COLLECTION_MAP — add it`,
      };
    }

    // Shopify puts the tag in a PATH segment: /collections/<handle>/<tag>
    // and paginates with ?page=. Neither survives; both collapse onto the
    // destination collection. Page 2 of a dead collection has no equivalent
    // and sending it to page 2 of a different collection is meaningless.
    const extra = seg.slice(2);
    if (extra.length) {
      return {
        dest: hit.dest, status: 301,
        confidence: hit.confidence === 'HIGH' ? 'MED' : hit.confidence,
        why: `${hit.why}; tag segment "${extra.join('/')}" dropped`,
      };
    }
    if (n.query) {
      return {
        dest: hit.dest, status: 301,
        confidence: hit.confidence === 'HIGH' ? 'MED' : hit.confidence,
        why: `${hit.why}; query "${n.query}" dropped`,
      };
    }
    return { dest: hit.dest, status: 301, confidence: hit.confidence, why: hit.why };
  }

  // ── /pages/<handle> ────────────────────────────────────────────────
  if (seg[0] === 'pages') {
    const handle = seg[1] || '';
    if (PAGE_MAP[handle]) {
      return { dest: PAGE_MAP[handle], status: 301, confidence: 'HIGH', why: 'direct page equivalent' };
    }
    return {
      dest: '', status: 'REVIEW', confidence: 'NONE',
      why: `page "${handle}" has no new equivalent — decide: write the page, redirect, or 410`,
    };
  }

  // ── /blogs/news[/<handle>] ─────────────────────────────────────────
  if (seg[0] === 'blogs') {
    if (seg[2] === 'tagged' || seg[1] === 'tagged') {
      return { dest: BLOG_INDEX, status: 301, confidence: 'MED', why: 'blog tag index -> inspiration hub' };
    }
    if (seg[2]) {
      if (BLOG_MAP[seg[2]]) {
        const [dest, why] = BLOG_MAP[seg[2]];
        return { dest, status: 301, confidence: 'MED', why };
      }
      return {
        dest: '', status: 'REVIEW', confidence: 'NONE',
        why: `blog post "${seg[2]}" — does it exist on the new site? migrate it or 410`,
      };
    }
    return { dest: BLOG_INDEX, status: 301, confidence: 'MED', why: 'blog index -> inspiration hub (/blog is empty)' };
  }

  // ── /search ────────────────────────────────────────────────────────
  if (seg[0] === 'search') {
    return { dest: `${BVO}/search`, status: 301, confidence: 'HIGH', why: 'search page' };
  }

  return {
    dest: '', status: 'REVIEW', confidence: 'NONE',
    why: 'unrecognised URL shape',
  };
}

/* ── Main ─────────────────────────────────────────────────────────────── */

(async function main() {
  if (!fs.existsSync(GSC_TABLE)) {
    console.error(`\n  ✗ Cannot find the Search Console export:\n    ${GSC_TABLE}\n`);
    process.exit(1);
  }

  console.log('\n── Building the redirect map ──────────────────────────────\n');

  // 1. old URLs
  const rows = fs.readFileSync(GSC_TABLE, 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
  const olds = [];
  const seen = new Set();
  for (const line of rows) {
    // "URL,Last crawled" — the URL may be quoted if it contains a comma.
    const m = /^("([^"]*)"|[^,]*),/.exec(line);
    const raw = m ? (m[2] !== undefined ? m[2] : m[1]) : line;
    const n = normalise(raw);
    if (!n) { console.warn(`  ! unparseable row: ${line.slice(0, 80)}`); continue; }
    if (seen.has(n.full)) continue;
    seen.add(n.full);
    olds.push(n);
  }
  console.log(`  ${olds.length} distinct old URLs read from the GSC export`);

  // 2. new URLs
  // --sitemap-file lets this run with no network (CI, an offline check, or a
  // saved sitemap from a point in time you want to diff against).
  const sitemapFile = arg('--sitemap-file', '');
  let xml;
  if (sitemapFile) {
    console.log(`  reading ${sitemapFile} ...`);
    xml = fs.readFileSync(sitemapFile, 'utf8');
  } else {
    console.log(`  fetching ${NEW_SITE}/sitemap.xml ...`);
    xml = await get(`${NEW_SITE}/sitemap.xml`);
  }
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const newProductSlugs   = new Set();
  const newCollectionSlugs = new Set();
  for (const l of locs) {
    const p = new URL(l).pathname.replace(/\/+$/, '');
    const s = p.split('/').filter(Boolean);
    if (s[0] === 'products' && s[1])    newProductSlugs.add(s[1]);
    if (s[0] === 'collections' && s[1]) newCollectionSlugs.add(s[1]);
  }
  console.log(`  ${locs.length} new URLs (${newProductSlugs.size} products, ${newCollectionSlugs.size} collections)\n`);

  if (newProductSlugs.size === 0) {
    console.error('  ✗ The sitemap yielded zero products. Refusing to write a map that would 410 the catalogue.\n');
    process.exit(1);
  }

  // 2b. GVS product slugs — the second match tier.
  //
  // GVS is Shopify, so /sitemap.xml is an INDEX pointing at per-chunk product
  // sitemaps. Walk it. If GVS is unreachable we carry on with an empty set:
  // the map degrades to "more REVIEW rows", never to a wrong destination.
  const gvsProductSlugs = new Set();
  try {
    console.log(`  fetching ${GVS}/sitemap.xml (index) ...`);
    const idx = await get(`${GVS}/sitemap.xml`);
    const children = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(m => m[1])
      .filter(u => /sitemap_products/.test(u));
    for (const child of children) {
      const cx = await get(child);
      for (const m of cx.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        const s = new URL(m[1]).pathname.replace(/\/+$/, '').split('/').filter(Boolean);
        if (s[0] === 'products' && s[1]) gvsProductSlugs.add(s[1]);
      }
    }
    console.log(`  ${gvsProductSlugs.size} GVS products across ${children.length} sitemap chunks\n`);
  } catch (e) {
    console.warn(`  ! GVS sitemap unavailable (${e.message}).`);
    console.warn(`    Continuing — GVS-matched rows will fall through to REVIEW.\n`);
  }

  // 3. classify
  const out = [];
  for (const n of olds) {
    const r = classify(n, newProductSlugs, newCollectionSlugs, gvsProductSlugs);
    out.push({ old: n.full, ...r });
  }

  // 4. write
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const header = 'old_path,destination,status,confidence,why';
  const line = r => [r.old, r.dest, r.status, r.confidence, r.why].map(csvCell).join(',');

  fs.writeFileSync(OUT_MAP, [header, ...out.map(line)].join('\n') + '\n');
  const review = out.filter(r => r.status === 'REVIEW');
  fs.writeFileSync(OUT_REV, [header, ...review.map(line)].join('\n') + '\n');

  // 5. report
  const by = k => out.reduce((a, r) => (a[r[k]] = (a[r[k]] || 0) + 1, a), {});
  const kind = r => {
    const s = r.old.split('/').filter(Boolean)[0] || 'home';
    return r.old.includes('/products/') ? 'products' : s;
  };
  const kinds = out.reduce((a, r) => (a[kind(r)] = a[kind(r)] || { ok: 0, review: 0 },
    r.status === 'REVIEW' ? a[kind(r)].review++ : a[kind(r)].ok++, a), {});

  console.log('  by status:     ', JSON.stringify(by('status')));
  console.log('  by confidence: ', JSON.stringify(by('confidence')));
  console.log('');
  console.log('  resolved / needs review, by URL type:');
  for (const [k, v] of Object.entries(kinds).sort((a, b) => b[1].review - a[1].review)) {
    console.log(`    ${k.padEnd(14)} ${String(v.ok).padStart(4)} resolved   ${String(v.review).padStart(4)} review`);
  }
  console.log('');
  console.log(`  full map     -> ${OUT_MAP}`);
  console.log(`  needs review -> ${OUT_REV}  (${review.length} rows)`);
  console.log('\n───────────────────────────────────────────────────────────\n');
})().catch(e => {
  console.error('\n  ✗ ' + e.message + '\n');
  process.exit(1);
});
