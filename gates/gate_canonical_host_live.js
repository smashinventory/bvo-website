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

async function get(url, opts = {}) {
  try { return await fetch(url, { redirect: 'manual', ...opts }); }
  catch (e) { die(`site unreachable (${e.message}) — ${url}`); }
}
const body = async (r) => { try { return await r.text(); } catch { return ''; } };

(async () => {
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
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      for (const u of (m[1].match(/https?:\/\/[^"'\s\\]+/g) || [])) {
        const h = hostOf(u);
        if (!h || h === CANONICAL) continue;
        if (/(^|\.)(schema\.org|bunny\.net|b-cdn\.net|cloudinary\.com)$/.test(h)) continue;
        bad.push(u);
      }
    }
    ok(`${p.name}: JSON-LD uses only ${CANONICAL}`,
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
