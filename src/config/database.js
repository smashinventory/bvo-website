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
  /* namedPlaceholders is deliberately NOT set here. See the note below —
     it is enabled PER QUERY by the one caller that needs it. */
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
 * WHY namedPlaceholders IS NO LONGER SET ON THE POOL (2026-10-16).
 *
 * It was enabled pool-wide on 2026-07-15 (commit 2208815) for ONE caller:
 * importJamesMartinFeed.upsertProduct, whose INSERT carries 44 columns and
 * is far safer written as :sku, :slug, ... than as 44 positional marks in a
 * hand-counted order. That reason is still good and the capability is kept.
 *
 * What was wrong was the SCOPE. With the flag on the pool, mysql2 routes
 * EVERY query in the app through named-placeholders unless its params are an
 * Array - and named-placeholders DOES NOT UNDERSTAND SQL COMMENTS. A single
 * question mark inside a block comment is read as a positional placeholder.
 *
 * That is not hypothetical. On 2026-10-16 this comment, inside a CREATE
 * TABLE in siteEvents.js:
 *
 *     "Did this request carry OUR session cookie back to us?"
 *
 * was parsed as a query with one placeholder and no parameters. It threw
 * inside the driver, as an uncaughtException, on every boot - two outages.
 *
 * So the flag is now enabled per query, by the single caller that wants it:
 *
 *     conn.query({ sql: `INSERT ... VALUES (:sku, :slug, ...)`,
 *                  namedPlaceholders: true }, data);
 *
 * Verified against mysql2's own _resolveNamedPlaceholders: with the pool
 * flag off and the per-query option on, the importer's SQL and values come
 * out byte-identical to before. gate_named_placeholders keeps the two in
 * step - removing the pool flag without the per-query option would break
 * the nightly JM feed import. */
/* ── THE RECENT-QUERY RING ───────────────────────────────────────
 * Added 2026-10-16, after the wrapper below failed to name the query on a
 * live reproduction. The log gave us this stack:
 *
 *     at PoolConnection.query  (mysql2/lib/base/connection.js:642)
 *     at ...                   (mysql2/lib/base/pool.js:248)
 *     at ...                   (mysql2/lib/base/pool.js:67)
 *
 * pool.js:67 is inside the getConnection CALLBACK. mysql2's pool defers the
 * real query into that callback, so the throw happens AFTER pool.query has
 * already returned — it never enters the promise chain, and it is not
 * synchronous either. Both branches of attachSql are blind to it, which is
 * why the [FATAL] line printed no sql:.
 *
 * So instead of trying to catch it, we remember. Every query is recorded
 * here before it is issued; the process handlers print the last few when
 * something dies. The throw lands microseconds after the call, so the
 * offending statement is reliably at or near the top of this list.
 *
 * Deliberately records the SQL TEXT ONLY, never the parameter values —
 * those are customer data (emails, addresses, order contents) and have no
 * business in a log we read over someone's shoulder in hPanel.
 *
 * Five entries, truncated. This is a diagnostic breadcrumb, not an audit
 * log; it must not become a memory or privacy liability of its own. */
const RECENT_MAX = 5;
const recentQueries = [];
function noteQuery(sql, label) {
  const text = typeof sql === 'string' ? sql : (sql && sql.sql) || String(sql);
  recentQueries.push({
    at:   new Date().toISOString(),
    pool: label,
    sql:  text.replace(/\s+/g, ' ').slice(0, 300),
  });
  if (recentQueries.length > RECENT_MAX) recentQueries.shift();
}

function sqlText(sql) {
  return typeof sql === 'string' ? sql : (sql && sql.sql) || String(sql);
}

/* ONE tagger, used by every wrapper below. It was briefly copy-pasted into
   two places and the mutation harness caught the consequence immediately:
   deleting one copy left the other, so the gate passed while half the query
   paths went untagged. */
function tagError(err, sql, label) {
  if (err && !err.sql) { err.sql = sqlText(sql); err.pool = label; }
  return err;
}

/* Wraps ONE query function (pool.query or connection.query) so that every
   statement is recorded and every error carries its SQL. Both the async and
   the synchronous throw paths are covered: mysql2 can throw before it
   returns a promise, which is exactly what the named-placeholders failure
   does, so a .catch() alone would miss the case this exists for. */
function wrapQuery(target, label) {
  const raw = target.query.bind(target);
  target.query = function (sql, values) {
    noteQuery(sql, label);
    try {
      return raw(sql, values).catch((err) => { throw tagError(err, sql, label); });
    } catch (err) {
      throw tagError(err, sql, label);
    }
  };
  return target;
}

function attachSql(pool, label) { return wrapQuery(pool, label); }
attachSql(bvoPool, 'bvo');

/* The importer, and anything else running a transaction, calls
   bvoPool.getConnection() and then conn.query(...) - which never passes
   through the wrapper above. That gap meant the recent-query ring could not
   see a single importer query, so a failure there would still be unnamed.
   Wrap the connection on the way out. */
const _rawGetConnection = bvoPool.getConnection.bind(bvoPool);
bvoPool.getConnection = async function () {
  const conn = await _rawGetConnection();
  /* Pooled connections are reused, so wrap once and mark it. */
  if (!conn.__sqlWrapped) { wrapQuery(conn, 'bvo:conn'); conn.__sqlWrapped = true; }
  return conn;
};

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

/* Is this error the database's, rather than the application's?
 *
 * This is the discriminator the uncaughtException handler uses to decide
 * whether to keep serving or to exit, so it has to be conservative in the
 * right direction: a false NEGATIVE just exits as before (safe, and what
 * we already did); a false POSITIVE keeps running a process that might be
 * genuinely broken. Hence three narrow tests rather than one loose one.
 *
 * The third test exists because the error that caused the 2026-10-16
 * outage has NO code and NO sqlState — named-placeholders throws a bare
 * Error. The only thing identifying it is that every frame of its stack is
 * inside the driver. A throw that originated entirely within mysql2 is the
 * driver rejecting one statement; the rest of the process is untouched. */
function isDatabaseError(err) {
  if (!err) return false;
  if (err.sqlState || err.sqlMessage) return true;
  if (typeof err.code === 'string' &&
      /^(ER_|PROTOCOL_|POOL_|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EPIPE)/.test(err.code)) return true;
  return /node_modules[\/\\](mysql2|named-placeholders)[\/\\]/.test(String(err.stack || ''));
}

module.exports = {
  bvoPool, getRflPool, ping,
  isDatabaseError,
  /* A copy, so a handler printing this cannot mutate the ring. */
  recentQueries: () => recentQueries.slice(),
};
