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
const authors    = require('./authorsController');

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
  const siteUrl = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';

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

    res.render('pages/inspiration-hub', {
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
  const siteUrl  = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';

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

    // Related guides: other inspiration pages (up to 4, include og_image for cards)
    const [related] = await bvoPool.query(
      `SELECT slug, title, meta_desc, og_image
       FROM pages
       WHERE page_type = 'inspiration' AND is_visible = 1 AND id <> ?
       ORDER BY RAND()
       LIMIT 4`,
      [page.id]
    );

    // Product showcase — 4 products filtered by slug-derived color family (or featured)
    const { colorFamily, shopLabel } = _slugToShopMeta(slug);
    let shopProducts = [];
    try {
      const colorWhere = colorFamily ? 'AND LOWER(p.color_family) LIKE ?' : '';
      const colorParam = colorFamily ? [`%${colorFamily}%`] : [];
      const [rows] = await bvoPool.query(
        `SELECT p.id, p.slug, p.name, p.price, p.compare_price, p.brand,
                COALESCE(p.primary_image_url, pi.url) AS primary_image
         FROM products p
         LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
         WHERE p.is_active = 1 ${colorWhere}
         ORDER BY p.is_featured DESC, RAND()
         LIMIT 4`,
        colorParam
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

    const jsonLd = JSON.stringify({
      '@context':       'https://schema.org',
      '@type':          'Article',
      headline:         page.title,
      description:      page.meta_desc || '',
      image:            page.og_image || `${siteUrl}/images/og-default.jpg`,
      author: author
        ? {
            '@type': 'Person',
            name:    author.name,
            url:     `${siteUrl}/authors/${author.slug}`,
            ...(author.image_base ? { image: `${siteUrl}${author.image_base}-320.png` } : {}),
          }
        : { '@type': 'Organization', name: 'BathroomVanitiesOutlet.com' },
      ...(_pub && !isNaN(_pub) ? { datePublished: _pub.toISOString() } : {}),
      ...(_mod && !isNaN(_mod) ? { dateModified:  _mod.toISOString() } : {}),
      publisher:        {
        '@type': 'Organization',
        name:    'BathroomVanitiesOutlet.com',
        logo:    { '@type': 'ImageObject', url: `${siteUrl}/images/logos/BVOLOGOSQ_512.png` },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${siteUrl}/inspiration/${page.slug}` },
    });

    res.render('pages/inspiration-guide', {
      layout:            'layouts/main',
      pageTitle:         page.meta_title || `${page.title} | BathroomVanitiesOutlet.com`,
      metaDesc:          page.meta_desc || '',
      canonicalUrl:      `${siteUrl}/inspiration/${page.slug}`,
      style:             '',
      script:            `<script type="application/ld+json">${jsonLd}</script>`,
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
