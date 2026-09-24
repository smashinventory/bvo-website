-- ═══════════════════════════════════════════════════════════════════
--  bundle_catalogue — the pre-built bundle builder payload
--
--  WHY A TABLE RATHER THAN THE IN-MEMORY CACHE IT REPLACES
--  ──────────────────────────────────────────────────────
--  The old cache was a module-level object with a 15-minute TTL. Two
--  problems, and the second is the one that was actually hurting:
--
--  1. TIME-based invalidation on EVENT-based data. The catalogue changes
--     when the JM feed lands (04:30 UTC) and at no other time. A 15-minute
--     clock rebuilds ~96 times a day to capture one real change.
--
--  2. It did not survive a restart. warmCatalogue() starts a rebuild at
--     boot, but getCataloguePayload() only skips the wait once the cache
--     is populated — so for the ~12 seconds after every deploy or app
--     wake-up, the first visitor waited out the whole rebuild. On a site
--     with sparse traffic that is close to every real visitor.
--
--  A row in a table is immune to both. It is written once a night, after
--  the feed, and read in ~1ms.
--
--  SINGLE ROW BY DESIGN. id is pinned to 1 and the writer upserts, so
--  there is exactly one current catalogue and no way to accumulate
--  history nobody reads. build_ms and the counts are kept so a slow or
--  shrinking build is visible without re-running it.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bundle_catalogue (
  id            TINYINT UNSIGNED NOT NULL DEFAULT 1,

  -- The complete payload the page needs, JSON-encoded. ~440 KB today.
  -- LONGTEXT rather than JSON: nothing queries inside it, it is read
  -- whole and parsed once, and LONGTEXT avoids MySQL's JSON validation
  -- cost on a write this large.
  payload       LONGTEXT NOT NULL,

  built_at      DATETIME NOT NULL,
  build_ms      INT UNSIGNED NULL,

  -- Which trigger produced this build: 'cron', 'admin', 'boot', 'manual'.
  -- A catalogue that only ever says 'boot' means the nightly cron is not
  -- firing and the app has been quietly covering for it — exactly how the
  -- jmv_rollup cron failure went unnoticed for weeks.
  source        VARCHAR(16) NOT NULL DEFAULT 'cron',

  -- Row counts per step. Cheap to store, and the only way to notice that
  -- a build "succeeded" while returning half the catalogue.
  counts_json   VARCHAR(500) NULL,

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
