'use strict';

/**
 * wwexService.js
 * Worldwide Express (WWEX) SpeedShip V4 API client.
 *
 * Auth:  POST https://auth.{env}-wwex.com/oauth/token  (client_credentials)
 * Flows: POST https://speedship.{env}-wwex.com/svc/{flowName}
 *
 * Required .env vars (add to server — never in chat):
 *   WWEX_CLIENT_ID       — from WWEX (may differ per product type; use LTL creds if one pair)
 *   WWEX_CLIENT_SECRET   — from WWEX
 *   WWEX_SP_CLIENT_ID    — optional: separate SMALLPACK client_id (falls back to WWEX_CLIENT_ID)
 *   WWEX_SP_CLIENT_SECRET— optional: separate SMALLPACK client_secret
 *   WWEX_ENV             — 'staging' (default) | 'production'
 *
 * When credentials are absent, all methods return realistic stub responses
 * so the admin UI works before credentials are wired.
 *
 * Flows implemented:
 *   shopFlow             — rate shop (get carrier quotes)
 *   quoteOrderFlow       — book shipment (uses IDs from shopFlow response)
 *   schedulePickupFlow   — schedule UPS pickup (SMALLPACK)
 *   searchShipmentsFlow  — track by BOL# or PRO#
 *   integratedCancelFlow — cancel booked shipment
 *   documentDownloadFlow — download BOL, POD, etc.
 *   addressValidationFlow— validate/normalize an address
 */

const axios = require('axios');

/* ── Environment ──────────────────────────────────────────────── */
const WWEX_ENV = process.env.WWEX_ENV === 'production' ? 'production' : 'staging';

const AUTH_BASE = WWEX_ENV === 'production'
  ? 'https://auth.wwex.com'
  : 'https://auth.staging-wwex.com';

const API_BASE = WWEX_ENV === 'production'
  ? 'https://speedship.wwex.com/svc'
  : 'https://speedship.staging-wwex.com/svc';

const AUDIENCE = WWEX_ENV === 'production' ? 'wwex-apig' : 'staging-wwex-apig';

/* ── Credential detection ─────────────────────────────────────── */
const HAS_CREDS = !!(process.env.WWEX_CLIENT_ID && process.env.WWEX_CLIENT_SECRET);

// LTL credentials (primary)
const LTL_CLIENT_ID     = process.env.WWEX_CLIENT_ID;
const LTL_CLIENT_SECRET = process.env.WWEX_CLIENT_SECRET;

// SMALLPACK credentials — falls back to LTL creds if not separately provided
const SP_CLIENT_ID     = process.env.WWEX_SP_CLIENT_ID     || LTL_CLIENT_ID;
const SP_CLIENT_SECRET = process.env.WWEX_SP_CLIENT_SECRET || LTL_CLIENT_SECRET;

/* ── Token cache (separate per product type) ──────────────────── */
const _tokens = {
  LTL:       { token: null, expiry: 0, clientId: LTL_CLIENT_ID, clientSecret: LTL_CLIENT_SECRET },
  SMALLPACK: { token: null, expiry: 0, clientId: SP_CLIENT_ID,  clientSecret: SP_CLIENT_SECRET  },
};

async function getToken(productType = 'LTL') {
  const cache = _tokens[productType] || _tokens.LTL;
  if (cache.token && Date.now() < cache.expiry) return cache.token;

  const res = await axios.post(
    `${AUTH_BASE}/oauth/token`,
    new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     cache.clientId,
      client_secret: cache.clientSecret,
      audience:      AUDIENCE,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 }
  );

  cache.token  = res.data.access_token;
  cache.expiry = Date.now() + (res.data.expires_in - 60) * 1000;
  return cache.token;
}

/* ── HTTP helper ──────────────────────────────────────────────── */
async function call(flowName, body, productType = 'LTL') {
  const token = await getToken(productType);
  const res = await axios.post(
    `${API_BASE}/${flowName}`,
    body,
    {
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    }
  );
  return res.data;
}

/* ── Error normalisation ──────────────────────────────────────────
   WWEX returns errors as a JSON object, not a string. Passing that
   object straight back to the browser produced "Error: [object Object]"
   in the admin UI (seen on Void Shipment). Every flow must return a
   human-readable STRING in `error`.

   WWEX V4 puts the useful text in clientStatus.message; older/other
   shapes use message, description, or an errors[] array.
─────────────────────────────────────────────────────────────────── */
function _errMsg(err) {
  const d = err && err.response ? err.response.data : null;
  if (!d) return (err && err.message) || 'Unknown error';
  if (typeof d === 'string') return d;
  return d.clientStatus?.message
      || d.message
      || d.description
      || (Array.isArray(d.errors)
            ? d.errors.map(e => e.message || e.description || JSON.stringify(e)).join('; ')
            : null)
      || JSON.stringify(d);
}

/* ── Stub helpers ─────────────────────────────────────────────── */
function _addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

const STUB_RATES_LTL = [
  { offerId: 'STUB-LTL-001', carrier: 'Estes Express', serviceLevel: 'LTL Standard', transitDays: 5,
    estimatedDelivery: _addDays(new Date(),7).toISOString().split('T')[0], totalCharge: 324.50, currency: 'USD', stub: true },
  { offerId: 'STUB-LTL-002', carrier: 'Southeastern Freight Lines', serviceLevel: 'LTL Standard', transitDays: 4,
    estimatedDelivery: _addDays(new Date(),6).toISOString().split('T')[0], totalCharge: 289.00, currency: 'USD', stub: true },
  { offerId: 'STUB-LTL-003', carrier: 'XPO Logistics', serviceLevel: 'LTL Economy', transitDays: 7,
    estimatedDelivery: _addDays(new Date(),9).toISOString().split('T')[0], totalCharge: 241.75, currency: 'USD', stub: true },
];

const STUB_RATES_SP = [
  { offerId: 'STUB-SP-001', carrier: 'UPS', serviceLevel: 'UPS Ground', service: 'GND', transitDays: 4,
    estimatedDelivery: _addDays(new Date(),5).toISOString().split('T')[0], totalCharge: 38.50, currency: 'USD', stub: true },
  { offerId: 'STUB-SP-002', carrier: 'UPS', serviceLevel: 'UPS 2nd Day Air', service: '2DA', transitDays: 2,
    estimatedDelivery: _addDays(new Date(),3).toISOString().split('T')[0], totalCharge: 89.25, currency: 'USD', stub: true },
];

/* ───────────────────────────────────────────────────────────────
   _proseScan — find human-readable text ANYWHERE in a response

   Written to answer one question: does WWEX return the carrier rules
   that SpeedShip's own UI shows us, or does it only show them there?

   Two carrier rules are visible on speedship.com and reach us nowhere:

     RL Carriers  a BLOCKING modal on rate selection — 'R&L requires that
                  each handling unit display both shipper and consignee
                  information...' (~250 chars, Accept / Cancel)
     TForce       an INLINE banner, no acknowledgement — 'Any pickup request
                  received after 3pm shipper's local time will be scheduled
                  for the following business day.'

   Verified 2026-09-03 by clicking the rate for all 12 carriers on a
   Marietta GA -> Chicago IL quote: those two, nobody else.

   Scanning by VALUE rather than by key name is deliberate. We do not know
   what such a field would be called, and guessing names ('note', 'message',
   'disclaimer') can only confirm guesses — it cannot tell us we guessed
   wrong. Prose is self-identifying: a long string with spaces in it is not
   an id, a SCAC or a price, whatever the field is named.
   ─────────────────────────────────────────────────────────────── */
function _proseScan(root, { minLen = 40, maxHits = 40, maxDepth = 8 } = {}) {
  const hits = [];
  const seen = new WeakSet();
  (function walk(node, path, depth) {
    if (hits.length >= maxHits || depth > maxDepth || node == null) return;
    if (typeof node === 'string') {
      // Prose = long enough, and contains a space. Ids and SCACs have neither.
      if (node.length >= minLen && /\s/.test(node)) {
        hits.push({ path, len: node.length, value: node.slice(0, 400) });
      }
      return;
    }
    if (typeof node !== 'object') return;
    if (seen.has(node)) return;              // cycles
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`, depth + 1));
    } else {
      for (const k of Object.keys(node)) walk(node[k], path ? `${path}.${k}` : k, depth + 1);
    }
  })(root, '', 0);
  return hits;
}

/* ═══════════════════════════════════════════════════════════════
   shopFlow — rate shop
   Returns { ok, productTransactionId, rates[] } where each rate has offerId.
   productType: 'LTL' | 'SMALLPACK'

   opts.diag — attach a _diag block to the return describing the RAW
   response. Off unless explicitly requested; see _proseScan above and
   the ?diag=1 gate in shippingController.getRates.
   ═══════════════════════════════════════════════════════════════ */
exports.shopFlow = async (payload, productType = 'LTL', opts = {}) => {
  if (!HAS_CREDS) {
    const rates = productType === 'SMALLPACK' ? STUB_RATES_SP : STUB_RATES_LTL;
    return { ok: true, productTransactionId: `STUB-TXN-${Date.now()}`, rates, stub: true };
  }
  try {
    const data = await call('shopFlow', { request: payload }, productType);
    const resp = data.response || data;
    // Diagnostic: log where productTransactionId lives (root vs per-offer)
    console.log('[wwex] shopFlow resp keys:', Object.keys(resp));
    console.log('[wwex] shopFlow resp.productTransactionId:', resp.productTransactionId);
    const rawOffers = resp.offerList || resp.rateList || resp.quoteList || resp.offers || [];
    if (!rawOffers.length) {
      console.warn('[wwex] shopFlow: no offers in response keys:', Object.keys(resp));
    } else {
      // Log offer[0] keys and its productTransactionId so we know where to pull it from
      console.log('[wwex] shopFlow offer[0] keys:', Object.keys(rawOffers[0]));
      console.log('[wwex] shopFlow offer[0].productTransactionId:', rawOffers[0]?.productTransactionId);
      console.log('[wwex] shopFlow offer[0] offerId:', rawOffers[0]?.offerId,
        '  offeredProductList[0].offeredProductId:', rawOffers[0]?.offeredProductList?.[0]?.offeredProductId);
    }
    // Log offer structure so we can see how many products each offer contains
    rawOffers.forEach((o, i) => {
      const carrier = o.primaryVendor?.preferredName || o.primaryVendor?.scac || '—';
      const prodCount = (o.offeredProductList || []).length;
      const levels = (o.offeredProductList || []).map(
        p => p.shopRQShipment?.timeInTransit?.serviceLevel || '?'
      );
      console.log(`[wwex] shopFlow offer[${i}] carrier=${carrier} products=${prodCount} levels=${levels.join(',')}`);
    });

    // flatMap over ALL products per offer so we never miss a Guaranteed variant
    // (WWEX may put Standard + Guaranteed as separate products within one offer,
    //  or as separate offers — flatMap handles both correctly)
    const offers = rawOffers.flatMap(o => {
      const carrier   = o.primaryVendor?.preferredName || o.primaryVendor?.scac || '—';
      const products  = (o.offeredProductList || []);
      // If no products array, fall back to one row using offer-level price
      if (!products.length) {
        return [{
          offerId:          o.offerId || '',
          // Each offer carries its own productTransactionId. Send the one that
          // belongs to the offer the user actually books rather than assuming
          // offer[0]'s id is valid for every carrier in the session.
          productTransactionId: o.productTransactionId || null,
          offeredProductId: null,
          carrier,
          serviceLevel:     'Standard',
          transitDays:      null,
          estimatedDelivery: null,
          totalCharge:      Number(o.totalOfferPrice?.value ?? o.totalOfferPrice ?? 0),
          currency:         o.totalOfferPrice?.unit || 'USD',
        }];
      }
      return products.map(prod => {
        const tit      = prod.shopRQShipment?.timeInTransit || {};
        const rawSvc   = tit.serviceLevel || '';
        const serviceLevel = rawSvc
          ? rawSvc.charAt(0).toUpperCase() + rawSvc.slice(1).toLowerCase()
          : 'Standard';
        const price    = prod.offerPrice ?? o.totalOfferPrice;
        return {
          offerId:          o.offerId || '',
          productTransactionId: o.productTransactionId || null,   // per-offer, see note above
          offeredProductId: prod.offeredProductId || null,
          carrier,
          serviceLevel,
          transitDays:      tit.transitDays  ?? null,
          estimatedDelivery: tit.estimatedDeliveryDate || null,
          totalCharge:      typeof price === 'object' ? Number(price?.value ?? 0) : Number(price ?? 0),
          currency:         (typeof price === 'object' ? price?.unit : null) || 'USD',
        };
      });
    });
    /* CORRECTED 2026-08-31 against a real response: productTransactionId is
       PER-OFFER (offerList[n].productTransactionId), NOT at the response root.
       resp.productTransactionId is always undefined — the root keys are
       nonSMC3ScacList, scacList, manualShopFlow, cubicMinApplicable,
       offerList, message.

       This session-level value is kept only as a fallback for older clients.
       Each rate row now carries its own productTransactionId and the booking
       uses the one belonging to the selected offer. */
    const txnId = rawOffers[0]?.productTransactionId || resp.productTransactionId || null;
    console.log('[wwex] shopFlow fallback productTransactionId (offer[0]):', txnId);
    const distinctTxn = [...new Set(rawOffers.map(o => o.productTransactionId).filter(Boolean))];
    if (distinctTxn.length > 1) {
      console.warn('[wwex] offers carry', distinctTxn.length,
                   'DIFFERENT productTransactionIds — per-offer id is required, not optional.');
    }
    const out = { ok: true, productTransactionId: txnId, rates: offers };

    /* ── Diagnostic, only when explicitly asked for ────────────────
       Reports the SHAPE of the raw response, not a reading of it.
       Whether any of this is a carrier rule is a judgement call for
       whoever reads it — the scan does not guess. */
    if (opts.diag) {
      const o0 = rawOffers[0] || null;
      out._diag = {
        respKeys:     Object.keys(resp),
        respMessage:  typeof resp.message === 'string'
                        ? resp.message.slice(0, 500)
                        : (resp.message ? `[${typeof resp.message}] ${JSON.stringify(resp.message).slice(0, 300)}` : null),
        offerCount:   rawOffers.length,
        offerKeys:    o0 ? Object.keys(o0) : [],
        vendorKeys:   o0?.primaryVendor ? Object.keys(o0.primaryVendor) : [],
        productKeys:  o0?.offeredProductList?.[0] ? Object.keys(o0.offeredProductList[0]) : [],
        /* The decisive part. Any prose ANYWHERE in the response, by value
           rather than by key name — see _proseScan. If RL's labeling rule
           or TForce's 3pm cutoff is in this payload, it lands here whatever
           the field is called. If this comes back empty, the API does not
           carry carrier rules and no amount of field-name guessing will
           change that. */
        prose:        _proseScan(resp),
        carriers:     rawOffers.map(o => o.primaryVendor?.preferredName
                                      || o.primaryVendor?.scac || '—'),

        /* ROUND 2 — 2026-09-03.

           Round 1 answered the prose question: NO. The only prose in the
           whole response was specialInstructions, identical on all six
           offers, and it is OUR OWN input echoed back. RL's labeling rule
           and TForce's 3pm cutoff are not in this payload as text.

           But primaryVendor turned out to carry STRUCTURED operational
           fields we had never looked at:

             latestPickupTime   pickupWindow   pickupDays
             businessHours      commentList    coverageDetails

           latestPickupTime is plausibly TForce's 3pm cutoff expressed as
           data rather than a sentence — which would be BETTER than the
           banner, because a time can be compared against the ship date
           instead of read by a human. commentList is the likeliest home
           for anything RL-shaped.

           These are short values, so the prose scan could never have
           caught them: '15:00' is not prose. Reporting them by name is
           correct here precisely BECAUSE we now know the names. */
        vendorOps: rawOffers.map(o => {
          const v = o.primaryVendor || {};
          const pick = {};
          for (const k of ['latestPickupTime', 'pickupWindow', 'pickupDays',
                           'businessHours', 'commentList', 'coverageDetails',
                           'notificationWindow', 'carrierCategory']) {
            if (v[k] === undefined) continue;
            if (typeof v[k] !== 'object' || v[k] === null) { pick[k] = v[k]; continue; }
            /* Serialise to a capped STRING. Do NOT slice JSON and re-parse:
               any object over the cap yields truncated JSON and JSON.parse
               throws — inside shopFlow's try/catch that surfaces as
               'ok:false' and a dead rate shop. It would have failed hardest
               on commentList, the biggest field and the one most likely to
               hold what we are looking for. */
            const s = JSON.stringify(v[k]);
            pick[k] = s.length > 600 ? s.slice(0, 600) + `…[truncated, ${s.length} chars]` : s;
          }
          return { carrier: v.preferredName || v.scac || '—', scac: v.scac || null, ...pick };
        }),
      };
      console.log('[wwex][diag] prose hits:', out._diag.prose.length,
                  '| resp.message:', JSON.stringify(out._diag.respMessage));
    }
    return out;
  } catch (err) {
    // Log full error so we can debug validation failures
    console.error('[wwex] shopFlow error | status:', err.response?.status);
    console.error('[wwex] shopFlow full error body:', JSON.stringify(err.response?.data, null, 2));
    return { ok: false, error: _errMsg(err) };
  }
};

/* ═══════════════════════════════════════════════════════════════
   quoteOrderFlow — book shipment
   Requires productTransactionId + offerId from shopFlow.
   Returns { ok, bolNumber, proNumber, bolUrl, productTransactionId }
   ═══════════════════════════════════════════════════════════════ */
exports.quoteOrderFlow = async (payload, productType = 'LTL') => {
  if (!HAS_CREDS) {
    const bol = `BOL-${Date.now()}`;
    return { ok: true, bolNumber: bol, proNumber: null, bolUrl: null,
             productTransactionId: payload.shipmentProductTransactionId, stub: true };
  }
  try {
    const data = await call('quoteOrderFlow', { request: payload }, productType);
    console.log('[wwex] quoteOrderFlow raw response:', JSON.stringify(data, null, 2));
    const resp = data.response || data;

    /* ─────────────────────────────────────────────────────────────
       Response shape — VERIFIED against a real booking 2026-08-31.
       Nothing here is guessed; every path below was read from an actual
       quoteOrderFlow response (BOL ATE34769194, order BVO-20260002).

       The useful values are nested two responses deep. Earlier code looked
       for resp.bolNumber / resp.proNumber / resp.pickupTxnId at the top
       level — none of those keys exist, which is why BOL and PRO came back
       null and the Shipments list showed "—".

         resp.pickupOrderResponse.order.orderedItemList[0]
              .pickupTxnId            ← REQUIRED to void an LTL shipment
              .secondaryTxnIdList[]   ← PRO / PRN / BILL_OF_LADING / etc.

         resp.shipmentOrderResponse.order
              .orderId                ← the BOL number, e.g. "ATE34769194"
              .quoteNumber            ← e.g. "Q14293357"
              .combinedLabel          ← s3 filename of the merged PDF
              .orderedItemList[0].documentList[]  ← BOL / QUOTE /
                                        PACKING_LIST / PALLET_LABEL
    ───────────────────────────────────────────────────────────────── */
    const pickupItem   = resp.pickupOrderResponse?.order?.orderedItemList?.[0]   || {};
    const shipOrder    = resp.shipmentOrderResponse?.order                        || {};
    const shipItem     = shipOrder.orderedItemList?.[0]                           || {};

    /** Pull a value out of a secondaryTxnIdList by its `type`. */
    const _secondary = (list, type) =>
      (list || []).find(x => x && x.type === type)?.value || null;

    const pickupTxnId = pickupItem.pickupTxnId || null;

    // BOL: shipmentOrderResponse.order.orderId is authoritative; the
    // secondaryTxnIdList entries are a cross-check / fallback.
    const bolNumber = shipOrder.orderId
                   || _secondary(shipItem.secondaryTxnIdList,   'BILL_OF_LADING')
                   || _secondary(pickupItem.secondaryTxnIdList, 'BILL_OF_LADING')
                   || null;

    // PRO comes back on the PICKUP order, not the shipment order.
    const proNumber = _secondary(pickupItem.secondaryTxnIdList, 'PRO') || null;

    console.log('[wwex] quoteOrderFlow parsed → BOL:', bolNumber,
                '| PRO:', proNumber, '| pickupTxnId:', pickupTxnId);
    if (!pickupTxnId) {
      console.warn('[wwex] NO pickupTxnId — voiding this LTL shipment from BVO will fail. ' +
                   'Expected at response.pickupOrderResponse.order.orderedItemList[0].pickupTxnId');
    }

    return {
      ok:                   true,
      pickupTxnId,
      bolNumber,
      proNumber,
      // PRN — the carrier's pickup reference number, useful when calling them
      pickupReferenceNumber: _secondary(pickupItem.secondaryTxnIdList, 'PRN'),
      quoteNumber:          shipOrder.quoteNumber || null,
      vendorId:             shipItem.vendorId     || null,
      // Documents are returned as s3 filenames, not URLs — fetch them via
      // documentDownloadFlow using the productTransactionId.
      documentList:         shipItem.documentList || [],
      combinedLabel:        shipOrder.combinedLabel || null,
      bolUrl:               null,   // WWEX returns no direct URL; see documentDownloadFlow
      productTransactionId: payload.shipmentProductTransactionId,
      trackingUrl:          null,
      _raw:                 resp,   // keep for one deploy so we can see field names
    };
  } catch (err) {
    console.error('[wwex] quoteOrderFlow error:', err.response?.data || err.message);
    return { ok: false, error: _errMsg(err) };
  }
};

/* ═══════════════════════════════════════════════════════════════
   schedulePickupFlow — schedule UPS pickup (SMALLPACK only)
   ═══════════════════════════════════════════════════════════════ */
exports.schedulePickupFlow = async (payload) => {
  if (!HAS_CREDS) {
    return { ok: true, confirmationNumber: `PICKUP-${Date.now()}`, stub: true };
  }
  try {
    const data = await call('schedulePickupFlow', { request: payload }, 'SMALLPACK');
    const resp = data.response || data;
    return { ok: true, confirmationNumber: resp.confirmationNumber || resp.pickupConfirmationCode };
  } catch (err) {
    console.error('[wwex] schedulePickupFlow error:', err.response?.data || err.message);
    return { ok: false, error: _errMsg(err) };
  }
};

/* ═══════════════════════════════════════════════════════════════
   searchShipmentsFlow — track by BOL or PRO
   type: 'BOL' | 'PRO'
   Returns { ok, shipments[] }
   ═══════════════════════════════════════════════════════════════ */
exports.searchShipmentsFlow = async (trackingNumbers, type = 'BOL', productType = 'LTL') => {
  if (!HAS_CREDS) {
    return {
      ok: true, stub: true,
      shipments: trackingNumbers.map(n => ({
        trackingNumber: n, type,
        status: 'IN_TRANSIT', carrier: 'Estes Express',
        estimatedDelivery: _addDays(new Date(), 2).toISOString().split('T')[0],
        events: [{ timestamp: new Date().toISOString(), location: 'Charlotte, NC', description: 'In transit' }],
        trackingUrl: null,
      })),
    };
  }
  try {
    const data = await call('searchShipmentsFlow', {
      request: { trackingInfoList: trackingNumbers, type }
    }, productType);
    const resp = data.response || data;
    const shipments = (resp.shipmentList || resp.shipments || [resp]).map(s => ({
      trackingNumber:    s.bolNumber || s.proNumber || s.trackingNumber,
      bol:               s.bolNumber,
      pro:               s.proNumber,
      status:            s.status || s.shipmentStatus,
      carrier:           s.carrierName || s.carrier,
      estimatedDelivery: s.estimatedDeliveryDate || s.estimatedDelivery,
      deliveredDate:     s.deliveredDate,
      events:            s.trackingEventList || s.events || [],
      trackingUrl:       s.trackingUrl || null,
    }));
    return { ok: true, shipments };
  } catch (err) {
    console.error('[wwex] searchShipmentsFlow error:', err.response?.data || err.message);
    return { ok: false, error: _errMsg(err) };
  }
};

/* ═══════════════════════════════════════════════════════════════
   integratedCancelFlow — void/cancel a booked shipment
   productTransactionIds: string[]
   ═══════════════════════════════════════════════════════════════ */
exports.integratedCancelFlow = async (productTransactionIds, productType = 'LTL') => {
  if (!HAS_CREDS) {
    return { ok: true, cancelled: productTransactionIds, stub: true };
  }
  try {
    const data = await call('integratedCancelFlow', {
      request: { cancelRQList: productTransactionIds.map(id => ({ productTransactionId: id })) }
    }, productType);
    const resp = data.response || data;
    return { ok: true, result: resp };
  } catch (err) {
    // Full body logged so a void failure can be diagnosed from the server log
    // rather than the (now normalised) one-line message alone.
    console.error('[wwex] integratedCancelFlow error | status:', err.response?.status);
    console.error('[wwex] integratedCancelFlow full error body:', JSON.stringify(err.response?.data, null, 2));
    return { ok: false, error: _errMsg(err) };
  }
};

/* ═══════════════════════════════════════════════════════════════
   documentDownloadFlow — fetch BOL, POD, etc.
   docType: 'BILL_OF_LADING' | 'PROOF_OF_DELIVERY' | 'PACKING_LIST' | etc.
   Returns { ok, base64, contentType } — caller streams to browser
   ═══════════════════════════════════════════════════════════════ */
exports.documentDownloadFlow = async (productTransactionId, docType = 'BILL_OF_LADING', productType = 'LTL') => {
  if (!HAS_CREDS) {
    return { ok: false, stub: true, error: 'Stub mode — no real document available' };
  }
  try {
    const data = await call('documentDownloadFlow', {
      request: {
        downloadMode:    'SINGLE',
        docTypes:        [docType],
        transactionType: productType,
        referenceMap:    { PRODUCT_TRANSACTION_ID: productTransactionId },
      }
    }, productType);
    const resp = data.response || data;

    /* CONFIRMED BY WWEX SUPPORT 2026-08-31 (they ran our exact request against
       our staging credentials). The response carries BOTH:
         fileContent — base64 of the PDF
         a download link — valid for only 60 SECONDS before it expires
       Earlier code looked for `document` / `base64Document` / `content`, none
       of which exist, which is why the BOL button returned nothing.

       We prefer fileContent and stream the bytes ourselves rather than
       redirecting the browser to the link — a 60-second expiry is far too
       short to survive a redirect plus the user's click. */
    const doc = resp.documentList?.[0] || resp;
    const base64 = resp.fileContent
                || doc.fileContent
                || resp.document || resp.base64Document || resp.content
                || null;
    const url = resp.url || resp.link || resp.downloadLink
             || doc.url || doc.link || doc.downloadLink || null;

    if (!base64) {
      console.warn('[wwex] documentDownloadFlow: no fileContent. resp keys:', Object.keys(resp));
      console.warn('[wwex] documentDownloadFlow raw:', JSON.stringify(resp, null, 2));
    }
    return {
      ok:          true,
      base64,
      // Fallback only. Expires in 60s — do not persist or hand to the browser late.
      url,
      contentType: resp.contentType || 'application/pdf',
    };
  } catch (err) {
    console.error('[wwex] documentDownloadFlow error:', err.response?.data || err.message);
    return { ok: false, error: _errMsg(err) };
  }
};

/* ═══════════════════════════════════════════════════════════════
   addressValidationFlow — validate and normalize an address
   ═══════════════════════════════════════════════════════════════ */
exports.addressValidationFlow = async (address, productType = 'LTL') => {
  if (!HAS_CREDS) {
    return { ok: true, valid: true, normalized: address, residential: false, stub: true };
  }
  try {
    const data = await call('addressValidationFlow', {
      request: {
        productType,
        addressList: [{
          addressLine1: address.addressLine1 || address.address1 || '',
          addressLine2: address.addressLine2 || address.address2 || '',
          city:         address.city   || address.locality || '',
          stateProvince:address.state  || address.region   || '',
          postalCode:   address.zip    || address.postalCode || '',
          country:      address.country || 'US',
          companyName:  address.company || '',
          phone:        address.phone   || '',
          contactName:  address.name    || '',
        }],
      }
    }, productType);
    const resp   = data.response || data;
    const result = (resp.addressList || [resp])[0] || {};
    return {
      ok:          true,
      valid:       result.isValid !== false,
      residential: result.isResidential || false,
      normalized:  result.normalizedAddress || result,
    };
  } catch (err) {
    console.error('[wwex] addressValidationFlow error:', err.response?.data || err.message);
    return { ok: false, error: _errMsg(err) };
  }
};

exports.apiMode = HAS_CREDS ? `SpeedShip V4 (${WWEX_ENV})` : 'stub';
exports.WWEX_ENV = WWEX_ENV;
