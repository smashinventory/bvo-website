'use strict';

const mysql = require('mysql2/promise');

// LOW-4: Refuse to start if DB_PASS is absent — a blank password is a misconfiguration.
if (!process.env.DB_PASS) {
  console.error('FATAL: DB_PASS is not set in .env — refusing to start without a database password');
  process.exit(1);
}

// ── BVO Website DB ───────────────────────────────────────────────
const bvoPool = mysql.createPool({
  host:              process.env.DB_HOST     || 'localhost',
  port:              parseInt(process.env.DB_PORT || '3306', 10),
  database:          process.env.DB_NAME     || 'bvo_website',
  user:              process.env.DB_USER     || 'bvo_user',
  password:          process.env.DB_PASS     || '',
  waitForConnections:   true,
  connectionLimit:      10,
  queueLimit:           0,
  connectTimeout:       3000,
  charset:              'utf8mb4',
  timezone:             '+00:00',
  namedPlaceholders:    true,   // enables :param syntax in queries (used by JM importer upsertProduct)
});

/* ── ATTACH THE SQL TO QUERY ERRORS ──────────────────────────────
 * mysql2 throws several errors that do NOT name the query that caused them.
 * The one that bit us on 2026-10-15 was:
 *
 *   Error: Named query contains placeholders, but parameters object is undefined
 *       at toArrayParams (named-placeholders/index.js:91)
 *
 * — a stack entirely inside node_modules, with no SQL and no application
 * frame. It told us a query was wrong and nothing about which one, and no
 * amount of reading the code found it: the offending call passes its params
 * as a variable that is undefined only at runtime, so it is invisible to a
 * static search.
 *
 * This wrapper changes nothing about behaviour. It catches, attaches the SQL
 * and rethrows the SAME error object, so every existing try/catch, every
 * error code check and every stack trace is untouched. The only difference
 * is that err.sql now exists, which the handlers in server.js print.
 *
 * WHY THIS CLASS OF ERROR IS WORSE THAN IT LOOKS. The pool sets
 * namedPlaceholders: true (line above) for the benefit of exactly one query,
 * the JM importer's upsert. With it on, mysql2 routes EVERY query through
 * named-placeholders unless the params are an Array - so any query whose
 * params come out undefined throws here, inside the driver, before MySQL is
 * ever contacted. Scoping that flag to the importer is the right follow-up;
 * this wrapper is what makes the next occurrence diagnosable either way. */
function attachSql(pool, label) {
  const raw = pool.query.bind(pool);
  pool.query = function (sql, values) {
    try {
      return raw(sql, values).catch((err) => {
        if (err && !err.sql) {
          err.sql  = typeof sql === 'string' ? sql : (sql && sql.sql) || String(sql);
          err.pool = label;
        }
        throw err;
      });
    } catch (err) {
      /* mysql2 can also throw SYNCHRONOUSLY before returning a promise -
         which is exactly what the named-placeholders failure does. Without
         this branch the single case this wrapper exists for is the one case
         it would miss. */
      if (err && !err.sql) {
        err.sql  = typeof sql === 'string' ? sql : (sql && sql.sql) || String(sql);
        err.pool = label;
      }
      throw err;
    }
  };
  return pool;
}
attachSql(bvoPool, 'bvo');

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
