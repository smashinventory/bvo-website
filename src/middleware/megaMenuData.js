'use strict';

/**
 * megaMenuData middleware
 *
 * Populates res.locals with dynamic mega menu content on every request:
 *   res.locals.megaMenuSizes         — size bucket labels with ≥1 active product
 *   res.locals.megaMenuColorFamilies — cabinet color families with ≥1 active vanity
 *
 * Results are cached in-memory for CACHE_TTL_MS (10 min) to avoid a DB hit
 * on every page load. Cache is shared across all requests for the Node process.
 * On the next import or product update, the stale cache expires naturally.
 *
 * Canonical sources (Rule 10):
 *   Size  → products.width_in bucketed via SIZE_BUCKETS
 *   Color → products.color_family filtered through FAMILIES (cabinet type, category 1)
 */

const { bvoPool }    = require('../config/database');
const { FAMILIES }   = require('../config/colorFamilies');
const { SIZE_BUCKETS } = require('../config/sizeBuckets');

const CACHE_TTL_MS   = 10 * 60 * 1000; // 10 minutes
const VANITY_CAT_ID  = 1;

let _cache     = null;
let _cacheTime = 0;

async function loadMegaMenuData() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL_MS) return _cache;

  try {
    // Run both queries in parallel
    const [[widthRows], [colorRows]] = await Promise.all([
      // All distinct active vanity widths (covers all categories for sizes)
      bvoPool.query(`
        SELECT DISTINCT p.width_in
        FROM products p
        WHERE p.is_active = 1
          AND p.width_in IS NOT NULL AND p.width_in > 0
          AND p.category_id = ?
        ORDER BY p.width_in
      `, [VANITY_CAT_ID]),

      // Distinct cabinet color families for active vanities
      bvoPool.query(`
        SELECT DISTINCT p.color_family
        FROM products p
        WHERE p.is_active = 1
          AND p.category_id = ?
          AND p.color_family IS NOT NULL
      `, [VANITY_CAT_ID]),
    ]);

    // Map widths → bucket labels (only populated buckets)
    const widths = widthRows.map(r => parseFloat(r.width_in)).filter(Boolean);
    const megaMenuSizes = SIZE_BUCKETS
      .filter(b => widths.some(w => w >= b.min && w <= b.max))
      .map(b => b.label);

    // Map color_family keys → FAMILIES objects (cabinet only, preserve FAMILIES order)
    const availableKeys = new Set(colorRows.map(r => r.color_family).filter(Boolean));
    const megaMenuColorFamilies = FAMILIES
      .filter(f => f.type === 'cabinet' && availableKeys.has(f.key))
      .map(f => ({ key: f.key, label: f.label, hex: f.hex, border: f.border }));

    _cache     = { megaMenuSizes, megaMenuColorFamilies };
    _cacheTime = now;
    return _cache;
  } catch {
    // On DB error return empty arrays — mega menu degrades gracefully
    return { megaMenuSizes: [], megaMenuColorFamilies: [] };
  }
}

module.exports = async function megaMenuData(req, res, next) {
  const data = await loadMegaMenuData();
  res.locals.megaMenuSizes         = data.megaMenuSizes;
  res.locals.megaMenuColorFamilies = data.megaMenuColorFamilies;
  next();
};
