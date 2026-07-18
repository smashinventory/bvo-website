'use strict';

const { bvoPool }              = require('../config/database');
const { FAMILIES, normalize }   = require('../config/colorFamilies');
const themeSettings            = require('../services/themeSettings');

/* Build family key → hex map */
const FAMILY_HEX = {};
FAMILIES.forEach(f => { FAMILY_HEX[f.key] = f.hex; FAMILY_HEX[f.key + '_border'] = f.border; });

async function getFeaturedProducts() {
  try {
    const [rows] = await bvoPool.query(`
      SELECT
        p.id, p.slug, p.name, p.brand, p.price, p.compare_price, p.is_new,
        COALESCE(p.primary_image_url, pi.url) AS primary_image,
        CASE
          WHEN p.compare_price IS NOT NULL AND p.compare_price > p.price THEN 'sale'
          WHEN p.is_new = 1 THEN 'new'
          WHEN p.is_featured = 1 THEN 'best'
          ELSE NULL
        END AS badge
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
      WHERE p.is_active = 1 AND p.is_featured = 1
      ORDER BY p.sort_order, p.created_at DESC
      LIMIT 12
    `);
    return rows;
  } catch {
    return [];
  }
}

async function getFeaturedModels() {
  try {
    /* Top 8 models by product count — with swatch data */
    const [modelRows] = await bvoPool.query(`
      SELECT
        p.model,
        p.brand,
        MIN(p.price)          AS price_from,
        MAX(p.price)          AS price_to,
        MIN(p.compare_price)  AS compare_price_from,
        GROUP_CONCAT(DISTINCT FLOOR(p.width_in) ORDER BY p.width_in) AS sizes_csv,
        COALESCE(
          MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END),
          MIN(pi.url)
        ) AS image_url
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
      WHERE p.is_active = 1 AND p.model IS NOT NULL
      GROUP BY p.model, p.brand
      ORDER BY COUNT(*) DESC
      LIMIT 8
    `);

    if (!modelRows.length) return [];

    /* Fetch per-model color swatches with one representative image per (model, color) */
    const modelNames = modelRows.map(r => r.model);
    const [swatchRows] = await bvoPool.query(`
      SELECT
        p.model,
        p.color,
        p.color_family,
        COALESCE(
          MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END),
          MIN(pi.url)
        ) AS image_url
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
      WHERE p.is_active = 1 AND p.model IN (${modelNames.map(() => '?').join(',')})
        AND p.color IS NOT NULL
      GROUP BY p.model, p.color, p.color_family
      ORDER BY p.model, p.color
    `, modelNames);

    const swatchMap = {};
    for (const r of swatchRows) {
      if (!swatchMap[r.model]) swatchMap[r.model] = [];
      const swatchFamilyKey = r.color_family || normalize(r.color, 'all') || '';
      swatchMap[r.model].push({
        color:        r.color,
        color_family: r.color_family,
        hex:          FAMILY_HEX[swatchFamilyKey]              || '#ccc',
        border:       FAMILY_HEX[swatchFamilyKey + '_border']  || '#aaa',
        image_url:    r.image_url || null,
      });
    }

    return modelRows.map(r => ({
      ...r,
      sizes:   r.sizes_csv ? r.sizes_csv.split(',').map(Number).filter(Boolean) : [],
      finishes: swatchMap[r.model] || [],
    }));
  } catch {
    return [];
  }
}

async function getFeaturedCategories() {
  try {
    const [rows] = await bvoPool.query(`
      SELECT slug, name, description, image_url
      FROM categories
      WHERE is_active = 1 AND parent_id IS NULL
      ORDER BY sort_order
    `);
    return rows;
  } catch {
    return [];
  }
}

exports.index = async (req, res, next) => {
  try {
    const [products, categories, featuredModels] = await Promise.all([
      getFeaturedProducts(),
      getFeaturedCategories(),
      getFeaturedModels(),
    ]);

    const ts = themeSettings.get();

    res.render('pages/index', {
      pageTitle: ts.seo?.home_title || 'BathroomVanitiesOutlet.com — Premium Vanities at Outlet Prices',
      metaDesc:  ts.seo?.home_description || 'Shop premium bathroom vanities, mirrors, faucets and accessories. Free shipping on all orders. Outlet prices on top brands.',
      products,
      categories,
      featuredModels,
      settings: ts,
    });
  } catch (err) {
    next(err);
  }
};
