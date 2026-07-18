'use strict';

const Category                                          = require('../models/Category');
const Product                                           = require('../models/Product');
const Customer                                          = require('../models/Customer');
const { FAMILIES, normalize, getFamily, CABINET_KEYS, METAL_KEYS } = require('../config/colorFamilies');
const { SIZE_BUCKETS }                                  = require('../config/sizeBuckets');
const { bvoPool }                                       = require('../config/database');

/* ── Color family hex lookup: family_key → hex / border ──────────── */
const FAMILY_HEX = {};
FAMILIES.forEach(f => { FAMILY_HEX[f.key] = f.hex; FAMILY_HEX[f.key + '_border'] = f.border; });

const MODELS_PER_PAGE = 12;
// SIZE_BUCKETS imported from src/config/sizeBuckets.js — shared with megaMenuData middleware

/* ── Windowed pagination ─────────────────────────────────────────── *
 * Returns page numbers with null for ellipsis gaps.
 * e.g. page=16, pages=177 → [1, null, 14, 15, 16, 17, 18, null, 177]
 */
function buildPageWindow(page, pages) {
  if (pages <= 9) return Array.from({ length: pages }, (_, i) => i + 1);
  const out = [1];
  if (page > 4)          out.push(null);
  for (let i = Math.max(2, page - 2); i <= Math.min(pages - 1, page + 2); i++) out.push(i);
  if (page < pages - 3)  out.push(null);
  out.push(pages);
  return out;
}

/* ── /collections ────────────────────────────────────────────────── */
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

/* ── /collections/:slug ──────────────────────────────────────────── */
exports.show = async (req, res, next) => {
  try {
    const { slug } = req.params;

    // ── Virtual "vanity-models" collection ────────────────────────
    // Groups products by model — cabinet color context only.
    if (slug === 'vanity-models') {
      const page = Math.max(1, parseInt(req.query.page || '1', 10));

      const activeSizes         = [].concat(req.query.size         || []).filter(Boolean).map(Number);
      const activeBrands        = [].concat(req.query.brand        || []).filter(Boolean);
      const activeColorFamilies = [].concat(req.query.color_family || []).filter(Boolean);
      const activeColorExact    = [].concat(req.query.color_exact  || []).filter(Boolean);
      const vmMinPrice          = req.query.min_price ? parseFloat(req.query.min_price) : undefined;
      const vmMaxPrice          = req.query.max_price ? parseFloat(req.query.max_price) : undefined;

      // Cabinet context — vanity-models only has cabinet color families
      const exactFamilyKeys = new Set();
      activeColorExact.forEach(v => { const fam = normalize(v, 'cabinet'); if (fam) exactFamilyKeys.add(fam); });
      const familyLevelKeys = activeColorFamilies.filter(f => !exactFamilyKeys.has(f));
      const hasColorFilter  = activeColorFamilies.length > 0 || activeColorExact.length > 0;

      const hasActiveFilters = !!(
        activeSizes.length || activeBrands.length || hasColorFilter ||
        vmMinPrice != null || vmMaxPrice != null
      );

      // Canonical source: products.width_in (Rule 10 — no EAV JOIN for size)
      const [optRows] = await bvoPool.query(`
        SELECT DISTINCT
          p.width_in AS size_in,
          p.brand,
          p.color,
          p.color_family
        FROM products p
        WHERE p.is_active = 1 AND p.model IS NOT NULL
          AND p.width_in IS NOT NULL AND p.width_in > 0
      `);
      const allSizes      = [...new Set(optRows.map(r => r.size_in).filter(Boolean))].sort((a,b)=>a-b);
      const allBrands     = [...new Set(optRows.map(r => r.brand).filter(Boolean))].sort();
      const availFinishes = [...new Set(optRows.map(r => r.color).filter(Boolean))].sort();

      // Cabinet families only — metallic families not relevant on vanity-models
      const colorFamiliesConfig = FAMILIES.filter(f => f.type === 'cabinet').map(fam => ({
        ...fam,
        isActive:    activeColorFamilies.includes(fam.key) || exactFamilyKeys.has(fam.key),
        isOpen:      activeColorFamilies.includes(fam.key) || exactFamilyKeys.has(fam.key),
        activeExact: activeColorExact.filter(e => normalize(e, 'cabinet') === fam.key),
      }));

      let vmWhere  = 'p.is_active = 1 AND p.model IS NOT NULL';
      const vmParams = [];

      if (activeBrands.length) {
        vmWhere += ` AND p.brand IN (${activeBrands.map(()=>'?').join(',')})`;
        vmParams.push(...activeBrands);
      }
      if (hasColorFilter) {
        const colorParts = [];
        if (familyLevelKeys.length) {
          colorParts.push(`p.color_family IN (${familyLevelKeys.map(()=>'?').join(',')})`);
          vmParams.push(...familyLevelKeys);
        }
        if (activeColorExact.length) {
          colorParts.push(`p.color IN (${activeColorExact.map(()=>'?').join(',')})`);
          vmParams.push(...activeColorExact);
        }
        if (colorParts.length) vmWhere += ` AND (${colorParts.join(' OR ')})`;
      }
      if (vmMinPrice != null) { vmWhere += ' AND p.price >= ?'; vmParams.push(vmMinPrice); }
      if (vmMaxPrice != null) { vmWhere += ' AND p.price <= ?'; vmParams.push(vmMaxPrice); }

      const [modelRows] = await bvoPool.query(`
        SELECT
          p.model,
          p.brand,
          MIN(p.price)          AS price_from,
          MAX(p.price)          AS price_to,
          MIN(p.compare_price)  AS compare_price_from,
          -- Canonical source: products.width_in (Rule 10)
          GROUP_CONCAT(DISTINCT CAST(p.width_in AS UNSIGNED)
            ORDER BY p.width_in SEPARATOR ',') AS sizes_csv,
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
        WHERE p.is_active = 1 AND p.model IS NOT NULL AND p.color IS NOT NULL
        GROUP BY p.model, p.color, p.color_family
        ORDER BY p.model, p.color
      `);
      const swatchMap = {};
      for (const r of swatchRows) {
        if (!swatchMap[r.model]) swatchMap[r.model] = [];
        swatchMap[r.model].push({
          color:        r.color,
          color_family: r.color_family,
          hex:          FAMILY_HEX[r.color_family]             || '#ccc',
          border:       FAMILY_HEX[r.color_family + '_border'] || '#aaa',
          image_url:    r.image_url || null,
        });
      }

      let models = modelRows.map(r => ({
        ...r,
        sizes:   r.sizes_csv ? r.sizes_csv.split(',').map(Number).filter(Boolean) : [],
        finishes: swatchMap[r.model] || [],
      }));

      // ±2" tolerance matches SIZE_BUCKETS ranges and Product.findByCategory logic
      if (activeSizes.length) {
        models = models.filter(m => activeSizes.some(sz => m.sizes.some(ms => Math.abs(ms - sz) <= 2)));
      }

      const allPrices  = modelRows.map(r => r.price_from).filter(Boolean);
      const vmPriceMin = allPrices.length ? Math.min(...allPrices) : 0;
      const vmPriceMax = allPrices.length ? Math.max(...allPrices) : 9999;

      const total       = models.length;
      const pages       = Math.ceil(total / MODELS_PER_PAGE) || 1;
      const offset      = (page - 1) * MODELS_PER_PAGE;
      const pagedModels = models.slice(offset, offset + MODELS_PER_PAGE);

      return res.render('pages/vanity-models', {
        pageTitle: 'Vanity Models | BathroomVanitiesOutlet.com',
        metaDesc:  'Browse all bathroom vanity collections — explore every model, finish, and size we carry.',
        models: pagedModels,
        page, pages, total,
        pageWindow: buildPageWindow(page, pages),
        perPage: MODELS_PER_PAGE,
        activeSizes, activeBrands,
        colorFamiliesConfig,
        colorFamilyActive: activeColorFamilies,
        colorExactActive:  activeColorExact,
        availFinishes,
        vmMinPrice, vmMaxPrice,
        hasActiveFilters,
        allSizes, allBrands,
        vmPriceMin, vmPriceMax,
        familyHex: FAMILY_HEX,
      });
    }

    // ── Virtual "sale" collection ──────────────────────────────────
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
        isVanityCategory: false,
        products,
        total: products.length, page: 1, pages: 1, perPage: 48,
        pageWindow: buildPageWindow(1, 1),
        sort: 'featured',
        brands: [], productTypes: [],
        attrFilters: {}, activeAttrFilters: {},
        rangeFilters: {},
        minPrice: undefined, maxPrice: undefined,
        priceRange: { min: 0, max: 9999 },
        availableBrands: [],
        attributeDefs: [],
        availableAttrValues: {},
        hasActiveFilters: false,
        // Primary color filter — not applicable on sale page
        colorFamiliesConfig: [],
        colorFamilyActive: [],
        colorExactActive: [],
        availFinishes: [],
        // Hardware finish filter — not applicable on sale page
        hwColorFamiliesConfig: [],
        hwColorFamilyActive: [],
        hwColorExactActive: [],
        availHardwareFinishes: [],
      });
    }

    // ── Regular category collection ────────────────────────────────

    // Fetch category first — needed to determine color context before param parsing
    let category = await Category.findBySlug(slug);
    if (!category) {
      // Allow the vanity-models-v2 test slug to work without a DB row.
      // Once the SQL migration has been run on Hostinger, the DB row will take
      // over and this stub can be removed.
      if (slug === 'vanity-models-v2') {
        category = {
          id:           null,
          slug:         'vanity-models-v2',
          name:         'Vanity Models',
          description:  'Browse every bathroom vanity collection we carry — explore all models, finishes, and size options.',
          image_url:    null,
          meta_title:   'Vanity Collections',
          meta_desc:    'Browse every bathroom vanity collection we carry.',
          display_mode: 'model-group',
        };
      } else {
        return res.status(404).render('pages/404', { pageTitle: '404 | BathroomVanitiesOutlet.com' });
      }
    }

    // ── Model-group display mode ──────────────────────────────────
    // Categories with display_mode = 'model-group' group products by model.
    // Uses SIZE_BUCKETS (Rule 10) and the same color-family infrastructure as
    // every other collection page.  Old if (slug==='vanity-models') block above
    // is left intact; this new path is tested at /collections/vanity-models-v2.
    if (category.display_mode === 'model-group') {
      const mgPage = Math.max(1, parseInt(req.query.page || '1', 10));

      // Active filter values — sizes are bucket labels (strings), not raw numbers
      const mgActiveSizes      = [].concat(req.query.size_in      || []).filter(Boolean);
      const mgActiveBrands     = [].concat(req.query.brand         || []).filter(Boolean);
      const mgColorFamilyParam = [].concat(req.query.color_family  || []).filter(Boolean);
      const mgColorExactParam  = [].concat(req.query.color_exact   || []).filter(Boolean);
      const mgMinPrice         = req.query.min_price ? parseFloat(req.query.min_price) : undefined;
      const mgMaxPrice         = req.query.max_price ? parseFloat(req.query.max_price) : undefined;

      // Cabinet color context — vanity models are always cabinet context
      const mgExactFamilyKeys = new Set();
      mgColorExactParam.forEach(v => {
        const fam = normalize(v, 'cabinet');
        if (fam) mgExactFamilyKeys.add(fam);
      });
      const mgFamilyLevelKeys = mgColorFamilyParam.filter(f => !mgExactFamilyKeys.has(f));
      const mgHasColorFilter  = mgColorFamilyParam.length > 0 || mgColorExactParam.length > 0;

      const mgHasActiveFilters = !!(
        mgActiveSizes.length || mgActiveBrands.length ||
        mgHasColorFilter || mgMinPrice != null || mgMaxPrice != null
      );

      // Filter option universe — all active products that have a model assigned
      const [mgOptRows] = await bvoPool.query(`
        SELECT DISTINCT p.width_in AS size_in, p.brand, p.color, p.color_family
        FROM products p
        WHERE p.is_active = 1 AND p.model IS NOT NULL
          AND p.width_in IS NOT NULL AND p.width_in > 0
      `);
      const mgRawWidths     = [...new Set(mgOptRows.map(r => r.size_in).filter(Boolean))];
      const mgAvailSizes    = SIZE_BUCKETS
        .filter(b => mgRawWidths.some(w => w >= b.min && w <= b.max))
        .map(b => b.label);
      const mgAllBrands     = [...new Set(mgOptRows.map(r => r.brand).filter(Boolean))].sort();
      const mgAvailFinishes = [...new Set(mgOptRows.map(r => r.color).filter(Boolean))].sort();

      // Cabinet color families config (cabinet-type families only)
      const mgColorFamiliesConfig = FAMILIES.filter(f => f.type === 'cabinet').map(fam => ({
        ...fam,
        isActive:    mgColorFamilyParam.includes(fam.key) || mgExactFamilyKeys.has(fam.key),
        isOpen:      mgColorFamilyParam.includes(fam.key) || mgExactFamilyKeys.has(fam.key),
        activeExact: mgColorExactParam.filter(e => normalize(e, 'cabinet') === fam.key),
      }));

      // Build model query WHERE clause
      let mgWhere    = 'p.is_active = 1 AND p.model IS NOT NULL';
      const mgParams = [];

      if (mgActiveBrands.length) {
        mgWhere += ` AND p.brand IN (${mgActiveBrands.map(() => '?').join(',')})`;
        mgParams.push(...mgActiveBrands);
      }
      if (mgHasColorFilter) {
        const colorParts = [];
        if (mgFamilyLevelKeys.length) {
          colorParts.push(`p.color_family IN (${mgFamilyLevelKeys.map(() => '?').join(',')})`);
          mgParams.push(...mgFamilyLevelKeys);
        }
        if (mgColorExactParam.length) {
          colorParts.push(`p.color IN (${mgColorExactParam.map(() => '?').join(',')})`);
          mgParams.push(...mgColorExactParam);
        }
        if (colorParts.length) mgWhere += ` AND (${colorParts.join(' OR ')})`;
      }
      if (mgMinPrice != null) { mgWhere += ' AND p.price >= ?'; mgParams.push(mgMinPrice); }
      if (mgMaxPrice != null) { mgWhere += ' AND p.price <= ?'; mgParams.push(mgMaxPrice); }

      // Fetch models (one row per model/brand group)
      const [mgModelRows] = await bvoPool.query(`
        SELECT
          p.model,
          p.brand,
          MIN(p.price)                                     AS price_from,
          MAX(p.price)                                     AS price_to,
          MIN(p.compare_price)                             AS compare_price_from,
          GROUP_CONCAT(DISTINCT CAST(p.width_in AS UNSIGNED)
            ORDER BY p.width_in SEPARATOR ',')             AS sizes_csv,
          COALESCE(
            MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END),
            MIN(pi.url)
          )                                                AS image_url
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        WHERE ${mgWhere}
        GROUP BY p.model, p.brand
        ORDER BY p.brand, p.model
      `, mgParams);

      // Swatch data — sourced from all active products for these models
      // (not from the filtered set, so swatches show all available finish options)
      const mgModelNames = mgModelRows.map(r => r.model).filter(Boolean);
      const mgSwatchMap  = {};
      if (mgModelNames.length) {
        const [mgSwatchRows] = await bvoPool.query(`
          SELECT p.model, p.color, p.color_family,
            COALESCE(
              MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END),
              MIN(pi.url)
            ) AS image_url
          FROM products p
          LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
          WHERE p.is_active = 1
            AND p.model IN (${mgModelNames.map(() => '?').join(',')})
            AND p.color IS NOT NULL
          GROUP BY p.model, p.color, p.color_family
          ORDER BY p.model, p.color
        `, mgModelNames);
        for (const r of mgSwatchRows) {
          if (!mgSwatchMap[r.model]) mgSwatchMap[r.model] = [];
          mgSwatchMap[r.model].push({
            color:        r.color,
            color_family: r.color_family,
            hex:          FAMILY_HEX[r.color_family]                      || '#ccc',
            border:       FAMILY_HEX[(r.color_family || '') + '_border']  || '#aaa',
            image_url:    r.image_url || null,
          });
        }
      }

      // Hydrate model rows with parsed sizes + finishes arrays
      let mgModels = mgModelRows.map(r => ({
        ...r,
        sizes:    r.sizes_csv ? r.sizes_csv.split(',').map(Number).filter(Boolean) : [],
        finishes: mgSwatchMap[r.model] || [],
      }));

      // Size bucket filter — post-query because sizes live per-product not per-model
      // Rule 10: compare against SIZE_BUCKETS ranges, not raw widths (±2" approximation)
      if (mgActiveSizes.length) {
        const activeBuckets = SIZE_BUCKETS.filter(b => mgActiveSizes.includes(b.label));
        mgModels = mgModels.filter(m =>
          activeBuckets.some(bucket =>
            m.sizes.some(ms => ms >= bucket.min && ms <= bucket.max)
          )
        );
      }

      const mgAllPrices = mgModelRows.map(r => r.price_from).filter(Boolean);
      const mgPriceMin  = mgAllPrices.length ? Math.min(...mgAllPrices) : 0;
      const mgPriceMax  = mgAllPrices.length ? Math.max(...mgAllPrices) : 9999;

      const mgTotal  = mgModels.length;
      const mgPages  = Math.ceil(mgTotal / MODELS_PER_PAGE) || 1;
      const mgOffset = (mgPage - 1) * MODELS_PER_PAGE;
      const mgPaged  = mgModels.slice(mgOffset, mgOffset + MODELS_PER_PAGE);

      const mgSiteUrl      = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';
      const mgCanonicalUrl = `${mgSiteUrl}/collections/${slug}`;
      const mgFilterCount  = (mgActiveSizes.length > 0 ? 1 : 0)
                           + (mgActiveBrands.length > 0 ? 1 : 0)
                           + (mgHasColorFilter ? 1 : 0)
                           + (mgMinPrice != null || mgMaxPrice != null ? 1 : 0);
      const mgNoindex = mgFilterCount >= 2;

      return res.render('pages/collection', {
        pageTitle:    `${category.meta_title || category.name} | BathroomVanitiesOutlet.com`,
        metaDesc:     category.meta_desc || category.description || '',
        canonicalUrl: mgCanonicalUrl,
        noindex:      mgNoindex,
        category,
        displayMode:  'model-group',
        // Model data
        models:      mgPaged,
        total:       mgTotal,
        page:        mgPage,
        pages:       mgPages,
        perPage:     MODELS_PER_PAGE,
        pageWindow:  buildPageWindow(mgPage, mgPages),
        hasActiveFilters: mgHasActiveFilters,
        // Filter sidebar — model-group specific variable names exposed to template
        availableSizes:      mgAvailSizes,
        activeSizes:         mgActiveSizes,
        allBrands:           mgAllBrands,
        activeBrands:        mgActiveBrands,
        colorFamiliesConfig: mgColorFamiliesConfig,
        colorFamilyActive:   mgColorFamilyParam,
        colorExactActive:    mgColorExactParam,
        availFinishes:       mgAvailFinishes,
        // Price filter
        minPrice:    mgMinPrice,
        maxPrice:    mgMaxPrice,
        priceRange:  { min: mgPriceMin, max: mgPriceMax },
        // Stubs — satisfy template vars used by regular-collection blocks
        // (those blocks are guarded by displayMode !== 'model-group', but
        //  EJS will error if variables are undefined, so we stub them out)
        isVanityCategory:      true,
        products:              [],
        sort:                  'featured',
        brands:                mgActiveBrands,
        productTypes:          [],
        model:                 null,
        modelColorMap:         {},
        modelSizeMap:          {},
        attrFilters:           {},
        rangeFilters:          {},
        availableBrands:       mgAllBrands,
        attributeDefs:         [],
        availableAttrValues:   {},
        familyHex:             FAMILY_HEX,
        hwColorFamiliesConfig: [],
        hwColorFamilyActive:   [],
        hwColorExactActive:    [],
        availHardwareFinishes: [],
        savedProductIds:       new Set(),
      });
    }

    const isVanityCategory = category.id === 1;

    // ── Parse standard query params ──────────────────────────────
    const page         = Math.max(1, parseInt(req.query.page  || '1', 10));
    const sort         = req.query.sort || 'featured';
    const brands       = [].concat(req.query.brand        || []).filter(Boolean);
    const productTypes = [].concat(req.query.type         || []).filter(Boolean);
    const model        = req.query.model || null;
    const minPrice     = req.query.min_price ? parseFloat(req.query.min_price) : undefined;
    const maxPrice     = req.query.max_price ? parseFloat(req.query.max_price) : undefined;

    // ── Primary color filter params ───────────────────────────────
    // Vanities: cabinet color (White, Navy, Walnut…)
    // All other categories: metallic finish (Chrome, Nickel, Bronze…)
    const colorFamilyParam = [].concat(req.query.color_family || []).filter(Boolean);
    const colorExactParam  = [].concat(req.query.color_exact  || []).filter(Boolean);

    // ── Hardware finish filter params (vanities only) ─────────────
    // Secondary color layer — cabinet pulls, handles, hardware
    const hwColorFamilyParam = [].concat(req.query.hw_color_family || []).filter(Boolean);
    const hwColorExactParam  = [].concat(req.query.hw_color_exact  || []).filter(Boolean);

    // ── Context-aware normalization ───────────────────────────────
    // Vanities primary = cabinet context; all other categories = metal context
    const primaryColorContext = isVanityCategory ? 'cabinet' : 'metal';

    // Primary color — exact sub-chip mode detection
    const exactFamilyKeys = new Set();
    colorExactParam.forEach(v => {
      const fam = normalize(v, primaryColorContext);
      if (fam) exactFamilyKeys.add(fam);
    });
    const familyLevelKeys = colorFamilyParam.filter(f => !exactFamilyKeys.has(f));
    const hasColorFilter  = colorFamilyParam.length > 0 || colorExactParam.length > 0;

    // Hardware finish — always metal context
    const hwExactFamilyKeys = new Set();
    hwColorExactParam.forEach(v => {
      const fam = normalize(v, 'metal');
      if (fam) hwExactFamilyKeys.add(fam);
    });
    const hwFamilyLevelKeys = hwColorFamilyParam.filter(f => !hwExactFamilyKeys.has(f));
    const hasHwColorFilter  = hwColorFamilyParam.length > 0 || hwColorExactParam.length > 0;

    // ── Color family configs for view ─────────────────────────────
    // Primary: ALL families for vanities (cabinet paint + metallic-finish vanities
    // such as Radiant Gold, Matte Black, Brushed Nickel which are stored in
    // products.color and map to metal family keys).
    // Metal-only for all other categories (mirrors, faucets, etc.).
    // The template's visibleFamilies check gates display: a family only renders
    // if fam.members.some(m => availFinishesLower.includes(m)) — so metal families
    // with no vanity products stay hidden automatically. See Task #34-C.
    const primaryFamilyPool = isVanityCategory
      ? FAMILIES                              // cabinet + metallic-finish vanities
      : FAMILIES.filter(f => f.type === 'metal');

    const colorFamiliesConfig = primaryFamilyPool.map(fam => ({
      ...fam,
      isActive:    colorFamilyParam.includes(fam.key) || exactFamilyKeys.has(fam.key),
      isOpen:      colorFamilyParam.includes(fam.key) || exactFamilyKeys.has(fam.key),
      activeExact: colorExactParam.filter(e => normalize(e, primaryColorContext) === fam.key),
    }));

    // Hardware finish config — metallic families, vanities only
    const hwColorFamiliesConfig = isVanityCategory
      ? FAMILIES.filter(f => f.type === 'metal').map(fam => ({
          ...fam,
          isActive:    hwColorFamilyParam.includes(fam.key) || hwExactFamilyKeys.has(fam.key),
          isOpen:      hwColorFamilyParam.includes(fam.key) || hwExactFamilyKeys.has(fam.key),
          activeExact: hwColorExactParam.filter(e => normalize(e, 'metal') === fam.key),
        }))
      : [];

    // colorFilters → primary (products.color_family column)
    const colorFilters = {
      families: familyLevelKeys,
      exact:    colorExactParam,
    };

    // hwColorFilters → EAV-based hardware_finish filtering (vanities only)
    const hwColorFilters = {
      families: hwFamilyLevelKeys,
      exact:    hwColorExactParam,
    };

    // ── Load attribute defs + filter option values ────────────────
    const [
      attributeDefs,
      availableBrands,
      availableAttrValues,
      [finishRows],
      [hwFinishRows],
    ] = await Promise.all([
      Category.getAttributeDefinitions(category.id),
      Category.getBrandsForCategory(category.id),
      Product.getAllAttributeValues(category.id),
      // Primary finish options — from products.color column
      bvoPool.query(
        'SELECT DISTINCT color FROM products WHERE category_id = ? AND is_active = 1 AND color IS NOT NULL ORDER BY color',
        [category.id]
      ),
      // Hardware finish options — from EAV (vanities only; empty for other categories)
      bvoPool.query(
        `SELECT DISTINCT pav.value_text
         FROM product_attribute_values pav
         JOIN products p ON p.id = pav.product_id
         WHERE p.category_id = ? AND pav.attr_key = 'hardware_finish'
           AND pav.value_text IS NOT NULL
         ORDER BY pav.value_text`,
        [category.id]
      ),
    ]);
    const availFinishes         = finishRows.map(r => r.color);
    const availHardwareFinishes = hwFinishRows.map(r => r.value_text);

    // ── Parse dynamic attribute filters ──────────────────────────
    // ALL color_swatch attrs are handled by colorFilters / hwColorFilters above —
    // skip them here so they don't appear as checkbox/text filters.
    const attrFilters  = {};
    const rangeFilters = {};

    for (const def of attributeDefs) {
      if (def.attr_key === 'brand')           continue; // handled separately
      if (def.filter_type === 'color_swatch') continue; // handled by color filter system

      if (def.filter_type === 'range') {
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

    const mergedAttrFilters = { ...attrFilters };
    for (const [key, { min, max }] of Object.entries(rangeFilters)) {
      mergedAttrFilters[key] = [min, max];
    }

    const hasActiveFilters = !!(
      brands.length || productTypes.length ||
      Object.keys(attrFilters).length || Object.keys(rangeFilters).length ||
      minPrice != null || maxPrice != null ||
      hasColorFilter || hasHwColorFilter || model
    );

    // ── SEO ───────────────────────────────────────────────────────
    const siteUrl      = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';
    const canonicalUrl = `${siteUrl}/collections/${slug}`;

    const activeFilterGroupCount = [
      brands.length > 0,
      productTypes.length > 0,
      ...Object.keys(attrFilters).map(k => attrFilters[k].length > 0),
      Object.keys(rangeFilters).length > 0,
      minPrice != null || maxPrice != null,
      hasColorFilter,
      hasHwColorFilter,
    ].filter(Boolean).length;
    const noindex = activeFilterGroupCount >= 2;

    // ── Fetch products, price range, and available size buckets ──
    // getAvailableWidths runs the same filters as the main query but WITHOUT
    // the size_in condition — so the sidebar only shows sizes that have products
    // in the current filtered view (e.g. black vanities → only their sizes).
    const [result, priceRange, availableWidths] = await Promise.all([
      Product.findByCategory(category.id, {
        page, sort, brands, productTypes,
        attrFilters: mergedAttrFilters,
        colorFilters,
        hwColorFilters,
        minPrice, maxPrice,
        model,
      }),
      Product.getPriceRange(category.id),
      isVanityCategory
        ? Product.getAvailableWidths(category.id, { brands, productTypes, colorFilters, hwColorFilters, minPrice, maxPrice, model })
        : Promise.resolve([]),
    ]);

    // Map raw width_in values → bucket labels; only populated buckets are passed to template
    const availableSizes = SIZE_BUCKETS
      .filter(b => availableWidths.some(w => w >= b.min && w <= b.max))
      .map(b => b.label);

    // ── Model → color swatches map ────────────────────────────────
    const pageModels = [...new Set(result.products.map(p => p.model).filter(Boolean))];
    let modelColorMap = {};
    if (pageModels.length) {
      const [mcRows] = await bvoPool.query(`
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
        WHERE p.model IN (${pageModels.map(() => '?').join(',')})
          AND p.color IS NOT NULL AND p.is_active = 1
        GROUP BY p.model, p.color, p.color_family
        ORDER BY p.model, p.color
      `, pageModels);
      for (const r of mcRows) {
        if (!modelColorMap[r.model]) modelColorMap[r.model] = [];
        modelColorMap[r.model].push({
          color:        r.color,
          color_family: r.color_family,
          hex:          FAMILY_HEX[r.color_family]                    || '#ccc',
          border:       FAMILY_HEX[(r.color_family || '') + '_border'] || '#aaa',
          image_url:    r.image_url || null,
        });
      }
    }

    // ── Model → size list map ─────────────────────────────────────
    // Uses products.width_in (same source as sidebar + homeController).
    let modelSizeMap = {};
    if (pageModels.length) {
      const [msRows] = await bvoPool.query(`
        SELECT DISTINCT p.model, CAST(p.width_in AS UNSIGNED) AS size_in
        FROM products p
        WHERE p.model IN (${pageModels.map(() => '?').join(',')})
          AND p.is_active = 1 AND p.width_in IS NOT NULL AND p.width_in > 0
        ORDER BY p.model, p.width_in
      `, pageModels);
      for (const r of msRows) {
        if (!modelSizeMap[r.model]) modelSizeMap[r.model] = [];
        if (!modelSizeMap[r.model].includes(r.size_in)) modelSizeMap[r.model].push(r.size_in);
      }
    }

    // Favorites
    const savedProductIds = req.session.customerId
      ? await Customer.getFavoriteIds(req.session.customerId)
      : new Set();

    res.render('pages/collection', {
      pageTitle:    `${category.meta_title || category.name} | BathroomVanitiesOutlet.com`,
      metaDesc:     category.meta_desc || category.description || '',
      canonicalUrl,
      noindex,
      category,
      isVanityCategory,
      ...result,
      pageWindow: buildPageWindow(page, result.pages || 1),
      sort,
      brands, productTypes,
      model,
      modelColorMap,
      modelSizeMap,
      availableSizes,   // size chip filter — populated buckets only (Rule 10)
      familyHex: FAMILY_HEX,
      attrFilters,
      rangeFilters,
      minPrice, maxPrice,
      priceRange,
      availableBrands,
      attributeDefs,
      availableAttrValues,
      hasActiveFilters,
      // Primary color filter (Cabinet Color for vanities; Finish for all others)
      colorFamiliesConfig,
      colorFamilyActive: colorFamilyParam,
      colorExactActive:  colorExactParam,
      availFinishes,
      // Hardware finish filter (vanities only — secondary color layer)
      hwColorFamiliesConfig,
      hwColorFamilyActive: hwColorFamilyParam,
      hwColorExactActive:  hwColorExactParam,
      availHardwareFinishes,
      // Favorites
      savedProductIds,
    });
  } catch (err) { next(err); }
};
