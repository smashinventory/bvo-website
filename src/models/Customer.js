'use strict';

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
  async create({ email, firstName, lastName, phone, acceptsMarketing = false }) {
    const [result] = await bvoPool.query(
      `INSERT INTO customers (email, first_name, last_name, phone, accepts_marketing)
       VALUES (?, ?, ?, ?, ?)`,
      [email.toLowerCase().trim(), firstName, lastName, phone || null, acceptsMarketing ? 1 : 0]
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
  async findOrCreateByEmail(rawEmail) {
    const email = String(rawEmail || '').toLowerCase().trim();
    if (!email) return null;

    const existing = await this.findByEmail(email);
    if (existing) return { id: existing.id, email: existing.email,
                           first_name: existing.first_name, created: false };

    const [result] = await bvoPool.query(
      `INSERT INTO customers (email, first_name, last_name, accepts_marketing)
       VALUES (?, '', '', 0)`,
      [email]
    );
    return { id: result.insertId, email, first_name: '', created: true };
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
