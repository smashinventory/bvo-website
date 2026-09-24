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
    /* WIDESPREAD OPENS THE CARD. activeTops() turns every top into its own
       entry and renderTopMatSwatches() keeps the FIRST one it meets per
       stone material, so whatever this ORDER BY puts first is what the
       shopper lands on when they pick a finish.

       Before this key existed the winner was simply the cheapest, and that
       gave the right answer 1,217 times out of 1,323 by luck rather than by
       rule. The 106 that opened on single-hole came from two places:

         - 60" single-sink White Zeus, where JM's own MAP puts the
           single-hole + backsplash top at $1,245 against $1,249 for the
           plain widespread. Four dollars decided the default.
         - The Radius Cut pairs — 36"/48" White Zeus and Victorian Silver —
           where RC and RCWS carry the SAME price. On a tie MySQL promises
           nothing, so which one opened the card could change between
           restarts with no code change at all.

       <=> not =. NULL = '8' is NULL, and NULL sorts after 0 under DESC,
       which would split non-widespread tops into two silent buckets and
       leave the tie problem alive among them. The NULL-safe operator
       returns 1 or 0 and never NULL, so this is a clean two-way split.

       Depth is NOT at risk here: Radius Cut tops never share a card with
       another series, because getCabinetTopMap() already separates them by
       cabinet. Verified — 0 groups mix series across all 289 cabinets. */
    ORDER BY p.model ASC, p.width_in ASC,
             (pav_spread.value_text <=> '8') DESC,
             p.price ASC
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
/* The four forms a feed component SKU can take in products.sku.
   These are the EXACT MySQL expressions this used to run inside a join
   predicate, ported to JS. Keep them in lockstep with the comment above;
   scripts/verifyCabinetTopMap.js diffs this against the old SQL and fails
   if a single pair differs. */
function topSkuAliases(componentSku) {
  const s = String(componentSku);
  const parts = s.split('-');
  return [
    // pc.component_sku
    s,
    // CONCAT(pc.component_sku, '-SNK')
    s + '-SNK',
    // CONCAT(SUBSTRING_INDEX(s,'-',2), '-BS-', SUBSTRING_INDEX(s,'-',-1))
    //   MySQL's SUBSTRING_INDEX returns the WHOLE string when the delimiter
    //   appears fewer times than requested; slice/pop behave the same way,
    //   so a SKU with no dash still produces the same value it did before.
    parts.slice(0, 2).join('-') + '-BS-' + parts[parts.length - 1],
    // CONCAT(REPLACE(s,'-S46-','-S46R-'), '-SNK')
    //   REPLACE swaps EVERY occurrence, so split/join, not String.replace,
    //   which would only take the first.
    s.split('-S46-').join('-S46R-') + '-SNK',
  ];
}

/* WHY THE PRODUCTS JOIN IS GONE, 2026-09-24.
   ──────────────────────────────────────────
   This used to resolve the four alias forms inside the join itself:

       JOIN products t ON t.sku IN (pc.component_sku, CONCAT(...), ...)

   Every one of those is computed per row, so the index on products.sku
   could not be used. Measured on the live database:

       EXPLAIN  ->  t: type=ALL, key=NULL, rows=5192,
                       Using join buffer (flat, BNL join)
       intermediate: 5,452 rows
       runtime:      12.27 s

   5,452 x 5,192 is ~28M string-function evaluations per rebuild, and
   because buildCataloguePayload() runs all six queries under Promise.all,
   the whole catalogue rebuild cost whatever THIS cost. It was the entire
   11-second rebuild; the cabinets query next to it returns in ~60ms.

   Both halves are cheap on their own — the edge list is index-only across
   all three tables, and "every active SKU" is one pass. So they are
   fetched separately and matched here with a hash lookup: ~22,000 Map
   probes instead of 28M comparisons.

   CASE. The old join compared under the column collation, which is
   case-insensitive. The Map is therefore keyed on the UPPERCASED sku and
   stores the real one, so the value returned is still products.sku exactly
   as stored — matching behaviour, not just matching rows. */
async function getCabinetTopMap() {
  const [[edges], [skuRows]] = await Promise.all([
    bvoPool.execute(`
      SELECT cab.sku AS cabinet_sku, pc.component_sku AS component_sku
        FROM jmv_dimensions cab
        JOIN jmv_dimensions combo
          ON combo.product_type  = 'Vanity'
         AND combo.collection    = cab.collection
         AND combo.base_finish   = cab.base_finish
         AND combo.size_nominal  = cab.size_nominal
        JOIN product_components pc
          ON pc.parent_sku     = combo.sku
         AND pc.component_role = 'top'
       WHERE cab.product_type = 'Cabinet'
       GROUP BY cab.sku, pc.component_sku
    `),
    bvoPool.execute(`SELECT sku FROM products WHERE is_active = 1`),
  ]);

  const bySku = new Map();
  for (const r of skuRows) bySku.set(String(r.sku).toUpperCase(), r.sku);

  const map = Object.create(null);
  const seen = new Map();          // cabinet -> Set(topSku), the old GROUP BY

  for (const e of edges) {
    const cab = e.cabinet_sku;
    let set = seen.get(cab);
    if (!set) { set = new Set(); seen.set(cab, set); map[cab] = []; }

    for (const alias of topSkuAliases(e.component_sku)) {
      const real = bySku.get(alias.toUpperCase());
      if (real !== undefined && !set.has(real)) {
        set.add(real);
        map[cab].push(real);
      }
    }
  }

  /* A cabinet whose every alias missed used to produce no row at all and
     therefore no key. Preserve that: an empty array would read as "this
     cabinet has no compatible tops" rather than "not in the map". */
  for (const [cab, set] of seen) if (set.size === 0) delete map[cab];

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
/* ── Faucet drilling ─────────────────────────────────────────────────
   A JM top is drilled one of two ways, and a faucet only fits one of
   them. Before the Huntington Brass import this step showed a handful of
   faucets and the mismatch was invisible; the catalogue now holds 669
   rows under `faucets`, most of them shower parts, so an unfiltered step
   4 offers shower arms and drain assemblies as "faucets for your vanity".

   HB encodes the drilling in the product NAME, which is the Shopify
   series title the importer prefers — "Sevaun Widespread", "Joy Single
   Control", "Isabelle Center Set". Measured across the 154 Bathroom
   Faucets on 2026-09-14: 60 Single Control, 47 Widespread, 34 Center Set,
   4 Vessel, 4 Lavatory.

   Classified in SQL rather than JS so the value travels with the row and
   the client cannot disagree with the server about what fits what.

   CENTER SET IS NOT A MATCH FOR EITHER. It is a 4" three-hole spread; a
   JM top is drilled single-hole or 8" widespread and nothing else. Center
   Set and Vessel are therefore classified 'other' and never offered — a
   4" faucet on an 8" deck is a return, not a near-miss. */
/* Branch order is load-bearing: Widespread is tested FIRST, so a future
   "Somewhere Lavatory Widespread" lands on widespread rather than being
   caught by the Lavatory test below. Do not reorder these.

   'Lavatory' in the single branch — added 2026-09-14. HB's only Lavatory
   model is Woodbury, whose own copy reads "Single handle, single hole
   lavatory faucet"; the name just never says so. The word does not mean
   single-hole in general, which is why Widespread gets first refusal.

   'Bar Faucet' and 'Laundry' in the other branch are belt-and-braces.
   Those five SKUs were retyped out of 'Bathroom Faucets' in migration
   2026-09-14_hb_faucet_types_and_finishes.sql, so they should never reach
   this CASE. If a future import puts them back, they get excluded here
   instead of silently reappearing on a vanity. */
const FAUCET_DRILLING_SQL = `
  CASE
    WHEN p.name LIKE '%Widespread%'                          THEN 'widespread'
    WHEN p.name LIKE '%Single Control%'
      OR p.name LIKE '%Single Hole%'
      OR p.name LIKE '%Single-Hole%'
      OR p.name LIKE '%Lavatory%'                            THEN 'single'
    WHEN p.name LIKE '%Center Set%' OR p.name LIKE '%Centerset%'
      OR p.name LIKE '%Vessel%'
      OR p.name LIKE '%Bar Faucet%' OR p.name LIKE '%Laundry%' THEN 'other'
    ELSE 'unknown'
  END`;

async function getFaucets() {
  const [rows] = await bvoPool.execute(`
    SELECT
      p.id, p.slug, p.name, p.model, p.brand, p.price, p.compare_price,
      p.width_in, p.color, p.color_family,
      ${FAUCET_DRILLING_SQL} AS drilling,
      ${IMG_SQL}
    FROM products p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE c.slug        = 'faucets'
      AND p.is_active   = 1
      /* Bathroom Faucets ONLY. The faucets category also carries Shower
         Fixtures (376), Kitchen Faucets (84) and Tub Fillers (55) since
         the HB import — none of which belong on a vanity. Filtering on
         product_type rather than on the name keeps this correct when HB
         names something unexpectedly. */
      AND p.product_type = 'Bathroom Faucets'
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

/* ── Catalogue cache ──────────────────────────────────────────────────
   MEASURED: the page took 11,056 ms to first byte. HTML download was
   94 ms and every one of the 14 assets came back under 51 ms — so none
   of it was the browser. All eleven seconds were these six queries.

   The offenders are structural, not accidental:
     · getCabinetTopMap() self-joins jmv_dimensions (5,218 rows) on
       collection + base_finish + size_nominal. The table has three
       SEPARATE single-column indexes and no composite, so MySQL picks
       one and filters the rest by hand — then multiplies that through
       product_components (8,940 rows) and four computed SKU forms.
     · CHIP_SQL is a correlated subquery run once per output row,
       matching brand + model + color + category_id. No index covers
       that combination.

   None of it needs to run per request. This catalogue changes when the
   JM feed imports — roughly daily — not between page views. So build it
   once and hand out the same object until it goes stale.

   WHY A WHOLE-PAYLOAD CACHE AND NOT PER-QUERY: the six run in parallel,
   so the request costs whatever the SLOWEST one costs. Caching five of
   six would save nothing.

   Staleness is the price. A product edited in admin does not appear here
   until the next build. That is acceptable for a merchandising page and
   NOT acceptable for price or stock at checkout — cart and checkout read
   the DB directly and must keep doing so.

   ── 2026-09-24: BUILT NIGHTLY, STORED IN A TABLE ─────────────────────

   This used to be a module-level object on a 15-minute TTL. Sam's call,
   and it is the right shape: the catalogue changes when the JM feed
   lands (04:30 UTC) and at no other time, so rebuild on that EVENT
   rather than on a clock.

   Two things were wrong with the TTL version:

   1. It rebuilt ~96 times a day to capture one real change.

   2. It did not survive a restart, and that is what was actually hurting.
      warmCatalogue() kicked off a rebuild at boot, but a request arriving
      before it finished found an empty cache and waited out the whole
      rebuild — 12 seconds, measured. Every deploy and every app wake-up
      opened that window, and on traffic this sparse the window caught
      close to every real visitor. "Slow to load" was this.

   Now: a nightly job writes one row; the page reads it in ~1ms. Nothing
   a visitor does can ever trigger a build.

   STALE BEATS SLOW, deliberately. If the nightly build has not run, the
   last good row is served however old it is — Sam's call. The catalogue
   going a day stale is a merchandising inconvenience; the page taking 12
   seconds is a lost customer. The one exception is an EMPTY table (first
   deploy), where there is nothing to serve and we must build inline.

   Age is logged on every read past 36h so "stale" never becomes
   "silently stale" — the failure mode that hid the jmv_rollup cron
   breakage for weeks while node-cron quietly covered for it.           */

const STALE_WARN_MS = 36 * 60 * 60 * 1000;

/* THE OLD TTL, KEPT ON PURPOSE AS THE FALLBACK.
   This is the 15 minutes the module used before the nightly table existed.
   It is dead code while the table works — a persisted catalogue is never
   aged out, because the nightly job owns when it changes. It comes back
   into play only when persistence FAILS, at which point this process
   behaves exactly as it did before this change rather than inventing some
   third, untested mode. Slower, and it dies with the process; but it is a
   path that ran in production for months, which is what you want from a
   fallback. */
const LEGACY_TTL_MS = 15 * 60 * 1000;

let _mem      = null;   // { at, payload, persisted } — per-process copy
let _inflight = null;   // de-dupes concurrent cold builds

/* Kept for the JM importer, which calls it after an in-process import.
   It no longer just drops a cache: it rebuilds and PERSISTS, because the
   import IS the event this catalogue tracks. Fire-and-forget; the caller
   is already in a setImmediate and must not wait on it. */
function bustBundleCache() {
  _mem = null;
  rebuildAndStore('admin').catch(err =>
    console.error('[bundle] rebuild after import failed:', err.message));
}
exports.bustBundleCache = bustBundleCache;

/* ── Restore the FreePower siblings c2eec1a removed ───────────────────
   BEFORE c2eec1a ("pair tops from JM's bill of materials, badge the
   depth") the builder filtered tops on width bucket and sink count alone.
   That commit replaced it with getCabinetTopMap(), and it was right to:
   width matching offered 1,105 Radius Cut tops on cabinets JM never pairs
   them with, and an RC top is 21.5" with a cut front — wrong on a standard
   cabinet, and a return we pay freight on twice.

   But it also took away 95 cabinet→top pairings whose only sin was a
   charging coil. 050-S72-FP-VSL-SNK is the same width, same depth, same
   sink count, same finish and same series as 050-S72-VSL-SNK, which JM
   does pair with E444-V72-MCA. JM simply does not publish a combo for the
   FreePower one, so the BOM never names it and the builder stopped
   offering it. It used to be on the card. A customer noticed.

   So: if a top is ALREADY approved for a cabinet by the bill of materials,
   any FreePower twin of that top is approved too. All five fields must
   match.

   That does NOT mean no Radius Cut top is ever added — two are, and an
   earlier draft of this comment wrongly claimed otherwise. 060-S48RCWS-FP-
   VSL-SNK and 060-S72RCWS-FP-VSL-SNK come through, and correctly: their
   sponsor is the non-FreePower RCWS top of the same 060 series and 21.5"
   depth, which the BOM already approved for that cabinet. The rule cannot
   put an RC top on a cabinet that has no RC top, because the sponsor has
   to be on that cabinet's list already and has to match on series and
   depth. Adding a FreePower RC top beside an approved RC top is the whole
   point; adding one to a standard cabinet remains impossible.

   This ADDS. It never removes, and it never widens on anything but an
   exact five-field match against a top the BOM already blessed. */
function expandFreePowerSiblings(topCompat, tops) {
  const key = t => [t.width_in, t.depth_in, t.sink_count,
                    String(t.top_finish || '').toLowerCase(),
                    String(t.sku).split('-')[0]].join('|');

  /* Index only the FreePower tops, by the five-field signature. */
  const fpBySig = new Map();
  for (const t of tops) {
    if (String(t.freepower) !== 'Yes') continue;
    const k = key(t);
    if (!fpBySig.has(k)) fpBySig.set(k, []);
    fpBySig.get(k).push(t.sku);
  }
  const bySku = new Map(tops.map(t => [t.sku, t]));

  let added = 0;
  for (const cab of Object.keys(topCompat)) {
    const have = new Set(topCompat[cab]);
    for (const sku of topCompat[cab]) {
      const t = bySku.get(sku);
      /* Only a NON-FreePower top earns its twin; starting from a FreePower
         top would let the rule chain onto itself. */
      if (!t || String(t.freepower) === 'Yes') continue;
      for (const sib of (fpBySig.get(key(t)) || [])) {
        if (!have.has(sib)) { have.add(sib); topCompat[cab].push(sib); added++; }
      }
    }
  }
  return added;
}

async function buildCataloguePayload() {
  const t0 = Date.now();
  const [cabinets, rawTops, mirrors, faucets, stoneSamples, topCompat] = await Promise.all([
    getCabinets(),
    getTops(),
    getMirrors(),
    getFaucets(),
    getStoneSamples(),
    getCabinetTopMap(),
  ]);
  const tops = enrichTopsWithMaterial(rawTops, stoneSamples);
  /* Mutates topCompat in place, after getTops() so the attributes are in
     hand. Logged rather than silent: if this ever prints 0, either JM
     started publishing the combos (good, the rule is now redundant) or the
     wireless_charging attribute has gone dead the way jd.freepower did. */
  const fpAdded = expandFreePowerSiblings(topCompat, tops);
  const payload = {
    cabinetModels: groupByModel(cabinets),
    topModels:     groupByModel(tops),
    mirrorModels:  groupByModel(mirrors),
    faucetModels:  groupByModel(faucets),
    familyHex:     FAMILY_HEX,
    sizeBuckets:   SIZE_BUCKETS,
    /* { cabinetSku: [topSku, ...] } — JM's own combo bill of materials. */
    topCompat,
  };
  /* Template literal, NOT console.log('%d', x). Hostinger's runtime log
     capture does not apply printf substitution — the first deploy of this
     line printed "rebuilt in %dms (%d cabinets, %d tops) 10183 289 177",
     with the format string verbatim and the values tacked on the end. */
  console.log(`[bundle] catalogue rebuilt in ${Date.now() - t0}ms `
            + `(${cabinets.length} cabinets, ${tops.length} tops, `
            + `${fpAdded} FreePower pairings restored)`);
  return payload;
}

/* ── Persistence ──────────────────────────────────────────────────── */

const CATALOGUE_DDL = `
  CREATE TABLE IF NOT EXISTS bundle_catalogue (
    id          TINYINT UNSIGNED NOT NULL DEFAULT 1,
    payload     LONGTEXT NOT NULL,
    built_at    DATETIME NOT NULL,
    build_ms    INT UNSIGNED NULL,
    source      VARCHAR(16) NOT NULL DEFAULT 'cron',
    counts_json VARCHAR(500) NULL,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

/* Self-heal, same pattern as _ensureModelGroupsTable. The migration is
   the intended path; this means a deploy that runs ahead of the SQL
   import still works rather than 500ing on an unknown table. */
let _ddlDone = false;
async function ensureTable() {
  if (_ddlDone) return;
  await bvoPool.query(CATALOGUE_DDL);
  _ddlDone = true;
}

/**
 * Build the catalogue and write it to bundle_catalogue.
 * @param {'cron'|'admin'|'boot'|'manual'} source  what triggered this
 */
async function rebuildAndStore(source = 'manual') {
  if (_inflight) return _inflight;

  _inflight = (async () => {
    const t0 = Date.now();
    const payload = await buildCataloguePayload();
    const ms = Date.now() - t0;

    const counts = {
      cabinets: payload.cabinetModels.reduce((a, m) => a + m.skus.length, 0),
      tops:     payload.topModels.reduce((a, m) => a + m.skus.length, 0),
      mirrors:  payload.mirrorModels.reduce((a, m) => a + m.skus.length, 0),
      faucets:  payload.faucetModels.reduce((a, m) => a + m.skus.length, 0),
      compat:   Object.keys(payload.topCompat).length,
    };

    /* REFUSE AN EMPTY CATALOGUE. A build can "succeed" and return nothing
       — a bad deploy, a truncated import, a category slug renamed. Serving
       or storing that replaces a working page with an empty one, and the
       nightly job would do it at 2am with nobody watching. Throw BEFORE
       touching _mem or the table, so both keep what they already had. */
    if (counts.cabinets === 0 || counts.tops === 0) {
      throw new Error(
        `refusing to store an empty catalogue (cabinets=${counts.cabinets}, ` +
        `tops=${counts.tops}) — keeping the previous copy`);
    }

    /* SERVE-ABILITY FIRST, PERSISTENCE SECOND. The payload is good; put it
       where requests can reach it BEFORE attempting the write. An earlier
       version wrote first and assigned _mem after, so a failed INSERT threw
       away a perfectly good catalogue and the page 500d over a storage
       problem it did not need to care about. */
    _mem = { at: Date.now(), payload, persisted: false };

    try {
      await ensureTable();
      await bvoPool.query(
        `INSERT INTO bundle_catalogue (id, payload, built_at, build_ms, source, counts_json)
         VALUES (1, ?, NOW(), ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           payload     = VALUES(payload),
           built_at    = VALUES(built_at),
           build_ms    = VALUES(build_ms),
           source      = VALUES(source),
           counts_json = VALUES(counts_json)`,
        [JSON.stringify(payload), ms, source, JSON.stringify(counts)]);

      _mem.persisted = true;
      console.log(`[bundle] catalogue stored (${source}) in ${ms}ms — ` +
                  `${counts.cabinets} cabinets, ${counts.tops} tops, ` +
                  `${counts.compat} cabinets with pairings`);
    } catch (err) {
      /* THE OLD BEHAVIOUR IS THE FALLBACK. Persisting failed, so this
         process reverts to exactly what it did before this change: an
         in-memory catalogue on a 15-minute TTL, rebuilt on demand. Slower,
         and it dies with the process — but the page works.

         Deliberately NOT rethrown. The caller is usually a scheduler or a
         fire-and-forget admin hook; a storage failure must not become a
         500 for a visitor who only wanted to see some vanities. */
      console.error(`[bundle] BUILD OK BUT STORE FAILED (${err.message}). ` +
                    `Falling back to the in-memory ${LEGACY_TTL_MS / 60000}-minute cache ` +
                    `for this process. The page still works; fix the DB write.`);
    }

    return payload;
  })().finally(() => { _inflight = null; });

  return _inflight;
}
exports.rebuildAndStore = rebuildAndStore;

/** Read the stored row. Returns null if the table is empty or unreadable. */
async function loadStored() {
  try {
    await ensureTable();
    const [rows] = await bvoPool.query(
      `SELECT payload, built_at, source, counts_json FROM bundle_catalogue WHERE id = 1`);
    if (!rows.length) return null;

    const ageMs = Date.now() - new Date(rows[0].built_at).getTime();
    if (ageMs > STALE_WARN_MS) {
      /* Loud on purpose. Serving stale is the chosen behaviour; serving
         stale WITHOUT SAYING SO is how a dead cron goes unnoticed. */
      console.warn(`[bundle] serving a catalogue built ${Math.round(ageMs / 3600000)}h ago ` +
                   `(source=${rows[0].source}) — is the nightly job running?`);
    }
    return { payload: JSON.parse(rows[0].payload), builtAt: rows[0].built_at, ageMs };
  } catch (err) {
    console.error('[bundle] could not read bundle_catalogue:', err.message);
    return null;
  }
}
exports.loadStored = loadStored;

/* THE READ PATH. Three cases, and only one of them can ever be slow.

     · in-process copy   -> return it, no I/O at all
     · stored row        -> one indexed SELECT + JSON.parse, ~1ms
     · nothing stored    -> build inline. THE ONLY slow case, and it can
                            only happen before the first build has ever
                            run (fresh deploy, table just created).

   Note what is NOT here: any notion of "expired". The row is replaced by
   the nightly job and by admin edits, never aged out by a clock. A
   visitor arriving at 23:59 gets the same row as one arriving at 00:01,
   and neither waits. Serving a stale catalogue is the deliberate choice
   over making someone wait 12 seconds — see the block comment above. */
async function getCataloguePayload() {
  if (_mem) {
    /* A PERSISTED copy never expires — the nightly job decides when the
       catalogue changes, not a clock. An UNPERSISTED one is the legacy
       fallback and does expire, exactly as it used to, so a process stuck
       in fallback mode still picks up new data every 15 minutes instead of
       serving one build until it is restarted. */
    if (_mem.persisted !== false) return _mem.payload;
    if ((Date.now() - _mem.at) < LEGACY_TTL_MS) return _mem.payload;
    // else fall through and try the table again — it may have recovered.
  }

  const stored = await loadStored();
  if (stored) {
    _mem = { at: Date.now(), payload: stored.payload, persisted: true };
    return stored.payload;
  }

  /* Nothing stored, or the table is unreadable. Build it. This is the old
     behaviour and the only slow path left. */
  console.warn('[bundle] no readable stored catalogue — building inline. ' +
               'Expected once, on first deploy. Repeatedly means the ' +
               'nightly job is not writing, or the table is unreachable.');
  try {
    return await rebuildAndStore('boot');
  } catch (err) {
    /* rebuildAndStore only throws now for a genuinely bad BUILD (empty
       catalogue, or a query that failed) — a failed WRITE is already
       swallowed in there. So there is no good payload to fall back to.
       Serve the last one this process had, however old, rather than 500.
       An old catalogue is a merchandising problem; a broken page is a
       lost customer. */
    if (_mem) {
      console.error(`[bundle] rebuild failed (${err.message}) — serving the ` +
                    `previous in-process copy rather than erroring.`);
      return _mem.payload;
    }
    throw err;   // nothing anywhere: let getBundleBuilder render its error page
  }
}

/* Warm the PROCESS from the stored row at boot — a read, not a build, so
   it costs a millisecond and cannot stampede.

   Deliberately NOT a rebuild. The old version built at boot, which meant
   every deploy paid 12 seconds and every restart re-ran six heavy
   queries for data that had not changed. The nightly job owns building.

   unref() so it never holds the process open; catch so a DB hiccup at
   boot logs rather than crashing the app. */
function warmCatalogue() {
  loadStored()
    .then(s => {
      if (s) {
        _mem = { at: Date.now(), payload: s.payload };
        console.log(`[bundle] catalogue loaded from DB (built ${s.builtAt})`);
      } else {
        console.warn('[bundle] no stored catalogue at boot — the first ' +
                     'request will build one. Run the nightly job.');
      }
    })
    .catch(err => console.error('[bundle] boot load failed:', err.message));
}
setTimeout(warmCatalogue, 0).unref?.();

/* ── GET /bundle-builder ─────────────────────────────────────────────── */
exports.getBundleBuilder = async (req, res) => {
  try {
    const cat = await getCataloguePayload();

    res.render('pages/bundle-builder', {
      ...cat,
      pageTitle:     'Build Your James Martin Bundle | BathroomVanitiesOutlet.com',
      metaDesc:      'Build your dream bathroom from James Martin\'s premium collection. Mix and match cabinets, tops, and mirrors — save up to 15% on your bundle.',
      canonicalUrl:  `${SITE_URL}/bundle-builder`,
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
