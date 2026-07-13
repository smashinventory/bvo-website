'use strict';

/**
 * RFLPOS → BVO Inventory Sync Service
 *
 * SAFETY CONTRACT:
 *   - Only SELECT statements are ever executed on the RFLPOS connection.
 *   - All writes go to bvoPool (the BVO website DB) only.
 *   - New products arrive as is_active=0 — nothing goes live without admin approval.
 *   - On any RFLPOS connection error, the function throws and BVO continues normally.
 */

const { bvoPool, getRflPool } = require('../config/database');

// ── Category name → BVO slug fuzzy map ──────────────────────────
// RFLPOS category names (lowercase) → BVO category slug
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
async function startLog(syncType) {
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

// ── Core upsert ──────────────────────────────────────────────────
async function upsertProduct(row) {
  const rflId  = String(row.product_id);
  const sku    = (row.product_code && row.product_code.trim())
                   ? row.product_code.trim()
                   : `RFLPOS-${rflId}`;
  const price  = parseFloat(row.product_sell_price)  || 0;
  const cost   = parseFloat(row.product_buy_price)   || null;
  const stock  = parseInt(row.product_stock, 10)     || 0;
  const imgUrl = row.product_image
                   ? `https://rflpos.com/product_images/${row.product_image}`
                   : null;
  const catId  = await getCatId(row.category_name || null);
  const desc   = row.product_description || null;

  // Check if already synced
  const [existing] = await bvoPool.query(
    'SELECT id, slug FROM products WHERE rflpos_item_id = ? LIMIT 1',
    [rflId]
  );

  if (existing.length) {
    // UPDATE — price, cost, name, description, image only.
    // Do NOT touch: is_active, category_id (admin controls these).
    await bvoPool.query(
      `UPDATE products
       SET name=?, price=?, cost=?, short_desc=?, primary_image_url=?, updated_at=NOW()
       WHERE rflpos_item_id=?`,
      [row.product_name, price, cost, desc, imgUrl, rflId]
    );
    // Update stock
    await bvoPool.query(
      `UPDATE inventory SET qty_on_hand=?, last_synced_at=NOW()
       WHERE product_id=?`,
      [stock, existing[0].id]
    );
  } else {
    // INSERT — hidden from storefront until admin approves (is_active=0)
    const slug = await uniqueSlug(toSlug(row.product_name));
    const [ins] = await bvoPool.query(
      `INSERT INTO products
         (sku, slug, name, category_id, short_desc, price, cost,
          primary_image_url, source_flag, rflpos_item_id,
          is_active, is_featured, is_new)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rflpos', ?, 0, 0, 0)`,
      [sku, slug, row.product_name, catId, desc, price, cost, imgUrl, rflId]
    );
    const newId = ins.insertId;
    // Create inventory row
    await bvoPool.query(
      `INSERT INTO inventory (product_id, qty_on_hand, last_synced_at)
       VALUES (?, ?, NOW())`,
      [newId, stock]
    );
  }
}

// ── Main sync entry point ────────────────────────────────────────
async function syncProducts() {
  const rfl = getRflPool();
  if (!rfl) {
    throw new Error('RFLPOS DB not configured — add RFLPOS_DB_* env vars.');
  }

  // Reset category cache each run so new categories are picked up
  _catCache = null;

  const logId = await startLog('product');
  let ok = 0, err = 0;
  const errMsgs = [];

  try {
    // READ ONLY — BVO never touches the RFLPOS DB except with SELECT
    const [rows] = await rfl.query(`
      SELECT
        p.product_id,
        p.product_name,
        p.product_code,
        p.product_description,
        p.product_sell_price,
        p.product_buy_price,
        p.product_stock,
        p.product_image,
        p.product_weight,
        pc.category_name
      FROM products p
      LEFT JOIN product_category pc ON p.category_id = pc.category_id
    `);

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
    // RFLPOS connection / query failure — log and rethrow
    await finishLog(logId, ok, err + 1, e.message);
    throw e;
  }

  await finishLog(logId, ok, err, errMsgs.length ? errMsgs.join('\n') : null);
  return { ok, err, total: ok + err, logId };
}

// ── Last sync summary (for admin dashboard widget) ───────────────
async function lastSyncSummary() {
  const [rows] = await bvoPool.query(
    `SELECT * FROM rflpos_sync_log
     WHERE sync_type = 'product'
     ORDER BY id DESC LIMIT 5`
  );
  return rows;
}

// ── Pending approvals count ──────────────────────────────────────
async function pendingCount() {
  const [[row]] = await bvoPool.query(
    `SELECT COUNT(*) AS cnt FROM products
     WHERE source_flag = 'rflpos' AND is_active = 0`
  );
  return row.cnt;
}

module.exports = { syncProducts, lastSyncSummary, pendingCount };
