/* ═══════════════════════════════════════════════════════════════════════
   carrierRules.js — carrier requirements that WWEX does not return

   STEP 2 of 3. Read-only. This module cannot change a booking.

   ── WHY IT EXISTS ────────────────────────────────────────────────────
   SpeedShip's web UI shows rules our integration never sees. Verified
   2026-09-03 by clicking the rate for all 12 carriers on one lane:

     RL Carriers (RLCA)   blocking modal — label every handling unit
     TForce      (UPGF)   inline banner  — 3pm pickup cutoff

   And the API genuinely does not carry them: a full prose scan of a live
   shopFlow response found only our own specialInstructions echoed back,
   resp.message is the status string 'Shop Offers created.', and every
   primaryVendor operational field (latestPickupTime, pickupWindow,
   businessHours, commentList, ...) is NULL for every carrier.

   ── WHAT THIS MODULE WILL NOT DO ─────────────────────────────────────
   It does not touch ship_date. The decision was: WARN, do not change.
   A cutoff we have not confirmed must not silently move a date somebody
   entered deliberately. UPGF in particular has never been observed in a
   BVO response — see isUnverifiedScac below.

   Every read degrades to [] and logs. A missing table, a renamed column
   or a dead connection must not break the rate shop; the worst outcome
   allowed here is that a warning fails to appear.
   ═══════════════════════════════════════════════════════════════════════ */

const { safeQuery } = require('../db/query')('carrier-rules');

/* SCACs we have actually seen in a BVO response. RLCA is confirmed from
   primaryVendor.scac on a live rate shop. UPGF is TForce's published SCAC
   but has NOT been matched against our own data — staging returned six
   carriers and TForce was not among them.

   This exists so an unverified rule can be labelled as such wherever it
   surfaces, rather than looking like a working feature that happens never
   to fire. A rule that silently matches nothing is the exact failure mode
   this project keeps running into. */
const CONFIRMED_SCACS = new Set(['RLCA']);

const isUnverifiedScac = scac => !CONFIRMED_SCACS.has(String(scac || '').toUpperCase());

/* Shipper-local timezone by state.

   A cutoff without a zone is a guess, and comparing '15:00' against a UTC
   server clock would fire four hours early for a Georgia origin — warning
   on bookings that are in fact fine. A warning that cries wolf gets
   ignored, which is worse than no warning at all.

   Only states BVO actually ships from need to be right. Anything unlisted
   falls back to Eastern and is reported as approximate rather than
   pretending to precision we do not have. */
const TZ_BY_STATE = {
  GA:'America/New_York', FL:'America/New_York', SC:'America/New_York',
  NC:'America/New_York', VA:'America/New_York', TN:'America/Chicago',
  AL:'America/Chicago',  MS:'America/Chicago',  TX:'America/Chicago',
  NY:'America/New_York', NJ:'America/New_York', PA:'America/New_York',
  OH:'America/New_York', MI:'America/New_York', IL:'America/Chicago',
  CA:'America/Los_Angeles', WA:'America/Los_Angeles', OR:'America/Los_Angeles',
  AZ:'America/Phoenix',  CO:'America/Denver',  UT:'America/Denver',
  NV:'America/Los_Angeles', MA:'America/New_York', MD:'America/New_York',
};
const DEFAULT_TZ = 'America/New_York';

/** Wall-clock date + minutes-since-midnight in a given IANA zone. */
function _localNow(tz, now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(now).reduce((a, x) => (a[x.type] = x.value, a), {});
  // 'en-CA' gives ISO-ordered parts; hour can be '24' at midnight in some
  // engines, so normalise rather than trusting it.
  const hour = parseInt(p.hour, 10) % 24;
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: hour * 60 + parseInt(p.minute, 10) };
}

/** '15:00' -> 900. Returns null for anything unparseable. */
function _toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = +m[1], min = +m[2];
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Active rules for a set of SCACs. [] on any failure. */
async function getRulesForScacs(scacs = [], appliesAt = null) {
  const list = [...new Set((scacs || []).filter(Boolean).map(s => String(s).toUpperCase()))];
  if (!list.length) return [];
  const where = appliesAt ? ' AND applies_at = ?' : '';
  const params = appliesAt ? [...list, appliesAt] : list;
  return safeQuery(
    `SELECT scac, carrier_name, rule_type, applies_at, rule_value, rule_tz,
            rule_text, last_verified_at
       FROM carrier_rules
      WHERE is_active = 1
        AND scac IN (${list.map(() => '?').join(',')})${where}
      ORDER BY scac, rule_type`,
    params
  );
}

/**
 * Booking-time warnings for a set of rates.
 *
 * Returns a Map of SCAC -> warning object. A rate row with no entry has no
 * warning; callers must treat absence as "fine", never as "unknown".
 *
 * Two deliberate restrictions on when a cutoff warns:
 *
 *   1. Only when the ship date IS TODAY in shipper-local terms. A 3pm
 *      cutoff is irrelevant to a shipment going out next Tuesday, and
 *      warning about it anyway trains people to dismiss the banner.
 *   2. Only when the cutoff has actually passed. Booking at 14:55 is fine
 *      and should say nothing.
 */
async function getBookingWarnings(scacs, { originState, shipDate } = {}) {
  const rules = await getRulesForScacs(scacs, 'book');
  const out = new Map();
  if (!rules.length) return out;

  const state = String(originState || '').toUpperCase();
  const tz = TZ_BY_STATE[state] || DEFAULT_TZ;
  const tzApprox = !TZ_BY_STATE[state];
  const local = _localNow(tz);

  for (const r of rules) {
    if (r.rule_type !== 'pickup_cutoff') continue;
    const cutoff = _toMinutes(r.rule_value);
    if (cutoff === null) {
      // Bad data, not a reason to warn. Say so in the log and move on.
      console.warn(`[carrier-rules] ${r.scac} pickup_cutoff has unparseable rule_value:`, r.rule_value);
      continue;
    }

    // Restriction 1 — today only.
    const ship = String(shipDate || '').slice(0, 10);
    if (!ship || ship !== local.date) continue;

    // Restriction 2 — actually past.
    if (local.minutes < cutoff) continue;

    out.set(String(r.scac).toUpperCase(), {
      scac:         r.scac,
      carrier:      r.carrier_name || r.scac,
      type:         r.rule_type,
      text:         r.rule_text,
      cutoff:       r.rule_value,
      localTime:    `${String(Math.floor(local.minutes / 60)).padStart(2, '0')}:${String(local.minutes % 60).padStart(2, '0')}`,
      tz,
      tzApprox,                      // origin state not in the map — say so rather than imply precision
      unverified:   isUnverifiedScac(r.scac),
      lastVerified: r.last_verified_at,
    });
  }
  return out;
}

/** Pack-time instructions for one carrier — for documents and the vendor
 *  email, NOT for a screen the warehouse never opens. [] on failure. */
async function getPackInstructions(scac) {
  if (!scac) return [];
  const rows = await getRulesForScacs([scac], 'pack');
  return rows.map(r => ({
    scac: r.scac,
    carrier: r.carrier_name || r.scac,
    type: r.rule_type,
    text: r.rule_text,
    unverified: isUnverifiedScac(r.scac),
    lastVerified: r.last_verified_at,
  }));
}

module.exports = {
  getRulesForScacs,
  getBookingWarnings,
  getPackInstructions,
  isUnverifiedScac,
  // exported for tests
  _toMinutes,
  _localNow,
  TZ_BY_STATE,
};
