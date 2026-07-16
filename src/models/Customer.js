'use strict';

const bcrypt     = require('bcryptjs');
const { bvoPool } = require('../config/database');

const Customer = {

  async findByEmail(email) {
    try {
      const [rows] = await bvoPool.query(
        'SELECT * FROM customers WHERE email = ? LIMIT 1',
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

  async create({ email, firstName, lastName, phone, password, acceptsMarketing = false }) {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await bvoPool.query(
      `INSERT INTO customers (email, first_name, last_name, phone, password_hash, accepts_marketing)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email.toLowerCase().trim(), firstName, lastName, phone || null, hash, acceptsMarketing ? 1 : 0]
    );
    return result.insertId;
  },

  async verifyPassword(plaintext, hash) {
    return bcrypt.compare(plaintext, hash);
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
