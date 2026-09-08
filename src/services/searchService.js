'use strict';

/**
 * searchService.js — the storefront product search query, in one place.
 * ====================================================================
 *
 * Two callers:
 *   - routes/search.js  GET /api/search      → JSON
 *   - controllers/searchPageController.js    → the /search HTML page
 *
 * They exist because a shopper can either pick a suggestion from the
 * dropdown or press Enter. Both must return the same products in the same
 * order; a shopper who sees a product in the dropdown and then cannot find
 * it on the results page has been told the site is broken.
 *
 * Which is why this is a service and not copied into the controller.
 * Every ordering bug fixed on this project in the last two days came from
 * the same shape of mistake: two code paths that were supposed to agree
 * and quietly didn't.
 *
 * Matching and ranking themselves live in src/utils/searchQuery.js
 * (PRODUCT_SEARCH). This module owns only the SQL around them.
 */

const { productSearch } = require('../utils/searchQuery');

const DEFAULT_PER_PAGE = 24;

/* Shopper-facing sort options. `relevance` leads the merchandised default;
   an explicit price or name choice is honoured as asked and does NOT get
   relevance prepended — same rule as the admin list and the collection
   pages. */
const ORDER_MAP = {
  relevance:  'relevance DESC, p.is_featured DESC, p.price ASC',
  /* Alias. /api/search has always defaulted to sort=featured; without
     this it would fall through to relevance by accident rather than by
     intent, and any existing caller passing 'featured' would silently
     get a different named sort than it asked for. Same ordering. */
  featured:   'relevance DESC, p.is_featured DESC, p.price ASC',
  price_asc:  'p.price ASC',
  price_desc: 'p.price DESC',
  newest:     'p.is_new DESC, p.created_at DESC',
  name_asc:   'p.name ASC',
};

const SORT_LABELS = [
  ['relevance',  'Best match'],
  ['price_asc',  'Price: Low to High'],
  ['price_desc', 'Price: High to Low'],
  ['newest',     'Newest'],
  ['name_asc',   'Name: A–Z'],
];

/**
 * @returns {{hits:Array, total:number, page:number, pages:number, sort:string}}
 *   An empty or unmatchable query returns zero hits rather than throwing,
 *   so the caller renders an empty state instead of an error page.
 */
async function runProductSearch(pool, opts = {}) {
  const q       = String(opts.q || '').trim().slice(0, 120);
  const perPage = Math.min(Math.max(parseInt(opts.perPage, 10) || DEFAULT_PER_PAGE, 1), 60);
  const page    = Math.max(1, parseInt(opts.page, 10) || 1);
  const sort    = ORDER_MAP[opts.sort] ? opts.sort : 'relevance';
  const brands  = [].concat(opts.brands || []).filter(Boolean);
  const types   = [].concat(opts.types  || []).filter(Boolean);

  const empty = { hits: [], total: 0, page, pages: 0, sort };
  if (!q) return empty;

  const s = productSearch(q, {
    // Tiebreakers, never filters. Filtering on stock would empty a
    // drop-ship catalogue; see docs/SEARCH_AND_ORDERING_2026-09-06.md.
    boosts: [{ expr: 'p.is_featured = 1', points: 2 },
             { expr: 'p.is_new = 1',      points: 1 }],
  });
  if (!s.active) return empty;

  let where = `p.is_active = 1 AND (${s.sql})`;
  const whereParams = [...s.params];
  if (brands.length) {
    where += ` AND p.brand IN (${brands.map(() => '?').join(',')})`;
    whereParams.push(...brands);
  }
  if (types.length) {
    where += ` AND p.product_type IN (${types.map(() => '?').join(',')})`;
    whereParams.push(...types);
  }

  // COUNT has no SELECT list, so it binds the WHERE params only.
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM products p WHERE ${where}`, whereParams,
  );

  const pages  = Math.ceil(total / perPage);
  const offset = (page - 1) * perPage;

  /* PARAM ORDER: score placeholders sit in the SELECT list and bind before
     the WHERE ones. Reversing them throws nothing and silently searches
     for the wrong strings. */
  const [rows] = await pool.query(`
    SELECT p.id, p.slug, p.name, p.brand, p.price, p.compare_price,
           p.is_new, p.is_featured, p.product_type, p.color,
           COALESCE(p.primary_image_url, pi.url) AS primary_image,
           COALESCE(inv.qty_on_hand, 0)          AS qty_on_hand,
           CASE WHEN p.compare_price > p.price THEN 'sale'
                WHEN p.is_new = 1      THEN 'new'
                WHEN p.is_featured = 1 THEN 'best' ELSE NULL END AS badge,
           ${s.score} AS relevance
    FROM products p
    LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
    LEFT JOIN inventory inv     ON inv.product_id = p.id
    WHERE ${where}
    ORDER BY ${ORDER_MAP[sort]}
    LIMIT ? OFFSET ?
  `, [...s.scoreParams, ...whereParams, perPage, offset]);

  return { hits: rows, total, page, pages, sort };
}

/**
 * Best sellers, for the empty state. A zero-result page is a dead end
 * otherwise — and it will happen, because LIKE has no typo tolerance:
 * "britany" matches nothing and always will.
 */
async function fetchPopular(pool, limit = 8) {
  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.slug, p.name, p.brand, p.price, p.compare_price,
             p.is_new, p.is_featured,
             COALESCE(p.primary_image_url, pi.url) AS primary_image,
             COALESCE(inv.qty_on_hand, 0)          AS qty_on_hand,
             CASE WHEN p.compare_price > p.price THEN 'sale'
                  WHEN p.is_new = 1      THEN 'new'
                  WHEN p.is_featured = 1 THEN 'best' ELSE NULL END AS badge
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
      LEFT JOIN inventory inv     ON inv.product_id = p.id
      WHERE p.is_active = 1 AND p.product_type IS NOT NULL
      ORDER BY COALESCE(NULLIF(p.sort_order, 0), 999999) ASC,
               p.demand_score DESC, p.is_featured DESC, p.id DESC
      LIMIT ?
    `, [limit]);
    return rows;
  } catch (err) {
    // Never let the suggestion strip take down the results page.
    console.warn('[search] popular products unavailable:', err.message);
    return [];
  }
}

module.exports = { runProductSearch, fetchPopular, ORDER_MAP, SORT_LABELS, DEFAULT_PER_PAGE };
