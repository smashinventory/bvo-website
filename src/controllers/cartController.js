'use strict';

const { bvoPool } = require('../config/database');

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

function recalc(cart) {
  cart.count    = cart.items.reduce((s, i) => s + i.qty, 0);
  // Guard: i.price may be null/NaN if a poisoned session entry slipped through;
  // treat null/NaN as 0 so the reduce never produces NaN (which JSON serialises
  // to null and then crashes cart.ejs on .toLocaleString()).
  const raw = cart.items.reduce((s, i) => s + i.qty * (parseFloat(i.price) || 0), 0);
  cart.subtotal = parseFloat(raw.toFixed(2));
}

/* ── GET /cart ──────────────────────────────────────────────────── */
exports.index = (req, res) => {
  const cart = getCart(req);
  res.render('pages/cart', {
    pageTitle: `Cart (${cart.count}) | BathroomVanitiesOutlet.com`,
    metaDesc:  '',
    cart,
    freeShipping: true, // BVO always free
  });
};

/* ── POST /cart/add ─────────────────────────────────────────────── */
exports.add = async (req, res) => {
  const cart = getCart(req);
  const {
    product_id, slug, name, image, qty: rawQty,
    bundle_discount_pct,
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
  let pricef, comparePricef;
  try {
    const [rows] = await bvoPool.query(
      'SELECT price, compare_price FROM products WHERE id = ? AND is_active = 1',
      [product_id]
    );
    if (!rows.length) {
      return res.status(400).json({ ok: false, error: 'Product not found' });
    }
    pricef        = parseFloat(rows[0].price)         || 0;
    comparePricef = parseFloat(rows[0].compare_price) || 0;  // MSRP — 0 means not set
  } catch (err) {
    console.error('[cart/add] DB price lookup failed:', err.message);
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' ||
        req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ ok: false, error: 'Unable to add item. Please try again.' });
    }
    return res.redirect('/cart');
  }

  const qty = Math.max(1, parseInt(rawQty || '1', 10) || 1);

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
  } else {
    cart.items.push({
      product_id,
      slug:                slug  || '',
      name:                name  || '',
      price:               pricef,
      image:               image || null,
      qty,
      original_price:      comparePricef || pricef,  // MSRP, falls back to sale price
      compare_price:       comparePricef,             // MSRP (0 = not set)
      bundle_discount_pct: bundleDiscPct,
    });
  }

  recalc(cart);
  req.session.cart = cart;

  // AJAX check — if fetch/XHR, return JSON; otherwise redirect
  if (req.headers['x-requested-with'] === 'XMLHttpRequest' ||
      req.headers.accept?.includes('application/json')) {
    return res.json({ ok: true, count: cart.count, subtotal: cart.subtotal });
  }
  res.redirect('/cart');
};

/* ── POST /cart/update ──────────────────────────────────────────── */
exports.update = (req, res) => {
  const cart = getCart(req);
  const { product_id, qty: rawQty } = req.body;
  const qty = parseInt(rawQty, 10);

  if (qty <= 0) {
    cart.items = cart.items.filter(i => i.product_id !== product_id);
  } else {
    const item = cart.items.find(i => i.product_id === product_id);
    if (item) item.qty = qty;
  }

  recalc(cart);
  req.session.cart = cart;
  res.redirect('/cart');
};

/* ── POST /cart/remove ──────────────────────────────────────────── */
exports.remove = (req, res) => {
  const cart = getCart(req);
  cart.items  = cart.items.filter(i => i.product_id !== req.body.product_id);
  recalc(cart);
  req.session.cart = cart;
  res.redirect('/cart');
};
