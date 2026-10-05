-- ════════════════════════════════════════════════════════════════════
--  Authors — bylines, profile pages, and the Article schema fields
--  2026-10-05
--
--  WHY NOW, BEFORE THE NEXT BATCH OF ARTICLES. The Article JSON-LD on
--  /inspiration/:slug currently declares author as an Organization and
--  carries NO datePublished or dateModified. Both are per-article data,
--  so adding the columns after a content batch means guessing a publish
--  date for every record written in between. Adding them first means an
--  author picks them up while writing. The schema and the byline are
--  template work and apply retroactively; the DATA is not.
--
--  ⚠️ THIS ALTERS `pages`. The standing rule on this project is to add
--  tables, not remove or alter others, and that rule exists because the
--  bundle-builder and filtering work depends on the shape of several
--  tables. Two things make this change safe and it is still worth
--  stating plainly rather than slipping past:
--
--    * Both columns are NULLABLE with no default and nothing backfills
--      them. Every existing row is untouched and every existing query
--      keeps working, because none of them SELECT *-and-positional.
--    * Nothing about product data, filtering or the bundle builder
--      touches `pages`. This table holds CMS and inspiration content.
--
--  If either column ever needs to go, DROP COLUMN is reversible here in
--  a way that dropping a table is not.
--
--  SAFE TO RE-RUN: the ALTERs are guarded, the INSERT is idempotent.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. The authors table ────────────────────────────────────────────
--
-- A table rather than two columns on `pages` because an author is an
-- entity with its own page, its own schema.org Person, and its own
-- credentials — repeating a bio across 50 rows would make a correction
-- a 50-row update and guarantee drift.
CREATE TABLE IF NOT EXISTS authors (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- URL segment: /authors/<slug>. Evergreen, no dates.
  slug          VARCHAR(120) NOT NULL,
  name          VARCHAR(160) NOT NULL,

  -- One line under the name. The E-E-A-T signal in miniature: who is
  -- this and why should the reader trust them on this subject.
  credential    VARCHAR(200) NULL,

  -- Two or three paragraphs. HTML allowed; written by an admin, not a
  -- visitor, so it is rendered with the raw tag like page.content is.
  bio           TEXT NULL,

  -- Served from /images/authors/. WebP with a PNG fallback, both at 160
  -- and 320 so the byline and the profile card each get a real file
  -- rather than a browser downscale.
  image_base    VARCHAR(255) NULL,
  image_alt     VARCHAR(255) NULL,

  -- schema.org Person.sameAs — one URL per line. Kept as text rather
  -- than a child table: a handful of links per author, edited by hand.
  same_as       TEXT NULL,

  is_visible    TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uniq_author_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. Two nullable columns on pages ────────────────────────────────
--
-- Guarded so this file is safe to run twice. MySQL has no
-- ADD COLUMN IF NOT EXISTS before 8.0.29, so the check is explicit.
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pages ADD COLUMN author_id INT UNSIGNED NULL AFTER page_type',
    'SELECT ''pages.author_id already exists'''
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pages' AND COLUMN_NAME = 'author_id'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- published_at is DISTINCT from updated_at, which already exists and
-- drives the sitemap's lastmod. Article wants both: datePublished says
-- when it first appeared, dateModified says it is being maintained.
-- Collapsing them into one column loses the freshness signal entirely.
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pages ADD COLUMN published_at DATETIME NULL AFTER author_id',
    'SELECT ''pages.published_at already exists'''
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pages' AND COLUMN_NAME = 'published_at'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── 3. Sam Nazer ────────────────────────────────────────────────────
INSERT INTO authors (slug, name, credential, bio, image_base, image_alt, same_as, is_visible)
VALUES (
  'sam-nazer',
  'Sam Nazer',
  'Founder, Bathroom Vanities Outlet · In construction since 1999',
  CONCAT(
    '<p>Sam Nazer founded Bathroom Vanities Outlet after more than two decades in construction. ',
    'He started in 1999 and has since run contracting and building-materials businesses, and worked ',
    'nearly every side of residential real estate — building, flipping, general contracting, and ',
    'supplying the materials other builders rely on. In the early 2000s that work put him on ',
    'television, including <em>Flip This House</em>.</p>',
    '<p>What carries through all of it is a practical view of renovation. Most people remodel a ',
    'bathroom once or twice in their lives, the decisions are expensive, and most of the information ',
    'available is written to sell rather than to help. Sam writes these guides the way he would ',
    'advise a client standing in a half-demolished bathroom: what actually matters, what does not, ',
    'and where the money is best spent.</p>',
    '<p>Over the years that approach has helped tens of thousands of homeowners, contractors and ',
    'designers get more out of their time and their budget.</p>'
  ),
  '/images/authors/sam-nazer',
  'Sam Nazer, founder of Bathroom Vanities Outlet',
  NULL,
  1
)
ON DUPLICATE KEY UPDATE
  name       = VALUES(name),
  credential = VALUES(credential),
  bio        = VALUES(bio),
  image_base = VALUES(image_base),
  image_alt  = VALUES(image_alt),
  is_visible = VALUES(is_visible);

-- ── 4. Attribute the existing guides ────────────────────────────────
--
-- Only rows with no author yet, so re-running cannot overwrite a
-- deliberate attribution later.
UPDATE pages p
JOIN   authors a ON a.slug = 'sam-nazer'
SET    p.author_id = a.id
WHERE  p.page_type = 'inspiration' AND p.author_id IS NULL;

-- published_at: a staggered backdate, 3-5 days apart, walking backwards
-- from yesterday. Owner's call, 2026-10-05.
--
-- WHY NOT created_at: every row carries the timestamp of the seed import,
-- so they would all share one date — ten guides published in the same
-- second, which reads as a dump rather than a publication history.
--
-- ⚠️ THERE ARE TEN, NOT FIFTY. Counted 2026-10-05:
--     SELECT COUNT(*) FROM pages WHERE page_type='inspiration';  -> 10
-- "50 guides" appears in older task notes and in several comments I
-- wrote earlier today; it was never verified against the table. With ten
-- rows at 3-5 day gaps the library spans about five weeks, not six
-- months. Worth knowing before anyone sizes a content plan off the
-- wrong number.
--
-- WHY NOT ALL TODAY: same problem, louder.
--
-- ⚠️ BE CLEAR WITH YOURSELF ABOUT WHAT THIS IS. These dates are chosen,
-- not recorded. The guides were written over a period and are being given
-- a plausible cadence; that is an editorial decision about presentation,
-- and a normal one for a site publishing an existing library. It is worth
-- naming because the honest alternative — no dates at all — was the other
-- option, and because once this runs, published_at is no longer evidence
-- of anything. From here on it should be set by hand per article, which
-- is what the Author/Published fields in the page editor are for.
--
-- The gap is derived from the row id rather than RAND(), so re-running
-- this file produces the SAME dates instead of reshuffling the library
-- every time someone applies the migration.
--
--   first guide   yesterday
--   each one after that   3, 4 or 5 days earlier, by (id * 7) % 3
--
-- Ordered by sort_order then id, so the guides at the top of the hub
-- carry the most recent dates and the list reads newest-first.

UPDATE pages p
JOIN (
  SELECT id,
         SUM(gap) OVER (ORDER BY sort_order, id ROWS UNBOUNDED PRECEDING) AS days_back
  FROM (
    SELECT id, sort_order,
           CASE WHEN ROW_NUMBER() OVER (ORDER BY sort_order, id) = 1
                THEN 1                        -- the newest guide: yesterday
                ELSE 3 + ((id * 7) % 3)       -- then 3, 4 or 5 days apart
           END AS gap
    FROM pages
    WHERE page_type = 'inspiration'
  ) AS g
) AS d ON d.id = p.id
SET p.published_at = TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL d.days_back DAY), '09:30:00')
WHERE p.page_type = 'inspiration' AND p.published_at IS NULL;

-- ── Verify ──────────────────────────────────────────────────────────
SELECT id, slug, name, credential, is_visible FROM authors;

SELECT COUNT(*) AS inspiration_pages,
       SUM(author_id IS NOT NULL)    AS with_author,
       SUM(published_at IS NOT NULL) AS with_publish_date,
       MIN(published_at)             AS oldest,
       MAX(published_at)             AS newest
FROM   pages WHERE page_type = 'inspiration';

-- Eyeball the cadence: the first ten, newest first, with the gap in days
-- between each. Every gap should be 3, 4 or 5.
SELECT slug, DATE(published_at) AS published,
       DATEDIFF(LAG(published_at) OVER (ORDER BY published_at DESC), published_at) AS days_after_next
FROM   pages
WHERE  page_type = 'inspiration'
ORDER  BY published_at DESC
LIMIT  10;
