'use strict';

/**
 * addressValidationService.js — Google Address Validation, server-side.
 *
 * List item 16. Turns "this address parses" into "USPS believes something
 * can be delivered here", which is a different and much more useful claim
 * when the thing being delivered is a 300 lb crate on a freight truck.
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHY THIS RUNS ON THE SERVER AND HAS ITS OWN KEY
 *
 * The storefront key is restricted by HTTP referrer, which only works for
 * requests made by a browser. A call from Node carries no referrer and is
 * rejected, so this needs a second key — GOOGLE_ADDRESS_VALIDATION_KEY —
 * restricted to the Address Validation API and never shipped to a client.
 *
 * That split is not incidental. Running this in the browser would mean
 * the verdict arrives as a form field, and a verdict the page can set is
 * one a fraudster can forge. "Address validated: pass" posted alongside a
 * hand-typed address is worse than no signal at all, because a human
 * reading the order screen reads it as corroboration. Same reasoning that
 * keeps ship_address_source out of the form — see
 * src/utils/addressProvenance.js.
 *
 * ──────────────────────────────────────────────────────────────────────
 * THE BILLING SESSION SURVIVES THE TWO-KEY SPLIT
 *
 * Autocomplete requests are free when the session is terminated by a
 * Place Details or Address Validation call; abandoned, each is billed
 * separately. Google's rule is that credentials within a session must
 * belong to the same PROJECT, not the same key, so the browser's session
 * token can be handed to this server-side call. Both keys live in
 * bathroom-vanities-outlet.
 *
 * Passing the token is therefore a cost decision, not a nicety. Omit it
 * and every keystroke in that session becomes billable.
 *
 * ──────────────────────────────────────────────────────────────────────
 * enableUspsCass MUST BE SET OR uspsData IS ABSENT
 *
 * Off by default. Without it the response simply has no uspsData, which
 * looks identical to "USPS had nothing to say". US and PR only.
 *
 * There is NO residential/business indicator in this API — checked
 * against the validateAddress reference, 2026-09-27, not recalled. The
 * residential flag that drives the freight surcharge stays the buyer's
 * checkbox. Do not go looking for an RDI field later assuming it was
 * missed.
 *
 * ──────────────────────────────────────────────────────────────────────
 * FAILURE POLICY: NULL, ALWAYS, AND NEVER AN EXCEPTION
 *
 * Every failure path returns null. Key missing, quota tripped, Google
 * down, timeout, malformed JSON — all the same to the caller. This runs
 * inside a checkout submit that has already passed validation, and a
 * dead third party must never stop an order being written.
 *
 * A null result means NOT ASKED. It does not mean the address is bad. The
 * columns stay NULL and ship_validated_at stays NULL, which is how a
 * screen distinguishes "never checked" from "checked and clean".
 */

const ENDPOINT = 'https://addressvalidation.googleapis.com/v1:validateAddress';

/* Six seconds. This sits in the request path of a checkout submit, so a
   stalled call costs the buyer directly. Long enough for a normal
   response — Google's median is well under a second — and short enough
   that an outage is a blip rather than an abandoned cart. */
const TIMEOUT_MS = 6000;

/* Google caps the input address at 280 characters across all fields.
   Longer input is rejected outright rather than truncated by them. */
const MAX_INPUT_CHARS = 280;

/**
 * Reduce the response to one word for the admin screen, so nothing
 * downstream has to re-derive it from five booleans.
 *
 * Deliberately NOT read from verdict.possibleNextAction: that field was
 * still Preview (pre-GA) as of 2026-09-27, and Google's own note says it
 * must not be treated as a guarantee. This is computed from the stable
 * fields instead.
 *
 *   suspect - USPS says the address is undeliverable, vacant, or a
 *             commercial mail-receiving agency. The ones worth a phone
 *             call before a truck is booked.
 *   fix     - real place, something is off: unit unconfirmed or missing,
 *             or Google could only confirm to street level. The commonest
 *             non-clean outcome and usually a missing apartment number.
 *   pass    - confirmed to the building or better, nothing flagged.
 */
function verdictFrom(v, usps) {
  const g = String(v.validationGranularity || '');
  const dpv = String((usps && usps.dpvConfirmation) || '').toUpperCase();

  /* N is USPS saying it cannot deliver there. Vacant and CMRA are not
     delivery failures but they are the two strongest fraud tells on a
     high-value freight order. */
  if (dpv === 'N') return 'suspect';
  if (usps && (String(usps.dpvVacant).toUpperCase() === 'Y'
            || String(usps.dpvCmra).toUpperCase()   === 'Y')) return 'suspect';

  /* S = building confirmed, unit not. D = unit missing entirely. */
  if (dpv === 'S' || dpv === 'D') return 'fix';

  if (g === 'SUB_PREMISE' || g === 'PREMISE') {
    return (v.addressComplete && !v.hasUnconfirmedComponents) ? 'pass' : 'fix';
  }
  /* PREMISE_PROXIMITY, BLOCK, ROUTE, OTHER: the street is real but the
     building is not confirmed. Not a failure, not clean either. */
  return 'fix';
}

/** CSV of the verdict booleans that came back true, for one admin row.
 *  Stored as text because these are flags to eyeball, not to query on. */
function flagsFrom(v, addr) {
  const out = [];
  if (v.hasUnconfirmedComponents)    out.push('unconfirmed');
  if (v.hasInferredComponents)       out.push('inferred');
  if (v.hasReplacedComponents)       out.push('replaced');
  if (v.hasSpellCorrectedComponents) out.push('spell_corrected');
  if (!v.addressComplete)            out.push('incomplete');

  /* The single commonest cause of a failed freight delivery to a
     multi-unit building, called out by name rather than left inside a
     generic "incomplete". */
  const missing = (addr && addr.missingComponentTypes) || [];
  if (missing.indexOf('subpremise') !== -1) out.push('missing_subpremise');

  return out.length ? out.join(',').slice(0, 160) : null;
}

/** CSV of the USPS warning flags that came back Y. Each is a real signal
 *  on a freight order; see the migration for what each one means. */
function uspsFlagsFrom(u) {
  if (!u) return null;
  const yes = k => String(u[k] || '').toUpperCase() === 'Y';
  const out = [];
  if (yes('dpvCmra'))             out.push('cmra');
  if (yes('dpvVacant'))           out.push('vacant');
  if (yes('dpvNoStat'))           out.push('no_stat');
  if (yes('dpvNoSecureLocation')) out.push('no_secure_location');
  if (yes('dpvDoorNotAccessible'))out.push('door_not_accessible');
  return out.length ? out.join(',').slice(0, 80) : null;
}

/**
 * Validate a US delivery address.
 *
 * @param {object}  a
 * @param {string}  a.address1
 * @param {string}  [a.address2]      included here, UNLIKE the geocoder
 * @param {string}  a.city
 * @param {string}  a.state
 * @param {string}  a.zip
 * @param {string}  [a.sessionToken]  the browser's autocomplete token
 * @param {string}  [a.previousResponseId] set ONLY on a re-validation
 * @returns {Promise<object|null>} null on every failure
 */
async function validateUsAddress(a) {
  const key = process.env.GOOGLE_ADDRESS_VALIDATION_KEY || '';
  if (!key) {
    /* Not an error. The feature is simply not configured yet, and saying
       so once per call would fill the log with noise during rollout. */
    return null;
  }

  const line1 = String((a && a.address1) || '').trim();
  const line2 = String((a && a.address2) || '').trim();
  const city  = String((a && a.city)     || '').trim();
  const state = String((a && a.state)    || '').trim().toUpperCase();
  const zip   = String((a && a.zip)      || '').trim();

  /* Same floor as the geocoder: a street plus enough to locate it. */
  if (!line1) return null;
  if (!zip && !(city && state)) return null;

  /* address2 IS sent here, unlike the Census geocoder, and the difference
     matters. The geocoder wants the building; this wants the unit,
     because confirming the apartment number is most of the value. */
  const addressLines = [line1, line2].filter(Boolean);

  if (addressLines.join(' ').length + city.length + state.length + zip.length
      > MAX_INPUT_CHARS) {
    console.error('[addrval] input exceeds Google\'s 280-character limit, skipping');
    return null;
  }

  const body = {
    address: {
      regionCode:        'US',
      administrativeArea: state,
      locality:          city,
      postalCode:        zip,
      addressLines,
    },
    /* Without this there is no uspsData at all - see the header. */
    enableUspsCass: true,
  };

  /* Terminates the autocomplete billing session, making every keystroke
     in it free. Only sent when it looks like a real token: Google
     rejects the whole request with INVALID_ARGUMENT on a malformed one,
     which would turn a cost optimisation into an outage. */
  const token = String((a && a.sessionToken) || '').trim();
  if (token && /^[A-Za-z0-9_-]{1,36}$/.test(token)) body.sessionToken = token;

  /* Set only when re-checking an address the buyer just edited, so Google
     can treat it as the same validation sequence rather than a new one. */
  const prev = String((a && a.previousResponseId) || '').trim();
  if (prev) body.previousResponseId = prev;

  let json;
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      /* Status is worth logging by name: 403 is almost always the key
         restriction or the API not being enabled, 429 is the quota, and
         those need completely different fixes. The response body is NOT
         logged - it echoes the address, and the log is not the place for
         a customer's home address. */
      console.error('[addrval] HTTP', res.status, res.statusText || '');
      return null;
    }
    json = await res.json();
  } catch (err) {
    console.error('[addrval] request failed:', err && err.message);
    return null;
  }

  const r = (json && json.result) || null;
  if (!r || !r.verdict) return null;

  const v    = r.verdict;
  const usps = r.uspsData || null;
  const addr = r.address  || null;
  const geo  = r.geocode  || null;

  /* Google's rooftop geocode is better than the Census street
     interpolation already stored, so the caller may upgrade ship_lat /
     ship_lng and set source='google'. Only offered when the point is
     actually finer: a LOCALITY-granularity geocode is a town centre and
     would be a downgrade dressed as an improvement. */
  let lat = null, lng = null;
  const geoGran = String(v.geocodeGranularity || '');
  if (geo && geo.location
      && (geoGran === 'SUB_PREMISE' || geoGran === 'PREMISE')) {
    const la = Number(geo.location.latitude);
    const ln = Number(geo.location.longitude);
    /* Same bounds check as the Census geocoder. A plausible-looking pair
       of numbers in the wrong hemisphere looks like a real answer. */
    if (Number.isFinite(la) && Number.isFinite(ln)
        && la >= 15 && la <= 72 && ln >= -180 && ln <= -64) {
      lat = la; lng = ln;
    }
  }

  return {
    verdict:       verdictFrom(v, usps),
    granularity:   String(v.validationGranularity || '').slice(0, 20) || null,
    flags:         flagsFrom(v, addr),
    formatted:     addr && addr.formattedAddress
                     ? String(addr.formattedAddress).slice(0, 255) : null,
    placeId:       geo && geo.placeId ? String(geo.placeId).slice(0, 255) : null,

    uspsDpv:       usps && usps.dpvConfirmation
                     ? String(usps.dpvConfirmation).toUpperCase().slice(0, 4) : null,
    uspsFlags:     uspsFlagsFrom(usps),
    uspsRoute:     usps && usps.carrierRoute
                     ? String(usps.carrierRoute).slice(0, 8) : null,

    lat, lng,

    /* Needed for previousResponseId if the buyer edits and we re-check. */
    responseId:    json.responseId ? String(json.responseId) : null,

    /* The corrected address, componentised, so the page can offer "use
       this" without re-parsing a formatted string. Null when Google
       changed nothing worth showing. */
    corrected:     correctedFrom(addr),
  };
}

/** Google's post-processed address, split back into our four fields.
 *  Returns null when there is nothing to offer the buyer. */
function correctedFrom(addr) {
  const comps = (addr && addr.addressComponents) || [];
  if (!comps.length) return null;

  const get = (type, short) => {
    const c = comps.find(x => (x.componentType || '') === type);
    if (!c) return '';
    const t = short ? (c.componentName && c.componentName.text)
                    : (c.componentName && c.componentName.text);
    return String(t || '');
  };

  const num    = get('street_number');
  const route  = get('route');
  const line1  = [num, route].filter(Boolean).join(' ');
  const city   = get('locality') || get('sublocality');
  const state  = get('administrative_area_level_1');
  const zip    = get('postal_code');

  if (!line1 || !city || !state || !zip) return null;
  return { address1: line1, city, state: state.toUpperCase(), zip };
}

module.exports = {
  validateUsAddress,
  /* Exported for the push-script gates, which exercise the pure
     reduction logic directly rather than inferring it from a grep. */
  _verdictFrom: verdictFrom,
  _flagsFrom: flagsFrom,
  _uspsFlagsFrom: uspsFlagsFrom,
  _correctedFrom: correctedFrom,
  _ENDPOINT: ENDPOINT,
};
