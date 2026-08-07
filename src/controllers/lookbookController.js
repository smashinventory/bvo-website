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

    // ── Build WHERE — two parallel versions ───────────────────────────
    // pConds / pParams  → outer query  (table alias p.)
    // iConds / iParams  → inner subquery (bare column names, single table)
    // Both encode the same logical filters so the subquery picks only
    // representative products that actually satisfy the active filters.

    const pParams = [], iParams = [];
    // Always limit to vanity product types — tops, mirrors, faucets, etc. are excluded.
    const VANITY_TYPES_PH = _CF_TYPES.map(() => '?').join(',');
    const pConds = [
      'p.is_active = 1',
      `p.product_type IN (${VANITY_TYPES_PH})`,
    ];
    const iConds = [
      'is_active = 1',
      `product_type IN (${VANITY_TYPES_PH})`,
    ];
    pParams.push(..._CF_TYPES);
    iParams.push(..._CF_TYPES);
    if (catId) {
      pConds.push('p.category_id = ?'); pParams.push(catId);
      iConds.push('category_id = ?');   iParams.push(catId);
    }

    // Size — each bucket is an OR clause
    if (activeSizes.length) {
      const pSz = [], iSz = [];
      for (const label of activeSizes) {
        const bucket = SIZE_BUCKETS.find(b => b.label === label);
        if (!bucket) continue;
        if (bucket.max === Infinity) {
          pSz.push('p.width_in >= ?'); pParams.push(bucket.min);
          iSz.push('width_in >= ?');   iParams.push(bucket.min);
        } else {
          pSz.push('p.width_in BETWEEN ? AND ?'); pParams.push(bucket.min, bucket.max);
          iSz.push('width_in BETWEEN ? AND ?');   iParams.push(bucket.min, bucket.max);
        }
      }
      if (pSz.length) { pConds.push(`(${pSz.join(' OR ')})`); iConds.push(`(${iSz.join(' OR ')})`); }
    }

    // Color family
    if (activeColors.length) {
      const ph = activeColors.map(() => '?').join(',');
      pConds.push(`p.color_family IN (${ph})`); pParams.push(...activeColors);
      iConds.push(`color_family IN (${ph})`);   iParams.push(...activeColors);
    }

    // Configuration (product_type)
    if (activeTypes.length) {
      const ph = activeTypes.map(() => '?').join(',');
      pConds.push(`p.product_type IN (${ph})`); pParams.push(...activeTypes);
      iConds.push(`product_type IN (${ph})`);   iParams.push(...activeTypes);
    }

    // Vanity style (EAV) — inner query uses bare 'id' which refers to products.id
    if (activeStyles.length) {
      const ph = activeStyles.map(() => '?').join(',');
      pConds.push(`EXISTS (
        SELECT 1 FROM product_attribute_values pav
        WHERE pav.product_id = p.id AND pav.attr_key = 'style'
          AND pav.value_text IN (${ph})
      )`);
      pParams.push(...activeStyles);
      iConds.push(`EXISTS (
        SELECT 1 FROM product_attribute_values pav
        WHERE pav.product_id = id AND pav.attr_key = 'style'
          AND pav.value_text IN (${ph})
      )`);
      iParams.push(...activeStyles);
    }

    const PWHERE = pConds.join(' AND ');
    const IWHERE = iConds.join(' AND ');

    // ── Fetch one product per model ────────────────────────────────────
    // Inner subquery: MIN(id) per model within the active filters → one
    // representative per model that actually satisfies all active filters.
    // Products without a model value are excluded (too many one-off SKUs).
    const [products] = await bvoPool.query(`
      SELECT p.id, p.slug, p.model, p.width_in, p.color_family, p.product_type
      FROM products p
      WHERE ${PWHERE}
        AND p.model IS NOT NULL AND p.model != ''
        AND p.id IN (
          SELECT COALESCE(
            MIN(CASE WHEN product_type LIKE '%Cabinet Only%' THEN id END),
            MIN(id)
          ) FROM products
          WHERE ${IWHERE}
            AND model IS NOT NULL AND model != ''
          GROUP BY model
        )
      ORDER BY p.is_featured DESC, p.model ASC
      LIMIT ${LIMIT}
    `, [...pParams, ...iParams]);

    // ── Fetch images from ALL variants + per-model color roster ──────────
    // For each model card we want:
    //   • Images from every variant, cabinet-only images first (so the first
    //     image the user sees is always the cabinet without a top).
    //   • Deduplicated by URL (many variants share the same hero shot).
    //   • The full list of cabinet colors the model is available in.
    if (products.length > 0) {
      const models   = products.map(p => p.model);
      const modelPh  = models.map(() => '?').join(',');
      const typePh   = _CF_TYPES.map(() => '?').join(',');

      // All product IDs sharing these model names (same category + type guard).
      const [allVariants] = await bvoPool.query(`
        SELECT id, model
        FROM products
        WHERE model IN (${modelPh})
          AND is_active = 1
          ${catId ? 'AND category_id = ?' : ''}
          AND product_type IN (${typePh})
        ORDER BY model,
                 CASE WHEN product_type LIKE '%Cabinet Only%' THEN 0 ELSE 1 END,
                 id ASC
      `, [...models, ...(catId ? [catId] : []), ..._CF_TYPES]);

      if (allVariants.length > 0) {
        const allIds = allVariants.map(v => v.id);
        const idPh   = allIds.map(() => '?').join(',');

        // Images for all variant IDs — cabinet-only variant images lead.
        const [imgRows] = await bvoPool.query(`
          SELECT pi.product_id, pi.url, p.model
          FROM product_images pi
          JOIN products p ON p.id = pi.product_id
          WHERE pi.product_id IN (${idPh})
          ORDER BY p.model,
                   CASE WHEN p.product_type LIKE '%Cabinet Only%' THEN 0 ELSE 1 END,
                   pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
        `, allIds);

        // Accumulate per-model, deduplicating by URL.
        const modelImages  = {};
        const modelSeenUrl = {};
        for (const row of imgRows) {
          if (!modelImages[row.model]) {
            modelImages[row.model]  = [];
            modelSeenUrl[row.model] = new Set();
          }
          if (!modelSeenUrl[row.model].has(row.url)) {
            modelImages[row.model].push(row.url);
            modelSeenUrl[row.model].add(row.url);
          }
        }

        // Colors the model is available in (for card swatches).
        const [colorRows] = await bvoPool.query(`
          SELECT model,
                 GROUP_CONCAT(DISTINCT color_family ORDER BY color_family) AS colors
          FROM products
          WHERE model IN (${modelPh})
            AND is_active = 1
            ${catId ? 'AND category_id = ?' : ''}
            AND color_family IS NOT NULL AND color_family != ''
          GROUP BY model
        `, [...models, ...(catId ? [catId] : [])]);

        const modelColorMap = {};
        for (const row of colorRows) {
          modelColorMap[row.model] = row.colors ? row.colors.split(',') : [];
        }

        for (const p of products) {
          p.images      = modelImages[p.model]   || [];
          p.availColors = modelColorMap[p.model] || [];
        }
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
