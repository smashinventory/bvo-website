#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_canonical_redirect.js — the apex 301 goes exactly one hop to www,
   keeps the path and query, and cannot take the site down.

   Run:  node gates/gate_canonical_redirect.js
   Exit: 0 = pass, 1 = fail

   Every failure here is silent in production. A dropped query string looks
   like a working redirect. A redirect loop looks like a browser problem. A
   blank canonical host sends every visitor to "https://" and the server
   logs nothing unusual. So they are asserted, not reviewed.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

const R = require('../src/utils/canonicalRedirect');
const CANON = 'www.bathroomvanitiesoutlet.com';
const APEX  = 'bathroomvanitiesoutlet.com';

/* A request object shaped like the express one, built so path and
   originalUrl cannot drift apart by accident in the fixtures. */
const req = (host, url = '/', method = 'GET') => ({
  method, hostname: host, originalUrl: url, path: String(url).split('?')[0],
});

/* ═══ 1. THE REDIRECT FIRES WHERE IT SHOULD, AND ONLY THERE ══════════ */
console.log('--- who gets redirected ---');
{
  ok('the apex is redirected',
     R.redirectTarget(req(APEX), CANON) === `https://${CANON}/`,
     String(R.redirectTarget(req(APEX), CANON)));

  ok('the canonical host is NOT redirected',
     R.redirectTarget(req(CANON), CANON) === null,
     'a redirect here is an infinite loop — the browser shows ERR_TOO_MANY_REDIRECTS ' +
     'and the whole site is down');

  ok('host comparison is case-insensitive',
     R.redirectTarget(req(CANON.toUpperCase()), CANON) === null,
     'Host headers are not case-normalised by every proxy; an uppercase Host ' +
     'that fails this comparison loops');

  ok('an unrelated host is redirected',
     R.redirectTarget(req('bvo.example.net', '/x'), CANON) === `https://${CANON}/x`);

  /* THE STAGING HOST IS NO LONGER EXEMPT. It was, on the theory that it
     was a working escape hatch. Hostinger's 2026-09-30 operation was a
     domain CHANGE, not an alias — the hostname now refuses connections
     (ERR_HTTP2_PROTOCOL_ERROR, verified). Exempting a dead host would
     leave a special case implying a fallback that does not exist. */
  ok('the dead staging host is NOT exempt — it redirects like any other',
     R.redirectTarget(req('slategrey-falcon-350174.hostingersite.com', '/x'), CANON)
       === `https://${CANON}/x`,
     'nothing serves that hostname any more; there is nothing to preserve');

  ok('no host at all is exempt',
     R.EXEMPT_HOST === null,
     String(R.EXEMPT_HOST) + ' — an exemption reintroduces a host that can ' +
     'serve non-canonical content without a redirect');

  ok('an empty host does nothing',
     R.redirectTarget(req(''), CANON) === null,
     'no Host header means nothing to compare — redirecting on a guess is worse');
}

/* ═══ 2. THE HOP IS EXACTLY ONE, AND LOSES NOTHING ══════════════════ */
console.log('\n--- what the redirect preserves ---');
{
  const withQuery = '/collections/bathroom-vanities?size=48&finish=white';
  ok('the query string survives',
     R.redirectTarget(req(APEX, withQuery), CANON) === `https://${CANON}${withQuery}`,
     String(R.redirectTarget(req(APEX, withQuery), CANON)) +
     ' — dropping the query silently un-filters every collection URL in the old index');

  const deep = '/products/050-s48-ejp-snk';
  ok('a deep path survives',
     R.redirectTarget(req(APEX, deep), CANON) === `https://${CANON}${deep}`);

  ok('the destination is absolute and https',
     /^https:\/\//.test(R.redirectTarget(req(APEX, deep), CANON)),
     'a scheme-relative or http destination adds a second hop via HSTS');

  /* ONE HOP. Feed the output back in: if the destination would itself be
     redirected, the chain is two hops and every 301 in it leaks signal. */
  const dest = R.redirectTarget(req(APEX, withQuery), CANON);
  const destHost = dest.replace(/^https:\/\//, '').split('/')[0];
  const destUrl  = dest.slice(`https://${destHost}`.length);
  ok('the destination is not itself redirected (exactly one hop)',
     R.redirectTarget(req(destHost, destUrl), CANON) === null,
     `${dest} → ${R.redirectTarget(req(destHost, destUrl), CANON)}`);

  ok('a root request lands on the root, not an empty path',
     R.redirectTarget(req(APEX, '/'), CANON).endsWith('/'),
     'https://host with no trailing slash is a different URL to Google');
}

/* ═══ 3. THE FAILURES THAT TAKE THE SITE DOWN ═══════════════════════ */
console.log('\n--- the redirect cannot break the site ---');
{
  ok('an empty canonical host disables the redirect entirely',
     R.redirectTarget(req(APEX), '') === null,
     'without this guard every request 301s to "https://" — a total outage ' +
     'caused by an env var, with nothing in the logs');
  ok('an undefined canonical host disables the redirect',
     R.redirectTarget(req(APEX), undefined) === null);
  ok('a whitespace-only canonical host disables the redirect',
     R.redirectTarget(req(APEX), '   ') === null);

  ok('POST is never redirected',
     R.redirectTarget(req(APEX, '/checkout', 'POST'), CANON) === null,
     'a 301 on POST may be replayed as GET with the body dropped — the form ' +
     'appears to succeed and does nothing');
  for (const m of ['PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    ok(`${m} is never redirected`,
       R.redirectTarget(req(APEX, '/x', m), CANON) === null);
  }
  ok('HEAD is redirected, like GET',
     R.redirectTarget(req(APEX, '/x', 'HEAD'), CANON) === `https://${CANON}/x`,
     'crawlers and link checkers use HEAD; leaving it un-redirected reports ' +
     'the apex as a live 200');
  ok('a lowercase method still redirects',
     R.redirectTarget(req(APEX, '/x', 'get'), CANON) === `https://${CANON}/x`);

  ok('the Stripe webhook path is exempt',
     R.redirectTarget(req(APEX, '/checkout/webhook'), CANON) === null,
     'a redirected webhook is a dropped webhook — the order never leaves pending');
}

/* ═══ 4. server.js ACTUALLY USES THIS ═══════════════════════════════
   Everything above tests a module. None of it proves the module is
   wired in — a deleted app.use() would leave all of it green. */
console.log('\n--- server.js is wired to this module ---');
{
  const s = read('src/server.js');

  ok('server.js requires the module',
     /require\(['"]\.\/utils\/canonicalRedirect['"]\)/.test(s));
  ok('server.js calls redirectTarget',
     /redirectTarget\s*\(/.test(s));
  ok('the result is used as a 301',
     /res\.redirect\(\s*301\s*,/.test(s),
     'a 302 is temporary — Google keeps the old URL indexed and passes nothing');
  ok('the middleware is mounted, not just defined',
     /app\.use\(\s*\(req,\s*res,\s*next\)\s*=>\s*\{[\s\S]{0,300}?redirectTarget/.test(s),
     'the function can be imported and never called');

  /* server.js must not reimplement the rule alongside the module. Two
     copies means one of them is stale and nothing says which. */
  const inline = /req\.hostname[\s\S]{0,200}?res\.redirect\(\s*30[18]/.test(s);
  ok('server.js does not hand-roll a second host redirect',
     !inline,
     'a duplicate rule next to the module is a rule that will drift');

  /* CANONICAL_HOST is what gets passed in, so it has to be the www form
     or the redirect points at the wrong place with every test still green. */
  ok('CANONICAL_HOST derives from SITE_URL with a www fallback',
     /CANONICAL_HOST\s*=\s*\(process\.env\.SITE_URL\s*\|\|\s*['"]https:\/\/www\./.test(s),
     'a non-www fallback would 301 www → apex, the exact inverse of the intent');
}

/* ═══ 5. THE ROBOTS ROUTE STILL CLOSES NON-CANONICAL HOSTS ══════════
   The redirect is the new belt; this is the braces that were already
   there. Removing it because "the redirect handles it" would leave the
   exempt temp host wide open with 6,076 indexable URLs. */
console.log('\n--- the non-canonical robots response survives ---');
{
  const s = read('src/server.js');
  const robots = s.slice(s.indexOf("app.get('/robots.txt'"));
  ok('robots.txt is still host-aware',
     /host\s*!==\s*CANONICAL_HOST/.test(robots));
  ok('non-canonical hosts still get Disallow: /',
     /host\s*!==\s*CANONICAL_HOST[\s\S]{0,400}?Disallow:\s*\//.test(robots),
     'the temp hostname is exempt from the redirect — this is the only thing ' +
     'keeping it out of the index');
  ok('the canonical host still gets Allow: /',
     /User-agent:\s*\*\s*\nAllow:\s*\//.test(robots));
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
