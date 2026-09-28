'use strict';
/* Gates for the launch rate-limiter settings, 2026-09-28.
 *
 * WHAT THIS IS PROTECTING
 *
 * The storefront limiter is a SCRAPING control. The risk it carries is not
 * that the number is too high — it is that a legitimate client, usually
 * Googlebot, trips it and then eats the remainder of the window. Sustained
 * 429s are read as a failing server and crawl rate drops, during exactly
 * the migration where rankings are moving.
 *
 * So the assertions below are mostly about the LOCKOUT SHAPE and about the
 * two files a crawler cannot be refused: robots.txt and sitemap.xml.
 *
 * The auth limiters are asserted UNCHANGED. They are the ones doing real
 * security work, and the most likely way this file gets damaged is someone
 * "making the limits consistent".
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const raw  = fs.readFileSync(path.join(ROOT, 'src/server.js'), 'utf8');
/* Comments are not code — this trap has caught five gates this month. */
const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

/* Pull each rateLimit({...}) block in declaration order. The storefront
   limiter is first, then authLimiter, then adminAuthLimiter. */
const blocks = code.match(/rateLimit\(\{[\s\S]*?\}\)/g) || [];
ok('three rateLimit blocks exist', blocks.length === 3, `found ${blocks.length}`);
if (blocks.length < 3) { console.log('\n*** cannot continue ***'); process.exit(1); }

const num = (block, key) => {
  const m = block.match(new RegExp(key + '\\s*:\\s*([0-9*\\s]+?)[,\\n]'));
  if (!m) return NaN;
  // eslint-disable-next-line no-eval
  return eval(m[1]);          // only ever digits and '*', from our own source
};

const [store, auth, adminAuth] = blocks;

console.log('--- storefront limiter ---');
const winMs = num(store, 'windowMs');
const max   = num(store, 'max');

ok('window is 5 minutes', winMs === 5 * 60 * 1000, `${winMs}ms`);
ok('max is 150',          max === 150,             `${max}`);

/* The two properties that actually matter, expressed as the quantities a
   human reasons about rather than as the raw constants. */
const perMin     = max / (winMs / 60000);
const lockoutMin = winMs / 60000;
ok('sustained rate is 30 req/min', perMin === 30, `${perMin}/min`);
ok('worst-case lockout is 5 minutes', lockoutMin === 5, `${lockoutMin} min`);

/* The retune must never have made it MORE punishing than what it
   replaced (15 min / 1000 = 67/min, 15-minute lockout). */
ok('lockout is shorter than the 15 minutes it replaced', lockoutMin < 15, 'regression');
ok('throughput is not a relaxation', perMin < 1000 / 15, 'looser than before');

console.log('\n--- what a crawler must never be refused ---');
const skipLine = code.match(/_RL_SKIP_EXACT\s*=\s*new Set\(\[([^\]]*)\]/);
ok('_RL_SKIP_EXACT is a Set literal', !!skipLine, 'shape changed');
const skips = skipLine ? skipLine[1] : '';

/* A 429 on robots.txt tells Google to stop crawling the site entirely.
   A 429 on sitemap.xml breaks URL discovery for all 5,139 pages. */
ok('/robots.txt is exempt',  /'\/robots\.txt'/.test(skips),  'Google stops crawling');
ok('/sitemap.xml is exempt', /'\/sitemap\.xml'/.test(skips), 'URL discovery breaks');
ok('/favicon.ico is exempt', /'\/favicon\.ico'/.test(skips), 'noise counts against the cap');

/* The exemption is only real if the route path matches exactly. */
ok('the sitemap route IS /sitemap.xml',
   /app\.get\('\/sitemap\.xml'/.test(code),
   'route path and skip entry disagree — the exemption would never match');

/* Static assets: a single page load pulls many, and counting them would
   exhaust 150 in a handful of page views. */
const pref = code.match(/_RL_SKIP_PREFIX\s*=\s*\[([^\]]*)\]/);
ok('static prefixes still exempt',
   pref && ['/css/', '/js/', '/images/'].every(p => pref[1].includes(p)),
   'one page load would burn the budget');

console.log('\n--- auth limiters UNCHANGED ---');
/* These guard credentials. The likeliest way they get damaged is someone
   tidying the three blocks to be "consistent". */
ok('customer auth is still 10 per 15 min',
   num(auth, 'max') === 10 && num(auth, 'windowMs') === 15 * 60 * 1000,
   `${num(auth, 'max')} per ${num(auth, 'windowMs')}ms`);
ok('admin login is still 5 per 15 min',
   num(adminAuth, 'max') === 5 && num(adminAuth, 'windowMs') === 15 * 60 * 1000,
   `${num(adminAuth, 'max')} per ${num(adminAuth, 'windowMs')}ms`);
ok('auth limiters are STRICTER than the storefront one',
   num(auth, 'max') < max && num(adminAuth, 'max') < max,
   'an auth limiter is looser than the page limiter');
ok('successful auth requests are not counted',
   /skipSuccessfulRequests:\s*true/.test(auth),
   'a legitimate customer signing in repeatedly would be locked out');

console.log('\n--- the reasoning survives in the file ---');
/* This number was wrong once for a documented reason. If the next reader
   cannot see why it is 150, they will "tidy" it. */
ok('the file explains the lockout-shape argument',
   /LOCKOUT SHAPE/i.test(raw) && /Retry-After/i.test(raw), 'reasoning lost');
ok('it records what the numbers were before',
   /15 min \/ 1000/.test(raw), 'no before/after to compare');
ok('the stale "retune AT CUTOVER" instruction is gone',
   !/Retune it AT CUTOVER/i.test(raw), 'file still says to do what has been done');

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
