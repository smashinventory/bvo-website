-- ═══════════════════════════════════════════════════════════════════
--  Which bundle-builder query is eating the 11 seconds?
--
--  Run these ONE AT A TIME in phpMyAdmin and note the reported time
--  under each result ("Query took N seconds").
--
--  Read-only. Nothing here writes, locks or changes anything.
-- ═══════════════════════════════════════════════════════════════════


-- ── 1. THE SUSPECT: getCabinetTopMap() ──────────────────────────────
--
-- The join predicate is
--     t.sku IN (pc.component_sku, CONCAT(...), CONCAT(SUBSTRING_INDEX(...)), ...)
-- Every one of those is COMPUTED PER ROW, so MySQL cannot use the index
-- on products.sku. It has to scan products for each row of the
-- jmv_dimensions x product_components intermediate. That is the shape
-- that turns a fast query into a slow one as the catalogue grows.
--
-- Expect this to dominate. If it does not, I am wrong and we look again.

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
 GROUP BY cab.sku, t.sku;


-- ── 1b. How big is the intermediate it scans products against? ──────
-- This is the row count that gets multiplied by a products scan.

SELECT COUNT(*) AS intermediate_rows
  FROM jmv_dimensions cab
  JOIN jmv_dimensions combo
    ON combo.product_type  = 'Vanity'
   AND combo.collection    = cab.collection
   AND combo.base_finish   = cab.base_finish
   AND combo.size_nominal  = cab.size_nominal
  JOIN product_components pc
    ON pc.parent_sku     = combo.sku
   AND pc.component_role = 'top'
 WHERE cab.product_type = 'Cabinet';


-- ── 1c. What the optimiser actually plans ───────────────────────────
-- Look at the `type` column for the `t` (products) row. "ALL" means a
-- full table scan per row of the intermediate — that is the problem.
-- Also look at `rows` and at Extra for "Using join buffer".

EXPLAIN
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
 GROUP BY cab.sku, t.sku;


-- ── 2. Are the join columns indexed at all? ─────────────────────────
-- jmv_dimensions self-joins on (product_type, collection, base_finish,
-- size_nominal) and product_components joins on (parent_sku,
-- component_role). If those are unindexed, the intermediate itself is
-- slow before products is even reached.

SHOW INDEX FROM jmv_dimensions;
SHOW INDEX FROM product_components;


-- ── 3. The other five, for comparison ───────────────────────────────
-- If one of these is also slow, it matters: buildCataloguePayload runs
-- all six with Promise.all, so the rebuild costs whatever the SLOWEST
-- one costs. Fixing a fast one saves nothing.

-- cabinets
SELECT COUNT(*) FROM products p
  INNER JOIN categories c ON c.id = p.category_id
  INNER JOIN product_attribute_values pav_depth
    ON pav_depth.product_id = p.id AND pav_depth.attr_key = 'depth_in'
   AND pav_depth.value_num >= 21
 WHERE p.brand = 'James Martin Vanities'
   AND c.slug = 'bathroom-vanities'
   AND p.product_type IN ('Single Sink Cabinet Only','Double Sink Cabinet Only')
   AND p.is_active = 1;

-- rough size of the tables involved
SELECT 'products' t, COUNT(*) n FROM products
UNION ALL SELECT 'jmv_dimensions', COUNT(*) FROM jmv_dimensions
UNION ALL SELECT 'product_components', COUNT(*) FROM product_components
UNION ALL SELECT 'product_attribute_values', COUNT(*) FROM product_attribute_values;
