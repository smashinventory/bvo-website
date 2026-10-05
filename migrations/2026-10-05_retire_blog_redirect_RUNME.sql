-- ════════════════════════════════════════════════════════════════════
--  Retire /blog — one redirect row. 2026-10-05
--
--  The /blog section was scaffolded at the start of the project and
--  abandoned within days when the content strategy moved to
--  /inspiration. Confirmed before removing it:
--
--    * blog_posts has never held a published post
--    * nav_menu_items contains no /blog row, so nothing on the storefront
--      ever linked to it (verified by query, zero rows)
--    * the Shopify /blogs/news/* redirects already point at /inspiration
--      guides, not at /blog — see BLOG_MAP in scripts/buildRedirectMap.js
--
--  So there is no link equity to preserve and nothing to migrate. The
--  code is gone in the same commit as this file.
--
--  WHY A 301 AND NOT A 404. /blog never had content, so a 404 would be
--  honest. But it costs one row to be certain, and the cost of being
--  wrong is a dead end for anyone who ever pasted the URL somewhere we
--  cannot see. /inspiration is where a reader expecting articles should
--  land.
--
--  NO ROW FOR /blog/<slug>. The map is exact-match, not a pattern, and
--  no post slug ever existed on this domain to be linked. Those will
--  404, which is correct — they were never real URLs here.
--
--  SAFE TO RE-RUN: ON DUPLICATE KEY UPDATE, and old_path is UNIQUE.
-- ════════════════════════════════════════════════════════════════════

INSERT INTO url_redirects (old_path, destination, status_code, confidence, note)
VALUES (
  '/blog',
  'https://www.bathroomvanitiesoutlet.com/inspiration',
  301,
  'HIGH',
  'Blog section retired 2026-10-05 - never held a post; Inspiration is the content hub'
)
ON DUPLICATE KEY UPDATE
  destination = VALUES(destination),
  status_code = VALUES(status_code),
  confidence  = VALUES(confidence),
  note        = VALUES(note);

-- ── Verify ──────────────────────────────────────────────────────────
-- Expect exactly one row, 301, pointing at /inspiration.
SELECT old_path, destination, status_code, confidence
FROM   url_redirects
WHERE  old_path = '/blog';

-- And confirm nothing else in the table still points INTO the dead
-- section. Expect zero rows.
SELECT old_path, destination
FROM   url_redirects
WHERE  destination LIKE '%bathroomvanitiesoutlet.com/blog%';
