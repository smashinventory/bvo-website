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

/** product_type → GMC taxonomy path (approved mapping, July 2026) */
const GMC_CATEGORY_MAP = {
  'vanity cabinet':   'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities',
  'linen cabinet':    'Home & Garden > Furniture > Cabinets & Storage',
  'medicine cabinet': 'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Mirrors',
  'mirror':           'Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Mirrors',
  'faucet':           'Hardware > Plumbing > Plumbing Fixtures > Faucets',
  'stone top':        'Home & Garden > Kitchen & Dining > Kitchen Fixtures > Countertops',
  'composite top':    'Home & Garden > Kitchen & Dining > Kitchen Fixtures > Countertops',
  'backsplash':       'Home & Garden > Kitchen & Dining > Kitchen Fixtures > Countertops',
  'light':            'Home & Garden > Lighting > Bathroom Lighting',
  'accessory':        'Home & Garden > Bathroom > Bathroom Accessories',
};

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
  // google_product_category — map from product_type
  if (!clean(d.google_product_category)) {
    const key = (d.product_type || '').toLowerCase().trim();
    d.google_product_category = GMC_CATEGORY_MAP[key] || null;
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
