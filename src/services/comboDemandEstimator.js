'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   ESTIMATED COMBO DEMAND — the single definition of the estimator.

   JMV_COMBO_DEMAND_DEFINITION.md is the artifact of record. That document
   is right and this file is a bug if they ever disagree.

   EXTRACTED 2026-09-12 from jmvReportsController.js, byte-for-byte. It now
   has two consumers with different needs:

     jmvReportsController  — renders the admin leaderboard, LIMIT 40, and
                             recomputes live for whatever window is on
                             screen (definition §3a: the warranty overage
                             must recompute per window, and there is no
                             stored per-SKU rate).
     jmvMovementRollup     — writes products.demand_score nightly for the
                             storefront sort, needs ALL combos, no limit.

   They cannot share a stored RESULT because the window differs. They share
   the SQL instead. That is the whole reason this module exists.

   Keeping two copies was the alternative and was rejected: the jd.freepower
   bug shipped 870 wrong labels precisely because one definition existed in
   two places and only one got fixed. Rule 2 naming the wrong collection for
   two days was the same failure in the documentation.

   LIMIT is the ONLY thing that varies between callers. Everything else —
   the rules, the joins, the rounding — is identical by construction.
   ═══════════════════════════════════════════════════════════════════════ */

/* Rule 1 — a finish is not one SKU. White Zeus 36" is four physical
   tops; without folding them it reads 17 units instead of 564. */
const TOP_FAMILY = `
  CASE WHEN SUBSTRING_INDEX(t.sku,'-',1) IN ('050','051') THEN 'PLAIN'
       WHEN SUBSTRING_INDEX(t.sku,'-',1) = '060'          THEN 'RC'
       ELSE SUBSTRING_INDEX(t.sku,'-',1) END`;

/* Rules 2 and 4 — the (finish, material, size, sinks) top key is not
   unique: 41 of 127 keys match more than one family. These constraints
   disambiguate it.

   RULE 2 IS DERIVED, NOT A LIST. Rewritten 2026-09-12.

   It used to read IN ('Gracyn','Kinnsden','Allamari') — and 'Kinnsden'
   was wrong. Kinnsden's cabinets are 23.13" deep and all 92 of its combo
   tops are 23.5"; it has never used an 060. The collection that actually
   uses RC exclusively is LUCIAN, and naming it wrongly pruned Lucian's
   53 RC combos out of the estimator, leaving that base demand with
   nowhere to allocate. A hardcoded list cannot be checked against
   anything — it is an assertion — so the error survived review.

   The rule behind the list: an RC top is 21.5" deep with a cut front, so
   only a cabinet shallow enough to need one is ever paired with one.
   Expressed as cabinet depth it is checkable, and it self-maintains if JM
   adds a fourth shallow collection instead of silently stranding it.

   THE BAND IS 21" <= depth < 22", AND BOTH BOUNDS ARE LOAD-BEARING.

     under 21"     43 cabinets, 7 collections — Chianti, Columbia,
                   Alicante', Mantova, Linden, Britannia, LINEAR — every
                   one on CS/CSP composite tops, zero 060. A rule of
                   "under 22" with no floor hands all seven the RC range.
     21" - 22"     Gracyn 6 @ 21.38", Lucian 7 @ 21.38", Allamari 6 @ 21.5"
                   — exactly the three RC collections, nothing else.
     22" and over  standard depth, 23.5" tops.

   Verified 2026-09-12: all 332 cabinets carry depth_in, none missing, so
   nothing can be stranded by absent data. Headroom is asymmetric — 1.37"
   below the floor (nearest non-RC cabinet 19.63") but only 0.5" above the
   ceiling (nearest 22.5"). If JM ships a ~21.75" standard-depth cabinet
   it lands in the band and is offered RC tops. Watch the ceiling.

   DEPTH IS NOT A VALID TEST ON THE TOP SIDE. Five 060 SFR (Siberian)
   tops are recorded at 23.5" instead of 21.5" — the known JM defect on
   the vendor report. This rule reads CABINET depth, which is clean; the
   top side keys on the 060 SKU token via td.fam. Do not invert that.

   See JMV_COMBO_DEMAND_DEFINITION.md §4 Rule 2.

   Rule 4 still stands and is NOT made redundant by the band: Linear sits
   at 18.8"/19.5" so the band already excludes it from RC, but Rule 4
   guards a different failure — Glossy White exists across ten SKUs in
   three prefixes, so without it Linear can be handed a composite top
   from the wrong series. */
const PAIRING_OK = `
  ( td.fam <> 'RC'
    OR c.collection IN (SELECT collection FROM rc_collections) )
  AND ( c.collection <> 'Linear'
        OR td.top_material LIKE '%Composite%' )`;

/* Top demand per family key, warranty-adjusted the same way the revenue
   path adjusts it. Share-neutral by construction — every group in a size
   loses the same fraction — but applied here too so one number cannot
   drift from the other. */
/* A FUNCTION, not a string. As a plain template literal the ${LIMIT_CLAUSE}
   interpolated once at module load, when the variable did not exist yet —
   ReferenceError on require. Taking it as a parameter defers it to call time. */
const COMBO_ESTIMATE_TEMPLATE = (LIMIT_CLAUSE) =>
  `WITH
   top_dem AS (
     SELECT ${TOP_FAMILY} AS fam, t.top_finish, t.top_material,
            t.size_nominal, t.sinks,
            SUM(m.demand_min) AS u
       FROM jmv_daily_movement m
       JOIN jmv_dimensions t ON t.sku = m.sku
      WHERE m.is_valid = 1 AND m.demand_min > 0
        AND t.product_type = 'Top' AND m.movement_date >= ?
      GROUP BY fam, t.top_finish, t.top_material, t.size_nominal, t.sinks
   ),
   /* Grouped WITHOUT the cabinet SKU. 40 of 275 base keys hold two
      cabinets — the double-sink and single-sink variants at the same
      size, e.g. 157-V60D-M-BW and 157-V60S-M-BW. Both carry sinks = 0
      because a base has no basin, so nothing in the data separates
      them and a combo joins to both. Keying on the SKU double-counted
      every such combo and pushed the total to 821 against 751 units
      available. Pooling their demand restores conservation; the
      single/double split still comes through the allocation, because
      the top key IS sink-aware and a 1-sink combo can only draw on
      1-sink top demand. */
   base_dem AS (
     SELECT b.collection, b.base_finish, b.size_nominal,
            SUM(m.demand_min) AS u
       FROM jmv_daily_movement m
       JOIN jmv_dimensions b ON b.sku = m.sku
      WHERE m.is_valid = 1 AND m.demand_min > 0
        AND b.product_type = 'Cabinet' AND m.movement_date >= ?
      GROUP BY b.collection, b.base_finish, b.size_nominal
   ),
   /* Rule 2, derived. The collections whose cabinets fall in the 21"-22"
      band — the only ones that can take a 21.5" Radius Cut top. Returns
      Gracyn, Lucian and Allamari today. See the PAIRING_OK comment above
      for why both bounds matter and why this reads cabinet depth rather
      than top depth.

      depth_in lives in product_attribute_values, not jmv_dimensions, so
      this is the one place the estimator reaches into the products
      tables. Joined on sku; the collation alignment migration
      (2026-09-03_jmv_collation_align.sql) is what makes that join use
      the index instead of failing on mixed collations. */
   rc_collections AS (
     SELECT DISTINCT cab.collection
       FROM jmv_dimensions cab
       JOIN products p ON p.sku = cab.sku
       JOIN product_attribute_values pav
         ON pav.product_id = p.id
        AND pav.attr_key   = 'depth_in'
      WHERE cab.product_type = 'Cabinet'
        AND pav.value_num  >= 21.0
        AND pav.value_num  <  22.0
   ),
   /* combo -> base on (collection, base_finish, size). sinks is
      DELIBERATELY absent: a cabinet carries sinks = 0, its combo carries
      sinks = 1, and including it matches zero of 4,199 combos. */
   opt AS (
     SELECT c.sku AS combo_sku, c.collection, c.base_finish, c.top_finish,
            c.size_nominal, c.sinks,
            CASE WHEN c.freepower = 1 THEN 1 ELSE 0 END AS is_fp,
            bd.u AS base_u,
            COALESCE(SUM(td.u), 0) AS top_u
       FROM jmv_dimensions c
       JOIN base_dem bd
         ON bd.collection = c.collection
        AND bd.base_finish = c.base_finish
        AND bd.size_nominal = c.size_nominal
       /* Join top_dem DIRECTLY. An earlier version joined
          jmv_dimensions t as well and then top_dem through it, which
          counted a family once per physical SKU — White Zeus 36" has
          four, so its share quadrupled and every other finish on the
          same base rounded to 0.00. top_dem already carries the family;
          the extra join only created duplicate rows. */
       LEFT JOIN top_dem td
         ON td.top_finish   = c.top_finish
        AND td.top_material = c.top_material
        AND td.size_nominal = c.size_nominal
        AND td.sinks        = c.sinks
        AND (${PAIRING_OK})
      WHERE c.product_type = 'Vanity'
        AND c.top_finish IS NOT NULL AND c.top_finish <> ''
      GROUP BY c.sku, c.collection, c.base_finish, c.top_finish,
               c.size_nominal, c.sinks, is_fp, bd.u
   )
   SELECT o.combo_sku AS sku, o.collection, o.base_finish, o.top_finish,
          o.size_nominal, o.sinks, o.is_fp,
          /* 1.0 forces float division. Both operands are integer
             sums, and an engine that does integer division truncates
             every share to 0 — which is exactly what happened, turning
             a 21-unit base into 8 + 8 + nine zeros instead of a real
             distribution. Do not remove the 1.0. */
          ROUND(o.base_u * o.top_u * 1.0
                / NULLIF(SUM(o.top_u) OVER (PARTITION BY o.collection, o.base_finish, o.size_nominal), 0), 2)
            AS total_drawdown,
          o.base_u AS base_units
     FROM opt o
    WHERE o.top_u > 0
    /* Definition §6 — 1WZ and 3WZ tie exactly and correctly, so the
       secondary key is required: without it MySQL may return equal rows
       in any order and paginated listings duplicate or skip. */
    ORDER BY total_drawdown DESC, sku ASC
    ${LIMIT_CLAUSE}`;

/* Rule 3 — Bellamy (D300) is the only SKU in its group: no cabinet, no
   top, and its one-off oval Carrara top is not sold separately. Nothing
   can clamp it, so its own drawdown is real and counts directly rather
   than being modelled. Bellamy ALONE — an earlier build treated every
   combo whose base failed to resolve as captive and counted 59 SKUs of
   raw drawdown, which took over the leaderboard with exactly the phantom
   numbers this replaces. */
const CAPTIVE_SQL =
  `SELECT d.sku, d.collection, d.base_finish, d.top_finish,
          d.size_nominal, d.sinks,
          CASE WHEN d.freepower = 1 THEN 1 ELSE 0 END AS is_fp,
          SUM(m.demand_min) AS total_drawdown,
          NULL AS base_units
     FROM jmv_daily_movement m
     JOIN jmv_dimensions d ON d.sku = m.sku
    WHERE m.is_valid = 1 AND m.demand_min > 0
      AND d.group_number = 'D300' AND m.movement_date >= ?
    GROUP BY d.sku, d.collection, d.base_finish, d.top_finish,
             d.size_nominal, d.sinks, is_fp`;

/* The report passes 40; the rollup passes null for every combo.
   ROUND(..., 2) inside the query is load-bearing for BOTH callers and is
   not a display choice: float arithmetic leaves differences around 1e-16
   that reshuffle exact ties, and a sku tiebreak cannot fix that because
   the values are not quite equal. Measured 2026-09-12: 1,448 positions
   moved on noise alone when rounding was removed. */
function comboEstimateSql(limit) {
  /* No leading newline — the template already has one before the
     placeholder. Adding another made the emitted SQL differ from the
     pre-extraction fixture by a blank line, which the equivalence gate
     caught. Harmless to MySQL, but the gate proves nothing if it tolerates
     drift, so it is exact. */
  const LIMIT_CLAUSE = (limit === null || limit === undefined)
    ? ''
    : `LIMIT ${Number(limit)}`;
  return COMBO_ESTIMATE_TEMPLATE(LIMIT_CLAUSE);
}

/* Both queries take the window cutoff. The leaderboard needs it twice —
   once for top_dem, once for base_dem. */
const comboEstimateParams = (cutoffStr) => [cutoffStr, cutoffStr];
const captiveParams       = (cutoffStr) => [cutoffStr];

module.exports = {
  comboEstimateSql,
  comboEstimateParams,
  CAPTIVE_SQL,
  captiveParams,
};
