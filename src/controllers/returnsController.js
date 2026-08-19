'use strict';

/**
 * returnsController.js
 * Returns workflow: request, approve/deny, receive, inspect, resolve.
 *
 * Admin routes:
 *   GET  /admin/returns                   — returns queue (RAG)
 *   GET  /admin/returns/:id               — return detail
 *   POST /admin/orders/:orderId/returns   — open a new return request (admin-initiated)
 *   POST /admin/returns/:id/approve       — approve + issue RA number
 *   POST /admin/returns/:id/deny          — deny with notes
 *   POST /admin/returns/:id/receive       — mark received + capture condition
 *   POST /admin/returns/:id/resolve       — set resolution + refund amount
 */

const { bvoPool } = require('../config/database');
const brevo       = require('../services/brevoService');

/* ── Helpers ──────────────────────────────────────────────────── */
function genReturnNumber() {
  const d = new Date();
  return `RET-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000)+1000}`;
}

function genRaNumber() {
  return `RA-${Date.now().toString(36).toUpperCase()}`;
}

function computeRag(ret) {
  const now = Date.now();
  const age = (now - new Date(ret.requested_at).getTime()) / 36e5; // hours

  if (ret.status === 'resolved' || ret.status === 'denied') return 'green';
  if (ret.status === 'requested' && age > 24) return 'red';
  if (ret.status === 'approved'  && !ret.ra_number) return 'red';
  if (ret.status === 'received'  && !ret.condition_on_receipt) return 'yellow';
  if (ret.status === 'inspected' && age > 5 * 24) return 'red'; // 5 days since requested
  if (['requested','approved','in_transit'].includes(ret.status)) return 'yellow';
  return 'green';
}

/* ═══════════════════════════════════════════════════════════════
   RETURNS QUEUE
   ═══════════════════════════════════════════════════════════════ */
exports.list = async (req, res) => {
  try {
    const status = req.query.status || '';
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND r.status = ?'; params.push(status); }

    const [returns] = await bvoPool.query(
      `SELECT r.*, o.order_number, o.id AS order_id,
              COALESCE(CONCAT(c.first_name,' ',c.last_name), o.guest_email) AS customer_name
       FROM order_returns r
       JOIN orders o ON o.id = r.order_id
       LEFT JOIN customers c ON c.id = o.customer_id
       ${where}
       ORDER BY r.requested_at DESC`, params
    );

    returns.forEach(r => { r.rag = computeRag(r); });
    const ragCounts = { red: 0, yellow: 0, green: 0 };
    returns.forEach(r => ragCounts[r.rag]++);

    res.render('pages/admin/orders/returns', {
      activePage: 'returns',
      pageTitle:  'Returns Queue',
      returns,
      status,
      ragCounts,
    });
  } catch (err) {
    console.error('[returnsController.list]', err);
    res.status(500).render('pages/error', { pageTitle: 'Error', message: 'Could not load returns.' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   OPEN A RETURN (admin-initiated on behalf of customer)
   ═══════════════════════════════════════════════════════════════ */
exports.openReturn = async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const { reason, customer_notes } = req.body;
    const VALID_REASONS = ['damaged','defective','wrong_item','changed_mind','not_as_described','other'];
    if (!VALID_REASONS.includes(reason)) return res.status(400).json({ ok: false, error: 'Invalid reason' });

    const returnNumber = genReturnNumber();
    await bvoPool.query(
      `INSERT INTO order_returns (order_id, return_number, status, reason, customer_notes)
       VALUES (?, ?, 'requested', ?, ?)`,
      [orderId, returnNumber, reason, customer_notes || null]
    );
    return res.json({ ok: true, return_number: returnNumber });
  } catch (err) {
    console.error('[returnsController.openReturn]', err);
    return res.status(500).json({ ok: false, error: 'Could not open return' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   APPROVE + ISSUE RA NUMBER
   ═══════════════════════════════════════════════════════════════ */
exports.approve = async (req, res) => {
  const conn = await bvoPool.getConnection();
  try {
    const id = parseInt(req.params.id);
    const { admin_notes } = req.body;
    const raNumber = genRaNumber();

    const [[ret]] = await conn.query(
      `SELECT r.*, o.guest_email, c.email AS customer_email,
              COALESCE(CONCAT(c.first_name,' ',c.last_name), o.guest_email) AS customer_name,
              oi.name AS product_name
       FROM order_returns r
       JOIN orders o ON o.id = r.order_id
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE r.id = ? LIMIT 1`, [id]
    );
    if (!ret) return res.status(404).json({ ok: false, error: 'Return not found' });

    await conn.query(
      `UPDATE order_returns SET status='approved', ra_number=?, admin_notes=?, approved_at=NOW()
       WHERE id=?`, [raNumber, admin_notes || null, id]
    );

    // Send RA email to customer
    const customerEmail = ret.customer_email || ret.guest_email;
    if (customerEmail) {
      await brevo.sendTemplate('return_approved', customerEmail, {
        customer_first_name: (ret.customer_name || '').split(' ')[0] || 'there',
        ra_number:           raNumber,
        resolution_type:     'refund or replacement',
        refund_timeline:     '5–7',
      });
    }

    return res.json({ ok: true, ra_number: raNumber });
  } catch (err) {
    console.error('[returnsController.approve]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  } finally {
    conn.release();
  }
};

/* ═══════════════════════════════════════════════════════════════
   DENY RETURN
   ═══════════════════════════════════════════════════════════════ */
exports.deny = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { admin_notes } = req.body;

    await bvoPool.query(
      `UPDATE order_returns SET status='denied', resolution='denied', admin_notes=?, resolved_at=NOW()
       WHERE id=?`, [admin_notes || null, id]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('[returnsController.deny]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   MARK RECEIVED + CAPTURE CONDITION
   ═══════════════════════════════════════════════════════════════ */
exports.receive = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { condition_on_receipt, admin_notes } = req.body;
    const VALID = ['good','minor_damage','major_damage','missing_parts'];
    if (!VALID.includes(condition_on_receipt)) return res.status(400).json({ ok: false, error: 'Invalid condition' });

    await bvoPool.query(
      `UPDATE order_returns
       SET status='received', condition_on_receipt=?, admin_notes=CONCAT(COALESCE(admin_notes,''), '\n[Received] ', ?), received_at=NOW()
       WHERE id=?`,
      [condition_on_receipt, admin_notes || 'No notes.', id]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('[returnsController.receive]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   RESOLVE RETURN
   ═══════════════════════════════════════════════════════════════ */
exports.resolve = async (req, res) => {
  const conn = await bvoPool.getConnection();
  try {
    const id = parseInt(req.params.id);
    const { resolution, refund_amount, admin_notes, vendor_claim_filed, vendor_claim_number } = req.body;
    const VALID = ['full_refund','partial_refund','replacement','denied'];
    if (!VALID.includes(resolution)) return res.status(400).json({ ok: false, error: 'Invalid resolution' });

    const [[ret]] = await conn.query(
      `SELECT r.*, o.guest_email, c.email AS customer_email,
              COALESCE(CONCAT(c.first_name,' ',c.last_name), o.guest_email) AS customer_name,
              oi.name AS product_name
       FROM order_returns r
       JOIN orders o ON o.id = r.order_id
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE r.id = ? LIMIT 1`, [id]
    );
    if (!ret) return res.status(404).json({ ok: false, error: 'Return not found' });

    await conn.query(
      `UPDATE order_returns
       SET status='resolved', resolution=?, refund_amount=?, admin_notes=?,
           vendor_claim_filed=?, vendor_claim_number=?, resolved_at=NOW()
       WHERE id=?`,
      [resolution, refund_amount || null, admin_notes || null,
       vendor_claim_filed ? 1 : 0, vendor_claim_number || null, id]
    );

    // Resolution label for email
    const resolutionLabel = {
      full_refund:     'Full Refund',
      partial_refund:  'Partial Refund',
      replacement:     'Replacement Order',
      denied:          'Return Denied',
    }[resolution];

    const refundDetail = refund_amount
      ? `${resolutionLabel} of $${parseFloat(refund_amount).toFixed(2)}`
      : resolutionLabel;

    const customerEmail = ret.customer_email || ret.guest_email;
    if (customerEmail) {
      await brevo.sendTemplate('return_resolved', customerEmail, {
        customer_first_name: (ret.customer_name || '').split(' ')[0] || 'there',
        product_name:        ret.product_name || 'your item',
        resolution_type:     resolutionLabel,
        resolution_detail:   refundDetail,
        refund_amount:       refund_amount ? parseFloat(refund_amount).toFixed(2) : '',
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[returnsController.resolve]', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  } finally {
    conn.release();
  }
};
