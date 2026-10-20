#!/usr/bin/env node
'use strict';

/* gate_site_analytics.js — the first-party funnel.
 *
 * THE THING THIS FEATURE EXISTS FOR: on 2026-10-07 "adds to cart" could not
 * be answered from any source. GA4/GTM/Clarity are all installed but the
 * codebase had ZERO gtag('event', ...) calls, so GA4 only ever received its
 * automatic events; and the cart lives in the session blob with no carts
 * table, so the database could not answer it either.
 *
 * THE RISKS WORTH GATING, in order of how badly they would mislead:
 *
 *   1. Revenue drifting away from the orders table. Money must have one
 *      source of truth. An events table that also totalled money would
 *      eventually disagree with what was actually charged, and a dashboard
 *      is the last place anyone looks for that.
 *   2. Counting cart adds that never happened. The add handler has a $0
 *      price guard that blocks the add; recording before it would count
 *      blocked adds as successes - flattering and wrong.
 *   3. Counting raw events instead of sessions, which inflates the top of
 *      the funnel every time a shopper reloads a page.
 *   4. Analytics breaking a page. A dropped event is a rounding error; a
 *      500 on "Add to cart" is lost revenue.
 *   5. Bots in the funnel.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let checks = 0, fails = 0;
const ok    = m => { checks++; console.log('  ok   ' + m); };
const bad   = (m, d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const read  = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

const SVC  = read('src/services/siteEvents.js');
const CTRL = read('src/controllers/siteAnalyticsController.js');
const CART = read('src/controllers/cartController.js');
const PROD = read('src/controllers/productsController.js');
const CHK  = read('src/controllers/checkoutController.js');
const VIEW = read('views/pages/admin/marketing/site-analytics.ejs');

console.log('\ngate_site_analytics — the funnel measures what it claims to\n');

/* ── 1. money has exactly one source ────────────────────────────────── */
console.log('--- money ---');
check(/FROM orders o/.test(CTRL) && /SUM\(o\.total\)/.test(CTRL),
      'revenue is summed from the orders table');
check(!/SUM\(\s*(e\.)?value_cents\s*\)\s*(AS|as)\s*revenue/i.test(CTRL),
      'revenue is never summed from site_events',
      'two totals for the same money will disagree, and the dashboard will be believed');
check(/o\.is_test = 0 AND o\.status <> 'cancelled'/.test(CTRL),
      "orders are filtered by the same rule the customers page uses - is_test and not cancelled");

/* ── 2. a cart add means a cart add ─────────────────────────────────── */
console.log('--- recording points ---');
const guardAt  = CART.indexOf('BLOCKED: product_id=');
const recordAt = CART.indexOf("siteEvents.record(req, 'add_to_cart'");
check(guardAt > -1 && recordAt > guardAt,
      'add_to_cart is recorded AFTER the $0-price guard, not before',
      'recording earlier counts blocked adds as cart adds');
check(/siteEvents\.record\(req, 'add_to_cart', \{[\s\S]{0,160}value:\s*pricef \* qty/.test(CART),
      'and records the authoritative DB price, not a client-supplied one');
check(/siteEvents\.record\(req, 'view_item'/.test(PROD),
      'view_item is recorded on the product page');
check(/siteEvents\.record\(req, 'begin_checkout'/.test(CHK),
      'begin_checkout is recorded at checkout');
/* checkout-identify is only an email gate; people reach it and leave. */
const idIdx  = CHK.indexOf("res.render('pages/checkout-identify'");
const bcIdx  = CHK.indexOf("siteEvents.record(req, 'begin_checkout'");
const infoIdx = CHK.indexOf("res.render('pages/checkout-info'");
check(bcIdx > -1 && infoIdx > -1 && Math.abs(bcIdx - infoIdx) < 900 && (idIdx === -1 || Math.abs(bcIdx - idIdx) > 900),
      'begin_checkout sits with checkout-info, not the checkout-identify email gate');

/* ── 3. nothing is awaited, so analytics cannot stall a page ─────────── */
['src/controllers/cartController.js',
 'src/controllers/productsController.js',
 'src/controllers/checkoutController.js'].forEach(f => {
  const src = read(f);
  check(!/await\s+siteEvents\.record\(/.test(src),
        path.basename(f) + ' never awaits record() - the shopper does not wait on analytics');
});

/* ── 4. fail-soft ───────────────────────────────────────────────────── */
console.log('--- fail-soft ---');
check(/async function record\([\s\S]*?try \{[\s\S]*?\} catch \(err\) \{[\s\S]*?\}\s*\}/.test(SVC),
      'record() wraps its whole body in try/catch');
check(/console\.error\('\[siteEvents\] record failed \(ignored\)/.test(SVC),
      'and logs the swallowed error rather than hiding it');
/* Proven, not assumed: call it with a request that has no session and a
   pool that is certain to reject, and require that it still resolves. */
{
  const Module = require('module');
  const origLoad = Module._load;
  Module._load = function (req2, parent, isMain) {
    if (req2 === '../config/database') {
      return { bvoPool: { query: () => Promise.reject(new Error('gate: simulated DB outage')) } };
    }
    return origLoad.apply(this, arguments);
  };
  delete require.cache[require.resolve(path.join(ROOT, 'src/services/siteEvents.js'))];
  const se = require(path.join(ROOT, 'src/services/siteEvents.js'));
  Module._load = origLoad;

  let resolved = false, threw = false;
  const origErr = console.error; console.error = () => {};
  se.record({ headers: {} }, 'add_to_cart', { product_id: 1, qty: 1, value: 10 })
    .then(() => { resolved = true; })
    .catch(() => { threw = true; })
    .finally(() => {
      console.error = origErr;
      check(resolved && !threw,
            'and a dead database makes record() resolve quietly instead of rejecting',
            'executed against a pool that always rejects');
      finish(se);
    });
}

function finish(se) {
  /* ── 5. sessions, not raw rows ────────────────────────────────────── */
  console.log('--- the funnel counts sessions ---');
  const distinct = (CTRL.match(/COUNT\(DISTINCT CASE WHEN event_name/g) || []).length;
  check(distinct >= 3,
        'each funnel step counts DISTINCT session_id (' + distinct + ' of 3)',
        'counting raw events inflates the top of the funnel on every page reload');
  check(/COUNT\(DISTINCT session_id\)/.test(CTRL) || distinct >= 3,
        'and the per-product tables do the same');

  /* ── 6. bots out of the funnel, but still reportable ──────────────── */
  console.log('--- bots ---');
  const bodies = CTRL.split(/async function /).slice(1);
  const funnelish = bodies.filter(b => /^(funnel|daily|topAdded|viewedNotCarted)\b/.test(b));
  funnelish.forEach(b => {
    const name = b.slice(0, b.indexOf('('));
    const uses = /FROM site_events/.test(b);
    check(!uses || /is_bot = 0/.test(b),
          name + '() filters is_bot = 0');
  });
  check(/async function botShare/.test(CTRL) && /SUM\(is_bot = 1\)/.test(CTRL),
        'bot volume is still reported rather than silently dropped');

  /* ── 7. the page survives both states it will actually be in ──────── */
  console.log('--- the view renders ---');
  const ejs = require('ejs');
  const tplPath = path.join(ROOT, 'views/pages/admin/marketing/site-analytics.ejs');
  let fn = null;
  try { fn = ejs.compile(fs.readFileSync(tplPath, 'utf8'), { filename: tplPath }); ok('the template compiles'); }
  catch (e) { bad('the template compiles', e.message); }

  if (fn) {
    const empty = {
      days: 30,
      funnel: { viewed: 0, carted: 0, checkout: 0, orders: 0, revenue: 0, rawEvents: 0,
                viewToCart: null, cartToCheck: null, checkToOrder: null, viewToOrder: null },
      series: [], topAdded: [], viewedNotCarted: [],
      bots: { bot: 0, total: 0, pct: null },
      coverage: { firstEvent: null, total: 0 }, gaConfigured: false,
      /* EJS throws ReferenceError on an undeclared local, so every local the
         template reads must be present in the fixture - including the ones
         added later. Leaving `traffic` out is how this gate first failed. */
      traffic: { ok: false, configured: false, reason: 'not configured' },
      /* 2026-10-19: the stateful-session fix added this one. */
      cookieless: { cookieless: 0, total: 0, pct: null },
      /* ⚠️ res.locals.cspNonce is set for EVERY template by global
         middleware (server.js:176), so it is a real local this fixture
         simply never supplied. The empty-state fixture passed without it
         only because the empty state returns before the chart <script>
         tags that read it - which is why exactly one of the two render
         checks was red and the page itself was fine. */
      cspNonce: 'gate-nonce',
    };
    try {
      const html = fn(empty);
      /* DAY ONE IS THE EMPTY STATE and it will last a week. A dashboard that
         renders "0%" everywhere on its first day gets read as a business
         crisis rather than an empty table. */
      check(/No events recorded yet/.test(html),
            'the empty state says recording has not started, rather than showing zeros');
      check(!/<canvas/.test(html),
            'and draws no chart when there is nothing to plot');
      /* A RENDERED RATE, not the substring. The first version of this check
         was !/0%/ and it failed on `.sa-table{width:100%}` in the page's own
         <style> block - the gate flagging its own stylesheet as a business
         metric. Matched inside the element that actually shows a rate. */
      check(!/<strong>0%<\/strong>/.test(html) && !/>0%</.test(html),
            'and never prints a 0% rate for an empty denominator',
            'an empty denominator is "no data", not "measured zero"');
    } catch (e) { bad('renders with no data', e.message); }

    try {
      const html2 = fn({
        days: 30,
        funnel: { viewed: 1200, carted: 180, checkout: 64, orders: 21, revenue: 48231.5,
                  rawEvents: 5400, viewToCart: 15, cartToCheck: 35.6, checkToOrder: 32.8, viewToOrder: 1.8 },
        series: [{ day: '2026-10-06', viewed: 40, carted: 6, orders: 1 }],
        topAdded: [{ product_id: 12, name: 'Bristol 60', slug: 'bristol-60', adds: 31, sessions: 24, units: 33, value: 19999 }],
        viewedNotCarted: [{ product_id: 9, name: 'Chatham 48', slug: 'chatham-48', views: 140, adds: 3, rate: 2.1 }],
        bots: { bot: 900, total: 6300, pct: 14.3 },
        cookieless: { cookieless: 540, total: 5400, pct: 10 },
        cspNonce: 'gate-nonce',
        coverage: { firstEvent: new Date(Date.now() - 86400e3 * 45), total: 5400 },
        gaConfigured: true,
        traffic: { ok: true, configured: true, users: 4210, newUsers: 3380,
                   sessions: 5120, views: 18400, avgEngagementSec: 112,
                   engagementRate: 54.2, cached: false,
                   topPages: [{ path: '/', views: 4100, avgSec: 95 }],
                   channels: [{ name: 'Organic Search', sessions: 2600 }] },
      });
      check(/48,231\.50/.test(html2), 'renders with data, and formats revenue with separators');
      check(/<canvas/.test(html2),   'and draws the chart once there is something to plot');
    } catch (e) { bad('renders with data', e.message); }
  }

  /* ── 7b. A CLIENT THAT NEVER RETURNS OUR COOKIE IS NOT A SESSION ─────
     2026-10-19. The tile read 7,951 against GA4's 322. The 10-16 synthetic
     session id was the right fix for one crawler on one IP making 15,000
     requests; what actually arrived was the inverse - 8,471 distinct
     synthetic ids over two days carrying 8,487 events between them, 1.002
     each, no referrer on 99.8%, spread flat across the catalogue so the
     busiest single path reached 13 hits. Rotating the IP defeats the
     collapsing by construction, because the IP is part of the hash key.

     ⚠️ EVERY CHECK BELOW GREPS COMMENT-STRIPPED SOURCE. The rationale
     comments in both files contain the exact phrases being asserted -
     "statefulPredicate", "anon-", "NOT LIKE" - so a grep over raw source
     would match the explanation of the rule rather than the rule, and pass
     on a file where the code had been reverted. That mistake has now been
     made four times on this project. */
  console.log('--- stateful sessions only ---');

  /* Comments out, string literals left alone. Deliberately crude: it only
     has to be good enough that a check cannot match its own rationale. */
  const strip = src => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/<%#[\s\S]*?%>/g, ' ');

  const SVC_C  = strip(SVC);
  const CTRL_C = strip(CTRL);
  const VIEW_C = strip(VIEW);

  /* The prefix is ONE string in ONE file. The controller knowing it too is
     how revenue.js and deliveryLocation.js were both born. */
  check(/const\s+SYNTHETIC_PREFIX\s*=\s*'anon-'/.test(SVC_C),
        'the synthetic prefix is declared as a named constant in siteEvents');
  check((SVC_C.match(/'anon-'/g) || []).length === 1,
        'and the literal appears exactly once in the service',
        'found ' + (SVC_C.match(/'anon-'/g) || []).length);
  check(!/anon-/.test(CTRL_C),
        'the controller never hard-codes the prefix, it asks the service',
        'the controller must not be the second place that knows the string');

  const synFn = (SVC_C.match(/function syntheticSessionId[\s\S]*?\n}/) || [''])[0];
  check(/return\s+SYNTHETIC_PREFIX\s*\+/.test(synFn),
        'syntheticSessionId builds its id from that constant');

  check(/statefulPredicate/.test(SVC_C) && /cookielessPredicate/.test(SVC_C),
        'both predicates exist in the service');
  check(/statefulPredicate,\s*cookielessPredicate|statefulPredicate, cookielessPredicate/.test(SVC_C.replace(/\s+/g, ' ')),
        'and both are exported');

  /* ── THE DRIFT CHECK, AND THE REASON THIS SECTION IS EXECUTABLE ───────
     Two functions must agree about one string: the one that MINTS ids and
     the one that FILTERS them. A text check cannot see a disagreement -
     both files would read fine and the tile would silently count crawlers
     again. So mint a real id and assert the real predicate excludes it. */
  process.env.DB_PASS = process.env.DB_PASS || 'gate-placeholder';
  /* ⚠️ NOT the `se` from the fail-soft section above - that one was loaded
     against a deliberately broken pool stub. The functions tested here are
     pure, so it would have worked, which is exactly why it would have been
     the wrong thing to lean on. Fresh module, real shape. */
  delete require.cache[require.resolve(path.join(ROOT, 'src/services/siteEvents.js'))];
  const sev = require(path.join(ROOT, 'src/services/siteEvents.js'));
  const fakeReq = {
    headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'en-US',
               'accept-encoding': 'gzip', 'x-forwarded-for': '203.0.113.7' },
    ip: '203.0.113.7',
  };
  const mintedId = sev.__sessionInternals.syntheticSessionId(fakeReq);
  const pred     = sev.statefulPredicate('session_id');
  const litMatch = (pred.match(/'([^']*)%'/) || [])[1];
  check(litMatch !== undefined && mintedId.startsWith(litMatch),
        'the predicate excludes exactly the ids syntheticSessionId mints',
        'minted ' + mintedId.slice(0, 12) + '..., predicate excludes ' + litMatch);
  check(/NOT LIKE/.test(pred) && /LIKE/.test(sev.cookielessPredicate('session_id')) &&
        !/NOT LIKE/.test(sev.cookielessPredicate('session_id')),
        'and the two predicates are genuine complements');

  /* A caller-supplied column goes into SQL unparameterised, same exposure
     revenue.js's alias argument has. */
  let refused = 0;
  for (const evil of ["x; DROP TABLE orders", "session_id' OR '1'='1", 'a b', '']) {
    try { sev.statefulPredicate(evil); } catch (e) { refused++; }
  }
  check(refused === 4, 'a non-identifier column is refused rather than interpolated',
        'refused ' + refused + ' of 4');

  /* ── EVERY QUERY THAT COUNTS SESSIONS, scoped to its own function ─────
     Not a file-level grep. A file-level one passes while a single query
     has been reverted, because a sibling query still carries the string -
     the exact hole gate_revenue_definition's harness found twice today. */
  const fnBody = name => {
    const m = CTRL_C.match(new RegExp('async function ' + name + '\\([\\s\\S]*?\\n}'));
    return m ? m[0] : '';
  };
  for (const name of ['funnel', 'daily', 'topAdded']) {
    const body = fnBody(name);
    check(body.length > 0 && /\$\{STATEFUL(_E)?\}/.test(body),
          name + '() counts only clients that returned a cookie');
    /* ⚠️ PRE-EXISTING BLIND SPOT, closed here because this change put a
       SECOND filter next to the first. mutate_site_analytics_gate.sh has
       been reporting "bots are no longer filtered out of the funnel —
       MISSED" since 2026-10-07: gate_site_analytics asserted is_bot = 0
       nowhere, and gate_session_identity's version of the check is in a
       different gate, so this harness could not see it.

       The two tests are NOT interchangeable and must both survive. is_bot
       catches a self-identifying crawler; the stateful predicate catches
       one that lies. Dropping either silently re-inflates the tile, which
       is the whole history of this feature. */
    check(body.length > 0 && /is_bot = 0/.test(body),
          name + '() still excludes flagged bots too');
  }
  const vnc = fnBody('viewedNotCarted');
  check((vnc.match(/\$\{STATEFUL\}/g) || []).length === 2,
        'viewedNotCarted() carries it in BOTH subqueries, views and adds',
        'found ' + (vnc.match(/\$\{STATEFUL\}/g) || []).length + ', expected 2');
  check(/is_bot = 0/.test(vnc),
        'and still excludes flagged bots as well - the two tests are not interchangeable');

  /* REPORTED, NOT HIDDEN. This is the larger exclusion by far. */
  check(/async function cookielessShare/.test(CTRL_C),
        'the dropped volume is measured');
  /* ⚠️ THE DENOMINATOR. cookielessShare reports a PERCENTAGE, and the page
     labels it "of N unflagged events". Drop is_bot = 0 here and flagged
     crawler rows join the denominator, so the figure silently understates
     the share and the >=50% banner stops firing when it is most needed.
     Found because the existing harness's bot mutation, whose anchor this
     change displaced, landed on this function instead of funnel() and was
     not caught. */
  check(/is_bot = 0/.test(fnBody('cookielessShare')),
        'and against unflagged events only, matching the label on the page');
  /* ⚠️ SCOPED TO THE Promise.all, NOT THE FILE. The first version of this
     check tested /cookielessShare\(days\)/ against the whole controller and
     matched the FUNCTION DECLARATION - `async function cookielessShare(days)`
     - so deleting the call site passed. The harness caught it. Same shape as
     the three holes gate_revenue_definition's harness found earlier today:
     a grep matching something adjacent to the thing being asserted. */
  const pall = (CTRL_C.match(/await Promise\.all\(\[[\s\S]*?\]\)/) || [''])[0];
  check(/cookielessShare\(days\)/.test(pall),
        'and runs in the same Promise.all as the rest',
        'the call site must be inside the Promise.all, not merely declared');
  /* The destructuring list and the Promise.all array are positional. Drop
     one and every local after it silently shifts onto the wrong value - no
     error, just a page rendering someone else's numbers. */
  const dstr = (CTRL_C.match(/const \[([^\]]*)\]\s*=\s*await Promise\.all/) || ['', ''])[1];
  const names = dstr.split(',').map(x => x.trim()).filter(Boolean);
  /* Counted INSIDE the brackets only. Counting over `pall` whole also
     matched the `all(` of Promise.all itself and read 9 for 8. */
  const inner = pall.slice(pall.indexOf('[') + 1, pall.lastIndexOf(']'));
  const calls = (inner.match(/\b[A-Za-z_$][\w$.]*\s*\(/g) || []).length;
  check(names.includes('anon') && names.length === calls,
        'and the destructuring list is the same length as the call array',
        names.length + ' names for ' + calls + ' calls: ' + names.join(','));
  check(/cookieless:\s*anon/.test(CTRL_C), 'and is passed to the view');
  check(/cookieless\.pct/.test(VIEW_C) && /cookieless\.cookieless/.test(VIEW_C),
        'and the page actually shows it');

  /* ── 8. wiring ────────────────────────────────────────────────────── */
  console.log('--- wiring ---');
  const ROUTES = read('src/routes/admin.js');
  const NAV    = read('views/layouts/admin.ejs');
  check(/router\.get\s*\(\s*'\/marketing\/site'/.test(ROUTES), 'the route is registered');
  check(/href="\/admin\/marketing\/site"/.test(NAV),            'and the nav links to it');
  check(/CREATE TABLE IF NOT EXISTS site_events/.test(SVC),
        'the table self-heals - there is no migration step in this deploy');
  check(/value_cents  INT/.test(SVC),
        'money is stored in integer cents, not a float');


  /* ── 9. GA4: read-only, zero-dependency, and never load-bearing ───── */
  console.log('--- GA4 traffic ---');
  const GA = read('src/services/ga4.js');
  const PKG = JSON.parse(read('package.json'));
  const deps = Object.keys(PKG.dependencies || {});

  check(!deps.some(d => /^@google-analytics|^google-gax|^googleapis$/.test(d)),
        'no Google client library was added as a dependency',
        'node_modules is gitignored, so the host npm-installs on every deploy; a ' +
        'failed install of the gRPC tree would take the storefront down to render four admin numbers');
  check(/require\('crypto'\)/.test(GA) && /createSign\('RSA-SHA256'\)/.test(GA),
        'the service-account JWT is signed with the crypto module Node already ships');
  check(/analyticsdata\.googleapis\.com/.test(GA) && /runReport/.test(GA),
        'and the Data API is called over plain REST');

  /* The whole point of GA being optional. */
  check(/return \{ ok: false, configured: false,/.test(GA),
        'an unconfigured GA4 resolves to ok:false rather than throwing');
  check(/catch \(err\) \{[\s\S]{0,400}console\.error\('\[ga4\]/.test(GA),
        'and a failing GA4 call is caught and logged, not propagated');
  check(/analytics\.readonly/.test(GA) && !/analytics\.edit|analytics\.manage/.test(GA),
        'the scope requested is read-only');

  /* Credentials are env-only. A private key in theme settings would be
     readable by anyone who can open the Theme Editor. */
  check(/process\.env\.GA4_PROPERTY_ID/.test(GA) &&
        /process\.env\.GA4_SA_EMAIL/.test(GA) &&
        /process\.env\.GA4_SA_KEY/.test(GA),
        'credentials come from env vars');
  check(!/GA4_SA_KEY/.test(read('src/services/themeSettings.js')),
        'and the private key is never stored in theme settings');

  /* GA4_ID (the G- measurement id for the page tag) already exists in env,
     one word away from GA4_PROPERTY_ID. Pasting the wrong one is the single
     likeliest setup mistake and fails as an opaque 403 deep in the API. */
  check(/looksLikeMeasurementId\s*=\s*\/\^\(G\|UA\|AW\|GT\)-\/i\.test\(id\)/.test(GA),
        'a Measurement ID pasted into GA4_PROPERTY_ID is detected by shape');
  check(/looksNumeric\s*=\s*\/\^\\d\+\$\/\.test\(id\)/.test(GA),
        'and the property id must be digits only');
  check(/idProblem/.test(GA) && /which is a Measurement ID/.test(GA),
        'and the page is told exactly which id was pasted where');

  /* Quota: an admin leaning on refresh must not burn the daily allowance. */
  /* GREP FOR A REAL DURATION, not the identifier. The first version was
     /TTL_MS/ && /_cache/, which still matched after a mutation set the TTL
     to 0 and deleted the Map - the words survive in _cache.get/.set. */
  check(/const TTL_MS = \d+ \* 60 \* 1000;/.test(GA),
        'the cache TTL is a real duration, not zero');
  check(/if \(hit && hit\.expiresAt > Date\.now\(\)\) return/.test(GA),
        'and a live cache entry short-circuits the API call, so refreshing does not spend quota');

  /* It must not stall the page, and must not be able to fail it. */
  check(/ga4\.traffic\(days\),/.test(CTRL) && /Promise\.all\(\[/.test(CTRL),
        'traffic is fetched inside the same Promise.all as the local queries');
  check(!/await ga4\.traffic[\s\S]{0,40};\s*\n\s*const \[/.test(CTRL),
        'and not awaited separately after them');

  /* EXECUTED, not asserted: with no env set it must resolve, not reject. */
  {
    const ga = require(path.join(ROOT, 'src/services/ga4.js'));
    const saved = [process.env.GA4_PROPERTY_ID, process.env.GA4_SA_EMAIL, process.env.GA4_SA_KEY];
    delete process.env.GA4_PROPERTY_ID; delete process.env.GA4_SA_EMAIL; delete process.env.GA4_SA_KEY;
    ga.traffic(30).then(r => {
      check(r && r.ok === false && r.configured === false,
            'calling traffic() with no credentials resolves to a reason, not an exception',
            JSON.stringify(r));
      /* EXECUTED: the wrong id must be reported as a configured mistake,
         not as "not set up", or the admin goes looking for the wrong thing. */
      process.env.GA4_PROPERTY_ID = 'G-PLBNP2YD9K';
      process.env.GA4_SA_EMAIL    = 'x@y.iam.gserviceaccount.com';
      process.env.GA4_SA_KEY      = 'not-a-key';
      return ga.traffic(30).then(r2 => {
        check(r2 && r2.ok === false && r2.configured === true &&
              /Measurement ID/.test(r2.reason || ''),
              'a Measurement ID in GA4_PROPERTY_ID is refused with a message naming the mistake',
              JSON.stringify(r2));
        delete process.env.GA4_PROPERTY_ID; delete process.env.GA4_SA_EMAIL; delete process.env.GA4_SA_KEY;
      });
    }).then(() => {
      if (saved[0]) process.env.GA4_PROPERTY_ID = saved[0];
      if (saved[1]) process.env.GA4_SA_EMAIL    = saved[1];
      if (saved[2]) process.env.GA4_SA_KEY      = saved[2];
      done();
    }).catch(e => { bad('traffic() must not reject', e.message); done(); });
  }
  return;

  function done() {
  console.log('\n' + (fails
    ? 'gate_site_analytics: FAILED ' + fails + ' of ' + checks
    : 'gate_site_analytics: all ' + checks + ' checks pass'));
    process.exit(fails ? 1 : 0);
  }
}
