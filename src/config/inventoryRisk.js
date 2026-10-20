'use strict';

/**
 * inventoryRisk.js — which SKUs on open orders need a vendor call today.
 *
 * ⚠️ THE THRESHOLD IS NOT ARBITRARY. It is the owner's standing operating
 * procedure, BVO_COMMERCE_STACK_BRIEF.md §2, stated 2026-09-25:
 *
 *   "AVAILABILITY — confirm stock. If vendor stock is 2 or below, call the
 *    vendor for verbal confirmation — inventory is first-come-first-served
 *    across all their resellers and we cannot see other resellers'
 *    incoming orders."
 *
 * This module does not change that process. It finds the orders the call
 * applies to, so the call is targeted rather than made on every order.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────
 *
 * NOT A BLOCK. Nothing here refuses an order, an add-to-cart or a capture.
 * The number it reads is a NIGHTLY SNAPSHOT of stock held at the vendor and
 * allocated first-come-first-served across resellers we cannot see. It was
 * already stale when it was written and is staler now. Refusing a sale on
 * that basis turns away orders the vendor could have filled; the staff call
 * is the control, and this only aims it.
 *
 * NOT A RESERVATION SYSTEM. `inventory.qty_reserved` exists, is commented
 * "held in open orders", and is read by adminController:532 — but NOTHING
 * HAS EVER WRITTEN IT. It is always 0. It is exactly the column a reader
 * reaches for here, and using it would make every figure on the page zero
 * while looking entirely reasonable. Demand is computed from order_items at
 * read time instead. Making qty_reserved real means decrementing on order,
 * releasing on cancel, reconciling against the nightly feed and handling the
 * race — a genuine inventory-reservation system, and not what a read-only
 * warning needs.
 */

/* ── THE THRESHOLD, from §2 ──────────────────────────────────────────── */
const LOW_STOCK_AT = 2;

/* How old the snapshot may be before the figure itself is the problem.
   The feed runs nightly, so anything past ~26 hours means it missed a run
   and every number on the page is yesterday's or older. That is a louder
   signal than any single SKU and is reported separately. */
const STALE_AFTER_HOURS = 26;

/* ── WHAT COUNTS AS DEMAND ───────────────────────────────────────────────
   Orders still competing for vendor stock: placed, not yet shipped.

   'shipped', 'in_transit' and 'delivered' are gone — the allocation was
   made. 'cancelled' and 'refunded' released theirs.

   ⚠️ 'pending' IS AMBIGUOUS AND MUST BE FILTERED FURTHER. An abandoned
   checkout also sits at status='pending' with payment_status='pending'
   (checkoutController:1522). Counting those as demand would inflate every
   figure here with carts nobody ever paid for — the same defect revenue.js
   was created to fix. So the base predicate from revenue.js is applied too,
   which excludes the placeholder payment states, test rows and
   cancellations. Demand means someone's card is on the hook for it. */
const OPEN_DEMAND_STATUSES = ['pending', 'confirmed', 'processing'];

/* ── SEVERITY ────────────────────────────────────────────────────────────
   Ordered worst-first. The ladder matters more than the labels: it is what
   turns a list of warnings into a work queue.

   'oversold'    more units are promised than the snapshot shows. Two
                 customers, one unit. This is the only state that is
                 already a problem rather than a risk, and it is invisible
                 today.
   'critical'    at or below the §2 threshold. Make the call.
   'backorder'   at or below the threshold, but the vendor has agreed to
                 supply regardless. Informational — NOT lumped in with
                 critical, because treating an agreed backorder as an
                 emergency is how a real emergency gets missed.
   'unknown'     no inventory row at all.

   ⚠️ 'unknown' IS A THIRD STATE AND MUST NEVER RENDER AS ZERO. Samples and
   parts may have no inventory row, so a LEFT JOIN yields NULL. In SQL
   `NULL <= 2` is NOT TRUE, so these would quietly fall OUT of a naive
   threshold test rather than into it — the page would assert "nothing to
   worry about" about a SKU it knows nothing about. Absence of data is not
   evidence of stock. It is surfaced, quietly, as its own state. */
function classify(row) {
  if (!row || row.stock_unknown) return 'unknown';

  /* ⚠️ NULL MUST BE TESTED BEFORE Number(), and this exact line was wrong
     in the first version of this file. `Number(null)` is 0 - a perfectly
     finite number - so a LEFT JOIN miss arrived here as "zero stock" and
     classified as OVERSOLD. The unit test caught it immediately; nothing
     about the code read as wrong, which is the whole point of this file's
     NULL-is-not-zero warning being a test rather than a paragraph. */
  if (row.qty_on_hand === null || row.qty_on_hand === undefined) return 'unknown';

  const stock  = Number(row.qty_on_hand);
  const demand = Number(row.demand);
  if (!Number.isFinite(stock)) return 'unknown';

  if (demand > stock && !row.allow_backorder) return 'oversold';
  if (stock <= LOW_STOCK_AT) {
    return row.allow_backorder ? 'backorder' : 'critical';
  }
  return 'ok';
}

/* Only these three put a badge on an order row. 'backorder' and 'ok' do not:
   a badge that appears on everything stops being read. */
const ACTIONABLE = ['oversold', 'critical', 'unknown'];

function isActionable(severity) { return ACTIONABLE.includes(severity); }

/**
 * Is the snapshot itself too old to reason about.
 * @param {Date|string|null} lastSyncedAt newest last_synced_at across the set
 */
function isStale(lastSyncedAt) {
  if (!lastSyncedAt) return true;
  const t = new Date(lastSyncedAt).getTime();
  if (!Number.isFinite(t)) return true;
  return (Date.now() - t) > STALE_AFTER_HOURS * 3600 * 1000;
}

/* Labels live with the rule so the view cannot invent a fourth severity. */
const LABELS = {
  oversold:  { text: 'Oversold',   tone: 'red',    hint: 'More units promised than the last snapshot showed' },
  critical:  { text: 'Low stock',  tone: 'amber',  hint: `Vendor stock at or below ${LOW_STOCK_AT} — call to confirm (SOP §2)` },
  backorder: { text: 'Backorder',  tone: 'blue',   hint: 'Low, but the vendor supplies on backorder' },
  unknown:   { text: 'No data',    tone: 'grey',   hint: 'No inventory record for this SKU — not the same as zero' },
};

module.exports = {
  LOW_STOCK_AT,
  STALE_AFTER_HOURS,
  OPEN_DEMAND_STATUSES,
  ACTIONABLE,
  LABELS,
  classify,
  isActionable,
  isStale,
};
