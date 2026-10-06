#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_cutover_config.js — the two config facts that decide cutover night

   Run:  node gates/gate_cutover_config.js
   Exit: 0 = pass, 1 = fail

   Both failures here are SILENT in production. The site serves 200s, the
   checkout renders, and the damage is only visible later — in Search
   Console, or in a Stripe dashboard with no live charges in it. So they
   are asserted in the push script rather than trusted to a checklist.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) walk(rel, out);
    else if (e.name.endsWith('.js') && !e.name.includes('.bak')) out.push(rel);
  }
  return out;
};

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

const SRC = walk('src');

/* Strip comments before searching for code.
   The `(?<!:)` matters: `https://` contains `//`, so a naive
   /\/\/.*$/ stripper deletes the rest of any line holding a URL — which
   silently blinded this gate's own Role B check until a mutation test
   caught it. Two mutations passed that should have failed. */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(?<!:)\/\/.*$/gm, '');


/* ═══ 1. THE SITE AGREES WITH ITSELF ABOUT ITS OWN ADDRESS ═══════════
   `process.env.SITE_URL || '<literal>'` was in 18 places with TWO
   different literals, so with SITE_URL unset the canonical tag said
   bare and robots.txt said www — for the same page. Split ranking
   between two hosts, on migration day, with nothing failing. */
console.log('--- one definition of the site address ---');
{
  const siteUrl = require('../src/utils/siteUrl');

  const offenders = SRC.filter(f =>
    f !== 'src/utils/siteUrl.js' && /SITE_URL\s*\|\|/.test(read(f)));
  ok('no file hardcodes its own SITE_URL fallback',
     offenders.length === 0,
     offenders.join(', ') + ' — copy the literal once and the two hosts diverge again');

  ok('the default is the www host',
     siteUrl.base({}) === 'https://www.bathroomvanitiesoutlet.com',
     `got ${siteUrl.base({})}; server.js redirects the bare host to www and ` +
     `serves a closed robots.txt on anything that is not CANONICAL_HOST`);

  ok('CANONICAL_HOST comes from the same module',
     /CANONICAL_HOST\s*=\s*require\('\.\/utils\/siteUrl'\)\.host\(\)/.test(read('src/server.js')),
     'robots.txt and the 301s key off this; a second derivation can disagree');

  /* Normalisation, so a trailing slash or a missing scheme in the env var
     cannot produce '...com//sitemap.xml' or a protocol-relative URL. */
  const cases = [
    ['trailing slash', { SITE_URL: 'https://www.bathroomvanitiesoutlet.com/' }, 'https://www.bathroomvanitiesoutlet.com'],
    ['no scheme',      { SITE_URL: 'www.bathroomvanitiesoutlet.com' },          'https://www.bathroomvanitiesoutlet.com'],
    ['whitespace',     { SITE_URL: '  https://www.bathroomvanitiesoutlet.com  ' }, 'https://www.bathroomvanitiesoutlet.com'],
    ['empty string',   { SITE_URL: '' },                                        'https://www.bathroomvanitiesoutlet.com'],
  ];
  let bad = [];
  for (const [n, env, want] of cases) if (siteUrl.base(env) !== want) bad.push(n);
  ok('the env value is normalised (slash, scheme, whitespace, empty)',
     bad.length === 0, bad.join(', '));
  ok('url() joins with exactly one slash',
     siteUrl.url('/sitemap.xml', {}) === 'https://www.bathroomvanitiesoutlet.com/sitemap.xml' &&
     siteUrl.url('sitemap.xml', {})  === 'https://www.bathroomvanitiesoutlet.com/sitemap.xml',
     'a double slash in a sitemap URL is a different URL to a crawler');
}

/* ═══ 2. THE STRIPE KEY NAMES THE CODE ACTUALLY READS ════════════════
   hPanel carries STRIPE_SECRET_KEY_LIVE and STRIPE_PUBLISHABLE_KEY_LIVE.
   Nothing reads them. Filling those in on cutover night and stopping
   there leaves the storefront on test keys, taking orders that never
   reach a bank, with no error anywhere. */
console.log('\n--- the Stripe variable names are the ones that are read ---');
{
  /* ASSERT THE DECISION, NOT THE SPELLING. The names are no longer
     literals anywhere — utils/stripeKeys.js builds them from STRIPE_MODE.
     Grepping for `process.env.STRIPE_SECRET_KEY` therefore went red
     against correct code, and the "no _LIVE suffix" check passed only
     because there was no literal left to find. Call the real resolver. */
  const keys = require('../src/utils/stripeKeys');

  ok('with STRIPE_MODE unset the unsuffixed names are used',
     keys.nameFor('SECRET_KEY',      {}) === 'STRIPE_SECRET_KEY' &&
     keys.nameFor('PUBLISHABLE_KEY', {}) === 'STRIPE_PUBLISHABLE_KEY' &&
     keys.nameFor('WEBHOOK_SECRET',  {}) === 'STRIPE_WEBHOOK_SECRET',
     'the deploy docs name the unsuffixed variables');

  ok('a suffixed name is used ONLY when STRIPE_MODE asks for it',
     keys.nameFor('SECRET_KEY', { STRIPE_MODE: 'live' })    === 'STRIPE_SECRET_KEY_LIVE' &&
     keys.nameFor('SECRET_KEY', { STRIPE_MODE: 'sandbox' }) === 'STRIPE_SECRET_KEY_SANDBOX' &&
     keys.nameFor('SECRET_KEY', { STRIPE_MODE: 'nonsense' })=== 'STRIPE_SECRET_KEY',
     'which account takes money must not depend on which vars happen to exist');

  ok('a test secret key under STRIPE_MODE=live is caught',
     keys.problems({ STRIPE_MODE: 'live',
                     STRIPE_SECRET_KEY_LIVE:      'sk_test_abc',
                     STRIPE_PUBLISHABLE_KEY_LIVE: 'pk_live_abc',
                     STRIPE_WEBHOOK_SECRET_LIVE:  'whsec_abc' }).length > 0,
     'assertCoherent is the only thing standing between live mode and test keys');

  /* No file may read a Stripe credential out of the environment itself —
     one resolver, or the mode logic is bypassed. Comments stripped first:
     checkoutController and stripeService both NAME these variables in
     their header comments, which is documentation, not a read. */
  const rawReaders = SRC.filter(f => {
    if (f === 'src/utils/stripeKeys.js') return false;
    const code = stripComments(read(f));
    return /process\.env\.STRIPE_(SECRET|PUBLISHABLE|WEBHOOK)/.test(code);
  });
  ok('only stripeKeys.js reads a Stripe credential from the environment',
     rawReaders.length === 0,
     rawReaders.join(', ') + ' — bypasses STRIPE_MODE and assertCoherent');

  /* The webhook secret is per-endpoint. Moving the endpoint to the live
     host issues a NEW secret; reusing the old one fails signature
     verification and every webhook is silently dropped. */
  ok('the webhook handler verifies the signature',
     /constructEvent\(/.test(read('src/controllers/checkoutController.js')),
     'an unverified webhook endpoint accepts anything');
}

/* ═══ 3. THE DOCS POINT AT THE SAME NAMES ════════════════════════════ */
console.log('\n--- the cutover docs name the real variables ---');
{
  let doc = '';
  try { doc = read('docs/reference/URL_CUTOVER_CHECKLIST.md'); } catch { doc = ''; }
  if (doc) {
    ok('the checklist does not tell you to set a _LIVE variable',
       !/STRIPE_[A-Z_]*_LIVE/.test(doc),
       'the checklist would be instructing the inert name');
  }
}


/* ═══ 3. THE CANONICAL NAME vs THE REQUEST HOST ══════════════════════
   Two legitimately different jobs that look identical in code:

     Role A  the site's canonical name — identical on every request.
             canonical tag, og:url, sitemap <loc>, JSON-LD @id, the GMC
             feed, and every absolute link in transactional mail.
             MUST come from utils/siteUrl.js.

     Role B  the host THIS request arrived on. Only three places need it:
             robots.txt (host-aware on purpose), the apex->www 301, and
             Stripe's return_url (allowlisted — the shopper must come back
             to where they actually are).

   Using B where A belongs is the whole bug class. It shipped twice:
   searchPageController built a canonical tag from req.get('host'), and
   accountController mailed a /account/secure link built from it — putting
   an attacker-influenceable request header into a security email. */
console.log('\n--- the canonical name and the request host are not the same thing ---');
{
  /* Role B is allowed here and nowhere else. */
  const ROLE_B_ALLOWED = new Set([
    'src/server.js',                          // robots.txt, host-aware
    'src/utils/canonicalRedirect.js',         // the 301 itself
    'src/controllers/checkoutController.js',  // Stripe return_url, allowlisted
  ]);

  const leaks = SRC.filter(f =>
    !ROLE_B_ALLOWED.has(f) &&
    /req\s*\.\s*(get\(\s*['"`]host['"`]\s*\)|hostname|headers\s*\.\s*host)/
      .test(stripComments(read(f))));

  ok('no file outside the three Role B sites derives a host from the request',
     leaks.length === 0,
     leaks.join(', ') + ' — a canonical, feed entry or mailed link must not '
     + 'depend on which hostname the request arrived on');

  /* The two that shipped. Pinned as conditions, not spellings: assert the
     request host is ABSENT from the construction, so any correct rewrite
     still passes. */
  for (const f of ['src/controllers/searchPageController.js',
                   'src/controllers/accountController.js']) {
    const code = stripComments(read(f));
    ok(`${f.split('/').pop()} builds absolute URLs from config, not the request`,
       !/req\s*\.\s*(get\(\s*['"`]host['"`]\s*\)|hostname)/.test(code) &&
       /siteUrl/.test(code),
       'regressed to the request host');
  }
}

/* ═══ VERDICT ════════════════════════════════════════════════════════ */
if (fail) { console.log(`\n*** ${fail} GATE(S) FAILED ***`); process.exit(1); }
console.log('\nall cutover-config gates pass');
