'use strict';

/**
 * lookbookController.js
 * Visual gallery at /lookbook — bathroom vanity images with sidebar filters.
 * No prices, names, or descriptions — purely image-driven browsing.
 *
 * Filters:
 *   size          — width bucket labels from SIZE_BUCKETS (OR logic)
 *   color         — cabinet color_family key (OR logic)
 *   type          — product_type string (configuration); OR logic
 *   style         — EAV attr_key='style' value; OR logic
 *
 * Products limited to the bathroom-vanities source category.
 */

const { bvoPool }      = require('../config/database');
const { FAMILIES }     = require('../config/colorFamilies');
const { SIZE_BUCKETS } = require('../config/sizeBuckets');

const VANITY_SLUG = 'bathroom-vanities';
const LIMIT       = 72; // max products per page

const _BVO_STYLE_ORDER = [
  'Traditional', 'Transitional', 'Modern', 'Farmhouse', 'Mid-Century Modern',
  'Industrial', 'Coastal', 'Scandinavian', 'European / Old World',
];

const _CF_TYPES = [
  'Single Sink Vanity With Top',
  'Double Sink Vanity With Top',
  'Single Sink Cabinet Only',
  'Double Sink Cabinet Only',
];

exports.index = async (req, res, next) => {
  try {
    // ── Parse active filters ──────────────────────────────────────────
    const activeSizes  = [].concat(req.query.size  || []).filter(Boolean);
    const activeColors = [].concat(req.query.color || []).filter(Boolean);
    const activeTypes  = [].concat(req.query.type  || [])
                           .filter(v => _CF_TYPES.includes(v));
    const activeStyles = [].concat(req.query.style || []).filter(Boolean);

    const hasActiveFilters =
      activeSizes.length + activeColors.length +
      activeTypes.length + activeStyles.length > 0;

    // ── Fetch source category ─────────────────────────────────────────
    const [[cat]] = await bvoPool.query(
      'SELECT id FROM categories WHERE slug = ? LIMIT 1',
      [VANITY_SLUG]
    );
    const catId = cat ? cat.id : null;

    // ── Build WHERE for product query ─────────────────────────────────
    const pParams     = [];
    const pConditions = ['p.is_active = 1'];
    if (catId) { pConditions.push('p.category_id = ?'); pParams.push(catId); }

    // Size — each bucket is an OR clause
    if (activeSizes.length) {
      const sizeClauses = [];
      for (const label of activeSizes) {
        const bucket = SIZE_BUCKETS.find(b => b.label === label);
        if (!bucket) continue;
        if (bucket.max === Infinity) {
          sizeClauses.push('p.width_in >= ?');
          pParams.push(bucket.min);
        } else {
          sizeClauses.push('p.width_in BETWEEN ? AND ?');
          pParams.push(bucket.min, bucket.max);
        }
      }
      if (sizeClauses.length) pConditions.push(`(${sizeClauses.join(' OR ')})`);
    }

    // Color family (cabinet finish)
    if (activeColors.length) {
      pConditions.push(
        `p.color_family IN (${activeColors.map(() => '?').join(',')})`
      );
      pParams.push(...activeColors);
    }

    // Configuration (product_type)
    if (activeTypes.length) {
      pConditions.push(
        `p.product_type IN (${activeTypes.map(() => '?').join(',')})`
      );
      pParams.push(...activeTypes);
    }

    // Vanity style (EAV)
    if (activeStyles.length) {
      pConditions.push(`EXISTS (
        SELECT 1 FROM product_attribute_values pav
        WHERE pav.product_id = p.id
          AND pav.attr_key = 'style'
          AND pav.value_text IN (${activeStyles.map(() => '?').join(',')})
      )`);
      pParams.push(...activeStyles);
    }

    const PWHERE = pConditions.join(' AND ');

    // ── Fetch products ─────────────────────────────────────────────────
    const [products] = await bvoPool.query(`
      SELECT p.id, p.slug, p.width_in, p.color_family, p.product_type
      FROM products p
      WHERE ${PWHERE}
      ORDER BY p.is_featured DESC, p.id DESC
      LIMIT ${LIMIT}
    `, pParams);

    // ── Fetch all images for each product ──────────────────────────────
    if (products.length > 0) {
      const ids = products.map(p => p.id);
      const [imgRows] = await bvoPool.query(`
        SELECT product_id, url
        FROM product_images
        WHERE product_id IN (${ids.map(() => '?').join(',')})
        ORDER BY product_id, is_primary DESC, sort_order ASC, id ASC
      `, ids);

      const byProduct = {};
      for (const row of imgRows) {
        if (!byProduct[row.product_id]) byProduct[row.product_id] = [];
        byProduct[row.product_id].push(row.url);
      }
      for (const p of products) {
        p.images = byProduct[p.id] || [];
      }
    }

    // ── Available filter values (unfiltered — always show full set) ────
    const baseParams     = [];
    const baseConditions = ['p.is_active = 1'];
    if (catId) { baseConditions.push('p.category_id = ?'); baseParams.push(catId); }
    const BWHERE = baseConditions.join(' AND ');

    // Available color families in this category
    const [colorRows] = await bvoPool.query(
      `SELECT DISTINCT color_family FROM products p
       WHERE ${BWHERE} AND color_family IS NOT NULL ORDER BY color_family`,
      baseParams
    );
    const availColorKeys = colorRows.map(r => r.color_family);

    // Available styles in this category
    const [styleRows] = await bvoPool.query(
      `SELECT DISTINCT pav.value_text
       FROM product_attribute_values pav
       JOIN products p ON p.id = pav.product_id
       WHERE ${BWHERE} AND pav.attr_key = 'style' AND pav.value_text IS NOT NULL`,
      baseParams
    );
    const rawStyles  = styleRows.map(r => r.value_text);
    const availStyles = _BVO_STYLE_ORDER.filter(s => rawStyles.includes(s));

    // ── Color families config (cabinet type only) ──────────────────────
    const colorFamiliesConfig = FAMILIES
      .filter(f => f.type === 'cabinet' && availColorKeys.includes(f.key))
      .map(f => ({ ...f, isActive: activeColors.includes(f.key) }));

    // ── Total result count ────────────────────────────────────────────
    const [[{ total }]] = await bvoPool.query(
      `SELECT COUNT(*) AS total FROM products p WHERE ${PWHERE}`,
      pParams
    );

    // ── Render ────────────────────────────────────────────────────────
    const siteUrl = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';
    res.render('pages/lookbook', {
      layout:       'layouts/main',
      pageTitle:    'Lookbook | BathroomVanitiesOutlet.com',
      metaDesc:     'Browse our visual vanity lookbook — shop by size, color, configuration, and style. No distractions, just beautiful bathrooms.',
      canonicalUrl: `${siteUrl}/lookbook`,
      noindex:      false,
      products,
      total,
      activeSizes,
      activeColors,
      activeTypes,
      activeStyles,
      hasActiveFilters,
      sizeBuckets:        SIZE_BUCKETS,
      colorFamiliesConfig,
      availStyles,
      cfTypes:            _CF_TYPES,
    });
  } catch (err) {
    next(err);
  }
};
