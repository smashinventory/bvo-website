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
const geocode     = require('../services/geocodeService');
/* Pure function, own module — see src/utils/addressProvenance.js for why
   the delivery address's origin is decided here and not sent by the page. */
const { addressProvenance } = require('../utils/addressProvenance');
/* Server-side, own key — a verdict the page could set is one a fraudster
   could forge. See src/services/addressValidationService.js. */
const addrVal = require('../services/addressValidationService');

/* Saved addresses + the velocity signal behind items 6/9. Every method
   catches its own errors and returns {ok:false} — nothing in here may
   throw into a checkout. */
const CustomerAddress = require('../models/CustomerAddress');

/* ── Helpers ────────────────────────────────────────────────────── */

function getCart(req) {
  if (!req.session.cart) req.session.cart = { items: [], count: 0, subtotal: 0 };
  return req.session.cart;
}

/* ── GET /checkout/identify ── the email-first gate ───────────────────
   Spec 7.1 (guest checkout superseded) and 7.2. Owner, 2026-09-27:
   "on cart page and they select checkout — if they do not have an
   account, we take them through a quick account setup or sign in."

   NO NEW AUTH MACHINERY. This page posts to the existing
   /account/code and /account/verify, which already carry the rate
   limits, the timing-safe comparison, the no-enumeration property and
   the Brevo blocklist check. A second code path for the same job would
   be a second place for those to drift.

   Sign-in and register are the same action here, which is why nothing
   on the page promises one or the other — the endpoint deliberately
   does not find out which it is. */
function identifyPage(req, res) {
  /* Already known: never make someone sign in twice. */
  if (req.session.customerId) return res.redirect(req.session.returnTo || '/checkout');

  /* An empty cart has nothing to identify FOR. Sending them to sign in
     and then to an empty checkout is a dead end; the cart page at least
     says so and offers a way out. */
  const cart = req.session.cart;
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return res.redirect('/cart');
  }

  return res.render('pages/checkout-identify', {
    pageTitle: 'Sign in to check out | BathroomVanitiesOutlet.com',
    metaDesc:  '',
    /* Validated in requireIdentity before it was stored, and validated
       again by /account/verify. Defaulted here so a direct visit with no
       stored value still lands somewhere sensible. */
    returnTo:  req.session.returnTo || '/checkout',
    cartCount: cart.count || cart.items.length,
  });
}
exports.identifyPage = identifyPage;

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
/**
 * The buyer's IP, as one canonical expression.
 *
 * Rule 10: one source per fact. This was written inline in saveInfo and was
 * about to be written a second time in saveDelivery, which is how two
 * copies of one rule come to disagree.
 *
 * x-forwarded-for first, leftmost entry: `trust proxy` is set
 * (server.js:31) and Hostinger fronts the app, so req.ip alone would record
 * the proxy rather than the customer. The leftmost entry is the closest
 * thing to the real client available, and it IS client-supplied and
 * therefore spoofable — which is acceptable for evidence of what we
 * recorded at the time, and would not be acceptable for access control.
 */
function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.ip
      || null;
}

/**
 * Version of the curbside delivery terms the buyer ticks on page 2.
 *
 * WHY A VERSION AND NOT JUST A TIMESTAMP
 * A timestamp proves someone ticked a box. It does not prove WHAT they
 * agreed to, which is the only question that matters in a dispute over a
 * refused delivery. Pairing the two makes the record defensible.
 *
 * BUMP THIS whenever the curbside copy in views/pages/checkout-delivery.ejs
 * changes in substance - what the driver does, where they stop, who must be
 * present, or what signing the receipt means. Do not bump it for typos or
 * styling. A stale version silently attributes new terms to old orders.
 */
const DELIVERY_TERMS_VERSION = '2026-09-26.curbside.v1';

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

  /* NO EMAIL RULE. The address is not on this form any more — it was
     proven by six-digit code at /checkout/identify and is read from the
     session, never from the body. Validating a body field that the page
     no longer submits would reject every single submission. */
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

/**
 * One address, one string — the key that decides whether we have already
 * validated and already warned about this exact address.
 *
 * Normalised the same way addressProvenance normalises, so retyping the
 * same address in capitals is not a different address and does not buy a
 * second billable validation call.
 */
function addressKey(f) {
  return ['ship_address1', 'ship_address2', 'ship_city', 'ship_state', 'ship_zip']
    .map(k => String(f[k] || '').trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|');
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

/**
 * Consume the one-shot checkout messages. READ AND DELETE IN ONE STEP.
 *
 * THE BUG THIS FIXES (2026-09-27)
 * Both checkout GET handlers used to read these into the render call and
 * delete them on the line AFTER res.render(). Both handlers also begin
 * with early returns - an empty cart redirects to /cart, and page 2's
 * requireDraft() bails when there is no draft order. On any of those paths
 * the function returned before the deletes ran, so the message was never
 * consumed.
 *
 * The cart is emptied on a completed purchase, so the commonest way to
 * reach that state is to finish an order. Sessions live seven days. The
 * result: a buyer who hit any error, or who simply completed a purchase
 * after one, came back days later to buy a mirror and was shown the old
 * banner - plus their previously typed address prefilled and red
 * validation errors on a form they had not submitted.
 *
 * It presents as a caching problem because the page looks stale. It is
 * not: Cache-Control is already 'no-store' on every HTML response. It was
 * a flash message that nothing ever cleared.
 *
 * Called at the TOP of both handlers, before any early return, so the
 * messages are consumed whether or not the page renders. A message
 * discarded on an empty-cart redirect is the right outcome: "we could not
 * save your details" is meaningless once there is nothing in the cart.
 */
function takeCheckoutFlash(req) {
  const s = req.session || {};
  const flash = {
    errors: s.checkoutErrors || {},
    old:    s.checkoutOld    || {},
    error:  s.checkoutError  || null,
    /* The address warning is one-shot for exactly the same reason as the
       rest of these: left behind on an early-return path it would greet a
       returning buyer weeks later with a caution about an address they
       already delivered to. Same bug, same fix - consumed here, before
       anything can bail out. */
    addrWarning: s.addrWarning || null,
  };
  delete req.session.checkoutErrors;
  delete req.session.checkoutOld;
  delete req.session.checkoutError;
  delete req.session.addrWarning;
  return flash;
}

/* ── GET /checkout — page 1 ─────────────────────────────────────── */
exports.show = async (req, res) => {
  /* FIRST, before the empty-cart return below can skip it. */
  const flash = takeCheckoutFlash(req);

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

  /* The FULL customer row, not the three fields the session carries.
     res.locals.customer is {id, firstName, email} — enough to greet
     someone, not enough to pre-tick a consent box from what they chose
     last time. Read here so a returning buyer is not asked the same
     question twice with the wrong default.

     requireIdentity guarantees customerId exists by this point, so
     there is no anonymous branch to handle. A failed read degrades to
     the spec defaults rather than throwing: an unavailable database
     should not take checkout down over a checkbox. */
  let customerRow = null;
  try {
    const [[row]] = await bvoPool.query(
      /* The *_consent_at timestamps come along because both consent
         flags are NOT NULL DEFAULT 0 — the flag alone cannot tell
         "never asked" from "asked and declined", and the checkbox
         default depends on that difference. */
      `SELECT id, email, first_name,
              accepts_marketing, marketing_consent_at,
              delivery_sms_consent, delivery_sms_consent_at
         FROM customers WHERE id = ? LIMIT 1`,
      [req.session.customerId]
    );
    customerRow = row || null;
  } catch (err) {
    console.error('[checkout.show] customer read failed:', err && err.message);
  }

  /* Item 28 — prefill for a returning buyer.
     Only consulted when there is no draft and nothing bounced back from
     a failed submit: a saved address must never overwrite what the buyer
     has already typed on THIS order.

     Returns null on any failure. An empty form is a poor experience; a
     500 is a lost sale. */
  const savedAddress = (!draft && !flash.old.ship_address1)
    ? await CustomerAddress.mostRecent(req.session.customerId, 'shipping')
    : null;

  res.render('pages/checkout-info', {
    pageTitle: 'Checkout | BathroomVanitiesOutlet.com',
    metaDesc:  '',
    noindex:   true,
    /* Shadows res.locals.customer deliberately — the view needs the
       consent columns, and two objects called `customer` with different
       shapes is exactly how a template ends up reading undefined. */
    customer:  customerRow,
    /* The most recent shipping address, or null. The view prefills from
       it AND says so — silent prefill sends a trade buyer's vanity to
       last month's jobsite. Spec §7 Stage 3, item 28. */
    savedAddress,
    cart,
    subtotal:  calcTotal(cart.items),
    draft,
    errors:    flash.errors,
    old:       flash.old,
    checkoutError: flash.error,
    /* Empty string, never undefined: the page branches on truthiness to
       decide whether to load the Places library at all, and an undefined
       would throw inside the template instead of quietly degrading to a
       plain text input. */
    mapsKey:   process.env.GOOGLE_MAPS_API_KEY || '',
    /* Null unless the previous submit produced a fix/suspect verdict.
       The page renders nothing at all when it is null. */
    addrWarning: flash.addrWarning,
  });
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
  const customerIp = clientIp(req);
  const prov  = addressProvenance(req.body);

  /* ── CONSENT, RECORDED AS EVIDENCE ────────────────────────────────
     Spec 9.2 / 9.2a. Two separate legal instruments, two separate
     columns, never collapsed: email marketing is CAN-SPAM (opt-out)
     and delivery SMS is TCPA (express consent, four-year records,
     $500–$1,500 per message). Conflating them is where retailers get
     sued (spec 9.4).

     PRESENCE, NOT TRUTHINESS. An unchecked box submits nothing, so
     `'1' === body[k]` is the only correct test. Anything that treats
     absence as "keep the previous value" would make opting OUT
     impossible — the buyer could tick but never untick.

     A timestamp, a source and an IP go with each flag because "accepts
     = 1" is not a record anyone can produce four years later. The copy
     version pins WHICH wording they agreed to; bump it whenever the
     text in checkout-info.ejs changes. */
  const CONSENT_COPY_VERSION = '2026-09-27a';
  const wantsMarketing = req.body.marketing_opt_in === '1';
  const wantsSms       = req.body.delivery_sms_opt_in === '1';

  if (req.session.customerId) {
    try {
      await bvoPool.query(
        `UPDATE customers
            SET accepts_marketing           = ?,
                marketing_consent_at        = NOW(),
                marketing_consent_source    = 'checkout_info',
                marketing_consent_ip        = ?,
                delivery_sms_consent        = ?,
                delivery_sms_consent_at     = NOW(),
                delivery_sms_consent_source = 'checkout_info',
                delivery_sms_consent_ip     = ?,
                consent_copy_version        = ?
          WHERE id = ?`,
        [wantsMarketing ? 1 : 0, customerIp,
         wantsSms ? 1 : 0, customerIp,
         CONSENT_COPY_VERSION, req.session.customerId]
      );
      /* Both *_at are stamped even on a NO. The date they declined is
         as much a record as the date they agreed, and it is what tells
         the checkout page not to re-tick a box they cleared. */
    } catch (err) {
      /* Never fail an order over a checkbox. The buyer is mid-checkout
         and the consent can be re-collected; a 500 here cannot. */
      console.error('[checkout.saveInfo] consent write failed:', err && err.message);
    }

    /* ── REMEMBER THIS DELIVERY ADDRESS (items 27/28, velocity for 6/9)
       Fire-and-forget by design: CustomerAddress.record catches its own
       errors and returns {ok:false}. A saved address is a convenience
       and a fraud signal; neither is worth failing an order.

       Written HERE rather than at order creation because this is the
       point the buyer confirmed the address — a draft that never
       reaches payment is still a real address they typed, and the
       velocity signal wants it. */
    CustomerAddress.record(req.session.customerId, 'shipping', {
      place_id:          prov.placeId || null,
      formatted_address: prov.formatted || null,
      first_name:        name.first,
      last_name:         name.last || null,
      address1:          String(req.body.ship_address1 || '').trim(),
      address2:          String(req.body.ship_address2 || '').trim() || null,
      city:              String(req.body.ship_city || '').trim(),
      state:             String(req.body.ship_state || '').trim().toUpperCase(),
      zip:               String(req.body.ship_zip || '').trim(),
      phone, phone_ext:  ext,
      address_type:      req.body.ship_address_type || null,
    }).catch(() => {});
  }

  const fields = {
    /* FROM THE SESSION, NEVER THE BODY. Proven at /checkout/identify.
       Reading it from req.body would let anyone past the gate swap in
       an address they never proved — which is the entire value of the
       gate, handed back at the next step.

       The column keeps the name guest_email for now: renaming it means
       touching the webhook, the order emails, the admin order list and
       four other queries, and a rename during a checkout rebuild is a
       change with no upside and a long blast radius. Guest checkout is
       gone (spec 7.1); the column name is a fossil, not a feature. */
    guest_email:       String(req.session.customer && req.session.customer.email || '')
                         .trim().toLowerCase(),
    /* customer_id IS NOT IN THIS OBJECT, DELIBERATELY. The INSERT below
       already names it in its own column list and then appends
       ${cols.join(', ')} — putting it here too produces
       "Duplicate column name 'customer_id'" on every new draft order.
       Caught by reading the INSERT, before it ran. */
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

    /* Provenance (item 17). Written on every save, including the re-edit
       path: a buyer who comes back and retypes the address by hand must
       flip from 'autocomplete' to 'typed', so these cannot be left out of
       the UPDATE or a stale verdict would outlive the address it
       described. */
    ship_place_id:          prov.placeId,
    ship_formatted_address: prov.formatted,
    ship_address_source:    prov.source,
  };

  /* ── Address Validation (item 16) ──────────────────────────────────
     ONE CALL PER DISTINCT ADDRESS, and never on a resubmit of an address
     the buyer has already been warned about. The free allowance is 1,000
     a month — the tightest cap in the Google stack — and re-validating on
     every submit would burn it on the same address twice.

     acked holds the address keys already settled: the one they typed AND
     the corrected one we offered. Accepting our suggestion must not cost
     a second call to be told the corrected address is fine.

     Never throws, never blocks. A null result means NOT ASKED — no key,
     quota tripped, Google down — and the order proceeds untouched. */
  const key   = addressKey(fields);
  const acked = Array.isArray(req.session.addrValAcked) ? req.session.addrValAcked : [];
  let val = null;

  if (!acked.includes(key)) {
    val = await addrVal.validateUsAddress({
      address1: fields.ship_address1,
      address2: fields.ship_address2,
      city:     fields.ship_city,
      state:    fields.ship_state,
      zip:      fields.ship_zip,
      /* Live token only. The page clears it once a suggestion is picked,
         because Place Details has already terminated that session. */
      sessionToken: req.body.ship_autocomplete_session,
    });
  }

  if (val) {
    fields.ship_validated_at           = new Date();
    fields.ship_validation_verdict     = val.verdict;
    fields.ship_validation_granularity = val.granularity;
    fields.ship_validation_flags       = val.flags;
    fields.ship_usps_dpv               = val.uspsDpv;
    fields.ship_usps_flags             = val.uspsFlags;
    fields.ship_usps_carrier_route     = val.uspsRoute;

    /* Google's rooftop point beats the Census street interpolation, and
       the service only offers it at PREMISE or finer. Written here so the
       admin delivery panel is centred on the building rather than the
       street, and so the fire-and-forget Census call at authorisation —
       guarded on ship_lat IS NULL — never overwrites it. */
    if (val.lat != null && val.lng != null) {
      fields.ship_lat             = val.lat;
      fields.ship_lng             = val.lng;
      fields.ship_geocode_source  = 'google';
      fields.ship_geocoded_at     = new Date();
    }
  }

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
          /* customerId, not customer?.id. Both are set together at
             sign-in, but customerId is the one requireIdentity checks
             and the one every other handler reads — so it is the single
             source of truth for "who is this". Past the guard it is
             never null. */
          req.session.customerId || null,
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

    /* WARN, NEVER BLOCK — and warn exactly once.
       The order is already written and the verdict already stored, so
       this is purely a chance for the buyer to correct a typo before a
       freight truck is booked. Whatever they do next, the second submit
       proceeds: both the typed key and the corrected one are marked
       settled, so neither re-validates and neither warns again.

       A prompt that reappears after the buyer has said "keep mine" is a
       loop, and at 1,000 free calls a month it would be an expensive one. */
    if (val && (val.verdict === 'fix' || val.verdict === 'suspect')) {
      const settled = [key];
      if (val.corrected) settled.push(addressKey({
        ship_address1: val.corrected.address1,
        ship_address2: fields.ship_address2,
        ship_city:     val.corrected.city,
        ship_state:    val.corrected.state,
        ship_zip:      val.corrected.zip,
      }));
      req.session.addrValAcked = acked.concat(settled).slice(-8);

      req.session.addrWarning = {
        verdict:   val.verdict,
        flags:     val.flags,
        uspsFlags: val.uspsFlags,
        dpv:       val.uspsDpv,
        corrected: val.corrected,
        typed: {
          address1: fields.ship_address1,
          address2: fields.ship_address2 || '',
          city:     fields.ship_city,
          state:    fields.ship_state,
          zip:      fields.ship_zip,
        },
      };
      return res.redirect('/checkout');
    }

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
  /* FIRST. This handler has TWO early returns below - an empty cart and a
     missing draft - and the delete used to sit after res.render(), so
     either one left the errors in the session for up to seven days. */
  const flash = takeCheckoutFlash(req);

  const cart = getCart(req);
  if (cart.items.length === 0) return res.redirect('/cart');

  const order = await requireDraft(req, res);
  if (!order) return;

  res.render('pages/checkout-delivery', {
    pageTitle: 'Delivery | BathroomVanitiesOutlet.com',
    metaDesc:  '', noindex: true,
    cart, subtotal: calcTotal(cart.items), order,
    errors: flash.errors,
  });
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
          SET ship_instructions      = ?,
              delivery_terms_ack_at  = NOW(),
              delivery_terms_ip      = ?,
              delivery_terms_version = ?
        WHERE id = ? AND ${EDITABLE}`,
      [
        String(req.body.ship_instructions || '').trim().slice(0, 500) || null,
        clientIp(req),
        DELIVERY_TERMS_VERSION,
        order.id,
      ]
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
    /* NO checkoutError here. It belongs to page 1 - "We could not save
       your details" - and a stale one rendered above the card form telling
       a buyer a payment failed when none had been attempted. Page 1 sets
       it, page 1 shows it, page 1 clears it. */
    /* Publishable key is public by design — it identifies the account and
       can only create, never read or charge. The secret key must never
       reach a template. */
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  });
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
    `SELECT id, order_number, delivery_terms_ack_at,
            guest_email, ship_phone
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
    /* REQUIRED for canConfirm. Page 3 has no email field - page 1 owns
       that fact - so without this the session's email is never set,
       canConfirm never turns true, and Place Order is permanently dead
       while looking enabled. See stripeService.customer_email. */
    email:     order.guest_email || '',
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

      /* The issuer says the card was used fraudulently — BEFORE any
         chargeback exists. Under manual capture this is the most valuable
         event Stripe sends us: the money is still only held, so cancelling
         the authorisation costs nothing and there is no dispute to fight.
         Captured first, and the same facts arrive later as a dispute. */
      case 'radar.early_fraud_warning.created':
        await handleEarlyFraudWarning(event.data.object);
        break;

      /* Disputes. All three types land in one handler because they write
         the same row; `status` is what distinguishes them. */
      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed':
        await handleDispute(event.data.object, event.type);
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

/**
 * Which order does this charge belong to?
 *
 * EFW and dispute events identify the transaction by CHARGE id, not by our
 * order id, and they carry no metadata — the metadata we set lives on the
 * PaymentIntent, and Stripe does not copy it onto these events. So the only
 * route back to an order is the id we stored at authorisation.
 *
 * Two columns are tried because they are written at different moments and
 * either can be the one that is populated:
 *   stripe_charge_id       written by handleSessionCompleted
 *   payment_transaction_id the PaymentIntent, written at the same time
 *
 * Returns null rather than throwing when nothing matches. An unmatched
 * event is not necessarily a bug — it may belong to a test-mode charge, or
 * to an order placed before these columns existed — but it IS logged,
 * because a fraud warning we cannot attach to an order is a fraud warning
 * nobody will see.
 */
async function orderIdForCharge(chargeId, paymentIntentId) {
  if (!chargeId && !paymentIntentId) return null;

  const [rows] = await bvoPool.query(
    `SELECT id FROM orders
      WHERE (? IS NOT NULL AND stripe_charge_id = ?)
         OR (? IS NOT NULL AND payment_transaction_id = ?)
      ORDER BY id DESC LIMIT 1`,
    [chargeId || null, chargeId || null,
     paymentIntentId || null, paymentIntentId || null]
  );
  return rows[0]?.id || null;
}

/**
 * Early Fraud Warning.
 *
 * Writes the flag and nothing else. It deliberately does NOT cancel the
 * authorisation automatically, for two reasons: Stripe's Chargeback
 * Protection terms void coverage on a transaction a merchant manually
 * intervenes in, and a false positive that auto-cancels a good order costs
 * a customer. A human decides; this makes sure the human can see it.
 *
 * Guarded on payment_efw_at IS NULL so a Stripe redelivery is a no-op and
 * cannot overwrite the first warning's timestamp with a later one.
 */
async function handleEarlyFraudWarning(efw) {
  const chargeId = typeof efw.charge === 'string' ? efw.charge : efw.charge?.id;
  const piId     = typeof efw.payment_intent === 'string'
                 ? efw.payment_intent : efw.payment_intent?.id;

  const orderId = await orderIdForCharge(chargeId, piId);
  if (!orderId) {
    console.error('[checkout.webhook] EFW with no matching order —',
      'efw:', efw.id, 'charge:', chargeId, 'pi:', piId);
    return;
  }

  await bvoPool.query(
    `UPDATE orders
        SET payment_efw_at     = NOW(),
            payment_efw_id     = ?,
            payment_efw_reason = ?
      WHERE id = ? AND payment_efw_at IS NULL`,
    [efw.id || null, efw.fraud_type || null, orderId]
  );

  /* Loud on purpose. There is no admin alert channel in this codebase yet,
     so the server log is the only place this surfaces until someone opens
     the order. */
  console.error('[FRAUD] Early Fraud Warning on order', orderId,
    '— reason:', efw.fraud_type || 'unknown',
    '— if still auth_only, cancel the authorisation rather than capturing.');
}

/**
 * Dispute created, updated or closed.
 *
 * `evidence_details.due_by` is the field that costs real money: Stripe
 * closes a dispute as LOST when the deadline passes with nothing submitted,
 * and a default loss cannot be appealed. It arrives as a unix timestamp in
 * SECONDS — multiplying by 1000 is not optional, and getting it wrong dates
 * the deadline to 1970 and hides it.
 *
 * Not guarded on a null check: unlike EFW, a dispute legitimately changes
 * over its life (needs_response to under_review to won or lost), so each
 * event overwrites. dispute_opened_at is written once via COALESCE so the
 * original date survives every later update.
 */
async function handleDispute(dispute, eventType) {
  const chargeId = typeof dispute.charge === 'string'
                 ? dispute.charge : dispute.charge?.id;
  const piId     = typeof dispute.payment_intent === 'string'
                 ? dispute.payment_intent : dispute.payment_intent?.id;

  const orderId = await orderIdForCharge(chargeId, piId);
  if (!orderId) {
    console.error('[checkout.webhook] dispute with no matching order —',
      'dispute:', dispute.id, 'charge:', chargeId, 'pi:', piId);
    return;
  }

  /* Unix SECONDS to a MySQL DATETIME. Null-safe: `due_by` is absent on some
     statuses (a won dispute has no deadline left to meet). */
  const dueBy = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000)
    : null;

  const closed = eventType === 'charge.dispute.closed';

  await bvoPool.query(
    `UPDATE orders
        SET dispute_id              = ?,
            dispute_status          = ?,
            dispute_reason          = ?,
            dispute_amount          = ?,
            dispute_evidence_due_at = ?,
            dispute_opened_at       = COALESCE(dispute_opened_at, NOW()),
            dispute_closed_at       = ?
      WHERE id = ?`,
    [
      dispute.id     || null,
      dispute.status || null,
      dispute.reason || null,
      /* Stripe amounts are in the currency's minor unit. */
      dispute.amount != null ? (dispute.amount / 100).toFixed(2) : null,
      dueBy,
      closed ? new Date() : null,
      orderId,
    ]
  );

  console.error('[DISPUTE]', eventType, 'on order', orderId,
    '— status:', dispute.status,
    '— reason:', dispute.reason,
    dueBy ? `— evidence due ${dueBy.toISOString().slice(0, 10)}` : '');
}

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
              /* 3DS. All three stay NULL when 3DS was not invoked, which is
                 the normal case. NULL means "not attempted", not "failed". */
              payment_3ds_result    = ?,
              payment_3ds_flow      = ?,
              payment_3ds_eci       = ?,
              /* Recorded at authorisation on purpose, so a later edit to
                 either address cannot rewrite what was true at the time. */
              ship_bill_mismatch    = ?,
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
        d.tdsResult, d.tdsFlow, d.tdsEci,
        who.shipBillMismatch ? 1 : 0,
        d.subtotal, d.tax, d.total,
        orderId,
      ]
    );

    if (upd.affectedRows === 0) return;   // replay — already handled

    /* Geocode the delivery address. Deliberately NOT awaited.

       This is a convenience for the admin delivery screen, not part of
       taking the order: the Census service is free and has no SLA, and a
       slow or dead lookup must never delay the confirmation email or
       leave this handler half-finished. Failure writes nothing, so
       ship_geocoded_at stays null and the columns can be filled later.

       Guarded on the ship-to actually existing. The guard matters: on an
       order where nothing was collected, shippingFrom() falls back to the
       billing address, and geocoding that would silently pin the map to
       the cardholder's home rather than the delivery address. */
    if (who.shipAddress1 && (who.shipZip || (who.shipCity && who.shipState))) {
      geocode.geocodeUsAddress({
        address1: who.shipAddress1,
        city:     who.shipCity,
        state:    who.shipState,
        zip:      who.shipZip,
      })
        .then(g => g && bvoPool.query(
          `UPDATE orders
              SET ship_lat = ?, ship_lng = ?,
                  ship_geocode_source = ?, ship_geocoded_at = NOW()
            WHERE id = ? AND ship_lat IS NULL`,
          [g.lat, g.lng, g.source, orderId]
        ))
        .catch(err => console.error('[checkout] geocode failed for order',
          orderId, '—', err && err.message));
    }

    /* ── REMEMBER THE BILLING ADDRESS (velocity, items 6/9) ──────────
       Billing only ever arrives here — Stripe collects it, BVO never
       asks for it — which is why this write lives in the webhook while
       the shipping one lives in saveInfo.

       There is NO SESSION in a webhook, so customer_id is read back off
       the order rather than taken from req. An order placed before the
       identity gate existed has a NULL customer_id; record() rejects
       that and returns {ok:false} rather than writing an orphan row.

       Fire-and-forget, like the geocode above: a fraud signal must not
       delay or fail the handler that confirms a paid order. */
    if (who.billAddress1) {
      bvoPool.query('SELECT customer_id FROM orders WHERE id = ?', [orderId])
        .then(([[row]]) => row && row.customer_id && CustomerAddress.record(
          row.customer_id, 'billing', {
            first_name: who.firstName,
            last_name:  who.lastName,
            address1:   who.billAddress1,
            city:       who.billCity,
            state:      who.billState,
            zip:        who.billZip,
          }))
        .catch(err => console.error('[checkout] billing address record failed for order',
          orderId, '—', err && err.message));
    }

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
