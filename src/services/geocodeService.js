'use strict';

/**
 * geocodeService.js — US address to latitude/longitude.
 *
 * WHY THE CENSUS BUREAU AND NOT GOOGLE
 * Free, keyless, unmetered, and run by the agency that defines US address
 * ranges. No billing account to configure, no key to leak, no quota to
 * blow through. Google's Geocoding API would do the same job better on
 * edge cases but needs a key, a billing account and a referrer
 * restriction, none of which exist yet.
 *
 * Google Places Autocomplete is a SEPARATE decision already taken (list
 * item 15) and solves a different problem — stopping the buyer typing a
 * bad address in the first place. This turns an address we already have
 * into a point on a map, which is what the admin Street View panel will
 * need later (item 20).
 *
 * WHAT IT IS NOT
 * Not address validation. The Census geocoder returns its own
 * interpretation of what was typed and a match confidence; it does not
 * certify deliverability the way USPS does. A result here means "we
 * found something that looks like this address", never "this address is
 * real and someone can receive freight there".
 *
 * FAILURE POLICY
 * Every failure returns null. Geocoding is a convenience for the
 * delivery screen — it must never block booking a shipment or saving an
 * order. Callers write the columns only on success and leave them null
 * otherwise, which is why ship_geocoded_at exists: a null timestamp
 * beside a non-null address means "not attempted or did not resolve",
 * and is distinguishable from "resolved to nothing".
 */

const BASE = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

/* The Census service is occasionally slow and has no SLA. Eight seconds
   is long enough for a normal response and short enough that a stalled
   call cannot hold a request open. */
const TIMEOUT_MS = 8000;

/* Benchmark and vintage are required and version-pinned by the API.
   'Public_AR_Current' is the current address-range benchmark. Leaving
   them off returns an error page rather than JSON. */
const BENCHMARK = 'Public_AR_Current';

/**
 * Geocode a US address.
 *
 * @param {object} a
 * @param {string} a.address1
 * @param {string} [a.address2]  ignored - see below
 * @param {string} a.city
 * @param {string} a.state
 * @param {string} a.zip
 * @returns {Promise<{lat:number, lng:number, matchedAddress:string,
 *                    source:'census'}|null>}
 */
async function geocodeUsAddress(a) {
  const line1 = String(a && a.address1 || '').trim();
  const city  = String(a && a.city     || '').trim();
  const state = String(a && a.state    || '').trim();
  const zip   = String(a && a.zip      || '').trim();

  /* Street plus either ZIP or city+state. Without a street there is
     nothing to match against a range, and the service would happily
     return a ZIP centroid that looks like a real result. */
  if (!line1) return null;
  if (!zip && !(city && state)) return null;

  /* address2 is deliberately omitted. "Apt 4B" and "Suite C" are not in
     the Census address ranges and measurably reduce the match rate -
     the unit is inside the building the street address already
     identifies. */
  const oneline = [line1, city, state, zip].filter(Boolean).join(', ');

  const url = `${BASE}?address=${encodeURIComponent(oneline)}`
            + `&benchmark=${BENCHMARK}&format=json`;

  let json;
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      console.error('[geocode] census HTTP', res.status, 'for', oneline);
      return null;
    }
    json = await res.json();
  } catch (err) {
    /* Abort, DNS, TLS, malformed JSON - all the same outcome to the
       caller. Logged, never thrown. */
    console.error('[geocode] census request failed:', err && err.message);
    return null;
  }

  const matches = json
    && json.result
    && Array.isArray(json.result.addressMatches)
    ? json.result.addressMatches : [];

  if (!matches.length) return null;

  /* First match only. The service returns them best-first, and picking
     among several would be guessing at which building the buyer meant -
     a judgement for a human looking at Street View, not for this. */
  const m   = matches[0];
  const lat = Number(m && m.coordinates && m.coordinates.y);
  const lng = Number(m && m.coordinates && m.coordinates.x);

  /* x is LONGITUDE and y is LATITUDE in the Census response. Reversing
     them puts every Georgia delivery in the Indian Ocean, and the values
     are both plausible-looking numbers so nothing would complain. */
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  /* Continental US plus Alaska and Hawaii, generously bounded. A result
     outside this is not a US delivery address and is more likely a
     parsing accident than a real one. */
  if (lat < 15 || lat > 72 || lng < -180 || lng > -64) {
    console.error('[geocode] census returned out-of-range point',
      lat, lng, 'for', oneline);
    return null;
  }

  return {
    lat,
    lng,
    matchedAddress: String(m.matchedAddress || oneline),
    source: 'census',
  };
}

module.exports = { geocodeUsAddress, _BASE: BASE };
