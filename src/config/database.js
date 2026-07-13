'use strict';

const mysql = require('mysql2/promise');

// ── BVO Website DB ───────────────────────────────────────────────
const bvoPool = mysql.createPool({
  host:              process.env.DB_HOST     || 'localhost',
  port:              parseInt(process.env.DB_PORT || '3306', 10),
  database:          process.env.DB_NAME     || 'bvo_website',
  user:              process.env.DB_USER     || 'bvo_user',
  password:          process.env.DB_PASS     || '',
  waitForConnections: true,
  connectionLimit:   10,
  queueLimit:        0,
  connectTimeout:    3000,   // fail fast → placeholder fallback fires quickly
  charset:           'utf8mb4',
  timezone:          '+00:00',
});

// ── RFLPOS DB (read-only for sync) ───────────────────────────────
// Connects via Unix socket (same as PHP) to avoid IPv6 TCP auth issues.
// Set RFLPOS_DB_SOCKET in env (default: /var/lib/mysql/mysql.sock).
// Falls back to TCP if RFLPOS_DB_HOST is set and no socket path given.
let rflPool = null;

function getRflPool() {
  if (!rflPool && process.env.RFLPOS_DB_NAME) {
    const socketPath = process.env.RFLPOS_DB_SOCKET || '/var/lib/mysql/mysql.sock';
    const useSocket  = !process.env.RFLPOS_DB_HOST || process.env.RFLPOS_DB_SOCKET;

    rflPool = mysql.createPool({
      ...(useSocket
        ? { socketPath }
        : {
            host: process.env.RFLPOS_DB_HOST,
            port: parseInt(process.env.RFLPOS_DB_PORT || '3306', 10),
          }),
      database:           process.env.RFLPOS_DB_NAME,
      user:               process.env.RFLPOS_DB_USER,
      password:           process.env.RFLPOS_DB_PASS,
      waitForConnections: true,
      connectionLimit:    5,
      queueLimit:         0,
      charset:            'utf8mb4',
      timezone:           '+00:00',
    });
  }
  return rflPool;
}

// ── Health check helper ──────────────────────────────────────────
async function ping() {
  const conn = await bvoPool.getConnection();
  await conn.ping();
  conn.release();
  console.log('[DB] BVO website DB connected');
}

module.exports = { bvoPool, getRflPool, ping };
