'use strict';

/**
 * BVO Search Sync — Typesense
 * ============================================================
 * Indexes all active products into Typesense for instant
 * predictive search with thumbnails, filters, and facets.
 *
 * Run modes:
 *   node src/jobs/searchSync.js          → full re-index
 *   node src/jobs/searchSync.js --delta  → sync only products
 *                                          updated in last 24h
 *
 * Typesense collection: "products"
 *
 * Install:
 *   npm install typesense
 *
 * Required .env vars:
 *   TYPESENSE_HOST        your_cluster.a1.typesense.net
 *   TYPESENSE_PORT        443
 *   TYPESENSE_PROTOCOL    https
 *   TYPESENSE_API_KEY     your_admin_api_key
 *
 * Scheduled via cron (e.g. every 15 min for near-real-time):
 *   */15 * * * * node /path/to/src/jobs/searchSync.js --delta
 */

const { bvoPool } = require('../config/database');

/* ── Typesense client ──────────────────────────────────────────── */
let Typesense;
try {
  Typesense = require('typesense');
} catch {
  console.error('[searchSync] typesense package not installed. Run: npm install typesense');
  process.exit(1);
}

const client = new Typesense.Client({
  nodes: [{
    host:     process.env.TYPESENSE_HOST     || 'localhost',
    port:     parseInt(process.env.TYPESENSE_PORT || '8108'),
    protocol: process.env.TYPESENSE_PROTOCOL || 'http',
  }],
  apiKey:         process.env.TYPESENSE_API_KEY || 'xyz',
  connectionTimeoutSeconds: 10,
});

/* ── Collection schema ─────────────────────────────────────────── */
/*
 * Schema design decisions:
 *
 * 1. primary_image_url is stored in the document so search results
 *    can display thumbnails without a second DB query. This is the
 *    same pattern Shopify uses for predictive search.
 *
 * 2. product_type is a facet — drives the "Type" filter group in
 *    the search overlay.
 *
 * 3. cabinet_finish / finish are facets — drive the colour swatch
 *    filter without requiring an EAV JOIN at query time.
 *
 * 4. price is a float32 — enables sort-by-price and range facets.
 *
 * 5. sort_weight is a synthetic ranking field:
 *    is_featured(×10) + is_new(×5) + qty_on_hand_capped(×1)
 *    This keeps featured/new items at the top of relevance-tied
 *    results without hard-coding business rules in the query.
 *
 * 6. category_ids is an int32[] array — a product can appear in
 *    multiple parent collections (e.g. a faucet in both "Faucets"
 *    and a "Plumbing" super-collection) without duplicating the doc.
 */
const SCHEMA = {
  name:                 'products',
  enable_nested_fields: false,
  fields: [
    // Core
    { name: 'id',                type: 'int32'  },
    { name: 'slug',              type: 'string' },
    { name: 'name',              type: 'string' },
    { name: 'brand',             type: 'string',  facet: true,  optional: true },
    { name: 'short_desc',        type: 'string',  optional: true },

    // Taxonomy
    { name: 'category_ids',      type: 'int32[]', facet: true  },
    { name: 'category_slug',     type: 'string',  facet: true,  optional: true },
    { name: 'product_type',      type: 'string',  facet: true,  optional: true },

    // Pricing
    { name: 'price',             type: 'float',   facet: true  },
    { name: 'compare_price',     type: 'float',   optional: true },
    { name: 'on_sale',           type: 'bool',    facet: true  },

    // Status
    { name: 'is_new',            type: 'bool',    facet: true  },
    { name: 'is_featured',       type: 'bool',    facet: true  },
    { name: 'in_stock',          type: 'bool',    facet: true  },

    // Key filterable attributes (denormalised from EAV for speed)
    { name: 'cabinet_finish',    type: 'string',  facet: true,  optional: true },
    { name: 'hardware_finish',   type: 'string',  facet: true,  optional: true },
    { name: 'finish',            type: 'string',  facet: true,  optional: true },
    { name: 'style',             type: 'string',  facet: true,  optional: true },
    { name: 'size_in',           type: 'float',   facet: true,  optional: true },

    // Display fields (not searchable, used in result rendering)
    { name: 'primary_image_url', type: 'string',  index: false, optional: true },
    { name: 'badge',             type: 'string',  index: false, optional: true },

    // Ranking
    { name: 'sort_weight',       type: 'int32'  },
  ],
  default_sorting_field: 'sort_weight',
};

/* ── Helpers ───────────────────────────────────────────────────── */
function buildDocument(row) {
  const attrs  = row._attrs || {};
  const onSale = !!(row.compare_price && row.compare_price > row.price);
  const weight = (row.is_featured ? 10 : 0) + (row.is_new ? 5 : 0)
               + Math.min(row.qty_on_hand || 0, 10);

  return {
    id:                String(row.id), // Typesense requires string IDs
    slug:              row.slug,
    name:              row.name,
    brand:             row.brand             || '',
    short_desc:        row.short_desc        || '',
    category_ids:      row.category_ids      || [row.category_id].filter(Boolean),
    category_slug:     row.category_slug     || '',
    product_type:      row.product_type      || '',
    price:             parseFloat(row.price) || 0,
    compare_price:     row.compare_price ? parseFloat(row.compare_price) : undefined,
    on_sale:           onSale,
    is_new:            !!row.is_new,
    is_featured:       !!row.is_featured,
    in_stock:          (row.qty_on_hand > 0) || !!row.allow_backorder,
    cabinet_finish:    attrs.cabinet_finish   || undefined,
    hardware_finish:   attrs.hardware_finish  || undefined,
    finish:            attrs.finish           || undefined,
    style:             attrs.style            || undefined,
    size_in:           attrs.size_in ? parseFloat(attrs.size_in) : undefined,
    primary_image_url: row.primary_image_url || row.primary_image || '',
    badge:             onSale ? 'sale' : (row.is_new ? 'new' : (row.is_featured ? 'best' : '')),
    sort_weight:       weight,
  };
}

/* ── Fetch products from DB with key attribute values ──────────── */
async function fetchProducts(deltaHours = null) {
  let where = 'p.is_active = 1';
  const params = [];
  if (deltaHours) {
    where += ' AND p.updated_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)';
    params.push(deltaHours);
  }

  const [rows] = await bvoPool.query(`
    SELECT
      p.id, p.slug, p.name, p.brand, p.short_desc,
      p.category_id, c.slug AS category_slug,
      p.product_type,
      p.price, p.compare_price,
      p.is_new, p.is_featured,
      COALESCE(p.primary_image_url, pi.url) AS primary_image_url,
      COALESCE(inv.qty_on_hand, 0)          AS qty_on_hand,
      inv.allow_backorder
    FROM products p
    LEFT JOIN categories c   ON c.id = p.category_id
    LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
    LEFT JOIN inventory inv  ON inv.product_id  = p.id
    WHERE ${where}
    ORDER BY p.id
  `, params);

  // Fetch key attribute values for these products in one query
  if (rows.length) {
    const ids = rows.map(r => r.id);
    const [attrRows] = await bvoPool.query(`
      SELECT pav.product_id, ad.attr_key,
             COALESCE(pav.value_text, CAST(pav.value_num AS CHAR)) AS val
      FROM product_attribute_values pav
      JOIN attribute_definitions ad ON ad.id = pav.attr_def_id
      WHERE pav.product_id IN (${ids.map(() => '?').join(',')})
        AND ad.attr_key IN ('cabinet_finish','hardware_finish','finish','style','size_in')
    `, ids);

    // Build attr map: { product_id: { key: val } }
    const attrMap = {};
    for (const a of attrRows) {
      if (!attrMap[a.product_id]) attrMap[a.product_id] = {};
      attrMap[a.product_id][a.attr_key] = a.val;
    }
    for (const r of rows) {
      r._attrs = attrMap[r.id] || {};
    }
  }

  return rows;
}

/* ── Ensure Typesense collection exists ────────────────────────── */
async function ensureCollection(forceRecreate = false) {
  try {
    const existing = await client.collections('products').retrieve();
    if (forceRecreate) {
      console.log('[searchSync] Dropping existing collection…');
      await client.collections('products').delete();
    } else {
      console.log(`[searchSync] Collection exists — ${existing.num_documents} documents.`);
      return;
    }
  } catch (e) {
    if (!e.message.includes('Not Found')) throw e;
    // Collection doesn't exist — create it
  }
  console.log('[searchSync] Creating collection…');
  await client.collections().create(SCHEMA);
}

/* ── Main ──────────────────────────────────────────────────────── */
async function run() {
  const isDelta = process.argv.includes('--delta');
  const deltaHours = isDelta ? 24 : null;

  console.log(`\n[searchSync] Starting ${isDelta ? 'delta' : 'full'} sync…`);

  await ensureCollection(!isDelta);

  const rows = await fetchProducts(deltaHours);
  console.log(`[searchSync] Fetched ${rows.length} products from DB.`);

  if (!rows.length) {
    console.log('[searchSync] Nothing to index.');
    return;
  }

  const docs = rows.map(buildDocument);

  // Import in batches of 500 (Typesense recommended batch size)
  const BATCH = 500;
  let imported = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);
    const results = await client.collections('products')
      .documents()
      .import(batch, { action: isDelta ? 'upsert' : 'create' });

    const failed = results.filter(r => !r.success);
    if (failed.length) {
      console.warn(`[searchSync] ${failed.length} docs failed in batch ${Math.floor(i / BATCH) + 1}:`);
      failed.slice(0, 3).forEach(f => console.warn('  ', f.error, f.document?.id));
    }
    imported += batch.length - failed.length;
  }

  console.log(`[searchSync] Done — ${imported}/${docs.length} documents indexed.\n`);
  await bvoPool.end().catch(() => {});
}

run().catch(err => {
  console.error('[searchSync] Fatal:', err.message);
  process.exit(1);
});
