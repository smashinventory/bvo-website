'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   cardBadge.js — the corner badge on product and model cards

   Replaces a corner badge that read "Save $1,211" directly above a price
   row that also read "Save $1,211". Same number twice on the same card.

   ── EARNED, NOT DECORATIVE ─────────────────────────────────────────────
   Four of these make claims that can be false, so each card rotates only
   among the badges it actually qualifies for:

     All Wood / Furniture Grade / Solid Quality
        construction claims. James Martin vanities are "Wood, MDF" in this
        catalogue; ER Vanities are "Solid Wood, Plywood". Rotating these
        freely would put a solid-wood claim on MDF product about half the
        time. The model brief is explicit: never guess or infer material
        composition, a mistaken construction claim is legal exposure.

     Hot Seller / Popular / Trending
        performance claims. These need a real demand_score. A zero-score
        product showing "Hot Seller" is the same unearned badge we removed
        when BEST fired for anything with the Featured box ticked.

     Low Stock       qty 1–3. Zero is out of stock, which is a different
                     message, not a scarcity nudge.
     Multiple Colors 4+ finishes.
     Sale            an actual discount.

   Great Value and Designer Class are subjective and always eligible, so
   no card is ever left bare.

   ── STABLE, NOT RANDOM ─────────────────────────────────────────────────
   Chosen by hashing a key that belongs to the card, not by Math.random().
   A badge that changes on every refresh reads as broken, makes a card
   impossible to screenshot for an ad, and would flicker between "Trending"
   and "Low Stock" on the same product. Variety across cards is the goal;
   variety across page loads is a bug.
   ═══════════════════════════════════════════════════════════════════════ */

/* Material strings that support a solid-wood claim, and the ones that
   veto it. The veto is checked FIRST and wins: "Solid Wood, MDF" must not
   qualify just because it contains the words "solid wood". */
const WOOD_VETO    = /mdf|particle\s*board|particleboard|laminate|melamine|veneer/i;
const WOOD_SUPPORT = /solid\s*wood|plywood|hardwood|solid\s*(oak|maple|poplar|birch|ash)/i;

function isSolidWood(material) {
  if (!material) return false;              // unknown → not claimed
  if (WOOD_VETO.test(material)) return false;
  return WOOD_SUPPORT.test(material);
}

/* Always-available, no factual content. */
const NEUTRAL = ['Great Value', 'Designer Class'];

/**
 * @param ctx {
 *   key          string  stable per card — "Model||Brand" or a SKU
 *   onSale       bool
 *   qty          number|null
 *   colorCount   number
 *   material     string|null   primary_material
 *   demandScore  number
 * }
 * @returns string badge label
 */
function pickBadge(ctx = {}) {
  const eligible = [];

  /* Sale and New are ELIGIBLE, not automatic. Every featured product is
     currently discounted, so treating Sale as a short-circuit produced a
     row of four identical SALE pills — the repetition this badge exists
     to break. The saving is still stated in words next to the price, so
     nothing is lost when the corner shows something else. */
  if (ctx.onSale) eligible.push('Sale');
  if (ctx.isNew)  eligible.push('New');

  if (isSolidWood(ctx.material)) {
    eligible.push('All Wood', 'Furniture Grade', 'Solid Quality');
  }

  if (Number(ctx.demandScore) > 0) {
    eligible.push('Hot Seller', 'Popular', 'Trending');
  }

  if (Number(ctx.colorCount) >= 4) eligible.push('Multiple Colors');

  eligible.push(...NEUTRAL);

  /* Low Stock takes precedence over the rotation. It is rare, it is
     time-sensitive, and it is the only badge that tells a shopper
     something they cannot see elsewhere on the card. Remove this block to
     put it back into the general pool. */
  const q = Number(ctx.qty);
  if (Number.isFinite(q) && q > 0 && q < 4) return 'Low Stock';

  return eligible[hashIndex(String(ctx.key || ''), eligible.length)];
}

/* Small deterministic string hash (FNV-1a style). Same key always yields
   the same index, and near-identical keys land far apart, so adjacent
   cards in a carousel do not all show the same badge. */
function hashIndex(str, len) {
  if (len <= 0) return 0;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % len;
}

module.exports = { pickBadge, isSolidWood, hashIndex, NEUTRAL };
