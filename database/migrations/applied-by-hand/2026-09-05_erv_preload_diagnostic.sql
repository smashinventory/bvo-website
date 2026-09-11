-- ---------------------------------------------------------------------------
-- ER Vanities -> BVO: PRE-LOAD DIAGNOSTIC   (regenerated 2026-09-05)
--
-- READ-ONLY. Every statement is a SELECT. Nothing is inserted, updated or
-- deleted. Its answers decide how the load file is written, so run it first.
-- ---------------------------------------------------------------------------

-- 1. Do any of our 78 already exist? BVO products were added then deleted
--    earlier, so this is expected to return 0 — but slug is UNIQUE, and a
--    survivor would turn the load into a hard failure or a silent overwrite.
SELECT 'match on vendor_sku' AS check_name, COUNT(*) AS n FROM products
 WHERE vendor_sku IN (
    'Bristol-29.5-NWA-BG',
    'Bristol-35.5-NWA-BG',
    'Bristol-41.5-NWA-BG',
    'Bristol-47.5-NWA-BG',
    'Bristol-59.5D-NWA-BG',
    'Bristol-59.5S-NWA-BG',
    'Bristol-71.5-NWA-BG',
    'Bristol-Bridge3DE-NWA-BG',
    'Bristol-BridgeMUCounter-NWA-BG',
    'Kensington-29.5L-DOAK-MB',
    'Kensington-29.5L-NVBLU-BG',
    'Kensington-29.5L-WH-BN',
    'Kensington-29.5R-DOAK-MB',
    'Kensington-29.5R-NVBLU-BG',
    'Kensington-29.5R-WH-BN',
    'Kensington-35.5L-DOAK-MB',
    'Kensington-35.5L-MGR-BN',
    'Kensington-35.5L-NVBLU-BG',
    'Kensington-35.5L-WH-BN',
    'Kensington-35.5R-DOAK-MB',
    'Kensington-35.5R-MGR-BN',
    'Kensington-35.5R-NVBLU-BG',
    'Kensington-35.5R-WH-BN',
    'Kensington-41.5-DOAK-MB',
    'Kensington-41.5-MGR-BN',
    'Kensington-41.5-NVBLU-BG',
    'Kensington-41.5-WH-BN',
    'Kensington-47.5-MGR-BN',
    'Kensington-47.5-WH-BN',
    'Kensington-59.5D-MGR-BN',
    'Kensington-59.5D-WH-BN',
    'Kensington-59.5S-MGR-BN',
    'Kensington-59.5S-WH-BN',
    'Kensington-71.5-MGR-BN',
    'Kensington-71.5-WH-BN',
    'Kensington-BridgeCabinet-MG-BN',
    'Kensington-BridgeCabinet-WH-BN',
    'London-23.5-DOAK-MB',
    'London-23.5-WH-BN',
    'London-29.5-WH-BN',
    'London-29.5-DOAK-MB',
    'London-35.5R-DOAK-MB',
    'London-35.5R-WH-BN',
    'London-47.5-DOAK-MB',
    'London-47.5-WH-BN',
    'London-59.5D-DOAK-MB',
    'London-59.5D-WH-BN',
    'London-59.5S-DOAK-MB',
    'London-59.5S-WH-BN',
    'London-71.5-DOAK-MB',
    'London-71.5-WH-BN',
    'Oxford-29.5-BLK-BG',
    'Oxford-29.5-CAMGRN-BG',
    'Oxford-29.5-WA-MB',
    'Oxford-35.5-BLK-BG',
    'Oxford-35.5-CAMGRN-BG',
    'Oxford-35.5-WA-MB',
    'Oxford-41.5-BLK-BG',
    'Oxford-41.5-CAMGRN-BG',
    'Oxford-41.5-WA-MB',
    'Oxford-47.5-CAMGRN-BG',
    'Oxford-47.5-BLK-BG',
    'Oxford-47.5-WA-MB',
    'Windsor-29.5-NVBLU-BG',
    'Windsor-29.5-WH-BN',
    'Windsor-35.5L-NVBLU-BG',
    'Windsor-35.5L-WH-BN',
    'Windsor-35.5R-NVBLU-BG',
    'Windsor-35.5R-WH-BN',
    'Windsor-47.5-NVBLU-BG',
    'Windsor-47.5-WH-BN',
    'Windsor-59.5D-WH-BN',
    'Windsor-59.5S-NVBLU-BG',
    'Windsor-59.5S-WH-BN',
    'Windsor-59.5D-NVBLU-BG',
    'Windsor-71.5-NVBLU-BG',
    'Windsor-71.5-WH-BN',
    'Windsor-LC-WH-BN'
 )
UNION ALL
SELECT 'match on rflpos_item_id', COUNT(*) FROM products
 WHERE rflpos_item_id IN (
    'PR1269',
    'PR1270',
    'PR1271',
    'PR1272',
    'PR1273',
    'PR1274',
    'PR1275',
    'PR1277',
    'PR1276',
    'Kensington-29.5L-DOAK-MB',
    'PR0974',
    'PR0972',
    'Kensington-29.5R-DOAK-MB',
    'PR0971',
    'PR0969',
    'Kensington-35.5L-DOAK-MB',
    'PR0979',
    'PR0980',
    'PR0978',
    'Kensington-35.5R-DOAK-MB',
    'PR0976',
    'PR0977',
    'PR0975',
    'Kensington-41.5-DOAK-MB',
    'PR0982',
    'PR0983',
    'PR0981',
    'PR0986',
    'PR0985',
    'PR0988',
    'PR0987',
    'PR0990',
    'PR0989',
    'PR0992',
    'PR0991',
    'Kensington-BridgeCabinet-MG-BN',
    'Kensington-BridgeCabinet-WH-BN',
    'PR0994',
    'PR0993',
    'PR0995',
    'PR0996',
    'PR0998',
    'PR0997',
    'PR1000',
    'PR0999',
    'PR1002',
    'PR1001',
    'PR1004',
    'PR1003',
    'PR1006',
    'PR1005',
    'PR1024',
    'PR1023',
    'PR1264',
    'PR1026',
    'PR1025',
    'PR1265',
    'PR1028',
    'PR1027',
    'PR1266',
    'PR1029',
    'PR1030',
    'PR1267',
    'PR1008',
    'PR1007',
    'PR1012',
    'PR1011',
    'PR1010',
    'PR1009',
    'PR1014',
    'PR1013',
    'PR1015',
    'PR1018',
    'PR1017',
    'PR1016',
    'PR1020',
    'PR1019',
    'PR1021'
 )
UNION ALL
SELECT 'match on slug', COUNT(*) FROM products
 WHERE slug IN (
    'bristol-29-5-bathroom-vanity-in-natural-white-ash',
    'bristol-35-5-bathroom-vanity-in-natural-white-ash',
    'bristol-41-5-bathroom-vanity-in-natural-white-ash',
    'bristol-47-5-bathroom-vanity-in-natural-white-ash',
    'bristol-59-5-double-sink-bathroom-vanity-in-natural-white-ash',
    'bristol-59-5-single-sink-bathroom-vanity-in-natural-white-ash',
    'bristol-71-5-bathroom-vanity-in-natural-white-ash',
    'bristol-24-3-drawer-bridge-in-natural-white-ash',
    'bristol-24-make-up-bridge-in-natural-white-ash',
    'kensington-29-5-left-drawers-bathroom-vanity-in-desert-oak',
    'kensington-29-5-left-drawers-bathroom-vanity-in-navy-blue',
    'kensington-29-5-left-drawers-bathroom-vanity-in-bright-white',
    'kensington-29-5-right-drawers-bathroom-vanity-in-desert-oak',
    'kensington-29-5-right-drawers-bathroom-vanity-in-navy-blue',
    'kensington-29-5-right-drawers-bathroom-vanity-in-bright-white',
    'kensington-35-5-left-drawers-bathroom-vanity-in-desert-oak',
    'kensington-35-5-left-drawers-bathroom-vanity-in-metal-gray',
    'kensington-35-5-left-drawers-bathroom-vanity-in-navy-blue',
    'kensington-35-5-left-drawers-bathroom-vanity-in-bright-white',
    'kensington-35-5-right-drawers-bathroom-vanity-in-desert-oak',
    'kensington-35-5-right-drawers-bathroom-vanity-in-metal-gray',
    'kensington-35-5-right-drawers-bathroom-vanity-in-navy-blue',
    'kensington-35-5-right-drawers-bathroom-vanity-in-bright-white',
    'kensington-41-5-bathroom-vanity-in-desert-oak',
    'kensington-41-5-bathroom-vanity-in-metal-gray',
    'kensington-41-5-bathroom-vanity-in-navy-blue',
    'kensington-41-5-bathroom-vanity-in-bright-white',
    'kensington-47-5-bathroom-vanity-in-metal-gray',
    'kensington-47-5-bathroom-vanity-in-bright-white',
    'kensington-59-5-double-sink-bathroom-vanity-in-metal-gray',
    'kensington-59-5-double-sink-bathroom-vanity-in-bright-white',
    'kensington-59-5-single-sink-bathroom-vanity-in-metal-gray',
    'kensington-59-5-single-sink-bathroom-vanity-in-bright-white',
    'kensington-71-5-bathroom-vanity-in-metal-gray',
    'kensington-71-5-bathroom-vanity-in-bright-white',
    'kensington-23-bridge-drawer-in-metal-gray',
    'kensington-23-bridge-drawer-in-bright-white',
    'london-23-5-bathroom-vanity-in-desert-oak',
    'london-23-5-bathroom-vanity-in-bright-white',
    'london-29-5-bathroom-vanity-in-bright-white',
    'london-29-5-bathroom-vanity-in-desert-oak',
    'london-35-5-right-drawers-bathroom-vanity-in-desert-oak',
    'london-35-5-right-drawers-bathroom-vanity-in-bright-white',
    'london-47-5-bathroom-vanity-in-desert-oak',
    'london-47-5-bathroom-vanity-in-bright-white',
    'london-59-5-double-sink-bathroom-vanity-in-desert-oak',
    'london-59-5-double-sink-bathroom-vanity-in-bright-white',
    'london-59-5-single-sink-bathroom-vanity-in-desert-oak',
    'london-59-5-single-sink-bathroom-vanity-in-bright-white',
    'london-71-5-bathroom-vanity-in-desert-oak',
    'london-71-5-bathroom-vanity-in-bright-white',
    'oxford-29-5-bathroom-vanity-in-black',
    'oxford-29-5-bathroom-vanity-in-sage-green',
    'oxford-29-5-bathroom-vanity-in-whitewashed-ash',
    'oxford-35-5-bathroom-vanity-in-black',
    'oxford-35-5-bathroom-vanity-in-sage-green',
    'oxford-35-5-bathroom-vanity-in-whitewashed-ash',
    'oxford-41-5-bathroom-vanity-in-black',
    'oxford-41-5-bathroom-vanity-in-sage-green',
    'oxford-41-5-bathroom-vanity-in-whitewashed-ash',
    'oxford-47-5-bathroom-vanity-in-sage-green',
    'oxford-47-5-bathroom-vanity-in-black',
    'oxford-47-5-bathroom-vanity-in-whitewashed-ash',
    'windsor-29-5-bathroom-vanity-in-navy-blue',
    'windsor-29-5-bathroom-vanity-in-bright-white',
    'windsor-35-5-left-drawers-bathroom-vanity-in-navy-blue',
    'windsor-35-5-left-drawers-bathroom-vanity-in-bright-white',
    'windsor-35-5-right-drawers-bathroom-vanity-in-navy-blue',
    'windsor-35-5-right-drawers-bathroom-vanity-in-bright-white',
    'windsor-47-5-bathroom-vanity-in-navy-blue',
    'windsor-47-5-bathroom-vanity-in-bright-white',
    'windsor-59-5-double-sink-bathroom-vanity-in-bright-white',
    'windsor-59-5-single-sink-bathroom-vanity-in-navy-blue',
    'windsor-59-5-single-sink-bathroom-vanity-in-bright-white',
    'windsor-59-5-double-sink-bathroom-vanity-in-navy-blue',
    'windsor-71-5-bathroom-vanity-in-navy-blue',
    'windsor-71-5-bathroom-vanity-in-bright-white',
    'windsor-linen-tower-in-bright-white'
 );

-- 2. Anything that DOES collide, named. Empty result = clear to insert.
SELECT id, sku, vendor_sku, rflpos_item_id, brand, slug, category_id,
       product_type, is_active
  FROM products
 WHERE slug IN (
    'bristol-29-5-bathroom-vanity-in-natural-white-ash',
    'kensington-35-5-right-drawers-bathroom-vanity-in-metal-gray',
    'london-29-5-bathroom-vanity-in-desert-oak',
    'oxford-47-5-bathroom-vanity-in-sage-green',
    'windsor-linen-tower-in-bright-white'
 )
    OR vendor_sku IN (
    'Bristol-29.5-NWA-BG',
    'Kensington-35.5R-MGR-BN',
    'London-29.5-DOAK-MB',
    'Oxford-47.5-CAMGRN-BG',
    'Windsor-LC-WH-BN'
 );

-- 3. Brand strings actually in use. PROJECT_BRIEF says the canonical RFL value
--    is 'Ethan Roth'; we are loading as 'ER Vanities'. This says how many rows
--    the rebrand migration would touch.
SELECT brand, COUNT(*) AS products FROM products GROUP BY brand ORDER BY products DESC;

-- 4. Collections. collections.brand DEFAULTS to 'James Martin', so an ER row
--    inserted without an explicit brand would be mislabelled.
SELECT id, slug, name, brand, is_active, sort_order
  FROM collections
 WHERE slug IN ('kensington','london','windsor','oxford','bristol')
    OR name IN ('Kensington','London','Windsor','Oxford','Bristol')
 ORDER BY name;

-- 5. Which product_type vocabulary is LIVE today. The 4-value taxonomy in
--    BVO_AUDIT_BRIEF Fix #3 is still pending; loading it early would make every
--    ER product invisible to the current sidebar filter.
SELECT category_id, product_type, COUNT(*) AS n
  FROM products WHERE category_id = 1
 GROUP BY category_id, product_type ORDER BY n DESC;

-- 6. EAV coverage. Expect 0 for country_origin and ships_ltl — they are defined
--    as filters but the JM importer only writes them to products columns.
SELECT attr_key, COUNT(*) AS rows_stored
  FROM product_attribute_values
 WHERE attr_key IN ('country_origin','ships_ltl','mount_type','style',
                    'cabinet_finish','primary_material','ada_compliant','drawer_side')
 GROUP BY attr_key ORDER BY rows_stored DESC;

-- 7. mount_type strings in use. Migration 011 converted 'Freestanding' to
--    'Floor Standing'; our file says 'Freestanding'. This decides which string
--    ER writes so both brands land in ONE filter group, not two.
SELECT value_text, COUNT(*) AS n
  FROM product_attribute_values WHERE attr_key = 'mount_type'
 GROUP BY value_text ORDER BY n DESC;

-- 8. Does drawer_side already exist as a definition? We propose adding it.
SELECT id, category_id, attr_key, display_name, filter_type, is_active
  FROM attribute_definitions
 WHERE attr_key IN ('drawer_side','country_origin','ships_ltl','size_in');
