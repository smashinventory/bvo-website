'use strict';

const Product   = require('../models/Product');
const Category  = require('../models/Category');
const Customer  = require('../models/Customer');
const { bvoPool } = require('../config/database');
const { FAMILIES } = require('../config/colorFamilies');

/* ── Taxonomy constants ─────────────────────────────────────────── */
const VANITY_CAT_ID  = 1;
const CABINET_TYPES  = ['Single Sink Cabinet Only', 'Double Sink Cabinet Only'];
const WITH_TOP_TYPES = ['Single Sink Vanity With Top', 'Double Sink Vanity With Top'];

/* ── Stone material extractor (mirrors bundleController) ────────── */
function _extractTopMaterial(name) {
  const m = (name || '').match(/,\s*\d+(?:\.\d+)?\s*CM\s+(.+?)\s+w\//i);
  return m ? m[1].trim() : '';
}

/* ── Color family lookup map (built once at module load) ────────── */
const COLOR_FAMILY_MAP = {};
FAMILIES.forEach(f => { COLOR_FAMILY_MAP[f.key] = f; });

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
        category = null;
      }
    }

    // Determine which parallel queries to run
    const isSuggestMirrors = !!(product.model && product.category_id === VANITY_CAT_ID);

    // Variant selector is available for vanity products that have width + color data
    const isVanityWithVariants = isSuggestMirrors && !!product.width_in && !!product.color_family;

    // Related products + documents + videos + suggested mirrors + all model variants (parallel)
    const [related, docRows, videoRows, suggestedMirrors, allVariants] = await Promise.all([
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
      // All active variants of this model in the vanities category
      isVanityWithVariants
        ? bvoPool.query(`
            SELECT id, slug, name, product_type, width_in, color_family
            FROM products
            WHERE model = ? AND category_id = ? AND is_active = 1
            ORDER BY width_in ASC, color_family ASC, id ASC
          `, [product.model, VANITY_CAT_ID]).then(([rows]) => rows).catch(() => [])
        : Promise.resolve([]),
    ]);

    // ── Build variant selector config ──────────────────────────────
    let variantConfig = null;
    if (isVanityWithVariants && allVariants.length > 0) {
      const { width_in: w, color_family: cf, product_type: pt, slug: currentSlug } = product;
      const isCabinetOnly    = CABINET_TYPES.includes(pt);
      const currentMaterial  = isCabinetOnly ? null : _extractTopMaterial(product.name);

      // Enrich With Top variants with stone_material
      const enriched = allVariants.map(v => ({
        ...v,
        stone_material: WITH_TOP_TYPES.includes(v.product_type) ? _extractTopMaterial(v.name) : null,
      }));

      // ── Size chips: unique widths for same model + same color ──
      const sameColor  = enriched.filter(v => v.color_family === cf);
      const uniqueWidths = [...new Set(sameColor.map(v => v.width_in))].sort((a, b) => a - b);

      const sizeChips = uniqueWidths.map(ww => {
        const at = sameColor.filter(v => Math.abs(v.width_in - ww) < 0.1);
        // Prefer: same stone material (With Top), then Cabinet Only, then any
        let best = null;
        if (!isCabinetOnly && currentMaterial) {
          best = at.find(v => WITH_TOP_TYPES.includes(v.product_type) && v.stone_material === currentMaterial);
        }
        if (!best) best = at.find(v => CABINET_TYPES.includes(v.product_type));
        if (!best) best = at[0];
        return best ? { width_in: ww, slug: best.slug, isSelected: Math.abs(ww - w) < 0.1 } : null;
      }).filter(Boolean);

      // ── Color swatches: unique colors for same model + same width ──
      const sameWidth = enriched.filter(v => Math.abs(v.width_in - w) < 0.1 && v.color_family);
      const uniqueColors = [...new Set(sameWidth.map(v => v.color_family))].sort();

      const colorSwatches = uniqueColors.map(c => {
        const at = sameWidth.filter(v => v.color_family === c);
        let best = null;
        if (!isCabinetOnly && currentMaterial) {
          best = at.find(v => WITH_TOP_TYPES.includes(v.product_type) && v.stone_material === currentMaterial);
        }
        if (!best) best = at.find(v => CABINET_TYPES.includes(v.product_type));
        if (!best) best = at[0];
        return best ? { color_family: c, slug: best.slug, isSelected: c === cf } : null;
      }).filter(Boolean);

      // ── Stone top tiles: With Top variants at current size + color ──
      const stoneTops = enriched
        .filter(v =>
          Math.abs(v.width_in - w) < 0.1 &&
          v.color_family === cf &&
          WITH_TOP_TYPES.includes(v.product_type)
        )
        .map(v => ({ ...v, isSelected: v.slug === currentSlug }));

      // ── Cabinet Only for "No Top" tile ──
      const cabinetOnly = enriched.find(v =>
        Math.abs(v.width_in - w) < 0.1 &&
        v.color_family === cf &&
        CABINET_TYPES.includes(v.product_type)
      );

      variantConfig = {
        sizeChips,
        colorSwatches,
        stoneTops,
        cabinetOnlySlug:    cabinetOnly ? cabinetOnly.slug : null,
        isCabinetOnly,
        currentStoneMaterial: currentMaterial || null,
        hasStoneOptions:    stoneTops.length > 0,
        colorFamilyMap:     COLOR_FAMILY_MAP,
      };
    }

    // Savings badge
    if (!product.savings && product.compare_price && product.compare_price > product.price) {
      product.savings    = (product.compare_price - product.price).toFixed(2);
      product.savingsPct = Math.round((1 - product.price / product.compare_price) * 100);
    }

    const siteUrl     = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';
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
      variantConfig,
    });
  } catch (err) { next(err); }
};
