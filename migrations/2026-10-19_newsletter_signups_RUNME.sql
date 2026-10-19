-- ─────────────────────────────────────────────────────────────────────────
-- 2026-10-19  newsletter_signups — the table the code has written to since July
--
-- ⚠️ THIS TABLE HAS NEVER EXISTED. Not dropped — never created. It does not
-- appear in the 2026-09-29 schema dump, and there is no migration for it
-- anywhere in the repo.
--
-- WHAT THAT COST. accountController.newsletter has run
--     INSERT IGNORE INTO newsletter_signups (email, source, created_at)
-- since 7bf20e2 (2026-07-23). Every call has failed ER_NO_SUCH_TABLE. The
-- handler catches it, so the visitor sees the success message and the input
-- disappears — the form has looked like it worked, every time, for three
-- months.
--
-- The handler also runs
--     UPDATE customers SET accepts_marketing = 1 WHERE email = ?
-- which only matches an EXISTING customer. So a signup from someone who had
-- ordered before was partly captured (the opt-in flag), and a signup from a
-- brand-new visitor was lost completely. The second case is the one that
-- matters: those are the people the form exists to capture.
--
-- Confirmed lost on 2026-10-19 18:47:37: h.melotto@melottogroup.com.
-- Every other lost address is in the server log — see
-- scripts/recoverNewsletterSignups.js, which parses them back out.
--
-- b4076ef (2026-09-02, "remove the silent-failure pattern site-wide") added
-- the logging that surfaced this. It replaced `.catch(() => {})` with a
-- logged catch and wrote "newsletter_signups may not exist yet" in a comment.
-- That was right about the symptom and did not finish the job: the log line
-- it added sat in production for seven weeks before anyone read it. A catch
-- that logs is better than one that swallows, and neither is a table.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `newsletter_signups` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,

  -- ⚠️ UNIQUE IS LOAD-BEARING. The handler uses INSERT IGNORE to make a
  -- repeat signup a no-op instead of an error. Without a unique index there
  -- is nothing for IGNORE to collide with, and someone who subscribes twice
  -- gets two rows — which becomes two sends, which becomes an unsubscribe.
  `email`      VARCHAR(255)  NOT NULL,

  -- Where it came from: 'homepage' today, 'recovered' for rows restored from
  -- the logs by scripts/recoverNewsletterSignups.js. Kept as a plain string
  -- rather than an enum so a new capture point needs no migration.
  `source`     VARCHAR(40)   NOT NULL DEFAULT 'homepage',

  -- For recovered rows this is the ORIGINAL time from the log line, not the
  -- time of recovery. A subscriber's age is a real fact about them and the
  -- recovery should not rewrite it.
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- ── Brevo sync state ────────────────────────────────────────────────
  -- NULL means never pushed. The push is best-effort and happens AFTER the
  -- row is written, so a Brevo outage costs the sync and never the address.
  -- A later job or a manual export can find the stragglers with
  --     WHERE brevo_synced_at IS NULL
  `brevo_synced_at` DATETIME      NULL,
  `brevo_error`     VARCHAR(255)  NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_email` (`email`),
  KEY `idx_created`    (`created_at`),
  KEY `idx_unsynced`   (`brevo_synced_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── The one address we know was lost, restored by hand ──────────────────
-- From the server log, 2026-10-19 18:47:37. INSERT IGNORE so re-running this
-- file is harmless, and so it does not fight the recovery script if that
-- picks up the same line.
--
-- brevo_synced_at stays NULL: this person has never been pushed to Brevo and
-- should be, once the list id is configured.
INSERT IGNORE INTO `newsletter_signups` (`email`, `source`, `created_at`)
VALUES ('h.melotto@melottogroup.com', 'recovered', '2026-10-19 18:47:37');


-- ─────────────────────────────────────────────────────────────────────────
-- Verify:
--   SHOW COLUMNS FROM newsletter_signups;      -- expect 6 columns
--   SHOW INDEX  FROM newsletter_signups WHERE Key_name = 'uniq_email';
--     -- expect ONE row with Non_unique = 0. If this is missing, INSERT IGNORE
--     -- silently stops deduplicating and repeat subscribers get doubled.
--   SELECT * FROM newsletter_signups;          -- expect the one recovered row
-- ─────────────────────────────────────────────────────────────────────────
