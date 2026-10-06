'use strict';

/**
 * inspirationController.js
 * Serves the /inspiration hub page and individual /inspiration/:slug guide pages.
 *
 * Pages are stored in the existing `pages` table with page_type = 'inspiration'.
 * Migration 013 adds the page_type column and seeds all 50 guides.
 *
 * Public routes:
 *   GET /inspiration         — hub page (card grid of all guides)
 *   GET /inspiration/:slug   — individual guide page
 */

const { bvoPool } = require('../config/database');
const { STYLE }   = require('../config/filterLandingPages');
const authors    = require('./authorsController');
const sd         = require('../utils/structuredData');

/* ── Category groupings for hub page display ──────────────────── */
const CATEGORIES = [
  {
    label: 'Style Guides',
    slugs: [
      'farmhouse-bathroom-vanity-ideas',
      'modern-bathroom-vanity-ideas',
      'traditional-bathroom-vanity-ideas',
      'contemporary-bathroom-vanity-ideas',
      'transitional-bathroom-vanity-ideas',
      'coastal-bathroom-vanity-ideas',
      'rustic-bathroom-vanity-ideas',
      'industrial-bathroom-vanity-ideas',
      'mid-century-modern-bathroom-vanity-ideas',
      'scandinavian-bathroom-vanity-ideas',
    ],
  },
  {
    label: 'Color & Finish',
    slugs: [
      'white-bathroom-vanity-ideas',
      'gray-bathroom-vanity-ideas',
      'navy-bathroom-vanity-ideas',
      'black-bathroom-vanity-ideas',
      'wood-bathroom-vanity-ideas',
      'two-tone-bathroom-vanity-ideas',
      'espresso-bathroom-vanity-ideas',
      'green-bathroom-vanity-ideas',
    ],
  },
  {
    label: 'Size & Configuration',
    slugs: [
      'small-bathroom-vanity-ideas',
      '30-inch-bathroom-vanity-ideas',
      '36-inch-bathroom-vanity-ideas',
      '48-inch-bathroom-vanity-ideas',
      '60-inch-bathroom-vanity-ideas',
      '72-inch-bathroom-vanity-ideas',
      'double-sink-bathroom-vanity-ideas',
      'floating-bathroom-vanity-ideas',
    ],
  },
  {
    label: 'Room Type',
    slugs: [
      'master-bathroom-vanity-ideas',
      'guest-bathroom-vanity-ideas',
      'powder-room-vanity-ideas',
      'kids-bathroom-vanity-ideas',
      'spa-bathroom-vanity-ideas',
      'luxury-bathroom-vanity-ideas',
    ],
  },
  {
    label: 'Buying Guides',
    slugs: [
      'how-to-choose-a-bathroom-vanity',
      'bathroom-vanity-buying-guide',
      'how-to-measure-for-a-bathroom-vanity',
      'bathroom-vanity-with-top-vs-without',
      'freestanding-vs-wall-mounted-bathroom-vanity',
      'single-vs-double-sink-bathroom-vanity',
      'how-to-style-a-bathroom-vanity',
      'bathroom-vanity-mirror-guide',
      'bathroom-faucet-buying-guide',
      'bathroom-vanity-hardware-guide',
    ],
  },
  {
    label: 'Renovation & Planning',
    slugs: [
      'budget-bathroom-vanity-ideas',
      'bathroom-remodel-ideas',
      'small-bathroom-remodel-ideas',
      'bathroom-vanity-lighting-ideas',
      'bathroom-vanity-storage-ideas',
      'bathroom-vanity-organization-ideas',
      'master-bathroom-remodel-ideas',
      'complete-bathroom-design-guide',
    ],
  },
];

/* ═══════════════ PUBLIC ══════════════════════════════════════════ */

/**
 * GET /inspiration
 * Renders the inspiration hub — a curated grid of all 50 guides.
 */
exports.hub = async (req, res) => {
  const siteUrl = require('../utils/siteUrl').base();

  try {
    const [pages] = await bvoPool.query(
      `SELECT slug, title, meta_desc
       FROM pages
       WHERE page_type = 'inspiration' AND is_visible = 1
       ORDER BY sort_order ASC, id ASC`
    );

    // Build a slug→page lookup for fast grouping
    const bySlug = {};
    for (const p of pages) bySlug[p.slug] = p;

    // Build categorised groups, filtering to only pages that actually exist in DB
    const groups = CATEGORIES.map(cat => ({
      label: cat.label,
      pages: cat.slugs.map(s => bySlug[s]).filter(Boolean),
    })).filter(g => g.pages.length > 0);

    /* NO BreadcrumbList. inspiration-hub.ejs renders no visible trail, and
       Google requires markup to match what the user sees — the same call
       made for author.ejs. Add `trail:` here if a visible trail is ever
       added to the view and the node appears on its own.

       A plain WebPage, not CollectionPage: sd.collectionPage() builds
       /products/<slug> URLs for its ItemList and these are guides, not
       products. Bending it would be a second method for one job. */
    const jsonLd = sd.scriptTag(sd.pageGraph({
      url:         '/inspiration',
      name:        'Bathroom Vanity Ideas & Inspiration',
      description: 'Browse expert bathroom vanity guides — styles, sizes and buying advice.',
      settings:    res.locals.settings,
    }));

    res.render('pages/inspiration-hub', {
      jsonLd,
      layout:       'layouts/main',
      pageTitle:    'Bathroom Vanity Ideas & Inspiration | BathroomVanitiesOutlet.com',
      metaDesc:     'Browse 50+ expert bathroom vanity guides — from farmhouse and floating styles to size charts and buying advice. Find the perfect vanity for your bathroom.',
      canonicalUrl: `${siteUrl}/inspiration`,
      style:        '',
      script:       '',
      groups,
      totalCount:   pages.length,
    });
  } catch (err) {
    console.error('[inspirationController] hub:', err.message);
    res.status(500).render('pages/error', { pageTitle: 'Error', message: 'An error occurred.' });
  }
};

/* ── Slug → product filter mapping ───────────────────────────── */
// Maps slug prefixes to a color_family LIKE filter for the product showcase.
const _COLOR_FAMILY_MAP = [
  ['white-bathroom',    'white'],
  ['gray-bathroom',     'gray'],
  ['navy-bathroom',     'blue'],
  ['black-bathroom',    'black'],
  ['wood-bathroom',     'wood'],
  ['espresso-bathroom', 'brown'],
  ['green-bathroom',    'green'],
  ['two-tone-bathroom', null],
];

// Maps slug prefixes to a human-readable shop label used in the showcase heading.
const _SHOP_LABELS = {
  'farmhouse':    'Farmhouse',
  'modern':       'Modern',
  'traditional':  'Traditional',
  'contemporary': 'Contemporary',
  'transitional': 'Transitional',
  'coastal':      'Coastal',
  'rustic':       'Rustic',
  'industrial':   'Industrial',
  'mid-century':  'Mid-Century Modern',
  'scandinavian': 'Scandinavian',
  'white':        'White',
  'gray':         'Gray',
  'navy':         'Navy Blue',
  'black':        'Black',
  'wood':         'Wood Finish',
  'espresso':     'Espresso',
  'green':        'Green',
  'two-tone':     'Two-Tone',
  'small':        'Small',
  'floating':     'Floating',
  'double-sink':  'Double Sink',
  'master':       'Master Bathroom',
  'luxury':       'Luxury',
  'spa':          'Spa-Style',
  '30-inch':      '30-Inch',
  '36-inch':      '36-Inch',
  '48-inch':      '48-Inch',
  '60-inch':      '60-Inch',
  '72-inch':      '72-Inch',
};

/* ── SLUG → PRODUCT MATCH ──────────────────────────────────────────────

   Which products belong on which guide. Three of the four dimensions in
   these slugs map onto data we actually hold:

     colour   products.color_family              white / gray / navy / black / wood
     width    products.width_in                  "60-inch", "small"
     sinks    product_attribute_values.sink_count  "double-sink"

     style    product_attribute_values.style     "farmhouse", "modern", ...

   ⚠️ I GOT THIS WRONG ON FIRST WRITE and said no style attribute
   existed, because I grepped for a COLUMN on products rather than for an
   attr_key — ten minutes after finding sink_count that exact way. It is
   there: a MULTI-VALUE EAV attribute written by insertStyleAttrs() in
   importJamesMartinFeed.js, and the same data behind the "Shop by Style"
   filter on collection pages.

   The style names come from src/config/filterLandingPages.js, which is
   already the single source for them (the filter landing pages, the
   collection sidebar and now this all read the same nine). A second list
   here would drift from it the first time a style was renamed. */
/* slug prefix -> canonical style value. Only the prefixes that differ
   from a simple lowercase of the style name need listing; the rest are
   derived, so adding a tenth style to filterLandingPages needs no edit
   here. */
const _STYLE_ALIASES = {
  'contemporary': 'Modern',            // the guide's word for it
  'rustic':       'Farmhouse',         // closest bucket we actually carry
  'mid-century':  'Mid-Century Modern',
  'european':     'European / Old World',
  'old-world':    'European / Old World',
};

function _slugToStyle(slug) {
  for (const [prefix, value] of Object.entries(_STYLE_ALIASES)) {
    if (slug.startsWith(prefix + '-')) return value;
  }
  for (const value of Object.keys(STYLE)) {
    const prefix = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    if (slug.startsWith(prefix + '-')) return value;
  }
  return null;
}

function _slugToProductMatch(slug) {
  const m = { colorFamily: null, widthMin: null, widthMax: null, sinkCount: null,
              style: _slugToStyle(slug) };

  for (const [prefix, family] of _COLOR_FAMILY_MAP) {
    if (slug.startsWith(prefix) && family) { m.colorFamily = family; break; }
  }

  /* "60-inch-bathroom-vanity-ideas" etc. Read the number out of the slug
     rather than listing every size, so a new size guide needs no code. */
  const size = slug.match(/^(\d{2})-inch-/);
  if (size) {
    const n = parseInt(size[1], 10);
    m.widthMin = n - 2;   // a 60" guide should show 60" vanities, and
    m.widthMax = n + 2;   // tolerate the 59/61 the catalogue actually has
  }

  if (slug.startsWith('small-'))  m.widthMax = 36;
  if (slug.startsWith('master-')) m.widthMin = 60;

  if (slug.startsWith('double-sink-')) m.sinkCount = 2;
  if (slug.startsWith('single-sink-')) m.sinkCount = 1;

  return m;
}

function _slugToShopMeta(slug) {
  // Determine color_family filter
  let colorFamily = null;
  for (const [prefix, family] of _COLOR_FAMILY_MAP) {
    if (slug.startsWith(prefix)) { colorFamily = family; break; }
  }

  // Determine display label
  let shopLabel = 'Featured';
  for (const [prefix, label] of Object.entries(_SHOP_LABELS)) {
    if (slug.startsWith(prefix)) { shopLabel = label; break; }
  }

  return { colorFamily, shopLabel };
}

/**
 * GET /inspiration/:slug
 * Renders a single inspiration/style guide page.
 */
exports.guide = async (req, res) => {
  const { slug } = req.params;
  const siteUrl  = require('../utils/siteUrl').base();

  try {
    /* ⚠️ THE COLUMNS MAY NOT EXIST YET, AND THAT MUST NOT 500 THE PAGE.
       author_id and published_at arrive with
       migrations/2026-10-05_authors_RUNME.sql. Code deploys and SQL runs
       are separate steps with a gap between them, and whichever order
       they happen in, these 50 guides have to keep serving.

       Naming a missing column is not a soft failure in MySQL - it throws
       ER_BAD_FIELD_ERROR and takes the whole request with it. The first
       version of this change had the new columns in the SELECT with no
       guard, which would have turned every guide into an error page for
       the length of that gap. It was caught by the owner asking a
       question about dates, not by a test, because the test I wrote
       exercised the TEMPLATE with no author and never the QUERY.

       So: try the full list, and on that one error fall back to the
       column list that has always existed. The fallback leaves author_id
       and published_at undefined, which every consumer below already
       handles - the byline is conditional and the schema dates are
       spread-guarded. */
    const _BASE_COLS = 'id, slug, title, content, meta_title, meta_desc, og_image, updated_at';
    const _NEW_COLS  = _BASE_COLS + ', author_id, published_at';
    const _fetch = cols => bvoPool.query(
      `SELECT ${cols}
       FROM pages
       WHERE slug = ? AND page_type = 'inspiration' AND is_visible = 1`,
      [slug]
    );

    let page;
    try {
      [[page]] = await _fetch(_NEW_COLS);
    } catch (e) {
      if (e && e.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('[inspiration] authors migration not applied yet - serving without byline');
        [[page]] = await _fetch(_BASE_COLS);
      } else {
        throw e;
      }
    }

    if (!page) {
      return res.status(404).render('pages/404', {
        pageTitle: '404 — Page Not Found | BathroomVanitiesOutlet.com',
      });
    }

    // Estimate reading time (~200 wpm)
    const wordCount = (page.content || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    page.readTime   = Math.max(1, Math.round(wordCount / 200));

    /* ── Related guides ───────────────────────────────────────────
       ⚠️ A SECOND RAND(), found 2026-10-05 only because the first one
       was being fixed. Same three costs: the internal links out of this
       guide changed on every request, so no link between two guides ever
       became a stable signal; the page could not be checked twice; and a
       returning reader saw a different "related" list each visit.

       Internal linking is the one thing a ten-article library can do for
       itself - a stable, sensible web of links between related guides is
       worth more here than almost any markup. Random links are not a web.

       NEWEST FIRST, then id. Deterministic, and it surfaces the most
       recently published guides, which is also the more useful default
       now that every article carries a real published_at. */
    /* Guarded the same way the main fetch is, and for the same reason:
       published_at arrives with the authors migration, and an unguarded
       reference to a missing column is ER_BAD_FIELD_ERROR, which takes
       the whole page down. Same pattern rather than a second one. */
    const _relatedSql = order => `
      SELECT slug, title, meta_desc, og_image
      FROM pages
      WHERE page_type = 'inspiration' AND is_visible = 1 AND id <> ?
      ORDER BY ${order}
      LIMIT 4`;
    let related;
    try {
      [related] = await bvoPool.query(
        _relatedSql('published_at DESC, sort_order ASC, id ASC'), [page.id]);
    } catch (e) {
      if (e && e.code !== 'ER_BAD_FIELD_ERROR') throw e;
      [related] = await bvoPool.query(_relatedSql('sort_order ASC, id ASC'), [page.id]);
    }

    // Product showcase — 4 products filtered by slug-derived color family (or featured)
    const { colorFamily, shopLabel } = _slugToShopMeta(slug);
    const match = _slugToProductMatch(slug);
    let shopProducts = [];
    try {
      /* ── WHAT THIS PICKS, AND WHY IT IS NOT RANDOM ─────────────────
         This was `ORDER BY p.is_featured DESC, RAND() LIMIT 4`. Four
         different vanities on every single page load, which costs three
         things that are easy to miss:

           * Google saw a different set on every crawl, so no image ever
             built an association with the page and none of them could
             surface in Google Images.
           * The page could not be screenshotted, cached or debugged
             reproducibly - "it showed the wrong vanity" was untestable.
           * A reader who returned to a guide saw different products,
             which reads as a glitch rather than a selection.

         Deterministic now: demand first (the analytics signal we already
         compute), then featured, then id as the tie-break so the order is
         total and stable. Same page, same products, until the catalogue
         or the demand data actually changes - which is the kind of
         "dynamic" that helps rather than churns. */
      const where  = ['p.is_active = 1'];
      const params = [];
      const joins  = [];

      if (match.colorFamily) { where.push('LOWER(p.color_family) LIKE ?'); params.push(`%${match.colorFamily}%`); }
      if (match.widthMin != null) { where.push('p.width_in >= ?'); params.push(match.widthMin); }
      if (match.widthMax != null) { where.push('p.width_in <= ?'); params.push(match.widthMax); }
      if (match.style) {
        /* Multi-value: a vanity can be both Transitional and Farmhouse,
           so this is a join against one of its style rows, not equality
           on a single column. */
        joins.push(`JOIN product_attribute_values pav_st
                      ON pav_st.product_id = p.id AND pav_st.attr_key = 'style'`);
        where.push('pav_st.value_text = ?');
        params.push(match.style);
      }
      if (match.sinkCount != null) {
        /* sink_count lives in the EAV table, same as the collection
           filters read it - not a column on products. */
        joins.push(`JOIN product_attribute_values pav_sc
                      ON pav_sc.product_id = p.id AND pav_sc.attr_key = 'sink_count'`);
        where.push('pav_sc.value_text = ?');
        params.push(String(match.sinkCount));
      }

      const [rows] = await bvoPool.query(
        `SELECT p.id, p.slug, p.name, p.price, p.compare_price, p.brand,
                COALESCE(p.primary_image_url, pi.url) AS primary_image
         FROM products p
         LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
         ${joins.join('\n         ')}
         WHERE ${where.join(' AND ')}
         ORDER BY COALESCE(p.demand_score, 0) DESC, p.is_featured DESC, p.id ASC
         LIMIT 4`,
        params
      );
      shopProducts = rows.map(p => ({
        ...p,
        price:         parseFloat(p.price) || 0,
        compare_price: p.compare_price != null ? parseFloat(p.compare_price) : null,
      }));
    } catch (_e) {
      // Non-fatal — page renders without product showcase if query fails
      console.warn('[inspirationController] product showcase query failed:', _e.message);
    }

    // Collection link for "View All" button
    const shopCollectionUrl = colorFamily
      ? `/collections/bathroom-vanities?color_family=${encodeURIComponent(colorFamily)}`
      : '/collections/bathroom-vanities';

    /* ── The author ──────────────────────────────────────────────
       Fails soft: byId() returns null if the authors table is absent or
       the row is hidden, and every use below is conditional. A guide must
       render without a byline rather than 500 because a migration has not
       been run yet. */
    const author = await authors.byId(page.author_id);
    page.author  = author;

    /* Human-readable dates for the byline. Formatted here rather than in
       the template so the schema's ISO strings and the visible text come
       from the SAME parsed value - two formatters reading the same column
       is how a page ends up claiming two different dates. */
    const _fmt = d => {
      const x = d instanceof Date ? d : d ? new Date(d) : null;
      return x && !isNaN(x)
        ? x.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : null;
    };
    page.publishedLabel = _fmt(page.published_at);
    /* Only show "Updated" when it is meaningfully after publication -
       every row's updated_at ticks on any edit, and "Published 4 March ·
       Updated 4 March" is noise that makes the real signal worthless. */
    const _pubT = page.published_at ? new Date(page.published_at).getTime() : 0;
    const _modT = page.updated_at   ? new Date(page.updated_at).getTime()   : 0;
    page.updatedLabel = (_modT && _pubT && _modT - _pubT > 86400000) ? _fmt(page.updated_at) : null;

    /* ── Article JSON-LD ─────────────────────────────────────────
       THREE CHANGES FROM THE ORGANISATION-ONLY VERSION, each a thing
       Google names in its Article guidance and each previously absent:

         author        was { Organization }. A Person with a `url`
                       pointing at a real profile page is the whole point
                       of the byline — it makes the author an entity that
                       can be linked and cited rather than a string.
         datePublished when it first appeared.
         dateModified  that it is being maintained. These are separate on
                       purpose: collapsing them into one loses the
                       freshness signal that makes evergreen content
                       worth re-crawling.

       Dates are emitted ONLY when the column holds a value. An invented
       date is worse than no date — it claims a maintenance history that
       does not exist, and it is the exact thing a backfill-to-today would
       have produced. */
    const _iso = d => (d instanceof Date ? d : d ? new Date(d) : null);
    const _pub = _iso(page.published_at);
    const _mod = _iso(page.updated_at);

    /* ⚠️ THIS BLOCK NEVER RENDERED. It was built as a standalone Article
       object and passed to res.render as `script:`. express-ejs-layouts
       runs with `layout extractScripts` enabled (server.js:504) and its
       extractor does `locals.script = ''` and then refills it ONLY from
       <script> tags found in the rendered view
       (express-ejs-layouts/lib/express-layouts.js:98-99). Anything a
       controller passes as `script:` is discarded before the layout sees
       it.

       So every guide page has been serving with NO structured data at
       all - no Article, no author, no dates - which is exactly what the
       owner's SEO audit reported as "No Schema.org data found". The
       authors work shipped earlier today was invisible to Google.

       Two things change here:
         1. the tag is emitted by the VIEW (inspiration-guide.ejs) from
            the `jsonLd` local, so the extractor finds it;
         2. the Article joins the shared @graph instead of standing
            alone, so its publisher and author resolve by @id against the
            one OnlineStore node rather than re-declaring the company.

       The Article's own fields are unchanged - same headline, image,
       Person author, datePublished and dateModified, all still guarded
       on presence. */
    const _article = {
      '@type':    'Article',
      '@id':      `${siteUrl}/inspiration/${page.slug}#article`,
      headline:   page.title,
      description: page.meta_desc || '',
      image:      page.og_image || `${siteUrl}/images/og-default.jpg`,
      author: author
        ? {
            '@type': 'Person',
            '@id':   `${siteUrl}/authors/${author.slug}#person`,
            name:    author.name,
            url:     `${siteUrl}/authors/${author.slug}`,
            ...(author.image_base ? { image: `${siteUrl}${author.image_base}-320.png` } : {}),
          }
        : sd.ref(sd.ID.organization),
      ...(_pub && !isNaN(_pub) ? { datePublished: _pub.toISOString() } : {}),
      ...(_mod && !isNaN(_mod) ? { dateModified:  _mod.toISOString() } : {}),
      publisher:        sd.ref(sd.ID.organization),
      mainEntityOfPage: sd.ref(sd.ID.webPage(`${siteUrl}/inspiration/${page.slug}`)),
    };

    /* The breadcrumb mirrors the trail already rendered at the top of
       inspiration-guide.ejs: Home > Inspiration > <title>. Google requires
       the markup to match what the user sees, and it does because both
       read the same three values. */
    const jsonLd = sd.scriptTag(sd.pageGraph({
      url:          `/inspiration/${page.slug}`,
      name:         page.title,
      description:  page.meta_desc || '',
      primaryImage: page.og_image || null,
      settings:     res.locals.settings,
      trail: [
        { name: 'Home',        url: '/' },
        { name: 'Inspiration', url: '/inspiration' },
        { name: page.title },
      ],
      nodes: [_article],
    }));

    res.render('pages/inspiration-guide', {
      layout:            'layouts/main',
      pageTitle:         page.meta_title || `${page.title} | BathroomVanitiesOutlet.com`,
      metaDesc:          page.meta_desc || '',
      canonicalUrl:      `${siteUrl}/inspiration/${page.slug}`,
      style:             '',
      jsonLd,
      page,
      related,
      shopProducts,
      shopLabel,
      shopCollectionUrl,
    });
  } catch (err) {
    console.error('[inspirationController] guide:', err.message);
    res.status(500).render('pages/error', { pageTitle: 'Error', message: 'An error occurred.' });
  }
};
