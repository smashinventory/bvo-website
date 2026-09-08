-- ═══════════════════════════════════════════════════════════════════════
-- 015_footer_column_menus.sql
--
-- Make the footer editable from the Menu Manager, in three columns.
--
-- ── THE PROBLEM THIS FIXES ────────────────────────────────────────────
-- Two systems both claimed to own the footer, and the wrong one won.
--
--   * Menu Manager wrote to nav_menus/nav_menu_items under handle
--     'footer'. Six correct links. Nothing ever read them —
--     megaMenuData.js only queries WHERE nm.handle = 'main-menu'.
--   * footer.ejs rendered themeSettings.footer.col_*_links instead, whose
--     URLs were /pages/shipping, /pages/returns, /pages/contact,
--     /pages/about and /pages/privacy.
--
-- Migration 012 seeded the pages as shipping-policy, returns-policy,
-- contact-us, about-us and privacy-policy. So ALL FIVE footer links were
-- 404s — verified live 8 Sept 2026 — and had been since the footer was
-- built. Terms & Conditions was not linked at all.
--
-- Nothing errored. A 404 on a footer link is invisible until someone
-- clicks it, and an admin screen that saves to a table nobody reads looks
-- exactly like one that works.
--
-- ── THE SHAPE ─────────────────────────────────────────────────────────
-- nav_menus is keyed by handle, so one menu per column costs nothing:
--     footer-shop  →  Shop
--     footer-help  →  Help
--     footer-company → Company
--
-- Column HEADINGS stay in theme settings (col_shop_heading and friends),
-- so "Help" can be renamed to "Customer Service" without touching menus.
--
-- ── THE OLD 'footer' MENU IS DELETED ──────────────────────────────────
-- Deliberate, and the only destructive step here. Its six links are
-- recreated below across the three column menus, so nothing is lost.
--
-- Leaving it would put a menu in the Menu Manager sidebar that saves
-- happily and changes nothing — which is the exact defect this migration
-- exists to remove. One editable source of truth, or none.
-- ═══════════════════════════════════════════════════════════════════════

-- ── The three column menus ────────────────────────────────────────────
INSERT IGNORE INTO nav_menus (name, handle) VALUES
  ('Footer — Shop',    'footer-shop'),
  ('Footer — Help',    'footer-help'),
  ('Footer — Company', 'footer-company');

-- ── Shop column ───────────────────────────────────────────────────────
-- Matches the current live footer. These were never broken; they point at
-- collections, not pages.
INSERT IGNORE INTO nav_menu_items (menu_id, label, url, sort_order)
SELECT id, 'Bathroom Vanities', '/collections/bathroom-vanities', 10 FROM nav_menus WHERE handle='footer-shop';
INSERT IGNORE INTO nav_menu_items (menu_id, label, url, sort_order)
SELECT id, 'Mirrors',           '/collections/bathroom-mirrors',  20 FROM nav_menus WHERE handle='footer-shop';
INSERT IGNORE INTO nav_menu_items (menu_id, label, url, sort_order)
SELECT id, 'Faucets',           '/collections/faucets',           30 FROM nav_menus WHERE handle='footer-shop';
INSERT IGNORE INTO nav_menu_items (menu_id, label, url, sort_order)
SELECT id, 'Sale',              '/collections/sale',              40 FROM nav_menus WHERE handle='footer-shop';

-- ── Help column ───────────────────────────────────────────────────────
-- Slugs verified against migration 012. These are the corrected URLs.
INSERT IGNORE INTO nav_menu_items (menu_id, label, url, sort_order)
SELECT id, 'Shipping Policy',   '/pages/shipping-policy', 10 FROM nav_menus WHERE handle='footer-help';
INSERT IGNORE INTO nav_menu_items (menu_id, label, url, sort_order)
SELECT id, 'Returns & Refunds', '/pages/returns-policy',  20 FROM nav_menus WHERE handle='footer-help';
INSERT IGNORE INTO nav_menu_items (menu_id, label, url, sort_order)
SELECT id, 'Contact Us',        '/pages/contact-us',      30 FROM nav_menus WHERE handle='footer-help';

-- ── Company column ────────────────────────────────────────────────────
-- Terms & Conditions added. An unlinked Terms page is close to
-- unenforceable — the customer has to be able to find it.
INSERT IGNORE INTO nav_menu_items (menu_id, label, url, sort_order)
SELECT id, 'About Us',           '/pages/about-us',             10 FROM nav_menus WHERE handle='footer-company';
INSERT IGNORE INTO nav_menu_items (menu_id, label, url, sort_order)
SELECT id, 'Privacy Policy',     '/pages/privacy-policy',       20 FROM nav_menus WHERE handle='footer-company';
INSERT IGNORE INTO nav_menu_items (menu_id, label, url, sort_order)
SELECT id, 'Terms & Conditions', '/pages/terms-and-conditions', 30 FROM nav_menus WHERE handle='footer-company';

-- ── Remove the old flat menu ──────────────────────────────────────────
-- Its items cascade (FK ON DELETE CASCADE). Content preserved above.
DELETE FROM nav_menus WHERE handle = 'footer';

-- ── Verification ──────────────────────────────────────────────────────
-- Expect: 3 menus, 4 + 3 + 3 = 10 items, and every /pages/ URL matching a
-- real, visible page. The second query should return ZERO rows.
SELECT nm.handle, COUNT(ni.id) AS items
FROM nav_menus nm
LEFT JOIN nav_menu_items ni ON ni.menu_id = nm.id
WHERE nm.handle LIKE 'footer-%'
GROUP BY nm.handle ORDER BY nm.handle;

SELECT ni.label, ni.url AS broken_link
FROM nav_menu_items ni
JOIN nav_menus nm ON nm.id = ni.menu_id
WHERE nm.handle LIKE 'footer-%'
  AND ni.url LIKE '/pages/%'
  AND NOT EXISTS (
    SELECT 1 FROM pages p
    WHERE CONCAT('/pages/', p.slug) = ni.url AND p.is_visible = 1
  );
