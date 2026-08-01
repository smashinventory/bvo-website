'use strict';

const Product   = require('../models/Product');
const Category  = require('../models/Category');
const Customer  = require('../models/Customer');
const { bvoPool } = require('../config/database');

/* ── /products/:slug ────────────────────────────────────────────── */
exports.show = async (req, res, next) => {
  try {
    const product = await Product.findBySlug(req.params.slug);
    if (!product) return res.status(404).render('pages/404', { pageTitle: '404 | BathroomVanitiesOutlet.com' });

    // Resolve category (graceful — DB may be down)
    let category = null;
    if (product.category_id) {
      try {
        const [rows] = await bvoPool.query(
          'SELECT id, slug, name FROM categories WHERE id = ? LIMIT 1',
          [product.category_id]
        );
        if (rows[0]) category = rows[0];
      } catch {
        category = null; // graceful fallback — category is display-only
      }
    }

    // Related products + documents + videos + suggested mirrors (parallel)
    //
    // suggestedMirrors: shown on vanity product pages (category_id=1) when the
    // product has a model name. Queries same-brand, same-model mirrors so shoppers
    // can see the mirror designed to match their vanity collection.
    // Returns up to 4 mirrors ordered by price ASC (entry price first).
    const isSuggestMirrors = !!(product.model && product.category_id === 1);
    const [related, docRows, videoRows, suggestedMirrors] = await Promise.all([
      product.category_id
        ? Product.findRelated(product.category_id, product.id, 4)
        : Promise.resolve([]),
      bvoPool.query(
        'SELECT doc_type, url, label FROM product_documents WHERE product_id = ? ORDER BY sort_order ASC, id ASC',
        [product.id]
      ).then(([rows]) => rows).catch(() => []),
      bvoPool.query(
        'SELECT url, title FROM product_videos WHERE product_id = ? ORDER BY sort_order ASC, id ASC',
        [product.id]
      ).then(([rows]) => rows).catch(() => []),
      isSuggestMirrors
        ? bvoPool.query(`
            SELECT p.id, p.slug, p.name, p.price, p.compare_price,
              COALESCE(
                p.primary_image_url,
                (SELECT pi.url FROM product_images pi
                 WHERE pi.product_id = p.id
                 ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1)
              ) AS primary_image
            FROM products p
            INNER JOIN categories c ON c.id = p.category_id
            WHERE p.brand     = 'James Martin Vanities'
              AND p.model     = ?
              AND c.slug      = 'bathroom-mirrors'
              AND p.is_active = 1
            ORDER BY p.price ASC
            LIMIT 4
          `, [product.model]).then(([rows]) => rows).catch(() => [])
        : Promise.resolve([]),
    ]);

    // Savings — only compute when compare_price is genuinely higher than price
    if (!product.savings && product.compare_price && product.compare_price > product.price) {
      product.savings    = (product.compare_price - product.price).toFixed(2);
      product.savingsPct = Math.round((1 - product.price / product.compare_price) * 100);
    }

    const siteUrl    = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';
    const canonicalUrl = `${siteUrl}/products/${product.slug}`;

    // Check if logged-in customer has this product saved
    const isFavorited = req.session.customerId
      ? (await Customer.getFavoriteIds(req.session.customerId)).has(product.id)
      : false;

    res.render('pages/product', {
      pageTitle:    `${product.meta_title || product.name} | BathroomVanitiesOutlet.com`,
      metaDesc:     product.meta_desc || product.short_desc || '',
      canonicalUrl,
      noindex:      false,
      siteUrl,
      product,
      category,
      related,
      suggestedMirrors,
      productDocs:   docRows,
      productVideos: videoRows,
      isFavorited,
    });
  } catch (err) { next(err); }
};
