'use strict';
/* Gates for /checkout/identify and requireIdentity.
 *
 * The guard is MOUNTED IN A REAL EXPRESS APP and driven with real
 * requests. Route-order bugs — a guard declared after the routes it
 * should protect, or accidentally covering the Stripe return — are
 * invisible to grep and obvious to a request.
 *
 * checkoutController is not loaded here (it pulls in the database and
 * Stripe); the routes are rebuilt with stub handlers in the SAME ORDER
 * as src/routes/checkout.js, and that ordering is asserted separately
 * against the real file so the two cannot drift.
 */

const assert = require('assert');
const path   = require('path');
const fs     = require('fs');
const http   = require('http');

const ROOT = path.join(__dirname, '..');
let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail++;
};

const requireIdentity = require(path.join(ROOT, 'src/middleware/requireIdentity'));

let express;
try { express = require('express'); }
catch { console.log('  express not resolvable — cannot run'); process.exit(1); }

/* ── a real app ──────────────────────────────────────────────────── */
function buildApp() {
  const app = express();
  app.use(express.json());

  // Minimal session stand-in. Each request carries its own.
  app.use((req, res, next) => {
    req.session = app.locals.session;
    next();
  });

  const r = express.Router();
  r.get('/identify', (req, res) => res.status(200).send('IDENTIFY'));
  r.get('/return',   (req, res) => res.status(200).send('RETURN'));
  r.get('/success',  (req, res) => res.status(200).send('SUCCESS'));
  r.get('/cancel',   (req, res) => res.status(200).send('CANCEL'));
  r.use(requireIdentity);
  r.get('/',               (req, res) => res.status(200).send('INFO'));
  r.post('/info',          (req, res) => res.status(200).send('SAVED'));
  r.get('/delivery',       (req, res) => res.status(200).send('DELIVERY'));
  r.post('/delivery',      (req, res) => res.status(200).send('DELIVERY_SAVED'));
  r.get('/payment',        (req, res) => res.status(200).send('PAYMENT'));
  r.post('/session',       (req, res) => res.json({ ok: true }));
  r.post('/order-details', (req, res) => res.json({ ok: true }));
  app.use('/checkout', r);
  return app;
}

const app = buildApp();
let server, base;

function req(method, urlPath, { json = false, session = {} } = {}) {
  app.locals.session = session;
  return new Promise((resolve) => {
    const r = http.request({
      hostname: '127.0.0.1', port: server.address().port,
      path: urlPath, method,
      headers: json
        ? { 'content-type': 'application/json', accept: 'application/json' }
        : { accept: 'text/html' },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({
        status: res.statusCode, location: res.headers.location, body, session: app.locals.session,
      }));
    });
    r.on('error', () => resolve({ status: 0, body: '' }));
    if (json) r.write('{}');
    r.end();
  });
}

(async () => {
  server = app.listen(0);
  await new Promise(r => server.once('listening', r));

  const OUT = {};                       // signed out
  const IN  = { customerId: 42 };       // signed in

  console.log('--- anonymous is bounced ---');
  for (const p of ['/checkout', '/checkout/delivery', '/checkout/payment']) {
    const r = await req('GET', p, { session: { ...OUT } });
    ok(`GET ${p} redirects to identify`,
       r.status === 302 && r.location === '/checkout/identify',
       `${r.status} ${r.location}`);
  }

  console.log('--- the sign-in page itself is NOT guarded ---');
  {
    const r = await req('GET', '/checkout/identify', { session: { ...OUT } });
    ok('GET /checkout/identify serves (no redirect loop)',
       r.status === 200 && r.body === 'IDENTIFY', `${r.status} -> ${r.location}`);
  }

  console.log('--- the Stripe return is NOT guarded ---');
  /* A buyer whose session expired during payment HAS ALREADY BEEN
     CHARGED. Bouncing them to sign-in instead of their confirmation is
     the worst failure in this file. */
  for (const [p, want] of [['/checkout/return', 'RETURN'],
                           ['/checkout/success', 'SUCCESS'],
                           ['/checkout/cancel', 'CANCEL']]) {
    const r = await req('GET', p, { session: { ...OUT } });
    ok(`GET ${p} serves while signed OUT`,
       r.status === 200 && r.body === want, `${r.status} -> ${r.location}`);
  }

  console.log('--- signed in passes through ---');
  for (const p of ['/checkout', '/checkout/delivery', '/checkout/payment']) {
    const r = await req('GET', p, { session: { ...IN } });
    ok(`GET ${p} serves when signed in`, r.status === 200, String(r.status));
  }

  console.log('--- returnTo is remembered, and narrow ---');
  {
    const s = { ...OUT };
    await req('GET', '/checkout/delivery', { session: s });
    ok('returnTo records the page they wanted', s.returnTo === '/checkout/delivery', s.returnTo);
  }
  {
    const s = { ...OUT };
    await req('GET', '/checkout/payment?foo=bar', { session: s });
    ok('query string is stripped from returnTo', s.returnTo === '/checkout/payment', s.returnTo);
  }
  console.log('    (open-redirect shapes, tested against the exported matcher)');
  for (const bad of ['//evil.com', '/evil', 'https://evil.com', '/checkout/../admin',
                     '/checkoutX', '/account']) {
    ok(`rejects ${bad}`, !requireIdentity.SAFE_RETURN.test(bad), 'ACCEPTED');
  }
  for (const good of ['/checkout', '/checkout/delivery', '/checkout/payment']) {
    ok(`accepts ${good}`, requireIdentity.SAFE_RETURN.test(good), 'rejected');
  }

  console.log('--- POST without identity ---');
  {
    const r = await req('POST', '/checkout/session', { json: true, session: { ...OUT } });
    ok('AJAX POST gets 401 JSON, not a 302 to HTML',
       r.status === 401 && /"ok":false/.test(r.body), `${r.status} ${r.body.slice(0, 60)}`);
  }
  {
    const r = await req('POST', '/checkout/info', { session: { ...OUT } });
    ok('form POST is redirected, not given JSON',
       r.status === 302 && r.location === '/checkout/identify', `${r.status} ${r.location}`);
  }
  {
    const r = await req('POST', '/checkout/session', { json: true, session: { ...IN } });
    ok('signed-in AJAX POST passes', r.status === 200, String(r.status));
  }

  server.close();

  /* ── the real route file must match the order tested above ──────── */
  console.log('--- real route file ordering ---');
  const rt = fs.readFileSync(path.join(ROOT, 'src/routes/checkout.js'), 'utf8');
  const code = rt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const iGuard    = code.indexOf('router.use(requireIdentity)');
  const iIdentify = code.indexOf("'/identify'");
  const iReturn   = code.indexOf("'/return'");
  const iSuccess  = code.indexOf("'/success'");
  const iCancel   = code.indexOf("'/cancel'");
  const iShow     = code.indexOf("router.get ('/',");
  const iInfo     = code.indexOf("'/info'");
  const iPayment  = code.indexOf("'/payment'");

  ok('guard is registered', iGuard !== -1, 'router.use(requireIdentity) missing');
  ok('/identify is BEFORE the guard', iIdentify !== -1 && iIdentify < iGuard,
     `identify@${iIdentify} guard@${iGuard}`);
  ok('/return is BEFORE the guard',  iReturn  !== -1 && iReturn  < iGuard, 'paid buyer would be bounced');
  ok('/success is BEFORE the guard', iSuccess !== -1 && iSuccess < iGuard, 'paid buyer would be bounced');
  ok('/cancel is BEFORE the guard',  iCancel  !== -1 && iCancel  < iGuard, 'bounced');
  ok('GET / is AFTER the guard',     iShow    !== -1 && iShow    > iGuard, 'checkout is unprotected');
  ok('/info is AFTER the guard',     iInfo    !== -1 && iInfo    > iGuard, 'unprotected');
  ok('/payment is AFTER the guard',  iPayment !== -1 && iPayment > iGuard, 'unprotected');

  ok('no duplicate /return registration',
     (code.match(/router\.get\s*\(\s*'\/return'/g) || []).length === 1, 'registered twice');

  console.log('--- controller + view ---');
  const cc = fs.readFileSync(path.join(ROOT, 'src/controllers/checkoutController.js'), 'utf8');
  ok('identifyPage exported', /exports\.identifyPage\s*=/.test(cc), 'missing');
  ok('already-signed-in short-circuits', /identifyPage[\s\S]{0,600}session\.customerId/.test(cc), 'missing');
  ok('empty cart redirects to /cart', /identifyPage[\s\S]{0,900}redirect\('\/cart'\)/.test(cc), 'missing');

  const v = fs.readFileSync(path.join(ROOT, 'views/pages/checkout-identify.ejs'), 'utf8');
  ok('view posts to the EXISTING /account/code', /'\/account\/code'/.test(v), 'missing');
  ok('view posts to the EXISTING /account/verify', /'\/account\/verify'/.test(v), 'missing');
  ok('view does NOT invent its own auth endpoint',
     !/\/checkout\/(code|verify|login)/.test(v), 'second auth path found');
  ok('uses X-CSRF-Token header', /'X-CSRF-Token'/.test(v), 'wrong header name');
  ok('navigates only to the server-supplied redirect',
     /r\.body\.redirect/.test(v), 'page chooses its own destination');

  console.log('--- the cart survives sign-in ---');
  const ac = fs.readFileSync(path.join(ROOT, 'src/controllers/accountController.js'), 'utf8');
  const acCode = ac.replace(/\/\*[\s\S]*?\*\//g, '');
  const iCarry = acCode.indexOf('const carried');
  const iRegen = acCode.indexOf('session.regenerate');
  ok('cart is captured BEFORE regenerate', iCarry !== -1 && iCarry < iRegen,
     `carried@${iCarry} regen@${iRegen}`);
  ok('cart is restored after regenerate', /req\.session\[k\] = v/.test(acCode), 'not restored');
  /* Bound the search to the object literal itself. A lazy [\s\S]*?
     still runs past the closing brace and happily matches the
     legitimate `req.session.customerId = customer.id` that follows the
     regenerate — which is the assignment that MUST be there. That
     version of this assertion failed on correct code. */
  const carriedLit = (acCode.match(/const carried\s*=\s*\{([\s\S]*?)\n\s*\};/) || [])[1] || '';
  ok('the carried object was found', carriedLit.length > 0, 'could not isolate it');
  ok('customerId is NOT carried across', !/customerId/.test(carriedLit),
     'session fixation guard defeated: ' + carriedLit.trim().slice(0, 80));
  ok('only cart and checkout drafts are carried',
     /cart/.test(carriedLit) && !/customer\b/.test(carriedLit),
     carriedLit.trim().slice(0, 80));

  console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
  process.exit(fail ? 1 : 0);
})();
