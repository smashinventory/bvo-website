'use strict';

/**
 * menusController.js
 * Admin CRUD for Nav Menus + header loading helper.
 *
 * Admin routes (all behind requireAdmin):
 *   GET  /admin/menus               — list menus + items
 *   GET  /admin/menus/:handle       — edit a specific menu
 *   POST /admin/menus/:handle/items — add item to menu
 *   POST /admin/menus/:handle/items/:itemId — update item
 *   POST /admin/menus/:handle/items/:itemId/delete — delete item
 *   POST /admin/menus/:handle/reorder — save drag sort_order (JSON body)
 *
 * Header helper:
 *   getMainMenuItems() — returns cached nav items for 'main-menu'
 */

const { bvoPool } = require('../config/database');

/* ── Simple in-process cache (5 min TTL) ─────────────────────── */
let _menuCache   = {};
let _cacheExpiry = {};
const TTL_MS     = 5 * 60 * 1000;

function _invalidate(handle) {
  delete _menuCache[handle];
  delete _cacheExpiry[handle];

  /* THREE caches existed here and only one was being cleared — this one,
     which feeds getMenuItems() below, which nothing calls. The header and
     footer are rendered from megaMenuData's _cmsCache, and that was never
     invalidated, so a Menu Manager save took up to 5 minutes to appear and
     looked like it had not saved at all.

     Required lazily, inside the function: menusController is loaded while
     routes are being wired, and a top-level require of a middleware module
     here is a cycle waiting to happen. */
  try {
    require('../middleware/megaMenuData').bustCmsCache();
  } catch (err) {
    /* Never let a cache-clear failure break a save that already committed.
       Logged, because a silent catch is what hid the collation bug. */
    console.error('[menusController] bustCmsCache failed:', err.message);
  }
}

/* ── Admin: list all menus ───────────────────────────────────── */
exports.adminList = async (req, res) => {
  try {
    const [menus] = await bvoPool.query(`SELECT * FROM nav_menus ORDER BY id`);

    // Load items for each menu
    for (const m of menus) {
      const [items] = await bvoPool.query(
        `SELECT * FROM nav_menu_items WHERE menu_id=? ORDER BY sort_order, id`,
        [m.id]
      );
      m.items = items;
    }

    res.render('pages/admin/menus', {
      layout:     'layouts/admin',
      pageTitle:  'Menu Manager | BVO Admin',
      activePage: 'menus',
      menus,
      activeHandle: req.query.menu || (menus[0] ? menus[0].handle : null),
      flash:      req.session.flash || null,
    });
    delete req.session.flash;
  } catch (err) {
    console.error('[menusController] adminList:', err.message);
    res.status(500).render('pages/error', { pageTitle: 'Error', message: err.message });
  }
};

/* ── Admin: add item ─────────────────────────────────────────── */
exports.adminAddItem = async (req, res) => {
  const { handle } = req.params;
  const { label, url, is_highlight, is_mega } = req.body;

  try {
    const [[menu]] = await bvoPool.query(`SELECT id FROM nav_menus WHERE handle=?`, [handle]);
    if (!menu) { req.session.flash = { type: 'error', msg: 'Menu not found.' }; return res.redirect('/admin/menus'); }

    const [[{ maxSort }]] = await bvoPool.query(
      `SELECT COALESCE(MAX(sort_order),0) AS maxSort FROM nav_menu_items WHERE menu_id=?`, [menu.id]
    );
    await bvoPool.query(
      `INSERT INTO nav_menu_items (menu_id, label, url, sort_order, is_highlight, is_mega) VALUES (?,?,?,?,?,?)`,
      [menu.id, (label || '').trim(), (url || '').trim(), maxSort + 10,
       is_highlight === 'true' || is_highlight === '1' ? 1 : 0,
       /* Only main-menu can carry the flag. A footer column has no flyout,
          and a stray 1 there would be invisible until someone wondered why
          a footer link behaved oddly. */
       (handle === 'main-menu' && (is_mega === 'true' || is_mega === '1')) ? 1 : 0]
    );
    _invalidate(handle);
    req.session.flash = { type: 'success', msg: 'Item added.' };
  } catch (err) {
    req.session.flash = { type: 'error', msg: err.message };
  }
  res.redirect(`/admin/menus?menu=${handle}`);
};

/* ── Admin: update item ──────────────────────────────────────── */
exports.adminUpdateItem = async (req, res) => {
  const { handle, itemId } = req.params;
  const { label, url, is_highlight, is_mega } = req.body;

  try {
    await bvoPool.query(
      `UPDATE nav_menu_items SET label=?, url=?, is_highlight=?, is_mega=? WHERE id=?`,
      [(label || '').trim(), (url || '').trim(),
       is_highlight === 'true' || is_highlight === '1' ? 1 : 0,
       (handle === 'main-menu' && (is_mega === 'true' || is_mega === '1')) ? 1 : 0,
       itemId]
    );
    _invalidate(handle);
    req.session.flash = { type: 'success', msg: 'Item updated.' };
  } catch (err) {
    req.session.flash = { type: 'error', msg: err.message };
  }
  res.redirect(`/admin/menus?menu=${handle}`);
};

/* ── Admin: delete item ──────────────────────────────────────── */
exports.adminDeleteItem = async (req, res) => {
  const { handle, itemId } = req.params;
  try {
    await bvoPool.query(`DELETE FROM nav_menu_items WHERE id=?`, [itemId]);
    _invalidate(handle);
    req.session.flash = { type: 'success', msg: 'Item removed.' };
  } catch (err) {
    req.session.flash = { type: 'error', msg: err.message };
  }
  res.redirect(`/admin/menus?menu=${handle}`);
};

/* ── Admin: reorder items (AJAX POST, JSON body) ─────────────── */
exports.adminReorder = async (req, res) => {
  const { handle } = req.params;
  const { order }  = req.body; // array of {id, sort_order}

  if (!Array.isArray(order)) return res.status(400).json({ ok: false, error: 'order must be an array' });

  try {
    for (const { id, sort_order } of order) {
      await bvoPool.query(`UPDATE nav_menu_items SET sort_order=? WHERE id=?`, [sort_order, id]);
    }
    _invalidate(handle);
    res.json({ ok: true });
  } catch (err) {
    console.error('[menusController] adminReorder:', err.message);
    res.status(500).json({ ok: false, error: 'An unexpected error occurred.' });
  }
};

/* ═══════════════ HEADER HELPER ══════════════════════════════════ */

/**
 * getMenuItems(handle)
 * Returns cached items for any menu handle.
 * Used in megaMenuData or a dedicated middleware to populate header nav.
 */
exports.getMenuItems = async (handle) => {
  const now = Date.now();
  if (_menuCache[handle] && _cacheExpiry[handle] > now) return _menuCache[handle];

  try {
    const [[menu]] = await bvoPool.query(`SELECT id FROM nav_menus WHERE handle=?`, [handle]);
    if (!menu) { _menuCache[handle] = []; _cacheExpiry[handle] = now + TTL_MS; return []; }

    const [items] = await bvoPool.query(
      `SELECT id, label, url, sort_order, is_highlight
       FROM nav_menu_items WHERE menu_id=? ORDER BY sort_order, id`,
      [menu.id]
    );
    _menuCache[handle]   = items;
    _cacheExpiry[handle] = now + TTL_MS;
    return items;
  } catch {
    return [];
  }
};
