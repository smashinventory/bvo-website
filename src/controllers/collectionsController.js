'use strict';

const Category                                          = require('../models/Category');
const Product                                           = require('../models/Product');
const Customer                                          = require('../models/Customer');
const { FAMILIES, normalize, getFamily, CABINET_KEYS, METAL_KEYS } = require('../config/colorFamilies');
const { SIZE_BUCKETS }                                  = require('../config/sizeBuckets');
const { bvoPool }                                       = require('../config/database');

/* ── Color family hex lookup: family_key → hex / border ──────────── */
const FAMILY_HEX = {};
FAMILIES.forEach(f => { FAMILY_HEX[f.key] = f.hex; FAMILY_HEX[f.key + '_border'] = f.border; });

const MODELS_PER_PAGE = 12;

/* ── MODEL CARD IDENTITY — read before touching any model-keyed map ──
   A model is identified by (model, brand), NEVER by model alone.

   ER Vanities and James Martin Vanities both sell a "Bristol". Keying a
   per-model lookup on the name alone makes one brand overwrite the other
   (assignment) or concatenate with it (push). The push case is the nastier
   one: the card shows a merged finish list, and clicking a swatch loads the
   other brand's photography.

   THE TRAP: the row must actually CARRY brand. If a query does not SELECT
   p.brand, r.brand is undefined, the key degrades to "Bristol||undefined",
   and the collision returns while looking fixed.

   The same string is built in views/pages/collection.ejs — if this format
   ever changes, that template changes with it. */
const mk = r => `${r.model}||${r.brand}`;
// SIZE_BUCKETS imported from src/config/sizeBuckets.js — shared with megaMenuData middleware

/* ── Windowed pagination ─────────────────────────────────────────── *
 * Returns page numbers with null for ellipsis gaps.
 * e.g. page=16, pages=177 → [1, null, 14, 15, 16, 17, 18, null, 177]
 */
function buildPageWindow(page, pages) {
  if (pages <= 9) return Array.from({ length: pages }, (_, i) => i + 1);
  const out = [1];
  if (page > 4)          out.push(null);
  for (let i = Math.max(2, page - 2); i <= Math.min(pages - 1, page + 2); i++) out.push(i);
  if (page < pages - 3)  out.push(null);
  out.push(pages);
  return out;
}

/* ── /collections ────────────────────────────────────────────────── */
exports.index = async (req, res, next) => {
  try {
    const categories = await Category.findAll();
    res.render('pages/collections', {
      pageTitle: 'All Collections | BathroomVanitiesOutlet.com',
      metaDesc:  'Browse our full range of bathroom vanities, mirrors, faucets, lighting, and accessories.',
      categories,
    });
  } catch (err) { next(err); }
};

/* ── /collections/:slug ──────────────────────────────────────────── */
exports.show = async (req, res, next) => {
  try {
    const { slug } = req.params;

    // ── Virtual "sale" collection ──────────────────────────────────
    if (slug === 'sale') {
      const [saleRows] = await bvoPool.query(`
        SELECT p.id, p.slug, p.name, p.brand, p.price, p.compare_price,
               p.is_new, p.is_featured,
               COALESCE(p.primary_image_url, pi.url) AS primary_image,
               (SELECT pi2.url FROM product_images pi2
                WHERE pi2.product_id = p.id
                ORDER BY pi2.sort_order ASC, pi2.id ASC
                LIMIT 1 OFFSET 1) AS hover_image,
               'sale' AS badge
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        WHERE p.is_active = 1 AND p.compare_price IS NOT NULL AND p.compare_price > p.price
        ORDER BY p.is_featured DESC, p.created_at DESC
        LIMIT 48
      `).catch(err => {
        /* Was `.catch(() => [[]])` — silent. The Sale page would render
           completely empty and look like a legitimately empty promotion
           rather than a broken query. */
        console.error('[collections] sale query FAILED:', err.code, err.sqlMessage || err.message);
        return [[]];
      });
      const products = Array.isArray(saleRows[0]) ? saleRows[0] : saleRows;
      return res.render('pages/collection', {
        pageTitle:    'Sale | BathroomVanitiesOutlet.com',
        metaDesc:     'Shop discounted bathroom vanities, mirrors, faucets and accessories.',
        category:     { id: null, slug: 'sale', name: 'Sale', description: 'Discounted products — limited time offers', meta_title: 'Sale', meta_desc: '' },
        isVanityCategory: false,
        products,
        total: products.length, page: 1, pages: 1, perPage: 48,
        pageWindow: buildPageWindow(1, 1),
        sort: 'featured',
        brands: [], productTypes: [],
        attrFilters: {}, activeAttrFilters: {},
        rangeFilters: {},
        minPrice: undefined, maxPrice: undefined,
        priceRange: { min: 0, max: 9999 },
        availableBrands: [],
        attributeDefs: [],
        availableAttrValues: {},
        hasActiveFilters: false,
        // Primary color filter — not applicable on sale page
        colorFamiliesConfig: [],
        colorFamilyActive: [],
        colorExactActive: [],
        availFinishes: [],
        // Hardware finish filter — not applicable on sale page
        hwColorFamiliesConfig: [],
        hwColorFamilyActive: [],
        hwColorExactActive: [],
        availHardwareFinishes: [],
      });
    }

    // ── Regular category collection ────────────────────────────────

    // Fetch category first — needed to determine color context before param parsing
    const category = await Category.findBySlug(slug);
    if (!category) {
      return res.status(404).render('pages/404', { pageTitle: '404 | BathroomVanitiesOutlet.com' });
    }

    // ── Model-group display mode ──────────────────────────────────
    // Categories with display_mode = 'model-group' group products by model.
    // Uses SIZE_BUCKETS (Rule 10) and the same color-family infrastructure as
    // every other collection page. Products are sourced from bathroom-vanities
    // (not from the display category itself — see mgProductCatId below).
    if (category.display_mode === 'model-group') {
      // Products for model-group pages live in bathroom-vanities, not in the
      // display category (vanity-models). Look up the source category by slug
      // so we're not relying on a hardcoded ID. (Rule 12 — canonical slugs)
      const mgSourceCat    = await Category.findBySlug('bathroom-vanities');
      const mgProductCatId = mgSourceCat ? mgSourceCat.id : 1;

      /* ── MODEL CARD IDENTITY ────────────────────────────────────────
         A model card is identified by (model, brand) — NEVER by model
         alone. ER Vanities and James Martin Vanities both sell a
         "Bristol"; keying on model alone makes one overwrite the other,
         or worse, concatenates their finishes so a swatch click loads the
         other brand's photography.

         MOVED HERE 2026-09-05 from line ~355. It was declared below its
         first use once mgModelSinkMap started using it, which is a TDZ
         ReferenceError at runtime — and `node --check` does not catch it,
         because it is a scope error rather than a syntax error. Declared
         once, at the top of the block, so every map below can use it.

         The trap when applying this: the row must actually CARRY brand.
         If the query does not SELECT p.brand, r.brand is undefined, the
         key silently degrades to "Bristol||undefined", and the collision
         comes back looking exactly like it was never fixed.

         mk() is declared at module scope — see the note at the top. */

      const mgPage = Math.max(1, parseInt(req.query.page || '1', 10));

      // Active filter values — sizes are bucket labels (strings), not raw numbers
      const mgActiveSizes      = [].concat(req.query.size_in      || []).filter(Boolean);
      const mgActiveBrands     = [].concat(req.query.brand         || []).filter(Boolean);
      let   mgActiveTypes      = [].concat(req.query.type          || []).filter(Boolean);
      // Taxonomy overhaul 2026-07-31: auto-inject product_type filters for new SEO display
      // categories so they show only the correct sub-type without requiring a ?type= param.
      // Products physically live in bathroom-vanities; these slugs are routing/display only.
      const SLUG_DEFAULT_TYPES = {
        'bathroom-vanities-with-tops': ['Single Sink Vanity With Top', 'Double Sink Vanity With Top'],
        'bathroom-vanity-cabinets':    ['Single Sink Cabinet Only',    'Double Sink Cabinet Only'],
      };
      if (SLUG_DEFAULT_TYPES[slug] && mgActiveTypes.length === 0) {
        mgActiveTypes = SLUG_DEFAULT_TYPES[slug];
      }
      const mgColorFamilyParam = [].concat(req.query.color_family  || []).filter(Boolean);
      const mgColorExactParam  = [].concat(req.query.color_exact   || []).filter(Boolean);
      const mgMinPrice         = req.query.min_price ? parseFloat(req.query.min_price) : undefined;
      const mgMaxPrice         = req.query.max_price ? parseFloat(req.query.max_price) : undefined;

      // Color context — vanities use cabinet context for exact-color normalization
      // (same as isVanityCategory = true in the regular collection route)
      const mgExactFamilyKeys = new Set();
      mgColorExactParam.forEach(v => {
        const fam = normalize(v, 'cabinet') || normalize(v, 'metal');
        if (fam) mgExactFamilyKeys.add(fam);
      });
      const mgFamilyLevelKeys = mgColorFamilyParam.filter(f => !mgExactFamilyKeys.has(f));
      const mgHasColorFilter  = mgColorFamilyParam.length > 0 || mgColorExactParam.length > 0;

      const mgHasActiveFilters = !!(
        mgActiveSizes.length || mgActiveBrands.length || mgActiveTypes.length ||
        mgHasColorFilter || mgMinPrice != null || mgMaxPrice != null
      );

      // Filter option universe — all active products that have a model assigned.
      // No width_in constraint here so all colors (including gray products that
      // may lack a width) appear in the color filter options.
      // product_type + model included so we can detect Single/Double Sink configs per size bucket.
      const [mgOptRows] = await bvoPool.query(`
        SELECT DISTINCT p.model, p.width_in AS size_in, p.brand, p.color, p.color_family, p.product_type
        FROM products p
        WHERE p.is_active = 1 AND p.model IS NOT NULL AND p.category_id = ?
      `, [mgProductCatId]);

      // ── S/D size chip detection ───────────────────────────────────────────
      // For each size bucket, check whether BOTH Single Sink AND Double Sink
      // products exist. When both exist, emit "60S" and "60D" chips instead of
      // a single "60" chip so shoppers can filter by sink configuration.
      // Per-model map is also built here for use in the post-query size filter.
      const mgBktSinkPresent  = {}; // { '60': { S: true, D: true } }
      const mgModelSinkMap    = {}; // { modelName: { '60': { S: true, D: true } } }
      mgOptRows.forEach(r => {
        if (!r.size_in || r.size_in <= 0) return;
        const bkt = SIZE_BUCKETS.find(b => r.size_in >= b.min && r.size_in <= b.max);
        if (!bkt) return;
        const pt   = r.product_type || '';
        const sink = pt.includes('Single') ? 'S' : pt.includes('Double') ? 'D' : null;
        // Global (category-level) presence
        if (!mgBktSinkPresent[bkt.label]) mgBktSinkPresent[bkt.label] = {};
        mgBktSinkPresent[bkt.label][sink || 'none'] = true;
        /* Per-model presence (used when filtering mgModels by S/D chip).

           Keyed by mk(r) — (model, brand) — NOT by model alone. James
           Martin's Bristol has Double Sink widths that ER Vanities'
           Bristol does not, so a bare [r.model] let a 60D chip match the
           ER card on the strength of JM inventory that does not exist
           under that name. mgOptRows already SELECTs p.brand, so mk()
           resolves properly here — no query change needed. */
        if (r.model) {
          const k = mk(r);
          if (!mgModelSinkMap[k])             mgModelSinkMap[k] = {};
          if (!mgModelSinkMap[k][bkt.label])  mgModelSinkMap[k][bkt.label] = {};
          mgModelSinkMap[k][bkt.label][sink || 'none'] = true;
        }
      });

      // Emit chip labels: "60S" + "60D" when both configs exist, plain "60" otherwise.
      const mgAvailSizes = [];
      SIZE_BUCKETS.forEach(bkt => {
        const sinks = mgBktSinkPresent[bkt.label];
        if (!sinks) return; // no products in this bucket
        if (sinks['S'] && sinks['D']) {
          mgAvailSizes.push(bkt.label + 'S');
          mgAvailSizes.push(bkt.label + 'D');
        } else {
          mgAvailSizes.push(bkt.label);
        }
      });
      const mgAllBrands          = [...new Set(mgOptRows.map(r => r.brand).filter(Boolean))].sort();
      const mgAvailFinishes      = [...new Set(mgOptRows.map(r => r.color).filter(Boolean))].sort();
      // color_family keys directly — used as primary visibility signal so families
      // whose products have non-standard color strings still appear in the sidebar.
      const mgAvailColorFamilies = [...new Set(mgOptRows.map(r => r.color_family).filter(Boolean))];
      // Available product_types for the Configuration filter sidebar.
      // Scoped to SLUG_DEFAULT_TYPES[slug] when on a display category (bathroom-vanities-with-tops,
      // bathroom-vanity-cabinets) so cabinet types never appear on the with-tops page and vice versa.
      // On bathroom-vanities (all vanities) all types are shown.
      const mgRawAvailTypes      = [...new Set(mgOptRows.map(r => r.product_type).filter(Boolean))].sort();
      const mgAvailTypes         = SLUG_DEFAULT_TYPES[slug]
        ? mgRawAvailTypes.filter(t => SLUG_DEFAULT_TYPES[slug].includes(t))
        : mgRawAvailTypes;

      // Color families config — ALL families (cabinet + metallic-finish vanities).
      // Same pool as the regular vanity collection route. The template's
      // visibleFamilies check hides any family with no matching products.
      const mgColorFamiliesConfig = FAMILIES.map(fam => ({
        ...fam,
        isActive:    mgColorFamilyParam.includes(fam.key) || mgExactFamilyKeys.has(fam.key),
        isOpen:      mgColorFamilyParam.includes(fam.key) || mgExactFamilyKeys.has(fam.key),
        activeExact: mgColorExactParam.filter(e =>
          (normalize(e, 'cabinet') || normalize(e, 'metal')) === fam.key
        ),
      }));

      // Build model query — two-layer filter strategy:
      //
      //   WHERE:  row-level filters that narrow which PRODUCTS enter the GROUP BY.
      //           Only brand goes here; color does NOT — see HAVING note below.
      //
      //   HAVING: model-level filters that discard entire model groups after
      //           aggregation.  Color filtering belongs here so that:
      //             (a) one card per model/brand is produced (correct grouping), and
      //             (b) sizes_csv / price_from / price_to reflect the FULL model
      //                 range, not just the filtered color's variants.
      //
      let mgWhere        = 'p.is_active = 1 AND p.model IS NOT NULL AND p.category_id = ?';
      const mgWhereParams = [mgProductCatId];
      const mgHavingParts  = [];
      const mgHavingParams = [];

      if (mgActiveBrands.length) {
        mgWhere += ` AND p.brand IN (${mgActiveBrands.map(() => '?').join(',')})`;
        mgWhereParams.push(...mgActiveBrands);
      }

      // Product type → WHERE (model must contain at least one SKU of the selected type)
      if (mgActiveTypes.length) {
        mgWhere += ` AND p.product_type IN (${mgActiveTypes.map(() => '?').join(',')})`;
        mgWhereParams.push(...mgActiveTypes);
      }

      // Color → HAVING (keeps full model data, filters model groups not individual rows)
      //
      // Dual-match strategy: check BOTH p.color_family AND p.color against member
      // strings.  Products imported before color_family normalization was in place
      // may have color_family = NULL but a correct p.color value (e.g. 'Radiant Gold',
      // 'Matte Black').  Checking only color_family would silently miss them — the
      // swatch appears (via the template's p.color fallback) but filtering returns 0.
      if (mgHasColorFilter) {
        const colorHavingParts = [];

        if (mgFamilyLevelKeys.length) {
          // 1a. color_family key match (products with correctly normalized color_family)
          colorHavingParts.push(
            `SUM(CASE WHEN p.color_family IN (${mgFamilyLevelKeys.map(() => '?').join(',')}) THEN 1 ELSE 0 END) > 0`
          );
          mgHavingParams.push(...mgFamilyLevelKeys);

          // 1b. p.color member-string match (products where color_family is NULL but
          //     p.color is a known member of one of the selected families)
          const familyMembers = mgFamilyLevelKeys.flatMap(fk => {
            const fam = FAMILIES.find(f => f.key === fk);
            return fam ? fam.members : [];
          });
          if (familyMembers.length) {
            colorHavingParts.push(
              `SUM(CASE WHEN p.color IN (${familyMembers.map(() => '?').join(',')}) THEN 1 ELSE 0 END) > 0`
            );
            mgHavingParams.push(...familyMembers);
          }
        }

        if (mgColorExactParam.length) {
          colorHavingParts.push(
            `SUM(CASE WHEN p.color IN (${mgColorExactParam.map(() => '?').join(',')}) THEN 1 ELSE 0 END) > 0`
          );
          mgHavingParams.push(...mgColorExactParam);
        }

        if (colorHavingParts.length) {
          mgHavingParts.push(`(${colorHavingParts.join(' OR ')})`);
        }
      }

      // Price → HAVING (compare starting price against user's range)
      // MIN(price) is the model's entry price; filter models whose entry price is in range.
      if (mgMinPrice != null) {
        mgHavingParts.push('MIN(p.price) >= ?');
        mgHavingParams.push(mgMinPrice);
      }
      if (mgMaxPrice != null) {
        mgHavingParts.push('MIN(p.price) <= ?');
        mgHavingParams.push(mgMaxPrice);
      }

      const mgHavingClause = mgHavingParts.length
        ? `HAVING ${mgHavingParts.join(' AND ')}`
        : '';
      const mgAllParams = [...mgWhereParams, ...mgHavingParams];

      // Fetch models (one row per model/brand group)
      const [mgModelRows] = await bvoPool.query(`
        SELECT
          p.model,
          p.brand,
          MIN(p.price)                                     AS price_from,
          MAX(p.price)                                     AS price_to,
          MIN(p.compare_price)                             AS compare_price_from,
          GROUP_CONCAT(DISTINCT CAST(p.width_in AS UNSIGNED)
            ORDER BY p.width_in SEPARATOR ',')             AS sizes_csv,
          COALESCE(
            MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END),
            MIN(pi.url)
          )                                                AS image_url,
          MIN(CASE WHEN p.video_url IS NOT NULL THEN p.video_url END)
                                                           AS video_url,
          /* Collection-level national demand — the summed movement of
             every SKU in the model. Same measure the homepage uses, so
             "See All" opens on the same ranking the carousel showed
             rather than reshuffling into alphabetical order. */
          SUM(p.demand_score)                              AS model_demand
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        WHERE ${mgWhere}
        GROUP BY p.model, p.brand
        ${mgHavingClause}
        /* Was ORDER BY p.brand, p.model — alphabetical, which buried the
           models that actually sell behind whatever starts with A.

           demand_score is INT UNSIGNED NOT NULL DEFAULT 0, so unscored
           models read 0 and sink to the bottom, where brand and name keep
           them in a stable, predictable order. */
        ORDER BY SUM(p.demand_score) DESC, p.brand, p.model
      `, mgAllParams);

      // Color × size image map — one image per model+color+size combination.
      // Drives synchronized image preview: swatch click respects active size,
      // size chip click respects active color. One query replaces the old
      // separate swatch-image and size-image queries.
      // KEYED BY MODEL **AND BRAND**, not model alone. The model query above
      // groups by (model, brand), so two brands that happen to share a model
      // name produce two separate cards — but until 2026-09-05 every map below
      // was keyed on model only, so the second brand's rows silently overwrote
      // the first's. ER Vanities Bristol and James Martin Bristol collided the
      // day ER Vanities loaded: the ER card rendered James Martin's
      // images.salsify.com photography, its swatches and its prices.
      //
      // mk(row) is the only key that may be used for these maps. A bare
      // [r.model] is the bug.
      //
      // mk() is declared at the top of this block (see the note there) —
      // mgModelSinkMap above needs it too, and a const cannot be used
      // before its declaration.

      const mgModelNames    = [...new Set(mgModelRows.map(r => r.model).filter(Boolean))];
      const mgModelBrands   = [...new Set(mgModelRows.map(r => r.brand).filter(Boolean))];
      const mgColorSizeMap  = {}; // [model||brand][color][size] = image_url
      const mgSizeImageMap  = {}; // [model||brand][size] = image_url (first-color fallback for chips)
      const mgSwatchMap     = {}; // [model||brand] = [{color, hex, border, image_url, sizeImages}]

      if (mgModelNames.length) {
        // Build mgCsRows WHERE dynamically so product_type filter applies when mgActiveTypes
        // is set (either by user ?type= param or by SLUG_DEFAULT_TYPES auto-injection above).
        // Without this, Cabinet Only model cards would still show Single/Double Sink swatches
        // when browsing bathroom-vanity-cabinets or filtering by type on bathroom-vanities.
        let   mgCsWhere    = `p.is_active = 1 AND p.category_id = ? AND p.model IN (${mgModelNames.map(() => '?').join(',')}) AND p.color IS NOT NULL`;
        const mgCsParams   = [mgProductCatId, ...mgModelNames];
        if (mgActiveTypes.length) {
          mgCsWhere += ` AND p.product_type IN (${mgActiveTypes.map(() => '?').join(',')})`;
          mgCsParams.push(...mgActiveTypes);
        }
        // Scope to the brands actually on this page. Derived from mgModelRows,
        // NOT from mgActiveBrands — the ?brand= param is empty on the unfiltered
        // page, and that is exactly the page where both Bristols appear.
        if (mgModelBrands.length) {
          mgCsWhere += ` AND p.brand IN (${mgModelBrands.map(() => '?').join(',')})`;
          mgCsParams.push(...mgModelBrands);
        }
        const [mgCsRows] = await bvoPool.query(`
          SELECT p.model, p.brand, p.color, p.color_family, p.width_in AS size_in,
            COALESCE(
              MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END),
              MIN(pi.url)
            ) AS image_url,
            MIN(p.price) AS price
          FROM products p
          LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
          WHERE ${mgCsWhere}
          GROUP BY p.model, p.brand, p.color, p.color_family, p.width_in
          ORDER BY p.brand, p.model, p.color, p.width_in
        `, mgCsParams);

        const mgColorSizePriceMap = {}; // [model||brand][color][bucketKey] = min price
        const mgSizePriceMap      = {}; // [model||brand][bucketKey] = min price across all colors

        // Build color×size map and derive the downstream maps from it
        for (const r of mgCsRows) {
          const k       = mk(r);
          const sizeKey = r.size_in != null ? Math.round(Number(r.size_in)) : null;

          // Resolve raw width → bucket key for price and image maps
          const bkt       = sizeKey ? SIZE_BUCKETS.find(b => sizeKey >= b.min && sizeKey <= b.max) : null;
          const bucketKey = bkt ? (parseInt(bkt.label, 10) || 0) : 0;

          // color × size image map
          if (!mgColorSizeMap[k]) mgColorSizeMap[k] = {};
          if (!mgColorSizeMap[k][r.color]) mgColorSizeMap[k][r.color] = {};
          if (sizeKey > 0 && r.image_url) {
            mgColorSizeMap[k][r.color][sizeKey] = r.image_url;
          }

          // size fallback image map (first-seen color wins for each size)
          if (sizeKey > 0 && r.image_url) {
            if (!mgSizeImageMap[k]) mgSizeImageMap[k] = {};
            if (!mgSizeImageMap[k][sizeKey]) {
              mgSizeImageMap[k][sizeKey] = r.image_url;
            }
          }

          // color × size price map (keep minimum price per bucket)
          if (bucketKey > 0 && r.price != null) {
            if (!mgColorSizePriceMap[k])               mgColorSizePriceMap[k] = {};
            if (!mgColorSizePriceMap[k][r.color])      mgColorSizePriceMap[k][r.color] = {};
            const curCP = mgColorSizePriceMap[k][r.color][bucketKey];
            if (curCP == null || r.price < curCP) mgColorSizePriceMap[k][r.color][bucketKey] = r.price;

            // size-level min price (across all colors)
            if (!mgSizePriceMap[k]) mgSizePriceMap[k] = {};
            const curSP = mgSizePriceMap[k][bucketKey];
            if (curSP == null || r.price < curSP) mgSizePriceMap[k][bucketKey] = r.price;
          }
        }

        // Build swatch list (one entry per model+brand+color, preserving order)
        // Includes per-color size image map AND per-color size price map for JS price updates.
        const seenSwatchKey = new Set();
        for (const r of mgCsRows) {
          const k   = mk(r);
          const key = `${k}||${r.color}`;
          if (seenSwatchKey.has(key)) continue;
          seenSwatchKey.add(key);
          if (!mgSwatchMap[k]) mgSwatchMap[k] = [];
          const swatchFamilyKey = r.color_family || normalize(r.color, 'all') || '';
          const colorImgRow = mgCsRows.find(x => mk(x) === k && x.color === r.color && x.image_url);
          mgSwatchMap[k].push({
            color:        r.color,
            color_family: r.color_family,
            hex:          FAMILY_HEX[swatchFamilyKey]              || '#ccc',
            border:       FAMILY_HEX[swatchFamilyKey + '_border']  || '#aaa',
            image_url:    colorImgRow ? colorImgRow.image_url : null,
            sizeImages:   mgColorSizeMap[k][r.color]        || {},
            sizePrices:   mgColorSizePriceMap[k]?.[r.color] || {},
          });
        }

        // Expose size-level price map for hydration below
        mgModelRows.forEach(r => { r._sizePriceMap = mgSizePriceMap[mk(r)] || {}; });
      }

      // Hydrate model rows with parsed sizes + sizeImages + finishes arrays
      let mgModels = mgModelRows.map(r => ({
        ...r,
        sizes:      r.sizes_csv
          ? [...new Map(
              r.sizes_csv.split(',').map(Number).filter(Boolean)
                .map(rawSize => {
                  const bucket = SIZE_BUCKETS.find(b => rawSize >= b.min && rawSize <= b.max);
                  if (!bucket) return null;
                  const key = parseInt(bucket.label, 10) || 0;
                  // priceFrom = min price across all colors for this size bucket
                  const priceFrom = r._sizePriceMap?.[key] ?? null;
                  return key ? [key, { label: bucket.label, key, priceFrom }] : null;
                })
                .filter(Boolean)
            ).values()]
          : [],
        sizeImages: mgSizeImageMap[mk(r)] || {},
        finishes:   mgSwatchMap[mk(r)] || [],
      }));

      // Size bucket filter — post-query because sizes live per-product not per-model
      // Rule 10: compare against SIZE_BUCKETS ranges, not raw widths (±2" approximation)
      // Handles plain labels ("60") and S/D chip labels ("60S", "60D").
      if (mgActiveSizes.length) {
        // Parse each chip label into { bucketLabel, sink }
        const parsedChips = mgActiveSizes.map(chip => {
          if (chip.endsWith('S')) return { bucketLabel: chip.slice(0, -1), sink: 'S' };
          if (chip.endsWith('D')) return { bucketLabel: chip.slice(0, -1), sink: 'D' };
          return { bucketLabel: chip, sink: null };
        });
        mgModels = mgModels.filter(m =>
          parsedChips.some(({ bucketLabel, sink }) => {
            const bucket = SIZE_BUCKETS.find(b => b.label === bucketLabel);
            if (!bucket) return false;
            // Must have the right width in sizes_csv
            if (!m.sizes.some(ms => ms >= bucket.min && ms <= bucket.max)) return false;
            // If no sink filter, width match is sufficient
            if (!sink) return true;
            // Check per-model sink map so "60S" only matches models with Single Sink 60".
            // mk(m) — the card row carries brand (mgModelRows SELECTs p.brand),
            // so this reads the same (model, brand) key the map was written with.
            const sinkMap = mgModelSinkMap[mk(m)];
            return sinkMap && sinkMap[bucketLabel] && sinkMap[bucketLabel][sink];
          })
        );
      }

      const mgAllPrices = mgModelRows.map(r => r.price_from).filter(Boolean);
      const mgPriceMin  = mgAllPrices.length ? Math.min(...mgAllPrices) : 0;
      const mgPriceMax  = mgAllPrices.length ? Math.max(...mgAllPrices) : 9999;

      const mgTotal  = mgModels.length;
      const mgPages  = Math.ceil(mgTotal / MODELS_PER_PAGE) || 1;
      const mgOffset = (mgPage - 1) * MODELS_PER_PAGE;
      const mgPaged  = mgModels.slice(mgOffset, mgOffset + MODELS_PER_PAGE);

      const mgSiteUrl      = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';
      const mgCanonicalUrl = `${mgSiteUrl}/collections/${slug}`;
      const mgFilterCount  = (mgActiveSizes.length > 0 ? 1 : 0)
                           + (mgActiveBrands.length > 0 ? 1 : 0)
                           + (mgHasColorFilter ? 1 : 0)
                           + (mgMinPrice != null || mgMaxPrice != null ? 1 : 0);
      const mgNoindex = mgFilterCount >= 2;

      return res.render('pages/collection', {
        pageTitle:    `${category.meta_title || category.name} | BathroomVanitiesOutlet.com`,
        metaDesc:     category.meta_desc || category.description || '',
        canonicalUrl: mgCanonicalUrl,
        noindex:      mgNoindex,
        category,
        displayMode:  'model-group',
        // Model data
        models:      mgPaged,
        total:       mgTotal,
        page:        mgPage,
        pages:       mgPages,
        perPage:     MODELS_PER_PAGE,
        pageWindow:  buildPageWindow(mgPage, mgPages),
        hasActiveFilters: mgHasActiveFilters,
        // Filter sidebar — model-group specific variable names exposed to template
        availableSizes:      mgAvailSizes,
        activeSizes:         mgActiveSizes,
        allBrands:           mgAllBrands,
        activeBrands:        mgActiveBrands,
        mgActiveTypes,       // product_type filter (e.g. ['Cabinet Only'])
        mgAvailTypes,        // all product_types present in this category
        colorFamiliesConfig: mgColorFamiliesConfig,
        colorFamilyActive:   mgColorFamilyParam,
        colorExactActive:    mgColorExactParam,
        availFinishes:       mgAvailFinishes,
        availColorFamilies:  mgAvailColorFamilies,
        // Price filter
        minPrice:    mgMinPrice,
        maxPrice:    mgMaxPrice,
        priceRange:  { min: mgPriceMin, max: mgPriceMax },
        // Stubs — satisfy template vars used by regular-collection blocks
        // (those blocks are guarded by displayMode !== 'model-group', but
        //  EJS will error if variables are undefined, so we stub them out)
        isVanityCategory:      true,
        products:              [],
        sort:                  'featured',
        brands:                mgActiveBrands,
        productTypes:          [],
        model:                 null,
        modelColorMap:         {},
        modelSizeMap:          {},
        attrFilters:           {},
        rangeFilters:          {},
        availableBrands:       mgAllBrands,
        attributeDefs:         [],
        availableAttrValues:   {},
        familyHex:             FAMILY_HEX,
        hwColorFamiliesConfig: [],
        hwColorFamilyActive:   [],
        hwColorExactActive:    [],
        availHardwareFinishes: [],
        savedProductIds:       new Set(),
      });
    }

    const isVanityCategory  = category.id === 1;
    // Tops (cat 7) also support size/width chips — same SIZE_BUCKETS mechanism
    // as vanities since width_in is stored on all JM products including tops.
    const isSizableCategory = isVanityCategory || category.id === 7;

    // ── Parse standard query params ──────────────────────────────
    const page         = Math.max(1, parseInt(req.query.page  || '1', 10));
    /* null (not 'featured') when the visitor has not chosen a sort, so the
       model can pick the default AFTER counting results: popularity on a
       long list, featured on a short one. An explicit ?sort= always wins.
       The effective value comes back on the result and is what the dropdown
       renders — see below. */
    const sort         = req.query.sort || null;
    const brands       = [].concat(req.query.brand        || []).filter(Boolean);
    const productTypes = [].concat(req.query.type         || []).filter(Boolean);

    // Auto-inject product_type defaults for select slugs on the regular (non-model-group)
    // collection path — mirrors SLUG_DEFAULT_TYPES on the model-group path (line ~126).
    // bathroom-vanity-tops: Stone Tops only. Composite Tops are excluded from a la carte
    // browsing — they surface only as part of vanity+top combo product listings.
    const SLUG_DEFAULT_PRODUCT_TYPES = {
      'bathroom-vanity-tops': ['Stone Top'],
    };
    if (SLUG_DEFAULT_PRODUCT_TYPES[slug] && productTypes.length === 0) {
      productTypes.push(...SLUG_DEFAULT_PRODUCT_TYPES[slug]);
    }

    const model        = req.query.model || null;
    const minPrice     = req.query.min_price ? parseFloat(req.query.min_price) : undefined;
    const maxPrice     = req.query.max_price ? parseFloat(req.query.max_price) : undefined;

    // ── Primary color filter params ───────────────────────────────
    // Vanities: cabinet color (White, Navy, Walnut…)
    // All other categories: metallic finish (Chrome, Nickel, Bronze…)
    const colorFamilyParam = [].concat(req.query.color_family || []).filter(Boolean);
    const colorExactParam  = [].concat(req.query.color_exact  || []).filter(Boolean);

    // ── Hardware finish filter params (vanities only) ─────────────
    // Secondary color layer — cabinet pulls, handles, hardware
    const hwColorFamilyParam = [].concat(req.query.hw_color_family || []).filter(Boolean);
    const hwColorExactParam  = [].concat(req.query.hw_color_exact  || []).filter(Boolean);

    // ── Context-aware normalization ───────────────────────────────
    // Vanities primary = cabinet context; all other categories = metal context
    const primaryColorContext = isVanityCategory ? 'cabinet' : 'metal';

    // Primary color — exact sub-chip mode detection
    const exactFamilyKeys = new Set();
    colorExactParam.forEach(v => {
      const fam = normalize(v, primaryColorContext);
      if (fam) exactFamilyKeys.add(fam);
    });
    const familyLevelKeys = colorFamilyParam.filter(f => !exactFamilyKeys.has(f));
    const hasColorFilter  = colorFamilyParam.length > 0 || colorExactParam.length > 0;

    // Hardware finish — always metal context
    const hwExactFamilyKeys = new Set();
    hwColorExactParam.forEach(v => {
      const fam = normalize(v, 'metal');
      if (fam) hwExactFamilyKeys.add(fam);
    });
    const hwFamilyLevelKeys = hwColorFamilyParam.filter(f => !hwExactFamilyKeys.has(f));
    const hasHwColorFilter  = hwColorFamilyParam.length > 0 || hwColorExactParam.length > 0;

    // ── Color family configs for view ─────────────────────────────
    // Primary: ALL families for vanities (cabinet paint + metallic-finish vanities
    // such as Radiant Gold, Matte Black, Brushed Nickel which are stored in
    // products.color and map to metal family keys).
    // Metal-only for all other categories (mirrors, faucets, etc.).
    // The template's visibleFamilies check gates display: a family only renders
    // if fam.members.some(m => availFinishesLower.includes(m)) — so metal families
    // with no vanity products stay hidden automatically. See Task #34-C.
    const primaryFamilyPool = isVanityCategory
      ? FAMILIES                              // cabinet + metallic-finish vanities
      : FAMILIES.filter(f => f.type === 'metal');

    const colorFamiliesConfig = primaryFamilyPool.map(fam => ({
      ...fam,
      isActive:    colorFamilyParam.includes(fam.key) || exactFamilyKeys.has(fam.key),
      isOpen:      colorFamilyParam.includes(fam.key) || exactFamilyKeys.has(fam.key),
      activeExact: colorExactParam.filter(e => normalize(e, primaryColorContext) === fam.key),
    }));

    // Hardware finish config — metallic families, vanities only
    const hwColorFamiliesConfig = isVanityCategory
      ? FAMILIES.filter(f => f.type === 'metal').map(fam => ({
          ...fam,
          isActive:    hwColorFamilyParam.includes(fam.key) || hwExactFamilyKeys.has(fam.key),
          isOpen:      hwColorFamilyParam.includes(fam.key) || hwExactFamilyKeys.has(fam.key),
          activeExact: hwColorExactParam.filter(e => normalize(e, 'metal') === fam.key),
        }))
      : [];

    // colorFilters → primary (products.color_family column)
    const colorFilters = {
      families: familyLevelKeys,
      exact:    colorExactParam,
    };

    // hwColorFilters → EAV-based hardware_finish filtering (vanities only)
    const hwColorFilters = {
      families: hwFamilyLevelKeys,
      exact:    hwColorExactParam,
    };

    // ── Load attribute defs + filter option values ────────────────
    const [
      attributeDefs,
      availableBrands,
      availableAttrValues,
      [finishRows],
      [hwFinishRows],
      [cfKeyRows],
    ] = await Promise.all([
      Category.getAttributeDefinitions(category.id),
      Category.getBrandsForCategory(category.id),
      Product.getAllAttributeValues(category.id),
      // Primary finish options — from products.color column (vendor color strings)
      bvoPool.query(
        'SELECT DISTINCT color FROM products WHERE category_id = ? AND is_active = 1 AND color IS NOT NULL ORDER BY color',
        [category.id]
      ),
      // Hardware finish options — from EAV (vanities only; empty for other categories)
      bvoPool.query(
        `SELECT DISTINCT pav.value_text
         FROM product_attribute_values pav
         JOIN products p ON p.id = pav.product_id
         WHERE p.category_id = ? AND pav.attr_key = 'hardware_finish'
           AND pav.value_text IS NOT NULL
         ORDER BY pav.value_text`,
        [category.id]
      ),
      // Distinct color_family keys present in this category — primary swatch visibility signal.
      // Using color_family directly (not fam.members) means admin-remapped colors like
      // "Silver Oak → gray" cause the Gray swatch to appear even though "Silver Oak"
      // is not in gray's static members array.
      bvoPool.query(
        'SELECT DISTINCT color_family FROM products WHERE category_id = ? AND is_active = 1 AND color_family IS NOT NULL',
        [category.id]
      ),
    ]);
    const availFinishes         = finishRows.map(r => r.color);
    const availHardwareFinishes = hwFinishRows.map(r => r.value_text);
    // Array of BVO family keys that actually have products in this category
    const availColorFamilies    = cfKeyRows.map(r => r.color_family);

    // ── Parse dynamic attribute filters ──────────────────────────
    // ALL color_swatch attrs are handled by colorFilters / hwColorFilters above —
    // skip them here so they don't appear as checkbox/text filters.
    const attrFilters  = {};
    const rangeFilters = {};

    for (const def of attributeDefs) {
      if (def.attr_key === 'brand')           continue; // handled separately
      if (def.filter_type === 'color_swatch') continue; // handled by color filter system

      if (def.filter_type === 'range') {
        if (def.attr_key === 'size_in') {
          const sizeVals = [].concat(req.query['size_in'] || []).filter(Boolean);
          if (sizeVals.length) attrFilters['size_in'] = sizeVals;
        } else {
          const lo = req.query[`${def.attr_key}_min`];
          const hi = req.query[`${def.attr_key}_max`];
          if (lo != null || hi != null) {
            rangeFilters[def.attr_key] = {
              min: lo != null ? parseFloat(lo) : undefined,
              max: hi != null ? parseFloat(hi) : undefined,
            };
          }
        }
      } else {
        const vals = [].concat(req.query[def.attr_key] || []).filter(Boolean);
        if (vals.length) attrFilters[def.attr_key] = vals;
      }
    }

    // ── Stone material filter — tops (category 7) ─────────────────
    // Passed as ?countertop_material=<val>; applied as an EAV filter via
    // Product.findByCategory() which handles arbitrary EAV attr keys.
    // Stone sample images (category_id=10) are fetched here for the sidebar
    // swatch grid, matched to products by name keyword overlap at render time.
    let stoneMaterialActive   = [];
    let stoneMaterialSwatches = [];
    if (category.id === 7) {
      stoneMaterialActive = [].concat(req.query.countertop_material || []).filter(Boolean);
      if (stoneMaterialActive.length) attrFilters['countertop_material'] = stoneMaterialActive;

      const [sampleRows] = await bvoPool.query(`
        SELECT p.name,
          COALESCE(
            (SELECT pi.url FROM product_images pi
             WHERE pi.product_id = p.id
             ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1),
            p.primary_image_url
          ) AS img_url
        FROM products p
        WHERE p.brand       = 'James Martin Vanities'
          AND p.category_id = 10
          AND p.name        LIKE 'Stone Sample -%'
          AND p.is_active   = 1
        ORDER BY p.name ASC
      `);
      stoneMaterialSwatches = sampleRows.map(r => ({
        material: r.name.replace(/^Stone Sample\s*-\s*/i, '').trim(),
        imgUrl:   r.img_url || null,
      }));
    }

    const mergedAttrFilters = { ...attrFilters };
    for (const [key, { min, max }] of Object.entries(rangeFilters)) {
      mergedAttrFilters[key] = [min, max];
    }

    const hasActiveFilters = !!(
      brands.length || productTypes.length ||
      Object.keys(attrFilters).length || Object.keys(rangeFilters).length ||
      minPrice != null || maxPrice != null ||
      hasColorFilter || hasHwColorFilter || model
    );

    // ── SEO ───────────────────────────────────────────────────────
    const siteUrl      = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';
    const canonicalUrl = `${siteUrl}/collections/${slug}`;

    const activeFilterGroupCount = [
      brands.length > 0,
      productTypes.length > 0,
      ...Object.keys(attrFilters).map(k => attrFilters[k].length > 0),
      Object.keys(rangeFilters).length > 0,
      minPrice != null || maxPrice != null,
      hasColorFilter,
      hasHwColorFilter,
    ].filter(Boolean).length;
    const noindex = activeFilterGroupCount >= 2;

    // ── Fetch products, price range, and available size buckets ──
    // getAvailableWidths runs the same filters as the main query but WITHOUT
    // the size_in condition — so the sidebar only shows sizes that have products
    // in the current filtered view (e.g. black vanities → only their sizes).
    const [result, priceRange, availableWidths] = await Promise.all([
      Product.findByCategory(category.id, {
        page, sort, brands, productTypes,
        attrFilters: mergedAttrFilters,
        colorFilters,
        hwColorFilters,
        minPrice, maxPrice,
        model,
      }),
      Product.getPriceRange(category.id),
      isSizableCategory
        ? Product.getAvailableWidths(category.id, { brands, productTypes, colorFilters, hwColorFilters, minPrice, maxPrice, model })
        : Promise.resolve([]),
    ]);

    // Map raw width_in values → bucket labels; only populated buckets are passed to template
    const availableSizes = SIZE_BUCKETS
      .filter(b => availableWidths.some(w => w >= b.min && w <= b.max))
      .map(b => b.label);

    /* ── Model → color swatches map ──────────────────────────────────
       BRAND-SCOPED 2026-09-05. These three queries matched on p.model
       alone, so the ER Vanities Bristol card listed its own Natural White
       Ash swatch followed by James Martin's three — and clicking one of
       those loaded a James Martin image onto an ER card. modelColorMap
       PUSHES, which is why this instance concatenated rather than
       overwrote, and why it was the worst of the set.

       Matching is now on the (model, brand) PAIR via a row constructor:
         WHERE (p.model, p.brand) IN ((?,?),(?,?),...)

       Category scope was considered and deliberately NOT added. Brand
       scope is a bug fix; category scope is a behaviour change — a model
       spanning categories would silently lose swatches, and that loss
       looks identical to the bug being fixed here. Kept separate on
       purpose. */
    const pageModelPairs = [...new Map(
      result.products
        .filter(p => p.model)
        .map(p => [mk(p), [p.model, p.brand]])
    ).values()];
    // Flattened for the row-constructor placeholders: [m1,b1,m2,b2,...]
    const pageModelParams = pageModelPairs.flat();
    const pagePairSql     = pageModelPairs.map(() => '(?,?)').join(',');
    let modelColorMap = {};
    if (pageModelPairs.length) {
      const [mcRows] = await bvoPool.query(`
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
        WHERE (p.model, p.brand) IN (${pagePairSql})
          AND p.color IS NOT NULL AND p.is_active = 1
        GROUP BY p.model, p.brand, p.color, p.color_family
        ORDER BY p.model, p.brand, p.color
      `, pageModelParams);
      for (const r of mcRows) {
        const k = mk(r);
        if (!modelColorMap[k]) modelColorMap[k] = [];
        const swatchFamilyKey = r.color_family || normalize(r.color, 'all') || '';
        modelColorMap[k].push({
          color:        r.color,
          color_family: r.color_family,
          hex:          FAMILY_HEX[swatchFamilyKey]              || '#ccc',
          border:       FAMILY_HEX[swatchFamilyKey + '_border']  || '#aaa',
          image_url:    r.image_url || null,
        });
      }
    }

    // ── Model → size list map (bucketed via SIZE_BUCKETS Rule 10) ───
    // Each entry is {label, key} — label is the display string ('30', '20-', '84+'),
    // key is the numeric value used as data-size and as the sizeImages dict key.
    let modelSizeMap = {};
    if (pageModelPairs.length) {
      const [msRows] = await bvoPool.query(`
        SELECT DISTINCT p.model, p.brand, CAST(p.width_in AS UNSIGNED) AS size_in
        FROM products p
        WHERE (p.model, p.brand) IN (${pagePairSql})
          AND p.is_active = 1 AND p.width_in IS NOT NULL AND p.width_in > 0
        ORDER BY p.model, p.brand, p.width_in
      `, pageModelParams);
      for (const r of msRows) {
        const bucket = SIZE_BUCKETS.find(b => r.size_in >= b.min && r.size_in <= b.max);
        if (!bucket) continue;
        const bKey = parseInt(bucket.label, 10) || 0;
        if (!bKey) continue;
        const k = mk(r);
        if (!modelSizeMap[k]) modelSizeMap[k] = [];
        if (!modelSizeMap[k].some(s => s.key === bKey))
          modelSizeMap[k].push({ label: bucket.label, key: bKey });
      }
    }

    // ── Model → color × size image map (product-card size chips) ────
    // Keys use the same numeric bucket key as modelSizeMap entries.
    // First image encountered for a bucket wins (ORDER BY width_in ensures smallest first).
    let modelColorSizeMap = {};
    let modelSizeImageMap = {};
    if (pageModelPairs.length) {
      const [mcSizeRows] = await bvoPool.query(`
        SELECT p.model, p.brand, p.color, CAST(p.width_in AS UNSIGNED) AS size_in,
          COALESCE(
            MIN(CASE WHEN p.primary_image_url IS NOT NULL THEN p.primary_image_url END),
            MIN(pi.url)
          ) AS image_url
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        WHERE (p.model, p.brand) IN (${pagePairSql})
          AND p.color IS NOT NULL AND p.is_active = 1
          AND p.width_in IS NOT NULL AND p.width_in > 0
        GROUP BY p.model, p.brand, p.color, p.width_in
        ORDER BY p.model, p.brand, p.color, p.width_in
      `, pageModelParams);
      for (const r of mcSizeRows) {
        const rawSize = Math.round(Number(r.size_in));
        if (!rawSize || !r.image_url) continue;
        const bucket = SIZE_BUCKETS.find(b => rawSize >= b.min && rawSize <= b.max);
        if (!bucket) continue;
        const bKey = parseInt(bucket.label, 10) || 0;
        if (!bKey) continue;
        const k = mk(r);
        if (!modelColorSizeMap[k])           modelColorSizeMap[k] = {};
        if (!modelColorSizeMap[k][r.color])  modelColorSizeMap[k][r.color] = {};
        if (!modelColorSizeMap[k][r.color][bKey])  // first image per bucket wins
          modelColorSizeMap[k][r.color][bKey] = r.image_url;
        if (!modelSizeImageMap[k])            modelSizeImageMap[k] = {};
        if (!modelSizeImageMap[k][bKey])      modelSizeImageMap[k][bKey] = r.image_url;
      }
      // Attach per-bucket image dict to every swatch → emitted as data-size-images
      for (const mdl of Object.keys(modelColorMap)) {
        modelColorMap[mdl] = modelColorMap[mdl].map(sw => ({
          ...sw,
          sizeImages: (modelColorSizeMap[mdl] && modelColorSizeMap[mdl][sw.color]) || {},
        }));
      }
    }

    // Favorites
    const savedProductIds = req.session.customerId
      ? await Customer.getFavoriteIds(req.session.customerId)
      : new Set();

    res.render('pages/collection', {
      pageTitle:    `${category.meta_title || category.name} | BathroomVanitiesOutlet.com`,
      metaDesc:     category.meta_desc || category.description || '',
      canonicalUrl,
      noindex,
      category,
      isVanityCategory,
      ...result,
      pageWindow: buildPageWindow(page, result.pages || 1),
      /* The EFFECTIVE sort, not the requested one. `sort` is null when the
         visitor did not choose, and the model resolves it after counting
         results. Spreading ...result already carries the resolved value, but
         this line used to be a bare `sort,` that overwrote it — leaving the
         dropdown reading "Featured" above a popularity-ordered page. */
      sort: result.sort || sort || 'featured',
      brands, productTypes,
      model,
      modelColorMap,
      modelSizeMap,
      modelSizeImageMap,
      availableSizes,   // size chip filter — populated buckets only (Rule 10)
      familyHex: FAMILY_HEX,
      attrFilters,
      rangeFilters,
      minPrice, maxPrice,
      priceRange,
      availableBrands,
      attributeDefs,
      availableAttrValues,
      hasActiveFilters,
      // Primary color filter (Cabinet Color for vanities; Finish for all others)
      colorFamiliesConfig,
      colorFamilyActive:   colorFamilyParam,
      colorExactActive:    colorExactParam,
      availFinishes,
      availColorFamilies,  // distinct color_family keys — primary swatch visibility signal
      // Hardware finish filter (vanities only — secondary color layer)
      hwColorFamiliesConfig,
      hwColorFamilyActive: hwColorFamilyParam,
      hwColorExactActive:  hwColorExactParam,
      availHardwareFinishes,
      // Favorites
      savedProductIds,
      // Stone material swatches — tops category (cat 7) only
      stoneMaterialSwatches,
      stoneMaterialActive,
    });
  } catch (err) { next(err); }
};
