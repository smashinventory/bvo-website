'use strict';

const crypto         = require('crypto');
const { bvoPool }   = require('../config/database');
const Product        = require('../models/Product');
const Category       = require('../models/Category');
const themeSettings  = require('../services/themeSettings');
const rflposSync     = require('../services/rflposSync');
const syncSettings   = require('../services/syncSettings');
const { normalize: normalizeColor } = require('../config/colorFamilies');
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

/* ── Multer — document / PDF uploads ────────────────────────── */
const _docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../public/docs/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '-').toLowerCase();
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});
const _docUpload = multer({
  storage: _docStorage,
  limits:  { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const ok = /^application\/pdf$|^application\/msword|^application\/vnd\.openxmlformats|^image\//i.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Only PDF, Word doc, or image files are allowed'), false);
  },
});

/* ── helpers ────────────────────────────────────────────────────── */
const LAYOUT = { layout: 'layouts/admin' };

/* ── Image URL columns image_2_url … image_30_url (29 total) ─── */
const IMG_URL_COLS = Array.from({ length: 29 }, (_, i) => `image_${i + 2}_url`);

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

  // Timing-safe comparison — prevents timing-based user/password enumeration.
  // Buffers must be equal length for timingSafeEqual; pad-compare so length
  // difference doesn't short-circuit early (still returns false on mismatch).
  const uBuf = Buffer.from(username  || '');
  const pBuf = Buffer.from(password  || '');
  const vuBuf = Buffer.from(validUser);
  const vpBuf = Buffer.from(validPass);
  const userMatch = uBuf.length === vuBuf.length && crypto.timingSafeEqual(uBuf, vuBuf);
  const passMatch = pBuf.length === vpBuf.length && crypto.timingSafeEqual(pBuf, vpBuf);

  if (userMatch && passMatch) {
    // Regenerate session ID to prevent session fixation
    req.session.regenerate((err) => {
      if (err) {
        console.error('[admin/login] session.regenerate error:', err);
        return res.redirect('/admin/login');
      }
      req.session.isAdmin = true;
      res.redirect('/admin');
    });
    return;
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
  // Destroy the entire session (not just the isAdmin flag) so the session ID
  // can't be reused after logout.
  req.session.destroy(() => res.redirect('/admin/login'));
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
    const offset = (page - 1) * PER_PAGE;

    // ── Parse filter params ──────────────────────────────────────────
    const search     = (req.query.q || '').trim();
    const fCategory  = req.query.category_id ? parseInt(req.query.category_id) : null;
    const fBrands    = [].concat(req.query.brand  || []).filter(Boolean);
    const fIsActive  = (req.query.is_active !== undefined && req.query.is_active !== '')
                         ? parseInt(req.query.is_active) : null;
    const fStatus    = (req.query.status || '').trim() || null;
    const fSource    = (req.query.source_flag || '').trim() || null;
    const fPriceMin  = req.query.price_min ? parseFloat(req.query.price_min) : null;
    const fPriceMax  = req.query.price_max ? parseFloat(req.query.price_max) : null;
    const fInStock   = req.query.in_stock === '1';
    const sort       = req.query.sort || 'newest';

    // ── Build WHERE clause ───────────────────────────────────────────
    const clauses = [];
    const qParams = [];

    if (search) {
      clauses.push('(p.name LIKE ? OR p.sku LIKE ? OR p.brand LIKE ? OR p.vendor_sku LIKE ?)');
      const like = `%${search}%`;
      qParams.push(like, like, like, like);
    }
    if (fCategory !== null) {
      clauses.push('p.category_id = ?');
      qParams.push(fCategory);
    }
    if (fBrands.length) {
      clauses.push(`p.brand IN (${fBrands.map(() => '?').join(',')})`);
      qParams.push(...fBrands);
    }
    if (fIsActive !== null) {
      clauses.push('p.is_active = ?');
      qParams.push(fIsActive);
    }
    if (fStatus) {
      clauses.push('p.status = ?');
      qParams.push(fStatus);
    }
    if (fSource) {
      clauses.push('p.source_flag = ?');
      qParams.push(fSource);
    }
    if (fPriceMin !== null) {
      clauses.push('p.price >= ?');
      qParams.push(fPriceMin);
    }
    if (fPriceMax !== null) {
      clauses.push('p.price <= ?');
      qParams.push(fPriceMax);
    }
    if (fInStock) {
      clauses.push('(COALESCE(i.qty_on_hand, 0) > 0 OR COALESCE(i.allow_backorder, 0) = 1)');
    }

    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';

    // Sort
    const sortMap = {
      newest:     'p.id DESC',
      name_asc:   'p.name ASC',
      name_desc:  'p.name DESC',
      price_asc:  'p.price ASC',
      price_desc: 'p.price DESC',
      brand:      'p.brand ASC, p.name ASC',
      sku:        'p.sku ASC',
    };
    const orderBy = sortMap[sort] || 'p.id DESC';

    // Count + data
    const countRow = await safeQueryOne(
      `SELECT COUNT(*) AS n FROM products p LEFT JOIN inventory i ON i.product_id=p.id ${where}`,
      qParams
    );
    const total = countRow?.n ?? 0;
    const pages = Math.ceil(total / PER_PAGE) || 1;

    const products = await safeQuery(
      `SELECT p.id, p.name, p.slug, p.sku, p.vendor_sku, p.brand, p.price, p.compare_price,
              p.is_active, p.source_flag, p.status, p.product_type,
              COALESCE(i.qty_on_hand, 0) AS qty_on_hand,
              c.name AS category_name,
              (SELECT url FROM product_images WHERE product_id=p.id
               ORDER BY is_primary DESC, sort_order ASC LIMIT 1) AS thumb
       FROM products p
       LEFT JOIN categories c  ON c.id = p.category_id
       LEFT JOIN inventory  i  ON i.product_id = p.id
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...qParams, PER_PAGE, offset]
    );

    // Pre-fetch data for filter sidebar
    const [categories, brandRows] = await Promise.all([
      Category.findAll(),
      safeQuery('SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL ORDER BY brand'),
    ]);
    const allBrands = brandRows.map(r => r.brand).filter(Boolean);

    const filters = {
      q: search, category_id: fCategory, brands: fBrands,
      is_active: fIsActive, status: fStatus, source_flag: fSource,
      price_min: fPriceMin, price_max: fPriceMax, in_stock: fInStock, sort,
    };
    const hasFilters = !!(search || fCategory || fBrands.length || fIsActive !== null ||
                         fStatus || fSource || fPriceMin || fPriceMax || fInStock);

    res.render('pages/admin/products', {
      ...LAYOUT,
      pageTitle: 'Products | BVO Admin',
      activePage: 'products',
      flash:     req.session.flash || null,
      products,
      categories,
      allBrands,
      filters,
      hasFilters,
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
      productDocs:   [],
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

    const [categories, productImages, productAttrs, inventoryRow, productDocs] = await Promise.all([
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
        'SELECT qty_on_hand, qty_reserved, allow_backorder, reorder_point FROM inventory WHERE product_id = ?',
        [product.id]
      ),
      safeQuery(
        'SELECT * FROM product_documents WHERE product_id = ? ORDER BY sort_order ASC, id ASC',
        [product.id]
      ),
    ]);

    product.qty_on_hand     = inventoryRow?.qty_on_hand     ?? 0;
    product.qty_reserved    = inventoryRow?.qty_reserved    ?? 0;
    product.allow_backorder  = inventoryRow?.allow_backorder  ?? 0;
    product.reorder_point   = inventoryRow?.reorder_point   ?? 0;

    res.render('pages/admin/product-edit', {
      ...LAYOUT,
      pageTitle:   `Edit: ${product.name} | BVO Admin`,
      activePage:  'products',
      flash:       req.session.flash || null,
      product,
      categories,
      productImages,
      productAttrs,
      productDocs,
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
          product_type, vendor_sku, upc, mpn, component_role, vendor_group_id,
          short_desc, long_desc, warranty,
          price, compare_price, cost,
          width_in, depth_in, height_in, weight_lbs,
          total_ship_weight_lbs, ships_ltl, freight_class, harmonized_code, lead_time_days,
          country_origin, prop65, release_date, status,
          is_active, is_featured, is_new,
          sort_order, primary_image_url,
          ${IMG_URL_COLS.join(', ')},
          meta_title, meta_desc,
          google_product_category, google_condition, color, material, pattern,
          age_group, gender, shipping_label,
          custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4,
          excluded_destinations, ads_redirect, identifier_exists,
          model, color_family,
          source_flag)
       VALUES (?,?,?,?,?, ?,?,?,?,?,?, ?,?,?, ?,?,?, ?,?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?, ?,?, ${IMG_URL_COLS.map(() => '?').join(', ')}, ?,?, ?,?,?,?,?, ?,?,?, ?,?,?,?,?, ?,?,?,?,?,'manual')`,
      [sku, d.slug, d.name, d.brand, d.category_id,
       d.product_type, d.vendor_sku, d.upc, d.mpn, d.component_role, d.vendor_group_id,
       d.short_desc, d.long_desc, d.warranty,
       d.price, d.compare_price, d.cost,
       d.width_in, d.depth_in, d.height_in, d.weight_lbs,
       d.total_ship_weight_lbs, d.ships_ltl, d.freight_class, d.harmonized_code, d.lead_time_days,
       d.country_origin, d.prop65, d.release_date, d.status,
       d.is_active, d.is_featured, d.is_new,
       d.sort_order, d.primary_image_url,
       ...IMG_URL_COLS.map(c => d[c]),
       d.meta_title, d.meta_desc,
       d.google_product_category, d.google_condition, d.color, d.material, d.pattern,
       d.age_group, d.gender, d.shipping_label,
       d.custom_label_0, d.custom_label_1, d.custom_label_2, d.custom_label_3, d.custom_label_4,
       d.excluded_destinations, d.ads_redirect, d.identifier_exists,
       d.model, d.color_family]
    );
    const productId = ins.insertId;
    await _upsertInventory(productId, d.qty_on_hand, d.allow_backorder, d.reorder_point);
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
         product_type=?, vendor_sku=?, upc=?, mpn=?, component_role=?, vendor_group_id=?,
         short_desc=?, long_desc=?, warranty=?,
         price=?, compare_price=?, cost=?,
         width_in=?, depth_in=?, height_in=?, weight_lbs=?,
         total_ship_weight_lbs=?, ships_ltl=?, freight_class=?, harmonized_code=?, lead_time_days=?,
         country_origin=?, prop65=?, release_date=?, status=?,
         is_active=?, is_featured=?, is_new=?,
         sort_order=?, primary_image_url=?,
         ${IMG_URL_COLS.map(c => `${c}=?`).join(', ')},
         meta_title=?, meta_desc=?,
         google_product_category=?, google_condition=?, color=?, material=?, pattern=?,
         age_group=?, gender=?, shipping_label=?,
         custom_label_0=?, custom_label_1=?, custom_label_2=?, custom_label_3=?, custom_label_4=?,
         excluded_destinations=?, ads_redirect=?, identifier_exists=?,
         model=?, color_family=?,
         updated_at=NOW()
       WHERE id=?`,
      [d.name, d.slug, d.sku, d.brand, d.category_id,
       d.product_type, d.vendor_sku, d.upc, d.mpn, d.component_role, d.vendor_group_id,
       d.short_desc, d.long_desc, d.warranty,
       d.price, d.compare_price, d.cost,
       d.width_in, d.depth_in, d.height_in, d.weight_lbs,
       d.total_ship_weight_lbs, d.ships_ltl, d.freight_class, d.harmonized_code, d.lead_time_days,
       d.country_origin, d.prop65, d.release_date, d.status,
       d.is_active, d.is_featured, d.is_new,
       d.sort_order, d.primary_image_url,
       ...IMG_URL_COLS.map(c => d[c]),
       d.meta_title, d.meta_desc,
       d.google_product_category, d.google_condition, d.color, d.material, d.pattern,
       d.age_group, d.gender, d.shipping_label,
       d.custom_label_0, d.custom_label_1, d.custom_label_2, d.custom_label_3, d.custom_label_4,
       d.excluded_destinations, d.ads_redirect, d.identifier_exists,
       d.model, d.color_family,
       id]
    );
    await _upsertInventory(id, d.qty_on_hand, d.allow_backorder, d.reorder_point);
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

/* POST /admin/products/bulk — bulk actions on selected product IDs */
exports.productBulkAction = async (req, res, next) => {
  try {
    const { action } = req.body;
    const ids = [].concat(req.body.ids || []).map(n => parseInt(n)).filter(n => n > 0);

    if (!ids.length) {
      req.session.flash = { type: 'error', msg: 'No products selected.' };
      return res.redirect('/admin/products');
    }

    const ph = ids.map(() => '?').join(',');

    if (action === 'activate') {
      await bvoPool.query(`UPDATE products SET is_active=1, updated_at=NOW() WHERE id IN (${ph})`, ids);
      req.session.flash = { type: 'success', msg: `${ids.length} product(s) activated.` };
      return res.redirect('back');
    }

    if (action === 'deactivate') {
      await bvoPool.query(`UPDATE products SET is_active=0, updated_at=NOW() WHERE id IN (${ph})`, ids);
      req.session.flash = { type: 'success', msg: `${ids.length} product(s) deactivated.` };
      return res.redirect('back');
    }

    if (action === 'delete') {
      await bvoPool.query(`DELETE FROM products WHERE id IN (${ph})`, ids);
      req.session.flash = { type: 'success', msg: `${ids.length} product(s) deleted.` };
      return res.redirect('/admin/products');
    }

    if (action === 'export') {
      return _buildAndSendCSV(res, ids, next);
    }

    req.session.flash = { type: 'error', msg: `Unknown action: ${action}` };
    res.redirect('/admin/products');
  } catch (err) { next(err); }
};

/* ── Product image management ────────────────────────────────────── */
/* All handlers return JSON — called via fetch() from the product edit page.
   Nested <form> elements inside productForm are invalid HTML (browsers ignore
   them), so all image actions use AJAX instead. */

exports.productAddImageMiddleware = (req, res, next) => {
  _upload.single('image_file')(req, res, (err) => {
    if (err) {
      console.error('[Product Upload] multer error:', err.message);
      return res.status(400).json({ ok: false, error: err.message });
    }
    next();
  });
};

exports.productAddImage = async (req, res) => {
  try {
    const id = req.params.id;
    if (!req.file) return res.status(400).json({ ok: false, error: 'No image file received.' });
    const url = `/images/uploads/${req.file.filename}`;
    const [[{ cnt }]] = await bvoPool.query(
      'SELECT COUNT(*) AS cnt FROM product_images WHERE product_id = ? AND is_primary = 1', [id]
    );
    const isPrimary = cnt === 0 ? 1 : 0;
    // Get current max sort_order so new image goes to end (falls back if column absent)
    let sortOrder = 0;
    try {
      const [[{ maxSort }]] = await bvoPool.query(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS maxSort FROM product_images WHERE product_id = ?', [id]
      );
      sortOrder = maxSort || 0;
    } catch (_) { /* sort_order column may not exist yet — ignore */ }
    let result;
    try {
      [result] = await bvoPool.query(
        'INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, ?)',
        [id, url, req.body.alt_text || '', sortOrder, isPrimary]
      );
    } catch (e) {
      // Fallback: insert without sort_order if column doesn't exist
      if (e.code === 'ER_BAD_FIELD_ERROR') {
        [result] = await bvoPool.query(
          'INSERT INTO product_images (product_id, url, alt_text, is_primary) VALUES (?, ?, ?, ?)',
          [id, url, req.body.alt_text || '', isPrimary]
        );
      } else { throw e; }
    }
    res.json({ ok: true, url, imgId: result.insertId, isPrimary });
  } catch (err) {
    console.error('[productAddImage] error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.productDeleteImage = async (req, res) => {
  try {
    const { id, imgId } = req.params;
    await bvoPool.query('DELETE FROM product_images WHERE id = ? AND product_id = ?', [imgId, id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[productDeleteImage] error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.productSetPrimaryImage = async (req, res) => {
  try {
    const { id, imgId } = req.params;
    await bvoPool.query('UPDATE product_images SET is_primary = 0 WHERE product_id = ?', [id]);
    await bvoPool.query('UPDATE product_images SET is_primary = 1 WHERE id = ? AND product_id = ?', [imgId, id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[productSetPrimaryImage] error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
};

exports.productReorderImages = async (req, res) => {
  try {
    const { id } = req.params;
    const order = req.body.order;
    if (!Array.isArray(order)) return res.status(400).json({ ok: false, error: 'order must be an array' });
    await Promise.all(
      order.map((imgId, idx) =>
        bvoPool.query(
          'UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ?',
          [idx, imgId, id]
        )
      )
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[productReorderImages] error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
};

/* ── CSV Export / Import ─────────────────────────────────────────── */

// Attribute keys included in the CSV — matches our filter definitions + JM spreadsheet fields
const CSV_ATTR_KEYS = [
  // Core / universal
  // 'size_in' removed — Audit Fix #2 (July 2026). Width is products.width_in (Rule 10); no EAV key.
  'product_type', 'height_in', 'depth_in',
  'cabinet_finish', 'finish', 'hardware_finish', 'style', 'mount_type',
  'sink_count', 'sink_included', 'countertop_material', 'countertop_included',
  'mirror_included', 'door_style', 'drawer_count', 'sink_type', 'faucet_holes',
  'faucet_spread_in', 'weight_lbs',
  // JM-specific feature flags
  'soft_close_hinges', 'soft_close_slides', 'backsplash_included',
  'wireless_charging', 'freepower_compatible', 'ada_compliant',
  'adjustable_shelves', 'assembly_required', 'has_electrical',
  // JM-specific descriptive specs
  'bowl_shape', 'distressed_finish', 'countertop_finish', 'countertop_thickness',
  'primary_material', 'construction_material',
  'sink_material', 'sink_installation', 'sink_overflow', 'drain_included',
  'sink_width_in', 'sink_depth_in', 'sink_basin_depth_in',
  'backsplash_material', 'drawer_organizer',
  'num_doors', 'num_shelves', 'drawer_count', 'tip_out_drawers',
  'has_makeup_counter',
  'vanity_type', 'substitute_sku',
  'wireless_charging_fc_certified', 'wireless_charging_ul',
];
// Keys stored as numeric values
const NUMERIC_ATTR_KEYS = new Set([
  'size_in', 'height_in', 'depth_in', 'weight_lbs',
  'sink_count', 'drawer_count', 'faucet_holes', 'faucet_spread_in',
  'num_doors', 'num_shelves', 'tip_out_drawers',
  'sink_width_in', 'sink_depth_in', 'sink_basin_depth_in',
]);
// Numeric keys that also need value_text for checkbox filtering (all NUMERIC_ATTR_KEYS except size_in which uses range)
const NUMERIC_CHECKBOX_KEYS = new Set(['sink_count', 'drawer_count', 'faucet_holes']);

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

/* GET /admin/products/export.csv — optionally ?ids=1,2,3 for a subset */
exports.productExport = (req, res, next) => {
  const ids = req.query.ids
    ? req.query.ids.split(',').map(Number).filter(Boolean)
    : null;
  return _buildAndSendCSV(res, ids, next);
};

/* Private: build CSV and stream to response. ids=null → all products */
async function _buildAndSendCSV(res, ids, next) {
  try {
    const attrSelects = CSV_ATTR_KEYS.map(k => {
      const col = NUMERIC_ATTR_KEYS.has(k)
        ? `(SELECT value_num  FROM product_attribute_values WHERE product_id=p.id AND attr_key=${bvoPool.escape(k)} LIMIT 1) AS ${bvoPool.escapeId('attr_' + k)}`
        : `(SELECT value_text FROM product_attribute_values WHERE product_id=p.id AND attr_key=${bvoPool.escape(k)} LIMIT 1) AS ${bvoPool.escapeId('attr_' + k)}`;
      return col;
    }).join(',\n  ');

    const idFilter = (ids && ids.length)
      ? `WHERE p.id IN (${ids.map(() => '?').join(',')})`
      : '';

    // Per-product document subqueries (one per doc_type)
    const DOC_TYPES = ['spec_sheet','installation_guide','warranty','rebate_form',
                       'cad_drawing','measurement_guide','care_guide'];
    const docSelects = DOC_TYPES.map(t =>
      `(SELECT url FROM product_documents WHERE product_id=p.id AND doc_type=${bvoPool.escape(t)} ORDER BY id LIMIT 1) AS ${bvoPool.escapeId('doc_' + t)}`
    ).join(',\n  ');

    const [rows] = await bvoPool.query(`
      SELECT
        p.name, p.sku, p.brand, p.product_type,
        c.slug AS category_slug,
        p.vendor_sku, p.upc, p.mpn, p.component_role, p.vendor_group_id,
        p.price, p.compare_price, p.cost,
        p.short_desc, p.long_desc, p.warranty,
        p.width_in, p.depth_in, p.height_in, p.weight_lbs,
        p.total_ship_weight_lbs, p.ships_ltl, p.freight_class,
        p.harmonized_code, p.lead_time_days,
        p.country_origin, p.prop65, p.release_date,
        p.status, p.is_active, p.is_featured, p.is_new,
        p.sort_order,
        p.primary_image_url, p.image_2_url, p.image_3_url, p.image_4_url,
        p.image_5_url, p.image_6_url, p.image_7_url,
        COALESCE(i.qty_on_hand, 0)     AS qty_on_hand,
        COALESCE(i.allow_backorder, 0)  AS allow_backorder,
        COALESCE(i.reorder_point, 0)    AS reorder_point,
        p.meta_title, p.meta_desc,
        (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=1 LIMIT 1) AS image_url,
        p.google_product_category, p.google_condition, p.color, p.material, p.pattern,
        p.age_group, p.gender, p.shipping_label,
        p.custom_label_0, p.custom_label_1, p.custom_label_2, p.custom_label_3, p.custom_label_4,
        p.excluded_destinations, p.ads_redirect, p.identifier_exists,
        p.model, p.color_family,
        ${attrSelects},
        ${docSelects}
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN inventory  i ON i.product_id = p.id
      ${idFilter}
      ORDER BY p.brand, p.name
    `, ids || []);

    const headers = [
      'name','sku','brand','product_type','category_slug',
      'vendor_sku','upc','mpn','component_role','vendor_group_id',
      'price','compare_price','cost',
      'short_desc','long_desc','warranty',
      'width_in','depth_in','height_in','weight_lbs',
      'total_ship_weight_lbs','ships_ltl','freight_class',
      'harmonized_code','lead_time_days',
      'country_origin','prop65','release_date',
      'status','is_active','is_featured','is_new',
      'sort_order',
      'primary_image_url','image_2_url','image_3_url','image_4_url',
      'image_5_url','image_6_url','image_7_url',
      'qty_on_hand','allow_backorder','reorder_point',
      'meta_title','meta_desc','image_url',
      'google_product_category','google_condition','color','material','pattern',
      'age_group','gender','shipping_label',
      'custom_label_0','custom_label_1','custom_label_2','custom_label_3','custom_label_4',
      'excluded_destinations','ads_redirect','identifier_exists',
      'model','color_family',
      ...CSV_ATTR_KEYS.map(k => `attr_${k}`),
      ...DOC_TYPES.map(t => `doc_${t}`),
    ];

    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(_csvRow(headers.map(h => r[h] ?? '')));
    }

    const label = (ids && ids.length) ? `bvo-selected-${ids.length}` : 'bvo-products';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition',
      `attachment; filename="${label}-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(lines.join('\r\n'));
  } catch (err) { next(err); }
}

/* POST /admin/products/import  (multipart — uses multer .single('csv_file')) */
exports.productImportMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('csv_file');

/**
 * RFC 4180–compliant CSV parser.
 * Single-pass char-by-char over the full text — correctly handles
 * quoted fields that contain commas, newlines (\r\n or \n), and
 * escaped double-quotes ("").  Returns an array of string arrays.
 */
function _parseCSV(text) {
  // Normalise line endings inside the raw text but do NOT split yet —
  // we need to span across newlines that are inside quoted fields.
  const src  = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let cells  = [];
  let cur    = '';
  let inQ    = false;
  let i      = 0;

  while (i < src.length) {
    const ch   = src[i];
    const next = src[i + 1];

    if (inQ) {
      if (ch === '"' && next === '"') {
        // Escaped quote → literal "
        cur += '"';
        i += 2;
      } else if (ch === '"') {
        // Close quote
        inQ = false;
        i++;
      } else {
        cur += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQ = true;
        i++;
      } else if (ch === ',') {
        cells.push(cur);
        cur = '';
        i++;
      } else if (ch === '\n') {
        // End of record — push last field and flush row
        cells.push(cur);
        cur = '';
        // Only keep rows that have at least one non-empty cell
        if (cells.some(c => c !== '')) rows.push(cells);
        cells = [];
        i++;
      } else {
        cur += ch;
        i++;
      }
    }
  }

  // Final field / row (file may not end with \n)
  cells.push(cur);
  if (cells.some(c => c !== '')) rows.push(cells);

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
        // ── Parse all columns from CSV row
        const g     = (k) => get(row, k) || null;
        const gNum  = (k) => { const v = get(row, k); const n = parseFloat(v); return (!isNaN(n) && v) ? n : null; };
        const gInt  = (k) => { const v = get(row, k); const n = parseInt(v);   return (!isNaN(n) && v) ? n : null; };
        const gBool = (k, def = 0) => get(row, k) === '1' ? 1 : (get(row, k) === '0' ? 0 : def);

        const sku                  = g('sku')         || `IMPORT-${Date.now()}`;
        const brand                = g('brand');
        const catSlug              = get(row, 'category_slug');
        const category_id          = catMap[catSlug] || null;
        const product_type         = g('product_type');
        const vendor_sku           = g('vendor_sku');
        const upc                  = g('upc');
        const mpn                  = g('mpn');
        const component_role       = g('component_role');
        const vendor_group_id      = g('vendor_group_id');
        const price                = gNum('price')         || 0;
        const compare_price        = gNum('compare_price');
        const cost                 = gNum('cost');
        const short_desc           = g('short_desc');
        const long_desc            = g('long_desc');
        const warranty             = g('warranty');
        const width_in             = gNum('width_in');
        const depth_in             = gNum('depth_in');
        const height_in            = gNum('height_in');
        const weight_lbs           = gNum('weight_lbs');
        const total_ship_weight    = gNum('total_ship_weight_lbs');
        const ships_ltl            = gBool('ships_ltl');
        const freight_class        = g('freight_class');
        const harmonized_code      = g('harmonized_code');
        const lead_time_days       = gInt('lead_time_days');
        const country_origin       = g('country_origin');
        const prop65               = gBool('prop65');
        const release_date         = g('release_date');
        const status               = g('status') || 'active';
        const is_active            = gBool('is_active', 1);
        const is_featured          = gBool('is_featured');
        const is_new               = gBool('is_new');
        const sort_order           = gInt('sort_order') || 0;
        const primary_image_url    = g('primary_image_url');
        const imgUrls = Object.fromEntries(IMG_URL_COLS.map(c => [c, g(c)]));
        const qty_on_hand          = gInt('qty_on_hand') || 0;
        const allow_back           = gBool('allow_backorder');
        const reorder_point        = gInt('reorder_point') || 0;
        const meta_title           = g('meta_title');
        const meta_desc            = g('meta_desc');
        const image_url            = g('image_url');
        // GMC fields
        const google_product_category = g('google_product_category');
        const rawCond = get(row, 'google_condition');
        const google_condition     = ['new','refurbished','used'].includes(rawCond) ? rawCond : 'new';
        const color                = g('color');
        const material             = g('material');
        const pattern              = g('pattern');
        const rawAG = get(row, 'age_group');
        const age_group            = ['newborn','infant','toddler','kids','adult','all ages'].includes(rawAG) ? rawAG : null;
        const rawGen = get(row, 'gender');
        const gender               = ['male','female','unisex'].includes(rawGen) ? rawGen : null;
        const shipping_label       = g('shipping_label');
        const custom_label_0       = g('custom_label_0');
        const custom_label_1       = g('custom_label_1');
        const custom_label_2       = g('custom_label_2');
        const custom_label_3       = g('custom_label_3');
        const custom_label_4       = g('custom_label_4');
        const excluded_destinations = g('excluded_destinations');
        const ads_redirect         = g('ads_redirect');
        const identifier_exists    = get(row,'identifier_exists') === '0' ? 0 : 1;
        const model                = g('model');
        // color_family: use CSV value if provided, otherwise derive from color via normalize()
        const color_family         = g('color_family') || normalizeColor(color) || null;
        // Document URLs from CSV
        const docTypes = ['spec_sheet','installation_guide','warranty','rebate_form',
                          'cad_drawing','measurement_guide','care_guide'];
        const docUrls  = {};
        for (const t of docTypes) { docUrls[t] = g(`doc_${t}`); }

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
               name=?, brand=?, category_id=?,
               product_type=?, vendor_sku=?, upc=?, mpn=?, component_role=?, vendor_group_id=?,
               short_desc=?, long_desc=?, warranty=?,
               price=?, compare_price=?, cost=?,
               width_in=?, depth_in=?, height_in=?, weight_lbs=?,
               total_ship_weight_lbs=?, ships_ltl=?, freight_class=?, harmonized_code=?, lead_time_days=?,
               country_origin=?, prop65=?, release_date=?, status=?,
               is_active=?, is_featured=?, is_new=?,
               sort_order=?, primary_image_url=?,
               ${IMG_URL_COLS.map(c => `${c}=?`).join(', ')},
               meta_title=?, meta_desc=?,
               google_product_category=?, google_condition=?, color=?, material=?, pattern=?,
               age_group=?, gender=?, shipping_label=?,
               custom_label_0=?, custom_label_1=?, custom_label_2=?, custom_label_3=?, custom_label_4=?,
               excluded_destinations=?, ads_redirect=?, identifier_exists=?,
               model=?, color_family=?,
               updated_at=NOW()
             WHERE id=?`,
            [name, brand, category_id,
             product_type, vendor_sku, upc, mpn, component_role, vendor_group_id,
             short_desc, long_desc, warranty,
             price, compare_price, cost,
             width_in, depth_in, height_in, weight_lbs,
             total_ship_weight, ships_ltl, freight_class, harmonized_code, lead_time_days,
             country_origin, prop65, release_date, status,
             is_active, is_featured, is_new,
             sort_order, primary_image_url,
             ...IMG_URL_COLS.map(c => imgUrls[c]),
             meta_title, meta_desc,
             google_product_category, google_condition, color, material, pattern,
             age_group, gender, shipping_label,
             custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4,
             excluded_destinations, ads_redirect, identifier_exists,
             model, color_family,
             productId]
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
               (sku, slug, name, brand, category_id,
                product_type, vendor_sku, upc, mpn, component_role, vendor_group_id,
                short_desc, long_desc, warranty,
                price, compare_price, cost,
                width_in, depth_in, height_in, weight_lbs,
                total_ship_weight_lbs, ships_ltl, freight_class, harmonized_code, lead_time_days,
                country_origin, prop65, release_date, status,
                is_active, is_featured, is_new,
                sort_order, primary_image_url,
                ${IMG_URL_COLS.join(', ')},
                meta_title, meta_desc,
                google_product_category, google_condition, color, material, pattern,
                age_group, gender, shipping_label,
                custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4,
                excluded_destinations, ads_redirect, identifier_exists,
                model, color_family,
                source_flag)
             VALUES (?,?,?,?,?, ?,?,?,?,?,?, ?,?,?, ?,?,?, ?,?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?, ?,?, ${IMG_URL_COLS.map(() => '?').join(', ')}, ?,?, ?,?,?,?,?, ?,?,?, ?,?,?,?,?, ?,?,?,?,?,'manual')`,
            [sku, finalSlug, name, brand, category_id,
             product_type, vendor_sku, upc, mpn, component_role, vendor_group_id,
             short_desc, long_desc, warranty,
             price, compare_price, cost,
             width_in, depth_in, height_in, weight_lbs,
             total_ship_weight, ships_ltl, freight_class, harmonized_code, lead_time_days,
             country_origin, prop65, release_date, status,
             is_active, is_featured, is_new,
             sort_order, primary_image_url,
             ...IMG_URL_COLS.map(c => imgUrls[c]),
             meta_title, meta_desc,
             google_product_category, google_condition, color, material, pattern,
             age_group, gender, shipping_label,
             custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4,
             excluded_destinations, ads_redirect, identifier_exists,
             model, color_family]
          );
          productId = ins.insertId;
        }

        // Inventory
        await _upsertInventory(productId, qty_on_hand, allow_back, reorder_point);

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
            // Numeric-checkbox keys (sink_count, drawer_count, faucet_holes) need value_text populated
            // so the checkbox filter (which queries value_text IN (...)) can find them.
            // size_in uses a range filter that queries value_num, so value_text stays null there.
            text: (isNum && !NUMERIC_CHECKBOX_KEYS.has(k)) ? null : val,
            num:  isNum ? (parseFloat(val) || null) : (isNaN(parseFloat(val)) ? null : parseFloat(val)),
          });
        }
        await _saveSpecs(productId, specs);

        // Documents from CSV — upsert by (product_id, doc_type)
        for (const [docType, url] of Object.entries(docUrls)) {
          if (!url) continue;
          const [[existing]] = await bvoPool.query(
            'SELECT id FROM product_documents WHERE product_id=? AND doc_type=? LIMIT 1',
            [productId, docType]
          );
          if (existing) {
            await bvoPool.query(
              'UPDATE product_documents SET url=? WHERE id=?', [url, existing.id]
            );
          } else {
            await bvoPool.query(
              'INSERT INTO product_documents (product_id, doc_type, url, label, sort_order) VALUES (?,?,?,?,0)',
              [productId, docType, url, docType.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())]
            );
          }
        }

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

/* ── James Martin XLSX Import ────────────────────────────────────────
 * Runs server-side using the existing bvoPool — the correct approach.
 * Do NOT run importJamesMartinFeed.js as a standalone local script;
 * local .env has DB_HOST=127.0.0.1 which has no MySQL. Always trigger
 * imports via this admin route so the server's DB connection is used.
 */
const _jmImporter = require('../jobs/importJamesMartinFeed');
const _xlsxLib     = require('xlsx');

exports.productImportJMMiddleware = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // JM feed is ~10-15 MB
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xlsm)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only .xlsx files are accepted'), ok);
  },
}).single('xlsx_file');

exports.productImportJM = async (req, res, next) => {
  if (!req.file) {
    req.session.flash = { type: 'error', msg: 'No XLSX file uploaded.' };
    return res.redirect('/admin/products');
  }

  // Parse workbook synchronously (fast — just reads buffer into memory).
  let wb;
  try {
    wb = _xlsxLib.read(req.file.buffer, { cellDates: false });
  } catch (err) {
    req.session.flash = { type: 'error', msg: `Could not parse XLSX: ${err.message}` };
    return res.redirect('/admin/products');
  }

  // Respond immediately so Hostinger's nginx gateway doesn't time out (504).
  // The import runs in the background via setImmediate; check server logs or
  // reload /admin/products in 3–5 minutes to see updated product counts.
  req.session.flash = {
    type: 'info',
    msg: 'JM Import started in background — reload this page in 3–5 minutes to see results. Check server logs for progress.',
  };
  res.redirect('/admin/products');

  // Fire-and-forget: runs after the response is flushed.
  setImmediate(async () => {
    try {
      console.log('[JM Import] Starting background import…');
      const result = await _jmImporter.importFromWorkbook(wb);
      const type   = result.errors === 0 ? 'success' : 'warning';
      const errs   = result.errorList.slice(0, 10).join('\n  ');
      console.log(`[JM Import] ✓ Complete — ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`);
      if (errs) console.error(`[JM Import] Errors:\n  ${errs}`);
    } catch (err) {
      console.error(`[JM Import] ✗ Fatal error: ${err.message}`, err);
    }
  });
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

  // Helper — numeric field, null when blank
  const num = (v) => { const n = parseFloat(v); return (!isNaN(n) && v !== '' && v != null) ? n : null; };
  const int = (v) => { const n = parseInt(v);   return (!isNaN(n) && v !== '' && v != null) ? n : null; };

  return {
    // ── Basic
    name,
    slug,
    sku:               (body.sku            || '').trim() || null,
    brand:             (body.brand          || '').trim() || null,
    category_id:       int(body.category_id),
    product_type:      (body.product_type   || '').trim() || null,
    vendor_sku:        (body.vendor_sku     || '').trim() || null,
    upc:               (body.upc            || '').trim() || null,
    component_role:    (body.component_role || '').trim() || null,
    vendor_group_id:   (body.vendor_group_id|| '').trim() || null,
    // ── Descriptions
    short_desc:        (body.short_desc || '').trim() || null,
    long_desc:         (body.long_desc  || '').trim() || null,
    warranty:          (body.warranty   || '').trim() || null,
    // ── Pricing
    price:             parseFloat(body.price) || 0,
    compare_price:     num(body.compare_price),
    cost:              num(body.cost),
    // ── Dimensions
    width_in:          num(body.width_in),
    depth_in:          num(body.depth_in),
    height_in:         num(body.height_in),
    weight_lbs:        num(body.weight_lbs),
    // ── Shipping / logistics
    total_ship_weight_lbs: num(body.total_ship_weight_lbs),
    ships_ltl:         body.ships_ltl  ? 1 : 0,
    freight_class:     (body.freight_class   || '').trim() || null,
    harmonized_code:   (body.harmonized_code || '').trim() || null,
    lead_time_days:    int(body.lead_time_days),
    // ── Compliance / origin
    country_origin:    (body.country_origin || '').trim() || null,
    prop65:            body.prop65     ? 1 : 0,
    // ── Status / availability
    release_date:      (body.release_date || '').trim() || null,
    status:            (body.status || 'active').trim(),
    is_active:         body.is_active === '1' ? 1 : 0,
    is_featured:       body.is_featured  ? 1 : 0,
    is_new:            body.is_new       ? 1 : 0,
    sort_order:        int(body.sort_order) ?? 0,
    // ── Images (primary + image_2_url … image_30_url)
    primary_image_url: (body.primary_image_url || '').trim() || null,
    ...Object.fromEntries(IMG_URL_COLS.map(c => [c, (body[c] || '').trim() || null])),
    // ── Inventory
    qty_on_hand:       int(body.qty_on_hand)    ?? 0,
    allow_backorder:   body.allow_backorder ? 1 : 0,
    reorder_point:     int(body.reorder_point)  ?? 0,
    // ── SEO
    meta_title:        (body.meta_title || '').trim() || null,
    meta_desc:         (body.meta_desc  || '').trim() || null,
    // ── Google Merchant Center
    identifier_exists:        body.identifier_exists === '0' ? 0 : 1,
    mpn:                      (body.mpn                      || '').trim() || null,
    google_product_category:  (body.google_product_category  || '').trim() || null,
    google_condition:         ['new','refurbished','used'].includes(body.google_condition)
                                ? body.google_condition : 'new',
    color:                    (body.color                    || '').trim() || null,
    material:                 (body.material                 || '').trim() || null,
    pattern:                  (body.pattern                  || '').trim() || null,
    age_group:                ['newborn','infant','toddler','kids','adult','all ages'].includes(body.age_group)
                                ? body.age_group : null,
    gender:                   ['male','female','unisex'].includes(body.gender)
                                ? body.gender : null,
    shipping_label:           (body.shipping_label           || '').trim() || null,
    custom_label_0:           (body.custom_label_0           || '').trim() || null,
    custom_label_1:           (body.custom_label_1           || '').trim() || null,
    custom_label_2:           (body.custom_label_2           || '').trim() || null,
    custom_label_3:           (body.custom_label_3           || '').trim() || null,
    custom_label_4:           (body.custom_label_4           || '').trim() || null,
    excluded_destinations:    (body.excluded_destinations     || '').trim() || null,
    ads_redirect:             (body.ads_redirect              || '').trim() || null,
    // ── Model + color family
    model:                    (body.model                     || '').trim() || null,
    color_family:             (body.color_family              || '').trim() || normalizeColor((body.color || '').trim()) || null,
    specs,
  };
}

/* ── Private helpers ─────────────────────────────────────────────── */

async function _upsertInventory(productId, qty, allowBackorder, reorderPoint) {
  await bvoPool.query(`
    INSERT INTO inventory (product_id, qty_on_hand, allow_backorder, reorder_point)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      qty_on_hand=VALUES(qty_on_hand),
      allow_backorder=VALUES(allow_backorder),
      reorder_point=VALUES(reorder_point)
  `, [productId, qty || 0, allowBackorder ? 1 : 0, reorderPoint || 0]);
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

/* ── Product document management ────────────────────────────────── */

exports.productAddDocumentMiddleware = _docUpload.single('doc_file');

const DOC_TYPE_LABELS = {
  spec_sheet:         'Spec Sheet',
  installation_guide: 'Installation Guide',
  warranty:           'Warranty',
  rebate_form:        'Rebate Form',
  cad_drawing:        'CAD Drawing',
  measurement_guide:  'Measurement Guide',
  care_guide:         'Care Guide',
  other:              'Other',
};

exports.productAddDocument = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const { doc_type, label, doc_url } = req.body;
    const validType = DOC_TYPE_LABELS[doc_type] ? doc_type : 'other';
    const docLabel  = (label || DOC_TYPE_LABELS[validType] || 'Document').trim();

    let url = (doc_url || '').trim();
    if (req.file) {
      // Uploaded file — serve from /docs/uploads/
      url = `/docs/uploads/${req.file.filename}`;
    }

    if (!url) {
      req.session.flash = { type: 'error', msg: 'Please provide a URL or upload a file.' };
      return res.redirect(`/admin/products/${productId}/edit`);
    }

    await bvoPool.query(
      'INSERT INTO product_documents (product_id, doc_type, url, label, sort_order) VALUES (?,?,?,?,0)',
      [productId, validType, url, docLabel]
    );
    req.session.flash = { type: 'success', msg: 'Document added.' };
    res.redirect(`/admin/products/${productId}/edit`);
  } catch (err) { next(err); }
};

exports.productDeleteDocument = async (req, res, next) => {
  try {
    const { id, docId } = req.params;
    await bvoPool.query('DELETE FROM product_documents WHERE id=? AND product_id=?', [docId, id]);
    req.session.flash = { type: 'success', msg: 'Document removed.' };
    res.redirect(`/admin/products/${id}/edit`);
  } catch (err) { next(err); }
};

/* ── Bulk Edit (Shopify-style inline grid) ───────────────────────── */

/* GET /admin/products/bulk-edit?ids=1,2,3 */
exports.productBulkEdit = async (req, res, next) => {
  try {
    const ids = (req.query.ids || '').split(',').map(Number).filter(Boolean);
    if (!ids.length) {
      req.session.flash = { type: 'error', msg: 'No products selected for bulk edit.' };
      return res.redirect('/admin/products');
    }
    const ph = ids.map(() => '?').join(',');
    const [products, categories] = await Promise.all([
      safeQuery(
        `SELECT p.id, p.name, p.sku, p.brand, p.price, p.compare_price,
                p.status, p.is_active, p.is_featured, p.is_new,
                p.category_id, c.name AS category_name,
                COALESCE(i.qty_on_hand, 0) AS qty_on_hand
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN inventory  i ON i.product_id = p.id
         WHERE p.id IN (${ph})
         ORDER BY p.name`,
        ids
      ),
      Category.findAll(),
    ]);
    res.render('pages/admin/bulk-edit', {
      ...LAYOUT,
      pageTitle:  'Bulk Edit | BVO Admin',
      activePage: 'products',
      flash:      req.session.flash || null,
      products,
      categories,
      ids: ids.join(','),
    });
    delete req.session.flash;
  } catch (err) { next(err); }
};

/* POST /admin/products/bulk-edit */
exports.productBulkEditSave = async (req, res, next) => {
  try {
    // Body is shaped as rows[idx][field] — each row is its own object.
    // This avoids the double-send bug from the hidden-input + checkbox trick:
    // checked checkboxes now only send '1'; the submit handler injects '0'
    // for unchecked ones, so we always get exactly one value per field per row.
    const rows = req.body.rows || {};

    let saved = 0;
    for (const row of Object.values(rows)) {
      const pid = parseInt(row.product_id);
      if (!pid) continue;
      const price       = parseFloat(row.price)         || 0;
      const comp        = row.compare_price !== '' ? (parseFloat(row.compare_price) || null) : null;
      const status      = row.status        || 'active';
      const is_active   = row.is_active   === '1' ? 1 : 0;
      const is_featured = row.is_featured === '1' ? 1 : 0;
      const is_new      = row.is_new      === '1' ? 1 : 0;
      const category_id = parseInt(row.category_id) || null;
      const qty         = parseInt(row.qty_on_hand)  || 0;

      await bvoPool.query(
        `UPDATE products SET price=?, compare_price=?, status=?,
          is_active=?, is_featured=?, is_new=?, category_id=?, updated_at=NOW()
         WHERE id=?`,
        [price, comp, status, is_active, is_featured, is_new, category_id, pid]
      );
      await bvoPool.query(
        `INSERT INTO inventory (product_id, qty_on_hand, allow_backorder, reorder_point)
         VALUES (?, ?, 0, 0)
         ON DUPLICATE KEY UPDATE qty_on_hand=VALUES(qty_on_hand)`,
        [pid, qty]
      );
      saved++;
    }

    req.session.flash = { type: 'success', msg: `${saved} product(s) updated.` };
    res.redirect('/admin/products');
  } catch (err) { next(err); }
};

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
  const navLinks      = _extractIndexedArray(body, 'nav.links',               ['label','url','highlight','megaMenu']);
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
  // Also persist to DB so settings survive a fresh Hostinger deploy (file wipe).
  // persistToDb is fire-and-forget; errors are swallowed non-fatally inside the service.
  themeSettings.persistToDb(settings);
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

/**
 * POST /admin/theme/duplicate
 * Copies settings from one section key to its _2 duplicate slot,
 * enables the _2 slot, and appends it to homepage_section_order.
 * Only allowed pairs: image_with_text → image_with_text_2, before_after → before_after_2
 */
exports.themeDuplicate = (req, res) => {
  try {
    const { from, to } = req.body || {};
    const ALLOWED = {
      'image_with_text': 'image_with_text_2',
      'before_after':    'before_after_2',
    };
    if (!from || ALLOWED[from] !== to) {
      return res.status(400).json({ ok: false, error: 'Invalid duplicate pair' });
    }
    const settings = themeSettings.get();
    if (!settings[from]) return res.status(400).json({ ok: false, error: 'Source section not found' });

    // Deep-copy source to destination, then enable it
    settings[to] = JSON.parse(JSON.stringify(settings[from]));
    settings[to].enabled = true;

    // Add to section order if not already there (immediately after the source)
    const order = Array.isArray(settings.homepage_section_order) ? settings.homepage_section_order : [];
    if (!order.includes(to)) {
      const srcIdx = order.indexOf(from);
      if (srcIdx !== -1) order.splice(srcIdx + 1, 0, to);
      else order.push(to);
      settings.homepage_section_order = order;
    }

    _persistSettings(settings);
    themeSettings.reload();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

/* ════════════════════════════════════════════════════════════════
   IMAGE UPLOAD  (theme editor AJAX — POST /admin/upload)
   ════════════════════════════════════════════════════════════════ */

// Wrap multer so errors return JSON instead of going to the HTML
// error handler (which breaks fetch().json() in the browser).
exports.uploadMiddleware = (req, res, next) => {
  _upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('[Upload] multer error:', err.message);
      return res.status(400).json({ ok: false, error: err.message });
    }
    next();
  });
};

exports.uploadImage = (req, res) => {
  if (!req.file) {
    console.error('[Upload] no file in req — possible field-name mismatch or empty body');
    return res.status(400).json({ ok: false, error: 'No file received. Check field name or file size.' });
  }
  const url = `/images/uploads/${req.file.filename}`;
  console.log('[Upload] saved:', req.file.path, '→', url);
  res.json({ ok: true, url });
};

/* GET /admin/upload/probe — diagnostic: verify upload dir is writable and served */
exports.uploadProbe = (req, res) => {
  const uploadDir = path.join(__dirname, '../../public/images/uploads');
  const testFile  = path.join(uploadDir, '_probe.txt');
  const results   = { uploadDir, writable: false, staticUrl: '/images/uploads/_probe.txt', error: null };
  try {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(testFile, 'probe ok');
    results.writable = true;
    fs.unlinkSync(testFile);
  } catch (e) {
    results.error = e.message;
  }
  res.json(results);
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

/* ════════════════════════════════════════════════════════════════
   COLOR FAMILY REPORT  (Task #35)
   GET  /admin/products/color-report  — list all products with null color_family
   POST /admin/products/color-report  — bulk-assign a family + persist to color_mappings
   ════════════════════════════════════════════════════════════════ */

/* GET /admin/products/color-report */
exports.colorFamilyReport = async (req, res, next) => {
  try {
    const { FAMILIES } = require('../config/colorFamilies');

    const [
      unmappedColorRows,
      nullColorRow,
      allColorRows,
      mappingRows,
    ] = await Promise.all([
      // Products that have a color string but no family assigned
      safeQuery(`
        SELECT p.color, c.name AS category_name, c.id AS category_id,
               COUNT(*) AS product_count
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.color_family IS NULL
          AND p.color IS NOT NULL
          AND p.color <> ''
        GROUP BY p.color, p.category_id
        ORDER BY product_count DESC, p.color ASC
      `),
      // Products with no color string at all
      safeQueryOne(`
        SELECT COUNT(*) AS n FROM products
        WHERE color_family IS NULL AND (color IS NULL OR color = '')
      `),
      // ALL distinct vendor color strings with their current BVO family + saved mapping context
      safeQuery(`
        SELECT
          p.color                  AS vendor_color,
          p.color_family           AS family_key,
          COUNT(*)                 AS product_count,
          cm.context               AS context,
          cm.notes                 AS notes
        FROM products p
        LEFT JOIN color_mappings cm ON cm.vendor_color = p.color
        WHERE p.color IS NOT NULL AND p.color <> ''
        GROUP BY p.color, p.color_family, cm.context, cm.notes
        ORDER BY p.color_family ASC, p.color ASC
      `),
      // color_mappings rows (for context/notes lookup above, also used for saved count)
      safeQuery('SELECT vendor_color, context, family_key, notes FROM color_mappings ORDER BY vendor_color'),
    ]);

    const flash = req.session.flash || null;
    delete req.session.flash;

    res.render('pages/admin/color-report', {
      ...LAYOUT,
      pageTitle:        'Color Family Report | BVO Admin',
      activePage:       'color-report',
      flash,
      unmappedColors:   unmappedColorRows,
      nullColorCount:   nullColorRow?.n ?? 0,
      allColorRows,
      families:         FAMILIES,
      existingMappings: mappingRows,
    });
  } catch (err) { next(err); }
};

/* POST /admin/products/color-report
   Body: vendor_color, context ('cabinet'|'metal'), family_key
   Action: UPDATE products.color_family WHERE color = vendor_color
           UPSERT color_mappings row
*/
exports.colorFamilyApply = async (req, res, next) => {
  try {
    const vendorColor = (req.body.vendor_color || '').trim();
    const context     = (req.body.context     || 'cabinet').trim();
    const familyKey   = (req.body.family_key  || '').trim();
    const notes       = (req.body.notes       || '').trim() || null;

    if (!vendorColor || !familyKey) {
      req.session.flash = { type: 'error', msg: 'Vendor color and family key are required.' };
      return res.redirect('/admin/products/color-report');
    }

    // 1 — Bulk-update all products with this vendor color string
    const [updateResult] = await bvoPool.query(
      `UPDATE products SET color_family = ? WHERE color = ? AND color_family IS NULL`,
      [familyKey, vendorColor]
    );

    // 2 — Persist to color_mappings so future imports resolve this automatically
    await bvoPool.query(
      `INSERT INTO color_mappings (vendor_color, context, family_key, notes)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE family_key = VALUES(family_key), notes = VALUES(notes)`,
      [vendorColor, context, familyKey, notes]
    );

    const affected = updateResult.affectedRows ?? 0;
    req.session.flash = {
      type: 'success',
      msg:  `"${vendorColor}" mapped to <strong>${familyKey}</strong> — ${affected} product(s) updated. Mapping saved to color_mappings.`,
    };
    res.redirect('/admin/products/color-report');
  } catch (err) { next(err); }
};

/* POST /admin/products/color-mapping/update
   Body: vendor_color, context, family_key, notes
   Updates the mapping row AND re-applies family to ALL products with that color.
*/
exports.colorMappingUpdate = async (req, res, next) => {
  try {
    const vendorColor = (req.body.vendor_color || '').trim();
    const context     = (req.body.context     || 'cabinet').trim();
    const familyKey   = (req.body.family_key  || '').trim();
    const notes       = (req.body.notes       || '').trim() || null;

    if (!vendorColor || !familyKey) {
      req.session.flash = { type: 'error', msg: 'Vendor color and family key are required.' };
      return res.redirect('/admin/products/color-report');
    }

    await bvoPool.query(
      `INSERT INTO color_mappings (vendor_color, context, family_key, notes)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE context = VALUES(context), family_key = VALUES(family_key), notes = VALUES(notes)`,
      [vendorColor, context, familyKey, notes]
    );

    const [updateResult] = await bvoPool.query(
      `UPDATE products SET color_family = ? WHERE color = ?`,
      [familyKey, vendorColor]
    );

    const affected = updateResult.affectedRows ?? 0;
    req.session.flash = {
      type: 'success',
      msg:  `"${vendorColor}" remapped to <strong>${familyKey}</strong> — ${affected} product(s) updated.`,
    };
    res.redirect('/admin/products/color-report');
  } catch (err) { next(err); }
};

/* POST /admin/products/color-mapping/delete
   Body: vendor_color
   Removes the mapping entry (leaves products.color_family as-is).
*/
exports.colorMappingDelete = async (req, res, next) => {
  try {
    const vendorColor = (req.body.vendor_color || '').trim();
    if (!vendorColor) {
      req.session.flash = { type: 'error', msg: 'Vendor color is required.' };
      return res.redirect('/admin/products/color-report');
    }
    await bvoPool.query(`DELETE FROM color_mappings WHERE vendor_color = ?`, [vendorColor]);
    req.session.flash = { type: 'success', msg: `Mapping for "${vendorColor}" removed from color_mappings.` };
    res.redirect('/admin/products/color-report');
  } catch (err) { next(err); }
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

/* ════════════════════════════════════════════════════════════════
   CATEGORIES MANAGER
   ════════════════════════════════════════════════════════════════ */

/** GET /admin/categories */
exports.categoryList = async (req, res, next) => {
  try {
    const [rows] = await bvoPool.query(
      `SELECT c.id, c.slug, c.name, c.description, c.image_url,
              c.sort_order, c.is_active, c.display_mode,
              COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
       WHERE c.parent_id IS NULL
       GROUP BY c.id
       ORDER BY c.sort_order, c.name`
    );
    res.render('pages/admin/categories', {
      ...LAYOUT,
      pageTitle:  'Categories | BVO Admin',
      activePage: 'categories',
      flash:      req.session.flash || null,
      categories: rows,
    });
    delete req.session.flash;
  } catch (err) { next(err); }
};

/** POST /admin/categories — create */
exports.categoryCreate = async (req, res, next) => {
  try {
    const name        = (req.body.name        || '').trim();
    const slug        = (req.body.slug        || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const description = (req.body.description || '').trim();
    const sort_order  = parseInt(req.body.sort_order) || 0;
    const is_active   = req.body.is_active ? 1 : 0;
    const display_mode = (req.body.display_mode || 'product').trim();

    if (!name || !slug) {
      req.session.flash = { type: 'error', msg: 'Name and slug are required.' };
      return res.redirect('/admin/categories');
    }
    await bvoPool.query(
      `INSERT INTO categories (slug, name, description, sort_order, is_active, display_mode, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [slug, name, description, sort_order, is_active, display_mode]
    );
    req.session.flash = { type: 'success', msg: `Category "${name}" created.` };
    res.redirect('/admin/categories');
  } catch (err) {
    req.session.flash = { type: 'error', msg: 'Create failed: ' + err.message };
    res.redirect('/admin/categories');
  }
};

/** POST /admin/categories/:id/delete */
exports.categoryDelete = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const [[row]] = await bvoPool.query('SELECT name FROM categories WHERE id = ?', [id]);
    if (!row) {
      req.session.flash = { type: 'error', msg: 'Category not found.' };
      return res.redirect('/admin/categories');
    }
    await bvoPool.query('DELETE FROM categories WHERE id = ?', [id]);
    req.session.flash = { type: 'success', msg: `Category "${row.name}" deleted.` };
    res.redirect('/admin/categories');
  } catch (err) {
    req.session.flash = { type: 'error', msg: 'Delete failed: ' + err.message };
    res.redirect('/admin/categories');
  }
};

/** POST /admin/categories/:id/image/ajax — AJAX upload (returns JSON) */
// The image card lives inside the main category <form>, so a nested
// <form enctype="multipart/form-data"> would be invalid HTML and ignored
// by browsers. We use fetch() from the page JS instead.
exports.categoryImageAjaxMiddleware = (req, res, next) => {
  _upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('[Category Upload] multer error:', err.message);
      return res.status(400).json({ ok: false, error: err.message });
    }
    next();
  });
};

exports.categorySetImageAjax = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    if (!req.file) {
      console.error('[Category Upload] no file received for category', id);
      return res.status(400).json({ ok: false, error: 'No file received. Only PNG, JPG, WebP under 10 MB.' });
    }
    const url = `/images/uploads/${req.file.filename}`;
    console.log('[Category Upload] saved:', req.file.path, '→', url);
    await bvoPool.query('UPDATE categories SET image_url = ? WHERE id = ?', [url, id]);
    res.json({ ok: true, url });
  } catch (err) {
    console.error('[Category Upload] DB error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
};

/** POST /admin/categories/:id/image/remove — clear category image (returns JSON) */
exports.categoryRemoveImage = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await bvoPool.query('UPDATE categories SET image_url = NULL WHERE id = ?', [id]);
    console.log('[Category Image] removed for category', id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Category Image] remove error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
};

/** POST /admin/categories/:id/image — legacy form POST (kept for safety, redirects) */
exports.categoryImageMiddleware = (req, res, next) => {
  _upload.single('image')(req, res, (err) => {
    if (err) {
      req.session.flash = { type: 'error', msg: 'Upload failed: ' + err.message };
      return res.redirect(`/admin/categories/${req.params.id}/edit`);
    }
    next();
  });
};

exports.categorySetImage = async (req, res, next) => {
  const id = parseInt(req.params.id);
  try {
    if (!req.file) {
      req.session.flash = { type: 'error', msg: 'No image file received.' };
      return res.redirect(`/admin/categories/${id}/edit`);
    }
    const url = `/images/uploads/${req.file.filename}`;
    await bvoPool.query('UPDATE categories SET image_url = ? WHERE id = ?', [url, id]);
    req.session.flash = { type: 'success', msg: 'Image updated.' };
    res.redirect(`/admin/categories/${id}/edit`);
  } catch (err) {
    req.session.flash = { type: 'error', msg: 'Image upload failed: ' + err.message };
    res.redirect(`/admin/categories/${id}/edit`);
  }
};

/** POST /admin/categories/:id — update */
exports.categoryUpdate = async (req, res, next) => {
  const id = parseInt(req.params.id);
  try {
    const name         = (req.body.name         || '').trim();
    const slug         = (req.body.slug         || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const description  = (req.body.description  || '').trim();
    const sort_order   = parseInt(req.body.sort_order) || 0;
    const is_active    = req.body.is_active ? 1 : 0;
    const display_mode = (req.body.display_mode  || 'product').trim();
    const meta_title   = (req.body.meta_title    || '').trim() || null;
    const meta_desc    = (req.body.meta_desc     || '').trim() || null;
    // image_url may be set by the URL paste input or left blank to keep existing.
    // Empty string = keep existing (don't overwrite with null from a blank field).
    const image_url_raw = (req.body.image_url || '').trim();

    if (!name || !slug) {
      req.session.flash = { type: 'error', msg: 'Name and slug are required.' };
      return res.redirect(`/admin/categories/${id}/edit`);
    }

    // Only update image_url when the field is non-empty (avoids wiping an
    // uploaded image if the user saves the form without touching the URL field).
    const imageClause = image_url_raw ? ', image_url=?' : '';
    const params = [name, slug, description, sort_order, is_active, display_mode, meta_title, meta_desc];
    if (image_url_raw) params.push(image_url_raw);
    params.push(id);

    await bvoPool.query(
      `UPDATE categories
          SET name=?, slug=?, description=?, sort_order=?, is_active=?,
              display_mode=?, meta_title=?, meta_desc=?${imageClause}
        WHERE id = ?`,
      params
    );
    req.session.flash = { type: 'success', msg: 'Category saved.' };
    res.redirect(`/admin/categories/${id}/edit`);
  } catch (err) {
    req.session.flash = { type: 'error', msg: 'Save failed: ' + err.message };
    res.redirect(`/admin/categories/${id}/edit`);
  }
};

/** GET /admin/categories/new */
exports.categoryNew = (req, res) => {
  res.render('pages/admin/category-edit', {
    ...LAYOUT,
    pageTitle:  'New Category | BVO Admin',
    activePage: 'categories',
    flash:      req.session.flash || null,
    category:   null,
    isNew:      true,
  });
  delete req.session.flash;
};

/** GET /admin/categories/:id/edit */
exports.categoryEditPage = async (req, res, next) => {
  try {
    const [[category]] = await bvoPool.query(
      `SELECT id, slug, name, description, image_url, sort_order, is_active,
              display_mode, meta_title, meta_desc
       FROM categories WHERE id = ?`,
      [req.params.id]
    );
    if (!category) {
      req.session.flash = { type: 'error', msg: 'Category not found.' };
      return res.redirect('/admin/categories');
    }
    res.render('pages/admin/category-edit', {
      ...LAYOUT,
      pageTitle:  `Edit: ${category.name} | BVO Admin`,
      activePage: 'categories',
      flash:      req.session.flash || null,
      category,
      isNew:      false,
    });
    delete req.session.flash;
  } catch (err) { next(err); }
};
