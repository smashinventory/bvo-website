'use strict';
/* Gate: one canonical host, checked against the SERVED RESPONSE.  2026-10-06
 *
 * ── WHY THIS ONE EXISTS ───────────────────────────────────────────────
 *
 * The site used to disagree with itself about its own address. Sixteen
 * files carried `process.env.SITE_URL || '<literal>'` with TWO different
 * literals, so whenever SITE_URL was absent the canonical tag and the
 * sitemap named the apex while robots.txt and the 301 named www. Two of
 * them went further and built absolute URLs from `req.get('host')` — a
 * canonical tag on /search, and the /account/secure link inside the
 * "new device" security email.
 *
 * utils/siteUrl.js is now the only source, and gate_cutover_config.js
 * proves that at the source level. This gate proves it at the only level
 * that counts: what a crawler actually receives.
 *
 * ── THE INVARIANT ─────────────────────────────────────────────────────
 *
 *     Every absolute URL the site PUBLISHES names the configured
 *     canonical host — regardless of which hostname the request
 *     arrived on.
 *
 * That last clause is the whole point. Run this with BVO_BASE pointed at
 * the temp hostingersite host, or at the apex, and the canonical tags
 * must STILL say www. If they follow the request host, the regression is
 * back and this gate fails. A test that only ever runs against the
 * canonical host cannot see the bug it was written for.
 *
 * ── WHEN IT CANNOT RUN ────────────────────────────────────────────────
 * It needs a reachable site. Unreachable exits NON-ZERO rather than
 * passing quietly: "could not check" is not "fine".
 *
 *   node gates/gate_canonical_host_live.js
 *   BVO_BASE=https://slategrey-falcon-350174.hostingersite.com node gates/...
 */

const siteUrl = require('../src/utils/siteUrl');

const CANONICAL = siteUrl.host();                 // what everything must say
const BASE      = (process.env.BVO_BASE || siteUrl.base()).replace(/\/+$/, '');
const APEX      = CANONICAL.replace(/^www\./, '');

/* One of each page type that publishes absolute URLs. */
const PAGES = [
  { name: 'home',            path: '/' },
  { name: 'collection',      path: '/collections/bathroom-vanities' },
  { name: 'inspiration hub', path: '/inspiration' },
  { name: 'search (was built from the request host)', path: '/search?q=vanity' },
];

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};
const die = (msg) => {
  console.log(`\n  FAIL  ${msg}`);
  console.log('\n*** GATE COULD NOT RUN — treated as a FAILURE on purpose. ***');
  process.exit(1);
};
const hostOf = (u) => { try { return new URL(u).host.toLowerCase(); } catch { return null; } };

/* ── WHICH JSON-LD PROPERTIES ARE ALLOWED TO BE FOREIGN ──────────────────
   ⚠️ `sameAs` IS EXTERNAL BY DESIGN AND MUST NEVER BE HOST-CHECKED. It is
   the schema.org property for "this entity's identity on other platforms"
   — our Facebook, X, Pinterest, Yelp and LinkedIn profiles
   (structuredData.js:102, read from theme settings). A sameAs that named
   www.bathroomvanitiesoutlet.com would be meaningless; the property exists
   precisely to point somewhere else.

   This gate failed all three page types on exactly those three URLs. It did
   not catch a regression: it went red because the owner FILLED IN the social
   URLs in the Theme Editor, i.e. because the markup became more correct.
   Same shape as Wave 2 breaking gate_sample_offer — see Rule 22. The rule
   this check means to enforce is "every URL that refers to OUR OWN content
   names the canonical host", and sameAs refers to someone else's by
   definition.

   Deliberately NOT exempted: url, @id, item, logo, image, contentUrl,
   thumbnailUrl, mainEntityOfPage, target. Those all denote our resources
   and a foreign host in any of them is the real defect this guards. */
const EXTERNAL_BY_DESIGN = new Set(['sameAs']);

/* Walk the parsed graph and collect only URLs that should be ours.
   Parsing beats regexing the raw text: a regex cannot tell which PROPERTY a
   URL sits under, which is the whole distinction that matters here. The
   trade-off is that a bare URL inside a free-text description is no longer
   collected — correct, since a link in prose is not a canonical-host claim. */
function ownUrls(node, key, out) {
  if (node == null) return;
  if (typeof node === 'string') {
    if (!EXTERNAL_BY_DESIGN.has(key) && /^https?:\/\//i.test(node)) out.push(node);
    return;
  }
  if (Array.isArray(node)) { for (const v of node) ownUrls(v, key, out); return; }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) ownUrls(v, k, out);
  }
}

async function get(url, opts = {}) {
  try { return await fetch(url, { redirect: 'manual', ...opts }); }
  catch (e) { die(`site unreachable (${e.message}) — ${url}`); }
}
const body = async (r) => { try { return await r.text(); } catch { return ''; } };

(async () => {
  /* Required as a module by the offline self-test — export the logic, run
     nothing. Without this, require() would start the live fetches and then
     process.exit out of the test harness. `node gates/...` is unaffected:
     there, require.main IS this module. */
  if (require.main !== module) return;

  console.log(`canonical host expected everywhere: ${CANONICAL}`);
  console.log(`requests sent to:                   ${BASE}\n`);

  /* ═══ 1. WHAT EACH PAGE PUBLISHES ════════════════════════════════ */
  console.log('--- canonical, og:url and JSON-LD on each page type ---');
  for (const p of PAGES) {
    const r = await get(BASE + p.path, { redirect: 'follow' });
    const html = await body(r);
    if (!html) { ok(`${p.name}: page returned a body`, false, `status ${r.status}`); continue; }

    const can = (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1];
    ok(`${p.name}: <link rel=canonical> names ${CANONICAL}`,
       !!can && hostOf(can) === CANONICAL, `got ${can || '(none)'}`);

    const og = (html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) || [])[1];
    if (og) ok(`${p.name}: og:url names ${CANONICAL}`,
               hostOf(og) === CANONICAL, `got ${og}`);

    /* Every absolute URL inside JSON-LD must name the canonical host,
       except assets on a known CDN. Flagging only *.bathroomvanitiesoutlet
       hosts (the first version of this check) was both untestable and blind
       to a URL on a third host entirely — the fixture self-test caught it. */
    const bad = [];
    const unparsable = [];
    let blocks = 0;
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      blocks++;
      let graph;
      try {
        graph = JSON.parse(m[1]);
      } catch (e) {
        /* ⚠️ A BLOCK THAT WILL NOT PARSE IS NOT A PASS. Google treats
           malformed JSON-LD as an error on the entity, so falling back to a
           regex here would report "clean" on markup no crawler can read.
           It is asserted separately below instead. */
        unparsable.push(e.message);
        continue;
      }
      const urls = [];
      ownUrls(graph, null, urls);
      for (const u of urls) {
        const h = hostOf(u);
        if (!h || h === CANONICAL) continue;
        if (/(^|\.)(schema\.org|bunny\.net|b-cdn\.net|cloudinary\.com)$/.test(h)) continue;
        bad.push(u);
      }
    }
    ok(`${p.name}: every JSON-LD block parses`,
       unparsable.length === 0,
       `${unparsable.length}/${blocks} unparsable: ${unparsable.slice(0, 2).join('; ')}`);
    ok(`${p.name}: JSON-LD self-references use only ${CANONICAL}`,
       bad.length === 0, [...new Set(bad)].slice(0, 3).join(', '));
  }

  /* ═══ 2. THE SITEMAP ═════════════════════════════════════════════ */
  console.log('\n--- the sitemap ---');
  {
    const r = await get(BASE + '/sitemap.xml', { redirect: 'follow' });
    const xml = await body(r);
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]);
    ok('sitemap.xml returned entries', locs.length > 0, `status ${r.status}`);
    if (locs.length) {
      const wrong = locs.filter(u => hostOf(u) !== CANONICAL);
      ok(`all ${locs.length} <loc> entries name ${CANONICAL}`,
         wrong.length === 0,
         `${wrong.length} wrong, e.g. ${[...new Set(wrong.map(hostOf))].slice(0,3).join(', ')}`);
    }
  }

  /* ═══ 3. ROBOTS AND THE 301 — the two that were always right, and
            must stay right, because they are the other half of the rule */
  console.log('\n--- robots.txt and the apex redirect ---');
  {
    const r = await get(`${siteUrl.base()}/robots.txt`, { redirect: 'follow' });
    const txt = await body(r);
    ok('canonical host robots.txt allows crawling',
       /Allow:\s*\//i.test(txt) && !/^\s*Disallow:\s*\/\s*$/im.test(txt),
       txt.slice(0, 120).replace(/\n/g, ' '));

    if (APEX === CANONICAL) {
      console.log('  skip  canonical host carries no www, so there is no apex variant');
      return done();
    }
    const ra = await get(`https://${APEX}/robots.txt`, { redirect: 'manual' });
    const isRedirect = ra.status >= 300 && ra.status < 400;
    const loc = ra.headers.get('location') || '';
    if (isRedirect) {
      ok(`apex 301s to ${CANONICAL} (single hop)`,
         ra.status === 301 && hostOf(loc) === CANONICAL, `status ${ra.status} -> ${loc}`);
      const hop2 = await get(loc, { redirect: 'manual' });
      ok('that redirect lands on a 200, not another redirect',
         hop2.status === 200, `second hop returned ${hop2.status}`);
    } else {
      /* No redirect yet (OPEN_ITEMS item 18 is uncommitted). Then the
         apex must at least be closed to crawlers. */
      ok('apex is closed to crawlers while the 301 is not deployed',
         /Disallow:\s*\//i.test(await body(ra)), `status ${ra.status}, no Location`);
    }
  }

  done();
})();

function done() {
  console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nall live canonical-host gates pass');
  process.exit(fail ? 1 : 0);
}

/* ── EXPORTED FOR THE OFFLINE SELF-TEST ──────────────────────────────────
   This gate needs the network, so its JSON-LD classification logic cannot
   be negative-tested by the normal mutation route — there is nothing to
   mutate locally that would change a live page. Exporting the two pieces
   that make the sameAs decision lets mutate_canonical_jsonld.js prove,
   offline, that a foreign `url`/`@id`/`logo` is still CAUGHT and a foreign
   `sameAs` is ALLOWED. The IIFE above still runs on `node gates/...`
   exactly as before; this only adds a handle for the test. */
module.exports = { ownUrls, EXTERNAL_BY_DESIGN, hostOf };
