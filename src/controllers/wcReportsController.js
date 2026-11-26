'use strict';

/**
 * wcReportsController.js
 * WC Inventory Analysis — admin reporting layer over the Water Creation
 * daily inventory feed.
 *
 * DELIBERATELY MIRRORS jmvReportsController.js. Same three-hazard discipline,
 * same source-note requirement, same "observed drawdown" vocabulary. Read that
 * file before changing the shape of this one.
 *
 * THREE HAZARDS, AS THEY APPLY HERE:
 *
 *  1. DEDUPLICATION: MAX(demand_min) per base_sku per day, NEVER SUM.
 *     WC publishes one cabinet as many SKUs, one per mirror/faucet
 *     permutation, all drawing on one stock pool. Measured on real snapshots:
 *       2026-11-23  1,301 SKUs →  244 bases   SUM 33,713 vs MAX 8,871  = 3.80x
 *       2025-06-16  1,555 SKUs →  249 bases   SUM 25,119 vs MAX 6,066  = 4.14x
 *       2022-03-01  1,766 SKUs →  227 bases   SUM 46,388 vs MAX 7,737  = 6.00x
 *     SUM is not slightly wrong, it is 4–6x wrong.
 *
 *     Note the contrast with JMV: there, DEDUPED_INNER groups by twelve
 *     columns and so collapses at VARIANT level, running high on purpose.
 *     Here the collapse is a TRUE base collapse, and it is safe to also group
 *     by collection / colour / size / top, because every one of those is a
 *     property of the base SKU — they cannot split a base into two rows.
 *     Mirror and faucet are the only config-level attributes. See §ATTACH.
 *
 *  2. METRIC LABEL: "observed drawdown (minimum demand)" — NEVER "units sold".
 *
 *  3. FEED-GAP EXCLUSION: is_valid = 1 only. Rates are per OBSERVED day, using
 *     span_days, never per calendar day.
 *
 * SOURCE NOTE required on every chart and table:
 *   "Water Creation national wholesale shipments — not BVO sales, not RFL sales."
 *
 * NO PRICING ON THE WC SIDE. Units only (Sam, 2026-11-24). There is no price
 * column in wc_snapshots and no WC revenue figure anywhere in this file. Do
 * not add one.
 *
 *   AMENDED 2026-11-26 (Sam): one price constant now exists, RFL_UNIT_PRICE,
 *   and it is NOT a WC price. It is the divisor that converts RFL showroom
 *   DOLLARS into an approximate unit count so the RFL line can share an axis
 *   with the WC drawdown line. The rule above is unchanged in substance: no
 *   WC SKU carries a price here, and no figure on this page is WC revenue.
 *
 * Admin routes:
 *   GET  /admin/marketing/wc            — main dashboard
 *   POST /admin/marketing/wc/run-rollup — trigger the ingestion/rollup job
 */

const { bvoPool } = require('../config/database');
const { runRollup, getSnapshotStatus, describeSnapshotsDir } = require('../jobs/wcMovementRollup');

const LAYOUT = { layout: 'layouts/admin' };

/* Default trailing window for the "recent" cards, in days. */
const DEFAULT_WINDOW = 90;

/* ─────────────────────────────────────────────────────────────────────
   RFL OVERLAY — dollars → approximate units

   RFL reports dollars; the WC series is units. To put them on one axis the
   RFL dollars are divided by an average selling price per vanity. ONE
   constant, here, so retuning it is a one-line change and never a data
   migration.

   $1,000 — RFL's OWN AVERAGE TICKET across the 4.5 years of sales data in
   scope (Sam, 2026-11-26). This is the right kind of number for the job: it
   is what RFL actually transacts at, measured over the whole span the chart
   covers, so the proxy is anchored to the business rather than to a
   reference price.

   IT REPLACED $1,430, AND THE REASON MATTERS. That figure came from Home
   Depot retail on base configurations of the three best-selling collections
   (Palace ~$1,948, Madison ~$1,144, Queen ~$1,200). HD list is a retail
   reference and RFL discounts off it, so dividing RFL dollars by HD list
   understated units by roughly 30%. Observed ticket beats inferred list;
   do not re-derive this from published retail prices.

   ⚠️ ONE THING THIS CONSTANT IS NOT: preferred over real data. Per-row
   `units` in rfl_monthly_sales always wins — the proxy is a fallback, not a
   preference. See the COALESCE in cards.rflSeries. Supplying a true unit
   count for a month retires the divisor entirely for that month.

   If the ticket is ever found to differ materially between the GVS Shopify
   era and the RFLPOS era, this becomes a per-source lookup and the division
   moves inside the SUM. It is a single number today because one number is
   what the evidence supports.

   Non-vanity categories (tile, flooring, faucets) stay in the dollar figure.
   Sam, 2026-11-26: they have always run under 10% of revenue. They move the
   level slightly; they do not move the shape, and the shape is what the
   chart is read for.
───────────────────────────────────────────────────────────────────── */
const RFL_UNIT_PRICE = 1000;

/* ─────────────────────────────────────────────────────────────────────
   NON-RETAIL EVENT CAPS

   WC's feed records inventory leaving the warehouse. Nearly all of that is
   dealer demand, which is what this page measures. Occasionally it is not —
   a liquidation, a catalogue purge, a bulk transfer — and a single day of it
   swamps the trend.

   MEASURED, 2026-11-26. Top days by units-per-moving-model across the whole
   archive (vanity scope):
       2025-08-25   5,832 units over  62 models   94.1 per model
       2024-07-09   1,885 units over 121 models   15.6 per model
       2021-09-06   1,877 units over 135 models   13.9 per model
       a busy normal day                          ~5   per model
   2025-08-25 is six times worse than the next worst day in five years. Sam
   identified it as a WC liquidation: not retail business (2026-11-26).
   Uncapped it adds ~16 units/day to the 2025 annual average on its own and
   is most of the reason 2025 read HIGHER than 2024 and 2026, which is the
   opposite of what the business did.

   WHAT THIS IS NOT. It is not a general outlier filter. Trimming whatever
   looks too big is how a chart gets quietly shaped into the story someone
   expected. This is an explicit, dated list of events identified by name,
   and every capped day is printed on the page with its original figure, so
   the adjustment is visible rather than silent. Adding a row here is a
   deliberate act that should carry a reason.

   2024-07-09 is deliberately NOT capped yet: it is the day the feed changed
   schema (legacy → modern), so it is more likely a parsing artifact than an
   event, and that deserves investigating rather than hiding.
───────────────────────────────────────────────────────────────────── */
const WC_EVENT_CAPS = [
  { from: '2025-08-17', to: '2025-09-07',
    note: 'WC liquidation — not retail demand (Sam, 2026-11-26)' },
];

/* The trigger is UNITS PER MOVING MODEL, not total units for the day.
   That distinction is the whole correctness of this feature. A flat
   units-per-day cap over the window also caught 2025-08-29 — 279 units,
   but spread across 103 models, i.e. 2.7 each, an ordinary busy day. Only
   the per-model figure separates "a lot of models moved" from "a few models
   dumped a warehouse":
       2025-08-25   62 models, 94.1 units each   <- the event
       2025-08-29  103 models,  2.7 units each   <- a normal day
   TRIGGER is set well above the busiest normal day ever observed (15.6, and
   that one is the feed's schema-change date), so an ordinary peak cannot
   trip it. A tripped day is rescaled to the typical per-model rate, which
   puts 2025-08-25 at 62 x 1.5 = 93 units — in line with its neighbours. */
const WC_CAP_TRIGGER_PER_MODEL = 6.0;
const WC_CAP_RESCALE_PER_MODEL = 1.5;

/** Apply the caps to a [{d, units, span, models}] series. {rows, capped}. */
function applyEventCaps(rows) {
  const capped = [];
  const out = rows.map(r => {
    const hit = WC_EVENT_CAPS.find(c => r.d >= c.from && r.d <= c.to);
    const models = Number(r.models) || 0;
    const units  = Number(r.units)  || 0;
    if (!hit || !models) return r;
    const perModel = units / models;
    if (perModel <= WC_CAP_TRIGGER_PER_MODEL) return r;   // a busy day, not an event
    const now = Math.round(models * WC_CAP_RESCALE_PER_MODEL);
    capped.push({ d: r.d, was: units, now, models,
                  perModel: Math.round(perModel * 10) / 10, note: hit.note });
    return { ...r, units: now };
  });
  return { rows: out, capped };
}

/* ─────────────────────────────────────────────────────────────────────
   PRODUCT SCOPE

   The WC feed is NOT all bathroom vanities. Across the archive:
     vanity 1,212 · faucet 393 · kitchen_sink 197 · washstand 165 ·
     accessory 53 · cabinet 22 · mirror 12 · furniture 1

   A third of the current feed is faucets and accessories, and the 2021 feed
   carried 197 KITCHEN sinks and a coffee table. Reporting "WC demand" across
   all of that answers nothing. Sam's scope (2026-11-25): bathroom vanities,
   with wash stands as a separate family excluded by default.

   ⚠️ There is no separate vanity-TOP family, and there never will be: the top
   is part of the vanity SKU. "Tops" is a DIMENSION (top_material,
   top_finish) cut within family='vanity', never a scope of its own.
───────────────────────────────────────────────────────────────────── */
const SCOPES = {
  vanity:     { label: 'Vanities',               families: ['vanity'] },
  vanity_ws:  { label: 'Vanities + wash stands', families: ['vanity', 'washstand'] },
  washstand:  { label: 'Wash stands only',       families: ['washstand'] },
  all:        { label: 'All families',           families: null },
};
const DEFAULT_SCOPE = 'vanity';

/** Build the SQL fragment + params that restrict a query to the chosen scope. */
function scopeClause(scopeKey) {
  const scope = SCOPES[scopeKey] || SCOPES[DEFAULT_SCOPE];
  if (!scope.families) return { sql: '', params: [] };
  return {
    sql: ` AND d.product_family IN (${scope.families.map(() => '?').join(',')})`,
    params: scope.families.slice(),
  };
}

/* ─────────────────────────────────────────────────────────────────────
   THE DEDUPE
   One row per (movement_date, base_sku) carrying the base's drawdown and its
   attributes. Every model/collection/colour/size/top card reads from this.
───────────────────────────────────────────────────────────────────── */
const DEDUPED_BASE = (whereExtra = '', scopeSql = '') => `
  SELECT m.movement_date,
         d.base_sku,
         MAX(d.collection)    AS collection,
         MAX(d.cabinet_color) AS cabinet_color,
         MAX(d.size_nominal)  AS size_nominal,
         MAX(d.top_material)  AS top_material,
         MAX(d.top_finish)    AS top_finish,
         MAX(d.sinks)         AS sinks,
         MAX(d.mounting)      AS mounting,
         MAX(d.product_name)  AS product_name,
         MAX(m.span_days)     AS span_days,
         MAX(m.demand_min)    AS base_drawdown
    FROM wc_daily_movement m
    JOIN wc_dimensions     d ON d.sku = m.sku
   WHERE m.is_valid = 1
     AND m.demand_min > 0
     ${scopeSql}
     ${whereExtra}
   GROUP BY m.movement_date, d.base_sku
`;

const q = async (sql, params = []) => {
  const [rows] = await bvoPool.query(sql, params);
  return rows;
};

/* Safe wrapper — one failing card must not blank the whole dashboard.
   The JMV build learned this when an optional enhancement took the page down
   with it. A card that cannot load says so; the rest still render. */
async function card(name, fn) {
  try { return { name, rows: await fn(), error: null }; }
  catch (err) {
    console.error(`[wc-reports] card "${name}" failed:`, err.sqlMessage || err.message);
    return { name, rows: [], error: err.sqlMessage || err.message };
  }
}

async function dashboard(req, res) {
  try {
    const windowDays = Math.max(7, Math.min(3650, parseInt(req.query.days, 10) || DEFAULT_WINDOW));
    const scopeKey   = SCOPES[req.query.scope] ? req.query.scope : DEFAULT_SCOPE;
    const SC         = scopeClause(scopeKey);

    const status = await getSnapshotStatus().catch(() => null);

    /* Nothing ingested yet — render the empty state with instructions rather
       than a wall of zero cards that look like real findings. */
    if (!status || !Number(status.days)) {
      return res.render('pages/admin/marketing/wc-inventory-analysis', {
        ...LAYOUT,
        pageTitle: 'WC Inventory Analysis',
        path: req.originalUrl,
        empty: true,
        status: status || {},
        windowDays, scopeKey, scopes: SCOPES, families: [],
        cards: {}, coverage: {}, trend: [], seasonality: [],
      });
    }

    const lastDate = status.last_date;

    /* ── Coverage. Shown at the top of the page, always, because every
       attribute cut below is only as complete as this. ───────────────── */
    const [cov] = await q(
      `SELECT COUNT(*)                                            AS skus,
              COUNT(DISTINCT base_sku)                            AS bases,
              SUM(attr_source IS NOT NULL)                        AS described,
              SUM(cabinet_color IS NOT NULL AND cabinet_color<>'')AS with_colour,
              SUM(top_material  IS NOT NULL AND top_material <>'')AS with_top,
              SUM(size_nominal  IS NOT NULL)                      AS with_size,
              SUM(collection    IS NOT NULL AND collection   <>'')AS with_collection,
              SUM(carried_sku   IS NOT NULL)                      AS carried
         FROM wc_dimensions d
        WHERE 1=1${SC.sql}`, SC.params
    );

    /* Family census — always across ALL families, never scoped. This is what
       tells the reader what the scope is EXCLUDING, and an unclassified count
       here is a new WC product line rather than noise. */
    const families = await q(
      `SELECT COALESCE(product_family,'unclassified') AS family,
              COUNT(*) AS skus, COUNT(DISTINCT base_sku) AS models
         FROM wc_dimensions
        GROUP BY product_family
        ORDER BY skus DESC`
    ).catch(() => []);

    const coverage = {
      ...cov,
      undescribed:      Number(cov.skus) - Number(cov.described || 0),
      colour_pct:     cov.skus ? (100 * Number(cov.with_colour)     / Number(cov.skus)) : 0,
      top_pct:        cov.skus ? (100 * Number(cov.with_top)        / Number(cov.skus)) : 0,
      size_pct:       cov.skus ? (100 * Number(cov.with_size)       / Number(cov.skus)) : 0,
      collection_pct: cov.skus ? (100 * Number(cov.with_collection) / Number(cov.skus)) : 0,
    };

    const W = `AND m.movement_date >= DATE_SUB(?, INTERVAL ? DAY)`;
    /* Param order must mirror fragment order inside DEDUPED_BASE: the scope
       IN(...) placeholders come before the date window. Getting this backwards
       silently filters on the wrong values rather than erroring. */
    const WP = [...SC.params, lastDate, windowDays];

    /* ── ROW 1 — ALERT STRIP ───────────────────────────────────────────
       Reads the latest snapshot only. A SKU at zero WITH an ETA is a wait;
       one WITHOUT an ETA is an unknown, and that is the list worth looking
       at. Deduped to base so "47 out of stock" means 47 cabinets, not 47
       option permutations of a dozen cabinets. */
    const cards = {};

    cards.stockouts = await card('stockouts', () => q(
      `SELECT d.base_sku,
              MAX(d.collection)   AS collection,
              MAX(d.product_name) AS product_name,
              MAX(d.cabinet_color)AS cabinet_color,
              MAX(d.size_nominal) AS size_nominal,
              MAX(CASE WHEN s.available_date IS NULL OR s.available_date=''
                       THEN 0 ELSE 1 END) AS has_eta,
              MAX(s.available_date) AS eta
         FROM wc_snapshots  s
         JOIN wc_dimensions d ON d.sku = s.sku
        WHERE s.snapshot_date = ? AND s.qty = 0${SC.sql}
        GROUP BY d.base_sku
        HAVING MAX(s.qty) = 0
        ORDER BY has_eta ASC, collection ASC
        LIMIT 200`, [lastDate, ...SC.params]));

    cards.stockoutSummary = await card('stockoutSummary', () => q(
      `SELECT COUNT(*) AS bases_out,
              SUM(has_eta = 0) AS no_eta,
              SUM(has_eta = 1) AS with_eta
         FROM (
           SELECT d.base_sku,
                  MAX(CASE WHEN s.available_date IS NULL OR s.available_date=''
                           THEN 0 ELSE 1 END) AS has_eta
             FROM wc_snapshots s
             JOIN wc_dimensions d ON d.sku = s.sku
            WHERE s.snapshot_date = ? AND s.qty = 0${SC.sql}
            GROUP BY d.base_sku
            HAVING MAX(s.qty) = 0
         ) t`, [lastDate, ...SC.params]));

    /* ── ROW 2 — HEADLINE MOVERS (trailing window) ─────────────────── */
    cards.topCollections = await card('topCollections', () => q(
      `SELECT gd.collection,
              SUM(gd.base_drawdown)                       AS drawdown,
              COUNT(DISTINCT gd.base_sku)                 AS models,
              COUNT(DISTINCT gd.movement_date)            AS observed_days,
              ROUND(SUM(gd.base_drawdown)
                    / NULLIF(SUM(gd.span_days),0), 1)     AS units_per_day
         FROM (${DEDUPED_BASE(W, SC.sql)}) gd
        WHERE gd.collection IS NOT NULL AND gd.collection <> ''
        GROUP BY gd.collection
        ORDER BY drawdown DESC LIMIT 20`, WP));

    cards.topModels = await card('topModels', () => q(
      `SELECT gd.base_sku,
              MAX(gd.collection)    AS collection,
              MAX(gd.product_name)  AS product_name,
              MAX(gd.cabinet_color) AS cabinet_color,
              MAX(gd.size_nominal)  AS size_nominal,
              SUM(gd.base_drawdown) AS drawdown,
              ROUND(SUM(gd.base_drawdown)
                    / NULLIF(SUM(gd.span_days),0), 1) AS units_per_day
         FROM (${DEDUPED_BASE(W, SC.sql)}) gd
        GROUP BY gd.base_sku
        ORDER BY drawdown DESC LIMIT 50`, WP));

    /* ── ROW 3 — DIMENSION BREAKDOWNS ──────────────────────────────────
       Each of these is only as complete as `coverage` says. The view MUST
       render the undescribed count beside them. A card covering a fifth of
       the catalogue while looking whole is worse than no card. */
    const byDim = (col) => q(
      `SELECT gd.${col} AS label,
              SUM(gd.base_drawdown)       AS drawdown,
              COUNT(DISTINCT gd.base_sku) AS models
         FROM (${DEDUPED_BASE(W, SC.sql)}) gd
        WHERE gd.${col} IS NOT NULL AND gd.${col} <> ''
        GROUP BY gd.${col}
        ORDER BY drawdown DESC LIMIT 25`, WP);

    cards.byColour     = await card('byColour',     () => byDim('cabinet_color'));
    cards.bySize       = await card('bySize',       () => byDim('size_nominal'));
    cards.byTopMaterial= await card('byTopMaterial',() => byDim('top_material'));
    /* No byTopFinish / byMounting cards — removed 2026-11-25. Neither
       attribute can be sourced honestly (top finish is not derivable from
       the SKU code; "Installation Type" in the supplier catalogue is a
       FAUCET attribute, not the vanity's). The columns remain in
       wc_dimensions so a future product-data export can fill them without a
       migration. Full reasoning in the view. Querying them here would just
       pay for two round trips that return nothing. */
    cards.bySinks      = await card('bySinks',      () => byDim('sinks'));

    cards.collectionBySize = await card('collectionBySize', () => q(
      `SELECT gd.collection, gd.size_nominal,
              SUM(gd.base_drawdown) AS drawdown
         FROM (${DEDUPED_BASE(W, SC.sql)}) gd
        WHERE gd.collection IS NOT NULL AND gd.collection <> ''
          AND gd.size_nominal IS NOT NULL
        GROUP BY gd.collection, gd.size_nominal
        ORDER BY drawdown DESC LIMIT 100`, WP));

    /* ── ONBOARDING PRIORITY ───────────────────────────────────────────
       BVO carries no Water Creation at all today, so every row here is
       "not carried" and the list IS the assortment question: what is moving
       nationally that we do not stock. Fills in by itself as SKUs are
       onboarded — carried_sku is resolved by the rollup, not by hand. */
    cards.onboarding = await card('onboarding', () => q(
      `SELECT gd.base_sku,
              MAX(gd.collection)    AS collection,
              MAX(gd.product_name)  AS product_name,
              MAX(gd.cabinet_color) AS cabinet_color,
              MAX(gd.size_nominal)  AS size_nominal,
              SUM(gd.base_drawdown) AS drawdown
         FROM (${DEDUPED_BASE(W, SC.sql)}) gd
         LEFT JOIN wc_dimensions c
                ON c.base_sku = gd.base_sku AND c.carried_sku IS NOT NULL
        WHERE c.base_sku IS NULL
        GROUP BY gd.base_sku
        ORDER BY drawdown DESC LIMIT 50`, WP));

    /* ── TREND — monthly units/day, one series per year ────────────────
       Rates, not sums, so a short or sparsely-observed month is not read as
       a weak one. observed_days is carried through so the view can show it. */
    /* ── DAILY SERIES — the interactive trend chart ────────────────────
     *
     * One row per observed movement date, for the WHOLE history. The browser
     * re-buckets it to day / week / month / quarter / year and overlays a
     * comparison period, so changing granularity or period costs no round
     * trip. ~1,460 rows at 2026-11; three small numbers each, so the payload
     * is tens of KB, not megabytes.
     *
     * ⚠️ WHY span_days TRAVELS WITH EVERY ROW, AND WHY THE CHART DIVIDES BY IT
     * This series is NOT one row per calendar day. The feed skips days, and
     * 157 of 1,627 adjacent pairs are non-consecutive, so a single
     * observation can cover several days — that is what span_days records.
     * Summing raw units per bucket therefore makes a sparsely-observed period
     * look weak and a densely-observed one look strong, and in a
     * year-over-year comparison that error lands squarely on the number
     * someone is about to act on.
     *
     * So the unit of this chart is ALWAYS units ÷ observed days, where
     * observed days is SUM(span_days) for the bucket. Never plot the raw sum.
     *
     * SCOPE-FILTERED, and that is load-bearing. SC.sql carries the family
     * restriction into DEDUPED_BASE, so at the default scope this series is
     * VANITY CABINETS ONLY. The WC feed is not all vanities — across the
     * archive it also holds 393 faucets, 197 kitchen sinks, 165 wash stands,
     * 53 accessories, 12 mirrors and a coffee table. A chart summing all of
     * that would not be comparable to RFL vanity sales, or to anything else.
     *
     * ONE UNIT ON THIS LINE = ONE CABINET, AND ITS TOP CAME WITH IT. WC
     * publishes the vanity and top as one combo SKU, so there is no separate
     * top family and never will be (see §PRODUCT SCOPE). base_sku then
     * collapses the mirror and faucet permutations onto the single cabinet
     * they all draw stock from, via MAX per base per day — so a cabinet that
     * went out as a combo SKU with a mirror and/or faucet included counts
     * once, same as a bare one. Not double-counted, not dropped.
     *
     * WHICH IS WHY THE DIVISOR IS A BLENDED TICKET, NOT A CABINET PRICE.
     * Those combo SKUs sell for more than the bare cabinet, and RFL sells a
     * mix of both. $1,000 is the average across that actual mix, which is
     * exactly what it needs to be: dividing blended dollars by a bare-cabinet
     * list price would overstate units. It is also why re-deriving the
     * divisor from a catalogue price is wrong in principle, not just stale.
     *
     * ⚠️ An earlier version of this comment said the series was deliberately
     * NOT scope-filtered. That was true of the first draft and became false
     * when the scopeClause bug below was fixed; it sat here claiming the
     * opposite of the code. Anyone trusting it would have concluded the chart
     * already included faucets and mirrors. Gate §13i now asserts the scope
     * is carried, so the code and this paragraph cannot drift apart again.
     */
    /* ⚠️ scopeClause() returns { sql, params }, NOT a string. Pass SC.sql and
       bind SC.params — exactly as every other card on this page does. The
       first version of this query passed the whole object, which stringified
       to "[object Object]" inside the SQL and failed at parse time. */
    cards.dailySeries = await card('dailySeries', () => q(
      `SELECT DATE_FORMAT(g.movement_date,'%Y-%m-%d') AS d,
              ROUND(SUM(g.base_drawdown))            AS units,
              COUNT(DISTINCT g.base_sku)             AS models,
              GREATEST(COALESCE(MAX(g.span_days),1),1) AS span
         FROM ( ${DEDUPED_BASE('', SC.sql)} ) g
        GROUP BY g.movement_date
        ORDER BY g.movement_date ASC`, [...SC.params]));

    /* Caps applied AFTER the query, not in SQL: the capped days have to be
       reportable, and a LEAST() in the SELECT would silently swallow them.
       cards.cappedDays drives the note under the chart. */
    {
      const capped = applyEventCaps(cards.dailySeries.rows || []);
      if (cards.dailySeries.rows) cards.dailySeries.rows = capped.rows;
      cards.cappedDays = { name: 'cappedDays', rows: capped.capped, error: null };
    }

    /* ── MONTHLY TREND + SEASONALITY, DERIVED FROM THE CAPPED SERIES ───
     *
     * These used to be their own SQL query over the full history. That was
     * wrong in two ways, and Sam's question — "don't we need to patch the
     * table?" — is what surfaced it:
     *
     *   1. UNCAPPED. The event caps applied to the chart only, so the table
     *      under the chart and the seasonality index still carried the
     *      2025-08-25 liquidation. August was reading as the strongest month
     *      of the year partly because of one warehouse dump.
     *   2. A DIFFERENT DIVISOR. The old query divided by
     *      COUNT(DISTINCT movement_date) while the chart divides by
     *      SUM(span_days). In years where the feed skipped days those are not
     *      the same number, so the table and the chart directly above it
     *      disagreed. span_days is the documented-correct divisor (see the
     *      daily series note below), so that is the one kept.
     *
     * Deriving both from cards.dailySeries makes one source of truth: the
     * chart, its table and the seasonal index cannot drift apart again.
     */
    const trend = (() => {
      const byMonth = new Map();
      for (const r of (cards.dailySeries.rows || [])) {
        const yr = Number(r.d.slice(0, 4)), mo = Number(r.d.slice(5, 7));
        const k = yr * 100 + mo;
        if (!byMonth.has(k)) byMonth.set(k, { yr, mo, drawdown: 0, span_total: 0, observed_days: 0 });
        const e = byMonth.get(k);
        e.drawdown      += Number(r.units) || 0;
        e.span_total    += Number(r.span)  || 0;
        e.observed_days += 1;
      }
      return [...byMonth.values()]
        .map(e => ({ ...e, units_per_day: e.span_total
                       ? Math.round(e.drawdown / e.span_total * 10) / 10 : 0 }))
        .sort((a, b) => a.yr - b.yr || a.mo - b.mo);
    })();

    /* ── SEASONALITY — year-normalised so trend cannot contaminate it ──
       Each month is indexed against its OWN year's mean, then averaged across
       years. A raw month-of-year average would just re-report the decline. */
    const seasonality = (() => {
      const byYear = new Map();
      for (const r of trend) {
        if (!byYear.has(r.yr)) byYear.set(r.yr, []);
        byYear.get(r.yr).push(r);
      }
      const idx = new Map();
      for (const [, months] of byYear) {
        if (months.length < 8) continue;        // too few months to normalise
        const mean = months.reduce((s, m) => s + Number(m.units_per_day || 0), 0) / months.length;
        if (!mean) continue;
        for (const m of months) {
          if (!idx.has(m.mo)) idx.set(m.mo, []);
          idx.get(m.mo).push(100 * Number(m.units_per_day || 0) / mean);
        }
      }
      return [...idx.entries()]
        .map(([mo, vals]) => ({
          mo,
          index: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
          years: vals.length,
        }))
        .sort((a, b) => a.mo - b.mo);
    })();


    /* ── RFL overlay series, monthly ───────────────────────────────────
     *
     * Returned as avg units per DAY, matching the WC series exactly, so the
     * two share one axis and one unit. No second axis: a dual axis is free to
     * rescale either line until they appear to track each other, which
     * manufactures a correlation out of nothing. Same unit, same axis, and if
     * the levels are far apart the chart says so honestly.
     *
     * DAY(LAST_DAY(month)) is the day count of that month — the divisor that
     * stops a 31-day month from looking busier than a 28-day one.
     *
     * COALESCE(units, net_sales / price): a real unit count always beats the
     * proxy. The proxy exists because the exports currently carry dollars.
     *
     * Stores are summed, not split: this is a company-level line against a
     * national one. `sources` rides along so the view can mark the
     * gvs_shopify → rflpos seam, which is a system change and not a trend.
     *
     * Table may legitimately not exist yet (migration 032 is applied by
     * hand), so an empty series here is normal, not an error — hence the
     * guarded probe rather than letting card() report a failure.
     */
    cards.rflSeries = await card('rflSeries', async () => {
      const [t] = await q(
        `SELECT COUNT(*) AS n FROM information_schema.tables
          WHERE table_schema = DATABASE() AND table_name = 'rfl_monthly_sales'`);
      if (!Number(t?.n)) return [];
      return q(
        `SELECT DATE_FORMAT(month,'%Y-%m-01')                AS d,
                ROUND(SUM(COALESCE(units, net_sales / ?)), 1) AS units,
                DAY(LAST_DAY(month))                          AS span,
                GROUP_CONCAT(DISTINCT source ORDER BY source) AS sources
           FROM rfl_monthly_sales
          GROUP BY month
          ORDER BY month ASC`, [RFL_UNIT_PRICE]);
    });

    /* ── KPI strip. The four numbers worth reading before scrolling. ──── */
    cards.kpis = await card('kpis', async () => {
      /* WP is the existing binding for exactly this shape:
         [...SC.params, lastDate, windowDays]. Param order follows the SQL
         TEXT, not the argument list — DEDUPED_BASE interpolates ${scopeSql}
         BEFORE ${whereExtra}, so the scope placeholders come first. (The
         stockout queries bind [lastDate, ...SC.params] because their own ?
         sits before SC.sql. Same rule, different sentence.) */
      const [w] = await q(
        `SELECT ROUND(SUM(g.base_drawdown))        AS units,
                COUNT(DISTINCT g.base_sku)         AS models,
                SUM(g.span_days)                   AS days
           FROM ( ${DEDUPED_BASE(W, SC.sql)} ) g`, WP);
      return [{
        units:  Number(w?.units  || 0),
        models: Number(w?.models || 0),
        rate:   w?.days ? Number(w.units) / Number(w.days) : 0,
      }];
    });

    /* ── Snapshot history, for auditing coverage ──────────────────────── */
    cards.history = await card('history', () => q(
      `SELECT DATE_FORMAT(snapshot_date,'%Y-%m-%d') AS d,
              row_count, is_valid, schema_variant, notes
         FROM wc_snapshot_validity
        ORDER BY snapshot_date DESC LIMIT 60`));

    res.render('pages/admin/marketing/wc-inventory-analysis', {
      ...LAYOUT,
      pageTitle: 'WC Inventory Analysis',
      path: req.originalUrl,
      empty: false,
      status, coverage, cards, trend, seasonality, windowDays,
      scopeKey, scopes: SCOPES, families,
    });
  } catch (err) {
    console.error('[wc-reports] dashboard failed:', err);
    res.status(500).render('pages/admin/marketing/wc-inventory-analysis', {
      ...LAYOUT,
      pageTitle: 'WC Inventory Analysis',
      path: req.originalUrl,
      empty: true, fatal: err.sqlMessage || err.message,
      status: {}, coverage: {}, cards: {}, trend: [], seasonality: [], windowDays: DEFAULT_WINDOW,
      scopeKey: DEFAULT_SCOPE, scopes: SCOPES, families: [],
    });
  }
}

/**
 * POST /admin/marketing/wc/run-rollup
 * Ingestion is resumable by design: the job skips any date that already has a
 * validity row, so this can be pressed repeatedly until the backlog clears.
 * With 1,628 snapshots that is expected to take several presses — a single
 * Hostinger process window will not finish it.
 */
async function triggerRollup(req, res) {
  try {
    const includeDimensions = req.body?.dimensions !== 'false';
    const results = await runRollup({ includeDimensions });

    const processed = results.filter(r => r.date && !r.error).length;
    const errors    = results.filter(r => r.error);
    const dims      = results.find(r => r.type === 'dimensions');

    /* Always report what the job could see. When processed is 0 this is the
       difference between "wrong path", "unreadable directory" and "filenames
       do not match" — three causes with identical symptoms from outside. */
    let disk = null;
    try { disk = describeSnapshotsDir(); } catch (e) { disk = { error: e.message }; }

    res.json({
      ok: true,
      processed,
      errors: errors.length,
      errorSample: errors.slice(0, 5),
      dimensions: dims || null,
      disk,
      note: 'Resumable — press again to continue the backlog.',
    });
  } catch (err) {
    console.error('[wc-reports] rollup failed:', err);
    res.status(500).json({ ok: false, error: err.sqlMessage || err.message });
  }
}

module.exports = { dashboard, triggerRollup, DEDUPED_BASE, SCOPES, DEFAULT_SCOPE, scopeClause };
