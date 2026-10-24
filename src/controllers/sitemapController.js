'use strict';

const { bvoPool } = require('../config/database');
const pathFilters = require('../config/pathFilters');
const Category    = require('../models/Category');
const Product     = require('../models/Product');
/* The Deals page is a query, not a category — shared so the sitemap and
   the page cannot disagree about what qualifies. See its header. */
const saleRule    = require('../config/saleRule');
/* The LIVE saved settings, never the Theme Editor preview — see below. */
const themeSettings = require('../services/themeSettings');

/**
 * GET /sitemap.xml
 *
 * Outputs a valid XML sitemap covering:
 *   - Homepage
 *   - All active category (collection) pages  — changefreq: weekly
 *   - All active product pages                — changefreq: daily
 *
 * Omits URLs it can't get from the DB.
 *
 * SEO notes:
 *   - Filtered collection URLs (?brand=...) are intentionally excluded
 *     to avoid wasting crawl budget on faceted navigation.
 *   - Priority is relative: homepage 1.0 > collections 0.8 > products 0.6
 */
exports.xml = async (req, res) => {
  const siteUrl = require('../utils/siteUrl').base();
  /* A `today` constant lived here and is deliberately gone. Nothing in a
     sitemap should be dated from the clock — every <lastmod> now comes from a
     row's updated_at, or from the newest child for an index page, or is
     omitted. Reintroducing a "now" here is how this file drifts back to
     claiming all 5,311 pages changed this morning. */

  try {
    /* ── Fetch CMS pages (standard, not inspiration) ─────────── */
    let cmsPages;
    try {
      const [rows] = await bvoPool.query(`
        SELECT slug, updated_at FROM pages
        WHERE is_visible=1 AND (page_type IS NULL OR page_type = 'page')
      `);
      cmsPages = rows;
    } catch {
      cmsPages = [];
    }

    /* ── Fetch inspiration / style guide pages ────────────────── */
    let inspirationPages;
    try {
      const [rows] = await bvoPool.query(`
        SELECT slug, updated_at FROM pages
        WHERE is_visible=1 AND page_type = 'inspiration'
        ORDER BY sort_order ASC, id ASC
      `);
      inspirationPages = rows;
    } catch {
      inspirationPages = [];
    }

    /* /blog REMOVED 2026-10-05 — the section was scaffolded and abandoned
       within days; it never held a post. The query and both URL blocks are
       gone rather than left guarded by `if (blogPosts.length)`, because a
       guard that is always false is a trap: it reads as a live feature and
       hides that nothing was ever behind it. The blog_posts table is left
       in place. */

    /* ── Fetch categories ──────────────────────────────────────── */
    let categories;
    try {
      const [rows] = await bvoPool.query(`
        SELECT slug, updated_at FROM categories
        WHERE is_active = 1 AND parent_id IS NULL
        ORDER BY sort_order
      `);
      categories = rows;
    } catch {
      categories = [];
    }

    /* ── Fetch products ────────────────────────────────────────── */
    let products;
    try {
      const [rows] = await bvoPool.query(`
        SELECT slug, updated_at FROM products
        WHERE is_active = 1
        ORDER BY id
        LIMIT 50000
      `);
      products = rows;
    } catch {
      products = [];
    }

    /* ── Build XML ─────────────────────────────────────────────── */
    const escUrl = (u) => u.replace(/&/g, '&amp;');

    /* fmtDate used to fall back to `today` when updated_at was NULL, turning
       "we do not know" into a confident wrong answer. <lastmod> is OPTIONAL in
       the sitemap protocol, so omitting it costs nothing, while a wrong date
       teaches Google to distrust the field across the whole site. Returns null
       now; lastmod() emits nothing for null. */
    const fmtDate = (d) => (d ? new Date(d).toISOString().split('T')[0] : null);
    const lastmod = (d) => {
      const s = fmtDate(d);
      return s ? `\n    <lastmod>${s}</lastmod>` : '';
    };

    /* Index pages have no row of their own, so their real last-modified date is
       the newest thing they list. Stamping them `today` was the same lie as the
       NULL fallback, and worse here — these four are the highest-priority URLs
       in the file. Returns null for an empty list, so the tag is omitted rather
       than invented. */
    const maxDate = (rows) => (rows || []).reduce((acc, r) => {
      const t = r && r.updated_at ? new Date(r.updated_at).getTime() : 0;
      return t > acc ? t : acc;
    }, 0) || null;

    const urls = [];

    // Homepage
    urls.push(`
  <url>
    <loc>${escUrl(siteUrl)}/</loc>${lastmod(maxDate([...products, ...cmsPages, ...inspirationPages, ...categories]))}
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`);

    /* ── Author profiles ──────────────────────────────────────────
       Included because each one is the destination of a byline link and
       of the Person.url in every guide's Article schema — an entity the
       crawler is pointed at from 50 pages should not be left out of the
       map. Only authors WITH visible guides: the controller noindexes an
       author who has none, and advertising a noindexed URL in a sitemap
       is a contradiction that Search Console reports as an error. */
    let authorRows = [];
    try {
      const [rows] = await bvoPool.query(`
        SELECT a.slug, MAX(p.updated_at) AS updated_at
        FROM   authors a
        JOIN   pages p ON p.author_id = a.id
                      AND p.page_type = 'inspiration' AND p.is_visible = 1
        WHERE  a.is_visible = 1
        GROUP  BY a.slug
      `);
      authorRows = rows;
    } catch { authorRows = []; }

    for (const a of authorRows) {
      urls.push(`
  <url>
    <loc>${escUrl(`${siteUrl}/authors/${a.slug}`)}</loc>${lastmod(a.updated_at)}
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`);
    }

    // Inspiration hub
    if (inspirationPages.length) {
      urls.push(`
  <url>
    <loc>${escUrl(siteUrl)}/inspiration</loc>${lastmod(maxDate(inspirationPages))}
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }

    // Individual inspiration / style guide pages
    for (const p of inspirationPages) {
      urls.push(`
  <url>
    <loc>${escUrl(`${siteUrl}/inspiration/${p.slug}`)}</loc>${lastmod(p.updated_at)}
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }

    // CMS pages
    for (const p of cmsPages) {
      urls.push(`
  <url>
    <loc>${escUrl(`${siteUrl}/pages/${p.slug}`)}</loc>${lastmod(p.updated_at)}
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`);
    }

    // Collections index
    urls.push(`
  <url>
    <loc>${escUrl(siteUrl)}/collections</loc>${lastmod(maxDate(categories))}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);

    /* ── /collections/sale — THE VIRTUAL COLLECTION (task #365) ──────
       Sale has no row in `categories`, because it is not a category: it is
       a query. The loop below builds collection URLs from that table, so
       the Deals page has never been in the sitemap and Google has had no
       way to discover it.

       ⚠️ ONLY IF SOMETHING QUALIFIES. Submitting a Deals page with nothing
       on it is a thin page, and the qualifying set is a THRESHOLD away
       from empty — raise deals_min_discount_pct above the catalogue
       ceiling and the page legitimately empties. So this asks.

       ⚠️ AND IT ASKS WITH THE PAGE'S OWN RULE. The predicate and the
       threshold both come from src/config/saleRule.js, the same module
       collectionsController uses to build the page. A second copy of the
       WHERE clause here would have drifted the first time either was
       edited — the Rule 18 trap as a second caller rather than a test.

       lastmod is the newest qualifying product, which is the honest answer
       to "when did this page last change": the page has no updated_at of
       its own because it has no row. */
    let saleCount = 0, saleLastmod = null;
    try {
      /* ⚠️ themeSettings.get(), NOT res.locals.settings, for two reasons.
         Ordering: res.locals.settings is written by a middleware whose
         position relative to this route is not something this file should
         depend on, and if it ran later the sitemap would silently use the
         default threshold while the page used the owner's.
         Correctness: res.locals.settings is the PREVIEW object inside the
         Theme Editor. An admin half-way through editing must not change
         what Google is told. The live saved value is the only right
         answer here. */
      const frac = saleRule.fracFromSetting(
        ((themeSettings.get() || {}).seo || {}).deals_min_discount_pct
      );
      const [[saleAgg]] = await bvoPool.query(
        `SELECT COUNT(*) AS n, MAX(p.updated_at) AS newest
           FROM products p
          WHERE ${saleRule.SALE_WHERE}`, [frac]
      );
      saleCount   = Number(saleAgg && saleAgg.n) || 0;
      saleLastmod = saleAgg && saleAgg.newest;
    } catch (err) {
      /* Not fatal, and deliberately so: a sitemap that loses one URL is a
         far smaller problem than a sitemap that 500s and loses 6,240. */
      console.error('[sitemap] sale count failed:', err.code, err.sqlMessage || err.message);
    }

    if (saleCount > 0) {
      urls.push(`
  <url>
    <loc>${escUrl(siteUrl)}/collections/sale</loc>${lastmod(saleLastmod)}
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`);
    }

    // Individual category pages
    for (const cat of categories) {
      urls.push(`
  <url>
    <loc>${escUrl(`${siteUrl}/collections/${cat.slug}`)}</loc>${lastmod(cat.updated_at)}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }

    /* ── Clean filter + model paths ─────────────────────────────────
       Added 2026-10-03 with the ?param= -> path conversion. These replaced
       URLs that were never in the sitemap because a parameterised filter
       canonicals to its parent and could not rank.

       Every path here is generated from src/config/pathFilters.js, so the
       sitemap cannot drift from what the router actually serves — adding a
       style or a model to that file puts it here automatically.

       NOTE, honestly: the facet paths include the handful whose product
       count is below seo.filter_landing_min_products and which therefore
       still canonical to their parent. Search Console will report those as
       "alternate page with proper canonical tag", which is information, not
       an error. Excluding them would need a per-filter count query here;
       not worth it unless the noise becomes a problem. */
    for (const p of pathFilters.allPaths()) {
      urls.push(`
  <url>
    <loc>${escUrl(siteUrl + p)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }
    for (const m of Object.values(pathFilters.MODELS)) {
      const mp = pathFilters.modelPath(m.model, m.brand);
      if (!mp) continue;
      urls.push(`
  <url>
    <loc>${escUrl(siteUrl + mp)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }

    // Product pages
    for (const p of products) {
      urls.push(`
  <url>
    <loc>${escUrl(`${siteUrl}/products/${p.slug}`)}</loc>${lastmod(p.updated_at)}
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}
</urlset>`;

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);

  } catch (err) {
    console.error('[Sitemap] Error:', err.message);
    res.status(500).send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
  }
};
