#!/usr/bin/env node
'use strict';

/* gate_ga_events.js — GA4 ecommerce events (phase 2).
 *
 * WHAT THESE ARE FOR: GA4 could already say where visitors came from, but
 * not which channel produced a cart, because the codebase fired no
 * gtag('event', ...) at all. These four events are what make GA4's funnel
 * and attribution reports work. They are GA4's COPY - site_events remains
 * the first-party record the admin dashboard reads, so an ad-blocker
 * dropping these costs nothing we own.
 *
 * THE RISKS WORTH GATING:
 *
 *   1. purchase queued AFTER the cart is cleared. The basket is wiped one
 *      line later; queue below it and every purchase ships with no items.
 *      This is an ordering bug that no type system and no test of the
 *      happy path would catch - the event still fires, just empty.
 *   2. purchase valued from the cart subtotal instead of Stripe's
 *      amount_total. The subtotal excludes shipping and tax, so GA4's
 *      revenue would sit permanently below what was charged.
 *   3. No transaction_id, so a refreshed success page double-counts.
 *   4. The flush read eagerly instead of at render time, which silently
 *      drops every event a controller queues after the middleware.
 *   5. A product name containing </script> ending the script element.
 *   6. Anything here throwing, on a page a customer is looking at.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let checks = 0, fails = 0;
const ok    = m => { checks++; console.log('  ok   ' + m); };
const bad   = (m, d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const read  = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

const SVC  = read('src/services/gaEvents.js');
const PROD = read('src/controllers/productsController.js');
const CART = read('src/controllers/cartController.js');
const CHK  = read('src/controllers/checkoutController.js');
const SRV  = read('src/server.js');
const LAY  = read('views/layouts/main.ejs');

console.log('\ngate_ga_events — GA4 gets the four ecommerce events, correctly\n');

/* ── 1. all four exist, at the right moments ────────────────────────── */
console.log('--- the four events ---');
check(/gaEvents\.viewItem\(req, product\)/.test(PROD), 'view_item on the product page');
check(/gaEvents\.addToCart\(req, \{/.test(CART),       'add_to_cart in the cart handler');
check(/gaEvents\.fromCart\(req, 'begin_checkout'/.test(CHK), 'begin_checkout at checkout');
check(/gaEvents\.fromCart\(req, 'purchase'/.test(CHK),       'purchase after payment');

/* ── 2. THE ORDERING BUG. purchase must be queued while the cart exists ── */
console.log('--- purchase ordering ---');
/* SCOPED TO THE HANDLER. The first version compared indexOf() across the
   whole file and failed on correct code: checkoutController contains FOUR
   `req.session.cart = { items: [] ... }` lines, and the first is a guard on
   line 96, thousands of lines above the purchase queue. Comparing against
   the wrong occurrence made a true ordering look false. The clear that
   matters is the one inside returnFromStripe. */
const HANDLER_START = CHK.indexOf('exports.returnFromStripe');
const HANDLER_END   = CHK.indexOf('exports.success', HANDLER_START);
const HANDLER = (HANDLER_START > -1 && HANDLER_END > HANDLER_START)
  ? CHK.slice(HANDLER_START, HANDLER_END) : '';
const qAt     = HANDLER.indexOf("gaEvents.fromCart(req, 'purchase'");
const clearAt = HANDLER.indexOf('req.session.cart = { items: [], count: 0, subtotal: 0 };');
check(HANDLER.length > 0, 'the returnFromStripe handler was located');
check(qAt > -1 && clearAt > -1 && qAt < clearAt,
      'purchase is queued BEFORE the cart is cleared, inside returnFromStripe',
      'queued after the wipe it still fires, just with an empty items array - ' +
      'a silent failure that looks like working analytics');

check(/transaction_id: req\.session\.lastOrder\.orderNumber/.test(CHK),
      'purchase carries transaction_id, so GA4 de-duplicates a refreshed success page');
check(/value:\s+req\.session\.lastOrder\.total/.test(CHK),
      "purchase is valued from Stripe's amount_total, not the cart subtotal",
      'the subtotal excludes shipping and tax, so GA4 revenue would sit permanently low');

/* ── 3. the flush is render-time, not eager ─────────────────────────── */
console.log('--- the flush ---');
check(/res\.locals\.gaFlush\s*=\s*\(\)\s*=>/.test(SRV),
      'gaFlush is a FUNCTION on res.locals, evaluated during render',
      'an eager value would miss every event the controller queues after this middleware');
check(/typeof gaFlush === 'function'/.test(LAY) && /gaFlush\(\)/.test(LAY),
      'and the layout calls it');
check(/<% if \(_gaQ\) \{ %><script nonce="<%= cspNonce %>"/.test(LAY),
      'the emitted script carries the CSP nonce and is omitted entirely when empty');
const gtagAt  = LAY.indexOf("gtag('config'");
const flushAt = LAY.indexOf('gaFlush()');
check(gtagAt > -1 && flushAt > gtagAt,
      'and is emitted after the gtag bootstrap, so gtag exists when it runs');

/* ── 4. executed behaviour ──────────────────────────────────────────── */
console.log('--- executed ---');
const ga = require(path.join(ROOT, 'src/services/gaEvents.js'));

{   /* escaping: a product name that would otherwise end the script */
  const req = { session: {} };
  ga.viewItem(req, { id: 1, name: 'Evil </script><script>alert(1)</script>', price: 10 });
  const out = ga.flush(req);
  check(!/<\/script>/i.test(out),
        'a product name containing </script> cannot end the script element',
        out.slice(0, 120));
  check(out.indexOf('\\u003c') > -1, 'the < is escaped as \\u003c, keeping the JSON valid');
}

{   /* the queue empties, so an event cannot fire twice */
  const req = { session: {} };
  ga.addToCart(req, { product_id: 7, name: 'X', price: 5, qty: 1 });
  const first = ga.flush(req);
  const second = ga.flush(req);
  check(first.length > 0 && second === '',
        'flushing clears the queue, so a queued event fires exactly once');
}

{   /* both transports, neither assumed present */
  const req = { session: {} };
  ga.addToCart(req, { product_id: 7, name: 'X', price: 5, qty: 1 });
  const out = ga.flush(req);
  check(/typeof gtag==="function"/.test(out) && /window\.dataLayer/.test(out),
        'the snippet uses gtag when present and the dataLayer shape otherwise',
        'gtag is undefined whenever GTM_ID is set - main.ejs skips its config block');
  check(/try\{/.test(out) && /catch\(e\)\{\}/.test(out),
        'and wraps the call so a blocked tag cannot throw in the page');
}

{   /* never throws, whatever it is handed */
  let threw = false;
  try {
    ga.queue(null, 'x', {});
    ga.queue({}, 'x', {});
    ga.viewItem({ session: {} }, null);
    ga.fromCart({ session: {} }, 'purchase', null);
    ga.flush(null);
    ga.flush({});
  } catch (e) { threw = true; }
  check(!threw, 'no entry point throws on a missing session, product or cart');
}

{   /* the session cannot balloon across a redirect chain */
  const req = { session: {} };
  for (let i = 0; i < 50; i++) ga.addToCart(req, { product_id: i, name: 'X', price: 1, qty: 1 });
  check(req.session.gaQueue.length <= 10,
        'the queue is capped (' + req.session.gaQueue.length + '), so a redirect loop cannot grow the session');
}

{   /* an empty cart produces no event rather than an empty one */
  const req = { session: {} };
  ga.fromCart(req, 'purchase', { items: [], subtotal: 0 });
  check(ga.flush(req) === '',
        'an empty cart queues nothing, rather than a purchase with no items');
}

{   /* money and ids are shaped the way GA4 expects */
  const req = { session: {} };
  ga.fromCart(req, 'purchase', { items: [{ product_id: 3, name: 'A', price: 10.005, qty: 2 }], subtotal: 20.01 },
              { transaction_id: 'BVO-1', value: 24.99 });
  const out = ga.flush(req);
  check(/"transaction_id":"BVO-1"/.test(out), 'transaction_id reaches the payload');
  check(/"value":24\.99/.test(out),           'and the override value wins over the cart subtotal');
  check(/"item_id":"3"/.test(out),            'item_id is a string, as GA4 expects');
  check(/"currency":"USD"/.test(out),         'currency is set');
}

/* ── 5. the first-party record is untouched ─────────────────────────── */
console.log('--- the first-party record still stands alone ---');
check(/siteEvents\.record\(req, 'add_to_cart'/.test(CART) &&
      /siteEvents\.record\(req, 'view_item'/.test(PROD) &&
      /siteEvents\.record\(req, 'begin_checkout'/.test(CHK),
      'all three siteEvents recordings remain',
      'GA4 is the copy; the dashboard must not depend on it');
check(!/gaEvents/.test(read('src/controllers/siteAnalyticsController.js')),
      'and the admin dashboard reads none of these GA events');

console.log('\n' + (fails
  ? 'gate_ga_events: FAILED ' + fails + ' of ' + checks
  : 'gate_ga_events: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
