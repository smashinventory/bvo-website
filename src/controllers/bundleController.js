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
   These are the swatch/chip photos JM provides with every collection.
   LOW-9 NOTE: CHIP_SQL contains one positional `?` placeholder (brand).
   Every query that embeds CHIP_SQL must supply `brand` as the FIRST
   parameter in its bind array, before any other params.                      */
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
   Returns JM cabinet-only SKUs eligible for the bundle builder.
   Ordered model ASC → width_in ASC → price ASC.
   ──────────────────────────────────────────────────────────────────────
   TWO SEPARATE GUARDS. Do not let one stand in for the other.

   1. BRAND — `p.brand = JM_BRAND`. This is what keeps other brands out.
      It is load-bearing: every ER Vanities cabinet is 21.63" deep, so it
      would clear the depth floor below. Removing the brand filter leaks
      all 73 of them into step 1.

   2. DEPTH FLOOR >= 21" — excludes the 43 JM cabinets at 15.4-19.63",
      which are small-format and pair with composite tops outside this
      flow. It is NOT a stone-top compatibility test.

   CORRECTED 2026-09-11. The floor was 22.5", on the stated rule that
   "cabinets >= 22.5 accept stone tops, shallower require Composite."
   That rule was false and it hid 19 cabinets:

     Gracyn  (D125) 21.38"   Lucian (D704) 21.38"   Allamari (D640) 21.5"

   All three are shallow AND take stone tops — the 060 Radius Cut
   Silestone range, which exists precisely for them. RC tops are 21.5"
   deep and are sold to these three collections and to nobody else.
   See JMV_CATALOGUE_STRUCTURE.md §2.3.

   PAIRING IS NOT DECIDED HERE, AND NOT BY DEPTH. Which tops fit which
   base comes from the product_components edge list, which carries JM's
   own combo -> top mapping for 4,198 of 4,199 combos. `depth_in` is
   inherited per finish rather than measured per part — it was wrong on
   51 SKUs until migration 019 — so it is a display label, not a join
   key. Never filter tops against a cabinet's depth.
   ────────────────────────────────────────────────────────────────────── */
async function getCabinets() {
  const [rows] = await bvoPool.execute(`
    SELECT
      p.id, p.sku, p.slug, p.name, p.model, p.price, p.compare_price,
      p.width_in, p.color, p.color_family, p.product_type,
      ${IMG_SQL},
      ${CHIP_SQL}
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    /* Depth FLOOR, not a compatibility test — drops the 15.4-19.63"
       small-format cabinets. See the block comment above. */
    INNER JOIN product_attribute_values pav_depth
      ON  pav_depth.product_id = p.id
      AND pav_depth.attr_key   = 'depth_in'
      AND pav_depth.value_num  >= 21
    /* p.brand is the BRAND guard — see the block comment above. Every ER
       Vanities cabinet is 21.63" deep and would clear the floor. */
    WHERE p.brand           = ?
      AND c.slug            = 'bathroom-vanities'
      AND p.product_type IN ('Single Sink Cabinet Only', 'Double Sink Cabinet Only')
      AND p.is_active       = 1
    ORDER BY p.model ASC, p.width_in ASC, p.price ASC
  `, [JM_BRAND, JM_BRAND]);
  return rows;
}

/* ── Step 2: Stone Tops ───────────────────────────────────────────────
   Returns every JM stone top. Which of them a customer actually sees is
   decided client-side against getCabinetTopMap() once a cabinet is
   chosen — incompatible tops are hidden, and each visible one carries a
   depth badge so the changing option set is legible rather than
   mysterious.

   product_type = 'Stone Top' is set by the importer's STONE_TERMS regex.
   It knows quartz, marble, silestone, eclos and carrara — JM names the
   brand rather than the substance, so a missing term silently drops a
   whole range from this query. That happened: 24 stone tops were typed
   Composite until 2026-09-11 (migration 020), six of them Radius Cut,
   which gave the shallow collections a partial list. See
   JMV_CATALOGUE_STRUCTURE.md §7a.                                       */
async function getTops() {
  const [rows] = await bvoPool.execute(`
    SELECT
      p.id, p.sku, p.slug, p.name, p.model, p.price, p.compare_price,
      p.width_in, p.color, p.color_family,
      CAST(pav_sink.value_num AS UNSIGNED) AS sink_count,
      pav_depth.value_num AS depth_in,
      jd.top_finish,
      /* The swatch row picks a FINISH. These pick between the tops that
         SHARE that finish. Measured over all 289 offered cabinets: 1,064
         finish groups hold more than one top, and 46 tops are reachable
         ONLY through this second control — the finish swatch alone lands
         on the group's first member and strands the rest.

         FREEPOWER COMES FROM wireless_charging, NOT jd.freepower.
         jmv_dimensions.freepower is 0 on all 203 top rows — it is only
         populated for combos. wireless_charging agrees with the '-FP-' SKU
         token and the product name on all 258 top rows, no exceptions.
         Sourcing it from jd.freepower made every FreePower pair render as
         two buttons reading '8" spread', which is how this was caught. */
      pav_fp.value_text AS freepower,
      pav_spread.value_text AS faucet_spread,
      pav_bsp.value_text    AS backsplash_included,
      ${IMG_SQL},
      ${CHIP_SQL}
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    LEFT JOIN product_attribute_values pav_sink
      ON  pav_sink.product_id = p.id
      AND pav_sink.attr_key   = 'sink_count'
    /* Depth is a DISPLAY LABEL only — it tells the customer why the option
       set changed when they switched base. Compatibility comes from
       getCabinetTopMap(). Never filter tops on this value. */
    LEFT JOIN product_attribute_values pav_depth
      ON  pav_depth.product_id = p.id
      AND pav_depth.attr_key   = 'depth_in'
    /* top_finish is the CLEAN material name — 'White Zeus', 'Phantome' —
       populated on all 177 active stone tops. Parsing it out of the product
       name fails on 49 of them; see enrichTopsWithMaterial(). */
    LEFT JOIN jmv_dimensions jd ON jd.sku = p.sku
    LEFT JOIN product_attribute_values pav_spread
      ON  pav_spread.product_id = p.id
      AND pav_spread.attr_key   = 'faucet_spread_in'
    LEFT JOIN product_attribute_values pav_bsp
      ON  pav_bsp.product_id = p.id
      AND pav_bsp.attr_key   = 'backsplash_included'
    LEFT JOIN product_attribute_values pav_fp
      ON  pav_fp.product_id = p.id
      AND pav_fp.attr_key   = 'wireless_charging'
    /* STOCK GATE. A top with nothing on hand is not an option — offering it
       costs a customer the configuration they just built. Backorderable rows
       are still offered, because those ARE sellable.

       Safe to apply: all 177 active stone tops carry an inventory row, only 8
       sit at zero, none of those allows backorder, and no cabinet loses its
       whole top list. Gated so that stays true. */
    INNER JOIN inventory inv ON inv.product_id = p.id
    WHERE p.brand          = ?
      AND c.slug           = 'bathroom-vanity-tops'
      AND p.product_type   = 'Stone Top'
      AND p.is_active      = 1
      AND (inv.qty_on_hand > 0 OR inv.allow_backorder = 1)
    ORDER BY p.model ASC, p.width_in ASC, p.price ASC
  `, [JM_BRAND, JM_BRAND]);
  return rows;
}

/* ── Cabinet → compatible tops ────────────────────────────────────────
   THE authority on which top fits which cabinet. Not depth, not width,
   not finish — JM's own combo bill of materials.

   `product_components` carries the exact combo -> top edge for 4,198 of
   the 4,199 JM combos, straight from the vendor feed. A cabinet's
   compatible tops are the tops of every combo built on that cabinet:

     cabinet --(collection + base_finish + size_nominal)--> combos
             --(product_components, role 'top')-----------> tops

   sinks is DELIBERATELY absent from the cabinet->combo key: a cabinet
   carries sinks = 0 and its combo sinks = 1, so including it matches
   nothing. The single/double distinction still comes through, because
   each combo names its own sink-specific top.

   The component SKU is abbreviated in the feed and needs up to three
   transforms to reach products.sku — the dropped '-SNK' suffix, the
   dropped 'BS' backsplash token, and S46 -> S46R. All 194 distinct
   components resolve under these four forms; scripts/jmv_scrub.py
   asserts that none is left over.

   WHY NOT DEPTH: depth_in is inherited per finish rather than measured
   per part — it was wrong on 51 SKUs until migration 019. It is a label
   for the customer, never a join key. See JMV_CATALOGUE_STRUCTURE.md
   §2.3.                                                                */
async function getCabinetTopMap() {
  const [rows] = await bvoPool.execute(`
    SELECT cab.sku AS cabinet_sku, t.sku AS top_sku
      FROM jmv_dimensions cab
      JOIN jmv_dimensions combo
        ON combo.product_type  = 'Vanity'
       AND combo.collection    = cab.collection
       AND combo.base_finish   = cab.base_finish
       AND combo.size_nominal  = cab.size_nominal
      JOIN product_components pc
        ON pc.parent_sku     = combo.sku
       AND pc.component_role = 'top'
      JOIN products t
        ON t.sku IN (pc.component_sku,
                     CONCAT(pc.component_sku, '-SNK'),
                     /* backsplash token: 051-S36-WZ -> 051-S36-BS-WZ. The BS
                        goes before the FINISH, i.e. before the last dash.
                        REPLACE(sku,'-S','-BS-S') looks equivalent and is not
                        — it hits the first '-S' and yields 051-BS-S36-WZ,
                        which matches nothing and drops all six backsplash
                        tops from the builder. */
                     CONCAT(SUBSTRING_INDEX(pc.component_sku, '-', 2), '-BS-',
                            SUBSTRING_INDEX(pc.component_sku, '-', -1)),
                     CONCAT(REPLACE(pc.component_sku, '-S46-', '-S46R-'), '-SNK'))
     WHERE cab.product_type = 'Cabinet'
       AND t.is_active      = 1
     GROUP BY cab.sku, t.sku
  `);
  const map = Object.create(null);
  for (const r of rows) (map[r.cabinet_sku] ||= []).push(r.top_sku);
  return map;
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
/* ── Swatch imagery ───────────────────────────────────────────────────
   The picture of the stone, NOT the little sample you can buy.

   DELIBERATELY UNFILTERED by is_active and by stock. A swatch is a display
   asset: whether the $9.99 sample happens to be in stock has nothing to do
   with whether we can show the customer what the countertop looks like.
   Tajnar sat at QTY 0 while its swatch was the only thing telling anyone
   what Tajnar looks like.

   Two naming conventions, Swatch Sample preferred:
     "Swatch Sample - <finish>"  imagery only, kept is_active = 0 so it never
                                 reaches the storefront. Use this for finishes
                                 with no sellable sample.
     "Stone Sample - <finish>"   the sellable sample; its image is reused when
                                 no Swatch Sample exists.

   The finish must match jmv_dimensions.top_finish exactly, case-insensitively
   — see finishKey(). "Stone Sample - White Zeus" pairs with top_finish
   "White Zeus".                                                          */
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
      AND (p.name LIKE 'Swatch Sample -%' OR p.name LIKE 'Stone Sample -%')
    ORDER BY
      /* A row with no imagery must never outrank one that has some. 021
         inserted three imageless duplicates that shared a name with the
         real samples, and name-order ties could have handed the swatch to
         the empty row. Defensive: the DB should not contain those any
         more (022), but the query should not depend on that. */
      CASE WHEN COALESCE(
             (SELECT pi3.url FROM product_images pi3
               WHERE pi3.product_id = p.id
               ORDER BY pi3.sort_order ASC, pi3.id ASC LIMIT 1),
             p.primary_image_url) IS NULL THEN 1 ELSE 0 END,
      /* Swatch Sample wins where both exist. */
      CASE WHEN p.name LIKE 'Swatch Sample -%' THEN 0 ELSE 1 END,
      p.name ASC
  `, [JM_BRAND]);
  return rows;
}

/** Extract material name from a top product name — FALLBACK ONLY.
 *  "Brooklyn 60\" W x 23\" D Stone Top, 3 CM Carrara White Marble w/ Sink"
 *  → "Carrara White Marble"
 *
 *  Prefer jmv_dimensions.top_finish. This regex wants ", <N> CM <material> w/"
 *  and JM writes the same fact at least four ways, so it returns '' on 49 of
 *  the 177 active stone tops:
 *
 *    "...Radius Cut Top, Widespread 3CM Phantome Eclos w/ Sink"  <- word before CM
 *    "84\" Double Top, 3 CM White Zeus Silestone"                <- no "w/"
 *    "...White Zeus Silestone, 3 CM, No Sink"                    <- order swapped
 *    "26\" Single Top For the 301 Collection, Eternal Serena..."  <- clause first
 *
 *  An empty material is not merely a missing label: the swatch row dedupes on
 *  it, so every unparsed top collapses into ONE shared swatch. Gracyn 36"
 *  showed 3 swatches for 7 tops with three different stones hidden behind one
 *  tile. Kept only for non-JM rows that have no jmv_dimensions entry.       */
function extractTopMaterial(topName) {
  const m = String(topName || '').match(/,\s*\d+(?:\.\d+)?\s*CM\s+(.+?)\s+w\//i);
  return m ? m[1].trim() : '';
}

/** Case/space-insensitive key for matching a finish to its sample product. */
function finishKey(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
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
    material: s.name.replace(/^(?:Swatch|Stone) Sample\s*-\s*/i, '').trim(),
    imgUrl:   s.img_url || null,
  }));

  /* Exact finish -> sample first. 'STONE SAMPLE - PHANTOME' and a top whose
     top_finish is 'Phantome' are the same stone; word overlap used to decide
     that by counting shared words > 3 chars, which is both fragile and prone
     to cross-matching ('Eternal Marfil' vs 'Eternal Serena' share a word). */
  const byFinish = new Map();
  for (const s of samples) if (!byFinish.has(finishKey(s.material))) {
    byFinish.set(finishKey(s.material), s.imgUrl);
  }

  return topRows.map(top => {
    const material = top.top_finish || extractTopMaterial(top.name);

    let img = byFinish.get(finishKey(material)) || null;
    if (!img) {                       // fall back to the old fuzzy match
      let bestScore = 0;
      for (const sample of samples) {
        const score = wordOverlapScore(material, sample.material);
        if (score > bestScore) { bestScore = score; img = sample.imgUrl; }
      }
      if (!bestScore) img = null;
    }
    return { ...top, stone_material: material, stone_image: img };
  });
}

/* ── GET /bundle-builder ─────────────────────────────────────────────── */
exports.getBundleBuilder = async (req, res) => {
  try {
    const [cabinets, rawTops, mirrors, faucets, stoneSamples, topCompat] = await Promise.all([
      getCabinets(),
      getTops(),
      getMirrors(),
      getFaucets(),
      getStoneSamples(),
      getCabinetTopMap(),
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
      /* { cabinetSku: [topSku, ...] } — JM's own combo bill of materials. */
      topCompat,
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
