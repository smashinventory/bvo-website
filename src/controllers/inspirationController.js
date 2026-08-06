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

/**
 * GET /inspiration/:slug
 * Renders a single inspiration/style guide page.
 */
exports.guide = async (req, res) => {
  const { slug } = req.params;
  const siteUrl  = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';

  try {
    const [[page]] = await bvoPool.query(
      `SELECT id, slug, title, content, meta_title, meta_desc, og_image
       FROM pages
       WHERE slug = ? AND page_type = 'inspiration' AND is_visible = 1`,
      [slug]
    );

    if (!page) {
      return res.status(404).render('pages/404', {
        pageTitle: '404 — Page Not Found | BathroomVanitiesOutlet.com',
      });
    }

    // Related guides: other inspiration pages (up to 4)
    const [related] = await bvoPool.query(
      `SELECT slug, title, meta_desc
       FROM pages
       WHERE page_type = 'inspiration' AND is_visible = 1 AND id <> ?
       ORDER BY RAND()
       LIMIT 4`,
      [page.id]
    );

    // Article JSON-LD for SEO
    const jsonLd = JSON.stringify({
      '@context':       'https://schema.org',
      '@type':          'Article',
      headline:         page.title,
      description:      page.meta_desc || '',
      image:            page.og_image || `${siteUrl}/images/og-default.jpg`,
      author:           { '@type': 'Organization', name: 'BathroomVanitiesOutlet.com' },
      publisher:        {
        '@type': 'Organization',
        name:    'BathroomVanitiesOutlet.com',
        logo:    { '@type': 'ImageObject', url: `${siteUrl}/images/logos/BVOLOGOSQ_512.png` },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${siteUrl}/inspiration/${page.slug}` },
    });

    res.render('pages/inspiration-guide', {
      layout:       'layouts/main',
      pageTitle:    page.meta_title || `${page.title} | BathroomVanitiesOutlet.com`,
      metaDesc:     page.meta_desc || '',
      canonicalUrl: `${siteUrl}/inspiration/${page.slug}`,
      style:        '',
      script:       `<script type="application/ld+json">${jsonLd}</script>`,
      page,
      related,
    });
  } catch (err) {
    console.error('[inspirationController] guide:', err.message);
    res.status(500).render('pages/error', { pageTitle: 'Error', message: 'An error occurred.' });
  }
};
