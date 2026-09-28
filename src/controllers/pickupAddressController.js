'use strict';

/**
 * pickupAddressController.js — saved pickup (origin) addresses.
 *
 * The origin panel on /admin/shipping/create was hard-coded in the
 * template. Owner, 2026-09-28: "we sometimes have the order picked up
 * from the vendor. So, we need the ability to add addresses that can be
 * saved to a dropdown selector."
 *
 * ══════════════════════════════════════════════════════════════════════
 * NOT BUILT, DELIBERATELY: AUTO-SELECT BY VENDOR
 *
 * Owner: "many vendors have multiple pick up addresses and we do not
 * have a way of programmatically knowing which to ship from - we have
 * to manually check in the pre-shipping phase."
 *
 * A vendor -> address rule would be wrong more often than right, and
 * wrong here sends a truck to the wrong warehouse. The dropdown is a
 * human decision on purpose. Do not "improve" it into an automatic one.
 *
 * ══════════════════════════════════════════════════════════════════════
 * DEACTIVATE, NEVER DELETE
 *
 * shipments.pickup_address_id points at these rows. Deleting one turns a
 * historic shipment's origin into a dangling id. Inactive rows drop out
 * of the dropdown and stay readable forever.
 */

const { bvoPool } = require('../config/database');

/* Mirrors the curated list in create.ejs. WWEX silently IGNORES a
   locationType outside its enum rather than rejecting it, so a typo
   here would book a standard commercial pickup while the screen claimed
   otherwise — no error, wrong truck. */
const LOCATION_TYPES = ['', 'RESIDENTIAL', 'LIMITED_ACCESS', 'CONSTRUCTION',
                        'DISTRIBUTION_CENTER', 'TRADESHOW'];

const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

/**
 * The dropdown's data source. Active only, default first.
 *
 * Exported because shippingController.createForm needs exactly this
 * list, and a second copy of the ordering would eventually disagree
 * about which address is offered first.
 */
async function listActive() {
  try {
    const [rows] = await bvoPool.query(
      `SELECT id, nickname, company, contact_name, phone, phone_ext,
              address1, address2, city, state, zip, country,
              location_type, notes, is_default
         FROM pickup_addresses
        WHERE is_active = 1
        ORDER BY is_default DESC, sort_order ASC, nickname ASC`
    );
    return rows;
  } catch (err) {
    /* Never take the shipping screen down over this. An empty list means
       the form keeps whatever is typed in it, which is exactly how it
       behaved before this feature existed. */
    console.error('[pickupAddress] listActive failed:', err && err.message);
    return [];
  }
}

/* ── GET /admin/shipping/pickup-addresses ────────────────────────── */
exports.index = async (req, res, next) => {
  try {
    const [rows] = await bvoPool.query(
      `SELECT * FROM pickup_addresses
        ORDER BY is_active DESC, is_default DESC, sort_order ASC, nickname ASC`
    );
    const editing = req.query.edit
      ? rows.find(r => String(r.id) === String(req.query.edit)) || null
      : null;

    res.render('pages/admin/shipping/pickup-addresses', {
      pageTitle: 'Pickup Addresses',
      addresses: rows,
      editing,
      locationTypes: LOCATION_TYPES,
      flash: req.session.pickupFlash || null,
      csrfToken: res.locals.csrfToken,
    });
    delete req.session.pickupFlash;
  } catch (err) { next(err); }
};

/* ── POST /admin/shipping/pickup-addresses ───────────────────────── */
/* Create and update share a handler: the form is the same shape either
   way, and splitting them duplicated the validation until they drifted
   on a previous screen. */
exports.save = async (req, res, next) => {
  const b  = req.body;
  const id = parseInt(b.id, 10) || null;

  const row = {
    nickname:      clean(b.nickname, 80),
    company:       clean(b.company, 120) || null,
    contact_name:  clean(b.contact_name, 120) || null,
    /* Digits only. WWEX rejects a formatted number, and an operator
       pasting "(770) 635-2030" from an email is the normal case. */
    phone:         clean(b.phone, 30).replace(/\D/g, '').slice(0, 15),
    phone_ext:     clean(b.phone_ext, 10).replace(/\D/g, '') || null,
    address1:      clean(b.address1, 200),
    address2:      clean(b.address2, 200) || null,
    city:          clean(b.city, 100),
    state:         clean(b.state, 2).toUpperCase(),
    zip:           clean(b.zip, 10),
    country:       clean(b.country, 2).toUpperCase() || 'US',
    location_type: LOCATION_TYPES.includes(clean(b.location_type, 40))
                     ? clean(b.location_type, 40) || null : null,
    notes:         clean(b.notes, 2000) || null,
    sort_order:    parseInt(b.sort_order, 10) || 0,
    is_active:     b.is_active ? 1 : 0,
  };

  /* Everything WWEX needs for originAddress. A booking missing any of
     these is rejected by the carrier, not by us — so it is caught here
     rather than at 4pm on a pickup day. */
  const missing = ['nickname', 'phone', 'address1', 'city', 'state', 'zip']
    .filter(k => !row[k]);
  if (missing.length) {
    req.session.pickupFlash = {
      type: 'error',
      msg: `Missing required field${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`,
    };
    return res.redirect('/admin/shipping/pickup-addresses' + (id ? `?edit=${id}` : ''));
  }

  const makeDefault = !!b.is_default;
  const conn = await bvoPool.getConnection();
  try {
    await conn.beginTransaction();

    /* EXACTLY ONE DEFAULT, cleared inside the same transaction as the
       write that sets the new one. Two statements outside a transaction
       leave a window with zero defaults — and the create form silently
       prefills nothing when it finds none. */
    if (makeDefault) {
      await conn.query('UPDATE pickup_addresses SET is_default = 0 WHERE is_default = 1');
    }

    let savedId = id;
    if (id) {
      const cols = Object.keys(row);
      await conn.query(
        `UPDATE pickup_addresses SET ${cols.map(c => `${c} = ?`).join(', ')}, is_default = ?
          WHERE id = ?`,
        [...cols.map(c => row[c]), makeDefault ? 1 : 0, id]
      );
    } else {
      const cols = Object.keys(row);
      const [r] = await conn.query(
        `INSERT INTO pickup_addresses (${cols.join(', ')}, is_default)
         VALUES (${cols.map(() => '?').join(', ')}, ?)`,
        [...cols.map(c => row[c]), makeDefault ? 1 : 0]
      );
      savedId = r.insertId;
    }

    /* An inactive default is a contradiction: the create form would
       preselect an address the dropdown does not offer. Demote it. */
    if (!row.is_active) {
      await conn.query('UPDATE pickup_addresses SET is_default = 0 WHERE id = ?', [savedId]);
    }

    /* Never leave the system with no default. If the only default was
       just deactivated, promote the first active address instead. */
    const [[d]] = await conn.query(
      'SELECT COUNT(*) AS n FROM pickup_addresses WHERE is_default = 1 AND is_active = 1');
    if (!d.n) {
      await conn.query(
        `UPDATE pickup_addresses SET is_default = 1
          WHERE is_active = 1 ORDER BY sort_order ASC, nickname ASC LIMIT 1`);
    }

    await conn.commit();
    req.session.pickupFlash = { type: 'ok', msg: `Saved "${row.nickname}".` };
  } catch (err) {
    try { await conn.rollback(); } catch { /* nothing useful to do */ }
    console.error('[pickupAddress] save failed:', err && err.message);
    req.session.pickupFlash = {
      type: 'error',
      msg: /Duplicate/i.test(err.message || '')
        ? `A pickup address named "${row.nickname}" already exists.`
        : 'Could not save. Check the values and try again.',
    };
  } finally {
    conn.release();
  }

  return res.redirect('/admin/shipping/pickup-addresses');
};

/* ── POST /admin/shipping/pickup-addresses/:id/deactivate ────────── */
/* No delete route exists, and that is the point — see the header. */
exports.deactivate = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const conn = await bvoPool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'UPDATE pickup_addresses SET is_active = 0, is_default = 0 WHERE id = ?', [id]);
    const [[d]] = await conn.query(
      'SELECT COUNT(*) AS n FROM pickup_addresses WHERE is_default = 1 AND is_active = 1');
    if (!d.n) {
      await conn.query(
        `UPDATE pickup_addresses SET is_default = 1
          WHERE is_active = 1 ORDER BY sort_order ASC, nickname ASC LIMIT 1`);
    }
    await conn.commit();
    req.session.pickupFlash = { type: 'ok', msg: 'Address deactivated.' };
  } catch (err) {
    try { await conn.rollback(); } catch { /* nothing useful to do */ }
    console.error('[pickupAddress] deactivate failed:', err && err.message);
    req.session.pickupFlash = { type: 'error', msg: 'Could not deactivate.' };
  } finally {
    conn.release();
  }
  return res.redirect('/admin/shipping/pickup-addresses');
};

exports.listActive     = listActive;
exports._LOCATION_TYPES = LOCATION_TYPES;
