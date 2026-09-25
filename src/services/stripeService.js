'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   stripeService.js — payments via the Checkout Sessions API

   WHY CHECKOUT SESSIONS AND NOT PAYMENTINTENTS
   ────────────────────────────────────────────
   The obvious choice for an embedded form is a PaymentIntent + Payment
   Element. It is also the wrong one here, because of tax.

   Stripe Tax on a bare PaymentIntent means running the Tax API by hand:
   create a Calculation, collect the address first, recalculate when it
   changes, update the PaymentIntent amount, then record a Tax Transaction
   after the payment succeeds. Every one of those steps is a place to drift
   out of sync, and the failure mode is undercharged sales tax that nobody
   notices until a filing.

   A Checkout Session with `ui_mode: 'elements'` backs the SAME embedded
   Payment Element, on our own page, with our own styling — but Stripe owns
   the tax calculation via `automatic_tax`. We get the embedded form without
   owning the tax maths.

   Docs: https://docs.stripe.com/tax/checkout/elements

   THE ORDER IS WRITTEN BEFORE THE PAYMENT, NOT AFTER
   ──────────────────────────────────────────────────
   The Authorize.net flow authorised the card and THEN inserted the order in
   the same request. When that insert failed it left the customer holding a
   transaction ID and a message asking them to phone in
   (checkoutController.js:310-319, now removed) — money moved, no order.

   Here the order row is written first with `payment_status = 'pending'`,
   and its id travels to Stripe in `metadata.order_id`. The webhook flips it
   to paid. If the DB is down we never reach Stripe, so no card is ever
   charged for an order that does not exist.

   It also means the cart does not have to survive the round trip. A webhook
   has no `req.session`, so reconstructing a bundle cart from Stripe line
   items — or stuffing it into metadata, capped at 500 chars per value —
   would both be fragile. The order id is eight bytes.

   AMOUNTS ARE STRIPE'S, NOT OURS
   ──────────────────────────────
   Once `automatic_tax` is on, the final total is whatever Stripe computes
   for the customer's address. `calcTotal()` in the controller is the
   PRE-TAX subtotal and nothing more. `orders.total` must be set from
   `session.amount_total` in the webhook. Writing our own figure there would
   mean the books disagree with the money.

   Required env vars:
     STRIPE_SECRET_KEY        sk_test_… / sk_live_…
     STRIPE_PUBLISHABLE_KEY   pk_test_… / pk_live_…   (read by the controller)
     STRIPE_WEBHOOK_SECRET    whsec_…                 (signature verification)
   ═══════════════════════════════════════════════════════════════════════ */

const Stripe = require('stripe');

/* Lazily constructed so that requiring this file cannot crash boot when the
   key is absent — the same reason brevoService and wwexService defer their
   clients. A missing key should break checkout, loudly, not the whole site. */
let _stripe = null;
function client() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  _stripe = new Stripe(key, {
    /* Pinned deliberately. Stripe rolls the default API version with the
       account, so leaving this out means a dashboard-side change can alter
       response shapes under a running deploy. Bump it on purpose, having
       read the changelog — never by accident. */
    apiVersion: '2025-08-27.basil',
    maxNetworkRetries: 2,
    timeout: 20000,
    appInfo: { name: 'BathroomVanitiesOutlet', version: '1.0.0' },
  });
  return _stripe;
}

/* Stripe Tax product codes.

   txcd_99999999 — "General - Tangible Goods". Correct for vanities, tops,
   faucets and mirrors: ordinary taxable tangible personal property.

   txcd_92010001 — shipping. Several states tax delivery charges and several
   do not; giving shipping its own code lets Stripe apply each state's rule
   instead of us guessing. Only matters once shipping is actually charged —
   calcTotal() does not add it today.

   Full list: https://docs.stripe.com/tax/tax-codes */
const TAX_CODE_GOODS    = 'txcd_99999999';
const TAX_CODE_SHIPPING = 'txcd_92010001';

/** Money → integer minor units. Stripe rejects floats.
 *
 *  Math.round, not truncation: 16.49 * 100 is 1648.9999999999998 in IEEE 754,
 *  and | 0 would silently bill a cent short on every such line.
 */
function toCents(amount) {
  return Math.round(parseFloat(amount || 0) * 100);
}

/**
 * Build Stripe line items from cart rows.
 *
 * price_data is used rather than pre-created Price objects because the
 * catalogue is 10k+ SKUs synced nightly from a vendor feed, and bundle
 * pricing applies a per-line discount that does not exist as a Price.
 * Mirroring all of that into Stripe would be a second source of truth for
 * money — the thing most worth having only one of.
 *
 * The discount is folded into unit_amount rather than sent as a Stripe
 * coupon: the customer is being shown one net price per line on our cart
 * page, and the invoice should say the same thing.
 */
function buildLineItems(items) {
  return items.map(it => {
    const disc = parseFloat(it.bundle_discount_pct) || 0;
    const unit = parseFloat(it.price || 0) * (1 - disc / 100);
    return {
      quantity: it.qty || 1,
      price_data: {
        currency: 'usd',
        unit_amount: toCents(unit),
        product_data: {
          name: String(it.name || 'Product').slice(0, 250),
          /* SKU in metadata, not in the name. It shows on the Stripe
             dashboard line and in exports, which is where reconciliation
             against order_items actually happens. */
          metadata: { sku: String(it.slug || it.sku || '').slice(0, 500) },
          tax_code: TAX_CODE_GOODS,
        },
      },
    };
  });
}

/**
 * Create a Checkout Session in Elements mode.
 *
 * @param {Object} p
 * @param {number} p.orderId      internal orders.id — the webhook's only key
 * @param {string} p.orderNumber  BVO-YYYY-MM-DD-NNNNN, for the dashboard
 * @param {Array}  p.items        cart rows
 * @param {string} p.email        customer email
 * @param {string} p.returnUrl    absolute; must contain {CHECKOUT_SESSION_ID}
 *
 * @returns {{ ok: boolean, clientSecret?: string, sessionId?: string, error?: string }}
 */
exports.createCheckoutSession = async (p) => {
  try {
    const session = await client().checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'elements',

      line_items: buildLineItems(p.items),

      /* Stripe owns the tax maths — the whole reason for Checkout Sessions
         over a bare PaymentIntent. Requires the address, collected below. */
      automatic_tax: { enabled: true },

      /* Required by automatic_tax: there is no sales tax without a
         jurisdiction. 'required' makes the Address Element mandatory in the
         form rather than letting the confirm fail later. */
      billing_address_collection: 'required',

      /* customer_email is deliberately NOT set.
         The Contact Details Element collects the address and the email on
         the page. Pre-setting customer_email here locks that field, so the
         customer cannot correct a typo, and the session is created before
         we know their email anyway. Read it back off
         session.customer_details in the webhook instead. */

      /* Both, deliberately. client_reference_id is what shows in the Stripe
         dashboard and in exports, so a human reconciling a payment sees the
         order number. metadata.order_id is what the webhook reads, because
         an integer PK cannot be mistyped or reformatted the way a string
         order number can. */
      client_reference_id: String(p.orderNumber || p.orderId),
      metadata: {
        order_id:     String(p.orderId),
        order_number: String(p.orderNumber || ''),
      },

      /* Copied onto the PaymentIntent, so it survives into the payment and
         into any dispute. Session metadata alone does not reach a chargeback
         record, which is exactly when someone needs the order number. */
      payment_intent_data: {
        /* AUTHORISE NOW, CAPTURE WITHIN 48 HOURS.
           The card is held at checkout and captured from the admin once the
           order is accepted. Card authorisations are valid 7 days online, so
           a 48-hour working window sits comfortably inside it.

           Note this restricts the payment methods Stripe will offer: ACH,
           iDEAL and SEPA cannot authorise and capture separately, so Stripe
           filters them out of the form automatically. If those are wanted
           later they need their own immediate-capture path — they cannot
           share a manual-capture session. */
        capture_method: 'manual',

        metadata: {
          order_id:     String(p.orderId),
          order_number: String(p.orderNumber || ''),
        },
        /* What the customer sees on their card statement. A descriptor that
           does not look like the site they bought from is a leading cause of
           "I don't recognise this charge" disputes. Card networks cap the
           suffix at 22 chars and reject most punctuation. */
        statement_descriptor_suffix: 'BVOUTLET',
      },

      return_url: p.returnUrl,
    });

    return { ok: true, clientSecret: session.client_secret, sessionId: session.id };
  } catch (err) {
    /* Stripe errors carry a customer-safe `message` for card problems and an
       internal one for integration bugs. The caller decides what to surface;
       we log the type so a misconfiguration is not mistaken for a decline. */
    console.error('[stripe.createCheckoutSession]', err.type || 'error', err.message);
    return { ok: false, error: err.message, type: err.type };
  }
};

/** Retrieve a session, expanded far enough to record the payment. */
exports.retrieveSession = async (sessionId) => {
  try {
    const session = await client().checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'payment_intent.latest_charge'],
    });
    return { ok: true, session };
  } catch (err) {
    console.error('[stripe.retrieveSession]', err.message);
    return { ok: false, error: err.message };
  }
};

/**
 * Verify and parse a webhook.
 *
 * MUST be handed the RAW body. Express's json() parser destroys the exact
 * bytes Stripe signed, so the webhook route needs express.raw() mounted
 * BEFORE the global json parser or every event fails signature checks with
 * a misleading "No signatures found matching the expected signature".
 */
exports.constructEvent = (rawBody, signature) => {
  try {
    const event = client().webhooks.constructEvent(
      rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET
    );
    return { ok: true, event };
  } catch (err) {
    /* Signature failure is the one case we must NOT treat as transient.
       Returning 200 here would tell Stripe the event was handled and it
       would never retry; returning 400 is correct and keeps forged events
       out. */
    console.error('[stripe.constructEvent] signature verification failed:', err.message);
    return { ok: false, error: err.message };
  }
};

/**
 * Pull the fields the orders table wants out of a completed session.
 *
 * Returns amounts in DOLLARS as fixed-2 strings, matching the DECIMAL
 * columns. Everything is null-guarded: a session for a non-card payment
 * method has no card object at all, and reading `.card.last4` off it would
 * throw inside the webhook handler — which Stripe would then retry forever.
 */
exports.paymentDetailsFrom = (session) => {
  const pi     = session.payment_intent || {};
  const charge = pi.latest_charge || {};
  const card   = charge.payment_method_details?.card || {};

  return {
    paymentIntentId: typeof pi === 'string' ? pi : (pi.id || null),
    chargeId:        charge.id || null,
    brand:           card.brand    || null,
    last4:           card.last4    || null,
    /* Stripe's own AVS/CVC equivalents. Different value domain from
       Authorize.net's letter codes — these are 'pass' | 'fail' |
       'unavailable' | 'unchecked'. */
    avsLine1:        card.checks?.address_line1_check      || null,
    avsZip:          card.checks?.address_postal_code_check || null,
    cvcCheck:        card.checks?.cvc_check                || null,
    /* Radar. risk_score is only populated on Radar for Fraud Teams; on Lite
       both are absent and the columns stay null rather than reading zero,
       which would look like a perfect score. */
    riskScore:       charge.outcome?.risk_score ?? null,
    riskLevel:       charge.outcome?.risk_level || null,
    sellerMessage:   charge.outcome?.seller_message || null,

    subtotal: session.amount_subtotal != null
      ? (session.amount_subtotal / 100).toFixed(2) : null,
    tax: session.total_details?.amount_tax != null
      ? (session.total_details.amount_tax / 100).toFixed(2) : null,
    total: session.amount_total != null
      ? (session.amount_total / 100).toFixed(2) : null,
    currency: session.currency || 'usd',
  };
};

/**
 * Capture an authorised payment.
 *
 * Replaces authorizeNetService.captureTransaction. Called from
 * ordersController.capturePayment once the order is accepted.
 *
 * Takes a PaymentIntent id — NOT a Checkout Session id. The two are easy to
 * confuse because the session is what checkout created; capture only works
 * on the PaymentIntent inside it, which is why paymentDetailsFrom() writes
 * `paymentIntentId` to orders.payment_transaction_id rather than the
 * session id.
 *
 * @param {string} paymentIntentId  pi_…
 * @param {number} [amount]         dollars; omit to capture the full hold.
 *                                  A partial capture RELEASES the remainder
 *                                  and cannot be topped up later — there is
 *                                  only one capture per authorisation.
 */
exports.capturePayment = async (paymentIntentId, amount) => {
  try {
    const pi = await client().paymentIntents.capture(paymentIntentId, {
      ...(amount != null ? { amount_to_capture: toCents(amount) } : {}),
    });
    return {
      ok: true,
      status: pi.status,                         // 'succeeded' when captured
      amountCaptured: (pi.amount_received / 100).toFixed(2),
    };
  } catch (err) {
    /* The expiry case deserves its own signal. Once an authorisation lapses
       the PaymentIntent is `canceled` and capture fails permanently — retrying
       will never help, and the admin needs to be told to re-take payment
       rather than shown a generic gateway error. */
    const expired = err.code === 'payment_intent_unexpected_state';
    console.error('[stripe.capturePayment]', err.type || 'error', err.message);
    return { ok: false, error: err.message, expired };
  }
};

/**
 * Cancel an authorisation, releasing the hold without charging.
 *
 * This is the correct action for an order rejected before capture. Using
 * refund() instead would fail — there is no charge to refund until the
 * payment is captured.
 */
exports.cancelAuthorization = async (paymentIntentId) => {
  try {
    const pi = await client().paymentIntents.cancel(paymentIntentId);
    return { ok: true, status: pi.status };
  } catch (err) {
    console.error('[stripe.cancelAuthorization]', err.type || 'error', err.message);
    return { ok: false, error: err.message };
  }
};

/**
 * Refund a payment, whole or partial.
 *
 * Only valid AFTER capture. Before capture, use cancelAuthorization().
 *
 * Deliberately takes a PaymentIntent id rather than a charge id — that is
 * what orders.payment_transaction_id holds, so callers never have to walk
 * the object graph to issue a refund.
 */
exports.refund = async (paymentIntentId, amount) => {
  try {
    const refund = await client().refunds.create({
      payment_intent: paymentIntentId,
      ...(amount != null ? { amount: toCents(amount) } : {}),
      /* Stripe treats a repeated (payment_intent, amount) pair as a new
         refund, so a double-submitted admin form refunds twice. Scoping the
         idempotency key to the amount means a genuine second partial refund
         for a DIFFERENT amount still goes through. */
    }, {
      idempotencyKey: `refund_${paymentIntentId}_${amount != null ? toCents(amount) : 'full'}`,
    });
    return { ok: true, refundId: refund.id, status: refund.status };
  } catch (err) {
    console.error('[stripe.refund]', err.type || 'error', err.message);
    return { ok: false, error: err.message };
  }
};

exports.TAX_CODE_GOODS    = TAX_CODE_GOODS;
exports.TAX_CODE_SHIPPING = TAX_CODE_SHIPPING;
exports._toCents          = toCents;        // exported for gates
exports._buildLineItems   = buildLineItems; // exported for gates
