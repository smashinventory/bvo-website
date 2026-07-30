'use strict';

const { bvoPool } = require('../config/database');

const JM_BRAND  = 'James Martin Vanities';
const SITE_URL  = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';

/* ── Shared image COALESCE fragment ────────────────────────────── */
const IMG_SQL = `
  COALESCE(
    (SELECT pi.url FROM product_images pi
     WHERE pi.product_id = p.id
     ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1),
    p.primary_image_url
  ) AS primary_image
`;

/* ── Step 1 — JM Cabinet Only ───────────────────────────────────
   category = vanities, product_type = 'Cabinet Only'
   Ordered by width ASC then price ASC so sizes group naturally.   */
async function getCabinets() {
  const [rows] = await bvoPool.execute(`
    SELECT
      p.id, p.slug, p.name, p.price, p.compare_price,
      p.width_in, p.color, p.color_family, p.model,
      ${IMG_SQL}
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE p.brand     = ?
      AND c.slug      = 'vanities'
      AND p.product_type = 'Cabinet Only'
      AND p.is_active = 1
    ORDER BY p.width_in ASC, p.price ASC
  `, [JM_BRAND]);
  return rows;
}

/* ── Step 2 — JM Vanity Tops ────────────────────────────────────
   Loaded in full; client-side filtered by width_in to match
   whichever cabinet the shopper selected.                         */
async function getTops() {
  /* Quartz and marble only — exclude composite/cultured tops */
  const [rows] = await bvoPool.execute(`
    SELECT
      p.id, p.slug, p.name, p.price, p.compare_price,
      p.width_in, p.color, p.color_family, p.model,
      ${IMG_SQL}
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE p.brand     = ?
      AND c.slug      = 'vanity-tops'
      AND p.is_active = 1
      AND (
        p.name LIKE '%Quartz%'
        OR p.name LIKE '%Marble%'
        OR p.product_type LIKE '%Quartz%'
        OR p.product_type LIKE '%Marble%'
      )
    ORDER BY p.width_in ASC, p.price ASC
  `, [JM_BRAND]);
  return rows;
}

/* ── Step 3 — JM Mirrors ────────────────────────────────────────
   Per taxonomy (10B): mirrors live in 'accessories' category
   with product_type LIKE '%Mirror%'. Guard 'mirrors' slug too
   in case the importer routed them there.                         */
async function getMirrors() {
  const [rows] = await bvoPool.execute(`
    SELECT
      p.id, p.slug, p.name, p.price, p.compare_price,
      p.width_in, p.color, p.color_family, p.model,
      ${IMG_SQL}
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE p.brand      = ?
      AND (c.slug = 'accessories' OR c.slug = 'mirrors')
      AND p.product_type LIKE '%Mirror%'
      AND p.is_active = 1
    ORDER BY p.width_in ASC, p.price ASC
  `, [JM_BRAND]);
  return rows;
}

/* ── GET /bundle-builder ────────────────────────────────────────── */
exports.getBundleBuilder = async (req, res) => {
  try {
    const [cabinets, tops, mirrors] = await Promise.all([
      getCabinets(),
      getTops(),
      getMirrors(),
    ]);

    res.render('pages/bundle-builder', {
      pageTitle:    'Build Your James Martin Bundle | BathroomVanitiesOutlet.com',
      metaDesc:     'Build your dream bathroom from James Martin\'s premium collection. Mix and match cabinets, tops, and mirrors — save up to 15% on your bundle.',
      canonicalUrl: `${SITE_URL}/bundle-builder`,
      cabinets,
      tops,
      mirrors,
    });
  } catch (err) {
    console.error('[bundle] getBundleBuilder error:', err);
    res.status(500).render('pages/error', {
      pageTitle: 'Error | BathroomVanitiesOutlet.com',
      message:   process.env.NODE_ENV === 'production'
        ? 'Unable to load the bundle builder right now.'
        : err.message,
    });
  }
};
