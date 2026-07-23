-- ============================================================
--  Migration 015 — App Settings Table
--  BathroomVanitiesOutlet.com
--
--  Creates the app_settings key-value table used to persist
--  theme settings in the database.  This makes theme settings
--  survive Hostinger fresh-deploy wipes (the data/ directory is
--  not tracked by git, so theme_settings.json is lost on a
--  full redeploy).  The Node.js server now:
--    • On startup: syncs settings file → DB (if file exists).
--    • On startup: restores file from DB (if file is missing).
--    • On every theme save: writes to file AND to DB.
--
--  Safe to re-run — uses CREATE TABLE IF NOT EXISTS.
--  Run in phpMyAdmin against the bvo_website database.
-- ============================================================


-- ── 1. Create app_settings key-value store ────────────────────
CREATE TABLE IF NOT EXISTS `app_settings` (
  `key`        VARCHAR(100)  NOT NULL,
  `value`      MEDIUMTEXT,
  `updated_at` TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
