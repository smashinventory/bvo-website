'use strict';

// Load .env from the git repo — must run before any other require
require('dotenv').config({
  path: '/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/nodejs/.env',
});

/**
 * syncJMFeed.js — Daily JM Feed Auto-Importer
 * ─────────────────────────────────────────────
 * Scans /public_html/JM_Feed/ for any .xlsx file dropped by the
 * James Martin team, imports it via importFromWorkbook(), then
 * archives the file to /public_html/JM_Feed/archive/ with a
 * datestamp so nothing is overwritten or lost.
 *
 * Triggered by Hostinger cron at 11:59 PM EST (04:59 UTC) daily.
 *
 * Hostinger hPanel cron command:
 *   /usr/bin/node /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/nodejs/src/jobs/syncJMFeed.js >> /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/nodejs/logs/jm-sync.log 2>&1
 *
 * Cron schedule (hPanel):  59 4 * * *   (04:59 UTC = 11:59 PM EST)
 *
 * After domain migration, update paths above to bathroomvanitiesoutlet.com.
 */

const path = require('path');
const fs   = require('fs');
const XLSX = require('xlsx');

const { importFromWorkbook } = require('./importJamesMartinFeed');

// ── Paths ─────────────────────────────────────────────────────────────
const FEED_DIR    = '/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/public_html/JM_Feed';
const ARCHIVE_DIR = '/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/public_html/JM_Feed/archive';

// ── Logging ───────────────────────────────────────────────────────────
const log = msg => console.log(`[${new Date().toISOString()}] ${msg}`);

// ── Main ──────────────────────────────────────────────────────────────
(async () => {
  log('=== JM Feed Sync Start ===');

  // 1. Find xlsx files (skip archive subfolder)
  if (!fs.existsSync(FEED_DIR)) {
    log(`ERROR: Feed directory not found: ${FEED_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(FEED_DIR).filter(f =>
    f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$')
  );

  if (files.length === 0) {
    log('No .xlsx file found in JM_Feed — nothing to import.');
    log('=== JM Feed Sync End ===');
    process.exit(0);
  }

  if (files.length > 1) {
    log(`WARNING: ${files.length} xlsx files found — importing the most recent one only.`);
  }

  // Pick the most recently modified file if multiple exist
  const target = files
    .map(f => ({ name: f, mtime: fs.statSync(path.join(FEED_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0].name;

  const filePath = path.join(FEED_DIR, target);
  log(`Importing: ${target} (${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB)`);

  // 2. Parse workbook
  let wb;
  try {
    wb = XLSX.readFile(filePath, { cellDates: false });
  } catch (err) {
    log(`ERROR: Could not parse workbook — ${err.message}`);
    process.exit(1);
  }

  // 3. Import
  let result;
  try {
    result = await importFromWorkbook(wb, {
      onProgress: (n, total) => { if (n % 100 === 0) log(`  Progress: ${n} / ${total}`); },
    });
  } catch (err) {
    log(`ERROR: Import failed — ${err.message}`);
    process.exit(1);
  }

  log(`Import complete — imported: ${result.imported}, skipped: ${result.skipped}, errors: ${result.errors}`);

  if (result.errors > 0) {
    log('Error details:');
    result.errorList.forEach(e => log(`  ${e}`));
  }

  // 4. Archive the file
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

  const stamp      = new Date().toISOString().slice(0, 10);           // YYYY-MM-DD
  const archiveName = target.replace('.xlsx', `_imported_${stamp}.xlsx`);
  const archivePath = path.join(ARCHIVE_DIR, archiveName);

  fs.renameSync(filePath, archivePath);
  log(`Archived to: archive/${archiveName}`);

  log('=== JM Feed Sync End ===');
  process.exit(result.errors > 0 ? 1 : 0);
})();
