'use strict';

/* Closed list of acquisition sources. An unrecognised value normalises to
   NULL rather than creating a new category, so two callers cannot split one
   real number into two smaller wrong ones. See the file for the reasoning. */
const SIGNUP_SOURCES = require('../config/signupSources');

/* NO BCRYPT HERE ANY MORE.
   Customer passwords are gone — the six-digit code IS the login (spec
   7.2), and `password_hash` was DROPPED from the customers table on
   2026-09-27. Every query below that named it would now fail with
   "Unknown column", so this is not tidying: leaving them would break
   sign-in outright.

   bcryptjs stays in package.json because adminController still uses it
   for the ADMIN login (ADMIN_PW_B64), which is a different system with
   a different threat model and is not affected by any of this. */
const { bvoPool } = require('../config/database');

const Customer = {

  async findByEmail(email) {
    try {
      const [rows] = await bvoPool.query(
        /* password_hash is NOT selected: the column was dropped on
           2026-09-27 and naming it makes this query fail outright with
           "Unknown column". The consent columns ARE selected because
           checkout reads them to set the checkbox defaults. */
        `SELECT id, email, first_name, last_name, accepts_marketing,
                marketing_consent_at, delivery_sms_consent,
                delivery_sms_consent_at, last_login_at, created_at
           FROM customers WHERE email = ? LIMIT 1`,
        [email.toLowerCase().trim()]
      );
      return rows[0] || null;
    } catch { return null; }
  },

  async findById(id) {
    try {
      const [rows] = await bvoPool.query(
        'SELECT id, email, first_name, last_name, phone, accepts_marketing, created_at FROM customers WHERE id = ? LIMIT 1',
        [id]
      );
      return rows[0] || null;
    } catch { return null; }
  },

  /* NO `password` PARAMETER. There is nowhere to put one: password_hash
     was dropped from the table on 2026-09-27 and the six-digit code is
     the login. A caller still passing one is a caller that has not been
     updated, and it is better that the argument simply does not exist
     than that it be accepted and silently discarded. */
  async create({ email, firstName, lastName, phone, acceptsMarketing = false, signupSource }) {
    const [result] = await bvoPool.query(
      `INSERT INTO customers (email, first_name, last_name, phone, accepts_marketing, signup_source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email.toLowerCase().trim(), firstName, lastName, phone || null,
       acceptsMarketing ? 1 : 0, SIGNUP_SOURCES.clean(signupSource)]
    );
    return result.insertId;
  },

  /* verifyPassword() is GONE. Nothing calls it, there is no hash to
     compare against, and leaving a working password-check function in a
     passwordless system is an invitation to reintroduce one. */

  /**
   * Find the customer for a VERIFIED email, creating one if there is none.
   *
   * Only ever called after authCodeService.verifyCode() has returned ok,
   * so the address is proven. That is what lets this both sign in and
   * register in a single step — and it is why the code endpoint cannot
   * enumerate customers: there is no "does this account exist" question
   * for it to answer, because the answer stops mattering.
   *
   * No password is written, and there is no column to write one to:
   * password_hash was dropped on 2026-09-27.
   * See docs/briefs/BVO_CHECKOUT_SPEC.md 7.2.
   */
  async findOrCreateByEmail(rawEmail, signupSource) {
    const email = String(rawEmail || '').toLowerCase().trim();
    if (!email) return null;

    const existing = await this.findByEmail(email);
    /* An existing customer keeps the source they were FIRST acquired with.
       Overwriting it on every sign-in would turn an acquisition field into a
       last-touch field, and the question it exists to answer — what produced
       this customer — would quietly become unanswerable. */
    if (existing) return { id: existing.id, email: existing.email,
                           first_name: existing.first_name, created: false };

    const [result] = await bvoPool.query(
      `INSERT INTO customers (email, first_name, last_name, accepts_marketing, signup_source)
       VALUES (?, '', '', 0, ?)`,
      [email, SIGNUP_SOURCES.clean(signupSource)]
    );
    return { id: result.insertId, email, first_name: '', created: true };
  },

  /**
   * Write a name ONLY where we do not already have one.
   *
   * The guard is in the WHERE clause, not an if() above it. A read-then-
   * write would race two tabs, and more importantly it would let a stale
   * form post a blank over a name captured five minutes earlier at
   * checkout. Here the condition and the write are one statement, so the
   * second caller simply updates nothing.
   *
   * last_name is only written when supplied: it is optional, and an empty
   * string posted by someone who skipped it must not erase a surname we
   * already have from an order.
   */
  async setNameIfMissing(customerId, firstName, lastName) {
    const id = parseInt(customerId, 10);
    if (!Number.isInteger(id) || id < 1) return false;
    const first = String(firstName || '').trim();
    if (!first) return false;
    const last = String(lastName || '').trim();

    const [r] = await bvoPool.query(
      `UPDATE customers
          SET first_name = ?,
              last_name  = CASE WHEN ? <> '' AND (last_name IS NULL OR last_name = '')
                                THEN ? ELSE last_name END
        WHERE id = ?
          AND (first_name IS NULL OR first_name = '')`,
      [first, last, last, id]
    );
    return r.affectedRows > 0;
  },

  /**
   * Write a phone number ONLY where we do not already have one.
   *
   * THE GAP THIS CLOSES. saveInfo has copied the buyer's name to their
   * customer record since 2026-10-01 (setNameIfMissing, right above) but
   * never their phone, because no setter existed. The result: customer 11's
   * admin detail page read "no phone number" while the order beside it held
   * the validated +1XXXXXXXXXX he had typed in himself. The number was
   * never missing — it was just never copied across.
   *
   * Guard in the WHERE clause, not an if() above it, for the same reason
   * setNameIfMissing does it that way: one statement cannot race a second
   * tab, and a stale form cannot post a blank over a number captured five
   * minutes earlier at checkout.
   *
   * ⚠️ NO EXTENSION. customers has one `phone` column, VARCHAR(30), and no
   * extension column. orders.ship_phone_ext stays on the order, where it
   * belongs: an extension describes how to reach someone about ONE
   * delivery. Concatenating "x204" in here would corrupt the only value
   * that has to stay dialable and E.164-shaped if SMS is ever switched on,
   * and it would silently overflow 30 characters for a long number.
   *
   * Expects E.164 — checkoutController has already run toE164() and
   * refused anything that is not /^\+1\d{10}$/, so no reformatting is done
   * here. Anything else is stored as given rather than mangled: a wrong
   * number you can see beats a cleaned one you cannot trace.
   */
  async setPhoneIfMissing(customerId, phone) {
    const id = parseInt(customerId, 10);
    if (!Number.isInteger(id) || id < 1) return false;
    const p = String(phone || '').trim();
    if (!p) return false;
    /* Longer than the column: refuse rather than let MySQL truncate a
       number into something that looks valid and dials nowhere. */
    if (p.length > 30) return false;

    const [r] = await bvoPool.query(
      `UPDATE customers
          SET phone = ?
        WHERE id = ?
          AND (phone IS NULL OR phone = '')`,
      [p, id]
    );
    return r.affectedRows > 0;
  },

  async updateLastLogin(id) {
    try {
      await bvoPool.query('UPDATE customers SET last_login_at = NOW() WHERE id = ?', [id]);
    } catch { /* non-critical */ }
  },

  /**
   * Toggle a product in/out of a customer's favorites.
   * Returns { saved: true } if the product was just added,
   *         { saved: false } if it was removed.
   */
  async toggleFavorite(customerId, productId) {
    // Try INSERT — if duplicate key, DELETE instead
    try {
      await bvoPool.query(
        'INSERT INTO favorites (customer_id, product_id) VALUES (?, ?)',
        [customerId, productId]
      );
      return { saved: true };
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        await bvoPool.query(
          'DELETE FROM favorites WHERE customer_id = ? AND product_id = ?',
          [customerId, productId]
        );
        return { saved: false };
      }
      throw err;
    }
  },

  /**
   * Returns the set of product IDs the customer has saved.
   * @param {number} customerId
   * @returns {Set<number>}
   */
  async getFavoriteIds(customerId) {
    try {
      const [rows] = await bvoPool.query(
        'SELECT product_id FROM favorites WHERE customer_id = ?',
        [customerId]
      );
      return new Set(rows.map(r => r.product_id));
    } catch { return new Set(); }
  },

  /**
   * Returns full product rows for a customer's saved items.
   * @param {number} customerId
   * @returns {object[]}
   */
  async getFavoriteProducts(customerId) {
    try {
      const [rows] = await bvoPool.query(`
        SELECT p.id, p.slug, p.name, p.brand, p.price, p.compare_price,
               p.color, p.color_family, p.is_new, p.is_featured,
               COALESCE(p.primary_image_url, pi.url) AS primary_image,
               CASE
                 WHEN p.compare_price IS NOT NULL AND p.compare_price > p.price THEN 'sale'
                 WHEN p.is_new = 1 THEN 'new'
                 WHEN p.is_featured = 1 THEN 'best'
               END AS badge
        FROM favorites f
        JOIN products p ON p.id = f.product_id
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        WHERE f.customer_id = ? AND p.is_active = 1
        ORDER BY f.created_at DESC
      `, [customerId]);
      return rows;
    } catch { return []; }
  },

  /**
   * ONE order, scoped to its owner.
   *
   * ⚠️ OWNERSHIP IS IN THE `WHERE`, NOT IN JAVASCRIPT. The id comes from the
   * URL and is attacker-controlled; the customer id comes from the SESSION.
   * Fetching by id and then comparing in the caller is the version of this
   * that leaks an order the first time someone forgets the comparison or
   * returns early. Here a mismatched pair simply returns no row.
   *
   * ⚠️ THE PREDICATE MATCHES getOrders() EXACTLY — `o.customer_id = ?`. If
   * the list and the detail ever disagree about whose order it is, the
   * result is either a 404 on an order the customer can see listed (the
   * 2026-10-26 defect this file is part of fixing) or, far worse, a detail
   * page for an order the list would never have shown.
   *
   * @returns {Promise<object|null>} null for "no such order OF YOURS" —
   *   deliberately indistinguishable from "no such order", so the caller
   *   can 404 without confirming that an id exists.
   */
  /* ⚠️ THIS METHOD DOES NOT CATCH, AND THAT IS THE FIX FOR A REAL DEFECT.
     It used to end with `catch { return null }`. On 2026-10-27 the SELECT
     below named a column that does not exist (`o.ship_name` — the table
     stores ship_first_name / ship_last_name). MySQL raised
     ER_BAD_FIELD_ERROR, the catch turned it into null, the controller read
     null as "no such order", and the customer got **the exact 404 this
     whole feature was built to fix**. The log line went to a file nobody
     was watching; the page said the order did not exist.

     A caught error that returns the same value as a legitimate empty
     result is worse than no handling at all: it is indistinguishable from
     success at the call site. Let it throw. The controller's try/catch
     turns it into a 500 — honest, loud, and logged with a stack. */
  async getOrder(customerId, orderId) {
    if (!customerId || !orderId) return null;
    const [rows] = await bvoPool.query(`
      SELECT o.id, o.order_number, o.status, o.payment_status,
             o.subtotal, o.tax, o.total,
             o.tier_pct, o.tier_at_order,
             o.created_at,
             /* There is no ship_name column. The admin builds the same
                string the same way — see ordersController's detail query.
                NULLIF(TRIM(...)) gives null rather than ' ' when both
                halves are empty, which is what the view tests. */
             NULLIF(TRIM(CONCAT(COALESCE(o.ship_first_name,''),' ',
                                COALESCE(o.ship_last_name,''))),'') AS ship_name,
             o.ship_address1, o.ship_address2,
             o.ship_city, o.ship_state, o.ship_zip,
             o.ship_address_type
        FROM orders o
       WHERE o.id = ? AND o.customer_id = ?
       LIMIT 1
    `, [orderId, customerId]);
    return (rows && rows[0]) || null;
  },

  /**
   * The lines of one order.
   *
   * ⚠️ CALL ONLY AFTER getOrder() HAS RETURNED A ROW. This is keyed by
   * order id alone, because the ownership question was already settled —
   * duplicating the customer check here would be a second definition of
   * ownership that can drift from the first.
   *
   * ⚠️ unit_price AND line_total ARE READ, NEVER RECOMPUTED. These are the
   * figures the customer actually paid, captured at order time. Multiplying
   * qty by a live product price would quietly rewrite history the next time
   * a price changed — and on a page whose entire purpose is to show what
   * was charged.
   */
  /* Does not catch — same reasoning as getOrder. An order with no items is
     a real state (nothing should produce it, but an empty list is a
     truthful answer); a broken query is not, and returning [] for both
     would render a paid order as having bought nothing. */
  async getOrderItems(orderId) {
    if (!orderId) return [];
    const [rows] = await bvoPool.query(`
      SELECT oi.id, oi.product_id, oi.sku, oi.name, oi.qty,
             oi.unit_price, oi.line_total,
             p.slug, p.primary_image_url
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC
    `, [orderId]);
    return rows || [];
  },

  /**
   * Tracking for one order, or null.
   *
   * ⚠️ A SHIPMENT ROW IS NOT TRACKING. A booking exists from the moment the
   * label is bought, before the carrier has issued a PRO number, and a
   * voided shipment keeps its row. "Track your order" must appear only when
   * there is something a customer can actually act on, so this returns null
   * unless a number exists and the shipment is not voided. The owner's
   * instruction, 2026-10-26: tracking appears once tracking is entered.
   */
  /* Does not catch — same reasoning as getOrder. "No tracking yet" and
     "the tracking query is broken" must not look identical: the first
     correctly hides the Track button, the second would hide it on a
     shipment that IS moving, and the customer would never know. */
  async getOrderTracking(orderId) {
    if (!orderId) return null;
    const [rows] = await bvoPool.query(`
      SELECT s.carrier, s.service_level, s.pro_number, s.bol_number,
             s.status, s.product_type, s.created_at
        FROM shipments s
       WHERE s.order_id = ?
         AND s.status <> 'voided'
         AND (s.pro_number IS NOT NULL AND s.pro_number <> '')
       ORDER BY s.created_at DESC
       LIMIT 1
    `, [orderId]);
    return (rows && rows[0]) || null;
  },

  async getOrders(customerId, limit = 20) {
    try {
      const [rows] = await bvoPool.query(`
        SELECT o.id, o.order_number, o.status, o.total, o.created_at,
               COUNT(oi.id) AS item_count
        FROM   orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE  o.customer_id = ?
        GROUP  BY o.id
        ORDER  BY o.created_at DESC
        LIMIT  ?
      `, [customerId, limit]);
      return rows;
    } catch { return []; }
  },

};

module.exports = Customer;
