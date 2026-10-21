-- ════════════════════════════════════════════════════════════════════════
-- 2026-10-21 — products.is_deal: the manual override for the Deals section
-- 45-point scope item 40, Deals page.
--
-- WHAT IT IS FOR. The Deals section admits a product two ways:
--
--   1. AUTOMATICALLY — its MSRP→price discount is at or above the
--      threshold (seo/deals setting, default 37.5%).
--   2. MANUALLY — this flag, ticked on the product edit page.
--
-- ⚠️ WHY THE THRESHOLD IS ABOVE EVERY CURRENT PRODUCT, ON PURPOSE.
-- Measured on live 2026-10-21: 5,222 active products carry a discount and
-- the DEEPEST is 34.6%. Nothing reaches 35%. That is because James Martin
-- pricing is formulaic — importJamesMartinFeed.js:1063 — `price` is JM's
-- MAP and `compare_price` is their MSRP, with MAP = MSRP x 0.66, i.e. 34%
-- off by construction.
--
-- So a 37.5% threshold sits ABOVE normal pricing and admits NOTHING by
-- default. The section is empty until the owner actually marks something
-- down. That is the intended behaviour, not a bug: the filter exists to
-- exclude ordinary pricing, so only genuine markdowns appear.
--
-- ⚠️ AND THAT IS WHY THIS FLAG IS NEEDED RATHER THAN OPTIONAL. With the
-- threshold above the catalogue ceiling, the flag is the ONLY way to seed
-- the section. A threshold alone would ship an empty page.
--
-- The owner's operating model (2026-10-21), recorded so the behaviour is
-- not mistaken for a fault later:
--   • ER Vanities and Huntington Brass are not on a nightly feed, so their
--     markdowns persist — these are the backbone of the section.
--   • James Martin markdowns are deliberately temporary: jmsync.sh runs at
--     04:30 and 16:30, so a hand-set JM price reverts within ~12 hours.
--     The owner uses that as the expiry mechanism.
--   • A manually-flagged product whose price has reverted still shows its
--     normal MSRP→MAP discount, which is a real discount. The shopper
--     cannot see the threshold, so there is no contradiction on the page.
--
-- RUN AS: one paste into phpMyAdmin / hPanel SQL. MariaDB.
-- ════════════════════════════════════════════════════════════════════════

-- ⚠️ NO information_schema ANYWHERE IN THIS FILE, AND THAT IS DELIBERATE.
-- The first version used it and failed on live with:
--     #1044 - Access denied for user '...'@'127.0.0.1' to database
--     'information_schema'
-- Hostinger shared hosting does not grant the DB user access to it. SHOW
-- COLUMNS / SHOW INDEX return the same facts and need no extra privilege.
-- Any future migration on this project must follow the same rule.

-- ── 1. BEFORE ──────────────────────────────────────────────────────────
SHOW COLUMNS FROM products LIKE 'is_deal';
-- EXPECTED: EMPTY RESULT (zero rows) before running.
-- If it returns a row, this has already been applied — skip to step 4.

-- ── 2. THE COLUMN ──────────────────────────────────────────────────────
-- Mirrors is_featured exactly: TINYINT(1) NOT NULL DEFAULT 0. Deliberately
-- the same shape, because the admin checkbox, the extractor and the queries
-- all follow is_featured's established pattern and a different type here
-- would mean a different code path for no reason.
-- IF NOT EXISTS so a re-run is a no-op rather than error 1060. MariaDB
-- supports it on ADD COLUMN; MySQL does not, and this DB is MariaDB.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_deal TINYINT(1) NOT NULL DEFAULT 0
  COMMENT 'Force this product into the Deals section regardless of discount %. See 2026-10-21 migration.';

-- ── 3. THE INDEX ───────────────────────────────────────────────────────
-- The Deals query filters on (is_active, is_deal). Without this, admitting
-- a handful of flagged products means scanning all 5,297 rows.
--
-- ⚠️ Composite, not a bare index on is_deal. A boolean column alone has a
-- cardinality of 2 and MariaDB would usually ignore it; leading with
-- is_active — which every storefront query already filters on — makes it
-- selective enough to be chosen.
ALTER TABLE products
  ADD INDEX IF NOT EXISTS idx_products_active_deal (is_active, is_deal);

-- ── 4. AFTER ───────────────────────────────────────────────────────────
SHOW COLUMNS FROM products LIKE 'is_deal';
-- EXPECTED: exactly one row —
--   Field = is_deal | Type = tinyint(1) | Null = NO | Default = 0

SHOW INDEX FROM products WHERE Key_name = 'idx_products_active_deal';
-- EXPECTED: two rows — Seq_in_index 1 = is_active, 2 = is_deal.

SELECT COUNT(*) AS flagged_products FROM products WHERE is_deal = 1;
-- EXPECTED: 0 — nothing is flagged until the owner ticks a box.

-- ── ROLLBACK ───────────────────────────────────────────────────────────
-- ALTER TABLE products DROP INDEX idx_products_active_deal;
-- ALTER TABLE products DROP COLUMN is_deal;
