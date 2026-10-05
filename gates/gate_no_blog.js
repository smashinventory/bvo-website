'use strict';
/* THE /blog SECTION IS GONE, AND STAYS GONE.
 *
 * ⚠️ WHY THIS GATE EXISTS. Removing a feature is easy to do incompletely,
 * and the leftovers are silent: a route that still resolves, a sitemap
 * entry for a page that 404s, an admin nav item that leads nowhere, a
 * require() of a deleted file that only throws on the one request that
 * hits it. None of those fail a build.
 *
 * The section itself was scaffolded at the start of the project and
 * abandoned within days when the content plan moved to /inspiration. It
 * never held a post. Confirmed before deleting: blog_posts empty,
 * nav_menu_items with no /blog row (queried, zero rows), and the Shopify
 * /blogs/news/* redirects already pointing at /inspiration guides.
 *
 * This gate asserts the removal is COMPLETE, not that it happened.
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

console.log('--- the files are gone ---');
['src/controllers/blogController.js',
 'views/pages/blog-list.ejs',
 'views/pages/blog-post.ejs',
 'views/pages/admin/blog-list.ejs',
 'views/pages/admin/blog-edit.ejs'].forEach(f =>
  ok(`${f} does not exist`, read(f) === null, 'still present'));

console.log('--- nothing requires the deleted controller ---');
/* A stale require() is the worst leftover: the app boots fine and throws
   only when that one route is hit. */
['src/server.js', 'src/routes/admin.js'].forEach(f => {
  const t = read(f) || '';
  ok(`${f} does not require blogController`, !/require\([^)]*blogController/.test(t),
     'the app would crash on first use of that route');
});

console.log('--- no route answers /blog any more ---');
{
  const srv = read('src/server.js') || '';
  const adm = read('src/routes/admin.js') || '';
  /* Match route registrations only - the file still carries a comment
     explaining the removal, and prose is not a route. This is the
     comment-vs-code trap that has caught several checks in this repo:
     strip comments before asking the question. */
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok('server.js registers no /blog route',
     !/app\.(get|post|use)\(\s*['"]\/blog/.test(strip(srv)), 'a public route survives');
  ok('admin.js registers no /blog route',
     !/router\.(get|post)\s*\(\s*['"]\/blog/.test(strip(adm)), 'an admin route survives');
}

console.log('--- the sitemap does not advertise it ---');
/* An entry here is worse than a dead route: it actively invites a crawler
   to a 404 and spends crawl budget doing it. */
{
  const sm = read('src/controllers/sitemapController.js') || '';
  const strip = sm.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok('no /blog URL is emitted', !/\$\{siteUrl\}\/blog/.test(strip), 'the sitemap lists a dead section');
  ok('blog_posts is no longer queried', !/FROM blog_posts/.test(strip),
     'a query whose results can never be used');
}

console.log('--- the admin UI does not link to it ---');
{
  const lay = read('views/layouts/admin.ejs') || '';
  ok('no sidebar item points at /admin/blog', lay.indexOf('href="/admin/blog"') === -1,
     'a nav item leading to a 404');
}

console.log('--- the storefront does not link to it ---');
{
  let bad = [];
  const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).forEach(e => {
    const rel = d + '/' + e.name;
    if (e.isDirectory()) return walk(rel);
    if (!/\.ejs$/.test(e.name) || /\.bak/.test(e.name)) return;
    if (rel.indexOf('/admin') > -1) return;
    const t = read(rel) || '';
    if (/href="\/blog/.test(t)) bad.push(rel);
  });
  walk('views');
  ok('no storefront template links to /blog', bad.length === 0, bad.join(', '));
}

console.log('--- the redirect is staged ---');
/* The code removal and the redirect row ship together. A migration file
   that was written but never run is invisible, so its presence is
   asserted here and the push script prints the reminder. */
{
  const mig = read('migrations/2026-10-05_retire_blog_redirect_RUNME.sql');
  ok('the redirect migration exists', mig !== null, 'nothing would catch /blog');
  ok('it maps /blog to /inspiration with a 301',
     !!mig && /'\/blog'/.test(mig) && /\/inspiration/.test(mig) && /301/.test(mig),
     'the migration does not do what it claims');
}

console.log('--- the table itself is untouched ---');
/* Standing instruction from the owner: add tables, do not remove or alter
   others. An empty table costs nothing and dropping it is irreversible. */
{
  const mig = read('migrations/2026-10-05_retire_blog_redirect_RUNME.sql') || '';
  ok('the migration does not DROP or ALTER blog_posts',
     !/DROP\s+TABLE|ALTER\s+TABLE/i.test(mig), 'a removal migration must not touch schema');
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
