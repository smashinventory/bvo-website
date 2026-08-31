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

/* ═══════════════════════════════════════════════════════════════
   shopFlow — rate shop
   Returns { ok, productTransactionId, rates[] } where each rate has offerId.
   productType: 'LTL' | 'SMALLPACK'
   ═══════════════════════════════════════════════════════════════ */
exports.shopFlow = async (payload, productType = 'LTL') => {
  if (!HAS_CREDS) {
    const rates = productType === 'SMALLPACK' ? STUB_RATES_SP : STUB_RATES_LTL;
    return { ok: true, productTransactionId: `STUB-TXN-${Date.now()}`, rates, stub: true };
  }
  try {
    const data = await call('shopFlow', { request: payload }, productType);
    const resp = data.response || data;
    const rawOffers = resp.offerList || resp.rateList || resp.quoteList || resp.offers || [];
    if (!rawOffers.length) {
      console.warn('[wwex] shopFlow: no offers in response keys:', Object.keys(resp));
    }
    // One entry per offer (Standard vs Guaranteed appear as separate offerList entries)
    const offers = rawOffers.map(o => {
      const carrier    = o.primaryVendor?.preferredName || o.primaryVendor?.scac || '—';
      const prod       = o.offeredProductList?.[0] || {};
      const tit        = prod.shopRQShipment?.timeInTransit || {};
      // serviceLevel, transitDays, estimatedDeliveryDate all live in shopRQShipment.timeInTransit
      const rawSvc     = tit.serviceLevel || '';
      const serviceLevel = rawSvc
        ? rawSvc.charAt(0).toUpperCase() + rawSvc.slice(1).toLowerCase()  // "STANDARD" → "Standard"
        : 'Standard';
      const transitDays  = tit.transitDays  ?? null;
      const deliveryDate = tit.estimatedDeliveryDate || null;
      // Per-product price confirmed as {unit, value} object
      const price        = prod.offerPrice ?? o.totalOfferPrice;
      return {
        offerId:          o.offerId || '',
        offeredProductId: prod.offeredProductId || null,
        carrier,
        serviceLevel,
        transitDays,
        estimatedDelivery: deliveryDate,
        totalCharge:      typeof price === 'object' ? Number(price?.value ?? 0) : Number(price ?? 0),
        currency:         (typeof price === 'object' ? price?.unit : null) || 'USD',
      };
    });
    return { ok: true, productTransactionId: rawOffers[0]?.productTransactionId, rates: offers };
  } catch (err) {
    const errData = err.response?.data;
    // Log full error so we can debug validation failures
    console.error('[wwex] shopFlow error | status:', err.response?.status);
    console.error('[wwex] shopFlow full error body:', JSON.stringify(errData, null, 2));
    // Normalize to human-readable string — check clientStatus.message first (WWEX V4 pattern)
    const errMsg = errData
      ? (typeof errData === 'string' ? errData
        : errData.clientStatus?.message || errData.message || errData.description
          || (Array.isArray(errData.errors) ? errData.errors.map(e => e.message || JSON.stringify(e)).join('; ') : null)
          || JSON.stringify(errData))
      : err.message;
    return { ok: false, error: errMsg };
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
    const resp = data.response || data;
    return {
      ok:                   true,
      bolNumber:            resp.bolNumber  || resp.bol,
      proNumber:            resp.proNumber  || resp.pro || null,
      bolUrl:               resp.bolUrl     || null,
      productTransactionId: resp.productTransactionId || payload.shipmentProductTransactionId,
      trackingUrl:          resp.trackingUrl || null,
    };
  } catch (err) {
    console.error('[wwex] quoteOrderFlow error:', err.response?.data || err.message);
    return { ok: false, error: err.response?.data || err.message };
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
    return { ok: false, error: err.response?.data || err.message };
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
    return { ok: false, error: err.response?.data || err.message };
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
    console.error('[wwex] integratedCancelFlow error:', err.response?.data || err.message);
    return { ok: false, error: err.response?.data || err.message };
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
    return {
      ok:          true,
      base64:      resp.document || resp.base64Document || resp.content,
      contentType: resp.contentType || 'application/pdf',
    };
  } catch (err) {
    console.error('[wwex] documentDownloadFlow error:', err.response?.data || err.message);
    return { ok: false, error: err.response?.data || err.message };
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
    return { ok: false, error: err.response?.data || err.message };
  }
};

exports.apiMode = HAS_CREDS ? `SpeedShip V4 (${WWEX_ENV})` : 'stub';
exports.WWEX_ENV = WWEX_ENV;
