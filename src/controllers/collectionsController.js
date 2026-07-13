'use strict';

const Category                    = require('../models/Category');
const Product                     = require('../models/Product');
const { FAMILIES, normalize }     = require('../config/colorFamilies');
const MODEL_FAMILIES              = require('../data/modelFamilies');
const { bvoPool }                 = require('../config/database');

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
    // Dedicated browse page for model families — with filter sidebar.
    if (slug === 'vanity-models') {
      const page = Math.max(1, parseInt(req.query.page || '1', 10));

      // ── Parse filter params ──────────────────────────────────────
      const activeSizes    = [].concat(req.query.size   || []).filter(Boolean).map(Number);
      const activeBrands   = [].concat(req.query.brand  || []).filter(Boolean);
      const activeFinishes = [].concat(req.query.finish || []).filter(Boolean);
      const vmMinPrice     = req.query.min_price ? parseFloat(req.query.min_price) : undefined;
      const vmMaxPrice     = req.query.max_price ? parseFloat(req.query.max_price) : undefined;

      const hasActiveFilters = !!(
        activeSizes.length || activeBrands.length || activeFinishes.length ||
        vmMinPrice != null || vmMaxPrice != null
      );

      // ── Build available option lists from ALL families ───────────
      const allSizes = [...new Set(MODEL_FAMILIES.flatMap(m => m.sizes))].sort((a, b) => a - b);
      const allBrands = [...new Set(MODEL_FAMILIES.map(m => m.brand))].sort();
      // Collect every finish name + its hex for swatch rendering
      const finishMap = {};   // { 'Antique Black': '#2C2C2C', ... }
      MODEL_FAMILIES.forEach(m => m.finishes.forEach(f => { finishMap[f.name] = f.hex; }));
      const allFinishes = Object.keys(finishMap).sort();

      const vmPriceMin = Math.min(...MODEL_FAMILIES.map(m => m.price_from));
      const vmPriceMax = Math.max(...MODEL_FAMILIES.map(m => m.price_from));

      // ── Filter MODEL_FAMILIES ────────────────────────────────────
      let filtered = MODEL_FAMILIES;
      // ±1" fuzzy: a model matches if any of its sizes is within 1" of any selected size
      if (activeSizes.length)    filtered = filtered.filter(m => activeSizes.some(sz => m.sizes.some(ms => Math.abs(ms - sz) <= 1)));
      if (activeBrands.length)   filtered = filtered.filter(m => activeBrands.includes(m.brand));
      if (activeFinishes.length) filtered = filtered.filter(m => m.finishes.some(f => activeFinishes.includes(f.name)));
      if (vmMinPrice != null)    filtered = filtered.filter(m => m.price_from >= vmMinPrice);
      if (vmMaxPrice != null)    filtered = filtered.filter(m => m.price_from <= vmMaxPrice);

      // ── Paginate ─────────────────────────────────────────────────
      const total  = filtered.length;
      const pages  = Math.ceil(total / MODELS_PER_PAGE) || 1;
      const offset = (page - 1) * MODELS_PER_PAGE;
      const models = filtered.slice(offset, offset + MODELS_PER_PAGE);

      return res.render('pages/vanity-models', {
        pageTitle: 'Vanity Models | BathroomVanitiesOutlet.com',
        metaDesc:  'Browse all bathroom vanity collections — explore every model, finish, and size we carry.',
        models,
        page, pages, total,
        perPage: MODELS_PER_PAGE,
        // Filter state
        activeSizes, activeBrands, activeFinishes,
        vmMinPrice, vmMaxPrice,
        hasActiveFilters,
        // Available options
        allSizes, allBrands, allFinishes, finishMap,
        vmPriceMin, vmPriceMax,
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

    // ── Dynamic sibling map: group by base-name to derive size options ──
    // Strips trailing size (e.g. "48"", "60 in", "36") to find the model name,
    // then aggregates all sizes found in this page's product set.
    const _sizeRE = /\s+(\d{2,3})\s*["'"]?\s*(?:in(?:ch(?:es)?)?)?\s*$/i;
    const productSiblingMap = {};
    for (const p of result.products) {
      const key = p.name.replace(_sizeRE, '').trim().toLowerCase();
      if (!productSiblingMap[key]) productSiblingMap[key] = { sizes: [] };
      const sm = p.name.match(_sizeRE);
      if (sm) {
        const sz = parseInt(sm[1]);
        if (!productSiblingMap[key].sizes.includes(sz)) productSiblingMap[key].sizes.push(sz);
      }
    }
    for (const key of Object.keys(productSiblingMap)) {
      productSiblingMap[key].sizes.sort((a, b) => a - b);
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
      modelFamilies: MODEL_FAMILIES,
      productSiblingMap,
      attrFilters,
      rangeFilters,
      minPrice, maxPrice,
      priceRange,
      availableBrands,
      attributeDefs,
      availableAttrValues,
      finishHex: Product.FINISH_HEX,
      hasActiveFilters,
      // Color filter state
      colorFamiliesConfig,
      colorFamilyActive: colorFamilyParam,
      colorExactActive:  colorExactParam,
    });
  } catch (err) { next(err); }
};
