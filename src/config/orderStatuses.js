'use strict';

/**
 * orderStatuses.js
 * Single source of truth for order status values and what they MEAN.
 *
 * WHY THIS EXISTS
 * ---------------
 * The seven status values existed as a bare array in ordersController with no
 * definitions anywhere. Only two were ever set automatically:
 *   • 'confirmed' — hardcoded at checkout (checkoutController)
 *   • 'shipped'   — set when a WWEX shipment books
 * The rest were manual dropdown values with no agreed meaning, which is why
 * it was unclear how an order reached a given state or what it implied.
 *
 * The definitions below are now the agreed semantics. Where the code does not
 * yet enforce one, it is flagged in `autoSet` so the gap stays visible rather
 * than being quietly forgotten.
 *
 * Used by: orders list filter, status badges, the detail-page dropdown.
 * Add a status here and everywhere picks it up.
 */

const ORDER_STATUSES = [
  {
    value: 'pending',
    label: 'Pending',
    tip:   'Awaiting payment. The order exists but funds have not been accepted yet.',
    /* ⚠️ THIS COMMENT USED TO READ "nothing sets this today — checkout goes
       straight to Confirmed". That was WRONG and had been since the
       three-page checkout landed: checkoutController.createSession writes
       status='pending' the moment a Stripe session is created. Corrected
       2026-10-22. Do not trust autoSet without grepping. */
    autoSet: true,    // checkoutController.createSession
  },
  {
    value: 'confirmed',
    label: 'Confirmed',
    tip:   'Payment accepted and the order is validated. Set automatically at checkout. Ready to order from the vendor.',
    autoSet: true,    // checkoutController
  },
  {
    value: 'processing',
    label: 'Processing',
    tip:   'Vendor purchase order placed and confirmed. Goods are being prepared; the order is ready to ship.',
    autoSet: false,   // manual today; also set when a shipment is voided
  },
  {
    value: 'shipped',
    label: 'Shipped',
    tip:   'Freight booked with the carrier and a BOL issued. Set automatically when a shipment is booked, and reverted to Processing if that shipment is voided.',
    autoSet: true,    // shippingController.bookShipment
  },
  {
    value: 'in_transit',
    label: 'In Transit',
    tip:   'Carrier has picked up the freight and it is moving. Set automatically by the twice-daily shipment status poll.',
    autoSet: true,    // shipmentStatusPoll.js / manual Refresh
  },
  {
    value: 'delivered',
    label: 'Delivered',
    tip:   'Carrier has delivered the freight. Set automatically by the twice-daily shipment status poll, or immediately when someone clicks Refresh on the Shipments list.',
    autoSet: true,    // shipmentStatusPoll.js / manual Refresh
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
    tip:   'Order cancelled before shipping. No goods sent. Refund handled separately.',
    autoSet: false,
  },
  {
    value: 'refunded',
    label: 'Refunded',
    tip:   'Money returned to the customer, whether or not goods shipped or were returned.',
    autoSet: false,
  },
];

/** Bare list of valid values — use for validation. */
const VALID_ORDER_STATUSES = ORDER_STATUSES.map(s => s.value);

/** Look up one status definition. Returns null for unknown values. */
function orderStatus(value) {
  return ORDER_STATUSES.find(s => s.value === value) || null;
}

/** Tooltip text for a status, or '' when unknown. */
function orderStatusTip(value) {
  return orderStatus(value)?.tip || '';
}

/* ── ABANDONED CHECKOUTS ────────────────────────────────────────────────
   A 'draft' is a checkout in progress: real contact details, no payment
   attempted. A 'pending' row has a Stripe session open. Neither is an order
   yet, and in ordinary operation neither is work for anyone.

   ⚠️ THEY ARE NOT HIDDEN FROM THE DEFAULT ORDER LIST, AND THAT IS THE POINT.
   Until 2026-10-22 the list's empty-status default silently excluded both.
   BVO-2026-10-19-00122 and BVO-2026-10-21-00125 then sat at 'pending' while
   Stripe held live authorisations for $657 and $2,694.60 — invisible on the
   one screen that would have shown the problem, under a dropdown labelled
   "All Statuses".

   This list exists so the rows can be MARKED rather than removed, and so
   the 'Active orders' filter below has one definition instead of a literal
   repeated in a WHERE clause and a template. */
const ABANDONED_STATUSES = ['draft', 'pending'];

/** True when a row is a checkout that never became an order. */
function isAbandonedStatus(value) {
  return ABANDONED_STATUSES.includes(value);
}

/* The dropdown value meaning "hide abandoned checkouts". Deliberately not
   '' — empty means ALL, and conflating the two is the bug above. */
const ACTIVE_ONLY = 'active';

/* ── DECIDED ORDERS ─────────────────────────────────────────────────────
   Nothing further is owed on these. Used by computeRag so the dashboard
   stops flagging them.

   ⚠️ 'shipped' AND 'in_transit' ARE NOT HERE, DELIBERATELY. Goods are
   moving and the ETA and tracking-scan rules are exactly the attention
   those still need. Adding them would silence a late or stalled delivery,
   which is the one thing the board exists to catch.

   ⚠️ AN OPEN RETURN STILL OUTRANKS THIS. A return arrives on a delivered
   order by definition, so computeRag tests returns BEFORE consulting this
   list. Order of operations is the whole safety property. */
const TERMINAL_ORDER_STATUSES = ['delivered', 'cancelled', 'refunded'];

/** True when an order is decided and needs no further action. */
function isTerminalStatus(value) {
  return TERMINAL_ORDER_STATUSES.includes(value);
}

module.exports = {
  ORDER_STATUSES,
  VALID_ORDER_STATUSES,
  ABANDONED_STATUSES,
  isAbandonedStatus,
  ACTIVE_ONLY,
  TERMINAL_ORDER_STATUSES,
  isTerminalStatus,
  orderStatus,
  orderStatusTip,
};
