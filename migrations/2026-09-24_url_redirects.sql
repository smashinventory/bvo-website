-- ═══════════════════════════════════════════════════════════════════
--  url_redirects — the Shopify -> Node.js migration map, 2026-09-24
--
--  WHY A TABLE AND NOT A CODE CONSTANT
--  ──────────────────────────────────
--  Destinations change after cutover and the person changing them is not
--  always going to be someone who can deploy. Two known cases already:
--
--    * the two Norcross/Atlanta location pages are being rebuilt; their
--      rows must be re-pointed at the new pages once those exist
--    * products come back into stock, or move between BVO and GVS
--
--  A constant in a .js file makes each of those a code change, a review
--  and a deploy. A table makes it an UPDATE.
--
--  WHAT IS NOT IN HERE
--  ───────────────────
--  Self-redirects. 158 of the 659 indexed old URLs are identical on the
--  new site (/products/<sku-slug> mostly) and already resolve 200. Loading
--  those would make the middleware redirect a URL to itself, forever. The
--  loader drops them and the gate re-checks. See scripts/loadRedirectMap.js.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS url_redirects (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Path only, no scheme or host, no trailing slash, lowercase.
  -- Query string INCLUDED when it is load-bearing (the /collections/types
  -- search URLs differ only by ?constraint=), otherwise absent.
  old_path      VARCHAR(500) NOT NULL,

  -- Absolute URL. Cross-domain targets are written NON-www for GVS, which
  -- canonicalises that way — writing www would add a hop to every one.
  destination   VARCHAR(500) NULL,

  -- 301 or 410. 410 means "deliberately gone", not "we could not decide".
  status_code   SMALLINT UNSIGNED NOT NULL DEFAULT 301,

  -- HIGH  = exact match, verified against a live sitemap
  -- MED   = category/filter landing, or one attribute differs
  -- Kept so a future audit can tell a verified row from a judgement call.
  confidence    ENUM('HIGH','MED','LOW') NOT NULL DEFAULT 'MED',

  -- Plain English. This is what makes the table reviewable a year from now.
  note          VARCHAR(255) NULL,

  -- Observability. Without these there is no way to answer "is anything
  -- still hitting the old URLs?" or "did I map something nobody wants?"
  hits          INT UNSIGNED NOT NULL DEFAULT 0,
  last_hit_at   DATETIME NULL,

  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_old_path (old_path),
  KEY idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
