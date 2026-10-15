-- ─────────────────────────────────────────────────────────────────────────
-- 2026-10-15  Retire the sessions that never existed
--
-- THE BUG, for the record. site_events.session_id was req.sessionID.
-- express-session mints a fresh id for any client that does not return the
-- cookie, so one cookieless crawler wrote one brand-new "session" PER
-- REQUEST. The Site Analytics tile read "Viewed a product: 15,463 sessions"
-- for a week in which GA4 counted 389 sessions in total. The SQL behind the
-- tile was correct and the label was correct; the data was 40x inflated.
--
-- The code fix (src/services/siteEvents.js) stops new rows inflating. It
-- cannot repair the rows already written, and the 7/30/90-day windows will
-- keep reporting the old figures until they age out. Hence this.
--
-- HOW A PHANTOM SESSION IS IDENTIFIED. A session_id that appears exactly
-- ONCE in the whole table. That is not a heuristic about behaviour, it is a
-- consequence of how the ids were minted: an id is reused only when the
-- client sent the cookie back, and a client that sent the cookie back went
-- on to fire more events. One event under a unique id means the cookie was
-- never returned.
--
-- WHAT IT COSTS. A genuine single-page bounce — arrive on a product page,
-- read it, leave — also produces exactly one event under one id, and will
-- be reclassified here. That visitor is real. The trade is deliberate: a
-- one-page bounce contributes nothing to a funnel about purchase intent,
-- and leaving the crawl in place makes every rate on the page meaningless.
-- Going forward the code fix handles this better than this backfill can,
-- because it can see the headers at request time.
--
-- NOTHING IS DELETED. These rows are flagged is_bot = 1, which every
-- dashboard query already filters, and which is reported as a share on the
-- page. The raw events remain for anyone who wants to re-examine this.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. BEFORE. Keep this output — it is the only record of the old figures.
SELECT 'before' AS stage,
       COUNT(*)                                     AS rows_total,
       SUM(is_bot = 1)                              AS rows_flagged_bot,
       COUNT(DISTINCT session_id)                   AS sessions_all,
       COUNT(DISTINCT CASE WHEN is_bot = 0 THEN session_id END) AS sessions_human,
       COUNT(DISTINCT CASE WHEN is_bot = 0 AND event_name = 'view_item'
                           THEN session_id END)     AS viewed_tile
  FROM site_events;

-- 2. The singleton session ids, into a temp table. Done in two steps rather
--    than as a subquery in the UPDATE: MySQL will not let an UPDATE read a
--    subquery on the table it is updating, and materialising it also means
--    the count below describes exactly what is about to change.
DROP TEMPORARY TABLE IF EXISTS _singleton_sessions;
CREATE TEMPORARY TABLE _singleton_sessions (
  session_id VARCHAR(128) NOT NULL,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB
SELECT session_id
  FROM site_events
 WHERE session_id IS NOT NULL
   AND is_bot = 0
 GROUP BY session_id
HAVING COUNT(*) = 1;

SELECT COUNT(*) AS singleton_sessions_to_flag FROM _singleton_sessions;

-- 3. Flag them.
UPDATE site_events e
  JOIN _singleton_sessions s ON s.session_id = e.session_id
   SET e.is_bot = 1
 WHERE e.is_bot = 0;

DROP TEMPORARY TABLE IF EXISTS _singleton_sessions;

-- 4. AFTER. viewed_tile is the number the dashboard tile will now show.
--    Expect it to land in the same order of magnitude as GA4's sessions for
--    the same window. If it does not, stop and say so rather than adjusting
--    this file until it does.
SELECT 'after' AS stage,
       COUNT(*)                                     AS rows_total,
       SUM(is_bot = 1)                              AS rows_flagged_bot,
       COUNT(DISTINCT session_id)                   AS sessions_all,
       COUNT(DISTINCT CASE WHEN is_bot = 0 THEN session_id END) AS sessions_human,
       COUNT(DISTINCT CASE WHEN is_bot = 0 AND event_name = 'view_item'
                           THEN session_id END)     AS viewed_tile
  FROM site_events;
