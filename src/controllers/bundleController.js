'use strict';

const { bvoPool }              = require('../config/database');
const { FAMILIES }             = require('../config/colorFamilies');
const { SIZE_BUCKETS }         = require('../config/sizeBuckets');

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

/* ── Step 1: Cabinet Only (stone-top-compatible) ──────────────────────
   Returns JM cabinet-only SKUs whose depth qualifies them for stone tops.
   (Taxonomy overhaul 2026-07-31 — 4-value product_type system.)
   Ordered model ASC → width_in ASC → price ASC.
   ──────────────────────────────────────────────────────────────────────
   STONE-TOP COMPATIBILITY RULE (James Martin only — 2026-07-31):
     JM cabinets with depth_in >= 22.5" accept the 23–23.5" stone tops
     (Quartz/Marble). Shallower cabinets require Composite tops and are
     not shown in the bundle builder (which is stone-top-focused).
     This rule is JM-SPECIFIC — other brands have different depth specs
     and must NOT be filtered by this threshold when added to BVO.
   ────────────────────────────────────────────────────────────────────── */
async function getCabinets() {
  const [rows] = await bvoPool.execute(`
    SELECT
      p.id, p.slug, p.name, p.model, p.price, p.compare_price,
      p.width_in, p.color, p.color_family,
      ${IMG_SQL},
      ${CHIP_SQL}
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    /* Stone-top depth filter: only JM cabinets >= 22.5" deep take stone tops */
    INNER JOIN product_attribute_values pav_depth
      ON  pav_depth.product_id = p.id
      AND pav_depth.attr_key   = 'depth_in'
      AND pav_depth.value_num  >= 22.5
    WHERE p.brand           = ?
      AND c.slug            = 'bathroom-vanities'
      AND p.product_type IN ('Single Sink Cabinet Only', 'Double Sink Cabinet Only')
      AND p.is_active       = 1
    ORDER BY p.model ASC, p.width_in ASC, p.price ASC
  `, [JM_BRAND, JM_BRAND]);
  return rows;
}

/* ── Step 2: Stone Tops only (Quartz + Marble) ────────────────────────
   Width filtering done client-side: once a cabinet is selected, only
   tops matching that width_in are shown (finish-only viewer, no size
   chips — width is locked to the chosen cabinet).
   Filters on product_type = 'Stone Top' — set by the importer when
   name/countertop_material contains 'Quartz' or 'Marble'.
   (Replaces fragile LIKE pattern; requires importer re-run + DB update.) */
async function getTops() {
  const [rows] = await bvoPool.execute(`
    SELECT
      p.id, p.slug, p.name, p.model, p.price, p.compare_price,
      p.width_in, p.color, p.color_family,
      ${IMG_SQL},
      ${CHIP_SQL}
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE p.brand          = ?
      AND c.slug           = 'bathroom-vanity-tops'
      AND p.product_type   = 'Stone Top'
      AND p.is_active      = 1
    ORDER BY p.model ASC, p.width_in ASC, p.price ASC
  `, [JM_BRAND, JM_BRAND]);
  return rows;
}

/* ── Step 3: Mirrors ─────────────────────────────────────────────────
   JM mirrors matched by model to the selected cabinet.                 */
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
      AND (c.slug = 'accessories' OR c.slug = 'bathroom-mirrors')
      AND p.product_type  LIKE '%Mirror%'
      AND p.is_active     = 1
    ORDER BY p.model ASC, p.width_in ASC, p.price ASC
  `, [JM_BRAND, JM_BRAND]);
  return rows;
}

/* ── Step 4: Faucets (all brands) ────────────────────────────────────
   JM vanities use standard 8" widespread faucet holes — any brand fits.
   No CHIP_SQL here: faucets are not JM products and have no sample chips.
   Initial brand: Huntington Brass. Additional brands added over time.
   NOTE: Do NOT restrict by brand = JM_BRAND — faucets are intentionally
   multi-brand and the bundle builder note explains universal compatibility. */
async function getFaucets() {
  const [rows] = await bvoPool.execute(`
    SELECT
      p.id, p.slug, p.name, p.model, p.brand, p.price, p.compare_price,
      p.width_in, p.color, p.color_family,
      ${IMG_SQL}
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE c.slug       = 'faucets'
      AND p.is_active  = 1
    ORDER BY p.brand ASC, p.model ASC, p.price ASC
  `);
  return rows;
}

/* ── Stone sample helpers for Step 2 material swatches ───────────────
   JM ships "Stone Sample - <Material>" products (category_id=10) for
   every countertop material.  We fetch them here and match each stone
   top to its sample image by word-overlap so the bundle builder can
   show a photo swatch for each material rather than a plain colour dot.
   ──────────────────────────────────────────────────────────────────── */
async function getStoneSamples() {
  const [rows] = await bvoPool.execute(`
    SELECT
      p.name,
      COALESCE(
        (SELECT pi.url FROM product_images pi
         WHERE pi.product_id = p.id
         ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1),
        p.primary_image_url
      ) AS img_url
    FROM products p
    WHERE p.brand       = ?
      AND p.category_id = 10
      AND p.name        LIKE 'Stone Sample -%'
      AND p.is_active   = 1
    ORDER BY p.name ASC
  `, [JM_BRAND]);
  return rows;
}

/** Extract material name from a top product name.
 *  "Brooklyn 60\" W x 23\" D Stone Top, 3 CM Carrara White Marble w/ Sink"
 *  → "Carrara White Marble"                                               */
function extractTopMaterial(topName) {
  // Stop at "w/" — don't require "Sink" immediately after (handles "w/ Undermount Sink", "w/ Rectangular Sink", etc.)
  const m = topName.match(/,\s*\d+(?:\.\d+)?\s*CM\s+(.+?)\s+w\//i);
  return m ? m[1].trim() : '';
}

/** Count words longer than 3 chars that appear in both strings. */
function wordOverlapScore(a, b) {
  const wordsA = a.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const setB   = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  return wordsA.filter(w => setB.has(w)).length;
}

/** Adds stone_material + stone_image fields to each top row. */
function enrichTopsWithMaterial(topRows, sampleRows) {
  const samples = sampleRows.map(s => ({
    material: s.name.replace(/^Stone Sample\s*-\s*/i, '').trim(),
    imgUrl:   s.img_url || null,
  }));

  return topRows.map(top => {
    const material = extractTopMaterial(top.name);
    let bestImg   = null;
    let bestScore = 0;
    for (const sample of samples) {
      const score = wordOverlapScore(material, sample.material);
      if (score > bestScore) { bestScore = score; bestImg = sample.imgUrl; }
    }
    return { ...top, stone_material: material, stone_image: bestScore > 0 ? bestImg : null };
  });
}

/* ── GET /bundle-builder ─────────────────────────────────────────────── */
exports.getBundleBuilder = async (req, res) => {
  try {
    const [cabinets, rawTops, mirrors, faucets, stoneSamples] = await Promise.all([
      getCabinets(),
      getTops(),
      getMirrors(),
      getFaucets(),
      getStoneSamples(),
    ]);
    const tops = enrichTopsWithMaterial(rawTops, stoneSamples);

    res.render('pages/bundle-builder', {
      pageTitle:     'Build Your James Martin Bundle | BathroomVanitiesOutlet.com',
      metaDesc:      'Build your dream bathroom from James Martin\'s premium collection. Mix and match cabinets, tops, and mirrors — save up to 15% on your bundle.',
      canonicalUrl:  `${SITE_URL}/bundle-builder`,
      cabinetModels: groupByModel(cabinets),
      topModels:     groupByModel(tops),
      mirrorModels:  groupByModel(mirrors),
      faucetModels:  groupByModel(faucets),
      familyHex:     FAMILY_HEX,
      sizeBuckets:   SIZE_BUCKETS,
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
