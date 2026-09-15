-- ─────────────────────────────────────────────────────────────────────
--  Menu Manager becomes the real source of the main menu.
--
--  THE BUG
--  header.ejs line 1 does `const nav = S.nav || {}` off theme settings, so
--  the main menu came from Theme Editor → "Logo & Header". Meanwhile
--  Menu Manager → Main Menu wrote to nav_menu_items, megaMenuData loaded
--  those rows into res.locals.navMenuItems, and no template read them.
--  Editing the screen labelled "Menus" changed nothing on the storefront.
--
--  Same bug the footer had (see the comment in megaMenuData.js) — fixed
--  there, left open here, one table over.
--
--  The code change ships in the same commit. This migration supplies the
--  mega-menu flag and corrects two values on the rows Sam has already
--  curated.
--
--  WHAT THIS DELIBERATELY DOES NOT DO
--  An earlier draft REPLACED Main Menu with the 5 items the theme
--  settings held. That was wrong: Main Menu has 6 rows because Sam added
--  "Bundle Builder", and its Sale row points at the vanities on-sale
--  listing rather than /collections/sale. Rewriting would have silently
--  destroyed both. The rows here are the source of truth from now on, so
--  they are edited in place, never rebuilt.
--
--  EXPECT ONE VISIBLE CHANGE after the restart: the header gains a
--  "Bundle Builder" item, because Main Menu has always had one and the
--  header has never read it. That is the fix working, not a side effect.
--  Remove it in Menu Manager if it is not wanted there.
--
--  SAFETY
--  - Every UPDATE is scoped to menu_id of 'main-menu' AND matched on the
--    current value, so re-running changes nothing.
--  - No DELETE, no INSERT. Nothing can be lost.
--  - The three footer menus are separate handles and are not referenced.
--  - Rollback: `UPDATE ... SET is_mega = 0` and revert the Faucets URL.
--    Or empty Main Menu entirely and the middleware falls back to theme
--    settings on its own — the header keeps working either way.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. is_mega column (idempotent) ─────────────────────────────────
SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'nav_menu_items'
     AND COLUMN_NAME  = 'is_mega');

SET @sql := IF(@has_col = 0,
  'ALTER TABLE nav_menu_items
     ADD COLUMN is_mega TINYINT(1) NOT NULL DEFAULT 0
     COMMENT ''1 = this item opens the mega menu (Vanities)''
     AFTER is_highlight',
  'SELECT ''is_mega already present'' AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

START TRANSACTION;

SELECT 'BEFORE' AS phase, ni.id, ni.label, ni.url, ni.sort_order, ni.is_highlight
  FROM nav_menu_items ni
  JOIN nav_menus nm ON nm.id = ni.menu_id
 WHERE nm.handle = 'main-menu'
 ORDER BY ni.sort_order, ni.id;

-- ── 2. Vanities opens the mega menu ────────────────────────────────
-- Without this the mega menu silently disappears the moment the header
-- starts reading this table: is_mega defaults to 0 and header.ejs only
-- renders the flyout for an item flagged megaMenu.
UPDATE nav_menu_items ni
  JOIN nav_menus nm ON nm.id = ni.menu_id
   SET ni.is_mega = 1
 WHERE nm.handle = 'main-menu'
   AND ni.url LIKE '/collections/bathroom-vanities%'
   AND ni.label = 'Vanities';

-- ── 3. Faucets preselect uses the param the sidebar posts ──────────
-- ?type= and ?product_type= both filter to 149, but the sidebar checkbox
-- is name="product_type". Landing on ?type= shows a filtered grid with
-- every box unticked, which reads as a bug.
UPDATE nav_menu_items ni
  JOIN nav_menus nm ON nm.id = ni.menu_id
   SET ni.url = '/collections/faucets?product_type=Bathroom+Faucets'
 WHERE nm.handle = 'main-menu'
   AND ni.url IN ('/collections/faucets',
                  '/collections/faucets?type=Bathroom+Faucets');

-- ── Verify ─────────────────────────────────────────────────────────
-- Same row count as BEFORE. Vanities is_mega=1. Faucets on product_type.
SELECT 'AFTER' AS phase, ni.label, ni.url, ni.sort_order, ni.is_highlight, ni.is_mega
  FROM nav_menu_items ni
  JOIN nav_menus nm ON nm.id = ni.menu_id
 WHERE nm.handle = 'main-menu'
 ORDER BY ni.sort_order, ni.id;

-- Exactly one mega item, or the flyout is missing or doubled.
SELECT 'MEGA COUNT (expect 1)' AS phase, COUNT(*) AS n
  FROM nav_menu_items ni
  JOIN nav_menus nm ON nm.id = ni.menu_id
 WHERE nm.handle = 'main-menu' AND ni.is_mega = 1;

-- Footer menus untouched.
SELECT 'FOOTER UNTOUCHED' AS phase, nm.handle, COUNT(*) AS items
  FROM nav_menu_items ni
  JOIN nav_menus nm ON nm.id = ni.menu_id
 WHERE nm.handle IN ('footer-shop','footer-help','footer-company')
 GROUP BY nm.handle
 ORDER BY nm.handle;

COMMIT;
