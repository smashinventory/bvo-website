#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_rate_limit_runtime.js
 *
 * THE RULE: the installed express-rate-limit must still BEHAVE the way this
 * app assumes. Proven by driving real HTTP traffic through real limiters,
 * not by reading the changelog.
 *
 * ── HOW THIS DIFFERS FROM gate_rate_limiter.js ─────────────────────────
 * That one is static analysis of src/server.js: are the NUMBERS still 150
 * per 5 min, 10 per 15, 5 per 15. It answers "did someone change our
 * config?"
 *
 * This one answers a different question: "does the LIBRARY still do what
 * those numbers mean?" Every option below is a behaviour the app depends
 * on and that an upgrade could silently change:
 *
 *   skipSuccessfulRequests  both auth limiters rely on it. A successful
 *                           login must not burn an attempt.
 *   skip()                  Googlebot must never be refused robots.txt or
 *                           sitemap.xml. Sustained 429s are read as a
 *                           failing server and crawl rate drops.
 *   standardHeaders: true   clients read RateLimit-* to back off.
 *   legacyHeaders: false    X-RateLimit-* must stay off.
 *   the limit itself        the thing actually has to block.
 *
 * WHY IT EXISTS. On 2026-11-22 we moved 7.5.1 -> 8.7.5 to clear
 * GHSA-cppf-2hm6-mrvm. Nothing in src/ changed, so no static gate could
 * have told us whether the upgrade worked. The only honest answer was to
 * run traffic through it. That question will come up at every future
 * upgrade, so the answer is checked in rather than re-derived.
 *
 * It also pins the v8 IPv6 fix. v8's one breaking change masks IPv6 to a
 * /56 so a user cannot evade the limit by walking their ISP-assigned
 * subnet. A downgrade to v7 would silently reopen that bypass and every
 * other check here would still pass — so it is asserted explicitly.
 *
 * Binds an ephemeral port on 127.0.0.1. No database, no outbound network,
 * so Rule 14 holds: this runs on a laptop and in CI.
 *
 * Run:  node gates/gate_rate_limit_runtime.js
 * Exit: 0 = pass, 1 = fail
 * ───────────────────────────────────────────────────────────────────────── */

const rateLimit = require('express-rate-limit');
const express   = require('express');
const http      = require('http');
const fs        = require('fs');
const path      = require('path');

let pass = 0, fail = 0;
const check = (c, label, detail) => {
  if (c) { console.log('  ok   ' + label + (detail ? `   [${detail}]` : '')); pass++; }
  else   { console.log('  FAIL ' + label + (detail ? `   [${detail}]` : '')); fail++; }
};

/* ⚠️ READ FROM DISK, NOT require('express-rate-limit/package.json').
   v8 added an `exports` map that does not expose ./package.json, so the
   require form throws ERR_PACKAGE_PATH_NOT_EXPORTED. It worked under
   v7.5.1. Harmless here, but it is a real v7->v8 behavioural difference
   and the first one this upgrade actually tripped over. */
const VERSION = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'node_modules/express-rate-limit/package.json'), 'utf8')).version;
console.log(`\ngate_rate_limit_runtime — express-rate-limit@${VERSION} still behaves\n`);

/* Capture the library's own validation output. v8 logs ERR_ERL_* / WRN_ERL_*
   for misconfiguration — a typo'd option, an unsafe keyGenerator. Those are
   warnings nobody reads in a production log, so here they are failures. */
const complaints = [];
const realWarn = console.warn, realError = console.error;
console.warn  = (...a) => complaints.push('WARN ' + a.join(' '));
console.error = (...a) => complaints.push('ERR  ' + a.join(' '));

const SKIP_EXACT = new Set(['/robots.txt', '/sitemap.xml']);
const L = {
  storefront: rateLimit({ windowMs: 5 * 60 * 1000, max: 150,
    standardHeaders: true, legacyHeaders: false,
    skip: (req) => SKIP_EXACT.has(req.path) }),
  auth: rateLimit({ windowMs: 15 * 60 * 1000, max: 10,
    standardHeaders: true, legacyHeaders: false,
    skipSuccessfulRequests: true }),
  adminLogin: rateLimit({ windowMs: 15 * 60 * 1000, max: 10,
    standardHeaders: true, legacyHeaders: false }),
};

console.warn = realWarn; console.error = realError;

const app = express();
app.set('trust proxy', 1);                       // mirrors src/server.js
app.use('/login', L.adminLogin);
app.post('/login', (_q, s) => s.status(401).send('no'));   // always FAILS
app.use('/acct',  L.auth);
app.get('/acct',  (_q, s) => s.send('ok'));                // always SUCCEEDS
app.use(L.storefront);
app.get('/robots.txt', (_q, s) => s.send('ok'));
app.get('/',           (_q, s) => s.send('ok'));

const server = http.createServer(app).listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const hit = (path, method, ip) =>
    fetch(`http://127.0.0.1:${port}${path}`,
          { method: method || 'GET', headers: { 'X-Forwarded-For': ip } })
      .then(r => ({ status: r.status, headers: r.headers }));

  try {
    console.log('--- the limit actually blocks ---');
    const codes = [];
    for (let i = 0; i < 12; i++) codes.push((await hit('/login', 'POST', '203.0.113.5')).status);
    check(codes.slice(0, 10).every(c => c === 401) && codes[10] === 429,
          'blocks on attempt 11, not before', codes.join(','));

    console.log('\n--- skipSuccessfulRequests still exempts successes ---');
    const okCodes = [];
    for (let i = 0; i < 15; i++) okCodes.push((await hit('/acct', 'GET', '203.0.113.9')).status);
    check(okCodes.every(c => c === 200),
          '15 successful requests against a limit of 10 never block',
          'if this fails, a customer who signs in correctly gets locked out');

    console.log('\n--- a crawler is never refused ---');
    const robots = await hit('/robots.txt', 'GET', '203.0.113.77');
    check(robots.status === 200, 'skip() still exempts /robots.txt', String(robots.status));

    console.log('\n--- the headers clients read to back off ---');
    const h = (await hit('/', 'GET', '203.0.113.80')).headers;
    check(!!h.get('ratelimit-limit'), 'standardHeaders emits RateLimit-*',
          'limit=' + h.get('ratelimit-limit') + ' remaining=' + h.get('ratelimit-remaining'));
    check(!h.get('x-ratelimit-limit'), 'legacyHeaders:false suppresses X-RateLimit-*',
          String(h.get('x-ratelimit-limit')));

    console.log('\n--- the v8 IPv6 fix is present ---');
    /* Two addresses inside one /56. Under v8 they share a bucket, so the
       second request decrements the same counter. Under v7 they are
       separate keys and `remaining` would not move — which is precisely
       the bypass v8 closed. */
    const a = await hit('/', 'GET', '2001:db8:1:1100:1:1:1:1');
    const b = await hit('/', 'GET', '2001:db8:1:1122:2:2:2:2');
    const ra = Number(a.headers.get('ratelimit-remaining'));
    const rb = Number(b.headers.get('ratelimit-remaining'));
    check(rb === ra - 1,
          'two IPv6 addresses in one /56 share a bucket',
          `remaining ${ra} -> ${rb}; if unchanged, an IPv6 client can walk ` +
          'its subnet to evade the limit (the v8 breaking change)');

    console.log('\n--- the library has no complaints about our config ---');
    const erl = complaints.filter(c => /ERR_ERL|WRN_ERL|express-rate-limit/i.test(c));
    check(erl.length === 0, 'no ERR_ERL_*/WRN_ERL_* validation output',
          erl.length ? erl.join(' | ') : 'none');
  } catch (err) {
    check(false, 'the harness ran to completion', err && err.message);
  }

  server.close();
  console.log(fail ? `\n*** ${fail} of ${pass + fail} CHECKS FAILED ***`
                   : `\nALL ${pass} CHECKS PASS`);
  process.exit(fail ? 1 : 0);
});
