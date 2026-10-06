'use strict';

/**
 * lookbookController.js
 * Visual gallery at /lookbook — bathroom vanity images with sidebar filters.
 * No prices, names, or descriptions — purely image-driven browsing.
 *
 * Filters:
 *   size          — width bucket labels from SIZE_BUCKETS (OR logic)
 *   color         — cabinet color_family key (OR logic)
 *   type          — product_type string (configuration); OR logic
 *   style         — EAV attr_key='style' value; OR logic
 *
 * Products limited to the bathroom-vanities source category.
 */

const { bvoPool }      = require('../config/database');
/* (model, brand) identity — see src/utils/modelKey.js. Two brands sell a
   "Bristol", so a model name alone is not a key on this site. */
const { modelKey, modelBrandPairs } = require('../utils/modelKey');
const { FAMILIES }     = require('../config/colorFamilies');
const { SIZE_BUCKETS } = require('../config/sizeBuckets');

const VANITY_SLUG = 'bathroom-vanities';
const LIMIT       = 72; // max products per page

const _BVO_STYLE_ORDER = [
  'Traditional', 'Transitional', 'Modern', 'Farmhouse', 'Mid-Century Modern',
  'Industrial', 'Coastal', 'Scandinavian', 'European / Old World',
];

const _CF_TYPES = [
  'Single Sink Vanity With Top',
  'Double Sink Vanity With Top',
  'Single Sink Cabinet Only',
  'Double Sink Cabinet Only',
];

exports.index = async (req, res, next) => {
  try {
    // ── Parse active filters ──────────────────────────────────────────
    const activeSizes  = [].concat(req.query.size  || []).filter(Boolean);
    const activeColors = [].concat(req.query.color || []).filter(Boolean);
    const activeTypes  = [].concat(req.query.type  || [])
                           .filter(v => _CF_TYPES.includes(v));
    const activeStyles = [].concat(req.query.style || []).filter(Boolean);

    const hasActiveFilters =
      activeSizes.length + activeColors.length +
      activeTypes.length + activeStyles.length > 0;

    // ── Fetch source category ─────────────────────────────────────────
    const [[cat]] = await bvoPool.query(
      'SELECT id FROM categories WHERE slug = ? LIMIT 1',
      [VANITY_SLUG]
    );
    const catId = cat ? cat.id : null;

    // ── Build WHERE — two parallel versions ───────────────────────────
    // pConds / pParams  → outer query  (table alias p.)
    // iConds / iParams  → inner subquery (bare column names, single table)
    // Both encode the same logical filters so the subquery picks only
    // representative products that actually satisfy the active filters.

    const pParams = [], iParams = [];
    // Always limit to vanity product types — tops, mirrors, faucets, etc. are excluded.
    const VANITY_TYPES_PH = _CF_TYPES.map(() => '?').join(',');
    const pConds = [
      'p.is_active = 1',
      `p.product_type IN (${VANITY_TYPES_PH})`,
    ];
    const iConds = [
      'is_active = 1',
      `product_type IN (${VANITY_TYPES_PH})`,
    ];
    pParams.push(..._CF_TYPES);
    iParams.push(..._CF_TYPES);
    if (catId) {
      pConds.push('p.category_id = ?'); pParams.push(catId);
      iConds.push('category_id = ?');   iParams.push(catId);
    }

    // Size — each bucket is an OR clause
    if (activeSizes.length) {
      const pSz = [], iSz = [];
      for (const label of activeSizes) {
        const bucket = SIZE_BUCKETS.find(b => b.label === label);
        if (!bucket) continue;
        if (bucket.max === Infinity) {
          pSz.push('p.width_in >= ?'); pParams.push(bucket.min);
          iSz.push('width_in >= ?');   iParams.push(bucket.min);
        } else {
          pSz.push('p.width_in BETWEEN ? AND ?'); pParams.push(bucket.min, bucket.max);
          iSz.push('width_in BETWEEN ? AND ?');   iParams.push(bucket.min, bucket.max);
        }
      }
      if (pSz.length) { pConds.push(`(${pSz.join(' OR ')})`); iConds.push(`(${iSz.join(' OR ')})`); }
    }

    // Color family
    if (activeColors.length) {
      const ph = activeColors.map(() => '?').join(',');
      pConds.push(`p.color_family IN (${ph})`); pParams.push(...activeColors);
      iConds.push(`color_family IN (${ph})`);   iParams.push(...activeColors);
    }

    // Configuration (product_type)
    if (activeTypes.length) {
      const ph = activeTypes.map(() => '?').join(',');
      pConds.push(`p.product_type IN (${ph})`); pParams.push(...activeTypes);
      iConds.push(`product_type IN (${ph})`);   iParams.push(...activeTypes);
    }

    // Vanity style (EAV) — inner query uses bare 'id' which refers to products.id
    if (activeStyles.length) {
      const ph = activeStyles.map(() => '?').join(',');
      pConds.push(`EXISTS (
        SELECT 1 FROM product_attribute_values pav
        WHERE pav.product_id = p.id AND pav.attr_key = 'style'
          AND pav.value_text IN (${ph})
      )`);
      pParams.push(...activeStyles);
      iConds.push(`EXISTS (
        SELECT 1 FROM product_attribute_values pav
        WHERE pav.product_id = id AND pav.attr_key = 'style'
          AND pav.value_text IN (${ph})
      )`);
      iParams.push(...activeStyles);
    }

    const PWHERE = pConds.join(' AND ');
    const IWHERE = iConds.join(' AND ');

    // ── Fetch one product per model ────────────────────────────────────
    // Inner subquery: MIN(id) per model within the active filters → one
    // representative per model that actually satisfies all active filters.
    // Products without a model value are excluded (too many one-off SKUs).
    const [products] = await bvoPool.query(`
      SELECT p.id, p.slug, p.model, p.brand, p.width_in, p.color_family, p.product_type
      FROM products p
      WHERE ${PWHERE}
        AND p.model IS NOT NULL AND p.model != ''
        AND p.id IN (
          SELECT COALESCE(
            MIN(CASE WHEN product_type LIKE '%Cabinet Only%' THEN id END),
            MIN(id)
          ) FROM products
          WHERE ${IWHERE}
            AND model IS NOT NULL AND model != ''
          GROUP BY model
        )
      ORDER BY p.is_featured DESC, p.model ASC
      LIMIT ${LIMIT}
    `, [...pParams, ...iParams]);

    // ── Fetch images from ALL variants + per-model color roster ──────────
    // For each model card we want:
    //   • Images from every variant, cabinet-only images first (so the first
    //     image the user sees is always the cabinet without a top).
    //   • Deduplicated by URL (many variants share the same hero shot).
    //   • The full list of cabinet colors the model is available in.
    if (products.length > 0) {
      /* BRAND-SCOPED 2026-09-05. These lookups matched on model alone, so an
         ER Vanities "Bristol" card collected James Martin's photography and
         colour swatches alongside its own. Same fault as the model-group and
         product-card maps — this page was not in the original inventory and
         was found by grepping for the shape of the others.

         p.brand is now selected on the outer query above. Without it every
         key would degrade to "Bristol||undefined" and the collision would
         return while looking fixed. */
      const { params: modelParams, sql: modelPairSql } = modelBrandPairs(products);

      // Variant IDs for image fetching.  Reuse IWHERE so the carousel only
      // shows images from variants that satisfy the active filters — e.g.
      // size=72 → only 72" variants of this model contribute images.
      // Cabinet-only variants are ordered first so their images lead.
      const [allVariants] = await bvoPool.query(`
        SELECT id, model, brand
        FROM products
        WHERE (model, brand) IN (${modelPairSql})
          AND ${IWHERE}
        ORDER BY model, brand,
                 CASE WHEN product_type LIKE '%Cabinet Only%' THEN 0 ELSE 1 END,
                 id ASC
      `, [...modelParams, ...iParams]);

      if (allVariants.length > 0) {
        const allIds = allVariants.map(v => v.id);
        const idPh   = allIds.map(() => '?').join(',');

        /* color_family added to the SELECT 2026-10-02 — the carousel now
           picks one image per colour before filling, so it has to know
           which colour each image belongs to. */
        const [imgRows] = await bvoPool.query(`
          SELECT pi.product_id, pi.url, p.model, p.brand, p.color_family
          FROM product_images pi
          JOIN products p ON p.id = pi.product_id
          WHERE pi.product_id IN (${idPh})
          ORDER BY p.model, p.brand,
                   CASE WHEN p.product_type LIKE '%Cabinet Only%' THEN 0 ELSE 1 END,
                   pi.is_primary DESC, pi.sort_order ASC, pi.id ASC
        `, allIds);

        /* ── THE CAROUSEL IS CAPPED. Added 2026-10-02. ──────────────────
           This loop used to accumulate EVERY image of EVERY variant under a
           model and put the whole list in the card's data-images attribute.

           What that actually shipped, measured on the live page:

             /lookbook HTML ............ 7,020 KB
             image URLs in attributes .. 55,429 across 41 cards
             of which data-images ...... 6,875 KB — 98% of the page
             median per card ........... 603
             largest card .............. 6,699  (Breckenridge)

           Seven megabytes of HTML on every visit, for a carousel nobody
           pages past the first few frames of. Sam spotted it from the "2/603"
           and "12/936" counters on the cards — the counter was the only
           visible symptom.

           It also retrospectively confirms a finding I had recorded as a
           false alarm: sitechecker reported "HTML 4.87 MB", I checked the
           HOMEPAGE (0.20 MB), and wrote it off. It was true, on a page I had
           not looked at. OPEN_ITEMS.md is corrected.

           SELECTION: ONE PER COLOUR, THEN FILL.
           Not simply the first N. The card shows colour swatches, and
           clicking one should have something distinct to show — taking the
           first N in query order can return a dozen frames of the same
           finish, because variants are ordered by product, not by colour.
           So: walk the rows in their existing priority order (cabinet-only
           first, then primary, then sort order), take the FIRST image of
           each colour family, then top up to the cap with whatever is left
           in that same order.

           The cap lives in one constant below. At 12 the page measures
           ~202 KB — the same weight as the homepage, a 97% reduction. */
        const LOOKBOOK_CARD_IMAGE_CAP = 12;

        const modelImages  = {};   // final, capped list per model
        const modelSeenUrl = {};   // URL dedupe — many variants share a hero shot
        const modelByColor = {};   // first image per colour family
        const modelRest    = {};   // everything else, in priority order

        for (const row of imgRows) {
          const k = modelKey(row);
          if (!modelSeenUrl[k]) {
            modelSeenUrl[k] = new Set();
            modelByColor[k] = new Map();
            modelRest[k]    = [];
          }
          if (modelSeenUrl[k].has(row.url)) continue;
          modelSeenUrl[k].add(row.url);

          /* A null/empty colour_family must not collapse every uncoloured
             variant into one bucket keyed "undefined" — that would reserve a
             single slot for all of them and push real colours out. Those go
             straight to the fill pile. */
          const cf = row.color_family || null;
          /* Each entry carries its colour, not just a URL. The card's colour
             swatches jump the carousel to that colour's frame, which needs a
             colour per image to find. Short keys (u, c) because this ships in
             a data- attribute on every card. */
          const entry = { u: row.url, c: cf };
          if (cf && !modelByColor[k].has(cf)) modelByColor[k].set(cf, entry);
          else                                modelRest[k].push(entry);
        }

        for (const k of Object.keys(modelSeenUrl)) {
          const perColour = [...modelByColor[k].values()];
          const picked    = perColour.slice(0, LOOKBOOK_CARD_IMAGE_CAP);
          /* Only fill if the colours did not already reach the cap. A model
             in 20 finishes shows 12 colours rather than 12 near-identical
             shots of the first one.

             The per-colour picks come FIRST on purpose: every swatch the card
             renders must have a frame to jump to, or clicking it does nothing.
             Measured on the live page — max 7 swatches on any card, and no
             card has more swatches than images — so with the colours leading,
             a dead swatch is not reachable. */
          for (const entry of modelRest[k]) {
            if (picked.length >= LOOKBOOK_CARD_IMAGE_CAP) break;
            picked.push(entry);
          }
          modelImages[k] = picked;
        }

        // Colors the model is available in (for card swatches).
        const [colorRows] = await bvoPool.query(`
          SELECT model, brand,
                 GROUP_CONCAT(DISTINCT color_family ORDER BY color_family) AS colors
          FROM products
          WHERE (model, brand) IN (${modelPairSql})
            AND is_active = 1
            ${catId ? 'AND category_id = ?' : ''}
            AND color_family IS NOT NULL AND color_family != ''
          GROUP BY model, brand
        `, [...modelParams, ...(catId ? [catId] : [])]);

        const modelColorMap = {};
        for (const row of colorRows) {
          modelColorMap[modelKey(row)] = row.colors ? row.colors.split(',') : [];
        }

        for (const p of products) {
          p.images      = modelImages[modelKey(p)]   || [];
          p.availColors = modelColorMap[modelKey(p)] || [];
        }
      }
    }

    // ── Available filter values (unfiltered — always show full set) ────
    const baseParams     = [];
    const baseConditions = ['p.is_active = 1'];
    if (catId) { baseConditions.push('p.category_id = ?'); baseParams.push(catId); }
    const BWHERE = baseConditions.join(' AND ');

    // Available color families in this category
    const [colorRows] = await bvoPool.query(
      `SELECT DISTINCT color_family FROM products p
       WHERE ${BWHERE} AND color_family IS NOT NULL ORDER BY color_family`,
      baseParams
    );
    const availColorKeys = colorRows.map(r => r.color_family);

    // Available styles in this category
    const [styleRows] = await bvoPool.query(
      `SELECT DISTINCT pav.value_text
       FROM product_attribute_values pav
       JOIN products p ON p.id = pav.product_id
       WHERE ${BWHERE} AND pav.attr_key = 'style' AND pav.value_text IS NOT NULL`,
      baseParams
    );
    const rawStyles  = styleRows.map(r => r.value_text);
    const availStyles = _BVO_STYLE_ORDER.filter(s => rawStyles.includes(s));

    // ── Color families config (cabinet type only) ──────────────────────
    const colorFamiliesConfig = FAMILIES
      .filter(f => f.type === 'cabinet' && availColorKeys.includes(f.key))
      .map(f => ({ ...f, isActive: activeColors.includes(f.key) }));

    // ── Total result count ────────────────────────────────────────────
    const [[{ total }]] = await bvoPool.query(
      `SELECT COUNT(*) AS total FROM products p WHERE ${PWHERE}`,
      pParams
    );

    // ── Render ────────────────────────────────────────────────────────
    const siteUrl = require('../utils/siteUrl').base();
    /* NO BreadcrumbList — lookbook.ejs renders no visible trail either.
       See the note in inspirationController.hub. */
    const sd     = require('../utils/structuredData');
    const jsonLd = sd.scriptTag(sd.pageGraph({
      url:      '/lookbook',
      name:     'Lookbook',
      settings: res.locals.settings,
    }));

    res.render('pages/lookbook', {
      jsonLd,
      layout:       'layouts/main',
      pageTitle:    'Lookbook | BathroomVanitiesOutlet.com',
      metaDesc:     'Browse our visual vanity lookbook — shop by size, color, configuration, and style. No distractions, just beautiful bathrooms.',
      canonicalUrl: `${siteUrl}/lookbook`,
      noindex:      false,
      products,
      total,
      activeSizes,
      activeColors,
      activeTypes,
      activeStyles,
      hasActiveFilters,
      sizeBuckets:        SIZE_BUCKETS,
      colorFamiliesConfig,
      availStyles,
      cfTypes:            _CF_TYPES,
    });
  } catch (err) {
    next(err);
  }
};
