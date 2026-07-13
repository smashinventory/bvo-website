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
