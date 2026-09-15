-- ─────────────────────────────────────────────────────────────────────
--  Retire the eight filter groups that appeared on 2026-09-14.
--
--  WHAT HAPPENED
--  None of these were added. They were seeded months ago — migrations 002
--  and 003 — and never rendered, because getAllAttributeValues() had been
--  throwing #1271 (illegal mix of collations) on every call and returning
--  {}. No checkbox or boolean facet could appear anywhere on the site.
--
--  f9596b2 fixed that function. Every definition holding values started
--  rendering at once, and the vanity sidebar went from 7 groups to 15.
--  The original groups were never lost — Brand, Vanity Type, Cabinet
--  Colour, Hardware Finish, Configuration, Vanity Style and Price Range
--  are all still there, just buried.
--
--  TWO OF THESE WERE NEVER USABLE
--    ships_ltl      'Shipping Method' — a TINYINT rendered as a checkbox
--                   list, so its only option reads "Yes". Meaningless.
--    country_origin one distinct value (Vietnam). A filter offering a
--                   single choice every product already matches cannot
--                   narrow anything.
--
--  The rest work but are not wanted in the sidebar: primary_material
--  (15 options, including both 'Rubber Wood' and the typo 'Ruber Wood'),
--  the three Yes-only toggles, and mount_type / drawer_side.
--
--  DEACTIVATED, NOT DELETED. is_active = 0 keeps the definitions, the
--  product_attribute_values rows, and the ability to bring any of them
--  back with one UPDATE. Nothing about the underlying data changes, and
--  ?ada_compliant=Yes still filters if anyone has the URL.
--
--  SCOPE NOTE: five of these are category_id = NULL, i.e. global. They
--  were showing on every category — vanities, mirrors, faucets,
--  accessories. Retiring them clears all four.
-- ─────────────────────────────────────────────────────────────────────

START TRANSACTION;

SELECT 'BEFORE' AS phase, id, category_id, attr_key, display_name, filter_type, is_active
  FROM attribute_definitions
 WHERE attr_key IN ('ships_ltl','country_origin','primary_material',
                    'ada_compliant','assembly_required',
                    'mount_type','sink_included','drawer_side')
 ORDER BY category_id, sort_order;

UPDATE attribute_definitions
   SET is_active = 0
 WHERE attr_key IN ('ships_ltl','country_origin','primary_material',
                    'ada_compliant','assembly_required',
                    'mount_type','sink_included','drawer_side')
   AND is_active = 1;

-- Expect every row above now is_active = 0.
SELECT 'AFTER' AS phase, id, category_id, attr_key, display_name, is_active
  FROM attribute_definitions
 WHERE attr_key IN ('ships_ltl','country_origin','primary_material',
                    'ada_compliant','assembly_required',
                    'mount_type','sink_included','drawer_side')
 ORDER BY category_id, sort_order;

-- What the vanity sidebar will render after this + the restart.
-- Expect Brand, Vanity Type, Cabinet Colour, Hardware Finish, the
-- countertop/sink groups, Vanity Width, and the custom Configuration /
-- Vanity Style / Price blocks that live in the template.
SELECT 'VANITY FACETS REMAINING' AS phase, attr_key, display_name, filter_type, sort_order
  FROM attribute_definitions
 WHERE (category_id = 1 OR category_id IS NULL) AND is_active = 1
 ORDER BY sort_order, attr_key;

COMMIT;
