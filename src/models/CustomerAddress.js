'use strict';

/**
 * CustomerAddress — the addresses we know a customer by.
 *
 * Scope items 27/28, and the velocity data behind 6/9.
 * Schema: migrations/2026-09-28_customer_addresses_RUNME.sql
 * Decisions: BVO_PAYMENT_RISK_AND_CHECKOUT_SCOPE.md §7 Stage 3.
 *
 * ──────────────────────────────────────────────────────────────────────
 * THIS IS NOT THE ORDER'S ADDRESS.
 *
 * `orders.ship_*` is what was ACTUALLY USED on that order, and it is
 * immutable — a financial record. This table is what we know about the
 * customer NOW. They are allowed to diverge, and reading "where they
 * live" out of a past order is how financial records become mutable.
 *
 * ──────────────────────────────────────────────────────────────────────
 * NOTHING HERE MAY THROW INTO A CHECKOUT.
 *
 * Every function catches and logs. A saved address is a convenience and
 * a fraud signal; neither is worth failing an order whose card is
 * already authorised. Same rule as brevoService, and the same cost:
 * a silent failure looks like success, so the writes are logged.
 */

const { bvoPool } = require('../config/database');
const addressKey  = require('../utils/addressKey');

/**
 * Record that an address was used. Insert on first sight, bump on every
 * later use.
 *
 * ⚠️ THE UPSERT IS THE POINT. Without ON DUPLICATE KEY the same house
 * would insert a row per checkout, `times_used` would never exceed 1,
 * and the velocity count would count ORDERS rather than distinct
 * ADDRESSES — flagging every loyal customer. The unique key it depends
 * on is (customer_id, kind, address_key).
 *
 * @param {number} customerId
 * @param {'shipping'|'billing'} kind
 * @param {object} a  address fields; see addressKey for the shape
 * @returns {Promise<{ok:boolean, key?:string, error?:string}>}
 */
async function record(customerId, kind, a) {
  const id = Number(customerId);
  if (!id || !Number.isFinite(id)) return { ok: false, error: 'no customer' };
  if (kind !== 'shipping' && kind !== 'billing') {
    return { ok: false, error: 'bad kind: ' + kind };
  }

  const src = a || {};
  /* An address with no street line is not an address. Writing it would
     put a row keyed on the hash of an almost-empty string into the
     table, where it would absorb every other broken write. */
  if (!String(src.address1 || '').trim()) {
    return { ok: false, error: 'no address1' };
  }

  const key = addressKey(src);

  try {
    await bvoPool.query(
      `INSERT INTO customer_addresses
         (customer_id, kind, address_key, place_id, formatted_address,
          first_name, last_name, company,
          address1, address2, city, state, zip, country,
          phone, phone_ext, address_type,
          lat, lng, validation_verdict, usps_dpv,
          last_used_at, times_used)
       VALUES (?,?,?,?,?, ?,?,?, ?,?,?,?,?,?, ?,?,?, ?,?,?,?, NOW(), 1)
       ON DUPLICATE KEY UPDATE
         last_used_at = NOW(),
         times_used   = times_used + 1,
         /* Refresh the detail on every use: a buyer who corrects an
            apartment number is describing the SAME place, so the key is
            unchanged and the newer values are the better ones. */
         place_id           = COALESCE(VALUES(place_id), place_id),
         formatted_address  = COALESCE(VALUES(formatted_address), formatted_address),
         first_name         = COALESCE(NULLIF(VALUES(first_name),''), first_name),
         last_name          = COALESCE(NULLIF(VALUES(last_name),''), last_name),
         company            = COALESCE(NULLIF(VALUES(company),''), company),
         address2           = COALESCE(NULLIF(VALUES(address2),''), address2),
         phone              = COALESCE(NULLIF(VALUES(phone),''), phone),
         phone_ext          = COALESCE(NULLIF(VALUES(phone_ext),''), phone_ext),
         address_type       = COALESCE(VALUES(address_type), address_type),
         lat                = COALESCE(VALUES(lat), lat),
         lng                = COALESCE(VALUES(lng), lng),
         validation_verdict = COALESCE(VALUES(validation_verdict), validation_verdict),
         usps_dpv           = COALESCE(VALUES(usps_dpv), usps_dpv)`,
      [
        id, kind, key,
        src.place_id || null, src.formatted_address || null,
        src.first_name || null, src.last_name || null, src.company || null,
        String(src.address1).trim(), src.address2 || null,
        String(src.city || '').trim(), String(src.state || '').trim().toUpperCase(),
        String(src.zip || '').trim(), src.country || 'US',
        src.phone || null, src.phone_ext || null, src.address_type || null,
        src.lat == null ? null : src.lat,
        src.lng == null ? null : src.lng,
        src.validation_verdict || null, src.usps_dpv || null,
      ]
    );
    return { ok: true, key };
  } catch (err) {
    console.error(`[customerAddress] ${kind} write failed for customer ${id}:`,
                  err && err.message);
    return { ok: false, error: err && err.message };
  }
}

/**
 * The most recent shipping address, for prefilling page 1 (item 28).
 * Returns null rather than throwing — an empty form is a worse outcome
 * than a failed order, but only just, and never worth a 500.
 */
async function mostRecent(customerId, kind = 'shipping') {
  const id = Number(customerId);
  if (!id) return null;
  try {
    const [[row]] = await bvoPool.query(
      `SELECT * FROM customer_addresses
        WHERE customer_id = ? AND kind = ?
        ORDER BY last_used_at DESC, id DESC LIMIT 1`,
      [id, kind]
    );
    return row || null;
  } catch (err) {
    console.error('[customerAddress] mostRecent failed:', err && err.message);
    return null;
  }
}

/**
 * Address velocity, for the admin order screen (items 6/9).
 *
 * ⛔ ADVISORY ONLY. This informs the verification call that already
 * happens; it must NEVER gate Capture. Blocking capture on risk is item
 * 4, a separate mechanism — the moment an advisory flag starts blocking
 * money, someone starts suppressing it.
 *
 * Returns the addresses themselves, not a count. A red "FRAUD RISK"
 * badge trains people to ignore it; "3 addresses in 90 days — Marietta,
 * Alpharetta, this one" produces a good question instead of a
 * suspicious one.
 */
async function velocity(customerId, days = 90) {
  const id = Number(customerId);
  if (!id) return { shipping: [], billing: [] };
  try {
    const [rows] = await bvoPool.query(
      `SELECT kind, address1, city, state, zip,
              last_used_at, times_used, created_at AS first_seen
         FROM customer_addresses
        WHERE customer_id = ?
          AND last_used_at > (NOW() - INTERVAL ? DAY)
        ORDER BY kind, last_used_at DESC`,
      [id, days]
    );
    return {
      shipping: rows.filter(r => r.kind === 'shipping'),
      billing:  rows.filter(r => r.kind === 'billing'),
    };
  } catch (err) {
    console.error('[customerAddress] velocity failed:', err && err.message);
    return { shipping: [], billing: [] };
  }
}

module.exports = { record, mostRecent, velocity };
