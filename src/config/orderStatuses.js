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
    autoSet: false,   // nothing sets this today — checkout goes straight to Confirmed
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
    value: 'delivered',
    label: 'Delivered',
    tip:   'Carrier has delivered the freight. Currently MANUAL — WWEX sends delivery alerts to the receiver, not to us, so nothing updates this automatically.',
    autoSet: false,
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

module.exports = {
  ORDER_STATUSES,
  VALID_ORDER_STATUSES,
  orderStatus,
  orderStatusTip,
};
