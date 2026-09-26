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

const crypto      = require('crypto');
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

/* Origin for Stripe's return_url.
 *
 * NOT process.env.SITE_URL. That is the CANONICAL host — set to
 * https://www.bathroomvanitiesoutlet.com for sitemaps, canonical tags and
 * the redirect map. The site is still served from the Hostinger temp
 * domain until cutover, so a return_url built from SITE_URL sends the
 * buyer to a domain that does not resolve. The payment authorises, the
 * webhook fires, and the customer sits on a spinner forever — which is
 * exactly what happened on the first live test, 2026-09-25.
 *
 * Derived from the request instead, so it is correct on the temp domain
 * now and on the live domain after cutover with no env change.
 *
 * `trust proxy` is set (server.js:31), so req.protocol reflects
 * X-Forwarded-Proto rather than always reading 'http' behind Hostinger's
 * proxy.
 *
 * The Host header is attacker-controllable, so it is checked against an
 * allowlist before being used to build a URL Stripe will redirect to.
 * A forged host would only ever redirect the attacker's own session, but
 * an open redirect on the checkout path is not worth leaving lying about.
 */
const ALLOWED_RETURN_HOSTS = new Set([
  'www.bathroomvanitiesoutlet.com',
  'bathroomvanitiesoutlet.com',
  'slategrey-falcon-350174.hostingersite.com',
]);

function returnOrigin(req) {
  const host = (req.get('host') || '').toLowerCase();
  if (ALLOWED_RETURN_HOSTS.has(host)) return `${req.protocol}://${host}`;

  console.warn('[checkout] unrecognised Host header:', host,
    '— falling back to SITE_URL. Add it to ALLOWED_RETURN_HOSTS if legitimate.');
  return (process.env.SITE_URL || 'https://www.bathroomvanitiesoutlet.com')
    .replace(/\/+$/, '');
}

/* ═══ THREE-PAGE CHECKOUT ═══════════════════════════════════════════
   1  GET  /checkout            who you are, where it goes
      POST /checkout/info       -> writes the DRAFT order
   2  GET  /checkout/delivery   what will physically happen
      POST /checkout/delivery   -> instructions + curbside acknowledgement
   3  GET  /checkout/payment    Stripe session created HERE
      POST /checkout/session

   Why three pages rather than one: Stripe's Shipping Address Element
   cannot be pre-filled or satisfied from the API, so the only way to
   collect a ship-to without forcing the buyer to type a second address
   is to own the field ourselves — which means collecting it before
   Stripe exists. See docs/briefs/BVO_CHECKOUT_SPEC.md §0.

   The order row is created on page 1, with a real email attached. That
   is the difference between an abandoned checkout we can follow up and
   the nine anonymous `pending` rows of 2026-09-25.

   STAGE 1 is guest-only. Sign-in and registration are stage 2; no dead
   UI for them is rendered here.
   ═══════════════════════════════════════════════════════════════════ */

/** E.164 for storage. Mirrors e164() in checkout-info.ejs — the client
 *  normalises for display, this one is what actually reaches the column,
 *  because a form post can arrive without ever running the page's JS. */
function toE164(raw) {
  const s = String(raw || '').trim()
    .replace(/[\s,;]*(?:ext|extension|xt|x|#)\.?\s*\d+\s*$/i, '');
  let d = s.replace(/[^\d+]/g, '');
  if (d.charAt(0) === '+') return d;
  d = d.replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d.charAt(0) === '1') return '+' + d;
  return d ? '+' + d : '';
}

const US_STATES = new Set(('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI '
  + 'MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC')
  .split(' '));

/** Server-side validation. The page validates too, for the buyer's sake;
 *  this is the copy that decides what enters the database. */
function validateInfo(b) {
  const errors = {};
  const v = k => String(b[k] || '').trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v('email')))
    errors.email = 'Enter a valid email address.';
  if (v('ship_name').length < 2)
    errors.ship_name = 'Enter the name of the person receiving the delivery.';
  if (!v('ship_address1'))
    errors.ship_address1 = 'Enter a street address.';
  if (!v('ship_city'))
    errors.ship_city = 'Enter a city.';
  if (!US_STATES.has(v('ship_state').toUpperCase()))
    errors.ship_state = 'Choose a state.';
  if (!/^\d{5}(-\d{4})?$/.test(v('ship_zip')))
    errors.ship_zip = 'Enter a 5-digit ZIP code.';
  if (!/^\+1\d{10}$/.test(toE164(v('ship_phone'))))
    errors.ship_phone = 'Enter a 10-digit phone number, e.g. (404) 555-1234.';
  if (!['residential', 'commercial'].includes(v('ship_address_type')))
    errors.ship_address_type = 'Choose residential or commercial.';

  /* PO boxes cannot take a freight delivery. Catching it here saves a
     cancelled order and a refund three days from now. */
  if (/\bP\.?\s*O\.?\s*BOX\b/i.test(v('ship_address1')))
    errors.ship_address1 = 'We ship by freight truck and cannot deliver to a PO box.';

  return errors;
}

/** Splits "Mary Anne Fitzgerald-Smith" on the LAST space. A single word
 *  is a first name — a mononym is not a surname. */
function splitName(full) {
  const s = String(full || '').trim();
  const cut = s.lastIndexOf(' ');
  return cut > 0
    ? { first: s.slice(0, cut), last: s.slice(cut + 1) }
    : { first: s, last: '' };
}

/* ── GET /checkout — page 1 ─────────────────────────────────────── */
exports.show = async (req, res) => {
  const cart = getCart(req);
  if (cart.items.length === 0) return res.redirect('/cart');

  /* Coming back to edit: repopulate from the draft rather than making
     them retype. */
  let draft = null;
  if (req.session.checkoutDraft?.orderId) {
    const [[row]] = await bvoPool.query(
      `SELECT guest_email, ship_first_name, ship_last_name, ship_phone,
              ship_phone_ext, ship_address1, ship_address2, ship_city,
              ship_state, ship_zip, ship_address_type
         FROM orders WHERE id = ? AND ${EDITABLE}`,
      [req.session.checkoutDraft.orderId]
    ).catch(() => [[null]]);
    draft = row || null;
  }

  res.render('pages/checkout-info', {
    pageTitle: 'Checkout | BathroomVanitiesOutlet.com',
    metaDesc:  '',
    noindex:   true,
    cart,
    subtotal:  calcTotal(cart.items),
    draft,
    errors:    req.session.checkoutErrors || {},
    old:       req.session.checkoutOld    || {},
    checkoutError: req.session.checkoutError || null,
  });

  delete req.session.checkoutErrors;
  delete req.session.checkoutOld;
  delete req.session.checkoutError;
};

/* ── POST /checkout/info ────────────────────────────────────────── */
/**
 * Creates or updates the DRAFT order. No Stripe, no order number, no
 * money — just the facts about the buyer and the destination.
 */
exports.saveInfo = async (req, res) => {
  const cart = getCart(req);
  if (cart.items.length === 0) return res.redirect('/cart');

  const errors = validateInfo(req.body);
  if (Object.keys(errors).length) {
    req.session.checkoutErrors = errors;
    req.session.checkoutOld    = req.body;
    return res.redirect('/checkout');
  }

  const name  = splitName(req.body.ship_name);
  const phone = toE164(req.body.ship_phone);
  const ext   = String(req.body.ship_phone_ext || '').replace(/\D/g, '').slice(0, 8) || null;
  const customerIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
                     || req.ip || null;

  const fields = {
    guest_email:       String(req.body.email).trim().toLowerCase(),
    ship_first_name:   name.first,
    ship_last_name:    name.last || null,
    ship_phone:        phone,
    ship_phone_ext:    ext,
    ship_address1:     String(req.body.ship_address1).trim(),
    ship_address2:     String(req.body.ship_address2 || '').trim() || null,
    ship_city:         String(req.body.ship_city).trim(),
    ship_state:        String(req.body.ship_state).trim().toUpperCase(),
    ship_zip:          String(req.body.ship_zip).trim(),
    ship_address_type: req.body.ship_address_type,
    /* The buyer typed this address themselves — it is not a copy of the
       billing address, which is what the flag distinguishes. */
    ship_address_confirmed: 1,
  };

  const conn = await bvoPool.getConnection();
  try {
    await conn.beginTransaction();

    let orderId = req.session.checkoutDraft?.orderId || null;

    /* Only ever reuse a row that is still a draft. Once payment has been
       attempted the row belongs to the webhook, and editing it from a
       stale browser tab would rewrite an authorised order. */
    if (orderId) {
      const [[still]] = await conn.query(
        `SELECT id FROM orders WHERE id = ? AND ${EDITABLE}`, [orderId]);
      if (!still) orderId = null;
    }

    const cols = Object.keys(fields);
    if (orderId) {
      await conn.query(
        `UPDATE orders SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
        [...cols.map(c => fields[c]), orderId]
      );
      await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    } else {
      const subtotal = calcTotal(cart.items);
      const [result] = await conn.query(
        `INSERT INTO orders
           (order_number, customer_id, status, payment_status,
            subtotal, tax, total, customer_ip,
            order_source, order_referrer,
            order_utm_campaign, order_utm_medium, order_utm_source,
            ${cols.join(', ')})
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,${cols.map(() => '?').join(',')})`,
        [
          /* A throwaway placeholder, NOT a real order number. order_number
             is NOT NULL UNIQUE, so it cannot be left empty - and the real
             BVO-YYYY-MM-DD-NNNNN is not assigned until the Stripe session
             is created, so a buyer who never reaches payment does not
             consume one. Nine were burned in one evening by a buyer
             retrying against the old page-load behaviour. */
          'DRAFT-' + crypto.randomUUID(),
          req.session.customer?.id || null,
          /* status is an ENUM and has no 'draft' member. The draft marker
             lives on payment_status, which is a plain varchar - and this
             way drafts inherit the status='pending' exclusion the admin
             already applies, rather than needing a second one. */
          'pending',
          'draft',
          subtotal.toFixed(2), 0, subtotal.toFixed(2),
          customerIp,
          req.body.order_source   || null,
          req.body.order_referrer || null,
          req.body.utm_campaign   || null,
          req.body.utm_medium     || null,
          req.body.utm_source     || null,
          ...cols.map(c => fields[c]),
        ]
      );
      orderId = result.insertId;
    }

    for (const item of cart.items) {
      const disc      = parseFloat(item.bundle_discount_pct) || 0;
      const unitPrice = parseFloat(item.price || 0) * (1 - disc / 100);
      await conn.query(
        `INSERT INTO order_items
           (order_id, product_id, sku, name, qty, unit_price, line_total)
         VALUES (?,?,?,?,?,?,?)`,
        [orderId, item.product_id || null, item.slug || '',
         item.name || 'Product', item.qty || 1,
         unitPrice.toFixed(2), (unitPrice * (item.qty || 1)).toFixed(2)]
      );
    }

    await conn.commit();
    req.session.checkoutDraft = { orderId };
    return res.redirect('/checkout/delivery');
  } catch (err) {
    await conn.rollback();
    console.error('[checkout.saveInfo]', err.message);
    req.session.checkoutError =
      'We could not save your details. Nothing has been charged. Please try again.';
    req.session.checkoutOld = req.body;
    return res.redirect('/checkout');
  } finally {
    conn.release();
  }
};

/* The checkout owns the order row while payment_status is 'draft' or
   'pending', and loses it the moment the webhook writes 'auth_only'.

   Both states, not just 'draft': createSession flips draft -> pending, so
   a guard that demands 'draft' disqualifies the payment page the instant
   it creates its own Stripe session. Every reload, back-navigation and
   retry then threw the buyer back to step 1 with their details gone. */
const EDITABLE = "payment_status IN ('draft','pending')";

/** Loads the in-progress order or sends the buyer back to step 1.
 *  Every page after the first depends on this. */
async function requireDraft(req, res) {
  const id = req.session.checkoutDraft?.orderId;
  if (!id) { res.redirect('/checkout'); return null; }

  const [[order]] = await bvoPool.query(
    `SELECT * FROM orders WHERE id = ? AND ${EDITABLE}`, [id]);
  if (!order) {
    delete req.session.checkoutDraft;
    res.redirect('/checkout');
    return null;
  }
  return order;
}

/* ── GET /checkout/delivery — page 2 ────────────────────────────── */
exports.deliveryPage = async (req, res) => {
  const cart = getCart(req);
  if (cart.items.length === 0) return res.redirect('/cart');

  const order = await requireDraft(req, res);
  if (!order) return;

  res.render('pages/checkout-delivery', {
    pageTitle: 'Delivery | BathroomVanitiesOutlet.com',
    metaDesc:  '', noindex: true,
    cart, subtotal: calcTotal(cart.items), order,
    errors: req.session.checkoutErrors || {},
  });
  delete req.session.checkoutErrors;
};

/* ── POST /checkout/delivery ────────────────────────────────────── */
exports.saveDelivery = async (req, res) => {
  const order = await requireDraft(req, res);
  if (!order) return;

  /* The acknowledgement is required. Curbside is the single biggest
     expectation gap in this business - a buyer who pictures two people
     carrying a vanity to the bathroom, and watches a crate come off a
     lift gate onto the driveway, refuses the delivery. A ticked box with
     a timestamp is the record that they were told. */
  if (!req.body.delivery_ack) {
    req.session.checkoutErrors = {
      delivery_ack: 'Please confirm you understand how curbside delivery works.',
    };
    return res.redirect('/checkout/delivery');
  }

  /* NOT fire-and-forget. This write is what lets the buyer reach payment:
     the payment page refuses to render without delivery_terms_ack_at, so
     a swallowed failure sends them back here with an empty checkbox and
     no explanation, forever. That is exactly what happened before the
     columns existed - the error went to the log and the buyer saw a page
     that simply would not advance. */
  try {
    const [upd] = await bvoPool.query(
      `UPDATE orders
          SET ship_instructions = ?, delivery_terms_ack_at = NOW()
        WHERE id = ? AND ${EDITABLE}`,
      [String(req.body.ship_instructions || '').trim().slice(0, 500) || null, order.id]
    );
    if (upd.affectedRows === 0) throw new Error('in-progress order row not updated');
  } catch (e) {
    console.error('[checkout.saveDelivery]', e.message);
    req.session.checkoutErrors = {
      delivery_ack: 'We could not save your delivery preferences. '
                  + 'Nothing has been charged. Please try again, or contact us if it keeps happening.',
    };
    return res.redirect('/checkout/delivery');
  }

  return res.redirect('/checkout/payment');
};

/* ── GET /checkout/payment — page 3 ─────────────────────────────── */
exports.paymentPage = async (req, res) => {
  const cart = getCart(req);
  if (cart.items.length === 0) return res.redirect('/cart');

  const order = await requireDraft(req, res);
  if (!order) return;

  /* Page 2 must have been completed. Without the acknowledgement the
     buyer has not seen the curbside terms, and this page is the last
     point before money moves. */
  if (!order.delivery_terms_ack_at) return res.redirect('/checkout/delivery');

  res.render('pages/checkout-payment', {
    pageTitle: 'Payment | BathroomVanitiesOutlet.com',
    metaDesc:  '', noindex: true,
    cart, subtotal: calcTotal(cart.items), order,
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
 * Turn the draft into a payable order and ask Stripe for a session.
 *
 * The order row already exists - page 1 created it with the buyer's
 * email, name, phone and ship-to. This step only:
 *   - assigns the order number (so a buyer who never got here did not
 *     consume one)
 *   - flips draft -> pending, which is what hands the row to the webhook
 *   - creates the Stripe session
 *
 * Returns JSON; the page mounts the Payment Element against
 * `clientSecret` rather than navigating.
 */
exports.createSession = async (req, res) => {
  const cart = getCart(req);
  if (cart.items.length === 0) {
    return res.status(400).json({ ok: false, error: 'Your cart is empty.' });
  }

  const orderId = req.session.checkoutDraft?.orderId;
  if (!orderId) {
    return res.status(409).json({
      ok: false, error: 'Your checkout session expired. Please start again.',
    });
  }

  /* Guarded on draft, and on the acknowledgement from page 2. A request
     that skips straight here - stale tab, hand-rolled POST - must not
     produce a payable order that never saw the curbside terms. */
  const [[order]] = await bvoPool.query(
    `SELECT id, order_number, delivery_terms_ack_at
       FROM orders WHERE id = ? AND ${EDITABLE}`, [orderId]);

  if (!order) {
    delete req.session.checkoutDraft;
    return res.status(409).json({
      ok: false, error: 'Your checkout session expired. Please start again.',
    });
  }
  if (!order.delivery_terms_ack_at) {
    return res.status(409).json({
      ok: false, error: 'Please confirm the delivery terms first.',
    });
  }

  /* Reuse the number if this is a retry - a buyer who fails 3DS and tries
     again should not walk the sequence forward each time. The DRAFT-
     placeholder is not a number, so it is replaced rather than reused. */
  const orderNumber = (order.order_number && !order.order_number.startsWith('DRAFT-'))
    ? order.order_number
    : makeOrderNumber(orderId);

  try {
    await bvoPool.query(
      `UPDATE orders SET order_number = ?, status = 'pending',
                         payment_status = 'pending'
        WHERE id = ? AND ${EDITABLE}`,
      [orderNumber, orderId]
    );
  } catch (dbErr) {
    console.error('[checkout.createSession] DB error BEFORE payment:', dbErr.message);
    /* Nothing was charged - Stripe has not been called yet. This is the
       whole point of writing the order first: the buyer can try again. */
    return res.status(500).json({
      ok: false,
      error: 'We could not start your order. Nothing has been charged. Please try again.',
    });
  }

  const session = await stripe.createCheckoutSession({
    orderId,
    orderNumber,
    items:     cart.items,
    returnUrl: `${returnOrigin(req)}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
  });

  if (!session.ok) {
    /* Back to draft rather than cancelled: the buyer is still standing at
       the payment page and can retry without retyping anything. */
    await bvoPool.query(
      `UPDATE orders SET payment_status = 'draft'
        WHERE id = ? AND payment_status = 'pending'`, [orderId]
    ).catch(e => console.error('[checkout] could not revert to draft:', e.message));

    return res.status(502).json({
      ok: false,
      error: 'We could not reach our payment provider. Nothing has been charged.',
    });
  }

  await bvoPool.query('UPDATE orders SET stripe_session_id = ? WHERE id = ?',
    [session.sessionId, orderId])
    .catch(e => console.error('[checkout] could not store session id:', e.message));

  /* Server-side handle on the row being paid for. setOrderDetails() writes
     through this rather than an id from the request body - a posted order
     id would let anyone edit any order by guessing integers. */
  req.session.pendingOrderId = orderId;

  return res.json({ ok: true, clientSecret: session.clientSecret, orderNumber });
};

/* ── POST /checkout/order-details ───────────────────────────────── */
/**
 * The two facts Stripe has no field for: the delivery type and the phone
 * extension. Written straight to our own order row rather than riding
 * along as session metadata, which is writable by anyone holding the
 * publishable key.
 *
 * Either key may be sent on its own — the page saves the extension and the
 * radio independently — so each is applied only when present. Sending
 * neither is a no-op rather than an error.
 *
 * Fire-and-forget from the page: the buyer must never be blocked from
 * paying because this did not save. An unanswered delivery type stays
 * NULL, which reads as "never asked" and is honestly different from
 * either answer.
 */
exports.setOrderDetails = async (req, res) => {
  const sets = [];
  const args = [];

  if (req.body?.type !== undefined) {
    const type = String(req.body.type || '');
    if (type !== 'residential' && type !== 'commercial') {
      return res.status(400).json({ ok: false });
    }
    sets.push('ship_address_type = ?');
    args.push(type);
  }

  if (req.body?.phone_ext !== undefined) {
    /* Digits only, capped at the column width. An extension is never
       anything else, and this value is read by a human dialling a phone. */
    const ext = String(req.body.phone_ext || '').replace(/\D/g, '').slice(0, 8);
    sets.push('ship_phone_ext = ?');
    args.push(ext || null);
  }

  if (!sets.length) return res.json({ ok: true });

  const orderId = req.session.pendingOrderId;
  if (!orderId) return res.status(409).json({ ok: false });

  try {
    /* Guarded on pending: once the webhook has authorised the order these
       must not move, or a buyer could change the delivery class of an
       order already booked with the carrier. */
    await bvoPool.query(
      `UPDATE orders SET ${sets.join(', ')}
        WHERE id = ? AND payment_status = 'pending'`,
      [...args, orderId]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error('[checkout.setOrderDetails]', e.message);
    return res.status(500).json({ ok: false });
  }
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
     Contact Details, Billing Address and Shipping Address Elements collect
     them on the page after the session exists. This is the only point at
     which we learn who placed the order and where it goes. */
  const who = stripe.shippingFrom(fetched.session);


  const conn = await bvoPool.getConnection();
  try {
    /* Guarded on payment_status = 'pending', which makes the whole
       handler idempotent: a redelivery affects 0 rows and returns early
       before the email. */
    const [upd] = await conn.query(
      `UPDATE orders
          SET payment_status        = ?,
              status                = ?,
              /* COALESCE(NULLIF(col,''), ?) - the buyer typed these on
                 page 1 and they are the destination the freight is booked
                 to. Stripe's copy comes from the BILLING address and must
                 only ever fill a gap, never overwrite. Before the
                 three-page flow these were plain assignments, which was
                 correct then and would be data loss now. */
              guest_email     = COALESCE(NULLIF(guest_email,''), ?),
              ship_first_name = COALESCE(NULLIF(ship_first_name,''), ?),
              ship_last_name  = COALESCE(NULLIF(ship_last_name,''), ?),
              ship_phone      = COALESCE(NULLIF(ship_phone,''), ?),
              ship_address1   = COALESCE(NULLIF(ship_address1,''), ?),
              ship_address2   = COALESCE(NULLIF(ship_address2,''), ?),
              ship_city       = COALESCE(NULLIF(ship_city,''), ?),
              ship_state      = COALESCE(NULLIF(ship_state,''), ?),
              ship_zip        = COALESCE(NULLIF(ship_zip,''), ?),
              ship_address_confirmed = GREATEST(ship_address_confirmed, ?),
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
        who.email,
        who.firstName,
        who.lastName,
        who.phone,
        /* SHIP-TO. Previously never written, while shippingController read
           these four columns to book the freight — so every order arrived
           at the ship screen with a null destination. */
        who.shipAddress1,
        who.shipAddress2,
        who.shipCity,
        who.shipState,
        who.shipZip,
        who.shippingWasCollected ? 1 : 0,
        who.billAddress1,
        who.billCity,
        who.billState,
        who.billZip,
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
    /* customer_details, not customer_email. The latter is only populated
       when the session was CREATED with an email, and this one deliberately
       is not — so it is always null here and the success page was greeting
       an empty string. */
    email:       s.customer_details?.email || '',
    firstName:   (s.customer_details?.name || '').split(' ')[0] || '',
    total:       s.amount_total != null ? s.amount_total / 100 : 0,
  };

  /* Cleared only once the payment is known good, so an abandoned attempt
     leaves the customer's basket intact. */
  req.session.cart = { items: [], count: 0, subtotal: 0 };

  /* And the draft handle, or the next visit to /checkout would reopen the
     order that was just paid for and let it be edited. */
  delete req.session.checkoutDraft;
  delete req.session.pendingOrderId;

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
