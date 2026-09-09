'use strict';

/**
 * Checkout Controller — Authorize.net Accept.js integration
 *
 * Flow:
 *  GET  /checkout         → review + card entry page (Accept.js tokenizes client-side)
 *  POST /checkout         → receive nonce, run Auth-Only, write order to DB
 *  GET  /checkout/success → order confirmation (read from session)
 *  GET  /checkout/cancel  → payment cancelled / back link
 *
 * Card data NEVER touches this server. Accept.js converts card → opaque nonce in-browser;
 * we receive only dataDescriptor + dataValue and pass them to Authorize.net.
 *
 * Required env vars:
 *   AUTHORIZE_NET_API_LOGIN_ID
 *   AUTHORIZE_NET_PUBLIC_CLIENT_KEY
 *   AUTHORIZE_NET_TRANSACTION_KEY
 *   AUTHORIZE_NET_ENV   'sandbox' | 'production'  (default: sandbox)
 */

const { bvoPool }    = require('../config/database');
const authorizeNet   = require('../services/authorizeNetService');
const fraudLabs      = require('../services/fraudLabsService');
const brevo          = require('../services/brevoService');

/* ── Helpers ────────────────────────────────────────────────────── */

function getCart(req) {
  if (!req.session.cart) req.session.cart = { items: [], count: 0, subtotal: 0 };
  return req.session.cart;
}

/** Re-calculate order total server-side — never trust client-sent totals */
function calcTotal(items) {
  return items.reduce((sum, i) => {
    const disc  = parseFloat(i.bundle_discount_pct) || 0;
    const price = parseFloat(i.price || 0) * (1 - disc / 100);
    return sum + price * (i.qty || 1);
  }, 0);
}

/** Accept.js CDN URL (env-aware) */
function aNetScriptUrl() {
  const env = (process.env.AUTHORIZE_NET_ENV || 'sandbox').toLowerCase();
  return env === 'production'
    ? 'https://js.authorize.net/v1/Accept.js'
    : 'https://jstest.authorize.net/v1/Accept.js';
}

/* ── GET /checkout ──────────────────────────────────────────────── */
exports.show = (req, res) => {
  const cart = getCart(req);
  if (cart.items.length === 0) return res.redirect('/cart');

  res.render('pages/checkout', {
    pageTitle:    'Checkout | BathroomVanitiesOutlet.com',
    metaDesc:     '',
    noindex:      true,
    cart,
    checkoutError: req.session.checkoutError || null,
    aNetScriptUrl: aNetScriptUrl(),
    aNetApiLoginId: process.env.AUTHORIZE_NET_API_LOGIN_ID      || '',
    aNetPublicKey:  process.env.AUTHORIZE_NET_PUBLIC_CLIENT_KEY || '',
  });

  delete req.session.checkoutError;
};

/* ── POST /checkout ─────────────────────────────────────────────── */
exports.process = async (req, res) => {
  const cart = getCart(req);
  if (cart.items.length === 0) return res.redirect('/cart');

  const {
    first_name, last_name, email, phone,
    bill_address1, bill_city, bill_state, bill_zip,
    dataDescriptor, dataValue,
  } = req.body;

  // Basic validation
  if (!email || !email.includes('@')) {
    req.session.checkoutError = 'Please enter a valid email address.';
    return res.redirect('/checkout');
  }
  if (!dataDescriptor || !dataValue) {
    req.session.checkoutError = 'Payment token missing — please try again.';
    return res.redirect('/checkout');
  }

  // Capture conversion tracking fields
  const customerIp    = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null;
  const orderSource   = req.body.order_source   || null;
  const orderReferrer = req.body.order_referrer || null;
  const utmCampaign   = req.body.utm_campaign   || null;
  const utmMedium     = req.body.utm_medium     || null;
  const utmSource     = req.body.utm_source     || null;

  // Server-side total (never trust client)
  const total = calcTotal(cart.items);

  // ── FraudLabs Pro screening ──────────────────────────────────────
  const fraudResult = await fraudLabs.screenOrder({
    ip:          customerIp,
    email:       email.trim(),
    billAddress1: (bill_address1 || '').trim(),
    billCity:    (bill_city     || '').trim(),
    billState:   (bill_state    || '').trim(),
    billZip:     (bill_zip      || '').trim(),
    amount:      total,
    quantity:    cart.items.reduce((n, i) => n + (i.qty || 1), 0),
  });

  // Hard REJECT — do not authorize; never reveal the reason to the customer
  if (fraudResult.ok && fraudResult.fraudStatus === 'REJECT') {
    console.warn('[checkout] FraudLabs REJECT — ip:', customerIp,
      'email:', email.trim(), 'score:', fraudResult.fraudScore);
    req.session.checkoutError =
      'We were unable to process your order. Please contact us if you believe this is an error.';
    return res.redirect('/checkout');
  }

  // Auth-Only transaction
  const authResult = await authorizeNet.authOnly({
    dataDescriptor,
    dataValue,
    amount:      total,
    orderNumber: 'PENDING',          // updated after DB insert
    email:       email.trim(),
    firstName:   (first_name || '').trim(),
    lastName:    (last_name  || '').trim(),
    billAddress1: (bill_address1 || '').trim(),
    billCity:    (bill_city  || '').trim(),
    billState:   (bill_state || '').trim(),
    billZip:     (bill_zip   || '').trim(),
    customerIp:  customerIp || undefined,
  });

  if (!authResult.ok) {
    req.session.checkoutError =
      `Payment could not be authorized: ${authResult.error}`;
    return res.redirect('/checkout');
  }

  // Write order to DB inside a transaction
  const conn = await bvoPool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO orders
         (order_number, customer_id, guest_email, status, subtotal, total,
          ship_first_name, ship_last_name,
          bill_address1, bill_city, bill_state, bill_zip,
          payment_transaction_id, payment_auth_code, payment_status,
          payment_avs_code, payment_cvv_code, payment_afds_code,
          payment_brand, payment_last4,
          customer_ip, order_source, order_referrer,
          order_utm_campaign, order_utm_medium, order_utm_source,
          fraudlabs_score, fraudlabs_status,
          fraudlabs_ip_vpn, fraudlabs_ip_tor, fraudlabs_ip_proxy,
          fraudlabs_email_risk)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        'PENDING',
        req.session.customer?.id || null,
        email.trim(),
        'confirmed',
        parseFloat(cart.subtotal || 0).toFixed(2),
        total.toFixed(2),
        (first_name || '').trim(),
        (last_name  || '').trim(),
        (bill_address1 || '').trim(),
        (bill_city     || '').trim(),
        (bill_state    || '').trim(),
        (bill_zip      || '').trim(),
        authResult.transactionId,
        authResult.authCode   || null,
        'auth_only',
        authResult.avsCode    || null,
        authResult.cvvCode    || null,
        authResult.afdsCode   || null,
        authResult.cardBrand  || null,
        authResult.last4      || null,
        customerIp,
        orderSource,
        orderReferrer,
        utmCampaign,
        utmMedium,
        utmSource,
        fraudResult.ok ? fraudResult.fraudScore              : null,
        fraudResult.ok ? fraudResult.fraudStatus             : null,
        fraudResult.ok ? (fraudResult.ipVpn   ? 1 : 0)      : null,
        fraudResult.ok ? (fraudResult.ipTor   ? 1 : 0)      : null,
        fraudResult.ok ? (fraudResult.ipProxy ? 1 : 0)      : null,
        fraudResult.ok ? fraudResult.emailRisk               : null,
      ]
    );

    // Generate order number: BVO-YYYY-MM-DD-NNNNN (+106 offset)
    const now   = new Date();
    const year  = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day   = String(now.getDate()).padStart(2, '0');
    const seq   = String(result.insertId + 106).padStart(5, '0');
    const orderNumber = `BVO-${year}-${month}-${day}-${seq}`;

    await conn.query(
      'UPDATE orders SET order_number = ? WHERE id = ?',
      [orderNumber, result.insertId]
    );

    // Insert order items
    for (const item of cart.items) {
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

    /* ── Order confirmation email ──────────────────────────────────────
       AFTER commit, and deliberately NOT awaited.

       The card is already authorized by this point. If this send were
       awaited and rejected, the customer would see the "we could not
       record your order" error for an order that committed fine, and
       would likely order again. So it is fire-and-forget with its own
       catch: the order is complete whether or not the email lands.
       brevoService.sendTemplate never throws (its DB read is inside its
       try) — the .catch here is belt and braces.

       This email is also the strongest evidence BVO has of what the
       customer was shown at purchase, because the copy sits in their
       mailbox rather than in a database we control. It restates the six
       points and links the four policies. See docs/POLICY_ANSWERS.md R6,
       which calls for the delivery-inspection warning to appear here
       specifically — this is the message customers actually read. */
    const itemsHtml = cart.items.map(it => {
      const disc  = parseFloat(it.bundle_discount_pct) || 0;
      const unit  = parseFloat(it.price || 0) * (1 - disc / 100);
      const line  = unit * (it.qty || 1);
      const esc   = s => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e5e0d8">${esc(it.name || 'Product')}${(it.qty || 1) > 1 ? ` &times;${it.qty}` : ''}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e0d8;text-align:right;white-space:nowrap">$${line.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>`;
    }).join('');

    brevo.sendTemplate('order_confirmed', email.trim(), {
      customer_first_name: (first_name || '').trim() || 'there',
      order_number:        orderNumber,
      order_date:          new Date().toLocaleDateString('en-US',
                             { year: 'numeric', month: 'long', day: 'numeric' }),
      order_items_html:    `<table style="width:100%;border-collapse:collapse">${itemsHtml}</table>`,
      order_total:         `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      /* Processing time before the freight carrier collects — NOT total
         time to the customer's door. The Shipping Policy states 2-5
         business days to process and ship, then 5-12 business days in
         transit. The template says "ships in approximately", so this must
         stay the processing figure or the two documents contradict each
         other. brevoService renders an unknown {{var}} as an empty string,
         so omitting this would print "ships in approximately ." with no
         error anywhere. */
      estimated_ship_window: '2 to 5 business days',
    }, `${(first_name || '').trim()} ${(last_name || '').trim()}`.trim())
      .catch(err => console.error('[checkout] confirmation email failed for',
                                  orderNumber, '—', err?.message || err));

    // Store confirmation info in session
    req.session.lastOrder = {
      orderNumber,
      email:     email.trim(),
      firstName: (first_name || '').trim(),
      total,
      transactionId: authResult.transactionId,
    };

    // Clear cart
    req.session.cart = { items: [], count: 0, subtotal: 0 };

    return res.redirect('/checkout/success');

  } catch (dbErr) {
    await conn.rollback();
    // Payment authorized but DB failed — show Transaction ID for manual recovery
    console.error('[checkout] DB error after auth:', dbErr.message,
      '| TxID:', authResult.transactionId);
    req.session.checkoutError =
      `Your payment was authorized (Transaction ID: ${authResult.transactionId}) ` +
      `but we encountered a technical error recording your order. ` +
      `Please contact us with this Transaction ID and we'll complete your order immediately.`;
    return res.redirect('/checkout');
  } finally {
    conn.release();
  }
};

/* ── GET /checkout/success ──────────────────────────────────────── */
exports.success = (req, res) => {
  const order = req.session.lastOrder || {};

  res.render('pages/checkout-success', {
    pageTitle:   'Order Confirmed | BathroomVanitiesOutlet.com',
    metaDesc:    '',
    noindex:     true,
    email:       order.email      || '',
    firstName:   order.firstName  || '',
    subtotal:    order.total      || 0,
    orderNumber: order.orderNumber || '',
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
