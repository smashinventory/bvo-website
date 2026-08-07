'use strict';

/**
 * pagesController.js
 * Admin CRUD + public render for CMS Pages.
 *
 * Admin routes (all behind requireAdmin):
 *   GET  /admin/pages               — list
 *   GET  /admin/pages/new           — new page form
 *   POST /admin/pages               — create
 *   GET  /admin/pages/:id/edit      — edit form
 *   POST /admin/pages/:id           — update
 *   POST /admin/pages/:id/delete    — delete
 *   POST /admin/pages/:id/toggle    — toggle visibility (AJAX)
 *
 * Public routes:
 *   GET  /pages/:slug               — render page
 */

const { bvoPool } = require('../config/database');

/* ── slug helper ─────────────────────────────────────────────── */
function makeSlug(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ═══════════════ ADMIN ══════════════════════════════════════════ */

exports.adminList = async (req, res) => {
  try {
    const [pages] = await bvoPool.query(
      `SELECT id, slug, title, is_visible, sort_order, updated_at
       FROM pages ORDER BY sort_order ASC, id ASC`
    );
    res.render('pages/admin/pages-list', {
      layout:     'layouts/admin',
      pageTitle:  'Pages | BVO Admin',
      activePage: 'pages',
      pages,
      flash:      req.session.flash || null,
    });
    delete req.session.flash;
  } catch (err) {
    console.error('[pagesController] adminList:', err.message);
    res.status(500).render('pages/error', { pageTitle: 'Error', message: err.message });
  }
};

exports.adminNew = (req, res) => {
  res.render('pages/admin/page-edit', {
    layout:     'layouts/admin',
    pageTitle:  'New Page | BVO Admin',
    activePage: 'pages',
    page:       null,
    flash:      null,
  });
};

exports.adminCreate = async (req, res) => {
  const { title, slug: rawSlug, content, meta_title, meta_desc, og_image, sort_order } = req.body;
  // is_visible: hidden field (value="false") + checkbox (value="true") both named is_visible.
  // Body parser creates an array when both are present — take the last element (checkbox wins).
  const _rawVis   = req.body.is_visible;
  const is_visible = Array.isArray(_rawVis) ? _rawVis[_rawVis.length - 1] : _rawVis;

  if (!title || !title.trim()) {
    return res.render('pages/admin/page-edit', {
      layout:     'layouts/admin',
      pageTitle:  'New Page | BVO Admin',
      activePage: 'pages',
      page:       req.body,
      flash:      { type: 'error', msg: 'Title is required.' },
    });
  }

  const slug = rawSlug ? makeSlug(rawSlug) : makeSlug(title);

  try {
    const [result] = await bvoPool.query(
      `INSERT INTO pages (slug, title, content, meta_title, meta_desc, og_image, is_visible, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, title.trim(), content || '', meta_title || '', meta_desc || '', og_image || '',
       is_visible === 'true' || is_visible === '1' ? 1 : 0,
       parseInt(sort_order) || 0]
    );
    req.session.flash = { type: 'success', msg: `Page "<strong>${title}</strong>" created.` };
    res.redirect('/admin/pages');
  } catch (err) {
    const dupSlug = err.code === 'ER_DUP_ENTRY';
    res.render('pages/admin/page-edit', {
      layout:     'layouts/admin',
      pageTitle:  'New Page | BVO Admin',
      activePage: 'pages',
      page:       { ...req.body, slug },
      flash:      { type: 'error', msg: dupSlug ? `Slug "<strong>${slug}</strong>" is already taken — choose a different one.` : err.message },
    });
  }
};

exports.adminEdit = async (req, res) => {
  try {
    const [[page]] = await bvoPool.query('SELECT * FROM pages WHERE id = ?', [req.params.id]);
    if (!page) return res.redirect('/admin/pages');
    res.render('pages/admin/page-edit', {
      layout:     'layouts/admin',
      pageTitle:  `Edit: ${page.title} | BVO Admin`,
      activePage: 'pages',
      page,
      flash:      req.session.flash || null,
    });
    delete req.session.flash;
  } catch (err) {
    console.error('[pagesController] adminEdit:', err.message);
    res.redirect('/admin/pages');
  }
};

exports.adminUpdate = async (req, res) => {
  const { id } = req.params;
  try {
    const { title, slug: rawSlug, content, meta_title, meta_desc, og_image, sort_order } = req.body || {};
    // is_visible: hidden field + checkbox both named is_visible → body parser makes an array.
    // Take the last element: hidden="false" comes first, checkbox="true" comes second.
    const _rawVis    = (req.body || {}).is_visible;
    const is_visible = Array.isArray(_rawVis) ? _rawVis[_rawVis.length - 1] : _rawVis;

    if (!title || !title.trim()) {
      return res.render('pages/admin/page-edit', {
        layout:     'layouts/admin',
        pageTitle:  'Edit Page | BVO Admin',
        activePage: 'pages',
        page:       { ...(req.body || {}), id },
        flash:      { type: 'error', msg: 'Title is required.' },
      });
    }

    const slug = rawSlug ? makeSlug(rawSlug) : makeSlug(title);

    await bvoPool.query(
      `UPDATE pages SET slug=?, title=?, content=?, meta_title=?, meta_desc=?, og_image=?,
       is_visible=?, sort_order=? WHERE id=?`,
      [slug, title.trim(), content || '', meta_title || '', meta_desc || '', og_image || '',
       is_visible === 'true' || is_visible === '1' ? 1 : 0,
       parseInt(sort_order) || 0, id]
    );
    req.session.flash = { type: 'success', msg: `Page updated.` };
    res.redirect('/admin/pages');

  } catch (err) {
    console.error('[pagesController] adminUpdate id=%s:', id, err.message);
    const slug = makeSlug((req.body || {}).slug || (req.body || {}).title || '');
    const dupSlug = err.code === 'ER_DUP_ENTRY';
    res.status(dupSlug ? 422 : 500).render('pages/admin/page-edit', {
      layout:     'layouts/admin',
      pageTitle:  'Edit Page | BVO Admin',
      activePage: 'pages',
      page:       { ...(req.body || {}), id, slug },
      flash:      { type: 'error', msg: dupSlug ? `Slug "<strong>${slug}</strong>" is already taken.` : 'An unexpected error occurred — check server logs.' },
    });
  }
};

exports.adminDelete = async (req, res) => {
  try {
    await bvoPool.query('DELETE FROM pages WHERE id = ?', [req.params.id]);
    req.session.flash = { type: 'success', msg: 'Page deleted.' };
  } catch (err) {
    req.session.flash = { type: 'error', msg: err.message };
  }
  res.redirect('/admin/pages');
};

exports.adminToggle = async (req, res) => {
  try {
    const visible = req.body.visible === '1' ? 1 : 0;
    await bvoPool.query('UPDATE pages SET is_visible=? WHERE id=?', [visible, req.params.id]);
    res.json({ ok: true, visible });
  } catch (err) {
    console.error('[pagesController] adminToggle:', err.message);
    res.status(500).json({ ok: false, error: 'An unexpected error occurred.' });
  }
};

/* ═══════════════ PUBLIC ═════════════════════════════════════════ */

exports.publicPage = async (req, res) => {
  const { slug } = req.params;

  try {
    const [[page]] = await bvoPool.query(
      `SELECT id, slug, title, content, meta_title, meta_desc, og_image
       FROM pages WHERE slug = ? AND is_visible = 1`,
      [slug]
    );

    if (!page) {
      return res.status(404).render('pages/404', {
        pageTitle: '404 — Page Not Found | BathroomVanitiesOutlet.com',
      });
    }

    const siteUrl = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';

    res.render('pages/cms-page', {
      layout:       'layouts/main',
      pageTitle:    page.meta_title || `${page.title} | BathroomVanitiesOutlet.com`,
      metaDesc:     page.meta_desc || '',
      canonicalUrl: `${siteUrl}/pages/${page.slug}`,
      style:        '',
      script:       '',
      page,
    });
  } catch (err) {
    console.error('[pagesController] publicPage:', err.message);
    res.status(500).render('pages/error', { pageTitle: 'Error', message: 'An error occurred.' });
  }
};

/* ── Helper for footer/menus: fetch all visible pages ─────────── */
exports.getVisiblePages = async () => {
  try {
    const [rows] = await bvoPool.query(
      `SELECT id, slug, title FROM pages WHERE is_visible=1 ORDER BY sort_order ASC, id ASC`
    );
    return rows;
  } catch {
    return [];
  }
};
