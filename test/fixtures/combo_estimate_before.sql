WITH
       top_dem AS (
         SELECT 
      CASE WHEN SUBSTRING_INDEX(t.sku,'-',1) IN ('050','051') THEN 'PLAIN'
           WHEN SUBSTRING_INDEX(t.sku,'-',1) = '060'          THEN 'RC'
           ELSE SUBSTRING_INDEX(t.sku,'-',1) END AS fam, t.top_finish, t.top_material,
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
            AND (
      ( td.fam <> 'RC'
        OR c.collection IN (SELECT collection FROM rc_collections) )
      AND ( c.collection <> 'Linear'
            OR td.top_material LIKE '%Composite%' ))
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
        LIMIT 40