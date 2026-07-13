'use strict';

const { bvoPool } = require('../config/database');

const PER_PAGE = 12;

/*
 * Placeholder products — shown when DB is unavailable.
 * Fields:
 *   category_id  → matches Category.SEED ids (1=Vanities 2=Mirrors 3=Faucets
 *                   4=Accessories 5=Lighting 6=Storage)
 *   product_type → machine key matching attribute_definitions seed data
 *   attrs        → key/value map used by in-memory attribute filtering
 */
const PLACEHOLDER = [
  /* ── Real James Martin vanities (category 1) ──────────────────────────
   * Extracted from the James Martin Etail Feed — used when DB is offline.
   * Covers sizes 24–72", diverse finishes, styles, and sink counts.
   * ──────────────────────────────────────────────────────────────────── */
  {
    id: 1, slug: '210-v36-gw-dgg',
    name: 'Linear 36" Single Vanity, Glossy White w/ Dusk Grey Glossy Composite Top',
    brand: 'James Martin', sku: '210-V36-GW-DGG',
    price: 2579, compare_price: 3908,
    is_new: 1, is_featured: 1,
    short_desc: 'The Linear 36" Single Vanity with Glossy White finish features spacious storage with two doors, one shelf, and one inside drawer. Cabinet exterior is solid Birch and Poplar.',
    primary_image: 'http://images.salsify.com/image/upload/s--FKbk-jC1--/ycfsgpny4z04owppkm6r.jpg',
    qty_on_hand: 5, badge: 'sale',
    category_id: 1, product_type: 'single-sink-vanity',
    attrs: { size_in: 36, cabinet_finish: 'Glossy White',
             hardware_finish: 'Satin Nickel', style: 'Modern',
             mount_type: 'Freestanding', sink_count: '1', sink_included: 'Yes' },
  },
  {
    id: 2, slug: '305-v48-www-3af',
    name: 'Chicago 48" Whitewashed Walnut Single Vanity w/ 3 CM Arctic Fall Solid Surface Top',
    brand: 'James Martin', sku: '305-V48-WWW-3AF',
    price: 3109, compare_price: 4711,
    is_new: 1, is_featured: 1,
    short_desc: 'The Chicago 48" Single Sink Whitewashed Walnut vanity by James Martin Vanities is a wall-mount optional cabinet with mounting brackets and chrome finish legs with tip out drawers.',
    primary_image: 'http://images.salsify.com/image/upload/s--L2YcrO_3--/a36e5c0d5dde31e83bcdb25e5f9d40d1c49a4f4d.jpg',
    qty_on_hand: 5, badge: 'sale',
    category_id: 1, product_type: 'single-sink-vanity',
    attrs: { size_in: 48, cabinet_finish: 'Whitewashed Walnut',
             hardware_finish: 'Satin Nickel', style: 'Contemporary',
             mount_type: 'Freestanding', sink_count: '1', sink_included: 'Yes' },
  },
  {
    id: 3, slug: '388-v24-agr-bnk',
    name: 'Columbia 24" Single Vanity Cabinet, Ash Gray, Brushed Nickel',
    brand: 'James Martin', sku: '388-V24-AGR-BNK',
    price: 1368, compare_price: 2073,
    is_new: 1, is_featured: 1,
    short_desc: 'A fresh contemporary touch for your bathroom — the 24" Columbia Single Vanity in Ash Gray with one soft-closing cabinet door.',
    primary_image: 'http://images.salsify.com/image/upload/s--EGv8J0a4--/rtiad22didae5oapbfmq.jpg',
    qty_on_hand: 5, badge: 'sale',
    category_id: 1, product_type: 'single-sink-vanity',
    attrs: { size_in: 24, cabinet_finish: 'Ash Gray',
             hardware_finish: 'Brushed Nickel', style: 'Modern',
             mount_type: 'Freestanding', sink_count: '1', sink_included: 'Yes' },
  },
  {
    id: 4, slug: 'e444-v30-mca-3af',
    name: 'Addison 30" Single Vanity Cabinet, Mid Century Acacia w/ 3 CM Arctic Fall Solid Surface Top',
    brand: 'James Martin', sku: 'E444-V30-MCA-3AF',
    price: 2229, compare_price: 3378,
    is_new: 0, is_featured: 1,
    short_desc: 'The Addison 30" Free-standing Vanity in mid-century Acacia on parawood with a solid surface top — a fresh take on Shaker-inspired design.',
    primary_image: 'http://images.salsify.com/image/upload/s--2gjCwP4a--/rnusb5pvqfnjblunxsde.jpg',
    qty_on_hand: 5, badge: 'sale',
    category_id: 1, product_type: 'single-sink-vanity',
    attrs: { size_in: 30, cabinet_finish: 'Mid Century Acacia',
             hardware_finish: 'Burnished Nickel', style: 'Traditional',
             mount_type: 'Freestanding', sink_count: '1', sink_included: 'Yes' },
  },
  {
    id: 5, slug: '147-114-5236-3af',
    name: 'Brookfield 48" Antique Black Single Vanity w/ 3 CM Arctic Fall Solid Surface Top',
    brand: 'James Martin', sku: '147-114-5236-3AF',
    price: 2985, compare_price: 4523,
    is_new: 0, is_featured: 1,
    short_desc: 'The Brookfield 48" Antique Black vanity features hand carved filigrees and raised panel doors with two drawers and shelf storage.',
    primary_image: 'http://images.salsify.com/image/upload/s--CRxRsrJ4--/jimtf8tnbdtwyi1udvnk.jpg',
    qty_on_hand: 5, badge: 'sale',
    category_id: 1, product_type: 'single-sink-vanity',
    attrs: { size_in: 48, cabinet_finish: 'Antique Black',
             hardware_finish: 'Antique Brass', style: 'Transitional',
             mount_type: 'Freestanding', sink_count: '1', sink_included: 'Yes' },
  },
  {
    id: 6, slug: '210-v59d-wlt-dgg',
    name: 'Linear 60" Double Vanity, Mid Century Walnut w/ Dusk Grey Glossy Composite Top',
    brand: 'James Martin', sku: '210-V59D-WLT-DGG',
    price: 4480, compare_price: 6788,
    is_new: 0, is_featured: 1,
    short_desc: 'The Linear 60" Double Vanity in Mid Century Walnut features two doors, two shelves, and three drawers in solid American Walnut.',
    primary_image: 'http://images.salsify.com/image/upload/s--vH2FBBKS--/xt3apgku4jw53qebhp0u.jpg',
    qty_on_hand: 5, badge: 'sale',
    category_id: 1, product_type: 'double-sink-vanity',
    attrs: { size_in: 60, cabinet_finish: 'Mid Century Walnut',
             hardware_finish: 'Satin Nickel', style: 'Modern',
             mount_type: 'Freestanding', sink_count: '2', sink_included: 'Yes' },
  },
  {
    id: 7, slug: '147-114-5761-3af',
    name: 'Brookfield 72" Burnished Mahogany Double Vanity w/ 3 CM Arctic Fall Solid Surface Top',
    brand: 'James Martin', sku: '147-114-5761-3AF',
    price: 4329, compare_price: 6559,
    is_new: 0, is_featured: 0,
    short_desc: 'The Brookfield 72" double sink Burnished Mahogany vanity features hand carved filigrees, four doors, and ample drawer storage.',
    primary_image: 'http://images.salsify.com/image/upload/s--9cf2OvwQ--/71dab93d635e9aa689edf9636135f83d87e5f2e6.jpg',
    qty_on_hand: 5, badge: 'sale',
    category_id: 1, product_type: 'double-sink-vanity',
    attrs: { size_in: 72, cabinet_finish: 'Burnished Mahogany',
             hardware_finish: 'Antique Brass', style: 'Transitional',
             mount_type: 'Freestanding', sink_count: '2', sink_included: 'Yes' },
  },
  {
    id: 8, slug: '147-114-5576-3af',
    name: 'Brookfield 36" Country Oak Single Vanity w/ 3 CM Arctic Fall Solid Surface Top',
    brand: 'James Martin', sku: '147-114-5576-3AF',
    price: 2275, compare_price: 3447,
    is_new: 0, is_featured: 0,
    short_desc: 'The Brookfield 36" Country Oak vanity features hand carved filigrees and raised panel doors with one door and two drawers.',
    primary_image: 'http://images.salsify.com/image/upload/s--E2xTLxOz--/nbdxnpigyj3abpodmpdl.jpg',
    qty_on_hand: 5, badge: 'sale',
    category_id: 1, product_type: 'single-sink-vanity',
    attrs: { size_in: 36, cabinet_finish: 'Country Oak',
             hardware_finish: 'Antique Brass', style: 'Transitional',
             mount_type: 'Freestanding', sink_count: '1', sink_included: 'Yes' },
  },
  {
    id: 9, slug: '301-v48-bw-3af',
    name: 'Copper Cove Encore 48" Single Vanity, Bright White w/ 3 CM Arctic Fall Solid Surface Top',
    brand: 'James Martin', sku: '301-V48-BW-3AF',
    price: 3389, compare_price: 5135,
    is_new: 0, is_featured: 0,
    short_desc: 'The Copper Cove Encore 48" Bright White vanity features optional towel bars, a bamboo drawer organizer, and an electrical outlet with two USB ports.',
    primary_image: 'http://images.salsify.com/image/upload/s--C3B7nv8w--/1fe33f53eea37e207c7ba40f4863d4e35f2191de.jpg',
    qty_on_hand: 5, badge: 'sale',
    category_id: 1, product_type: 'single-sink-vanity',
    attrs: { size_in: 48, cabinet_finish: 'Bright White',
             hardware_finish: 'Satin Nickel', style: 'Modern',
             mount_type: 'Freestanding', sink_count: '1', sink_included: 'Yes' },
  },
  {
    id: 10, slug: '147-114-v26-wch-3af',
    name: 'Brookfield 24" Warm Cherry Single Vanity w/ 3 CM Arctic Fall Solid Surface Top',
    brand: 'James Martin', sku: '147-114-V26-WCH-3AF',
    price: 1765, compare_price: 2674,
    is_new: 0, is_featured: 0,
    short_desc: 'The Brookfield Warm Cherry vanity features hand carved filigrees, raised panel doors, and a single door cabinet with shelf storage.',
    primary_image: 'http://images.salsify.com/image/upload/s--RfQzfMEi--/bd5ab5c58f414c0953747bd12f0f494ca46703a6.jpg',
    qty_on_hand: 5, badge: 'sale',
    category_id: 1, product_type: 'single-sink-vanity',
    attrs: { size_in: 24, cabinet_finish: 'Warm Cherry',
             hardware_finish: 'Antique Brass', style: 'Transitional',
             mount_type: 'Freestanding', sink_count: '1', sink_included: 'Yes' },
  },
  {
    id: 11, slug: '157-v60d-sbr-3af',
    name: 'Bristol 60" Double Vanity, Saddle Brown w/ 3 CM Arctic Fall Solid Surface Top',
    brand: 'James Martin', sku: '157-V60D-SBR-3AF',
    price: 4084, compare_price: 6188,
    is_new: 0, is_featured: 0,
    short_desc: 'The Bristol 60" Saddle Brown Double Vanity features a full plinth base, wraparound toe kick, and satin nickel hardware.',
    primary_image: 'http://images.salsify.com/image/upload/s--ibX3d2mV--/k5glycejskohmj9jjmma.jpg',
    qty_on_hand: 5, badge: 'sale',
    category_id: 1, product_type: 'double-sink-vanity',
    attrs: { size_in: 60, cabinet_finish: 'Saddle Brown',
             hardware_finish: 'Satin Nickel', style: 'Transitional',
             mount_type: 'Freestanding', sink_count: '2', sink_included: 'Yes' },
  },

  /* ── Other categories (mirrors, faucets, accessories) ─────────────── */
  {
    id: 12, slug: 'sample-mirror-frameless-36',
    name: '36" Frameless LED Mirror',
    brand: 'Kohler', price: 299.00, compare_price: 399.00,
    is_new: 0, is_featured: 1,
    short_desc: 'Anti-fog, dimmable LED backlight, built-in touch switch.',
    primary_image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=600&q=80',
    qty_on_hand: 12, badge: 'sale',
    category_id: 2, product_type: 'led-mirror',
    attrs: { width_in: 36, shape: 'Rectangle', finish: 'Chrome', has_led: 'Yes', has_defogger: 'Yes' },
  },
  {
    id: 13, slug: 'sample-faucet-brushed-nickel',
    name: 'Single-Handle Faucet — Brushed Nickel',
    brand: 'Moen', price: 189.00, compare_price: null,
    is_new: 1, is_featured: 1,
    short_desc: 'WaterSense certified, single-hole installation, lifetime warranty.',
    primary_image: 'https://images.unsplash.com/photo-1564540583246-934409427776?auto=format&fit=crop&w=600&q=80',
    qty_on_hand: 20, badge: 'new',
    category_id: 3, product_type: 'sink-faucet',
    attrs: { finish: 'Brushed Nickel', faucet_config: 'Single', handle_type: 'Single', spout_type: 'Standard', flow_rate_gpm: 1.2 },
  },
  {
    id: 14, slug: 'sample-faucet-matte-black',
    name: 'Widespread Faucet — Matte Black',
    brand: 'Delta', price: 249.00, compare_price: null,
    is_new: 1, is_featured: 1,
    short_desc: 'Three-hole 8" widespread, ceramic disc cartridge, matte black finish.',
    primary_image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80',
    qty_on_hand: 15, badge: 'new',
    category_id: 3, product_type: 'sink-faucet',
    attrs: { finish: 'Matte Black', faucet_config: '8 Inch Widespread', handle_type: 'Double', spout_type: 'Widespread', flow_rate_gpm: 1.5 },
  },
  {
    id: 15, slug: 'sample-shower-system-chrome',
    name: 'Rain Shower System — Polished Chrome',
    brand: 'Hansgrohe', price: 799.00, compare_price: null,
    is_new: 1, is_featured: 0,
    short_desc: '12" rain head, hand shower, thermostatic valve, all-in-one trim kit.',
    primary_image: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=600&q=80',
    qty_on_hand: 9, badge: 'new',
    category_id: 3, product_type: 'shower-system',
    attrs: { finish: 'Chrome', faucet_config: 'Wall Mounted', handle_type: 'Thermostatic', spout_type: 'Rain' },
  },
  {
    id: 16, slug: 'sample-toilet-elongated-white',
    name: 'Elongated Comfort Height Toilet',
    brand: 'TOTO', price: 549.00, compare_price: 699.00,
    is_new: 0, is_featured: 0,
    short_desc: 'Tornado flush technology, skirted trapway, cefiontect glaze.',
    primary_image: 'https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&w=600&q=80',
    qty_on_hand: 7, badge: 'sale',
    category_id: 4, product_type: 'toilet',
    attrs: { finish: 'White', material: 'Ceramic' },
  },
];

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
        // Match product names that start with the model collection name
        const modelName = model.replace(/-/g, ' ');
        where += ' AND LOWER(p.name) LIKE ?';
        params.push(`${modelName.toLowerCase()}%`);
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

        // size_in is stored as value_num; checkbox values are numeric strings + optional '84+' sentinel
        if (key === 'size_in') {
          const has84Plus  = vals.includes('84+');
          const exactSizes = vals.filter(v => v !== '84+').map(Number).filter(n => !isNaN(n));
          const orParts    = [];
          const sizeParams = [];

          if (exactSizes.length) {
            orParts.push(`pav.value_num IN (${exactSizes.map(() => '?').join(',')})`);
            sizeParams.push(...exactSizes);
          }
          if (has84Plus) {
            orParts.push('pav.value_num >= 84');
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
      // Combines family-level (color_family column) and exact (value_text) in one EXISTS.
      const cfFamilies = (colorFilters.families || []).filter(Boolean);
      const cfExact    = (colorFilters.exact    || []).filter(Boolean);

      if (cfFamilies.length || cfExact.length) {
        const orParts  = [];
        const cfParams = [];

        if (cfFamilies.length) {
          orParts.push(`pav.color_family IN (${cfFamilies.map(() => '?').join(',')})`);
          cfParams.push(...cfFamilies);
        }
        if (cfExact.length) {
          orParts.push(`pav.value_text IN (${cfExact.map(() => '?').join(',')})`);
          cfParams.push(...cfExact);
        }

        where += `
          AND EXISTS (
            SELECT 1 FROM product_attribute_values pav
            WHERE pav.product_id = p.id
              AND pav.attr_key = 'cabinet_finish'
              AND (${orParts.join(' OR ')})
          )`;
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

      return { products, total, page, perPage: PER_PAGE, pages: Math.ceil(total / PER_PAGE) };

    } catch {
      // ── In-memory fallback filtering on PLACEHOLDER ──────────────────
      const { normalize: normColor } = require('../config/colorFamilies');

      let results = PLACEHOLDER.filter(p => p.category_id === categoryId);

      if (brands.length)       results = results.filter(p => brands.includes(p.brand));
      if (productTypes.length) results = results.filter(p => productTypes.includes(p.product_type));
      if (minPrice != null)    results = results.filter(p => p.price >= minPrice);
      if (maxPrice != null)    results = results.filter(p => p.price <= maxPrice);
      if (model) {
        const modelName = model.replace(/-/g, ' ').toLowerCase();
        results = results.filter(p => p.name.toLowerCase().startsWith(modelName));
      }

      // Attribute filters on placeholder attrs map
      for (const [key, vals] of Object.entries(attrFilters)) {
        if (!Array.isArray(vals) || !vals.length) continue;

        if (key === 'size_in') {
          const has84Plus  = vals.includes('84+');
          const exactSizes = vals.filter(v => v !== '84+').map(Number).filter(n => !isNaN(n));
          results = results.filter(p => {
            const sz = Number(p.attrs[key]);
            if (exactSizes.includes(sz)) return true;
            if (has84Plus && sz >= 84)   return true;
            return false;
          });
        } else if (['width_in', 'flow_rate_gpm', 'num_lights'].includes(key)) {
          const [lo, hi] = vals;
          if (lo != null) results = results.filter(p => (p.attrs[key] || 0) >= parseFloat(lo));
          if (hi != null) results = results.filter(p => (p.attrs[key] || 0) <= parseFloat(hi));
        } else if (key === 'product_type') {
          // product_type is a top-level field on placeholder objects, not inside attrs
          results = results.filter(p => vals.includes(String(p.product_type || '')));
        } else {
          results = results.filter(p => vals.includes(String(p.attrs[key] || '')));
        }
      }

      // Color family filter on placeholder
      const cfFamilies = (colorFilters.families || []).filter(Boolean);
      const cfExact    = (colorFilters.exact    || []).filter(Boolean);
      if (cfFamilies.length || cfExact.length) {
        results = results.filter(p => {
          const finish = String(p.attrs['cabinet_finish'] || '');
          if (!finish) return false;
          if (cfExact.length   && cfExact.includes(finish))              return true;
          if (cfFamilies.length && cfFamilies.includes(normColor(finish))) return true;
          return false;
        });
      }

      // Sort
      if (sort === 'price_asc')       results.sort((a, b) => a.price - b.price);
      else if (sort === 'price_desc') results.sort((a, b) => b.price - a.price);
      else if (sort === 'name_asc')   results.sort((a, b) => a.name.localeCompare(b.name));
      else if (sort === 'newest')     results.sort((a, b) => b.id - a.id);
      else results.sort((a, b) => (b.is_featured - a.is_featured) || (a.id - b.id));

      const total  = results.length;
      const sliced = results.slice(offset, offset + PER_PAGE);
      return { products: sliced, total, page, perPage: PER_PAGE, pages: Math.ceil(total / PER_PAGE) || 1 };
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
      // Derive from PLACEHOLDER
      const vals = [...new Set(
        PLACEHOLDER.filter(p => p.category_id === categoryId)
                   .map(p => p.attrs[attrKey])
                   .filter(v => v != null),
      )];
      const hasNum = vals.some(v => typeof v === 'number');
      return { type: hasNum ? 'num' : 'text', values: vals.sort() };
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
      // Derive from PLACEHOLDER for this category
      const catProducts = PLACEHOLDER.filter(p => p.category_id === categoryId);
      const sets = {};
      for (const p of catProducts) {
        // product_type is a top-level field
        if (p.product_type) {
          (sets['product_type'] = sets['product_type'] || new Set()).add(p.product_type);
        }
        // all attrs map entries
        for (const [key, val] of Object.entries(p.attrs || {})) {
          if (val != null) (sets[key] = sets[key] || new Set()).add(String(val));
        }
      }
      const result = {};
      for (const [key, s] of Object.entries(sets)) {
        result[key] = [...s].sort((a, b) => {
          const na = parseFloat(a), nb = parseFloat(b);
          return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b);
        });
      }
      return result;
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

    return [...new Set(
      PLACEHOLDER.filter(p => p.category_id === categoryId && p.product_type)
                 .map(p => p.product_type),
    )].sort();
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
        const ph = PLACEHOLDER.find(p => p.slug === slug);
        return ph ? _toDetail(ph) : null;
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

      product.images     = images;
      product.attributes = attrs;
      product.inStock    = (product.qty_on_hand > 0) || !!product.allow_backorder;
      return product;
    } catch {
      const p = PLACEHOLDER.find(p => p.slug === slug);
      return p ? _toDetail(p) : null;
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
      return rows;
    } catch {
      return PLACEHOLDER
        .filter(p => p.id !== excludeId && p.category_id === categoryId)
        .slice(0, limit);
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
      return rows.length ? rows : PLACEHOLDER.slice(0, limit);
    } catch {
      return PLACEHOLDER.slice(0, limit);
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
      const cats = PLACEHOLDER.filter(p => p.category_id === categoryId);
      if (!cats.length) return { min: 0, max: 9999 };
      return {
        min: Math.min(...cats.map(p => p.price)),
        max: Math.max(...cats.map(p => p.price)),
      };
    }
  },

};

/** Expose placeholder array for controllers that need it without a DB call */
Product._placeholder = () => PLACEHOLDER;

/** Finish → hex colour lookup (for swatch rendering in templates) */
Product.FINISH_HEX = FINISH_HEX;

/* ── Private helper: inflate placeholder into a detail-shaped object ── */
function _toDetail(p) {
  return {
    ...p,
    sku:             p.slug.toUpperCase(),
    long_desc:       null,
    width_in:        null, depth_in: null, height_in: null, weight_lbs: null,
    allow_backorder: 0,
    images:          [],
    attributes:      Object.entries(p.attrs || {}).map(([attr_key, val]) => ({
      attr_key,
      display_name: attr_key,
      value_text:   typeof val === 'number' ? null : String(val),
      value_num:    typeof val === 'number' ? val  : null,
    })),
    inStock:         true,
    savings:         p.compare_price ? (p.compare_price - p.price).toFixed(2) : null,
    savingsPct:      p.compare_price ? Math.round((1 - p.price / p.compare_price) * 100) : null,
  };
}

module.exports = Product;
