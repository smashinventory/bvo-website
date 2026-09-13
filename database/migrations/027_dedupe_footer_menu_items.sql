-- ════════════════════════════════════════════════════════════════════
--  027 — every footer link renders twice
--
--  SYMPTOM: the public footer shows Bathroom Vanities, Bathroom Vanities,
--  Mirrors, Mirrors, Faucets, Faucets … in all three columns. Spotted on
--  the live collections page 2026-09-13.
--
--  CAUSE: migration 015 seeds the footer items with
--
--      INSERT IGNORE INTO nav_menu_items (menu_id, label, url, sort_order)
--      SELECT id, 'Mirrors', '/collections/bathroom-mirrors', 20
--        FROM nav_menus WHERE handle='footer-shop';
--
--  IGNORE only suppresses a UNIQUE KEY violation. nav_menu_items has no
--  unique key — PRIMARY KEY (id) and a NON-unique idx_menu_items_sort — so
--  there is nothing to violate and the INSERT runs unconditionally. The
--  migration looked idempotent and was not. Run twice, seeded twice.
--
--  nav_menus escaped because it HAS `UNIQUE KEY handle`, which is why the
--  menus are single and only the items doubled. The difference between the
--  two tables is the whole bug.
--
--  Measured before this ran: 10 labels, 2 copies each, ids 15-24 and 25-34.
--  Contiguous blocks, so exactly two runs and no hand-edits in between.
--
--  THE ORDER OF THE TWO STEPS IS LOAD-BEARING. The DELETE runs first and
--  the UNIQUE KEY second, so the constraint IS the verification: if the
--  dedupe missed anything, ADD UNIQUE fails loudly with #1062 rather than
--  succeeding on bad data. A separate "verify zero duplicates" SELECT could
--  pass vacuously; this cannot.
-- ════════════════════════════════════════════════════════════════════

-- Before — expect 10 rows, copies = 2.
SELECT nm.handle, ni.label, COUNT(*) AS copies,
       GROUP_CONCAT(ni.id ORDER BY ni.id) AS ids
  FROM nav_menu_items ni
  JOIN nav_menus nm ON nm.id = ni.menu_id
 GROUP BY nm.handle, ni.label, ni.url
HAVING COUNT(*) > 1
 ORDER BY nm.handle, ni.label;

-- ── 1. Delete the copies, keep the original ─────────────────────────
--  Keeps the LOWEST id per (menu_id, label, url). Deliberate: the first
--  seeding is the one any later Menu Manager edit would have been applied
--  to, so keeping it preserves hand-edits. Keeping the highest would throw
--  them away.
--
--  The self-join through a derived table is required. MySQL refuses
--  "DELETE FROM t WHERE id NOT IN (SELECT ... FROM t)" with error #1093,
--  and materialising the keep-list in a subquery is the standard way round
--  it. Do not "simplify" this back.
DELETE ni
  FROM nav_menu_items ni
  JOIN (
        SELECT MIN(id) AS keep_id, menu_id, label, url
          FROM nav_menu_items
         GROUP BY menu_id, label, url
       ) k
    ON  k.menu_id = ni.menu_id
   AND  k.label   = ni.label
   AND  k.url     = ni.url
 WHERE ni.id <> k.keep_id;

-- ── 2. Make INSERT IGNORE mean what migration 015 thought it meant ──
--  With this in place 015 becomes genuinely idempotent, and so does every
--  future seeder against this table. Adding it is what stops a third run
--  from recreating the problem.
--
--  Key length: menu_id 4 + label 255*4 + url 500*4 = 3024 bytes, inside
--  InnoDB's 3072-byte limit for DYNAMIC row format. If this errors with
--  #1071 the table is on COMPACT/REDUNDANT (767-byte limit) and the fix is
--  ROW_FORMAT=DYNAMIC first, NOT a shorter prefix — a prefix index would
--  make two long URLs sharing their first N characters collide and start
--  silently dropping legitimate menu items.
--  IF NOT EXISTS so the file is re-runnable. Without it a second run dies
--  on #1061 "Duplicate key name" — and this migration has ALREADY been
--  applied to production, so the next person to run the folder would hit
--  exactly that. Caught by the push-script gate, not by reading it.
--
--  MariaDB-specific: ALTER TABLE ... ADD KEY IF NOT EXISTS is a MariaDB
--  extension and is NOT valid in MySQL proper. This database is MariaDB.
--  The DELETE above is naturally idempotent — once deduped it matches
--  nothing — so the two steps together are now safe to re-run.
--
--  The version executed on 2026-09-13 did not carry this guard. Re-running
--  the current file against production is a no-op, not a repair.
ALTER TABLE nav_menu_items
  ADD UNIQUE KEY IF NOT EXISTS uniq_menu_item (menu_id, label, url);

-- ── Verify ──────────────────────────────────────────────────────────
--  Expect ZERO rows. If step 1 failed, step 2 already errored and we never
--  reached here.
SELECT nm.handle, ni.label, COUNT(*) AS copies
  FROM nav_menu_items ni
  JOIN nav_menus nm ON nm.id = ni.menu_id
 GROUP BY nm.handle, ni.label, ni.url
HAVING COUNT(*) > 1;

--  The constraint exists. SHOW INDEX, not information_schema — the app user
--  is denied information_schema on this host (#1044), and phpMyAdmin blames
--  the following statement for the refusal. See migration 026.
SHOW INDEX FROM nav_menu_items WHERE Key_name = 'uniq_menu_item';

--  The footer as it will now render — expect 10 rows, 4 shop, 3 help,
--  3 company, each label once.
SELECT nm.handle, ni.label, ni.url, ni.sort_order
  FROM nav_menu_items ni
  JOIN nav_menus nm ON nm.id = ni.menu_id
 WHERE nm.handle IN ('footer-shop','footer-help','footer-company')
 ORDER BY nm.handle, ni.sort_order, ni.id;

-- ────────────────────────────────────────────────────────────────────
--  ⚠ THE FOOTER WILL NOT CHANGE IMMEDIATELY.
--
--  megaMenuData.js caches the CMS read in memory for 10 minutes and has no
--  cache-bust hook. After running this, either wait out the TTL or restart
--  the app. Seeing duplicates straight afterwards does not mean the
--  migration failed — re-run the verify SELECT above, which reads the
--  database directly.
-- ────────────────────────────────────────────────────────────────────
