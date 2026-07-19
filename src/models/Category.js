'use strict';

const { bvoPool } = require('../config/database');

const Category = {

  /** All active root categories */
  async findAll() {
    try {
      const [rows] = await bvoPool.query(`
        SELECT id, slug, name, description, image_url, sort_order
        FROM   categories
        WHERE  is_active = 1 AND parent_id IS NULL
        ORDER  BY sort_order, name
      `);
      return rows;
    } catch { return []; }
  },

  /** Single category by slug */
  async findBySlug(slug) {
    // Primary query: includes display_mode (requires migration to have run)
    try {
      const [rows] = await bvoPool.query(
        `SELECT id, slug, name, description, image_url, meta_title, meta_desc,
                COALESCE(display_mode, 'product') AS display_mode
         FROM   categories
         WHERE  slug = ? AND is_active = 1
         LIMIT  1`,
        [slug]
      );
      return rows[0] || null;
    } catch {
      // Fallback: one or more new columns (display_mode, meta_title, meta_desc)
      // not yet added on this server — query only original safe columns.
      try {
        const [rows] = await bvoPool.query(
          `SELECT id, slug, name, description, image_url
           FROM   categories
           WHERE  slug = ? AND is_active = 1
           LIMIT  1`,
          [slug]
        );
        const row = rows[0] || null;
        if (row) {
          row.display_mode = 'product';
          row.meta_title   = null;
          row.meta_desc    = null;
        }
        return row;
      } catch {
        return null;
      }
    }
  },

  /** Active root categories + their active children */
  async findTree() {
    try {
      const [rows] = await bvoPool.query(`
        SELECT c.id, c.parent_id, c.slug, c.name, c.description, c.image_url, c.sort_order
        FROM   categories c
        WHERE  c.is_active = 1
        ORDER  BY c.parent_id IS NOT NULL, c.sort_order, c.name
      `);
      const roots    = rows.filter(r => r.parent_id === null);
      const children = rows.filter(r => r.parent_id !== null);
      roots.forEach(r => { r.children = children.filter(c => c.parent_id === r.id); });
      return roots;
    } catch {
      return [];
    }
  },

  /**
   * Attribute definitions for a category — drives the filter sidebar.
   * Returns an array of { id, attr_key, display_name, filter_type, sort_order }
   * ordered by sort_order.
   *
   * Fallback maps mirror the seed rows in migration 002.
   * cabinet_finish / hardware_finish are SEPARATE for vanities so a navy
   * cabinet with gold pulls never pollutes both filter groups.
   */
  async getAttributeDefinitions(categoryId) {
    try {
      const [rows] = await bvoPool.query(`
        SELECT id, attr_key, display_name, filter_type, sort_order
        FROM   attribute_definitions
        WHERE  (category_id = ? OR category_id IS NULL) AND is_active = 1
        ORDER  BY sort_order
      `, [categoryId]);
      if (rows.length) return rows;
    } catch { /* fall through to hardcoded fallback */ }

    /* ── Hardcoded fallbacks (no DB) ───────────────────────────────── */
    const GLOBAL = [
      { id: 0, attr_key: 'brand', display_name: 'Brand', filter_type: 'checkbox', sort_order: 0 },
    ];

    const BY_CATEGORY = {
      // Vanities
      1: [
        { id: 11, attr_key: 'product_type',    display_name: 'Vanity Type',     filter_type: 'checkbox',     sort_order: 1 },
        { id: 12, attr_key: 'size_in',          display_name: 'Vanity Size',     filter_type: 'range',        sort_order: 2 },
        { id: 13, attr_key: 'cabinet_finish',   display_name: 'Cabinet Color',   filter_type: 'color_swatch', sort_order: 3 },
        { id: 14, attr_key: 'hardware_finish',  display_name: 'Hardware Finish', filter_type: 'color_swatch', sort_order: 4 },
        { id: 15, attr_key: 'style',            display_name: 'Style',           filter_type: 'checkbox',     sort_order: 5 },
        { id: 16, attr_key: 'mount_type',       display_name: 'Mount Type',      filter_type: 'checkbox',     sort_order: 6 },
        { id: 17, attr_key: 'sink_count',       display_name: 'Number of Sinks', filter_type: 'checkbox',     sort_order: 7 },
        { id: 18, attr_key: 'sink_included',    display_name: 'Sink Included',   filter_type: 'boolean',      sort_order: 8 },
      ],
      // Mirrors
      2: [
        { id: 21, attr_key: 'product_type', display_name: 'Mirror Type',    filter_type: 'checkbox',     sort_order: 1 },
        { id: 22, attr_key: 'width_in',     display_name: 'Width',          filter_type: 'range',        sort_order: 2 },
        { id: 23, attr_key: 'shape',        display_name: 'Shape',          filter_type: 'checkbox',     sort_order: 3 },
        { id: 24, attr_key: 'finish',       display_name: 'Frame Finish',   filter_type: 'color_swatch', sort_order: 4 },
        { id: 25, attr_key: 'has_led',      display_name: 'LED / Lighted',  filter_type: 'boolean',      sort_order: 5 },
        { id: 26, attr_key: 'has_defogger', display_name: 'Anti-Fog',       filter_type: 'boolean',      sort_order: 6 },
      ],
      // Faucets
      3: [
        { id: 31, attr_key: 'product_type',  display_name: 'Faucet Type',     filter_type: 'checkbox',     sort_order: 1 },
        { id: 32, attr_key: 'finish',        display_name: 'Finish',          filter_type: 'color_swatch', sort_order: 2 },
        { id: 33, attr_key: 'faucet_config', display_name: 'Configuration',   filter_type: 'checkbox',     sort_order: 3 },
        { id: 34, attr_key: 'handle_type',   display_name: 'Handle Type',     filter_type: 'checkbox',     sort_order: 4 },
        { id: 35, attr_key: 'spout_type',    display_name: 'Spout Style',     filter_type: 'checkbox',     sort_order: 5 },
        { id: 36, attr_key: 'flow_rate_gpm', display_name: 'Flow Rate',       filter_type: 'range',        sort_order: 6 },
      ],
      // Accessories
      4: [
        { id: 41, attr_key: 'product_type', display_name: 'Accessory Type',  filter_type: 'checkbox',     sort_order: 1 },
        { id: 42, attr_key: 'finish',       display_name: 'Finish',          filter_type: 'color_swatch', sort_order: 2 },
        { id: 43, attr_key: 'material',     display_name: 'Material',        filter_type: 'checkbox',     sort_order: 3 },
      ],
      // Lighting
      5: [
        { id: 51, attr_key: 'product_type', display_name: 'Fixture Type',    filter_type: 'checkbox',     sort_order: 1 },
        { id: 52, attr_key: 'finish',       display_name: 'Finish',          filter_type: 'color_swatch', sort_order: 2 },
        { id: 53, attr_key: 'num_lights',   display_name: 'Number of Lights',filter_type: 'range',        sort_order: 3 },
        { id: 54, attr_key: 'bulb_type',    display_name: 'Bulb Type',       filter_type: 'checkbox',     sort_order: 4 },
        { id: 55, attr_key: 'style',        display_name: 'Style',           filter_type: 'checkbox',     sort_order: 5 },
      ],
      // Storage
      6: [
        { id: 61, attr_key: 'product_type', display_name: 'Storage Type',   filter_type: 'checkbox',     sort_order: 1 },
        { id: 62, attr_key: 'finish',       display_name: 'Finish',         filter_type: 'color_swatch', sort_order: 2 },
        { id: 63, attr_key: 'material',     display_name: 'Material',       filter_type: 'checkbox',     sort_order: 3 },
        { id: 64, attr_key: 'width_in',     display_name: 'Width',          filter_type: 'range',        sort_order: 4 },
      ],
    };

    const catDefs = BY_CATEGORY[categoryId] || [];
    return [...GLOBAL, ...catDefs].sort((a, b) => a.sort_order - b.sort_order);
  },

  /** Distinct brands in a category */
  async getBrandsForCategory(categoryId) {
    try {
      const [rows] = await bvoPool.query(`
        SELECT DISTINCT brand FROM products
        WHERE  category_id = ? AND is_active = 1 AND brand IS NOT NULL
        ORDER  BY brand
      `, [categoryId]);
      if (rows.length) return rows.map(r => r.brand);
    } catch { /* fall through */ }

    return [];
  },

};

module.exports = Category;
