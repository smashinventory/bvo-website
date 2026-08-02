'use strict';

/**
 * Checkout Controller — Clover Hosted Checkout integration
 *
 * Flow:
 *  GET  /checkout        → review page (order summary + email capture)
 *  POST /checkout        → create Clover session → redirect to Clover payment page
 *  GET  /checkout/success → order confirmation (Clover redirects here on payment success)
 *  GET  /checkout/cancel  → payment cancelled (Clover redirects here on cancel/failure)
 *
 * Config (.env):
 *  CLOVER_API_KEY      — Private API key from Clover Merchant Dashboard
 *                        (Dashboard → Account & Setup → Ecommerce API Tokens → Private Token)
 *  CLOVER_ENV          — 'sandbox' | 'production'  (default: 'production')
 *  SITE_URL            — Full URL e.g. https://bathroomvanitiesoutlet.com
 *
 * Clover Hosted Checkout API docs:
 *  https://docs.clover.com/dev/docs/hosted-checkout-api
 *  https://docs.clover.com/dev/docs/creating-a-hosted-checkout-session
 *
 * Price note: Clover requires amounts in CENTS (integer). $299.00 → 29900.
 */

const axios = require('axios');

/* ── Helpers ────────────────────────────────────────────────────── */

function getCart(req) {
  if (!req.session.cart) req.session.cart = { items: [], count: 0, subtotal: 0 };
  return req.session.cart;
}

/** Convert dollar amount to integer cents for Clover API */
function toCents(dollars) {
  return Math.round((parseFloat(dollars) || 0) * 100);
}

/** Clover Hosted Checkout endpoint (env-aware) */
function cloverCheckoutUrl() {
  const env = (process.env.CLOVER_ENV || 'production').toLowerCase();
  return env === 'sandbox'
    ? 'https://sandbox.dev.clover.com/invoicingcheckout/v1/checkouts'
    : 'https://scl.clover.com/invoicingcheckout/v1/checkouts';
}

/* ── GET /checkout ──────────────────────────────────────────────── */
exports.show = (req, res) => {
  const cart = getCart(req);

  if (cart.items.length === 0) {
    return res.redirect('/cart');
  }

  res.render('pages/checkout', {
    pageTitle: 'Checkout | BathroomVanitiesOutlet.com',
    metaDesc:  '',
    noindex:   true,
    cart,
    checkoutError: req.session.checkoutError || null,
  });

  // Clear any previous error message after showing it
  delete req.session.checkoutError;
};

/* ── POST /checkout ─────────────────────────────────────────────── */
exports.process = async (req, res) => {
  const cart = getCart(req);

  if (cart.items.length === 0) {
    return res.redirect('/cart');
  }

  const { email, first_name, last_name, phone } = req.body;

  if (!email || !email.includes('@')) {
    req.session.checkoutError = 'Please enter a valid email address.';
    return res.redirect('/checkout');
  }

  const apiKey = process.env.CLOVER_API_KEY;
  if (!apiKey) {
    // Key not yet configured — show a helpful error instead of crashing
    req.session.checkoutError =
      'Payment is not configured yet. Please contact us to complete your order.';
    return res.redirect('/checkout');
  }

  const siteUrl = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';

  // Build line items — each cart item becomes a Clover line item
  const lineItems = cart.items.map(item => ({
    name:     item.name || 'Product',
    unitQty:  item.qty,
    price:    toCents(item.price),  // Clover requires cents
    note:     item.slug ? `SKU: ${item.slug}` : '',
  }));

  const payload = {
    customer: {
      email,
      firstName:   first_name || '',
      lastName:    last_name  || '',
      phoneNumber: phone      || '',
    },
    shoppingCart: { lineItems },
    redirectUrls: {
      success: `${siteUrl}/checkout/success`,
      failure: `${siteUrl}/checkout/cancel`,
      cancel:  `${siteUrl}/checkout/cancel`,
    },
  };

  try {
    const { data } = await axios.post(cloverCheckoutUrl(), payload, {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 10000,
    });

    // Save email + session ID for the success page
    req.session.pendingCheckout = {
      email,
      firstName:         first_name || '',
      lastName:          last_name  || '',
      checkoutSessionId: data.checkoutSessionId || '',
      subtotal:          cart.subtotal,
    };

    // Redirect customer to Clover's PCI-compliant hosted payment page
    if (data.href) {
      return res.redirect(data.href);
    }

    throw new Error('Clover response missing href');

  } catch (err) {
    console.error('[checkout] Clover API error:', err.response?.data || err.message);
    req.session.checkoutError =
      'We were unable to process your payment at this time. Please try again or contact us.';
    return res.redirect('/checkout');
  }
};

/* ── GET /checkout/success ──────────────────────────────────────── */
exports.success = (req, res) => {
  const pending = req.session.pendingCheckout || {};

  // Clear cart and pending checkout from session
  req.session.cart            = { items: [], count: 0, subtotal: 0 };
  req.session.pendingCheckout = null;

  res.render('pages/checkout-success', {
    pageTitle: 'Order Confirmed | BathroomVanitiesOutlet.com',
    metaDesc:  '',
    noindex:   true,
    email:     pending.email     || '',
    firstName: pending.firstName || '',
    subtotal:  pending.subtotal  || 0,
  });
};

/* ── GET /checkout/cancel ───────────────────────────────────────── */
exports.cancel = (req, res) => {
  res.render('pages/checkout-cancel', {
    pageTitle: 'Payment Cancelled | BathroomVanitiesOutlet.com',
    metaDesc:  '',
    noindex:   true,
  });
};
