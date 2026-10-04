'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   signupSources.js — what produced a customer account.

   WHY THIS IS A FILE AND NOT A STRING LITERAL AT EACH CALL SITE
   The whole value of the field is that the report can group by it. The
   moment one caller writes 'bundle' and another writes 'bundle_save',
   that report silently splits one real number into two smaller wrong
   ones, and nothing errors. A closed list with a normaliser makes that
   impossible: an unrecognised value becomes NULL and shows as "unknown"
   rather than inventing a new category.

   NULL IS A REAL AND HONEST ANSWER. Customers created before this field
   existed have no source and never will — it cannot be backfilled. The
   reports count them as unknown and say so, instead of guessing.

   ADDING A SOURCE: add the key here and nowhere else. The admin report
   reads this list, so a new source appears in the breakdown with no
   second edit. The DB column is VARCHAR(40) — keep keys short.
   ═══════════════════════════════════════════════════════════════════════ */

/* key -> label shown in the admin. Order is display order. */
const SOURCES = {
  bundle_save:    'Saved a bundle',
  sample_request: 'Requested samples',
  checkout:       'Placed an order',
  newsletter:     'Newsletter signup',
  favorite:       'Saved an item',
  direct:         'Signed up directly',
};

const KEYS = Object.keys(SOURCES);

/** Normalise anything to a known key, or NULL. Never throws, never invents. */
function clean(v) {
  const k = String(v || '').trim().toLowerCase();
  return KEYS.includes(k) ? k : null;
}

/** Display label for a stored value, including the NULL case. */
function label(v) {
  return SOURCES[clean(v)] || 'Unknown';
}

module.exports = { SOURCES, KEYS, clean, label };
