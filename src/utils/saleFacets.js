/* ═══════════════════════════════════════════════════════════════════════════
   saleFacets.js — the sidebar facets for the virtual /collections/sale page.

   WHY THIS IS A MODULE AND NOT INLINE IN THE CONTROLLER.

   Gates on this project execute pure functions and compare results. Logic
   living inline in a controller that opens a DB connection cannot be
   executed by a gate, so the only way to test it would be to re-implement it
   inside the gate — and a test that re-implements its subject agrees with the
   bug rather than catching it. That is Rule 18: the fixture invented the very
   property the implementation wrongly depended on, so the test and the bug
   agreed with each other and stayed green for four days.

   Same extraction pattern as src/utils/cartPricing.js, src/utils/inventory.js
   and src/services/orderEmails.js.

   WHY NOT THE Product MODEL.

   Product.findByCategory and Product.getAvailableWidths are keyed on
   category.id. /collections/sale is VIRTUAL — collectionsController short-
   circuits before any category lookup and renders with a synthetic category
   whose id is null. Passing null would match nothing, silently. The
   qualifying pool is capped at 300 rows by the SQL, so faceting it in memory
   costs one query instead of four and adds no SQL that, per Rule 14, no gate
   could verify.

   ⚠️ RULE 10 — EACH FACET IS COMPUTED WITHOUT ITS OWN FILTER.
   A facet list built from the already-filtered rows collapses to the single
   value the shopper just picked, so they cannot widen or change their choice
   without hitting Clear all. Brand options therefore come from the pool
   filtered by Type+Size+Price but NOT Brand, and so on for each. This mirrors
   what getAvailableWidths does on the grid path, where it deliberately runs
   the page's filters WITHOUT the size_in condition.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const { SIZE_BUCKETS } = require('../config/sizeBuckets');

const PER_PAGE = 48;

/** Query values arrive as a string, an array, or not at all. */
function asArray(v) {
  return [].concat(v == null ? [] : v).filter(x => x !== '' && x != null);
}

/**
 * ⚠️ parseFloat, NOT Number, AND THE DIFFERENCE IS THE WHOLE POINT.
 * `Number('')` is 0 — finite, in range, and therefore accepted as a real
 * bound — so an empty min_price would have filtered out every free or
 * zero-priced row. `parseFloat('')` is NaN, which this rejects. Same defect
 * family as the cleared-threshold box in collectionsController and the
 * Number(null) === 0 bug in src/config/inventoryRisk.js. Empty is not zero.
 */
function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * ⚠️ NULL IS REJECTED BEFORE Number(), AND THIS WAS A LIVE BUG FIRST TIME.
 * `Number(null)` is 0 — and 0 is finite and sits inside the first bucket,
 * which is `20-` at {min:0,max:22}. So every row with no width_in — every
 * faucet, every accessory, the whole non-vanity half of this page — matched
 * the 20-inch size filter and showed up in that bucket's facet. Caught by
 * the executed test, not by reading the code.
 *
 * Third sighting of this family in one scope: Number('') === 0 in the
 * discount threshold, Number('') === 0 in min_price, Number(null) === 0
 * here. Also the original defect in src/config/inventoryRisk.js.
 */
function widthInBucket(width, label) {
  const b = SIZE_BUCKETS.find(x => x.label === label);
  if (!b) return false;
  if (width == null || width === '') return false;
  const w = Number(width);
  return Number.isFinite(w) && w >= b.min && w <= b.max;
}

/** True when a row belongs to this bucket. ONE definition — the facet list
 *  and the filter must agree, or the sidebar offers a bucket that returns
 *  nothing when clicked. */
function rowInBucket(row, bucket) {
  return widthInBucket(row && row.width_in, bucket.label);
}

/**
 * @param {Array<object>} pool  qualifying rows: {brand, product_type, width_in, price}
 * @param {object} query        req.query
 */
function buildSaleView(pool, query) {
  const rows = Array.isArray(pool) ? pool : [];
  const q = query || {};

  const selBrands = asArray(q.brand);
  const selTypes  = asArray(q.type);
  const selSizes  = asArray(q.size_in);
  const minPrice  = numOrNull(q.min_price);
  const maxPrice  = numOrNull(q.max_price);

  const okBrand = p => !selBrands.length || selBrands.includes(p.brand);
  const okType  = p => !selTypes.length  || selTypes.includes(p.product_type);
  const okSize  = p => !selSizes.length  || selSizes.some(l => widthInBucket(p.width_in, l));
  const okPrice = p => {
    const v = parseFloat(p.price);
    /* An unpriced row is NOT hidden by a price filter. Treating a missing
       price as 0 would quietly drop it from every filtered view, which is
       how a product disappears with nothing on the page to explain why. */
    if (!Number.isFinite(v)) return true;
    if (minPrice != null && v < minPrice) return false;
    if (maxPrice != null && v > maxPrice) return false;
    return true;
  };

  // Rule 10: each facet excludes its own filter.
  const availableBrands = [...new Set(
    rows.filter(p => okType(p) && okSize(p) && okPrice(p))
        .map(p => p.brand).filter(Boolean)
  )].sort();

  const counts = new Map();
  for (const p of rows.filter(p => okBrand(p) && okSize(p) && okPrice(p))) {
    if (p.product_type) counts.set(p.product_type, (counts.get(p.product_type) || 0) + 1);
  }
  /* {value,count} is the shape the legacy Type group renders — the same
     shape the FAUCETS fixture uses. Not the generic attributeDefs loop:
     this collection has no attribute_definitions rows of its own. */
  const availableProductTypes = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => String(a.value).localeCompare(String(b.value)));

  const sizeRows = rows.filter(p => okBrand(p) && okType(p) && okPrice(p));
  /* Only POPULATED buckets, in SIZE_BUCKETS order — Rule 10, and Rule 13
     forbids rendering raw width_in. */
  const availableSizes = SIZE_BUCKETS
    .filter(b => sizeRows.some(p => rowInBucket(p, b)))
    .map(b => b.label);

  /* Bounds come from the UNFILTERED pool. Narrowing them as the shopper
     filters would move the slider's own range under them mid-interaction. */
  const prices = rows.map(p => parseFloat(p.price)).filter(Number.isFinite);
  const priceRange = prices.length
    ? { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) }
    : { min: 0, max: 9999 };

  const matched = rows.filter(p => okBrand(p) && okType(p) && okSize(p) && okPrice(p));

  /* Slices, never re-sorts: the SQL already ordered hand-picks first. */
  const pages = Math.max(1, Math.ceil(matched.length / PER_PAGE));
  const page  = Math.min(Math.max(1, parseInt(q.page, 10) || 1), pages);
  const products = matched.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const activeGroups = [
    selBrands.length > 0,
    selTypes.length  > 0,
    selSizes.length  > 0,
    minPrice != null || maxPrice != null,
  ].filter(Boolean).length;

  return {
    products,
    total: matched.length,
    page, pages, perPage: PER_PAGE,
    brands: selBrands,
    productTypes: selTypes,
    activeSizes: selSizes,
    minPrice: minPrice == null ? undefined : minPrice,
    maxPrice: maxPrice == null ? undefined : maxPrice,
    priceRange,
    availableBrands,
    availableProductTypes,
    availableSizes,
    activeGroups,
    hasActiveFilters: activeGroups > 0,
  };
}

module.exports = { buildSaleView, asArray, numOrNull, widthInBucket, rowInBucket, PER_PAGE };
