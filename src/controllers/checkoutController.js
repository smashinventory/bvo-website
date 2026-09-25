'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   Checkout Controller — Stripe, embedded Payment Element

   FLOW
   ────
     GET  /checkout                 review page + Payment Element mount
     POST /checkout/session  (AJAX) write the order, create a Checkout
                                    Session, return its client_secret
     GET  /checkout/return          Stripe returns the buyer here
     POST /checkout/webhook         Stripe tells US what happened — this
                                    is the authoritative path
     GET  /checkout/success         confirmation
     GET  /checkout/cancel          abandoned / failed

   Card data never touches this server. The Payment Element is an iframe
   served by Stripe; we hold only ids. That keeps BVO at PCI SAQ A, which
   is the same reason Authorize.net's AcceptUI was used before it. Custom
   card inputs against Stripe.js would be SAQ A-EP. Do not "simplify" the
   Element away.

   ── WHY THE ORDER IS WRITTEN BEFORE THE PAYMENT ────────────────────────
   The Authorize.net flow authorised the card and THEN inserted the order.
   When the insert failed it left the customer holding a transaction id and
   a message asking them to phone in — money moved, no order existed.

   Here the order row is written first as `pending`, and its id travels to
   Stripe in metadata. If the database is unreachable we never reach
   Stripe, so no card is ever touched for an order that does not exist.

   It also means the cart does not have to survive the round trip: the
   webhook has no `req.session`, and reconstructing a bundle cart from
   Stripe line items would be fragile. The order id is eight bytes.

   ── WHY THE WEBHOOK IS AUTHORITATIVE, NOT THE RETURN URL ───────────────
   The browser may never come back — closed tab, dead battery, tunnel.
   GET /checkout/return is a courtesy that shows the customer a result.
   POST /checkout/webhook is what actually moves the order forward, and
   Stripe retries it for days if we fail.

   ── PAYMENT MODEL ──────────────────────────────────────────────────────
   AUTHORISE at checkout. CAPTURE from the admin, typically within 48
   hours, once staff have verified the buyer, the delivery access and the
   stock. See docs/briefs/BVO_COMMERCE_STACK_BRIEF.md §2. This file must
   never capture.

   Required env vars:
     STRIPE_SECRET_KEY
     STRIPE_PUBLISHABLE_KEY
     STRIPE_WEBHOOK_SECRET
     SITE_URL                 absolute, for the return URL
   ═══════════════════════════════════════════════════════════════════════ */

const { bvoPool } = require('../config/database');
const stripe      = require('../services/stripeService');
const brevo       = require('../services/brevoService');

/* ── Helpers ────────────────────────────────────────────────────── */

function getCart(req) {
  if (!req.session.cart) req.session.cart = { items: [], count: 0, subtotal: 0 };
  return req.session.cart;
}

/** Pre-tax subtotal, recalculated server-side — never trust the client.
 *
 *  This is NOT the amount charged. Once Stripe Tax is on, the total is
 *  whatever Stripe computes for the delivery address, and `orders.total`
 *  is set from `session.amount_total` in the webhook. Writing our own
 *  figure into `total` would put the books out of step with the money. */
function calcTotal(items) {
  return items.reduce((sum, i) => {
    const disc  = parseFloat(i.bundle_discount_pct) || 0;
    const price = parseFloat(i.price || 0) * (1 - disc / 100);
    return sum + price * (i.qty || 1);
  }, 0);
}

/** BVO-YYYY-MM-DD-NNNNN. The +106 offset preserves continuity with the
 *  pre-migration numbering and must not be removed. */
function makeOrderNumber(insertId) {
  const now = new Date();
  return `BVO-${now.getFullYear()}-`
       + `${String(now.getMonth() + 1).padStart(2, '0')}-`
       + `${String(now.getDate()).padStart(2, '0')}-`
       + `${String(insertId + 106).padStart(5, '0')}`;
}

function siteUrl() {
  return (process.env.SITE_URL || 'https://www.bathroomvanitiesoutlet.com')
    .replace(/\/+$/, '');
}

/* ── GET /checkout ──────────────────────────────────────────────── */
exports.show = (req, res) => {
  const cart = getCart(req);
  if (cart.items.length === 0) return res.redirect('/cart');

  res.render('pages/checkout', {
    pageTitle:     'Checkout | BathroomVanitiesOutlet.com',
    metaDesc:      '',
    noindex:       true,
    cart,
    checkoutError: req.session.checkoutError || null,
    /* Publishable key is public by design — it identifies the account and
       can only create, never read or charge. The secret key must never
       reach a template. */
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  });

  delete req.session.checkoutError;
};

/* ── POST /checkout/session ─────────────────────────────────────── */
/**
 * Write the order, then ask Stripe for a session.
 *
 * Returns JSON — the page mounts the Element against `clientSecret`
 * rather than navigating.
 */
exports.createSession = async (req, res) => {
  const cart = getCart(req);
  if (cart.items.length === 0) {
    return res.status(400).json({ ok: false, error: 'Your cart is empty.' });
  }

  /* NOTE: no contact or billing fields arrive here.
     Stripe's Contact Details and Billing Address Elements collect them on
     the page, and this endpoint runs BEFORE the customer has filled them
     in — it is what produces the client_secret those elements mount
     against. The name, email and address are read off
     session.customer_details in the webhook.

     This is why the order row below is written with nulls for all of
     them. A `pending` row with no customer is an abandoned checkout, not
     a broken one. */

  /* Conversion attribution — captured at the moment of intent, because
     the session that carries it is gone by the time the webhook runs. */
  const customerIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
                     || req.ip || null;

  const subtotal = calcTotal(cart.items);

  const conn = await bvoPool.getConnection();
  let orderId, orderNumber;

  try {
    await conn.beginTransaction();

    /* status 'pending' and payment_status 'pending' — NOT 'confirmed'.
       The old code hardcoded 'confirmed' at insert while the card had
       only been authorised (OPEN_ITEMS F6), which read to staff as paid.
       Nothing here is confirmed until Stripe says the hold exists. */
    const [result] = await conn.query(
      `INSERT INTO orders
         (order_number, customer_id, status,
          subtotal, tax, total,
          payment_status,
          customer_ip, order_source, order_referrer,
          order_utm_campaign, order_utm_medium, order_utm_source)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        'PENDING',
        req.session.customer?.id || null,
        'pending',
        subtotal.toFixed(2),
        0,                       // Stripe Tax fills this in the webhook
        subtotal.toFixed(2),     // provisional; replaced by amount_total
        'pending',
        customerIp,
        req.body.order_source   || null,
        req.body.order_referrer || null,
        req.body.utm_campaign   || null,
        req.body.utm_medium     || null,
        req.body.utm_source     || null,
      ]
    );

    orderId     = result.insertId;
    orderNumber = makeOrderNumber(orderId);

    await conn.query('UPDATE orders SET order_number = ? WHERE id = ?',
      [orderNumber, orderId]);

    for (const item of cart.items) {
      const disc      = parseFloat(item.bundle_discount_pct) || 0;
      const unitPrice = parseFloat(item.price || 0) * (1 - disc / 100);
      await conn.query(
        `INSERT INTO order_items
           (order_id, product_id, sku, name, qty, unit_price, line_total)
         VALUES (?,?,?,?,?,?,?)`,
        [
          orderId,
          item.product_id || null,
          item.slug       || '',
          item.name       || 'Product',
          item.qty        || 1,
          unitPrice.toFixed(2),
          (unitPrice * (item.qty || 1)).toFixed(2),
        ]
      );
    }

    await conn.commit();
  } catch (dbErr) {
    await conn.rollback();
    console.error('[checkout.createSession] DB error BEFORE payment:', dbErr.message);
    /* Nothing was charged — Stripe has not been called yet. This is the
       whole point of writing the order first: the customer can simply
       try again. */
    return res.status(500).json({
      ok: false,
      error: 'We could not start your order. Nothing has been charged. Please try again.',
    });
  } finally {
    conn.release();
  }

  /* ── Stripe ──────────────────────────────────────────────────────── */
  const session = await stripe.createCheckoutSession({
    orderId,
    orderNumber,
    items:     cart.items,
    returnUrl: `${siteUrl()}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
  });

  if (!session.ok) {
    /* The order row exists but has no session. Mark it so it is visible
       as a failure rather than sitting as a silent 'pending' forever.
       Not rolled back — the row is evidence that someone tried, and the
       admin can see the attempt. */
    await bvoPool.query(
      `UPDATE orders SET status = 'cancelled', payment_status = 'failed'
        WHERE id = ? AND payment_status = 'pending'`, [orderId]
    ).catch(e => console.error('[checkout] could not mark failed order:', e.message));

    return res.status(502).json({
      ok: false,
      error: 'We could not reach our payment provider. Nothing has been charged.',
    });
  }

  await bvoPool.query('UPDATE orders SET stripe_session_id = ? WHERE id = ?',
    [session.sessionId, orderId])
    .catch(e => console.error('[checkout] could not store session id:', e.message));

  return res.json({ ok: true, clientSecret: session.clientSecret, orderNumber });
};

/* ── POST /checkout/webhook ─────────────────────────────────────── */
/**
 * The authoritative path.
 *
 * MOUNTED WITH express.raw() BEFORE the global JSON parser. Stripe signs
 * the exact bytes; express.json() reserialises them and every signature
 * check then fails with a misleading "No signatures found matching".
 *
 * Idempotency: Stripe retries, and duplicates are normal, not an error
 * condition. Every write below is guarded on the CURRENT state, so a
 * replay is a no-op rather than a second email or a status regression.
 */
exports.webhook = async (req, res) => {
  const parsed = stripe.constructEvent(req.body, req.headers['stripe-signature']);

  if (!parsed.ok) {
    /* 400, never 200. Returning 200 would tell Stripe the event was
       handled and it would never retry — and it would let a forged
       request through. */
    return res.status(400).send(`Webhook signature verification failed`);
  }

  const event = parsed.event;

  /* Acknowledge FIRST, work after. Stripe times out at 20s and retries;
     a slow Brevo call must not cause a duplicate delivery. Anything that
     throws below is logged, not surfaced — Stripe has already been told
     we have it. */
  res.json({ received: true });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleSessionCompleted(event.data.object);
        break;

      case 'payment_intent.canceled':
        await markPaymentStatus(event.data.object.metadata?.order_id,
          'canceled', ['auth_only', 'pending']);
        break;

      case 'payment_intent.payment_failed':
        await markPaymentStatus(event.data.object.metadata?.order_id,
          'failed', ['pending']);
        break;

      default:
        /* Unhandled types are normal — the endpoint may be subscribed to
           more than it acts on. Logged at debug volume, not as an error. */
        break;
    }
  } catch (err) {
    console.error('[checkout.webhook]', event.type, '—', err.message);
  }
};

/** Narrow status write, guarded on the states it is allowed to move from. */
async function markPaymentStatus(orderId, next, allowedFrom) {
  if (!orderId) return;
  const ph = allowedFrom.map(() => '?').join(',');
  await bvoPool.query(
    `UPDATE orders SET payment_status = ?
      WHERE id = ? AND payment_status IN (${ph})`,
    [next, orderId, ...allowedFrom]
  );
}

/**
 * The hold exists. Move the order to auth_only and record the payment.
 *
 * With manual capture the session completes while the money is still
 * only held, so `session.payment_status` reads 'unpaid' here. That is
 * correct and expected — do NOT treat it as a failure. The PaymentIntent
 * sitting at `requires_capture` is what says the authorisation succeeded.
 */
async function handleSessionCompleted(sessionStub) {
  const orderId = sessionStub.metadata?.order_id;
  if (!orderId) {
    console.error('[checkout.webhook] session with no order_id:', sessionStub.id);
    return;
  }

  /* Re-fetch expanded. The webhook payload carries the PaymentIntent as a
     bare id string, and we need the charge underneath it for the card
     brand, the Radar outcome and the check results. */
  const fetched = await stripe.retrieveSession(sessionStub.id);
  if (!fetched.ok) {
    console.error('[checkout.webhook] could not retrieve session', sessionStub.id);
    return;
  }

  const d  = stripe.paymentDetailsFrom(fetched.session);
  const pi = fetched.session.payment_intent;
  const authorized = typeof pi === 'object' && pi?.status === 'requires_capture';

  /* The customer's details arrive HERE, not at session creation — the
     Contact Details and Billing Address Elements collect them on the page
     after the session exists. This is the only point at which we learn
     who placed the order. */
  const cd   = fetched.session.customer_details || {};
  const addr = cd.address || {};

  /* Stripe returns one `name` string; the orders table has two columns.
     Split on the LAST space so multi-part given names stay intact —
     "Mary Anne Fitzgerald-Smith" gives "Mary Anne" / "Fitzgerald-Smith"
     rather than "Mary" / "Anne Fitzgerald-Smith". Single-word names put
     everything in first and leave last empty, which is correct: a
     mononym is a first name, not a surname. */
  const fullName = (cd.name || '').trim();
  const cut      = fullName.lastIndexOf(' ');
  const firstName = cut > 0 ? fullName.slice(0, cut) : fullName;
  const lastName  = cut > 0 ? fullName.slice(cut + 1) : '';

  const conn = await bvoPool.getConnection();
  try {
    /* Guarded on payment_status = 'pending', which makes the whole
       handler idempotent: a redelivery affects 0 rows and returns early
       before the email. */
    const [upd] = await conn.query(
      `UPDATE orders
          SET payment_status        = ?,
              status                = ?,
              guest_email           = ?,
              ship_first_name       = ?,
              ship_last_name        = ?,
              bill_address1         = ?,
              bill_city             = ?,
              bill_state            = ?,
              bill_zip              = ?,
              payment_transaction_id= ?,
              stripe_charge_id      = ?,
              payment_brand         = ?,
              payment_last4         = ?,
              payment_risk_score    = ?,
              payment_risk_level    = ?,
              payment_seller_message= ?,
              payment_check_cvc     = ?,
              payment_check_zip     = ?,
              payment_check_line1   = ?,
              subtotal              = COALESCE(?, subtotal),
              tax            = COALESCE(?, tax),
              total                 = COALESCE(?, total),
              payment_authorized_at = NOW()
        WHERE id = ? AND payment_status = 'pending'`,
      [
        authorized ? 'auth_only' : 'pending',
        /* 'confirmed' here means "authorised and validated enough to work
           on", which is what staff act from. It does NOT mean paid —
           payment_status is the field that says that. */
        authorized ? 'confirmed' : 'pending',
        cd.email || null,
        firstName || null,
        lastName  || null,
        addr.line1       || null,
        addr.city        || null,
        addr.state       || null,
        addr.postal_code || null,
        d.paymentIntentId, d.chargeId,
        d.brand, d.last4,
        d.riskScore, d.riskLevel, d.sellerMessage,
        d.cvcCheck, d.avsZip, d.avsLine1,
        d.subtotal, d.tax, d.total,
        orderId,
      ]
    );

    if (upd.affectedRows === 0) return;   // replay — already handled

    await conn.query(
      `INSERT INTO order_events (order_id, event_type, from_status, to_status, actor, notes)
       VALUES (?, 'payment_authorized', 'pending', 'auth_only', 'stripe', ?)`,
      [orderId, `Authorized $${d.total || '?'} — ${d.paymentIntentId}`]
    ).catch(() => {});   // audit trail must never block the order

    const [[order]] = await conn.query(
      `SELECT order_number, guest_email, ship_first_name, ship_last_name, total
         FROM orders WHERE id = ?`, [orderId]
    );
    const [items] = await conn.query(
      'SELECT name, qty, line_total FROM order_items WHERE order_id = ?', [orderId]
    );

    sendConfirmation(order, items);
  } finally {
    conn.release();
  }
}

/**
 * Order confirmation — sent on AUTHORISATION, not capture.
 *
 * The copy must not imply the card has been charged. It has not: funds
 * are held while staff verify the buyer, the delivery access and the
 * stock. The template says so (see the brief §10) — this function only
 * supplies the variables.
 *
 * Deliberately NOT awaited by the caller. The authorisation already
 * exists; a mail failure must not look to anyone like an order failure.
 */
function sendConfirmation(order, items) {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const money = n => `$${Number(n || 0).toLocaleString('en-US',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const rows = items.map(it => `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e0d8">${esc(it.name)}${it.qty > 1 ? ` &times;${it.qty}` : ''}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e0d8;text-align:right;white-space:nowrap">${money(it.line_total)}</td>
    </tr>`).join('');

  brevo.sendTemplate('order_confirmed', order.guest_email, {
    customer_first_name: order.ship_first_name || 'there',
    order_number:        order.order_number,
    order_date:          new Date().toLocaleDateString('en-US',
                           { year: 'numeric', month: 'long', day: 'numeric' }),
    order_items_html:    `<table style="width:100%;border-collapse:collapse">${rows}</table>`,
    order_total:         money(order.total),
  }, `${order.ship_first_name || ''} ${order.ship_last_name || ''}`.trim())
    .catch(err => console.error('[checkout] confirmation email failed for',
                                order.order_number, '—', err?.message || err));
}

/* ── GET /checkout/return ───────────────────────────────────────── */
/**
 * Where Stripe sends the buyer back.
 *
 * Read-only. This handler must not write the order — the webhook owns
 * that, and racing it here would double-send the confirmation email. All
 * this does is decide which page the customer sees.
 */
exports.returnFromStripe = async (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) return res.redirect('/checkout/cancel');

  const fetched = await stripe.retrieveSession(sessionId);
  if (!fetched.ok) return res.redirect('/checkout/cancel');

  const s  = fetched.session;
  const pi = s.payment_intent;
  const ok = typeof pi === 'object'
    && ['requires_capture', 'succeeded', 'processing'].includes(pi?.status);

  if (!ok) {
    req.session.checkoutError =
      'Your payment was not completed. Nothing has been charged.';
    return res.redirect('/checkout');
  }

  req.session.lastOrder = {
    orderNumber: s.metadata?.order_number || '',
    email:       s.customer_email || '',
    firstName:   (s.customer_details?.name || '').split(' ')[0] || '',
    total:       s.amount_total != null ? s.amount_total / 100 : 0,
  };

  /* Cleared only once the payment is known good, so an abandoned attempt
     leaves the customer's basket intact. */
  req.session.cart = { items: [], count: 0, subtotal: 0 };

  return res.redirect('/checkout/success');
};

/* ── GET /checkout/success ──────────────────────────────────────── */
exports.success = (req, res) => {
  const order = req.session.lastOrder || {};
  res.render('pages/checkout-success', {
    pageTitle:   'Order Received | BathroomVanitiesOutlet.com',
    metaDesc:    '',
    noindex:     true,
    email:       order.email       || '',
    firstName:   order.firstName   || '',
    subtotal:    order.total       || 0,
    orderNumber: order.orderNumber || '',
  });
};

/* ── GET /checkout/cancel ───────────────────────────────────────── */
exports.cancel = (req, res) => {
  res.render('pages/checkout-cancel', {
    pageTitle: 'Payment Not Completed | BathroomVanitiesOutlet.com',
    metaDesc:  '',
    noindex:   true,
  });
};

/* Exported for gates. */
exports._calcTotal       = calcTotal;
exports._makeOrderNumber = makeOrderNumber;
