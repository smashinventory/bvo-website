'use strict';

/**
 * shippingController.js
 * Admin shipping management — WWEX SpeedShip V4 integration.
 *
 * Routes (all under /admin/shipping):
 *   GET  /                 — shipments list
 *   GET  /create           — new shipment form (optional ?orderId=X to pre-fill)
 *   POST /rates            — AJAX: shopFlow → return rate options
 *   POST /book             — AJAX: quoteOrderFlow → book, save to DB
 *   POST /pickup           — AJAX: schedulePickupFlow (SMALLPACK)
 *   POST /cancel           — AJAX: integratedCancelFlow
 *   GET  /document         — proxy documentDownloadFlow → stream PDF
 *   GET  /track/:bol       — AJAX: searchShipmentsFlow for one BOL
 */

const { bvoPool } = require('../config/database');
const wwex        = require('../services/wwexService');

const LAYOUT = { layout: 'layouts/admin', activePage: 'shipping' };

function safeQuery(sql, p = []) {
  return bvoPool.query(sql, p).then(([r]) => r).catch(() => []);
}
function safeQueryOne(sql, p = []) {
  return bvoPool.query(sql, p).then(([r]) => r[0] || null).catch(() => null);
}

/* ─────────────────────────────────────────────────────────────────
   LIST — /admin/shipping
───────────────────────────────────────────────────────────────────*/
async function index(req, res) {
  try {
    const shipments = await safeQuery(
      `SELECT s.*
       FROM shipments s
       ORDER BY s.created_at DESC LIMIT 200`
    );
    res.render('pages/admin/shipping/index', {
      ...LAYOUT,
      pageTitle: 'Shipments',
      shipments,
      apiMode: wwex.apiMode,
    });
  } catch (err) {
    console.error('[shipping] index error:', err);
    res.status(500).render('pages/admin/shipping/index', {
      ...LAYOUT, pageTitle: 'Shipments',
      shipments: [], apiMode: wwex.apiMode,
      error: err.message,
    });
  }
}

/* ─────────────────────────────────────────────────────────────────
   CREATE FORM — /admin/shipping/create
   Optional ?orderId=X pre-fills recipient address from orders table
───────────────────────────────────────────────────────────────────*/
async function createForm(req, res) {
  const orderId = req.query.orderId || null;
  let prefill      = {};
  let prefillItems = [];
  let orderMeta    = null;   // raw order row for the info banner

  if (orderId) {
    // ── Order header ────────────────────────────────────────────
    const order = await safeQueryOne(
      `SELECT id, order_number, customer_name, email, phone,
              shipping_address, shipping_city, shipping_state, shipping_zip,
              billing_address,  billing_city,  billing_state,  billing_zip,
              total, status
       FROM orders WHERE id = ? LIMIT 1`, [orderId]
    );

    if (order) {
      orderMeta = order;
      prefill = {
        orderId:    order.id,
        orderNum:   order.order_number || `#${order.id}`,
        company:    '',                           // usually residential — left blank so agent fills it
        name:       order.customer_name || '',
        address1:   order.shipping_address || order.billing_address || '',
        city:       order.shipping_city    || order.billing_city    || '',
        state:      order.shipping_state   || order.billing_state   || '',
        zip:        order.shipping_zip     || order.billing_zip     || '',
        phone:      order.phone            || '',
        email:      order.email            || '',
        reference1: `Order ${order.order_number || '#'+order.id}`,
      };

      // ── Line items joined to products for dimensions ────────────
      const items = await safeQuery(
        `SELECT
           oi.product_name,
           oi.quantity,
           oi.price,
           p.sku,
           p.vendor_sku,
           p.upc,
           p.width_in,
           p.depth_in,
           p.height_in,
           p.weight_lbs,
           p.total_ship_weight_lbs,
           p.freight_class,
           p.ships_ltl
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?
         ORDER BY oi.id ASC`, [orderId]
      );

      prefillItems = items.map(function(item) {
        // Use total_ship_weight_lbs if available, else weight_lbs, times qty
        const qty    = item.quantity || 1;
        const weight = item.total_ship_weight_lbs
                     ? Math.round(item.total_ship_weight_lbs * qty)
                     : item.weight_lbs
                     ? Math.round(item.weight_lbs * qty)
                     : null;
        return {
          description:  item.product_name || item.sku || '',
          sku:          item.vendor_sku || item.sku || item.upc || '',
          weight:       weight,
          length:       item.depth_in  ? Math.ceil(item.depth_in)  : null,
          width:        item.width_in  ? Math.ceil(item.width_in)  : null,
          height:       item.height_in ? Math.ceil(item.height_in) : null,
          qty:          qty,
          freightClass: item.freight_class || '',
          shipsLTL:     item.ships_ltl     || false,
        };
      });
    }
  }

  // ── Default ship type: LTL if any item has ships_ltl=true ────
  const defaultType = prefillItems.some(function(i){ return i.shipsLTL; })
    ? 'LTL' : 'LTL';   // always default LTL; SMALLPACK selected manually

  res.render('pages/admin/shipping/create', {
    ...LAYOUT,
    pageTitle:    'Create Shipment',
    prefill,
    prefillItems,
    orderMeta,
    apiMode:      wwex.apiMode,
    orderId,
    defaultType,
  });
}

/* ─────────────────────────────────────────────────────────────────
   RATE SHOP — POST /admin/shipping/rates  (AJAX)
   Body: { productType, origin, destination, items[] }
───────────────────────────────────────────────────────────────────*/
async function getRates(req, res) {
  try {
    const { productType = 'LTL', origin, destination, items = [], service } = req.body;

    let shopPayload;

    if (productType === 'SMALLPACK') {
      shopPayload = {
        productType: 'SMALLPACK',
        returnSelectedServiceOnly: false,
        service: service || null,
        shipment: {
          adultSignatureRequiredFlag: false,
          destinationAddress: {
            address: {
              addressLineList: [destination.address1].filter(Boolean),
              locality:    destination.city,
              region:      destination.state,
              postalCode:  destination.zip,
              countryCode: destination.country || 'US',
              companyName: destination.company || '',
              phone:       destination.phone   || '',
              contactList: [{ firstName: '', lastName: destination.name || '', phone: destination.phone || '', email: destination.email || '', extension: null }],
            },
          },
          handlingUnitList: (items || []).map(pkg => ({
            billedDimension: {
              length: { value: pkg.length || null, unit: 'in', dimensionType: 'NET' },
              width:  { value: pkg.width  || null, unit: 'in' },
              height: { value: pkg.height || null, unit: 'in' },
            },
            packagingType:     '02',
            packagingTypeName: 'Custom',
            quantity:          pkg.quantity || 1,
            shippedItemList: [{
              additionalHandlingFeeFlag: false,
              weight: { value: pkg.weight || 0, unit: 'lbs' },
            }],
          })),
          originAddress: {
            address: {
              addressLineList: [origin.address1].filter(Boolean),
              locality:    origin.city,
              region:      origin.state,
              postalCode:  origin.zip,
              countryCode: origin.country || 'US',
              companyName: origin.company || '',
              phone:       origin.phone   || '',
              contactList: [{ firstName: '', lastName: origin.name || '', phone: origin.phone || '' }],
            },
          },
        },
      };
    } else {
      // LTL
      shopPayload = {
        productType: 'LTL',
        shipment: {
          originAddress: {
            address: {
              addressLineList: [origin.address1].filter(Boolean),
              locality:    origin.city,
              region:      origin.state,
              postalCode:  origin.zip,
              countryCode: origin.country || 'US',
              companyName: origin.company || '',
              phone:       origin.phone   || '',
            },
          },
          destinationAddress: {
            address: {
              addressLineList: [destination.address1].filter(Boolean),
              locality:    destination.city,
              region:      destination.state,
              postalCode:  destination.zip,
              countryCode: destination.country || 'US',
              companyName: destination.company || '',
              phone:       destination.phone   || '',
              contactList: [{ firstName: '', lastName: destination.name || '', phone: destination.phone || '', email: destination.email || '' }],
            },
          },
          accessorialList: buildAccessorials(req.body),
          handlingUnitList: (items || []).map(item => ({
            count:         item.quantity || 1,
            type:          item.huType   || 'PLT',
            weight:        { value: item.weight || 0, unit: 'lbs' },
            dimension:     {
              length: { value: item.length || null, unit: 'in' },
              width:  { value: item.width  || null, unit: 'in' },
              height: { value: item.height || null, unit: 'in' },
            },
            freightClass:  item.freightClass || null,
            nmfcCode:      item.nmfcCode     || null,
            description:   item.description  || '',
          })),
        },
      };
    }

    const result = await wwex.shopFlow(shopPayload, productType);
    res.json(result);
  } catch (err) {
    console.error('[shipping] getRates error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

function buildAccessorials(body) {
  const acc = [];
  // Pickup Services
  if (body.insidePickup)        acc.push({ code: 'INP', description: 'Inside Pickup' });
  if (body.liftgatePickup)      acc.push({ code: 'LGP', description: 'Liftgate Pickup' });
  if (body.residentialPickup)   acc.push({ code: 'RSP', description: 'Residential Pickup' });
  if (body.tradeshowPickup)     acc.push({ code: 'TSP', description: 'Tradeshow Pickup' });
  if (body.constructionPickup)  acc.push({ code: 'COP', description: 'Construction Site Pickup' });
  if (body.dropAtTerminal)      acc.push({ code: 'DAT', description: 'Drop Shipment at Terminal' });
  if (body.groceryPickup)       acc.push({ code: 'GCP', description: 'Grocery Consolidation Pickup' });
  // Delivery Services
  if (body.insideDelivery)      acc.push({ code: 'IND', description: 'Inside Delivery' });
  if (body.liftgateDelivery)    acc.push({ code: 'LGD', description: 'Liftgate Delivery' });
  if (body.residentialDelivery || body.residential) acc.push({ code: 'RES', description: 'Residential Delivery' });
  if (body.tradeshowDelivery)   acc.push({ code: 'TSD', description: 'Tradeshow Delivery' });
  if (body.groceryDelivery)     acc.push({ code: 'GCD', description: 'Grocery Consolidation Delivery' });
  if (body.constructionDelivery)acc.push({ code: 'COD', description: 'Construction Site Delivery' });
  if (body.notifyBeforeDelivery)acc.push({ code: 'NBD', description: 'Notify Before Delivery' });
  if (body.holdAtTerminal)      acc.push({ code: 'HAT', description: 'Hold Shipment at Terminal' });
  if (body.appointment)         acc.push({ code: 'APT', description: 'Appointment Delivery' });
  // Shipment Services
  if (body.sortAndSegregate)    acc.push({ code: 'SAS', description: 'Sort and Segregate' });
  if (body.protectFromFreeze)   acc.push({ code: 'PFF', description: 'Protect from Freeze' });
  // Insurance
  if (body.insure && body.declaredValue > 0) {
    acc.push({ code: 'INS', description: 'Insurance', declaredValue: body.declaredValue });
  }
  return acc;
}

/* ─────────────────────────────────────────────────────────────────
   BOOK — POST /admin/shipping/book  (AJAX)
   Body: { productType, productTransactionId, offerId, shipment{...}, orderId? }
───────────────────────────────────────────────────────────────────*/
async function bookShipment(req, res) {
  try {
    const {
      productType = 'LTL',
      productTransactionId,
      offerId,
      shipment,
      orderId         = null,
      carrier         = '',
      serviceLevel    = '',
      totalCharge     = 0,
      schedulePickup  = false,
      pickupDate      = null,
      pickupReadyTime = '08:00:00',
      pickupCloseTime = '17:00:00',
    } = req.body;

    if (!productTransactionId || !offerId) {
      return res.status(400).json({ ok: false, error: 'productTransactionId and offerId are required.' });
    }

    // ── Book ────────────────────────────────────────────────────
    const bookPayload = {
      shipmentProductTransactionId: productTransactionId,
      shipmentOfferId:              offerId,
      shipment,
    };

    const booked = await wwex.quoteOrderFlow(bookPayload, productType);
    if (!booked.ok) return res.status(502).json(booked);

    // ── Schedule pickup (SMALLPACK only, if requested) ───────────
    let pickupConfirmation = null;
    if (productType === 'SMALLPACK' && schedulePickup && pickupDate) {
      const pkup = await wwex.schedulePickupFlow({
        productTransactionIdList: [booked.productTransactionId || productTransactionId],
        pickupDate:  `${pickupDate} 00:00:00`,
        productType: 'SMALLPACK',
        vendorId:    'UPS',
        isAlternateAddress:  false,
        isResidential:       false,
        isSaturdayAvailable: false,
        isSelfScheduled:     false,
        pickupStop: {
          readyTime: pickupReadyTime,
          closeTime: pickupCloseTime,
          address:   shipment.originAddress?.address || {},
        },
      });
      if (pkup.ok) pickupConfirmation = pkup.confirmationNumber;
    }

    // ── Save to DB ───────────────────────────────────────────────
    const dest = shipment?.destinationAddress?.address || {};
    const orig = shipment?.originAddress?.address      || {};

    await safeQuery(
      `INSERT INTO shipments
         (order_id, product_transaction_id, offer_id, product_type, bol_number, pro_number,
          bol_url, carrier, service_level, total_charge, status,
          origin_company, origin_city, origin_state, origin_zip,
          dest_company, dest_name, dest_address1, dest_city, dest_state, dest_zip,
          dest_phone, dest_email, pickup_confirmation, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`,
      [
        orderId || null,
        booked.productTransactionId || productTransactionId,
        offerId,
        productType,
        booked.bolNumber || null,
        booked.proNumber || null,
        booked.bolUrl    || null,
        carrier,
        serviceLevel,
        totalCharge,
        'booked',
        (Array.isArray(orig.addressLineList) ? orig.addressLineList[0] : orig.addressLine1) || '',
        orig.locality  || '',
        orig.region    || '',
        orig.postalCode|| '',
        dest.companyName|| '',
        (dest.contactList?.[0]?.lastName) || '',
        (Array.isArray(dest.addressLineList) ? dest.addressLineList[0] : dest.addressLine1) || '',
        dest.locality  || '',
        dest.region    || '',
        dest.postalCode|| '',
        dest.phone     || dest.contactList?.[0]?.phone || '',
        dest.contactList?.[0]?.email || '',
        pickupConfirmation || null,
      ]
    );

    // Mark order as shipped if linked
    if (orderId) {
      await safeQuery(
        `UPDATE orders SET status='shipped', tracking_number=?, updated_at=NOW() WHERE id=?`,
        [booked.bolNumber || booked.proNumber || '', orderId]
      );
    }

    res.json({ ok: true, ...booked, pickupConfirmation });
  } catch (err) {
    console.error('[shipping] bookShipment error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* ─────────────────────────────────────────────────────────────────
   CANCEL — POST /admin/shipping/cancel  (AJAX)
   Body: { shipmentId, productType }
───────────────────────────────────────────────────────────────────*/
async function cancelShipment(req, res) {
  try {
    const { shipmentId, productType = 'LTL' } = req.body;
    if (!shipmentId) return res.status(400).json({ ok: false, error: 'shipmentId required' });

    // Look up productTransactionId from DB
    const row = await safeQueryOne(
      `SELECT product_transaction_id FROM shipments WHERE id = ?`, [shipmentId]
    );
    const txnId = row?.product_transaction_id;
    if (!txnId) return res.status(404).json({ ok: false, error: 'Shipment not found' });

    const result = await wwex.integratedCancelFlow([txnId], productType);
    if (!result.ok) return res.status(502).json(result);

    await safeQuery(
      `UPDATE shipments SET status='voided', updated_at=NOW() WHERE id=?`, [shipmentId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[shipping] cancelShipment error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* ─────────────────────────────────────────────────────────────────
   DOCUMENT — GET /admin/shipping/document?shipmentId=X&docType=BILL_OF_LADING
───────────────────────────────────────────────────────────────────*/
async function getDocument(req, res) {
  try {
    const { shipmentId, docType = 'BILL_OF_LADING' } = req.query;
    const row = await safeQueryOne(
      `SELECT product_transaction_id, product_type, bol_url FROM shipments WHERE id=?`, [shipmentId]
    );
    if (!row) return res.status(404).send('Shipment not found');

    // If we have a direct BOL URL and it's a BOL request, redirect
    if (docType === 'BILL_OF_LADING' && row.bol_url) {
      return res.redirect(row.bol_url);
    }

    const doc = await wwex.documentDownloadFlow(row.product_transaction_id, docType, row.product_type);
    if (!doc.ok) return res.status(502).send(doc.error || 'Document unavailable');

    const buf = Buffer.from(doc.base64, 'base64');
    res.set('Content-Type', doc.contentType || 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${docType}-${shipmentId}.pdf"`);
    res.send(buf);
  } catch (err) {
    console.error('[shipping] getDocument error:', err);
    res.status(500).send(err.message);
  }
}

/* ─────────────────────────────────────────────────────────────────
   TRACK — GET /admin/shipping/track/:bol  (AJAX)
───────────────────────────────────────────────────────────────────*/
async function trackShipment(req, res) {
  try {
    const { bol } = req.params;
    const row = await safeQueryOne(
      `SELECT product_type FROM shipments WHERE bol_number=? OR pro_number=? LIMIT 1`,
      [bol, bol]
    );
    const productType = row?.product_type || 'LTL';
    const type = req.query.type || 'BOL';

    const result = await wwex.searchShipmentsFlow([bol], type, productType);
    if (!result.ok) return res.status(502).json(result);

    // Update DB status if delivered
    const ship = result.shipments?.[0];
    if (ship?.status) {
      const dbStatus = ship.status.toLowerCase().includes('deliver') ? 'delivered'
                     : ship.status.toLowerCase().includes('transit')  ? 'in_transit'
                     : ship.status.toLowerCase().includes('void')     ? 'voided'
                     : 'booked';
      await safeQuery(
        `UPDATE shipments SET status=?, pro_number=COALESCE(pro_number,?), updated_at=NOW()
         WHERE bol_number=? OR pro_number=?`,
        [dbStatus, ship.pro || bol, bol, bol]
      );
    }

    res.json({ ok: true, shipment: ship });
  } catch (err) {
    console.error('[shipping] track error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* ─────────────────────────────────────────────────────────────────
   ADDRESS VALIDATE — POST /admin/shipping/validate-address  (AJAX)
───────────────────────────────────────────────────────────────────*/
async function validateAddress(req, res) {
  try {
    const { address, productType = 'LTL' } = req.body;
    const result = await wwex.addressValidationFlow(address, productType);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* ─────────────────────────────────────────────────────────────────
   TRACK PAGE — GET /admin/shipping/track-search
   Dedicated tracking UI (not the AJAX endpoint).
───────────────────────────────────────────────────────────────────*/
async function trackPage(req, res) {
  const { q, type = 'BOL' } = req.query;
  res.render('pages/admin/shipping/track', {
    ...LAYOUT,
    activePage: 'shipping-track',
    pageTitle:  'Track Shipment',
    query:      q || '',
    trackType:  type,
    shipment:   null,
    apiMode:    wwex.apiMode,
  });
}

/* ─────────────────────────────────────────────────────────────────
   DASHBOARD — GET /admin/shipping/dashboard
───────────────────────────────────────────────────────────────────*/
async function dashboard(req, res) {
  try {
    const [[stats]] = await bvoPool.query(`
      SELECT
        COUNT(*)                                                         AS total,
        SUM(status='booked')                                            AS booked,
        SUM(status='in_transit')                                        AS in_transit,
        SUM(status='delivered')                                         AS delivered,
        SUM(status='voided')                                            AS voided,
        SUM(total_charge)                                               AS total_spend,
        SUM(product_type='LTL')                                        AS ltl_count,
        SUM(IF(product_type='LTL', total_charge, 0))                   AS ltl_spend,
        SUM(product_type='SMALLPACK')                                   AS sp_count,
        SUM(IF(product_type='SMALLPACK', total_charge, 0))             AS sp_spend
      FROM shipments WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    const [byCarrier] = await bvoPool.query(`
      SELECT carrier, COUNT(*) AS count, SUM(total_charge) AS spend
      FROM shipments
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND carrier IS NOT NULL
      GROUP BY carrier ORDER BY spend DESC LIMIT 10
    `);

    const [recent] = await bvoPool.query(`
      SELECT s.* FROM shipments s
      ORDER BY s.created_at DESC LIMIT 10
    `);

    res.render('pages/admin/shipping/dashboard', {
      ...LAYOUT,
      activePage: 'shipping-dashboard',
      pageTitle: 'Shipping Dashboard',
      stats:     stats || {},
      byCarrier,
      recent,
      apiMode:   wwex.apiMode,
    });
  } catch (err) {
    console.error('[shipping] dashboard error:', err);
    res.render('pages/admin/shipping/dashboard', {
      ...LAYOUT, activePage: 'shipping-dashboard', pageTitle: 'Shipping Dashboard',
      stats: {}, byCarrier: [], recent: [], apiMode: wwex.apiMode,
    });
  }
}

/* ─────────────────────────────────────────────────────────────────
   INVOICES — GET /admin/shipping/invoices
───────────────────────────────────────────────────────────────────*/
async function invoices(req, res) {
  try {
    const [shipments] = await bvoPool.query(`
      SELECT s.* FROM shipments s
      WHERE s.status != 'voided'
      ORDER BY s.created_at DESC LIMIT 500
    `);

    const [[totals]] = await bvoPool.query(`
      SELECT
        SUM(total_charge)                                   AS total,
        SUM(IF(product_type='LTL', total_charge, 0))       AS ltl,
        SUM(IF(product_type='SMALLPACK', total_charge, 0)) AS smallpack
      FROM shipments WHERE status != 'voided'
    `);

    res.render('pages/admin/shipping/invoices', {
      ...LAYOUT,
      activePage: 'shipping-invoices',
      pageTitle: 'Shipping Invoices',
      shipments,
      totals: totals || {},
      apiMode: wwex.apiMode,
    });
  } catch (err) {
    console.error('[shipping] invoices error:', err);
    res.render('pages/admin/shipping/invoices', {
      ...LAYOUT, activePage: 'shipping-invoices', pageTitle: 'Shipping Invoices',
      shipments: [], totals: {}, apiMode: wwex.apiMode,
    });
  }
}

/* ─────────────────────────────────────────────────────────────────
   OPEN ORDERS — GET /admin/shipping/open-orders  (AJAX)
   Returns orders that are shippable (not cancelled/shipped/delivered)
   and don't already have an active (non-voided) shipment.
───────────────────────────────────────────────────────────────────*/
async function openOrders(req, res) {
  try {
    const rows = await safeQuery(`
      SELECT o.id, o.order_number, o.customer_name, o.total, o.status,
             o.shipping_address, o.created_at
      FROM orders o
      WHERE o.status NOT IN ('cancelled','shipped','delivered','refunded')
        AND NOT EXISTS (
          SELECT 1 FROM shipments s
          WHERE s.order_id = o.id AND s.status != 'voided'
        )
      ORDER BY o.created_at DESC
      LIMIT 200
    `);
    res.json({ ok: true, orders: rows });
  } catch (err) {
    console.error('[shipping] openOrders error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  index, createForm, getRates, bookShipment, cancelShipment,
  getDocument, trackShipment, trackPage, dashboard, invoices,
  validateAddress, openOrders,
};
