'use strict';

/* ── Cart helpers ───────────────────────────────────────────────── */
function getCart(req) {
  if (!req.session.cart) req.session.cart = { items: [], count: 0, subtotal: 0 };
  return req.session.cart;
}

function recalc(cart) {
  cart.count    = cart.items.reduce((s, i) => s + i.qty, 0);
  cart.subtotal = parseFloat(
    cart.items.reduce((s, i) => s + i.qty * i.price, 0).toFixed(2)
  );
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
  const qty   = Math.max(1, parseInt(rawQty || '1', 10));
  const pricef = parseFloat(price);

  const existing = cart.items.find(i => i.product_id === product_id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.items.push({ product_id, slug, name, price: pricef, image: image || null, qty });
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
