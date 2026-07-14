'use strict';

const Category                    = require('../models/Category');
const Product                     = require('../models/Product');
const { FAMILIES, normalize, getFamily } = require('../config/colorFamilies');
const { bvoPool }                        = require('../config/database');

/* ── Build a color family hex lookup: family_key → hex ─────────── */
const FAMILY_HEX = {};
FAMILIES.forEach(f => { FAMILY_HEX[f.key] = f.hex; FAMILY_HEX[f.key + '_border'] = f.border; });

const MODELS_PER_PAGE = 12;

/* ── /collections — all categories ─────────────────────────────── */
exports.index = async (req, res, next) => {
  try {
    const categories = await Category.findAll();
    res.render('pages/collections', {
      pageTitle: 'All Collections | BathroomVanitiesOutlet.com',
      metaDesc:  'Browse our full range of bathroom vanities, mirrors, faucets, lighting, and accessories.',
      categories,
    });
  } catch (err) { next(err); }
};

/* ── /collections/:slug — products in category ──────────────────── */
exports.show = async (req, res, next) => {
  try {
    const { slug } = req.params;

    // ── Virtual "vanity-models" collection ───────────────────────────
    // DB-driven browse page — groups products by products.model column.
    if (slug === 'vanity-models') {
      const page = Math.max(1, parseInt(req.query.page || '1', 10));

      // ── Parse filter params ──────────────────────────────────────
      const activeSizes    = [].concat(req.query.size   || []).filter(Boolean).map(Number);
      const activeBrands   = [].concat(req.query.brand  || []).filter(Boolean);
      const activeFinishes = [].concat(req.query.finish || []).filter(Boolean);  // color values
      const vmMinPrice     = req.query.min_price ? parseFloat(req.query.min_price) : undefined;
      const vmMaxPrice     = req.query.max_price ? parseFloat(req.query.max_price) : undefined;

      const hasActiveFilters = !!(
        activeSizes.length || activeBrands.length || activeFinishes.length ||
        vmMinPrice != null || vmMaxPrice != null
      );

      // ── Build available filter options from DB ───────────────────
      const [optRows] = await bvoPool.query(`
        SELECT DISTINCT
          FLOOR(p.width_in) AS size_in,
          p.brand,
          p.color,
          p.color_family
        FROM products p
        WHERE p.is_active = 1 AND p.model IS NOT NULL
      `);
      const allSizes    = [...new Set(optRows.map(r => r.size_in).filter(Boolean))].sort((a,b)=>a-b);
      const allBrands   = [...new Set(optRows.map(r => r.brand).filter(Boolean))].sort();
      const allFinishes = [...new Set(optRows.map(r => r.color).filter(Boolean))].sort();
      /* Build color-name → hex map for sidebar filter swatches */
      const finishMap = {};
      optRows.forEach(r => {
        if (r.color && !finishMap[r.color]) {
          finishMap[r.color] = FAMILY_HEX[r.color_family] || '#CCCCCC';
        }
      });

      // ── Query model groups from DB ───────────────────────────────
      let vmWhere  = 'p.is_active = 1 AND p.model IS NOT NULL';
      const vmParams = [];

      if (activeBrands.length) {
        vmWhere += ` AND p.brand IN (${activeBrands.map(()=>'?').join(',')})`;
        vmParams.push(...activeBrands);
      }
      if (activeFinishes.length) {
        vmWhere += ` AND p.color IN (${activeFinishes.map(()=>'?').join(',')})`;
        vmParams.push(...activeFinishes);
      }
      if (vmMinPrice != null) { vmWhere += ' AND p.price >= ?'; vmParams.push(vmMinPrice); }
      if (vmMaxPrice != null) { vmWhere += ' AND p.price <= ?'; vmParams.push(vmMaxPrice); }

      // Fetch all matching models (we filter sizes in JS since GROUP_CONCAT is easier)
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
        WHERE ${vmWhere}
        GROUP BY p.model, p.brand
        ORDER BY p.brand, p.model
      `, vmParams);

      // Fetch per-model color swatches: [{model, color, color_family}]
      const [swatchRows] = await bvoPool.query(`
        SELECT DISTINCT model, color, color_family
        FROM products
        WHERE is_active = 1 AND model IS NOT NULL AND color IS NOT NULL
        ORDER BY model, color
      `);
      const swatchMap = {};  // { 'London': [{color, color_family, hex, border}] }
      for (const r of swatchRows) {
        if (!swatchMap[r.model]) swatchMap[r.model] = [];
        swatchMap[r.model].push({
          color:        r.color,
          color_family: r.color_family,
          hex:          FAMILY_HEX[r.color_family]        || '#ccc',
          border:       FAMILY_HEX[r.color_family + '_border'] || '#aaa',
        });
      }

      // Parse sizes and apply size filter
      let models = modelRows.map(r => ({
        ...r,
        sizes: r.sizes_csv ? r.sizes_csv.split(',').map(Number).filter(Boolean) : [],
        finishes: swatchMap[r.model] || [],
      }));

      if (activeSizes.length) {
        models = models.filter(m => activeSizes.some(sz => m.sizes.some(ms => Math.abs(ms - sz) <= 1)));
      }

      // Price range for slider
      const allPrices = modelRows.map(r => r.price_from).filter(Boolean);
      const vmPriceMin = allPrices.length ? Math.min(...allPrices) : 0;
      const vmPriceMax = allPrices.length ? Math.max(...allPrices) : 9999;

      // Paginate
      const total  = models.length;
      const pages  = Math.ceil(total / MODELS_PER_PAGE) || 1;
      const offset = (page - 1) * MODELS_PER_PAGE;
      const pagedModels = models.slice(offset, offset + MODELS_PER_PAGE);

      return res.render('pages/vanity-models', {
        pageTitle: 'Vanity Models | BathroomVanitiesOutlet.com',
        metaDesc:  'Browse all bathroom vanity collections — explore every model, finish, and size we carry.',
        models: pagedModels,
        page, pages, total,
        perPage: MODELS_PER_PAGE,
        activeSizes, activeBrands, activeFinishes,
        vmMinPrice, vmMaxPrice,
        hasActiveFilters,
        allSizes, allBrands, allFinishes,
        finishMap,
        vmPriceMin, vmPriceMax,
        familyHex: FAMILY_HEX,
      });
    }

    // ── Virtual "sale" collection ─────────────────────────────────────
    if (slug === 'sale') {
      const [saleRows] = await bvoPool.query(`
        SELECT p.id, p.slug, p.name, p.brand, p.price, p.compare_price,
               p.is_new, p.is_featured,
               COALESCE(p.primary_image_url, pi.url) AS primary_image,
               'sale' AS badge
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        WHERE p.is_active = 1 AND p.compare_price IS NOT NULL AND p.compare_price > p.price
        ORDER BY p.is_featured DESC, p.created_at DESC
        LIMIT 48
      `).catch(() => [[]]);
      const products = Array.isArray(saleRows[0]) ? saleRows[0] : saleRows;
      return res.render('pages/collection', {
        pageTitle:    'Sale | BathroomVanitiesOutlet.com',
        metaDesc:     'Shop discounted bathroom vanities, mirrors, faucets and accessories.',
        category:     { id: null, slug: 'sale', name: 'Sale', description: 'Discounted products — limited time offers', meta_title: 'Sale', meta_desc: '' },
        products,
        total: products.length, page: 1, pages: 1, perPage: 48,
        sort: 'featured',
        brands: [], productTypes: [],
        attrFilters: {}, activeAttrFilters: {},
        minPrice: undefined, maxPrice: undefined,
        priceRange: { min: 0, max: 9999 },
        availableBrands: [],
        attributeDefs: [],
        finishHex: Product.FINISH_HEX,
        hasActiveFilters: false,
        colorFamiliesConfig: FAMILIES,
        colorFamilyActive: [],
        colorExactActive: [],
        rangeFilters: {},
      });
    }

    const category = await Category.findBySlug(slug);
    if (!category) return res.status(404).render('pages/404', { pageTitle: '404 | BathroomVanitiesOutlet.com' });

    // ── Parse standard query params ──────────────────────────────────
    const page     = Math.max(1, parseInt(req.query.page  || '1', 10));
    const sort     = req.query.sort || 'featured';
    const brands   = [].concat(req.query.brand        || []).filter(Boolean);
    const productTypes = [].concat(req.query.type     || []).filter(Boolean);
    const model    = req.query.model || null;   // e.g. 'brookfield', 'linear'
    const minPrice = req.query.min_price ? parseFloat(req.query.min_price) : undefined;
    const maxPrice = req.query.max_price ? parseFloat(req.query.max_price) : undefined;

    // ── Color family filter params ───────────────────────────────────
    // color_family[] — selected family keys (e.g. ['blue', 'black'])
    // color_exact[]  — selected exact manufacturer values (e.g. ['Navy Blue', 'Midnight'])
    //                  exact values implicitly belong to one family (resolved via normalize())
    const colorFamilyParam = [].concat(req.query.color_family || []).filter(Boolean);
    const colorExactParam  = [].concat(req.query.color_exact  || []).filter(Boolean);

    // Determine which families are in "exact sub-chip mode" vs "whole-family mode".
    // A family is in exact mode when it has at least one color_exact value.
    const exactFamilyKeys = new Set();
    colorExactParam.forEach(v => {
      const fam = normalize(v);
      if (fam) exactFamilyKeys.add(fam);
    });

    // Families selected at the whole-family level (no sub-chip override for them)
    const familyLevelKeys = colorFamilyParam.filter(f => !exactFamilyKeys.has(f));

    // Enriched families config for the view — precompute active/open state per family
    const colorFamiliesConfig = FAMILIES.map(fam => ({
      ...fam,
      isActive: colorFamilyParam.includes(fam.key) || exactFamilyKeys.has(fam.key),
      isOpen:   colorFamilyParam.includes(fam.key) || exactFamilyKeys.has(fam.key),
      activeExact: colorExactParam.filter(e => normalize(e) === fam.key),
    }));

    // colorFilters passed to the model
    const colorFilters = {
      families: familyLevelKeys,   // whole-family: match color_family column
      exact:    colorExactParam,   // exact: match value_text
    };
    const hasColorFilter = colorFamilyParam.length > 0 || colorExactParam.length > 0;

    // ── Load attribute definitions + available filter values ─────────
    const [attributeDefs, availableBrands, availableAttrValues] = await Promise.all([
      Category.getAttributeDefinitions(category.id),
      Category.getBrandsForCategory(category.id),
      Product.getAllAttributeValues(category.id),
    ]);

    /*
     * Parse dynamic attribute filters from query string.
     * Skip cabinet_finish — handled by colorFilters above.
     * Range attrs: ?{attr_key}_min / ?{attr_key}_max
     * Size (range attr rendered as checkboxes): '84+' is a catch-all for >= 84"
     */
    const attrFilters  = {};   // { attr_key: string[] | ['84+', ...] }
    const rangeFilters = {};   // { attr_key: { min, max } }

    for (const def of attributeDefs) {
      if (def.attr_key === 'brand')           continue; // handled above
      if (def.attr_key === 'cabinet_finish')  continue; // handled by colorFilters

      if (def.filter_type === 'range') {
        // Special case: size_in rendered as checkboxes including '84+' catch-all
        if (def.attr_key === 'size_in') {
          const sizeVals = [].concat(req.query['size_in'] || []).filter(Boolean);
          if (sizeVals.length) attrFilters['size_in'] = sizeVals;
        } else {
          const lo = req.query[`${def.attr_key}_min`];
          const hi = req.query[`${def.attr_key}_max`];
          if (lo != null || hi != null) {
            rangeFilters[def.attr_key] = {
              min: lo != null ? parseFloat(lo) : undefined,
              max: hi != null ? parseFloat(hi) : undefined,
            };
          }
        }
      } else {
        const vals = [].concat(req.query[def.attr_key] || []).filter(Boolean);
        if (vals.length) attrFilters[def.attr_key] = vals;
      }
    }

    // Merge range filters into the format Product.findByCategory expects
    const mergedAttrFilters = { ...attrFilters };
    for (const [key, { min, max }] of Object.entries(rangeFilters)) {
      mergedAttrFilters[key] = [min, max];
    }

    const hasActiveFilters = !!(
      brands.length || productTypes.length ||
      Object.keys(attrFilters).length || Object.keys(rangeFilters).length ||
      minPrice != null || maxPrice != null ||
      hasColorFilter || model
    );

    // ── SEO ──────────────────────────────────────────────────────────
    const siteUrl     = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';
    const canonicalUrl = `${siteUrl}/collections/${slug}`;

    const activeFilterGroupCount = [
      brands.length > 0,
      productTypes.length > 0,
      ...Object.keys(attrFilters).map(k => attrFilters[k].length > 0),
      Object.keys(rangeFilters).length > 0,
      minPrice != null || maxPrice != null,
      hasColorFilter,
    ].filter(Boolean).length;
    const noindex = activeFilterGroupCount >= 2;

    // ── Fetch products + price range ──────────────────────────────────
    const [result, priceRange] = await Promise.all([
      Product.findByCategory(category.id, {
        page, sort, brands, productTypes,
        attrFilters: mergedAttrFilters,
        colorFilters,
        minPrice, maxPrice,
        model,
      }),
      Product.getPriceRange(category.id),
    ]);

    // ── Build model → color swatches map from DB ─────────────────────
    // For each model on this page, fetch all available color variants.
    const pageModels = [...new Set(result.products.map(p => p.model).filter(Boolean))];
    let modelColorMap = {};  // { 'London': [{color, color_family, hex, border}] }
    if (pageModels.length) {
      const [mcRows] = await bvoPool.query(`
        SELECT DISTINCT model, color, color_family
        FROM products
        WHERE model IN (${pageModels.map(() => '?').join(',')})
          AND color IS NOT NULL AND is_active = 1
        ORDER BY model, color
      `, pageModels);
      for (const r of mcRows) {
        if (!modelColorMap[r.model]) modelColorMap[r.model] = [];
        modelColorMap[r.model].push({
          color:        r.color,
          color_family: r.color_family,
          hex:          FAMILY_HEX[r.color_family]               || '#ccc',
          border:       FAMILY_HEX[(r.color_family || '') + '_border'] || '#aaa',
        });
      }
    }

    res.render('pages/collection', {
      pageTitle:    `${category.meta_title || category.name} | BathroomVanitiesOutlet.com`,
      metaDesc:     category.meta_desc || category.description || '',
      canonicalUrl,
      noindex,
      category,
      ...result,
      sort,
      brands, productTypes,
      model,
      modelColorMap,
      familyHex: FAMILY_HEX,
      attrFilters,
      rangeFilters,
      minPrice, maxPrice,
      priceRange,
      availableBrands,
      attributeDefs,
      availableAttrValues,
      hasActiveFilters,
      // Color filter state
      colorFamiliesConfig,
      colorFamilyActive: colorFamilyParam,
      colorExactActive:  colorExactParam,
    });
  } catch (err) { next(err); }
};
