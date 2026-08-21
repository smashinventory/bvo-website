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
const brevo          = require('../services/brevoService');
const wwex           = require('../services/wwexService');
const authorizeNet   = require('../services/authorizeNetService');
const path        = require('path');
const fs          = require('fs');
const multer      = require('multer');

const LAYOUT = { layout: 'layouts/admin' };

function safeQuery(sql, params = []) {
  return bvoPool.query(sql, params).then(([rows]) => rows).catch(() => []);
}
function safeQueryOne(sql, params = []) {
  return bvoPool.query(sql, params).then(([rows]) => rows[0] || null).catch(() => null);
}

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

    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND o.status = ?'; params.push(status); }
    if (search) {
      where += ' AND (o.order_number LIKE ? OR o.guest_email LIKE ? OR CONCAT(c.first_name," ",c.last_name) LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const countRow = await safeQueryOne(
      `SELECT COUNT(*) AS total FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ${where}`, params
    );
    const total = countRow ? countRow.total : 0;

    const orders = await safeQuery(
      `SELECT o.id, o.order_number, o.status, o.total, o.created_at, o.shipped_at, o.delivered_at,
              COALESCE(CONCAT(c.first_name,' ',c.last_name), o.guest_email) AS customer_name,
              vpo.status AS vpo_status, vpo.sent_at AS vpo_sent_at, vpo.confirmed_at AS vpo_confirmed_at,
              s.status AS ship_status, s.estimated_delivery, s.last_tracking_scan,
              (SELECT COUNT(*) FROM order_returns r WHERE r.order_id = o.id AND r.status NOT IN ('resolved','denied')) AS open_returns
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN vendor_purchase_orders vpo ON vpo.order_id = o.id
       LEFT JOIN shipments s ON s.order_id = o.id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    orders.forEach(o => {
      const vpo      = o.vpo_status ? { status: o.vpo_status, sent_at: o.vpo_sent_at, confirmed_at: o.vpo_confirmed_at } : null;
      const shipment = o.ship_status ? { status: o.ship_status, estimated_delivery: o.estimated_delivery, last_tracking_scan: o.last_tracking_scan } : null;
      const openRet  = o.open_returns > 0 ? { status: 'requested', requested_at: new Date() } : null;
      o.rag = computeRag(o, vpo, shipment, openRet);
    });

    const ragCounts = { red: 0, yellow: 0, green: 0 };
    orders.forEach(o => ragCounts[o.rag]++);

    res.render('pages/admin/orders/index', {
      ...LAYOUT,
      activePage: 'orders',
      pageTitle:  'Orders',
      flash:      null,
      orders,
      total,
      page,
      pages:    Math.ceil(total / limit),
      limit,
      status,
      search,
      ragCounts,
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
              COALESCE(CONCAT(c.first_name,' ',c.last_name), o.guest_email) AS customer_name,
              c.email AS customer_email, c.phone AS customer_phone
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

    const openReturn = returns.find(r => !['resolved','denied'].includes(r.status)) || null;
    const rag = computeRag(order, vendorPo, shipment, openReturn);

    res.render('pages/admin/orders/detail', {
      ...LAYOUT,
      activePage: 'orders',
      pageTitle:  `Order ${order.order_number}`,
      order,
      items,
      vendorPo:   vendorPo || null,
      shipment:   shipment || null,
      returns,
      events,
      documents,
      rag,
      wwexMode:   wwex.apiMode,
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
    const VALID  = ['pending','confirmed','processing','shipped','delivered','cancelled','refunded'];
    if (!VALID.includes(status)) return res.status(400).json({ ok: false, error: 'Invalid status' });

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
      `SELECT o.*, COALESCE(CONCAT(c.first_name,' ',c.last_name), o.guest_email) AS customer_name
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
      `SELECT o.*, COALESCE(CONCAT(c.first_name,' ',c.last_name), o.guest_email) AS customer_name,
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
   CAPTURE PAYMENT (Prior Auth → Capture)
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
      return res.status(400).json({ ok: false, error: 'No transaction ID on record' });
    }

    const result = await authorizeNet.captureTransaction(
      order.payment_transaction_id,
      order.total
    );

    if (!result.ok) {
      return res.status(502).json({ ok: false, error: result.error });
    }

    await conn.query(
      'UPDATE orders SET payment_status = ? WHERE id = ?',
      ['captured', id]
    );
    await logEvent(conn, id, 'payment_captured', 'auth_only', 'captured',
      req.session?.adminUser || 'admin',
      `Captured $${parseFloat(order.total).toFixed(2)} — TxID: ${order.payment_transaction_id}`
    );

    return res.json({ ok: true, message: `$${parseFloat(order.total).toFixed(2)} captured successfully` });
  } catch (err) {
    console.error('[ordersController.capturePayment]', err);
    return res.status(500).json({ ok: false, error: 'Server error during capture' });
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
              COALESCE(CONCAT(c.first_name,' ',c.last_name), o.guest_email) AS customer_name
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

    const kpis = await safeQueryOne(
      `SELECT
         COUNT(*)                                                    AS total_orders,
         COALESCE(SUM(total),0)                                      AS total_revenue,
         COALESCE(AVG(total),0)                                      AS avg_order_value,
         COUNT(CASE WHEN status='cancelled' THEN 1 END)              AS cancelled_orders,
         COUNT(CASE WHEN status='delivered' THEN 1 END)              AS delivered_orders,
         COUNT(CASE WHEN status='refunded'  THEN 1 END)              AS refunded_orders,
         AVG(CASE WHEN shipped_at IS NOT NULL
             THEN TIMESTAMPDIFF(HOUR, created_at, shipped_at) END)  AS avg_hours_to_ship
       FROM orders
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`, [days]
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

    const revenueByDay = await safeQuery(
      `SELECT DATE(created_at) AS day, COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
       FROM orders
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
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
