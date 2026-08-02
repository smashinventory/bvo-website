'use strict';

/* ── Cart helpers ───────────────────────────────────────────────── */
function getCart(req) {
  if (!req.session.cart) req.session.cart = { items: [], count: 0, subtotal: 0 };
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
exports.add = (req, res) => {
  const cart  = getCart(req);
  const { product_id, slug, name, price, image, qty: rawQty } = req.body;

  // Reject add if product_id is missing — happens when FormData is sent instead
  // of application/x-www-form-urlencoded (Express urlencoded can't parse multipart).
  if (!product_id) {
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' ||
        req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ ok: false, error: 'Missing product_id' });
    }
    return res.redirect('/cart');
  }

  const qty    = Math.max(1, parseInt(rawQty || '1', 10));
  // Guard: parseFloat(undefined/null/NaN) → 0 so we never store NaN in the session
  // (JSON.stringify(NaN) → null, and null.toLocaleString() throws in cart.ejs).
  const pricef = parseFloat(price) || 0;

  const existing = cart.items.find(i => i.product_id === product_id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.items.push({ product_id, slug: slug || '', name: name || '', price: pricef, image: image || null, qty });
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
