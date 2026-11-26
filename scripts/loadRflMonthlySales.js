#!/usr/bin/env node
'use strict';

/**
 * loadRflMonthlySales.js — load RFL monthly sales from a CSV into
 * rfl_monthly_sales, for the overlay on the WC trend chart.
 *
 *   node scripts/loadRflMonthlySales.js <file.csv> --source=rflpos
 *   node scripts/loadRflMonthlySales.js <file.csv> --source=gvs_shopify --dry
 *
 * MANUAL BY DECISION. There is no cron and no watcher here (Sam, 2026-11-26:
 * "I don't need this automated. I will do an upload every so often as
 * needed."). Same posture as the WC snapshots.
 *
 * EXPECTED COLUMNS (header row required, order irrelevant, case-insensitive):
 *   month       2024-01 or 2024-01-01 or 01/2024 — normalised to the 1st
 *   store       Roswell | Kennesaw | ...
 *   net_sales   dollars; $ and thousands separators are tolerated
 *   units       OPTIONAL. A real WC vanity unit count for the month. Supply
 *               it whenever the export has one — the chart prefers it over
 *               the dollars ÷ price proxy, and then the price assumption
 *               stops mattering at all for that month.
 *   note        OPTIONAL free text, carried through to the row.
 *
 * --source IS REQUIRED AND NOT GUESSED. The pre-2024 GVS Shopify figures and
 * the post-2024 RFLPOS figures are different measurements, and the chart
 * draws them as two separate lines so the seam is visible rather than read as
 * a trend (WC_MARKET_ANALYSIS §1). Inferring the source from the date would
 * quietly mislabel any backfill that crossed the boundary, so it is stated
 * explicitly, once, by whoever is doing the load.
 *
 * Re-running with the same file is safe: the key is (month, store, source)
 * and the upsert overwrites. Correcting a month means re-loading it, not
 * deleting first.
 */

require('dotenv').config();
const fs    = require('fs');
const path  = require('path');
const mysql = require('mysql2/promise');

const SOURCES = ['rflpos', 'gvs_shopify'];

function parseArgs(argv) {
  const file = argv.find(a => !a.startsWith('--'));
  const src  = (argv.find(a => a.startsWith('--source=')) || '').split('=')[1];
  return { file, source: src, dry: argv.includes('--dry') };
}

/* Minimal CSV reader: quoted fields with embedded commas and doubled quotes.
   Deliberately not a dependency — this runs by hand a few times a year. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

/* Anything month-shaped → YYYY-MM-01. Returns null rather than a guess. */
function normaliseMonth(raw) {
  const s = String(raw || '').trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/)))  return `${m[1]}-${String(m[2]).padStart(2, '0')}-01`;
  if ((m = s.match(/^(\d{1,2})\/(\d{4})$/)))              return `${m[2]}-${String(m[1]).padStart(2, '0')}-01`;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)))   return `${m[3]}-${String(m[1]).padStart(2, '0')}-01`;
  return null;
}

const money = (raw) => {
  const n = Number(String(raw || '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

async function main() {
  const { file, source, dry } = parseArgs(process.argv.slice(2));

  if (!file || !SOURCES.includes(source)) {
    console.error('usage: node scripts/loadRflMonthlySales.js <file.csv> ' +
                  `--source=<${SOURCES.join('|')}> [--dry]`);
    process.exit(2);
  }
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) { console.error(`no such file: ${abs}`); process.exit(2); }

  const rows = parseCsv(fs.readFileSync(abs, 'utf8'));
  const hdr  = rows.shift().map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const col  = (name) => hdr.indexOf(name);

  for (const req of ['month', 'store', 'net_sales']) {
    if (col(req) === -1) {
      console.error(`missing required column "${req}". Found: ${hdr.join(', ')}`);
      process.exit(2);
    }
  }
  const iUnits = col('units'), iNote = col('note');

  /* Rejected rows are listed, never silently dropped: a load that quietly
     skips half a file and reports success is how a chart ends up with a
     plausible shape and the wrong level. */
  const good = [], bad = [];
  rows.forEach((r, n) => {
    const month = normaliseMonth(r[col('month')]);
    const store = String(r[col('store')] || '').trim();
    const sales = money(r[col('net_sales')]);
    const units = iUnits === -1 || !String(r[iUnits] || '').trim()
                    ? null : Math.round(Number(String(r[iUnits]).replace(/[,\s]/g, '')));
    const note  = iNote === -1 ? null : (String(r[iNote] || '').trim() || null);

    if (!month)            return bad.push([n + 2, `unparseable month "${r[col('month')]}"`]);
    if (!store)            return bad.push([n + 2, 'blank store']);
    if (sales === null)    return bad.push([n + 2, `unparseable net_sales "${r[col('net_sales')]}"`]);
    if (units !== null && !Number.isFinite(units))
                           return bad.push([n + 2, `unparseable units "${r[iUnits]}"`]);
    good.push([month, store, source, sales, units, note]);
  });

  const months = good.map(g => g[0]).sort();
  console.log(`file     ${abs}`);
  console.log(`source   ${source}`);
  console.log(`parsed   ${good.length} row(s), ${bad.length} rejected`);
  if (months.length) console.log(`range    ${months[0]} … ${months[months.length - 1]}`);
  console.log(`dollars  $${good.reduce((s, g) => s + g[3], 0).toLocaleString()}`);
  console.log(`units    ${good.filter(g => g[4] !== null).length} row(s) carry a real unit count`);
  if (bad.length) {
    console.log('\nrejected:');
    bad.forEach(([line, why]) => console.log(`  line ${line}: ${why}`));
  }
  if (!good.length) { console.error('\nnothing to load'); process.exit(1); }
  if (dry) { console.log('\n--dry: nothing written'); process.exit(0); }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER, password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  try {
    const [res] = await conn.query(
      `INSERT INTO rfl_monthly_sales (month, store, source, net_sales, units, note)
            VALUES ?
       ON DUPLICATE KEY UPDATE
            net_sales = VALUES(net_sales),
            units     = VALUES(units),
            note      = VALUES(note),
            loaded_at = CURRENT_TIMESTAMP`, [good]);
    /* affectedRows counts an overwrite as 2, so it is not a row count. */
    console.log(`\nloaded ${good.length} row(s) (affectedRows ${res.affectedRows})`);
  } finally {
    await conn.end();
  }
}

main().catch(err => { console.error(`\nload failed: ${err.message}`); process.exit(1); });
