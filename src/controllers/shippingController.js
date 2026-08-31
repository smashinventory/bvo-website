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
  let prefill              = {};
  let prefillHandlingUnits = [];
  let orderMeta            = null;   // raw order row for the info banner

  if (orderId) {
    // ── Order header ────────────────────────────────────────────
    const order = await safeQueryOne(
      `SELECT o.id, o.order_number, o.status, o.total,
              o.ship_first_name, o.ship_last_name,
              o.ship_address1, o.ship_city, o.ship_state, o.ship_zip,
              COALESCE(CONCAT(c.first_name,' ',c.last_name), o.guest_email) AS customer_name,
              c.email AS email,
              c.phone AS phone
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id = ? LIMIT 1`, [orderId]
    );

    if (order) {
      orderMeta = order;
      const fullName = order.ship_first_name
        ? [order.ship_first_name, order.ship_last_name].filter(Boolean).join(' ')
        : order.customer_name || '';
      prefill = {
        orderId:    order.id,
        orderNum:   order.order_number || `#${order.id}`,
        company:    '',
        name:       fullName,
        address1:   order.ship_address1 || '',
        city:       order.ship_city     || '',
        state:      order.ship_state    || '',
        zip:        order.ship_zip      || '',
        phone:      order.phone         || '',
        email:      order.email         || '',
        reference1: `Order ${order.order_number || '#'+order.id}`,
      };

      // ── Line items with product IDs ──────────────────────────
      const lineItems = await safeQuery(
        `SELECT
           oi.name  AS product_name,
           oi.qty   AS quantity,
           p.id     AS product_id,
           p.sku,
           p.vendor_sku,
           p.upc,
           p.total_ship_weight_lbs,
           p.freight_class,
           p.ships_ltl
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?
         ORDER BY oi.id ASC`, [orderId]
      );

      // ── Build one Handling Unit per shipping box ──────────────
      // Each row in product_shipping_boxes = one physical carton shipped
      for (const item of lineItems) {
        const sku  = item.vendor_sku || item.sku || item.upc || '';
        const name = item.product_name || sku || '';
        const qty  = item.quantity || 1;

        if (item.product_id) {
          const boxes = await safeQuery(
            `SELECT component_type, box_number,
                    ship_height_in, ship_width_in, ship_depth_in, gross_weight_lbs
             FROM product_shipping_boxes
             WHERE product_id = ?
             ORDER BY component_type, box_number`, [item.product_id]
          );

          if (boxes.length) {
            for (const box of boxes) {
              prefillHandlingUnits.push({
                huType:        'PLT',
                count:         qty,
                stackable:     false,
                length:        box.ship_depth_in  ? Math.ceil(box.ship_depth_in)  : null,
                width:         box.ship_width_in  ? Math.ceil(box.ship_width_in)  : null,
                height:        box.ship_height_in ? Math.ceil(box.ship_height_in) : null,
                grossWeight:   box.gross_weight_lbs ? Math.round(box.gross_weight_lbs) : null,
                productName:   name,
                sku:           sku,
                componentType: box.component_type || '',
                boxNumber:     box.box_number     || 1,
                commodities: [{
                  description:  name,
                  nmfcCode:     '',
                  freightClass: item.freight_class || '',
                  pieces:       qty,
                  pieceType:    'CTN',
                  weight:       box.gross_weight_lbs ? Math.round(box.gross_weight_lbs) : null,
                }],
              });
            }
            continue;
          }
        }

        // Fallback: no product linked or no shipping boxes — use product totals
        prefillHandlingUnits.push({
          huType:      'PLT',
          count:       qty,
          stackable:   false,
          length:      null,
          width:       null,
          height:      null,
          grossWeight: item.total_ship_weight_lbs ? Math.round(item.total_ship_weight_lbs * qty) : null,
          productName: name,
          sku:         sku,
          commodities: [{
            description:  name,
            nmfcCode:     '',
            freightClass: item.freight_class || '',
            pieces:       qty,
            pieceType:    'CTN',
            weight:       item.total_ship_weight_lbs ? Math.round(item.total_ship_weight_lbs * qty) : null,
          }],
        });
      }
    }
  }

  res.render('pages/admin/shipping/create', {
    ...LAYOUT,
    pageTitle:           'Create Shipment',
    prefill,
    prefillHandlingUnits,
    orderMeta,
    apiMode:             wwex.apiMode,
    orderId,
    defaultType:         'LTL',
  });
}

/* ─────────────────────────────────────────────────────────────────
   RATE SHOP — POST /admin/shipping/rates  (AJAX)
   Body: { productType, origin, destination, items[] }
───────────────────────────────────────────────────────────────────*/
function _wwexDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function getRates(req, res) {
  try {
    const { productType = 'LTL', origin, destination, handlingUnits = [], items = [], service } = req.body;
    // Support both new handlingUnits[] (two-layer) and legacy items[] (flat)
    const hus = handlingUnits.length ? handlingUnits : items;
    // Use client-supplied date (yyyy-MM-dd) or fall back to now
    const rawDate = req.body.shipmentDate;
    const shipmentDate = rawDate ? `${rawDate} 08:00:00` : _wwexDate(new Date());

    let shopPayload;

    if (productType === 'SMALLPACK') {
      shopPayload = {
        productType: 'SMALLPACK',
        returnSelectedServiceOnly: false,
        service: service || null,
        shipment: {
          shipmentDate,
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
          handlingUnitList: hus.map(pkg => ({
            billedDimension: {
              length: { value: pkg.length || null, unit: 'IN', dimensionType: 'NET' },
              width:  { value: pkg.width  || null, unit: 'IN' },
              height: { value: pkg.height || null, unit: 'IN' },
            },
            packagingType:     '02',
            packagingTypeName: 'Custom',
            quantity:          pkg.count || pkg.quantity || 1,
            shippedItemList: [{
              additionalHandlingFeeFlag: false,
              weight: { value: pkg.grossWeight || pkg.weight || 0, unit: 'LBS' },
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
      // LTL — field names from official Postman collection
      const b = req.body;
      const totalHUWeight = hus.reduce((sum, hu) => sum + (Number(hu.grossWeight || hu.weight) || 0), 0);
      const totalHUCount  = hus.reduce((sum, hu) => sum + (Number(hu.count || hu.quantity)     || 1), 0);
      shopPayload = {
        productType: 'LTL',
        shipment: {
          shipmentDate,
          appointmentDeliveryFlag:      !!b.appointmentDelivery,
          holdAtTerminalFlag:           !!b.dropAtTerminal,
          insideDeliveryFlag:           !!b.insideDelivery,
          insidePickupFlag:             !!b.insidePickup,
          liftgateDeliveryFlag:         !!b.liftgateDelivery,
          liftgatePickupFlag:           !!b.liftgatePickup,
          residentialPickupFlag:        !!b.residentialPickup,
          constructionSiteDeliveryFlag: !!b.constructionDelivery,
          constructionSitePickupFlag:   !!b.constructionPickup,
          notifyBeforeDeliveryFlag:     !!b.notifyBeforeDelivery,
          protectionFromColdFlag:       !!b.protectionFromCold,
          sortAndSegregateFlag:         false,
          tradeshowDeliveryFlag:        !!b.tradeshowDelivery,
          tradeshowDeliveryName:        b.tradeshowDeliveryName || '',
          tradeshowPickupFlag:          !!b.tradeshowPickup,
          tradeshowPickupName:          b.tradeshowPickupName   || '',
          totalHandlingUnitCount: totalHUCount,
          totalWeight: { value: totalHUWeight, unit: 'LB' },
          originAddress: {
            address: {
              addressLineList: [origin.address1].filter(Boolean),
              locality:    origin.city,
              region:      origin.state,
              postalCode:  origin.zip,
              countryCode: origin.country || 'US',
              ...(origin.company ? { companyName: origin.company } : {}),
              contactList: [{
                firstName:   '',
                lastName:    origin.name  || '',
                phone:       origin.phone || '',
                contactType: 'SENDER',
              }],
            },
            locationType: null,
          },
          destinationAddress: {
            address: {
              addressLineList: [destination.address1].filter(Boolean),
              locality:    destination.city,
              region:      destination.state,
              postalCode:  destination.zip,
              countryCode: destination.country || 'US',
              ...(destination.company ? { companyName: destination.company } : {}),
              contactList: [{
                firstName:   '',
                lastName:    destination.name  || '',
                phone:       destination.phone || '',
                contactType: 'RECEIVER',
              }],
            },
            locationType: null,
          },
          handlingUnitList: hus.map(hu => {
            const comm0    = (hu.commodities && hu.commodities[0]) || {};
            const huWeight = Number(hu.grossWeight || hu.weight) || 0;
            const items    = (hu.commodities && hu.commodities.length) ? hu.commodities : [comm0];
            return {
              packagingType: hu.huType || hu.packagingType || 'PLT',
              quantity:      Number(hu.count || hu.quantity) || 1,
              isStackable:   !!(hu.stackable || hu.isStackable),
              isMixedClass:  false,
              weight: { value: huWeight, unit: 'LB' },
              ...(hu.length && hu.width && hu.height ? {
                billedDimension: {
                  length: { value: String(hu.length), unit: 'in' },
                  width:  { value: String(hu.width),  unit: 'in' },
                  height: { value: String(hu.height), unit: 'in' },
                  dimensionType: 'NET',
                },
              } : {}),
              shippedItemList: items.map(c => ({
                commodityClass:       c.freightClass || comm0.freightClass || '',
                commodityDescription: c.description  || comm0.description  || '',
                NMFCNbr:              ((c.nmfcCode || hu.nmfcCode || '').split('-')[0]) || null,
                quantity:             String(c.pieces || 1),
                isHazMat:             false,
                weight: { value: Number(c.weight || huWeight) || 0, unit: 'LB' },
              })),
            };
          }),
        },
      };
    }

    console.log('[shipping] shopFlow payload:', JSON.stringify(shopPayload, null, 2));
    const result = await wwex.shopFlow(shopPayload, productType);
    // Return the original shipment object so the client can echo it back in quoteOrderFlow.
    // WWEX requires the full shipment (handlingUnitList, freight flags, etc.) in the booking.
    res.json({ ...result, shopShipment: shopPayload.shipment || null });
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
    // Default pickup date = today if not provided
    const pDate = pickupDate || new Date().toISOString().split('T')[0];
    const bookPayload = {
      mode:                         'SAVE',
      shipmentProductTransactionId: productTransactionId,
      shipmentOfferId:              offerId,
      isSelfScheduled:              false,
      pickupDate:                   `${pDate} 00:00:00`,
      readyTime:                    pickupReadyTime,
      closeTime:                    pickupCloseTime,
      shipment,
    };

    console.log('[shipping] quoteOrderFlow payload:', JSON.stringify(bookPayload, null, 2));
    const booked = await wwex.quoteOrderFlow(bookPayload, productType);
    console.log('[shipping] quoteOrderFlow result:', JSON.stringify(booked, null, 2));
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
      SELECT o.id, o.order_number, o.total, o.status, o.created_at,
             COALESCE(CONCAT(c.first_name,' ',c.last_name), o.guest_email) AS customer_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
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
