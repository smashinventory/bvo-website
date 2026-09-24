-- ═══════════════════════════════════════════════════════════════════
--  Prove the new cabinet->top logic returns EXACTLY the old pairs.
--
--  The JS rewrite resolves four alias forms with a hash lookup instead of
--  a non-sargable IN() inside a join. Faster is worthless if it is also
--  different: a lost pair means a top silently vanishes from a cabinet,
--  and nobody finds out until a customer does. That happened before —
--  see the FreePower siblings comment in bundleController.js.
--
--  So: express the NEW logic in SQL, run both, and diff. The alias
--  expansion below is a line-for-line port of topSkuAliases() in
--  src/controllers/bundleController.js.
--
--  Read-only. Run the whole thing; QUERY 3 is the one that matters.
-- ═══════════════════════════════════════════════════════════════════


-- ── QUERY 1 — the NEW logic, in SQL ─────────────────────────────────
-- Aliases are expanded FIRST, into a derived table, then joined on
-- equality — which can use the index on products.sku. Note the runtime
-- versus the 12.27s the old shape took.

WITH ed AS (
  SELECT DISTINCT cab.sku AS cabinet_sku, pc.component_sku
    FROM jmv_dimensions cab
    JOIN jmv_dimensions combo
      ON combo.product_type  = 'Vanity'
     AND combo.collection    = cab.collection
     AND combo.base_finish   = cab.base_finish
     AND combo.size_nominal  = cab.size_nominal
    JOIN product_components pc
      ON pc.parent_sku     = combo.sku
     AND pc.component_role = 'top'
   WHERE cab.product_type = 'Cabinet'
),
al AS (
  SELECT cabinet_sku, component_sku AS alias FROM ed
  UNION ALL
  SELECT cabinet_sku, CONCAT(component_sku, '-SNK') FROM ed
  UNION ALL
  SELECT cabinet_sku, CONCAT(SUBSTRING_INDEX(component_sku, '-', 2), '-BS-',
                             SUBSTRING_INDEX(component_sku, '-', -1)) FROM ed
  UNION ALL
  SELECT cabinet_sku, CONCAT(REPLACE(component_sku, '-S46-', '-S46R-'), '-SNK') FROM ed
)
SELECT COUNT(*) AS new_pair_count FROM (
  SELECT DISTINCT al.cabinet_sku, t.sku AS top_sku
    FROM al
    JOIN products t ON t.sku = al.alias AND t.is_active = 1
) x;


-- ── QUERY 2 — the OLD logic's count, for comparison ─────────────────
-- (This is the slow one. ~12s. Expect it to match QUERY 1 exactly.)

SELECT COUNT(*) AS old_pair_count FROM (
  SELECT cab.sku AS cabinet_sku, t.sku AS top_sku
    FROM jmv_dimensions cab
    JOIN jmv_dimensions combo
      ON combo.product_type  = 'Vanity'
     AND combo.collection    = cab.collection
     AND combo.base_finish   = cab.base_finish
     AND combo.size_nominal  = cab.size_nominal
    JOIN product_components pc
      ON pc.parent_sku     = combo.sku
     AND pc.component_role = 'top'
    JOIN products t
      ON t.sku IN (pc.component_sku,
                   CONCAT(pc.component_sku, '-SNK'),
                   CONCAT(SUBSTRING_INDEX(pc.component_sku, '-', 2), '-BS-',
                          SUBSTRING_INDEX(pc.component_sku, '-', -1)),
                   CONCAT(REPLACE(pc.component_sku, '-S46-', '-S46R-'), '-SNK'))
   WHERE cab.product_type = 'Cabinet'
     AND t.is_active      = 1
   GROUP BY cab.sku, t.sku
) y;


-- ── QUERY 3 — THE ONE THAT MATTERS: the symmetric difference ────────
--
-- Counts alone can coincide while the contents differ. This lists every
-- pair present in one result and not the other, in both directions.
--
--   ZERO ROWS = the rewrite is exactly equivalent. Ship it.
--   ANY ROWS  = do not ship. `side` says which logic produced the orphan:
--               'only_in_OLD' means the rewrite LOSES a pair (a top
--               disappears from a cabinet); 'only_in_NEW' means it
--               invents one.

WITH ed AS (
  SELECT DISTINCT cab.sku AS cabinet_sku, pc.component_sku
    FROM jmv_dimensions cab
    JOIN jmv_dimensions combo
      ON combo.product_type  = 'Vanity'
     AND combo.collection    = cab.collection
     AND combo.base_finish   = cab.base_finish
     AND combo.size_nominal  = cab.size_nominal
    JOIN product_components pc
      ON pc.parent_sku     = combo.sku
     AND pc.component_role = 'top'
   WHERE cab.product_type = 'Cabinet'
),
al AS (
  SELECT cabinet_sku, component_sku AS alias FROM ed
  UNION ALL SELECT cabinet_sku, CONCAT(component_sku, '-SNK') FROM ed
  UNION ALL SELECT cabinet_sku, CONCAT(SUBSTRING_INDEX(component_sku, '-', 2), '-BS-',
                                       SUBSTRING_INDEX(component_sku, '-', -1)) FROM ed
  UNION ALL SELECT cabinet_sku, CONCAT(REPLACE(component_sku, '-S46-', '-S46R-'), '-SNK') FROM ed
),
newmap AS (
  SELECT DISTINCT al.cabinet_sku, t.sku AS top_sku
    FROM al JOIN products t ON t.sku = al.alias AND t.is_active = 1
),
oldmap AS (
  SELECT cab.sku AS cabinet_sku, t.sku AS top_sku
    FROM jmv_dimensions cab
    JOIN jmv_dimensions combo
      ON combo.product_type  = 'Vanity'
     AND combo.collection    = cab.collection
     AND combo.base_finish   = cab.base_finish
     AND combo.size_nominal  = cab.size_nominal
    JOIN product_components pc
      ON pc.parent_sku     = combo.sku
     AND pc.component_role = 'top'
    JOIN products t
      ON t.sku IN (pc.component_sku,
                   CONCAT(pc.component_sku, '-SNK'),
                   CONCAT(SUBSTRING_INDEX(pc.component_sku, '-', 2), '-BS-',
                          SUBSTRING_INDEX(pc.component_sku, '-', -1)),
                   CONCAT(REPLACE(pc.component_sku, '-S46-', '-S46R-'), '-SNK'))
   WHERE cab.product_type = 'Cabinet'
     AND t.is_active      = 1
   GROUP BY cab.sku, t.sku
)
SELECT 'only_in_OLD (rewrite LOSES this pair)' AS side, o.cabinet_sku, o.top_sku
  FROM oldmap o
  LEFT JOIN newmap n ON n.cabinet_sku = o.cabinet_sku AND n.top_sku = o.top_sku
 WHERE n.cabinet_sku IS NULL
UNION ALL
SELECT 'only_in_NEW (rewrite INVENTS this pair)', n.cabinet_sku, n.top_sku
  FROM newmap n
  LEFT JOIN oldmap o ON o.cabinet_sku = n.cabinet_sku AND o.top_sku = n.top_sku
 WHERE o.cabinet_sku IS NULL;
