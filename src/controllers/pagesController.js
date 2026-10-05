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

/* ⚠️ FAILS SOFT, DELIBERATELY. The authors table arrives with
   migrations/2026-10-05_authors_RUNME.sql. Between the deploy and that
   SQL running, this returns [] and the editor simply shows no Author
   dropdown - it does not 500 the page editor, which is the one screen
   the owner would need in order to fix anything else. */
async function _authorOptions() {
  try {
    const [rows] = await bvoPool.query(
      'SELECT id, name FROM authors WHERE is_visible = 1 ORDER BY name'
    );
    return rows;
  } catch { return []; }
}

/* <input type="date"> speaks YYYY-MM-DD and nothing else. A DATETIME out
   of MySQL is a Date object; a bare '' must stay '' rather than becoming
   1970-01-01. */
function _dateInput(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

/* The inverse. '' means "no date" and must round-trip to NULL, not to a
   zero date - a guide with no publish date must emit no datePublished at
   all rather than claiming 1970. */
function _dateValue(v) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(String(v).trim())) return null;
  const d = new Date(String(v).trim() + 'T12:00:00Z');
  return isNaN(d) ? null : d;
}

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

exports.adminNew = async (req, res) => {
  res.render('pages/admin/page-edit', {
    layout:     'layouts/admin',
    pageTitle:  'New Page | BVO Admin',
    activePage: 'pages',
    page:       null,
    authors:    await _authorOptions(),
    dateInput:  _dateInput,
    flash:      null,
  });
};

exports.adminCreate = async (req, res) => {
  const { title, slug: rawSlug, content, meta_title, meta_desc, og_image, sort_order,
          author_id, published_at } = req.body;
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
      authors:    await _authorOptions(),
      dateInput:  _dateInput,
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
    /* Same guarded second statement as the update path - see the comment
       there. The core INSERT must not carry columns that may not exist. */
    if (result && result.insertId) {
      try {
        await bvoPool.query(
          'UPDATE pages SET author_id=?, published_at=? WHERE id=?',
          [parseInt(author_id) || null, _dateValue(published_at), result.insertId]
        );
      } catch (e) {
        if (!e || e.code !== 'ER_BAD_FIELD_ERROR') throw e;
        console.warn('[pages] authors migration not applied - author/date not saved');
      }
    }

    req.session.flash = { type: 'success', msg: `Page "<strong>${title}</strong>" created.` };
    res.redirect('/admin/pages');
  } catch (err) {
    const dupSlug = err.code === 'ER_DUP_ENTRY';
    res.render('pages/admin/page-edit', {
      layout:     'layouts/admin',
      pageTitle:  'New Page | BVO Admin',
      activePage: 'pages',
      page:       { ...req.body, slug },
      authors:    await _authorOptions(),
      dateInput:  _dateInput,
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
      authors:    await _authorOptions(),
      dateInput:  _dateInput,
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
    const { title, slug: rawSlug, content, meta_title, meta_desc, og_image, sort_order,
            author_id, published_at } = req.body || {};
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
        authors:    await _authorOptions(),
        dateInput:  _dateInput,
        flash:      { type: 'error', msg: 'Title is required.' },
      });
    }

    const slug = rawSlug ? makeSlug(rawSlug) : makeSlug(title);

    await bvoPool.query(
      /* ⚠️ author_id and published_at are written through a GUARDED
         statement, not added to the list above. Before the authors
         migration runs those columns do not exist, and naming a missing
         column is ER_BAD_FIELD_ERROR - it would take out the Save button
         on every page in the admin. The core UPDATE always succeeds; the
         attribution is a second statement that is allowed to fail. */
      `UPDATE pages SET slug=?, title=?, content=?, meta_title=?, meta_desc=?, og_image=?,
       is_visible=?, sort_order=? WHERE id=?`,
      [slug, title.trim(), content || '', meta_title || '', meta_desc || '', og_image || '',
       is_visible === 'true' || is_visible === '1' ? 1 : 0,
       parseInt(sort_order) || 0, id]
    );
    try {
      await bvoPool.query(
        'UPDATE pages SET author_id=?, published_at=? WHERE id=?',
        [parseInt(author_id) || null, _dateValue(published_at), id]
      );
    } catch (e) {
      if (!e || e.code !== 'ER_BAD_FIELD_ERROR') throw e;
      console.warn('[pages] authors migration not applied - author/date not saved');
    }

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
      authors:    await _authorOptions(),
      dateInput:  _dateInput,
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
