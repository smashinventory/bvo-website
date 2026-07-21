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
    const category = await Category.findBySlug(slug);
    if (!category) {
      return res.status(404).render('pages/404', { pageTitle: '404 | BathroomVanitiesOutlet.com' });
    }

    // ── Model-group display mode ──────────────────────────────────
    // Categories with display_mode = 'model-group' group products by model.
    // Uses SIZE_BUCKETS (Rule 10) and the same color-family infrastructure as
    // every other collection page. Products are sourced from bathroom-vanities
    // (not from the display category itself — see mgProductCatId below).
    if (category.display_mode === 'model-group') {
      // Products for model-group pages live in bathroom-vanities, not in the
      // display category (vanity-models). Look up the source category by slug
      // so we're not relying on a hardcoded ID. (Rule 12 — canonical slugs)
      const mgSourceCat    = await Category.findBySlug('bathroom-vanities');
      const mgProductCatId = mgSourceCat ? mgSourceCat.id : 1;

      const mgPage = Math.max(1, parseInt(req.query.page || '1', 10));

      // Active filter values — sizes are bucket labels (strings), not raw numbers
      const mgActiveSizes      = [].concat(req.query.size_in      || []).filter(Boolean);
      const mgActiveBrands     = [].concat(req.query.brand         || []).filter(Boolean);
      const mgColorFamilyParam = [].concat(req.query.color_family  || []).filter(Boolean);
      const mgColorExactParam  = [].concat(req.query.color_exact   || []).filter(Boolean);
      const mgMinPrice         = req.query.min_price ? parseFloat(req.query.min_price) : undefined;
      const mgMaxPrice         = req.query.max_price ? parseFloat(req.query.max_price) : undefined;

      // Color context — vanities use cabinet context for exact-color normalization
      // (same as isVanityCategory = true in the regular collection route)
      const mgExactFamilyKeys = new Set();
      mgColorExactParam.forEach(v => {
        const fam = normalize(v, 'cabinet') || normalize(v, 'metal');
        if (fam) mgExactFamilyKeys.add(fam);
      });
      const mgFamilyLevelKeys = mgColorFamilyParam.filter(f => !mgExactFamilyKeys.has(f));
      const mgHasColorFilter  = mgColorFamilyParam.length > 0 || mgColorExactParam.length > 0;

      const mgHasActiveFilters = !!(
        mgActiveSizes.length || mgActiveBrands.length ||
        mgHasColorFilter || mgMinPrice != null || mgMaxPrice != null
      );

      // Filter option universe — all active products that have a model assigned.
      // No width_in constraint here so all colors (including gray products that
      // may lack a width) appear in the color filter options.
      const [mgOptRows] = await bvoPool.query(`
        SELECT DISTINCT p.width_in AS size_in, p.brand, p.color, p.color_family
        FROM products p
        WHERE p.is_active = 1 AND p.model IS NOT NULL AND p.category_id = ?
      `, [mgProductCatId]);
      // Size buckets only count products that have a valid width_in
      const mgRawWidths     = [...new Set(mgOptRows.map(r => r.size_in).filter(v => v != null && v > 0))];
      const mgAvailSizes    = SIZE_BUCKETS
        .filter(b => mgRawWidths.some(w => w >= b.min && w <= b.max))
        .map(b => b.label);
      const mgAllBrands          = [...new Set(mgOptRows.map(r => r.brand).filter(Boolean))].sort();
      const mgAvailFinishes      = [...new Set(mgOptRows.map(r => r.color).filter(Boolean))].sort();
      // color_family keys directly — used as primary visibility signal so families
      // whose products have non-standard color strings still appear in the sidebar.
      const mgAvailColorFamilies = [...new Set(mgOptRows.map(r => r.color_family).filter(Boolean))];

      // Color families config — ALL families (cabinet + metallic-finish vanities).
      // Same pool as the regular vanity collection route. The template's
      // visibleFamilies check hides any family with no matching products.
      const mgColorFamiliesConfig = FAMILIES.map(fam => ({
        ...fam,
        isActive:    mgColorFamilyParam.includes(fam.key) || mgExactFamilyKeys.has(fam.key),
        isOpen:      mgColorFamilyParam.includes(fam.key) || mgExactFamilyKeys.has(fam.key),
        activeExact: mgColorExactParam.filter(e =>
          (normalize(e, 'cabinet') || normalize(e, 'metal')) === fam.key
        ),
      }));

      // Build model query — two-layer filter strategy:
      //
      //   WHERE:  row-level filters that narrow which PRODUCTS enter the GROUP BY.
      //           Only brand goes here; color does NOT — see HAVING note below.
      //
      //   HAVING: model-level filters that discard entire model groups after
      //           aggregation.  Color filtering belongs here so that:
      //             (a) one card per model/brand is produced (correct grouping), and
      //             (b) sizes_csv / price_from / price_to reflect the FULL model
      //                 range, not just the filtered color's variants.
      //
      let mgWhere        = 'p.is_active = 1 AND p.model IS NOT NULL AND p.category_id = ?';
      const mgWhereParams = [mgProductCatId];
      const mgHavingParts  = [];
      const mgHavingParams = [];

      if (mgActiveBrands.length) {
        mgWhere += ` AND p.brand IN (${mgActiveBrands.map(() => '?').join(',')})`;
        mgWhereParams.push(...mgActiveBrands);
      }

      // Color → HAVING (keeps full model data, filters model groups not individual rows)
      //
      // Dual-match strategy: check BOTH p.color_family AND p.color against member
      // strings.  Products imported before color_family normalization was in place
      // may have color_family = NULL but a correct p.color value (e.g. 'Radiant Gold',
      // 'Matte Black').  Checking only color_family would silently miss them — the
      // swatch appears (via the template's p.color fallback) but filtering returns 0.
      if (mgHasColorFilter) {
        const colorHavingParts = [];

        if (mgFamilyLevelKeys.length) {
          // 1a. color_family key match (products with correctly normalized color_family)
          colorHavingParts.push(
            `SUM(CASE WHEN p.color_family IN (${mgFamilyLevelKeys.map(() => '?').join(',')}) THEN 1 ELSE 0 END) > 0`
          );
          mgHavingParams.push(...mgFamilyLevelKeys);

          // 1b. p.color member-string match (products where color_family is NULL but
          //     p.color is a known member of one of the selected families)
          const familyMembers = mgFamilyLevelKeys.flatMap(fk => {
            const fam = FAMILIES.find(f => f.key === fk);
            return fam ? fam.members : [];
          });
          if (familyMembers.length) {
            colorHavingParts.push(
              `SUM(CASE WHEN p.color IN (${familyMembers.map(() => '?').join(',')}) THEN 1 ELSE 0 END) > 0`
            );
            mgHavingParams.push(...familyMembers);
          }
        }

        if (mgColorExactParam.length) {
          colorHavingParts.push(
            `SUM(CASE WHEN p.color IN (${mgColorExactParam.map(() => '?').join(',')}) THEN 1 ELSE 0 END) > 0`
          );
          mgHavingParams.push(...mgColorExactParam);
        }

        if (colorHavingParts.length) {
          mgHavingParts.push(`(${colorHavingParts.join(' OR ')})`);
        }
      }

      // Price → HAVING (compare starting price against user's range)
      // MIN(price) is the model's entry price; filter models whose entry price is in range.
      if (mgMinPrice != null) {
        mgHavingParts.push('MIN(p.price) >= ?');
        mgHavingParams.push(mgMinPrice);
      }
      if (mgMaxPrice != null) {
        mgHavingParts.push('MIN(p.price) <= ?');
        mgHavingParams.push(mgMaxPrice);
      }

      const mgHavingClause = mgHavingParts.length
        ? `HAVING ${mgHavingParts.join(' AND ')}`
        : '';
      const mgAllParams = [...mgWhereParams, ...mgHavingParams];

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
        ${mgHavingClause}
        ORDER BY p.brand, p.model
      `, mgAllParams);

      // Color × size image map — one image per model+color+size combination.
      // Drives synchronized image preview: swatch click respects active size,
      // size chip click respects active color. One query replaces the old
      // separate swatch-image and size-image queries.
      const mgModelNames    = mgModelRows.map(r => r.model).filter(Boolean);
      const mgColorSizeMap  = {}; // [model][color][size] = image_url
      const mgSizeImageMap  = {}; // [model][size] = image_url (first-color fallback for chips)
      const mgSwatchMap     = {}; // [model] = [{color, hex, border, image_url, sizeImages}]

      if (mgModelNames.length) {
        const [mgCsRows] = await bvoPool.query(`
          SELECT p.model, p.color, p.color_family, p.width_in AS size_in,
            COALESCE(
              MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END),
              MIN(pi.url)
            ) AS image_url,
            MIN(p.price) AS price
          FROM products p
          LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
          WHERE p.is_active = 1
            AND p.model IN (${mgModelNames.map(() => '?').join(',')})
            AND p.color IS NOT NULL
          GROUP BY p.model, p.color, p.color_family, p.width_in
          ORDER BY p.model, p.color, p.width_in
        `, mgModelNames);

        const mgColorSizePriceMap = {}; // [model][color][bucketKey] = min price
        const mgSizePriceMap      = {}; // [model][bucketKey] = min price across all colors

        // Build color×size map and derive the downstream maps from it
        for (const r of mgCsRows) {
          const sizeKey = r.size_in != null ? Math.round(Number(r.size_in)) : null;

          // Resolve raw width → bucket key for price and image maps
          const bkt       = sizeKey ? SIZE_BUCKETS.find(b => sizeKey >= b.min && sizeKey <= b.max) : null;
          const bucketKey = bkt ? (parseInt(bkt.label, 10) || 0) : 0;

          // color × size image map
          if (!mgColorSizeMap[r.model]) mgColorSizeMap[r.model] = {};
          if (!mgColorSizeMap[r.model][r.color]) mgColorSizeMap[r.model][r.color] = {};
          if (sizeKey > 0 && r.image_url) {
            mgColorSizeMap[r.model][r.color][sizeKey] = r.image_url;
          }

          // size fallback image map (first-seen color wins for each size)
          if (sizeKey > 0 && r.image_url) {
            if (!mgSizeImageMap[r.model]) mgSizeImageMap[r.model] = {};
            if (!mgSizeImageMap[r.model][sizeKey]) {
              mgSizeImageMap[r.model][sizeKey] = r.image_url;
            }
          }

          // color × size price map (keep minimum price per bucket)
          if (bucketKey > 0 && r.price != null) {
            if (!mgColorSizePriceMap[r.model])               mgColorSizePriceMap[r.model] = {};
            if (!mgColorSizePriceMap[r.model][r.color])      mgColorSizePriceMap[r.model][r.color] = {};
            const curCP = mgColorSizePriceMap[r.model][r.color][bucketKey];
            if (curCP == null || r.price < curCP) mgColorSizePriceMap[r.model][r.color][bucketKey] = r.price;

            // size-level min price (across all colors)
            if (!mgSizePriceMap[r.model]) mgSizePriceMap[r.model] = {};
            const curSP = mgSizePriceMap[r.model][bucketKey];
            if (curSP == null || r.price < curSP) mgSizePriceMap[r.model][bucketKey] = r.price;
          }
        }

        // Build swatch list (one entry per model+color, preserving order)
        // Includes per-color size image map AND per-color size price map for JS price updates.
        const seenSwatchKey = new Set();
        for (const r of mgCsRows) {
          const key = `${r.model}||${r.color}`;
          if (seenSwatchKey.has(key)) continue;
          seenSwatchKey.add(key);
          if (!mgSwatchMap[r.model]) mgSwatchMap[r.model] = [];
          const swatchFamilyKey = r.color_family || normalize(r.color, 'all') || '';
          const colorImgRow = mgCsRows.find(x => x.model === r.model && x.color === r.color && x.image_url);
          mgSwatchMap[r.model].push({
            color:        r.color,
            color_family: r.color_family,
            hex:          FAMILY_HEX[swatchFamilyKey]              || '#ccc',
            border:       FAMILY_HEX[swatchFamilyKey + '_border']  || '#aaa',
            image_url:    colorImgRow ? colorImgRow.image_url : null,
            sizeImages:   mgColorSizeMap[r.model][r.color]        || {},
            sizePrices:   mgColorSizePriceMap[r.model]?.[r.color] || {},
          });
        }

        // Expose size-level price map for hydration below
        mgModelRows.forEach(r => { r._sizePriceMap = mgSizePriceMap[r.model] || {}; });
      }

      // Hydrate model rows with parsed sizes + sizeImages + finishes arrays
      let mgModels = mgModelRows.map(r => ({
        ...r,
        sizes:      r.sizes_csv
          ? [...new Map(
              r.sizes_csv.split(',').map(Number).filter(Boolean)
                .map(rawSize => {
                  const bucket = SIZE_BUCKETS.find(b => rawSize >= b.min && rawSize <= b.max);
                  if (!bucket) return null;
                  const key = parseInt(bucket.label, 10) || 0;
                  // priceFrom = min price across all colors for this size bucket
                  const priceFrom = r._sizePriceMap?.[key] ?? null;
                  return key ? [key, { label: bucket.label, key, priceFrom }] : null;
                })
                .filter(Boolean)
            ).values()]
          : [],
        sizeImages: mgSizeImageMap[r.model] || {},
        finishes:   mgSwatchMap[r.model] || [],
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
        availColorFamilies:  mgAvailColorFamilies,
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
      [cfKeyRows],
    ] = await Promise.all([
      Category.getAttributeDefinitions(category.id),
      Category.getBrandsForCategory(category.id),
      Product.getAllAttributeValues(category.id),
      // Primary finish options — from products.color column (vendor color strings)
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
      // Distinct color_family keys present in this category — primary swatch visibility signal.
      // Using color_family directly (not fam.members) means admin-remapped colors like
      // "Silver Oak → gray" cause the Gray swatch to appear even though "Silver Oak"
      // is not in gray's static members array.
      bvoPool.query(
        'SELECT DISTINCT color_family FROM products WHERE category_id = ? AND is_active = 1 AND color_family IS NOT NULL',
        [category.id]
      ),
    ]);
    const availFinishes         = finishRows.map(r => r.color);
    const availHardwareFinishes = hwFinishRows.map(r => r.value_text);
    // Array of BVO family keys that actually have products in this category
    const availColorFamilies    = cfKeyRows.map(r => r.color_family);

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
        const swatchFamilyKey = r.color_family || normalize(r.color, 'all') || '';
        modelColorMap[r.model].push({
          color:        r.color,
          color_family: r.color_family,
          hex:          FAMILY_HEX[swatchFamilyKey]              || '#ccc',
          border:       FAMILY_HEX[swatchFamilyKey + '_border']  || '#aaa',
          image_url:    r.image_url || null,
        });
      }
    }

    // ── Model → size list map (bucketed via SIZE_BUCKETS Rule 10) ───
    // Each entry is {label, key} — label is the display string ('30', '20-', '84+'),
    // key is the numeric value used as data-size and as the sizeImages dict key.
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
        const bucket = SIZE_BUCKETS.find(b => r.size_in >= b.min && r.size_in <= b.max);
        if (!bucket) continue;
        const bKey = parseInt(bucket.label, 10) || 0;
        if (!bKey) continue;
        if (!modelSizeMap[r.model]) modelSizeMap[r.model] = [];
        if (!modelSizeMap[r.model].some(s => s.key === bKey))
          modelSizeMap[r.model].push({ label: bucket.label, key: bKey });
      }
    }

    // ── Model → color × size image map (product-card size chips) ────
    // Keys use the same numeric bucket key as modelSizeMap entries.
    // First image encountered for a bucket wins (ORDER BY width_in ensures smallest first).
    let modelColorSizeMap = {};
    let modelSizeImageMap = {};
    if (pageModels.length) {
      const [mcSizeRows] = await bvoPool.query(`
        SELECT p.model, p.color, CAST(p.width_in AS UNSIGNED) AS size_in,
          COALESCE(
            MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END),
            MIN(pi.url)
          ) AS image_url
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        WHERE p.model IN (${pageModels.map(() => '?').join(',')})
          AND p.color IS NOT NULL AND p.is_active = 1
          AND p.width_in IS NOT NULL AND p.width_in > 0
        GROUP BY p.model, p.color, p.width_in
        ORDER BY p.model, p.color, p.width_in
      `, pageModels);
      for (const r of mcSizeRows) {
        const rawSize = Math.round(Number(r.size_in));
        if (!rawSize || !r.image_url) continue;
        const bucket = SIZE_BUCKETS.find(b => rawSize >= b.min && rawSize <= b.max);
        if (!bucket) continue;
        const bKey = parseInt(bucket.label, 10) || 0;
        if (!bKey) continue;
        if (!modelColorSizeMap[r.model])           modelColorSizeMap[r.model] = {};
        if (!modelColorSizeMap[r.model][r.color])  modelColorSizeMap[r.model][r.color] = {};
        if (!modelColorSizeMap[r.model][r.color][bKey])  // first image per bucket wins
          modelColorSizeMap[r.model][r.color][bKey] = r.image_url;
        if (!modelSizeImageMap[r.model])            modelSizeImageMap[r.model] = {};
        if (!modelSizeImageMap[r.model][bKey])      modelSizeImageMap[r.model][bKey] = r.image_url;
      }
      // Attach per-bucket image dict to every swatch → emitted as data-size-images
      for (const mdl of Object.keys(modelColorMap)) {
        modelColorMap[mdl] = modelColorMap[mdl].map(sw => ({
          ...sw,
          sizeImages: (modelColorSizeMap[mdl] && modelColorSizeMap[mdl][sw.color]) || {},
        }));
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
      modelSizeImageMap,
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
      colorFamilyActive:   colorFamilyParam,
      colorExactActive:    colorExactParam,
      availFinishes,
      availColorFamilies,  // distinct color_family keys — primary swatch visibility signal
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
