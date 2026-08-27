'use strict';

/**
 * jmvReportsController.js
 * JMV Demand Intelligence — admin reporting layer over nightly snapshot data.
 *
 * ALL aggregations follow the three-hazard rules:
 *  1. Group deduplication: MAX demand_min per group_number per day, never SUM
 *  2. Metric label: "observed drawdown (minimum demand)" — NEVER "units sold"
 *  3. Feed-gap exclusion: is_valid = 1 only
 *
 * Source note required on every chart/table:
 *   "Depletion from James Martin warehouse — industry-wide demand, not RFL sales."
 *
 * Admin routes (all GET unless noted):
 *   GET  /admin/marketing/jmv               — main dashboard
 *   POST /admin/marketing/jmv/run-rollup    — trigger movement rollup job
 *   GET  /admin/marketing/jmv/stockout      — drill-down: stockout risk
 *   GET  /admin/marketing/jmv/new-arrivals  — drill-down: new arrivals
 */

const { bvoPool }    = require('../config/database');
const { runRollup, getSnapshotStatus } = require('../jobs/jmvMovementRollup');

const LAYOUT = { layout: 'layouts/admin' };
const SYNC_TYPES = ['Vanity', 'Cabinet', 'Top'];
const SYNC_TYPES_SQL = SYNC_TYPES.map(() => '?').join(',');

function safeQuery(sql, params = []) {
  return bvoPool.query(sql, params).then(([rows]) => rows).catch(() => []);
}
function safeQueryOne(sql, params = []) {
  return bvoPool.query(sql, params).then(([rows]) => rows[0] || null).catch(() => null);
}

/** Build the deduped-by-group inner query fragment */
const DEDUPED_INNER = (whereExtra = '') => `
  SELECT m.movement_date, d.group_number, d.collection,
         d.base_finish, d.size_nominal, d.theme, d.vanity_type,
         d.hardware, d.top_finish, d.freepower, d.sinks, d.released,
         MAX(m.demand_min) AS grp_max
  FROM jmv_daily_movement m
  JOIN jmv_dimensions d ON d.sku = m.sku
  WHERE m.is_valid = 1
    AND m.demand_min > 0
    AND d.product_type IN (${SYNC_TYPES_SQL})
    ${whereExtra}
  GROUP BY m.movement_date, d.group_number, d.collection,
           d.base_finish, d.size_nominal, d.theme, d.vanity_type,
           d.hardware, d.top_finish, d.freepower, d.sinks, d.released
`;

/* ─────────────────────────────────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────────────────────────────────── */

async function dashboard(req, res) {
  try {
    const days   = parseInt(req.query.days  || '30', 10);
    const ptype  = req.query.type  || 'sync';   // 'sync' | 'all'
    const scope  = ptype === 'all' ? [] : SYNC_TYPES;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    // ── Snapshot status ──────────────────────────────────────────────
    const snapshotStatus = await getSnapshotStatus();
    const latestDate = snapshotStatus[0]?.snapshot_date || null;
    const totalDays  = snapshotStatus.filter(r => r.is_valid).length;

    // ── Dimension table check ────────────────────────────────────────
    const dimCount = await safeQueryOne(`SELECT COUNT(*) AS cnt FROM jmv_dimensions`);
    const hasDims  = (dimCount?.cnt || 0) > 0;

    // ── Alert strip ─────────────────────────────────────────────────
    // Stockout (qty = 0, sync scope, latest snapshot)
    const stockoutCount = await safeQueryOne(
      `SELECT COUNT(*) AS cnt
       FROM jmv_snapshots s
       JOIN jmv_dimensions d USING (sku)
       WHERE s.snapshot_date = ? AND s.qty = 0
         AND d.product_type IN (${SYNC_TYPES_SQL})`,
      [latestDate, ...SYNC_TYPES]
    );

    // Low stock (qty 1–3, sync scope, latest snapshot)
    const lowStockCount = await safeQueryOne(
      `SELECT COUNT(*) AS cnt
       FROM jmv_snapshots s
       JOIN jmv_dimensions d USING (sku)
       WHERE s.snapshot_date = ? AND s.qty BETWEEN 1 AND 3
         AND d.product_type IN (${SYNC_TYPES_SQL})`,
      [latestDate, ...SYNC_TYPES]
    );

    // New arrivals: SKUs in latest snapshot not in earliest
    const earliestDate = await safeQueryOne(
      `SELECT MIN(snapshot_date) AS d FROM jmv_snapshot_validity WHERE is_valid = 1`
    );
    const newArrivalsCount = await safeQueryOne(
      `SELECT COUNT(*) AS cnt FROM jmv_snapshots s
       WHERE s.snapshot_date = ?
         AND s.sku NOT IN (SELECT sku FROM jmv_snapshots WHERE snapshot_date = ?)`,
      [latestDate, earliestDate?.d || latestDate]
    );

    // Discontinued: in earliest but not latest
    const discontinuedCount = await safeQueryOne(
      `SELECT COUNT(*) AS cnt FROM jmv_snapshots s
       WHERE s.snapshot_date = ?
         AND s.sku NOT IN (SELECT sku FROM jmv_snapshots WHERE snapshot_date = ?)`,
      [earliestDate?.d || latestDate, latestDate]
    );

    // MAP changes since earliest
    const mapChangesCount = await safeQueryOne(
      `SELECT COUNT(DISTINCT a.sku) AS cnt
       FROM jmv_snapshots a
       JOIN jmv_snapshots b ON a.sku = b.sku
       WHERE a.snapshot_date = ?
         AND b.snapshot_date = ?
         AND a.map_price IS NOT NULL
         AND b.map_price IS NOT NULL
         AND a.map_price <> b.map_price`,
      [earliestDate?.d || latestDate, latestDate]
    );

    // ── Top collections (group-deduped) ──────────────────────────────
    const topCollections = hasDims ? await safeQuery(
      `SELECT gd.collection,
              SUM(gd.grp_max) AS total_drawdown,
              COUNT(DISTINCT gd.group_number) AS group_count
       FROM (${DEDUPED_INNER(`AND m.movement_date >= ?`)}) gd
       GROUP BY gd.collection
       ORDER BY total_drawdown DESC LIMIT 15`,
      [...SYNC_TYPES, cutoffStr]
    ) : [];

    // ── Top finishes ──────────────────────────────────────────────────
    const topFinishes = hasDims ? await safeQuery(
      `SELECT gd.base_finish, SUM(gd.grp_max) AS total_drawdown
       FROM (${DEDUPED_INNER(`AND m.movement_date >= ?`)}) gd
       WHERE gd.base_finish IS NOT NULL
       GROUP BY gd.base_finish
       ORDER BY total_drawdown DESC LIMIT 15`,
      [...SYNC_TYPES, cutoffStr]
    ) : [];

    // ── Top sizes ─────────────────────────────────────────────────────
    const topSizes = hasDims ? await safeQuery(
      `SELECT gd.size_nominal AS size, SUM(gd.grp_max) AS total_drawdown
       FROM (${DEDUPED_INNER(`AND m.movement_date >= ?`)}) gd
       WHERE gd.size_nominal IS NOT NULL
       GROUP BY gd.size_nominal
       ORDER BY total_drawdown DESC LIMIT 12`,
      [...SYNC_TYPES, cutoffStr]
    ) : [];

    // ── Top themes ────────────────────────────────────────────────────
    const topThemes = hasDims ? await safeQuery(
      `SELECT gd.theme, SUM(gd.grp_max) AS total_drawdown
       FROM (${DEDUPED_INNER(`AND m.movement_date >= ?`)}) gd
       WHERE gd.theme IS NOT NULL AND gd.theme <> ''
       GROUP BY gd.theme
       ORDER BY total_drawdown DESC LIMIT 10`,
      [...SYNC_TYPES, cutoffStr]
    ) : [];

    // ── Vanity type ───────────────────────────────────────────────────
    const topVanityTypes = hasDims ? await safeQuery(
      `SELECT gd.vanity_type, SUM(gd.grp_max) AS total_drawdown
       FROM (${DEDUPED_INNER(`AND m.movement_date >= ?`)}) gd
       WHERE gd.vanity_type IS NOT NULL AND gd.vanity_type <> ''
       GROUP BY gd.vanity_type
       ORDER BY total_drawdown DESC LIMIT 8`,
      [...SYNC_TYPES, cutoffStr]
    ) : [];

    // ── Price band velocity ───────────────────────────────────────────
    const priceBands = hasDims ? await safeQuery(
      `SELECT
         CASE
           WHEN d.map_price IS NULL     THEN 'Unknown'
           WHEN d.map_price < 2000      THEN 'Under $2K'
           WHEN d.map_price < 3000      THEN '$2K–$3K'
           WHEN d.map_price < 4000      THEN '$3K–$4K'
           WHEN d.map_price < 5000      THEN '$4K–$5K'
           WHEN d.map_price < 7000      THEN '$5K–$7K'
           ELSE '$7K+'
         END AS price_band,
         SUM(gd.grp_max) AS total_drawdown
       FROM (${DEDUPED_INNER(`AND m.movement_date >= ?`)}) gd
       JOIN jmv_dimensions d ON d.group_number = gd.group_number
         AND d.sku = (SELECT sku FROM jmv_dimensions WHERE group_number = gd.group_number LIMIT 1)
       GROUP BY price_band
       ORDER BY total_drawdown DESC`,
      [...SYNC_TYPES, cutoffStr]
    ) : [];

    // Simpler price band using latest snapshot MAP price
    const priceBandsFallback = hasDims ? await safeQuery(
      `SELECT
         CASE
           WHEN s.map_price IS NULL THEN 'Unknown'
           WHEN s.map_price < 2000  THEN 'Under $2K'
           WHEN s.map_price < 3000  THEN '$2K–$3K'
           WHEN s.map_price < 4000  THEN '$3K–$4K'
           WHEN s.map_price < 5000  THEN '$4K–$5K'
           WHEN s.map_price < 7000  THEN '$5K–$7K'
           ELSE '$7K+'
         END AS price_band,
         SUM(gd.grp_max) AS total_drawdown
       FROM (
         SELECT m.movement_date, d.group_number, MAX(m.demand_min) AS grp_max
         FROM jmv_daily_movement m
         JOIN jmv_dimensions d USING (sku)
         WHERE m.is_valid = 1 AND m.demand_min > 0
           AND d.product_type IN (${SYNC_TYPES_SQL})
           AND m.movement_date >= ?
         GROUP BY m.movement_date, d.group_number
       ) gd
       JOIN jmv_snapshots s ON s.sku IN (
         SELECT sku FROM jmv_dimensions WHERE group_number = gd.group_number LIMIT 1
       ) AND s.snapshot_date = ?
       GROUP BY price_band
       ORDER BY total_drawdown DESC`,
      [...SYNC_TYPES, cutoffStr, latestDate]
    ) : [];

    // ── Size × Finish heatmap (top 10 sizes × top 12 finishes) ───────
    const heatmapRaw = hasDims ? await safeQuery(
      `SELECT gd.size_nominal AS size, gd.base_finish,
              SUM(gd.grp_max) AS drawdown
       FROM (${DEDUPED_INNER(`AND m.movement_date >= ?`)}) gd
       WHERE gd.size_nominal IS NOT NULL AND gd.base_finish IS NOT NULL
       GROUP BY gd.size_nominal, gd.base_finish
       ORDER BY drawdown DESC`,
      [...SYNC_TYPES, cutoffStr]
    ) : [];

    // Pivot heatmap: { finishes[], sizes[], matrix{finish: {size: val}} }
    const topHeatmapFinishes = [...new Set(topFinishes.slice(0,12).map(r => r.base_finish))];
    const topHeatmapSizes    = [...new Set(topSizes.slice(0,10).map(r => r.size))].sort((a,b) => a-b);
    const heatmapMatrix = {};
    topHeatmapFinishes.forEach(f => { heatmapMatrix[f] = {}; topHeatmapSizes.forEach(s => heatmapMatrix[f][s] = 0); });
    heatmapRaw.forEach(r => {
      if (heatmapMatrix[r.base_finish]) heatmapMatrix[r.base_finish][r.size] = r.drawdown;
    });

    // ── Top 50 SKUs (SKU-level, not group-deduped — for browsing) ────
    const top50 = await safeQuery(
      `SELECT m.sku, d.collection, d.base_finish, d.size_nominal, d.product_type,
              d.group_number,
              SUM(m.demand_min)   AS total_drawdown,
              SUM(m.is_restock)   AS restock_events,
              COUNT(m.movement_date) AS days_tracked,
              s.qty AS current_qty,
              s.map_price
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d USING (sku)
       JOIN jmv_snapshots s ON s.sku = m.sku AND s.snapshot_date = ?
       WHERE m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type IN (${SYNC_TYPES_SQL})
         AND m.movement_date >= ?
       GROUP BY m.sku, d.collection, d.base_finish, d.size_nominal,
                d.product_type, d.group_number, s.qty, s.map_price
       ORDER BY total_drawdown DESC LIMIT 50`,
      [latestDate, ...SYNC_TYPES, cutoffStr]
    );

    // ── Top mirrors (full feed scope — "should we add?" view) ────────
    const topMirrors = hasDims ? await safeQuery(
      `SELECT d.collection, SUM(gm.grp_max) AS total_drawdown, COUNT(DISTINCT d.group_number) AS group_count
       FROM (
         SELECT m.movement_date, d.group_number, MAX(m.demand_min) AS grp_max
         FROM jmv_daily_movement m
         JOIN jmv_dimensions d USING (sku)
         WHERE m.is_valid = 1 AND m.demand_min > 0
           AND d.product_type = 'Mirror'
           AND m.movement_date >= ?
         GROUP BY m.movement_date, d.group_number
       ) gm
       JOIN jmv_dimensions d ON d.group_number = gm.group_number
       GROUP BY d.collection
       ORDER BY total_drawdown DESC LIMIT 10`,
      [cutoffStr]
    ) : [];

    // ── FreePower attach ──────────────────────────────────────────────
    const fpAttach = hasDims ? await safeQuery(
      `SELECT
         CASE WHEN gd.freepower IN ('Y','Yes','1','y','yes') THEN 'Yes – FreePower' ELSE 'Standard' END AS fp,
         SUM(gd.grp_max) AS total_drawdown
       FROM (${DEDUPED_INNER(`AND m.movement_date >= ?`)}) gd
       GROUP BY fp`,
      [...SYNC_TYPES, cutoffStr]
    ) : [];

    // ── Restock cadence (top restocked SKUs) ─────────────────────────
    const restockCadence = await safeQuery(
      `SELECT m.sku, d.collection, d.base_finish, d.size_nominal,
              COUNT(*) AS restock_count,
              AVG(m.received_min) AS avg_batch_min,
              AVG(m.received_max) AS avg_batch_max,
              s.qty AS current_qty
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d USING (sku)
       JOIN jmv_snapshots s ON s.sku = m.sku AND s.snapshot_date = ?
       WHERE m.is_restock = 1 AND m.is_valid = 1
         AND d.product_type IN (${SYNC_TYPES_SQL})
         AND m.movement_date >= ?
       GROUP BY m.sku, d.collection, d.base_finish, d.size_nominal, s.qty
       ORDER BY restock_count DESC, avg_batch_min DESC LIMIT 20`,
      [latestDate, ...SYNC_TYPES, cutoffStr]
    );

    // ── Days of cover (sync scope, latest snapshot) ───────────────────
    const daysOfCover = await safeQuery(
      `SELECT s.sku, d.collection, d.base_finish, d.size_nominal, d.product_type,
              s.qty AS current_qty, s.map_price,
              AVG(m.demand_min) AS avg_daily,
              ROUND(s.qty / NULLIF(AVG(m.demand_min), 0), 1) AS days_cover
       FROM jmv_snapshots s
       JOIN jmv_dimensions d USING (sku)
       JOIN jmv_daily_movement m USING (sku)
       WHERE s.snapshot_date = ?
         AND m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type IN (${SYNC_TYPES_SQL})
         AND m.movement_date >= ?
       GROUP BY s.sku, d.collection, d.base_finish, d.size_nominal,
                d.product_type, s.qty, s.map_price
       HAVING days_cover IS NOT NULL
       ORDER BY days_cover ASC LIMIT 30`,
      [latestDate, ...SYNC_TYPES, cutoffStr]
    );

    const viewData = {
      pageTitle: 'JMV Demand Reports',
      // controls
      days, ptype,
      // meta
      snapshotStatus,
      latestDate,
      totalDays,
      hasDims,
      earliestDate: earliestDate?.d,
      // alert strip
      stockoutCount:      stockoutCount?.cnt  || 0,
      lowStockCount:      lowStockCount?.cnt  || 0,
      newArrivalsCount:   newArrivalsCount?.cnt || 0,
      discontinuedCount:  discontinuedCount?.cnt || 0,
      mapChangesCount:    mapChangesCount?.cnt || 0,
      // charts
      topCollections:  JSON.stringify(topCollections),
      topFinishes:     JSON.stringify(topFinishes),
      topSizes:        JSON.stringify(topSizes),
      topThemes:       JSON.stringify(topThemes),
      topVanityTypes:  JSON.stringify(topVanityTypes),
      priceBandsFallback: JSON.stringify(priceBandsFallback.length ? priceBandsFallback : priceBands),
      heatmapFinishes: JSON.stringify(topHeatmapFinishes),
      heatmapSizes:    JSON.stringify(topHeatmapSizes),
      heatmapMatrix:   JSON.stringify(heatmapMatrix),
      topMirrors:      JSON.stringify(topMirrors),
      fpAttach:        JSON.stringify(fpAttach),
      restockCadence,
      daysOfCover,
      top50,
      style: '',
    };

    res.render('pages/admin/marketing/jmv-reports', { ...LAYOUT, ...viewData });
  } catch (err) {
    console.error('[jmvReports] dashboard error:', err);
    res.status(500).render('pages/admin/marketing/jmv-reports', {
      ...LAYOUT,
      pageTitle: 'JMV Demand Reports',
      error: 'Failed to load report data — ' + err.message,
      days: 30, ptype: 'sync', hasDims: false, snapshotStatus: [],
      latestDate: null, totalDays: 0, earliestDate: null,
      stockoutCount: 0, lowStockCount: 0, newArrivalsCount: 0,
      discontinuedCount: 0, mapChangesCount: 0,
      topCollections: '[]', topFinishes: '[]', topSizes: '[]',
      topThemes: '[]', topVanityTypes: '[]', priceBandsFallback: '[]',
      heatmapFinishes: '[]', heatmapSizes: '[]', heatmapMatrix: '{}',
      topMirrors: '[]', fpAttach: '[]', restockCadence: [], daysOfCover: [], top50: [],
      style: '',
    });
  }
}

/* ─────────────────────────────────────────────────────────────────────
   RUN ROLLUP (manual trigger from admin UI)
───────────────────────────────────────────────────────────────────── */

async function triggerRollup(req, res) {
  try {
    const includeDims = req.body.include_dimensions === '1';
    const results = await runRollup({ includeDimensions: includeDims });
    res.json({ ok: true, results });
  } catch (err) {
    console.error('[jmvReports] rollup error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* ─────────────────────────────────────────────────────────────────────
   DRILL-DOWN: STOCKOUT LIST
───────────────────────────────────────────────────────────────────── */

async function stockoutDrilldown(req, res) {
  try {
    const [latestSnap] = await bvoPool.query(
      `SELECT MAX(snapshot_date) AS d FROM jmv_snapshot_validity WHERE is_valid = 1`
    );
    const latestDate = latestSnap[0]?.d || null;

    const rows = await safeQuery(
      `SELECT s.sku, d.collection, d.base_finish, d.size_nominal,
              d.product_type, d.group_number, s.qty, s.map_price, d.vanity_type
       FROM jmv_snapshots s
       JOIN jmv_dimensions d USING (sku)
       WHERE s.snapshot_date = ?
         AND s.qty <= 3
         AND d.product_type IN (${SYNC_TYPES_SQL})
       ORDER BY s.qty ASC, s.map_price DESC`,
      [latestDate, ...SYNC_TYPES]
    );

    res.render('pages/admin/marketing/jmv-stockout', {
      ...LAYOUT,
      pageTitle: 'JMV Stockout Risk',
      latestDate,
      rows,
      style: '',
    });
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   DRILL-DOWN: NEW ARRIVALS
───────────────────────────────────────────────────────────────────── */

async function newArrivalsDrilldown(req, res) {
  try {
    const [snapDates] = await bvoPool.query(
      `SELECT snapshot_date FROM jmv_snapshot_validity
       WHERE is_valid = 1 ORDER BY snapshot_date`
    );
    const earliest = snapDates[0]?.snapshot_date;
    const latest   = snapDates[snapDates.length - 1]?.snapshot_date;

    const rows = await safeQuery(
      `SELECT s.sku, d.collection, d.base_finish, d.size_nominal,
              d.product_type, s.qty, s.map_price
       FROM jmv_snapshots s
       JOIN jmv_dimensions d USING (sku)
       WHERE s.snapshot_date = ?
         AND s.sku NOT IN (SELECT sku FROM jmv_snapshots WHERE snapshot_date = ?)
       ORDER BY d.collection, s.map_price DESC`,
      [latest, earliest]
    );

    res.render('pages/admin/marketing/jmv-new-arrivals', {
      ...LAYOUT,
      pageTitle: 'JMV New Arrivals',
      earliest, latest, rows,
      style: '',
    });
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
}

module.exports = { dashboard, triggerRollup, stockoutDrilldown, newArrivalsDrilldown };
