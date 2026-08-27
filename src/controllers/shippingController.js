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
      `SELECT s.*, o.id AS order_id_ref, o.customer_name
       FROM shipments s
       LEFT JOIN orders o ON o.id = s.order_id
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
  let prefill = {};

  if (orderId) {
    const order = await safeQueryOne(
      `SELECT o.*, oi.product_name, oi.quantity, oi.price
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = ?
       LIMIT 1`, [orderId]
    );
    if (order) {
      prefill = {
        orderId:        order.id,
        company:        order.customer_name || '',
        name:           order.customer_name || '',
        address1:       order.shipping_address || order.billing_address || '',
        city:           order.shipping_city    || order.billing_city    || '',
        state:          order.shipping_state   || order.billing_state   || '',
        zip:            order.shipping_zip     || order.billing_zip     || '',
        phone:          order.phone            || '',
        email:          order.email            || '',
        reference1:     `Order #${order.id}`,
      };
    }
  }

  res.render('pages/admin/shipping/create', {
    ...LAYOUT,
    pageTitle: 'Create Shipment',
    prefill,
    apiMode: wwex.apiMode,
    orderId,
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
  if (body.liftgatePickup)   acc.push({ code: 'LGP', description: 'Liftgate Pickup' });
  if (body.liftgateDelivery) acc.push({ code: 'LGD', description: 'Liftgate Delivery' });
  if (body.residential)      acc.push({ code: 'RES', description: 'Residential Delivery' });
  if (body.appointment)      acc.push({ code: 'APT', description: 'Appointment Required' });
  if (body.insideDelivery)   acc.push({ code: 'IND', description: 'Inside Delivery' });
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

module.exports = { index, createForm, getRates, bookShipment, cancelShipment, getDocument, trackShipment, validateAddress };
