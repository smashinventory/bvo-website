'use strict';

/**
 * RFLPOS → BVO Inventory Sync Service
 *
 * SAFETY CONTRACT:
 *   - Only SELECT statements are ever executed on the RFLPOS connection.
 *   - All writes go to bvoPool (the BVO website DB) only.
 *   - New products arrive as is_active=0 — nothing goes live without admin approval.
 *   - On any RFLPOS connection error, the function throws and BVO continues normally.
 *
 * RFLPOS schema (actual column names, confirmed via phpMyAdmin):
 *   products:                  id, name, sku, brand_id, category_id, product_description,
 *                              image, weight, is_inactive, not_for_selling, deleted_at
 *   brands:                    id, name, deleted_at
 *   categories:                id, name, deleted_at
 *   product_variations:        id, product_id, is_dummy
 *   variation_location_details: product_id, product_variation_id, qty_available
 *   transaction_sell_lines:    product_id, unit_price_inc_tax (sell price inc tax)
 */

const { bvoPool, getRflPool } = require('../config/database');
const syncSettings             = require('./syncSettings');

// ── Category name → BVO slug fuzzy map ──────────────────────────
const CAT_MAP = {
  'vanity':             'vanities',
  'vanities':           'vanities',
  'bathroom vanity':    'vanities',
  'bathroom vanities':  'vanities',
  'mirror':             'mirrors',
  'mirrors':            'mirrors',
  'bathroom mirror':    'mirrors',
  'faucet':             'faucets',
  'faucets':            'faucets',
  'bathroom faucet':    'faucets',
  'accessory':          'accessories',
  'accessories':        'accessories',
  'hardware':           'accessories',
  'lighting':           'lighting',
  'lights':             'lighting',
  'vanity light':       'lighting',
  'storage':            'storage',
  'medicine cabinet':   'storage',
  'cabinet':            'storage',
};

// Cache BVO category slug → id so we aren't hitting the DB on every product
let _catCache = null;
async function getCatId(categoryName) {
  if (!_catCache) {
    const [rows] = await bvoPool.query('SELECT id, slug FROM categories WHERE is_active = 1');
    _catCache = {};
    for (const r of rows) _catCache[r.slug] = r.id;
  }
  if (!categoryName) return null;
  const slug = CAT_MAP[categoryName.toLowerCase().trim()];
  return slug ? (_catCache[slug] || null) : null;
}

// ── Slug generator ───────────────────────────────────────────────
function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

async function uniqueSlug(base, existingId = null) {
  let slug = base;
  let i = 2;
  for (;;) {
    const [rows] = await bvoPool.query(
      'SELECT id FROM products WHERE slug = ? LIMIT 1', [slug]
    );
    if (!rows.length) return slug;
    if (existingId && rows[0].id === existingId) return slug;
    slug = `${base}-${i++}`;
  }
}

// ── Sync log helpers ─────────────────────────────────────────────
async function startLog() {
  const [r] = await bvoPool.query(
    `INSERT INTO rflpos_sync_log (sync_type, direction, records_ok, records_err, started_at)
     VALUES ('product', 'pull', 0, 0, NOW())`
  );
  return r.insertId;
}

async function finishLog(logId, ok, err, detail) {
  await bvoPool.query(
    `UPDATE rflpos_sync_log
     SET records_ok=?, records_err=?, error_detail=?, finished_at=NOW()
     WHERE id=?`,
    [ok, err, detail || null, logId]
  );
}

// ── Image upsert ─────────────────────────────────────────────────
// Inserts or updates the primary image for a product.
// Only overwrites an image that originally came from RFLPOS (URL contains rflpos.com).
// Never touches a manually uploaded primary image.
async function upsertImage(productId, imgUrl) {
  if (!imgUrl) return;
  // Is there an existing rflpos-sourced primary image?
  const [existing] = await bvoPool.query(
    `SELECT id FROM product_images
     WHERE product_id = ? AND is_primary = 1 AND url LIKE '%rflpos.com%'
     LIMIT 1`,
    [productId]
  );
  if (existing.length) {
    await bvoPool.query(
      `UPDATE product_images SET url = ? WHERE id = ?`,
      [imgUrl, existing[0].id]
    );
    return;
  }
  // No rflpos image — only insert if there is no primary image at all
  const [anyPrimary] = await bvoPool.query(
    `SELECT id FROM product_images WHERE product_id = ? AND is_primary = 1 LIMIT 1`,
    [productId]
  );
  if (!anyPrimary.length) {
    await bvoPool.query(
      `INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
       VALUES (?, ?, '', 0, 1)`,
      [productId, imgUrl]
    );
  }
}

// ── Core upsert ──────────────────────────────────────────────────
async function upsertProduct(row) {
  const rflId  = String(row.rfl_id);
  const sku    = (row.sku && row.sku.trim()) ? row.sku.trim() : `RFLPOS-${rflId}`;
  const price  = parseFloat(row.sell_price) || 0;
  const stock  = parseFloat(row.stock_qty)  || 0;
  const imgUrl = row.image ? `https://rflpos.com/product_images/${row.image}` : null;
  const catId  = await getCatId(row.category_name || null);
  const desc   = row.description || null;
  const brand  = row.brand_name  || null;

  // Check if this product is already in BVO
  const [existing] = await bvoPool.query(
    'SELECT id FROM products WHERE rflpos_item_id = ? LIMIT 1',
    [rflId]
  );

  if (existing.length) {
    // UPDATE — only sync fields RFLPOS owns: price, brand, stock.
    // Do NOT touch: is_active, category_id (admin controls these after approval).
    await bvoPool.query(
      `UPDATE products
       SET name=?, brand=?, price=?, short_desc=?, updated_at=NOW()
       WHERE rflpos_item_id=?`,
      [row.product_name, brand, price, desc, rflId]
    );
    await bvoPool.query(
      `UPDATE inventory SET qty_on_hand=?, last_synced_at=NOW() WHERE product_id=?`,
      [stock, existing[0].id]
    );
    await upsertImage(existing[0].id, imgUrl);
  } else {
    // INSERT — hidden from storefront until admin approves (is_active=0)
    const slug = await uniqueSlug(toSlug(row.product_name));
    const [ins] = await bvoPool.query(
      `INSERT INTO products
         (sku, slug, name, brand, category_id, short_desc, price,
          source_flag, rflpos_item_id, is_active, is_featured, is_new)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'rflpos', ?, 0, 0, 0)`,
      [sku, slug, row.product_name, brand, catId, desc, price, rflId]
    );
    const newId = ins.insertId;
    await bvoPool.query(
      `INSERT INTO inventory (product_id, qty_on_hand, last_synced_at) VALUES (?, ?, NOW())`,
      [newId, stock]
    );
    await upsertImage(newId, imgUrl);
  }
}

// ── Get available brands from RFLPOS (for brand filter UI) ───────
async function getRflBrands() {
  const rfl = getRflPool();
  if (!rfl) return [];
  try {
    const [rows] = await rfl.query(`
      SELECT id, name
      FROM brands
      WHERE deleted_at IS NULL
      ORDER BY name
    `);
    return rows;
  } catch {
    return [];
  }
}

// ── Main sync entry point ────────────────────────────────────────
async function syncProducts() {
  const rfl = getRflPool();
  if (!rfl) throw new Error('RFLPOS DB not configured — add RFLPOS_DB_* env vars.');

  // Reset category cache each run so new BVO categories are picked up
  _catCache = null;

  const settings      = syncSettings.get();
  const allowedBrands = (settings.allowedBrands || []).map(Number).filter(Boolean);

  const logId = await startLog();
  let ok = 0, err = 0;
  const errMsgs = [];

  try {
    // Build brand filter — empty array means "sync all brands"
    const brandWhere  = allowedBrands.length > 0
      ? `AND p.brand_id IN (${allowedBrands.map(() => '?').join(',')})`
      : '';

    // READ ONLY — BVO never writes to the RFLPOS database
    const [rows] = await rfl.query(`
      SELECT
        p.id                  AS rfl_id,
        p.name                AS product_name,
        p.sku,
        p.product_description AS description,
        p.image,
        p.weight,
        b.name                AS brand_name,
        c.name                AS category_name,
        COALESCE(SUM(vld.qty_available), 0) AS stock_qty,
        (
          SELECT tsl.unit_price_inc_tax
          FROM transaction_sell_lines tsl
          WHERE tsl.product_id = p.id
            AND tsl.unit_price_inc_tax IS NOT NULL
            AND tsl.unit_price_inc_tax > 0
          ORDER BY tsl.created_at DESC
          LIMIT 1
        ) AS sell_price
      FROM products p
      LEFT JOIN brands b
             ON p.brand_id = b.id AND b.deleted_at IS NULL
      LEFT JOIN categories c
             ON p.category_id = c.id AND c.deleted_at IS NULL
      LEFT JOIN product_variations pv
             ON p.id = pv.product_id AND pv.is_dummy = 1
      LEFT JOIN variation_location_details vld
             ON pv.id = vld.product_variation_id
      WHERE p.is_inactive    = 0
        AND p.not_for_selling = 0
        AND p.deleted_at     IS NULL
        ${brandWhere}
      GROUP BY p.id, p.name, p.sku, p.product_description,
               p.image, p.weight, b.name, c.name
      ORDER BY b.name, p.name
    `, allowedBrands);

    for (const row of rows) {
      try {
        await upsertProduct(row);
        ok++;
      } catch (e) {
        err++;
        errMsgs.push(`[${row.product_name}] ${e.message}`);
      }
    }
  } catch (e) {
    await finishLog(logId, ok, err + 1, e.message);
    throw e;
  }

  await finishLog(logId, ok, err, errMsgs.length ? errMsgs.join('\n') : null);
  return { ok, err, total: ok + err, logId };
}

// ── Last sync summary (for admin dashboard widget) ───────────────
async function lastSyncSummary() {
  const [rows] = await bvoPool.query(
    `SELECT * FROM rflpos_sync_log WHERE sync_type='product' ORDER BY id DESC LIMIT 5`
  );
  return rows;
}

// ── Pending approvals count ──────────────────────────────────────
async function pendingCount() {
  const [[row]] = await bvoPool.query(
    `SELECT COUNT(*) AS cnt FROM products WHERE source_flag='rflpos' AND is_active=0`
  );
  return row.cnt;
}

module.exports = { syncProducts, lastSyncSummary, pendingCount, getRflBrands };
