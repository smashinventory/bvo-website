'use strict';
/* ═══════════════════════════════════════════════════════════════════
   legacyRedirects — Shopify -> Node.js URL migration, 2026-09-24

   Serves the url_redirects table. 501 old URLs that would otherwise 404
   after the www.bathroomvanitiesoutlet.com cutover.

   WHY THIS RUNS BEFORE THE ROUTES
   ───────────────────────────────
   The obvious place for a redirect layer is just above the 404 handler:
   let the app try, and only rewrite what it could not serve. That does not
   work here. Our controllers render 404 THEMSELVES —

       if (!product) return res.status(404).render('pages/404', ...)

   — rather than calling next(). A post-route middleware would never see a
   dead product URL, which is the exact case this exists for.

   So it runs first. That is only safe because the loader drops every
   self-redirect (158 of them: old URLs that are byte-identical on the new
   site). Without that filter, running first would mean redirecting live
   product pages to themselves, forever. Two things keep it that way:
   loadRedirectMap.js refuses to insert a self-redirect, and _isSelf below
   refuses to serve one even if a row somehow appears in the table by hand.
   Belt and braces, because the failure mode is a page that can never load.

   IN-MEMORY, NOT PER-REQUEST SQL
   ──────────────────────────────
   The whole table is ~501 rows. Loading it once and serving from a Map
   keeps this off the hot path — every request that is NOT a legacy URL
   (which is almost all of them, and permanently so once Google re-crawls)
   costs one Map.get and nothing else. A per-request query would put a DB
   round-trip in front of every page on the site to serve a shrinking set
   of URLs.

   Cache refreshes every REFRESH_MS, so a destination edited in the DB goes
   live within the window with no deploy and no restart.
   ═══════════════════════════════════════════════════════════════════ */

const { safeQuery, mustQuery } = require('../db/query')('redirects');

const REFRESH_MS = 5 * 60 * 1000;

let MAP          = new Map();
let loadedAt     = 0;
let loading      = null;
let lastLoadOk   = false;

/* Hit counts are buffered and flushed on the refresh tick. Writing on every
   hit would put an UPDATE in the redirect path — the slowest possible way
   to serve a 301, for a statistic nobody reads in real time. */
const hitBuffer = new Map();

const BVO_HOSTS = new Set(['bathroomvanitiesoutlet.com', 'www.bathroomvanitiesoutlet.com']);

/** Normalise a request path the same way the map builder did:
 *  strip the trailing slash, drop tracking params, lowercase. */
function normalise(originalUrl) {
  const qIdx = originalUrl.indexOf('?');
  let p = (qIdx >= 0 ? originalUrl.slice(0, qIdx) : originalUrl).replace(/\/+$/, '') || '/';
  p = p.toLowerCase();

  if (qIdx < 0) return { path: p, withQuery: p };

  const keep = new URLSearchParams();
  for (const [k, v] of new URLSearchParams(originalUrl.slice(qIdx + 1))) {
    if (k.startsWith('pr_') || k.startsWith('utm_') || k === 'gclid' || k === 'fbclid') continue;
    keep.set(k.toLowerCase(), v);
  }
  const qs = keep.toString();
  return { path: p, withQuery: qs ? `${p}?${qs}` : p };
}

/** A row whose destination is this very URL would loop forever.
 *
 *  Compares path AND query. Path-only is wrong and was caught by the gate:
 *  nine indexed rows exist purely to SHED a query —
 *      /collections/bathroom-vanities?page=8            -> /collections/bathroom-vanities
 *      /products/csp-s2418-wg?variant=453…&country=US   -> /products/csp-s2418-wg
 *  Those are legitimate and necessary (Google has the ?variant= forms
 *  indexed). Treating them as self-redirects would silently drop them. */
function _isSelf(oldPath, destination) {
  if (!destination) return false;
  try {
    const u = new URL(destination);
    if (!BVO_HOSTS.has(u.hostname)) return false;
    return ((u.pathname.replace(/\/+$/, '') || '/') + (u.search || '')) === oldPath;
  } catch { return false; }
}

async function load() {
  const rows = await safeQuery(
    `SELECT old_path, destination, status_code
       FROM url_redirects
      WHERE is_active = 1`);

  // safeQuery resolves [] on error as well as on an empty table. Those are
  // very different: an empty result must NOT replace a good cache, or one
  // transient DB blip turns every legacy URL into a 404 until the next tick.
  if (!rows.length && lastLoadOk) {
    console.warn('[redirects] load returned 0 rows — keeping the previous cache');
    loadedAt = Date.now();
    return;
  }

  const next = new Map();
  let skipped = 0;
  for (const r of rows) {
    if (_isSelf(r.old_path, r.destination)) { skipped++; continue; }
    next.set(r.old_path, { to: r.destination, code: r.status_code });
  }
  if (skipped) {
    console.error(`[redirects] ${skipped} SELF-REDIRECT row(s) in url_redirects were ignored — ` +
                  `they would loop. Fix the table; see scripts/loadRedirectMap.js`);
  }

  MAP = next;
  loadedAt = Date.now();
  lastLoadOk = true;
  console.log(`[redirects] ${MAP.size} legacy URLs loaded`);
}

async function flushHits() {
  if (!hitBuffer.size) return;
  const batch = [...hitBuffer.entries()];
  hitBuffer.clear();
  try {
    for (const [p, n] of batch) {
      await mustQuery(
        `UPDATE url_redirects
            SET hits = hits + ?, last_hit_at = NOW()
          WHERE old_path = ?`, [n, p]);
    }
  } catch (e) {
    console.error('[redirects] hit flush failed:', e.code || e.message);
  }
}

function ensureFresh() {
  if (loading) return loading;
  if (Date.now() - loadedAt < REFRESH_MS) return null;
  loading = load()
    .then(flushHits)
    .catch(e => console.error('[redirects] refresh failed:', e.message))
    .finally(() => { loading = null; });
  return loading;
}

module.exports = function legacyRedirects(req, res, next) {
  // Only ever redirect a plain page fetch. A POST carries a body that a 301
  // does not reliably survive, and rewriting an API call would break the
  // caller rather than help a search engine.
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const url = req.originalUrl || req.url;
  if (url.startsWith('/admin') || url.startsWith('/api') ||
      url.startsWith('/images/') || url.startsWith('/docs/')) return next();

  ensureFresh();               // fire and forget; never blocks a request
  if (!MAP.size) return next();

  const n = normalise(url);
  // Query-qualified first: /collections/types?constraint=60-inch is a
  // DIFFERENT destination from the bare path, so the more specific key wins.
  const key = MAP.has(n.withQuery) ? n.withQuery : n.path;
  const hit = MAP.get(key);
  if (!hit) return next();

  hitBuffer.set(key, (hitBuffer.get(key) || 0) + 1);

  if (hit.code === 410 || !hit.to) {
    return res.status(410).render('pages/404', {
      pageTitle: '410 — No Longer Available | BathroomVanitiesOutlet.com',
    });
  }
  return res.redirect(301, hit.to);
};

/* Exposed for the gate script and for an admin "reload now" action. */
module.exports.load  = load;
module.exports.peek  = () => MAP;
module.exports.stats = () => ({ size: MAP.size, loadedAt, lastLoadOk });
