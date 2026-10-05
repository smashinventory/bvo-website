'use strict';

const { bvoPool } = require('../config/database');
/* ⚠️ THE ONLY PLACE A LINE PRICE IS DECIDED. This formula used to be
   written out here, in checkoutController.calcTotal and again in
   stripeService.buildLineItems — three copies, and the Stripe one is
   what charges the card. See the header of cartPricing.js. */
const pricing = require('../utils/cartPricing');
const SAMPLE  = require('../config/sampleOffer');
const SampleRedemption = require('../models/SampleRedemption');

/* ── Cart helpers ───────────────────────────────────────────────── */
function getCart(req) {
  if (!req.session.cart) req.session.cart = { items: [], count: 0, subtotal: 0 };
  // Self-heal: drop poisoned entries (null/empty product_id from old FormData bug
  // where Express urlencoded couldn't parse multipart bodies → req.body was {}).
  const items = req.session.cart.items || [];
  const clean = items.filter(
    i => i.product_id != null && i.product_id !== '' && String(i.product_id) !== 'undefined'
  );
  if (clean.length !== items.length) {
    req.session.cart.items = clean;
    recalc(req.session.cart);
  }
  return req.session.cart;
}

/* Recalculate the cart's own figures. Delegates to cartPricing so the
   cart page, orders.subtotal and the Stripe charge cannot disagree.
 *
 * ⚠️ NO sampleEligible HERE, deliberately. Whether this customer may take
 * free samples is a database question (has this email or address already
 * redeemed?) and recalc is called from synchronous session handlers. The
 * promotion is applied where eligibility is actually known — see
 * cartController.index and the checkout flow — so a cart mutated by a
 * route that has not asked prices at FULL price. Failing closed means a
 * customer occasionally sees the discount appear a step later; failing
 * open would mean giving samples away to everyone, forever. */
function recalc(cart) {
  const priced  = pricing.priceCart(cart.items);
  cart.count    = pricing.itemCount(cart.items);
  cart.subtotal = priced.subtotal;
}

// Strip bundle discount from all items that share the same bundle_id.
// Called when any item in a bundle is removed so the remaining items
// revert to their standard sale price.
function stripBundleGroup(cart, bundleId) {
  if (!bundleId) return;
  cart.items.forEach(i => {
    if (i.bundle_id === bundleId) i.bundle_discount_pct = 0;
  });
}

/* ── GET /cart ──────────────────────────────────────────────────── */
exports.index = async (req, res, next) => {
  try {
    const cart = getCart(req);

    /* ── THE FREE-SAMPLE OFFER ON THE CART PAGE ────────────────────
       Three states, and the distinction matters because one of them is
       a promise we cannot yet keep.

       signed in  -> we know their email, so eligibility is a real
                     answer and the discount is applied and priced.
       signed out  -> we know nothing. The samples price at full value
                     and the page says the first two come off at
                     checkout. NOT applied to the total, because showing
                     a discount we have not verified is how a cart ends
                     up promising $0.00 and a card gets charged $19.98.
       ineligible  -> already redeemed on this email. Say so, quietly.

       ⚠️ THE CART IS NEVER THE AUTHORITY. checkoutController recomputes
       this from the typed address as well as the email, because the rule
       is one per email AND one per mailing address and the address does
       not exist yet at this point. */
    let sampleEligible = false;
    let sampleState    = 'unknown';
    /* The kill switch, checked first. With the offer off the cart must
       not say "your first 2 come off at checkout", because they will
       not - that promise is what made the broken checkout feel
       dishonest rather than merely broken. 'none' renders no note. */
    if (!SAMPLE.ENABLED) {
      sampleState = 'none';
    } else if (cart.items.some(i => pricing.isSample(i))) {
      if (req.session.customerId) {
        const who = req.session.customer || {};
        const e = await SampleRedemption.isEligible(who.email, null);
        sampleEligible = e.eligible;
        sampleState    = e.eligible ? 'applied' : 'used';
      }
    } else {
      sampleState = 'none';
    }

    const priced = pricing.priceCart(cart.items, { sampleEligible });
    /* Rendered figures come from the SAME call that priced the cart, not
       from cart.subtotal, which was computed without eligibility. */
    res.render('pages/cart', {
      pageTitle: `Cart (${cart.count}) | BathroomVanitiesOutlet.com`,
      metaDesc:  '',
      cart,
      freeShipping: true, // BVO always free
      sampleState,
      sampleDiscount: priced.discount,
      sampleSubtotal: priced.subtotal,
      sampleFreeUnits: priced.freeUnits,
      sampleOffer: SAMPLE,
    });
  } catch (err) { next(err); }
};

/* ── POST /cart/add ─────────────────────────────────────────────── */
exports.add = async (req, res) => {
  const cart = getCart(req);
  const {
    product_id, slug, name, image, qty: rawQty,
    bundle_discount_pct, bundle_id,
  } = req.body;
  // price, original_price, compare_price intentionally NOT read from req.body —
  // monetary values must come from the DB, never from the client.

  // Reject add if product_id is missing — happens when FormData is sent instead
  // of application/x-www-form-urlencoded (Express urlencoded can't parse multipart).
  if (!product_id) {
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' ||
        req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ ok: false, error: 'Missing product_id' });
    }
    return res.redirect('/cart');
  }

  // ── Fetch authoritative price from DB — never trust client-supplied prices ──
  let pricef, comparePricef, isSample;
  try {
    const [rows] = await bvoPool.query(
      // category_id joins the same authoritative row the price comes from.
      'SELECT price, compare_price, category_id FROM products WHERE id = ? AND is_active = 1',
      [product_id]
    );
    if (!rows.length) {
      return res.status(400).json({ ok: false, error: 'Product not found' });
    }
    pricef        = parseFloat(rows[0].price)         || 0;
    comparePricef = parseFloat(rows[0].compare_price) || 0;  // MSRP — 0 means not set
    /* ⚠️ A FREE SAMPLE IS WORTH MONEY, so what counts as a sample is
       decided HERE, from the database row, for the same reason the price
       is. Never from the name or the SKU: "Sample" appears in product
       names outside category 10, and a name test would hand out free
       vanities. Never from req.body: the client would simply claim it. */
    isSample = Number(rows[0].category_id) === SAMPLE.CATEGORY_ID;
  } catch (err) {
    console.error('[cart/add] DB price lookup failed:', err.message);
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' ||
        req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ ok: false, error: 'Unable to add item. Please try again.' });
    }
    return res.redirect('/cart');
  }

  const qty = Math.min(99, Math.max(1, parseInt(rawQty || '1', 10) || 1));

  // Validate bundle discount is exactly one of the allowed tier values (0, 5, 10, 15%).
  // Any other value (e.g. client-supplied 99) is silently reset to 0.
  const ALLOWED_BUNDLE_DISC = new Set([0, 5, 10, 15]);
  const rawDisc      = parseFloat(bundle_discount_pct) || 0;
  const bundleDiscPct = ALLOWED_BUNDLE_DISC.has(rawDisc) ? rawDisc : 0;

  const existing = cart.items.find(i => i.product_id === product_id);
  if (existing) {
    existing.qty            += qty;
    // Refresh price from DB in case it changed since the item was first added
    existing.price           = pricef;
    existing.compare_price   = comparePricef;
    existing.original_price  = comparePricef || pricef;
    /* Refreshed alongside the price, and for the same reason: a line
       added before this flag existed, or before the product was moved
       into/out of category 10, must not keep a stale answer to "is this
       free?". */
    existing.is_sample       = isSample;
  } else {
    cart.items.push({
      product_id,
      slug:                slug      || '',
      name:                name      || '',
      price:               pricef,
      /* Boolean, not the raw category_id: cartPricing requires === true,
         so a truthy string from anywhere cannot buy a free sample. */
      is_sample:           isSample,
      image:               image     || null,
      qty,
      original_price:      comparePricef || pricef,  // MSRP, falls back to sale price
      compare_price:       comparePricef,             // MSRP (0 = not set)
      bundle_discount_pct: bundleDiscPct,
      bundle_id:           bundle_id || null,         // groups items from the same bundle
    });
  }

  recalc(cart);
  req.session.cart = cart;

  // Explicitly save session before responding. express-session with
  // saveUninitialized:false doesn't flush to MySQL until after the response
  // is sent. On the very first visit (no session in MySQL yet) the bundle
  // builder's sequential fetches + immediate redirect race against the async
  // INSERT — GET /cart arrives before the write completes and sees an empty cart.
  // session.save() blocks the response until MySQL confirms the write.
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                 req.headers.accept?.includes('application/json');
  req.session.save(err => {
    if (err) console.error('[cart/add] session save error:', err.message);
    if (isAjax) return res.json({ ok: true, count: cart.count, subtotal: cart.subtotal });
    res.redirect('/cart');
  });
};

/* ── POST /cart/update ──────────────────────────────────────────── */
exports.update = (req, res) => {
  const cart = getCart(req);
  const { product_id, qty: rawQty } = req.body;
  // NaN (non-numeric input) → 0 → removes item; valid values capped at 99.
  const qty = Math.min(99, parseInt(rawQty, 10) || 0);

  if (qty <= 0) {
    const removed = cart.items.find(i => i.product_id === product_id);
    cart.items = cart.items.filter(i => i.product_id !== product_id);
    // If this item was part of a bundle, strip discounts from its bundle-mates.
    if (removed?.bundle_discount_pct > 0) stripBundleGroup(cart, removed.bundle_id);
  } else {
    const item = cart.items.find(i => i.product_id === product_id);
    if (item) item.qty = qty;
  }

  recalc(cart);
  req.session.cart = cart;
  req.session.save(err => {
    if (err) console.error('[cart/update] session save error:', err.message);
    res.redirect('/cart');
  });
};

/* ── POST /cart/remove ──────────────────────────────────────────── */
exports.remove = (req, res) => {
  const cart    = getCart(req);
  const removed = cart.items.find(i => i.product_id === req.body.product_id);
  cart.items    = cart.items.filter(i => i.product_id !== req.body.product_id);
  // If this item was part of a bundle, strip discounts from its bundle-mates.
  if (removed?.bundle_discount_pct > 0) stripBundleGroup(cart, removed.bundle_id);
  recalc(cart);
  req.session.cart = cart;
  req.session.save(err => {
    if (err) console.error('[cart/remove] session save error:', err.message);
    res.redirect('/cart');
  });
};
