'use strict';

const { bvoPool } = require('../config/database');

const PER_PAGE = 24;

/* ── Finish → hex map (mirrors finish_colors table in migration 002) ── */
const FINISH_HEX = {
  'White':             '#FFFFFF',
  'Gray Oak':          '#9E9488',
  'Espresso':          '#3B1F0E',
  'Navy Blue':         '#182840',
  'Sage Green':        '#5A7A5A',
  'Walnut':            '#7B4F2E',
  'Matte Black':       '#1C1C1C',
  'Chrome':            '#C0C0C0',
  'Brushed Nickel':    '#8C8680',
  'Oil-Rubbed Bronze': '#4A3728',
  'Polished Gold':     '#CFB53B',
  'Brushed Gold':      '#B5924C',
  'Polished Brass':    '#B5A642',
  'Antique Bronze':    '#614E3C',
  'Matte White':       '#F0EEE9',
};

const Product = {

  /**
   * Products in a category with optional filters + pagination.
   * Returns { products, total, page, pages, perPage }
   *
   * @param {number}   categoryId
   * @param {object}   opts
   * @param {number}   opts.page
   * @param {string}   opts.sort
   * @param {string[]} opts.brands
   * @param {string[]} opts.productTypes   — product_type filter values
   * @param {object}   opts.attrFilters    — { [attr_key]: string[]|[min,max] } for EAV filters
   *                                         size_in values may include '84+' sentinel (>= 84")
   * @param {object}   opts.colorFilters   — { families: string[], exact: string[] }
   *                                         families: whole-family color_family IN (...)
   *                                         exact:    exact manufacturer names value_text IN (...)
   * @param {number}   [opts.minPrice]
   * @param {number}   [opts.maxPrice]
   */
  async findByCategory(categoryId, {
    page = 1, sort = 'featured',
    brands = [], productTypes = [], attrFilters = {},
    colorFilters = {},
    minPrice, maxPrice,
    model = null,   // collection slug e.g. 'brookfield'; matched against product name
  } = {}) {
    const offset = (page - 1) * PER_PAGE;

    try {
      const params = [categoryId];
      let where = 'p.category_id = ? AND p.is_active = 1';

      if (brands.length) {
        where += ` AND p.brand IN (${brands.map(() => '?').join(',')})`;
        params.push(...brands);
      }
      if (productTypes.length) {
        where += ` AND p.product_type IN (${productTypes.map(() => '?').join(',')})`;
        params.push(...productTypes);
      }
      if (minPrice != null) { where += ' AND p.price >= ?'; params.push(minPrice); }
      if (maxPrice != null) { where += ' AND p.price <= ?'; params.push(maxPrice); }
      if (model) {
        // Filter by products.model column (exact match, case-insensitive).
        // Previously used LIKE on p.name — replaced now that products.model is populated.
        where += ' AND LOWER(p.model) = LOWER(?)';
        params.push(model.replace(/-/g, ' '));
      }

      // ── EAV attribute filters — one EXISTS subquery per active attribute ──
      const attrKeys = Object.keys(attrFilters).filter(k => {
        const v = attrFilters[k];
        return Array.isArray(v) && v.length > 0 && v.some(x => x != null);
      });

      for (const key of attrKeys) {
        const vals = attrFilters[key];

        // product_type lives in products table, not EAV
        if (key === 'product_type') {
          where += ` AND p.product_type IN (${vals.map(() => '?').join(',')})`;
          params.push(...vals);
          continue;
        }

        // Range attrs are stored as [min, max]
        if (vals.length === 2 && !vals.includes('84+') &&
            (vals[0] == null || typeof vals[0] === 'number') &&
            (vals[1] == null || typeof vals[1] === 'number')) {
          const [lo, hi] = vals;
          let numCond = '';
          const numParams = [];
          if (lo != null) { numCond += 'pav.value_num >= ?'; numParams.push(lo); }
          if (hi != null) { numCond += (numCond ? ' AND ' : '') + 'pav.value_num <= ?'; numParams.push(hi); }
          if (!numCond) continue;
          where += `
          AND EXISTS (
            SELECT 1 FROM product_attribute_values pav
            WHERE pav.product_id = p.id AND pav.attr_key = ? AND ${numCond}
          )`;
          params.push(key, ...numParams);
          continue;
        }

        // size_in: ±1" fuzzy match to catch adjacent sizes (e.g. 59"/60"/61" all match "60").
        // Text fallback via MySQL CAST handles variant formats: '60"', '60 Inch', '60"', '60 in'
        // MySQL CAST(expr AS UNSIGNED) stops at the first non-numeric char, so all variants → integer.
        if (key === 'size_in') {
          const has84Plus  = vals.includes('84+');
          const exactSizes = vals.filter(v => v !== '84+').map(Number).filter(n => !isNaN(n));
          const orParts    = [];
          const sizeParams = [];

          if (exactSizes.length) {
            // Numeric storage: ±1" tolerance per selected size
            const numRanges = exactSizes.map(() => 'pav.value_num BETWEEN ? AND ?').join(' OR ');
            orParts.push(`(pav.value_num IS NOT NULL AND (${numRanges}))`);
            exactSizes.forEach(sz => sizeParams.push(sz - 1, sz + 1));

            // Text fallback: strips "  /" Inch etc. — covers manufacturers who store value_text only
            const txtRanges = exactSizes.map(() => 'CAST(pav.value_text AS UNSIGNED) BETWEEN ? AND ?').join(' OR ');
            orParts.push(`(pav.value_num IS NULL AND (${txtRanges}))`);
            exactSizes.forEach(sz => sizeParams.push(sz - 1, sz + 1));
          }
          if (has84Plus) {
            orParts.push('pav.value_num >= 84');
            orParts.push('(pav.value_num IS NULL AND CAST(pav.value_text AS UNSIGNED) >= 84)');
          }
          if (!orParts.length) continue;

          where += `
          AND EXISTS (
            SELECT 1 FROM product_attribute_values pav
            WHERE pav.product_id = p.id AND pav.attr_key = ?
              AND (${orParts.join(' OR ')})
          )`;
          params.push(key, ...sizeParams);
          continue;
        }

        // Default: text equality (checkbox, boolean, color_swatch)
        where += `
          AND EXISTS (
            SELECT 1 FROM product_attribute_values pav
            WHERE pav.product_id = p.id
              AND pav.attr_key = ?
              AND pav.value_text IN (${vals.map(() => '?').join(',')})
          )`;
        params.push(key, ...vals);
      }

      // ── Color family filter ──────────────────────────────────────────
      // Family-level: match products.color_family directly (no EAV JOIN needed).
      // Exact-level:  match products.color (brand name) for sub-chip dropdown.
      const cfFamilies = (colorFilters.families || []).filter(Boolean);
      const cfExact    = (colorFilters.exact    || []).filter(Boolean);

      if (cfFamilies.length || cfExact.length) {
        const orParts  = [];
        const cfParams = [];

        if (cfFamilies.length) {
          orParts.push(`p.color_family IN (${cfFamilies.map(() => '?').join(',')})`);
          cfParams.push(...cfFamilies);
        }
        if (cfExact.length) {
          orParts.push(`p.color IN (${cfExact.map(() => '?').join(',')})`);
          cfParams.push(...cfExact);
        }

        where += ` AND (${orParts.join(' OR ')})`;
        params.push(...cfParams);
      }

      const orderMap = {
        featured:   'p.is_featured DESC, p.sort_order, p.created_at DESC',
        price_asc:  'p.price ASC',
        price_desc: 'p.price DESC',
        newest:     'p.created_at DESC',
        name_asc:   'p.name ASC',
      };
      const order = orderMap[sort] || orderMap.featured;

      const countParams = [...params];
      const [[{ total }]] = await bvoPool.query(
        `SELECT COUNT(*) AS total FROM products p WHERE ${where}`,
        countParams,
      );

      const listParams = [...params, PER_PAGE, offset];
      const [products] = await bvoPool.query(`
        SELECT
          p.id, p.slug, p.name, p.brand, p.price, p.compare_price,
          p.is_new, p.is_featured, p.short_desc, p.product_type,
          COALESCE(p.primary_image_url, pi.url) AS primary_image,
          i.qty_on_hand,
          CASE
            WHEN p.compare_price IS NOT NULL AND p.compare_price > p.price THEN 'sale'
            WHEN p.is_new = 1                                               THEN 'new'
            WHEN p.is_featured = 1                                          THEN 'best'
            ELSE NULL
          END AS badge
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        LEFT JOIN inventory i       ON i.product_id  = p.id
        WHERE ${where}
        ORDER BY ${order}
        LIMIT ? OFFSET ?
      `, listParams);

      // Strip HTML from plain-text fields; cast DECIMAL to number
      const clean = products.map(p => ({
        ...p,
        name:          p.name  ? p.name.replace(/<[^>]*>/g, '').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim() : p.name,
        brand:         p.brand ? p.brand.replace(/<[^>]*>/g, '').trim() : p.brand,
        price:         parseFloat(p.price) || 0,
        compare_price: p.compare_price != null ? parseFloat(p.compare_price) : null,
      }));

      return { products: clean, total, page, perPage: PER_PAGE, pages: Math.ceil(total / PER_PAGE) };

    } catch {
      return { products: [], total: 0, page, perPage: PER_PAGE, pages: 0 };
    }
  },

  /**
   * Distinct attribute values for a given attr_key in a category.
   * Used to build dynamic filter option lists.
   * Returns { values: Array, type: 'text'|'num' }
   */
  async getAttributeValues(categoryId, attrKey) {
    try {
      const [rows] = await bvoPool.query(`
        SELECT DISTINCT pav.value_text, pav.value_num
        FROM product_attribute_values pav
        JOIN products p ON p.id = pav.product_id
        WHERE p.category_id = ? AND p.is_active = 1
          AND pav.attr_key = ?
        ORDER BY pav.value_text, pav.value_num
      `, [categoryId, attrKey]);

      const hasNum = rows.some(r => r.value_num != null);
      return {
        type: hasNum ? 'num' : 'text',
        values: rows.map(r => hasNum ? r.value_num : r.value_text).filter(v => v != null),
      };
    } catch {
      return { type: 'text', values: [] };
    }
  },

  /**
   * All distinct attribute values for a category, grouped by attr_key.
   * Returns { [attr_key]: string[] }
   * Used by the collection template to show only filter options that have
   * at least one matching product — prevents "dead" filter checkboxes.
   */
  async getAllAttributeValues(categoryId) {
    try {
      // UNION: product_type lives in products table (not EAV); everything else in product_attribute_values.
      // GROUP BY deduplicates the UNION ALL result before ORDER BY.
      const [rows] = await bvoPool.query(`
        SELECT attr_key, val FROM (
          SELECT 'product_type' AS attr_key, product_type AS val
          FROM products
          WHERE category_id = ? AND is_active = 1 AND product_type IS NOT NULL
          UNION ALL
          SELECT pav.attr_key,
                 COALESCE(pav.value_text, CAST(pav.value_num AS UNSIGNED)) AS val
          FROM product_attribute_values pav
          JOIN products p ON p.id = pav.product_id
          WHERE p.category_id = ? AND p.is_active = 1
            AND (pav.value_text IS NOT NULL OR pav.value_num IS NOT NULL)
        ) t
        GROUP BY attr_key, val
        ORDER BY attr_key, val
      `, [categoryId, categoryId]);

      const result = {};
      for (const row of rows) {
        if (row.val == null) continue;
        if (!result[row.attr_key]) result[row.attr_key] = [];
        result[row.attr_key].push(String(row.val));
      }
      return result;
    } catch {
      return {};
    }
  },

  /**
   * Distinct product_types in a category (for "Product Type" filter group).
   * Returns string[]
   */
  async getProductTypesForCategory(categoryId) {
    try {
      const [rows] = await bvoPool.query(`
        SELECT DISTINCT product_type
        FROM products
        WHERE category_id = ? AND is_active = 1 AND product_type IS NOT NULL
        ORDER BY product_type
      `, [categoryId]);
      if (rows.length) return rows.map(r => r.product_type);
    } catch { /* fall through */ }

    return [];
  },

  /**
   * Full product detail by slug — includes images + attributes.
   */
  async findBySlug(slug) {
    try {
      const [rows] = await bvoPool.query(`
        SELECT
          p.*,
          i.qty_on_hand, i.allow_backorder,
          CASE
            WHEN p.compare_price IS NOT NULL AND p.compare_price > p.price THEN 'sale'
            WHEN p.is_new = 1 THEN 'new'
            WHEN p.is_featured = 1 THEN 'best'
            ELSE NULL
          END AS badge
        FROM products p
        LEFT JOIN inventory i ON i.product_id = p.id
        WHERE p.slug = ? AND p.is_active = 1
        LIMIT 1
      `, [slug]);

      if (!rows[0]) {
        return null;
      }
      const product = rows[0];

      const [images] = await bvoPool.query(`
        SELECT url, alt_text, sort_order, is_primary FROM product_images
        WHERE product_id = ? ORDER BY sort_order, is_primary DESC
      `, [product.id]);

      const [attrs] = await bvoPool.query(`
        SELECT pav.attr_key, COALESCE(ad.display_name, pav.attr_key) AS display_name,
               pav.value_text, pav.value_num
        FROM product_attribute_values pav
        LEFT JOIN attribute_definitions ad ON ad.attr_key = pav.attr_key
        WHERE pav.product_id = ?
        ORDER BY COALESCE(ad.sort_order, 99), pav.attr_key
      `, [product.id]);

      // Use product_images table; fall back to flat URL columns if table is empty
      if (images.length > 0) {
        product.images = images;
      } else {
        const flatUrls = [];
        if (product.primary_image_url) flatUrls.push(product.primary_image_url);
        for (let n = 2; n <= 30; n++) {
          const u = product[`image_${n}_url`];
          if (u) flatUrls.push(u);
        }
        product.images = flatUrls.map((url, idx) => ({
          url,
          alt_text:   (product.name || '').replace(/<[^>]*>/g, '').trim(),
          sort_order: idx,
          is_primary: idx === 0 ? 1 : 0,
        }));
      }
      product.attributes = attrs;
      // Strip any HTML tags RFLPOS may have injected into plain-text fields
      product.name  = product.name  ? product.name.replace(/<[^>]*>/g, '').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim() : product.name;
      product.brand = product.brand ? product.brand.replace(/<[^>]*>/g, '').trim() : product.brand;
      // MySQL returns DECIMAL columns as strings — cast to avoid toFixed() crashes
      product.price         = parseFloat(product.price) || 0;
      product.compare_price = product.compare_price != null ? parseFloat(product.compare_price) : null;
      product.inStock       = (product.qty_on_hand > 0) || !!product.allow_backorder;
      return product;
    } catch {
      return null;
    }
  },

  /** Related products — same category, different product */
  async findRelated(categoryId, excludeId, limit = 4) {
    try {
      const [rows] = await bvoPool.query(`
        SELECT
          p.id, p.slug, p.name, p.brand, p.price, p.compare_price,
          COALESCE(p.primary_image_url, pi.url) AS primary_image,
          CASE
            WHEN p.compare_price IS NOT NULL AND p.compare_price > p.price THEN 'sale'
            WHEN p.is_new = 1 THEN 'new'
            ELSE NULL
          END AS badge
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        WHERE p.category_id = ? AND p.id != ? AND p.is_active = 1
        ORDER BY p.is_featured DESC, RAND()
        LIMIT ?
      `, [categoryId, excludeId, limit]);
      // Cast DECIMAL strings to numbers; strip HTML from plain-text fields
      return rows.map(r => ({
        ...r,
        name:          r.name  ? r.name.replace(/<[^>]*>/g, '').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim() : r.name,
        brand:         r.brand ? r.brand.replace(/<[^>]*>/g, '').trim() : r.brand,
        price:         parseFloat(r.price) || 0,
        compare_price: r.compare_price != null ? parseFloat(r.compare_price) : null,
      }));
    } catch {
      return [];
    }
  },

  /** Featured products for homepage */
  async findFeatured(limit = 8) {
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
        LIMIT ?
      `, [limit]);
      return rows;
    } catch {
      return [];
    }
  },

  /** Price range for a category (for filter slider) */
  async getPriceRange(categoryId) {
    try {
      const [[row]] = await bvoPool.query(`
        SELECT MIN(price) AS min_price, MAX(price) AS max_price
        FROM products WHERE category_id = ? AND is_active = 1
      `, [categoryId]);
      return { min: row.min_price || 0, max: row.max_price || 9999 };
    } catch {
      return { min: 0, max: 9999 };
    }
  },

};

/** Finish → hex colour lookup (for swatch rendering in templates) */
Product.FINISH_HEX = FINISH_HEX;

module.exports = Product;
