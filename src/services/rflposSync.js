'use strict';

/**
 * RFLPOS → BVO Inventory Sync Service
 *
 * SAFETY CONTRACT:
 *   - All RFLPOS data comes via the read-only PHP proxy at rflpos.com/bvo_sync.php.
 *   - The proxy only runs SELECT queries — it never writes to RFLPOS.
 *   - New products arrive as is_active=0 — nothing goes live without admin approval.
 *
 * Env vars required:
 *   BVO_SYNC_TOKEN  — must match SYNC_TOKEN in bvo_sync.php
 *   BVO_SYNC_URL    — optional override (default: https://rflpos.com/bvo_sync.php)
 */

const https        = require('https');
const { bvoPool }  = require('../config/database');
const syncSettings = require('./syncSettings');

const PROXY_BASE = process.env.BVO_SYNC_URL || 'https://rflpos.com/bvo_sync.php';

// ── HTTPS helper ─────────────────────────────────────────────────
function proxyGet(params) {
  return new Promise((resolve, reject) => {
    const token  = process.env.BVO_SYNC_TOKEN || '';
    const qs     = new URLSearchParams({ token, ...params }).toString();
    const url    = `${PROXY_BASE}?${qs}`;

    const req = https.get(url, { timeout: 30000 }, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (!data.ok) reject(new Error(data.error || 'Proxy returned ok:false'));
          else resolve(data);
        } catch {
          reject(new Error(`Proxy returned non-JSON: ${raw.slice(0, 300)}`));
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Proxy request timed out')); });
    req.on('error',   reject);
  });
}

// ── Category name → BVO slug fuzzy map ──────────────────────────
const CAT_MAP = {
  'vanity':             'bathroom-vanities',
  'vanities':           'bathroom-vanities',
  'bathroom vanity':    'bathroom-vanities',
  'bathroom vanities':  'bathroom-vanities',
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

// Cache BVO category slug → id
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

// ── Strip HTML tags from a string ────────────────────────────────
function stripHtml(str) {
  if (!str) return str;
  return String(str)
    .replace(/<[^>]*>/g, '')   // remove all tags
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/\s+/g, ' ')
    .trim();
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
  let i    = 2;
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
// Only overwrites an image that originally came from RFLPOS.
// Never touches a manually uploaded primary image.
async function upsertImage(productId, imgUrl) {
  if (!imgUrl) return;
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
  const sku    = (row.sku && String(row.sku).trim()) ? String(row.sku).trim() : `RFLPOS-${rflId}`;
  const price  = parseFloat(row.sell_price) || 0;
  const stock  = parseFloat(row.stock_qty)  || 0;
  const imgUrl = row.image ? `https://rflpos.com/product_images/${row.image}` : null;
  const catId  = await getCatId(row.category_name || null);
  const name   = stripHtml(row.product_name);   // strip any <p>, <br>, etc from RFLPOS
  const desc   = row.description || null;        // keep HTML in desc — rendered via <%- %>
  const brand  = stripHtml(row.brand_name) || null;

  const [existing] = await bvoPool.query(
    'SELECT id FROM products WHERE rflpos_item_id = ? LIMIT 1', [rflId]
  );

  if (existing.length) {
    // UPDATE — only fields RFLPOS owns (price, brand, stock).
    // Never touch is_active or category_id — admin controls those.
    await bvoPool.query(
      `UPDATE products
       SET name=?, brand=?, price=?, short_desc=?, updated_at=NOW()
       WHERE rflpos_item_id=?`,
      [name, brand, price, desc, rflId]
    );
    await bvoPool.query(
      `UPDATE inventory SET qty_on_hand=?, last_synced_at=NOW() WHERE product_id=?`,
      [stock, existing[0].id]
    );
    await upsertImage(existing[0].id, imgUrl);
  } else {
    // INSERT — hidden until approved (is_active=0)
    const slug  = await uniqueSlug(toSlug(name));
    const [ins] = await bvoPool.query(
      `INSERT INTO products
         (sku, slug, name, brand, category_id, short_desc, price,
          source_flag, rflpos_item_id, is_active, is_featured, is_new)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'rflpos', ?, 0, 0, 0)`,
      [sku, slug, name, brand, catId, desc, price, rflId]
    );
    const newId = ins.insertId;
    await bvoPool.query(
      `INSERT INTO inventory (product_id, qty_on_hand, last_synced_at) VALUES (?, ?, NOW())`,
      [newId, stock]
    );
    await upsertImage(newId, imgUrl);
  }
}

// ── Get available brands from RFLPOS proxy ───────────────────────
async function getRflBrands() {
  if (!process.env.BVO_SYNC_TOKEN) return [];
  try {
    const data = await proxyGet({ action: 'brands' });
    return data.brands || [];
  } catch {
    return [];
  }
}

// ── Main sync entry point ────────────────────────────────────────
async function syncProducts() {
  if (!process.env.BVO_SYNC_TOKEN) {
    throw new Error('BVO_SYNC_TOKEN not set — add it to env vars.');
  }

  _catCache = null;

  const settings      = syncSettings.get();
  const allowedBrands = (settings.allowedBrands || []).map(Number).filter(Boolean);

  const logId = await startLog();
  let ok = 0, err = 0;
  const errMsgs = [];

  try {
    const params = { action: 'products' };
    if (allowedBrands.length) params.brands = allowedBrands.join(',');

    const data = await proxyGet(params);
    const rows = data.products || [];

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

// ── Last sync summary ────────────────────────────────────────────
async function lastSyncSummary() {
  const [rows] = await bvoPool.query(
    `SELECT * FROM rflpos_sync_log WHERE sync_type='product' ORDER BY id DESC LIMIT 5`
  );
  return rows;
}

// ── Pending count ────────────────────────────────────────────────
async function pendingCount() {
  const [[row]] = await bvoPool.query(
    `SELECT COUNT(*) AS cnt FROM products WHERE source_flag='rflpos' AND is_active=0`
  );
  return row.cnt;
}

module.exports = { syncProducts, lastSyncSummary, pendingCount, getRflBrands };
