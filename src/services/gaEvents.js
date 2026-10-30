'use strict';

/* gaEvents.js — GA4 ecommerce events, queued on the server, fired in the page.
 *
 * WHY QUEUED RATHER THAN FIRED FROM THE BROWSER: the add-to-cart on
 * product.ejs is a PLAIN FORM POST that redirects to /cart. There is no
 * success callback to hang a gtag() call on, and public/js/site.js is
 * minified to a single line, so putting one there is not a safe edit. The
 * bundle builder and the saved-bundles page use fetch() instead - three
 * call sites, three shapes.
 *
 * So the server, which already knows the authoritative price, queues the
 * event; the layout flushes the queue into the next render. One mechanism
 * for every path, no edit to minified code, and the payload is built from
 * the same DB row the cart used.
 *
 * SAME REQUEST OR THE NEXT ONE, correctly either way: the layout calls
 * gaFlush() DURING render, so an event queued by the controller just before
 * res.render goes out on that very page. An event queued before a redirect
 * waits in the session and goes out on the page the redirect lands on.
 * Reading the session at render time is what makes both work without the
 * controller having to know which case it is in.
 *
 * THIS IS GA4's COPY OF THE TRUTH, NOT OURS. site_events records the same
 * moments server-side and is what the admin dashboard reads. These events
 * exist so GA4's funnel and attribution reports work - so you can ask which
 * channel produced a cart. If an ad-blocker drops them, the dashboard is
 * unaffected.
 */

const MAX_QUEUED = 10;   // a redirect chain cannot balloon the session

/* gtag is only defined when GA4 runs WITHOUT GTM - main.ejs skips its
   config block entirely when GTM_ID is set. Verified live on 2026-10-07:
   gtag is a function, no gtm.js, measurement id G-PLBNP2YD9K. The emitted
   snippet still handles both, because the day GTM_ID is set is not the day
   anyone will remember this file. */
function queue(req, name, params) {
  try {
    if (!req || !req.session) return;
    const q = req.session.gaQueue || (req.session.gaQueue = []);
    if (q.length >= MAX_QUEUED) return;
    q.push({ n: String(name).slice(0, 40), p: params || {} });
  } catch (_) { /* analytics must never break a request */ }
}

/* JSON inside <script> has one escape that matters: a literal </script> in
   any string value ends the element early. Escaping the '<' of every tag
   sequence is the standard fix and leaves the JSON valid. */
function safeJson(v) {
  return JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Render the queued events as JS and clear the queue. Returns '' when there
 * is nothing to send, so the layout emits no <script> at all.
 */
function flush(req) {
  try {
    if (!req || !req.session) return '';
    const q = req.session.gaQueue;
    if (!q || !q.length) return '';
    req.session.gaQueue = [];

    const calls = q.map(e =>
      `_bvoGa(${safeJson(e.n)},${safeJson(e.p)});`
    ).join('');

    /* The same moments, sent to the Meta pixel (added 2026-10-30). Built
       from the SAME payload GA4 gets, so the two can never disagree about
       a price. Emitted only for the four events Meta has a standard name
       for; anything else stays GA4-only. */
    const metaCalls = q.map(e => {
      const m = metaEvent(e.n, e.p);
      return m ? `_bvoFb(${safeJson(m.name)},${safeJson(m.params)},${safeJson(m.opts)});` : '';
    }).join('');

    /* gtag when it exists; otherwise the GTM dataLayer shape. Neither is
       assumed to be present - a blocked tag must not throw in the page.

       _bvoFb is a no-op unless fbq exists. fbq is ONLY defined when the
       pixel block in main.ejs rendered — i.e. META_PIXEL_ID is set AND the
       visitor has not opted out (GPC or /privacy-choices). So opt-out is
       enforced by the layout, and this needs no second copy of that rule. */
    return 'function _bvoGa(n,p){try{' +
             'if(typeof gtag==="function"){gtag("event",n,p);}' +
             'else if(window.dataLayer){window.dataLayer.push({event:n,ecommerce:p});}' +
           '}catch(e){}}' +
           'function _bvoFb(n,p,o){try{' +
             'if(typeof fbq==="function"){fbq("track",n,p,o||{});}' +
           '}catch(e){}}' + calls + metaCalls;
  } catch (_) {
    return '';
  }
}

/* ── GA4 -> Meta standard events ─────────────────────────────────────────
   Meta's names and parameter shape for the four GA4 ecommerce events this
   site queues. content_ids are the same item_id GA4 receives (our product
   id), which is also what a future Meta catalog feed must use as its id
   for dynamic ads to match.

   eventID on Purchase is "purchase-<order number>". Nothing uses it yet;
   it is there so a later Conversions API (server-side) send can carry the
   same id and Meta de-duplicates the pair instead of counting the sale
   twice. Adding it now costs nothing; adding it later means a period of
   double-counted purchases. */
const META_EVENT = {
  view_item:      'ViewContent',
  add_to_cart:    'AddToCart',
  begin_checkout: 'InitiateCheckout',
  purchase:       'Purchase',
};

function metaEvent(gaName, p) {
  const name = META_EVENT[gaName];
  if (!name) return null;
  p = p || {};
  const items = Array.isArray(p.items) ? p.items : [];
  const params = {
    currency:     p.currency || 'USD',
    value:        Number(p.value) || 0,
    content_type: 'product',
    content_ids:  items.map(i => String(i.item_id)),
    contents:     items.map(i => {
      const c = { id: String(i.item_id), quantity: Number(i.quantity) || 1 };
      if (i.price) c.item_price = i.price;
      return c;
    }),
    num_items:    items.reduce((n, i) => n + (Number(i.quantity) || 1), 0),
  };
  if (name === 'ViewContent' && items[0] && items[0].item_name) {
    params.content_name = items[0].item_name;
  }
  const opts = {};
  if (name === 'Purchase' && p.transaction_id) {
    opts.eventID = 'purchase-' + String(p.transaction_id).slice(0, 60);
  }
  return { name, params, opts };
}

/* ── payload builders ───────────────────────────────────────────────────
   One place that knows GA4's ecommerce shape, so four call sites cannot
   each invent a slightly different item object. */

function item(o) {
  const it = {
    item_id:   String(o.id != null ? o.id : (o.product_id || '')),
    item_name: String(o.name || '').slice(0, 100),
    quantity:  Number(o.qty) > 0 ? Number(o.qty) : 1,
  };
  const price = Number(o.price);
  if (isFinite(price) && price > 0) it.price = Math.round(price * 100) / 100;
  if (o.brand)    it.item_brand    = String(o.brand).slice(0, 100);
  if (o.category) it.item_category = String(o.category).slice(0, 100);
  return it;
}

function money(v) {
  const n = Number(v);
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

const CURRENCY = 'USD';

function viewItem(req, product) {
  if (!product) return;
  queue(req, 'view_item', {
    currency: CURRENCY,
    value:    money(product.price),
    items:    [item({ id: product.id, name: product.name, price: product.price,
                      brand: product.brand, category: product.category_name, qty: 1 })],
  });
}

function addToCart(req, line) {
  if (!line) return;
  queue(req, 'add_to_cart', {
    currency: CURRENCY,
    value:    money(Number(line.price) * (Number(line.qty) || 1)),
    items:    [item(line)],
  });
}

function fromCart(req, name, cart, extra) {
  const items = ((cart && cart.items) || []).slice(0, 25).map(i =>
    item({ id: i.product_id, name: i.name, price: i.price, qty: i.qty }));
  if (!items.length) return;
  queue(req, name, Object.assign({
    currency: CURRENCY,
    value:    money(cart && cart.subtotal),
    items,
  }, extra || {}));
}

module.exports = { queue, flush, viewItem, addToCart, fromCart, metaEvent };
