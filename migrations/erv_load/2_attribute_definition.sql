-- ---------------------------------------------------------------------------
-- ER Vanities -> BVO  ·  CATALOGUE LOAD
-- Generated 2026-09-05 from the reviewed source files.
--
-- 78 SKUs. BVO has no product import route, so this is the load.
--
-- HOW TO RUN. phpMyAdmin -> bvo_website -> SQL tab. Run ONE STEP AT A TIME and
-- read the verification SELECT at the end of each before moving on. Every step
-- is idempotent: re-running it will not duplicate rows.
--
-- WHAT THE PRE-LOAD DIAGNOSTIC ESTABLISHED (run 2026-09-05):
--   * 0 of these 78 exist in BVO — clean insert, no slug collisions
--   * no 'Ethan Roth' rows exist, so no rebrand migration is needed
--   * the 4-value product_type taxonomy is LIVE, so we load into it
--   * mount_type canonical string is 'Floor Standing', not 'Freestanding'
--   * collections.slug 'bristol' is taken by James Martin (id 28)
--
-- ROLLBACK is at the bottom of this file. Read it before you start.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;
SET SESSION sql_mode = 'STRICT_ALL_TABLES';


-- ===========================================================================
-- STEP 2 — attribute_definitions: drawer_side
-- ---------------------------------------------------------------------------
-- Left vs right is a plumbing constraint, not a preference: a shopper whose
-- supply lines sit on one side cannot use the other. 20 of 78 ER SKUs carry a
-- value and James Martin has no equivalent field, so this filter group will
-- show ER products only.
-- Guarded by NOT EXISTS, so re-running is safe.
-- ===========================================================================

INSERT INTO attribute_definitions
  (category_id, attr_key, display_name, filter_type, sort_order, is_active)
SELECT 1, 'drawer_side', 'Drawer Side', 'checkbox', 24, 1 FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM attribute_definitions WHERE attr_key = 'drawer_side');

-- VERIFY step 2 — expect exactly 1 row.
SELECT id, category_id, attr_key, display_name, filter_type
  FROM attribute_definitions WHERE attr_key = 'drawer_side';


