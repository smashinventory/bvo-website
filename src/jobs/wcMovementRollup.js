'use strict';

/**
 * wcMovementRollup.js
 * Reads Water Creation daily inventory snapshots, computes per-SKU deltas and
 * upserts:
 *   wc_snapshots          — raw daily qty + WC's own restock ETA per SKU
 *   wc_snapshot_validity  — row-count sanity gate + which parser read the day
 *   wc_daily_movement     — delta / demand_min / received bounds / restock flag
 *   wc_dimensions         — attribute upsert from the supplier catalogue
 *
 * DELIBERATELY MIRRORS src/jobs/jmvMovementRollup.js. Same structure, same
 * delta semantics, same validity gate, same already-evaluated check. Where
 * this file differs from that one it is because WC's data differs, and each
 * difference is justified in a comment. Do not "improve" one of these two
 * files alone — the point is that they reason alike.
 *
 * THREE HAZARDS (never violate):
 *  1. Option-config coupling → MAX per base_sku, never SUM.
 *     WC's analogue of JMV's shared-component hazard, and bigger: measured at
 *     3.8x–6.0x overstatement on real snapshots. One cabinet is published as
 *     many SKUs, one per mirror/faucet permutation, against one stock pool.
 *     This job writes per-SKU rows (correct — that is what the feed says);
 *     the DEDUPE IS THE REPORTING LAYER'S JOB, on wc_dimensions.base_sku.
 *  2. Restock censoring → delta > 0 hides demand; impute from trailing avg.
 *  3. Feed gaps → 157 of 1,627 adjacent pairs are non-consecutive. span_days
 *     sizes the observation so a multi-day gap is not read as a one-day spike.
 *
 * NO PRICING. The WC reports are units only (Sam, 2026-11-24). There is no
 * price column in the schema and none is read here. This is the structural
 * divergence from the JMV job, and it is deliberate — see migration 030.
 *
 * Env:
 *   WC_SNAPSHOTS_PATH  directory of wc_YYYY-MM-DD.csv files
 *                      (defaults to <project_root>/wc_sync/snapshots/)
 *   WC_CATALOGUE_PATH  supplier catalogue .xlsx for dimensions
 */

const path     = require('path');
const fs       = require('fs');
const zlib     = require('zlib');
const readline = require('readline');
const { bvoPool } = require('../config/database');

const SNAPSHOTS_DIR = process.env.WC_SNAPSHOTS_PATH
  || path.join(__dirname, '../../../wc_sync/snapshots');

const CATALOGUE_PATH = process.env.WC_CATALOGUE_PATH
  || path.join(__dirname, '../../../Water Creation product catalog 2021 NEW collections.xlsx');

/* Row-count validity gate: >10% deviation from trailing 7-day median → INVALID.
   Same threshold as JMV. WC's SKU count drifts slowly (1,834 in 2021 → 1,301
   now), so a genuine catalogue change never trips this; a truncated file does. */
const VALIDITY_THRESHOLD = 0.10;

/* Trailing window for demand imputation on restock days. Same as JMV. */
const TRAILING_DAYS = 14;

/* ─────────────────────────────────────────────────────────────────────
   SNAPSHOT PARSING — TWO SCHEMAS

   The feed changed format exactly once, on 2024-07-09. One clean flip, no
   flapping — verified across all 1,628 files (771 legacy, 857 modern):

     legacy  Original Sku, New Sku, Maximum of Stock, Maximum of Available Date
     modern  SKU, Available Qty, Available Date

   Read column 1 (New Sku) on legacy, NOT column 0. `Original Sku` is WC's
   retired format (VAB030BLGG00); `New Sku` is the same key the modern feed
   uses (AB30BL03GG-000000000). Keying on Original Sku would split every SKU's
   history in half at the flip date.
───────────────────────────────────────────────────────────────────── */

function detectSchema(header) {
  if (header && String(header[0]).trim() === 'SKU') return 'modern';
  if (header && header.length >= 4 && /Original/i.test(String(header[0] || ''))) return 'legacy';
  return null;
}

const SCHEMA_COLS = {
  modern: { sku: 0, qty: 1, eta: 2 },
  legacy: { sku: 1, qty: 2, eta: 3 },   // col 1 = New Sku. See note above.
};

/** Minimal CSV field splitter — handles quoted fields containing commas. */
function splitCsv(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Read one snapshot file → { rows: [{sku, qty, available_date}], schema }
 *
 * MERGED SKU CELLS. Five rows across March 2022 carry two SKUs in one cell,
 * joined by ' : ' —
 *     AB30BL03GG-000000000 : AB30BL03GG-000BX1203
 * Two distinct values, five occurrences, all in 2022. Tiny, but a silent
 * coercion here would mint a garbage SKU that then appears in every report as
 * a real product. Both halves are emitted as separate rows instead.
 */
async function readSnapshotFile(filepath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let schema = null;
    let header = null;
    const isGz   = filepath.endsWith('.gz');
    const stream = fs.createReadStream(filepath);
    const input  = isGz ? stream.pipe(zlib.createGunzip()) : stream;
    const rl = readline.createInterface({ input, crlfDelay: Infinity });

    rl.on('line', line => {
      if (!line.trim()) return;
      const parts = splitCsv(line);
      if (!header) {
        header = parts;
        schema = detectSchema(parts);
        return;
      }
      if (!schema) return;
      const c = SCHEMA_COLS[schema];
      if (parts.length <= c.qty) return;

      const raw = String(parts[c.sku] || '').trim().toUpperCase();
      if (!raw || raw === 'SKU') return;

      const qtyRaw = String(parts[c.qty] || '').replace(/[, ]/g, '');
      const qty    = parseInt(parseFloat(qtyRaw), 10);
      const eta    = String(parts[c.eta] ?? '').trim() || null;

      for (const sku of (raw.includes(':') ? raw.split(':').map(s => s.trim()) : [raw])) {
        if (!sku) continue;
        rows.push({ sku, qty: Number.isFinite(qty) ? qty : 0, available_date: eta });
      }
    });
    rl.on('close', () => {
      /* DEDUPE WITHIN THE SNAPSHOT.
         Splitting a merged ' : ' cell can re-emit a SKU that also has its own
         standalone row — on 2022-03-10, AB30BL03GG-000000000 appears twice.
         The DB would absorb it (same primary key, same value), but rowCount
         feeds the validity gate, and a gate fed an inflated count is a gate
         that drifts. Dedupe here so the count is the truth.

         A repeated SKU with a DIFFERENT qty is a different thing entirely —
         the feed contradicting itself — so that is surfaced, not smoothed. */
      const byKey = new Map();
      const conflicts = [];
      for (const r of rows) {
        const prev = byKey.get(r.sku);
        if (!prev) { byKey.set(r.sku, r); continue; }
        if (prev.qty !== r.qty) conflicts.push(`${r.sku}: ${prev.qty} vs ${r.qty}`);
      }
      resolve({ rows: [...byKey.values()], schema, duplicates: rows.length - byKey.size, conflicts });
    });
    rl.on('error', reject);
    stream.on('error', reject);
  });
}

/** Parse wc_YYYY-MM-DD.csv[.gz] → date string or null */
function parseDateFromFilename(filename) {
  const m = filename.match(/^wc_(\d{4}-\d{2}-\d{2})\.csv(?:\.gz)?$/);
  return m ? m[1] : null;
}

/**
 * Where the snapshots actually are.
 *
 * SNAPSHOTS_DIR is the configured location, but unzipping an archive through
 * a web file manager routinely drops everything into a wrapper folder named
 * after the zip — so the files land in snapshots/wc_snapshots_flat/ rather
 * than snapshots/. That happened on the first real load (2026-11-25).
 *
 * Rather than make someone move 1,628 files by hand, look one level down when
 * the configured directory has no snapshots of its own. One level only, and
 * only as a fallback: if the top level has files, that always wins, so this
 * can never quietly prefer a stale copy over the real one.
 *
 * Resolved once per process and cached — this runs inside a 1,628-iteration
 * loop and must not stat the tree every time.
 */
let _resolvedDir = null;
function resolveSnapshotsDir() {
  if (_resolvedDir !== null) return _resolvedDir;
  if (!fs.existsSync(SNAPSHOTS_DIR)) { _resolvedDir = SNAPSHOTS_DIR; return _resolvedDir; }

  const hasSnapshots = (dir) => {
    try { return fs.readdirSync(dir).some(f => parseDateFromFilename(f)); }
    catch { return false; }
  };

  if (hasSnapshots(SNAPSHOTS_DIR)) { _resolvedDir = SNAPSHOTS_DIR; return _resolvedDir; }

  for (const entry of fs.readdirSync(SNAPSHOTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sub = path.join(SNAPSHOTS_DIR, entry.name);
    if (hasSnapshots(sub)) {
      console.log(`[wc-rollup] snapshots found one level down, in "${entry.name}/" — using that`);
      _resolvedDir = sub;
      return _resolvedDir;
    }
  }
  _resolvedDir = SNAPSHOTS_DIR;   // nothing found; let the caller report empty
  return _resolvedDir;
}

/** Locate a snapshot file for a date, plain or gzipped. */
function findSnapshotFile(dateStr) {
  const dir = resolveSnapshotsDir();
  const candidates = [
    path.join(dir, `wc_${dateStr}.csv.gz`),
    path.join(dir, `wc_${dateStr}.csv`),
  ];
  return candidates.find(f => fs.existsSync(f)) || null;
}

/* ─────────────────────────────────────────────────────────────────────
   SKU DECODE — the suffix is a bill of materials

       PY30CW03GG-000000000
       └─ base ──┘└ suffix ┘    suffix = [mirror:3][faucet:6]

   base_sku is the dedupe key (hazard 1). '000'/'000000' mean "not included".
───────────────────────────────────────────────────────────────────── */

function parseSku(sku) {
  const raw  = String(sku || '').trim().toUpperCase();
  if (!raw) return null;
  const dash = raw.indexOf('-');
  if (dash < 0) return { sku: raw, base: raw, mirror: '', faucet: '' };
  const base   = raw.slice(0, dash);
  const suffix = raw.slice(dash + 1);
  if (suffix.length === 9) {
    return { sku: raw, base, mirror: suffix.slice(0, 3), faucet: suffix.slice(3) };
  }
  /* Non-standard suffix length — keep the base (which is what rollups group
     on) and leave the option codes blank rather than slicing nonsense out of
     a string whose shape we have not verified. */
  return { sku: raw, base, mirror: '', faucet: '' };
}

const hasOption = code => !!code && !/^0+$/.test(code);

/* ─────────────────────────────────────────────────────────────────────
   PRODUCT FAMILY

   The feed is not all bathroom vanities. Classified from SKU shape and
   verified against catalogue product names across the whole archive:

     vanity        AB30CW03RS-000TL1203   "Chestnut 24" Single Bathroom Vanity"
     faucet        F1-0003-01-AL          "Vintage Classic Basin Cocks Lavatory Faucets"
     kitchen_sink  CF511-AS-3022A         "30x22 Zero Radius Single Bowl Stainless Steel"
                   SS-AD-3322B-16          (same product, later SKU scheme)
     washstand     EB30A-0100             "Embassy 30 Inch Wide Single Wash Stand"
     accessory     BA-0006-02             robe hooks, bath caddies, P-trap kits
     cabinet       MADISON-LC-E           "Madison Collection Linen Cabinet"
                   MADISON-TT-E           "Madison Collection Wall Cabinet"
     mirror        EMPIRE-M-1824-01       "Metal Rectangular Mirror 18" X 24""

   ORDER MATTERS. The vanity pattern is the loosest, so it is tested LAST
   among the specific shapes — otherwise a kitchen sink SKU like
   SS-AD-3322B-16 could be swallowed by a broad rule. The kitchen_sink and
   mirror rules in particular must precede anything general.

   An unrecognised shape returns null rather than a guess. A NULL is how a
   new WC product line announces itself; silently filing it under "vanity"
   would quietly corrupt the one number this dashboard exists to report.
───────────────────────────────────────────────────────────────────── */
const FAMILY_RULES = [
  /* Kitchen sinks. THREE SKU schemes across the years — CF511-, SS-, SSS- —
     and the middle segment is 1 or 2 letters (AD/AS/TD = apron styles,
     U = undermount). Tuning these on a single snapshot missed 121 SKUs;
     they were only found by classifying the whole archive at once. */
  ['kitchen_sink', /^(CF\d+|SS[A-Z]*)-[A-Z]{1,2}-\d{4}[A-Z]?(-\d+)?$/],
  // Mirrors: a -M- segment between name and dimensions.
  ['mirror',       /^[A-Z]+-M-\d{4}/],
  // Linen cabinets (LC) and wall cabinets (TT).
  ['cabinet',      /-(LC|TT)-/],
  /* Faucets. The trailing finish code is optional: F5-0011-01 has none.
     NOTE the family mixes rooms — F1 is "Basin Cocks Lavatory Faucets"
     (bathroom) while F5 is "Pull-Out Kitchen Faucet". Not split further
     because the vanity scope excludes both; split it if faucets ever
     become a reporting target in their own right. */
  ['faucet',       /^F\d-\d{4}-\d{2}(-[A-Z]{2})?$/],
  // Wash stands: EB30A-0100
  ['washstand',    /^[A-Z]{2}\d{2}[A-Z]-\d{4}$/],
  // Bath accessories: BA-/BC-/PS- nnnn-nn
  ['accessory',    /^[A-Z]{2}-\d{4}-\d{2}$/],
  /* Furniture. Exactly one SKU ever: CTAB2727BLGG, "Aberdeen Collection
     27 Inch By 27 Inch Blue Limestone Top Coffee Table". Given its own
     family rather than left unclassified, so the unclassified count stays
     a genuine alarm rather than a known-noise number people learn to ignore. */
  ['furniture',    /^CT[A-Z]{2}\d{4}[A-Z]+$/],
  /* Vanity combos: <base>-<9-char option suffix>. The loosest rule, so it is
     tested LAST — every more specific shape gets first refusal. */
  ['vanity',       /^[A-Z0-9]+-[A-Z0-9]{9}$/],
];

function classifyFamily(sku) {
  const s = String(sku || '').trim().toUpperCase();
  if (!s) return null;
  for (const [family, rx] of FAMILY_RULES) if (rx.test(s)) return family;
  return null;   // unclassified — surfaced, never guessed
}

/* ─────────────────────────────────────────────────────────────────────
   DB HELPERS — same shape as the JMV job
───────────────────────────────────────────────────────────────────── */

async function getTrailingMedian(conn) {
  const [rows] = await conn.query(
    `SELECT row_count FROM wc_snapshot_validity
     WHERE is_valid = 1 ORDER BY snapshot_date DESC LIMIT 7`
  );
  if (!rows.length) return null;
  const counts = rows.map(r => r.row_count).sort((a, b) => a - b);
  return counts[Math.floor(counts.length / 2)];
}

async function getTrailingAvg(conn, sku, dateStr) {
  const [rows] = await conn.query(
    `SELECT AVG(demand_min) AS avg_d
       FROM wc_daily_movement
      WHERE sku = ? AND is_valid = 1 AND demand_min > 0
        AND movement_date <  ?
        AND movement_date >= DATE_SUB(?, INTERVAL ? DAY)`,
    [sku, dateStr, dateStr, TRAILING_DAYS]
  );
  return rows[0]?.avg_d || null;
}

/* ─────────────────────────────────────────────────────────────────────
   CORE ROLLUP
───────────────────────────────────────────────────────────────────── */

/**
 * processSnapshot(dateStr, conn)
 * Returns { date, inserted, restocks, skipped, isValid, notes }
 */
async function processSnapshot(dateStr, conn) {
  const file = findSnapshotFile(dateStr);
  if (!file) throw new Error(`No snapshot found for ${dateStr}`);

  const { rows, schema, duplicates, conflicts } = await readSnapshotFile(file);
  const rowCount = rows.length;

  /* A contradicting duplicate is a feed defect, not a parsing quirk. Record it
     on the validity row so it is visible in the snapshot history rather than
     discovered months later as an unexplained wobble in a chart. */
  const dupNote = conflicts && conflicts.length
    ? `Conflicting duplicate SKU(s): ${conflicts.slice(0, 5).join('; ')}` +
      (conflicts.length > 5 ? ` (+${conflicts.length - 5} more)` : '')
    : null;
  if (dupNote) console.warn(`[wc-rollup] ${dateStr}: ${dupNote}`);

  if (!schema) {
    await conn.query(
      `INSERT INTO wc_snapshot_validity (snapshot_date, row_count, is_valid, schema_variant, notes)
       VALUES (?,?,0,NULL,?)
       ON DUPLICATE KEY UPDATE row_count=VALUES(row_count), is_valid=VALUES(is_valid),
                               schema_variant=VALUES(schema_variant), notes=VALUES(notes)`,
      [dateStr, rowCount, 'Unrecognised header — neither legacy nor modern schema']
    );
    return { date: dateStr, inserted: 0, restocks: 0, skipped: rowCount,
             isValid: false, notes: 'Unrecognised header' };
  }

  // Validity gate
  const median = await getTrailingMedian(conn);
  let isValid = 1;
  let notes   = null;
  if (median !== null) {
    const deviation = Math.abs(rowCount - median) / median;
    if (deviation > VALIDITY_THRESHOLD) {
      isValid = 0;
      notes = `Row count ${rowCount} deviates ${(deviation*100).toFixed(1)}% from median ${median} — marked INVALID`;
    }
  }

  const validityNote = [notes, dupNote].filter(Boolean).join(' | ') || null;
  await conn.query(
    `INSERT INTO wc_snapshot_validity (snapshot_date, row_count, is_valid, schema_variant, notes)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE row_count=VALUES(row_count), is_valid=VALUES(is_valid),
                             schema_variant=VALUES(schema_variant), notes=VALUES(notes)`,
    [dateStr, rowCount, isValid, schema, validityNote]
  );

  // Upsert raw snapshot
  if (rows.length) {
    const vals = rows.map(r => [dateStr, r.sku, r.qty, r.available_date]);
    // Chunked: 1,300–1,800 rows/day is fine in one statement, but a future
    // catalogue expansion should not start failing on max_allowed_packet.
    for (let i = 0; i < vals.length; i += 1000) {
      await conn.query(
        `INSERT INTO wc_snapshots (snapshot_date, sku, qty, available_date) VALUES ?
         ON DUPLICATE KEY UPDATE qty=VALUES(qty), available_date=VALUES(available_date)`,
        [vals.slice(i, i + 1000)]
      );
    }
  }

  if (!isValid) {
    return { date: dateStr, inserted: 0, restocks: 0, skipped: rowCount, isValid: false, notes };
  }

  // Previous VALID snapshot, read back out of the DB (same as JMV)
  const [prevRows] = await conn.query(
    `SELECT sku, qty FROM wc_snapshots
      WHERE snapshot_date = (
        SELECT MAX(snapshot_date) FROM wc_snapshots
         WHERE snapshot_date < ? AND snapshot_date IN (
           SELECT snapshot_date FROM wc_snapshot_validity WHERE is_valid = 1
         )
      )`,
    [dateStr]
  );

  if (!prevRows.length) {
    return { date: dateStr, inserted: rowCount, restocks: 0, skipped: 0,
             isValid: true, notes: 'First snapshot — no delta computed' };
  }

  const prevMap = new Map(prevRows.map(r => [r.sku, r.qty]));

  /* ── NO OBSERVATION vs ZERO DEMAND ───────────────────────────────────
     Straight from the JMV job, because WC has the same failure mode: a feed
     that republishes unchanged. Writing delta = 0 for every SKU asserts "we
     looked and the whole warehouse moved nothing", which is a false zero a
     chart will draw as real. We did not look — WC had not republished.

     If not one SKU differs, no movement rows are written and any previously
     written for this date are purged, so a re-run repairs history rather than
     leaving the false zeros in place. The next date that DOES differ needs no
     special handling: its delta is already measured against the last changed
     state, so the value is right — span_days supplies how many days it covers. */
  let changed = false;
  for (const row of rows) {
    const qtyPrev = prevMap.has(row.sku) ? prevMap.get(row.sku) : row.qty;
    if (row.qty !== qtyPrev) { changed = true; break; }
  }

  if (!changed) {
    const [purged] = await conn.query(
      `DELETE FROM wc_daily_movement WHERE movement_date = ?`, [dateStr]
    );
    await conn.query(
      `UPDATE wc_snapshot_validity SET notes = ? WHERE snapshot_date = ?`,
      ['Feed unchanged — no observation, no movement recorded', dateStr]
    );
    console.log(`[wc-rollup] ${dateStr}: feed unchanged — no observation` +
      (purged.affectedRows ? `, purged ${purged.affectedRows} false zero rows` : ''));
    return { date: dateStr, inserted: 0, restocks: 0, skipped: rowCount,
             isValid: true, noObservation: true,
             notes: 'Feed unchanged — no observation (chart will gap, not show zero)' };
  }

  /* How many calendar days this observation covers. WC has 157 gapped pairs
     out of 1,627 — about 10% — so this is load-bearing here, not an edge case. */
  const [spanRow] = await conn.query(
    `SELECT GREATEST(1, DATEDIFF(?, COALESCE(
              (SELECT MAX(movement_date) FROM wc_daily_movement WHERE movement_date < ?),
              DATE_SUB(?, INTERVAL 1 DAY)
            ))) AS span`,
    [dateStr, dateStr, dateStr]
  );
  const spanDays = Math.min(255, Number(spanRow[0]?.span || 1));
  if (spanDays > 1) {
    console.log(`[wc-rollup] ${dateStr}: observation covers ${spanDays} days ` +
                `(no snapshot on the preceding ${spanDays - 1})`);
  }

  // Deltas + restock detection — identical semantics to the JMV job
  let inserted = 0, restocks = 0;
  const movementRows = [];

  for (const row of rows) {
    const qtyEnd  = row.qty;
    const qtyPrev = prevMap.has(row.sku) ? prevMap.get(row.sku) : qtyEnd;
    const delta   = qtyEnd - qtyPrev;

    let demandMin = 0, receivedMin = 0, receivedMax = 0;
    let isRestock = 0, isEstimated = 0;

    if (delta < 0) {
      demandMin = -delta;                 // observed drawdown — NOT "units sold"
    } else if (delta > 0) {
      isRestock   = 1;
      receivedMin = delta;
      receivedMax = delta + qtyPrev;
      isEstimated = 1;                    // demand_est back-filled below
      restocks++;
    }

    movementRows.push([
      dateStr, row.sku, qtyEnd, delta,
      demandMin, receivedMin, receivedMax,
      null /* demand_est */, isRestock, isEstimated, 1 /* is_valid */, spanDays,
    ]);
    inserted++;
  }

  for (let i = 0; i < movementRows.length; i += 1000) {
    await conn.query(
      `INSERT INTO wc_daily_movement
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
      [movementRows.slice(i, i + 1000)]
    );
  }

  /* Back-fill demand_est on restock rows. Bounded by the trailing window and
     done after the batch insert, so the common case (no restocks) costs
     nothing. getTrailingAvg is scoped to dates BEFORE this one, so a re-run
     cannot feed a row's own value back into its own estimate. */
  if (restocks > 0) {
    const restockSkus = movementRows.filter(r => r[8] === 1).map(r => r[1]);
    for (const sku of restockSkus) {
      const avg = await getTrailingAvg(conn, sku, dateStr);
      if (avg !== null) {
        await conn.query(
          `UPDATE wc_daily_movement SET demand_est = ? WHERE movement_date = ? AND sku = ?`,
          [Math.round(avg * 10) / 10, dateStr, sku]
        );
      }
    }
  }

  return { date: dateStr, inserted, restocks, skipped: 0, isValid: true, notes };
}

/* ─────────────────────────────────────────────────────────────────────
   DIMENSION UPSERT

   ⚠️ COVERAGE IS PARTIAL AND THAT IS THE KNOWN STATE.
   The 2021 supplier catalogue carries 145 attribute columns but only 284 rows
   with a Supplier SKU — 64 distinct base SKUs across 13 collections, against
   765 base SKUs in the feed. ~79% of current feed SKUs get a row here; only
   ~22% get cabinet_color / top_material / top_finish.

   Sam declined to source a newer catalogue (2026-11-24). So the reporting
   layer MUST show the undescribed count next to any card that cuts by those
   attributes. Never let a card look complete while covering a fifth of the
   catalogue.

   Colours are stored VERBATIM as WC names them (Sam, 2026-11-24) — no colour
   family mapping, no normalisation.

   Every SKU in the feed gets a row even with no attributes at all, because
   base_sku is needed for the dedupe and that is derivable from the SKU alone.
───────────────────────────────────────────────────────────────────── */

async function upsertDimensions(conn, { skus = null } = {}) {
  let catalogue = new Map();
  let source = 'none';

  if (fs.existsSync(CATALOGUE_PATH)) {
    const XLSX = require('xlsx');
    const wb   = XLSX.readFile(CATALOGUE_PATH, { dense: false });
    const name = wb.SheetNames.find(n => /product data/i.test(n));
    if (name) {
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[name],
        { header: 1, defval: '', blankrows: false });
      /* HEADER IS ON ROW 2, not row 1. Row 1 holds merged group labels
         ("Included parts", "Pricing"). Reading row 1 as the header yields a
         sheet of blanks and no error. */
      const hdr = (grid[1] || []).map(v => String(v || '').trim());
      if (/supplier sku/i.test(hdr[0] || '')) {
        const C = { collection:6, name:11, width:41, top_material:53, top_finish:56,
                    cabinet_color:66, cabinet_finish:67, sinks:71, mounting:104, ada:30 };
        for (let r = 2; r < grid.length; r++) {
          const row = grid[r];
          const p = parseSku(row[0]);
          if (!p) continue;
          const nm = String(row[C.name] || '').trim();
          let size = parseFloat(String(row[C.width] || '').replace(/[^0-9.]/g, ''));
          if (!(size > 0 && size < 200)) {
            const m = nm.match(/(\d{2,3})\s*(?:in\b|inch|")/i);
            size = m ? parseInt(m[1], 10) : null;
          }
          catalogue.set(p.sku, {
            collection:     String(row[C.collection] || '').trim() || null,
            product_name:   nm || null,
            size_nominal:   size || null,
            cabinet_color:  String(row[C.cabinet_color]  || '').trim() || null,
            cabinet_finish: String(row[C.cabinet_finish] || '').trim() || null,
            top_material:   String(row[C.top_material]   || '').trim() || null,
            top_finish:     String(row[C.top_finish]     || '').trim() || null,
            sinks:          parseInt(String(row[C.sinks] || '').replace(/[^0-9]/g,''), 10) || null,
            mounting:       String(row[C.mounting] || '').trim() || null,
            ada:            /^y/i.test(String(row[C.ada] || '')) ? 1 : 0,
            attr_source:    '2021',
          });
        }
        source = path.basename(CATALOGUE_PATH);
      }
    }
  }

  // Which SKUs need a row? Everything the feed has ever carried.
  let targets = skus;
  if (!targets) {
    const [r] = await conn.query(`SELECT DISTINCT sku FROM wc_snapshots`);
    targets = r.map(x => x.sku);
  }

  const today = new Date().toISOString().slice(0, 10);
  let upserted = 0, described = 0;
  const families = {};

  for (const sku of targets) {
    const p = parseSku(sku);
    if (!p) continue;
    const a = catalogue.get(p.sku) || {};
    if (a.attr_source) described++;
    const famKey = classifyFamily(p.sku) || 'unclassified';
    families[famKey] = (families[famKey] || 0) + 1;

    await conn.query(
      `INSERT INTO wc_dimensions
         (sku, base_sku, product_family, mirror_code, faucet_code, has_mirror, has_faucet,
          collection, product_name, size_nominal, cabinet_color, cabinet_finish,
          top_material, top_finish, sinks, mounting, ada, attr_source, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         base_sku=VALUES(base_sku), product_family=VALUES(product_family),
         mirror_code=VALUES(mirror_code),
         faucet_code=VALUES(faucet_code), has_mirror=VALUES(has_mirror),
         has_faucet=VALUES(has_faucet),
         /* Never overwrite a described row with a blank one. A re-run without
            the catalogue present must not wipe the attributes it loaded last
            time — COALESCE keeps the richer value. */
         collection=COALESCE(VALUES(collection), collection),
         product_name=COALESCE(VALUES(product_name), product_name),
         size_nominal=COALESCE(VALUES(size_nominal), size_nominal),
         cabinet_color=COALESCE(VALUES(cabinet_color), cabinet_color),
         cabinet_finish=COALESCE(VALUES(cabinet_finish), cabinet_finish),
         top_material=COALESCE(VALUES(top_material), top_material),
         top_finish=COALESCE(VALUES(top_finish), top_finish),
         sinks=COALESCE(VALUES(sinks), sinks),
         mounting=COALESCE(VALUES(mounting), mounting),
         ada=VALUES(ada),
         attr_source=COALESCE(VALUES(attr_source), attr_source),
         updated_at=VALUES(updated_at)`,
      [
        p.sku, p.base, classifyFamily(p.sku), p.mirror || null, p.faucet || null,
        hasOption(p.mirror) ? 1 : 0, hasOption(p.faucet) ? 1 : 0,
        a.collection ?? null, a.product_name ?? null, a.size_nominal ?? null,
        a.cabinet_color ?? null, a.cabinet_finish ?? null,
        a.top_material ?? null, a.top_finish ?? null,
        a.sinks ?? null, a.mounting ?? null, a.ada ?? 0,
        a.attr_source ?? null, today,
      ]
    );
    upserted++;
  }

  /* An unclassified SKU is a FINDING, not noise: it is how a new WC product
     line announces itself. Known benign case as of 2026-11-25 is exactly one
     — SEQUOIA-30MW, which appeared in 2 of 1,628 snapshots, always at qty 0
     with an expired ETA, is in no catalogue and never moved a unit. Anything
     beyond that deserves a look before the next report is trusted. */
  if (families.unclassified) {
    console.warn(`[wc-rollup] ${families.unclassified} SKU(s) could not be ` +
                 `classified into a product family — check for a new WC line`);
  }

  return {
    upserted,
    described,
    undescribed: upserted - described,
    families,
    source,
    notes: `${described}/${upserted} SKUs carry catalogue attributes ` +
           `(${(100*described/Math.max(upserted,1)).toFixed(1)}%) — the rest are ` +
           `SKU-derived only and MUST be surfaced as undescribed in the UI. ` +
           `Families: ${Object.entries(families).map(([k,v])=>`${k}=${v}`).join(', ')}`,
  };
}

/* ─────────────────────────────────────────────────────────────────────
   PUBLIC API
───────────────────────────────────────────────────────────────────── */

/**
 * runRollup({ dates, includeDimensions })
 * Defaults to every unevaluated date found in SNAPSHOTS_DIR.
 */
async function runRollup({ dates = null, includeDimensions = false } = {}) {
  const conn = await bvoPool.getConnection();
  const results = [];

  try {
    let targetDates = dates;
    if (!targetDates) {
      const dir = resolveSnapshotsDir();
      const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
      const allDates = files.map(parseDateFromFilename).filter(Boolean).sort();

      /* WHICH DATES ARE DONE? Read wc_snapshot_validity, NOT wc_daily_movement.
         Two outcomes deliberately write no movement rows — "feed unchanged"
         and "invalid row count" — and both write a validity row instead. The
         JMV job originally checked movement only, so those dates were re-parsed
         on every single run, for ever. With 1,628 files that is not a slow
         leak, it is a job that never finishes.

         TO FORCE A RE-READ: runRollup({ dates: ['2026-11-23'] }) — the
         explicit-dates path skips this filter entirely. */
      const [processed] = await conn.query(
        `SELECT DATE_FORMAT(snapshot_date,'%Y-%m-%d') AS d FROM wc_snapshot_validity`
      );
      const done = new Set(processed.map(r => r.d));
      targetDates = allDates.filter(d => !done.has(d));
      console.log(`[wc-rollup] ${allDates.length} snapshot(s) on disk, ` +
                  `${allDates.length - targetDates.length} already evaluated, ` +
                  `${targetDates.length} to process`);
    }

    for (const date of targetDates) {
      try {
        results.push(await processSnapshot(date, conn));
      } catch (err) {
        results.push({ date, error: err.message });
      }
    }

    if (includeDimensions) {
      try {
        const dim = await upsertDimensions(conn);
        results.push({ type: 'dimensions', ...dim });
      } catch (dimErr) {
        /* Isolated, exactly as the JMV demand-score step is. Dimensions are an
           enhancement layered on top of the rollup; ingestion and deltas are
           the thing that must not fail. A bad catalogue file must not take
           down a run that has already committed its snapshots. */
        console.error('[wc-rollup] dimensions FAILED:', dimErr.message);
        results.push({ type: 'dimensions', error: dimErr.message });
      }
    }

    return results;
  } finally {
    conn.release();
  }
}

/**
 * describeSnapshotsDir()
 * What the job can actually SEE on disk, reported back to the UI.
 *
 * WHY THIS EXISTS. The first live run reported "0 processed, backlog clear"
 * with 1,628 files sitting in the folder, and from outside the process there
 * was no way to tell whether the path was wrong, the directory unreadable, or
 * the filenames unmatched — the three have identical symptoms and the guess
 * costs a deploy each time. This returns the resolved path and a sample of
 * what is in it, so the answer is on screen instead of inferred.
 *
 * Cheap, read-only, and safe to call on every rollup.
 */
function describeSnapshotsDir() {
  const out = {
    configured: process.env.WC_SNAPSHOTS_PATH || null,
    defaultPath: path.join(__dirname, '../../../wc_sync/snapshots'),
    dirname: __dirname,
    cwd: process.cwd(),
    resolved: null,
    exists: false,
    entryCount: 0,
    matchedSnapshots: 0,
    sample: [],
    error: null,
  };
  try {
    out.resolved = resolveSnapshotsDir();
    out.exists = fs.existsSync(out.resolved);
    if (out.exists) {
      const entries = fs.readdirSync(out.resolved);
      out.entryCount = entries.length;
      out.matchedSnapshots = entries.filter(f => parseDateFromFilename(f)).length;
      out.sample = entries.slice(0, 5);
    }
  } catch (err) {
    out.error = err.message;
  }
  return out;
}

/** Status for the admin header: coverage, last snapshot, validity counts. */
async function getSnapshotStatus() {
  const [rows] = await bvoPool.query(
    `SELECT COUNT(*)                                   AS days,
            SUM(is_valid)                              AS valid_days,
            DATE_FORMAT(MIN(snapshot_date),'%Y-%m-%d') AS first_date,
            DATE_FORMAT(MAX(snapshot_date),'%Y-%m-%d') AS last_date
       FROM wc_snapshot_validity`
  );
  return rows[0] || { days: 0, valid_days: 0, first_date: null, last_date: null };
}

module.exports = {
  runRollup,
  processSnapshot,
  upsertDimensions,
  getSnapshotStatus,
  describeSnapshotsDir,
  // exported for the gates
  parseSku,
  classifyFamily,
  detectSchema,
  readSnapshotFile,
  findSnapshotFile,
  resolveSnapshotsDir,
  parseDateFromFilename,
  SCHEMA_COLS,
  /* Test seam. resolveSnapshotsDir() caches, because it runs inside a
     1,628-iteration loop and must not stat the tree each time. A gate that
     exercises several directory layouts in one process needs to clear it. */
  _resetResolvedDir: () => { _resolvedDir = null; },
};
