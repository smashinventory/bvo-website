'use strict';

const { bvoPool }              = require('../config/database');
const { FAMILIES }             = require('../config/colorFamilies');

const JM_BRAND = 'James Martin Vanities';
const SITE_URL = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';

/* ── Color family hex lookup (sent to client as JSON for fallback swatches) */
const FAMILY_HEX = {};
FAMILIES.forEach(f => {
  FAMILY_HEX[f.key]            = f.hex;
  FAMILY_HEX[f.key + '_border']= f.border || f.hex;
});

/* ── Shared image COALESCE fragment ─────────────────────────────────── */
const IMG_SQL = `
  COALESCE(
    (SELECT pi.url FROM product_images pi
     WHERE pi.product_id = p.id
     ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1),
    p.primary_image_url
  ) AS primary_image
`;

/* ── Color chip image — looks up a matching Sample product (category_id=10)
   that shares the same brand + model + color as the cabinet/top/mirror SKU.
   These are the swatch/chip photos JM provides with every collection.       */
const CHIP_SQL = `
  (SELECT pi2.url FROM product_images pi2
   INNER JOIN products s ON s.id = pi2.product_id
   WHERE s.brand       = ?
     AND s.model       = p.model
     AND s.color       = p.color
     AND s.category_id = 10
   ORDER BY pi2.sort_order ASC, pi2.id ASC LIMIT 1) AS chip_image
`;

/* ── Group flat rows by model name ──────────────────────────────────── */
function groupByModel(rows) {
  const map = new Map();
  for (const row of rows) {
    const m = row.model || 'Other';
    if (!map.has(m)) map.set(m, []);
    map.get(m).push(row);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([model, skus]) => ({ model, skus }));
}

/* ── Step 1: Cabinet Only ─────────────────────────────────────────────
   Matches the megamenu "Cabinet Only" link:
     /collections/bathroom-vanities?type=Cabinet+Only
   which filters on products.product_type = 'Cabinet Only'.
   Ordered model ASC → width_in ASC → price ASC so each model's
   sizes and price tiers are naturally arranged.                         */
async function getCabinets() {
  const [rows] = await bvoPool.execute(`
    SELECT
      p.id, p.slug, p.name, p.model, p.price, p.compare_price,
      p.width_in, p.color, p.color_family,
      ${IMG_SQL},
      ${CHIP_SQL}
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE p.brand        = ?
      AND c.slug         = 'vanities'
      AND p.product_type = 'Cabinet Only'
      AND p.is_active    = 1
    ORDER BY p.model ASC, p.width_in ASC, p.price ASC
  `, [JM_BRAND, JM_BRAND]);
  return rows;
}

/* ── Step 2: Vanity Tops (quartz + marble only) ───────────────────────
   Width filtering is done client-side: once a cabinet is selected,
   only tops matching that width_in are shown. Finish-only viewer
   (no size chips — width is locked to the chosen cabinet).              */
async function getTops() {
  const [rows] = await bvoPool.execute(`
    SELECT
      p.id, p.slug, p.name, p.model, p.price, p.compare_price,
      p.width_in, p.color, p.color_family,
      ${IMG_SQL},
      ${CHIP_SQL}
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE p.brand      = ?
      AND c.slug       = 'vanity-tops'
      AND p.is_active  = 1
      AND (
        p.name         LIKE '%Quartz%'
        OR p.name      LIKE '%Marble%'
        OR p.product_type LIKE '%Quartz%'
        OR p.product_type LIKE '%Marble%'
      )
    ORDER BY p.model ASC, p.width_in ASC, p.price ASC
  `, [JM_BRAND, JM_BRAND]);
  return rows;
}

/* ── Step 3: Mirrors ─────────────────────────────────────────────────  */
async function getMirrors() {
  const [rows] = await bvoPool.execute(`
    SELECT
      p.id, p.slug, p.name, p.model, p.price, p.compare_price,
      p.width_in, p.color, p.color_family,
      ${IMG_SQL},
      ${CHIP_SQL}
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE p.brand         = ?
      AND (c.slug = 'accessories' OR c.slug = 'mirrors')
      AND p.product_type  LIKE '%Mirror%'
      AND p.is_active     = 1
    ORDER BY p.model ASC, p.width_in ASC, p.price ASC
  `, [JM_BRAND, JM_BRAND]);
  return rows;
}

/* ── GET /bundle-builder ─────────────────────────────────────────────── */
exports.getBundleBuilder = async (req, res) => {
  try {
    const [cabinets, tops, mirrors] = await Promise.all([
      getCabinets(),
      getTops(),
      getMirrors(),
    ]);

    res.render('pages/bundle-builder', {
      pageTitle:     'Build Your James Martin Bundle | BathroomVanitiesOutlet.com',
      metaDesc:      'Build your dream bathroom from James Martin\'s premium collection. Mix and match cabinets, tops, and mirrors — save up to 15% on your bundle.',
      canonicalUrl:  `${SITE_URL}/bundle-builder`,
      cabinetModels: groupByModel(cabinets),
      topModels:     groupByModel(tops),
      mirrorModels:  groupByModel(mirrors),
      familyHex:     FAMILY_HEX,
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
