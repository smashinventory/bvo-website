'use strict';

const { bvoPool }    = require('../config/database');
const MODEL_FAMILIES = require('../data/modelFamilies');
const themeSettings  = require('../services/themeSettings');

/**
 * Placeholder product data — used while the DB is being populated.
 * Each item matches the shape returned by the real DB query below.
 */
const PLACEHOLDER_PRODUCTS = [
  { id:  1, slug: 'sample-vanity-36-white-marble',  name: '36" Single Sink Vanity — White Marble',  brand: 'James Martin',      price:  899.00, compare_price: 1199.00, badge: 'sale', primary_image: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=600&q=80' },
  { id:  2, slug: 'sample-vanity-48-grey-oak',       name: '48" Double Sink Vanity — Grey Oak',       brand: 'James Martin',      price: 1249.00, compare_price: null,    badge: 'new',  primary_image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80' },
  { id:  3, slug: 'sample-vanity-60-espresso',       name: '60" Freestanding Vanity — Espresso',      brand: 'James Martin',      price: 1599.00, compare_price: 1899.00, badge: 'sale', primary_image: 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=600&q=80' },
  { id:  4, slug: 'sample-vanity-24-glossy-white',   name: '24" Wall-Mount Vanity — Glossy White',    brand: 'James Martin',      price:  649.00, compare_price: null,    badge: 'best', primary_image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80' },
  { id:  5, slug: 'sample-mirror-frameless-36',      name: '36" Frameless LED Mirror',                brand: 'Kohler',            price:  299.00, compare_price:  399.00, badge: 'sale', primary_image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=600&q=80' },
  { id:  6, slug: 'sample-faucet-brushed-nickel',    name: 'Single-Handle Faucet — Brushed Nickel',   brand: 'Moen',              price:  189.00, compare_price: null,    badge: 'new',  primary_image: 'https://images.unsplash.com/photo-1564540583246-934409427776?auto=format&fit=crop&w=600&q=80' },
  { id:  7, slug: 'sample-vanity-72-navy-blue',      name: '72" Double Vanity — Navy Blue',            brand: 'James Martin',      price: 2199.00, compare_price: 2599.00, badge: 'sale', primary_image: 'https://images.unsplash.com/photo-1507652955-f3dcef5a3be5?auto=format&fit=crop&w=600&q=80' },
  { id:  8, slug: 'sample-faucet-matte-black',       name: 'Widespread Faucet — Matte Black',         brand: 'Delta',             price:  249.00, compare_price: null,    badge: 'new',  primary_image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80' },
  { id:  9, slug: 'sample-vanity-42-walnut',         name: '42" Single Vanity — Natural Walnut',      brand: 'Signature Hardware', price: 1099.00, compare_price: 1299.00, badge: 'sale', primary_image: 'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=600&q=80' },
  { id: 10, slug: 'sample-shower-system-chrome',     name: 'Rain Shower System — Polished Chrome',    brand: 'Hansgrohe',         price:  799.00, compare_price: null,    badge: 'new',  primary_image: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=600&q=80' },
  { id: 11, slug: 'sample-toilet-elongated-white',   name: 'Elongated Comfort Height Toilet',          brand: 'TOTO',              price:  549.00, compare_price:  699.00, badge: 'sale', primary_image: 'https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&w=600&q=80' },
  { id: 12, slug: 'sample-vanity-48-sage-green',     name: '48" Single Vanity — Sage Green',           brand: 'American Standard', price: 1149.00, compare_price: null,    badge: 'new',  primary_image: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=600&q=80' },
];

const PLACEHOLDER_CATEGORIES = [
  { slug: 'vanities',    name: 'Bathroom Vanities', description: 'Single, double &amp; freestanding', image_url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=600&q=80' },
  { slug: 'mirrors',     name: 'Mirrors',            description: 'Framed, frameless &amp; lighted',  image_url: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=600&q=80' },
  { slug: 'faucets',     name: 'Faucets',            description: 'Sink, shower &amp; tub',           image_url: 'https://images.unsplash.com/photo-1564540583246-934409427776?auto=format&fit=crop&w=600&q=80' },
  { slug: 'accessories', name: 'Accessories',        description: 'Finishing touches',                image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80' },
];

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
    return rows.length ? rows : PLACEHOLDER_PRODUCTS;
  } catch {
    // DB not yet configured — return placeholder data so page still renders
    return PLACEHOLDER_PRODUCTS;
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
    return rows.length ? rows : PLACEHOLDER_CATEGORIES;
  } catch {
    return PLACEHOLDER_CATEGORIES;
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
