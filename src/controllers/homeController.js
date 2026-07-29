'use strict';

const { bvoPool }              = require('../config/database');
const { FAMILIES, normalize }   = require('../config/colorFamilies');
const { SIZE_BUCKETS }          = require('../config/sizeBuckets');
const themeSettings            = require('../services/themeSettings');

/* Convert a raw integer width → {label, key} bucket object, or null */
function toBucket(rawSize) {
  const b = SIZE_BUCKETS.find(b => rawSize >= b.min && rawSize <= b.max);
  if (!b) return null;
  const key = parseInt(b.label, 10) || 0;
  return key ? { label: b.label, key } : null;
}

/* Build family key → hex map */
const FAMILY_HEX = {};
FAMILIES.forEach(f => { FAMILY_HEX[f.key] = f.hex; FAMILY_HEX[f.key + '_border'] = f.border; });

async function getFeaturedProducts() {
  try {
    const [rows] = await bvoPool.query(`
      SELECT
        p.id, p.slug, p.name, p.brand, p.price, p.compare_price, p.is_new, p.model,
        p.video_url,
        COALESCE(p.primary_image_url, pi.url) AS primary_image,
        COALESCE(inv.qty_on_hand, 0) AS qty_on_hand,
        CASE
          WHEN p.compare_price IS NOT NULL AND p.compare_price > p.price THEN 'sale'
          WHEN p.is_new = 1 THEN 'new'
          WHEN p.is_featured = 1 THEN 'best'
          ELSE NULL
        END AS badge
      FROM products p
      LEFT JOIN product_images pi  ON pi.product_id  = p.id AND pi.is_primary = 1
      LEFT JOIN inventory      inv ON inv.product_id = p.id
      WHERE p.is_active = 1 AND p.is_featured = 1
      ORDER BY p.sort_order, p.created_at DESC
      LIMIT 12
    `);
    if (!rows.length) return [];

    /* Fetch color swatches + color×size image map for each product's model */
    const modelNames = [...new Set(rows.map(r => r.model).filter(Boolean))];
    if (!modelNames.length) return rows.map(r => ({ ...r, finishes: [], sizes: [], sizeImageMap: {} }));

    const ph = modelNames.map(() => '?').join(',');

    const [[swatchRows], [csRows]] = await Promise.all([
      bvoPool.query(`
        SELECT p.model, p.color, p.color_family,
          COALESCE(MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END), MIN(pi.url)) AS image_url
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        WHERE p.is_active = 1 AND p.model IN (${ph}) AND p.color IS NOT NULL
        GROUP BY p.model, p.color, p.color_family
        ORDER BY p.model, p.color
      `, modelNames),
      bvoPool.query(`
        SELECT p.model, p.color, CAST(p.width_in AS UNSIGNED) AS size_in,
          COALESCE(MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END), MIN(pi.url)) AS image_url
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        WHERE p.is_active = 1 AND p.model IN (${ph}) AND p.color IS NOT NULL
          AND p.width_in IS NOT NULL AND p.width_in > 0
        GROUP BY p.model, p.color, p.width_in
        ORDER BY p.model, p.color, p.width_in
      `, modelNames),
    ]);

    /* Build swatchMap[model] = [{color, hex, border, image_url, sizeImages}] */
    const FAMILY_HEX_LOCAL = {};
    FAMILIES.forEach(f => { FAMILY_HEX_LOCAL[f.key] = f.hex; FAMILY_HEX_LOCAL[f.key + '_border'] = f.border; });

    const colorSizeMap = {}; // [model][color][bKey] = imageURL
    const sizeImageMap = {}; // [model][bKey] = imageURL
    for (const r of csRows) {
      const rawSize = Math.round(Number(r.size_in));
      if (!rawSize || !r.image_url) continue;
      const bkt = toBucket(rawSize);
      if (!bkt) continue;
      if (!colorSizeMap[r.model])           colorSizeMap[r.model] = {};
      if (!colorSizeMap[r.model][r.color])  colorSizeMap[r.model][r.color] = {};
      if (!colorSizeMap[r.model][r.color][bkt.key]) colorSizeMap[r.model][r.color][bkt.key] = r.image_url;
      if (!sizeImageMap[r.model])            sizeImageMap[r.model] = {};
      if (!sizeImageMap[r.model][bkt.key])   sizeImageMap[r.model][bkt.key] = r.image_url;
    }

    const swatchMap = {};
    for (const r of swatchRows) {
      if (!swatchMap[r.model]) swatchMap[r.model] = [];
      const fk = r.color_family || normalize(r.color, 'all') || '';
      swatchMap[r.model].push({
        color: r.color, color_family: r.color_family,
        hex: FAMILY_HEX_LOCAL[fk] || '#ccc', border: FAMILY_HEX_LOCAL[fk + '_border'] || '#aaa',
        image_url: r.image_url || null,
        sizeImages: (colorSizeMap[r.model] && colorSizeMap[r.model][r.color]) || {},
      });
    }

    /* Build bucketed size list per model */
    const modelSizes = {}; // [model] = [{label, key}]
    for (const r of csRows) {
      const rawSize = Math.round(Number(r.size_in));
      const bkt = toBucket(rawSize);
      if (!bkt) continue;
      if (!modelSizes[r.model]) modelSizes[r.model] = [];
      if (!modelSizes[r.model].some(s => s.key === bkt.key)) modelSizes[r.model].push(bkt);
    }

    return rows.map(r => ({
      ...r,
      finishes:     swatchMap[r.model]  || [],
      sizes:        modelSizes[r.model] || [],
      sizeImageMap: sizeImageMap[r.model] || {},
    }));
  } catch (e) {
    console.error('getFeaturedProducts error:', e);
    return [];
  }
}

async function getFeaturedModels(limit = 8) {
  try {
    const safeLimit = Math.max(1, Math.min(20, parseInt(limit) || 8));

    /* ── Check for curated model_groups featured records first ── */
    let curatedModels = [];
    try {
      const [mgRows] = await bvoPool.query(`
        SELECT model_name, is_featured, sort_order,
               custom_image, image_alt, video_url AS mg_video_url, description
        FROM model_groups
        WHERE is_featured = 1
        ORDER BY sort_order, model_name
        LIMIT ?
      `, [safeLimit]);
      curatedModels = mgRows;
    } catch (mgErr) {
      // model_groups table may not exist yet — fall through to auto-ranking
      console.warn('[getFeaturedModels] model_groups query failed (table may not exist yet):', mgErr.message);
    }

    /* ── Determine model names to fetch (curated list, or auto-top-N) ── */
    let useCurated = curatedModels.length > 0;
    let modelRows;

    if (useCurated) {
      const curatedNames = curatedModels.map(r => r.model_name);
      const ph = curatedNames.map(() => '?').join(',');
      [modelRows] = await bvoPool.query(`
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
          ) AS image_url,
          MIN(CASE WHEN p.video_url IS NOT NULL THEN p.video_url END) AS video_url
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        JOIN categories c ON c.id = p.category_id AND c.slug = 'bathroom-vanities'
        WHERE p.is_active = 1 AND p.model IN (${ph})
        GROUP BY p.model, p.brand
      `, curatedNames);

      // Restore curated sort order (SQL IN() doesn't guarantee order)
      const orderMap = {};
      curatedModels.forEach((r, i) => { orderMap[r.model_name] = i; });
      modelRows.sort((a, b) => (orderMap[a.model] ?? 999) - (orderMap[b.model] ?? 999));
    } else {
      /* Auto-top-N by product count — original behaviour */
      [modelRows] = await bvoPool.query(`
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
          ) AS image_url,
          MIN(CASE WHEN p.video_url IS NOT NULL THEN p.video_url END) AS video_url
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        JOIN categories c ON c.id = p.category_id AND c.slug = 'bathroom-vanities'
        WHERE p.is_active = 1 AND p.model IS NOT NULL
        GROUP BY p.model, p.brand
        ORDER BY COUNT(*) DESC
        LIMIT ?
      `, [safeLimit]);
    }

    /* Build curated overlay map: model_name → {custom_image, mg_video_url, description} */
    const mgOverlay = {};
    curatedModels.forEach(r => { mgOverlay[r.model_name] = r; });

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

    /* Fetch color × size → image + price map so carousel chips can swap images and show prices */
    const [csRows] = await bvoPool.query(`
      SELECT p.model, p.color, CAST(p.width_in AS UNSIGNED) AS size_in,
        COALESCE(
          MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END),
          MIN(pi.url)
        ) AS image_url,
        MIN(p.price) AS price
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
      WHERE p.is_active = 1 AND p.model IN (${modelNames.map(() => '?').join(',')})
        AND p.color IS NOT NULL AND p.width_in IS NOT NULL AND p.width_in > 0
      GROUP BY p.model, p.color, p.width_in
      ORDER BY p.model, p.color, p.width_in
    `, modelNames);

    // Build bucketed colorSizeMap, sizeImageMap, colorSizePriceMap, sizePriceMap
    const colorSizeMap      = {}; // [model][color][bKey] = imageURL
    const sizeImageMap      = {}; // [model][bKey] = imageURL
    const colorSizePriceMap = {}; // [model][color][bKey] = min price
    const sizePriceMap      = {}; // [model][bKey] = min price across colors
    const modelBuckets      = {}; // [model] = [{label, key, priceFrom}] — deduplicated
    for (const r of csRows) {
      const rawSize = Math.round(Number(r.size_in));
      if (!rawSize) continue;
      const bkt = toBucket(rawSize);
      if (!bkt) continue;

      if (!colorSizeMap[r.model])          colorSizeMap[r.model] = {};
      if (!colorSizeMap[r.model][r.color]) colorSizeMap[r.model][r.color] = {};
      if (!colorSizeMap[r.model][r.color][bkt.key]) colorSizeMap[r.model][r.color][bkt.key] = r.image_url;

      if (!sizeImageMap[r.model])           sizeImageMap[r.model] = {};
      if (!sizeImageMap[r.model][bkt.key])  sizeImageMap[r.model][bkt.key] = r.image_url;

      // Price maps
      if (r.price != null) {
        if (!colorSizePriceMap[r.model])               colorSizePriceMap[r.model] = {};
        if (!colorSizePriceMap[r.model][r.color])      colorSizePriceMap[r.model][r.color] = {};
        const curCP = colorSizePriceMap[r.model][r.color][bkt.key];
        if (curCP == null || r.price < curCP) colorSizePriceMap[r.model][r.color][bkt.key] = r.price;

        if (!sizePriceMap[r.model]) sizePriceMap[r.model] = {};
        const curSP = sizePriceMap[r.model][bkt.key];
        if (curSP == null || r.price < curSP) sizePriceMap[r.model][bkt.key] = r.price;
      }

      if (!modelBuckets[r.model]) modelBuckets[r.model] = [];
      if (!modelBuckets[r.model].some(s => s.key === bkt.key)) {
        modelBuckets[r.model].push({ label: bkt.label, key: bkt.key });
      }
    }

    // Attach sizeImages + sizePrices to every swatch
    for (const model of Object.keys(swatchMap)) {
      swatchMap[model] = swatchMap[model].map(sw => ({
        ...sw,
        sizeImages: (colorSizeMap[model]      && colorSizeMap[model][sw.color])      || {},
        sizePrices: (colorSizePriceMap[model] && colorSizePriceMap[model][sw.color]) || {},
      }));
    }

    // Attach priceFrom to each size bucket
    for (const model of Object.keys(modelBuckets)) {
      modelBuckets[model] = modelBuckets[model].map(bkt => ({
        ...bkt,
        priceFrom: (sizePriceMap[model] && sizePriceMap[model][bkt.key]) ?? null,
      }));
    }

    return modelRows.map(r => {
      const ov = mgOverlay[r.model] || {};
      return {
        ...r,
        // Curated overrides: custom_image wins over auto product image
        image_url:    ov.custom_image  || r.image_url,
        video_url:    ov.mg_video_url  || r.video_url,
        mg_desc:      ov.description   || null,   // tagline from model_groups
        is_curated:   !!ov.model_name,
        sizes:        modelBuckets[r.model] || [],
        finishes:     swatchMap[r.model]    || [],
        sizeImageMap: sizeImageMap[r.model] || {},
      };
    });
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
    const ts = themeSettings.get();
    const fmSettings = ts.featured_models || {};
    const fmLimit    = fmSettings.limit || 8;

    const [products, categories, featuredModels] = await Promise.all([
      getFeaturedProducts(),
      getFeaturedCategories(),
      fmSettings.enabled !== false ? getFeaturedModels(fmLimit) : Promise.resolve([]),
    ]);

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
