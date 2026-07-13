'use strict';

/**
 * Search routes — /api/search/*
 *
 * GET /api/search/predict?q=<term>[&limit=8][&category=<slug>]
 *   Predictive (typeahead) search — returns products with thumbnails.
 *   Used by the header search bar overlay.
 *   Primary: Typesense (sub-10ms). Fallback: MySQL FULLTEXT.
 *
 * GET /api/search?q=<term>[&page=1][&sort=featured][&brand=...][&type=...]
 *   Full search results page — returns JSON for a React/fetch-driven
 *   results view (future) or can power a server-rendered /search page.
 */

const express  = require('express');
const router   = express.Router();
const { bvoPool } = require('../config/database');
const Product  = require('../models/Product');

/* ── Typesense client (optional — graceful fallback if not configured) ── */
function getTypesenseClient() {
  try {
    const Typesense = require('typesense');
    if (!process.env.TYPESENSE_API_KEY || process.env.TYPESENSE_API_KEY === 'xyz') return null;
    return new Typesense.Client({
      nodes: [{
        host:     process.env.TYPESENSE_HOST     || 'localhost',
        port:     parseInt(process.env.TYPESENSE_PORT || '8108'),
        protocol: process.env.TYPESENSE_PROTOCOL || 'http',
      }],
      apiKey:                  process.env.TYPESENSE_API_KEY,
      connectionTimeoutSeconds: 3,
    });
  } catch { return null; }
}

/* ── Predictive search ─────────────────────────────────────────── */
router.get('/predict', async (req, res) => {
  const q      = String(req.query.q  || '').trim().slice(0, 120);
  const limit  = Math.min(parseInt(req.query.limit || '8', 10), 20);
  const catSlug = req.query.category || null;

  if (q.length < 2) return res.json({ hits: [] });

  // ── Try Typesense first ────────────────────────────────────────
  const tsClient = getTypesenseClient();
  if (tsClient) {
    try {
      const filterBy = catSlug ? `category_slug:${catSlug} && in_stock:true` : 'in_stock:true';
      const result   = await tsClient.collections('products').documents().search({
        q,
        query_by:       'name,brand,short_desc,product_type',
        query_by_weights:'4,2,1,2',
        filter_by:       filterBy,
        per_page:        limit,
        prefix:          true,        // typeahead: match incomplete words
        highlight_full_doc: false,
        include_fields: 'id,slug,name,brand,price,compare_price,primary_image_url,badge,product_type,category_slug',
      });

      const hits = result.hits.map(h => {
        const d = h.document;
        return {
          id:            d.id,
          slug:          d.slug,
          name:          d.name,
          brand:         d.brand,
          price:         d.price,
          compare_price: d.compare_price,
          image:         d.primary_image_url,
          badge:         d.badge,
          product_type:  d.product_type,
          url:           `/products/${d.slug}`,
        };
      });

      return res.json({ hits, source: 'typesense', total: result.found });
    } catch (err) {
      console.warn('[search/predict] Typesense error, falling back to MySQL:', err.message);
    }
  }

  // ── MySQL FULLTEXT fallback ────────────────────────────────────
  try {
    const params = [`${q}*`, limit];
    let catJoin  = '';
    let catWhere = '';
    if (catSlug) {
      catJoin  = 'JOIN categories c ON c.id = p.category_id';
      catWhere = 'AND c.slug = ?';
      params.splice(1, 0, catSlug);
    }

    const [rows] = await bvoPool.query(`
      SELECT
        p.id, p.slug, p.name, p.brand, p.price, p.compare_price,
        p.is_new, p.is_featured,
        COALESCE(p.primary_image_url, pi.url) AS image,
        CASE
          WHEN p.compare_price IS NOT NULL AND p.compare_price > p.price THEN 'sale'
          WHEN p.is_new  = 1 THEN 'new'
          WHEN p.is_featured = 1 THEN 'best'
          ELSE NULL
        END AS badge
      FROM products p
      ${catJoin}
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
      WHERE p.is_active = 1 ${catWhere}
        AND MATCH(p.name, p.short_desc, p.brand) AGAINST(? IN BOOLEAN MODE)
      ORDER BY p.is_featured DESC, p.sort_order
      LIMIT ?
    `, params);

    const hits = rows.map(r => ({
      id:            r.id,
      slug:          r.slug,
      name:          r.name,
      brand:         r.brand,
      price:         r.price,
      compare_price: r.compare_price,
      image:         r.image,
      badge:         r.badge,
      url:           `/products/${r.slug}`,
    }));

    return res.json({ hits, source: 'mysql', total: hits.length });

  } catch (err) {
    return res.json({ hits: [], source: 'db', total: 0 });
  }
});

/* ── Full search results ───────────────────────────────────────── */
router.get('/', async (req, res) => {
  const q          = String(req.query.q    || '').trim().slice(0, 120);
  const page       = Math.max(1, parseInt(req.query.page  || '1', 10));
  const perPage    = 24;
  const sort       = req.query.sort || 'featured';
  const brands     = [].concat(req.query.brand || []).filter(Boolean);
  const types      = [].concat(req.query.type  || []).filter(Boolean);

  if (!q) return res.json({ hits: [], total: 0, page, pages: 0 });

  // ── Try Typesense first ────────────────────────────────────────
  const tsClient = getTypesenseClient();
  if (tsClient) {
    try {
      const sortMap = {
        featured:   'sort_weight:desc',
        price_asc:  'price:asc',
        price_desc: 'price:desc',
        newest:     'is_new:desc,sort_weight:desc',
        name_asc:   'name:asc',
      };
      const filters = ['in_stock:true'];
      if (brands.length) filters.push(`brand:[${brands.map(b => `\`${b}\``).join(',')}]`);
      if (types.length)  filters.push(`product_type:[${types.map(t => `\`${t}\``).join(',')}]`);

      const result = await tsClient.collections('products').documents().search({
        q,
        query_by:       'name,brand,short_desc,product_type',
        query_by_weights:'4,2,1,2',
        filter_by:      filters.join(' && '),
        sort_by:        sortMap[sort] || sortMap.featured,
        page,
        per_page:       perPage,
        facet_by:       'brand,product_type,cabinet_finish,finish,style',
        max_facet_values: 20,
      });

      return res.json({
        hits:   result.hits.map(h => h.document),
        total:  result.found,
        page,
        pages:  Math.ceil(result.found / perPage),
        facets: result.facet_counts,
        source: 'typesense',
      });
    } catch (err) {
      console.warn('[search] Typesense error:', err.message);
    }
  }

  // ── MySQL FULLTEXT fallback ─────────────────────────────────────
  try {
    const params = [`${q}*`];
    let where = `p.is_active = 1 AND MATCH(p.name, p.short_desc, p.brand) AGAINST(? IN BOOLEAN MODE)`;
    if (brands.length) { where += ` AND p.brand IN (${brands.map(() => '?').join(',')})`; params.push(...brands); }
    if (types.length)  { where += ` AND p.product_type IN (${types.map(() => '?').join(',')})`; params.push(...types); }

    const orderMap = {
      featured:   'p.is_featured DESC, p.sort_order',
      price_asc:  'p.price ASC',
      price_desc: 'p.price DESC',
      newest:     'p.is_new DESC, p.created_at DESC',
      name_asc:   'p.name ASC',
    };

    const [[{ total }]] = await bvoPool.query(
      `SELECT COUNT(*) AS total FROM products p WHERE ${where}`, [...params],
    );
    const [rows] = await bvoPool.query(`
      SELECT p.id, p.slug, p.name, p.brand, p.price, p.compare_price,
             p.is_new, p.is_featured, p.product_type,
             COALESCE(p.primary_image_url, pi.url) AS image,
             CASE WHEN p.compare_price > p.price THEN 'sale'
                  WHEN p.is_new=1 THEN 'new'
                  WHEN p.is_featured=1 THEN 'best' ELSE NULL END AS badge
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
      WHERE ${where}
      ORDER BY ${orderMap[sort] || orderMap.featured}
      LIMIT ? OFFSET ?
    `, [...params, perPage, (page - 1) * perPage]);

    return res.json({
      hits:   rows.map(r => ({ ...r, url: `/products/${r.slug}` })),
      total,
      page,
      pages:  Math.ceil(total / perPage),
      source: 'mysql',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Search unavailable', hits: [], total: 0 });
  }
});

module.exports = router;
