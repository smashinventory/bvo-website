'use strict';

const { bvoPool }   = require('../config/database');
const Product        = require('../models/Product');
const Category       = require('../models/Category');
const themeSettings  = require('../services/themeSettings');
const rflposSync     = require('../services/rflposSync');
const syncSettings   = require('../services/syncSettings');
const path           = require('path');
const fs             = require('fs');
const multer         = require('multer');

/* ── Multer — image uploads ──────────────────────────────────── */
const _storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../public/images/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '-').toLowerCase();
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});
const _upload = multer({
  storage: _storage,
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (/^image\//i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

/* ── helpers ────────────────────────────────────────────────────── */
const LAYOUT = { layout: 'layouts/admin' };

function safeQuery(sql, params = []) {
  return bvoPool.query(sql, params).then(([rows]) => rows).catch(() => []);
}

function safeQueryOne(sql, params = []) {
  return bvoPool.query(sql, params).then(([rows]) => rows[0] || null).catch(() => null);
}

/* ════════════════════════════════════════════════════════════════
   AUTH
   ════════════════════════════════════════════════════════════════ */

/* GET /admin/login */
exports.loginPage = (req, res) => {
  if (req.session?.isAdmin) return res.redirect('/admin');
  res.render('pages/admin/login', {
    ...LAYOUT,
    pageTitle: 'Admin Login',
    activePage: '',
    error: null,
    flash: null,
  });
};

/* POST /admin/login */
exports.login = (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USER     || 'admin';
  const validPass = process.env.ADMIN_PASSWORD || 'changeme';

  if (username === validUser && password === validPass) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('pages/admin/login', {
    ...LAYOUT,
    pageTitle: 'Admin Login',
    activePage: '',
    error: 'Invalid username or password.',
    flash: null,
  });
};

/* POST /admin/logout */
exports.logout = (req, res) => {
  req.session.isAdmin = false;
  delete req.session.isAdmin;
  res.redirect('/admin/login');
};

/* ════════════════════════════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════════════════════════════ */

exports.dashboard = async (req, res, next) => {
  try {
    const [
      totalProductsRow,
      activeProductsRow,
      totalOrdersRow,
      ordersToday,
      revenueRow,
      totalCustomersRow,
      recentOrders,
    ] = await Promise.all([
      safeQueryOne('SELECT COUNT(*) AS n FROM products'),
      safeQueryOne('SELECT COUNT(*) AS n FROM products WHERE is_active = 1'),
      safeQueryOne('SELECT COUNT(*) AS n FROM orders'),
      safeQueryOne('SELECT COUNT(*) AS n FROM orders WHERE DATE(created_at) = CURDATE()'),
      safeQueryOne('SELECT COALESCE(SUM(total),0) AS rev FROM orders WHERE MONTH(created_at)=MONTH(CURDATE()) AND YEAR(created_at)=YEAR(CURDATE())'),
      safeQueryOne('SELECT COUNT(*) AS n FROM customers'),
      safeQuery('SELECT o.id, o.order_number, o.status, o.total, o.created_at, CONCAT(c.first_name," ",c.last_name) AS customer_name FROM orders o LEFT JOIN customers c ON c.id=o.customer_id ORDER BY o.created_at DESC LIMIT 8'),
    ]);

    const stats = {
      totalProducts:   totalProductsRow?.n   ?? 0,
      activeProducts:  activeProductsRow?.n  ?? 0,
      totalOrders:     totalOrdersRow?.n     ?? 0,
      ordersToday:     ordersToday?.n        ?? 0,
      revenueMonth:    parseFloat(revenueRow?.rev ?? 0),
      totalCustomers:  totalCustomersRow?.n  ?? 0,
    };

    res.render('pages/admin/dashboard', {
      ...LAYOUT,
      pageTitle: 'Dashboard | BVO Admin',
      activePage: 'dashboard',
      flash: null,
      stats,
      recentOrders,
    });
  } catch (err) { next(err); }
};

/* ════════════════════════════════════════════════════════════════
   PRODUCTS
   ════════════════════════════════════════════════════════════════ */

const PER_PAGE = 20;

exports.productList = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const search = (req.query.q || '').trim();
    const offset = (page - 1) * PER_PAGE;

    let where = '';
    let params = [];
    if (search) {
      where = 'WHERE p.name LIKE ? OR p.sku LIKE ? OR p.brand LIKE ?';
      const like = `%${search}%`;
      params = [like, like, like];
    }

    const countRow = await safeQueryOne(
      `SELECT COUNT(*) AS n FROM products p ${where}`,
      params
    );
    const total = countRow?.n ?? 0;
    const pages = Math.ceil(total / PER_PAGE);

    const products = await safeQuery(
      `SELECT p.id, p.name, p.slug, p.sku, p.brand, p.price, p.compare_price,
              p.is_active, p.source_flag, c.name AS category_name,
              (SELECT url FROM product_images WHERE product_id=p.id ORDER BY is_primary DESC, sort_order ASC LIMIT 1) AS thumb
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, PER_PAGE, offset]
    );

    const displayProducts = products;
    const categories      = await Category.findAll();

    res.render('pages/admin/products', {
      ...LAYOUT,
      pageTitle: 'Products | BVO Admin',
      activePage: 'products',
      flash:      req.session.flash || null,
      products:   displayProducts,
      categories,
      search,
      total,
      page,
      pages,
    });
    delete req.session.flash;
  } catch (err) { next(err); }
};

exports.productNew = async (req, res, next) => {
  try {
    const categories = await Category.findAll();
    res.render('pages/admin/product-edit', {
      ...LAYOUT,
      pageTitle:    'Add Product | BVO Admin',
      activePage:   'products',
      flash:        req.session.flash || null,
      product:      null,
      categories,
      productImages: [],
      productAttrs:  [],
      isNew: true,
    });
    delete req.session.flash;
  } catch (err) { next(err); }
};

exports.productEdit = async (req, res, next) => {
  try {
    const product = await safeQueryOne(
      'SELECT * FROM products WHERE id = ?', [req.params.id]
    );
    if (!product) return res.redirect('/admin/products');

    const [categories, productImages, productAttrs, inventoryRow] = await Promise.all([
      Category.findAll(),
      safeQuery(
        'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, is_primary DESC',
        [product.id]
      ),
      safeQuery(
        'SELECT attr_key, value_text, value_num FROM product_attribute_values WHERE product_id = ? ORDER BY attr_key',
        [product.id]
      ),
      safeQueryOne(
        'SELECT qty_on_hand, allow_backorder FROM inventory WHERE product_id = ?',
        [product.id]
      ),
    ]);

    product.qty_on_hand    = inventoryRow?.qty_on_hand    ?? 0;
    product.allow_backorder = inventoryRow?.allow_backorder ?? 0;

    res.render('pages/admin/product-edit', {
      ...LAYOUT,
      pageTitle:   `Edit: ${product.name} | BVO Admin`,
      activePage:  'products',
      flash:       req.session.flash || null,
      product,
      categories,
      productImages,
      productAttrs,
      isNew: false,
    });
    delete req.session.flash;
  } catch (err) { next(err); }
};

exports.productCreate = async (req, res, next) => {
  try {
    const d = _extractProductFields(req.body);
    const sku = d.sku || `MANUAL-${Date.now()}`;
    const [ins] = await bvoPool.query(
      `INSERT INTO products
         (sku, slug, name, brand, category_id,
          short_desc, long_desc,
          price, compare_price,
          width_in, depth_in, height_in, weight_lbs,
          is_active, is_featured, is_new,
          meta_title, meta_desc, source_flag)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'manual')`,
      [sku, d.slug, d.name, d.brand, d.category_id,
       d.short_desc, d.long_desc, d.price, d.compare_price,
       d.width_in, d.depth_in, d.height_in, d.weight_lbs,
       d.is_active, d.is_featured, d.is_new,
       d.meta_title, d.meta_desc]
    );
    const productId = ins.insertId;
    await _upsertInventory(productId, d.qty_on_hand, d.allow_backorder);
    await _saveSpecs(productId, d.specs);
    req.session.flash = { type: 'success', msg: 'Product created.' };
    res.redirect(`/admin/products/${productId}/edit`);
  } catch (err) { next(err); }
};

exports.productUpdate = async (req, res, next) => {
  try {
    const d  = _extractProductFields(req.body);
    const id = req.params.id;
    await bvoPool.query(
      `UPDATE products SET
         name=?, slug=?, sku=?, brand=?, category_id=?,
         short_desc=?, long_desc=?,
         price=?, compare_price=?,
         width_in=?, depth_in=?, height_in=?, weight_lbs=?,
         is_active=?, is_featured=?, is_new=?,
         meta_title=?, meta_desc=?,
         updated_at=NOW()
       WHERE id=?`,
      [d.name, d.slug, d.sku, d.brand, d.category_id,
       d.short_desc, d.long_desc, d.price, d.compare_price,
       d.width_in, d.depth_in, d.height_in, d.weight_lbs,
       d.is_active, d.is_featured, d.is_new,
       d.meta_title, d.meta_desc, id]
    );
    await _upsertInventory(id, d.qty_on_hand, d.allow_backorder);
    await _saveSpecs(id, d.specs);
    req.session.flash = { type: 'success', msg: 'Product saved.' };
    res.redirect(`/admin/products/${id}/edit`);
  } catch (err) { next(err); }
};

exports.productDelete = async (req, res, next) => {
  try {
    await bvoPool.query('DELETE FROM products WHERE id = ?', [req.params.id])
      .catch(() => {});
    req.session.flash = { type: 'success', msg: 'Product deleted.' };
    res.redirect('/admin/products');
  } catch (err) { next(err); }
};

/* ── Product image management ────────────────────────────────────── */

exports.productAddImageMiddleware = _upload.single('image_file');

exports.productAddImage = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!req.file) {
      req.session.flash = { type: 'error', msg: 'No image file received.' };
      return res.redirect(`/admin/products/${id}/edit`);
    }
    const url = `/images/uploads/${req.file.filename}`;
    // Check if any primary image exists
    const [[{ cnt }]] = await bvoPool.query(
      'SELECT COUNT(*) AS cnt FROM product_images WHERE product_id = ? AND is_primary = 1', [id]
    );
    const isPrimary = cnt === 0 ? 1 : 0;
    await bvoPool.query(
      'INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, 0, ?)',
      [id, url, req.body.alt_text || '', isPrimary]
    );
    req.session.flash = { type: 'success', msg: 'Image uploaded.' };
    res.redirect(`/admin/products/${id}/edit`);
  } catch (err) { next(err); }
};

exports.productDeleteImage = async (req, res, next) => {
  try {
    const { id, imgId } = req.params;
    await bvoPool.query('DELETE FROM product_images WHERE id = ? AND product_id = ?', [imgId, id]);
    req.session.flash = { type: 'success', msg: 'Image removed.' };
    res.redirect(`/admin/products/${id}/edit`);
  } catch (err) { next(err); }
};

exports.productSetPrimaryImage = async (req, res, next) => {
  try {
    const { id, imgId } = req.params;
    await bvoPool.query('UPDATE product_images SET is_primary = 0 WHERE product_id = ?', [id]);
    await bvoPool.query('UPDATE product_images SET is_primary = 1 WHERE id = ? AND product_id = ?', [imgId, id]);
    req.session.flash = { type: 'success', msg: 'Primary image updated.' };
    res.redirect(`/admin/products/${id}/edit`);
  } catch (err) { next(err); }
};

/* ── CSV Export / Import ─────────────────────────────────────────── */

// Attribute keys included in the CSV — matches our filter definitions + JM spreadsheet fields
const CSV_ATTR_KEYS = [
  'product_type', 'size_in', 'cabinet_finish', 'color_family',
  'hardware_finish', 'style', 'mount_type', 'sink_count', 'sink_included',
  'countertop_material', 'countertop_included', 'mirror_included',
  'door_style', 'drawer_count', 'sink_type', 'faucet_holes',
];
// Keys stored as numeric values
const NUMERIC_ATTR_KEYS = new Set(['size_in', 'sink_count', 'drawer_count', 'faucet_holes']);

function _csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function _csvRow(vals) {
  return vals.map(_csvEscape).join(',');
}

/* GET /admin/products/export.csv */
exports.productExport = async (req, res, next) => {
  try {
    // Build subquery columns for each attribute key
    const attrSelects = CSV_ATTR_KEYS.map(k => {
      const col = NUMERIC_ATTR_KEYS.has(k)
        ? `(SELECT value_num  FROM product_attribute_values WHERE product_id=p.id AND attr_key=${bvoPool.escape(k)} LIMIT 1) AS ${bvoPool.escapeId('attr_' + k)}`
        : `(SELECT value_text FROM product_attribute_values WHERE product_id=p.id AND attr_key=${bvoPool.escape(k)} LIMIT 1) AS ${bvoPool.escapeId('attr_' + k)}`;
      return col;
    }).join(',\n  ');

    const [rows] = await bvoPool.query(`
      SELECT
        p.name, p.sku, p.brand,
        c.slug AS category_slug,
        p.price, p.compare_price,
        p.short_desc, p.long_desc,
        p.width_in, p.depth_in, p.height_in, p.weight_lbs,
        p.is_active, p.is_featured, p.is_new,
        COALESCE(i.qty_on_hand, 0)    AS qty_on_hand,
        COALESCE(i.allow_backorder, 0) AS allow_backorder,
        p.meta_title, p.meta_desc,
        (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=1 LIMIT 1) AS image_url,
        ${attrSelects}
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN inventory  i ON i.product_id = p.id
      ORDER BY p.brand, p.name
    `);

    const headers = [
      'name','sku','brand','category_slug',
      'price','compare_price',
      'short_desc','long_desc',
      'width_in','depth_in','height_in','weight_lbs',
      'is_active','is_featured','is_new',
      'qty_on_hand','allow_backorder',
      'meta_title','meta_desc','image_url',
      ...CSV_ATTR_KEYS.map(k => `attr_${k}`),
    ];

    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(_csvRow(headers.map(h => r[h] ?? '')));
    }

    const csv = lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bvo-products-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
};

/* POST /admin/products/import  (multipart — uses multer .single('csv_file')) */
exports.productImportMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('csv_file');

function _parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ',') { cells.push(cur); cur = ''; }
        else cur += ch;
      }
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

exports.productImport = async (req, res, next) => {
  try {
    if (!req.file) {
      req.session.flash = { type: 'error', msg: 'No CSV file uploaded.' };
      return res.redirect('/admin/products');
    }

    const text    = req.file.buffer.toString('utf8');
    const [headerRow, ...dataRows] = _parseCSV(text);
    if (!headerRow) {
      req.session.flash = { type: 'error', msg: 'CSV appears to be empty.' };
      return res.redirect('/admin/products');
    }

    // Build column index
    const hdr = {};
    headerRow.forEach((h, i) => { hdr[h.trim()] = i; });

    function get(row, key) {
      const idx = hdr[key];
      return idx !== undefined ? (row[idx] || '').trim() : '';
    }

    // Cache category slug → id
    const catRows = await safeQuery('SELECT id, slug FROM categories');
    const catMap  = {};
    catRows.forEach(r => { catMap[r.slug] = r.id; });

    let ok = 0, err = 0, errs = [];

    for (const row of dataRows) {
      const name = get(row, 'name');
      if (!name) continue;

      try {
        const sku          = get(row, 'sku') || `IMPORT-${Date.now()}`;
        const brand        = get(row, 'brand') || null;
        const catSlug      = get(row, 'category_slug');
        const category_id  = catMap[catSlug] || null;
        const price        = parseFloat(get(row, 'price'))         || 0;
        const compare_price= parseFloat(get(row, 'compare_price')) || null;
        const short_desc   = get(row, 'short_desc')  || null;
        const long_desc    = get(row, 'long_desc')   || null;
        const width_in     = parseFloat(get(row, 'width_in'))  || null;
        const depth_in     = parseFloat(get(row, 'depth_in'))  || null;
        const height_in    = parseFloat(get(row, 'height_in')) || null;
        const weight_lbs   = parseFloat(get(row, 'weight_lbs'))|| null;
        const is_active    = get(row, 'is_active')  === '0' ? 0 : 1;
        const is_featured  = get(row, 'is_featured') === '1' ? 1 : 0;
        const is_new       = get(row, 'is_new')      === '1' ? 1 : 0;
        const qty_on_hand  = parseInt(get(row, 'qty_on_hand'))    || 0;
        const allow_back   = get(row, 'allow_backorder') === '1' ? 1 : 0;
        const meta_title   = get(row, 'meta_title')  || null;
        const meta_desc    = get(row, 'meta_desc')   || null;
        const image_url    = get(row, 'image_url')   || null;

        // Generate slug
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Upsert product by SKU
        const [existing] = await bvoPool.query(
          'SELECT id FROM products WHERE sku = ? LIMIT 1', [sku]
        );

        let productId;
        if (existing.length) {
          productId = existing[0].id;
          await bvoPool.query(
            `UPDATE products SET
               name=?, brand=?, category_id=?, short_desc=?, long_desc=?,
               price=?, compare_price=?, width_in=?, depth_in=?, height_in=?, weight_lbs=?,
               is_active=?, is_featured=?, is_new=?, meta_title=?, meta_desc=?, updated_at=NOW()
             WHERE id=?`,
            [name, brand, category_id, short_desc, long_desc,
             price, compare_price, width_in, depth_in, height_in, weight_lbs,
             is_active, is_featured, is_new, meta_title, meta_desc, productId]
          );
        } else {
          // Make slug unique
          let finalSlug = slug;
          let s = 2;
          while (true) {
            const [clash] = await bvoPool.query('SELECT id FROM products WHERE slug=? LIMIT 1', [finalSlug]);
            if (!clash.length) break;
            finalSlug = `${slug}-${s++}`;
          }
          const [ins] = await bvoPool.query(
            `INSERT INTO products
               (sku, slug, name, brand, category_id, short_desc, long_desc,
                price, compare_price, width_in, depth_in, height_in, weight_lbs,
                is_active, is_featured, is_new, meta_title, meta_desc, source_flag)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'manual')`,
            [sku, finalSlug, name, brand, category_id, short_desc, long_desc,
             price, compare_price, width_in, depth_in, height_in, weight_lbs,
             is_active, is_featured, is_new, meta_title, meta_desc]
          );
          productId = ins.insertId;
        }

        // Inventory
        await _upsertInventory(productId, qty_on_hand, allow_back);

        // Primary image
        if (image_url) {
          const [[{ cnt }]] = await bvoPool.query(
            'SELECT COUNT(*) AS cnt FROM product_images WHERE product_id=? AND is_primary=1', [productId]
          );
          if (cnt === 0) {
            await bvoPool.query(
              'INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary) VALUES (?,?,?,0,1)',
              [productId, image_url, name]
            );
          } else {
            await bvoPool.query(
              'UPDATE product_images SET url=? WHERE product_id=? AND is_primary=1',
              [image_url, productId]
            );
          }
        }

        // Attributes
        const specs = [];
        for (const k of CSV_ATTR_KEYS) {
          const val = get(row, `attr_${k}`);
          if (!val) continue;
          const isNum = NUMERIC_ATTR_KEYS.has(k);
          specs.push({
            key:  k,
            text: isNum ? null : val,
            num:  isNum ? (parseFloat(val) || null) : (isNaN(parseFloat(val)) ? null : parseFloat(val)),
          });
        }
        await _saveSpecs(productId, specs);

        ok++;
      } catch (e) {
        err++;
        errs.push(`Row "${name}": ${e.message}`);
      }
    }

    req.session.flash = {
      type: err > 0 ? 'error' : 'success',
      msg:  `Import complete — ${ok} succeeded, ${err} failed.${errs.length ? ' Errors: ' + errs.slice(0,3).join('; ') : ''}`,
    };
    res.redirect('/admin/products');
  } catch (err) { next(err); }
};

function _extractProductFields(body) {
  const name    = (body.name || '').trim();
  const rawSlug = (body.slug || '').trim();
  const slug    = rawSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Parse dynamic spec rows submitted as spec[0][key], spec[0][text], spec[0][num]
  const specs = [];
  let i = 0;
  while (body[`spec[${i}][key]`] !== undefined) {
    const key  = (body[`spec[${i}][key]`]  || '').trim();
    const text = (body[`spec[${i}][text]`] || '').trim() || null;
    const numRaw = body[`spec[${i}][num]`];
    const num  = (numRaw !== '' && numRaw != null) ? parseFloat(numRaw) : null;
    if (key) specs.push({ key, text, num: (num != null && !isNaN(num)) ? num : null });
    i++;
  }

  return {
    name,
    slug,
    sku:            (body.sku   || '').trim() || null,
    brand:          (body.brand || '').trim() || null,
    category_id:    parseInt(body.category_id)     || null,
    price:          parseFloat(body.price)          || 0,
    compare_price:  parseFloat(body.compare_price)  || null,
    short_desc:     (body.short_desc || '').trim()  || null,
    long_desc:      (body.long_desc  || '').trim()  || null,
    width_in:       parseFloat(body.width_in)        || null,
    depth_in:       parseFloat(body.depth_in)        || null,
    height_in:      parseFloat(body.height_in)       || null,
    weight_lbs:     parseFloat(body.weight_lbs)      || null,
    is_active:      body.is_active   === '1' ? 1 : 0,
    is_featured:    body.is_featured  ? 1 : 0,
    is_new:         body.is_new       ? 1 : 0,
    qty_on_hand:    parseInt(body.qty_on_hand)       || 0,
    allow_backorder:body.allow_backorder ? 1 : 0,
    meta_title:     (body.meta_title || '').trim()   || null,
    meta_desc:      (body.meta_desc  || '').trim()   || null,
    specs,
  };
}

/* ── Private helpers ─────────────────────────────────────────────── */

async function _upsertInventory(productId, qty, allowBackorder) {
  await bvoPool.query(`
    INSERT INTO inventory (product_id, qty_on_hand, allow_backorder)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE qty_on_hand=VALUES(qty_on_hand), allow_backorder=VALUES(allow_backorder)
  `, [productId, qty || 0, allowBackorder ? 1 : 0]);
}

async function _saveSpecs(productId, specs) {
  if (!Array.isArray(specs)) return;
  await bvoPool.query('DELETE FROM product_attribute_values WHERE product_id = ?', [productId]);
  for (const s of specs) {
    if (!s.key) continue;
    await bvoPool.query(
      'INSERT INTO product_attribute_values (product_id, attr_key, value_text, value_num) VALUES (?, ?, ?, ?)',
      [productId, s.key, s.text || null, s.num != null ? s.num : null]
    );
  }
}

/* ════════════════════════════════════════════════════════════════
   ORDERS
   ════════════════════════════════════════════════════════════════ */

const ORDER_STATUSES = ['pending','processing','shipped','delivered','cancelled'];

exports.orderList = async (req, res, next) => {
  try {
    const status = ORDER_STATUSES.includes(req.query.status) ? req.query.status : '';
    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const offset = (page - 1) * PER_PAGE;

    const where  = status ? 'WHERE o.status = ?' : '';
    const params = status ? [status] : [];

    const countRow = await safeQueryOne(
      `SELECT COUNT(*) AS n FROM orders o ${where}`, params
    );
    const total = countRow?.n ?? 0;
    const pages = Math.ceil(total / PER_PAGE);

    const orders = await safeQuery(
      `SELECT o.id, o.order_number, o.status, o.total, o.created_at,
              CONCAT(c.first_name,' ',c.last_name) AS customer_name, c.email,
              COUNT(oi.id) AS item_count
       FROM orders o
       LEFT JOIN customers c  ON c.id = o.customer_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${where}
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, PER_PAGE, offset]
    );

    res.render('pages/admin/orders', {
      ...LAYOUT,
      pageTitle:  'Orders | BVO Admin',
      activePage: 'orders',
      flash:      req.session.flash || null,
      orders,
      statuses:   ORDER_STATUSES,
      status,
      total,
      page,
      pages,
    });
    delete req.session.flash;
  } catch (err) { next(err); }
};

exports.orderUpdateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (ORDER_STATUSES.includes(status)) {
      await bvoPool.query(
        'UPDATE orders SET status=?, updated_at=NOW() WHERE id=?',
        [status, req.params.id]
      ).catch(() => {});
    }
    req.session.flash = { type: 'success', msg: `Order status updated to "${status}".` };
    res.redirect('/admin/orders');
  } catch (err) { next(err); }
};

/* ════════════════════════════════════════════════════════════════
   THEME EDITOR
   ════════════════════════════════════════════════════════════════ */

exports.themeEditor = (req, res) => {
  res.render('pages/admin/theme', {
    ...LAYOUT,
    pageTitle:  'Theme Editor | BVO Admin',
    activePage: 'theme',
    flash:      req.session.flash || null,
    ts:         themeSettings.get(),
  });
  delete req.session.flash;
};

exports.themeSave = (req, res) => {
  try {
    const settings = _buildSettingsFromBody(req.body);
    _persistSettings(settings);
    themeSettings.reload();
    req.session.flash = { type: 'success', msg: 'Theme settings saved.' };
    res.redirect('/admin/theme');
  } catch (err) {
    req.session.flash = { type: 'error', msg: 'Save failed: ' + err.message };
    res.redirect('/admin/theme');
  }
};

/* ── Shared helpers for theme save ──────────────────────────── */
function _buildSettingsFromBody(body) {
  const navLinks      = _extractIndexedArray(body, 'nav.links',               ['label','url','highlight']);
  const shopLinks     = _extractIndexedArray(body, 'footer.col_shop_links',   ['label','url']);
  const helpLinks     = _extractIndexedArray(body, 'footer.col_help_links',   ['label','url']);
  const companyLinks  = _extractIndexedArray(body, 'footer.col_company_links',['label','url']);
  const brandLogos    = _extractIndexedArray(body, 'brand_logos.logos',       ['name','image_url','url']);
  const tickerItems   = _extractIndexedArray(body, 'scrolling_ticker.items',  ['text']);
  const testimonials  = _extractIndexedArray(body, 'testimonials.items',      ['text','author','location','rating']);

  const ARRAY_PREFIXES = ['nav.links[','footer.col_shop_links[','footer.col_help_links[',
                          'footer.col_company_links[','brand_logos.logos[',
                          'scrolling_ticker.items[','testimonials.items[',
                          'homepage_section_order'];
  const flat = {};
  for (const [k, v] of Object.entries(body)) {
    if (!ARRAY_PREFIXES.some(p => k.startsWith(p))) flat[k] = v;
  }

  // Handle section order
  let sectionOrder = null;
  if (body.homepage_section_order) {
    try { sectionOrder = JSON.parse(body.homepage_section_order); } catch(e) {}
  }

  const settings = themeSettings.save(flat);
  settings.nav.links                = navLinks;
  if (!settings.footer)         settings.footer         = {};
  if (!settings.brand_logos)    settings.brand_logos    = {};
  if (!settings.testimonials)   settings.testimonials   = {};
  if (!settings.scrolling_ticker) settings.scrolling_ticker = {};
  settings.footer.col_shop_links    = shopLinks;
  settings.footer.col_help_links    = helpLinks;
  settings.footer.col_company_links = companyLinks;
  settings.brand_logos.logos        = brandLogos;
  settings.scrolling_ticker.items   = tickerItems.map(t => t.text || '');
  settings.testimonials.items       = testimonials;
  if (sectionOrder) settings.homepage_section_order = sectionOrder;

  return settings;
}

function _persistSettings(settings) {
  const p = path.join(__dirname, '../../data/theme_settings.json');
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(settings, null, 2), 'utf8');
}

function _extractIndexedArray(body, prefix, fields) {
  const result = [];
  let i = 0;
  while (body[`${prefix}[${i}].${fields[0]}`] !== undefined) {
    const item = {};
    for (const f of fields) {
      let raw = body[`${prefix}[${i}].${f}`];
      // Handle checkbox+hidden pattern: body sends ['false','true'] when checked
      if (Array.isArray(raw)) raw = raw[raw.length - 1];
      item[f] = (raw === 'true') ? true : (raw === 'false') ? false : (raw || '');
    }
    result.push(item);
    i++;
  }
  return result;
}

/* ════════════════════════════════════════════════════════════════
   THEME PREVIEW (live split-screen)
   ════════════════════════════════════════════════════════════════ */

/**
 * POST /admin/theme/preview
 * Saves settings to disk and responds with { ok: true }.
 * Called by the live editor on every debounced field change.
 */
exports.themeSavePreview = (req, res) => {
  try {
    const settings = _buildSettingsFromBody(req.body);
    _persistSettings(settings);
    themeSettings.reload();
    req.session.tePreviewSettings = settings;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

/**
 * POST /admin/theme/reorder
 * Saves homepage_section_order only (from sidebar drag-drop).
 */
exports.themeSaveOrder = (req, res) => {
  try {
    let order = req.body.order;
    if (typeof order === 'string') {
      try { order = JSON.parse(order); } catch(e) { order = null; }
    }
    if (!Array.isArray(order)) return res.status(400).json({ ok: false, error: 'Invalid order' });
    const settings = themeSettings.get();
    settings.homepage_section_order = order;
    _persistSettings(settings);
    themeSettings.reload();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

/* ════════════════════════════════════════════════════════════════
   IMAGE UPLOAD
   ════════════════════════════════════════════════════════════════ */

exports.uploadMiddleware = _upload.single('image');

exports.uploadImage = (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file received' });
  const url = `/images/uploads/${req.file.filename}`;
  res.json({ ok: true, url });
};

/* ════════════════════════════════════════════════════════════════
   RFLPOS SYNC
   ════════════════════════════════════════════════════════════════ */

/* GET /admin/sync/probe — diagnostic: test PHP proxy from Node.js */
exports.syncProbe = async (req, res) => {
  const https = require('https');
  const token  = process.env.BVO_SYNC_TOKEN || '';
  const base   = process.env.BVO_SYNC_URL || 'https://rflpos.com/bvo_sync.php';

  // Show which env vars are present (masks passwords)
  const env = {
    BVO_SYNC_TOKEN:   token ? `(set, ${token.length} chars)` : '*** NOT SET ***',
    BVO_SYNC_URL:     process.env.BVO_SYNC_URL || '(using default)',
    DB_HOST:          process.env.DB_HOST  || '(not set)',
    DB_NAME:          process.env.DB_NAME  || '(not set)',
    DB_USER:          process.env.DB_USER  || '(not set)',
    DB_PASS:          process.env.DB_PASS  ? '(set)' : '(not set)',
    RFLPOS_DB_NAME:   process.env.RFLPOS_DB_NAME  || '(not set)',
    RFLPOS_DB_HOST:   process.env.RFLPOS_DB_HOST  || '(not set)',
    RFLPOS_DB_USER:   process.env.RFLPOS_DB_USER  || '(not set)',
    RFLPOS_DB_PASS:   process.env.RFLPOS_DB_PASS  ? '(set)' : '(not set)',
    RFLPOS_DB_SOCKET: process.env.RFLPOS_DB_SOCKET || '(not set)',
  };

  function fetchUrl(url) {
    return new Promise((resolve) => {
      const r = https.get(url, { rejectUnauthorized: false }, (resp) => {
        let raw = '';
        resp.on('data', c => { raw += c; });
        resp.on('end', () => resolve({ status: resp.statusCode, body: raw.slice(0, 600) }));
      });
      r.on('error', e => resolve({ status: 'NET_ERROR', body: e.message }));
      r.setTimeout(12000, () => { r.destroy(); resolve({ status: 'TIMEOUT', body: 'no response in 12s' }); });
    });
  }

  const brandsUrl   = `${base}?token=${encodeURIComponent(token)}&action=brands`;
  const productsUrl = `${base}?token=${encodeURIComponent(token)}&action=products&brands=628,26,44`;

  const [br, pr] = await Promise.all([ fetchUrl(brandsUrl), fetchUrl(productsUrl) ]);

  res.json({
    env,
    brands:   { url: brandsUrl,   status: br.status, body: br.body },
    products: { url: productsUrl, status: pr.status, body: pr.body.slice(0, 300) },
  });
};

/* GET /admin/sync */
exports.syncPage = async (req, res) => {
  try {
    const [totalRow]   = await safeQuery(
      `SELECT COUNT(*) AS cnt FROM products WHERE source_flag='rflpos'`
    );
    const [liveRow]    = await safeQuery(
      `SELECT COUNT(*) AS cnt FROM products WHERE source_flag='rflpos' AND is_active=1`
    );
    const [pendingRow] = await safeQuery(
      `SELECT COUNT(*) AS cnt FROM products WHERE source_flag='rflpos' AND is_active=0`
    );
    const [lastLog]    = await safeQuery(
      `SELECT started_at FROM rflpos_sync_log WHERE sync_type='product' ORDER BY id DESC LIMIT 1`
    );

    const pending = await bvoPool.query(`
      SELECT p.id, p.name, p.sku, p.price, p.brand,
             pi.url AS primary_image_url,
             c.name AS category_name,
             i.qty_on_hand AS stock_qty
      FROM products p
      LEFT JOIN categories c     ON p.category_id  = c.id
      LEFT JOIN inventory  i     ON i.product_id   = p.id
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
      WHERE p.source_flag='rflpos' AND p.is_active=0
      ORDER BY p.brand, p.name
      LIMIT 200
    `).then(([rows]) => rows).catch(() => []);

    const logs = await bvoPool.query(
      `SELECT * FROM rflpos_sync_log WHERE sync_type='product' ORDER BY id DESC LIMIT 10`
    ).then(([rows]) => rows).catch(() => []);

    // Load RFLPOS brand list for the brand filter UI (non-fatal if not connected yet)
    let rflBrands = [];
    try { rflBrands = await rflposSync.getRflBrands(); } catch {}

    res.render('pages/admin/sync', {
      layout:   'layouts/admin',
      pageTitle: 'RFLPOS Sync | BVO Admin',
      activePage: 'sync',
      flash: req.session.syncFlash || null,
      stats: {
        total:    totalRow?.cnt   || 0,
        live:     liveRow?.cnt    || 0,
        pending:  pendingRow?.cnt || 0,
        lastSync: lastLog?.started_at
                    ? new Date(lastLog.started_at).toLocaleString()
                    : null,
      },
      pending,
      logs,
      rflBrands,
      syncSettings: syncSettings.get(),
    });
    delete req.session.syncFlash;
  } catch (err) {
    console.error('[SYNC PAGE]', err);
    res.status(500).send('Error loading sync page');
  }
};

/* POST /admin/sync/run */
exports.syncRun = async (req, res) => {
  try {
    const result = await rflposSync.syncProducts();
    // If autoApprove is on, activate all newly synced products
    if (syncSettings.get().autoApprove) {
      await bvoPool.query(
        `UPDATE products SET is_active=1 WHERE source_flag='rflpos' AND is_active=0`
      );
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[SYNC RUN]', err);
    res.json({ ok: false, error: err.message });
  }
};

/* POST /admin/sync/approve/:id */
exports.syncApprove = async (req, res) => {
  try {
    await bvoPool.query(
      `UPDATE products SET is_active=1 WHERE id=? AND source_flag='rflpos'`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
};

/* POST /admin/sync/skip/:id */
exports.syncSkip = async (req, res) => {
  try {
    // Mark with a special status so it won't keep re-appearing after every sync
    // We set source_flag to 'rflpos_skipped' so the upsert won't re-add it as pending
    await bvoPool.query(
      `UPDATE products SET source_flag='rflpos_skipped' WHERE id=? AND source_flag='rflpos'`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
};

/* POST /admin/sync/approve-all */
exports.syncApproveAll = async (req, res) => {
  try {
    await bvoPool.query(
      `UPDATE products SET is_active=1 WHERE source_flag='rflpos' AND is_active=0`
    );
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
};

/* POST /admin/sync/settings */
exports.syncSaveSettings = (req, res) => {
  try {
    const { interval, autoApprove, allowedBrands } = req.body;
    syncSettings.save({
      interval,
      autoApprove:   !!autoApprove,
      allowedBrands: Array.isArray(allowedBrands)
                       ? allowedBrands.map(Number).filter(Boolean)
                       : [],
    });
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
};
