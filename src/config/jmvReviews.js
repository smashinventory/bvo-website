'use strict';

/* jmvReviews.js — the James Martin retailer review figures, and the rules that
 * decide whether one is honest enough to publish.
 *
 * ⚠️ THIS FILE REQUIRES NOTHING. No database, no settings service, no express.
 * That is the entire reason it exists as its own module rather than living in
 * themeSettings.js, where it started.
 *
 * gates/gate_structured_data.js has to re-derive these numbers to check them,
 * and gates run on a developer laptop with no DB_PASS in .env. Requiring
 * themeSettings pulls in src/config/database, which refuses to load without a
 * database password and takes the whole gate down with it — which is exactly
 * what happened on 2026-11-06, after every check passed in an environment that
 * happened to have DB_PASS set. A guard that only runs where the secrets are
 * is not a guard; it is a thing that runs on the server and nowhere else.
 *
 * themeSettings.js imports DEFAULTS from here and wraps resolve() so callers
 * keep one entry point. The data and the rules live here, once.
 */

/* ── THE FIGURES ──────────────────────────────────────────────────────────
   Collected by hand from Home Depot and Ferguson, 2026-11-06. See
   docs/SCHEDULED_jmv_review_figures_refresh.md for the quarterly re-check.

   ⚠️ KEYED BY BRAND *AND* MODEL, NOT MODEL ALONE. "Bristol" exists under BOTH
   James Martin Vanities and ER Vanities. A lookup on the model name would hand
   James Martin's 184 reviews to the ER Vanities Bristol page, and it would do
   it silently — the page renders, it just credits the wrong cabinet.
   collectionsController.js documents the same trap for model copy.

   ⚠️ `show` EXISTS BECAUSE A KEY IN DEFAULTS CAN NEVER BE DELETED.
   themeSettings.load() is deepMerge(DEFAULTS, file) and save() only ever SETS
   dot paths — there is no delete anywhere in it. So removing a figure from the
   admin is impossible; it would come straight back from here on the next load.
   Setting show:false is a value change, which does survive. This is the
   off-switch for "that number turned out wrong", and it has to work fast.

   hd / ferguson are the per-retailer figures the published `rating` came from.
   They are stored so the gate can CHECK the spread rule rather than take the
   author's word for it — a gate that cannot recompute what it guards is a
   decoration. */
const DEFAULTS = {
  enabled:     true,
  verified_on: 'November 2026',

  /* NOT surfaced in the Theme Editor, deliberately. These decide whether a
     number is honest enough to publish, which is not a matter of taste. The
     gate asserts both are still 30 and 0.5, so loosening them fails CI rather
     than quietly shipping. */
  min_reviews: 30,
  max_spread:  0.5,

  figures: {
    brittany: {
      show: true,  brand: 'James Martin Vanities', model: 'Brittany',
      rating: '4.5', count: '143', hd: '4.55', ferguson: '4.51',
    },
    bristol: {
      show: true,  brand: 'James Martin Vanities', model: 'Bristol',
      rating: '4.3', count: '184', hd: '4.31', ferguson: '4.24',
    },
    myrrin: {
      show: true,  brand: 'James Martin Vanities', model: 'Myrrin',
      rating: '4.9', count: '33',  hd: '5.00', ferguson: '4.83',
    },

    /* ── DELIBERATELY ABSENT ────────────────────────────────────────────
       Lorelai      — 12 reviews across both retailers, below min_reviews.
                      4.9 off 12 is noise wearing a decimal point.
       Breckenridge — 3.43 at Home Depot against 4.57 at Ferguson, a 1.14
                      spread. The combined 4.2 is arithmetically true and
                      misleading in both directions, and Breckenridge is the
                      #2 seller, so it is the worst possible place to publish
                      a number nobody can stand behind. Decided 2026-11-06.
                      Adding either one fails the gate, which is the point —
                      this comment is not the enforcement. */
  },
};

/* ── THE RESOLVER ─────────────────────────────────────────────────────────
 * The ONE answer to "does this model page get a review line, and what does it
 * say". collection.ejs renders from it and the gate re-checks it, so the rule
 * lives in exactly one place. Writing the threshold test twice is how a view
 * and a gate end up disagreeing about what is allowed, with the view winning
 * silently.
 *
 * Returns null — never a partial object — when anything disqualifies the
 * figure. There is no "show it but without the count" state, because the count
 * is what makes the claim mean anything.
 *
 * ⚠️ EVERY NUMBER MAY ARRIVE AS A STRING. themeSettings' setDotPath coerces
 * only 'true' and 'false', so a rating typed into the Theme Editor comes back
 * as '4.5', not 4.5. Comparing '4.5' < 30, or subtracting '4.55' - '4.51'
 * without parsing, gives answers that are wrong in ways that look right.
 */
function resolve(jr, brand, model) {
  const s = jr || {};
  if (s.enabled !== true) return null;

  const figs = s.figures || {};
  const b = String(brand || '').trim().toLowerCase();
  const m = String(model || '').trim().toLowerCase();
  if (!b || !m) return null;

  const hit = Object.keys(figs).map(k => figs[k]).find(f =>
    f && f.show === true &&
    String(f.brand || '').trim().toLowerCase() === b &&
    String(f.model || '').trim().toLowerCase() === m);
  if (!hit) return null;

  const rating = parseFloat(hit.rating);
  const count  = parseInt(hit.count, 10);
  const hd     = parseFloat(hit.hd);
  const fg     = parseFloat(hit.ferguson);
  if (!isFinite(rating) || !isFinite(count)) return null;
  if (rating <= 0 || rating > 5) return null;

  /* The two publish rules. Enforced HERE as well as in the gate, because the
     gate guards the repository and this guards a live admin edit — the Theme
     Editor can set a count to 4 at 2am with no CI run in between. */
  const minReviews = Number(s.min_reviews);
  const maxSpread  = Number(s.max_spread);
  if (!isFinite(minReviews) || !isFinite(maxSpread)) return null;
  if (count < minReviews) return null;
  if (isFinite(hd) && isFinite(fg) && Math.abs(hd - fg) > maxSpread) return null;

  return {
    rating, count,
    /* Star fill as a PERCENTAGE, not a rounded star count. 4.3 drawn as five
       solid stars is a false claim with no qualifier available to soften it. */
    fillPct:    Math.max(0, Math.min(100, (rating / 5) * 100)),
    ratingText: rating.toFixed(1),
    verifiedOn: String(s.verified_on || '').trim(),
  };
}

module.exports = { DEFAULTS, resolve };
