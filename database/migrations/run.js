'use strict';

/**
 * Migration runner — executes all *.sql files in this directory
 * in filename order (001_, 002_, etc.)
 *
 * Usage:  npm run migrate
 */

require('dotenv').config();

const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'bvo_website',
    user:     process.env.DB_USER || 'bvo_user',
    password: process.env.DB_PASS || '',
    multipleStatements: true,
    charset:  'utf8mb4',
  });

  console.log('\n[migrate] Connected to', process.env.DB_NAME || 'bvo_website');

  /* ── Ledger ────────────────────────────────────────────────────────
     This runner used to execute EVERY .sql in the directory on EVERY
     invocation, with no record of what had already been applied. That
     is fine while migrations are purely additive and stops being fine
     the moment one of them drops something.

     Two were destructive by the time this was noticed:
       · 005 opened with DROP TABLE product_attribute_values — ~176,000
         rows, the source of every attribute the site reads.
       · 008 dropped products.color_family, which 009 then re-added
         EMPTY — ~4,700 values, silently blanking the colour filters.

     Neither would have raised an error. Both are now self-guarded, so
     they are safe even when pasted straight into phpMyAdmin, which is
     how migrations here usually get run. This ledger is the second
     layer: once a file is recorded, it is never executed again.

     Applying by hand does NOT write to this table, so a hand-applied
     migration will be attempted once more by the runner. That is why
     the per-file guards matter more than the ledger does, and why
     every migration in this directory must be idempotent regardless.  */
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    VARCHAR(255) NOT NULL,
      applied_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const dir   = __dirname;
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  /* ── Adopting an existing database ────────────────────────────────
     Introducing the ledger creates it EMPTY, which on an established
     database would mean "nothing applied" and trigger a full re-run of
     all 22 migrations — precisely the event the ledger exists to
     prevent, on the very first run.

     So: if the ledger is empty but the schema is plainly already
     built, adopt it. Record every migration as applied without
     executing any of them, and let the operator apply anything new by
     hand or with --force.

     `products` having rows is the test. A genuinely fresh database has
     no such table, falls through, and migrates normally from 001.     */
  let [appliedRows] = await conn.query('SELECT filename FROM schema_migrations');
  if (appliedRows.length === 0) {
    const [[{ built }]] = await conn.query(`
      SELECT COUNT(*) AS built FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'
    `);
    let populated = 0;
    if (built) {
      const [[row]] = await conn.query('SELECT COUNT(*) AS n FROM products');
      populated = row.n;
    }
    if (populated > 0) {
      console.log(`[migrate] Existing database detected (${populated} products) and an`);
      console.log('[migrate] empty ledger. Adopting: recording all %d migrations as', files.length);
      console.log('[migrate] applied WITHOUT running them. Use --force to override.');
      for (const f of files) {
        await conn.query(
          'INSERT INTO schema_migrations (filename) VALUES (?) ' +
          'ON DUPLICATE KEY UPDATE applied_at = applied_at', [f]
        );
      }
      [appliedRows] = await conn.query('SELECT filename FROM schema_migrations');
    }
  }
  const applied = new Set(appliedRows.map(r => r.filename));

  /* --force re-runs everything, for the rare case of repairing a
     half-applied state. Announce it loudly: on this schema that is a
     destructive option, not a convenience. */
  const force = process.argv.includes('--force');
  if (force) {
    console.warn('[migrate] --force: ledger ignored, EVERY migration will re-run.');
    console.warn('[migrate] The guards in 005 and 008 are all that protect your data.');
  }

  let ran = 0, skipped = 0;
  for (const file of files) {
    if (!force && applied.has(file)) { skipped++; continue; }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`[migrate] Running ${file}…`);
    try {
      await conn.query(sql);
      await conn.query(
        'INSERT INTO schema_migrations (filename) VALUES (?) ' +
        'ON DUPLICATE KEY UPDATE applied_at = applied_at',
        [file]
      );
      ran++;
      console.log(`[migrate] ✓ ${file}`);
    } catch (err) {
      console.error(`[migrate] ✗ ${file}: ${err.message}`);
      await conn.end();
      process.exit(1);
    }
  }

  await conn.end();
  console.log(`[migrate] Done — ${ran} applied, ${skipped} already recorded.\n`);
}

run().catch(err => {
  // Show code + message — mysql2 connection errors sometimes have empty .message
  const detail = err.message || err.code || err.sqlMessage || JSON.stringify(err);
  console.error('[migrate] Fatal:', detail);
  if (err.code) console.error('[migrate] Error code:', err.code);
  if (err.address) console.error('[migrate] Host:', err.address, 'Port:', err.port);
  process.exit(1);
});
