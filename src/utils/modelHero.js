'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   modelHero.js — which product a model card leads with

   A model card shows one image, one price, one highlighted finish and one
   highlighted size. Before this existed each of those four was chosen
   independently — cheapest price, smallest size, first swatch, and
   whichever image MIN() happened to land on — so a card could show one
   product's photo above another product's price.

   The hero is resolved once, here, and every card field comes from it.

   ── ORDER OF PREFERENCE ────────────────────────────────────────────────
     1. model_groups.default_sku   an explicit hand-picked choice
     2. highest demand_score       the best-selling variant nationally
     3. nothing                    caller falls back to its old behaviour

   ── WHY THIS IS A SHARED FILE ──────────────────────────────────────────
   The homepage carousel (homeController) and the model collection page
   (collectionsController) both render model cards from separate queries.
   Ranking them by demand in two places invites exactly the drift this
   codebase keeps producing: one page updated, the other left behind, both
   still rendering fine. One definition means the two cannot disagree.
   ═══════════════════════════════════════════════════════════════════════ */

const { modelKey, modelBrandPairs } = require('./modelKey');
const { SIZE_BUCKETS }              = require('../config/sizeBuckets');

/**
 * Resolve the hero product for each (model, brand) pair.
 *
 * @param pool       mysql2 pool
 * @param rows       rows carrying `model` and `brand`
 * @param overrides  optional { "Model||Brand": "SKU" } from model_groups.default_sku
 * @returns          { "Model||Brand": heroRow } — pairs with no usable
 *                   candidate are simply absent, never a partial object.
 */
async function fetchModelHeroes(pool, rows, overrides = {}) {
  const out = {};
  const { params, sql } = modelBrandPairs(rows);
  if (!params.length) return out;

  try {
    /* ROW_NUMBER over (model, brand) picks one winner per card in a single
       round trip. MariaDB 10.6 supports window functions.

       Candidates must carry width_in AND color: the card highlights a size
       chip and a finish swatch, both of which come from those columns, so
       a product missing either cannot drive the preselection and would
       leave the card half-defaulted — image from the hero, chips still on
       the old "first one wins". Requiring both also keeps parts and
       brackets out of the hero slot, since they carry neither.

       Tiebreak on price ASC so an unscored model still resolves to
       something stable rather than shuffling between deploys. */
    const [heroRows] = await pool.query(`
      SELECT sku, model, brand, color, width_in, price, compare_price, demand_score, image_url
      FROM (
        SELECT
          p.sku, p.model, p.brand, p.color, p.width_in,
          p.price, p.compare_price, p.demand_score,
          COALESCE(p.primary_image_url, MIN(pi.url)) AS image_url,
          ROW_NUMBER() OVER (
            PARTITION BY p.model, p.brand
            ORDER BY p.demand_score DESC, p.price ASC, p.id ASC
          ) AS rn
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        WHERE p.is_active = 1
          AND (p.model, p.brand) IN (${sql})
          AND p.width_in IS NOT NULL
          AND p.color    IS NOT NULL AND p.color <> ''
        GROUP BY p.id
      ) ranked
      WHERE rn = 1
    `, params);

    for (const r of heroRows) out[modelKey(r)] = r;
  } catch (err) {
    /* Non-fatal by design. Every card falls back to its previous
       behaviour rather than the section disappearing over a ranking
       nicety. Logged loudly because a silent empty result here looks
       identical to "no products are scored yet". */
    console.warn('[modelHero] demand ranking failed, cards fall back:', err.message);
    return {};
  }

  /* Hand-picked SKUs override the demand winner. Resolved separately and
     matched on (sku, model, brand) — the SKU is typed by hand in the
     admin, and a typo colliding with another model's product would
     otherwise put an unrelated vanity on the card. Matching all three
     makes a wrong SKU find nothing and leave the demand pick in place,
     which is the safe direction. */
  const wanted = Object.entries(overrides)
    .filter(([, sku]) => sku)
    .map(([key, sku]) => {
      const i = key.indexOf('||');
      return [sku, key.slice(0, i), key.slice(i + 2)];
    });

  if (wanted.length) {
    try {
      const ph = wanted.map(() => '(?,?,?)').join(',');
      const [pinned] = await pool.query(`
        SELECT p.sku, p.model, p.brand, p.color, p.width_in,
               p.price, p.compare_price, p.demand_score,
               COALESCE(p.primary_image_url, MIN(pi.url)) AS image_url
        FROM products p
        LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
        WHERE p.is_active = 1 AND (p.sku, p.model, p.brand) IN (${ph})
        GROUP BY p.id
      `, wanted.flat());
      for (const r of pinned) out[modelKey(r)] = r;
    } catch (err) {
      console.warn('[modelHero] default_sku lookup failed:', err.message);
    }
  }

  return out;
}

/* Raw width → size-chip bucket key.

   homeController and collectionsController had byte-identical copies of
   this. It lives here now because heroFields depends on it: a width that
   does not go through the SAME bucketing the chips were built with will
   never match a chip key, so the card keeps its first chip highlighted
   while the image and price come from the hero — half-defaulted, and
   indistinguishable from working. */
function toBucket(rawSize) {
  const b = SIZE_BUCKETS.find(x => rawSize >= x.min && rawSize <= x.max);
  if (!b) return null;
  const key = parseInt(b.label, 10) || 0;
  return key ? { label: b.label, key } : null;
}

/**
 * Shape a hero row into the fields the card templates read.
 *
 * Field names are default* rather than hero* because index.ejs already
 * ships reading them. One vocabulary across both templates matters more
 * than a tidier word.
 */
function heroFields(hero) {
  if (!hero) {
    return {
      defaultSku: null, defaultColor: null, defaultSizeKey: null,
      defaultPrice: null, defaultCompare: null, defaultImage: null,
    };
  }
  const bkt = hero.width_in != null ? toBucket(Math.round(Number(hero.width_in))) : null;

  /* No matching size chip → decline the hero entirely rather than apply
     it halfway. SIZE_BUCKETS is not continuous (33, 39, 45, 51, 57, 63,
     69 and 75–81 fall between buckets), so a hero at one of those widths
     would set the image and price while the size chip stayed on "first
     one wins" — a card whose photo and highlighted size describe
     different products. Falling all the way back is consistent and
     visible; falling back halfway is neither. */
  if (!bkt) {
    return {
      defaultSku: null, defaultColor: null, defaultSizeKey: null,
      defaultPrice: null, defaultCompare: null, defaultImage: null,
    };
  }

  return {
    defaultSku:     hero.sku,
    defaultColor:   hero.color,
    defaultSizeKey: bkt.key,
    defaultPrice:   hero.price         != null ? Number(hero.price)         : null,
    defaultCompare: hero.compare_price != null ? Number(hero.compare_price) : null,
    defaultImage:   hero.image_url || null,
  };
}

module.exports = { fetchModelHeroes, heroFields, toBucket };
