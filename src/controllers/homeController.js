'use strict';

const { bvoPool }              = require('../config/database');
/* (model, brand) identity — see src/utils/modelKey.js for why a model
   name alone is not a key on this site. */
const { modelKey, modelBrandPairs } = require('../utils/modelKey');
/* Which product a model card leads with — shared with collectionsController
   so the homepage carousel and the full list cannot disagree. */
const { fetchModelHeroes } = require('../utils/modelHero');
/* Corner badge — shared with collectionsController so a card cannot claim
   one thing on the homepage and another on the full list. */
const { pickBadge }        = require('../utils/cardBadge');
const { FAMILIES, normalize }   = require('../config/colorFamilies');
const { SIZE_BUCKETS }          = require('../config/sizeBuckets');
const themeSettings            = require('../services/themeSettings');

/* Convert a raw integer width → {label, key} bucket object, or null */
function toBucket(rawSize) {
  const b = SIZE_BUCKETS.find(b => rawSize >= b.min && rawSize <= b.max);
  if (!b) return null;
  const key = parseInt(b.label, 10) || 0;
  return key ? { label: b.label, key } : null;
}

/* Build family key → hex map */
const FAMILY_HEX = {};
FAMILIES.forEach(f => { FAMILY_HEX[f.key] = f.hex; FAMILY_HEX[f.key + '_border'] = f.border; });

/* ═══════════════════════════════════════════════════════════════════════
   Section filters — brand / category / product_type

   Shared by getFeaturedProducts and BOTH branches of getFeaturedModels.
   It lives in one place because getFeaturedModels has two queries (curated
   and auto-ranked) that must narrow identically; when they were written
   out separately, a filter added to one and forgotten in the other would
   show a correctly-filtered section until the curated list emptied, then
   silently widen.

   Every filter is optional — '' or undefined contributes nothing, so a
   section with no filters produces exactly the SQL it produced before.

   `category` matches categories.slug and requires the caller to have the
   categories table joined as `c`. Callers that pass a category must
   include that join; joinCategories below reports whether it is needed so
   the join and the predicate cannot get out of step.
   ═══════════════════════════════════════════════════════════════════════ */
function sectionFilters(opts = {}) {
  const brand    = (opts.brand    || '').trim();
  const category = (opts.category || '').trim();
  const ptype    = (opts.ptype    || '').trim();

  const sql = [];
  const params = [];
  if (brand)    { sql.push('p.brand = ?');        params.push(brand); }
  if (ptype)    { sql.push('p.product_type = ?'); params.push(ptype); }
  if (category) { sql.push('c.slug = ?');         params.push(category); }

  return {
    where: sql.length ? ' AND ' + sql.join(' AND ') : '',
    params,
    joinCategories: !!category,
    // Stable identity for memoisation — two sections with identical
    // filters must not run the same query twice.
    key: JSON.stringify([brand, category, ptype]),
  };
}

async function getFeaturedProducts(opts = {}) {
  try {
    const f = sectionFilters(opts);
    /* limit was previously hardcoded to 12 and featured_section.limit was
       read by nobody, so the Theme Editor control did nothing. */
    const safeLimit = Math.max(1, Math.min(24, parseInt(opts.limit) || 12));
    const [rows] = await bvoPool.query(`
      SELECT
        p.id, p.slug, p.name, p.brand, p.price, p.compare_price, p.is_new, p.model,
        p.video_url,
        COALESCE(p.primary_image_url, pi.url) AS primary_image,
        (SELECT pi2.url FROM product_images pi2
         WHERE pi2.product_id = p.id
         ORDER BY pi2.sort_order ASC, pi2.id ASC
         LIMIT 1 OFFSET 1) AS hover_image,
        COALESCE(inv.qty_on_hand, 0) AS qty_on_hand,
        p.demand_score,
        /* Corner-badge input — see src/utils/cardBadge.js. MAX() because
           the join can return more than one row per product and the outer
           query does not group; without it a product with two material
           rows would duplicate the whole card. */
        MAX(pav.value_text) AS primary_material,
        /* 'best' is NOT awarded here any more. It used to fire for every
           is_featured row, which made the badge mean "someone ticked a
           box" rather than "this one sells". It is assigned below, to the
           top-ranked product only. */
        CASE
          WHEN p.compare_price IS NOT NULL AND p.compare_price > p.price THEN 'sale'
          WHEN p.is_new = 1 THEN 'new'
          ELSE NULL
        END AS badge
      FROM products p
      LEFT JOIN product_images pi  ON pi.product_id  = p.id AND pi.is_primary = 1
      LEFT JOIN inventory      inv ON inv.product_id = p.id
      LEFT JOIN product_attribute_values pav
             ON pav.product_id = p.id AND pav.attr_key = 'primary_material'
      ${f.joinCategories ? 'JOIN categories c ON c.id = p.category_id' : ''}
      WHERE p.is_active = 1 AND p.is_featured = 1${f.where}
      /* GROUP BY is required now that the SELECT aggregates
         primary_material. Without it MySQL treats the whole query as one
         aggregate and returns a SINGLE row — the entire Featured Products
         section collapsing to one card. */
      GROUP BY p.id
      /* is_featured picks the POOL by hand; national demand orders it.

         demand_score comes from the James Martin movement rollup — how
         fast the SKU ships across all JM dealers — deliberately, not from
         this site's own order history. National trend, not local.

         demand_score is INT UNSIGNED NOT NULL DEFAULT 0, so an unscored
         product is 0 rather than NULL — DESC puts it last either way, and
         sort_order / created_at still break the tie among the zeros. */
      ORDER BY p.demand_score DESC, p.sort_order, p.created_at DESC
      LIMIT ?
    `, [...f.params, safeLimit]);
    if (!rows.length) return [];

    /* Award 'best' to the strongest seller in this section, and only if it
       is not already carrying a sale or new badge — one badge per card,
       and a live discount is the more useful thing to shout about.

       Requires a score ABOVE ZERO, not merely non-null. The column is
       NOT NULL DEFAULT 0, so every unscored product reads 0 — a null
       check would pass on all of them and badge whatever happened to sort
       first, which is exactly the unearned "best" this change removes. */
    const topSeller = rows.find(r => Number(r.demand_score) > 0);
    if (topSeller && !topSeller.badge) topSeller.badge = 'best';

    /* The corner badge is computed further down, once `finishes` exists —
       "Multiple Colors" needs the swatch count, so computing it here would
       silently never award that badge. */

    /* Fetch color swatches + color×size image map for each product's model.

       BRAND-SCOPED 2026-09-05. These sub-queries matched p.model alone and
       the maps below PUSH, so a featured ER Vanities Bristol listed its own
       finish followed by James Martin's three — and clicking one of those
       loaded a James Martin image onto an ER card. The outer query already
       selects p.brand, so the rows carry it.

       modelBrandPairs also de-duplicates: with two brands sharing a model
       name the old modelNames list emitted the name twice. */
    const { pairs: modelPairs, params: modelParams, sql: pairSql } = modelBrandPairs(rows);
    if (!modelPairs.length) return rows.map(r => ({ ...r, finishes: [], sizes: [], sizeImageMap: {} }));

    const [[swatchRows], [csRows]] = await Promise.all([
      bvoPool.query(`
        SELECT p.model, p.brand, p.color, p.color_family,
          COALESCE(MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END), MIN(pi.url)) AS image_url
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        WHERE p.is_active = 1 AND (p.model, p.brand) IN (${pairSql}) AND p.color IS NOT NULL
        GROUP BY p.model, p.brand, p.color, p.color_family
        ORDER BY p.model, p.brand, p.color
      `, modelParams),
      bvoPool.query(`
        SELECT p.model, p.brand, p.color, CAST(p.width_in AS UNSIGNED) AS size_in,
          COALESCE(MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END), MIN(pi.url)) AS image_url
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        WHERE p.is_active = 1 AND (p.model, p.brand) IN (${pairSql}) AND p.color IS NOT NULL
          AND p.width_in IS NOT NULL AND p.width_in > 0
        GROUP BY p.model, p.brand, p.color, p.width_in
        ORDER BY p.model, p.brand, p.color, p.width_in
      `, modelParams),
    ]);

    /* Build swatchMap[model] = [{color, hex, border, image_url, sizeImages}] */
    const FAMILY_HEX_LOCAL = {};
    FAMILIES.forEach(f => { FAMILY_HEX_LOCAL[f.key] = f.hex; FAMILY_HEX_LOCAL[f.key + '_border'] = f.border; });

    const colorSizeMap = {}; // [model][color][bKey] = imageURL
    const sizeImageMap = {}; // [model][bKey] = imageURL
    for (const r of csRows) {
      const rawSize = Math.round(Number(r.size_in));
      if (!rawSize || !r.image_url) continue;
      const bkt = toBucket(rawSize);
      if (!bkt) continue;
      const k = modelKey(r);
      if (!colorSizeMap[k])           colorSizeMap[k] = {};
      if (!colorSizeMap[k][r.color])  colorSizeMap[k][r.color] = {};
      if (!colorSizeMap[k][r.color][bkt.key]) colorSizeMap[k][r.color][bkt.key] = r.image_url;
      if (!sizeImageMap[k])            sizeImageMap[k] = {};
      if (!sizeImageMap[k][bkt.key])   sizeImageMap[k][bkt.key] = r.image_url;
    }

    const swatchMap = {};
    for (const r of swatchRows) {
      const k = modelKey(r);
      if (!swatchMap[k]) swatchMap[k] = [];
      const fk = r.color_family || normalize(r.color, 'all') || '';
      swatchMap[k].push({
        color: r.color, color_family: r.color_family,
        hex: FAMILY_HEX_LOCAL[fk] || '#ccc', border: FAMILY_HEX_LOCAL[fk + '_border'] || '#aaa',
        image_url: r.image_url || null,
        sizeImages: (colorSizeMap[k] && colorSizeMap[k][r.color]) || {},
      });
    }

    /* Build bucketed size list per model */
    const modelSizes = {}; // [model] = [{label, key}]
    for (const r of csRows) {
      const rawSize = Math.round(Number(r.size_in));
      const bkt = toBucket(rawSize);
      if (!bkt) continue;
      const k = modelKey(r);
      if (!modelSizes[k]) modelSizes[k] = [];
      if (!modelSizes[k].some(s => s.key === bkt.key)) modelSizes[k].push(bkt);
    }

    return rows.map(r => {
      const finishes = swatchMap[modelKey(r)] || [];
      return {
        ...r,
        finishes,
        sizes:        modelSizes[modelKey(r)] || [],
        sizeImageMap: sizeImageMap[modelKey(r)] || {},

        /* Corner badge. Computed here, not earlier, because
           "Multiple Colors" needs the finish count and `finishes` only
           exists at this point.

           ONLY 'best' short-circuits. It is awarded to exactly one card
           per section and is genuinely earned, so it outranks a rotation
           label. Sale and New do NOT short-circuit: every featured
           product is discounted right now, so honouring 'sale' produced
           four identical SALE pills in a row. They are passed into the
           pool instead and surface some of the time. */
        cardBadge: r.badge === 'best' ? null : pickBadge({
          key:         String(r.sku || r.slug || r.id),
          onSale:      !!(r.compare_price && r.price && Number(r.compare_price) > Number(r.price)),
          isNew:       !!r.is_new,
          qty:         r.qty_on_hand,
          colorCount:  finishes.length,
          material:    r.primary_material,
          demandScore: Number(r.demand_score) || 0,
        }),
      };
    });
  } catch (e) {
    console.error('getFeaturedProducts error:', e);
    return [];
  }
}

async function getFeaturedModels(opts = {}) {
  try {
    const safeLimit = Math.max(1, Math.min(20, parseInt(opts.limit) || 8));
    const f = sectionFilters(opts);
    const mgBrand = (opts.brand || '').trim();

    /* ── Check for curated model_groups featured records first ── */
    let curatedModels = [];
    try {
      /* Brand-scoped at the model_groups level, not just downstream. A
         section scoped to ER Vanities must not spend its LIMIT slots on
         curated James Martin rows and then filter them out — that would
         return fewer cards than asked for, or none, and fall back to auto
         ranking for no visible reason. */
      const [mgRows] = await bvoPool.query(`
        SELECT model_name, brand, is_featured, sort_order,
               custom_image, image_alt, video_url AS mg_video_url, description,
               default_sku
        FROM model_groups
        WHERE is_featured = 1${mgBrand ? ' AND brand = ?' : ''}
        ORDER BY sort_order, model_name, brand
        LIMIT ?
      `, mgBrand ? [mgBrand, safeLimit] : [safeLimit]);
      curatedModels = mgRows;
    } catch (mgErr) {
      /* Falls through to auto-ranking on ANY error, which is deliberate —
         but note the failure mode: if `brand` were selected before the
         column existed, the homepage would not error, it would quietly
         stop honouring curated featured models. The schema change must
         land before this code. Logged loudly for that reason. */
      console.warn('[getFeaturedModels] model_groups query failed (table/column may not exist yet):', mgErr.message);
    }

    /* ── Determine model names to fetch (curated list, or auto-top-N) ── */
    let useCurated = curatedModels.length > 0;
    let modelRows;

    if (useCurated) {
      /* Composite match on (model, brand). Matching on name alone pulled
         in EVERY brand's Bristol when only one was curated. */
      const curatedRows = curatedModels.map(r => ({ model: r.model_name, brand: r.brand }));
      const { params: curatedParams, sql: curatedPairSql } = modelBrandPairs(curatedRows);
      [modelRows] = await bvoPool.query(`
        SELECT
          p.model,
          p.brand,
          MIN(p.price)          AS price_from,
          MAX(p.price)          AS price_to,
          MIN(p.compare_price)  AS compare_price_from,
          /* Collection-level national demand: the total movement of every
             SKU in the model. SUM rather than MAX because the question is
             "which collection sells most", and a model earning its
             position through many steady sizes is as popular as one
             carried by a single hot SKU. */
          SUM(p.demand_score)   AS model_demand,
          GROUP_CONCAT(DISTINCT FLOOR(p.width_in) ORDER BY p.width_in) AS sizes_csv,
          COALESCE(
            MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END),
            MIN(pi.url)
          ) AS image_url,
          MIN(CASE WHEN p.video_url IS NOT NULL THEN p.video_url END) AS video_url
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        ${f.joinCategories ? 'JOIN categories c ON c.id = p.category_id' : ''}
        WHERE p.is_active = 1 AND (p.model, p.brand) IN (${curatedPairSql})${f.where}
        GROUP BY p.model, p.brand
      `, [...curatedParams, ...f.params]);

      /* Order the curated pool by national demand, most popular first.

         The Featured toggle in /admin/models picks WHICH models appear;
         demand decides the order among them. Curated sort_order is kept
         only as the tiebreaker, so hand-set positions still decide between
         models the rollup scores equally (or has not scored at all).

         SQL IN() does not guarantee order, so this has to be done here
         regardless — the sort is not extra work, only a different key.

         Keyed on (model, brand) — see src/utils/modelKey.js. */
      const orderMap = {};
      curatedModels.forEach((r, i) => {
        orderMap[modelKey({ model: r.model_name, brand: r.brand })] = i;
      });
      modelRows.sort((a, b) => {
        const db = Number(b.model_demand || 0) - Number(a.model_demand || 0);
        if (db !== 0) return db;
        return (orderMap[modelKey(a)] ?? 999) - (orderMap[modelKey(b)] ?? 999);
      });
    } else {
      /* Auto-top-N by product count — original behaviour */
      [modelRows] = await bvoPool.query(`
        SELECT
          p.model,
          p.brand,
          MIN(p.price)          AS price_from,
          MAX(p.price)          AS price_to,
          MIN(p.compare_price)  AS compare_price_from,
          /* Collection-level national demand: the total movement of every
             SKU in the model. SUM rather than MAX because the question is
             "which collection sells most", and a model earning its
             position through many steady sizes is as popular as one
             carried by a single hot SKU. */
          SUM(p.demand_score)   AS model_demand,
          GROUP_CONCAT(DISTINCT FLOOR(p.width_in) ORDER BY p.width_in) AS sizes_csv,
          COALESCE(
            MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END),
            MIN(pi.url)
          ) AS image_url,
          MIN(CASE WHEN p.video_url IS NOT NULL THEN p.video_url END) AS video_url
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        ${f.joinCategories ? 'JOIN categories c ON c.id = p.category_id' : ''}
        WHERE p.is_active = 1 AND p.model IS NOT NULL${f.where}
        GROUP BY p.model, p.brand
        /* Was COUNT(*) DESC — which ranked by how many SKUs a model has,
           not by how well it sells. A model with many colours beat a
           genuinely popular one. Demand first, SKU count only as the
           tiebreaker among models the rollup has not scored. */
        ORDER BY SUM(p.demand_score) DESC, COUNT(*) DESC
        LIMIT ?
      `, [...f.params, safeLimit]);
    }

    /* Build curated overlay map: model_name → {custom_image, mg_video_url, description} */
    /* Keyed on (model, brand) — see src/utils/modelKey.js. The curated
       rows carry model_name rather than model, so they are adapted here. */
    const mgOverlay = {};
    curatedModels.forEach(r => {
      mgOverlay[modelKey({ model: r.model_name, brand: r.brand })] = r;
    });

    if (!modelRows.length) return [];

    /* Fetch per-model color swatches, one representative image per
       (model, brand, color).

       BRAND-SCOPED 2026-09-05. The homepage carousel keyed five maps on
       model alone, so ER Vanities' Bristol and James Martin's overwrote
       or concatenated each other. modelRows already GROUPs BY p.model,
       p.brand, so the rows carry brand.

       The old `modelRows.map(r => r.model)` also had no de-duplication —
       two brands sharing a name emitted it twice in the IN list.
       modelBrandPairs de-duplicates on the pair. */
    const { pairs: mPairs, params: mParams, sql: mPairSql } = modelBrandPairs(modelRows);
    const [swatchRows] = await bvoPool.query(`
      SELECT
        p.model,
        p.brand,
        p.color,
        p.color_family,
        COALESCE(
          MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END),
          MIN(pi.url)
        ) AS image_url
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
      WHERE p.is_active = 1 AND (p.model, p.brand) IN (${mPairSql})
        AND p.color IS NOT NULL
      GROUP BY p.model, p.brand, p.color, p.color_family
      ORDER BY p.model, p.brand, p.color
    `, mParams);

    const swatchMap = {};
    for (const r of swatchRows) {
      const k = modelKey(r);
      if (!swatchMap[k]) swatchMap[k] = [];
      const swatchFamilyKey = r.color_family || normalize(r.color, 'all') || '';
      swatchMap[k].push({
        color:        r.color,
        color_family: r.color_family,
        hex:          FAMILY_HEX[swatchFamilyKey]              || '#ccc',
        border:       FAMILY_HEX[swatchFamilyKey + '_border']  || '#aaa',
        image_url:    r.image_url || null,
      });
    }

    /* Fetch color × size → image + price map so carousel chips can swap images and show prices */
    const [csRows] = await bvoPool.query(`
      SELECT p.model, p.brand, p.color, CAST(p.width_in AS UNSIGNED) AS size_in,
        COALESCE(
          MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END),
          MIN(pi.url)
        ) AS image_url,
        MIN(p.price) AS price
      FROM products p
      LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
      WHERE p.is_active = 1 AND (p.model, p.brand) IN (${mPairSql})
        AND p.color IS NOT NULL AND p.width_in IS NOT NULL AND p.width_in > 0
      GROUP BY p.model, p.brand, p.color, p.width_in
      ORDER BY p.model, p.brand, p.color, p.width_in
    `, mParams);

    // Build bucketed colorSizeMap, sizeImageMap, colorSizePriceMap, sizePriceMap
    const colorSizeMap      = {}; // [model][color][bKey] = imageURL
    const sizeImageMap      = {}; // [model][bKey] = imageURL
    const colorSizePriceMap = {}; // [model][color][bKey] = min price
    const sizePriceMap      = {}; // [model][bKey] = min price across colors
    const modelBuckets      = {}; // [model] = [{label, key, priceFrom}] — deduplicated
    for (const r of csRows) {
      const rawSize = Math.round(Number(r.size_in));
      if (!rawSize) continue;
      const bkt = toBucket(rawSize);
      if (!bkt) continue;

      const k = modelKey(r);
      if (!colorSizeMap[k])          colorSizeMap[k] = {};
      if (!colorSizeMap[k][r.color]) colorSizeMap[k][r.color] = {};
      if (!colorSizeMap[k][r.color][bkt.key]) colorSizeMap[k][r.color][bkt.key] = r.image_url;

      if (!sizeImageMap[k])           sizeImageMap[k] = {};
      if (!sizeImageMap[k][bkt.key])  sizeImageMap[k][bkt.key] = r.image_url;

      // Price maps
      if (r.price != null) {
        if (!colorSizePriceMap[k])               colorSizePriceMap[k] = {};
        if (!colorSizePriceMap[k][r.color])      colorSizePriceMap[k][r.color] = {};
        const curCP = colorSizePriceMap[k][r.color][bkt.key];
        if (curCP == null || r.price < curCP) colorSizePriceMap[k][r.color][bkt.key] = r.price;

        if (!sizePriceMap[k]) sizePriceMap[k] = {};
        const curSP = sizePriceMap[k][bkt.key];
        if (curSP == null || r.price < curSP) sizePriceMap[k][bkt.key] = r.price;
      }

      if (!modelBuckets[k]) modelBuckets[k] = [];
      if (!modelBuckets[k].some(s => s.key === bkt.key)) {
        modelBuckets[k].push({ label: bkt.label, key: bkt.key });
      }
    }

    // Attach sizeImages + sizePrices to every swatch
    for (const model of Object.keys(swatchMap)) {
      swatchMap[model] = swatchMap[model].map(sw => ({
        ...sw,
        sizeImages: (colorSizeMap[model]      && colorSizeMap[model][sw.color])      || {},
        sizePrices: (colorSizePriceMap[model] && colorSizePriceMap[model][sw.color]) || {},
      }));
    }

    /* Sort the size chips by width before anything reads them.

       They are built by walking csRows and pushing each bucket the first
       time it is seen — and that query is ORDER BY model, brand, COLOUR,
       width. Colour-major, so the chips came out grouped by colour rather
       than sorted by size. Most models looked fine by luck, because their
       smallest width happened to sit in the first colour; London has a 25"
       that exists only in its second colour, so it rendered
       "30 36 48 60 72 25".

       Sorting here rather than reordering the query: csRows also feeds
       colorSizeMap and sizeImageMap, which are keyed lookups and do not
       care about row order, but changing the ORDER BY to satisfy this one
       consumer would be a change with no local justification. */
    for (const model of Object.keys(modelBuckets)) {
      modelBuckets[model].sort((a, b) => a.key - b.key);
    }

    // Attach priceFrom to each size bucket
    for (const model of Object.keys(modelBuckets)) {
      modelBuckets[model] = modelBuckets[model].map(bkt => ({
        ...bkt,
        priceFrom: (sizePriceMap[model] && sizePriceMap[model][bkt.key]) ?? null,
      }));
    }

    /* ── Which product each model card leads with ─────────────────────
       Hand-picked default_sku first, otherwise the best-selling variant
       nationally. See src/utils/modelHero.js — the rule is shared with the
       collection page so the two cannot rank differently. */
    const heroOverrides = {};
    curatedModels.forEach(r => {
      if (r.default_sku) heroOverrides[modelKey({ model: r.model_name, brand: r.brand })] = r.default_sku;
    });
    const defaultBySku = await fetchModelHeroes(bvoPool, modelRows, heroOverrides);

    return modelRows.map(r => {
      /* RESOLVED 2026-09-05 — was the last map on the site still keyed on
         model name alone. A curated row for "Bristol" applied its custom
         image, video and tagline to EVERY brand's Bristol.

         model_groups.brand now exists and is backfilled, so this keys on
         (model, brand) like the rest. Note the precondition: if the
         column were missing, the curated query above would throw,
         curatedModels would be empty, and this would fall back to auto
         ranking rather than mis-apply an overlay. */
      const ov  = mgOverlay[modelKey(r)] || {};
      const def = defaultBySku[modelKey(r)] || null;

      /* Which size chip to preselect. The chip carries a BUCKET key, not a
         raw width, so the chosen product's width_in has to go through the
         same toBucket() the chips were built with — comparing width to
         bucket key directly would match nothing and silently leave the
         first chip active. */
      const defBucket = (def && def.width_in) ? toBucket(Math.round(Number(def.width_in))) : null;

      return {
        ...r,
        /* Precedence: custom_image (an explicitly uploaded picture) beats
           the starting product's photo, which beats the automatic pick.
           custom_image stays on top because it is the more specific
           instruction — someone uploaded that file for this card. */
        image_url:    ov.custom_image  || (def && def.image_url) || r.image_url,
        video_url:    ov.mg_video_url  || r.video_url,
        mg_desc:      ov.description   || null,   // tagline from model_groups
        is_curated:   !!ov.model_name,
        sizes:        modelBuckets[modelKey(r)] || [],
        finishes:     swatchMap[modelKey(r)]    || [],
        sizeImageMap: sizeImageMap[modelKey(r)] || {},
        // Null when unset or unresolvable — the template falls back to
        // its original "first one wins" behaviour on null.
        defaultSku:      def ? def.sku : null,
        defaultColor:    def ? def.color : null,
        defaultSizeKey:  defBucket ? defBucket.key : null,
        defaultPrice:    def && def.price != null ? Number(def.price) : null,
        defaultCompare:  def && def.compare_price != null ? Number(def.compare_price) : null,

        /* Corner badge. Replaces a "Save $X" that duplicated the figure in
           the price row below it. Each card rotates only among badges it
           qualifies for — see src/utils/cardBadge.js. Material and stock
           come from the hero, because that is the product on the card. */
        cardBadge: pickBadge({
          key:         modelKey(r),
          onSale:      !!(r.compare_price_from && r.price_from && r.compare_price_from > r.price_from),
          qty:         def ? def.qty_on_hand : null,
          colorCount:  (swatchMap[modelKey(r)] || []).length,
          material:    def ? def.primary_material : null,
          demandScore: Number(r.model_demand) || 0,
        }),
      };
    });
  } catch {
    return [];
  }
}

async function getFeaturedCategories() {
  try {
    const [rows] = await bvoPool.query(`
      SELECT slug, name, description, image_url
      FROM categories
      WHERE is_active = 1 AND parent_id IS NULL
      ORDER BY sort_order
    `);
    return rows;
  } catch {
    return [];
  }
}

async function getFeaturedInspirationPages() {
  try {
    // Fetch up to 3 inspiration pages that have images, ordered by sort_order
    const [rows] = await bvoPool.query(`
      SELECT slug, title, meta_desc, og_image
      FROM pages
      WHERE is_visible = 1 AND page_type = 'inspiration' AND og_image IS NOT NULL AND og_image != ''
      ORDER BY sort_order ASC, id ASC
      LIMIT 3
    `);
    // If fewer than 3 have images, fill the rest with any visible inspiration pages
    if (rows.length < 3) {
      const existingSlugs = rows.map(r => r.slug);
      const ph = existingSlugs.length ? `AND slug NOT IN (${existingSlugs.map(() => '?').join(',')})` : '';
      const [extra] = await bvoPool.query(`
        SELECT slug, title, meta_desc, og_image
        FROM pages
        WHERE is_visible = 1 AND page_type = 'inspiration' ${ph}
        ORDER BY sort_order ASC, id ASC
        LIMIT ?
      `, [...existingSlugs, 3 - rows.length]);
      rows.push(...extra);
    }
    return rows;
  } catch {
    return [];
  }
}

/* Section bases whose content is fetched per slot. Each may appear as the
   bare key or as base_2, base_3 … once duplicated in the Theme Editor. */
const PER_SLOT_BASES = ['featured_section', 'featured_models'];

/**
 * Resolve every featured_* slot in the homepage order to its own row set.
 *
 * Returns { featured_section: [...], featured_models_2: [...], ... } keyed
 * by the FULL slot key, so two copies of a section with different filters
 * hold different content. Before this existed there was one `products`
 * array and one `featuredModels` array shared by every copy, which is why
 * duplicating these sections was not offered.
 *
 * Identical filter sets share one query — three bands all scoped to James
 * Martin cost one round trip, not three.
 */
async function getSectionData(ts) {
  const order = Array.isArray(ts.homepage_section_order) ? ts.homepage_section_order : [];
  const slots = order.filter(k => PER_SLOT_BASES.includes(k.replace(/_\d+$/, '')));

  const cache = new Map();   // filter signature -> Promise of rows
  const out   = {};

  for (const slot of slots) {
    const base = slot.replace(/_\d+$/, '');
    const cfg  = ts[slot] || {};
    if (cfg.enabled === false) { out[slot] = []; continue; }

    const opts = {
      limit:    cfg.limit,
      brand:    cfg.brand,
      category: cfg.category,
      ptype:    cfg.ptype,
    };
    /* base is part of the signature: featured_section and featured_models
       return different shapes, so they must never share a cache entry even
       with identical filters. */
    const sig = base + '|' + sectionFilters(opts).key + '|' + (parseInt(cfg.limit) || 0);

    if (!cache.has(sig)) {
      cache.set(sig, base === 'featured_models'
        ? getFeaturedModels(opts)
        : getFeaturedProducts(opts));
    }
    out[slot] = await cache.get(sig);
  }
  return out;
}

exports.index = async (req, res, next) => {
  try {
    const ts = themeSettings.get();

    const [sectionData, categories, inspirationPages] = await Promise.all([
      getSectionData(ts),
      getFeaturedCategories(),
      getFeaturedInspirationPages(),
    ]);

    res.render('pages/index', {
      pageTitle: ts.seo?.home_title || 'BathroomVanitiesOutlet.com — Premium Vanities at Outlet Prices',
      metaDesc:  ts.seo?.home_description || 'Shop premium bathroom vanities, mirrors, faucets and accessories. Free shipping on all orders. Outlet prices on top brands.',
      /* `products` and `featuredModels` are kept as aliases for the base
         slot. index.ejs reads sectionData now, but other includes and any
         cached view could still reference these, and an undefined local is
         a hard EJS error rather than an empty section. */
      products:      sectionData.featured_section || [],
      featuredModels: sectionData.featured_models || [],
      sectionData,
      categories,
      inspirationPages,
      settings: ts,
    });
  } catch (err) {
    next(err);
  }
};
