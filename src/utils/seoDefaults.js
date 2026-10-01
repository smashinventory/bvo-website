'use strict';
/**
 * Server-side SEO + GMC auto-fill defaults — mirrors the browser rule in admin-seo.js.
 *
 * Rule: fill empty fields only. Never overwrite a value already set.
 * Exception: identifier_exists is always recalculated (it's a derived fact, not an opinion).
 *
 * Used by:
 *   • adminController._extractProductFields()  — admin form saves
 *   • importJamesMartinFeed.upsertProduct()    — JM feed imports
 *   • (any future importer or API ingestion)
 */

/* THE product_type → Google category map lives in ONE file, and this is not
   it. See src/utils/googleProductCategory.js.

   On 2026-09-30 a second map was created there while this one still existed —
   two sources deriving one fact, breaking Rule 8 (one internal taxonomy) and
   Rule 10 (one canonical source per fact). This import is the repair: the map
   that used to sit below as GMC_CATEGORY_MAP is gone, and both this file and
   the Merchant Center feed now read the same table.

   Why that file is the home rather than this one: it is a dedicated, gated
   module whose ids were each read out of Google's published taxonomy, and it
   carries the deliberate-exclusion list too. This file is a grab-bag of SEO
   and GMC defaults; a taxonomy does not belong inside it, and the feed
   controller importing "seoDefaults" to get a category would be the wrong
   shape. Keeping the map here instead was the alternative and was rejected on
   those grounds, not on history — it did live here first. */
const gpc = require('./googleProductCategory');

const DESC_MAX = 125;  // First 125 chars + "…" keeps meta_desc under 160

/** Strip HTML tags and trim whitespace */
function clean(str) {
  return (str || '').replace(/<[^>]*>/g, '').trim();
}

/** Truncate to n chars. Adds suffix when text was cut. */
function trunc(str, n, suffix) {
  suffix = (suffix === undefined) ? '…' : suffix;
  const s = clean(str);
  if (!s) return '';
  return s.length > n ? s.slice(0, n).trimEnd() + suffix : s;
}

/**
 * Apply SEO defaults to a product data object.
 * Fills: meta_title, meta_desc — only if empty.
 *
 * @param  {object} d
 * @returns {object}
 */
function applyProductSeoDefaults(d) {
  // meta_title — fall back to product name
  if (!clean(d.meta_title)) {
    d.meta_title = clean(d.name || '') || null;
  }

  // meta_desc — fall back to short_desc, then long_desc (first 125 chars + "…")
  if (!clean(d.meta_desc)) {
    const src = clean(d.short_desc || '') || clean(d.long_desc || '');
    d.meta_desc = src ? trunc(src, DESC_MAX) : null;
  }

  return d;
}

/* ─────────────────────────────────────────────────────────────────
   Google Merchant Center defaults
   ───────────────────────────────────────────────────────────────── */

/* GMC_CATEGORY_MAP WAS HERE. REMOVED 2026-09-30 — do not reinstate it.

   It held fourteen keys mapping product_type to a Google taxonomy PATH, e.g.
   'single sink vanity with top' → 'Home & Garden > Bathroom > Bathroom
   Fixtures > Bathroom Vanities'. Two separate things were wrong with it, and
   both are worth knowing before anyone is tempted to bring it back:

   1. EVERY PATH IN IT WAS INVENTED. Checked against Google's published
      taxonomy (taxonomy-with-ids.en-US.txt, version 2021-09-21): neither
      "Home & Garden > Bathroom > Bathroom Fixtures > ..." nor
      "Home & Garden > Kitchen & Dining > Kitchen Fixtures > ..." exists. They
      read plausibly, which is exactly why they survived three rounds of
      maintenance (7fcf537, 8bb7729, db077a3). Google cannot resolve them, so
      5,035 product rows carry a category that means nothing.

   2. It covered 14 product_type keys against 27 in the live catalogue, and
      four of its keys ('vanity cabinet', 'medicine cabinet', 'light',
      'accessory') matched no live type at all. 900 active products therefore
      loaded a NULL category — all 376 Shower Fixtures, all 149 Bathroom
      Faucets, all 84 Kitchen Faucets, and so on — silently, because an
      unmapped key is indistinguishable from a deliberate null here.

   Replaced by googleProductCategory.js, which covers all 27 types and whose
   ids were each read out of Google's file rather than recalled. */

/**
 * Apply Google Merchant Center defaults to a product data object.
 * Fills empty GMC fields from existing product data.
 * identifier_exists is always recalculated (derived fact).
 *
 * Fields read:   product_type, upc, vendor_sku, mpn, ships_ltl,
 *                price, is_new, model, google_condition
 * Fields filled: google_product_category, google_condition, identifier_exists,
 *                mpn, shipping_label, custom_label_0–4
 *
 * @param  {object} d
 * @returns {object}
 */
function applyGmcDefaults(d) {
  /* google_product_category — derived from product_type via the ONE map.
     Now stores Google's NUMERIC ID (e.g. 2081), not a path string. The id is
     what the feed emits, what Google prefers, and the one form that cannot be
     subtly mistyped into something that looks right and resolves to nothing —
     which is precisely how the fourteen invented paths survived here for
     months.

     UNCHANGED ON PURPOSE: this still fills only when the field is EMPTY.
     Whether the column should instead become a derived cache that is
     recomputed on every sync is an open question for Sam (OPEN_ITEMS item 20)
     and is deliberately NOT decided here.

     CONSEQUENCE, KNOWN AND ACCEPTED: the column is mixed-format until the
     backfill runs — rows touched after this change hold an id, the 5,035
     untouched rows still hold an invalid path. Nothing reads the column
     (verified: never parsed, compared, or used in any WHERE/ORDER BY/GROUP BY
     anywhere in the codebase, and the feed derives its own), so mixed content
     is untidy rather than harmful. */
  if (!clean(d.google_product_category)) {
    d.google_product_category = gpc.categoryFor(d.product_type) || null;
  }

  // google_condition — always 'new' unless explicitly set to refurbished/used
  if (!d.google_condition || !['new', 'refurbished', 'used'].includes(d.google_condition)) {
    d.google_condition = 'new';
  }

  // mpn — fall back to vendor_sku if empty (vendor SKU = manufacturer part number for JM)
  if (!clean(d.mpn)) {
    d.mpn = clean(d.vendor_sku) || null;
  }

  // identifier_exists — always recalculate from resolved upc + mpn
  d.identifier_exists = (clean(d.upc) || clean(d.mpn)) ? 1 : 0;

  // shipping_label — derive from ships_ltl
  if (!clean(d.shipping_label)) {
    d.shipping_label = d.ships_ltl ? 'freight' : 'standard';
  }

  // custom_label_0 — price tier (for Google Shopping bid segmentation)
  if (!clean(d.custom_label_0)) {
    const p = parseFloat(d.price) || 0;
    d.custom_label_0 = p < 500 ? 'budget' : p <= 1500 ? 'mid-range' : 'premium';
  }

  // custom_label_1 — product_type (for campaign segmentation by product type)
  if (!clean(d.custom_label_1)) {
    d.custom_label_1 = clean(d.product_type) || null;
  }

  // custom_label_2 — new arrival flag
  if (!clean(d.custom_label_2)) {
    d.custom_label_2 = d.is_new ? 'new-arrival' : 'catalog';
  }

  // custom_label_3 — shipping method (for freight vs ground bid adjustments)
  if (!clean(d.custom_label_3)) {
    d.custom_label_3 = d.ships_ltl ? 'freight' : 'ground';
  }

  // custom_label_4 — model/collection name (for collection-level bid rules)
  if (!clean(d.custom_label_4)) {
    d.custom_label_4 = clean(d.model) || null;
  }

  return d;
}

module.exports = { applyProductSeoDefaults, applyGmcDefaults, trunc, clean };
