'use strict';

/**
 * addressKey — the identity of an address, for dedup and velocity.
 *
 * WHY THIS IS ITS OWN FILE
 * Pure function: no database, no session, no network. Same reasoning as
 * addressProvenance.js — living inside checkoutController meant a gate
 * could not exercise it without loading the DB config, which hard-exits
 * when DB_PASS is unset. A test that needs a database password to check
 * a hash is a test that gets skipped.
 *
 * ──────────────────────────────────────────────────────────────────────
 * PLACE ID FIRST. THIS IS THE WHOLE POINT.
 *
 * "123 Main St", "123 Main Street" and "123 Main St." are three strings
 * and ONE Google place_id. The velocity flag counts DISTINCT addresses
 * in 90 days; dedup on the string and it fires on spelling variants —
 * false flags on honest customers, which teaches everyone to ignore the
 * flag, which is worse than not having one.
 *
 * So: hash the place_id when there is one. Fall back to a normalised
 * string only when there is not (a typed address — which
 * ship_address_source already identifies as 'typed').
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHY HASH AT ALL, RATHER THAN STORE THE place_id
 *
 * The column sits in a UNIQUE index. Place IDs are variable length and
 * can run long; a fixed CHAR(64) keeps the index small and predictable,
 * and lets ONE column carry both cases. The raw place_id is stored
 * beside it for debugging and for re-deriving keys if this ever changes.
 *
 * ⚠️ CHANGING THIS FUNCTION ORPHANS EVERY EXISTING ROW. The old keys
 * stop matching, the upsert inserts duplicates, and velocity counts
 * break silently. If it must change, re-derive every stored key in the
 * same migration — `place_id` and the address columns are both kept so
 * that is possible.
 */

const crypto = require('crypto');

/* Prefixed so a place-id key and a string key can never collide, and so
   a glance at a raw digest's source tells you which kind it is. */
const PLACE_PREFIX  = 'gp:';
const STRING_PREFIX = 'st:';

/** Street-suffix spellings that mean the same thing. Deliberately
 *  SHORT: this list only has to catch the common variants a buyer types
 *  by hand. Anything autocompleted never reaches it, because it has a
 *  place_id. Over-normalising here would start merging addresses that
 *  are genuinely different, which is the failure that matters — a
 *  missed duplicate costs a spurious flag, a wrong merge HIDES one. */
const SUFFIXES = {
  street: 'st', str: 'st', st: 'st',
  avenue: 'ave', av: 'ave', ave: 'ave',
  road: 'rd', rd: 'rd',
  drive: 'dr', dr: 'dr',
  lane: 'ln', ln: 'ln',
  boulevard: 'blvd', blvd: 'blvd',
  court: 'ct', ct: 'ct',
  circle: 'cir', cir: 'cir',
  place: 'pl', pl: 'pl',
  terrace: 'ter', ter: 'ter',
  parkway: 'pkwy', pkwy: 'pkwy',
  highway: 'hwy', hwy: 'hwy',
  suite: 'ste', ste: 'ste',
  apartment: 'apt', apt: 'apt',
  unit: 'unit', building: 'bldg', bldg: 'bldg',
  north: 'n', south: 's', east: 'e', west: 'w',
  northeast: 'ne', northwest: 'nw',
  southeast: 'se', southwest: 'sw',
};

/**
 * Normalise an address into a comparable string.
 * Lowercase, strip punctuation, collapse whitespace, canonicalise the
 * street suffixes and directionals above.
 */
function normalise(parts) {
  const joined = [
    parts.address1, parts.address2, parts.city, parts.state, parts.zip,
  ].map(v => String(v == null ? '' : v)).join(' ');

  return joined
    .toLowerCase()
    /* ZIP+4 down to the 5-digit base: 30060 and 30060-1234 are the same
       destination, and which one a buyer types is arbitrary. */
    .replace(/(\d{5})-\d{4}\b/g, '$1')
    .replace(/[.,#]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => SUFFIXES[w] || w)
    .join(' ')
    .trim();
}

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

/**
 * The key for one address.
 *
 * @param {object} a
 * @param {string} [a.place_id]  Google Place ID, when the buyer picked
 *                               the address from the dropdown.
 * @param {string} a.address1
 * @param {string} [a.address2]
 * @param {string} a.city
 * @param {string} a.state
 * @param {string} a.zip
 * @returns {string} 64-char hex. NEVER null — the column is NOT NULL and
 *   a missing key would defeat the unique index (MariaDB treats NULLs as
 *   distinct, so NULL keys are not deduped at all).
 */
function addressKey(a) {
  const src = a || {};

  const placeId = String(src.place_id || '').trim();
  /* Same shape check the provenance module applies. A place_id that
     fails it is not trusted as an identity. */
  if (placeId && /^[A-Za-z0-9_-]{10,255}$/.test(placeId)) {
    return sha256(PLACE_PREFIX + placeId);
  }

  const norm = normalise(src);
  /* An empty address still gets a key rather than null — the caller has
     bigger problems, but a NULL here would silently disable dedup for
     every future row. Hashing the empty string is deterministic, so the
     broken rows at least collapse into one. */
  return sha256(STRING_PREFIX + norm);
}

module.exports = addressKey;
module.exports.normalise = normalise;
module.exports._PLACE_PREFIX = PLACE_PREFIX;
module.exports._STRING_PREFIX = STRING_PREFIX;
