/* ═══════════════════════════════════════════════════════════════════════════
   saleRule.js — ONE definition of "this product is on the Deals page".

   WHY IT WAS EXTRACTED (task #365, 2026-10-24). /collections/sale is a
   VIRTUAL collection: sitemapController builds collection URLs by selecting
   from the `categories` table, and Sale has no row there, so the Deals page
   has never appeared in the sitemap. Google cannot find it.

   Adding the URL needs a decision — is the page worth submitting today? —
   and that decision is "does anything qualify". Answering it in the sitemap
   with its own copy of the WHERE clause would have created a second
   definition of "on sale" that drifts from the page the moment either is
   edited. That is the Rule 18 trap in its everyday form: not a test that
   re-implements its subject, but a second caller that does.

   So the predicate and the threshold live here, and both the Deals page and
   the sitemap import them.

   ⚠️ THE SQL FRAGMENT TAKES EXACTLY ONE PLACEHOLDER, the discount fraction,
   and it must be passed as a bound parameter. It is interpolated into a
   query string by both callers, so nothing user-supplied may ever be added
   to this constant.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

/* The shipped threshold: 37.5% off MSRP. */
const DEFAULT_DEALS_FRAC = 0.375;

/**
 * The qualifying rule, as a SQL fragment over `products p`.
 *
 * Hand-picked (is_deal) ignores the threshold entirely — the owner decides,
 * and a flagged product stays put even after a temporary James Martin
 * markdown reverts on the next feed run.
 *
 * compare_price > 0 is required, not merely NOT NULL: a zero MSRP divides by
 * zero and MariaDB returns NULL rather than erroring, so the row would
 * vanish with nothing to show why.
 */
const SALE_WHERE = `
  p.is_active = 1
  AND (
    p.is_deal = 1
    OR (
      p.compare_price IS NOT NULL
      AND p.compare_price > 0
      AND (p.compare_price - p.price) / p.compare_price >= ?
    )
  )`;

/**
 * Turn the Theme Editor's `seo.deals_min_discount_pct` into a fraction.
 *
 * PURE, and exported so a gate can execute the rule rather than match its
 * text. The subtleties below are the reason this is a function at all.
 *
 * ⚠️ EMPTY IS NOT ZERO, AND THIS WAS WRONG ONCE ALREADY. An earlier version
 * read Number(raw) on the assumption that a cleared Theme Editor box arrives
 * as '' -> NaN. It does not: Number('') is 0 — finite, in range, and
 * therefore ACCEPTED as a threshold of zero, which would dump every
 * discounted product in the catalogue onto the Deals page. Triggered by the
 * most ordinary admin action there is: clearing a box.
 *
 * Same family as Number(null) === 0 in src/config/inventoryRisk.js, and as
 * the undefined-column defects in SESSION_HANDOFF §6.
 *
 * A deliberate 0 is still honoured — "show everything" is a legitimate thing
 * to ask for — but it has to be TYPED, not left blank.
 */
function fracFromSetting(raw) {
  const pct = (raw === '' || raw === null || raw === undefined) ? NaN : Number(raw);
  return (Number.isFinite(pct) && pct >= 0 && pct <= 100)
    ? pct / 100
    : DEFAULT_DEALS_FRAC;
}

module.exports = { SALE_WHERE, DEFAULT_DEALS_FRAC, fracFromSetting };
