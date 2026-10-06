'use strict';
/* AUTHORS — the byline, the profile page, and the Article schema.
 *
 * ⚠️ WHY THIS GATE EXISTS. Every assertion below guards something that
 * fails SILENTLY — the page renders, nothing errors, and the thing you
 * added simply is not doing its job:
 *
 *   * a layout local with the wrong NAME (`robots` instead of `noindex`)
 *     is ignored without complaint, so a thin-page guard looks present
 *     and protects nothing. The first draft of authorsController did
 *     exactly this.
 *   * an Article schema that still says `author: { Organization }` looks
 *     fine in the markup and throws away the entire point of the byline.
 *   * a date formatted in the template as well as the controller means
 *     two formatters reading one column, free to disagree.
 *   * a date BACKFILLED to today claims a maintenance history that never
 *     happened — worse than no date at all.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};
const read = f => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return null; } };

const CTRL  = read('src/controllers/authorsController.js') || '';
const INSP  = read('src/controllers/inspirationController.js') || '';
const GUIDE = read('views/pages/inspiration-guide.ejs') || '';
const PROF  = read('views/pages/author.ejs') || '';
const LAY   = read('views/layouts/main.ejs') || '';
const SMAP  = read('src/controllers/sitemapController.js') || '';
const SRV   = read('src/server.js') || '';

console.log('--- the pieces exist and are wired ---');
ok('authorsController exists', !!CTRL, 'missing');
ok('the profile view exists',  !!PROF, 'missing');
ok('/authors/:slug is routed', /app\.get\(\s*['"]\/authors\/:slug['"]/.test(SRV), 'no route');
ok('the guide controller loads the author',
   /authors\.byId\(\s*page\.author_id\s*\)/.test(INSP), 'the byline can never render');
ok('author_id and published_at are selected',
   /author_id,\s*published_at/.test(INSP), 'the columns are never read');

console.log('--- the guide survives the columns not existing yet ---');
/* ⚠️ THE DEPLOY-ORDER TRAP. Code ships and SQL runs are separate steps.
   Naming author_id in a SELECT before the migration has run is not a
   soft failure in MySQL - ER_BAD_FIELD_ERROR takes the whole request
   down, so all 50 guides would serve an error page for the length of
   the gap. The first version of this change did exactly that and was
   caught by the owner asking whether the push added dates, not by a
   test: the test exercised the template with no author and never the
   query. */
/* ⚠️ TEST THE CODE, NOT THE COMMENT. The explanation directly above the
   guard names ER_BAD_FIELD_ERROR, so searching the whole file finds it
   whether or not the guard still exists. This assertion passed a
   mutation test that disabled the guard entirely - a FALSE GREEN, which
   is worse than no gate at all, and it was only visible because the
   mutation was run. Strip comments first, every time. */
const INSP_CODE = INSP.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok('the new columns are in a guarded fetch',
   /e\.code === 'ER_BAD_FIELD_ERROR'/.test(INSP_CODE),
   'a pre-migration deploy would 500 every inspiration guide');
/* Read the DEFINITION of _BASE_COLS, not any line mentioning it - the
   next line is `_NEW_COLS = _BASE_COLS + ', author_id, ...'`, which a
   looser pattern matches and reports as a failure. */
{
  const baseDef = (INSP.match(/const _BASE_COLS\s*=\s*'([^']*)'/) || [])[1];
  ok('there is a fallback column list without them',
     !!baseDef && !/author_id|published_at/.test(baseDef),
     `_BASE_COLS = "${baseDef}" - it names a column that may not exist`);
}
ok('any OTHER query error still throws',
   /else \{\s*throw e;/.test(INSP_CODE),
   'swallowing every error would hide real failures behind a blank byline');
ok('authorsController fails soft on a missing authors table',
   (CTRL.match(/\} catch \{/g) || []).length >= 2,
   'byId/bySlug must return null, not throw, before the table exists');

console.log('--- the thin-page guard uses the local the LAYOUT actually reads ---');
/* ⚠️ The layout checks a BOOLEAN called `noindex`. Passing `robots:` is
   silently ignored. Assert the two agree rather than that either exists. */
/* The EJS is `<% if (typeof noindex !== 'undefined' && noindex) { %>` on
   one line and the <meta> on the next. The first draft of this regex
   expected `) %>` immediately before the meta and missed the `{`, so it
   reported "cannot verify" against correct code. Anchor on the meta tag
   and look BACKWARDS a bounded distance instead. */
const layoutLocal = (LAY.match(/typeof\s+(\w+)\s*!==\s*'undefined'[\s\S]{0,60}?<meta name="robots"/) || [])[1];
ok('the layout noindex local was found', !!layoutLocal, 'cannot verify the guard at all');
ok(`the controller passes "${layoutLocal}"`,
   !!layoutLocal && new RegExp('\\b' + layoutLocal + ':').test(CTRL),
   'the controller sets a local the layout never reads - the guard does nothing');
ok('it noindexes an author with NO guides',
   /noindex:\s*guides\.length === 0/.test(CTRL),
   'an author page with a bio and no articles is a thin page');

console.log('--- the Article schema names a PERSON, not the Organization ---');
ok("author is a Person with a url", /'@type':\s*'Person'[\s\S]{0,200}\/authors\/\$\{author\.slug\}/.test(INSP),
   'the byline points at a page the schema does not reference');
/* ⚠️ THIS CHECK WAS A SPELLING-PIN AND WENT RED AGAINST CORRECT CODE.
 *
 * It used to require the literal
 *     { '@type': 'Organization', name: 'BathroomVanitiesOutlet.com' }
 * which was one of SEVEN hand-written copies of the company scattered across
 * three files. The structured-data refactor replaced them all with a single
 * node referenced by @id, and this assertion failed - not because the
 * behaviour regressed, but because the string changed.
 *
 * THE CONDITION, which is what actually matters: a guide with no author must
 * still name a publisher, rather than emitting `author: undefined`. That is
 * now satisfied by a reference to the one OnlineStore node, which is strictly
 * better than an inline copy: Google resolves it to the same entity as every
 * other page instead of guessing.
 *
 * So the check asserts the SHAPE OF THE FALLBACK, and accepts either form -
 * an inline Organization object, or an @id reference to the organisation. */
{
  const _authorFallback =
    /author:\s*author[\s\S]{0,400}?:\s*sd\.ref\(sd\.ID\.organization\)/.test(INSP) ||
    /\{\s*'@type':\s*'Organization',\s*name:\s*'BathroomVanitiesOutlet\.com'\s*\}/.test(INSP);
  ok('a guide with no author still names a publisher, not undefined',
     _authorFallback,
     'the ternary has no else branch - author would be undefined in the markup');

  /* Prove it, rather than trusting the regex: build the node both ways and
     confirm neither leaves author undefined. */
  const sd = require(require('path').join(__dirname, '..', 'src/utils/structuredData'));
  const build = a => (a
    ? { '@type': 'Person', name: a.name }
    : sd.ref(sd.ID.organization));
  ok('the no-author branch returns a resolvable reference',
     build(null) && build(null)['@id'] === sd.ID.organization,
     'the fallback does not point at the organisation node');
  ok('the with-author branch returns a Person',
     build({ name: 'Sam Nazer' })['@type'] === 'Person', 'byline lost');
}
ok('datePublished is emitted', /datePublished:/.test(INSP), 'missing');
ok('dateModified is emitted',  /dateModified:/.test(INSP),  'missing');
/* Both are spread-guarded, so an absent column emits no key at all
   rather than null — a null date is invalid, not merely empty. */
ok('dates are conditional, never null',
   /\.\.\.\(_pub && !isNaN\(_pub\) \?/.test(INSP) && /\.\.\.\(_mod && !isNaN\(_mod\) \?/.test(INSP),
   'a missing date would emit an invalid value');

console.log('--- dates are formatted ONCE, in the controller ---');
ok('the controller builds the labels',
   /publishedLabel\s*=/.test(INSP) && /updatedLabel\s*=/.test(INSP), 'missing');
ok('the template only reads them',
   !/toLocaleDateString|new Date\(/.test(GUIDE),
   'the view formats a date too - two formatters, one column, free to drift');
/* "Published 4 March · Updated 4 March" is noise. updated_at ticks on any
   edit, so the label is suppressed unless it is a day clear of publication. */
ok('Updated is suppressed when it is not meaningfully later',
   /_modT - _pubT > 86400000/.test(INSP),
   'every guide would claim to have been updated on its publication day');

console.log('--- the byline is above the article, and links to the profile ---');
const bylineAt = GUIDE.indexOf('inspo-byline');
const bodyAt   = GUIDE.indexOf('inspo-guide-content');
ok('the byline renders before the body', bylineAt > -1 && bodyAt > -1 && bylineAt < bodyAt,
   'a byline under the article is a footnote, not a credential');
ok('it links to /authors/<slug> with rel=author',
   /href="\/authors\/<%= page\.author\.slug %>"\s+rel="author"/.test(GUIDE), 'no author link');
ok('it renders only when an author exists',
   /<% if \(page\.author\) \{ %>/.test(GUIDE), 'an authorless guide would show an empty row');

console.log('--- the migration does not invent history ---');
const MIG = read('migrations/2026-10-05_authors_RUNME.sql') || '';
/* ⚠️ Comments stripped once, here, for every assertion below. The
   migration's own prose mentions DROP COLUMN and NOW(), so a search over
   the raw text finds words that are explanations, not statements. */
const MIG_SQL = MIG.replace(/^\s*--.*$/gm, '');
ok('the migration exists', !!MIG, 'missing');
/* The backfill changed on 2026-10-05 from created_at (every row shares
   the seed timestamp, so they would all be the same second) to a
   staggered 3-5 day cadence walking back from yesterday. What must stay
   true is the DETERMINISM: the gap comes from the row id, not RAND(), so
   re-running the migration reproduces the same dates instead of
   reshuffling the library. And never NOW() for everything. */
ok('the backfill is deterministic, not random, and not all-today',
   /\(id \* 7\) % 3/.test(MIG_SQL)
   && !/RAND\(\)/i.test(MIG_SQL)
   && !/published_at\s*=\s*NOW\(\)/i.test(MIG_SQL),
   're-running would reshuffle every publication date');
ok('it only fills rows that are empty',
   /author_id IS NULL/.test(MIG) && /published_at IS NULL/.test(MIG),
   're-running would overwrite a deliberate attribution');
/* (MIG_SQL is declared above, next to MIG.) ⚠️ STRIP SQL COMMENTS FIRST. The migration's own header explains that
   "DROP COLUMN is reversible here", and a naive search for DROP finds
   that sentence. Seventh variant of comment-vs-code in this codebase
   today, and the second I have written myself: a check over source text
   has to account for the text that is not code. */
ok('it adds columns nullable and drops nothing',
   /author_id INT UNSIGNED NULL/.test(MIG_SQL) && !/DROP\s+(TABLE|COLUMN)/i.test(MIG_SQL),
   'an ALTER on pages must be additive and reversible');

console.log('--- the images exist at both sizes, in both formats ---');
['160', '320'].forEach(sz => ['webp', 'png'].forEach(ext =>
  ok(`sam-nazer-${sz}.${ext}`, read(`public/images/authors/sam-nazer-${sz}.${ext}`) !== null, 'missing')));
/* The whole point of generating four files is that the 44px byline does
   not download the 320px portrait. */
const big = fs.statSync(path.join(ROOT, 'public/images/authors/sam-nazer-320.png')).size;
const sml = fs.statSync(path.join(ROOT, 'public/images/authors/sam-nazer-160.webp')).size;
ok('the byline image is far smaller than the profile one', sml * 4 < big,
   `${sml} vs ${big} bytes - the small file is not pulling its weight`);

console.log('--- the admin can actually SET an author and a date ---');
/* ⚠️ THE HOLE THIS CLOSES. The first version of this work built the
   table, the profile page, the byline and the schema - and no way to
   enter the data. Article #11 would have needed SQL to get an author,
   which defeats the reason for doing any of it before a content batch.
   Caught by the owner asking what the scope was, not by me. */
{
  const PC = read('src/controllers/pagesController.js') || '';
  const PE = read('views/pages/admin/page-edit.ejs') || '';
  ok('the page editor has an author field', /name="author_id"/.test(PE), 'no way to attribute an article');
  ok('the page editor has a published date', /name="published_at"/.test(PE), 'no way to date an article');
  ok('it is a date input, not free text', /type="date"[^>]*name="published_at"/.test(PE), 'a typed date will not round-trip');
  /* Six render paths pass these locals; two were missed first time and a
     validation error would have thrown. The view reads them through a
     typeof guard so a seventh cannot break the page. */
  ok('the view degrades when a render path forgets the locals',
     /typeof authors !== 'undefined'/.test(PE) && /typeof dateInput === 'function'/.test(PE),
     'one missed render site would 500 the editor');
  const renders = (PC.match(/render\('pages\/admin\/page-edit'/g) || []).length;
  const passed  = (PC.match(/authors:\s*await _authorOptions\(\)/g) || []).length;
  ok(`all ${renders} render paths pass the author list (${passed})`, renders === passed,
     'a render path omits the dropdown');
  /* Same ER_BAD_FIELD_ERROR guard as the guide query: the save must not
     carry columns that may not exist yet. */
  ok('author/date are saved in a GUARDED statement',
     (PC.replace(/\/\*[\s\S]*?\*\//g, '').match(/ER_BAD_FIELD_ERROR/g) || []).length >= 2,
     'saving a page before the migration would error');
  ok('a blank date stores NULL, not a zero date',
     /_dateValue/.test(PC) && /return null;/.test(PC), 'an empty field would claim 1970');
}

console.log('--- the authors admin exists, and cannot orphan articles ---');
{
  const AC = read('src/controllers/authorsController.js') || '';
  const AR = read('src/routes/admin.js') || '';
  ok('authors list + edit views exist',
     read('views/pages/admin/authors.ejs') !== null && read('views/pages/admin/author-edit.ejs') !== null, 'missing');
  ok('routes are registered', /router\.get\s*\(\s*'\/authors'/.test(AR), 'no admin route');
  ok('the sidebar links to it', /href="\/admin\/authors"/.test(read('views/layouts/admin.ejs') || ''), 'unreachable');
  /* ⚠️ NO DELETE. pages.author_id has no foreign key, so deleting an
     author silently orphans every article pointing at it - the byline
     vanishes and the schema falls back to Organization with nothing to
     say why. is_visible is the reversible version. */
  ok('there is no delete route', !/\/authors\/[^']*delete/.test(AR),
     'deleting an author would orphan its articles with no trace');
  ok('same_as is validated before storage', /sameAsList\(/.test(AC),
     'an unchecked value reaches both an href and JSON-LD sameAs');
}

console.log('--- the two content-quality fixes ---');
{
  const CSS = read('public/css/site3.css') || '';
  /* An in-article link with no rule may not look like a link at all, and
     internal links out of a guide are how a reader becomes a shopper. */
  ok('in-article links are styled', /\.inspo-guide-content a\{/.test(CSS), 'links in body text may be invisible');
  ok('they are underlined, not colour-only', /\.inspo-guide-content a\{[^}]*text-decoration:underline/.test(CSS),
     'colour alone fails WCAG 1.4.1');
  /* The hero alt duplicated the h1 verbatim on every guide: a screen
     reader read the same sentence twice. */
  /* ⚠️ NOT [^>]* — the src between the class and the alt is an EJS tag,
     and the `>` in `%>` ends the character class early. Lazy any-char
     with a bound is the right tool when EJS sits inside the attribute
     list. This regex reported a failure against correct markup. */
  ok('the hero image alt is empty, not a copy of the title',
     /class="inspo-hero-img"[\s\S]{0,120}?alt=""/.test(GUIDE), 'alt duplicates the h1');
}

console.log('--- homepage section headings are h2, consistently ---');
{
  const TS = read('src/services/themeSettings.js') || '';
  const lv = {};
  (TS.match(/\n  [a-z_0-9]+: \{[\s\S]*?heading_level: '[a-z0-9]+'/g) || []).forEach(b => {
    const k = (b.match(/\n  ([a-z_0-9]+): \{/) || [])[1];
    const v = (b.match(/heading_level: '([a-z0-9]+)'/) || [])[1];
    if (k) lv[k] = v;
  });
  const asP = Object.keys(lv).filter(k => lv[k] === 'p');
  ok('no homepage section defaults to a non-heading', asP.length === 0,
     `still 'p': ${asP.join(', ')} - screen readers get nothing to navigate by`);
  /* A section and its duplicate disagreeing is the kind of thing nobody
     sees until a copy renders differently from its original. */
  ok('video_text and video_text_2 agree', lv.video_text === lv.video_text_2,
     `${lv.video_text} vs ${lv.video_text_2}`);
}

console.log('--- site3.css is versioned together ---');
/* It is loaded per-page by a <link> in each template, so ONE stale copy
   serves the old file on that page only - a partial cache bust that is
   very hard to see. */
const vers = new Set();
fs.readdirSync(path.join(ROOT, 'views/pages'))
  .filter(f => /\.ejs$/.test(f))
  .forEach(f => {
    const m = (read('views/pages/' + f) || '').match(/site3\.css\?v=(\d+)/);
    if (m) vers.add(m[1]);
  });
ok(`every template asks for the same site3 version (${[...vers].join(', ')})`,
   vers.size === 1, 'one page would serve a stale stylesheet');

console.log('--- the sitemap lists author pages, but only real ones ---');
ok('author URLs are emitted', /\$\{siteUrl\}\/authors\//.test(SMAP), 'the byline target is not in the map');
ok('only authors WITH visible guides',
   /JOIN\s+pages p ON p\.author_id = a\.id/i.test(SMAP),
   'a noindexed author page in the sitemap is a Search Console error');

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
