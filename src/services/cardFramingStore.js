'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   cardFramingStore.js — the measured framing for every card hero, held
   in memory.

   ── WHY THE WHOLE TABLE, NOT A JOIN ────────────────────────────────────

   The obvious shape is a LEFT JOIN onto the existing product query. It
   was rejected for a specific reason: collectionsController joins
   product_images in SIX places, homeController has its own per-slot
   fetches, and the bundle builder has more. Adding a join to each is six
   chances to add it to five of them — and the one that gets missed shows
   up as a single card that looks different from its neighbours, which is
   exactly the bug being fixed and exactly the kind nobody notices in
   review.

   So: one query, one map, every caller reads the same map.

   It is small enough to be uninteresting. 4,566 rows of seven short
   numbers is well under a megabyte, and it is measurements of images —
   it changes when a vendor replaces photography, which is roughly never
   between deploys.

   ── FAILURE IS SILENT AND SAFE ─────────────────────────────────────────

   Every failure path returns an empty map, and an empty map means
   `frameStyle()` returns '' and the card renders exactly what it renders
   today. A missing table, a database blip, an unmeasured product, a
   lifestyle shot — all of them degrade to today's markup rather than to
   a broken card. That is why this never throws.
   ═══════════════════════════════════════════════════════════════════════ */

const TTL_MS = 10 * 60 * 1000;

let cache = null;          // Map<source_url, row>
let loadedAt = 0;
let inFlight = null;       // de-dupes concurrent first loads on boot
let lastError = null;

function normaliseUrl(u) {
  if (!u) return '';
  /* Strip the query so a card asking for '...webp?width=800' matches the
     row stored as '...webp'. The templates append ?width= themselves and
     the measurement is a property of the image, not of the size served. */
  const s = String(u).trim();
  const q = s.indexOf('?');
  return q === -1 ? s : s.slice(0, q);
}

async function load(pool) {
  try {
    const [rows] = await pool.query(
      `SELECT source_url, src_w, src_h, fill_w, fill_h, off_x, off_y,
              bg_white, product_type
         FROM hero_card_framing
        WHERE bg_white = 1`);
    const m = new Map();
    for (const r of rows) {
      m.set(normaliseUrl(r.source_url), {
        src_w: Number(r.src_w), src_h: Number(r.src_h),
        fill_w: Number(r.fill_w), fill_h: Number(r.fill_h),
        off_x: Number(r.off_x), off_y: Number(r.off_y),
      });
    }
    lastError = null;
    return m;
  } catch (err) {
    /* Almost certainly "table doesn't exist" before the migration has
       been run. Recorded for /admin diagnostics, never thrown: a card
       grid must not 500 because a cosmetic lookup is unavailable. */
    lastError = err.message;
    return new Map();
  }
}

/** Warm the cache. Safe to call repeatedly; safe to never call. */
async function ensure(pool) {
  const fresh = cache && (Date.now() - loadedAt) < TTL_MS;
  if (fresh) return cache;
  if (inFlight) return inFlight;
  inFlight = load(pool).then((m) => {
    cache = m; loadedAt = Date.now(); inFlight = null;
    return m;
  });
  return inFlight;
}

/** Synchronous read for templates. Empty map until ensure() has run. */
function get(sourceUrl) {
  if (!cache) return null;
  return cache.get(normaliseUrl(sourceUrl)) || null;
}

function stats() {
  return { rows: cache ? cache.size : 0, loadedAt, lastError };
}

/** Test seam — lets the gate load a map without a database. */
function _setCache(map) { cache = map; loadedAt = Date.now(); }

module.exports = { ensure, get, stats, normaliseUrl, _setCache, TTL_MS };
