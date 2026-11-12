'use strict';

/* jmvReviewService.js — the James Martin review figures, read from the DB.
 *
 * Reads jmv_review_pools + jmv_review_collections, applies the pure rules in
 * src/config/jmvReviews.js, and hands collection.ejs a render-ready object.
 *
 * ⚠️ THE RULES ARE NOT IN THIS FILE, ON PURPOSE. The 5-review floor, the
 * 0.5 spread limit and the pool dedupe live in src/config/jmvReviews.js,
 * which requires nothing. That is what lets gates/gate_structured_data.js
 * prove them on a laptop with no DB_PASS — the exact failure that broke the
 * first push of this feature. If a threshold is ever written here as well,
 * the gate and the page will start disagreeing and the page will win
 * silently.
 */

const { bvoPool } = require('../config/database');
const jmv = require('../config/jmvReviews');

/* ── CACHE ────────────────────────────────────────────────────────────────
 * Model pages are storefront traffic. Two queries per request to render one
 * sentence would be absurd, so the whole (small) table is loaded once and
 * held. The figures change four times a year.
 *
 * ⚠️ A FAILED LOAD IS NOT CACHED. Caching a failure would pin the site to
 * the fallback until the next restart, and a transient DB blip at boot would
 * look exactly like "the feature is off" with nothing in the logs to say so.
 */
let _cache = null;
let _cachedAt = 0;
const TTL_MS = 10 * 60 * 1000;

function invalidate() { _cache = null; _cachedAt = 0; }

async function _load() {
  /* Published collections first — this is the switch that takes a wrong
     number off the site in one UPDATE, so it is queried, not derived. */
  const [cols] = await bvoPool.query(
    `SELECT brand, collection, is_published, override_rating, override_count,
            suppressed_reason
       FROM jmv_review_collections`
  );

  /* ⚠️ ONLY THE LATEST BATCH PER COLLECTION. jmv_review_pools keeps history
     on purpose, so a bare SELECT would sum February's pools onto November's
     and roughly double every count — a number that would look entirely
     plausible on the page. */
  const [pools] = await bvoPool.query(
    `SELECT p.brand, p.collection, p.retailer, p.pool_key,
            p.rating, p.review_count, p.capture_batch
       FROM jmv_review_pools p
       JOIN (SELECT brand, collection, MAX(capture_batch) AS latest
               FROM jmv_review_pools
              GROUP BY brand, collection) m
         ON m.brand = p.brand
        AND m.collection = p.collection
        AND m.latest = p.capture_batch`
  );

  const key = (b, c) => String(b || '').trim().toLowerCase() + '|' +
                        String(c || '').trim().toLowerCase();

  const byKey = new Map();
  for (const c of cols) {
    byKey.set(key(c.brand, c.collection), {
      brand: c.brand, collection: c.collection,
      isPublished: Number(c.is_published) === 1,
      overrideRating: c.override_rating, overrideCount: c.override_count,
      suppressedReason: c.suppressed_reason,
      pools: [], batch: null,
    });
  }
  for (const p of pools) {
    const hit = byKey.get(key(p.brand, p.collection));
    if (!hit) continue;                 // pools with no collections row stay dark
    hit.pools.push({ retailer: p.retailer, pool_key: p.pool_key,
                     rating: p.rating, count: p.review_count,
                     batch: String(p.capture_batch || '') });
  }

  /* ⚠️ THE BATCH FILTER IS ENFORCED HERE TOO, NOT ONLY IN THE SQL ABOVE.
     The query already joins to MAX(capture_batch), so today this is
     belt-and-braces — but it was caught by a test that stubbed the DB and
     returned two batches, and the service happily summed them. Any future
     edit to that query, a backfill written by someone else, or a second
     caller feeding rows in would silently add February's pools to
     November's. The failure mode is a review count roughly double the truth,
     on a page whose entire value is being accurate about numbers. Nothing
     about the page would look wrong. */
  for (const hit of byKey.values()) {
    if (!hit.pools.length) continue;
    const latest = hit.pools.reduce((m, p) => (p.batch > m ? p.batch : m), '');
    const before = hit.pools.length;
    hit.pools = hit.pools.filter(p => p.batch === latest);
    hit.batch = latest;
    if (hit.pools.length !== before) {
      console.warn(`[jmvReviews] ${hit.collection}: dropped ${before - hit.pools.length} ` +
                   `pool row(s) from older batches — the query should have excluded them.`);
    }
  }
  return byKey;
}

async function _cached() {
  if (_cache && (Date.now() - _cachedAt) < TTL_MS) return _cache;
  const loaded = await _load();
  _cache = loaded; _cachedAt = Date.now();   // only on success
  return loaded;
}

/* ── THE ONE PUBLIC READ ──────────────────────────────────────────────────
 * Returns the render object, or null. Never throws: a model page must not
 * 500 because a review figure could not be read.
 *
 * ⚠️ FALLBACK IS THE HARDCODED FIGURES, NOT BLANK. Until the collector has
 * run, jmv_review_pools is empty and every collection would otherwise go
 * dark — silently removing three verified, correct figures that are live
 * today. Falling back to jmvReviews.DEFAULTS keeps the site truthful during
 * the changeover. The fallback is also what answers a DB outage.
 */
async function forModel(brand, model, verifiedOn) {
  try {
    const map = await _cached();
    const hit = map.get(String(brand || '').trim().toLowerCase() + '|' +
                        String(model || '').trim().toLowerCase());

    /* No row at all, or no captured pools yet -> fall back. A row that
       exists and is explicitly UNPUBLISHED does NOT fall back: someone
       turned it off deliberately and must not be overridden by a default. */
    if (!hit) return _fallback(brand, model);
    if (!hit.isPublished) return null;

    /* An override is a number a human chose to stand behind. It still has to
       be a real number, but it bypasses the derived aggregate. */
    const oR = parseFloat(hit.overrideRating), oC = parseInt(hit.overrideCount, 10);
    if (isFinite(oR) && isFinite(oC)) {
      return jmv.present(oR, oC, verifiedOn || _batchLabel(hit.batch));
    }

    if (!hit.pools.length) return _fallback(brand, model);

    const agg = jmv.aggregate(hit.pools);
    const verdict = jmv.decide(agg);
    if (!verdict.ok) return null;        // the rules refused it; render nothing

    return jmv.present(agg.rating, agg.count, verifiedOn || _batchLabel(hit.batch));
  } catch (err) {
    /* Logged, not thrown, and NOT cached. */
    console.error('[jmvReviews] read failed, using fallback figures:', err.message);
    return _fallback(brand, model);
  }
}

function _fallback(brand, model) {
  return jmv.resolve(jmv.DEFAULTS, brand, model);
}

/* '2026-11' -> 'November 2026'. The page says a month, not a batch id. */
function _batchLabel(batch) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(batch || ''));
  if (!m) return '';
  const MON = ['January','February','March','April','May','June','July',
               'August','September','October','November','December'];
  return MON[+m[2] - 1] + ' ' + m[1];
}

/* ── ADMIN / REPORTING READ ───────────────────────────────────────────────
 * Every collection with its aggregate and verdict, including the refusals
 * and WHY. Built for an admin screen and for the quarterly refresh report:
 * "Breckenridge is dark because the retailers disagree by 1.14" is the
 * sentence that stops someone re-enabling it next quarter.
 */
async function auditAll() {
  const map = await _cached();
  const out = [];
  for (const hit of map.values()) {
    const agg = hit.pools.length ? jmv.aggregate(hit.pools) : null;
    const verdict = jmv.decide(agg);
    out.push({
      brand: hit.brand, collection: hit.collection,
      isPublished: hit.isPublished,
      batch: hit.batch,
      pools: hit.pools.length,
      rating: agg ? agg.rating : null,
      count: agg ? agg.count : null,
      retailers: agg ? agg.retailers : {},
      spread: agg ? agg.spread : null,
      singleRetailer: agg ? agg.singleRetailer : null,
      passesRules: verdict.ok,
      blockedBy: verdict.reason,
      suppressedReason: hit.suppressedReason,
      /* The combination worth seeing on an admin screen: the data says yes,
         the switch says no. That is either a deliberate hold or an oversight,
         and it should never be invisible. */
      liveNow: hit.isPublished && verdict.ok,
    });
  }
  return out.sort((a, b) => (b.count || 0) - (a.count || 0));
}

module.exports = { forModel, auditAll, invalidate, _batchLabel };
