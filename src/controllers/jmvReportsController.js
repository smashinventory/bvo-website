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

/* Was `.catch(() => [])` / `.catch(() => null)`. Especially costly on this
   dashboard: a broken query renders as "No data", which looks like a
   legitimate empty period rather than a fault. That is exactly how the
   Price Band Velocity panel sat blank until someone happened to question it.
   See src/db/query.js. */
const { safeQuery, safeQueryOne, mustQuery, mustAffect } =
  require('../db/query')('jmv-reports');

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
    // priceBands: one query — inner subquery LEFT JOINs snapshot so no groups
    // are dropped even if a SKU is missing from the latest snapshot.
    // MAX(snap.map_price) across all SKUs in the group on latestDate gives the
    // representative price; groups with no snapshot row fall into 'Unknown'.
    const priceBands = []; // replaced by priceBandsFallback below

    /* FIXED 2026-09-02 — this query never ran. Not once.

       It was:
         SELECT CASE WHEN MAX(gd.grp_map) < 2000 THEN ... END AS price_band ...
         GROUP BY price_band

       price_band is an alias for an expression containing MAX(), and you
       cannot group on an aggregate. MariaDB rejects it outright:

         #1056 - Can't group on 'price_band'
         (MySQL reports the same thing as #1111 Invalid use of group function)

       safeQuery swallowed the error and returned [], so the panel rendered
       "No data" — indistinguishable from a genuinely empty period. It had
       been that way since the panel was written.

       Wrong twice over, in fact: even in an engine that permitted it,
       MAX(gd.grp_map) evaluates across the WHOLE result rather than per row,
       so every group would have collapsed into a single band. The aggregate
       was not merely illegal, it was not what was meant.

       FIX: band each inner row by its own grp_map in a subquery, THEN sum.
       The inner query is unchanged — its per-(date, group) dedup was correct.

       Verified against production data before committing: 7 bands,
       $5K–$7K leading at 1206, then $2K–$3K at 538. */
    const priceBandsFallback = hasDims ? await safeQuery(
      `SELECT band AS price_band, SUM(grp_max) AS total_drawdown
       FROM (
         SELECT
           CASE
             WHEN gd.grp_map IS NULL THEN 'Unknown'
             WHEN gd.grp_map < 2000  THEN 'Under $2K'
             WHEN gd.grp_map < 3000  THEN '$2K–$3K'
             WHEN gd.grp_map < 4000  THEN '$3K–$4K'
             WHEN gd.grp_map < 5000  THEN '$4K–$5K'
             WHEN gd.grp_map < 7000  THEN '$5K–$7K'
             ELSE '$7K+'
           END AS band,
           gd.grp_max
         FROM (
           SELECT m.movement_date, d.group_number,
                  MAX(m.demand_min)     AS grp_max,
                  MAX(s.map_price)      AS grp_map
           FROM jmv_daily_movement m
           JOIN jmv_dimensions d USING (sku)
           LEFT JOIN jmv_snapshots s ON s.sku = m.sku AND s.snapshot_date = ?
           WHERE m.is_valid = 1 AND m.demand_min > 0
             AND d.product_type IN (${SYNC_TYPES_SQL})
             AND m.movement_date >= ?
           GROUP BY m.movement_date, d.group_number
         ) gd
       ) b
       GROUP BY band
       ORDER BY total_drawdown DESC`,
      [latestDate, ...SYNC_TYPES, cutoffStr]
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
    // IMPORTANT: do NOT use DEDUPED_INNER here — that query groups by freepower
    // among other dimension fields, so a group with a Vanity SKU (fp=Y) and a
    // Cabinet SKU (fp='') would produce TWO inner rows with the same grp_max,
    // double-counting the Cabinet's demand into the Standard bucket.
    //
    // Instead: collapse to exactly one row per (movement_date, group_number),
    // capturing MAX(demand_min) for dedup and a binary has_fp flag that is 1
    // if ANY SKU in the group has a recognised FreePower attribute value.
    /* ── FreePower attach rate ────────────────────────────────────────
       REWRITTEN 2026-09-02. The old query was wrong three separate ways;
       the SQL error was only the most visible of them.

       1. INVALID SQL. 'fp' aliased a CASE over MAX(gd.has_fp), then was used
          in GROUP BY. You cannot group on an aggregate — MariaDB answers
          #1056 every time. safeQuery swallowed it and the panel showed
          "No data". (Same bug as priceBandsFallback above; found by grepping
          for the shape, not by noticing a second symptom.)

       2. WRONG COLUMN. It read d.freepower, which comes from the feed column
          'FreePower Compatible?' — meaning "this base can ACCEPT a charger",
          not "this unit HAS one". The two are close to inverses in practice.
          Proof from one row pair on 2026-09-02, group 330:

            330-V60S-BW        top_finish NULL                freepower 1
            330-V60S-BW-FEJP   Eternal Jasmine Pearl          freepower 0

          The bare cabinet is flagged 1; the actual FreePower vanity built on
          it is flagged 0.

       3. WRONG DENOMINATOR AND WRONG DEDUP. It grouped by (date, group) and
          took MAX(has_fp), so if ANY sku in a model family had the flag, the
          family's entire drawdown was attributed to FreePower. group_number
          is the model prefix — 330 is all of Breckenridge — so nearly every
          group qualified and the chart read close to 100%.

       WHAT IT MEASURES NOW: of the tops that moved, what share carried the
       FreePower charger. Straight from the business question.

       WHY product_type = 'Top' AND NO DEDUP: a combo (vanity + top) sku
       draws down the individual cabinet sku AND the individual top sku
       automatically. So the standalone Top rows already capture every top
       that moved, whether sold alone or inside a combo. They are the atomic
       unit — there is no coupling left to correct for, and adding a group
       dedup here would undercount.

       WHY THE SKU RULE: verified against product names across all 5,218 JM
       skus, with zero disagreement in either direction:

         name says FreePower  &  sku rule says FP    979
         name says nothing    &  sku rule says no   4239

       Baseline at time of writing: FreePower 441 / Standard 2240 ≈ 16%. */
    const fpAttach = hasDims ? await safeQuery(
      `SELECT
         CASE WHEN d.sku LIKE '%-FP-%' THEN 'FreePower' ELSE 'Standard' END AS fp,
         SUM(m.demand_min) AS total_drawdown
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d ON d.sku = m.sku
       WHERE m.is_valid = 1
         AND m.demand_min > 0
         AND d.product_type = 'Top'
         AND m.movement_date >= ?
       GROUP BY fp
       ORDER BY total_drawdown DESC`,
      [cutoffStr]
    ) : [];

    /* ═══════════════════════════════════════════════════════════════════
       TOPS DEMAND — added 2026-09-02
       ───────────────────────────────────────────────────────────────────
       Which stone finishes and sizes are actually moving, so the storefront
       can eventually be sorted by demand rather than by hand.

       NO GROUP DEDUP ANYWHERE IN THIS SECTION, deliberately. A combo
       (vanity + top) sku automatically draws down the individual top sku,
       so the Top rows already capture every top that moved — whether sold
       alone or inside a combo. They are the atomic unit; there is nothing
       left to collapse, and a MAX-per-group here would hide exactly what
       these charts exist to show. A heavy-selling top appears as itself.

       All four queries are SKU-level over product_type = 'Top'.
    ═══════════════════════════════════════════════════════════════════ */

    // Stone finish by demand — what colour is selling
    const topsByFinish = hasDims ? await safeQuery(
      `SELECT d.top_finish, SUM(m.demand_min) AS total_drawdown,
              COUNT(DISTINCT d.sku) AS sku_count
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d ON d.sku = m.sku
       WHERE m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type = 'Top'
         AND d.top_finish IS NOT NULL AND d.top_finish <> ''
         AND m.movement_date >= ?
       GROUP BY d.top_finish
       ORDER BY total_drawdown DESC
       LIMIT 15`,
      [cutoffStr]
    ) : [];

    // Size by demand — which widths move
    const topsBySize = hasDims ? await safeQuery(
      `SELECT d.size_nominal, SUM(m.demand_min) AS total_drawdown
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d ON d.sku = m.sku
       WHERE m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type = 'Top'
         AND d.size_nominal IS NOT NULL
         AND m.movement_date >= ?
       GROUP BY d.size_nominal
       ORDER BY d.size_nominal ASC`,
      [cutoffStr]
    ) : [];

    // Material — Silestone / quartz / composite etc.
    const topsByMaterial = hasDims ? await safeQuery(
      `SELECT d.top_material, SUM(m.demand_min) AS total_drawdown
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d ON d.sku = m.sku
       WHERE m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type = 'Top'
         AND d.top_material IS NOT NULL AND d.top_material <> ''
         AND m.movement_date >= ?
       GROUP BY d.top_material
       ORDER BY total_drawdown DESC
       LIMIT 10`,
      [cutoffStr]
    ) : [];

    /* Finish × size matrix. Which stone sells in which width — the pairing
       that decides what to stock and what to surface first on a size-filtered
       collection page. Returned long-form; the view pivots it. */
    const topsFinishSize = hasDims ? await safeQuery(
      `SELECT d.top_finish, d.size_nominal, SUM(m.demand_min) AS total_drawdown
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d ON d.sku = m.sku
       WHERE m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type = 'Top'
         AND d.top_finish IS NOT NULL AND d.top_finish <> ''
         AND d.size_nominal IS NOT NULL
         AND m.movement_date >= ?
       GROUP BY d.top_finish, d.size_nominal`,
      [cutoffStr]
    ) : [];

    // SKU leaderboard — the explicit ask: a heavy seller must show as itself
    const topsLeaderboard = hasDims ? await safeQuery(
      `SELECT d.sku, d.top_finish, d.top_material, d.size_nominal, d.sinks,
              CASE WHEN d.sku LIKE '%-FP-%' THEN 1 ELSE 0 END AS is_fp,
              SUM(m.demand_min) AS total_drawdown,
              COUNT(DISTINCT m.movement_date) AS active_days
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d ON d.sku = m.sku
       WHERE m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type = 'Top'
         AND m.movement_date >= ?
       GROUP BY d.sku, d.top_finish, d.top_material, d.size_nominal, d.sinks, is_fp
       ORDER BY total_drawdown DESC
       LIMIT 40`,
      [cutoffStr]
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

    // ── Restock events in window (alert strip KPI) ────────────────────
    const restockKpi = await safeQueryOne(
      `SELECT COUNT(*) AS events, COALESCE(SUM(m.received_min), 0) AS total_qty
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d USING (sku)
       WHERE m.is_valid = 1
         AND m.is_restock = 1
         AND d.product_type IN (${SYNC_TYPES_SQL})
         AND m.movement_date >= ?`,
      [...SYNC_TYPES, cutoffStr]
    );

    /* ── Days of cover — REORDER LIST ──────────────────────────────────
       AVG is computed ONLY over days with confirmed demand (demand_min > 0)
       via CASE WHEN — this freezes the average the moment a SKU hits 0 qty,
       so extended stockout periods do not dilute the true demand signal.

       FIXED 2026-09-02 — the top of this table was noise.

       The HAVING read:

         HAVING avg_daily IS NOT NULL OR restock_events > 0

       That second limb admitted rows with NO demand average at all, provided
       they had been restocked. Those rows have days_cover = NULL, and MySQL
       sorts NULL FIRST under ASC — so every SKU with no movement signal
       floated to the top of a panel titled "Fastest Moving".

       Measured on production: 59 null rows against 3,798 real ones. With
       LIMIT 200, that is the first 30% of the visible table showing "— —"
       where the fastest movers should be.

       TWO CHANGES:

       1. Dropped the `OR restock_events > 0` limb. A row with no demand
          average cannot have a days-of-cover; restock activity already has
          its own panel (Restock Cadence). NULLs can no longer be produced,
          which also makes ORDER BY days_cover ASC safe rather than
          accidentally inverted.

       2. Added `AND s.qty > 0`. This table is a REORDER LIST — what is in
          stock and running out soonest. SKUs already at zero have
          days_cover = 0.0, which is accurate but would fill every visible
          row and push the actionable ones below the fold, recreating the
          bug in a different form. The 1,269 already-out SKUs are covered by
          the Stockouts KPI at the top of the page, which has its own
          drill-down.

       To include stockouts again, delete the `AND s.qty > 0` line — but
       expect them to dominate the first screen. */
    const daysOfCover = await safeQuery(
      `SELECT s.sku, d.collection, d.base_finish, d.size_nominal, d.product_type,
              s.qty AS current_qty, s.map_price,
              AVG(CASE WHEN m.demand_min > 0 THEN m.demand_min END) AS avg_daily,
              ROUND(s.qty / NULLIF(AVG(CASE WHEN m.demand_min > 0 THEN m.demand_min END), 0), 1) AS days_cover,
              SUM(m.is_restock) AS restock_events,
              COALESCE(SUM(m.received_min), 0) AS total_received
       FROM jmv_snapshots s
       JOIN jmv_dimensions d USING (sku)
       JOIN jmv_daily_movement m USING (sku)
       WHERE s.snapshot_date = ?
         AND m.is_valid = 1
         AND d.product_type IN (${SYNC_TYPES_SQL})
         AND m.movement_date >= ?
         AND s.qty > 0
       GROUP BY s.sku, d.collection, d.base_finish, d.size_nominal,
                d.product_type, s.qty, s.map_price
       HAVING avg_daily IS NOT NULL
       ORDER BY days_cover ASC, restock_events DESC
       LIMIT 200`,
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
      restockEvents:      restockKpi?.events  || 0,
      restockQty:         restockKpi?.total_qty || 0,
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
      // Tops demand — SKU-level, no group dedup (see the section comment above)
      topsByFinish:    JSON.stringify(topsByFinish),
      topsBySize:      JSON.stringify(topsBySize),
      topsByMaterial:  JSON.stringify(topsByMaterial),
      topsFinishSize:  JSON.stringify(topsFinishSize),
      topsLeaderboard,
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
      topMirrors: '[]', fpAttach: '[]',
      topsByFinish: '[]', topsBySize: '[]', topsByMaterial: '[]',
      topsFinishSize: '[]', topsLeaderboard: [],
      restockCadence: [], daysOfCover: [], top50: [],
      restockEvents: 0, restockQty: 0,
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

/* ─────────────────────────────────────────────────────────────────────
   FINANCIALS — MAP revenue proxy, velocity by dimension & date
   NOTE: "revenue" = drawdown_units × MAP_price.  Minimum demand estimate.

   METHODOLOGY — CONSERVATIVE (worst-case) deduplication:
     Purpose: marketing spend planning & content product selection.
     We cannot validate against JM's actual order data, so we apply the
     most conservative assumption to avoid chasing inflated signals.

     Observation: combo (Vanity) availability = min(cabinet qty, top qty)
     in static snapshots (e.g. 650-V30-BKO=42, 650-V30-BKO-3CAR=42).
     This suggests components may be coupled to combo allocation.

     Conservative rule: for each (group_number, movement_date), treat
     Cabinet and Top drawdown up to the combo count as attributable to
     the combo — not additional standalone demand. Only the excess is
     counted as genuine standalone revenue.

       net_cabinet = GREATEST(0, cabinet_drawdown − combo_drawdown)
       net_top     = GREATEST(0, top_drawdown     − combo_drawdown)
       revenue     = (combo_u × combo_p)
                   + (net_cabinet × cabinet_p)
                   + (net_top × top_p)

     This produces the FLOOR — actual demand ≥ this number.
     If JM pools are truly independent (flat SUM) this understates; that
     is acceptable. We prefer false-negative to false-positive when
     selecting products to invest marketing spend behind.
───────────────────────────────────────────────────────────────────── */

async function getFinancials(req, res) {
  try {
    // ── Date range (default: month-to-date) ─────────────────────────
    const today = new Date();
    const y  = today.getFullYear();
    const mo = String(today.getMonth() + 1).padStart(2, '0');
    const defaultFrom = `${y}-${mo}-01`;
    const defaultTo   = today.toISOString().slice(0, 10);
    const fromDate = (req.query.from || defaultFrom).slice(0, 10);
    const toDate   = (req.query.to   || defaultTo).slice(0, 10);
    const scope    = req.query.scope === 'sync' ? 'sync' : 'all';

    // ── VCT = types subject to conservative dedup ────────────────────
    const VCT     = ['Vanity', 'Cabinet', 'Top'];
    const VCT_SQL = VCT.map(() => '?').join(',');

    // ── Latest valid snapshot (for MAP price lookup) ─────────────────
    const latestSnap = await safeQueryOne(
      `SELECT MAX(snapshot_date) AS d FROM jmv_snapshot_validity WHERE is_valid = 1`
    );
    const latestDate = latestSnap?.d || null;

    if (!latestDate) {
      return res.render('pages/admin/marketing/jmv-financials', {
        ...LAYOUT, pageTitle: 'JMV Financials',
        fromDate, toDate, scope, latestDate: null,
        mapRevenue: 0, qtySold: 0,
        comboRevenue: 0, comboUnits: 0, indivRevenue: 0, indivUnits: 0,
        top10Revenue: [],
        revenueByDay: '[]', revenueByCategory: '[]',
        revenueByCollection: '[]', revenueByFinish: '[]',
        comboVsIndividual: '[]',
        error: 'No valid snapshot data yet — run the rollup job first.',
        style: '',
      });
    }

    // ── Inner pivot: one row per (group_number, movement_date) ───────
    // Collapses VCT types into columns so the dedup formula can be applied.
    const PIVOT = `
      SELECT
        d.group_number,
        m.movement_date,
        MAX(d.collection)   AS collection,
        MAX(d.base_finish)  AS base_finish,
        MAX(d.size_nominal) AS size_nominal,
        MAX(CASE WHEN d.product_type = 'Vanity'  THEN m.demand_min  ELSE 0 END) AS combo_u,
        MAX(CASE WHEN d.product_type = 'Cabinet' THEN m.demand_min  ELSE 0 END) AS cabinet_u,
        MAX(CASE WHEN d.product_type = 'Top'     THEN m.demand_min  ELSE 0 END) AS top_u,
        MAX(CASE WHEN d.product_type = 'Vanity'  THEN COALESCE(s.map_price,0) ELSE 0 END) AS combo_p,
        MAX(CASE WHEN d.product_type = 'Cabinet' THEN COALESCE(s.map_price,0) ELSE 0 END) AS cabinet_p,
        MAX(CASE WHEN d.product_type = 'Top'     THEN COALESCE(s.map_price,0) ELSE 0 END) AS top_p
      FROM jmv_daily_movement m
      JOIN jmv_dimensions d ON d.sku = m.sku
      LEFT JOIN jmv_snapshots s ON s.sku = m.sku AND s.snapshot_date = ?
      WHERE m.is_valid = 1
        AND d.product_type IN (${VCT_SQL})
        AND m.movement_date BETWEEN ? AND ?
      GROUP BY d.group_number, m.movement_date
    `;
    const PP = [latestDate, ...VCT, fromDate, toDate];

    // Conservative dedup expressions
    const REV   = `(g.combo_u * g.combo_p) + (GREATEST(0, g.cabinet_u - g.combo_u) * g.cabinet_p) + (GREATEST(0, g.top_u - g.combo_u) * g.top_p)`;
    const UNITS = `g.combo_u + GREATEST(0, g.cabinet_u - g.combo_u) + GREATEST(0, g.top_u - g.combo_u)`;

    // ── VCT KPI totals ───────────────────────────────────────────────
    const kpiVCT = await safeQueryOne(
      `SELECT ROUND(SUM(${REV}),0) AS map_revenue, SUM(${UNITS}) AS qty_sold
       FROM (${PIVOT}) g`, PP
    );

    // ── Revenue by day ───────────────────────────────────────────────
    const revenueByDay = await safeQuery(
      `SELECT DATE_FORMAT(g.movement_date,'%Y-%m-%d') AS date,
              ROUND(SUM(${REV}),0) AS revenue,
              SUM(${UNITS}) AS units
       FROM (${PIVOT}) g
       GROUP BY g.movement_date ORDER BY g.movement_date`, PP
    );

    // ── Combo vs standalone breakdown ────────────────────────────────
    const cviBrk = await safeQueryOne(
      `SELECT
         ROUND(SUM(g.combo_u * g.combo_p),0)                              AS combo_rev,
         SUM(g.combo_u)                                                    AS combo_u,
         ROUND(SUM(GREATEST(0, g.cabinet_u - g.combo_u) * g.cabinet_p),0) AS cabinet_rev,
         SUM(GREATEST(0, g.cabinet_u - g.combo_u))                        AS cabinet_u,
         ROUND(SUM(GREATEST(0, g.top_u - g.combo_u) * g.top_p),0)        AS top_rev,
         SUM(GREATEST(0, g.top_u - g.combo_u))                            AS top_u
       FROM (${PIVOT}) g`, PP
    );

    // ── Revenue by collection ─────────────────────────────────────────
    const revenueByCollection = await safeQuery(
      `SELECT COALESCE(g.collection,'(none)') AS label,
              ROUND(SUM(${REV}),0) AS revenue,
              SUM(${UNITS}) AS units
       FROM (${PIVOT}) g
       GROUP BY g.collection ORDER BY revenue DESC LIMIT 12`, PP
    );

    // ── Revenue by finish ─────────────────────────────────────────────
    const revenueByFinish = await safeQuery(
      `SELECT COALESCE(g.base_finish,'(none)') AS label,
              ROUND(SUM(${REV}),0) AS revenue,
              SUM(${UNITS}) AS units
       FROM (${PIVOT}) g
       GROUP BY g.base_finish ORDER BY revenue DESC LIMIT 10`, PP
    );

    // ── Top 10 groups by revenue (conservative dedup) ─────────────────
    const top10Revenue = await safeQuery(
      `SELECT g.group_number,
              MAX(g.collection)   AS collection,
              MAX(g.base_finish)  AS base_finish,
              MAX(g.size_nominal) AS size_nominal,
              SUM(g.combo_u)                                AS combo_units,
              SUM(GREATEST(0, g.cabinet_u - g.combo_u))    AS net_cabinet,
              SUM(GREATEST(0, g.top_u     - g.combo_u))    AS net_top,
              ROUND(SUM(${REV}),0)                          AS revenue,
              SUM(${UNITS})                                 AS units
       FROM (${PIVOT}) g
       GROUP BY g.group_number
       ORDER BY revenue DESC LIMIT 10`, PP
    );

    // ── By-category array ─────────────────────────────────────────────
    const revenueByCategory = [
      { label: 'Combo (Vanity)',       revenue: cviBrk?.combo_rev   || 0, units: cviBrk?.combo_u   || 0 },
      { label: 'Cabinet (standalone)', revenue: cviBrk?.cabinet_rev || 0, units: cviBrk?.cabinet_u || 0 },
      { label: 'Top (standalone)',     revenue: cviBrk?.top_rev     || 0, units: cviBrk?.top_u     || 0 },
    ].filter(r => r.revenue > 0);

    // ── "all" scope: add uncoupled types (Mirror, Linen Cabinet, etc.) ─
    let extraRevenue = 0, extraUnits = 0;
    const extraByCollection = [], extraByFinish = [], extraByCat = [];

    const OTHER_TYPES = scope === 'all'
      ? ['Mirror', 'Linen Cabinet', 'Storage Cabinet', 'Backsplash',
         'Bench', 'Shelf', 'Hutch', 'Drawer Unit', 'Console']
      : [];

    if (OTHER_TYPES.length > 0) {
      const OT_SQL = OTHER_TYPES.map(() => '?').join(',');
      const OTP  = [latestDate, ...OTHER_TYPES, fromDate, toDate];
      const OT_JN = `FROM jmv_daily_movement m
                     JOIN jmv_dimensions d ON d.sku = m.sku
                     LEFT JOIN jmv_snapshots s ON s.sku = m.sku AND s.snapshot_date = ?`;
      const OT_WH = `WHERE m.is_valid = 1
                       AND d.product_type IN (${OT_SQL})
                       AND m.movement_date BETWEEN ? AND ?`;

      const otKpi = await safeQueryOne(
        `SELECT ROUND(SUM(m.demand_min * COALESCE(s.map_price,0)),0) AS rev,
                SUM(m.demand_min) AS u ${OT_JN} ${OT_WH}`, OTP
      );
      extraRevenue = Number(otKpi?.rev || 0);
      extraUnits   = Number(otKpi?.u   || 0);

      const otColl = await safeQuery(
        `SELECT COALESCE(d.collection,'(none)') AS label,
                ROUND(SUM(m.demand_min * COALESCE(s.map_price,0)),0) AS revenue,
                SUM(m.demand_min) AS units ${OT_JN} ${OT_WH}
         GROUP BY d.collection ORDER BY revenue DESC LIMIT 12`, OTP
      );
      const otFin = await safeQuery(
        `SELECT COALESCE(d.base_finish,'(none)') AS label,
                ROUND(SUM(m.demand_min * COALESCE(s.map_price,0)),0) AS revenue,
                SUM(m.demand_min) AS units ${OT_JN} ${OT_WH}
         GROUP BY d.base_finish ORDER BY revenue DESC LIMIT 10`, OTP
      );
      const otCat = await safeQuery(
        `SELECT d.product_type AS label,
                ROUND(SUM(m.demand_min * COALESCE(s.map_price,0)),0) AS revenue,
                SUM(m.demand_min) AS units ${OT_JN} ${OT_WH}
         GROUP BY d.product_type ORDER BY revenue DESC`, OTP
      );

      otColl.forEach(r => extraByCollection.push(r));
      otFin.forEach(r => extraByFinish.push(r));
      otCat.forEach(r => extraByCat.push(r));
    }

    // ── Merge VCT + other-type collection/finish for "all" scope ─────
    const mergeByLabel = (base, extra) => {
      const map = {};
      base.forEach(r => { map[r.label] = { label: r.label, revenue: Number(r.revenue), units: Number(r.units) }; });
      extra.forEach(r => {
        if (map[r.label]) { map[r.label].revenue += Number(r.revenue); map[r.label].units += Number(r.units); }
        else map[r.label] = { label: r.label, revenue: Number(r.revenue), units: Number(r.units) };
      });
      return Object.values(map).sort((a, b) => b.revenue - a.revenue);
    };

    // ── Final KPI totals ─────────────────────────────────────────────
    const mapRevenue   = Number(kpiVCT?.map_revenue || 0) + extraRevenue;
    const qtySold      = Number(kpiVCT?.qty_sold    || 0) + extraUnits;
    const comboRevenue = Number(cviBrk?.combo_rev   || 0);
    const comboUnits   = Number(cviBrk?.combo_u     || 0);
    const indivRevenue = Number(cviBrk?.cabinet_rev || 0) + Number(cviBrk?.top_rev || 0) + extraRevenue;
    const indivUnits   = Number(cviBrk?.cabinet_u   || 0) + Number(cviBrk?.top_u   || 0) + extraUnits;

    const comboVsIndividual = [
      { label: 'Combo (Vanity)',       revenue: comboRevenue,                     units: comboUnits },
      { label: 'Cabinet (standalone)', revenue: Number(cviBrk?.cabinet_rev || 0), units: Number(cviBrk?.cabinet_u || 0) },
      { label: 'Top (standalone)',     revenue: Number(cviBrk?.top_rev     || 0), units: Number(cviBrk?.top_u     || 0) },
      ...extraByCat,
    ].filter(r => r.revenue > 0);

    res.render('pages/admin/marketing/jmv-financials', {
      ...LAYOUT,
      pageTitle: 'JMV Financials',
      fromDate, toDate, scope, latestDate,
      mapRevenue, qtySold,
      comboRevenue, comboUnits, indivRevenue, indivUnits,
      top10Revenue,
      revenueByDay:        JSON.stringify(revenueByDay),
      revenueByCategory:   JSON.stringify([...revenueByCategory, ...extraByCat]),
      revenueByCollection: JSON.stringify(mergeByLabel(revenueByCollection, extraByCollection).slice(0, 12)),
      revenueByFinish:     JSON.stringify(mergeByLabel(revenueByFinish, extraByFinish).slice(0, 10)),
      comboVsIndividual:   JSON.stringify(comboVsIndividual),
      style: '',
    });
  } catch (err) {
    console.error('[jmvReports] financials error:', err);
    res.status(500).render('pages/admin/marketing/jmv-financials', {
      ...LAYOUT,
      pageTitle: 'JMV Financials',
      error: 'Failed to load financials — ' + err.message,
      fromDate: '', toDate: '', scope: 'all', latestDate: null,
      mapRevenue: 0, qtySold: 0,
      comboRevenue: 0, comboUnits: 0, indivRevenue: 0, indivUnits: 0,
      top10Revenue: [],
      revenueByDay: '[]', revenueByCategory: '[]',
      revenueByCollection: '[]', revenueByFinish: '[]',
      comboVsIndividual: '[]',
      style: '',
    });
  }
}

module.exports = { dashboard, triggerRollup, stockoutDrilldown, newArrivalsDrilldown, getFinancials };
