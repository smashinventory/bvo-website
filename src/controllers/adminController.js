'use strict';

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
          image_2_url, image_3_url, image_4_url, image_5_url, image_6_url, image_7_url,
          meta_title, meta_desc,
          google_product_category, google_condition, color, material, pattern,
          age_group, gender, shipping_label,
          custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4,
          excluded_destinations, ads_redirect, identifier_exists,
          model, color_family,
          source_flag)
       VALUES (?,?,?,?,?, ?,?,?,?,?,?, ?,?,?, ?,?,?, ?,?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?, ?,?, ?,?,?,?,?,?, ?,?, ?,?,?,?,?, ?,?,?, ?,?,?,?,?, ?,?,?,?,?,'manual')`,
      [sku, d.slug, d.name, d.brand, d.category_id,
       d.product_type, d.vendor_sku, d.upc, d.mpn, d.component_role, d.vendor_group_id,
       d.short_desc, d.long_desc, d.warranty,
       d.price, d.compare_price, d.cost,
       d.width_in, d.depth_in, d.height_in, d.weight_lbs,
       d.total_ship_weight_lbs, d.ships_ltl, d.freight_class, d.harmonized_code, d.lead_time_days,
       d.country_origin, d.prop65, d.release_date, d.status,
       d.is_active, d.is_featured, d.is_new,
       d.sort_order, d.primary_image_url,
       d.image_2_url, d.image_3_url, d.image_4_url, d.image_5_url, d.image_6_url, d.image_7_url,
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
         image_2_url=?, image_3_url=?, image_4_url=?, image_5_url=?, image_6_url=?, image_7_url=?,
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
       d.image_2_url, d.image_3_url, d.image_4_url, d.image_5_url, d.image_6_url, d.image_7_url,
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
  // Core / universal
  'product_type', 'size_in', 'height_in', 'depth_in',
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
        const image_2_url          = g('image_2_url');
        const image_3_url          = g('image_3_url');
        const image_4_url          = g('image_4_url');
        const image_5_url          = g('image_5_url');
        const image_6_url          = g('image_6_url');
        const image_7_url          = g('image_7_url');
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
               image_2_url=?, image_3_url=?, image_4_url=?,
               image_5_url=?, image_6_url=?, image_7_url=?,
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
             image_2_url, image_3_url, image_4_url,
             image_5_url, image_6_url, image_7_url,
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
                image_2_url, image_3_url, image_4_url,
                image_5_url, image_6_url, image_7_url,
                meta_title, meta_desc,
                google_product_category, google_condition, color, material, pattern,
                age_group, gender, shipping_label,
                custom_label_0, custom_label_1, custom_label_2, custom_label_3, custom_label_4,
                excluded_destinations, ads_redirect, identifier_exists,
                model, color_family,
                source_flag)
             VALUES (?,?,?,?,?, ?,?,?,?,?,?, ?,?,?, ?,?,?, ?,?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?, ?,?, ?,?,?, ?,?,?, ?,?, ?,?,?,?,?, ?,?,?, ?,?,?,?,?, ?,?,?,?,?,'manual')`,
            [sku, finalSlug, name, brand, category_id,
             product_type, vendor_sku, upc, mpn, component_role, vendor_group_id,
             short_desc, long_desc, warranty,
             price, compare_price, cost,
             width_in, depth_in, height_in, weight_lbs,
             total_ship_weight, ships_ltl, freight_class, harmonized_code, lead_time_days,
             country_origin, prop65, release_date, status,
             is_active, is_featured, is_new,
             sort_order, primary_image_url,
             image_2_url, image_3_url, image_4_url,
             image_5_url, image_6_url, image_7_url,
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
    // ── Images
    primary_image_url: (body.primary_image_url || '').trim() || null,
    image_2_url:       (body.image_2_url || '').trim() || null,
    image_3_url:       (body.image_3_url || '').trim() || null,
    image_4_url:       (body.image_4_url || '').trim() || null,
    image_5_url:       (body.image_5_url || '').trim() || null,
    image_6_url:       (body.image_6_url || '').trim() || null,
    image_7_url:       (body.image_7_url || '').trim() || null,
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
    // Body contains arrays: product_id[], price[], compare_price[], status[],
    // is_active[], is_featured[], is_new[], category_id[], qty_on_hand[]
    const productIds    = [].concat(req.body.product_id   || []);
    const prices        = [].concat(req.body.price        || []);
    const comparePrices = [].concat(req.body.compare_price|| []);
    const statuses      = [].concat(req.body.status       || []);
    const isActives     = [].concat(req.body.is_active    || []);
    const isFeaturedArr = [].concat(req.body.is_featured  || []);
    const isNewArr      = [].concat(req.body.is_new       || []);
    const categoryIds   = [].concat(req.body.category_id  || []);
    const qtys          = [].concat(req.body.qty_on_hand  || []);

    let saved = 0;
    for (let i = 0; i < productIds.length; i++) {
      const pid = parseInt(productIds[i]);
      if (!pid) continue;
      const price       = parseFloat(prices[i])        || 0;
      const comp        = prices[i] !== undefined ? (parseFloat(comparePrices[i]) || null) : null;
      const status      = statuses[i] || 'active';
      const is_active   = isActives[i]   === '1' ? 1 : 0;
      const is_featured = isFeaturedArr[i] === '1' ? 1 : 0;
      const is_new      = isNewArr[i]     === '1' ? 1 : 0;
      const category_id = parseInt(categoryIds[i]) || null;
      const qty         = parseInt(qtys[i])        || 0;

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
