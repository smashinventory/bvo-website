'use strict';
/* ──────────────────────────────────────────────────────────────────────────
   googleProductCategory.js — our product_type → Google product taxonomy.

   WHY THIS EXISTS AS CODE AND NOT AS A COLUMN
   `products.google_product_category` is populated on 5,035 of 6,059 active
   rows, and EVERY ONE OF THOSE VALUES IS INVALID. Verified 2026-09-30
   against Google's published taxonomy
   (google.com/basepages/producttype/taxonomy-with-ids.en-US.txt,
   version 2021-09-21):

     stored    Home & Garden > Bathroom > Bathroom Fixtures > Bathroom Vanities
     real      Furniture > Cabinets & Storage > Vanities > Bathroom Vanities   (2081)

     stored    Home & Garden > Kitchen & Dining > Kitchen Fixtures > Countertops
     real      Hardware > Building Materials > Countertops                     (2729)

   Neither stored path exists anywhere in the taxonomy. They are not
   mis-chosen categories, they are strings Google cannot resolve. On top of
   that the assignment was incoherent: 2,958 vanities carried the Countertops
   value while 1,241 identical products carried the Vanities one.

   So the feed derives the category here and ignores the column entirely.
   Backfilling the column is a separate, gated job — the feed being correct
   must not wait on 6,059 rows being rewritten.

   EVERY ID BELOW WAS READ OUT OF GOOGLE'S FILE, NOT RECALLED. If you add a
   product_type, look the ID up there too. A wrong category does not error
   anywhere: the item is accepted, serves against the wrong queries, and
   quietly underperforms. That is why the gate asserts total coverage rather
   than trusting this file to stay complete.
   ────────────────────────────────────────────────────────────────────────── */

/* id → human path. The path is carried for the comment value only; the feed
   emits the numeric id, which is what Google prefers and what cannot be
   mistyped into a near-miss string. */
const CATEGORIES = {
  2081:   'Furniture > Cabinets & Storage > Vanities > Bathroom Vanities',
  2729:   'Hardware > Building Materials > Countertops',
  595:    'Home & Garden > Decor > Mirrors',
  2032:   'Hardware > Plumbing > Plumbing Fixtures > Faucets',
  2206:   'Hardware > Plumbing > Plumbing Fixture Hardware & Parts > Shower Parts',
  504635: 'Hardware > Plumbing > Plumbing Fixture Hardware & Parts',
  574:    'Home & Garden > Bathroom Accessories',
  4700:   'Hardware > Hardware Accessories > Cabinet Hardware > Cabinet Knobs & Handles',
  5938:   'Furniture > Cabinets & Storage > Storage Cabinets & Lockers',
  6356:   'Furniture > Cabinets & Storage',
  441:    'Furniture > Benches',
};

/* product_type (exactly as stored, case-insensitively matched) → category id.
   Counts are from the 2026-09-30 dump and are a sanity anchor, not a rule. */
const BY_PRODUCT_TYPE = {
  /* Vanities — 4,604 rows. A cabinet sold without its top is still a vanity
     to a shopper searching for one, so cabinet-only lands here too rather
     than in generic storage. */
  'single sink vanity with top': 2081,   // 2,589
  'double sink vanity with top': 2081,   // 1,610
  'single sink cabinet only':    2081,   //   284
  'double sink cabinet only':    2081,   //   121

  /* Surfaces — 290 rows. Backsplash sits here deliberately: it is sold as a
     matched piece of the same slab, and Google has no backsplash leaf. */
  'stone top':       2729,               //   177
  'composite top':   2729,               //    26
  'countertop unit': 2729,               //    32
  'backsplash':      2729,               //    55

  'mirror': 595,                         //   120

  /* Faucets — 291 rows. Google does not split by room; one leaf covers all. */
  'bathroom faucets': 2032,              //   149
  'kitchen faucets':  2032,              //    84
  'tub fillers':      2032,              //    55
  'bar faucets':      2032,              //     3
  'laundry faucets':  2032,              //     2

  'shower fixtures':      2206,          //   376
  'plumbing accessories': 504635,        //    27  (the parent — these are mixed parts)
  'bathroom accessories': 574,           //    72

  'knobs & legs': 4700,                  //    21

  /* Casework — 61 rows. All read as storage furniture rather than vanities,
     because none of them hold a sink. */
  'storage cabinet': 5938,               //    37
  'linen cabinet':   5938,               //     5
  'side cabinet':    5938,               //     4
  'hutch':           5938,               //    15
  'drawer unit':     5938,               //     5

  /* A vanity's metal base is a furniture component with no better leaf.
     Table Legs (6911) was considered and rejected — these are full bases,
     not legs, and the parent is the honest answer. */
  'metal base': 6356,                    //    13

  'bench': 441,                          //     2
};

/* product_types that are deliberately NOT in the feed at all. Kept as an
   explicit list rather than a silent absence so the gate can tell "excluded
   on purpose" apart from "nobody mapped it yet" — the second is a bug and
   the first is a decision. */
const EXCLUDED_PRODUCT_TYPES = new Set([
  'sample',   // 3 rows. Stone chips. Low value, and a $0-ish item next to
              // $2,000 vanities drags the account's average and invites
              // policy attention for no return.
]);

function norm(t) {
  return String(t == null ? '' : t).trim().toLowerCase();
}

/** The Google category id for a product_type, or null if there is none. */
function categoryFor(productType) {
  const k = norm(productType);
  if (!k) return null;
  if (EXCLUDED_PRODUCT_TYPES.has(k)) return null;
  return BY_PRODUCT_TYPE[k] || null;
}

/** True when a product_type is excluded on purpose (not merely unmapped). */
function isExcluded(productType) {
  return EXCLUDED_PRODUCT_TYPES.has(norm(productType));
}

/** The human path for an id — used by the gate's output and by diagnostics. */
function pathFor(id) {
  return CATEGORIES[id] || null;
}

/** Every product_type this file knows how to place. */
function mappedTypes() {
  return Object.keys(BY_PRODUCT_TYPE);
}

module.exports = {
  CATEGORIES,
  BY_PRODUCT_TYPE,
  EXCLUDED_PRODUCT_TYPES,
  categoryFor,
  isExcluded,
  pathFor,
  mappedTypes,
};
