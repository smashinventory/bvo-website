'use strict';

/**
 * ordersController.js
 * Full order management: list (RAG dashboard), detail, vendor PO workflow,
 * WWEX shipping quotes + booking, status transitions, event log.
 *
 * Admin routes:
 *   GET  /admin/orders                    — dashboard list (RAG)
 *   GET  /admin/orders/:id                — order detail
 *   POST /admin/orders/:id/status         — update order status
 *   POST /admin/orders/:id/vendor-order   — send/resend PO email to JM
 *   POST /admin/orders/:id/vendor-confirm — manually log vendor confirmation
 *   POST /admin/orders/:id/shipping/quote — get WWEX rate quotes
 *   POST /admin/orders/:id/shipping/book  — book selected rate
 *   POST /admin/orders/:id/notes          — add admin note (logged as event)
 *   POST /admin/orders/:id/documents      — upload doc (BOL, invoice, etc.)
 */

const { bvoPool }    = require('../config/database');
/* Shared search-box behaviour — see src/utils/searchQuery.js */
const { buildSearch } = require('../utils/searchQuery');
// Single source of truth for status values and their meanings.
const { ORDER_STATUSES, VALID_ORDER_STATUSES } = require('../config/orderStatuses');
// Single source for the delete-reason dropdown, its validation and the gate.
const { composeDeleteReason, ORDER_DELETE_REASONS, MIN_DELETE_NOTE } =
  require('../config/orderDeleteReasons');
const brevo          = require('../services/brevoService');
const CustomerAddress = require('../models/CustomerAddress');
const wwex           = require('../services/wwexService');
const stripePay      = require('../services/stripeService');

/* ⚠️ ONE DEFINITION OF A SALE, shared with every other dashboard.
   See src/config/revenue.js. Unaliased ('') because the KPI queries below
   select straight FROM orders with no table alias. */
const _rev       = require('../config/revenue').predicates('');
const COUNTED    = _rev.IS_COUNTED;
const AUTHORIZED = _rev.IS_AUTHORIZED;

/* ⚠️ ALIASED TO `o`, SEPARATELY FROM THE THREE ABOVE. Those are built with
   predicates('') for queries that say `FROM orders` bare; the inventory-risk
   query joins order_items and must alias. Same module, same rule, correct
   prefix — rather than string-patching an unaliased predicate, which is how
   a WHERE clause silently starts referring to the wrong table. */
const REV_BASE   = require('../config/revenue').predicates('o').IS_REAL;
const INV        = require('../config/inventoryRisk');
const path        = require('path');
const fs          = require('fs');
const multer      = require('multer');

const LAYOUT = { layout: 'layouts/admin' };

/* Was `.catch(() => [])` / `.catch(() => null)` — every DB error swallowed
   with no log and no signal, so a broken query looked exactly like an empty
   table. See src/db/query.js for the two production incidents that came of
   it. Reads still degrade gracefully; nothing is silent. */
const { safeQuery, safeQueryOne, mustQuery, mustAffect } =
  require('../db/query')('orders');

/* ── Document upload (BOLs, invoices, damage photos) ─────────── */
const _docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = process.env.UPLOADS_DOCS_PATH
      || path.join(__dirname, '../../public/images/uploads/order-docs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `order-doc-${Date.now()}-${Math.random().toString(36).slice(2,7)}${ext}`;
    cb(null, name);
  },
});
const _docUpload = multer({ storage: _docStorage, limits: { fileSize: 20 * 1024 * 1024 } });
exports.documentUploadMiddleware = _docUpload.single('doc_file');

/* ── Helpers ──────────────────────────────────────────────────── */

/** Compute RAG status for an order based on timing and current state */
function computeRag(order, vendorPo, shipment, openReturn) {
  const now      = Date.now();
  const created  = new Date(order.created_at).getTime();
  const hoursOld = (now - created) / 36e5;

  // Red conditions
  if (openReturn && openReturn.status === 'requested' &&
      (now - new Date(openReturn.requested_at).getTime()) > 24 * 36e5) return 'red';
  if (!vendorPo && hoursOld > 4) return 'red';
  if (vendorPo && vendorPo.status === 'sent' &&
      (now - new Date(vendorPo.sent_at).getTime()) > 5 * 24 * 36e5) return 'red';
  if (shipment && shipment.status === 'in_transit' && shipment.estimated_delivery) {
    const eta = new Date(shipment.estimated_delivery).getTime();
    if (now > eta + 3 * 24 * 36e5) return 'red';
    if (shipment.last_tracking_scan &&
        (now - new Date(shipment.last_tracking_scan).getTime()) > 3 * 24 * 36e5) return 'red';
  }
  if (shipment && shipment.status === 'exception') return 'red';

  // Yellow conditions
  if (vendorPo && vendorPo.status === 'sent' &&
      (now - new Date(vendorPo.sent_at).getTime()) > 2 * 24 * 36e5) return 'yellow';
  if (!vendorPo && hoursOld > 2) return 'yellow';
  if (shipment && shipment.status === 'in_transit' && shipment.estimated_delivery) {
    const eta = new Date(shipment.estimated_delivery).getTime();
    if (now > eta + 1 * 24 * 36e5) return 'yellow';
  }
  if (openReturn && ['requested','approved','in_transit'].includes(openReturn.status)) return 'yellow';

  // Green
  return 'green';
}

/** Log an event to order_events */
async function logEvent(conn, orderId, eventType, fromStatus, toStatus, actor, notes) {
  await conn.query(
    `INSERT INTO order_events (order_id, event_type, from_status, to_status, actor, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [orderId, eventType, fromStatus || null, toStatus || null, actor || 'system', notes || null]
  );
}

/** Generate a return number */
function genReturnNumber() {
  const d = new Date();
  return `RET-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000)+1000}`;
}

/* ═══════════════════════════════════════════════════════════════
   ORDERS LIST — RAG Dashboard
   ═══════════════════════════════════════════════════════════════ */
exports.list = async (req, res, next) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page) || 1);
    const limit   = 25;
    const offset  = (page - 1) * limit;
    const status  = req.query.status || '';
    const search  = (req.query.search || '').trim();

    /* ── Abandoned checkouts are hidden, not deleted ─────────────────
       A `pending` row is written the moment someone opens /checkout —
       the Stripe session has to exist before the payment form can
       render, and the order id is what ties the two together. Most of
       those are never completed.

       They stay in the table: they are the abandoned-checkout record,
       with cart contents, UTM attribution and referrer attached, which
       is worth having. They just must not clutter the working order
       list, where every row should be something a human has to act on.

       A row leaves `pending` the moment Stripe confirms the hold
       (checkoutController webhook), so nothing real is ever hidden by
       this. Explicitly filtering on ?status=pending still shows them,
       for anyone deliberately looking. */
    let where = 'WHERE 1=1';
    const params = [];
    if (status) {
      where += ' AND o.status = ?';
      params.push(status);
    } else {
      /* Neither drafts nor pending rows are orders yet. A draft is a
         checkout in progress - real contact details, no payment attempted.
         A pending row has a Stripe session open. Both would read to staff
         as work to do, and both would be counted as revenue. */
      where += " AND o.status NOT IN ('draft','pending')";
    }

    /* Word-by-word matching — see src/utils/searchQuery.js.
       Was a single `%${search}%` across all three expressions, so the whole
       string had to appear contiguously. Searching a customer as
       "Smith John" found nothing, because the CONCAT produces "John Smith". */
    const searchQ = buildSearch(search, {
      /* The order's own ship_* name is searchable too. Without it a guest
         order could only be found by email or order number - the staff
         member looking at "Sam Nazer" on screen could not search for it. */
      columns: ['o.order_number', 'o.guest_email',
                'CONCAT(c.first_name," ",c.last_name)',
                'CONCAT(o.ship_first_name," ",o.ship_last_name)'],
      weights: { 'o.order_number': 5,
                 'CONCAT(c.first_name," ",c.last_name)': 3,
                 'CONCAT(o.ship_first_name," ",o.ship_last_name)': 3,
                 'o.guest_email': 2 },
      exact:   ['o.order_number'],
      prefix:  'o.order_number',
    });
    if (searchQ.active) {
      where += ` AND (${searchQ.sql})`;
      params.push(...searchQ.params);
    }

    const countRow = await safeQueryOne(
      `SELECT COUNT(*) AS total FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ${where}`, params
    );
    const total = countRow ? countRow.total : 0;

    const orders = await safeQuery(
      `SELECT o.id, o.order_number, o.status, o.total, o.created_at, o.shipped_at, o.delivered_at,
              /* ⚠️ PAYMENT STATE, for the bulk-delete warnings.
                 Neither of these was selected before 2026-10-19, so
                 index.ejs rendered data-captured="" on EVERY row and the red
                 "this has a captured payment" banner never once appeared.
                 The template comment beside it even allowed for the
                 possibility — "if the list query does not select
                 payment_captured_at this is simply undefined" — and nobody
                 checked which it was.

                 It failed CLOSED, which is why it went unnoticed: with the
                 flag always false the server refused captured deletions
                 anyway. Fail-closed is why this was a UX bug and not a
                 money bug. An unselected column is undefined, never an
                 error — the same shape as the checkout 409 (cbafe9f) and
                 the NULL payment intent in order_deletions. */
              o.payment_captured_at, o.payment_status,
              COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))),''),
                NULLIF(TRIM(CONCAT(COALESCE(o.ship_first_name,''),' ',COALESCE(o.ship_last_name,''))),''),
                o.guest_email
              ) AS customer_name,
              /* Email verification, for the badge on each row. Read from
                 the CUSTOMER, not the order: proving you own an address
                 is a fact about a person, so a repeat buyer who verified
                 once stays verified. See emailVerificationService.js. */
              c.email_verified_at AS email_verified_at,
              vpo.status AS vpo_status, vpo.sent_at AS vpo_sent_at, vpo.confirmed_at AS vpo_confirmed_at,
              s.status AS ship_status, s.estimated_delivery, s.last_tracking_scan,
              (SELECT COUNT(*) FROM order_returns r WHERE r.order_id = o.id AND r.status NOT IN ('resolved','denied')) AS open_returns,
              ${searchQ.score} AS relevance
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN vendor_purchase_orders vpo ON vpo.order_id = o.id
       LEFT JOIN shipments s ON s.order_id = o.id
       ${where}
       ORDER BY ${searchQ.active ? 'relevance DESC, ' : ''}o.created_at DESC
       LIMIT ? OFFSET ?`,
      // Score params bind first — they sit in the SELECT list.
      [...searchQ.scoreParams, ...params, limit, offset]
    );

    orders.forEach(o => {
      const vpo      = o.vpo_status ? { status: o.vpo_status, sent_at: o.vpo_sent_at, confirmed_at: o.vpo_confirmed_at } : null;
      const shipment = o.ship_status ? { status: o.ship_status, estimated_delivery: o.estimated_delivery, last_tracking_scan: o.last_tracking_scan } : null;
      const openRet  = o.open_returns > 0 ? { status: 'requested', requested_at: new Date() } : null;
      o.rag = computeRag(o, vpo, shipment, openRet);
    });

    const ragCounts = { red: 0, yellow: 0, green: 0 };
    orders.forEach(o => ragCounts[o.rag]++);

    /* ── INVENTORY RISK ───────────────────────────────────────────────
       Which SKUs on open orders need the vendor call from SOP §2, and
       which orders they land on. The rule lives in config/inventoryRisk.js;
       this only fetches what the rule needs.

       ⚠️ ONE AGGREGATE, NOT PER ROW. The list is paginated and a per-order
       lookup would be N+1 against order_items on every page view.

       ⚠️ SCOPE IS ALL OPEN ORDERS, NOT THIS PAGE. The strip exists to say
       "these are the SKUs to work first", which is a question about the
       whole queue. Page 3 of the list must not report a different risk
       picture from page 1. Row badges are then matched by order id. */
    let inventoryRisk = { skus: [], orderIds: new Set(), counts: {}, lastSyncedAt: null, stale: true };
    try {
      const [riskRows] = await bvoPool.query(
        `SELECT
           oi.sku,
           MIN(COALESCE(p.name, oi.name))                AS name,
           SUM(oi.qty)                                   AS demand,
           COUNT(DISTINCT oi.order_id)                   AS order_count,
           GROUP_CONCAT(DISTINCT oi.order_id)            AS order_ids,
           /* One SKU is one product, so these are constant per group.
              MIN() satisfies ONLY_FULL_GROUP_BY without changing meaning. */
           MIN(inv.qty_on_hand)                          AS qty_on_hand,
           MIN(inv.allow_backorder)                      AS allow_backorder,
           MAX(inv.last_synced_at)                       AS last_synced_at,
           /* ⚠️ THE THIRD STATE, carried explicitly rather than inferred
              from a NULL qty downstream. NULL <= 2 is NOT TRUE in SQL,
              (and note: no backticks in this comment - it lives inside a
              template literal, and a backtick here ENDS THE STRING. Same
              shape as the question mark that killed the boot in
              siteEvents.js, caught here by node --check instead.)
              so a SKU with no inventory row would fall OUT of a threshold
              test rather than into it - the page would say nothing is
              wrong about a SKU it knows nothing about. */
           MAX(CASE WHEN inv.product_id IS NULL THEN 1 ELSE 0 END) AS stock_unknown
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         /* ⚠️ RECOVERS ORPHANED LINES. order_items.product_id is
            ON DELETE SET NULL, so deleting a product leaves its order
            lines with a sku and no product_id. Those orders still have to
            be fulfilled. products.sku is UNIQUE, so this is a safe
            second route to the same row - joining on product_id alone
            would silently drop exactly the orders nobody is tracking. */
         LEFT JOIN products  p   ON p.sku = oi.sku
         LEFT JOIN inventory inv ON inv.product_id = COALESCE(oi.product_id, p.id)
         WHERE ${REV_BASE}
           AND o.status IN (${INV.OPEN_DEMAND_STATUSES.map(() => '?').join(',')})
         GROUP BY oi.sku`,
        INV.OPEN_DEMAND_STATUSES
      );

      const skus = riskRows
        .map(r => ({ ...r, severity: INV.classify(r) }))
        .filter(r => INV.isActionable(r.severity))
        .sort((a, b) => INV.ACTIONABLE.indexOf(a.severity) - INV.ACTIONABLE.indexOf(b.severity)
                     || Number(b.demand) - Number(a.demand));

      const orderIds = new Set();
      skus.forEach(r => String(r.order_ids || '').split(',')
        .forEach(id => { if (id) orderIds.add(Number(id)); }));

      const counts = {};
      skus.forEach(r => { counts[r.severity] = (counts[r.severity] || 0) + 1; });

      /* Newest sync across every row, including the healthy ones - the
         question "is the feed running" is not about the at-risk subset. */
      const newest = riskRows.reduce((acc, r) =>
        (r.last_synced_at && (!acc || new Date(r.last_synced_at) > new Date(acc))) ? r.last_synced_at : acc, null);

      inventoryRisk = { skus, orderIds, counts, lastSyncedAt: newest, stale: INV.isStale(newest) };
    } catch (err) {
      /* ⚠️ FAILS SOFT, like siteEvents. This is a prioritisation aid bolted
         onto the page staff use to work orders. A bad join here must not
         take the orders list down with it; the absence of the strip is a
         far smaller harm than an unusable dashboard. Logged so it is not
         silent. */
      console.error('[orders/list] inventory risk query failed (ignored):', err && err.message);
    }

    orders.forEach(o => { o.inventoryRisk = inventoryRisk.orderIds.has(Number(o.id)); });

    res.render('pages/admin/orders/index', {
      /* The delete-reason dropdown is rendered from the shared config rather
         than hand-typed into the template, so the options, the server-side
         validation and the gate can never disagree. */
      ORDER_DELETE_REASONS,
      MIN_DELETE_NOTE,
      ...LAYOUT,
      activePage: 'orders',
      pageTitle:  'Orders',
      flash:      null,
      ORDER_STATUSES,      // labels + hover definitions
      orders,
      total,
      page,
      pages:    Math.ceil(total / limit),
      limit,
      status,
      search,
      ragCounts,
      /* The at-risk SKUs, the order ids they touch, and how old the
         snapshot is. INV goes with it so the view renders labels from the
         rule rather than hard-coding a fourth severity. */
      inventoryRisk,
      INV,
    });
  } catch (err) { next(err); }
};

/* ═══════════════════════════════════════════════════════════════
   ORDER DETAIL
   ═══════════════════════════════════════════════════════════════ */
exports.detail = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const [[order]] = await bvoPool.query(
      `SELECT o.*,
              COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))),''),
                NULLIF(TRIM(CONCAT(COALESCE(o.ship_first_name,''),' ',COALESCE(o.ship_last_name,''))),''),
                o.guest_email
              ) AS customer_name,
              c.email AS customer_email, c.phone AS customer_phone,
              /* Verified state AND how it was proven. 'code' is the
                 stronger evidence — twenty minutes, one shot, typed by a
                 human — where 'order_link' is a seven-day link in a
                 mailbox that gets forwarded. The rep should see which
                 before the verification call. */
              c.email_verified_at, c.email_verified_method
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id = ?`, [id]
    );
    if (!order) return res.status(404).render('pages/error', { pageTitle: '404', message: 'Order not found.' });

    const [items]   = await bvoPool.query(
      `SELECT oi.*, p.slug AS product_slug,
              (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) AS thumb
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`, [id]
    );
    const [[vendorPo]] = await bvoPool.query(
      'SELECT * FROM vendor_purchase_orders WHERE order_id = ? LIMIT 1', [id]
    );
    const [[shipment]] = await bvoPool.query(
      'SELECT * FROM shipments WHERE order_id = ? LIMIT 1', [id]
    );
    const [returns] = await bvoPool.query(
      'SELECT * FROM order_returns WHERE order_id = ? ORDER BY requested_at DESC', [id]
    );
    const [events] = await bvoPool.query(
      'SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC', [id]
    );
    const [documents] = await bvoPool.query(
      'SELECT * FROM order_documents WHERE order_id = ? ORDER BY created_at DESC', [id]
    );

    /* ── ADDRESS HISTORY (items 6/9) ─────────────────────────────────
       Context for the verification call that already happens before
       capture — NOT a gate, NOT a score.

       ⛔ ADVISORY ONLY. This must never block the Capture button. That
       is item 4, a separate mechanism with a separate decision. The
       moment an advisory flag starts blocking money, someone starts
       suppressing it.

       Owner, 2026-09-28: "this is just an internal flag that someone
       needs to look at and have awareness of before the verification of
       order call that we do — so we can ask the right questions."

       NO TRADE EXEMPTION, deliberately. Fraudsters open trade accounts
       too, and exempting trade creates exactly the gap one would aim
       for. A contractor shipping to many jobsites is a false positive
       that costs nothing: the call happens anyway and the answer takes
       five seconds.

       Orders placed before the identity gate have a NULL customer_id
       and simply get an empty history — not an error. */
    const addressHistory = order.customer_id
      ? await CustomerAddress.velocity(order.customer_id, 90)
      : { shipping: [], billing: [] };

    const openReturn = returns.find(r => !['resolved','denied'].includes(r.status)) || null;
    const rag = computeRag(order, vendorPo, shipment, openReturn);

    res.render('pages/admin/orders/detail', {
      ...LAYOUT,
      activePage: 'orders',
      pageTitle:  `Order ${order.order_number}`,
      ORDER_STATUSES,      // labels + hover definitions
      /* ⚠️ The delete dialog on this page needs these and never had them.
         orderDeleteReasons.js documents three consumers — the list page,
         this controller's validation, and the gate — and the DETAIL page
         was never one. That is why its delete button posted no reason_code
         and 400'd on every attempt from 2026-10-14 to 2026-10-19, while
         all eleven recorded deletions came through the bulk endpoint.
         Passing the config rather than hardcoding codes in the template
         keeps the one-source rule intact. */
      ORDER_DELETE_REASONS,
      MIN_DELETE_NOTE,
      order,
      items,
      vendorPo:   vendorPo || null,
      shipment:   shipment || null,
      returns,
      events,
      documents,
      rag,
      /* Facts, not a verdict. The view shows the addresses and dates so
         the rep can ask a good question; a red "FRAUD RISK" badge would
         train everyone to ignore it. */
      addressHistory,
      wwexMode:   wwex.apiMode,
      /* Maps Embed key for the delivery panel. Client-side visible by
         design — it ships in the iframe URL and anyone can read it. The
         HTTP referrer restriction is what makes that safe, not secrecy.
         See BVO_PAYMENT_RISK_AND_CHECKOUT_SCOPE.md §5A.6.

         Empty string rather than undefined so the template can test it
         plainly; an unset key renders the panel's fallback instead of an
         iframe pointing at `key=undefined`. */
      mapsKey:    process.env.GOOGLE_MAPS_API_KEY || '',

      /* ── outreach flash messages (2026-10-19) ───────────────────────
         Set by customerOutreachController on redirect: rr_* from Resend
         receipt, ce_* from Correct email. Read off the query string
         rather than a session flash because there is no flash mechanism
         in this app and adding one for two banners would be new
         infrastructure nobody else uses.

         Defaulted to '' so the template can test them plainly, and
         ESCAPED at render (<%= %>, never <%- %>) — the strings carry
         Brevo's own error text and an email address the operator typed,
         and the second of those is attacker-controllable in principle. */
      rrOk:  req.query.rr_ok  || '',
      rrErr: req.query.rr_err || '',
      ceOk:  req.query.ce_ok  || '',
      ceErr: req.query.ce_err || '',
    });
  } catch (err) { next(err); }
};

/* ═══════════════════════════════════════════════════════════════
   UPDATE ORDER STATUS
   ═══════════════════════════════════════════════════════════════ */
exports.updateStatus = async (req, res) => {
  const conn = await bvoPool.getConnection();
  try {
    const id     = parseInt(req.params.id);
    const { status, notes } = req.body;
    // Was a duplicated inline array; now shares src/config/orderStatuses.js
    // with the list filter, the badges and the detail dropdown.
    if (!VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, error: 'Invalid status' });
    }

    const [[order]] = await conn.query('SELECT status FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ ok: false, error: 'Not found' });

    await conn.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    await logEvent(conn, id, 'status_change', order.status, status, req.session?.adminUser || 'admin', notes || null);

    return res.json({ ok: true });
  } catch (err) {
    console.error('[ordersController.updateStatus]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  } finally {
    conn.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   SEND VENDOR ORDER (JM email)
   ═══════════════════════════════════════════════════════════════ */
exports.sendVendorOrder = async (req, res) => {
  const conn = await bvoPool.getConnection();
  try {
    const id = parseInt(req.params.id);

    const [[order]] = await conn.query(
      `SELECT o.*, COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))),''),
                NULLIF(TRIM(CONCAT(COALESCE(o.ship_first_name,''),' ',COALESCE(o.ship_last_name,''))),''),
                o.guest_email
              ) AS customer_name
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`, [id]
    );
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

    const [items] = await conn.query(
      'SELECT oi.sku, oi.name, oi.qty FROM order_items oi WHERE oi.order_id = ?', [id]
    );

    // Build PO email body
    const poLines = items.map(i => `  • ${i.sku}  ×${i.qty}  — ${i.name}`).join('\n');
    const shipTo  = [
      order.ship_first_name + ' ' + order.ship_last_name,
      order.ship_address1,
      order.ship_address2 || '',
      `${order.ship_city}, ${order.ship_state} ${order.ship_zip}`,
    ].filter(Boolean).join('\n  ');

    const htmlBody = `
<p>Hello JM Order Support,</p>
<p>Please process the following purchase order for drop-ship to our customer:</p>
<p><strong>BVO Order #:</strong> ${order.order_number}<br>
<strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p>
<h3 style="margin-bottom:4px">Items Ordered</h3>
<pre style="background:#f5f5f5;padding:12px;border-radius:4px;font-size:14px">${poLines}</pre>
<h3 style="margin-bottom:4px">Ship To</h3>
<pre style="background:#f5f5f5;padding:12px;border-radius:4px;font-size:14px">  ${shipTo}</pre>
<p>Please confirm receipt of this order and provide an estimated ship date at your earliest convenience.
Reply to this email with your confirmation number.</p>
<p>Thank you,<br>BVO — Bathroom Vanities Outlet</p>`;

    const jmEmail = process.env.JM_ORDER_EMAIL || 'JMOrderSupport@jamesmartin.com';
    await brevo.sendRaw(jmEmail, `Purchase Order — BVO #${order.order_number}`, htmlBody, 'JM Order Support');

    // Upsert vendor_purchase_orders row
    const [[existing]] = await conn.query('SELECT id FROM vendor_purchase_orders WHERE order_id = ?', [id]);
    const poNumber = `BVO-PO-${order.order_number}`;
    if (existing) {
      await conn.query(
        `UPDATE vendor_purchase_orders SET status='sent', po_number=?, sent_at=NOW(), confirmation_number=NULL, confirmed_at=NULL
         WHERE order_id=?`, [poNumber, id]
      );
    } else {
      await conn.query(
        `INSERT INTO vendor_purchase_orders (order_id, vendor, status, po_number, sent_at)
         VALUES (?, 'james_martin', 'sent', ?, NOW())`, [id, poNumber]
      );
    }

    await logEvent(conn, id, 'vendor_po_sent', null, null, req.session?.adminUser || 'admin',
      `PO emailed to ${jmEmail} — PO# ${poNumber}`);

    // Trigger customer email: "vanity in preparation"
    const customerEmail = order.customer_email || order.guest_email;
    if (customerEmail) {
      const firstItem = items[0];
      await brevo.sendTemplate('vanity_in_preparation', customerEmail, {
        customer_first_name: (order.customer_name || '').split(' ')[0] || 'there',
        product_name:        firstItem?.name || 'your vanity',
        transit_days:        '5–7',
      });
    }

    return res.json({ ok: true, message: `PO sent to ${jmEmail}` });
  } catch (err) {
    console.error('[ordersController.sendVendorOrder]', err);
    return res.status(500).json({ ok: false, error: 'Failed to send vendor order' });
  } finally {
    conn.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   CONFIRM VENDOR ORDER (manual — until inbox scanning is built)
   ═══════════════════════════════════════════════════════════════ */
exports.confirmVendorOrder = async (req, res) => {
  const conn = await bvoPool.getConnection();
  try {
    const id = parseInt(req.params.id);
    const { confirmation_number, expected_ship_date } = req.body;

    await conn.query(
      `UPDATE vendor_purchase_orders
       SET status='confirmed', confirmation_number=?, confirmed_at=NOW(), expected_ship_date=?
       WHERE order_id=?`,
      [confirmation_number || null, expected_ship_date || null, id]
    );
    await logEvent(conn, id, 'vendor_confirmed', 'sent', 'confirmed',
      req.session?.adminUser || 'admin',
      `Confirmation# ${confirmation_number}${expected_ship_date ? ' · Est ship ' + expected_ship_date : ''}`
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('[ordersController.confirmVendorOrder]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  } finally {
    conn.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET SHIPPING QUOTES (WWEX)
   ═══════════════════════════════════════════════════════════════ */
exports.getShippingQuotes = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [[order]] = await bvoPool.query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

    const [items] = await bvoPool.query(
      `SELECT oi.qty, p.weight_lbs, p.width_in, p.depth_in, p.height_in
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`, [id]
    );

    const payload = {
      originZip:   process.env.WAREHOUSE_ZIP || '28201',
      destZip:     order.ship_zip,
      destCity:    order.ship_city,
      destState:   order.ship_state,
      residential: req.body.residential !== 'false',
      liftgate:    req.body.liftgate    !== 'false',
      appointment: req.body.appointment === 'true',
      items: items.map(i => ({
        weight:       (i.weight_lbs || 50) * i.qty,
        length:       i.depth_in   || 30,
        width:        i.width_in   || 24,
        height:       i.height_in  || 36,
        freightClass: 85,
      })),
    };

    const result = await wwex.getRates(payload);
    return res.json(result);
  } catch (err) {
    console.error('[ordersController.getShippingQuotes]', err);
    return res.status(500).json({ ok: false, error: 'Could not fetch rates' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   BOOK SHIPMENT (WWEX)
   ═══════════════════════════════════════════════════════════════ */
exports.bookShipment = async (req, res) => {
  const conn = await bvoPool.getConnection();
  try {
    const id = parseInt(req.params.id);
    const { rate_id, carrier, service_level, ship_type, rate_amount, estimated_delivery } = req.body;

    const [[order]] = await conn.query(
      `SELECT o.*, COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))),''),
                NULLIF(TRIM(CONCAT(COALESCE(o.ship_first_name,''),' ',COALESCE(o.ship_last_name,''))),''),
                o.guest_email
              ) AS customer_name,
              c.email AS customer_email
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`, [id]
    );
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

    const booking = await wwex.bookShipment(rate_id, {
      orderId:      order.order_number,
      destName:     order.ship_first_name + ' ' + order.ship_last_name,
      destAddress1: order.ship_address1,
      destAddress2: order.ship_address2 || '',
      destCity:     order.ship_city,
      destState:    order.ship_state,
      destZip:      order.ship_zip,
    });

    if (!booking.ok) return res.status(500).json({ ok: false, error: booking.error });

    // Upsert shipment record
    const [[existingShip]] = await conn.query('SELECT id FROM shipments WHERE order_id = ?', [id]);
    if (existingShip) {
      await conn.query(
        `UPDATE shipments SET wwex_shipment_id=?, ship_type=?, carrier=?, service_level=?, tracking_number=?,
         bol_number=?, bol_url=?, rate_quoted=?, rate_charged=?, status='booked', estimated_delivery=?, shipped_at=NOW()
         WHERE order_id=?`,
        [booking.shipmentId, ship_type, carrier, service_level, booking.trackingNumber,
         booking.bolNumber, booking.bolUrl, rate_amount, rate_amount, estimated_delivery || null, id]
      );
    } else {
      await conn.query(
        `INSERT INTO shipments (order_id, wwex_shipment_id, ship_type, carrier, service_level, tracking_number,
         bol_number, bol_url, rate_quoted, rate_charged, status, estimated_delivery, shipped_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'booked', ?, NOW())`,
        [id, booking.shipmentId, ship_type, carrier, service_level, booking.trackingNumber,
         booking.bolNumber, booking.bolUrl, rate_amount, rate_amount, estimated_delivery || null]
      );
    }

    // Update order shipping fields
    await conn.query(
      `UPDATE orders SET tracking_number=?, carrier=?, shipped_at=NOW(), status='shipped' WHERE id=?`,
      [booking.trackingNumber, carrier, id]
    );
    await logEvent(conn, id, 'shipment_booked', 'processing', 'shipped',
      req.session?.adminUser || 'admin',
      `${carrier} · Tracking: ${booking.trackingNumber} · BOL: ${booking.bolNumber}`
    );

    // Fire shipped email to customer
    const customerEmail = order.customer_email || order.guest_email;
    if (customerEmail) {
      const [[firstItem]] = await conn.query(
        'SELECT name FROM order_items WHERE order_id = ? LIMIT 1', [id]
      );
      await brevo.sendTemplate('order_shipped', customerEmail, {
        customer_first_name: (order.customer_name || '').split(' ')[0] || 'there',
        product_name:        firstItem?.name || 'your vanity',
        tracking_url:        `https://wwex.com/track/${booking.trackingNumber}`,
        carrier,
        estimated_delivery:  estimated_delivery || 'within 5–7 business days',
      });
    }

    return res.json({ ok: true, tracking_number: booking.trackingNumber, bol_number: booking.bolNumber, stub: booking.stub || false });
  } catch (err) {
    console.error('[ordersController.bookShipment]', err);
    return res.status(500).json({ ok: false, error: 'Booking failed' });
  } finally {
    conn.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   ADD ADMIN NOTE
   ═══════════════════════════════════════════════════════════════ */
exports.addNote = async (req, res) => {
  try {
    const id    = parseInt(req.params.id);
    const { notes } = req.body;
    if (!notes?.trim()) return res.status(400).json({ ok: false, error: 'Note is empty' });
    await bvoPool.query(
      `INSERT INTO order_events (order_id, event_type, actor, notes) VALUES (?, 'note_added', ?, ?)`,
      [id, req.session?.adminUser || 'admin', notes.trim()]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('[ordersController.addNote]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   CAPTURE PAYMENT — take the funds held at checkout
   ───────────────────────────────────────────────────────────────
   Step 3 of the order lifecycle. Staff have verified the buyer, the
   delivery access and the stock; this collects the money, and the vendor
   PO follows. See docs/briefs/BVO_COMMERCE_STACK_BRIEF.md §2.

   Captures the FULL authorised amount. Stripe allows exactly one capture
   per authorisation and a partial capture permanently releases the
   remainder — there is no topping up afterwards. Until the admin has a
   deliberate partial-capture workflow, full is the only safe default.
   ═══════════════════════════════════════════════════════════════ */
exports.capturePayment = async (req, res) => {
  const conn = await bvoPool.getConnection();
  try {
    const id = parseInt(req.params.id);
    const [[order]] = await conn.query(
      'SELECT id, total, payment_transaction_id, payment_status FROM orders WHERE id = ?', [id]
    );
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
    if (order.payment_status !== 'auth_only') {
      return res.status(400).json({ ok: false, error: `Payment status is '${order.payment_status}' — can only capture 'auth_only' transactions` });
    }
    if (!order.payment_transaction_id) {
      return res.status(400).json({ ok: false, error: 'No PaymentIntent on record' });
    }

    /* Full capture — amount omitted deliberately, see the note above. */
    const result = await stripePay.capturePayment(order.payment_transaction_id);

    if (!result.ok) {
      /* An expired authorisation is terminal, not transient. Retrying
         will never work, so say what actually has to happen instead of
         showing a generic gateway error. */
      if (result.expired) {
        await conn.query(
          `UPDATE orders SET payment_status = 'canceled' WHERE id = ? AND payment_status = 'auth_only'`,
          [id]
        );
        await logEvent(conn, id, 'payment_auth_expired', 'auth_only', 'canceled',
          req.session?.adminUser || 'admin',
          `Authorization lapsed before capture — ${order.payment_transaction_id}`);
        return res.status(409).json({
          ok: false,
          error: 'This authorization has expired and can no longer be captured. '
               + 'Contact the customer to take payment again.',
        });
      }
      return res.status(502).json({ ok: false, error: result.error });
    }

    await conn.query(
      `UPDATE orders SET payment_status = 'captured', payment_captured_at = NOW() WHERE id = ?`,
      [id]
    );
    await logEvent(conn, id, 'payment_captured', 'auth_only', 'captured',
      req.session?.adminUser || 'admin',
      `Captured $${result.amountCaptured} — ${order.payment_transaction_id}`
    );

    return res.json({ ok: true, message: `$${result.amountCaptured} captured successfully` });
  } catch (err) {
    console.error('[ordersController.capturePayment]', err);
    return res.status(500).json({ ok: false, error: 'Server error during capture' });
  } finally {
    conn.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   CANCEL AUTHORIZATION — release the hold without charging
   ───────────────────────────────────────────────────────────────
   For an order rejected during Step 2 validation: the buyer could not be
   verified, the address is undeliverable, or the stock is gone.

   THIS IS NOT A REFUND. Before capture no charge exists, so there is
   nothing to refund — Stripe's refund API would reject it. Cancelling
   the PaymentIntent releases the hold and the money never leaves the
   customer's account. Refund only applies after capture.
   ═══════════════════════════════════════════════════════════════ */
exports.cancelAuthorization = async (req, res) => {
  const conn = await bvoPool.getConnection();
  try {
    const id     = parseInt(req.params.id);
    const reason = (req.body?.reason || '').toString().trim();

    const [[order]] = await conn.query(
      'SELECT id, payment_transaction_id, payment_status FROM orders WHERE id = ?', [id]
    );
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

    if (order.payment_status === 'captured') {
      /* Guard rather than silently doing the wrong thing. A captured
         payment needs a refund, partial refund or write-off decision —
         which is a different screen and a different permission. */
      return res.status(400).json({
        ok: false,
        error: 'Payment has already been captured. Use refund, partial refund or write-off instead.',
      });
    }
    if (order.payment_status !== 'auth_only') {
      return res.status(400).json({ ok: false, error: `Payment status is '${order.payment_status}' — nothing to release` });
    }

    const result = await stripePay.cancelAuthorization(order.payment_transaction_id);
    if (!result.ok) return res.status(502).json({ ok: false, error: result.error });

    await conn.query(
      `UPDATE orders SET payment_status = 'canceled', status = 'cancelled' WHERE id = ?`,
      [id]
    );
    await logEvent(conn, id, 'payment_canceled', 'auth_only', 'canceled',
      req.session?.adminUser || 'admin',
      reason ? `Authorization released — ${reason}` : 'Authorization released'
    );

    return res.json({ ok: true, message: 'Authorization released. The customer was not charged.' });
  } catch (err) {
    console.error('[ordersController.cancelAuthorization]', err);
    return res.status(500).json({ ok: false, error: 'Server error during cancellation' });
  } finally {
    conn.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   UPLOAD DOCUMENT
   ═══════════════════════════════════════════════════════════════ */
exports.uploadDocument = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
    const docType = req.body.doc_type || 'other';
    const label   = req.body.label || req.file.originalname;
    const fileUrl = `/images/uploads/order-docs/${req.file.filename}`;
    await bvoPool.query(
      `INSERT INTO order_documents (order_id, doc_type, label, file_url, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [id, docType, label, fileUrl, req.session?.adminUser || 'admin']
    );
    return res.json({ ok: true, file_url: fileUrl });
  } catch (err) {
    console.error('[ordersController.uploadDocument]', err);
    return res.status(500).json({ ok: false, error: 'Upload failed' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   SHIPMENTS TRACKER VIEW
   ═══════════════════════════════════════════════════════════════ */
exports.shipmentsView = async (req, res, next) => {
  try {
    const shipments = await safeQuery(
      `SELECT s.*, o.order_number, o.id AS order_id,
              COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))),''),
                NULLIF(TRIM(CONCAT(COALESCE(o.ship_first_name,''),' ',COALESCE(o.ship_last_name,''))),''),
                o.guest_email
              ) AS customer_name
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE s.status NOT IN ('delivered','cancelled')
       ORDER BY s.shipped_at DESC`
    );

    // Compute RAG per shipment
    const now = Date.now();
    shipments.forEach(s => {
      if (s.status === 'exception') { s.rag = 'red'; return; }
      if (s.estimated_delivery && now > new Date(s.estimated_delivery).getTime() + 3*24*36e5) { s.rag = 'red'; return; }
      if (s.last_tracking_scan && (now - new Date(s.last_tracking_scan).getTime()) > 3*24*36e5) { s.rag = 'red'; return; }
      if (s.estimated_delivery && now > new Date(s.estimated_delivery).getTime() + 1*24*36e5) { s.rag = 'yellow'; return; }
      s.rag = 'green';
    });

    res.render('pages/admin/orders/shipments', {
      ...LAYOUT,
      activePage: 'orders',
      pageTitle:  'Shipments Tracker',
      flash:      null,
      shipments,
    });
  } catch (err) { next(err); }
};

/* ═══════════════════════════════════════════════════════════════
   KPI REPORTS VIEW
   ═══════════════════════════════════════════════════════════════ */
exports.reportsView = async (req, res, next) => {
  try {
    const period = req.query.period || '30';
    const days   = parseInt(period) || 30;

    /* ⚠️ THIS QUERY HAD NO FILTER AT ALL — not even is_test. Every
       abandoned checkout (status='pending', payment_status='pending') was
       counted as an order and summed into revenue, alongside test rows.

       Two groups of numbers live here and they do NOT share a population:

         MONEY AND UNITS — total_orders, total_revenue, avg_order_value.
         Capture-gated per the owner's rule: nothing counts until the
         authorization is captured.

         OPERATIONAL COUNTS — cancelled, delivered, refunded, time-to-ship.
         These describe what happened to orders, and a cancelled order is
         BY DEFINITION never captured. Gating them the same way would make
         every one of them zero, which is why they are counted over the
         non-test set instead of over IS_COUNTED.

       Both are computed in one pass so they cannot be read from different
       snapshots of the table. */
    const kpis = await safeQueryOne(
      `SELECT
         COUNT(CASE WHEN ${COUNTED} THEN 1 END)                      AS total_orders,
         COALESCE(SUM(CASE WHEN ${COUNTED} THEN total END),0)        AS total_revenue,
         COALESCE(AVG(CASE WHEN ${COUNTED} THEN total END),0)        AS avg_order_value,
         /* Money authorized and not yet captured. Reported beside revenue,
            never inside it. */
         COALESCE(SUM(CASE WHEN ${AUTHORIZED} THEN total END),0)     AS awaiting_capture,
         COUNT(CASE WHEN status='cancelled' THEN 1 END)              AS cancelled_orders,
         COUNT(CASE WHEN status='delivered' THEN 1 END)              AS delivered_orders,
         COUNT(CASE WHEN status='refunded'  THEN 1 END)              AS refunded_orders,
         AVG(CASE WHEN shipped_at IS NOT NULL
             THEN TIMESTAMPDIFF(HOUR, created_at, shipped_at) END)  AS avg_hours_to_ship
       FROM orders
       WHERE is_test = 0
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`, [days]
    ) || {};

    const returnStats = await safeQueryOne(
      `SELECT
         COUNT(*)                                                              AS total_returns,
         COUNT(CASE WHEN resolution='full_refund'    THEN 1 END)              AS full_refunds,
         COUNT(CASE WHEN resolution='partial_refund' THEN 1 END)              AS partial_refunds,
         COUNT(CASE WHEN resolution='replacement'    THEN 1 END)              AS replacements,
         COALESCE(SUM(refund_amount),0)                                        AS total_refunded,
         AVG(CASE WHEN resolved_at IS NOT NULL
             THEN TIMESTAMPDIFF(HOUR, requested_at, resolved_at) END)         AS avg_hours_to_resolve
       FROM order_returns
       WHERE requested_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`, [days]
    ) || {};

    /* Capture-gated like the KPI strip above, so the chart and the
       headline numbers cannot tell different stories. A day on which three
       checkouts were attempted and none captured now reads as zero, which
       is what happened. */
    const revenueByDay = await safeQuery(
      `SELECT DATE(created_at) AS day, COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
       FROM orders
       WHERE ${COUNTED}
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(created_at) ORDER BY day ASC`, [days]
    );

    const vendorKpis = await safeQueryOne(
      `SELECT
         COUNT(*)                                                              AS pos_sent,
         COUNT(CASE WHEN status='confirmed' THEN 1 END)                       AS pos_confirmed,
         AVG(CASE WHEN confirmed_at IS NOT NULL
             THEN TIMESTAMPDIFF(HOUR, sent_at, confirmed_at) END)             AS avg_confirm_hours
       FROM vendor_purchase_orders
       WHERE sent_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`, [days]
    ) || {};

    const returnsByReason = await safeQuery(
      `SELECT reason, COUNT(*) AS cnt FROM order_returns
       WHERE requested_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY reason`, [days]
    );

    res.render('pages/admin/orders/reports', {
      ...LAYOUT,
      activePage:     'orders',
      pageTitle:      'Operations Reports',
      flash:          null,
      period,
      kpis,
      returnStats,
      revenueByDay:   JSON.stringify(revenueByDay),
      vendorKpis,
      returnsByReason,
    });
  } catch (err) { next(err); }
};

/* ═══════════════════════════════════════════════════════════════
   DELETE — hard, audited, and refuses captured payments
   ═══════════════════════════════════════════════════════════════

   WHY HARD AND NOT A FLAG. `orders` is read in roughly thirty places across
   ten files. A deleted_at flag would need filtering in every one, and one
   missed filter means a deleted order keeps counting toward a revenue KPI —
   silently, and differently depending on which screen you look at. A DELETE
   is consistent everywhere the instant it runs.

   WHAT PROTECTS YOU INSTEAD:
     1. order_deletions keeps a JSON snapshot of the row. Nothing reads it at
        runtime, so it adds no filter surface, but "what was that order" has
        an answer afterwards.
     2. An order with payment_captured_at set is REFUSED unless the caller
        passes confirm_captured. Money taken is the line where a mis-click
        stops being recoverable, so it takes a second, deliberate act.
     3. Everything runs in one transaction. A half-deleted order — row gone,
        shipment orphaned — is worse than either outcome. */

/* Children of an order, in delete order. Only order_items has ON DELETE
   CASCADE (fk_item_order); the other four carry a nullable order_id with an
   index and no constraint, so nothing removes them for us. Left alone they
   become rows pointing at an id that no longer exists, which is how a
   shipments screen ends up showing a blank customer forever.

   sample_redemptions is deleted rather than orphaned on purpose: it exists to
   enforce one free sample per email and address, and a redemption still
   blocking a customer after its order is gone is a support ticket nobody can
   explain. */
const ORDER_CHILD_TABLES = ['order_events', 'shipments', 'returns', 'sample_redemptions'];

async function countOrderChildren(conn, id) {
  const counts = {};
  const [[items]] = await conn.query('SELECT COUNT(*) AS n FROM order_items WHERE order_id = ?', [id]);
  counts.order_items = items.n;
  for (const t of ORDER_CHILD_TABLES) {
    try {
      const [[r]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\` WHERE order_id = ?`, [id]);
      counts[t] = r.n;
    } catch (err) {
      /* A table that does not exist on this environment is not an error —
         sample_redemptions post-dates some installs. A table that exists but
         fails for another reason still is. */
      if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
      counts[t] = null;
    }
  }
  return counts;
}

/* Deletes ONE order inside a caller-supplied transaction. Returns a result
   object rather than throwing on a refusal, because the bulk path needs to
   skip one order and carry on rather than abort the batch. */
async function deleteOneOrder(conn, id, { actor, reason, confirmCaptured, releaseAuth }) {
  const [[order]] = await conn.query('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) return { id, ok: false, skipped: 'not_found' };

  if (order.payment_captured_at && !confirmCaptured) {
    return {
      id, ok: false, skipped: 'payment_captured',
      orderNumber: order.order_number,
      capturedAt:  order.payment_captured_at,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     AN UNCAPTURED AUTHORIZATION MUST BE RELEASED BEFORE THE ROW GOES
     ═══════════════════════════════════════════════════════════════════
     Until 2026-10-19 this case had no guard at all. Deleting an auth_only
     order left the hold sitting on the customer's card and removed the
     only local record pointing at it — the money is real, the explanation
     is gone, and nobody finds out until the customer calls.

     On 2026-10-14 exactly that happened to ten orders. It cost nothing:
     they were sandbox transactions, and Stripe auto-cancels an uncaptured
     PaymentIntent 7 days after creation, which had already passed. The
     code cannot tell test from live, so that was luck, not safety.

     NOT THE SAME AS CAPTURED. Before capture there is no charge: cancelling
     the PaymentIntent releases the hold, costs no fee, and the customer is
     never out of pocket. After capture, money has moved and only a refund
     reverses it — a different decision, a different screen, and deliberately
     NOT something a delete dialog performs. That case keeps its existing
     confirm-and-warn behaviour above.

     ⚠️ ORDER OF OPERATIONS IS THE WHOLE POINT. Release FIRST, and refuse
     to delete if the release fails. The reverse — delete, then try to
     release — is unrecoverable: on failure the hold is live and the row
     that named it is gone.

     ⚠️ A STRIPE CALL INSIDE A DB TRANSACTION, knowingly. It holds a row
     lock across a network round trip, which is not free. The alternative
     is worse: if the transaction later rolls back, a release that already
     happened leaves an order marked auth_only whose hold is actually gone
     — visible, reversible, and fixable from the Stripe dashboard. The
     opposite mistake is not fixable, because the order id is gone. */
  const authPi     = order.payment_transaction_id || null;
  const holdsAuth  = order.payment_status === 'auth_only' && !!authPi;
  let   authReleased  = null;
  let   authReleaseNote = null;

  if (holdsAuth && !releaseAuth) {
    /* Refuse and SAY WHAT IS AT STAKE. The bulk path turns this into a
       skip line rather than aborting the batch. */
    return {
      id, ok: false, skipped: 'authorization_pending',
      orderNumber: order.order_number,
      amount:      order.total ?? null,
      paymentIntent: authPi,
    };
  }

  if (holdsAuth && releaseAuth) {
    const rel = await stripePay.cancelAuthorization(authPi);
    if (!rel.ok) {
      /* DO NOT DELETE. A failed release with the row removed is the exact
         outcome this guard exists to prevent. */
      return {
        id, ok: false, skipped: 'release_failed',
        orderNumber: order.order_number,
        paymentIntent: authPi,
        error: rel.error,
      };
    }
    authReleased    = 1;
    authReleaseNote = `Released ${authPi} before deletion`;
  }

  const counts = await countOrderChildren(conn, id);

  /* Snapshot BEFORE anything is removed. */
  await conn.query(
    `INSERT INTO order_deletions
       (order_id, order_number, order_total, order_status, payment_captured_at,
        payment_status, auth_released, auth_release_note,
        stripe_payment_intent, order_snapshot, child_counts, deleted_by, deleted_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      order.id,
      order.order_number,
      order.total ?? null,
      order.status ?? null,
      order.payment_captured_at ?? null,
      order.payment_status ?? null,
      authReleased,
      authReleaseNote,
      /* ⚠️ payment_transaction_id — THE COLUMN THAT ACTUALLY EXISTS.
         This line read `order.stripe_payment_intent_id ?? order.stripe_payment_intent`
         from 2026-10-14 until 2026-10-19. The orders table has neither, so
         it evaluated to undefined → NULL on every row, silently: an
         unselected or misspelled column is undefined in mysql2, never an
         error. All eleven deletions recorded NULL here while their JSON
         snapshots held the real pi_… ids all along.

         Same shape as the checkout 409 (cbafe9f): new code reading a name
         the schema never had. gate_order_delete now checks every column
         read off the order row against the schema dump, which is the only
         version of this check that generalises. */
      order.payment_transaction_id ?? null,
      JSON.stringify(order),
      JSON.stringify(counts),
      actor || 'admin',
      reason || null,
    ]
  );

  for (const t of ORDER_CHILD_TABLES) {
    if (counts[t] === null) continue;          // table absent here
    await conn.query(`DELETE FROM \`${t}\` WHERE order_id = ?`, [id]);
  }
  /* order_items goes with the parent via fk_item_order ON DELETE CASCADE. */
  await conn.query('DELETE FROM orders WHERE id = ?', [id]);

  return { id, ok: true, orderNumber: order.order_number, counts,
           authReleased: authReleased === 1 };
}

/* The deletion reason is REQUIRED, and required HERE as well as in the browser.
   A rule enforced only in the UI is a suggestion: anything posting straight at
   the endpoint would otherwise land a placeholder in the audit column, which is
   that column's whole reason for existing.

   The request carries a CODE from the dropdown plus an optional note; the
   stored string is composed from the shared config, so an unknown code is
   rejected rather than written through. */
function readDeleteReason(req) {
  const b = req.body || {};
  return composeDeleteReason(b.reason_code, b.reason_note);
}

/* POST /admin/orders/:id/delete */
exports.deleteOrder = async (req, res) => {
  const conn = await bvoPool.getConnection();
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ ok: false, error: 'Invalid order id' });
    }

    const reason = readDeleteReason(req);
    if (!reason) {
      return res.status(400).json({ ok: false,
        error: 'Pick a deletion reason. "Other" needs a note of at least 5 characters.' });
    }

    await conn.beginTransaction();
    const r = await deleteOneOrder(conn, id, {
      actor:           req.session?.adminUser || 'admin',
      reason,
      confirmCaptured: !!(req.body && req.body.confirm_captured),
      releaseAuth:     !!(req.body && req.body.release_auth),
    });

    if (!r.ok) {
      await conn.rollback();
      if (r.skipped === 'not_found') return res.status(404).json({ ok: false, error: 'Not found' });

      /* An uncaptured hold. The browser asks once and re-sends with
         release_auth; the amount is quoted so the operator is confirming a
         number, not a word. */
      if (r.skipped === 'authorization_pending') {
        return res.status(409).json({
          ok: false,
          requiresRelease: true,
          amount: r.amount,
          error: `${r.orderNumber} is holding an uncaptured authorization` +
                 (r.amount ? ` of $${Number(r.amount).toFixed(2)}` : '') +
                 ' on the customer\'s card. Deleting without releasing it leaves ' +
                 'the hold in place with no local record of it.',
        });
      }

      /* Stripe refused the release. Nothing was deleted, deliberately. */
      if (r.skipped === 'release_failed') {
        return res.status(502).json({
          ok: false,
          error: `Could not release the authorization on ${r.orderNumber} ` +
                 `(${r.paymentIntent}): ${r.error}. NOTHING WAS DELETED — ` +
                 'release it in Stripe, then delete.',
        });
      }

      return res.status(409).json({
        ok: false,
        error: `${r.orderNumber} has a captured payment (${r.capturedAt}). ` +
               'Deleting it loses your only local record of money taken. ' +
               'Re-send with confirm_captured to proceed.',
        requiresConfirm: true,
      });
    }

    await conn.commit();
    return res.json({ ok: true, deleted: 1, orderNumber: r.orderNumber,
                      counts: r.counts, authReleased: r.authReleased });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error('[ordersController.deleteOrder]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  } finally {
    conn.release();
  }
};

/* POST /admin/orders/bulk-delete   body: { ids: [1,2,3], confirm_captured? } */
exports.bulkDelete = async (req, res) => {
  const conn = await bvoPool.getConnection();
  try {
    const raw = (req.body && req.body.ids) || [];
    const ids = (Array.isArray(raw) ? raw : [raw])
      .map(n => parseInt(n, 10))
      .filter(n => Number.isInteger(n) && n > 0);

    if (!ids.length) return res.status(400).json({ ok: false, error: 'No order ids supplied' });

    /* A cap, because this endpoint takes an arbitrary array and the whole
       point of it is destruction. Clearing more than 500 at once is a job for
       the one-off script, where it is visible and reviewed. */
    if (ids.length > 500) {
      return res.status(400).json({ ok: false, error: 'Refusing more than 500 at once' });
    }

    const reason = readDeleteReason(req);
    if (!reason) {
      return res.status(400).json({ ok: false,
        error: 'Pick a deletion reason. "Other" needs a note of at least 5 characters.' });
    }

    await conn.beginTransaction();
    const deleted = [], skipped = [];
    for (const id of ids) {
      const r = await deleteOneOrder(conn, id, {
        actor:           req.session?.adminUser || 'admin',
        reason,
        confirmCaptured: !!(req.body && req.body.confirm_captured),
        /* Same acknowledgement model as confirm_captured: the UI shows how
           many of the selected orders hold a live authorization, and THIS
           flag is the operator saying release them. Absent, each one is
           skipped with its reason rather than silently stranded. */
        releaseAuth:     !!(req.body && req.body.release_auth),
      });
      (r.ok ? deleted : skipped).push(r);
    }
    await conn.commit();

    return res.json({
      ok: true,
      deleted: deleted.length,
      /* ⚠️ s.skipped is a CODE. It is surfaced to the operator in an alert,
         so it gets a sentence as well — 'authorization_pending' tells
         someone clearing test data nothing about why their order survived.
         The code stays in `reason` because the UI and the gate both key
         off it; the prose is additive. */
      skipped: skipped.map(s => ({
        id: s.id,
        orderNumber: s.orderNumber || null,
        reason: s.skipped,
        detail:
          s.skipped === 'authorization_pending'
            ? 'holds an uncaptured authorization' +
              (s.amount ? ` of $${Number(s.amount).toFixed(2)}` : '') +
              ' — re-run with "release the holds" ticked'
          : s.skipped === 'release_failed'
            ? `Stripe refused to release ${s.paymentIntent}: ${s.error}` +
              ' — nothing was deleted for this one'
          : s.skipped === 'payment_captured'
            ? `payment was captured ${s.capturedAt}`
          : s.skipped === 'not_found'
            ? 'no longer exists'
          : s.skipped,
      })),
      /* So the operator can see the holds actually went, not just that the
         rows did. */
      authReleased: deleted.filter(d => d.authReleased).length,
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error('[ordersController.bulkDelete]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  } finally {
    conn.release();
  }
};

/* Exported for the gate and for scripts/cleanupTestOrders.js, so the one-off
   cleanup runs the SAME delete the button runs rather than its own SQL. */
exports.__deleteInternals = { deleteOneOrder, countOrderChildren, ORDER_CHILD_TABLES };
