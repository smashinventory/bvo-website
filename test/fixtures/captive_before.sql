SELECT d.sku, d.collection, d.base_finish, d.top_finish,
              d.size_nominal, d.sinks,
              CASE WHEN d.freepower = 1 THEN 1 ELSE 0 END AS is_fp,
              SUM(m.demand_min) AS total_drawdown,
              NULL AS base_units
         FROM jmv_daily_movement m
         JOIN jmv_dimensions d ON d.sku = m.sku
        WHERE m.is_valid = 1 AND m.demand_min > 0
          AND d.group_number = 'D300' AND m.movement_date >= ?
        GROUP BY d.sku, d.collection, d.base_finish, d.top_finish,
                 d.size_nominal, d.sinks, is_fp