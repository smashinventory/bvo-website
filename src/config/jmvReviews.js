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
     gate asserts both are still 5 and 0.5, so loosening them fails CI rather
     than quietly shipping.

     ⚠️ THE FLOOR WAS 30 UNTIL 2026-11-06 (b3e66db). A sweep of all 40 James
     Martin collections found review counts collapse after the top three —
     Chicago carries 115 products on Ferguson and ONE review. A 30-review
     floor was not protecting the site from thin data, it was permanently
     hiding every collection except the three that happened to clear it.

     max_spread did NOT move with it, and that was deliberate: loosening the
     floor and the spread together would have been one change carrying two
     unrelated risks. */
  min_reviews: 5,
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

    /* ⚠️ THIS LIST IS THE FALLBACK, NOT THE LIVE SET. These three are what
       renders when jmv_review_pools cannot be read — a DB outage, or before
       the collector has run. The LIVE figures come from the database and
       there are more of them (Addison, Laurent, Lorelai, Breckenridge and
       others), so what a page shows today is NOT decided here.

       ⚠️ THE COUNTS HERE DRIFT, AND THAT IS TOLERATED. They were true on
       2026-11-06; the DB has since moved (Bristol reads 220 live against
       the 184 below). The fallback exists to keep the site truthful during
       an outage, not current — a slightly stale real number beats a blank.
       Refresh them at the quarterly re-check, not piecemeal.

       ── WHAT USED TO BE HERE, AND WHY IT IS GONE ──────────────────────
       A "DELIBERATELY ABSENT" block listed Lorelai and Breckenridge as
       excluded and ended "Adding either one fails the gate, which is the
       point — this comment is not the enforcement."

       Both are live today, and the comment was wrong on every count. The
       floor moved 30 -> 5 on 2026-11-06 (b3e66db), which let Lorelai's 10
       reviews through; Breckenridge is published through
       override_rating/override_count on jmv_review_collections, a dated
       human decision, because decide() still refuses its 0.84 spread.
       Neither change failed any gate, because the gate tracked the
       threshold rather than the exclusion.

       The comment outlived the decision it described and then asserted an
       enforcement that did not exist — exactly what it warned against. A
       future reader would have "corrected" a figure that was published on
       purpose. Removed 2026-11-12 rather than updated: the live set belongs
       in jmv_review_collections and in auditAll(), which reports every
       collection with its verdict and the reason it is dark. */
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

/* ═══════════════════════════════════════════════════════════════════════
 * THE DB-BACKED PATH
 *
 * Everything below is PURE: it takes rows in and returns a decision out,
 * touching no database and no settings file. That is what lets
 * gates/gate_structured_data.js prove the publish rules on a laptop with no
 * DB_PASS, which is the failure that broke the first push of this feature.
 * src/services/jmvReviewService.js does the querying and caching and then
 * calls these.
 * ═══════════════════════════════════════════════════════════════════════ */

/* The two rules that decide whether a number is honest enough to publish.
   Not in the database and not in the Theme Editor, on purpose: they are not
   a matter of taste, and the gate asserts these exact values. */
/* ⚠️ MIN_REVIEWS WAS 30 UNTIL 2026-11-06. Lowered to 5 by the owner after a
   full sweep of the ten largest collections found that review volume simply
   is not there: Chicago has 115 products on Ferguson and ONE review. At 30
   only three collections would ever qualify. At 5, Addison, Laurent and
   Lorelai become publishable too.
   The trade-off is accepted knowingly: a 5-review average is noisy, and one
   angry customer moves it visibly. The review COUNT is always shown beside
   the rating, so a reader can weigh it themselves — which is the thing that
   makes a low floor defensible rather than misleading. */
const THRESHOLDS = { MIN_REVIEWS: 5, MAX_SPREAD: 0.5 };

/* ── aggregate(rows) ──────────────────────────────────────────────────────
 * Rows are jmv_review_pools records: { retailer, pool_key, rating, count }.
 *
 * ⚠️ DEDUPED ON (retailer, pool_key) BEFORE ANYTHING IS SUMMED. Home Depot
 * surfaces ONE review pool against every finish of a model: six different
 * Brittany 36" listings all report 47 reviews at 4.5957 because it is one
 * pool shown six times. Summing listings instead of pools inflated Brittany
 * from 245 to roughly 900 in testing. The table's unique key already
 * prevents duplicates within a batch; this guards the case where rows arrive
 * from somewhere else, because a count that is four times too large would
 * look entirely plausible on the page.
 *
 * ⚠️ WEIGHTED BY COUNT, NEVER A MEAN OF MEANS. Averaging 4.86 (7 reviews)
 * with 4.55 (47 reviews) as equals would let a seven-review pool move the
 * published figure as much as a fifty-review one.
 */
function aggregate(rows) {
  const seen = new Set();
  const pools = [];
  for (const r of (rows || [])) {
    if (!r) continue;
    const rating = parseFloat(r.rating);
    const count  = parseInt(r.count != null ? r.count : r.review_count, 10);
    if (!isFinite(rating) || !isFinite(count) || count <= 0) continue;
    if (rating <= 0 || rating > 5) continue;
    const retailer = String(r.retailer || '').trim().toLowerCase();
    const key = retailer + '|' + String(r.pool_key || (rating + '/' + count));
    if (seen.has(key)) continue;
    seen.add(key);
    pools.push({ retailer, rating, count });
  }
  if (!pools.length) return null;

  const byRetailer = {};
  for (const p of pools) {
    const b = byRetailer[p.retailer] || (byRetailer[p.retailer] = { sum: 0, w: 0, pools: 0 });
    b.sum += p.rating * p.count; b.w += p.count; b.pools += 1;
  }
  for (const k of Object.keys(byRetailer)) {
    const b = byRetailer[k];
    b.rating = +(b.sum / b.w).toFixed(2);
    b.count  = b.w;
    delete b.sum; delete b.w;
  }

  const totalCount = pools.reduce((s, p) => s + p.count, 0);
  const rating     = pools.reduce((s, p) => s + p.rating * p.count, 0) / totalCount;

  /* Spread is only meaningful with two or more retailers. With one, it is 0
     and the spread rule cannot fire — which is correct, not a loophole: a
     single retailer cannot disagree with anyone. The volume floor still
     applies, and a one-retailer figure is flagged so it can be reported. */
  const names   = Object.keys(byRetailer);
  const avgs    = names.map(n => byRetailer[n].rating);
  const spread  = names.length > 1 ? +(Math.max(...avgs) - Math.min(...avgs)).toFixed(2) : 0;

  return {
    rating: +rating.toFixed(2),
    count:  totalCount,
    poolCount: pools.length,
    retailers: byRetailer,
    retailerCount: names.length,
    spread,
    singleRetailer: names.length < 2,
  };
}

/* ── decide(agg) ──────────────────────────────────────────────────────────
 * The publish verdict, with a REASON when the answer is no. The reason is
 * the point: a figure that vanishes with no explanation gets "fixed" by the
 * next person who looks at it.
 */
function decide(agg, thresholds) {
  const T = thresholds || THRESHOLDS;
  if (!agg) return { ok: false, reason: 'no review pools captured' };
  if (agg.count < T.MIN_REVIEWS) {
    return { ok: false, reason: `only ${agg.count} reviews, under the floor of ${T.MIN_REVIEWS}` };
  }
  if (!agg.singleRetailer && agg.spread > T.MAX_SPREAD) {
    const parts = Object.keys(agg.retailers)
      .map(n => `${n} ${agg.retailers[n].rating}`).join(' vs ');
    return { ok: false, reason: `retailers disagree by ${agg.spread} (${parts}), over the limit of ${T.MAX_SPREAD}` };
  }
  return { ok: true, reason: null };
}

/* ── present(rating, count, verifiedOn) ───────────────────────────────────
 * The shape the template renders. Star fill is a PERCENTAGE, never a rounded
 * star count: 4.3 drawn as five solid stars is a false claim, and on a star
 * row there is no room for a qualifier to soften it.
 */
function present(rating, count, verifiedOn) {
  const r = parseFloat(rating), c = parseInt(count, 10);
  if (!isFinite(r) || !isFinite(c)) return null;
  return {
    rating: r,
    count: c,
    fillPct: Math.max(0, Math.min(100, (r / 5) * 100)),
    ratingText: r.toFixed(1),
    verifiedOn: String(verifiedOn || '').trim(),
  };
}

module.exports = { DEFAULTS, resolve, THRESHOLDS, aggregate, decide, present };
