-- ─────────────────────────────────────────────────────────────────────
--  Main-nav "Faucets" lands preselected on Bathroom Faucets.
--
--  WHY
--  The faucets category holds 669 products since the Huntington Brass
--  import — 376 Shower Fixtures, 84 Kitchen Faucets, 55 Tub Fillers, 5
--  bar/laundry. A shopper clicking "Faucets" from a bathroom vanity store
--  landed on a wall of shower arms and supply elbows.
--
--  The new Type facet in the collection sidebar (this same commit) lets
--  them switch to any other type, or clear it and see all 669. This only
--  changes where the nav link points.
--
--  WHY NOT SLUG_DEFAULT_PRODUCT_TYPES
--  There is an existing hook that would default the whole collection to
--  one type. Two reasons against it here:
--
--    1. site.js rebuilds the query string on every checkbox change, so
--       unchecking the last type removes ?type= entirely and the default
--       silently re-injects. The shopper unticks "Bathroom Faucets" and
--       lands back on Bathroom Faucets. It looks broken because it is.
--    2. It would make /collections/faucets — the canonical URL in the
--       sitemap — show 149 of 669 products, orphaning the other 520 from
--       their category page.
--
--  Putting the preselect on the LINK keeps the bare URL honest and makes
--  clearing the filter behave the way a filter should.
--
--  SAFETY
--  - Scoped to the main-menu item whose URL is exactly the bare
--    collection path. Idempotent: re-running matches nothing, because the
--    URL now has the query string.
--  - Does not touch the footer "Faucets" link (menu handle footer-shop),
--    which should keep pointing at the full collection.
--  - Nothing is inserted or deleted. One UPDATE, one row.
--
--  AFTER RUNNING: restart. megaMenuData caches the nav for 5 minutes
--  (CMS_TTL_MS), so the link will otherwise look unchanged for a while.
-- ─────────────────────────────────────────────────────────────────────

START TRANSACTION;

SELECT 'BEFORE' AS phase, nmi.id, nmi.label, nmi.url
  FROM nav_menu_items nmi
  JOIN nav_menus nm ON nm.id = nmi.menu_id
 WHERE nm.handle = 'main-menu'
   AND nmi.url LIKE '/collections/faucets%';

UPDATE nav_menu_items nmi
  JOIN nav_menus nm ON nm.id = nmi.menu_id
   SET nmi.url = '/collections/faucets?type=Bathroom+Faucets'
 WHERE nm.handle = 'main-menu'
   AND nmi.url   = '/collections/faucets';

-- Expect exactly one row, url now carrying ?type=Bathroom+Faucets.
SELECT 'AFTER' AS phase, nmi.id, nmi.label, nmi.url
  FROM nav_menu_items nmi
  JOIN nav_menus nm ON nm.id = nmi.menu_id
 WHERE nm.handle = 'main-menu'
   AND nmi.url LIKE '/collections/faucets%';

-- The Type facet options this will land on, in the order the sidebar
-- renders them (count DESC). Bathroom Faucets should be one of them.
SELECT product_type, COUNT(*) AS n
  FROM products
 WHERE category_id = (SELECT id FROM categories WHERE slug = 'faucets')
   AND is_active = 1
   AND product_type IS NOT NULL AND product_type <> ''
 GROUP BY product_type
 ORDER BY n DESC, product_type ASC;

COMMIT;
