'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * shipMode.js — ONE answer to "is this freight or parcel, and where does
 * the customer track it?"
 *
 * WHY THIS IS A MODULE AND NOT THREE COPIES OF AN IF
 * ─────────────────────────────────────────────────────────────────────────
 * The same question is asked in at least five places: the customer
 * tracking page, the customer order detail, the admin shipment panel, the
 * shipped email, and whatever is built next. On 2026-10-27 the tracking
 * page answered it one way (freight, always) and shipped copy promising a
 * UPS parcel customer an appointment call that was never coming.
 *
 * A second copy of a predicate drifts from the first. So there is one.
 *
 * ⚠️ MODE COMES FROM product_type, NEVER FROM THE CARRIER NAME.
 * 'FedEx' is both: FedEx Freight is LTL, FedEx Ground is a parcel on a
 * van. A match on the string 'fedex' is wrong roughly half the time and
 * looks perfectly reasonable in review. shipments.product_type is
 * ENUM('LTL','SMALLPACK') NOT NULL DEFAULT 'LTL', so there is always an
 * answer.
 *
 * ⚠️ NO FUNCTION HERE OPENS A DATABASE CONNECTION. Every one takes a row
 * and returns a value, so a gate can RUN these rules rather than
 * re-implement them — which is the only way a gate can be trusted not to
 * agree with the bug it is meant to catch.
 * ───────────────────────────────────────────────────────────────────────── */

/* ── MODE ──────────────────────────────────────────────────────────── */

/**
 * True when this shipment is small parcel (UPS / FedEx Ground / USPS).
 *
 * Only an explicit SMALLPACK counts. Everything else — including a null,
 * an empty string or a value nobody anticipated — is treated as freight,
 * and that direction is deliberate: freight copy promises an appointment
 * call, parcel copy promises a doorstep drop. Wrongly promising a call
 * costs a redelivery; wrongly promising a doorstep drop leaves a pallet
 * on a driveway and a customer who was never told to be home.
 */
function isParcel(shipment) {
  if (!shipment) return false;
  return String(shipment.product_type || '').trim().toUpperCase() === 'SMALLPACK';
}

/** 'parcel' | 'freight' — for labels and CSS hooks. */
function mode(shipment) {
  return isParcel(shipment) ? 'parcel' : 'freight';
}

/**
 * What to call the number in front of a customer.
 *
 * 'PRO number' is freight vocabulary. A parcel customer has never seen it
 * and would not recognise it as the number on their FedEx notification.
 */
function trackingLabel(shipment) {
  return isParcel(shipment) ? 'Tracking number' : 'Tracking (PRO) number';
}

/* ── THE NUMBER ────────────────────────────────────────────────────── */

/**
 * The tracking number, wherever it was written.
 *
 * ⚠️ TWO COLUMNS HOLD THIS, BECAUSE TWO BOOKING PATHS WROTE IT
 * DIFFERENTLY. shippingController (the WWEX flow) writes `pro_number`;
 * ordersController (the Book button on the order page) writes
 * `tracking_number`. Both routes are live and both rows are real, so
 * reading only one column makes half of all shipments look untracked —
 * which is exactly what happened: Customer.getOrderTracking required
 * pro_number, so anything booked from the order page showed no Track
 * button at all.
 *
 * pro_number wins when both are set: it is the freight document number
 * and the one a carrier's own desk will recognise.
 */
function trackingNumber(shipment) {
  if (!shipment) return null;
  const pro = String(shipment.pro_number || '').trim();
  if (pro) return pro;
  const tn = String(shipment.tracking_number || '').trim();
  return tn || null;
}

/** A shipment a customer can actually act on: not voided, has a number. */
function isTrackable(shipment) {
  if (!shipment) return false;
  if (String(shipment.status || '').trim().toLowerCase() === 'voided') return false;
  return trackingNumber(shipment) !== null;
}

/* ── THE LINK ──────────────────────────────────────────────────────── */

/**
 * Carrier → tracking URL.
 *
 * ⚠️ DELIBERATELY SMALL, AND A MISS RETURNS null RATHER THAN A GUESS.
 * A wrong tracking link is worse than no link: it reads to the customer
 * as the carrier having lost their shipment, and it generates the support
 * ticket the page existed to prevent.
 *
 * FedEx has changed its public tracking URL more than once and sources
 * disagree on the current parameter (?trknbr= vs ?tracknumbers=), so the
 * per-shipment `tracking_url` column always wins over anything here: the
 * vendor supplies a working link, somebody pastes it, and no template
 * can rot underneath it.
 *
 * Keys are matched loosely against the carrier name because WWEX returns
 * display names with inconsistent punctuation ('RL Carriers', 'R+L
 * Carriers', 'TFORCE FREIGHT'). That looseness is safe HERE and nowhere
 * else in this file: the worst case of a wrong match is a link to the
 * wrong carrier's lookup page, not a wrong promise about delivery. Mode
 * is never decided this way.
 */
const URL_TEMPLATES = [
  { test: /\bups\b/i,                 url: n => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}` },
  { test: /\busps\b|postal/i,         url: n => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}` },
  { test: /fedex/i,                   url: n => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}` },
  { test: /\bestes\b/i,               url: n => `https://www.estes-express.com/myestes/shipment-tracking/?search=${encodeURIComponent(n)}` },
  { test: /old\s*dominion|\bodfl\b/i, url: n => `https://www.odfl.com/us/en/tools/trace-results.html?pro=${encodeURIComponent(n)}` },
  { test: /\bsaia\b/i,                url: n => `https://www.saia.com/track/details?pro=${encodeURIComponent(n)}` },
  { test: /\bxpo\b/i,                 url: n => `https://www.xpo.com/track/?reference=${encodeURIComponent(n)}` },
];

/**
 * The URL to link the tracking number to, or null.
 *
 * Order of preference:
 *   1. shipment.tracking_url   — pasted by hand, cannot rot
 *   2. a carrier template      — convenience only
 *   3. null                    — show the number as plain text
 *
 * ⚠️ NEVER FALLS BACK TO A GENERIC TRACKER. The old code hardcoded
 * `https://wwex.com/track/<number>` into both the shipped email and the
 * admin panel for every shipment regardless of carrier. For a FedEx
 * parcel that is a dead link in the one email the customer actually
 * opens.
 */
function trackingUrl(shipment) {
  if (!shipment) return null;

  const manual = String(shipment.tracking_url || '').trim();
  /* http(s) only: a pasted value ends up in an href, and javascript: or
     data: in that position is a scripting vector even in an admin-sourced
     field. Anything else is dropped rather than rendered. */
  if (manual && /^https?:\/\//i.test(manual)) return manual;

  const num = trackingNumber(shipment);
  if (!num) return null;

  const carrier = String(shipment.carrier || '');
  if (!carrier.trim()) return null;

  const hit = URL_TEMPLATES.find(t => t.test.test(carrier));
  return hit ? hit.url(num) : null;
}

module.exports = {
  isParcel, mode, trackingLabel,
  trackingNumber, isTrackable, trackingUrl,
  URL_TEMPLATES,
};
