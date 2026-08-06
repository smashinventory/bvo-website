'use strict';

/**
 * blogController.js
 * Admin CRUD + public render for Blog Posts.
 *
 * Admin routes (all behind requireAdmin):
 *   GET  /admin/blog               — list
 *   GET  /admin/blog/new           — new post form
 *   POST /admin/blog               — create
 *   GET  /admin/blog/:id/edit      — edit form
 *   POST /admin/blog/:id           — update
 *   POST /admin/blog/:id/delete    — delete
 *   POST /admin/blog/:id/toggle    — toggle visibility (AJAX)
 *
 * Public routes:
 *   GET  /blog                     — blog index (paginated)
 *   GET  /blog/:slug               — single post
 */

const { bvoPool } = require('../config/database');
const PER_PAGE = 12;

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

/* ── strip HTML for auto-excerpt ──────────────────────────────── */
function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ═══════════════ ADMIN ══════════════════════════════════════════ */

exports.adminList = async (req, res) => {
  try {
    const [posts] = await bvoPool.query(
      `SELECT id, slug, title, author, is_visible, published_at, created_at
       FROM blog_posts ORDER BY created_at DESC`
    );
    res.render('pages/admin/blog-list', {
      layout:     'layouts/admin',
      pageTitle:  'Blog | BVO Admin',
      activePage: 'blog',
      posts,
      flash:      req.session.flash || null,
    });
    delete req.session.flash;
  } catch (err) {
    console.error('[blogController] adminList:', err.message);
    res.status(500).render('pages/error', { pageTitle: 'Error', message: err.message });
  }
};

exports.adminNew = (req, res) => {
  res.render('pages/admin/blog-edit', {
    layout:     'layouts/admin',
    pageTitle:  'New Post | BVO Admin',
    activePage: 'blog',
    post:       null,
    flash:      null,
  });
};

exports.adminCreate = async (req, res) => {
  const {
    title, slug: rawSlug, content, excerpt,
    featured_image, author, tags, is_visible, published_at,
  } = req.body;

  if (!title || !title.trim()) {
    return res.render('pages/admin/blog-edit', {
      layout:     'layouts/admin',
      pageTitle:  'New Post | BVO Admin',
      activePage: 'blog',
      post:       req.body,
      flash:      { type: 'error', msg: 'Title is required.' },
    });
  }

  const slug    = rawSlug ? makeSlug(rawSlug) : makeSlug(title);
  const visible = is_visible === 'true' || is_visible === '1' ? 1 : 0;
  // Auto-set published_at when first publishing
  const pubAt   = visible && !published_at ? new Date() : (published_at || null);

  try {
    await bvoPool.query(
      `INSERT INTO blog_posts
         (slug, title, content, excerpt, featured_image, author, tags, is_visible, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, title.trim(), content || '', excerpt || '', featured_image || '',
       author || 'BVO Team', tags || '', visible, pubAt]
    );
    req.session.flash = { type: 'success', msg: `Post "<strong>${title}</strong>" created.` };
    res.redirect('/admin/blog');
  } catch (err) {
    const dupSlug = err.code === 'ER_DUP_ENTRY';
    res.render('pages/admin/blog-edit', {
      layout:     'layouts/admin',
      pageTitle:  'New Post | BVO Admin',
      activePage: 'blog',
      post:       { ...req.body, slug },
      flash:      { type: 'error', msg: dupSlug ? `Slug "<strong>${slug}</strong>" is already taken.` : err.message },
    });
  }
};

exports.adminEdit = async (req, res) => {
  try {
    const [[post]] = await bvoPool.query('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
    if (!post) return res.redirect('/admin/blog');
    res.render('pages/admin/blog-edit', {
      layout:     'layouts/admin',
      pageTitle:  `Edit: ${post.title} | BVO Admin`,
      activePage: 'blog',
      post,
      flash:      req.session.flash || null,
    });
    delete req.session.flash;
  } catch (err) {
    console.error('[blogController] adminEdit:', err.message);
    res.redirect('/admin/blog');
  }
};

exports.adminUpdate = async (req, res) => {
  const { id } = req.params;
  const {
    title, slug: rawSlug, content, excerpt,
    featured_image, author, tags, is_visible, published_at,
  } = req.body;

  if (!title || !title.trim()) {
    return res.render('pages/admin/blog-edit', {
      layout:     'layouts/admin',
      pageTitle:  'Edit Post | BVO Admin',
      activePage: 'blog',
      post:       { ...req.body, id },
      flash:      { type: 'error', msg: 'Title is required.' },
    });
  }

  const slug    = rawSlug ? makeSlug(rawSlug) : makeSlug(title);
  const visible = is_visible === 'true' || is_visible === '1' ? 1 : 0;

  // Fetch existing to check if we're toggling visible for first time
  let pubAt = published_at || null;
  try {
    const [[existing]] = await bvoPool.query('SELECT is_visible, published_at FROM blog_posts WHERE id=?', [id]);
    if (visible && !existing.published_at && !published_at) pubAt = new Date();
  } catch { /* ignore */ }

  try {
    await bvoPool.query(
      `UPDATE blog_posts SET slug=?, title=?, content=?, excerpt=?, featured_image=?,
       author=?, tags=?, is_visible=?, published_at=? WHERE id=?`,
      [slug, title.trim(), content || '', excerpt || '', featured_image || '',
       author || 'BVO Team', tags || '', visible, pubAt, id]
    );
    req.session.flash = { type: 'success', msg: 'Post updated.' };
    res.redirect('/admin/blog');
  } catch (err) {
    const dupSlug = err.code === 'ER_DUP_ENTRY';
    res.render('pages/admin/blog-edit', {
      layout:     'layouts/admin',
      pageTitle:  'Edit Post | BVO Admin',
      activePage: 'blog',
      post:       { ...req.body, id, slug },
      flash:      { type: 'error', msg: dupSlug ? `Slug "<strong>${slug}</strong>" is already taken.` : err.message },
    });
  }
};

exports.adminDelete = async (req, res) => {
  try {
    await bvoPool.query('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
    req.session.flash = { type: 'success', msg: 'Post deleted.' };
  } catch (err) {
    req.session.flash = { type: 'error', msg: err.message };
  }
  res.redirect('/admin/blog');
};

exports.adminToggle = async (req, res) => {
  try {
    const visible = req.body.visible === '1' ? 1 : 0;
    // Auto-set published_at on first publish
    const [[existing]] = await bvoPool.query('SELECT is_visible, published_at FROM blog_posts WHERE id=?', [req.params.id]);
    const pubAt = visible && !existing.published_at ? new Date() : existing.published_at;
    await bvoPool.query('UPDATE blog_posts SET is_visible=?, published_at=? WHERE id=?', [visible, pubAt, req.params.id]);
    res.json({ ok: true, visible });
  } catch (err) {
    console.error('[blogController] adminToggle:', err.message);
    res.status(500).json({ ok: false, error: 'An unexpected error occurred.' });
  }
};

/* ═══════════════ PUBLIC ═════════════════════════════════════════ */

exports.publicList = async (req, res) => {
  const page    = Math.max(1, parseInt(req.query.page) || 1);
  const offset  = (page - 1) * PER_PAGE;
  const siteUrl = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';

  try {
    const [[{ total }]] = await bvoPool.query(
      `SELECT COUNT(*) AS total FROM blog_posts WHERE is_visible=1`
    );
    const [posts] = await bvoPool.query(
      `SELECT id, slug, title, excerpt, content, featured_image, author, tags, published_at
       FROM blog_posts WHERE is_visible=1
       ORDER BY published_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [PER_PAGE, offset]
    );

    // Auto-excerpt if excerpt is empty
    posts.forEach(p => {
      if (!p.excerpt) p.excerpt = stripHtml(p.content).substring(0, 180) + '…';
    });

    const totalPages = Math.ceil(total / PER_PAGE);

    res.render('pages/blog-list', {
      layout:       'layouts/main',
      pageTitle:    'Blog | BathroomVanitiesOutlet.com',
      metaDesc:     'Design tips, bathroom renovation guides, and inspiration from the BathroomVanitiesOutlet.com team.',
      canonicalUrl: `${siteUrl}/blog`,
      style:        '',
      script:       '',
      posts,
      page,
      totalPages,
      total,
    });
  } catch (err) {
    console.error('[blogController] publicList:', err.message);
    res.status(500).render('pages/error', { pageTitle: 'Error', message: 'An error occurred.' });
  }
};

exports.publicPost = async (req, res) => {
  const { slug }  = req.params;
  const siteUrl   = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';

  try {
    const [[post]] = await bvoPool.query(
      `SELECT * FROM blog_posts WHERE slug=? AND is_visible=1`,
      [slug]
    );

    if (!post) {
      return res.status(404).render('pages/404', {
        pageTitle: '404 — Page Not Found | BathroomVanitiesOutlet.com',
      });
    }

    // Recent posts sidebar (exclude current)
    const [recent] = await bvoPool.query(
      `SELECT slug, title, published_at FROM blog_posts
       WHERE is_visible=1 AND id <> ? ORDER BY published_at DESC LIMIT 4`,
      [post.id]
    );

    const autoExcerpt = post.excerpt || stripHtml(post.content).substring(0, 200);
    const pubIso      = post.published_at ? new Date(post.published_at).toISOString() : null;
    const modIso      = post.updated_at   ? new Date(post.updated_at).toISOString()   : null;

    // Article JSON-LD
    const jsonLd = JSON.stringify({
      '@context':        'https://schema.org',
      '@type':           'BlogPosting',
      headline:          post.title,
      description:       autoExcerpt,
      image:             post.featured_image || `${siteUrl}/images/og-default.jpg`,
      author:            { '@type': 'Organization', name: post.author || 'BVO Team' },
      publisher:         { '@type': 'Organization', name: 'BathroomVanitiesOutlet.com', logo: { '@type': 'ImageObject', url: `${siteUrl}/images/logos/BVOLOGOSQ_512.png` } },
      datePublished:     pubIso,
      dateModified:      modIso,
      mainEntityOfPage:  { '@type': 'WebPage', '@id': `${siteUrl}/blog/${post.slug}` },
    });

    res.render('pages/blog-post', {
      layout:       'layouts/main',
      pageTitle:    `${post.title} | BathroomVanitiesOutlet.com`,
      metaDesc:     autoExcerpt.substring(0, 160),
      canonicalUrl: `${siteUrl}/blog/${post.slug}`,
      style:        '',
      script:       `<script type="application/ld+json">${jsonLd}</script>`,
      post,
      recent,
    });
  } catch (err) {
    console.error('[blogController] publicPost:', err.message);
    res.status(500).render('pages/error', { pageTitle: 'Error', message: 'An error occurred.' });
  }
};
