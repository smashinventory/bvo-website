'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   siteUrl.js — the site's own address, defined once.

   ── WHY THIS EXISTS ────────────────────────────────────────────────────

   `process.env.SITE_URL || '<a literal>'` appeared in 18 places across
   server.js and nine controllers, with TWO different literals:

       https://www.bathroomvanitiesoutlet.com    4 places
       https://bathroomvanitiesoutlet.com       14 places

   With SITE_URL unset — which is how it is today — the site therefore
   disagrees with itself about its own canonical host:

       robots.txt + canonical host  ->  www          (server.js:385,390)
       <link rel=canonical> on pages ->  bare        (server.js:558)
       sitemap.xml entries          ->  bare        (sitemapController:23)
       Stripe return URLs           ->  www          (checkoutController:187)

   Canonical tags and the sitemap naming different hosts for the same
   page is precisely the signal not to send a search engine during a
   migration: it splits ranking between two hosts and makes the 301s
   look like a loop.

   Setting SITE_URL papers over it. It does not fix it — the next file
   that needs a base URL copies whichever literal it happens to see, and
   the disagreement is back the first time the variable is missing.

   ── THE RULE ───────────────────────────────────────────────────────────

   One default, www, matching CANONICAL_HOST in server.js, which is what
   robots.txt and the 301s already enforce. Nothing else may write a
   literal; gate_site_url.js fails the push if anything does.
   ═══════════════════════════════════════════════════════════════════════ */

/* www, not bare. server.js already redirects the bare host to this one
   and serves a closed robots.txt on anything that is not it, so this is
   not a preference — it is the host the rest of the system enforces. */
const DEFAULT_SITE_URL = 'https://www.bathroomvanitiesoutlet.com';

/** Normalised base URL, no trailing slash. */
function base(env = process.env) {
  const raw = (env.SITE_URL || DEFAULT_SITE_URL).trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
  return withScheme.replace(/\/+$/, '');
}

/** Hostname only, lowercased — what CANONICAL_HOST compares against. */
function host(env = process.env) {
  return base(env).replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
}

/** base() + a path, with exactly one slash between them. */
function url(path = '', env = process.env) {
  const p = String(path || '');
  if (!p) return base(env);
  return base(env) + (p.startsWith('/') ? p : '/' + p);
}

module.exports = { base, host, url, DEFAULT_SITE_URL };
