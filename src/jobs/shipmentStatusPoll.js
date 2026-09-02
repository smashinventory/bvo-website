'use strict';

/* Load .env BEFORE any other require.
   Only src/server.js calls dotenv normally, so a job run from cron would
   otherwise start with no environment: WWEX_CLIENT_ID would be undefined,
   wwexService would fall into stub mode, and this job would report
   "nothing to poll" on every run while silently doing nothing.

   WHERE THE ENVIRONMENT ACTUALLY COMES FROM — read this before changing
   anything here.

   The source of truth is hPanel. Environment variables are defined in
   Hostinger's Node.js app manager, and hPanel injects them into the
   MANAGED APP PROCESS. That is why server.js gets away with a bare
   require('dotenv').config() and why the site works.

   A cron job inherits none of that. Cron spawns a bare shell with a
   minimal environment; it is not the managed app process, so nothing is
   injected. This is the same shape as the node-not-found problem one layer
   down: works interactively, works for the app, dies on a schedule.

   So a cron-run job has to get the values from a FILE. On this server they
   materialise at:

       <domain>/hbuilds/config/.env

   which sits outside hbuilds/current/ so deploys cannot overwrite it, and
   carries DB_* plus WWEX_*. Note this file is DOWNSTREAM of hPanel, not the
   authority: change a variable in hPanel, not here. If a value looks stale,
   suspect drift between the two before suspecting this code.

   (The alternative, used by jmsync.sh and jmv_rollup.sh, is to export the
   values inline in the shell wrapper. That works, but puts a plaintext
   password in a file at the domain root and creates a third copy to keep
   in sync. Reading the file avoids both.)

   CORRECTED 2026-09-02 — this previously pointed at <domain>/nodejs/.env,
   which holds only a .env.example, and the job died with
   "DB_PASS is not set in .env".

   Every candidate is tried in turn and the one that actually yields
   DB_PASS wins, so this works on the server and on a laptop without
   editing anything. The resolved path is logged — an environment loaded
   from somewhere unexpected should never be a mystery. */
const path = require('path');
const fs   = require('fs');

const BVO_BASE = '/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com';
const ENV_CANDIDATES = [
  process.env.BVO_ENV_PATH,                       // explicit override wins
  `${BVO_BASE}/hbuilds/config/.env`,              // CONFIRMED — survives deploys
  `${BVO_BASE}/hbuilds/current/nodejs/.env`,      // if a deploy ever symlinks it in
  path.resolve(__dirname, '../../.env'),          // local/dev checkout
].filter(Boolean);

let ENV_LOADED_FROM = null;
for (const candidate of ENV_CANDIDATES) {
  if (!fs.existsSync(candidate)) continue;
  require('dotenv').config({ path: candidate });
  if (process.env.DB_PASS) { ENV_LOADED_FROM = candidate; break; }
}

if (!ENV_LOADED_FROM) {
  console.error('FATAL: no .env yielded DB_PASS. Looked in:');
  ENV_CANDIDATES.forEach(c => console.error('  ', c, fs.existsSync(c) ? '(exists)' : '(missing)'));
  console.error('Set BVO_ENV_PATH to the correct file if it has moved.');
  process.exit(1);
}
console.log('[poll] env loaded from:', ENV_LOADED_FROM);

/**
 * shipmentStatusPoll.js
 * Polls WWEX for the current carrier status of every ACTIVE shipment and
 * syncs the result to both the shipment and its linked order.
 *
 * WHY THIS EXISTS
 * ---------------
 * WWEX sends delivery alerts to the RECEIVER's email address, not to us,
 * and there is no webhook. Without polling, a shipment's status only ever
 * updates when a human clicks Refresh on the Shipments list — so orders
 * sat on "Shipped" indefinitely even after the freight had arrived.
 *
 * Run twice daily via cron. See shipment_status_poll.sh.
 *
 * Usage:
 *   node src/jobs/shipmentStatusPoll.js          # normal run
 *   node src/jobs/shipmentStatusPoll.js --dry    # report only, no writes
 *
 * Safe to run repeatedly — every write is idempotent.
 */

const { bvoPool } = require('../config/database');
const wwex        = require('../services/wwexService');

/* Statuses worth polling. Anything already delivered, voided or cancelled
   is terminal and never checked again — that keeps the API call count
   proportional to shipments actually in motion. */
/* shipments.status is an ENUM, NOT the VARCHAR(30) the migration file claims:
     enum('booked','in_transit','delivered','exception','voided')
   Writing anything outside it does NOT error — MySQL in non-strict mode stores
   an EMPTY STRING, and that row then falls outside every status filter and
   goes invisible. Keep this list matching the ENUM exactly. */
const SHIPMENT_STATUSES = ['booked', 'in_transit', 'delivered', 'exception', 'voided'];

/* Statuses worth polling. delivered and voided are terminal. */
const ACTIVE_STATUSES = ['booked', 'in_transit', 'exception'];

/* Which carrier states move the ORDER, and what they move it to.
   Mirrors SHIPMENT_TO_ORDER_STATUS in shippingController. Orders stay
   coarser than shipments deliberately — 'out_for_delivery' and 'exception'
   are useful on the Shipments list but would only add churn to the order. */
const SHIPMENT_TO_ORDER_STATUS = {
  in_transit: 'in_transit',
  delivered:  'delivered',
};

/* Orders move FORWARD only. Stops a late or out-of-order carrier update
   dragging a delivered order back to in_transit, and keeps cancelled or
   refunded orders untouched since they are not on this path at all. */
const ORDER_PROGRESSION = ['shipped', 'in_transit', 'delivered'];

/* Stop polling a shipment this many days after its ship date. Without this
   an old stuck row would be queried forever, twice a day, for nothing. */
const MAX_AGE_DAYS = 45;

/** Map a free-text carrier status onto our vocabulary. Mirrors
 *  _mapCarrierStatus in shippingController — keep the two in step.
 *
 *  ORDER MATTERS. "Out For Delivery" and "Delivery Exception" both contain
 *  "deliver" but neither means delivered. Testing the general case first
 *  would mark freight still on the truck as delivered and flip its order
 *  to Delivered prematurely — so the specific cases come first.
 *
 *  "Out For Delivery" maps to in_transit: the ENUM has no out_for_delivery,
 *  and the freight is still, accurately, in transit.
 */
function mapCarrierStatus(raw) {
  const s = String(raw || '').toLowerCase();
  let v;
  if (s.includes('out for'))                              v = 'in_transit';
  else if (s.includes('exception') || s.includes('fail')) v = 'exception';
  else if (s.includes('deliver'))                         v = 'delivered';
  else if (s.includes('void') || s.includes('cancel'))    v = 'voided';
  else if (s.includes('transit') || s.includes('pickup')
        || s.includes('picked'))                          v = 'in_transit';
  else                                                    v = 'booked';

  // Never hand the ENUM a value it cannot store — that writes '' silently.
  if (!SHIPMENT_STATUSES.includes(v)) {
    console.warn(`[poll] refusing unknown shipment status "${v}" (from "${raw}") — using 'booked'`);
    return 'booked';
  }
  return v;
}

/**
 * Run the poll.
 * @param {{dry?:boolean}} opts  dry = report only, write nothing
 * @returns {Promise<object>} summary — also returned to the admin UI
 */
async function runPoll(opts = {}) {
  const DRY     = !!opts.dry;
  const started = Date.now();
  const lines   = [];   // human-readable trace returned to the caller
  const say = (msg) => { lines.push(msg); console.log(msg); };

  say(`[poll] shipment status poll starting${DRY ? ' (DRY RUN)' : ''} — ${new Date().toISOString()}`);

  if (wwex.apiMode === 'stub') {
    say('[poll] wwexService is in stub mode — no WWEX credentials visible to this process. Nothing to poll.');
    return { ok: false, dry: DRY, stub: true, lines,
             error: 'WWEX credentials not loaded — the poll cannot run. Check that .env is readable from the job.' };
  }
  say(`[poll] WWEX mode: ${wwex.apiMode}`);

  const [rows] = await bvoPool.query(
    `SELECT id, bol_number, pro_number, product_type, status, order_id, ship_date
       FROM shipments
      WHERE status IN (?)
        AND (bol_number IS NOT NULL OR pro_number IS NOT NULL)
        AND (ship_date IS NULL OR ship_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY))
      ORDER BY id ASC`,
    [ACTIVE_STATUSES, MAX_AGE_DAYS]
  );

  if (!rows.length) {
    say('[poll] no active shipments to check.');
    return { ok: true, dry: DRY, checked: 0, changed: 0,
             deliveredOrders: 0, inTransitOrders: 0, failed: 0, lines };
  }
  say(`[poll] checking ${rows.length} active shipment(s)…`);

  let changed = 0, deliveredOrders = 0, inTransitOrders = 0, failed = 0, unchanged = 0;

  for (const s of rows) {
    const ref  = s.bol_number || s.pro_number;
    const type = s.bol_number ? 'BOL' : 'PRO';

    try {
      const result = await wwex.searchShipmentsFlow([ref], type, s.product_type || 'LTL');
      if (!result.ok) {
        failed++;
        say(`[poll]   #${s.id} ${ref} — lookup failed: ${result.error}`);
        continue;
      }

      const carrier = result.shipments?.[0];
      if (!carrier?.status) { unchanged++; continue; }

      const next = mapCarrierStatus(carrier.status);
      if (next === s.status) { unchanged++; continue; }

      say(`[poll]   #${s.id} ${ref} — ${s.status} → ${next} ("${carrier.status}")`);
      if (DRY) { changed++; continue; }

      await bvoPool.query(
        `UPDATE shipments
            SET status = ?,
                pro_number   = COALESCE(pro_number, ?),
                delivered_at = CASE WHEN ? = 'delivered' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
                updated_at   = NOW()
          WHERE id = ?`,
        [next, carrier.pro || null, next, s.id]
      );
      changed++;

      /* Propagate to the order. Mirrors _syncOrderFromShipment in
         shippingController — keep the two in step. Orders may only move
         FORWARD along shipped → in_transit → delivered, so a late or
         out-of-order carrier update can never drag a delivered order
         backwards, and cancelled/refunded orders are never touched. */
      const target = SHIPMENT_TO_ORDER_STATUS[next];
      if (target && s.order_id) {
        const [[ord]] = await bvoPool.query('SELECT status FROM orders WHERE id = ?', [s.order_id]);
        const from = ord ? ORDER_PROGRESSION.indexOf(ord.status) : -1;
        const to   = ORDER_PROGRESSION.indexOf(target);
        if (from !== -1 && to > from) {
          await bvoPool.query(
            `UPDATE orders
                SET status = ?,
                    delivered_at = CASE WHEN ? = 'delivered' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
                    updated_at = NOW()
              WHERE id = ?`,
            [target, target, s.order_id]
          );
          await bvoPool.query(
            `INSERT INTO order_events (order_id, event_type, from_status, to_status, actor, notes)
             VALUES (?, ?, ?, ?, 'system:poll', ?)`,
            [s.order_id, target === 'delivered' ? 'delivered' : 'in_transit',
             ord.status, target,
             `Carrier reported "${next}" for shipment #${s.id} (${ref}).`]
          );
          if (target === 'delivered') deliveredOrders++; else inTransitOrders++;
          say(`[poll]     order ${s.order_id} ${ord.status} → ${target}`);
        }
      }
    } catch (err) {
      failed++;
      say(`[poll]   #${s.id} ${ref} — error: ${err.message}`);
    }
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  say(`[poll] done in ${secs}s — checked ${rows.length}, shipments changed ${changed}, `
    + `orders → in transit ${inTransitOrders}, → delivered ${deliveredOrders}, `
    + `unchanged ${unchanged}, failed ${failed}`
    + (DRY ? '  (DRY RUN — nothing written)' : ''));

  return {
    ok: true, dry: DRY,
    checked: rows.length, changed, inTransitOrders, deliveredOrders,
    unchanged, failed, seconds: Number(secs), lines,
  };
}

module.exports = { runPoll, mapCarrierStatus };

/* ── CLI entry ─────────────────────────────────────────────────────
   Only self-executes when run directly (node src/jobs/shipmentStatusPoll.js).
   Requiring the module from the admin controller must NOT trigger a run or
   close the shared connection pool. */
if (require.main === module) {
  runPoll({ dry: process.argv.includes('--dry') })
    .then(()  => bvoPool.end())
    .then(()  => process.exit(0))
    .catch(e  => {
      console.error('[poll] FATAL:', e);
      bvoPool.end().finally(() => process.exit(1));
    });
}
