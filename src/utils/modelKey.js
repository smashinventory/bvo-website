'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   modelKey.js — the identity of a model card on BVO

   A model is identified by (model, brand). NEVER by model alone.

   ── WHY ────────────────────────────────────────────────────────────────
   ER Vanities and James Martin Vanities both sell a model called
   "Bristol". Until 78 ER SKUs loaded on 2026-09-05, model names happened
   to be globally unique and every per-model lookup keyed on the name got
   away with it. That assumption is gone.

   Keying a map on the name alone fails in one of two ways:

     ASSIGN  map[m] = x        last writer wins. Rows sort by brand, so
                               James Martin silently overwrote ER Vanities.
     PUSH    map[m].push(x)    worse, and less obvious — the two brands'
                               finishes concatenate, so a card shows a
                               merged swatch list and clicking one loads
                               the other brand's photography.

   The symptom that surfaced it: the ER Vanities Bristol card served
   images.salsify.com — James Martin's CDN — with James Martin's swatches
   and prices.

   ── THE TRAP WHEN APPLYING THIS ────────────────────────────────────────
   The row must actually CARRY brand. If the query does not SELECT p.brand,
   r.brand is undefined, the key degrades to "Bristol||undefined", every
   row collides again — and it looks exactly like the fix was never made.
   Check the SELECT before trusting the key.

   ── WHY THIS LIVES IN ITS OWN FILE ─────────────────────────────────────
   Three call sites need it: collectionsController (model-group cards and
   product cards), homeController (featured models and featured products),
   and the two templates build the same string inline. One definition means
   the format cannot drift between them — if it changes here it changes
   everywhere, and the templates are commented to point at this file.
   ═══════════════════════════════════════════════════════════════════════ */

/** Key for any per-model map. Pass a row carrying `model` and `brand`. */
const modelKey = r => `${r.model}||${r.brand}`;

/**
 * Distinct (model, brand) pairs from a set of rows, for composite SQL
 * matching:  WHERE (p.model, p.brand) IN ((?,?),(?,?),...)
 *
 * Returns { pairs, params, sql } where params is the flattened bind array
 * and sql is the placeholder string. Rows without a model are dropped.
 */
function modelBrandPairs(rows) {
  const pairs = [...new Map(
    (rows || [])
      .filter(r => r && r.model)
      .map(r => [modelKey(r), [r.model, r.brand]])
  ).values()];
  return {
    pairs,
    params: pairs.flat(),
    sql:    pairs.map(() => '(?,?)').join(','),
  };
}

module.exports = { modelKey, modelBrandPairs };
