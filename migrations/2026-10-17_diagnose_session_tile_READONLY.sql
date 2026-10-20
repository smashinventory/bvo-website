/* 2026-10-17 — why does "Viewed a product" still read 7,951 against GA4's 322?
 *
 * READ ONLY. No INSERT, no UPDATE, no DDL. Safe to run on production.
 *
 * THE FACTS WE HAVE. The session fix deployed 2026-10-15 20:20 (commit
 * 9390364). The backfill ran earlier that day and took the 7-day tile from
 * 16,383 to 683. This morning the same 7-day tile reads 7,951 while GA4
 * reports 322 sessions for the window. So either the backfill left rows
 * behind, or new inflation is still arriving after the fix.
 *
 * Those two have opposite remedies, so the question has to be settled before
 * anything is changed. Query 1 is the decisive one: it splits the tile by day
 * and by whether the session id is synthetic.
 *
 * The tile's own filter, mirrored exactly from siteAnalyticsController.funnel:
 *   COUNT(DISTINCT session_id) WHERE is_bot = 0 AND event_name = 'view_item'
 */

/* ── 1. THE DECISIVE ONE ─────────────────────────────────────────────────
   Per day: how many unflagged view_item sessions, split by synthetic vs
   real cookie-backed id.

   HOW TO READ IT. The fix went live midday-ish on the 15th.
     - If 10-16 and 10-17 are in the HUNDREDS -> the fix works and the 7,951
       is pre-fix residue the backfill missed. Remedy: re-run the backfill
       over the earlier days.
     - If 10-16 and 10-17 are in the THOUSANDS -> the fix is not collapsing
       what we expected. Remedy is in the code, not the data.
     - synthetic_sessions vs real_sessions says WHICH half is inflated.
       Synthetic ids are one per (ip, user-agent, accept-language, day), so a
       large synthetic count means many distinct IPs, not many requests. */
SELECT
  DATE(occurred_at)                                        AS day,
  COUNT(DISTINCT session_id)                               AS viewed_tile,
  COUNT(DISTINCT CASE WHEN session_id LIKE 'anon-%'
                      THEN session_id END)                 AS synthetic_sessions,
  COUNT(DISTINCT CASE WHEN session_id NOT LIKE 'anon-%'
                      THEN session_id END)                 AS real_sessions,
  COUNT(*)                                                 AS view_events
FROM site_events
WHERE is_bot = 0
  AND event_name = 'view_item'
  AND occurred_at >= DATE_SUB(CURDATE(), INTERVAL 8 DAY)
GROUP BY DATE(occurred_at)
ORDER BY day;

/* ── 2. ARE THE SYNTHETIC SESSIONS STILL SINGLETONS? ────────────────────
   The whole point of the synthetic id is that one cookieless client's whole
   crawl collapses into ONE session for the day. If it is working, synthetic
   sessions should carry MANY events each. If most still carry exactly one,
   the id is not collapsing anything and every hit is still its own session.

   events_per_session is the number to look at. Near 1.0 means the fix is
   not doing its job. */
SELECT
  CASE WHEN session_id LIKE 'anon-%' THEN 'synthetic' ELSE 'real' END AS id_kind,
  COUNT(DISTINCT session_id)                          AS sessions,
  COUNT(*)                                            AS events,
  ROUND(COUNT(*) / COUNT(DISTINCT session_id), 2)     AS events_per_session,
  SUM(CASE WHEN ev = 1 THEN 1 ELSE 0 END)             AS singleton_sessions
FROM (
  SELECT session_id, COUNT(*) AS ev
  FROM site_events
  WHERE is_bot = 0
    AND occurred_at >= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
  GROUP BY session_id
) per
JOIN site_events USING (session_id)
WHERE is_bot = 0
  AND occurred_at >= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
GROUP BY id_kind;

/* ── 3. WHAT DO THE UNFLAGGED CLIENTS LOOK LIKE? ────────────────────────
   If the heavy hitters are one path hit thousands of times, or a referrer
   that is always empty, that is a crawler the UA regex and the header
   heuristic both missed - which is exactly what happened on 2026-10-01.

   Top paths among unflagged synthetic sessions over the last 2 days. */
SELECT
  path,
  COUNT(DISTINCT session_id) AS sessions,
  COUNT(*)                   AS events
FROM site_events
WHERE is_bot = 0
  AND session_id LIKE 'anon-%'
  AND occurred_at >= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
GROUP BY path
ORDER BY events DESC
LIMIT 15;

/* ── 4. SANITY: did the backfill actually stick? ────────────────────────
   Confirms the 2026-10-15 migration's work is still in place and tells us
   how much of the window is flagged versus not. If flagged is large and
   unflagged is also large, the backfill ran but its singleton rule no
   longer catches what is arriving. */
SELECT
  DATE(occurred_at)                                  AS day,
  SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END)        AS flagged_events,
  SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END)        AS unflagged_events
FROM site_events
WHERE occurred_at >= DATE_SUB(CURDATE(), INTERVAL 8 DAY)
GROUP BY DATE(occurred_at)
ORDER BY day;
