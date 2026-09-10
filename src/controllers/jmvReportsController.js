'use strict';

/**
 * jmvReportsController.js
 * JMV Demand Intelligence — admin reporting layer over nightly snapshot data.
 *
 * ALL aggregations follow the three-hazard rules:
 *  1. Deduplication: MAX demand_min, never SUM.
 *     CORRECTED 2026-09-03 — this line used to read "per group_number per
 *     day", which overstated it. DEDUPED_INNER groups by TWELVE columns, so
 *     the collapse is at VARIANT level, not group level: 8,005 rows where a
 *     true per-group dedup yields 179. A cabinet and its combos land in
 *     separate rows because top_finish and freepower differ, so collection
 *     totals run HIGH. Deliberate — a true group collapse would merge every
 *     stone finish into one number and hide which stone is moving.
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
const { runRollup, getSnapshotStatus, getValidDayCount } = require('../jobs/jmvMovementRollup');

const LAYOUT = { layout: 'layouts/admin' };
/* JM computes MAP as MSRP x 0.66 — derived at import from 4,761 products that
   carry both values (range 65.85–67.85%). See importJamesMartinFeed.js. Used
   as the price fallback when MAP is absent. */
const MSRP_TO_MAP = 0.66;

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
    /* Whitelisted, not just parsed. `parseInt(req.query.days || '30', 10)`
       returns NaN for ?days=abc, cutoff.setDate(NaN) makes an Invalid
       Date, and .toISOString() then throws — a 500 on a query string.
       365 is offered so history past 90 days is visible as it accrues;
       MoM/YoY comparison is a separate build, not a wider window. */
    const ALLOWED_DAYS = [7, 14, 30, 60, 90, 365];
    const reqDays = parseInt(req.query.days, 10);
    const days = ALLOWED_DAYS.includes(reqDays) ? reqDays : 30;
    /* REMOVED 2026-09-03 — ptype / scope.
       `scope` was computed here and never read; every query on this page
       hardcodes SYNC_TYPES. `ptype` existed only to render the selected
       state of a dropdown that changed nothing. Both gone with the control.
       The working full-feed view is the scope selector on JMV Financials. */
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    // ── Snapshot status ──────────────────────────────────────────────
    /* Two different questions, deliberately two queries.

       snapshotStatus — the most recent N days, for the status TABLE.
       totalDays      — every valid day on record, for the header, the
                        DATA WINDOW card and the confidence caption.

       Counting the first to answer the second is what pinned "Valid days
       collected" at 14 from the day history reached 14. See the note on
       getSnapshotStatus(). */
    const snapshotStatus = await getSnapshotStatus(30);
    const latestDate = snapshotStatus[0]?.snapshot_date || null;
    const totalDays  = await getValidDayCount();

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

    /* ── Comparison baseline ───────────────────────────────────────────
       FIXED 2026-09-02 — these three KPIs used to compare against the
       EARLIEST valid snapshot, always, which broke in two ways:

       1. The 7/14/30/60/90 window selector never reached them. It sets
          cutoffStr, which the charts use; these read earliestDate. Changing
          the window moved every chart and left these three frozen.

       2. The meaning drifted as history accumulated. With 10 days of data
          "New Arrivals" means "added in the last 10 days". At 90 days it
          silently becomes "added in the last three months" — a number that
          only ever grows and stops being actionable, without the label
          changing.

       Now: compare against the newest valid snapshot at or before the
       selected cutoff. The selector works, and "new since X" means what the
       window says. Falls back to the earliest snapshot when history is
       shorter than the window — which is the case today at 10 days. */
    const earliestDate = await safeQueryOne(
      `SELECT MIN(snapshot_date) AS d FROM jmv_snapshot_validity WHERE is_valid = 1`
    );
    const baselineRow = await safeQueryOne(
      `SELECT COALESCE(
                (SELECT MAX(snapshot_date) FROM jmv_snapshot_validity
                  WHERE is_valid = 1 AND snapshot_date <= ?),
                (SELECT MIN(snapshot_date) FROM jmv_snapshot_validity
                  WHERE is_valid = 1)
              ) AS d`,
      [cutoffStr]
    );
    const baselineDate = baselineRow?.d || earliestDate?.d || latestDate;

    /* All three below now filter to SYNC_TYPES. They previously did not,
       while Stockouts / Low Stock / Restock Events did — so one strip was
       reporting two different populations, and only some cards said so.
       MAP Changes was the sharpest case: its tooltip tells you to bring BVO
       pricing in line, while counting mirrors, backsplashes and samples we
       do not sell. */

    // New arrivals: in the latest snapshot, absent from the baseline
    const newArrivalsCount = await safeQueryOne(
      `SELECT COUNT(*) AS cnt
       FROM jmv_snapshots s
       JOIN jmv_dimensions d USING (sku)
       WHERE s.snapshot_date = ?
         AND d.product_type IN (${SYNC_TYPES_SQL})
         AND s.sku NOT IN (SELECT sku FROM jmv_snapshots WHERE snapshot_date = ?)`,
      [latestDate, ...SYNC_TYPES, baselineDate]
    );

    /* Discontinued: present at the baseline, absent from the last N
       CONSECUTIVE valid snapshots.

       This used to be a single comparison against one day. Its tooltip says
       "Pull from site before orders" — a destructive action — and one short
       feed file was enough to trigger it. Not hypothetical: deploys wipe the
       drop zone and gvssync recovers from the protected archive, so partial
       or re-fetched files happen.

       Requiring absence across the most recent 3 valid snapshots means a
       single bad day cannot recommend delisting a live product. */
    const DISCONTINUED_CONSECUTIVE_DAYS = 3;
    const discontinuedCount = await safeQueryOne(
      `SELECT COUNT(*) AS cnt
       FROM jmv_snapshots s
       JOIN jmv_dimensions d USING (sku)
       WHERE s.snapshot_date = ?
         AND d.product_type IN (${SYNC_TYPES_SQL})
         AND s.sku NOT IN (
           SELECT sku FROM jmv_snapshots
            WHERE snapshot_date IN (
              /* Derived table, not a bare LIMIT. MySQL rejects
                 "IN (SELECT ... LIMIT n)" outright:
                   #1235 This version of MySQL doesn't yet support
                         'LIMIT & IN/ALL/ANY/SOME subquery'
                 Wrapping it makes the same intent portable. */
              SELECT d FROM (
                SELECT snapshot_date AS d
                  FROM jmv_snapshot_validity
                 WHERE is_valid = 1
                 ORDER BY snapshot_date DESC
                 LIMIT ${DISCONTINUED_CONSECUTIVE_DAYS}
              ) recent
            )
         )`,
      [baselineDate, ...SYNC_TYPES]
    );

    // MAP changes between the baseline and the latest snapshot
    const mapChangesCount = await safeQueryOne(
      `SELECT COUNT(DISTINCT a.sku) AS cnt
       FROM jmv_snapshots a
       JOIN jmv_snapshots b ON a.sku = b.sku
       JOIN jmv_dimensions d ON d.sku = a.sku
       WHERE a.snapshot_date = ?
         AND b.snapshot_date = ?
         AND d.product_type IN (${SYNC_TYPES_SQL})
         AND a.map_price IS NOT NULL
         AND b.map_price IS NOT NULL
         AND a.map_price <> b.map_price`,
      [baselineDate, latestDate, ...SYNC_TYPES]
    );

    // ── Top collections (group-deduped) ──────────────────────────────
    /* CHANGED 2026-09-03 — collection-less rows are excluded outright.

       Earlier today I labelled the blank bucket "Tops & Sinks (no
       collection)" so it would stop reading as missing data. That was the
       wrong call: naming it kept a non-collection in a chart of collections,
       where it ranked 4th and pushed real collections down. It is not a
       collection, so it does not belong on this axis at all.

       Nothing is lost — those SKUs are standalone tops and sinks, and they
       now have their own Tops Demand section with finish, size, material and
       a SKU leaderboard, which says far more about them than one unnamed bar
       ever did. */
    const topCollections = hasDims ? await safeQuery(
      `SELECT gd.collection,
              SUM(gd.grp_max) AS total_drawdown,
              COUNT(DISTINCT gd.group_number) AS group_count
       FROM (${DEDUPED_INNER(`AND m.movement_date >= ?`)}) gd
       WHERE gd.collection IS NOT NULL AND gd.collection <> ''
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

    /* ── Top mirrors (full feed scope — "should we add?" view) ────────
       FIXED 2026-09-03 — a FAN-OUT JOIN was multiplying every number here.

       It was:
         FROM ( ...one row per (date, group_number)... ) gm
         JOIN jmv_dimensions d ON d.group_number = gm.group_number
         GROUP BY d.collection

       group_number identifies a model FAMILY, so joining jmv_dimensions back
       on it returns one row per SKU in that family — and each deduped
       (date, group) figure was then counted once per SKU. The inflation
       factor was roughly the mirror SKU count for that collection. Bristol
       reading "3090 units · 1 groups" was that artefact, not demand.

       The inner query carries collection through now, so there is nothing to
       re-join. Collection-less rows are excluded for the same reason as
       every other dimensional chart: this axis is collections. */
    const topMirrors = hasDims ? await safeQuery(
      `SELECT gm.collection, SUM(gm.grp_max) AS total_drawdown,
              COUNT(DISTINCT gm.group_number) AS group_count
       FROM (
         SELECT m.movement_date, d.group_number, d.collection,
                MAX(m.demand_min) AS grp_max
         FROM jmv_daily_movement m
         JOIN jmv_dimensions d USING (sku)
         WHERE m.is_valid = 1 AND m.demand_min > 0
           AND d.product_type = 'Mirror'
           AND m.movement_date >= ?
         GROUP BY m.movement_date, d.group_number, d.collection
       ) gm
       WHERE gm.collection IS NOT NULL AND gm.collection <> ''
       GROUP BY gm.collection
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

    /* ═══════════════════════════════════════════════════════════════════
       CABINET DEMAND and COMBO DEMAND — added 2026-09-09
       ───────────────────────────────────────────────────────────────────
       Two reports, each scoped to ONE product_type:

         Cabinet Demand   product_type = 'Cabinet'   332 SKUs
                          Verified against the 2026-09-08 dump: zero of
                          them carry a top_finish and zero have sinks > 0.
                          Cabinet-only by definition, not by assumption.

         Combo Demand     product_type = 'Vanity'    4,212 SKUs
                          4,199 carry BOTH a top_finish and sinks > 0 —
                          cabinet + top. The 13 without a top_finish are
                          either a feed gap or genuinely top-less; they
                          are included because product_type is the filter.

       Everything else is excluded: Mirror, Backsplash, Storage Cabinet,
       Countertop Unit, Drawer Unit, Console, Console Base, Floating
       Console, Metal Base, Linen Cabinet, Hutch, Shelf, Pull, Bench,
       Knobs and Legs, and the three Sample types. That is the "no
       accessories or one-off components" requirement.

       NO GROUP DEDUP, same as Tops Demand and for the same reason: once
       scoped to a single product_type the SKU is the atomic unit and there
       is nothing left to collapse. Cross-type double counting cannot occur
       because the two reports never mix types.

       On whether a combo sale also depletes a standalone cabinet: 37 of 70
       group_numbers contain both. Measured on the 2026-09-08 movement data,
       on days a Vanity SKU drew down a Cabinet in the same group also drew
       down 86% of the time against a 66% base rate — elevated, but far from
       the ~100% a shared physical pool would produce. Read as correlated
       demand, not one pool. Sixteen days of sparse data, so revisit if
       Cabinet numbers ever look implausibly high.
    ═══════════════════════════════════════════════════════════════════ */

    const CABINET = 'Cabinet';
    const COMBO   = 'Vanity';

    /* Collection — which model line moves. Same query shape for both
       reports; the product_type parameter is the only difference. */
    const demandByCollection = (ptype) => safeQuery(
      `SELECT d.collection, SUM(m.demand_min) AS total_drawdown,
              COUNT(DISTINCT d.sku) AS sku_count
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d ON d.sku = m.sku
       WHERE m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type = ?
         AND d.collection IS NOT NULL AND d.collection <> ''
         AND m.movement_date >= ?
       GROUP BY d.collection
       ORDER BY total_drawdown DESC
       LIMIT 15`, [ptype, cutoffStr]);

    const demandByBaseFinish = (ptype) => safeQuery(
      `SELECT d.base_finish, SUM(m.demand_min) AS total_drawdown
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d ON d.sku = m.sku
       WHERE m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type = ?
         AND d.base_finish IS NOT NULL AND d.base_finish <> ''
         AND m.movement_date >= ?
       GROUP BY d.base_finish
       ORDER BY total_drawdown DESC
       LIMIT 12`, [ptype, cutoffStr]);

    const demandBySize = (ptype) => safeQuery(
      `SELECT d.size_nominal, SUM(m.demand_min) AS total_drawdown
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d ON d.sku = m.sku
       WHERE m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type = ?
         AND d.size_nominal IS NOT NULL
         AND m.movement_date >= ?
       GROUP BY d.size_nominal
       ORDER BY d.size_nominal ASC`, [ptype, cutoffStr]);

    // ── Cabinet Demand ───────────────────────────────────────────────
    const cabByCollection = hasDims ? await demandByCollection(CABINET) : [];
    const cabByFinish     = hasDims ? await demandByBaseFinish(CABINET) : [];
    const cabBySize       = hasDims ? await demandBySize(CABINET)       : [];

    /* Collection × size. Long-form; the view pivots it, ordered by the
       collection ranking above so both panels agree. */
    const cabCollectionSize = hasDims ? await safeQuery(
      `SELECT d.collection, d.size_nominal, SUM(m.demand_min) AS total_drawdown
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d ON d.sku = m.sku
       WHERE m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type = ?
         AND d.collection IS NOT NULL AND d.collection <> ''
         AND d.size_nominal IS NOT NULL
         AND m.movement_date >= ?
       GROUP BY d.collection, d.size_nominal`, [CABINET, cutoffStr]) : [];

    const cabLeaderboard = hasDims ? await safeQuery(
      `SELECT d.sku, d.collection, d.base_finish, d.size_nominal,
              d.hardware, d.vanity_type,
              SUM(m.demand_min) AS total_drawdown,
              COUNT(DISTINCT m.movement_date) AS active_days
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d ON d.sku = m.sku
       WHERE m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type = ?
         AND m.movement_date >= ?
       GROUP BY d.sku, d.collection, d.base_finish, d.size_nominal,
                d.hardware, d.vanity_type
       ORDER BY total_drawdown DESC
       LIMIT 40`, [CABINET, cutoffStr]) : [];

    // ── Combo Demand ─────────────────────────────────────────────────
    const comboByCollection = hasDims ? await demandByCollection(COMBO) : [];
    const comboBySize       = hasDims ? await demandBySize(COMBO)       : [];

    /* Base finish × top finish. The pairing unique to combos — which
       cabinet colour sells against which stone. This is the panel that
       has no equivalent in either of the other two reports. */
    const comboFinishPair = hasDims ? await safeQuery(
      `SELECT d.base_finish, d.top_finish, SUM(m.demand_min) AS total_drawdown
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d ON d.sku = m.sku
       WHERE m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type = ?
         AND d.base_finish IS NOT NULL AND d.base_finish <> ''
         AND d.top_finish  IS NOT NULL AND d.top_finish  <> ''
         AND m.movement_date >= ?
       GROUP BY d.base_finish, d.top_finish`, [COMBO, cutoffStr]) : [];

    /* Single vs double sink. `sinks` is a tinyint; COALESCE keeps rows
       with a NULL out of a bucket that would otherwise read as 0. */
    const comboBySinks = hasDims ? await safeQuery(
      `SELECT d.sinks, SUM(m.demand_min) AS total_drawdown,
              COUNT(DISTINCT d.sku) AS sku_count
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d ON d.sku = m.sku
       WHERE m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type = ?
         AND d.sinks IS NOT NULL AND d.sinks > 0
         AND m.movement_date >= ?
       GROUP BY d.sinks
       ORDER BY d.sinks ASC`, [COMBO, cutoffStr]) : [];

    const comboLeaderboard = hasDims ? await safeQuery(
      `SELECT d.sku, d.collection, d.base_finish, d.top_finish,
              d.size_nominal, d.sinks,
              CASE WHEN d.freepower = 1 THEN 1 ELSE 0 END AS is_fp,
              SUM(m.demand_min) AS total_drawdown,
              COUNT(DISTINCT m.movement_date) AS active_days
       FROM jmv_daily_movement m
       JOIN jmv_dimensions d ON d.sku = m.sku
       WHERE m.is_valid = 1 AND m.demand_min > 0
         AND d.product_type = ?
         AND m.movement_date >= ?
       GROUP BY d.sku, d.collection, d.base_finish, d.top_finish,
                d.size_nominal, d.sinks, is_fp
       ORDER BY total_drawdown DESC
       LIMIT 40`, [COMBO, cutoffStr]) : [];

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
      days,
      // meta
      snapshotStatus,
      latestDate,
      totalDays,
      hasDims,
      earliestDate: earliestDate?.d,
      /* The date the New Arrivals / Discontinued / MAP Changes cards are
         actually measured from. Was earliestDate, which stopped matching the
         selected window the moment history exceeded it. The cards render
         this so the strip states its own baseline instead of implying one. */
      baselineDate,
      discontinuedDays: DISCONTINUED_CONSECUTIVE_DAYS,
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
      // Cabinet Demand — product_type = 'Cabinet'
      cabByCollection:   JSON.stringify(cabByCollection),
      cabByFinish:       JSON.stringify(cabByFinish),
      cabBySize:         JSON.stringify(cabBySize),
      cabCollectionSize: JSON.stringify(cabCollectionSize),
      cabLeaderboard,
      // Combo Demand — product_type = 'Vanity'
      comboByCollection: JSON.stringify(comboByCollection),
      comboBySize:       JSON.stringify(comboBySize),
      comboFinishPair:   JSON.stringify(comboFinishPair),
      comboBySinks:      JSON.stringify(comboBySinks),
      comboLeaderboard,
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
      days: 30, hasDims: false, snapshotStatus: [],
      latestDate: null, totalDays: 0, earliestDate: null,
      /* Must be supplied here too. The KPI cards render these
         unconditionally, so omitting them turns a handled 500 — which is
         supposed to show the user a readable error — into a ReferenceError
         inside the template and a blank page. The error path is the one
         place you cannot afford a second failure. */
      baselineDate: null, discontinuedDays: 3,
      stockoutCount: 0, lowStockCount: 0, newArrivalsCount: 0,
      discontinuedCount: 0, mapChangesCount: 0,
      topCollections: '[]', topFinishes: '[]', topSizes: '[]',
      topThemes: '[]', topVanityTypes: '[]', priceBandsFallback: '[]',
      heatmapFinishes: '[]', heatmapSizes: '[]', heatmapMatrix: '{}',
      topMirrors: '[]', fpAttach: '[]',
      topsByFinish: '[]', topsBySize: '[]', topsByMaterial: '[]',
      topsFinishSize: '[]', topsLeaderboard: [],
      /* The error render must define EVERY local the template reads, or a
         failed query becomes a second, more confusing crash inside the
         error page itself. */
      cabByCollection: '[]', cabByFinish: '[]', cabBySize: '[]',
      cabCollectionSize: '[]', cabLeaderboard: [],
      comboByCollection: '[]', comboBySize: '[]', comboFinishPair: '[]',
      comboBySinks: '[]', comboLeaderboard: [],
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

    /* Scope filter added 2026-09-02 — this drill-down listed the whole feed
       (mirrors, backsplashes, samples) while the KPI card that links to it
       is scoped to Vanity/Cabinet/Top. The count and the list disagreed. */
    const rows = await safeQuery(
      `SELECT s.sku, d.collection, d.base_finish, d.size_nominal,
              d.product_type, s.qty, s.map_price
       FROM jmv_snapshots s
       JOIN jmv_dimensions d USING (sku)
       WHERE s.snapshot_date = ?
         AND d.product_type IN (${SYNC_TYPES_SQL})
         AND s.sku NOT IN (SELECT sku FROM jmv_snapshots WHERE snapshot_date = ?)
       ORDER BY d.collection, s.map_price DESC`,
      [latest, ...SYNC_TYPES, earliest]
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

   METHODOLOGY — see JMV_REVENUE_DEFINITION.md (approved 2026-09-10, amended
     the same day before build). That document is the artifact of record; if
     it and this code disagree, it is right and this is a bug.

     Per SKU, per day: depletion x that day's MAP price, summed. Nothing is
     grouped, nothing is subtracted from anything else, and no inference is
     made about what was "really" sold.

     Combos are excluded — a SKU carrying a top_finish that is not itself a
     Top includes a top, and its quantity is derived from its components
     rather than being stock of its own.

     The retired "conservative floor" pivot and the evidence against it are
     documented at the revenue basis block inside getFinancials.
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

    /* Newest valid snapshot. Anchors the run-rate cards (which must not move
       when the from/to selector narrows) and gates the whole page: with no
       snapshot there is nothing to price against. */
    const latestSnap = await safeQueryOne(
      `SELECT MAX(snapshot_date) AS d FROM jmv_snapshot_validity WHERE is_valid = 1`
    );
    const latestDate = latestSnap?.d || null;

    if (!latestDate) {
      return res.render('pages/admin/marketing/jmv-financials', {
        ...LAYOUT, pageTitle: 'JMV Financials',
        fromDate, toDate, scope, latestDate: null,
        mapRevenue: 0, qtySold: 0,
        /* Every local the template reads must exist here too, or a failed
           query turns the error page into a second, more confusing crash. */
        rev30: { total:0, days:0, avg:0 }, rev15: { total:0, days:0, avg:0 },
        rev7:  { total:0, days:0, avg:0 }, rev24: 0, rev24Date: null,
        cabinetRevenue: 0, cabinetUnits: 0, topRevenue: 0, topUnits: 0,
        otherRevenue: 0, otherUnits: 0, unpricedSkus: 0, unpricedUnits: 0,
        top10Revenue: [],
        revenueByDay: '[]', collectedDays: '[]', revenueByCategory: '[]',
        revenueByCollection: '[]', revenueByFinish: '[]',
        excludedNoCollectionRev: 0, excludedNoCollectionUnits: 0,
        excludedNoFinishRev: 0, excludedNoFinishUnits: 0,
        comboVsIndividual: '[]',
        error: 'No valid snapshot data yet — run the rollup job first.',
        style: '',
      });
    }

    /* ══════════════════════════════════════════════════════════════════
       REVENUE BASIS — see JMV_REVENUE_DEFINITION.md (approved 2026-09-10)
       That document is the artifact of record. If this code and it ever
       disagree, it is right and this is a bug.

       REPLACED the "conservative floor" pivot on 2026-09-10. The old method
       took the Vanity SKU's drawdown at face value, priced it at combo MAP,
       and counted Cabinet/Top only for their excess above it, pivoted to MAX
       per (group_number, movement_date). Three independent defects:

         - A combo SKU's quantity is min(base, top) — computed availability,
           not inventory. E444-V72-GW-3WZ logged 72 units across six
           observations while its base sat at 158, unmoved, every day; from
           08-29 its qty is identical to the top's. One top drawdown of 62
           units manufactured 482 units of phantom demand across 51 SKUs.
         - group_number is JM's SERIES code (the leading SKU token). Group 157
           is 309 SKUs across 7 sizes collapsed by MAX to one number per day,
           and ZERO of 71 groups hold both a Cabinet and a Top — so the dedup's
           premise was unreachable.
         - 08-29 showed 17,061 Vanity units against 120 Cabinet units. Every
           real combo consumes a cabinet.

       Measured: $8,957,392 old vs $5,495,606 new over the six observation
       days — 39% inflation.

       Now: one SKU, one quantity, one price, multiplied and summed. No
       grouping, no cross-SKU subtraction, no inference about what was "really"
       sold. ─────────────────────────────────────────────────────────────── */

    /* ── WHAT COUNTS AS A COMBO ──────────────────────────────────────
       A SKU is an assembly — and therefore excluded — when it carries a
       top_finish AND belongs to a type that ships in assembled form.

       BOTH halves are load-bearing.

       Without the type list, top_finish alone excludes solid stone pieces
       that merely share a finish name: 203 Tops, 15 Backsplashes and 15
       Floating Consoles. The first version of this rule did exactly that
       and silently deleted 245 units of backsplash demand. Gate G14 caught
       it; nothing on the page would have.

       Without top_finish, the type list alone is useless: Countertop Unit,
       Storage Cabinet and Drawer Unit each ship BOTH ways —
       825-CU30-BW plain, 825-CU30-BW-3CAR with a Carrara top — and only
       top_finish separates the two.

       The five types below are the ones observed to have an assembled
       form. Adding a type here excludes its with-top variants; it does not
       touch its plain ones.

       This also picks up, with no allow-list, the 13 Vanity-typed SKUs
       that are really cabinets (533-V20-GW-BNK et al): their trailing
       token is a hardware finish, so they carry no top_finish. */
    const ASSEMBLED_TYPES = ['Vanity', 'Console', 'Countertop Unit',
                             'Storage Cabinet', 'Drawer Unit'];
    const AT_SQL = ASSEMBLED_TYPES.map(t => `'${t.replace(/'/g, "''")}'`).join(',');
    const NOT_A_COMBO =
      `NOT (d.top_finish IS NOT NULL AND d.top_finish <> '' AND d.product_type IN (${AT_SQL}))`;

    const NOT_A_SAMPLE = `(d.product_type NOT LIKE 'Sample - %')`;

    // Scope: narrow is Cabinet+Top; "all" is every type, combos and samples
    // still excluded by the two predicates above.
    const SCOPE_SQL = scope === 'all' ? '1=1' : `d.product_type IN ('Cabinet','Top')`;

    /* PRICE — resolved per SKU per DAY, definition §4:
         1. that day's MAP
         2. that day's MSRP x 0.66      (jmv_snapshots.msrp, migration 017)
         3. current products.compare_price x 0.66   (retroactive fallback)
         4. otherwise the row is EXCLUDED from revenue AND units

       0.66 is JM's own back-calc, derived at import from 4,761 products
       carrying both values. Defined in importJamesMartinFeed.js — this is the
       one place it is repeated, and it is repeated in SQL because the
       arithmetic has to happen in the query.

       Previously every row was priced from the LATEST snapshot, so a MAP
       change was applied retroactively across the whole window, and an
       unpriced SKU contributed units at $0 via COALESCE(...,0) — inflating
       Units Depleted while adding nothing to revenue, silently. */
    const UNIT_PRICE = `COALESCE(sd.map_price, sd.msrp * ${MSRP_TO_MAP}, pr.compare_price * ${MSRP_TO_MAP})`;

    const BASE_JOIN = `
      FROM jmv_daily_movement m
      JOIN jmv_dimensions d  ON d.sku = m.sku
      LEFT JOIN jmv_snapshots sd ON sd.sku = m.sku AND sd.snapshot_date = m.movement_date
      LEFT JOIN products pr      ON pr.sku = m.sku`;

    const BASE_WHERE = `
      WHERE m.is_valid = 1
        AND m.movement_date BETWEEN ? AND ?
        AND ${SCOPE_SQL}
        AND ${NOT_A_COMBO}
        AND ${NOT_A_SAMPLE}
        AND ${UNIT_PRICE} IS NOT NULL`;

    /* Every figure on the page reads from this one derived table, so a card
       and the chart beside it cannot end up on different bases. */
    const PRICED = `
      SELECT m.sku, m.movement_date, m.span_days,
             d.collection, d.base_finish, d.size_nominal,
             d.product_type, d.group_number,
             m.demand_min                    AS units,
             m.demand_min * ${UNIT_PRICE}    AS revenue
      ${BASE_JOIN} ${BASE_WHERE}`;
    const PP = [fromDate, toDate];

    /* Money we could not price at all — surfaced, not swallowed. */
    const unpriced = await safeQueryOne(
      `SELECT COUNT(DISTINCT m.sku) AS skus, SUM(m.demand_min) AS units
       ${BASE_JOIN}
       WHERE m.is_valid = 1
         AND m.movement_date BETWEEN ? AND ?
         AND ${SCOPE_SQL} AND ${NOT_A_COMBO} AND ${NOT_A_SAMPLE}
         AND ${UNIT_PRICE} IS NULL`, [fromDate, toDate]
    );

    // ── VCT KPI totals ───────────────────────────────────────────────
    const kpiVCT = await safeQueryOne(
      `SELECT ROUND(SUM(g.revenue),0) AS map_revenue, SUM(g.units) AS qty_sold
       FROM (${PRICED}) g`, PP
    );

    // ── Revenue by day ───────────────────────────────────────────────
    /* span_days added 2026-09-03 — see migrations/2026-09-03_movement_span_days.sql.
       An observation can cover more than one calendar day, because JM does
       not publish new data every day. Days with no new feed now have NO rows
       at all, so this series simply skips them and the chart gaps rather than
       drawing a false $0. The span comes through so the tooltip can say
       "covers 2 days" instead of reading as a one-day spike. */
    const revenueByDay = await safeQuery(
      `SELECT DATE_FORMAT(g.movement_date,'%Y-%m-%d') AS date,
              ROUND(SUM(g.revenue),0) AS revenue,
              SUM(g.units) AS units,
              MAX(g.span_days) AS span_days
       FROM (${PRICED}) g
       GROUP BY g.movement_date ORDER BY g.movement_date`, PP
    );

    /* ── Days we actually collected ───────────────────────────────────
       ADDED 2026-09-09.

       revenueByDay only has rows for days the feed CHANGED, so the chart
       could not tell three different situations apart:

         a) collected, feed unchanged  → nothing was depleted. A real zero.
         b) never collected (08-31)    → we do not know. A real gap.
         c) outside the collection era → not our window's business.

       Drawing (a) and (b) the same way is what made a closed Labor Day
       weekend look identical to a dead cron. With the collected dates in
       hand the view can draw a $0 bar for (a) and leave (b) blank.

       Validity, not mere presence: a snapshot whose row count failed the
       ±10% gate is not evidence that nothing sold. */
    const collectedDays = await safeQuery(
      `SELECT DATE_FORMAT(snapshot_date,'%Y-%m-%d') AS date
         FROM jmv_snapshot_validity
        WHERE is_valid = 1 AND snapshot_date BETWEEN ? AND ?
        ORDER BY snapshot_date`, [fromDate, toDate]
    );

    // ── Combo vs standalone breakdown ────────────────────────────────
    /* Composition. There is no observable "combo" any more, so this is the
       real split: cabinets, tops, and everything else. */
    const cviBrk = await safeQueryOne(
      `SELECT
         ROUND(SUM(CASE WHEN g.product_type='Cabinet' THEN g.revenue ELSE 0 END),0) AS cabinet_rev,
         SUM(CASE WHEN g.product_type='Cabinet' THEN g.units ELSE 0 END)            AS cabinet_u,
         ROUND(SUM(CASE WHEN g.product_type='Top'     THEN g.revenue ELSE 0 END),0) AS top_rev,
         SUM(CASE WHEN g.product_type='Top'     THEN g.units ELSE 0 END)            AS top_u,
         ROUND(SUM(CASE WHEN g.product_type NOT IN ('Cabinet','Top') THEN g.revenue ELSE 0 END),0) AS other_rev,
         SUM(CASE WHEN g.product_type NOT IN ('Cabinet','Top') THEN g.units ELSE 0 END)            AS other_u
       FROM (${PRICED}) g`, PP
    );

    /* ══════════════════════════════════════════════════════════════════
       DIMENSIONAL CHARTS — no '(none)' buckets. FIXED 2026-09-03.

       Both queries below read COALESCE(<dimension>,'(none)') and grouped by
       it, which manufactured a bucket containing every standalone top, sink
       and accessory in the feed. On charts titled "Revenue by Collection"
       and "By Color / Finish" that bucket ranked FIRST — larger than
       Bellshire, larger than Whitewashed Oak — precisely because it is not a
       collection or a finish. It was the sum of everything that has neither.

       THE RULE, applied here and to be applied to any chart added later:
       a chart keyed on a dimension may only contain rows that HAVE that
       dimension. Tops and sinks have no collection and no base finish, so
       they do not belong on those axes at any size.

       They are not simply discarded. Each excluded total is returned
       alongside so the view can state it as a footnote — money left off a
       chart should be visible, not a silent gap between the chart and the
       KPI above it.

       Tops and sinks have their own analysis: the Tops Demand section on
       the main dashboard, keyed on top_finish, size and material — the
       dimensions they actually have.
    ══════════════════════════════════════════════════════════════════ */

    // ── Revenue by collection ─────────────────────────────────────────
    const revenueByCollection = await safeQuery(
      `SELECT g.collection AS label,
              ROUND(SUM(g.revenue),0) AS revenue,
              SUM(g.units) AS units
       FROM (${PRICED}) g
       WHERE g.collection IS NOT NULL AND g.collection <> ''
       GROUP BY g.collection ORDER BY revenue DESC LIMIT 12`, PP
    );

    const excludedNoCollection = await safeQueryOne(
      `SELECT ROUND(SUM(g.revenue),0) AS revenue, SUM(g.units) AS units
       FROM (${PRICED}) g
       WHERE g.collection IS NULL OR g.collection = ''`, PP
    );

    // ── Revenue by finish ─────────────────────────────────────────────
    const revenueByFinish = await safeQuery(
      `SELECT g.base_finish AS label,
              ROUND(SUM(g.revenue),0) AS revenue,
              SUM(g.units) AS units
       FROM (${PRICED}) g
       WHERE g.base_finish IS NOT NULL AND g.base_finish <> ''
       GROUP BY g.base_finish ORDER BY revenue DESC LIMIT 10`, PP
    );

    const excludedNoFinish = await safeQueryOne(
      `SELECT ROUND(SUM(g.revenue),0) AS revenue, SUM(g.units) AS units
       FROM (${PRICED}) g
       WHERE g.base_finish IS NULL OR g.base_finish = ''`, PP
    );

    // ── Top 10 groups by revenue (conservative dedup) ─────────────────
    /* FIXED 2026-09-03 — the sweep missed this table, and how it missed it
       matters more than the fix.

       The sweep checker looked for `GROUP BY <dimension>`. This groups by
       group_number and only DISPLAYS collection and base_finish, so it went
       straight through a gate written to catch exactly this problem.

       The symptom: row 1 read '— / — / 84.0"' with 467 TOP-ONLY units and
       $1.34M — a bucket of standalone tops ranked above every vanity family
       on a table titled "Top 10 Groups". Standalone tops do share a
       group_number, so they collapse into one pseudo-group that then wins on
       aggregate size rather than on being a model.

       Excluded, on the same rule as everywhere else: this table ranks MODEL
       FAMILIES, and a set of collection-less tops is not one. They are
       covered SKU-by-SKU in the Tops Demand section, which is the right
       granularity for them.

       The gate is now written against the RENDERED IDENTITY of a row, not
       just the GROUP BY clause — a display column that can be NULL is the
       thing that produces a dash where a name belongs. */
    const top10Revenue = await safeQuery(
      `SELECT g.group_number,
              MAX(g.collection)   AS collection,
              MAX(g.base_finish)  AS base_finish,
              MAX(g.size_nominal) AS size_nominal,
              SUM(CASE WHEN g.product_type='Cabinet' THEN g.units ELSE 0 END) AS net_cabinet,
              SUM(CASE WHEN g.product_type='Top'     THEN g.units ELSE 0 END) AS net_top,
              ROUND(SUM(g.revenue),0)                       AS revenue,
              SUM(g.units)                                  AS units
       FROM (${PRICED}) g
       WHERE g.collection IS NOT NULL AND g.collection <> ''
       GROUP BY g.group_number
       ORDER BY revenue DESC LIMIT 10`, PP
    );

    // ── By-category array ─────────────────────────────────────────────
    const revenueByCategory = [
      { label: 'Cabinet', revenue: cviBrk?.cabinet_rev || 0, units: cviBrk?.cabinet_u || 0 },
      { label: 'Top',     revenue: cviBrk?.top_rev     || 0, units: cviBrk?.top_u     || 0 },
      { label: 'Other',   revenue: cviBrk?.other_rev   || 0, units: cviBrk?.other_u   || 0 },
    ].filter(r => r.revenue > 0);

    /* ── "all" scope ─────────────────────────────────────────────────
       REMOVED 2026-09-10. The scope used to be bolted on here as a second,
       separately-priced query whose results were merged into the first. That
       is now handled inside PRICED by SCOPE_SQL, so every type is on one
       basis and there is nothing to merge.

       Two bugs died with it. The old OTHER_TYPES list included 'Console' —
       a combo type, all 17 of which carry a top_finish — so "all types" was
       quietly adding combo revenue back after the main query excluded it.
       And it priced with COALESCE(map_price, 0), booking unpriceable SKUs as
       units at $0 while the main query did something different.

       These stay declared and empty: the merge helpers and the render block
       below still reference them, and a scope toggle that silently changed
       shape mid-refactor is how the last set of defects got in. */
    const extraRevenue = 0, extraUnits = 0;
    const extraByCollection = [], extraByFinish = [], extraByCat = [];

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

    /* ══════════════════════════════════════════════════════════════════
       ROLLING REVENUE KPIs — added 2026-09-09
       ──────────────────────────────────────────────────────────────────
       Four cards: average revenue per day over 30 / 15 / 7 days, and the
       revenue of the last reported day.

       ANCHORED ON latestDate, NOT on the page's from/to selector. These
       answer "what is the run rate right now", so narrowing the date range
       to inspect a past period must not move them. Same PIVOT and the same
       conservative-floor REV expression as every other number on the page,
       so the cards and the chart can never disagree.

       THE DENOMINATOR IS DAYS OF HISTORY ACTUALLY AVAILABLE, not the
       nominal window. Decided 2026-09-09. With ~17 days of history a
       30-day card that divides by 30 reads roughly half the true daily
       rate, and nothing on screen explains why — so each card states its
       own denominator: "$X/day over 17 days". Once history passes 30 days
       it becomes a true 30-day average with no code change.

       span_days is the unit of the denominator, not row count. JM does not
       publish every day; one observation can cover two calendar days and
       carries two days of revenue, so it must contribute two days of
       divisor. Counting rows would inflate the average on every gap.
    ══════════════════════════════════════════════════════════════════ */
    const _asDate = (v) => { const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
    const _iso    = (d) => d.toISOString().slice(0, 10);
    const latestDt = _asDate(latestDate);

    let rollRows = [];
    if (latestDt) {
      const from30 = new Date(latestDt); from30.setDate(from30.getDate() - 29);
      const from30Str = _iso(from30);

      /* Same PRICED basis as the MAP Revenue card these sit beside, so the
         run rate and the total can never quietly disagree. The old code ran a
         second query for the "all" scope and merged it by date; PRICED already
         carries every type, so that merge is gone. */
      rollRows = await safeQuery(
        `SELECT DATE_FORMAT(g.movement_date,'%Y-%m-%d') AS date,
                ROUND(SUM(g.revenue),0) AS revenue,
                MAX(g.span_days) AS span_days
         FROM (${PRICED}) g
         GROUP BY g.movement_date
         ORDER BY g.movement_date DESC`,
        [from30Str, latestDate]
      );
    }

    /* n = nominal window. Returns the window's total, the days of history
       it actually covers, and the per-day average over those days. */
    const rollingAvg = (n) => {
      if (!latestDt || !rollRows.length) return { total: 0, days: 0, avg: 0 };
      const cut = new Date(latestDt); cut.setDate(cut.getDate() - (n - 1));
      const cutStr = _iso(cut);
      const rows = rollRows.filter(r => String(r.date) >= cutStr);
      const total = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);
      /* Capped at n: the oldest observation's span can reach back before
         the window opens, which would otherwise divide by more days than
         the card claims to cover. */
      const days = Math.min(n, rows.reduce((s, r) => s + Number(r.span_days || 1), 0));
      return { total, days, avg: days ? total / days : 0 };
    };

    const rev30 = rollingAvg(30);
    const rev15 = rollingAvg(15);
    const rev7  = rollingAvg(7);
    /* Last REPORTED day, not literally the last 24 hours — if JM published
       nothing yesterday the newest row may be older than that. The card
       renders its date so the distinction is visible rather than assumed. */
    const rev24     = Number(rollRows[0]?.revenue || 0);
    const rev24Date = rollRows[0]?.date || null;

    // ── Final KPI totals ─────────────────────────────────────────────
    const mapRevenue   = Number(kpiVCT?.map_revenue || 0) + extraRevenue;
    const qtySold      = Number(kpiVCT?.qty_sold    || 0) + extraUnits;
    /* Composition. The old pair was "Combo (Vanity)" vs "Individual SKU" —
       a split that cannot exist now that the combo SKU is not counted.
       Cabinet / Top / Other is the real composition of what depleted. */
    const cabinetRevenue = Number(cviBrk?.cabinet_rev || 0);
    const cabinetUnits   = Number(cviBrk?.cabinet_u   || 0);
    const topRevenue     = Number(cviBrk?.top_rev     || 0);
    const topUnits       = Number(cviBrk?.top_u       || 0);
    const otherRevenue   = Number(cviBrk?.other_rev   || 0);
    const otherUnits     = Number(cviBrk?.other_u     || 0);

    /* Depletion we could not price. Definition §4 rule 4 drops it from BOTH
       revenue and units rather than booking units at $0, so it is surfaced
       here instead of becoming a silent gap between the two cards. */
    const unpricedSkus  = Number(unpriced?.skus  || 0);
    const unpricedUnits = Number(unpriced?.units || 0);

    const comboVsIndividual = [
      { label: 'Cabinet', revenue: cabinetRevenue, units: cabinetUnits },
      { label: 'Top',     revenue: topRevenue,     units: topUnits     },
      { label: 'Other',   revenue: otherRevenue,   units: otherUnits   },
    ].filter(r => r.revenue > 0);

    res.render('pages/admin/marketing/jmv-financials', {
      ...LAYOUT,
      pageTitle: 'JMV Financials',
      fromDate, toDate, scope, latestDate,
      mapRevenue, qtySold,
      // Rolling revenue cards — see the ROLLING REVENUE KPIs block above.
      rev30, rev15, rev7, rev24, rev24Date,
      cabinetRevenue, cabinetUnits, topRevenue, topUnits,
      otherRevenue, otherUnits, unpricedSkus, unpricedUnits,
      top10Revenue,
      revenueByDay:        JSON.stringify(revenueByDay),
      collectedDays:       JSON.stringify(collectedDays.map(r => r.date)),
      revenueByCategory:   JSON.stringify([...revenueByCategory, ...extraByCat]),
      revenueByCollection: JSON.stringify(mergeByLabel(revenueByCollection, extraByCollection).slice(0, 12)),
      revenueByFinish:     JSON.stringify(mergeByLabel(revenueByFinish, extraByFinish).slice(0, 10)),
      /* What the two dimensional charts above deliberately leave out —
         tops, sinks and accessories that have no collection / no base
         finish. Rendered as a footnote on each card so the difference
         between these charts and the KPI totals is stated rather than left
         as an unexplained gap. */
      excludedNoCollectionRev:   Number(excludedNoCollection?.revenue || 0),
      excludedNoCollectionUnits: Number(excludedNoCollection?.units   || 0),
      excludedNoFinishRev:       Number(excludedNoFinish?.revenue     || 0),
      excludedNoFinishUnits:     Number(excludedNoFinish?.units       || 0),
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
      rev30: { total:0, days:0, avg:0 }, rev15: { total:0, days:0, avg:0 },
      rev7:  { total:0, days:0, avg:0 }, rev24: 0, rev24Date: null,
      cabinetRevenue: 0, cabinetUnits: 0, topRevenue: 0, topUnits: 0,
      otherRevenue: 0, otherUnits: 0, unpricedSkus: 0, unpricedUnits: 0,
      top10Revenue: [],
      revenueByDay: '[]', collectedDays: '[]', revenueByCategory: '[]',
      revenueByCollection: '[]', revenueByFinish: '[]',
      // Footnote figures — the cards read these unconditionally, so an error
      // path that omits them turns a handled 500 into a template crash.
      excludedNoCollectionRev: 0, excludedNoCollectionUnits: 0,
      excludedNoFinishRev: 0, excludedNoFinishUnits: 0,
      comboVsIndividual: '[]',
      style: '',
    });
  }
}

module.exports = { dashboard, triggerRollup, stockoutDrilldown, newArrivalsDrilldown, getFinancials };
