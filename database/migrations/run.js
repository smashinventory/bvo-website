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

  const dir   = __dirname;
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`[migrate] Running ${file}…`);
    try {
      await conn.query(sql);
      console.log(`[migrate] ✓ ${file}`);
    } catch (err) {
      console.error(`[migrate] ✗ ${file}: ${err.message}`);
      await conn.end();
      process.exit(1);
    }
  }

  await conn.end();
  console.log('[migrate] All migrations complete.\n');
}

run().catch(err => {
  // Show code + message — mysql2 connection errors sometimes have empty .message
  const detail = err.message || err.code || err.sqlMessage || JSON.stringify(err);
  console.error('[migrate] Fatal:', detail);
  if (err.code) console.error('[migrate] Error code:', err.code);
  if (err.address) console.error('[migrate] Host:', err.address, 'Port:', err.port);
  process.exit(1);
});
