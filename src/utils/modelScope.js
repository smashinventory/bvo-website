'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   modelScope.js — what a model card is allowed to be built from

   ── THE BUG THIS EXISTS TO END ─────────────────────────────────────────

   A model card ("The Bristol Collection") is assembled from FOUR separate
   queries: the facet list, the card row, the swatch/size/image map, and
   the hero that supplies image + price + colour + size. Each one had to
   restate which products were eligible. Nothing enforced that they agree.

   They drifted, repeatedly, and always the same way — the card ended up
   showing one product's photo above another product's price:

     2026-07-21  e5f8df4  mgCsRows had no category filter; vanity cards
                          rendered mirror photography on size-chip click.
     2026-07-30  53c0c29  type filter added to the model-group query —
                          but not to the maps beside it.
     2026-09-24           "mirrors have snuck back into the vanity/cabinet
                          collections", then "accessory cabinet is also
                          slipping in". modelHero.js gained a productTypes
                          parameter. It never gained a category one.
     2026-09-29           The Bristol card on /collections/vanity-models
                          shows a MIRROR's photo and its $388 price, over
                          a model whose real range in that category is
                          $1,608-$4,237. Same SKU as the September report.

   Every one of those was fixed. Every fix patched the ONE query that was
   visibly wrong that day, and the next feature that took over part of the
   card started from an unscoped query again. modelHero.js is the sharpest
   example: it was written specifically to stop a card mixing two products,
   and it reintroduced exactly that along a new axis, because it inherited
   the job of choosing the image and the price without inheriting the
   filters that decided which products were eligible.

   ── THE RULE ───────────────────────────────────────────────────────────

   ONE scope object per request. Every query that contributes to a model
   card derives its WHERE from it. A new query that needs eligibility asks
   this module; it does not write `category_id = ?` by hand.

   Adding a filter here changes all of them at once. That is the entire
   point — not tidiness.

   ── WHY UNSCOPED MUST BE SPELLED OUT ───────────────────────────────────

   fetchModelHeroes used to take `productTypes = []`, where empty meant
   "rank across everything". The call site read
   `fetchModelHeroes(pool, rows, overrides, mgActiveTypes)` and looked
   correct; on an unfiltered page mgActiveTypes is empty, so it ran
   completely unscoped. A parameter whose DEFAULT is the dangerous
   behaviour will eventually be defaulted.

   So a genuinely site-wide surface must say `unscoped: true` out loud. It
   is legitimate — a homepage section with no category filter really is
   site-wide — but it has to be typed, reviewed, and greppable.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Build a scope for one request.
 *
 * @param {object}  o
 * @param {number}  [o.categoryId]    products.category_id the card may draw from
 * @param {string}  [o.categorySlug]  alternative to categoryId; requires the
 *                                    categories join (see needsCategoryJoin)
 * @param {string[]}[o.productTypes]  optional narrowing, e.g. Cabinet Only
 * @param {string[]}[o.brands]        optional narrowing
 * @param {boolean} [o.unscoped]      explicit opt-out; see the header
 * @param {string}  [o.label]         where this came from, for log lines
 */
function createScope(o = {}) {
  const categoryId   = o.categoryId != null ? Number(o.categoryId) : null;
  const categorySlug = (o.categorySlug || '').trim() || null;
  const productTypes = (o.productTypes || []).filter(Boolean);
  const brands       = (o.brands       || []).filter(Boolean);
  const unscoped     = !!o.unscoped;

  /* A scope that names no category and does not admit to being unscoped
     is the exact mistake this module exists to catch. It is not thrown —
     a throw here takes a page down over a ranking nicety — but it is
     never treated as valid, and isBounded() below is what callers check. */
  const bounded = unscoped || categoryId != null || categorySlug != null;

  return {
    categoryId, categorySlug, productTypes, brands, unscoped,
    label: o.label || '(unlabelled)',

    /** True when this scope actually constrains anything, or says it means not to. */
    isBounded() { return bounded; },

    /** Does a query using this scope need `JOIN categories c`? */
    needsCategoryJoin() { return !!categorySlug && categoryId == null; },

    /**
     * SQL fragment, ANDed onto an existing WHERE.
     * @param {string} alias  table alias for products (default 'p')
     * @returns {{sql: string, params: any[]}}  sql begins with ' AND ' or is ''
     */
    where(alias = 'p') {
      const parts = [];
      const params = [];

      /* Category first: it is the guard that survives a page having no
         type filter at all, which is the state /collections/vanity-models
         is in and the reason the mirror got through. */
      if (categoryId != null) {
        parts.push(`${alias}.category_id = ?`);
        params.push(categoryId);
      } else if (categorySlug) {
        parts.push('c.slug = ?');
        params.push(categorySlug);
      }

      if (productTypes.length) {
        parts.push(`${alias}.product_type IN (${productTypes.map(() => '?').join(',')})`);
        params.push(...productTypes);
      }

      if (brands.length) {
        parts.push(`${alias}.brand IN (${brands.map(() => '?').join(',')})`);
        params.push(...brands);
      }

      return { sql: parts.length ? ' AND ' + parts.join(' AND ') : '', params };
    },

    /** Stable identity, for memoising queries across sections. */
    key() {
      return JSON.stringify([categoryId, categorySlug, productTypes, brands, unscoped]);
    },
  };
}

/** A scope object, or null. Used by callers to refuse to guess. */
function isScope(s) {
  return !!(s && typeof s.where === 'function' && typeof s.isBounded === 'function');
}

module.exports = { createScope, isScope };
