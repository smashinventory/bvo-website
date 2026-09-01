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

/* ─────────────────────────────────────────────────────────────────
   FIXED 2026-08-31 — these previously used `.catch(() => [])`, which
   swallowed EVERY database error with no log and no signal.

   That is how a booking succeeded at WWEX (BOL ATE34769194) while the
   local INSERT failed on a missing column: the error vanished, execution
   continued, and the UI reported "Shipment Booked". The shipment existed
   at the carrier with no record in our system — no BOL stored, no way to
   void or track it from the admin.

   They still resolve rather than throw (many callers are read paths that
   should degrade to an empty list), but nothing is silent any more.
   For writes that MUST NOT fail silently, use mustQuery() below.
───────────────────────────────────────────────────────────────────*/
function safeQuery(sql, p = []) {
  return bvoPool.query(sql, p).then(([r]) => r).catch(err => {
    console.error('[shipping] safeQuery FAILED:', err.code, err.sqlMessage || err.message);
    console.error('[shipping]   sql:', String(sql).replace(/\s+/g, ' ').slice(0, 200));
    return [];
  });
}
function safeQueryOne(sql, p = []) {
  return bvoPool.query(sql, p).then(([r]) => r[0] || null).catch(err => {
    console.error('[shipping] safeQueryOne FAILED:', err.code, err.sqlMessage || err.message);
    console.error('[shipping]   sql:', String(sql).replace(/\s+/g, ' ').slice(0, 200));
    return null;
  });
}

/** Like safeQuery but THROWS. Use for writes where losing the row is worse
 *  than showing an error — e.g. recording a shipment we already booked. */
function mustQuery(sql, p = []) {
  return bvoPool.query(sql, p).then(([r]) => r);
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
                  pieceType:    'CARTON',   // WWEX commodityType — 'CTN' is not a valid value
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
            pieceType:    'CARTON',   // WWEX commodityType — 'CTN' is not a valid value
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

/* ─────────────────────────────────────────────────────────────────
   WWEX locationType — the ONLY accepted values.
   Verified against SpeedshipAPI V4 Staging.postman_collection.json
   (/LTL/DOMESTIC/shopFlow, originAddress.locationType comment).
   'PIER_PORT_WARF' is spelled that way in the WWEX docs (sic).
   Anything not in this list is rejected/ignored by WWEX, so we
   whitelist rather than pass user input straight through.
───────────────────────────────────────────────────────────────────*/
const WWEX_LOCATION_TYPES = [
  'COMMERCIAL', 'AIRPORT', 'CONTAINER_FREIGHT_STATION', 'CONSTRUCTION',
  'DISTRIBUTION_CENTER', 'PIER_PORT_WARF', 'LIMITED_ACCESS',
  'GOVERNMENT_FACILITY', 'SECURED_LOCATION', 'RESIDENTIAL', 'TRADESHOW',
];

/** Return a valid WWEX locationType or null. Never passes junk to the API. */
function _locationType(v) {
  if (!v) return null;
  const up = String(v).toUpperCase().trim();
  return WWEX_LOCATION_TYPES.includes(up) ? up : null;
}

/** WWEX supports up to 3 address lines. Build the list from whatever we have. */
function _addressLines(a) {
  return [a.address1, a.address2, a.address3].filter(Boolean).slice(0, 3);
}

/* ─────────────────────────────────────────────────────────────────
   WWEX packagingType / commodityType — one shared enum (19 values).
   Verified against the Postman collection. NOTE: there is no 'OTH'.
   The legacy map translates BVO's old 3-letter codes, which were
   invented before the enum was known, so existing saved data and
   any cached form state keep working.
───────────────────────────────────────────────────────────────────*/
const WWEX_PACKAGING_TYPES = [
  'BAG', 'BALE', 'BOX', 'BUNDLE', 'CARTON', 'CASE', 'CRATE', 'CYLINDER',
  'DRUM', 'PAIL', 'PLT', 'PIECES', 'REEL', 'ROLL', 'SKID', 'TANK',
  'TOTE', 'TRAILER', 'TUBE',
];

const _LEGACY_PACKAGING = {
  DRM: 'DRUM',   // BVO legacy → WWEX
  RLL: 'ROLL',
  SKD: 'SKID',
  OTH: 'PIECES', // 'Other' is not a WWEX value; PIECES is the closest generic
  PALLET: 'PLT',
  PIECE: 'PIECES',
};

/** Return a valid WWEX packaging/commodity type, defaulting when unrecognised. */
function _packagingType(v, fallback = 'PLT') {
  const up = String(v || '').toUpperCase().trim();
  if (!up) return fallback;
  if (WWEX_PACKAGING_TYPES.includes(up)) return up;
  return _LEGACY_PACKAGING[up] || fallback;
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
      // Insurance — WWEX requires 4 co-dependent fields when insuring.
      // Field names verified against SpeedshipAPI V4 Staging.postman_collection.json
      // (/LTL/DOMESTIC/shopFlow). See SHIPPING_WWEX_BRIEF.md.
      const insureOn  = !!b.insure && Number(b.declaredValue) > 0;
      const insurance = insureOn ? {
        insuranceRequestFlag:     true,
        // 406 = Furniture & Large Items — correct category for vanities/cabinets.
        // Other valid: 400 General Merchandise, 407 Stonework, 408 Fragile Items.
        insuredCommodityCategory: b.insuredCategory || '406',
        insuredItemConditions:    'NEW',
        totalDeclaredValue:       { unit: 'USD', value: String(b.declaredValue) },
        insuredMarksNumbers:      '',
      } : { insuranceRequestFlag: false };

      // Handling charge — { value, unit } where unit is AMOUNT or PERCENT.
      const handlingCharge = (b.handlingCharge && Number(b.handlingChargeValue) > 0)
        ? { handlingCharge: {
              value: String(b.handlingChargeValue),
              unit:  b.handlingChargeUnit === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
            } }
        : {};

      shopPayload = {
        productType: 'LTL',
        shipment: {
          shipmentDate,
          appointmentDeliveryFlag:      !!b.appointment,
          // FIXED 2026-08-31: these two were crossed. "Hold Shipment at Terminal"
          // (a delivery service) is holdAtTerminalFlag; "Drop Shipment at Terminal"
          // (a pickup service) is carrierTerminalPickupFlag. Previously
          // holdAtTerminalFlag was fed by dropAtTerminal and acc_holdAtTerminal
          // was ignored entirely.
          holdAtTerminalFlag:           !!b.holdAtTerminal,
          carrierTerminalPickupFlag:    !!b.dropAtTerminal,
          insideDeliveryFlag:           !!b.insideDelivery,
          insidePickupFlag:             !!b.insidePickup,
          liftgateDeliveryFlag:         !!b.liftgateDelivery,
          liftgatePickupFlag:           !!b.liftgatePickup,
          residentialPickupFlag:        !!b.residentialPickup,
          // NOTE: there is NO residentialDeliveryFlag in the WWEX API.
          // Residential DELIVERY is expressed as
          // destinationAddress.locationType = 'RESIDENTIAL' (set below).
          constructionSiteDeliveryFlag: !!b.constructionDelivery,
          constructionSitePickupFlag:   !!b.constructionPickup,
          notifyBeforeDeliveryFlag:     !!b.notifyBeforeDelivery,
          // CONFIRMED BY WWEX SUPPORT 2026-08-31 — these ARE real API fields.
          // They are absent from the Postman collection, which is why an
          // earlier pass concluded they were unsupported and left the UI
          // checkboxes disconnected.
          groceryConsolidationPickupFlag:   !!b.groceryPickup,
          groceryConsolidationDeliveryFlag: !!b.groceryDelivery,
          // FIXED 2026-08-31: read b.protectFromFreeze (what create.ejs actually
          // sends). Was reading b.protectionFromCold, which is never sent.
          protectionFromColdFlag:       !!b.protectFromFreeze,
          // FIXED 2026-08-31: was hardcoded false, ignoring the checkbox.
          sortAndSegregateFlag:         !!b.sortAndSegregate,
          tradeshowDeliveryFlag:        !!b.tradeshowDelivery,
          tradeshowDeliveryName:        b.tradeshowDeliveryName || '',
          tradeshowPickupFlag:          !!b.tradeshowPickup,
          tradeshowPickupName:          b.tradeshowPickupName   || '',
          marksNumbers:                 b.marksNumbers || '',
          ...insurance,
          ...handlingCharge,
          totalHandlingUnitCount: totalHUCount,
          totalWeight: { value: totalHUWeight, unit: 'LB' },
          originAddress: {
            address: {
              addressLineList: _addressLines(origin),
              locality:    origin.city,
              region:      origin.state,
              postalCode:  String(origin.zip || '').trim().slice(0, 5),
              countryCode: origin.country || 'US',
              ...(origin.company ? { companyName: origin.company } : {}),
              contactList: [{
                firstName:   '',
                lastName:    (origin.name  || '').slice(0, 35),
                phone:       String(origin.phone || '').slice(0, 15),
                contactType: 'SENDER',
              }],
            },
            // Pickup/Limited Access Location Type — SpeedShip exposes this
            // separately from the delivery one. Whitelisted to the WWEX enum.
            locationType: _locationType(origin.locationType),
          },
          destinationAddress: {
            address: {
              addressLineList: _addressLines(destination),
              locality:    destination.city,
              region:      destination.state,
              postalCode:  String(destination.zip || '').trim().slice(0, 5),
              countryCode: destination.country || 'US',
              ...(destination.company ? { companyName: destination.company } : {}),
              contactList: [{
                firstName:   '',
                lastName:    (destination.name  || '').slice(0, 35),
                phone:       String(destination.phone || '').slice(0, 15),
                contactType: 'RECEIVER',
              }],
            },
            // Delivery/Limited Access Location Type. This is ALSO how residential
            // delivery is signalled — there is no residentialDeliveryFlag in the API.
            // If the user ticked "Residential", force RESIDENTIAL regardless of
            // whatever else the dropdown holds.
            locationType: (b.residential || b.residentialDelivery)
              ? 'RESIDENTIAL'
              : _locationType(destination.locationType),
          },
          handlingUnitList: hus.map(hu => {
            const comm0    = (hu.commodities && hu.commodities[0]) || {};
            const huWeight = Number(hu.grossWeight || hu.weight) || 0;
            const items    = (hu.commodities && hu.commodities.length) ? hu.commodities : [comm0];

            // Per-commodity weight. WWEX requires a weight on every shippedItem.
            // FIXED 2026-08-31: previously every commodity inherited the FULL handling
            // unit weight, so a 2-commodity pallet reported 2× its true weight.
            // Now: use the commodity's own weight when entered; otherwise split the
            // handling-unit weight evenly so the items sum back to the HU weight.
            const entered   = items.reduce((s, c) => s + (Number(c.weight) || 0), 0);
            const missing   = items.filter(c => !(Number(c.weight) > 0)).length;
            const perItemLB = missing > 0
              ? Math.max(0, (huWeight - entered)) / missing
              : 0;

            // isMixedClass must be true when the HU carries more than one freight class.
            const classes = [...new Set(
              items.map(c => String(c.freightClass || comm0.freightClass || '')).filter(Boolean)
            )];

            return {
              packagingType: _packagingType(hu.huType || hu.packagingType),
              quantity:      Number(hu.count || hu.quantity) || 1,
              isStackable:   !!(hu.stackable || hu.isStackable),
              isMixedClass:  classes.length > 1,
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
                // Piece Type. WWEX calls this commodityType; same enum as packagingType.
                commodityType:        _packagingType(c.pieceType, 'BOX'),
                // NMFCNbr: base number only (strip the -NN suffix), max 10 chars.
                NMFCNbr:              ((c.nmfcCode || hu.nmfcCode || '').split('-')[0] || '').slice(0, 10) || null,
                quantity:             String(c.pieces || 1),
                isHazMat:             !!c.isHazMat,
                hazMatItemInfo:       null,
                weight: {
                  value: Number(c.weight) > 0 ? Number(c.weight) : Number(perItemLB.toFixed(2)),
                  unit:  'LB',
                },
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

/* ─────────────────────────────────────────────────────────────────
   REMOVED 2026-08-31 — buildAccessorials()

   This function built an array of { code, description } accessorial
   objects (INP/LGP/RES/HAT/…). It was defined here but NEVER CALLED
   from anywhere in the codebase, so every accessorial it mapped was
   silently discarded.

   It was also the wrong shape: WWEX SpeedShip V4 does not take an
   accessorial code list. Each accessorial is an individual boolean
   flag on `shipment` (liftgateDeliveryFlag, holdAtTerminalFlag, …),
   and residential delivery is not a flag at all — it is
   destinationAddress.locationType = 'RESIDENTIAL'.

   All accessorials are now wired directly into the shopFlow payload
   in getRates(). Do not reintroduce a code-list builder.

   UPDATE 2026-08-31 — WWEX support answered both open items:

   • Grocery Consolidation IS supported. The fields are
     groceryConsolidationPickupFlag / groceryConsolidationDeliveryFlag
     (booleans). They are simply missing from the Postman collection.
     Now wired in getRates().

   • Billing terms are NOT a request field and never will be. Freight
     Terms are ALWAYS "Bill Third Party" with a fixed remit-to address:
         Carrier Payment Processing
         P O Box 192629, Dallas, TX 75219
         Customer Number: W0002746112
     The BVO billing dropdown was therefore misleading — it implied a
     choice that does not exist. Replaced with a fixed display.
───────────────────────────────────────────────────────────────────*/

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
      // Accepted from the client but INTENTIONALLY NOT SENT to WWEX — the field
      // shipmentOfferedProductId does not exist in the V4 Postman collection.
      // Kept in the signature so the client contract is unchanged; still stored
      // on the shipments row for our own service-level record.
      offeredProductId  = null,
      shipment,
      orderId         = null,
      carrier           = '',
      serviceLevel      = '',
      totalCharge       = 0,
      estimatedDelivery = null,   // from the selected rate — stored as est_delivery
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

    /* REWRITTEN 2026-08-31 — quoteOrderFlow.shipment is NOT a full echo of the
       shopFlow shipment. Per the V4 Postman collection (/LTL/DOMESTIC/
       quoteOrderFlow) it contains ONLY:
         originAddress, destinationAddress, shipmentReferenceList,
         pickupSpecialInstructions, deliverySpecialInstructions,
         handlingSpecialInstructions
       No handlingUnitList, no freight flags, no weights, no shipmentDate —
       WWEX already has all of that against the productTransactionId from the
       rate shop. Previously BVO echoed the entire shopFlow shipment here,
       sending far more than the endpoint accepts.

       Also removed: shipmentOfferedProductId. It does not appear anywhere in
       the Postman collection. Only shipmentProductTransactionId + shipmentOfferId
       are documented. See SHIPPING_WWEX_BRIEF.md corrections section. */

    /** Reshape an address for quoteOrderFlow: address-level phone is REQUIRED
     *  here (unlike shopFlow), and contacts carry email + extension. */
    const _bookAddr = (a, contactType) => {
      const addr    = (a && a.address) || {};
      const contact = (addr.contactList && addr.contactList[0]) || {};
      const phone   = String(contact.phone || addr.phone || '').slice(0, 15);
      return {
        address: {
          addressLineList: (addr.addressLineList || []).filter(Boolean).slice(0, 3),
          locality:    addr.locality    || '',
          region:      addr.region      || '',
          postalCode:  String(addr.postalCode || '').trim().slice(0, 5),
          countryCode: addr.countryCode || 'US',
          companyName: addr.companyName || '',
          phone,                                   // Required at address level
          contactList: [{
            firstName:   (contact.firstName || '').slice(0, 35),
            lastName:    (contact.lastName  || '').slice(0, 35),
            phone,
            contactType,
            email:       contact.email     || '',
            extension:   contact.extension || null,
          }],
        },
      };
    };

    const bookShipmentObj = {
      originAddress:      _bookAddr(shipment && shipment.originAddress,      'SENDER'),
      destinationAddress: _bookAddr(shipment && shipment.destinationAddress, 'RECEIVER'),
      // Up to 5 references supported; type and value each max 35 chars.
      shipmentReferenceList: (shipment && shipment.shipmentReferenceList || [])
        .filter(r => r && r.value)
        .slice(0, 5)
        .map(r => ({
          type:  String(r.type  || '').slice(0, 35),
          value: String(r.value || '').slice(0, 35),
        })),
      pickupSpecialInstructions:   String(req.body.pickupInstructions   || '').slice(0, 60),
      deliverySpecialInstructions: String(req.body.deliveryInstructions || '').slice(0, 60),
      handlingSpecialInstructions: String(req.body.handlingInstructions || '').slice(0, 82),
    };

    /* Guard: WWEX rejects the booking with "Destination Phone is required;
       exception: AppException" when address.phone is blank. Fail here with a
       clear message rather than spending a round trip to find out. Both
       origin and destination phone are Required in quoteOrderFlow. */
    if (!String(bookShipmentObj.destinationAddress.address.phone || '').replace(/\D/g, '')) {
      return res.status(400).json({
        ok: false,
        error: 'Destination Phone is required. Go back to Step 1 and add a phone number for the receiver — WWEX will not accept the booking without one.',
      });
    }
    if (!String(bookShipmentObj.originAddress.address.phone || '').replace(/\D/g, '')) {
      return res.status(400).json({
        ok: false,
        error: 'Origin Phone is required. Go back to Step 1 and add a phone number for the shipper.',
      });
    }

    /* Carrier-sent tracking alerts. WWEX emails these itself — nothing is sent
       from BVO. Per the /LTL/DOMESTIC/quoteOrderFlow sample, notificationGroups
       carries an emailList and an alertTypeList, and notificationGroupId is the
       shipment's productTransactionId. The docs also note that mode:'SAVE'
       exists specifically to enable these notifications.

       NOTE: SpeedShip's own web UI does NOT use this — it posts to an
       undocumented /svc/setAlertFlow endpoint instead. notificationGroups is
       the documented path, so it is what we use. If WWEX support confirms
       setAlertFlow is required, only this block and the service call change;
       the UI stays as-is. See WWEX_SUPPORT_REQUEST.md. */
    const notify = req.body.notify;
    const notificationGroups = (notify && notify.email && Array.isArray(notify.alerts) && notify.alerts.length)
      ? [{
          notificationSource: 'CUSTOM_SHIPMENT_PREFERENCE',
          notificationGroupId: productTransactionId,
          shipmentNotificationPreference: {
            emailList:     [String(notify.email).trim()],
            alertTypeList: notify.alerts,
          },
        }]
      : null;
    if (notificationGroups) {
      console.log('[shipping] notificationGroups →', notify.email, notify.alerts.join(', '));
    }

    const bookPayload = {
      mode:                         'SAVE',
      shipmentProductTransactionId: productTransactionId,
      shipmentOfferId:              offerId,
      ...(notificationGroups ? { notificationGroups } : {}),
      isSelfScheduled:              false,
      pickupDate:                   `${pDate} 00:00:00`,
      readyTime:                    pickupReadyTime,
      closeTime:                    pickupCloseTime,
      ...(req.body.customerBolNum ? { customerBolNum: String(req.body.customerBolNum).slice(0, 35) } : {}),
      shipment: bookShipmentObj,
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

    /* mustQuery, NOT safeQuery. At this point WWEX has already booked the
       shipment — the carrier has it. If we cannot record that locally we must
       NOT report success, because the operator would have no BOL, no way to
       void it, and no idea anything went wrong. The catch below surfaces the
       BOL so the booking is recoverable by hand. */
    try {
    await mustQuery(
      /* FIXED 2026-08-31 — three problems with this INSERT:
         1. ship_date and est_delivery exist in the schema but were never
            written, so both stayed NULL. The Shipments list rendered
            created_at under its "Ship Date" header, which meant the column
            always showed the BOOKING date and silently ignored the pickup
            date the user actually chose.
         2. origin_company was being fed addressLineList[0] — the street
            address — instead of the company name. There is no
            origin_address1 column, so the street simply is not stored
            (origin is always our own warehouse). */
      `INSERT INTO shipments
         (order_id, product_transaction_id, offer_id, product_type, bol_number, pro_number,
          bol_url, carrier, service_level, total_charge, status,
          ship_date, est_delivery, pickup_txn_id,
          origin_company, origin_city, origin_state, origin_zip,
          dest_company, dest_name, dest_address1, dest_city, dest_state, dest_zip,
          dest_phone, dest_email, pickup_confirmation, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())`,
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
        pDate,                                    // ship_date — the real pickup date
        estimatedDelivery || null,                // est_delivery — from the selected rate
        booked.pickupTxnId || null,               // pickup_txn_id — REQUIRED to void an LTL shipment
        orig.companyName || '',                   // was: street address (wrong column)
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
    } catch (dbErr) {
      /* The shipment IS booked at WWEX but we failed to record it. Report the
         failure loudly and hand back every identifier needed to recover it by
         hand, rather than returning ok:true over a lost row. */
      console.error('[shipping] *** BOOKED AT WWEX BUT INSERT FAILED ***');
      console.error('[shipping]   BOL:', booked.bolNumber, '| PRO:', booked.proNumber);
      console.error('[shipping]   productTransactionId:', booked.productTransactionId || productTransactionId);
      console.error('[shipping]   pickupTxnId:', booked.pickupTxnId);
      console.error('[shipping]   db error:', dbErr.code, dbErr.sqlMessage || dbErr.message);
      return res.status(500).json({
        ok: false,
        bookedAtCarrier: true,
        bolNumber:   booked.bolNumber,
        proNumber:   booked.proNumber,
        error:
          `The shipment WAS booked with the carrier (BOL ${booked.bolNumber || 'unknown'}), ` +
          `but saving it to the database failed: ${dbErr.sqlMessage || dbErr.message}. ` +
          `Record this BOL manually and void it in SpeedShip if it was not intended. ` +
          `Do not re-book — that would create a second shipment.`,
      });
    }

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

    /* LTL requires cancelling BOTH the shipment AND its associated pickup.
       Sending only the shipment id returns:
         "LTL does not support shipment only cancel; exception: AppException"
       Per /LTL/integratedCancelFlow in the V4 Postman collection, cancelRQList
       takes two entries: the shipment productTransactionId, and the pickup
       transaction id captured from the quoteOrderFlow response at booking time. */
    const row = await safeQueryOne(
      `SELECT product_transaction_id, pickup_txn_id, product_type
         FROM shipments WHERE id = ?`, [shipmentId]
    );
    const txnId = row?.product_transaction_id;
    if (!txnId) return res.status(404).json({ ok: false, error: 'Shipment not found' });

    const pType  = row.product_type || productType;
    const txnIds = [txnId];
    if (row.pickup_txn_id) txnIds.push(row.pickup_txn_id);

    if (pType === 'LTL' && !row.pickup_txn_id) {
      return res.status(409).json({
        ok: false,
        error: 'This shipment was booked before the pickup transaction ID was recorded, '
             + 'so it cannot be voided from here — WWEX rejects an LTL cancel that does not '
             + 'also cancel the pickup. Void it directly in the SpeedShip portal instead.',
      });
    }

    console.log('[shipping] integratedCancelFlow ids:', txnIds, 'productType:', pType);
    const result = await wwex.integratedCancelFlow(txnIds, pType);
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

    /* FIXED 2026-08-31 — documentDownloadFlow can return ok:true with no
       document body (the response key mapping is still unconfirmed). That
       crashed here with "Buffer.from(undefined)" and produced a 500 with a
       raw Node stack trace. Fail with a readable message instead. */
    // WWEX may hand back a link rather than bytes — follow it if so.
    if (!doc.base64 && doc.url) return res.redirect(doc.url);

    if (!doc.base64) {
      console.error('[shipping] documentDownloadFlow returned no document. keys:', Object.keys(doc));
      return res.status(502).send(
        `WWEX returned no ${docType} document for this shipment. ` +
        `Download it from the SpeedShip portal instead. ` +
        `(Server log has the raw response for diagnosis.)`
      );
    }

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
