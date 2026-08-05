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

const axios    = require('axios');
const { bvoPool } = require('../config/database');

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
    // Apply bundle discount so Clover charges the correct bundle-discounted price.
    price:    toCents((parseFloat(item.price) || 0) * (1 - (parseFloat(item.bundle_discount_pct) || 0) / 100)),
    note:     item.slug ? `SKU: ${item.slug}` : '',
  }));

  const payload = {
    customer: {
      email,
      firstName:   (first_name || '').trim().slice(0, 100),
      lastName:    (last_name  || '').trim().slice(0, 100),
      phoneNumber: (phone      || '').trim().slice(0, 30),
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

    // Save everything needed to record the order on the success page.
    // Cart items are snapshotted here because the cart is cleared on success.
    req.session.pendingCheckout = {
      email,
      firstName:         first_name || '',
      lastName:          last_name  || '',
      phone:             phone      || '',
      checkoutSessionId: data.checkoutSessionId || '',
      subtotal:          cart.subtotal,
      customerId:        req.session.customer?.id || null,
      items:             cart.items.map(i => ({ ...i })),  // snapshot
    };

    // Redirect customer to Clover's PCI-compliant hosted payment page.
    // Validate the domain first — guards against open redirect if the API
    // response were ever tampered with.
    if (data.href) {
      const _CLOVER_DOMAINS = [
        'https://checkout.clover.com/',
        'https://sandbox.dev.clover.com/',
        'https://scl.clover.com/',
      ];
      if (!_CLOVER_DOMAINS.some(d => data.href.startsWith(d))) {
        console.error('[checkout] Unexpected Clover href domain:', data.href);
        throw new Error('Unexpected payment redirect URL');
      }
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
exports.success = async (req, res) => {
  const pending    = req.session.pendingCheckout || {};
  const cartItems  = pending.items || [];
  let   orderNumber = '';

  /* ── Write order to DB (only when we have a real pending checkout) ── */
  if (pending.checkoutSessionId && cartItems.length > 0) {
    try {
      /* Idempotency: if the customer refreshes the confirmation page,
         the checkoutSessionId already exists — skip the insert and reuse
         the order number stored in rflpos_order_id match.              */
      const [existing] = await bvoPool.query(
        'SELECT id, order_number FROM orders WHERE rflpos_order_id = ? LIMIT 1',
        [pending.checkoutSessionId]
      );

      if (existing.length > 0) {
        orderNumber = existing[0].order_number;
      } else {
        const conn = await bvoPool.getConnection();
        try {
          await conn.beginTransaction();

          /* Total = sum of each item's effective price (after bundle discount) */
          const total = cartItems.reduce((sum, i) => {
            const disc = parseFloat(i.bundle_discount_pct) || 0;
            const unitPrice = parseFloat(i.price || 0) * (1 - disc / 100);
            return sum + unitPrice * (i.qty || 1);
          }, 0);

          /* Insert order row — order_number starts as placeholder */
          const [result] = await conn.query(
            `INSERT INTO orders
               (order_number, customer_id, guest_email, status,
                subtotal, total, ship_first_name, ship_last_name, rflpos_order_id)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [
              'PENDING',
              pending.customerId || null,
              pending.email      || null,
              'pending',
              parseFloat(pending.subtotal || 0).toFixed(2),
              total.toFixed(2),
              pending.firstName || '',
              pending.lastName  || '',
              pending.checkoutSessionId,
            ]
          );

          /* Generate order number: BVO-YYYY-MM-DD-NNNNN
             Offset +106 so the first order displays as 00107, not 00001. */
          const now    = new Date();
          const year   = now.getFullYear();
          const month  = String(now.getMonth() + 1).padStart(2, '0');
          const day    = String(now.getDate()).padStart(2, '0');
          const seq    = String(result.insertId + 106).padStart(5, '0');
          orderNumber  = `BVO-${year}-${month}-${day}-${seq}`;

          await conn.query(
            'UPDATE orders SET order_number = ? WHERE id = ?',
            [orderNumber, result.insertId]
          );

          /* Insert one row per cart item */
          for (const item of cartItems) {
            const disc      = parseFloat(item.bundle_discount_pct) || 0;
            const unitPrice = parseFloat(item.price || 0) * (1 - disc / 100);
            const lineTotal = unitPrice * (item.qty || 1);
            await conn.query(
              `INSERT INTO order_items
                 (order_id, product_id, sku, name, qty, unit_price, line_total)
               VALUES (?,?,?,?,?,?,?)`,
              [
                result.insertId,
                item.product_id || null,
                item.slug       || '',
                item.name       || 'Product',
                item.qty        || 1,
                unitPrice.toFixed(2),
                lineTotal.toFixed(2),
              ]
            );
          }

          await conn.commit();
        } catch (dbErr) {
          await conn.rollback();
          /* Log but don't surface to the customer — they paid successfully */
          console.error('[checkout/success] Failed to record order:', dbErr.message);
        } finally {
          conn.release();
        }
      }
    } catch (err) {
      console.error('[checkout/success] DB error:', err.message);
    }
  }

  /* Clear cart and pending checkout from session */
  req.session.cart            = { items: [], count: 0, subtotal: 0 };
  req.session.pendingCheckout = null;

  res.render('pages/checkout-success', {
    pageTitle:   'Order Confirmed | BathroomVanitiesOutlet.com',
    metaDesc:    '',
    noindex:     true,
    email:       pending.email     || '',
    firstName:   pending.firstName || '',
    subtotal:    pending.subtotal  || 0,
    orderNumber,
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
