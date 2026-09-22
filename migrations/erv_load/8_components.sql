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
-- STEP 8 — product_components  (bridge units and the linen tower)
-- ---------------------------------------------------------------------------
-- Keyed on SKU strings, not product ids, per the table's own design.
-- Matched on collection + cabinet finish + hardware finish: a bright white
-- bridge between two navy cabinets is not a pairing.
-- product_accessories is deliberately left EMPTY — mirroring this relationship
-- into a second table is the two-homes-for-one-fact problem Rule 10 prevents.
-- ===========================================================================

INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-29.5-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-35.5-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-41.5-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-47.5-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-59.5D-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-59.5S-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-71.5-NWA-BG', 'Bristol-Bridge3DE-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-29.5-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-35.5-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-41.5-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-47.5-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-59.5D-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-59.5S-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Bristol-71.5-NWA-BG', 'Bristol-BridgeMUCounter-NWA-BG', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-35.5L-MGR-BN', 'Kensington-BridgeCabinet-MG-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-35.5R-MGR-BN', 'Kensington-BridgeCabinet-MG-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-41.5-MGR-BN', 'Kensington-BridgeCabinet-MG-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-47.5-MGR-BN', 'Kensington-BridgeCabinet-MG-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-59.5D-MGR-BN', 'Kensington-BridgeCabinet-MG-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-59.5S-MGR-BN', 'Kensington-BridgeCabinet-MG-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-71.5-MGR-BN', 'Kensington-BridgeCabinet-MG-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-29.5L-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-29.5R-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-35.5L-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-35.5R-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-41.5-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-47.5-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-59.5D-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-59.5S-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Kensington-71.5-WH-BN', 'Kensington-BridgeCabinet-WH-BN', 'bridge', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Windsor-29.5-WH-BN', 'Windsor-LC-WH-BN', 'linen', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Windsor-35.5L-WH-BN', 'Windsor-LC-WH-BN', 'linen', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Windsor-35.5R-WH-BN', 'Windsor-LC-WH-BN', 'linen', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Windsor-47.5-WH-BN', 'Windsor-LC-WH-BN', 'linen', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Windsor-59.5D-WH-BN', 'Windsor-LC-WH-BN', 'linen', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Windsor-59.5S-WH-BN', 'Windsor-LC-WH-BN', 'linen', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);
INSERT INTO product_components (parent_sku, component_sku, component_role, seq)
VALUES ('Windsor-71.5-WH-BN', 'Windsor-LC-WH-BN', 'linen', 1)
ON DUPLICATE KEY UPDATE seq = VALUES(seq);

-- VERIFY step 8 — expect 37 rows.
SELECT COUNT(*) AS component_rows FROM product_components
 WHERE component_sku LIKE 'Kensington-Bridge%'
    OR component_sku LIKE 'Bristol-Bridge%'
    OR component_sku LIKE 'Windsor-LC%';


