'use strict';

/**
 * jmvMovementRollup.js
 * Reads nightly JMV snapshot CSV.gz files, computes per-SKU deltas,
 * applies the three-hazard rules, and upserts:
 *   jmv_snapshots          — raw daily qty + map per SKU
 *   jmv_snapshot_validity  — row-count sanity gate
 *   jmv_daily_movement     — delta / demand_min / received bounds / restock flag
 *   jmv_dimensions         — 17-attribute upsert from dimensions.csv.gz
 *
 * THREE HAZARDS (never violate):
 *  1. Shared-component coupling → MAX per group_number, never SUM
 *  2. Restock censoring         → delta > 0 hides demand; impute from trailing avg
 *  3. Feed gaps                 → row count ±10% of median → mark INVALID, skip rate math
 *
 * Called from:
 *   POST /admin/marketing/jmv/run-rollup  (manual trigger)
 *   node-cron in server.js                (nightly, 05:30 UTC — after PHP sync at 04:59)
 *
 * Env:
 *   JMV_SNAPSHOTS_PATH  path to jmv_sync/snapshots/ on server
 *   (defaults to <project_root>/jmv_sync/snapshots/)
 */

const path   = require('path');
const fs     = require('fs');
const zlib   = require('zlib');
const readline = require('readline');
const XLSX   = require('xlsx');
const { bvoPool } = require('../config/database');

const SNAPSHOTS_DIR = process.env.JMV_SNAPSHOTS_PATH
  || path.join(__dirname, '../../../jmv_sync/snapshots');

// Protected XLSX archive — JM_Feed_Repo/archive/ gets a new file every night via gvssync.sh
const FEED_ARCHIVE_DIR = process.env.JMV_FEED_ARCHIVE
  || path.join(__dirname, '../../../JM_Feed_Repo/archive');

// Column names in the XLSX have trailing spaces — strip before use
const XLSX_COL_MAP = {
  sku:          'Item Number',
  qty:          'Total Inventory',
  type:         'Product Type',
  vanity_type:  'Vanity Type',
  group:        'Group Number',
  name:         'Product Name',
  map:          'MAP Price',
  collection:   'Collection Name',
  base_finish:  'Vanity Base Color/Finish',
  top_material: 'Vanity Countertop Material',
  top_finish:   'Countertop Finish',
  hardware:     'Hardware Finish',
  freepower:    'FreePower Compatible?',
  sinks:        'Number of Sinks Included (0, 1, or 2)',
  theme:        'Theme (Contemporary/Modern, Transitional, Traditional, or Commercial)',
  released:     'Release Date',
  status:       'Item Status',
};

// Product types that carry their own nominal size (parsed from Product Name)
const SIZED_TYPES = new Set(['Vanity','Cabinet','Top','Mirror','Linen Cabinet',
  'Storage Cabinet','Backsplash','Bench','Shelf','Hutch','Drawer Unit','Console']);
const SIZE_RE = /(\d+(?:\.\d+)?)\s*"/;

// Row-count validity gate: >10% deviation from trailing 7-day median → INVALID
const VALIDITY_THRESHOLD = 0.10;

// Trailing window for demand imputation on restock days
const TRAILING_DAYS = 14;

/* ─────────────────────────────────────────────────────────────────────
   INTERNAL HELPERS
───────────────────────────────────────────────────────────────────── */

/** Parse a YYYY-MM-DD.csv.gz snapshot filename → Date string or null */
function parseDateFromFilename(filename) {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})\.csv(?:\.gz)?$/);
  return m ? m[1] : null;
}

/** Parse a JMV-product-feed_imported_YYYY-MM-DD.xlsx archive filename → Date string or null */
function parseDateFromXlsxFilename(filename) {
  const m = filename.match(/JMV-product-feed_imported_(\d{4}-\d{2}-\d{2})\.xlsx$/);
  return m ? m[1] : null;
}

/**
 * Read a JMV XLSX feed file from the archive folder.
 * Returns [{sku, qty, map_price}] or null if file doesn't exist.
 */
function readXlsxFeedFile(dateStr) {
  const filepath = path.join(FEED_ARCHIVE_DIR, `JMV-product-feed_imported_${dateStr}.xlsx`);
  if (!fs.existsSync(filepath)) return null;

  const wb   = XLSX.readFile(filepath, { dense: false });
  const ws   = wb.Sheets['Etail Products'];
  if (!ws) return null;

  const raw  = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const rows = [];
  for (const row of raw) {
    // Strip trailing spaces from all column names
    const clean = {};
    for (const [k, v] of Object.entries(row)) clean[k.trim()] = v;

    const sku = String(clean[XLSX_COL_MAP.sku] || '').trim();
    if (!sku) continue;
    const qty = parseInt(String(clean[XLSX_COL_MAP.qty] || '0').replace(/[^0-9]/g,''), 10) || 0;
    const mapRaw = String(clean[XLSX_COL_MAP.map] || '').replace(/[$,]/g,'');
    rows.push({ sku, qty, map_price: parseFloat(mapRaw) || null });
  }
  return rows;
}

/**
 * Read dimension attributes from a JMV XLSX feed file.
 * Used when dimensions.csv.gz doesn't exist yet.
 * Returns an array of dimension objects ready for upsertDimensions().
 */
function readXlsxDimensions(dateStr) {
  const filepath = path.join(FEED_ARCHIVE_DIR, `JMV-product-feed_imported_${dateStr}.xlsx`);
  if (!fs.existsSync(filepath)) return [];

  const wb  = XLSX.readFile(filepath, { dense: false });
  const ws  = wb.Sheets['Etail Products'];
  if (!ws) return [];

  const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const rows = [];
  for (const row of raw) {
    const clean = {};
    for (const [k, v] of Object.entries(row)) clean[k.trim()] = v;

    const sku  = String(clean[XLSX_COL_MAP.sku] || '').trim();
    if (!sku) continue;

    const ptype = String(clean[XLSX_COL_MAP.type] || '').trim();
    const name  = String(clean[XLSX_COL_MAP.name] || '');
    const sizeM = SIZE_RE.exec(name);
    const sizeNominal = (sizeM && SIZED_TYPES.has(ptype)) ? parseFloat(sizeM[1]) : null;

    const sinksRaw = String(clean[XLSX_COL_MAP.sinks] || '0').trim();
    const sinks    = parseInt(sinksRaw, 10) || 0;
    const fpRaw    = String(clean[XLSX_COL_MAP.freepower] || '').trim().toUpperCase();
    const freepower = /^(Y|YES|1)$/.test(fpRaw) ? 1 : 0;

    rows.push({
      sku,
      collection:   String(clean[XLSX_COL_MAP.collection] || '').trim() || null,
      group_number: String(clean[XLSX_COL_MAP.group] || '').trim() || null,
      product_type: ptype || null,
      vanity_type:  String(clean[XLSX_COL_MAP.vanity_type] || '').trim() || null,
      base_finish:  String(clean[XLSX_COL_MAP.base_finish] || '').trim() || null,
      top_finish:   String(clean[XLSX_COL_MAP.top_finish] || '').trim() || null,
      top_material: String(clean[XLSX_COL_MAP.top_material] || '').trim() || null,
      size_nominal: sizeNominal,
      fits_size:    null,
      theme:        String(clean[XLSX_COL_MAP.theme] || '').trim() || null,
      sinks,
      hardware:     String(clean[XLSX_COL_MAP.hardware] || '').trim() || null,
      freepower,
      released:     String(clean[XLSX_COL_MAP.released] || '').trim() || null,
    });
  }
  return rows;
}

/** Read a .csv.gz or .csv file into an array of {sku, qty, map_price} */
async function readSnapshotFile(filepath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const isGz = filepath.endsWith('.gz');
    const stream = fs.createReadStream(filepath);
    const input  = isGz ? stream.pipe(zlib.createGunzip()) : stream;
    const rl = readline.createInterface({ input, crlfDelay: Infinity });
    let header = null;
    rl.on('line', line => {
      if (!line.trim()) return;
      const parts = line.split(',');
      if (!header) { header = parts.map(h => h.trim().toLowerCase()); return; }
      const row = {};
      header.forEach((h, i) => row[h] = (parts[i] || '').trim());
      const qty = parseInt(row['qty'] || row['total_inventory'] || '0', 10);
      const map = parseFloat((row['map'] || row['map_price'] || '').replace(/[$,]/g,'')) || null;
      if (row['sku'] || row['item_number']) {
        rows.push({ sku: (row['sku'] || row['item_number']).trim(), qty: isNaN(qty) ? 0 : qty, map_price: isNaN(map) ? null : map });
      }
    });
    rl.on('close', () => resolve(rows));
    rl.on('error', reject);
    stream.on('error', reject);
  });
}

/** Read dimensions.csv.gz → array of dimension objects */
async function readDimensionsFile() {
  const candidates = [
    path.join(SNAPSHOTS_DIR, 'dimensions.csv.gz'),
    path.join(SNAPSHOTS_DIR, 'dimensions.csv'),
  ];
  const file = candidates.find(f => fs.existsSync(f));
  if (!file) return [];

  return new Promise((resolve, reject) => {
    const rows = [];
    const isGz = file.endsWith('.gz');
    const stream = fs.createReadStream(file);
    const input  = isGz ? stream.pipe(zlib.createGunzip()) : stream;
    const rl = readline.createInterface({ input, crlfDelay: Infinity });
    let header = null;
    rl.on('line', line => {
      if (!line.trim()) return;
      const parts = line.split(',');
      if (!header) { header = parts.map(h => h.trim().toLowerCase().replace(/\s+/g,'_')); return; }
      const obj = {};
      header.forEach((h, i) => obj[h] = (parts[i] || '').trim());
      if (obj['sku'] || obj['item_number']) rows.push(obj);
    });
    rl.on('close', () => resolve(rows));
    rl.on('error', reject);
    stream.on('error', reject);
  });
}

/** Get trailing row-count median from jmv_snapshot_validity */
async function getTrailingMedian(conn) {
  const [rows] = await conn.query(
    `SELECT row_count FROM jmv_snapshot_validity
     WHERE is_valid = 1 ORDER BY snapshot_date DESC LIMIT 7`
  );
  if (!rows.length) return null;
  const counts = rows.map(r => r.row_count).sort((a,b) => a-b);
  return counts[Math.floor(counts.length / 2)];
}

/** Get trailing 14-day avg demand for a single SKU */
async function getTrailingAvg(conn, sku) {
  const [rows] = await conn.query(
    `SELECT AVG(demand_min) AS avg_d
     FROM jmv_daily_movement
     WHERE sku = ? AND is_valid = 1 AND demand_min > 0
       AND movement_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [sku, TRAILING_DAYS]
  );
  return rows[0]?.avg_d || null;
}

/* ─────────────────────────────────────────────────────────────────────
   CORE ROLLUP
───────────────────────────────────────────────────────────────────── */

/**
 * processSnapshot(dateStr)
 * Process a single snapshot date end-to-end.
 * Returns { date, inserted, restocks, skipped, isValid, notes }
 */
async function processSnapshot(dateStr, conn) {
  // Prefer lightweight csv.gz snapshot; fall back to XLSX archive
  let rows;
  const csvCandidates = [
    path.join(SNAPSHOTS_DIR, `${dateStr}.csv.gz`),
    path.join(SNAPSHOTS_DIR, `${dateStr}.csv`),
  ];
  const csvFile = csvCandidates.find(f => fs.existsSync(f));
  if (csvFile) {
    rows = await readSnapshotFile(csvFile);
  } else {
    const xlsxRows = readXlsxFeedFile(dateStr);
    if (!xlsxRows) throw new Error(`No snapshot or XLSX found for ${dateStr}`);
    rows = xlsxRows;
  }
  const rowCount = rows.length;

  // Validity gate
  const median = await getTrailingMedian(conn);
  let isValid = 1;
  let notes = null;
  if (median !== null) {
    const deviation = Math.abs(rowCount - median) / median;
    if (deviation > VALIDITY_THRESHOLD) {
      isValid = 0;
      notes = `Row count ${rowCount} deviates ${(deviation*100).toFixed(1)}% from median ${median} — marked INVALID`;
    }
  }

  // Record validity
  await conn.query(
    `INSERT INTO jmv_snapshot_validity (snapshot_date, row_count, is_valid, notes)
     VALUES (?,?,?,?)
     ON DUPLICATE KEY UPDATE row_count=VALUES(row_count), is_valid=VALUES(is_valid), notes=VALUES(notes)`,
    [dateStr, rowCount, isValid, notes]
  );

  // Upsert jmv_snapshots
  if (rows.length) {
    const vals = rows.map(r => [dateStr, r.sku, r.qty, r.map_price]);
    await conn.query(
      `INSERT INTO jmv_snapshots (snapshot_date, sku, qty, map_price) VALUES ?
       ON DUPLICATE KEY UPDATE qty=VALUES(qty), map_price=VALUES(map_price)`,
      [vals]
    );
  }

  if (!isValid) {
    return { date: dateStr, inserted: 0, restocks: 0, skipped: rowCount, isValid: false, notes };
  }

  // Get previous day's snapshot from DB to compute deltas
  const [prevRows] = await conn.query(
    `SELECT sku, qty FROM jmv_snapshots
     WHERE snapshot_date = (
       SELECT MAX(snapshot_date) FROM jmv_snapshots
       WHERE snapshot_date < ? AND snapshot_date IN (
         SELECT snapshot_date FROM jmv_snapshot_validity WHERE is_valid = 1
       )
     )`,
    [dateStr]
  );

  if (!prevRows.length) {
    // No previous valid snapshot — record this day but skip delta computation
    return { date: dateStr, inserted: rowCount, restocks: 0, skipped: 0, isValid: true, notes: 'First snapshot — no delta computed' };
  }

  const prevMap = new Map(prevRows.map(r => [r.sku, r.qty]));

  /* ── NO OBSERVATION vs ZERO DEMAND ─────────────────────────────────
     ADDED 2026-09-03.

     James Martin publishes new data roughly once every 24h, but gvssync
     runs twice daily and the rollup runs per calendar date. So a date
     regularly gets a snapshot that is BYTE-IDENTICAL to the previous one.

     Previously that produced 5,218 rows of delta = 0, is_valid = 1 —
     asserting "we looked and observed no demand anywhere in the warehouse".
     We did not look. JM had not published. The Financials chart then drew
     $0 on 08-24, 08-28, 08-30, 09-01 and 09-03, and the depletion that
     really occurred on those days was attributed to whichever date the feed
     did change: 08-29 showed 18,949 units for what was actually two days.

     Now: if not one SKU differs, this date has NO OBSERVATION. No movement
     rows are written, and any previously written for it are removed. Charts
     gap rather than showing a false zero.

     The next date that DOES differ needs no special handling — its delta is
     already measured against the last changed state, so the VALUE is right.
     What it lacked was a record of how many days it covers. span_days
     supplies that, so a two-day observation can be labelled as one rather
     than read as a one-day spike. */
  let changedSkus = 0;
  for (const row of rows) {
    const qtyPrev = prevMap.has(row.sku) ? prevMap.get(row.sku) : row.qty;
    if (row.qty !== qtyPrev) { changedSkus++; break; }
  }

  if (changedSkus === 0) {
    // Remove anything previously recorded for this date under the old
    // behaviour, so a re-run repairs history rather than leaving false zeros.
    const [purged] = await conn.query(
      `DELETE FROM jmv_daily_movement WHERE movement_date = ?`, [dateStr]
    );
    await conn.query(
      `INSERT INTO jmv_snapshot_validity (snapshot_date, row_count, is_valid, notes)
       VALUES (?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE notes=VALUES(notes)`,
      [dateStr, rowCount, 'Feed unchanged — no observation, no movement recorded']
    );
    console.log(`[rollup] ${dateStr}: feed unchanged since previous snapshot — ` +
                `no observation recorded${purged.affectedRows ? `, purged ${purged.affectedRows} false zero rows` : ''}`);
    return {
      date: dateStr, inserted: 0, restocks: 0, skipped: rowCount,
      isValid: true, noObservation: true,
      notes: 'Feed unchanged — no observation (chart will gap, not show zero)',
    };
  }

  /* How many calendar days this observation covers. 1 normally; more when
     the preceding days had no new feed. Uses the previous date that actually
     produced movement rows, so it stays correct after the purge above. */
  const [spanRow] = await conn.query(
    `SELECT GREATEST(1, DATEDIFF(?, COALESCE(
              (SELECT MAX(movement_date) FROM jmv_daily_movement
                WHERE movement_date < ?),
              DATE_SUB(?, INTERVAL 1 DAY)
            ))) AS span`,
    [dateStr, dateStr, dateStr]
  );
  const spanDays = Math.min(255, Number(spanRow[0]?.span || 1));
  if (spanDays > 1) {
    console.log(`[rollup] ${dateStr}: observation covers ${spanDays} days ` +
                `(no new feed on the preceding ${spanDays - 1})`);
  }

  // Compute deltas + restock detection
  let inserted = 0, restocks = 0;
  const movementRows = [];

  for (const row of rows) {
    const qtyEnd   = row.qty;
    const qtyPrev  = prevMap.has(row.sku) ? prevMap.get(row.sku) : qtyEnd;
    const delta    = qtyEnd - qtyPrev;

    let demandMin   = 0;
    let receivedMin = 0;
    let receivedMax = 0;
    let demandEst   = null;
    let isRestock   = 0;
    let isEstimated = 0;

    if (delta < 0) {
      // Depletion day — observed drawdown
      demandMin = -delta;
    } else if (delta > 0) {
      // Restock day — actual demand is hidden; store bounds
      isRestock   = 1;
      receivedMin = delta;
      receivedMax = delta + qtyPrev;
      // Impute demand from trailing 14-day avg (async — batch these)
      isEstimated = 1;
      restocks++;
    }
    // delta === 0 → no movement

    movementRows.push([
      dateStr, row.sku, qtyEnd, delta,
      demandMin, receivedMin, receivedMax,
      demandEst, isRestock, isEstimated, 1 /* is_valid */, spanDays
    ]);
    inserted++;
  }

  // Batch upsert movement rows
  if (movementRows.length) {
    await conn.query(
      `INSERT INTO jmv_daily_movement
         (movement_date, sku, qty_end, delta,
          demand_min, received_min, received_max,
          demand_est, is_restock, is_estimated, is_valid, span_days)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         qty_end=VALUES(qty_end), delta=VALUES(delta),
         demand_min=VALUES(demand_min), received_min=VALUES(received_min),
         received_max=VALUES(received_max), demand_est=VALUES(demand_est),
         is_restock=VALUES(is_restock), is_estimated=VALUES(is_estimated),
         is_valid=VALUES(is_valid), span_days=VALUES(span_days)`,
      [movementRows]
    );
  }

  // Back-fill demand_est for restock rows (trailing avg per SKU)
  // Done after batch insert to avoid N+1 on most common case (no restocks)
  if (restocks > 0) {
    const restockSkus = movementRows
      .filter(r => r[8] === 1) // is_restock
      .map(r => r[1]);          // sku

    for (const sku of restockSkus) {
      const avg = await getTrailingAvg(conn, sku);
      if (avg !== null) {
        await conn.query(
          `UPDATE jmv_daily_movement SET demand_est = ?
           WHERE movement_date = ? AND sku = ?`,
          [Math.round(avg * 10) / 10, dateStr, sku]
        );
      }
    }
  }

  return { date: dateStr, inserted, restocks, skipped: 0, isValid: true, notes };
}

/* ─────────────────────────────────────────────────────────────────────
   DIMENSION UPSERT
───────────────────────────────────────────────────────────────────── */

/**
 * upsertDimensions()
 * Reads dimensions.csv.gz and upserts jmv_dimensions.
 * Safe to run weekly — ON DUPLICATE KEY UPDATE.
 */
async function upsertDimensions(conn) {
  let rows = await readDimensionsFile();
  let source = 'dimensions.csv.gz';

  // Fall back to latest XLSX in archive when no dimensions.csv.gz exists
  if (!rows.length && fs.existsSync(FEED_ARCHIVE_DIR)) {
    const xlsxFiles = fs.readdirSync(FEED_ARCHIVE_DIR)
      .map(f => ({ f, d: parseDateFromXlsxFilename(f) }))
      .filter(x => x.d)
      .sort((a, b) => b.d.localeCompare(a.d));

    if (xlsxFiles.length) {
      const latestDate = xlsxFiles[0].d;
      rows  = readXlsxDimensions(latestDate);
      source = `XLSX archive (${latestDate})`;
    }
  }

  if (!rows.length) return { upserted: 0, notes: 'No dimension source found (csv.gz or XLSX)' };

  const today = new Date().toISOString().slice(0, 10);
  let upserted = 0;

  for (const r of rows) {
    const sku = (r['sku'] || r['item_number'] || '').trim();
    if (!sku) continue;
    await conn.query(
      `INSERT INTO jmv_dimensions
         (sku, collection, group_number, product_type, vanity_type,
          base_finish, top_finish, top_material, size_nominal, fits_size,
          theme, sinks, hardware, freepower, released, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         collection=VALUES(collection), group_number=VALUES(group_number),
         product_type=VALUES(product_type), vanity_type=VALUES(vanity_type),
         base_finish=VALUES(base_finish), top_finish=VALUES(top_finish),
         top_material=VALUES(top_material), size_nominal=VALUES(size_nominal),
         fits_size=VALUES(fits_size), theme=VALUES(theme),
         sinks=VALUES(sinks), hardware=VALUES(hardware),
         freepower=VALUES(freepower), released=VALUES(released),
         updated_at=VALUES(updated_at)`,
      [
        sku,
        r['collection'] || r['collection_name'] || null,
        r['group_number'] || r['group'] || null,
        r['product_type'] || null,
        r['vanity_type'] || null,
        r['base_finish'] || r['vanity_base_color_finish'] || null,
        r['top_finish'] || r['countertop_finish'] || null,
        r['top_material'] || r['vanity_countertop_material'] || null,
        parseFloat(r['size_nominal'] || r['size'] || '') || null,
        parseFloat(r['fits_size'] || '') || null,
        r['theme'] || null,
        parseInt(r['sinks'] || r['number_of_sinks_included'] || '0', 10) || 0,
        r['hardware'] || r['hardware_finish'] || null,
        /^(y|yes|1)$/i.test(r['freepower'] || r['freepower_compatible'] || '') ? 1 : 0,
        r['released'] || r['release_date'] || null,
        today,
      ]
    );
    upserted++;
  }
  return { upserted, notes: null };
}

/* ─────────────────────────────────────────────────────────────────────
   PUBLIC API
───────────────────────────────────────────────────────────────────── */

/**
 * runRollup({ dates, includeDimensions })
 * Main entry point. Accepts optional array of date strings;
 * defaults to all unprocessed dates found in SNAPSHOTS_DIR.
 *
 * Returns array of per-date result objects.
 */
async function runRollup({ dates = null, includeDimensions = false } = {}) {
  const conn = await bvoPool.getConnection();
  const results = [];

  try {
    // Discover dates to process — check csv.gz snapshots AND XLSX archive
    let targetDates = dates;
    if (!targetDates) {
      const csvFiles  = fs.existsSync(SNAPSHOTS_DIR)    ? fs.readdirSync(SNAPSHOTS_DIR)    : [];
      const xlsxFiles = fs.existsSync(FEED_ARCHIVE_DIR) ? fs.readdirSync(FEED_ARCHIVE_DIR) : [];

      const allDates = Array.from(new Set([
        ...csvFiles.map(f  => parseDateFromFilename(f)).filter(Boolean),
        ...xlsxFiles.map(f => parseDateFromXlsxFilename(f)).filter(Boolean),
      ])).sort();

      // Find which dates already have movement rows
      const [processed] = await conn.query(
        `SELECT DISTINCT DATE_FORMAT(movement_date,'%Y-%m-%d') AS d FROM jmv_daily_movement`
      );
      const processedSet = new Set(processed.map(r => r.d));
      targetDates = allDates.filter(d => !processedSet.has(d));
    }

    for (const date of targetDates) {
      try {
        const result = await processSnapshot(date, conn);
        results.push(result);
      } catch (err) {
        results.push({ date, error: err.message });
      }
    }

    if (includeDimensions) {
      const dimResult = await upsertDimensions(conn);
      results.push({ type: 'dimensions', ...dimResult });
    }

    /* Demand scores run on EVERY rollup, not only on dimension days. The
       storefront sorts by this, so a stale score is a visibly wrong page
       ordering rather than a stale report nobody is looking at.

       ISOLATED 2026-09-03 — this must never take the rollup down with it.

       As first written it was un-guarded, so on a server where the
       demand_score migration had not been run yet the whole job died:

         [FATAL] Unknown column 'p.demand_score' in 'SET'
         exit=1

       Snapshot ingestion and movement deltas had already completed and
       committed by that point; only the reporting of them was lost, along
       with a red "Rollup failed" in the admin UI. That is a bad trade for an
       optional enhancement. Scoring is a nice-to-have layered on top of the
       rollup — the rollup is the thing that must not fail.

       A missing column is now a warning naming the migration to run. */
    try {
      const scoreResult = await updateDemandScores(conn);
      results.push({ type: 'demand_scores', ...scoreResult });
    } catch (scoreErr) {
      const missingColumn = scoreErr.code === 'ER_BAD_FIELD_ERROR';
      if (missingColumn) {
        console.warn('[rollup] demand scores SKIPPED — products.demand_score does not exist.');
        console.warn('[rollup]   Run migrations/2026-09-02_product_demand_score.sql, then re-run.');
        console.warn('[rollup]   Collection pages keep their current order until then.');
      } else {
        console.error('[rollup] demand scores FAILED:',
                      scoreErr.code || '', scoreErr.sqlMessage || scoreErr.message);
      }
      results.push({
        type: 'demand_scores',
        skipped: true,
        error: missingColumn
          ? 'products.demand_score missing — run migrations/2026-09-02_product_demand_score.sql'
          : (scoreErr.sqlMessage || scoreErr.message),
      });
    }
  } finally {
    conn.release();
  }

  return results;
}

/**
 * updateDemandScores(conn)
 * ─────────────────────────────────────────────────────────────────────
 * Writes products.demand_score from JM warehouse depletion, so collection
 * pages can sort by popularity.
 *
 * THE SIGNAL IS MACRO, NOT OURS. This is how fast a SKU depletes at James
 * Martin's warehouse — industry-wide demand across all their retailers, not
 * BVO sales. Deliberate: our own order history is thin, and the intent is to
 * surface what the market buys.
 *
 * WINDOW: all valid days available, capped at 90. Only ~10 days of history
 * exist at the time of writing, so a fixed 30-day window would score most
 * SKUs on partial data without saying so. demand_days records what each
 * score actually covers.
 *
 * EVERY ACTIVE PRODUCT IS WRITTEN, including those with no JMV row — they
 * are reset to 0 rather than left holding a stale score. A product that
 * stops appearing in the feed must fall out of the popularity ordering, not
 * sit at the top forever on a number nobody refreshes.
 */
async function updateDemandScores(conn) {
  // How many valid days we actually have, capped at 90.
  const [[win]] = await conn.query(
    `SELECT COUNT(*) AS valid_days,
            COALESCE(MIN(d), CURDATE()) AS from_date
       FROM (SELECT snapshot_date AS d
               FROM jmv_snapshot_validity
              WHERE is_valid = 1
              ORDER BY snapshot_date DESC
              LIMIT 90) w`
  );
  const days     = win.valid_days || 0;
  const fromDate = win.from_date;

  if (!days) {
    console.warn('[rollup] demand scores skipped — no valid snapshot days');
    return { scored: 0, cleared: 0, days: 0, note: 'no valid snapshot days' };
  }

  /* Score = total observed drawdown over the window, SKU-level.
     No group dedup: this ranks individual products for a product listing,
     and collapsing a family would make every variant rank identically —
     which is precisely what a popularity sort must not do. */
  /* No COLLATE clauses here, deliberately.

     An earlier version of this pinned both sides of the join to
     utf8mb4_unicode_ci to work around:

       Illegal mix of collations (utf8mb4_uca1400_ai_ci,IMPLICIT)
       and (utf8mb4_unicode_ci,IMPLICIT) for operation '='

     That treated the symptom. The cause was that the four jmv_* tables were
     declared `DEFAULT CHARSET=utf8mb4` with NO collation, so the server
     chose its own — uca1400_ai_ci on newer MariaDB — while every other
     table in the schema is utf8mb4_unicode_ci. Pinning it per-query would
     have left the next join between products and a jmv_* table to fail the
     same way, and cost the sku index every time.

     Fixed at the schema instead:
       migrations/2026-09-03_jmv_collation_align.sql

     If this join ever raises a collation error again, the migration has not
     been run on that database. Do not add COLLATE here — fix the table. */
  const [scored] = await conn.query(
    `UPDATE products p
       JOIN (
         SELECT m.sku, SUM(m.demand_min) AS score
           FROM jmv_daily_movement m
          WHERE m.is_valid = 1
            AND m.demand_min > 0
            AND m.movement_date >= ?
          GROUP BY m.sku
       ) s ON s.sku = p.sku
        SET p.demand_score     = s.score,
            p.demand_days      = ?,
            p.demand_scored_at = CURDATE()`,
    [fromDate, days]
  );

  // Anything with no row in the window drops to 0 — never left stale.
  const [cleared] = await conn.query(
    `UPDATE products p
        LEFT JOIN (
          SELECT DISTINCT m.sku
            FROM jmv_daily_movement m
           WHERE m.is_valid = 1
             AND m.demand_min > 0
             AND m.movement_date >= ?
        ) s ON s.sku = p.sku
        SET p.demand_score     = 0,
            p.demand_days      = ?,
            p.demand_scored_at = CURDATE()
      WHERE s.sku IS NULL
        AND (p.demand_score <> 0 OR p.demand_scored_at IS NULL)`,
    [fromDate, days]
  );

  console.log(`[rollup] demand scores: ${scored.affectedRows} scored, ` +
              `${cleared.affectedRows} cleared, window ${days}d from ${fromDate}`);

  return {
    scored:  scored.affectedRows,
    cleared: cleared.affectedRows,
    days,
    fromDate: String(fromDate).slice(0, 10),
  };
}

/**
 * getSnapshotStatus()
 * Returns a summary of what's in the DB — used by the admin dashboard header.
 */
async function getSnapshotStatus() {
  const [rows] = await bvoPool.query(
    `SELECT snapshot_date, row_count, is_valid, notes
     FROM jmv_snapshot_validity
     ORDER BY snapshot_date DESC LIMIT 14`
  );
  return rows;
}

module.exports = { runRollup, getSnapshotStatus, upsertDimensions, updateDemandScores };
