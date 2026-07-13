'use strict';

const { bvoPool }    = require('../config/database');
const MODEL_FAMILIES = require('../data/modelFamilies');
const themeSettings  = require('../services/themeSettings');

async function getFeaturedProducts() {
  try {
    const [rows] = await bvoPool.query(`
      SELECT
        p.id, p.slug, p.name, p.brand, p.price, p.compare_price, p.is_new,
        pi.url AS primary_image,
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

async function getFeaturedCategories() {
  try {
    const [rows] = await bvoPool.query(`
      SELECT slug, name, description, image_url
      FROM categories
      WHERE is_active = 1 AND parent_id IS NULL
      ORDER BY sort_order
      LIMIT 4
    `);
    return rows;
  } catch {
    return [];
  }
}

exports.index = async (req, res, next) => {
  try {
    const [products, categories] = await Promise.all([
      getFeaturedProducts(),
      getFeaturedCategories(),
    ]);

    const ts = themeSettings.get();

    res.render('pages/index', {
      pageTitle: ts.seo?.home_title || 'BathroomVanitiesOutlet.com — Premium Vanities at Outlet Prices',
      metaDesc:  ts.seo?.home_description || 'Shop premium bathroom vanities, mirrors, faucets and accessories. Free shipping on all orders. Outlet prices on top brands.',
      products,
      categories,
      modelFamilies: MODEL_FAMILIES,
      settings: ts,
    });
  } catch (err) {
    next(err);
  }
};
