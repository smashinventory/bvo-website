'use strict';

/**
 * megaMenuData middleware
 *
 * Populates res.locals with dynamic mega menu content on every request:
 *   res.locals.megaMenuSizes         — size bucket labels with ≥1 active product
 *   res.locals.megaMenuColorFamilies — cabinet color families with ≥1 active vanity
 *
 * Results are cached in-memory for CACHE_TTL_MS (10 min) to avoid a DB hit
 * on every page load. Cache is shared across all requests for the Node process.
 * On the next import or product update, the stale cache expires naturally.
 *
 * Canonical sources (Rule 10):
 *   Size  → products.width_in bucketed via SIZE_BUCKETS
 *   Color → products.color_family filtered through FAMILIES (cabinet type, category 1)
 */

const { bvoPool }    = require('../config/database');
const { FAMILIES }   = require('../config/colorFamilies');
const { SIZE_BUCKETS } = require('../config/sizeBuckets');

const CACHE_TTL_MS   = 10 * 60 * 1000; // 10 minutes
const VANITY_CAT_ID  = 1;

let _cache     = null;
let _cacheTime = 0;

// Separate short-lived cache for CMS data (nav/pages change more often)
let _cmsCache     = null;
let _cmsCacheTime = 0;
const CMS_TTL_MS  = 5 * 60 * 1000; // 5 minutes

async function loadCmsData() {
  const now = Date.now();
  if (_cmsCache && (now - _cmsCacheTime) < CMS_TTL_MS) return _cmsCache;

  try {
    const [navItems, footerItems, cmsPages] = await Promise.all([
      bvoPool.query(`
        SELECT ni.id, ni.label, ni.url, ni.sort_order, ni.is_highlight, ni.is_mega
        FROM nav_menu_items ni
        JOIN nav_menus nm ON nm.id = ni.menu_id
        WHERE nm.handle = 'main-menu'
        ORDER BY ni.sort_order, ni.id
      `).then(([r]) => r),
      /* Footer columns — one menu per column, handles footer-shop /
         footer-help / footer-company (migration 015).

         Until this query existed, the Menu Manager had a 'footer' menu
         that saved correctly and was read by nothing, while footer.ejs
         rendered a hardcoded list from theme settings whose URLs were all
         404s. Two systems, and the one with correct data was the one being
         ignored. This is the read that makes the editor real. */
      bvoPool.query(`
        SELECT nm.handle, ni.label, ni.url, ni.sort_order, ni.is_highlight
        FROM nav_menu_items ni
        JOIN nav_menus nm ON nm.id = ni.menu_id
        WHERE nm.handle IN ('footer-shop','footer-help','footer-company')
        ORDER BY ni.sort_order, ni.id
      `).then(([r]) => r),
      bvoPool.query(`
        SELECT id, slug, title, sort_order FROM pages
        WHERE is_visible=1 ORDER BY sort_order ASC, id ASC
      `).then(([r]) => r),
    ]);

    /* Grouped by column. Empty arrays rather than undefined, so the
       template can test length without guarding for the key. */
    const footerMenus = { shop: [], help: [], company: [] };
    const _col = { 'footer-shop': 'shop', 'footer-help': 'help', 'footer-company': 'company' };
    for (const it of footerItems) footerMenus[_col[it.handle]].push(it);

    _cmsCache     = { navMenuItems: navItems, footerMenus, cmsPages };
    _cmsCacheTime = now;
    return _cmsCache;
  } catch {
    /* Tables may not exist yet on first deploy — return empty gracefully.
       footerMenus MUST carry its three empty arrays: the footer template
       reads .shop/.help/.company lengths directly, and an undefined here
       would throw on every page render rather than degrading. */
    return {
      navMenuItems: [],
      footerMenus:  { shop: [], help: [], company: [] },
      cmsPages:     [],
    };
  }
}

async function loadMegaMenuData() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL_MS) return _cache;

  try {
    // Run both queries in parallel
    const [[widthRows], [colorRows]] = await Promise.all([
      // All distinct active vanity widths (covers all categories for sizes)
      bvoPool.query(`
        SELECT DISTINCT p.width_in
        FROM products p
        WHERE p.is_active = 1
          AND p.width_in IS NOT NULL AND p.width_in > 0
          AND p.category_id = ?
        ORDER BY p.width_in
      `, [VANITY_CAT_ID]),

      // Distinct cabinet color families for active vanities
      bvoPool.query(`
        SELECT DISTINCT p.color_family
        FROM products p
        WHERE p.is_active = 1
          AND p.category_id = ?
          AND p.color_family IS NOT NULL
      `, [VANITY_CAT_ID]),
    ]);

    // Map widths → bucket labels (only populated buckets)
    const widths = widthRows.map(r => parseFloat(r.width_in)).filter(Boolean);
    const megaMenuSizes = SIZE_BUCKETS
      .filter(b => widths.some(w => w >= b.min && w <= b.max))
      .map(b => b.label);

    // Map color_family keys → FAMILIES objects (cabinet only, preserve FAMILIES order)
    const availableKeys = new Set(colorRows.map(r => r.color_family).filter(Boolean));
    const megaMenuColorFamilies = FAMILIES
      .filter(f => f.type === 'cabinet' && availableKeys.has(f.key))
      .map(f => ({ key: f.key, label: f.label, hex: f.hex, border: f.border }));

    _cache     = { megaMenuSizes, megaMenuColorFamilies };
    _cacheTime = now;
    return _cache;
  } catch (err) {
    // On DB error return empty arrays — mega menu degrades gracefully
    console.error('[megaMenuData] DB error:', err.message);
    return { megaMenuSizes: [], megaMenuColorFamilies: [] };
  }
}

/* Clear the CMS cache so a Menu Manager save shows up immediately instead
   of up to CMS_TTL_MS later. Exported so menusController can call it —
   an invalidator nobody calls is just a comment. */
function bustCmsCache() {
  _cmsCache     = null;
  _cmsCacheTime = 0;
}

module.exports = async function megaMenuData(req, res, next) {
  const [data, cms] = await Promise.all([loadMegaMenuData(), loadCmsData()]);
  res.locals.megaMenuSizes         = data.megaMenuSizes;
  res.locals.megaMenuColorFamilies = data.megaMenuColorFamilies;
  res.locals.navMenuItems          = cms.navMenuItems;   // DB-driven main nav
  res.locals.footerMenus           = cms.footerMenus;    // DB-driven footer columns
  res.locals.cmsPages              = cms.cmsPages;       // DB pages (last-resort fallback)

  /* ── Main menu: Menu Manager is the source ─────────────────────────
     Until 2026-09-14 header.ejs rendered nav.links from THEME SETTINGS
     while this middleware loaded navMenuItems from the Menu Manager and
     handed it to a template that read it nowhere. Editing Menus → Main
     Menu changed nothing on the storefront, and the screen that did work
     was the one labelled "Logo & Header". Exactly the footer bug
     described above, still open, one table over.

     header.ejs is deliberately NOT rewritten. It keeps reading
     nav.links; we swap what nav.links IS. One assignment, and the mega
     menu / mobile menu / highlight rendering stay byte-identical.

     Falls back to theme settings when Main Menu is empty, so a fresh
     install or a truncated table degrades to the old behaviour rather
     than rendering a header with no links at all.

     Override settings.nav.links, NOT res.locals.nav. header.ejs line 1
     does `const nav = S.nav || {}` off res.locals.settings — setting
     res.locals.nav would be read by nothing at all.

     CLONED, never mutated in place: res.locals.settings is the object
     themeSettings.get() hands to every request. Writing through it would
     corrupt the cached settings process-wide, and the Theme Editor would
     start showing menu items it does not own.                          */
  if (Array.isArray(cms.navMenuItems) && cms.navMenuItems.length) {
    const s = res.locals.settings || {};
    res.locals.settings = Object.assign({}, s, {
      nav: Object.assign({}, s.nav || {}, {
        links: cms.navMenuItems.map(i => ({
          label:     i.label,
          url:       i.url,
          highlight: !!i.is_highlight,
          megaMenu:  !!i.is_mega,
        })),
      }),
    });
  }

  next();
};

module.exports.bustCmsCache = bustCmsCache;
