'use strict';

const { bvoPool } = require('../config/database');
const Category    = require('../models/Category');
const Product     = require('../models/Product');

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
  const siteUrl = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';
  const today   = new Date().toISOString().split('T')[0];

  try {
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
    const fmtDate = (d) => d ? new Date(d).toISOString().split('T')[0] : today;

    const urls = [];

    // Homepage
    urls.push(`
  <url>
    <loc>${escUrl(siteUrl)}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`);

    // Collections index
    urls.push(`
  <url>
    <loc>${escUrl(siteUrl)}/collections</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);

    // Individual category pages
    for (const cat of categories) {
      urls.push(`
  <url>
    <loc>${escUrl(`${siteUrl}/collections/${cat.slug}`)}</loc>
    <lastmod>${fmtDate(cat.updated_at)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }

    // Product pages
    for (const p of products) {
      urls.push(`
  <url>
    <loc>${escUrl(`${siteUrl}/products/${p.slug}`)}</loc>
    <lastmod>${fmtDate(p.updated_at)}</lastmod>
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
