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
-- STEP 1 — collections
-- ---------------------------------------------------------------------------
-- collections.brand DEFAULTS to 'James Martin', so brand is set explicitly on
-- every row. 'bristol' already belongs to James Martin (id 28), so ER's Bristol
-- takes the slug 'bristol-er-vanities' — slug is UNIQUE.
-- ===========================================================================

INSERT INTO collections (slug, name, brand, is_active, sort_order)
VALUES ('bristol-er-vanities', 'Bristol', 'ER Vanities', 1, 30)
ON DUPLICATE KEY UPDATE name = VALUES(name), brand = VALUES(brand), is_active = VALUES(is_active);
INSERT INTO collections (slug, name, brand, is_active, sort_order)
VALUES ('kensington', 'Kensington', 'ER Vanities', 1, 31)
ON DUPLICATE KEY UPDATE name = VALUES(name), brand = VALUES(brand), is_active = VALUES(is_active);
INSERT INTO collections (slug, name, brand, is_active, sort_order)
VALUES ('london', 'London', 'ER Vanities', 1, 32)
ON DUPLICATE KEY UPDATE name = VALUES(name), brand = VALUES(brand), is_active = VALUES(is_active);
INSERT INTO collections (slug, name, brand, is_active, sort_order)
VALUES ('oxford', 'Oxford', 'ER Vanities', 1, 33)
ON DUPLICATE KEY UPDATE name = VALUES(name), brand = VALUES(brand), is_active = VALUES(is_active);
INSERT INTO collections (slug, name, brand, is_active, sort_order)
VALUES ('windsor', 'Windsor', 'ER Vanities', 1, 34)
ON DUPLICATE KEY UPDATE name = VALUES(name), brand = VALUES(brand), is_active = VALUES(is_active);

-- VERIFY step 1 — expect 5 rows, all brand 'ER Vanities'.
SELECT id, slug, name, brand FROM collections WHERE brand = 'ER Vanities' ORDER BY name;


