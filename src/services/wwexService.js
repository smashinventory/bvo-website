'use strict';

/**
 * wwexService.js
 * Worldwide Express (WWEX) shipping API abstraction.
 *
 * Supports two API modes — detected automatically from env vars:
 *   NEW API  (post-June 2023): WWEX_CLIENT_ID + WWEX_CLIENT_SECRET
 *   LEGACY API:                WWEX_ACCOUNT_NUMBER + WWEX_USERNAME + WWEX_PASSWORD + WWEX_AUTH_KEY
 *
 * When credentials are absent, all methods return realistic stub responses
 * so the admin UI and controllers work fully before credentials arrive.
 *
 * Methods:
 *   getRates(payload)          → array of rate options
 *   bookShipment(rateId, data) → { shipmentId, trackingNumber, bolNumber, bolUrl }
 *   getTracking(trackingNumber)→ { status, events[], estimatedDelivery }
 *   getBOL(shipmentId)         → { bolUrl }
 */

const axios = require('axios');

/* ── Env-based mode detection ─────────────────────────────────── */
const MODE = process.env.WWEX_CLIENT_ID ? 'new'
           : process.env.WWEX_AUTH_KEY   ? 'legacy'
           : 'stub';

const NEW_BASE    = 'https://api.wwex.com';        // confirmed from WWEX developer docs
const LEGACY_BASE = 'https://api.wwex.com/legacy'; // placeholder — update when rep confirms

/* ── Token cache (new API only) ───────────────────────────────── */
let _tokenCache = null;
let _tokenExpiry = 0;

async function getNewApiToken() {
  if (_tokenCache && Date.now() < _tokenExpiry) return _tokenCache;
  const res = await axios.post(`${NEW_BASE}/oauth/token`, {
    grant_type:    'client_credentials',
    client_id:     process.env.WWEX_CLIENT_ID,
    client_secret: process.env.WWEX_CLIENT_SECRET,
  }, { timeout: 10000 });
  _tokenCache  = res.data.access_token;
  _tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;
  return _tokenCache;
}

/* ── Stub responses (used when credentials not yet present) ───── */
const STUB_RATES = [
  {
    rateId:        'STUB-LTL-001',
    carrier:       'Estes Express (via WWEX)',
    serviceLevel:  'LTL Standard',
    shipType:      'ltl',
    transitDays:   5,
    estimatedDelivery: _addDays(new Date(), 7).toISOString().split('T')[0],
    totalCharge:   189.50,
    currency:      'USD',
    stub:          true,
  },
  {
    rateId:        'STUB-LTL-002',
    carrier:       'XPO Logistics (via WWEX)',
    serviceLevel:  'LTL Economy',
    shipType:      'ltl',
    transitDays:   7,
    estimatedDelivery: _addDays(new Date(), 9).toISOString().split('T')[0],
    totalCharge:   154.00,
    currency:      'USD',
    stub:          true,
  },
  {
    rateId:        'STUB-PKG-001',
    carrier:       'UPS Ground (via WWEX)',
    serviceLevel:  'Ground',
    shipType:      'parcel',
    transitDays:   4,
    estimatedDelivery: _addDays(new Date(), 5).toISOString().split('T')[0],
    totalCharge:   42.75,
    currency:      'USD',
    stub:          true,
  },
];

function _addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/* ═══════════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════════ */

/**
 * Get shipping rate quotes.
 * payload: {
 *   originZip, destZip, destCity, destState,
 *   residential, liftgate, appointment,
 *   items: [{ weight, length, width, height, freightClass? }]
 * }
 */
exports.getRates = async (payload) => {
  if (MODE === 'stub') {
    console.log('[wwex] STUB mode — returning sample rates');
    return { ok: true, rates: STUB_RATES, stub: true };
  }

  try {
    if (MODE === 'new') {
      const token = await getNewApiToken();
      const res = await axios.post(`${NEW_BASE}/v1/rates`, payload, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      return { ok: true, rates: res.data.rates || res.data };
    }

    // Legacy mode
    const res = await axios.post(`${LEGACY_BASE}/rates`, payload, {
      auth: { username: process.env.WWEX_USERNAME, password: process.env.WWEX_PASSWORD },
      headers: {
        'X-Auth-Key':        process.env.WWEX_AUTH_KEY,
        'X-Account-Number':  process.env.WWEX_ACCOUNT_NUMBER,
        'Content-Type':      'application/json',
      },
      timeout: 15000,
    });
    return { ok: true, rates: res.data.rates || res.data };
  } catch (err) {
    console.error('[wwex] getRates error:', err.response?.data || err.message);
    return { ok: false, error: err.response?.data || err.message };
  }
};

/**
 * Book a shipment using a rate ID returned from getRates.
 * Returns tracking number, BOL number, and BOL URL.
 */
exports.bookShipment = async (rateId, shipmentData) => {
  if (MODE === 'stub') {
    const stubId  = `STUB-SHIP-${Date.now()}`;
    const stubBOL = `BOL-${Date.now()}`;
    console.log('[wwex] STUB mode — returning mock booking');
    return {
      ok:             true,
      shipmentId:     stubId,
      trackingNumber: `1Z999AA1${Math.floor(Math.random() * 1e9)}`,
      bolNumber:      stubBOL,
      bolUrl:         null,
      stub:           true,
    };
  }

  try {
    if (MODE === 'new') {
      const token = await getNewApiToken();
      const res = await axios.post(`${NEW_BASE}/v1/shipments`, { rateId, ...shipmentData }, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 20000,
      });
      const d = res.data;
      return {
        ok:             true,
        shipmentId:     d.shipmentId,
        trackingNumber: d.trackingNumber,
        bolNumber:      d.bolNumber,
        bolUrl:         d.bolUrl || null,
      };
    }

    // Legacy mode
    const res = await axios.post(`${LEGACY_BASE}/shipments`, { rateId, ...shipmentData }, {
      auth: { username: process.env.WWEX_USERNAME, password: process.env.WWEX_PASSWORD },
      headers: {
        'X-Auth-Key':       process.env.WWEX_AUTH_KEY,
        'X-Account-Number': process.env.WWEX_ACCOUNT_NUMBER,
        'Content-Type':     'application/json',
      },
      timeout: 20000,
    });
    const d = res.data;
    return { ok: true, shipmentId: d.shipmentId, trackingNumber: d.trackingNumber, bolNumber: d.bolNumber, bolUrl: d.bolUrl || null };
  } catch (err) {
    console.error('[wwex] bookShipment error:', err.response?.data || err.message);
    return { ok: false, error: err.response?.data || err.message };
  }
};

/**
 * Poll tracking status for a shipment.
 */
exports.getTracking = async (trackingNumber) => {
  if (MODE === 'stub') {
    return {
      ok:     true,
      status: 'in_transit',
      events: [
        { timestamp: new Date().toISOString(), location: 'Charlotte, NC', description: 'In transit to destination' },
        { timestamp: new Date(Date.now() - 86400000).toISOString(), location: 'Atlanta, GA', description: 'Departed facility' },
      ],
      estimatedDelivery: _addDays(new Date(), 3).toISOString().split('T')[0],
      stub: true,
    };
  }

  try {
    if (MODE === 'new') {
      const token = await getNewApiToken();
      const res = await axios.get(`${NEW_BASE}/v1/tracking/${encodeURIComponent(trackingNumber)}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      return { ok: true, ...res.data };
    }

    const res = await axios.get(`${LEGACY_BASE}/tracking/${encodeURIComponent(trackingNumber)}`, {
      auth: { username: process.env.WWEX_USERNAME, password: process.env.WWEX_PASSWORD },
      headers: { 'X-Auth-Key': process.env.WWEX_AUTH_KEY, 'X-Account-Number': process.env.WWEX_ACCOUNT_NUMBER },
      timeout: 10000,
    });
    return { ok: true, ...res.data };
  } catch (err) {
    console.error('[wwex] getTracking error:', err.response?.data || err.message);
    return { ok: false, error: err.response?.data || err.message };
  }
};

exports.apiMode = MODE;
