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
      safeQueryOne('SELECT COUNT(*) AS n FROM products WHERE active = 1'),
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

    // fallback to placeholders when DB unavailable
    const displayProducts = products.length ? products : Product._placeholder().slice(0, PER_PAGE);
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
      pageTitle:  'Add Product | BVO Admin',
      activePage: 'products',
      flash: null,
      product: null,
      categories,
      isNew: true,
    });
  } catch (err) { next(err); }
};

exports.productEdit = async (req, res, next) => {
  try {
    const product = await safeQueryOne(
      'SELECT * FROM products WHERE id = ?', [req.params.id]
    );
    if (!product) return res.redirect('/admin/products');

    const categories = await Category.findAll();
    res.render('pages/admin/product-edit', {
      ...LAYOUT,
      pageTitle:  `Edit: ${product.name} | BVO Admin`,
      activePage: 'products',
      flash: null,
      product,
      categories,
      isNew: false,
    });
  } catch (err) { next(err); }
};

exports.productCreate = async (req, res, next) => {
  try {
    const d = _extractProductFields(req.body);
    await bvoPool.query(
      `INSERT INTO products (name,slug,sku,brand,category_id,price,compare_price,
        description,active,source_flag) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [d.name, d.slug, d.sku, d.brand, d.category_id, d.price,
       d.compare_price, d.description, d.active, 'manual']
    );
    req.session.flash = { type: 'success', msg: 'Product created.' };
    res.redirect('/admin/products');
  } catch (err) { next(err); }
};

exports.productUpdate = async (req, res, next) => {
  try {
    const d = _extractProductFields(req.body);
    await bvoPool.query(
      `UPDATE products SET name=?,slug=?,sku=?,brand=?,category_id=?,price=?,
        compare_price=?,description=?,active=? WHERE id=?`,
      [d.name, d.slug, d.sku, d.brand, d.category_id, d.price,
       d.compare_price, d.description, d.active, req.params.id]
    ).catch(() => {}); // DB may not exist in dev — silent
    req.session.flash = { type: 'success', msg: 'Product updated.' };
    res.redirect('/admin/products');
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

function _extractProductFields(body) {
  const name    = (body.name || '').trim();
  const rawSlug = (body.slug || '').trim();
  const slug    = rawSlug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    name,
    slug,
    sku:          (body.sku          || '').trim(),
    brand:        (body.brand        || '').trim(),
    category_id:  parseInt(body.category_id) || null,
    price:        parseFloat(body.price)      || 0,
    compare_price:parseFloat(body.compare_price) || null,
    description:  (body.description  || '').trim(),
    active:       body.active === '1' ? 1 : 0,
  };
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
